"""Параллельные авторы: каждый в своём worktree, всё остальное — по одному.

Проверяется и то, ради чего это сделано (авторы действительно работают одновременно),
и то, что от этого не поехали гарантии: чужие файлы, чужой Git, оставшиеся worktree.
"""

import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
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
    stream.write(f"port {task['id']} {os.environ.get('PW_PORT', '0')}\n")
    stream.write(f"pid {task['id']} {os.getpid()}\n")
    worktrees = len(list(pathlib.Path.cwd().parent.glob('wt-*')))
    stream.write(f"worktrees {task['id']} {worktrees}\n")
    modules = pathlib.Path('frontend_vue/node_modules')
    inside = modules.is_dir() and not modules.is_symlink() and (modules / 'pkg/index.js').is_file() \
        and modules.resolve().is_relative_to(pathlib.Path.cwd().resolve())
    stream.write(f"modules {task['id']} {int(inside)}\n")
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
time.sleep(json.loads(os.environ.get('NIGHT_TEST_SLEEPS') or '{}').get(task['id'], 0.7))
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

    def test_files_of_running_authors_count_as_taken(self):
        tasks = [{"id": "a", "outputs": ["one.ts"]}, {"id": "b", "outputs": ["two.ts"]}]
        self.assertEqual([t["id"] for t in core.disjoint_batch(tasks, 5, owned={"one.ts"})], ["b"])

    def test_empty_candidates_give_empty_batch(self):
        self.assertEqual(self.batch([], 3), [])


class AuthorPortsTest(unittest.TestCase):
    def test_pairs_do_not_overlap_and_skip_busy_ports(self):
        busy = {5400, 5403}
        self.assertEqual(core.author_ports(2, 5400, lambda port: port not in busy), [5404, 5406])

    def test_port_held_by_someone_is_not_free(self):
        import socket
        with socket.socket() as holder:
            holder.bind(("127.0.0.1", 0))
            holder.listen()
            self.assertFalse(core.port_free(holder.getsockname()[1]))


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

    def command(self, parallel, run_dir=None, max_tasks=2, previous=None):
        command = [sys.executable, str(RUNNER), "--workspace", str(self.root), "--queue", str(self.queue),
                   "--routing", str(self.routing), "--run", "--run-dir", str(run_dir or self.logs),
                   "--minutes", "2", "--max-tasks", str(max_tasks), "--parallel", str(parallel)]
        return command + (["--retry-review", str(previous)] if previous else [])

    def environment(self, mode="", barrier=0, sleeps=None):
        mode = json.dumps(mode) if isinstance(mode, dict) else mode
        return {**self.env, "NIGHT_TEST_MODE": mode, "NIGHT_TEST_BARRIER": str(barrier),
                "NIGHT_TEST_SLEEPS": json.dumps(sleeps or {})}

    def invoke(self, parallel, mode="", barrier=0, sleeps=None, **options):
        return subprocess.run(self.command(parallel, **options), env=self.environment(mode, barrier, sleeps),
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

    def test_batch_authors_get_their_own_playwright_ports(self):
        """Два автора с e2e в своих worktree на 5173: второй не поднимет сервер, а с
        reuseExistingServer молча проверит код соседа."""
        self.assertEqual(self.invoke(parallel=2, barrier=2).returncode, 0)
        ports = [int(self.spans()[task]["port"]) for task in ("alpha", "beta")]
        self.assertGreaterEqual(abs(ports[0] - ports[1]), 2, ports)   # PW_PORT и PW_PORT + 1
        self.assertFalse({5173, 5174} & {p + d for p in ports for d in (0, 1)}, ports)
        prompt = (self.logs / "alpha-work.prompt.txt").read_text()
        self.assertIn(f"PW_PORT={ports[0]}", prompt)

    def test_batch_author_gets_node_modules_inside_its_worktree(self):
        """Симлинк уводил настоящий путь за корень worktree: vite отвечал 403 на шрифты
        `@fontsource`, и у автора пачки краснели все снимки."""
        modules = self.root / "frontend_vue/node_modules/pkg"
        modules.mkdir(parents=True)
        (modules / "index.js").write_text("module.exports = 1\n")
        (self.root / ".gitignore").write_text("node_modules/\n")
        self.git("add", ".gitignore")
        self.git("commit", "-m", "ignore")
        self.assertEqual(self.invoke(parallel=2, barrier=2).returncode, 0)
        self.assertEqual({t: self.spans()[t]["modules"] for t in ("alpha", "beta")}, {"alpha": 1, "beta": 1})
        self.assertEqual(list(self.logs.glob("wt-*")), [])   # копия уходит вместе с worktree

    def test_single_author_keeps_the_default_port(self):
        self.assertEqual(self.invoke(parallel=1).returncode, 0)
        self.assertEqual(self.spans()["alpha"]["port"], 0)
        self.assertNotIn("PW_PORT", (self.logs / "alpha-work.prompt.txt").read_text())

    def test_sequential_run_keeps_authors_apart(self):
        result = self.invoke(parallel=1)
        self.assertEqual(result.returncode, 0, result.stderr)
        spans = self.spans()
        self.assertGreater(spans["beta"]["start"], spans["alpha"]["end"])

    def test_both_results_land_in_the_checkout_and_are_committed(self):
        self.invoke(parallel=2)
        self.assertEqual((self.root / "plan.md").read_text(), "prepared by alpha\n")
        self.assertEqual((self.root / "plan2.md").read_text(), "prepared by beta\n")
        # Порядок коммитов — порядок готовности авторов (конвейер), а не очереди.
        self.assertEqual(sorted(self.git("log", "--format=%s", f"{self.baseline}..HEAD").split("\n")),
                         ["night: alpha", "night: beta"])

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

    # --- конвейер (П3): автор не ждёт пачку ---

    def three_tasks(self, gamma_sources=("gamma.md",)):
        for name in ("gamma.md", "plan3.md"):
            (self.root / name).write_text("исходное\n")
        self.git("add", "gamma.md", "plan3.md")
        self.git("commit", "-m", "источники")
        self.queue.write_text(json.dumps({"tasks": [
            {"id": "alpha", "sources": ["plan.md"], "outputs": ["plan.md"], "task": "долгая"},
            {"id": "beta", "sources": ["spec.md"], "outputs": ["plan2.md"], "task": "быстрая"},
            {"id": "gamma", "sources": list(gamma_sources), "outputs": ["gamma-out.md"], "task": "следующая"}]}))

    def test_fast_author_takes_the_next_task_before_the_slow_one_ends(self):
        # Пачкой gamma ждала бы конца alpha: быстрый автор простаивал до самого медленного.
        self.three_tasks()
        result = self.invoke(parallel=2, max_tasks=3, sleeps={"alpha": 4, "beta": 0.2, "gamma": 0.2})
        self.assertEqual(result.returncode, 0, result.stderr)
        spans = self.spans()
        self.assertLess(spans["gamma"]["start"], spans["alpha"]["end"], spans)
        self.assertEqual(sorted(c["task"] for c in self.state()["completed"]), ["alpha", "beta", "gamma"])
        self.assertEqual(list(self.logs.glob("wt-*")), [])

    def test_never_more_authors_than_slots(self):
        self.three_tasks()
        self.invoke(parallel=2, max_tasks=3, sleeps={"alpha": 1.5, "beta": 0.2, "gamma": 0.2})
        spans = self.spans()
        for moment in (s["start"] for s in spans.values()):
            writing = [t for t, s in spans.items() if s["start"] <= moment < s["end"]]
            self.assertLessEqual(len(writing), 2, spans)

    def task_done_at(self, task):
        for line in (self.logs / "journal.jsonl").read_text().splitlines():
            event = json.loads(line)
            if event["event"] == "task-done" and event["completed"][-1]["task"] == task:
                return event["time"]
        self.fail(f"{task} не принята")

    def test_reader_of_uncommitted_output_waits_for_its_commit(self):
        # gamma читает plan2.md, который пишет beta. Зависимость по очереди тут есть
        # (beta раньше), но и без неё незакоммиченный файл соседа читать нельзя.
        self.three_tasks(gamma_sources=("plan2.md",))
        (self.root / "plan2.md").write_text("исходное\n")
        self.git("add", "plan2.md")
        self.git("commit", "-m", "plan2")
        result = self.invoke(parallel=2, max_tasks=3, sleeps={"alpha": 3, "beta": 1, "gamma": 0.2})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertGreater(self.spans()["gamma"]["start"], self.task_done_at("beta"))

    def test_reader_does_not_start_while_a_later_writer_is_in_flight(self):
        # Очередь: alpha → beta (пишет plan.md, как alpha, и читает plan3.md) → gamma
        # (пишет plan3.md). По очереди beta от gamma не зависит: писатель ПОЗЖЕ. Но когда
        # alpha принята, gamma уже пишет plan3.md — и beta не вправе стартовать до её
        # коммита, иначе прочтёт версию, которую коммит gamma заменит.
        self.three_tasks()
        self.queue.write_text(json.dumps({"tasks": [
            {"id": "alpha", "sources": ["plan.md"], "outputs": ["plan.md"], "task": "первая"},
            {"id": "beta", "sources": ["plan3.md"], "outputs": ["plan.md"], "task": "читатель"},
            {"id": "gamma", "sources": ["spec.md"], "outputs": ["plan3.md"], "task": "писатель"}]}))
        result = self.invoke(parallel=2, max_tasks=3, sleeps={"alpha": 0.5, "gamma": 3, "beta": 0.2})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertGreater(self.spans()["beta"]["start"], self.task_done_at("gamma"))

    def test_author_done_during_checks_gets_a_task_before_the_review(self):
        # alpha закончила, её слот сразу взяла долгая gamma, alpha пошла на проверки.
        # beta дописала во время них — её слот не ждёт конца приёмки alpha.
        self.three_tasks()
        queue = json.loads(self.queue.read_text())
        queue["tasks"].append({"id": "delta", "sources": ["plan3.md"], "outputs": ["delta.md"], "task": "четвёртая"})
        self.queue.write_text(json.dumps(queue))
        self.env.update(NIGHT_TEST_VERIFY_SLEEP="1.5", NIGHT_TEST_REVIEW_SLEEP="1.5")
        result = self.invoke(parallel=2, max_tasks=4,
                             sleeps={"alpha": 0.2, "beta": 0.6, "gamma": 6, "delta": 0.2})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertLess(self.spans()["delta"]["start"], self.task_done_at("alpha"))

    def test_finished_author_frees_its_worktree_at_once(self):
        # Копия node_modules — 230 МБ на worktree; держать их до конца прогона — гигабайты.
        self.three_tasks()
        self.invoke(parallel=2, max_tasks=3, sleeps={"alpha": 3, "beta": 0.2, "gamma": 0.2})
        self.assertEqual(self.spans()["gamma"]["worktrees"], 2)

    def test_writing_author_is_not_counted_against_the_budget(self):
        # Лог пишущего автора пуст: разбор его расхода ронял ночь посреди конвейера.
        (self.logs).mkdir()
        (self.logs / "alpha-work.stdout.log").write_text("")
        done = {"is_error": False, "result": "{}", "modelUsage": {"m": {"inputTokens": 7, "outputTokens": 3}}}
        (self.logs / "beta-work.stdout.log").write_text(json.dumps(done))
        backends = core.load_routing(self.routing)
        self.assertEqual(core.spent_tokens(backends, self.logs, {"alpha"}), 10)
        with self.assertRaises(json.JSONDecodeError):
            core.spent_tokens(backends, self.logs)
        # Задача с id, начинающимся так же, в счёт идёт: сопоставление — по id целиком.
        (self.logs / "alpha-work-work.stdout.log").write_text(json.dumps(done))
        self.assertEqual(core.spent_tokens(backends, self.logs, {"alpha"}), 20)

    def test_reader_waits_for_a_producer_that_has_not_started(self):
        # Производитель w.md (writer) ждёт слота: он делит plan.md с долгой alpha. Его
        # файлы ещё никем не заняты, и только зависимость по очереди держит читателя.
        self.three_tasks()
        (self.root / "w.md").write_text("исходное\n")
        self.git("add", "w.md")
        self.git("commit", "-m", "w")
        self.queue.write_text(json.dumps({"tasks": [
            {"id": "alpha", "sources": ["plan.md"], "outputs": ["plan.md"], "task": "долгая"},
            {"id": "writer", "sources": ["spec.md"], "outputs": ["plan.md", "w.md"], "task": "производитель"},
            {"id": "reader", "sources": ["w.md"], "outputs": ["r.md"], "task": "читатель"}]}))
        result = self.invoke(parallel=2, max_tasks=3, sleeps={"alpha": 1, "writer": 0.2, "reader": 0.2})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertGreater(self.spans()["reader"]["start"], self.task_done_at("writer"))

    def test_stop_signal_kills_the_authors_still_writing(self):
        # Ловушка 26–27.09: ядро, получившее сигнал, ждало авторов пачки до конца.
        self.three_tasks()
        core_proc = subprocess.Popen(self.command(2, max_tasks=3),
                                     env=self.environment(sleeps={"alpha": 60, "beta": 0.2, "gamma": 60}),
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.addCleanup(lambda: core_proc.poll() is None and core_proc.kill())
        deadline = time.monotonic() + 30
        while "start gamma" not in ((self.base / "calls").read_text() if (self.base / "calls").exists() else ""):
            self.assertLess(time.monotonic(), deadline, "gamma не стартовала")
            time.sleep(0.1)
        time.sleep(0.3)
        core_proc.send_signal(signal.SIGTERM)
        self.assertEqual(core_proc.wait(timeout=20), 1)
        state = self.state()
        self.assertEqual(state["status"], "stopped")
        self.assertIn("сигнал", state["reason"])
        self.assertIn("KeyboardInterrupt", (self.logs / "stop-traceback.txt").read_text())
        for task in ("alpha", "gamma"):
            pid = int(self.spans()[task]["pid"])
            with self.assertRaises(ProcessLookupError, msg=f"автор {task} пережил остановку"):
                os.kill(pid, 0)
        self.assertNotIn("wt-", self.git("worktree", "list"))

    def test_review_retry_after_a_stop_on_a_task_that_is_not_first(self):
        # Конвейер принял beta раньше alpha и остановился на её приёмке: первой
        # оставшейся в очереди стоит alpha. Повтор обязан это принять.
        result = self.invoke(parallel=2, mode={"beta": "review-cli-error"}, sleeps={"alpha": 30, "beta": 0.2})
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertEqual((self.state()["status"], self.state()["current"]), ("stopped", "beta"))
        retry_dir = self.base / "retry"
        result = self.invoke(parallel=2, run_dir=retry_dir, previous=self.logs, sleeps={"alpha": 0.2})
        self.assertEqual(result.returncode, 0, result.stderr)
        state = json.loads((retry_dir / "state.json").read_text())
        self.assertEqual([c["task"] for c in state["completed"]], ["beta", "alpha"])
        calls = (self.base / "calls").read_text()
        self.assertEqual(calls.count("start beta"), 1, "автор beta повторился — повтор должен быть только приёмкой")
        self.assertEqual(calls.count("start alpha"), 2)


if __name__ == "__main__":
    unittest.main()
