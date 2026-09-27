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

    def test_reference_matches_a_path_segment_not_a_suffix_of_letters(self):
        """`.../crud/domain.py` кончается буквами `main.py`, но это другой файл.

        Голый `endswith` двигал ссылку на `main.py` сдвигами `domain.py`. Строка там
        совпадала дословно, значит номер переписывался МОЛЧА и указывал в никуда.
        Найдено 2026-09-25 на правке настроек.
        """
        nested = self.root / "crud"
        nested.mkdir()
        domain = nested / "domain.py"
        domain.write_text("альфа\nбета\nгамма\n")
        main = self.root / "main.py"
        main.write_text("альфа\nбета\nгамма\n")
        self.commit("Ссылка на `гамма` в другом файле — main.py:3\n")
        domain.write_text("ноль\nальфа\nбета\nгамма\n")  # сдвинулся ТОЛЬКО domain.py

        safe, unsafe = refs_shift.renumber(self.root)

        self.assertEqual((safe, unsafe), ([], []))
        self.assertIn("main.py:3", self.doc.read_text())

    def test_reference_without_a_directory_still_matches_its_file(self):
        """Сужение не должно сломать обычный случай: `code.ts:3` — это `code.ts`."""
        self.commit("Ссылка на `три` — code.ts:3\n")
        self.code.write_text("ноль\nодин\nдва\nтри\nчетыре\n")
        safe, _ = refs_shift.renumber(self.root)
        self.assertEqual([i["стало"] for i in safe], ["code.ts:4"])

    def test_bare_filename_pointing_at_many_files_is_left_for_human_eyes(self):
        """`models.py:98` — это все `models.py` дерева, а не тот, что изменился.

        Резолвер контракта (`contractRefs.ts`, `resolveCandidates`) считает годным
        ЛЮБОЙ файл, чей путь кончается этим хвостом. Значит сдвиг ОДНОГО из них не
        говорит про такую ссылку ничего. Найдено 2026-09-25: правка
        `suppliers/shared/models.py` молча перенумеровала `models.py:98-103` в
        `bcc.md` — строка совпала дословно, `verbatim` прошла, ссылка на модель BCC
        уехала в никуда. По всему дереву так уехала 101 ссылка в 18 документах.
        """
        first, second = self.root / "один", self.root / "два"
        for folder in (first, second):
            folder.mkdir()
            (folder / "models.py").write_text("альфа\nбета\nгамма\n")
        self.commit("Ссылка на `гамма` — models.py:3\n")
        (first / "models.py").write_text("ноль\nальфа\nбета\nгамма\n")

        safe, unsafe = refs_shift.renumber(self.root)

        self.assertEqual(safe, [])
        self.assertEqual(len(unsafe), 1, unsafe)
        self.assertIn("models.py:3", self.doc.read_text())

    def test_unique_path_with_a_directory_is_still_renumbered(self):
        """Сужение не должно превратить механику в бездействие."""
        folder = self.root / "only-here"
        folder.mkdir()
        (folder / "uniq.py").write_text("альфа\nбета\nгамма\n")
        self.commit("Ссылка на `гамма` — only-here/uniq.py:3\n")
        (folder / "uniq.py").write_text("ноль\nальфа\nбета\nгамма\n")

        safe, _ = refs_shift.renumber(self.root)

        self.assertEqual([i["стало"] for i in safe], ["only-here/uniq.py:4"])

    def test_shifts_see_a_file_whose_name_is_not_latin(self):
        """Git ЭКРАНИРУЕТ кириллицу в `+++ b/...`, если не сказать обратного.

        Имя в заголовке диффа тогда не совпадает ни с чем, сдвиги такого файла не
        находятся вовсе, и ссылки на него молча остаются старыми. В этом проекте
        кириллицей названы документы планов, то есть случай не гипотетический.
        """
        code = self.root / "документ.py"
        code.write_text("альфа\nбета\n")
        self.commit("неважно\n")
        code.write_text("ноль\nальфа\nбета\n")

        self.assertEqual(refs_shift.shifts(self.root, "HEAD"), {"документ.py": [(0, 1)]})

    def test_the_plan_archive_is_a_snapshot_and_is_not_renumbered(self):
        """Архив записывает прошлое чтение, а не сегодняшний код (инвариант ROO.md).

        Перенумерованная ссылка внутри снимка превращает запись «тогда там было это»
        в утверждение о настоящем, которого никто не делал. Проверке ссылок это
        ничего не стоит: `contractRefs.spec.ts` архив не читает вовсе.
        """
        archive = self.root / "roo_code" / "plans" / "archive" / "2026-08"
        archive.mkdir(parents=True)
        frozen = archive / "снимок.md"
        frozen.write_text("Тогда `три` было на code.ts:3\n")
        self.commit("Ссылка на `три` — code.ts:3\n")
        self.code.write_text("ноль\nодин\nдва\nтри\nчетыре\n")

        safe, _ = refs_shift.renumber(self.root)

        # Живой документ перенумерован, снимок — нет.
        self.assertEqual(["roo_code/док.md"], sorted({i["документ"] for i in safe}))
        self.assertIn("code.ts:3", frozen.read_text())
        self.assertIn("code.ts:4", self.doc.read_text())

    def test_only_named_document_tree_is_touched(self):
        self.commit("Ссылка на `три` — code.ts:3\n")
        outside = self.root / "чужой.md"
        outside.write_text("Тоже ссылка code.ts:3\n")
        self.code.write_text("ноль\nодин\nдва\nтри\nчетыре\n")
        refs_shift.renumber(self.root)
        self.assertIn("code.ts:3", outside.read_text())

    def test_short_reference_after_a_sole_path_is_renumbered(self):
        """`:3` без пути рядом — файл подразумевается прозой: названный левее `code.ts`."""
        self.commit("Строка `три` в `code.ts` — это `:3`.\n")
        self.code.write_text("ноль\nодин\nдва\nтри\nчетыре\n")

        safe, unsafe = refs_shift.renumber(self.root)

        self.assertEqual([i["стало"] for i in safe], [":4"])
        self.assertEqual(unsafe, [])
        self.assertIn("`:4`", self.doc.read_text())

    def test_short_range_moves_with_both_ends(self):
        """Диапазон `:2-3` двигается ОБОИМИ концами; сдвиг одного дал бы `:3-3`."""
        self.commit("`code.ts` — диапазон `:2-3`.\n")
        self.code.write_text("ноль\nодин\nдва\nтри\nчетыре\n")

        safe, _ = refs_shift.renumber(self.root)

        self.assertEqual([i["стало"] for i in safe], [":3-4"])
        self.assertIn("`:3-4`", self.doc.read_text())

    def test_enumerated_tail_moves_every_number(self):
        """Хвост `,3,4` в `models.py:2,3,4` — такие же ссылки, а не текст."""
        models = self.root / "models.py"
        models.write_text("альфа\nбета\nгамма\nдельта\n")
        self.commit("Строки `models.py:2,3,4` — все три.\n")
        models.write_text("ноль\nальфа\nбета\nгамма\nдельта\n")

        safe, _ = refs_shift.renumber(self.root)

        self.assertEqual([i["стало"] for i in safe], ["models.py:3,4,5"])
        self.assertIn("`models.py:3,4,5`", self.doc.read_text())

    def test_a_line_with_two_different_paths_is_left_for_human_eyes(self):
        """`:3` после двух РАЗНЫХ `models.py` не двигается: файл угадать нельзя.

        Строка с двумя разными путями — это ровно тот случай, где автоматика
        2026-09-25 перепутала контекст (`:72` уехал по чужой карте сдвигов).
        """
        first, second = self.root / "one", self.root / "two"
        for folder in (first, second):
            folder.mkdir()
            (folder / "models.py").write_text("альфа\nбета\nгамма\n")
        self.commit("Открой `one/models.py` и `two/models.py`, строка `:3`.\n")
        (first / "models.py").write_text("ноль\nальфа\nбета\nгамма\n")
        (second / "models.py").write_text("ноль\nНОЛЬ\nальфа\nбета\nгамма\n")

        safe, unsafe = refs_shift.renumber(self.root)

        self.assertEqual(safe, [])
        self.assertEqual([i["было"] for i in unsafe], [":3"])
        self.assertIn("`:3`", self.doc.read_text())

    def test_short_reference_to_a_changed_line_is_left_for_human_eyes(self):
        """Строка не переехала, а изменилась — номер молча править нельзя."""
        self.commit("`code.ts` — строка `:3`.\n")
        self.code.write_text("ноль\nодин\nдва\nТРИ ДРУГОЕ\nчетыре\n")

        safe, unsafe = refs_shift.renumber(self.root)

        self.assertEqual(safe, [])
        self.assertEqual([i["было"] for i in unsafe], [":3"])
        self.assertIn("`:3`", self.doc.read_text())


    def test_time_on_a_sole_path_line_is_not_a_short_reference(self):
        """`17:36` после единственного пути — время вердикта, а не строка `:36`."""
        self.commit("План `code.ts` · вердикт от 2026-09-13 17:3\n")
        self.code.write_text("ноль\nодин\nдва\nтри\nчетыре\n")

        safe, unsafe = refs_shift.renumber(self.root)

        self.assertEqual(safe, [])
        self.assertEqual(unsafe, [])
        self.assertIn("17:3\n", self.doc.read_text())

    def test_column_and_port_are_not_short_references(self):
        """Колонка `code.ts:3:2` и порт `localhost:3` не двигаются; строка `:3` — двигается."""
        self.commit("Стек `code.ts:3:2`, база на localhost:3\n")
        self.code.write_text("ноль\nодин\nдва\nтри\nчетыре\n")

        safe, unsafe = refs_shift.renumber(self.root)

        self.assertEqual([i["стало"] for i in safe], ["code.ts:4"])
        self.assertEqual(unsafe, [])
        self.assertIn("`code.ts:4:2`, база на localhost:3\n", self.doc.read_text())


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
