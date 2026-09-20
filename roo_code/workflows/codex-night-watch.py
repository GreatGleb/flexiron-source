"""One-shot recovery guard for an already running, older controller.

Run from a frozen directory beside controller.py and queue.json. It waits for
the specified systemd service, never restarts a user pause, and hands off at most
once to the updated controller within the original deadline.
"""

import argparse
from datetime import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import time


def eligible(state, service_result, previous, classify):
    task = state.get("current")
    if (service_result != "exit-code" or state.get("status") != "stopped"
            or not isinstance(task, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", task)):
        return False
    # A timeout, signal, rejected task or failed machine check is not a CLI outage.
    if not re.fullmatch(rf"Команда завершилась с кодом [1-9][0-9]*: {re.escape(task)}-review; см\. логи",
                        state.get("reason", "")):
        return False
    return bool(classify(previous / f"{task}-review.stdout.log"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pointer", type=Path, required=True)
    parser.add_argument("--unit", required=True)
    parser.add_argument("--watch-unit", required=True)
    parser.add_argument("--codex", required=True)
    args = parser.parse_args()
    here = Path(__file__).resolve().parent
    metadata = json.loads(args.pointer.read_text())
    if metadata["unit"] != args.unit:
        raise RuntimeError("Активный запуск уже сменился")
    previous = Path(metadata["run_dir"])
    deadline = datetime.fromisoformat(metadata["deadline"]).timestamp()
    queue = here / "queue.json"
    if hashlib.sha256(queue.read_bytes()).hexdigest() != metadata["queue_sha256"]:
        raise RuntimeError("Очередь не совпадает с исходным запуском")
    spec = importlib.util.spec_from_file_location("controller", here / "controller.py")
    controller = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(controller)
    while time.time() < deadline:
        active = json.loads(args.pointer.read_text())
        if active["unit"] != args.unit or active["run_dir"] != str(previous):
            print("Активный запуск сменился; наблюдение завершено", flush=True)
            return 0
        result = subprocess.run(["systemctl", "--user", "show", args.unit,
                                 "--property=ActiveState,Result"], capture_output=True, text=True, check=True)
        properties = dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)
        if properties.get("ActiveState") in ("active", "activating", "deactivating", "reloading"):
            time.sleep(10)
            continue
        state = json.loads((previous / "state.json").read_text())
        if not eligible(state, properties.get("Result"), previous, controller.service_error_kind):
            print("Завершение, пауза или иной отказ: автоматического перезапуска нет", flush=True)
            return 0
        root = Path(metadata["workspace"]).resolve()
        data = json.loads(queue.read_text())
        checkpoint = controller.retry_checkpoint(root, data, previous)
        controller.preflight(root, data, args.codex, checkpoint)
        remaining = deadline - time.time()
        if remaining <= 5:
            return 0
        run_dir = here / "run"
        # Exclusive watcher snapshot/run directory makes this a one-shot action.
        if run_dir.exists():
            raise RuntimeError("Повторный запуск наблюдателя запрещён")
        metadata.update(unit=args.watch_unit, previous_run=str(previous), run_dir=str(run_dir),
                        minutes=remaining / 60, recovery_reason="Automatic recovery of recognized review service error",
                        stop_command=["systemctl", "--user", "stop", args.watch_unit])
        (here / "launch.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2))
        temp = args.pointer.with_suffix(".watch.tmp")
        temp.write_text(json.dumps(metadata, ensure_ascii=False, indent=2))
        temp.replace(args.pointer)
        command = ["systemd-inhibit", "--what=sleep:idle:handle-lid-switch", "--mode=block",
                   "--who=Flexiron backend", "--why=Authorized backend queue", sys.executable,
                   str(here / "controller.py"), "--workspace", str(root), "--queue", str(queue),
                   "--codex", args.codex, "--run", "--run-dir", str(run_dir),
                   "--retry-review", str(previous), "--minutes", str(remaining / 60),
                   "--max-tasks", str(metadata["max_tasks"])]
        print("Восстановление проверки в прежнем временном окне", flush=True)
        return subprocess.call(command)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
