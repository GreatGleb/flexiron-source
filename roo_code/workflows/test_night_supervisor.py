"""Тесты супервизора ночи: цикл «оператор → порция → снова» и его стоп-условия.

Модель не вызывается: и оператор, и исполнитель — скрипты. Проверяется то, ради чего
супервизор написан (ночь не кончается вместе с одной очередью) и то, что он умеет
вовремя остановиться, а не крутить пустые порции до утра.
"""

import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unittest

SUPERVISOR = Path(__file__).with_name("night-supervisor.py").resolve()
_spec = importlib.util.spec_from_file_location("pilot_fixtures", Path(__file__).with_name("test_codex_night.py"))
_pilot = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_pilot)

# Один скрипт на две роли: с --restricted он оператор и возвращает очередь,
# без него — исполнитель. Очередь берётся из файла, чтобы тест ей управлял.
FAKE_CLAUDE = r'''#!/usr/bin/env python3
import json, os, pathlib, sys
args = sys.argv[1:]
prompt = sys.stdin.read()
usage = {'m': {'inputTokens': 100, 'outputTokens': 10,
               'cacheCreationInputTokens': 0, 'cacheReadInputTokens': 999999}}
if '--restricted' in args:
    calls = pathlib.Path(os.environ['NIGHT_TEST_CALLS'])
    index = calls.read_text().count('operator') if calls.exists() else 0
    with calls.open('a') as stream:
        stream.write('operator\n')
    assert 'УЖЕ СДЕЛАНО этой ночью' in prompt, 'оператору не сказали, что уже сделано'
    bodies = json.loads(pathlib.Path(os.environ['NIGHT_TEST_QUEUES']).read_text())
    body = bodies[min(index, len(bodies) - 1)]
    print(json.dumps({'is_error': False, 'result': body, 'modelUsage': usage}))
    raise SystemExit(0)
task = json.loads(prompt.split('\nЗадание (JSON):\n', 1)[1])
if os.environ.get('NIGHT_TEST_MODE') != 'no-edit':
    for name in task['outputs']:
        path = pathlib.Path(name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text('prepared\n')
result = {'status': 'done', 'summary': 'ок', 'evidence': ['читал plan.md']}
print(json.dumps({'is_error': False, 'result': json.dumps(result), 'modelUsage': usage}))
'''


def queue_json(task_id, outputs=("plan.md",)):
    return json.dumps({"description": "тест", "baseline_checks": [], "tasks": [
        {"id": task_id, "depends_on": [], "sources": ["plan.md"], "outputs": list(outputs),
         "checks": [], "task": "подготовить", "acceptance": ["готово"]}]}, ensure_ascii=False)


class SupervisorTest(unittest.TestCase):
    def setUp(self):
        _pilot.PilotTest.setUp(self)
        claude = self.bin / "claude"
        claude.write_text(FAKE_CLAUDE)
        claude.chmod(0o755)
        self.routing = self.base / "routing.json"
        self.routing.write_text(json.dumps({"work": {"backend": "claude", "binary": str(claude)},
                                            "review": {"backend": "codex", "binary": str(self.bin / "codex")}}))
        self.prompt = self.base / "operator.md"
        self.prompt.write_text("Ты оператор. Верни очередь.")
        self.queues = self.base / "queues.json"
        self.out = self.base / "night"

    git = _pilot.PilotTest.git

    def run_supervisor(self, queues, batches=3, budget=10_000_000, mode="", parallel=1):
        self.queues.write_text(json.dumps(queues))
        command = [sys.executable, str(SUPERVISOR), "--workspace", str(self.root),
                   "--routing", str(self.routing), "--operator-prompt", str(self.prompt),
                   "--out", str(self.out), "--hours", "0.5", "--token-budget", str(budget),
                   "--operator-binary", str(self.bin / "claude"), "--max-tasks", "1",
                   "--parallel", str(parallel), "--max-batches", str(batches)]
        return subprocess.run(command, env={**self.env, "NIGHT_TEST_QUEUES": str(self.queues),
                                            "NIGHT_TEST_MODE": mode},
                              capture_output=True, text=True, timeout=120)

    def report(self):
        return json.loads((self.out / "supervisor.json").read_text())

    def test_night_continues_past_the_first_queue(self):
        result = self.run_supervisor([queue_json("alpha"), queue_json("beta", ["plan2.md"])], batches=2)
        self.assertEqual(result.returncode, 0, result.stderr)
        report = self.report()
        self.assertEqual([b["tasks"] for b in report["batches"]], [["alpha"], ["beta"]])
        self.assertEqual(report["stopped"], "порции кончились")
        # Обе задачи приняты и закоммичены — ночь не кончилась вместе с первой очередью.
        self.assertEqual(self.git("log", "--format=%s", f"{self.baseline}..HEAD").split("\n"),
                         ["night: beta", "night: alpha"])

    def test_parallel_setting_reaches_the_core(self):
        # Без этого супервизор гонял бы ядро по одной задаче, как до параллельности.
        # Признак, что флаг дошёл: ядро пишет пачку в журнал только при параллели.
        self.run_supervisor([queue_json("alpha")], batches=1, parallel=4)
        journal = (self.out / "run-1" / "journal.jsonl").read_text().splitlines()
        batches = [json.loads(x)["batch"] for x in journal if json.loads(x)["event"] == "batch"]
        self.assertEqual(batches, [["alpha"]])

    def test_without_parallel_the_core_forms_no_batches(self):
        self.run_supervisor([queue_json("alpha")], batches=1, parallel=1)
        journal = (self.out / "run-1" / "journal.jsonl").read_text().splitlines()
        self.assertEqual([x for x in journal if json.loads(x)["event"] == "batch"], [])

    def test_operator_is_told_what_is_already_done(self):
        self.run_supervisor([queue_json("alpha"), queue_json("beta", ["plan2.md"])], batches=2)
        second = (self.out / "operator-2.prompt.txt")
        if second.exists():  # промпт пишется ядром только для задач, оператора пишем сами
            self.assertIn("alpha", second.read_text())
        self.assertEqual((self.base / "calls").read_text().count("operator"), 2)

    def test_three_batches_without_accepted_tasks_stop_the_night(self):
        result = self.run_supervisor([queue_json("alpha")], batches=9, mode="no-edit")
        self.assertEqual(result.returncode, 0, result.stderr)
        report = self.report()
        self.assertEqual(report["stopped"], "три порции подряд без принятых задач")
        self.assertEqual(len(report["batches"]), 3)
        self.assertEqual(self.git("rev-parse", "HEAD"), self.baseline)

    def test_operator_without_a_queue_stops_the_night(self):
        result = self.run_supervisor(["не JSON вовсе"])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("оператор не дал очередь", self.report()["stopped"])

    def test_budget_stops_before_calling_the_operator_again(self):
        result = self.run_supervisor([queue_json("alpha")], batches=5, budget=200)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("потолок токенов исчерпан", self.report()["stopped"])


if __name__ == "__main__":
    unittest.main()
