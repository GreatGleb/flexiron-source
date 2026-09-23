#!/usr/bin/env python3
"""Bounded, sequential Codex pilot. No model calls without --run.

Run in a dedicated clean checkout on auto/*, with logs outside that checkout.
The controller owns logs, checks, and commits; agents only edit task files.
"""

import argparse
import concurrent.futures
import fcntl
import json
import math
import os
from pathlib import Path
import re
import shutil
import signal
import stat
import subprocess
import sys
import tarfile
import time


HERE = Path(__file__).resolve().parent
# Промпт проверяющего несёт дифф и хвосты логов; обрезка — чтобы одна огромная правка
# не вытеснила из контекста саму задачу.
DIFF_LIMIT = 120_000
LOG_TAIL_LIMIT = 2_000
sys.path.insert(0, str(HERE))
from headless_backends import ROLES, load_routing  # noqa: E402  (нужен HERE в sys.path)

SCHEMA = {
    "type": "object",
    "properties": {
        "status": {"type": "string", "enum": ["done", "blocked"]},
        "summary": {"type": "string"},
        "evidence": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["status", "summary", "evidence"],
    "additionalProperties": False,
}


class CommandFailed(RuntimeError):
    """A process exited unsuccessfully (distinct from timeout or launch failure)."""


def git(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args], text=True)


def changed(root):
    tracked = git(root, "diff", "--name-only", "-z", "HEAD").split("\0")
    untracked = git(root, "ls-files", "--others", "--exclude-standard", "-z").split("\0")
    return set(filter(None, tracked + untracked))


def git_state(root):
    return (git(root, "rev-parse", "HEAD"), git(root, "branch", "--show-current"),
            git(root, "write-tree"))


def dependencies(queue):
    """Explicit dependencies plus earlier producers of files this task uses."""
    tasks = queue["tasks"]
    ids = {task["id"] for task in tasks}
    result = {}
    for index, task in enumerate(tasks):
        deps = task.get("depends_on", [])
        if not isinstance(deps, list) or not all(isinstance(x, str) for x in deps):
            raise ValueError("depends_on должен быть списком id")
        deps = set(deps)
        if deps - ids or task["id"] in deps:
            raise ValueError(f"Неизвестная зависимость или ссылка на себя: {task['id']}")
        used = set(task["sources"] + task["outputs"])
        deps.update(t["id"] for t in tasks[:index] if used.intersection(t["outputs"]))
        result[task["id"]] = deps
    return result


def ordered_tasks(queue, deps):
    pending, done, ordered = list(queue["tasks"]), set(), []
    while pending:
        task = next((t for t in pending if deps[t["id"]] <= done), None)
        if task is None:
            raise ValueError("Цикл зависимостей в очереди")
        pending.remove(task)
        ordered.append(task)
        done.add(task["id"])
    return ordered


def file_snapshot(root):
    result = {}
    for name in changed(root):
        path = root / name
        if path.is_symlink():
            result[name] = ("symlink", os.readlink(path))
        elif path.is_file():
            result[name] = (stat.S_IMODE(path.stat().st_mode), path.read_bytes())
        elif not path.exists():
            result[name] = None
        else:
            raise RuntimeError(f"Неподдерживаемый результат задачи: {name}")
    return result


def validate_checks(root, checks):
    if not isinstance(checks, list):
        raise ValueError("checks должен быть списком команд")
    for check in checks:
        if not isinstance(check, dict) or set(check) != {"cwd", "argv"}:
            raise ValueError("Проверка требует только cwd и argv")
        cwd, argv = check["cwd"], check["argv"]
        if (not isinstance(cwd, str) or Path(cwd).is_absolute() or ".." in Path(cwd).parts
                or not (root / cwd).resolve().is_relative_to(root) or not (root / cwd).is_dir()):
            raise ValueError("Рабочая папка проверки должна существовать внутри checkout")
        if not isinstance(argv, list) or not argv or not all(isinstance(x, str) and x for x in argv):
            raise ValueError("argv проверки должен быть непустым списком строк")
        executable = str((root / cwd / argv[0]).resolve()) if "/" in argv[0] else argv[0]
        if not shutil.which(executable):
            raise ValueError(f"Не найден исполнитель проверки: {argv[0]}")


def execute_checks(root, checks, prefix, deadline):
    for number, check in enumerate(checks):
        execute(check["argv"], root / check["cwd"],
                prefix.with_name(f"{prefix.name}-{number}"), deadline)


def link_report(root, doc, prefix, deadline):
    """Сколько ссылок документа не резолвится. Отсутствующий документ — ноль битых.

    Считается ДО и ПОСЛЕ правки, потому что судить автора по всему файлу нельзя:
    планы этого проекта копили битые ссылки годами, и первая же задача, тронувшая
    такой файл, блокировалась за чужую гниль. Критерий — «не стало больше».
    Проверка идёт без CONTRACT_REFS_STRICT: нужен счёт, а не падение спека.
    """
    if not (root / doc).is_file():
        return 0
    execute(["env", f"CONTRACT_REFS={doc}", "./node_modules/.bin/vitest", "run",
             "src/services/contractRefs.spec.ts"], root / "frontend_vue", prefix, deadline)
    report = prefix.with_suffix(".stdout.log").read_text(errors="replace")
    found = re.findall(r"\[ссылки\][^\n]*битых (\d+)", report)
    if not found:
        raise CommandFailed(f"Проверка ссылок не дала отчёта по {doc}; см. {prefix.name}")
    return int(found[-1])


def disjoint_batch(candidates, size):
    """Сколько задач можно писать одновременно: те, что не делят ни одного файла.

    Владение файлом — единственный критерий. Два автора в одном файле затрут друг
    друга молча, и ни одна из проверок ядра этого не увидит: каждая правка сама по
    себе выглядит законной.
    """
    batch, owned = [], set()
    for task in candidates:
        files = set(task["outputs"])
        if files & owned:
            continue
        batch.append(task)
        owned |= files
        if len(batch) >= size:
            break
    return batch


def write_author(root, backends, task, run_dir, deadline):
    """Автор работает в своём worktree, а не в общем дереве.

    Возвращает (результат, патч). Патч применяется в checkout позже и по одному:
    параллелен здесь только автор, всё остальное — проверки, приёмка, коммит —
    остаётся последовательным, иначе `npm run verify` погонит чужую недописанную
    работу и упадёт не по своей причине.
    """
    worktree = run_dir / f'wt-{task["id"]}'
    git(root, "worktree", "add", "--detach", str(worktree), "HEAD")
    modules = root / "frontend_vue/node_modules"
    if modules.is_dir():
        # Без него автор потратит ходы на попытки запустить проверки, которые
        # всё равно выполняет контроллер.
        (worktree / "frontend_vue/node_modules").symlink_to(modules)
    before = git_state(worktree)
    result = ask_agent(worktree, backends, task, "work", run_dir, deadline)
    if git_state(worktree) != before:
        raise RuntimeError(f'{task["id"]}: исполнитель изменил Git в своём worktree')
    outside = changed(worktree) - set(task["outputs"])
    if outside:
        raise RuntimeError(f'{task["id"]}: исполнитель изменил файлы вне задачи: {sorted(outside)}')
    touched = sorted(changed(worktree))
    patch = None
    if touched:
        # add нужен, чтобы в патч попали новые файлы: git diff их не видит.
        execute(["git", "add", "--", *touched], worktree, run_dir / f'{task["id"]}-stage-wt', deadline)
        patch = run_dir / f'{task["id"]}.patch'
        patch.write_bytes(subprocess.check_output(["git", "-C", str(worktree), "diff", "--cached", "--binary"]))
    return result, patch


def drop_worktrees(root, run_dir):
    for worktree in sorted(run_dir.glob("wt-*")):
        subprocess.run(["git", "-C", str(root), "worktree", "remove", "--force", str(worktree)],
                       capture_output=True)
    subprocess.run(["git", "-C", str(root), "worktree", "prune"], capture_output=True)


def spent_tokens(backends, run_dir):
    """Сколько токенов потрачено прогоном на бэкенды, идущие в счёт потолка.

    Считается по логам вызовов, а не накапливается в памяти: остановленный и
    возобновлённый прогон видит тот же расход, что и непрерывный.
    """
    total = 0
    for path in sorted(run_dir.glob("*.stdout.log")):
        match = re.fullmatch(r".*-(work|review)(?:-retry-\d+)?\.stdout\.log", path.name)
        role = match.group(1) if match else None
        if role and backends[role].metered:
            total += backends[role].tokens(Path(str(path)[: -len(".stdout.log")]))
    return total


def link_documents(task):
    return [name for name in task["outputs"] if name.endswith(".md")]


def preflight(root, queue, backends, retry=None):
    if Path(git(root, "rev-parse", "--show-toplevel").strip()).resolve() != root:
        raise ValueError("--workspace должен указывать на корень checkout")
    if not git(root, "branch", "--show-current").strip().startswith("auto/"):
        raise ValueError("Нужен отдельный checkout на ветке auto/*")
    if not retry and git(root, "status", "--porcelain").strip():
        raise ValueError("Checkout содержит несохранённые изменения; ничего не спрятано и не удалено")
    for role in ROLES:
        backends[role].check()
    for key in ("user.name", "user.email"):
        if not git(root, "config", "--get", key).strip():
            raise ValueError(f"Не задан git {key}")
    ids = set()
    validate_checks(root, queue.get("baseline_checks", []))
    for task in queue["tasks"]:
        task_id = task["id"]
        if not task_id or any(c not in "abcdefghijklmnopqrstuvwxyz0123456789-" for c in task_id):
            raise ValueError("Некорректный id задачи")
        if task_id in ids or not task["outputs"]:
            raise ValueError("Повтор id или пустой список outputs")
        ids.add(task_id)
        validate_checks(root, task.get("checks", []))
        if any(Path(name).parts[0] == "backend" for name in task["outputs"]) and not task.get("checks"):
            raise ValueError(f"Backend-задача {task_id} требует явных машинных checks")
        for name in task["sources"] + task["outputs"]:
            path = root / name
            if Path(name).is_absolute() or ".." in Path(name).parts or not path.resolve().is_relative_to(root):
                raise ValueError(f"Путь за пределами checkout: {name}")
    if not queue["tasks"]:
        raise ValueError("Пустая очередь")
    deps = dependencies(queue)
    available = set()
    for task in ordered_tasks(queue, deps):
        for name in task["sources"]:
            if not (root / name).is_file() and name not in available:
                raise ValueError(f"Нет источника: {name}")
        available.update(task["outputs"])


def retry_checkpoint(root, queue, previous):
    state = json.loads((previous / "state.json").read_text())
    if state["status"] != "stopped" or Path(state["workspace"]).resolve() != root:
        raise ValueError("Повторная приёмка требует остановленного прогона этого checkout")
    if json.loads((previous / "queue.json").read_text()) != queue:
        raise ValueError("Очередь изменилась после остановки")
    tasks = ordered_tasks(queue, dependencies(queue))
    completed = [t["task"] for t in state["completed"]]
    resolved = set(completed) | {t["task"] for t in state.get("blocked", []) + state.get("waiting", [])}
    remaining = [t for t in tasks if t["id"] not in resolved]
    if not remaining or state["current"] != remaining[0]["id"]:
        raise ValueError("Контрольная точка не соответствует очереди")
    if completed != [t["id"] for t in tasks if t["id"] in completed]:
        raise ValueError("Завершённые задачи не соответствуют очереди")
    expected_head = state["completed"][-1]["commit"] if completed else state["baseline"]
    if git(root, "rev-parse", "HEAD").strip() != expected_head or git(root, "diff", "--cached").strip():
        raise ValueError("HEAD или индекс изменились после остановки")
    task = remaining[0]
    if not changed(root) or changed(root) - set(task["outputs"]):
        raise ValueError("Изменения для повторной приёмки выходят за область задачи")
    work = json.loads((previous / f'{task["id"]}-work.json').read_text())
    if work.get("status") != "done":
        raise ValueError("Нет завершённого результата исполнителя")
    return state


def execute(command, root, prefix, deadline, prompt=None):
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError("Лимит времени исчерпан")
    with prefix.with_suffix(".stdout.log").open("xb") as out, prefix.with_suffix(".stderr.log").open("xb") as err:
        proc = subprocess.Popen(command, cwd=root, stdin=subprocess.PIPE if prompt else subprocess.DEVNULL,
                                stdout=out, stderr=err, start_new_session=True)
        try:
            proc.communicate(prompt.encode() if prompt else None, timeout=remaining)
        except BaseException:
            # Kill the whole process group, including tests started by the agent.
            try:
                os.killpg(proc.pid, signal.SIGTERM)
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(proc.pid, signal.SIGKILL)
                proc.wait()
            except ProcessLookupError:
                pass
            finally:
                # The parent may exit before descendants that ignored SIGTERM.
                try:
                    os.killpg(proc.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            raise
    if proc.returncode:
        raise CommandFailed(f"Команда завершилась с кодом {proc.returncode}: {prefix.name}; см. логи")


def service_error_kind(log):
    """Only CLI error events, never text printed by a repository command."""
    if not log.is_file():
        return None
    for line in reversed(log.read_text(errors="replace").splitlines()):
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(event, dict) or event.get("type") not in ("error", "turn.failed"):
            continue
        value = event.get("error", event.get("message"))
        for _ in range(5):
            if isinstance(value, str):
                try:
                    value = json.loads(value)
                    continue
                except json.JSONDecodeError:
                    if "stream disconnected before completion" in value.lower():
                        return "stream_disconnected"
                    break
            if not isinstance(value, dict):
                break
            if value.get("code") == "unsupported_parameter" and value.get("param") == "access_programs.cyber":
                return "unsupported_access_program"
            if value.get("code") in ("server_error", "internal_server_error", "service_unavailable", "rate_limit_exceeded"):
                return value["code"]
            if "code" in value:
                break  # Authentication, quota and unrelated invalid requests are not retried.
            value = value.get("error", value.get("message"))
        # Only the last error is authoritative; an earlier transient error may
        # have been followed by an authentication or quota refusal.
        return None
    return None


def ask_agent_once(root, backends, task, role, run_dir, deadline, attempt=1):
    suffix = "" if attempt == 1 else f"-retry-{attempt}"
    prefix = run_dir / f'{task["id"]}-{role}{suffix}'
    result_path = prefix.with_suffix(".json")
    instruction = (
        "Ты запущен скриптом в автономном режиме. Прочитай ROO.md, "
        "roo_code/skills/vue-rules.md и roo_code/skills/verify.md, затем применимые навыки. "
        "Задача и критерии ниже. Актуальные решения владельца из реестра (включая новые "
        "дополнения после опросника) и заполненные ответы имеют "
        "приоритет над старыми вопросами и рекомендациями. Не придумывай продуктовые решения. "
        "Не используй старые /tmp/night-queue-briefs. Источники читай из этого checkout. "
        "Не изменяй ответы владельца, файлы вне outputs, Git, зависимости, конфигурацию инструментов "
        "и скрипты workflow. Доменные файлы внутри outputs изменять разрешено. "
        "Не делай коммит, merge, push, deploy и не запускай вложенных агентов. "
        "Если не хватает продуктового решения или нельзя завершить разрешённые правки — "
        "status=blocked с точной причиной. "
        "Доказательства — команды и реальные файлы; не сочиняй машинный вывод. "
        "Ничего не спрашивай в чате. Верни JSON по схеме.\n"
    )
    if role == "review":
        instruction += (
            "Ты независимый проверяющий. Не меняй файлы. Проверь git diff HEAD, каждый критерий "
            "задачи, согласованность источников и ссылки. Не доверяй выводу автора. "
            "done допустим только при выполнении всех критериев и непустых доказательствах.\n"
            "Машинные проверки уже выполнены контроллером на текущих файлах. "
            "Прочитай их реальные stdout/stderr по указанным ниже путям. "
            "Не запускай npm/Vitest и другие проверки, создающие кэш: твой sandbox read-only. "
            "Самостоятельно проверь содержание и ссылки чтением исходников.\n"
        )
        # Дифф и хвосты проверок кладутся в промпт целиком: у проверяющего уходило
        # 27-42 хода, и половина из них — поиск того, что уже лежало у контроллера.
        diff = git(root, "diff", "HEAD")
        if len(diff) > DIFF_LIMIT:
            diff = diff[:DIFF_LIMIT] + f"\n… дифф обрезан на {DIFF_LIMIT} символах, полностью — git diff HEAD\n"
        instruction += "\n=== Дифф работы (git diff HEAD) ===\n" + diff + "\n"
        logs = sorted(run_dir.glob(f'{task["id"]}-check*.stdout.log'))
        instruction += "\n=== Хвосты машинных проверок ===\n"
        for log in logs:
            tail = log.read_text(errors="replace")[-LOG_TAIL_LIMIT:]
            instruction += f"--- {log.name} ---\n{tail}\n"
        full = sorted(run_dir.glob(f'{task["id"]}-check*.log'))
        instruction += "Полные логи (включая stderr): " + ", ".join(str(p) for p in full) + "\n"
    else:
        instruction += (
            "Ты исполнитель. Подготовь результат и тесты в разрешённых файлах. "
            "Твой done означает готовность кандидата к приёмке, а не успешное прохождение тестов. "
            "Контроллер сам выполнит npm run verify, task.checks и проверку ссылок "
            "после твоего ответа, затем передаст фактические логи независимому проверяющему. "
            "Ссылки считаются разницей: битых ссылок в документе не должно стать больше, "
            "чем было до твоей правки; чужую старую битую ссылку чинить не обязан. "
            "Недоступность этих команд именно в sandbox исполнителя не требует blocked: "
            "честно укажи, что они ожидают контроллера; не называй их пройденными.\n"
            "Ссылки в документах: ссылка вида `файл:строка` обязана нести в том же "
            "предложении токен в бэктиках, который ДЕЙСТВИТЕЛЬНО есть на этой строке — "
            "иначе она ничего не проверяет и критерий считается невыполненным. Правишь "
            "текст вокруг ссылки или вставляешь строки в файл, на который ссылаются, — "
            "перепроверь номера резолвером: cd frontend_vue && CONTRACT_REFS=<документ> "
            "./node_modules/.bin/vitest run src/services/contractRefs.spec.ts. "
            "Предложение и ссылка обязаны говорить одно и то же: ссылка на место, где "
            "искомого НЕТ, опровергает предложение, а не подтверждает его.\n"
            "Документы про изменённый код: закончив правку, перечитай документы из sources "
            "и outputs в тех местах, где они описывают строки, которые ты изменил. "
            "Утверждение, опровергнутое твоим же диффом, — это брак задачи, даже если всё "
            "остальное верно и машинные проверки зелёные.\n"
        )
    backend = backends[role]
    instruction += backend.result_instruction(result_path)
    prompt = instruction + "\nЗадание (JSON):\n" + json.dumps(task, ensure_ascii=False, indent=2)
    prefix.with_suffix(".prompt.txt").write_text(prompt)
    execute(backend.build(role, root, run_dir, result_path), root, prefix, deadline, prompt)
    backend.finalize(role, prefix, result_path)
    result = json.loads(result_path.read_text())
    if (set(result) != {"status", "summary", "evidence"}
            or result["status"] not in ("done", "blocked")
            or not isinstance(result["summary"], str) or not result["summary"].strip()
            or not isinstance(result["evidence"], list)
            or (result["status"] == "done" and not result["evidence"])
            or not all(isinstance(item, str) and item.strip() for item in result["evidence"])):
        raise RuntimeError(f"{task['id']} / {role}: нет подтверждения выполнения: {result}")
    return result


def ask_agent(root, backends, task, role, run_dir, deadline):
    # A review has no write effects and can safely start a fresh session after
    # a recognized service failure. Never replay the author or alter access settings.
    before_git, before_files = git_state(root), file_snapshot(root)
    for attempt in (1, 2):
        try:
            result = ask_agent_once(root, backends, task, role, run_dir, deadline, attempt)
            if attempt == 2:
                first_result = run_dir / f'{task["id"]}-{role}.json'
                if first_result.exists():
                    first_result.rename(run_dir / f'{task["id"]}-{role}-failed-1.json')
                shutil.copyfile(run_dir / f'{task["id"]}-{role}-retry-2.json',
                                first_result)
            return result
        except CommandFailed:
            suffix = "" if attempt == 1 else "-retry-2"
            prefix = run_dir / f'{task["id"]}-{role}{suffix}'
            kind = (service_error_kind(prefix.with_suffix(".stdout.log"))
                    if backends[role].supports_service_retry else None)
            if role != "review" or not kind:
                raise
            if git_state(root) != before_git or file_snapshot(root) != before_files:
                raise RuntimeError("Сбой проверяющего сопровождался изменением checkout; повтор запрещён")
            event = {"time": time.time(), "task": task["id"], "role": role,
                     "attempt": attempt, "error": kind, "log": str(prefix.with_suffix('.stdout.log'))}
            with (run_dir / "service-retries.jsonl").open("a") as stream:
                stream.write(json.dumps(event) + "\n")
                stream.flush()
                os.fsync(stream.fileno())
            if attempt == 2:
                result = {"status": "blocked", "summary": f"Сервис проверки недоступен после двух попыток: {kind}",
                          "evidence": [str(run_dir / "service-retries.jsonl"), event["log"]]}
                first_result = run_dir / f'{task["id"]}-{role}.json'
                if first_result.exists():
                    first_result.rename(run_dir / f'{task["id"]}-{role}-failed-1.json')
                first_result.write_text(json.dumps(result, ensure_ascii=False, indent=2))
                return result
            if deadline - time.monotonic() <= 2:
                raise TimeoutError("Недостаточно времени для повторной приёмки")
            time.sleep(2)


def run(root, queue, backends, run_dir, minutes, max_tasks, retry=None, previous=None,
        token_budget=None, parallel=1):
    if run_dir.is_relative_to(root):
        raise ValueError("Каталог результатов должен находиться вне checkout")
    # Never reuse a directory: even a stopped run remains intact.
    run_dir.mkdir(parents=True, exist_ok=False)
    shutil.copyfile(Path(__file__).resolve(), run_dir / "controller.py")
    shutil.copyfile(HERE / "headless_backends.py", run_dir / "headless_backends.py")
    (run_dir / "backends.json").write_text(json.dumps(
        {role: {"backend": backends[role].name, **backends[role].options} for role in ROLES},
        ensure_ascii=False, indent=2))
    (run_dir / "schema.json").write_text(json.dumps(SCHEMA))
    (run_dir / "queue.json").write_text(json.dumps(queue, ensure_ascii=False, indent=2))
    state = {"status": "running", "tokens": 0, "token_budget": token_budget,
             "baseline": git(root, "rev-parse", "HEAD").strip(),
             "workspace": str(root), "completed": list(retry["completed"]) if retry else [],
             "blocked": list(retry.get("blocked", [])) if retry else [],
             "waiting": list(retry.get("waiting", [])) if retry else [],
             "current": None, "reason": "", "retried_from": str(previous) if previous else None}
    deps = dependencies(queue)
    tasks = ordered_tasks(queue, deps)
    exhausted = False
    # Цена задачи в этом проекте гуляет втрое (замер ночи 2026-09-23: от 2.5 до 7.4 млн
    # токенов). Поэтому следующая задача начинается, только если остатка хватит на
    # САМУЮ дорогую из уже виденных: иначе потолок узнаёт о превышении постфактум.
    task_costs = []
    spent = 0
    if retry:
        # Preserve the author's checkpoint so another failed review can be retried.
        task_id = retry["current"]
        shutil.copyfile(previous / f"{task_id}-work.json", run_dir / f"{task_id}-work.json")

    def save(event):
        resolved = {item["task"] for key in ("completed", "blocked", "waiting") for item in state[key]}
        state["pending"] = [t["id"] for t in tasks if t["id"] not in resolved]
        with (run_dir / "journal.jsonl").open("a") as stream:
            stream.write(json.dumps({"time": time.time(), "event": event, **state}, ensure_ascii=False) + "\n")
            stream.flush()
            os.fsync(stream.fileno())
        temp = run_dir / "state.tmp"
        temp.write_text(json.dumps(state, ensure_ascii=False, indent=2))
        temp.replace(run_dir / "state.json")
        lines = ["# Ночной прогон Codex", "", f"Статус: {state['status']}",
                 f"Причина: {state['reason']}", f"Checkout: `{root}`", "",
                 "Завершено: " + ", ".join(x["task"] for x in state["completed"]),
                 f"Текущая задача: {state['current']}", "",
                 "Осталось: " + ", ".join(state["pending"]), "",
                 "## Заблокировано", ""]
        for item in state["blocked"]:
            lines.extend([f"- **{item['task']}** ({item['phase']}): {item['reason']}",
                          f"  База: `{item['base_commit']}`; архив: `{item['archive']}`; "
                          f"stash: `{item.get('stash') or 'нет'}`."])
            lines.extend(f"  - {e}" for e in item["evidence"])
        lines.extend(["", "## Ожидают зависимостей", ""])
        lines.extend(f"- **{item['task']}**: {', '.join(item['dependencies'])}" for item in state["waiting"])
        lines.extend(["", "Черновики блокировок сохранены отдельно. При аварийной остановке текущие "
                      "правки остаются в checkout. Слияния и отправки не было.", ""])
        (run_dir / "report.md").write_text("\n".join(lines))

    def block(task, phase, result, expected_git):
        # Archive outside the checkout BEFORE cleaning anything. Tar retains binary
        # files, permissions and symlinks; the manifest also records deleted paths.
        files = file_snapshot(root)
        archive = run_dir / f'{task["id"]}-blocked'
        archive.mkdir()
        (archive / "changes.patch").write_bytes(subprocess.check_output(
            ["git", "-C", str(root), "diff", "--binary", "HEAD"]))
        (archive / "manifest.json").write_text(json.dumps(
            {p: "deleted" if value is None else "saved" for p, value in files.items()}, indent=2))
        with tarfile.open(archive / "files.tar", "w", dereference=False) as tar:
            for name, value in sorted(files.items()):
                if value is not None:
                    tar.add(root / name, arcname=name, recursive=False)
        item = {"task": task["id"], "phase": phase, "reason": result["summary"],
                "evidence": result["evidence"], "base_commit": expected_git[0].strip(),
                "archive": str(archive), "stash": None}
        state["blocked"].append(item)
        save("task-blocked-archive")
        if files:
            execute(["git", "stash", "push", "--include-untracked", "-m",
                     f'codex-night blocked {task["id"]}: {run_dir}', "--", *sorted(files)],
                    root, run_dir / f'{task["id"]}-stash', deadline)
            item["stash"] = git(root, "rev-parse", "refs/stash").strip()
            (archive / "stash.txt").write_text(item["stash"] + "\n")
        if changed(root) or git_state(root) != expected_git:
            raise RuntimeError("Не удалось изолировать заблокированную задачу; продолжение небезопасно")
        save("task-blocked")

    deadline = time.monotonic() + minutes * 60
    save("start")
    try:
        if not retry:
            baseline_git = git_state(root)
            execute(["npm", "run", "verify"], root / "frontend_vue", run_dir / "baseline", deadline)
            execute_checks(root, queue.get("baseline_checks", []), run_dir / "baseline-check", deadline)
            if changed(root) or git_state(root) != baseline_git:
                raise RuntimeError("Baseline-проверка изменила checkout")
        attempts = 0
        prepared = {}
        for task in tasks:
            resolved = {x["task"] for key in ("completed", "blocked", "waiting") for x in state[key]}
            if task["id"] in resolved:
                continue
            unavailable = deps[task["id"]] & {x["task"] for key in ("blocked", "waiting") for x in state[key]}
            if unavailable:
                state["waiting"].append({"task": task["id"], "dependencies": sorted(unavailable)})
                save("task-waiting")
                continue
            if attempts >= max_tasks:
                continue
            # Потолок проверяется между задачами: внутри задачи прерывать нечего —
            # брошенный на середине автор оставит правки без приёмки. Значит прогон
            # может превысить потолок не больше чем на одну задачу, и это записано.
            measured = spent_tokens(backends, run_dir)
            if measured > spent:
                task_costs.append(measured - spent)
            spent = state["tokens"] = measured
            if token_budget is not None:
                remaining = token_budget - spent
                need = max(task_costs, default=0)
                if remaining <= 0:
                    state["reason"] = f"Потолок токенов исчерпан: {spent} из {token_budget}"
                elif remaining < need:
                    state["reason"] = (f"Остатка не хватит на задачу: {remaining} из {token_budget}, "
                                       f"самая дорогая виденная задача — {need}")
                if state["reason"]:
                    exhausted = True
                    save("token-budget")
                    break
            attempts += 1
            state["current"] = task["id"]
            save("task-start")
            expected_git = git_state(root)
            links_before = {}
            if (root / "frontend_vue/src/services/contractRefs.spec.ts").is_file():
                for n, doc in enumerate(link_documents(task)):
                    links_before[doc] = link_report(root, doc, run_dir / f'{task["id"]}-links-before-{n}', deadline)
            missing = [name for name in task["sources"] if not (root / name).is_file()]
            if missing:
                block(task, "sources", {"summary": "Нет необходимых источников", "evidence": missing}, expected_git)
                state["current"] = None
                continue
            work = {"status": "done"}
            if retry and task["id"] == retry["current"]:
                pass
            elif parallel <= 1:
                work = ask_agent(root, backends, task, "work", run_dir, deadline)
            else:
                if task["id"] not in prepared:
                    # Пачка — только задачи, не делящие файлов, и только те, что уже
                    # можно начинать: зависимости и потолок проверены выше по циклу.
                    resolved_now = {x["task"] for key in ("completed", "blocked", "waiting")
                                    for x in state[key]}
                    candidates = [t for t in tasks
                                  if t["id"] not in resolved_now and t["id"] not in prepared
                                  and not (deps[t["id"]] - resolved_now)]
                    batch = disjoint_batch(candidates, min(parallel, max_tasks - attempts + 1))
                    state["batch"] = [t["id"] for t in batch]
                    save("batch")
                    with concurrent.futures.ThreadPoolExecutor(max_workers=len(batch)) as pool:
                        futures = {pool.submit(write_author, root, backends, t, run_dir, deadline): t
                                   for t in batch}
                        for future in concurrent.futures.as_completed(futures):
                            prepared[futures[future]["id"]] = future.result()
                    drop_worktrees(root, run_dir)
                work, patch = prepared.pop(task["id"])
                if patch is not None and work["status"] != "blocked":
                    execute(["git", "apply", "--binary", str(patch)], root,
                            run_dir / f'{task["id"]}-apply', deadline)
            if git_state(root) != expected_git or changed(root) - set(task["outputs"]):
                raise RuntimeError("Исполнитель изменил Git или файлы вне задачи")
            if work["status"] == "blocked":
                block(task, "work", work, expected_git)
                state["current"] = None
                continue
            if not changed(root):
                block(task, "work", {"summary": "Исполнитель сообщил done без изменений; нужна сверка очереди",
                                     "evidence": work.get("evidence", [])}, expected_git)
                state["current"] = None
                continue
            before_review = git(root, "diff", "HEAD")
            files_before = file_snapshot(root)
            check_failure = None
            try:
                execute(["npm", "run", "verify"], root / "frontend_vue", run_dir / f'{task["id"]}-check-verify', deadline)
                execute_checks(root, task.get("checks", []), run_dir / f'{task["id"]}-check-extra', deadline)
                for n, doc in enumerate(link_documents(task)):
                    if doc not in links_before:
                        continue
                    after = link_report(root, doc, run_dir / f'{task["id"]}-check-links-{n}', deadline)
                    if after > links_before[doc]:
                        raise CommandFailed(f"{doc}: битых ссылок стало больше — было "
                                            f"{links_before[doc]}, стало {after}; см. "
                                            f'{task["id"]}-check-links-{n}')
            except CommandFailed as exc:
                check_failure = {"summary": str(exc), "evidence": [str(p) for p in
                                 sorted(run_dir.glob(f'{task["id"]}-check*.log'))]}
            if git_state(root) != expected_git or file_snapshot(root) != files_before:
                raise RuntimeError("Машинная проверка изменила проверенные файлы")
            if check_failure:
                block(task, "checks", check_failure, expected_git)
                state["current"] = None
                continue
            review = ask_agent(root, backends, task, "review", run_dir, deadline)
            if (git_state(root) != expected_git or git(root, "diff", "HEAD") != before_review
                    or file_snapshot(root) != files_before):
                raise RuntimeError("Проверяющий изменил checkout")
            if review["status"] == "blocked":
                block(task, "review", review, expected_git)
                state["current"] = None
                continue
            execute(["git", "add", "--", *sorted(changed(root))], root,
                    run_dir / f'{task["id"]}-stage', deadline)
            expected_tree = git(root, "write-tree").strip()
            execute(["git", "commit", "-m", f'night: {task["id"]}'], root,
                    run_dir / f'{task["id"]}-commit', deadline)
            if (git(root, "rev-parse", "HEAD^{tree}").strip() != expected_tree or changed(root)
                    or git(root, "branch", "--show-current") != expected_git[1]):
                raise RuntimeError("Коммит или hook изменил проверенное дерево; результат не принят")
            state["completed"].append({"task": task["id"], "commit": git(root, "rev-parse", "HEAD").strip()})
            save("task-done")
            if changed(root):
                raise RuntimeError("После коммита осталось изменённое дерево")
        state["current"] = None
        state["tokens"] = spent_tokens(backends, run_dir)
        resolved_count = sum(len(state[key]) for key in ("completed", "blocked", "waiting"))
        state["status"] = ("token-budget" if exhausted else
                           "task-limit" if resolved_count < len(tasks) else
                           "completed-with-blockers" if state["blocked"] else "completed")
        drop_worktrees(root, run_dir)
        save("finish")
        return 0
    except (Exception, KeyboardInterrupt) as exc:
        drop_worktrees(root, run_dir)
        try:
            state["tokens"] = spent_tokens(backends, run_dir)
        except Exception:  # учёт не должен мешать сохранить причину остановки
            pass
        state["status"] = "stopped"
        state["reason"] = str(exc) or type(exc).__name__
        save("stop")
        return 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, default=Path.cwd())
    parser.add_argument("--queue", type=Path, default=HERE / "codex-night-queue.json")
    parser.add_argument("--codex", default="codex", help="Бинарь Codex, если маршрутизация не задана")
    parser.add_argument("--routing", type=Path, help="Файл маршрутизации ролей по бэкендам")
    parser.add_argument("--token-budget", type=int, help="Потолок расхода токенов на прогон")
    parser.add_argument("--parallel", type=int, default=1,
                        help="Сколько авторов писать одновременно (каждый в своём worktree)")
    parser.add_argument("--run", action="store_true", help="Без флага — только preflight, без вызова модели")
    parser.add_argument("--run-dir", type=Path)
    parser.add_argument("--minutes", type=float)
    parser.add_argument("--max-tasks", type=int)
    parser.add_argument("--retry-review", type=Path, help="Каталог остановленного прогона: повторить проверки и приёмку сохранённой работы")
    args = parser.parse_args()
    root = args.workspace.resolve()
    queue = json.loads(args.queue.read_text())
    backends = load_routing(args.routing, args.codex)
    if args.run and (args.run_dir is None or args.minutes is None or not math.isfinite(args.minutes)
                     or args.minutes <= 0 or args.max_tasks is None or args.max_tasks <= 0):
        parser.error("Для --run обязательны --run-dir, положительные --minutes и --max-tasks")
    # Shared git directory lock prevents two controllers using the same repository.
    common = Path(git(root, "rev-parse", "--git-common-dir").strip())
    common = (root / common).resolve()
    if not args.run:
        retry = retry_checkpoint(root, queue, args.retry_review.resolve()) if args.retry_review else None
        preflight(root, queue, backends, retry)
        routed = ", ".join(f"{role}={backends[role].name}" for role in ROLES)
        print(f"Preflight пройден: {len(queue['tasks'])} задач, {routed}. Модель не запускалась.")
        return 0
    with (common / "codex-night.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        previous = args.retry_review.resolve() if args.retry_review else None
        retry = retry_checkpoint(root, queue, previous) if previous else None
        preflight(root, queue, backends, retry)
        return run(root, queue, backends, args.run_dir.resolve(), args.minutes, args.max_tasks,
                   retry, previous, args.token_budget, args.parallel)


if __name__ == "__main__":
    def stop_signal(_number, _frame):
        raise KeyboardInterrupt("Получен сигнал остановки")

    signal.signal(signal.SIGTERM, stop_signal)
    try:
        sys.exit(main())
    except Exception as error:
        print(f"Прогон не запущен: {error}", file=sys.stderr)
        sys.exit(2)
