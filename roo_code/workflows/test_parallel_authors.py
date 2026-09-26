"""Параллельные авторы: каждый в своём worktree, всё остальное — по одному.

Проверяется и то, ради чего это сделано (авторы действительно работают одновременно),
и то, что от этого не поехали гарантии: чужие файлы, чужой Git, оставшиеся worktree.
"""

import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unittest

RUNNER = Path(__file__).with_name("codex-night.py").resolve()
_spec = importlib.util.spec_from_file_location("pilot_fixtures", Path(__file__).with_name("test_codex_night.py"))
_pilot = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_pilot)
_core_spec = importlib.util.spec_from_file_location("controller", RUNNER)
core = importlib.util.module_from_spec(_core_spec)
_core_spec.loader.exec_module(core)

# Автор отмечает начало и конец: по этим отметкам видно, шли ли двое разом.
FAKE_CLAUDE = r'''#!/usr/bin/env python3
import json, os, pathlib, sys, time
prompt = sys.stdin.read()
task = json.loads(prompt.split('\nЗадание (JSON):\n', 1)[1])
calls = pathlib.Path(os.environ['NIGHT_TEST_CALLS'])
mode = os.environ.get('NIGHT_TEST_MODE', '')
with calls.open('a') as stream:
    stream.write(f"start {task['id']} {time.time()}\n")
barrier = int(os.environ.get('NIGHT_TEST_BARRIER', '0'))
if barrier:
    # Ждём, пока стартуют все авторы пачки. Идут по очереди — не дождёмся и упадём.
    deadline = time.time() + 20
    while time.time() < deadline:
        if calls.read_text().count('start ') >= barrier:
            break
        time.sleep(0.05)
    else:
        sys.exit(3)
time.sleep(0.7)
names = list(task['outputs'])
if mode == 'outside' and task['id'] == 'beta':
    names.append('unrelated.md')
for name in names:
    path = pathlib.Path(name)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"prepared by {task['id']}\n")
with calls.open('a') as stream:
    stream.write(f"end {task['id']} {time.time()}\n")
result = {'status': 'done', 'summary': 'ок', 'evidence': ['читал plan.md']}
printed = json.dumps(result)
if mode == 'prose' and task['id'] == 'beta':
    # Ровно то, чем кончилась ночь 2026-09-23-2241: проза вместо объекта результата.
    printed = 'All done. Summary of the change:\n\n- plan2.md: переписал раздел'
print(json.dumps({'is_error': False, 'result': printed,
                  'modelUsage': {'m': {'inputTokens': 10, 'outputTokens': 1,
                                       'cacheCreationInputTokens': 0, 'cacheReadInputTokens': 0}}}))
'''


class DisjointBatchTest(unittest.TestCase):
    def batch(self, tasks, size):
        return [t["id"] for t in core.disjoint_batch(tasks, size)]

    def test_tasks_sharing_a_file_never_land_in_one_batch(self):
        tasks = [{"id": "a", "outputs": ["one.ts"]}, {"id": "b", "outputs": ["one.ts", "two.ts"]},
                 {"id": "c", "outputs": ["three.ts"]}]
        self.assertEqual(self.batch(tasks, 5), ["a", "c"])

    def test_batch_is_capped_by_size(self):
        tasks = [{"id": x, "outputs": [f"{x}.ts"]} for x in "abcd"]
        self.assertEqual(self.batch(tasks, 2), ["a", "b"])

    def test_empty_candidates_give_empty_batch(self):
        self.assertEqual(self.batch([], 3), [])


class ParallelRunTest(unittest.TestCase):
    def setUp(self):
        _pilot.PilotTest.setUp(self)
        claude = self.bin / "claude"
        claude.write_text(FAKE_CLAUDE)
        claude.chmod(0o755)
        # У задач должны быть РАЗНЫЕ источники: ядро само выводит зависимость, если
        # одна читает то, что другая пишет, и тогда параллелить их нельзя.
        (self.root / "spec.md").write_text("спека\n")
        self.git("add", "spec.md")
        self.git("commit", "-m", "вторая отправная точка")
        self.baseline = self.git("rev-parse", "HEAD")
        self.queue.write_text(json.dumps({"tasks": [
            {"id": "alpha", "sources": ["plan.md"], "outputs": ["plan.md"], "task": "первая"},
            {"id": "beta", "sources": ["spec.md"], "outputs": ["plan2.md"], "task": "вторая"}]}))
        self.routing = self.base / "routing.json"
        self.routing.write_text(json.dumps({"work": {"backend": "claude", "binary": str(claude)},
                                            "review": {"backend": "codex", "binary": str(self.bin / "codex")}}))

    git = _pilot.PilotTest.git
    state = _pilot.PilotTest.state

    def invoke(self, parallel, mode="", barrier=0):
        command = [sys.executable, str(RUNNER), "--workspace", str(self.root), "--queue", str(self.queue),
                   "--routing", str(self.routing), "--run", "--run-dir", str(self.logs),
                   "--minutes", "2", "--max-tasks", "2", "--parallel", str(parallel)]
        return subprocess.run(command, env={**self.env, "NIGHT_TEST_MODE": mode,
                                            "NIGHT_TEST_BARRIER": str(barrier)},
                              capture_output=True, text=True, timeout=120)

    def spans(self):
        spans = {}
        for line in (self.base / "calls").read_text().splitlines():
            parts = line.split()
            if len(parts) != 3:  # строки подменённого проверяющего нам не нужны
                continue
            kind, task, moment = parts
            spans.setdefault(task, {})[kind] = float(moment)
        return spans

    def test_two_authors_write_at_the_same_time(self):
        # Каждый автор ждёт старта второго. Пойди они по очереди — первый не дождётся
        # и упадёт, прогон остановится. Успех и есть доказательство одновременности.
        result = self.invoke(parallel=2, barrier=2)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.state()["status"], "completed")
        self.assertEqual(len(self.state()["completed"]), 2)

    def test_sequential_run_keeps_authors_apart(self):
        result = self.invoke(parallel=1)
        self.assertEqual(result.returncode, 0, result.stderr)
        spans = self.spans()
        self.assertGreater(spans["beta"]["start"], spans["alpha"]["end"])

    def test_both_results_land_in_the_checkout_and_are_committed(self):
        self.invoke(parallel=2)
        self.assertEqual((self.root / "plan.md").read_text(), "prepared by alpha\n")
        self.assertEqual((self.root / "plan2.md").read_text(), "prepared by beta\n")
        self.assertEqual(self.git("log", "--format=%s", f"{self.baseline}..HEAD").split("\n"),
                         ["night: beta", "night: alpha"])

    def test_no_worktrees_survive_the_run(self):
        self.invoke(parallel=2)
        self.assertNotIn("wt-", self.git("worktree", "list"))
        self.assertEqual(list(self.logs.glob("wt-*")), [])

    def test_reader_of_another_task_output_is_not_batched_with_it(self):
        # Зависимость выводится из файлов: beta читает то, что пишет alpha, — значит
        # они идут по очереди, даже когда прогон разрешает параллель.
        self.queue.write_text(json.dumps({"tasks": [
            {"id": "alpha", "sources": ["plan.md"], "outputs": ["plan.md"], "task": "первая"},
            {"id": "beta", "sources": ["plan.md"], "outputs": ["plan2.md"], "task": "вторая"}]}))
        self.assertEqual(self.invoke(parallel=2).returncode, 0)
        batches = [json.loads(x)["batch"] for x in (self.logs / "journal.jsonl").read_text().splitlines()
                   if json.loads(x)["event"] == "batch"]
        self.assertEqual(batches, [["alpha"], ["beta"]])
        spans = self.spans()
        self.assertGreater(spans["beta"]["start"], spans["alpha"]["end"])

    def test_batch_is_recorded_in_the_journal(self):
        self.invoke(parallel=2)
        batches = [json.loads(x)["batch"] for x in (self.logs / "journal.jsonl").read_text().splitlines()
                   if json.loads(x)["event"] == "batch"]
        self.assertEqual(batches, [["alpha", "beta"]])

    def test_unusable_answer_blocks_its_task_and_lets_the_rest_finish(self):
        # Автор beta возвращает прозу вместо JSON. Это брак одной задачи: прогон обязан
        # довести alpha до коммита и закончиться нормально, а не упасть на разборе ответа.
        result = self.invoke(parallel=2, mode="prose")
        self.assertEqual(result.returncode, 0, result.stderr)
        state = self.state()
        self.assertEqual([item["task"] for item in state["completed"]], ["alpha"])
        self.assertEqual([item["task"] for item in state["blocked"]], ["beta"])
        self.assertIn("непригоден", state["blocked"][0]["reason"])
        self.assertEqual(self.git("log", "--format=%s", f"{self.baseline}..HEAD"), "night: alpha")

    def test_unusable_answer_keeps_the_patch_it_produced(self):
        # Работа автора пережила блокировку: патч лежит в каталоге прогона и назван
        # в доказательствах — иначе его пришлось бы искать по каталогу руками.
        self.invoke(parallel=2, mode="prose")
        patch = self.logs / "beta.patch"
        self.assertTrue(patch.is_file())
        self.assertIn("prepared by beta", patch.read_text())
        self.assertIn(str(patch), self.state()["blocked"][0]["evidence"])
        # В checkout он при этом не применён: непринятую работу никто не коммитил.
        self.assertFalse((self.root / "plan2.md").exists())

    def test_author_touching_a_foreign_file_is_blocked_and_the_run_goes_on(self):
        # Политика изменена 2026-09-26: выход за границы бракует ОДНУ задачу, а не
        # останавливает ночь. Обоснование и замер — в одноимённом тесте
        # test_codex_night.py. Здесь важно, что параллельная ветка ведёт себя так же:
        # расхождение политик между одиночным и параллельным автором уже стоило прогона.
        result = self.invoke(parallel=2, mode="outside")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([x["task"] for x in self.state()["blocked"]], ["beta"])
        self.assertIn("вне задачи", self.state()["blocked"][0]["reason"])
        # Сосед не пострадал: ночь идёт дальше, и законная работа alpha принята.
        self.assertEqual([x["task"] for x in self.state()["completed"]], ["alpha"])
        self.assertEqual((self.root / "plan.md").read_text(), "prepared by alpha\n")
        # Чужая правка не уехала в checkout и работа beta не закоммичена.
        self.assertFalse((self.root / "unrelated.md").exists())
        self.assertFalse((self.root / "plan2.md").exists())
        self.assertNotIn("wt-", self.git("worktree", "list"))
        self.assertFalse(self.git("status", "--porcelain"))


if __name__ == "__main__":
    unittest.main()
