"""Скрипт ночи: он отказывается работать в занятом дереве.

Это единственное его правило, которое нельзя проверить глазами вовремя: прогон,
начатый поверх чужих незакоммиченных правок, заберёт их в свой коммит или спрячет
в stash. Остальное (ветка, каталог, сводка) проверяется здесь же на подменённом
супервизоре, чтобы модель не вызывалась.
"""

import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("night-run.sh").resolve()


class NightRunTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="night-run-test-")
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.repo = self.base / "repo"
        (self.repo / "roo_code/workflows").mkdir(parents=True)
        # Подменяем супервизор и сводку: настоящие ходят в модель.
        for name, body in (("night-supervisor.py", "import sys; print('супервизор: ' + ' '.join(sys.argv[1:]))"),
                           ("night-report.py", "print('# сводка')")):
            (self.repo / "roo_code/workflows" / name).write_text(body)
        (self.repo / "roo_code/workflows/operator-prompt.md").write_text("промпт")
        self.git("init", "-b", "main")
        self.git("config", "user.name", "Тест")
        self.git("config", "user.email", "test@example.invalid")
        self.git("add", "-A")
        self.git("commit", "-m", "исходное")
        self.routing = self.base / "routing.json"
        self.routing.write_text('{"work": {"backend": "claude"}, "review": {"backend": "codex"}}')
        self.nights = self.base / "ночи"

    def git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.repo), *args], text=True,
                                       stderr=subprocess.DEVNULL)

    def run_script(self):
        env = {**os.environ, "FLEXIRON_REPO": str(self.repo), "FLEXIRON_ROUTING": str(self.routing),
               "FLEXIRON_NIGHTS": str(self.nights), "FLEXIRON_HOURS": "1", "FLEXIRON_TOKENS": "1000"}
        return subprocess.run(["bash", str(SCRIPT)], capture_output=True, text=True, env=env, timeout=60)

    def test_busy_tree_stops_the_night(self):
        (self.repo / "чужая-работа.txt").write_text("не трогать\n")
        result = self.run_script()
        self.assertEqual(result.returncode, 3)
        self.assertIn("Дерево занято", result.stderr)
        self.assertEqual(self.git("branch", "--show-current").strip(), "main")
        self.assertTrue((self.repo / "чужая-работа.txt").exists())

    def test_clean_tree_gets_its_own_branch_and_summary(self):
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(self.git("branch", "--show-current").strip().startswith("auto/night-"))
        nights = list(self.nights.glob("night-*"))
        self.assertEqual(len(nights), 1)
        self.assertIn("# сводка", (nights[0] / "СВОДКА.md").read_text())

    def test_missing_routing_is_refused_before_touching_git(self):
        self.routing.unlink()
        result = self.run_script()
        self.assertEqual(result.returncode, 2)
        self.assertEqual(self.git("branch", "--show-current").strip(), "main")


if __name__ == "__main__":
    unittest.main()
