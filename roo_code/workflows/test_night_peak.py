"""Команда паузы на пик: переключает режим идущей ночи и говорит, что сейчас."""

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("night-peak.py").resolve()


class NightPeakTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="night-peak-test-")
        self.addCleanup(self.temp.cleanup)
        self.nights = Path(self.temp.name)
        self.old = self.nights / "night-2026-09-27-2200"
        self.night = self.nights / "night-2026-09-28-2200"
        for night in (self.old, self.night):
            (night / "run-1").mkdir(parents=True)
            (night / "deepseek-peak").write_text("pause\n")
        (self.nights / "night-launch-2026-09-28-2200.log").write_text("")   # файл, не ночь

    def run_command(self, *args):
        return subprocess.run([sys.executable, str(SCRIPT), *args], capture_output=True, text=True, timeout=30,
                              env={**os.environ, "FLEXIRON_NIGHTS": str(self.nights)})

    def test_switch_goes_to_the_latest_night_only(self):
        result = self.run_command("ignore")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.night / "deepseek-peak").read_text().strip(), "ignore")
        self.assertEqual((self.old / "deepseek-peak").read_text().strip(), "pause")
        self.assertIn("Режим: ignore", result.stdout)

    def test_status_names_the_mode_the_next_change_and_waiting_tasks(self):
        (self.night / "run-1" / "альфа-work.aider.pause.json").write_text(
            json.dumps({"paused_seconds": 600, "until_utc": "2026-09-29T04:00:00+00:00"}))
        out = self.run_command().stdout
        self.assertIn("Режим: pause", out)
        self.assertRegex(out, r"Сейчас (не )?пик, (начнётся|кончится) .* по часам ноутбука \(\d\d:\d\d UTC\)")
        self.assertIn("на паузе: альфа, ждёт 10 мин", out)

    def test_night_started_before_the_feature_is_said_plainly(self):
        (self.night / "deepseek-peak").unlink()
        self.assertIn("файла нет", self.run_command().stdout)

    def test_explicit_night_and_bad_mode(self):
        self.assertEqual(self.run_command("ignore", "--night", str(self.old)).returncode, 0)
        self.assertEqual((self.old / "deepseek-peak").read_text().strip(), "ignore")
        self.assertNotEqual(self.run_command("никогда").returncode, 0)


if __name__ == "__main__":
    unittest.main()
