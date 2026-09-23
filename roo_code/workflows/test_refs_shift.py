"""Перенумерация ссылок: механика чинит только то, что механика может доказать."""

import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

MODULE = Path(__file__).with_name("refs_shift.py").resolve()
_spec = importlib.util.spec_from_file_location("refs_shift", MODULE)
refs_shift = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(refs_shift)


class ShiftTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="refs-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "roo_code").mkdir()
        self.code = self.root / "code.ts"
        self.code.write_text("один\nдва\nтри\nчетыре\n")
        self.doc = self.root / "roo_code" / "док.md"
        self.git("init", "-b", "main")
        self.git("config", "user.name", "Тест")
        self.git("config", "user.email", "test@example.invalid")

    def git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.root), *args], text=True,
                                       stderr=subprocess.DEVNULL)

    def commit(self, text):
        self.doc.write_text(text)
        self.git("add", "-A")
        self.git("commit", "-m", "исходное")

    def test_verbatim_move_is_renumbered(self):
        self.commit("Ссылка на `три` — code.ts:3\n")
        self.code.write_text("ноль\nодин\nдва\nтри\nчетыре\n")  # вставка сверху сдвинула на 1
        safe, unsafe = refs_shift.renumber(self.root)
        self.assertEqual([i["стало"] for i in safe], ["code.ts:4"])
        self.assertEqual(unsafe, [])
        self.assertIn("code.ts:4", self.doc.read_text())

    def test_changed_line_is_left_for_human_eyes(self):
        self.commit("Ссылка на `три` — code.ts:3\n")
        self.code.write_text("ноль\nодин\nдва\nТРИ ДРУГОЕ\nчетыре\n")
        safe, unsafe = refs_shift.renumber(self.root)
        self.assertEqual(safe, [])
        self.assertEqual(len(unsafe), 1)
        # Документ не тронут: механика не знает, стала ли ссылка ложью.
        self.assertIn("code.ts:3", self.doc.read_text())

    def test_ranges_move_as_a_whole(self):
        self.commit("Диапазон `два` — code.ts:2-3\n")
        self.code.write_text("ноль\nодин\nдва\nтри\nчетыре\n")
        safe, _ = refs_shift.renumber(self.root)
        self.assertEqual([i["стало"] for i in safe], ["code.ts:3-4"])

    def test_references_above_the_change_are_untouched(self):
        self.commit("Ссылка на `один` — code.ts:1\n")
        self.code.write_text("один\nдва\nтри\nчетыре\nпять\n")  # вставка в конец
        safe, unsafe = refs_shift.renumber(self.root)
        self.assertEqual((safe, unsafe), ([], []))
        self.assertIn("code.ts:1", self.doc.read_text())

    def test_no_code_change_means_no_work(self):
        self.commit("Ссылка на `три` — code.ts:3\n")
        self.assertEqual(refs_shift.survey(self.root), ([], []))

    def test_only_named_document_tree_is_touched(self):
        self.commit("Ссылка на `три` — code.ts:3\n")
        outside = self.root / "чужой.md"
        outside.write_text("Тоже ссылка code.ts:3\n")
        self.code.write_text("ноль\nодин\nдва\nтри\nчетыре\n")
        refs_shift.renumber(self.root)
        self.assertIn("code.ts:3", outside.read_text())


_pilot_spec = importlib.util.spec_from_file_location(
    "pilot_fixtures", Path(__file__).with_name("test_codex_night.py"))
_pilot = importlib.util.module_from_spec(_pilot_spec)
_pilot_spec.loader.exec_module(_pilot)
RUNNER = Path(__file__).with_name("codex-night.py").resolve()

FAKE_AUTHOR = r'''#!/usr/bin/env python3
import json, pathlib, sys
prompt = sys.stdin.read()
task = json.loads(prompt.split('\nЗадание (JSON):\n', 1)[1])
# Вставка сверху сдвигает всё, на что ссылаются документы.
path = pathlib.Path(task['outputs'][0])
path.write_text('ноль\n' + path.read_text())
result = {'status': 'done', 'summary': 'ок', 'evidence': ['вставил строку']}
print(json.dumps({'is_error': False, 'result': json.dumps(result),
                  'modelUsage': {'m': {'inputTokens': 5, 'outputTokens': 1,
                                       'cacheCreationInputTokens': 0, 'cacheReadInputTokens': 0}}}))
'''


class ControllerRenumbersTest(unittest.TestCase):
    """Перенумерация вшита в прогон, а не остаётся отдельным скриптом на полке."""

    def setUp(self):
        _pilot.PilotTest.setUp(self)
        author = self.bin / "claude"
        author.write_text(FAKE_AUTHOR)
        author.chmod(0o755)
        (self.root / "code.ts").write_text("один\nдва\nтри\n")
        docs = self.root / "roo_code"
        docs.mkdir(exist_ok=True)
        (docs / "док.md").write_text("Про `три` — code.ts:3\n")
        self.git("add", "-A")
        self.git("commit", "-m", "код и документ")
        self.baseline = self.git("rev-parse", "HEAD")
        self.queue.write_text(json.dumps({"tasks": [
            {"id": "insert-line", "sources": ["code.ts"], "outputs": ["code.ts"], "task": "вставить строку"}]}))
        self.routing = self.base / "routing.json"
        self.routing.write_text(json.dumps({"work": {"backend": "claude", "binary": str(author)},
                                            "review": {"backend": "codex", "binary": str(self.bin / "codex")}}))

    git = _pilot.PilotTest.git
    state = _pilot.PilotTest.state

    def invoke(self):
        return subprocess.run(
            [sys.executable, str(RUNNER), "--workspace", str(self.root), "--queue", str(self.queue),
             "--routing", str(self.routing), "--run", "--run-dir", str(self.logs),
             "--minutes", "1", "--max-tasks", "1"],
            env={**self.env, "NIGHT_TEST_MODE": ""}, capture_output=True, text=True, timeout=60)

    def test_reference_is_renumbered_and_committed_with_the_task(self):
        result = self.invoke()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.state()["status"], "completed")
        # Документ уехал бы в ложь: строка `три` теперь четвёртая.
        self.assertIn("code.ts:4", (self.root / "roo_code" / "док.md").read_text())
        # core.quotepath экранирует кириллицу в выводе git — выключаем, чтобы сравнивать имя.
        committed = self.git("-c", "core.quotepath=false", "show", "--name-only", "--format=", "HEAD")
        self.assertIn("roo_code/док.md", committed)
        self.assertIn("code.ts", committed)
        self.assertFalse(self.git("status", "--porcelain"))

    def test_renumbering_is_recorded_for_the_reviewer(self):
        self.invoke()
        record = json.loads((self.logs / "insert-line-refs.json").read_text())
        self.assertEqual([i["стало"] for i in record["перенумеровано"]], ["code.ts:4"])
        self.assertEqual(record["требуют_глаз"], [])
        prompt = (self.logs / "insert-line-review.prompt.txt").read_text()
        self.assertIn("контроллер сам перенумеровал 1 ссылок", prompt)


if __name__ == "__main__":
    unittest.main()
