#!/usr/bin/env python3
"""Bounded, sequential Codex pilot. No model calls without --run.

Run in a dedicated clean checkout on auto/*, with logs outside that checkout.
The controller owns logs, checks, and commits; agents only edit task files.
"""

import argparse
import fcntl
import json
import math
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time


HERE = Path(__file__).resolve().parent
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


def git(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args], text=True)


def changed(root):
    tracked = git(root, "diff", "--name-only", "-z", "HEAD").split("\0")
    untracked = git(root, "ls-files", "--others", "--exclude-standard", "-z").split("\0")
    return set(filter(None, tracked + untracked))


def git_state(root):
    return (git(root, "rev-parse", "HEAD"), git(root, "branch", "--show-current"),
            git(root, "write-tree"))


def preflight(root, queue, codex, retry=None):
    if Path(git(root, "rev-parse", "--show-toplevel").strip()).resolve() != root:
        raise ValueError("--workspace должен указывать на корень checkout")
    if not git(root, "branch", "--show-current").strip().startswith("auto/"):
        raise ValueError("Нужен отдельный checkout на ветке auto/*")
    if not retry and git(root, "status", "--porcelain").strip():
        raise ValueError("Checkout содержит несохранённые изменения; ничего не спрятано и не удалено")
    if not shutil.which(codex):
        raise ValueError("Codex CLI не найден")
    for key in ("user.name", "user.email"):
        if not git(root, "config", "--get", key).strip():
            raise ValueError(f"Не задан git {key}")
    ids = set()
    for task in queue["tasks"]:
        task_id = task["id"]
        if not task_id or any(c not in "abcdefghijklmnopqrstuvwxyz0123456789-" for c in task_id):
            raise ValueError("Некорректный id задачи")
        if task_id in ids or not task["outputs"]:
            raise ValueError("Повтор id или пустой список outputs")
        ids.add(task_id)
        for name in task["sources"] + task["outputs"]:
            path = root / name
            if Path(name).is_absolute() or ".." in Path(name).parts or not path.resolve().is_relative_to(root):
                raise ValueError(f"Путь за пределами checkout: {name}")
        for name in task["sources"]:
            if not (root / name).is_file():
                raise ValueError(f"Нет источника: {name}")
    if not queue["tasks"]:
        raise ValueError("Пустая очередь")


def retry_checkpoint(root, queue, previous):
    state = json.loads((previous / "state.json").read_text())
    if state["status"] != "stopped" or Path(state["workspace"]).resolve() != root:
        raise ValueError("Повторная приёмка требует остановленного прогона этого checkout")
    if json.loads((previous / "queue.json").read_text()) != queue:
        raise ValueError("Очередь изменилась после остановки")
    count = len(state["completed"])
    if count >= len(queue["tasks"]) or state["current"] != queue["tasks"][count]["id"]:
        raise ValueError("Контрольная точка не соответствует очереди")
    if [t["task"] for t in state["completed"]] != [t["id"] for t in queue["tasks"][:count]]:
        raise ValueError("Завершённые задачи не соответствуют очереди")
    expected_head = state["completed"][-1]["commit"] if count else state["baseline"]
    if git(root, "rev-parse", "HEAD").strip() != expected_head or git(root, "diff", "--cached").strip():
        raise ValueError("HEAD или индекс изменились после остановки")
    task = queue["tasks"][count]
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
        raise RuntimeError(f"Команда завершилась с кодом {proc.returncode}: {prefix.name}; см. логи")


def ask_agent(root, codex, task, role, run_dir, deadline):
    prefix = run_dir / f'{task["id"]}-{role}'
    result_path = prefix.with_suffix(".json")
    instruction = (
        "Ты запущен скриптом в автономном режиме. Прочитай ROO.md, "
        "roo_code/skills/vue-rules.md и roo_code/skills/verify.md, затем применимые навыки. "
        "Задача и критерии ниже. Решения владельца П1–П129 и заполненные ответы имеют "
        "приоритет над старыми вопросами и рекомендациями. Не придумывай продуктовые решения. "
        "Не используй старые /tmp/night-queue-briefs. Источники читай из этого checkout. "
        "Не изменяй ответы владельца, файлы вне outputs, Git, настройки, зависимости и скрипты. "
        "Не делай коммит, merge, push, deploy и не запускай вложенных агентов. "
        "Если задача неоднозначна или проверка недоступна — status=blocked с точной причиной. "
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
        instruction += "Логи контроллера: " + ", ".join(str(p) for p in sorted(run_dir.glob(f'{task["id"]}-check*.log'))) + "\n"
    else:
        instruction += "Ты исполнитель. Выполни задачу полностью в разрешённых файлах.\n"
    prompt = instruction + json.dumps(task, ensure_ascii=False, indent=2)
    prefix.with_suffix(".prompt.txt").write_text(prompt)
    command = [codex, "-a", "never", "exec", "--sandbox",
               "read-only" if role == "review" else "workspace-write", "--json",
               "--output-schema", str(run_dir / "schema.json"),
               "--output-last-message", str(result_path), "-"]
    execute(command, root, prefix, deadline, prompt)
    result = json.loads(result_path.read_text())
    if (set(result) != {"status", "summary", "evidence"}
            or result["status"] != "done" or not isinstance(result["summary"], str)
            or not isinstance(result["evidence"], list) or not result["evidence"]
            or not all(isinstance(item, str) and item.strip() for item in result["evidence"])):
        raise RuntimeError(f"{task['id']} / {role}: нет подтверждения выполнения: {result}")


def run(root, queue, codex, run_dir, minutes, max_tasks, retry=None, previous=None):
    if run_dir.is_relative_to(root):
        raise ValueError("Каталог результатов должен находиться вне checkout")
    # Never reuse a directory: even a stopped run remains intact.
    run_dir.mkdir(parents=True, exist_ok=False)
    shutil.copyfile(Path(__file__).resolve(), run_dir / "controller.py")
    (run_dir / "schema.json").write_text(json.dumps(SCHEMA))
    (run_dir / "queue.json").write_text(json.dumps(queue, ensure_ascii=False, indent=2))
    state = {"status": "running", "baseline": git(root, "rev-parse", "HEAD").strip(),
             "workspace": str(root), "completed": list(retry["completed"]) if retry else [],
             "current": None, "reason": "", "retried_from": str(previous) if previous else None}
    if retry:
        # Preserve the author's checkpoint so another failed review can be retried.
        task_id = retry["current"]
        shutil.copyfile(previous / f"{task_id}-work.json", run_dir / f"{task_id}-work.json")

    def save(event):
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
                 "Все изменения остались в checkout. Слияния и отправки не было.", ""]
        (run_dir / "report.md").write_text("\n".join(lines))

    deadline = time.monotonic() + minutes * 60
    save("start")
    try:
        if not retry:
            baseline_git = git_state(root)
            execute(["npm", "run", "verify"], root / "frontend_vue", run_dir / "baseline", deadline)
            if changed(root) or git_state(root) != baseline_git:
                raise RuntimeError("Baseline-проверка изменила checkout")
        start = len(state["completed"])
        for index, task in enumerate(queue["tasks"][start:start + max_tasks]):
            state["current"] = task["id"]
            save("task-start")
            expected_git = git_state(root)
            if not retry or index:
                ask_agent(root, codex, task, "work", run_dir, deadline)
            if git_state(root) != expected_git or changed(root) - set(task["outputs"]):
                raise RuntimeError("Исполнитель изменил Git или файлы вне задачи")
            if not changed(root):
                raise RuntimeError("Исполнитель сообщил done без изменений; нужна сверка очереди")
            before_review = git(root, "diff", "HEAD")
            files_before = {p: (root / p).read_bytes() if (root / p).is_file() else None for p in changed(root)}
            execute(["npm", "run", "verify"], root / "frontend_vue", run_dir / f'{task["id"]}-check-verify', deadline)
            if (root / "frontend_vue/src/services/contractRefs.spec.ts").is_file():
                for n, doc in enumerate(task["outputs"]):
                    if doc.endswith(".md"):
                        execute(["env", f"CONTRACT_REFS={doc}", "CONTRACT_REFS_STRICT=1",
                                 "./node_modules/.bin/vitest", "run", "src/services/contractRefs.spec.ts"],
                                root / "frontend_vue", run_dir / f'{task["id"]}-check-links-{n}', deadline)
            if (git_state(root) != expected_git or changed(root) != set(files_before)
                    or any(((root / p).read_bytes() if (root / p).is_file() else None) != data
                           for p, data in files_before.items())):
                raise RuntimeError("Машинная проверка изменила проверенные файлы")
            ask_agent(root, codex, task, "review", run_dir, deadline)
            if (git_state(root) != expected_git or git(root, "diff", "HEAD") != before_review
                    or changed(root) != set(files_before)
                    or any(((root / p).read_bytes() if (root / p).is_file() else None) != data
                           for p, data in files_before.items())):
                raise RuntimeError("Проверяющий изменил checkout")
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
        state["status"] = "completed" if len(state["completed"]) == len(queue["tasks"]) else "task-limit"
        save("finish")
        return 0
    except (Exception, KeyboardInterrupt) as exc:
        state["status"] = "stopped"
        state["reason"] = str(exc) or type(exc).__name__
        save("stop")
        return 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, default=Path.cwd())
    parser.add_argument("--queue", type=Path, default=HERE / "codex-night-queue.json")
    parser.add_argument("--codex", default="codex")
    parser.add_argument("--run", action="store_true", help="Без флага — только preflight, без вызова модели")
    parser.add_argument("--run-dir", type=Path)
    parser.add_argument("--minutes", type=float)
    parser.add_argument("--max-tasks", type=int)
    parser.add_argument("--retry-review", type=Path, help="Каталог остановленного прогона: повторить проверки и приёмку сохранённой работы")
    args = parser.parse_args()
    root = args.workspace.resolve()
    queue = json.loads(args.queue.read_text())
    if args.run and (args.run_dir is None or args.minutes is None or not math.isfinite(args.minutes)
                     or args.minutes <= 0 or args.max_tasks is None or args.max_tasks <= 0):
        parser.error("Для --run обязательны --run-dir, положительные --minutes и --max-tasks")
    # Shared git directory lock prevents two controllers using the same repository.
    common = Path(git(root, "rev-parse", "--git-common-dir").strip())
    common = (root / common).resolve()
    if not args.run:
        retry = retry_checkpoint(root, queue, args.retry_review.resolve()) if args.retry_review else None
        preflight(root, queue, args.codex, retry)
        print(f"Preflight пройден: {len(queue['tasks'])} задач. Модель не запускалась.")
        return 0
    with (common / "codex-night.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        previous = args.retry_review.resolve() if args.retry_review else None
        retry = retry_checkpoint(root, queue, previous) if previous else None
        preflight(root, queue, args.codex, retry)
        return run(root, queue, args.codex, args.run_dir.resolve(), args.minutes, args.max_tasks, retry, previous)


if __name__ == "__main__":
    def stop_signal(_number, _frame):
        raise KeyboardInterrupt("Получен сигнал остановки")

    signal.signal(signal.SIGTERM, stop_signal)
    try:
        sys.exit(main())
    except Exception as error:
        print(f"Прогон не запущен: {error}", file=sys.stderr)
        sys.exit(2)
