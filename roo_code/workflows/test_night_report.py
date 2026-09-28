"""Сводка ночи: она читает журналы и не имеет права ничего трогать."""

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

REPORT = Path(__file__).with_name("night-report.py").resolve()


class ReportTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="report-test-")
        self.addCleanup(self.temp.cleanup)
        self.out = Path(self.temp.name) / "ночь"
        (self.out / "run-1").mkdir(parents=True)

    def write_state(self, **state):
        (self.out / "run-1" / "state.json").write_text(json.dumps(
            {"status": "completed", "completed": [], "blocked": [], "waiting": [], "tokens": 0, **state}))

    def run_report(self):
        return subprocess.run([sys.executable, str(REPORT), "--out", str(self.out)],
                              capture_output=True, text=True, timeout=30)

    def test_accepted_blocked_and_spend_are_all_named(self):
        self.write_state(completed=[{"task": "альфа", "commit": "0123456789abcdef"}],
                         blocked=[{"task": "бета", "phase": "review", "reason": "ссылка ничего не доказывает",
                                   "archive": "/tmp/архив-беты"}],
                         tokens=1234567)
        result = self.run_report()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("принято 1, забраковано 1, токенов 1,234,567", result.stdout)
        self.assertIn("альфа", result.stdout)
        self.assertIn("ссылка ничего не доказывает", result.stdout)
        # Черновик забракованного должен быть назван: иначе работа считается потерянной.
        self.assertIn("/tmp/архив-беты", result.stdout)

    def test_batches_of_parallel_authors_are_shown(self):
        self.write_state()
        (self.out / "run-1" / "journal.jsonl").write_text(
            json.dumps({"event": "batch", "batch": ["a", "b"]}) + "\n"
            + json.dumps({"event": "task-done"}) + "\n")
        self.assertIn("пачки авторов: a, b", self.run_report().stdout)

    def test_money_is_by_the_provider_tariff_not_the_aider_estimate(self):
        """Счёт aider — по дневному тарифу DeepSeek, а ночь вдвое дешевле: складывать его нельзя."""
        self.write_state()
        run = self.out / "run-1"
        (run / "а-work.aider.stats.json").write_text(json.dumps(
            {"cost": 0.6, "cost_real": 0.3, "calls": [["2026-09-28T17:00:00+00:00", 1000, 800, 10]]}))
        # Статистика до замера цены: сказать, а не посчитать нулём.
        (run / "б-work.aider.stats.json").write_text(json.dumps({"cost": 0.2}))
        out = self.run_report().stdout
        self.assertIn("DeepSeek $0.30, из кэша 80%, задач без замера цены 1", out)
        self.assertNotIn("$0.80", out)
        self.assertEqual(out.count("DeepSeek $0.30"), 2, out)   # порция и итог

    def test_missing_run_is_said_plainly(self):
        (self.out / "run-1" / "state.json").unlink(missing_ok=True)
        result = self.run_report()
        self.assertIn("не оставил состояния", result.stdout)

    def test_empty_directory_is_not_reported_as_success(self):
        empty = Path(self.temp.name) / "пусто"
        empty.mkdir()
        result = subprocess.run([sys.executable, str(REPORT), "--out", str(empty)],
                                capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 1)
        self.assertIn("нет ни одного прогона", result.stdout)


if __name__ == "__main__":
    unittest.main()
