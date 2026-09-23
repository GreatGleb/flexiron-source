"""Супервизор ночи: держит прогон занятым, пока есть время и лимит.

Ядро (`codex-night.py`) проходит одну очередь и заканчивается. Ночь кончалась вместе с
ней: восемь задач — полтора часа, дальше тишина до утра. Супервизор замыкает цикл —
очередь опустела, зовём оператора нарезать следующую порцию по планам, гоним, повторяем.

Чего супервизор НЕ делает: не трогает границы задач, не коммитит сам, не мержит и не
пушит. Всё это остаётся в ядре и в политике прогона; здесь только «чем занять ночь».
"""

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from headless_backends import ClaudeBackend, load_routing  # noqa: E402

RUNNER = HERE / "codex-night.py"


def call_operator(root, prompt, model, binary, out_dir, index, done_ids):
    """Одна read-only сессия оператора: вернуть очередь задач JSON-ом."""
    history = ("\nУЖЕ СДЕЛАНО этой ночью — не предлагай снова и не переделывай: "
               + (", ".join(sorted(done_ids)) if done_ids else "ничего") + "\n")
    prefix = out_dir / f"operator-{index}"
    backend = ClaudeBackend({"model": model, **({"binary": binary} if binary else {})})
    # Оператор читает checkout, а не каталог, из которого его запустили.
    argv = backend.build("review", root, out_dir, prefix.with_suffix(".json"))
    with prefix.with_suffix(".stdout.log").open("wb") as out, prefix.with_suffix(".stderr.log").open("wb") as err:
        subprocess.run(argv, input=(prompt + history).encode(), stdout=out, stderr=err, cwd=root, check=True)
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--routing", type=Path, required=True)
    parser.add_argument("--operator-prompt", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True, help="Каталог ночи, вне checkout")
    parser.add_argument("--hours", type=float, required=True)
    parser.add_argument("--token-budget", type=int, required=True)
    parser.add_argument("--operator-model", default="claude-opus-5")
    parser.add_argument("--operator-binary")
    parser.add_argument("--max-tasks", type=int, default=8, help="Задач в одной порции")
    parser.add_argument("--parallel", type=int, default=1,
                        help="Сколько авторов писать одновременно внутри порции")
    parser.add_argument("--max-batches", type=int, default=20)
    args = parser.parse_args()

    root = args.workspace.resolve()
    args.out.mkdir(parents=True, exist_ok=True)
    deadline = time.monotonic() + args.hours * 3600
    prompt = args.operator_prompt.read_text()
    load_routing(args.routing)  # падаем сразу, если маршрутизация негодна

    spent, done_ids, idle_batches = 0, set(), 0
    report = {"batches": [], "stopped": None}

    def finish(reason):
        report["stopped"] = reason
        report["tokens"] = spent
        (args.out / "supervisor.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
        print(f"Ночь закончена: {reason}. Порций: {len(report['batches'])}, "
              f"задач принято: {sum(b['completed'] for b in report['batches'])}, токенов: {spent}")
        return 0

    for index in range(1, args.max_batches + 1):
        minutes_left = (deadline - time.monotonic()) / 60
        if minutes_left <= 10:
            return finish("время вышло")
        if spent >= args.token_budget:
            return finish(f"потолок токенов исчерпан: {spent} из {args.token_budget}")

        try:
            queue_path, queue, operator_spent = call_operator(
                root, prompt, args.operator_model, args.operator_binary, args.out, index, done_ids)
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
            idle_batches += 1
            if idle_batches >= 3:
                return finish("три порции подряд без принятых задач")
            continue

        result = runner(["--workspace", str(root), "--queue", str(queue_path), "--routing", str(args.routing),
                         "--run", "--run-dir", str(run_dir), "--minutes", f"{minutes_left - 5:.1f}",
                         "--max-tasks", str(args.max_tasks), "--parallel", str(args.parallel),
                         "--token-budget", str(args.token_budget - spent)])
        state = json.loads((run_dir / "state.json").read_text())
        spent = measure(args.out)
        completed = [c["task"] for c in state["completed"]]
        done_ids.update(completed)
        done_ids.update(b["task"] for b in state.get("blocked", []))
        report["batches"].append({"batch": index, "completed": len(completed), "tasks": completed,
                                  "blocked": [b["task"] for b in state.get("blocked", [])],
                                  "status": state["status"], "tokens": state.get("tokens", 0)})
        idle_batches = 0 if completed else idle_batches + 1
        if idle_batches >= 3:
            return finish("три порции подряд без принятых задач")
        if result.returncode:
            return finish(f"ядро остановилось: {state.get('reason', '')[:200]}")
    return finish("порции кончились")


if __name__ == "__main__":
    sys.exit(main())
