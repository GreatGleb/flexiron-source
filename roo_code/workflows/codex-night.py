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
import socket
import stat
import subprocess
import sys
import tarfile
import threading
import time


HERE = Path(__file__).resolve().parent
# Промпт проверяющего несёт дифф и хвосты логов; обрезка — чтобы одна огромная правка
# не вытеснила из контекста саму задачу.
DIFF_LIMIT = 120_000
LOG_TAIL_LIMIT = 2_000
sys.path.insert(0, str(HERE))
from headless_backends import (PROVIDER_REFUSAL_PREFIX, ROLES, UnreadableCallLog,  # noqa: E402
                               load_routing)  # (нужен HERE в sys.path)
import night_db  # noqa: E402
import refs_shift  # noqa: E402

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


def execute_checks(root, checks, prefix, deadline, env=None):
    for number, check in enumerate(checks):
        execute(check["argv"], root / check["cwd"],
                prefix.with_name(f"{prefix.name}-{number}"), deadline, env=env)


def link_report(root, doc, prefix, deadline):
    """Сколько ссылок документа не резолвится. Отсутствующий документ — ноль битых.

    Считается ДО и ПОСЛЕ правки, потому что судить автора по всему файлу нельзя:
    планы этого проекта копили битые ссылки годами, и первая же задача, тронувшая
    такой файл, блокировалась за чужую гниль. Критерий — «не стало больше».
    Проверка идёт без CONTRACT_REFS_STRICT: нужен счёт, а не падение спека.
    """
    if not (root / doc).is_file():
        return 0
    execute(refs_shift.link_check_argv(doc), root / "frontend_vue", prefix, deadline)
    found = refs_shift.broken_links(prefix.with_suffix(".stdout.log").read_text(errors="replace"))
    if found is None:
        raise CommandFailed(f"Проверка ссылок не дала отчёта по {doc}; см. {prefix.name}")
    return found


def disjoint_batch(candidates, size, owned=()):
    """Сколько задач можно писать одновременно: те, что не делят ни одного файла.

    Владение файлом — единственный критерий. Два автора в одном файле затрут друг
    друга молча, и ни одна из проверок ядра этого не увидит: каждая правка сама по
    себе выглядит законной.
    """
    batch, owned = [], set(owned)
    if size <= 0:
        return batch   # свободных слотов нет — назначать некому
    for task in candidates:
        files = set(task["outputs"])
        if files & owned:
            continue
        batch.append(task)
        owned |= files
        if len(batch) >= size:
            break
    return batch


# Порты playwright для авторов пачки. `playwright.config.ts` берёт PW_PORT и PW_PORT + 1
# (второй сервер без моков), по умолчанию 5173. Два автора пачки с e2e в своих worktree
# на одном порту: второй не поднимет сервер, а с `reuseExistingServer` — хуже, молча
# проверит код ЧУЖОГО worktree. Выдаёт ядро, а не исполнитель: номер слота в пачке
# знает только оно, а столкнуться могут авторы на любом исполнителе. Начало — вдали от
# 5173 (там dev-сервер человека); занятая пара пропускается по той же причине — занятый
# порт playwright подхватил бы, чей бы сервер на нём ни стоял.
AUTHOR_PORT_BASE = int(os.environ.get("NIGHT_PW_PORT_BASE", "5400"))
# Как часто главный поток, ожидая приёмку, смотрит на авторов конвейера.
REVIEW_POLL = 2.0


def port_free(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            probe.bind(("127.0.0.1", port))
        except OSError:
            return False
    return True


def author_ports(count, base=AUTHOR_PORT_BASE, free=port_free, taken=()):
    """PW_PORT на каждого автора пачки: пары (порт, порт + 1) не пересекаются и свободны.

    `taken` — порты авторов, которые уже работают: их сервер мог ещё не подняться, и
    проба «свободен» отдала бы тот же порт второму.
    """
    ports, port = [], base
    while len(ports) < count:
        if port > 65000:
            raise RuntimeError(f"Нет свободной пары портов для автора выше {base}")
        if port not in taken and free(port) and free(port + 1):
            ports.append(port)
        port += 2
    return ports


def add_worktree(root, task, run_dir):
    """Worktree автора — из главного потока: `git worktree add` и `remove` в .git общие,
    и потоки, делающие их наперегонки с коммитом ядра, отлаживались бы вслепую."""
    worktree = run_dir / f'wt-{task["id"]}'
    git(root, "worktree", "add", "--detach", str(worktree), "HEAD")
    modules = root / "frontend_vue/node_modules"
    if modules.is_dir():
        # Без него автор потратит ходы на попытки запустить проверки, которые
        # всё равно выполняет контроллер. КОПИЯ, а не симлинк: vite разрешает импорт
        # по настоящему пути, симлинк уводит его за корень worktree, и файл вне
        # `server.fs.allow` получает 403 — шрифты `@fontsource` не грузились, и у
        # автора пачки краснели все снимки и замеры шрифта (замер 2026-09-26: 27 из
        # 119 в одиночном прогоне). Копия 230 МБ / 17 тыс. файлов — секунда.
        (worktree / "frontend_vue").mkdir(exist_ok=True)
        subprocess.run(["cp", "-a", str(modules), str(worktree / "frontend_vue/node_modules")], check=True)
    return worktree


def drop_worktree(root, worktree):
    subprocess.run(["git", "-C", str(root), "worktree", "remove", "--force", str(worktree)],
                   capture_output=True)


def write_author(root, backends, task, run_dir, deadline, env=None):
    """Автор работает в своём worktree (готовит его `add_worktree`), а не в общем дереве.

    Возвращает (результат, патч). Патч применяется в checkout позже и по одному:
    параллелен здесь только автор, всё остальное — проверки, приёмка, коммит —
    остаётся последовательным, иначе `npm run verify` погонит чужую недописанную
    работу и упадёт не по своей причине.
    """
    worktree = run_dir / f'wt-{task["id"]}'
    before = git_state(worktree)
    try:
        result = ask_agent(worktree, backends, task, "work", run_dir, deadline, env)
    except CommandFailed:
        # Процесс исполнителя не запустился или упал — это не «ответ», а отказ среды.
        # Он остаётся поводом остановить прогон: если CLI лёг, ляжет и на следующей задаче.
        raise
    except (RuntimeError, ValueError) as error:
        # Ответ пришёл, но пользоваться им нельзя: не JSON, не по схеме, `is_error`.
        # Это брак ОДНОЙ задачи, а не всей ночи. Ночь 2026-09-23-2241 кончилась в 01:51
        # из 05:40 ровно так: один автор из четырёх вернул прозу «All done. Summary of
        # the change: …», исключение вылетело из пачки — и три готовых патча соседей
        # остались в run-4 непросмотренными. Схему держит только Codex (--output-schema),
        # у claude и zoo её нечем навязать, значит случай штатный и обязан обрабатываться.
        result = {"status": "blocked",
                  "summary": f'Ответ автора непригоден: {error}'[:500],
                  "evidence": [str(run_dir / f'{task["id"]}-work.stdout.log')]}
    # Границы задачи проверяются и после непригодного ответа: автор, вышедший за них,
    # останавливает прогон в любом случае — это строже, чем блокировка одной задачи.
    if git_state(worktree) != before:
        raise RuntimeError(f'{task["id"]}: исполнитель изменил Git в своём worktree')
    outside = changed(worktree) - set(task["outputs"])
    if outside and result["status"] == "blocked":
        result = {**result,
                  "summary": f'{result["summary"]} | вне задачи: {sorted(outside)}'[:500],
                  "evidence": [*result["evidence"], f'Разрешено было: {sorted(task["outputs"])}']}
    elif outside:
        # Та же политика, что в одиночной ветке: выход за границы — брак одной задачи.
        # Патч ниже всё равно не применяется у заблокированной, а сама работа
        # сохраняется в `<id>.patch` и в архиве блокировки.
        result = {"status": "blocked",
                  "summary": f'Исполнитель изменил файлы вне задачи: {sorted(outside)}'[:500],
                  "evidence": [str(run_dir / f'{task["id"]}-work.stdout.log'),
                               f'Разрешено было: {sorted(task["outputs"])}']}
    touched = sorted(changed(worktree))
    patch = None
    if touched:
        # add нужен, чтобы в патч попали новые файлы: git diff их не видит.
        execute(["git", "add", "--", *touched], worktree, run_dir / f'{task["id"]}-stage-wt', deadline)
        patch = run_dir / f'{task["id"]}.patch'
        patch.write_bytes(subprocess.check_output(["git", "-C", str(worktree), "diff", "--cached", "--binary"]))
        # Патч заблокированной задачи не применяется, но и не пропадает: без этой строки
        # работу автора пришлось бы искать по каталогу прогона руками.
        if result["status"] == "blocked":
            result["evidence"].append(str(patch))
    return result, patch


def drop_worktrees(root, run_dir):
    for worktree in sorted(run_dir.glob("wt-*")):
        subprocess.run(["git", "-C", str(root), "worktree", "remove", "--force", str(worktree)],
                       capture_output=True)
    subprocess.run(["git", "-C", str(root), "worktree", "prune"], capture_output=True)


def spent_tokens(backends, run_dir, unfinished=()):
    """Сколько токенов потрачено прогоном на бэкенды, идущие в счёт потолка.

    Считается по логам вызовов, а не накапливается в памяти: остановленный и
    возобновлённый прогон видит тот же расход, что и непрерывный. Авторы из
    `unfinished` ещё пишут: их лог пуст или недописан, и разбор уронил бы ночь —
    их расход засчитается, когда они закончат.

    Законченный вызов, не оставивший отчёта о сессии, пропускается — так же, как его
    пропускает `measure()` супервизора, то есть два счётчика ночи дают одно число.
    Ронять на нём прогон нельзя: ночь 2026-09-28-0022 встала так после того, как ядро
    УЖЕ разобрало этот случай — задача забракована («Ответ приёмщика непригоден»), а
    лог остался в каталоге и валил каждую следующую проверку потолка. Молчания тут
    нет: тот же лог лежит в доказательствах забракованной задачи. Вывод БЕЗ учёта
    токенов — другое дело, он по-прежнему останавливает прогон.
    """
    total = 0
    for path in sorted(run_dir.glob("*.stdout.log")):
        match = re.fullmatch(r"(.*)-(work|review)(?:-retry-\d+)?\.stdout\.log", path.name)
        if match and match.group(2) == "work" and match.group(1) in unfinished:
            continue
        role = match.group(2) if match else None
        if role and backends[role].metered:
            try:
                total += backends[role].tokens(Path(str(path)[: -len(".stdout.log")]))
            except UnreadableCallLog:
                continue
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


def renumbered_before(previous, task_id):
    """Документы, которые контроллер прошлого прогона перенумеровал за эту задачу.

    Это правка контроллера, а не автора, и она уже лежит в checkout: повтор приёмки
    обязан считать её своей. Без этого повтор отказывал «изменения выходят за область
    задачи» ровно после той остановки, ради которой он существует (ночь 2026-09-27-0224).
    """
    refs = previous / f"{task_id}-refs.json"
    if not refs.is_file():
        return set()
    return {item["документ"] for item in json.loads(refs.read_text())["перенумеровано"]}


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
    # Остановка — на любой из оставшихся: конвейер принимает задачи в порядке готовности
    # авторов, а не очереди, и первой оставшейся может быть задача, чей автор был погашен.
    if state["current"] not in {t["id"] for t in remaining}:
        raise ValueError("Контрольная точка не соответствует очереди")
    if len(set(completed)) != len(completed) or not set(completed) <= {t["id"] for t in tasks}:
        raise ValueError("Завершённые задачи не соответствуют очереди")
    expected_head = state["completed"][-1]["commit"] if completed else state["baseline"]
    if git(root, "rev-parse", "HEAD").strip() != expected_head or git(root, "diff", "--cached").strip():
        raise ValueError("HEAD или индекс изменились после остановки")
    task = next(t for t in remaining if t["id"] == state["current"])
    if not changed(root) or changed(root) - set(task["outputs"]) - renumbered_before(previous, task["id"]):
        raise ValueError("Изменения для повторной приёмки выходят за область задачи")
    work = json.loads((previous / f'{task["id"]}-work.json').read_text())
    if work.get("status") != "done":
        raise ValueError("Нет завершённого результата исполнителя")
    return state


# Процессы, запущенные execute() из любого потока. Остановка ядра гасит их все: авторы
# конвейера работают в потоках, и SIGTERM главному потоку до них не доходит — ядро
# ждало бы их до конца (ловушка 26–27.09: убитая обёртка, живое ядро с авторами).
LIVE, LIVE_LOCK = set(), threading.Lock()


def stop_live(grace=5.0):
    with LIVE_LOCK:
        procs = list(LIVE)
    for sig in (signal.SIGTERM, signal.SIGKILL):
        for proc in procs:
            try:
                os.killpg(proc.pid, sig)
            except ProcessLookupError:
                pass
        stop = time.monotonic() + grace
        while any(proc.poll() is None for proc in procs) and time.monotonic() < stop:
            time.sleep(0.05)


def execute(command, root, prefix, deadline, prompt=None, env=None):
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError("Лимит времени исчерпан")
    # env — это ДОБАВКА к окружению контроллера, а не замена: подменив его целиком,
    # мы лишили бы команду PATH и HOME, то есть сломали бы её по другой причине.
    environment = {**os.environ, **env} if env else None
    with prefix.with_suffix(".stdout.log").open("xb") as out, prefix.with_suffix(".stderr.log").open("xb") as err:
        proc = subprocess.Popen(command, cwd=root, stdin=subprocess.PIPE if prompt else subprocess.DEVNULL,
                                stdout=out, stderr=err, start_new_session=True, env=environment)
        with LIVE_LOCK:
            LIVE.add(proc)
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
        finally:
            with LIVE_LOCK:
                LIVE.discard(proc)
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


def ask_agent_once(root, backends, task, role, run_dir, deadline, attempt=1, env=None):
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
        # Отчёт автора кладётся целиком. Без него инструкция «не доверяй выводу автора»
        # бессмысленна: доверять или не доверять нечему, вывод до проверяющего не
        # доходил вовсе. Замер 2026-09-26: две задачи из четырёх забракованы именно
        # так — «мутация не подтверждена, отчёт автора мне не передан», при том что
        # правка по содержанию была верна. Это ЗАЯВЛЕНИЯ, а не доказательства:
        # проверяются по диффу и логам контроллера, которые лежат выше.
        work_path = run_dir / f'{task["id"]}-work.json'
        if work_path.is_file():
            instruction += ("\n=== Что УТВЕРЖДАЕТ автор (непроверенные заявления) ===\n"
                            + work_path.read_text()[:DIFF_LIMIT] + "\n"
                            "Заявление автора само по себе ничего не доказывает. Если критерий "
                            "требует того, что видно только из его прогона (мутация, код возврата, "
                            "нагрузка), и в логах контроллера выше этого нет — суди по заявлению "
                            "автора вместе с диффом, а не бракуй за то, что не можешь повторить "
                            "сам: твой sandbox read-only по построению.\n")
        refs_path = run_dir / f'{task["id"]}-refs.json'
        if refs_path.is_file():
            refs = json.loads(refs_path.read_text())
            instruction += (f"\nСсылки документов: контроллер сам перенумеровал "
                            f"{len(refs['перенумеровано'])} ссылок, чьи строки переехали дословно — "
                            "это механика, придираться к ней не нужно.\n")
            if refs["требуют_глаз"]:
                instruction += ("Эти ссылки контроллер НЕ трогал, потому что строка изменилась, "
                                "а не переехала — проверь, не стали ли они ложью:\n")
                for item in refs["требуют_глаз"]:
                    instruction += f"  {item['документ']}:{item['строка']} — {item['было']}\n"
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
            "НОВЫХ ссылок с номерами строк не вводи: место в коде называй цитатой — именем "
            "функции, класса или токеном в бэктиках без `:номер`. Такую ссылку нечему "
            "сломать, и резолвер её не судит. Номера ссылок, чьи строки переехали "
            "ДОСЛОВНО, контроллер правит сам после твоей работы — их не трогай. Ссылки в "
            "твоих outputs на строки, которые ИЗМЕНИЛИСЬ, контроллер не трогает: их "
            "исправляешь ты, и рядом с номером в том же предложении должен стоять токен в "
            "бэктиках с целевой строки. "
            "НЕ запускай refs_shift.py — ни с --fix, ни без: он правит документы, которых "
            "нет в твоих outputs, и задача будет забракована за выход за границы. "
            "Замер 2026-09-26: так погибла ночь на первой же задаче.\n"
        )
    if env and "DATABASE_URL" in env:
        # Без этого абзаца изоляция не работает: worktree автора не содержит
        # `backend/.env` (он в .gitignore), и автор, которому нужна база, ПОДСТАВЛЯЕТ
        # адрес в команду руками. Замер — ночь 2026-09-24-2225, задача
        # `suppliers-schema-t2`: в доказательствах стоит
        # `DATABASE_URL=postgresql+asyncpg://postgres:root@localhost:5433/flexiron
        # python3 -m alembic upgrade head`, то есть общая база. Переменная окружения
        # такую команду не перебивает — её перебивает только запрет её писать.
        instruction += (
            "База данных. У тебя СВОЯ база, её адрес уже лежит в переменной окружения "
            "DATABASE_URL, и настройки бэкенда читают переменную окружения раньше файла "
            f"`backend/.env`. Твоя база: `{env['DATABASE_URL']}`.\n"
            "Не подставляй адрес базы в команду руками и не бери его из `backend/.env`, "
            "`alembic.ini` или из примеров в документах: там стоит ОБЩАЯ база, и правка, "
            "накаченная в неё, останется там после отката твоей задачи и сломает "
            "`alembic check` у всех, кто пойдёт после тебя. Пиши просто "
            "`cd backend && python3 -m alembic upgrade head`.\n")
    if env and "PW_PORT" in env:
        # Порт уже в окружении и playwright его берёт сам; абзац — против порта, вписанного
        # в команду руками по примерам из документов (там стоит 5173 и 5273).
        instruction += (
            f"Порты. Рядом с тобой одновременно работают другие авторы. Твой порт playwright — "
            f"PW_PORT={env['PW_PORT']} (и следующий за ним), он уже в окружении. Не задавай "
            "PW_PORT и --port руками и не занимай 5173: там чужой сервер.\n"
            # Ночь 2026-09-27-2225: автор пачки поднял 160 `yes` на 8 ядрах ради инверсии
            # под нагрузкой, а сосед в это время гнал свои e2e под этой нагрузкой.
            "Машина общая: пока ты работаешь, на ней идут тесты других авторов. Не создавай "
            "искусственную нагрузку на процессор (`yes`, `stress`, пустые циклы) и не гаси "
            "процессы по имени (`pkill`, `killall`) — это бьёт по чужим тестам. Если задача "
            "просит прогон или инверсию под нагрузкой, сделай вместо этого замер фактического "
            "времени ожидания и так и напиши в результате.\n")
    if env and "TMPDIR" in env:
        instruction += (
            f"Временные файлы — только в `$TMPDIR` (`{env['TMPDIR']}`, уже в окружении), не в "
            "`/tmp`: одноимённый файл соседа затрёт твой.\n")
    backend = backends[role]
    instruction += backend.result_instruction(result_path)
    prompt = instruction + "\nЗадание (JSON):\n" + json.dumps(task, ensure_ascii=False, indent=2)
    prefix.with_suffix(".prompt.txt").write_text(prompt)
    execute(backend.build(role, root, run_dir, result_path), root, prefix, deadline, prompt, env=env)
    backend.finalize(role, prefix, result_path)
    result = json.loads(result_path.read_text())
    if (set(result) != {"status", "summary", "evidence"}
            or result["status"] not in ("done", "blocked")
            or not isinstance(result["summary"], str) or not result["summary"].strip()
            or not isinstance(result["evidence"], list)
            or (result["status"] == "done" and not result["evidence"])
            or not all(isinstance(item, str) and item.strip() for item in result["evidence"])):
        raise RuntimeError(f"{task['id']} / {role}: нет подтверждения выполнения: {result}")
    if result["status"] == "blocked" and result["summary"].startswith(PROVIDER_REFUSAL_PREFIX):
        # Провайдер исполнителя отказал деньгами, ключом или квотой. Это не брак ОДНОЙ
        # задачи, а отказ среды — тот же, что упавший CLI: следующая задача получит тот
        # же ответ. Без остановки ночь 2026-09-28-0022 гнала пустые порции, и каждая
        # уносила по четыре задачи в blocked НАВСЕГДА: супервизор считает заблокированную
        # решённой и больше не предлагает её оператору. Строку ставит обёртка исполнителя
        # по своему списку ошибок, а не модель: подделать её ответом нельзя.
        raise CommandFailed(f'{result["summary"]} (задача {task["id"]}, роль {role})')
    return result


def ask_agent(root, backends, task, role, run_dir, deadline, env=None):
    # A review has no write effects and can safely start a fresh session after
    # a recognized service failure. Never replay the author or alter access settings.
    before_git, before_files = git_state(root), file_snapshot(root)
    for attempt in (1, 2):
        try:
            result = ask_agent_once(root, backends, task, role, run_dir, deadline, attempt, env)
            if attempt == 2:
                first_result = run_dir / f'{task["id"]}-{role}.json'
                if first_result.exists():
                    first_result.rename(run_dir / f'{task["id"]}-{role}-failed-1.json')
                shutil.copyfile(run_dir / f'{task["id"]}-{role}-retry-2.json',
                                first_result)
            return result
        except (CommandFailed, ValueError) as error:
            suffix = "" if attempt == 1 else "-retry-2"
            prefix = run_dir / f'{task["id"]}-{role}{suffix}'
            if isinstance(error, CommandFailed):
                kind = (service_error_kind(prefix.with_suffix(".stdout.log"))
                        if backends[role].supports_service_retry else None)
            else:
                # Вышел с кодом 0 и не напечатал НИЧЕГО — это не суждение приёмщика, а
                # сбой среды, у любого бэкенда. Ночь 2026-09-28-0022: приёмщик Opus по
                # `expect-budget-after-action-warehouse-specs` умер за секунду с пустыми
                # stdout и stderr, и готовая работа ушла в брак без второй попытки, хотя
                # вызовы оператора до и после прошли. Непустой негодный ответ — по-прежнему
                # брак задачи: его ловит приёмка ядра.
                log = prefix.with_suffix(".stdout.log")
                kind = "empty_output" if log.is_file() and not log.read_text(errors="replace").strip() else None
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
        token_budget=None, parallel=1, databases=None, finish_minutes=0):
    if run_dir.is_relative_to(root):
        raise ValueError("Каталог результатов должен находиться вне checkout")
    # Never reuse a directory: even a stopped run remains intact.
    run_dir.mkdir(parents=True, exist_ok=False)
    shutil.copyfile(Path(__file__).resolve(), run_dir / "controller.py")
    shutil.copyfile(HERE / "headless_backends.py", run_dir / "headless_backends.py")
    shutil.copyfile(HERE / "refs_shift.py", run_dir / "refs_shift.py")
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
    databases = databases or night_db.NoDatabases()
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
    carried_refs = renumbered_before(previous, retry["current"]) if retry else set()

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

    # Два срока. `minutes` — до какого момента НАЧИНАТЬ задачи; `finish_minutes` сверх
    # него — запас начатым на доделку. Один срок на всё убивал автора на полуслове:
    # задача, взятая за пять минут до конца ночи, гибла вместе с прогоном, а её работа
    # пропадала, потому что патч снимается только с законченного автора.
    start_deadline = time.monotonic() + minutes * 60
    deadline = start_deadline + finish_minutes * 60
    late = [False]

    def may_start():
        if time.monotonic() < start_deadline:
            return True
        if not late[0]:
            late[0] = True
            state["reason"] = "Время начинать задачи вышло; начатые доделаны"
            save("time-limit")
        return False

    pools = [None]
    save("start")
    try:
        if not retry:
            baseline_git = git_state(root)
            execute(["npm", "run", "verify"], root / "frontend_vue", run_dir / "baseline", deadline)
            execute_checks(root, queue.get("baseline_checks", []), run_dir / "baseline-check", deadline)
            if changed(root) or git_state(root) != baseline_git:
                raise RuntimeError("Baseline-проверка изменила checkout")
        # Шаблон баз строится ДО первой задачи и падением останавливает прогон: тихий
        # пропуск вернул бы общую базу, то есть сам БАГ-05, и никто бы этого не увидел.
        databases.prepare(root, lambda url: execute(
            ["python3", "-m", "alembic", "upgrade", "head"], root / "backend",
            run_dir / "db-template", deadline, env={"DATABASE_URL": url}))
        attempts = 0

        def resolved():
            return {x["task"] for key in ("completed", "blocked", "waiting") for x in state[key]}

        def failed_deps(task):
            return deps[task["id"]] & {x["task"] for key in ("blocked", "waiting") for x in state[key]}

        writing = set()   # id авторов конвейера, которые ещё пишут

        def budget_allows():
            # Потолок проверяется перед каждым автором: внутри задачи прерывать нечего —
            # брошенный на середине автор оставит правки без приёмки. Значит прогон
            # может превысить потолок не больше чем на задачи, уже отданные авторам.
            nonlocal spent, exhausted
            measured = spent_tokens(backends, run_dir, writing)
            if measured > spent:
                task_costs.append(measured - spent)
            spent = state["tokens"] = measured
            if token_budget is None:
                return True
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
                return False
            return True

        def begin(task):
            """Задача пошла в checkout: отметка и счёт битых ссылок ДО её правки."""
            state["current"] = task["id"]
            save("task-start")
            links_before = {}
            if (root / "frontend_vue" / refs_shift.RESOLVER_SPEC).is_file():
                for n, doc in enumerate(link_documents(task)):
                    links_before[doc] = link_report(root, doc, run_dir / f'{task["id"]}-links-before-{n}', deadline)
            return git_state(root), links_before

        def sources_missing(task, expected_git):
            missing = [name for name in task["sources"] if not (root / name).is_file()]
            if missing:
                block(task, "sources", {"summary": "Нет необходимых источников", "evidence": missing}, expected_git)
                databases.release(task["id"])
                state["current"] = None
            return bool(missing)

        def while_waiting(call, between):
            """Приёмка идёт минуты (1–4, ночи 27.09), а главному потоку в это время есть дело:
            подхватывать слоты авторов. Вторая приёмка одновременно общего времени не
            сокращает — узкое место авторы (замер: 140 мин и так и так), — а простой слотов
            во время приёмки стоил 7.1 мин на 18 задач. Приёмщик только читает, подхват
            трогает лишь `.git/worktrees`; проверка «приёмщик не менял checkout» — как прежде.
            """
            if between is None:
                return call()
            between()
            reviewer = concurrent.futures.ThreadPoolExecutor(max_workers=1)
            try:
                future = reviewer.submit(call)
                while True:
                    try:
                        return future.result(timeout=REVIEW_POLL)
                    except concurrent.futures.TimeoutError:
                        between()
            finally:
                # Не ждать: при остановке процесс приёмщика гасит stop_live, а ожидание
                # здесь держало бы остановку до конца приёмки.
                reviewer.shutdown(wait=False)

        def accept(task, work, expected_git, links_before, patch=None, between=None):
            """После автора: применить, проверить, отдать приёмщику, закоммитить или забраковать."""
            if patch is not None and work["status"] != "blocked":
                execute(["git", "apply", "--binary", str(patch)], root,
                        run_dir / f'{task["id"]}-apply', deadline)
            # Git трогать нельзя никому и никогда: коммит, ветка или индекс, сдвинутые
            # автором, означают, что прогон больше не знает, на чём стоит. Это отказ,
            # а не плохая работа.
            if git_state(root) != expected_git:
                raise RuntimeError("Исполнитель изменил Git")
            # Файлы вне задачи — брак ОДНОЙ задачи, а не ночи. `block` архивирует всё
            # наружу и прячет в stash, то есть дерево возвращается к базе, а работа не
            # теряется: строгость ничего не добавляет, а цена измерена. Ночь
            # night-2026-09-26-0821 умерла на ПЕРВОЙ задаче, потому что автор сам
            # запустил refs_shift --fix и перенумеровал два документа сверх outputs —
            # ровно те, которые контроллер и так перенумеровал бы следом сам.
            outside = changed(root) - set(task["outputs"])
            if retry and task["id"] == retry["current"]:
                outside -= carried_refs   # перенумеровал контроллер прошлого прогона, не автор
            if outside:
                note = f'Исполнитель изменил файлы вне задачи: {sorted(outside)}'
                allowed = f'Разрешено было: {sorted(task["outputs"])}'
                if work["status"] == "blocked":
                    # Автор уже признал брак — но выход за границы всё равно обязан
                    # попасть в причину: иначе утром это не с чем связать.
                    work = {**work, "summary": f'{work["summary"]} | {note}'[:500],
                            "evidence": [*work["evidence"], allowed]}
                else:
                    work = {"status": "blocked", "summary": note[:500],
                            "evidence": [str(run_dir / f'{task["id"]}-work.stdout.log'), allowed]}
            if work["status"] == "blocked":
                block(task, "work", work, expected_git)
                databases.release(task["id"])
                state["current"] = None
                return
            if not changed(root):
                block(task, "work", {"summary": "Исполнитель сообщил done без изменений; нужна сверка очереди",
                                     "evidence": work.get("evidence", [])}, expected_git)
                databases.release(task["id"])
                state["current"] = None
                return
            # Ссылки документов на сдвинутые строки чинит контроллер: автор не имеет
            # права трогать чужие документы, а держать в голове тысячи ссылок не может
            # никто. Молча правятся только дословно переехавшие строки; изменившиеся
            # уходят списком проверяющему — они могли стать ложью по существу.
            renumbered, eyes = refs_shift.renumber(root)
            if renumbered or eyes:
                (run_dir / f'{task["id"]}-refs.json').write_text(json.dumps(
                    {"перенумеровано": renumbered, "требуют_глаз": eyes}, ensure_ascii=False, indent=2))
            touched = set(task["outputs"]) | {item["документ"] for item in renumbered}
            if retry and task["id"] == retry["current"]:
                touched |= carried_refs
            if changed(root) - touched:
                raise RuntimeError("Перенумерация ссылок вышла за пределы задачи и своих правок")
            before_review = git(root, "diff", "HEAD")
            files_before = file_snapshot(root)
            check_failure = None
            try:
                execute(["npm", "run", "verify"], root / "frontend_vue", run_dir / f'{task["id"]}-check-verify', deadline)
                execute_checks(root, task.get("checks", []), run_dir / f'{task["id"]}-check-extra', deadline,
                               env=databases.env_for(task["id"]))
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
                databases.release(task["id"])
                state["current"] = None
                return
            try:
                review = while_waiting(lambda: ask_agent(root, backends, task, "review", run_dir, deadline,
                                                         databases.env_for(task["id"])), between)
            except CommandFailed:
                raise
            except (RuntimeError, ValueError) as error:
                # Ответ приёмщика, которым нельзя пользоваться (не JSON, не по схеме), —
                # брак ОДНОЙ задачи, как у автора: ночь 2026-09-27-0224 простояла с 05:27
                # до утра из-за одного такого ответа. Изменённый приёмщиком checkout
                # по-прежнему останавливает прогон — проверка ниже.
                review = {"status": "blocked",
                          "summary": f"Ответ приёмщика непригоден: {error}"[:500],
                          "evidence": [str(run_dir / f'{task["id"]}-review.stdout.log')]}
            if (git_state(root) != expected_git or git(root, "diff", "HEAD") != before_review
                    or file_snapshot(root) != files_before):
                raise RuntimeError("Проверяющий изменил checkout")
            if review["status"] == "blocked":
                block(task, "review", review, expected_git)
                databases.release(task["id"])
                state["current"] = None
                return
            execute(["git", "add", "--", *sorted(changed(root))], root,
                    run_dir / f'{task["id"]}-stage', deadline)
            expected_tree = git(root, "write-tree").strip()
            execute(["git", "commit", "-m", f'night: {task["id"]}'], root,
                    run_dir / f'{task["id"]}-commit', deadline)
            if (git(root, "rev-parse", "HEAD^{tree}").strip() != expected_tree or changed(root)
                    or git(root, "branch", "--show-current") != expected_git[1]):
                raise RuntimeError("Коммит или hook изменил проверенное дерево; результат не принят")
            state["completed"].append({"task": task["id"], "commit": git(root, "rev-parse", "HEAD").strip()})
            databases.release(task["id"])
            save("task-done")
            if changed(root):
                raise RuntimeError("После коммита осталось изменённое дерево")

        if retry:
            # Сохранённая работа лежит в checkout — она идёт первой, до любого автора.
            task = next(t for t in tasks if t["id"] == retry["current"])
            if budget_allows():
                attempts += 1
                expected_git, links_before = begin(task)
                if not sources_missing(task, expected_git):
                    accept(task, {"status": "done"}, expected_git, links_before)

        if parallel <= 1:
            for task in tasks:
                if exhausted:
                    break
                if task["id"] in resolved():
                    continue
                unavailable = failed_deps(task)
                if unavailable:
                    state["waiting"].append({"task": task["id"], "dependencies": sorted(unavailable)})
                    save("task-waiting")
                    continue
                if attempts >= max_tasks:
                    continue
                if not may_start() or not budget_allows():
                    break
                attempts += 1
                expected_git, links_before = begin(task)
                if sources_missing(task, expected_git):
                    continue
                try:
                    work = ask_agent(root, backends, task, "work", run_dir, deadline,
                                     databases.env_for(task["id"]))
                except CommandFailed:
                    # Порядок веток тут — не стиль, а смысл: CommandFailed наследует
                    # RuntimeError, и без этой строки отказ среды (упавший CLI, сбой
                    # сервиса у автора) был бы принят за плохой ответ и тихо забракован
                    # как одна задача. Отказ среды обязан останавливать ночь.
                    raise
                except (RuntimeError, ValueError) as error:
                    # Та же политика, что в write_author: непригодный ответ — брак ОДНОЙ
                    # задачи. Без этой ветки одиночный автор был защищён слабее, чем
                    # параллельный: любая проза вместо JSON валила всю ночь.
                    work = {"status": "blocked",
                            "summary": f'Ответ автора непригоден: {error}'[:500],
                            "evidence": [str(run_dir / f'{task["id"]}-work.stdout.log')]}
                accept(task, work, expected_git, links_before)
        else:
            # Конвейер: автор закончил — его задача идёт на проверки и приёмку, а его слот
            # сразу берёт следующую. Пачка «все пишут → все по очереди» держала быстрого
            # автора без дела до конца самого медленного: 3–18 мин на пачку (ночи 27.09).
            # Инварианты прежние: Git и checkout меняет только главный поток, коммит — по
            # одной задаче, авторы в своих worktree.
            # accepting — задача на проверках и приёмке: её файлы заняты, как у пишущих.
            running, finished, ports, accepting = {}, [], {}, []
            pool = pools[0] = concurrent.futures.ThreadPoolExecutor(max_workers=parallel)

            def in_flight():
                return [*running.values(), *(item[0] for item in finished), *accepting]

            def fill(checkout_clean=True):
                nonlocal attempts
                active = {t["id"] for t in in_flight()}
                # Незакоммиченная работа: её файлы нельзя ни писать, ни читать — читатель
                # увидел бы старую версию, которую коммит соседа вот-вот заменит.
                busy = {name for t in in_flight() for name in t["outputs"]}
                candidates = []
                for task in tasks:
                    if task["id"] in active or task["id"] in resolved():
                        continue
                    unavailable = failed_deps(task)
                    if unavailable:
                        state["waiting"].append({"task": task["id"], "dependencies": sorted(unavailable)})
                        save("task-waiting")
                        continue
                    if deps[task["id"]] - resolved() or busy & set(task["sources"]):
                        continue
                    candidates.append(task)
                started = []
                for task in disjoint_batch(candidates, parallel - len(running), busy):
                    if exhausted or attempts >= max_tasks or not may_start() or not budget_allows():
                        break
                    if any(not (root / name).is_file() for name in task["sources"]):
                        # Брак по источникам прячет checkout в stash — посреди чужой
                        # приёмки это спрятало бы и её работу. Ждём чистого checkout.
                        if checkout_clean:
                            attempts += 1
                            sources_missing(task, git_state(root))
                        continue
                    attempts += 1
                    port = author_ports(1, taken={p + d for p in ports.values() for d in (-1, 0, 1)})[0]
                    ports[task["id"]] = port
                    add_worktree(root, task, run_dir)
                    # Свой TMPDIR: авторы пачки писали в одни и те же /tmp/mine.ts и
                    # /tmp/head-load.txt (ночь 2026-09-27-2225) и затёрли бы друг другу.
                    temp = run_dir / f'tmp-{task["id"]}'
                    temp.mkdir(exist_ok=True)
                    future = pool.submit(write_author, root, backends, task, run_dir, deadline,
                                         {**databases.env_for(task["id"]), "PW_PORT": str(port),
                                          "TMPDIR": str(temp)})
                    running[future] = task
                    writing.add(task["id"])
                    started.append(task["id"])
                if started:
                    state["batch"] = started
                    save("batch")

            def harvest(wait):
                if not running:
                    return
                done = [f for f in running if f.done()]
                if wait and not done:
                    done, _ = concurrent.futures.wait(running, return_when=concurrent.futures.FIRST_COMPLETED)
                for future in done:
                    task = running.pop(future)
                    writing.discard(task["id"])
                    ports.pop(task["id"], None)
                    work, patch = future.result()   # отказ среды у автора — остановка ночи
                    drop_worktree(root, run_dir / f'wt-{task["id"]}')
                    finished.append((task, work, patch))

            def between():
                harvest(False)
                fill(checkout_clean=False)

            fill()
            while running or finished:
                if not finished:
                    harvest(True)
                    fill()
                while finished:
                    task, work, patch = finished.pop(0)
                    accepting.append(task)
                    expected_git, links_before = begin(task)
                    accept(task, work, expected_git, links_before, patch, between)
                    accepting.clear()
                    harvest(False)
                    fill()   # принятая задача могла открыть зависимые
            pool.shutdown()
        state["current"] = None
        state["tokens"] = spent_tokens(backends, run_dir)
        resolved_count = sum(len(state[key]) for key in ("completed", "blocked", "waiting"))
        state["status"] = ("token-budget" if exhausted else
                           "time-limit" if late[0] and resolved_count < len(tasks) else
                           "task-limit" if resolved_count < len(tasks) else
                           "completed-with-blockers" if state["blocked"] else "completed")
        drop_worktrees(root, run_dir)
        databases.dispose()
        save("finish")
        return 0
    except (Exception, KeyboardInterrupt) as exc:
        # Трассировка — рядом с журналом: причина «Expecting value…» без места, где она
        # случилась, утром не разбирается ни человеком, ни сторожем.
        import traceback
        (run_dir / "stop-traceback.txt").write_text(traceback.format_exc())
        # Авторы конвейера живут в потоках: без этого ядро ждало бы их до конца.
        stop_live()
        if pools[0]:
            pools[0].shutdown(wait=True, cancel_futures=True)
        drop_worktrees(root, run_dir)
        databases.dispose()
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
    parser.add_argument("--shared-db", action="store_true",
                        help="Общая база на все задачи — то, чем был вызван БАГ-05. Только для разбора "
                             "самой механики; в прогоне не использовать")
    parser.add_argument("--run", action="store_true", help="Без флага — только preflight, без вызова модели")
    parser.add_argument("--run-dir", type=Path)
    parser.add_argument("--minutes", type=float, help="До какого момента начинать задачи, минут от старта")
    parser.add_argument("--finish-minutes", type=float, default=0,
                        help="Запас сверх --minutes начатым задачам на доделку; 0 — обрыв на сроке")
    parser.add_argument("--max-tasks", type=int)
    parser.add_argument("--retry-review", type=Path, help="Каталог остановленного прогона: повторить проверки и приёмку сохранённой работы")
    args = parser.parse_args()
    root = args.workspace.resolve()
    queue = json.loads(args.queue.read_text())
    backends = load_routing(args.routing, args.codex)
    # Изоляция включена ПО УМОЛЧАНИЮ везде, где есть чему отравляться: БАГ-05 вернулся бы
    # от одного забытого флага, а забытый флаг ничем не виден. Репозиторий без backend/.env
    # базы не имеет вовсе — там изолировать нечего, и это не умолчание, а отсутствие предмета.
    isolate = not args.shared_db and (root / "backend/.env").is_file()
    databases = night_db.TaskDatabases(night_db.read_database_url(root)) if isolate else night_db.NoDatabases()
    if args.run and (args.run_dir is None or args.minutes is None or not math.isfinite(args.minutes)
                     or args.minutes <= 0 or args.max_tasks is None or args.max_tasks <= 0):
        parser.error("Для --run обязательны --run-dir, положительные --minutes и --max-tasks")
    if not math.isfinite(args.finish_minutes) or args.finish_minutes < 0:
        parser.error("--finish-minutes — неотрицательное число")
    # Shared git directory lock prevents two controllers using the same repository.
    common = Path(git(root, "rev-parse", "--git-common-dir").strip())
    common = (root / common).resolve()
    if not args.run:
        retry = retry_checkpoint(root, queue, args.retry_review.resolve()) if args.retry_review else None
        preflight(root, queue, backends, retry)
        if isolate:
            # Недоступный сервер обязан всплыть на preflight, а не на первой задаче:
            # иначе прогон узнаёт об этом, уже потратив ход автора.
            print(f"Базы на задачу: сервер отвечает, сейчас есть {databases.existing()}")
        routed = ", ".join(f"{role}={backends[role].name}" for role in ROLES)
        print(f"Preflight пройден: {len(queue['tasks'])} задач, {routed}. Модель не запускалась.")
        return 0
    with (common / "codex-night.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        previous = args.retry_review.resolve() if args.retry_review else None
        retry = retry_checkpoint(root, queue, previous) if previous else None
        preflight(root, queue, backends, retry)
        return run(root, queue, backends, args.run_dir.resolve(), args.minutes, args.max_tasks,
                   retry, previous, args.token_budget, args.parallel, databases, args.finish_minutes)


if __name__ == "__main__":
    def stop_signal(_number, _frame):
        raise KeyboardInterrupt("Получен сигнал остановки")

    signal.signal(signal.SIGTERM, stop_signal)
    try:
        sys.exit(main())
    except Exception as error:
        print(f"Прогон не запущен: {error}", file=sys.stderr)
        sys.exit(2)
