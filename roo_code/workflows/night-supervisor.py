"""Супервизор ночи: держит прогон занятым, пока есть время и лимит.

Ядро (`codex-night.py`) проходит одну очередь и заканчивается. Ночь кончалась вместе с
ней: восемь задач — полтора часа, дальше тишина до утра. Супервизор замыкает цикл —
очередь опустела, зовём оператора нарезать следующую порцию по планам, гоним, повторяем.

Чего супервизор НЕ делает: не трогает границы задач, не коммитит сам, не мержит и не
пушит. Всё это остаётся в ядре и в политике прогона; здесь только «чем занять ночь».
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from headless_backends import ClaudeBackend, load_routing  # noqa: E402

RUNNER = HERE / "codex-night.py"


def rejection_note(stderr, queue):
    """Отказ preflight — в виде, из которого оператор может исправить очередь.

    Ядро отвергает очередь целиком и называет правило, но не всегда виновника:
    «Некорректный id задачи» не говорит, какой. Поэтому рядом кладём id самой
    отвергнутой очереди — ночью 2026-09-25/26 порция из пяти годных задач ушла за
    четыре заглавные буквы в одном id, и оператор, не узнав причины, выдал то же снова.
    """
    ids = ", ".join(str(t.get("id")) for t in queue.get("tasks", []) if isinstance(t, dict))
    return ("\nПРЕДЫДУЩАЯ ОЧЕРЕДЬ ОТВЕРГНУТА ЦЕЛИКОМ на preflight — ни одна задача из неё не "
            "запускалась. Ответ ядра:\n" + (stderr.strip()[-2000:] or "(ядро не объяснило)")
            + "\nid в отвергнутой очереди: " + (ids or "нет") + "\n"
            "Найди в своей очереди то, на что указывает эта ошибка, и исправь именно это, "
            "прежде чем отдавать ответ. Очередь с той же ошибкой будет отвергнута снова "
            "и сожжёт ещё одну порцию.\n")


def blocked_note(blocked):
    """Задачи, которые ядро забраковало этой ночью, с причинами браковки.

    Их id уже в списке сделанного, но оператор повторял саму ФОРМУ неудачной задачи
    под другим id. Причина браковки — единственное, что говорит, что в форме не так.
    """
    if not blocked:
        return ""
    lines = [f"- {b['task']} ({b.get('phase', '?')}): {str(b.get('reason', '')).strip()[:300]}"
             for b in blocked[-10:]]
    return ("\nЗАБРАКОВАНО ядром этой ночью — прочитай причины и не выдавай задач, которые "
            "упадут так же; если задача нужна, измени в ней то, на что указывает причина:\n"
            + "\n".join(lines) + "\n")


def call_operator(root, prompt, model, binary, out_dir, index, done_ids, feedback=""):
    """Одна read-only сессия оператора: вернуть очередь задач JSON-ом."""
    history = ("\nУЖЕ СДЕЛАНО этой ночью — не предлагай снова и не переделывай: "
               + (", ".join(sorted(done_ids)) if done_ids else "ничего") + "\n")
    prefix = out_dir / f"operator-{index}"
    backend = ClaudeBackend({"model": model, **({"binary": binary} if binary else {})})
    # Оператор читает checkout, а не каталог, из которого его запустили.
    argv = backend.build("review", root, out_dir, prefix.with_suffix(".json"))
    full_prompt = prompt + history + feedback
    # Что именно оператору сказали — утром это первое, что хочется увидеть.
    prefix.with_suffix(".prompt.txt").write_text(full_prompt)
    with prefix.with_suffix(".stdout.log").open("wb") as out, prefix.with_suffix(".stderr.log").open("wb") as err:
        subprocess.run(argv, input=full_prompt.encode(), stdout=out, stderr=err, cwd=root, check=True)
    backend.finalize("review", prefix, prefix.with_suffix(".json"))
    queue = json.loads(prefix.with_suffix(".json").read_text())
    spent = backend.tokens(prefix)
    if not isinstance(queue, dict) or not queue.get("tasks"):
        raise ValueError("Оператор вернул пустую очередь")
    path = out_dir / f"queue-{index}.json"
    path.write_text(json.dumps(queue, ensure_ascii=False, indent=2))
    return path, queue, spent


def measure(out_dir):
    """Фактический расход всей ночи по логам: вызовы оператора плюс вызовы ядра.

    Первый прогон показал, чем плоха вера в чужое число: ядро писало в state расход,
    снятый ПЕРЕД задачей, и супервизор начинал лишнюю порцию сверх потолка владельца.
    """
    total = 0
    for path in sorted(out_dir.rglob("*.stdout.log")):
        if not re.fullmatch(r".*-(?:work|review)(?:-retry-\d+)?\.stdout\.log|operator-\d+\.stdout\.log",
                            path.name):
            continue
        try:
            usage = json.loads(path.read_text()).get("modelUsage") or {}
        except (OSError, json.JSONDecodeError):
            continue
        total += sum(int(m.get("inputTokens", 0)) + int(m.get("outputTokens", 0))
                     + int(m.get("cacheCreationInputTokens", 0)) for m in usage.values())
    return total


def runner(args_list):
    return subprocess.run([sys.executable, str(RUNNER), *args_list], capture_output=True, text=True)


# Параметры ночи, которые продолжение берёт из `night.json`, а не из командной строки:
# сторож поднимает ночь, не зная, с какими флагами её запускал владелец.
NIGHT_PARAMS = ("workspace", "routing", "operator_prompt", "token_budget", "operator_model",
                "operator_binary", "max_tasks", "parallel", "max_batches", "idle_limit")


def number(path):
    match = re.fullmatch(r"(?:run|queue|operator)-(\d+)(?:\..*)?", path.name)
    return int(match.group(1)) if match else 0


def night_so_far(out):
    """Что ночь уже сделала — для продолжения в том же каталоге.

    Сделанное и забракованное собираются по `state.json` всех прогонов, а не по памяти
    упавшего супервизора: её нет. Номер следующей порции — после самого большого из уже
    занятых, иначе ядро откажется писать в существующий `run-N`.
    """
    report = json.loads((out / "supervisor.json").read_text()) if (out / "supervisor.json").is_file() else {}
    report = {"batches": report.get("batches", []), "stopped": None, "resumes": report.get("resumes", [])}
    done, blocked, seen = set(), [], set()
    recorded = {b["batch"] for b in report["batches"]}
    for path in sorted(out.glob("run-*/state.json"), key=lambda p: number(p.parent)):
        state = json.loads(path.read_text())
        done.update(c["task"] for c in state["completed"])
        if number(path.parent) and number(path.parent) not in recorded:
            # Супервизор умер, пока ядро гнало эту порцию, и итога не записал: ядро её
            # дописало само. Без этой строки принятые задачи порции исчезли бы из отчёта
            # ночи, хотя их коммиты в ветке (живая проба сторожа, 2026-09-27).
            report["batches"].append({
                "batch": number(path.parent), "completed": len(state["completed"]),
                "tasks": [c["task"] for c in state["completed"]],
                "blocked": [b["task"] for b in state.get("blocked", [])],
                "status": state["status"], "tokens": state.get("tokens", 0), "restored": True})
        for item in state.get("blocked", []):
            done.add(item["task"])
            if item["task"] not in seen:
                seen.add(item["task"])
                blocked.append(item)
    report["batches"].sort(key=lambda b: b["batch"])
    start = 1 + max((number(p) for p in out.iterdir()), default=0)
    return report, done, blocked, start


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path)
    parser.add_argument("--routing", type=Path)
    parser.add_argument("--operator-prompt", type=Path)
    parser.add_argument("--out", type=Path, required=True, help="Каталог ночи, вне checkout")
    parser.add_argument("--hours", type=float)
    parser.add_argument("--token-budget", type=int)
    parser.add_argument("--operator-model", default="claude-opus-5")
    parser.add_argument("--operator-binary")
    parser.add_argument("--max-tasks", type=int, default=8, help="Задач в одной порции")
    parser.add_argument("--parallel", type=int, default=1,
                        help="Сколько авторов писать одновременно внутри порции")
    parser.add_argument("--max-batches", type=int, default=20)
    parser.add_argument("--idle-limit", type=int, default=3,
                        help="Сколько порций подряд без принятых задач заканчивают ночь; 0 — не "
                             "заканчивать вовсе")
    parser.add_argument("--resume", action="store_true",
                        help="Продолжить ночь в --out: параметры и срок — из её night.json")
    parser.add_argument("--retry-review", type=Path,
                        help="При продолжении: сначала повторить приёмку остановленного прогона")
    args = parser.parse_args()

    if args.resume:
        night = json.loads((args.out / "night.json").read_text())
        for key in NIGHT_PARAMS:
            value = night[key]
            setattr(args, key, Path(value) if key in ("workspace", "routing", "operator_prompt") else value)
        # Срок ночи — тот, что назначил владелец при старте: продолжение его не продлевает.
        deadline_wall = night["deadline"]
        resumes = night.get("resumes", 0) + 1
    else:
        missing = [name for name in ("workspace", "routing", "operator_prompt", "hours", "token_budget")
                   if getattr(args, name) is None]
        if missing:
            parser.error("обязательны: " + ", ".join("--" + m.replace("_", "-") for m in missing))
        if args.retry_review:
            parser.error("--retry-review — только вместе с --resume")
        deadline_wall = time.time() + args.hours * 3600
        resumes = 0

    root = args.workspace.resolve()
    args.out.mkdir(parents=True, exist_ok=True)
    deadline = time.monotonic() + (deadline_wall - time.time())
    prompt = args.operator_prompt.read_text()
    load_routing(args.routing)  # падаем сразу, если маршрутизация негодна
    # По этому файлу сторож узнаёт, жива ли ночь, до какого часа она должна идти и с
    # какими параметрами её поднимать.
    (args.out / "night.json").write_text(json.dumps({
        "pid": os.getpid(), "deadline": deadline_wall, "resumes": resumes,
        "branch": subprocess.check_output(["git", "-C", str(root), "branch", "--show-current"],
                                          text=True).strip(),
        **{key: str(getattr(args, key)) if isinstance(getattr(args, key), Path) else getattr(args, key)
           for key in NIGHT_PARAMS}}, ensure_ascii=False, indent=2))

    if args.resume:
        report, done_ids, blocked, start = night_so_far(args.out)
        report["resumes"].append({"time": time.time(), "from_batch": start,
                                  "retry_review": str(args.retry_review) if args.retry_review else None})
    else:
        report, done_ids, blocked, start = {"batches": [], "stopped": None, "resumes": []}, set(), [], 1
    spent = measure(args.out)
    idle_batches = 0
    for batch in reversed(report["batches"]):
        if batch["completed"]:
            break
        idle_batches += 1
    rejection = ""

    def persist():
        report["tokens"] = spent
        (args.out / "supervisor.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))

    def finish(reason):
        report["stopped"] = reason
        persist()
        print(f"Ночь закончена: {reason}. Порций: {len(report['batches'])}, "
              f"задач принято: {sum(b['completed'] for b in report['batches'])}, токенов: {spent}")
        return 0

    def absorb(index, run_dir, result, extra=None):
        """Итог прогона ядра — в отчёт ночи; причина конца ночи или None."""
        nonlocal spent, idle_batches
        if not (run_dir / "state.json").is_file():
            # Ядро не дошло даже до первой записи состояния — прогон не запустился.
            return f"ядро не запустилось: {result.stderr.strip()[-200:]}"
        state = json.loads((run_dir / "state.json").read_text())
        spent = measure(args.out)
        completed = [c["task"] for c in state["completed"]]
        known = {b["task"] for b in blocked}
        done_ids.update(completed)
        done_ids.update(b["task"] for b in state.get("blocked", []))
        blocked.extend(b for b in state.get("blocked", []) if b["task"] not in known)
        report["batches"].append({"batch": index, "completed": len(completed), "tasks": completed,
                                  "blocked": [b["task"] for b in state.get("blocked", [])],
                                  "status": state["status"], "tokens": state.get("tokens", 0),
                                  **(extra or {})})
        persist()
        idle_batches = 0 if completed else idle_batches + 1
        if args.idle_limit and idle_batches >= args.idle_limit:
            return f"порций подряд без принятых задач: {idle_batches}"
        if result.returncode:
            return f"ядро остановилось: {state.get('reason', '')[:200]}"
        return None

    persist()
    if args.retry_review:
        # Повтор приёмки идёт ПЕРВЫМ: он требует HEAD ровно как при остановке, а любая
        # новая порция его сдвинет.
        previous = args.retry_review.resolve()
        run_dir = args.out / f"run-{start}"
        queue = json.loads((previous / "queue.json").read_text())
        minutes_left = (deadline - time.monotonic()) / 60
        result = runner(["--workspace", str(root), "--queue", str(previous / "queue.json"),
                         "--routing", str(args.routing), "--run", "--run-dir", str(run_dir),
                         "--minutes", f"{minutes_left - 5:.1f}", "--max-tasks", str(len(queue["tasks"])),
                         "--parallel", str(args.parallel), "--token-budget", str(args.token_budget - spent),
                         "--retry-review", str(previous)])
        stop = absorb(start, run_dir, result, {"retry_of": previous.name})
        if stop:
            return finish(stop)
        start += 1

    for index in range(start, args.max_batches + 1):
        minutes_left = (deadline - time.monotonic()) / 60
        if minutes_left <= 10:
            return finish("время вышло")
        if spent >= args.token_budget:
            return finish(f"потолок токенов исчерпан: {spent} из {args.token_budget}")

        try:
            queue_path, queue, operator_spent = call_operator(
                root, prompt, args.operator_model, args.operator_binary, args.out, index, done_ids,
                rejection + blocked_note(blocked))
        # RuntimeError сюда попадает от разбора ответа: оператор, не сумевший выдать
        # очередь, заканчивает ночь отчётом, а не трассировкой в лог.
        except (subprocess.CalledProcessError, ValueError, RuntimeError, json.JSONDecodeError) as error:
            return finish(f"оператор не дал очередь: {error}")
        spent = measure(args.out)

        run_dir = args.out / f"run-{index}"
        checked = runner(["--workspace", str(root), "--queue", str(queue_path), "--routing", str(args.routing)])
        if checked.returncode:
            # Негодная очередь не стоит ночи: следующая порция может быть годной.
            report["batches"].append({"batch": index, "completed": 0, "preflight": checked.stderr.strip()[:400]})
            persist()
            # Причина обязана дойти до следующего оператора: без неё он повторяет ту же ошибку.
            rejection = rejection_note(checked.stderr, queue)
            idle_batches += 1
            if args.idle_limit and idle_batches >= args.idle_limit:
                return finish(f"порций подряд без принятых задач: {idle_batches}")
            continue

        rejection = ""
        result = runner(["--workspace", str(root), "--queue", str(queue_path), "--routing", str(args.routing),
                         "--run", "--run-dir", str(run_dir), "--minutes", f"{minutes_left - 5:.1f}",
                         "--max-tasks", str(args.max_tasks), "--parallel", str(args.parallel),
                         "--token-budget", str(args.token_budget - spent)])
        stop = absorb(index, run_dir, result)
        if stop:
            return finish(stop)
    return finish("порции кончились")


if __name__ == "__main__":
    sys.exit(main())
