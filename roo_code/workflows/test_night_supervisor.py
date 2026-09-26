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

    def run_supervisor(self, queues, batches=3, budget=10_000_000, mode="", parallel=1,
                       idle_limit=None):
        self.queues.write_text(json.dumps(queues))
        command = [sys.executable, str(SUPERVISOR), "--workspace", str(self.root),
                   "--routing", str(self.routing), "--operator-prompt", str(self.prompt),
                   "--out", str(self.out), "--hours", "0.5", "--token-budget", str(budget),
                   "--operator-binary", str(self.bin / "claude"), "--max-tasks", "1",
                   "--parallel", str(parallel), "--max-batches", str(batches)]
        if idle_limit is not None:
            command += ["--idle-limit", str(idle_limit)]
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
        self.assertIn("alpha", self.operator_prompt(2))
        self.assertEqual((self.base / "calls").read_text().count("operator"), 2)

    def operator_prompt(self, index):
        return (self.out / f"operator-{index}.prompt.txt").read_text()

    def test_preflight_rejection_reaches_the_next_operator(self):
        """Причина отказа preflight доходит до оператора и требует исправления.

        Ночь 2026-09-25/26: id с заглавными буквами отверг порцию целиком, оператор
        причины не узнал и выдал то же самое снова. Ядро говорит «Некорректный id
        задачи», не называя какой, поэтому оператору нужны и ответ ядра, и свои id.
        """
        bad = "expect-budget-toHaveURL-analytics"
        result = self.run_supervisor([queue_json(bad), queue_json("alpha"), queue_json("beta", ["plan2.md"])],
                                     batches=3)
        self.assertEqual(result.returncode, 0, result.stderr)
        report = self.report()
        self.assertIn("Некорректный id задачи", report["batches"][0]["preflight"])
        self.assertEqual([b.get("tasks") for b in report["batches"][1:]], [["alpha"], ["beta"]])
        self.assertNotIn("ОТВЕРГНУТА", self.operator_prompt(1))
        second = self.operator_prompt(2)
        self.assertIn("ПРЕДЫДУЩАЯ ОЧЕРЕДЬ ОТВЕРГНУТА", second)
        self.assertIn("Некорректный id задачи", second)
        self.assertIn(bad, second)
        self.assertIn("исправь именно это", second)
        # Принятая очередь снимает упрёк: иначе оператор чинил бы то, что уже починено.
        self.assertNotIn("ОТВЕРГНУТА", self.operator_prompt(3))

    def test_blocked_reasons_reach_the_next_operator(self):
        """Причина браковки задачи доходит до оператора — чтобы не повторял её форму."""
        result = self.run_supervisor([queue_json("alpha"), queue_json("beta", ["plan2.md"])],
                                     batches=2, mode="no-edit", idle_limit=0)
        self.assertEqual(result.returncode, 0, result.stderr)
        blocked = json.loads((self.out / "run-1" / "state.json").read_text())["blocked"]
        self.assertEqual([b["task"] for b in blocked], ["alpha"])
        self.assertNotIn("ЗАБРАКОВАНО", self.operator_prompt(1))
        second = self.operator_prompt(2)
        self.assertIn("ЗАБРАКОВАНО ядром этой ночью", second)
        self.assertIn(f"- alpha ({blocked[0]['phase']}): {blocked[0]['reason'].strip()[:300]}", second)

    def test_three_batches_without_accepted_tasks_stop_the_night(self):
        result = self.run_supervisor([queue_json("alpha")], batches=9, mode="no-edit")
        self.assertEqual(result.returncode, 0, result.stderr)
        report = self.report()
        self.assertEqual(report["stopped"], "порций подряд без принятых задач: 3")
        self.assertEqual(len(report["batches"]), 3)
        self.assertEqual(self.git("rev-parse", "HEAD"), self.baseline)

    def test_idle_limit_zero_lets_the_night_run_to_the_end(self):
        """Ночь длиннее запаса работы: владелец вправе отменить раннюю остановку.

        Правило «три порции подряд» бережёт токены там, где работа кончилась, — но на
        длинной ночи оно же обрывает прогон, у которого просто неудачная полоса порций.
        Ноль означает «не заканчивать вовсе»; ограничителями остаются часы, порции и
        потолок токенов.
        """
        result = self.run_supervisor([queue_json("alpha")], batches=5, mode="no-edit", idle_limit=0)
        self.assertEqual(result.returncode, 0, result.stderr)
        report = self.report()
        # Дошли до конца отпущенных порций, а не остановились на третьей.
        self.assertEqual(report["stopped"], "порции кончились")
        self.assertEqual(len(report["batches"]), 5)
        self.assertTrue(all(b["completed"] == 0 for b in report["batches"]), report["batches"])
        self.assertEqual(self.git("rev-parse", "HEAD"), self.baseline)

    def test_idle_limit_is_honoured_as_given(self):
        """Число берётся из флага, а не зашито: двойка заканчивает ночь на второй порции."""
        result = self.run_supervisor([queue_json("alpha")], batches=9, mode="no-edit", idle_limit=2)
        self.assertEqual(result.returncode, 0, result.stderr)
        report = self.report()
        self.assertEqual(report["stopped"], "порций подряд без принятых задач: 2")
        self.assertEqual(len(report["batches"]), 2)

    def test_report_counts_operator_calls_too(self):
        # Вызовы оператора — такой же расход лимита, как работа авторов; ночь, где
        # их не считают, выходит за потолок владельца.
        self.run_supervisor([queue_json("alpha"), queue_json("beta", ["plan2.md"])], batches=2)
        report = self.report()
        # 2 оператора + 2 автора по 110 токенов (чтение кэша в лимит не идёт).
        self.assertEqual(report["tokens"], 440)

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
