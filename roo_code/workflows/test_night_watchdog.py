"""Тесты сторожа ночи: каждый признак беды и каждое лечение.

Решения сторожа проверяются на подделанном каталоге ночи с подменённым «миром» —
процессами, деревом, Claude и запуском. Настоящие куски мира (архив со stash, поиск
процессов ночи, разбор ответа Claude) — отдельно, на настоящем git и процессах. И одна
живая проба: настоящие супервизор и ядро на поддельных CLI, супервизор убит по PID
посреди порции, сторож поднимает ночь.
"""

import importlib.util
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import unittest

HERE = Path(__file__).resolve().parent
WATCHDOG = HERE / "night-watchdog.py"
_spec = importlib.util.spec_from_file_location("night_watchdog", WATCHDOG)
wd = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(wd)
_spec = importlib.util.spec_from_file_location("supervisor_tests", HERE / "test_night_supervisor.py")
sup = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sup)


class FakeWorld:
    def __init__(self, now):
        self.clock = now
        self.alive = False
        self.processes = []
        self.dirty = False
        self.retry = [(False, "HEAD или индекс изменились")]
        self.verdict = {"status": "failed", "summary": "не нашёл"}
        self.launched, self.claude_calls, self.terminated, self.parked = [], [], [], []

    def now(self):
        return self.clock

    def supervisor_alive(self, pid):
        return self.alive

    def night_processes(self, workspace, night):
        return list(self.processes)

    def tree_dirty(self, workspace):
        return self.dirty

    def retry_ok(self, workspace, run_dir, routing):
        return self.retry.pop(0) if len(self.retry) > 1 else self.retry[0]

    def launch(self, night, meta, retry, number):
        self.launched.append(retry.name if retry else None)
        return night / f"watchdog-launch-{number}.log"

    def terminate(self, pids):
        self.terminated.append(pids)

    def park(self, workspace, night, number):
        self.parked.append(number)
        self.dirty = False
        return night / f"watchdog-parked-{number}", "abc123"

    def ask_claude(self, night, meta, saw, detail, number):
        self.claude_calls.append(saw)
        return self.verdict


class DecisionTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="watchdog-test-")
        self.addCleanup(self.temp.cleanup)
        self.nights = Path(self.temp.name)
        self.night = self.nights / "night-2026-09-28-0130"
        self.night.mkdir()
        self.now = time.time()
        self.meta = {"pid": 424242, "deadline": self.now + 3 * 3600, "workspace": "/нет/checkout",
                     "branch": "auto/night-2026-09-28-0130", "routing": "/нет/routing.json",
                     "operator_model": "claude-opus-5", "operator_binary": None}
        (self.night / "night.json").write_text(json.dumps(self.meta))
        self.world = FakeWorld(self.now)

    def report(self, stopped=None, batches=None):
        (self.night / "supervisor.json").write_text(json.dumps(
            {"batches": batches if batches is not None else [{"batch": 1, "completed": 2}],
             "stopped": stopped}, ensure_ascii=False))

    def run_state(self, number, status, current=None, reason=""):
        run = self.night / f"run-{number}"
        run.mkdir()
        (run / "state.json").write_text(json.dumps(
            {"status": status, "current": current, "reason": reason}, ensure_ascii=False))
        return run

    def tick(self):
        return wd.tick(self.nights, self.world)

    def journal(self):
        return wd.Journal(self.night).entries()

    # --- признаки беды ---

    def test_dead_supervisor_with_clean_tree_is_resumed(self):
        self.report()
        self.run_state(1, "completed")
        self.assertEqual(self.tick(), "продолжение")
        self.assertEqual(self.world.launched, [None])
        entry = self.journal()[-1]
        self.assertEqual(entry["увидел"], "супервизор умер до срока")
        self.assertIn("продолжение ночи на оставшиеся 180 мин", entry["сделал"])
        self.assertEqual(self.world.claude_calls, [])

    def test_core_stopped_by_signal_with_supervisor_is_resumed(self):
        # Убита группа супервизора: ядро получило SIGTERM и записало остановку сигналом.
        self.report()
        self.run_state(1, "stopped", "alpha", "Получен сигнал остановки")
        self.assertEqual(self.tick(), "продолжение")
        self.assertEqual(self.world.launched, [None])

    def test_normal_finish_is_left_alone(self):
        for reason in ("время вышло", "порции кончились", "потолок токенов исчерпан: 9 из 8",
                       "порций подряд без принятых задач: 3"):
            self.report(reason)
            self.assertEqual(self.tick(), "ночь закончилась штатно")
        self.assertEqual(self.world.launched, [])
        self.assertEqual(self.journal(), [])

    def test_exhausted_provider_is_not_raised_again(self):
        """Счёт провайдера пуст — подъём упрётся в ту же стену и сожжёт оператора.

        Записать один раз и ждать владельца: ни запуска, ни вызова Claude.
        """
        self.report("ядро остановилось: исполнитель без доступа к модели: litellm.BadRequestError: "
                    "DeepseekException - Insufficient Balance (задача alpha, роль work)")
        self.run_state(1, "stopped", "alpha", "исполнитель без доступа к модели: Insufficient Balance")
        self.assertEqual(self.tick(), "ресурс исполнителя исчерпан")
        self.assertEqual(self.tick(), "ресурс исполнителя исчерпан")
        self.assertEqual(self.world.launched, [])
        self.assertEqual(self.world.claude_calls, [])
        self.assertEqual(sum(1 for e in self.journal() if "решение за владельцем" in e["сделал"]), 1)

    def test_stop_on_review_with_work_in_checkout_is_retried(self):
        self.report("ядро остановилось: Команда завершилась с кодом 1: alpha-review; см. логи")
        self.run_state(1, "completed")
        self.run_state(2, "stopped", "alpha", "Команда завершилась с кодом 1: alpha-review; см. логи")
        self.world.dirty = True
        self.world.retry = [(True, "")]
        self.assertEqual(self.tick(), "повтор приёмки")
        self.assertEqual(self.world.launched, ["run-2"])
        self.assertIn("ядро остановилось в run-2 на alpha", self.journal()[-1]["увидел"])
        self.assertIn("повтор приёмки run-2", self.journal()[-1]["сделал"])

    def test_live_core_without_supervisor_is_waited_for(self):
        # Супервизор убит по PID, ядро живёт в своей группе и дописывает пачку.
        self.report()
        self.run_state(1, "running", "alpha")
        self.world.processes = [5001]
        self.assertEqual(self.tick(), "жду ядро")
        self.assertEqual(self.tick(), "жду ядро")
        self.assertEqual(self.world.launched, [])
        self.assertEqual(len(self.journal()), 1, "ожидание пишется в журнал один раз, а не каждый обход")

    def age(self, minutes):
        stamp = self.now - minutes * 60
        for folder, _dirs, files in os.walk(self.night):
            for name in files:
                os.utime(os.path.join(folder, name), (stamp, stamp))
        os.utime(self.night, (stamp, stamp))

    def test_silence_calls_claude_once_and_stops_the_hung_night(self):
        self.report()
        self.run_state(1, "running", "alpha")
        self.world.alive = True
        self.world.processes = [5001, 5002]
        self.age(wd.SILENCE_MINUTES + 5)
        self.assertEqual(self.tick(), "тишина разобрана")
        self.assertEqual(len(self.world.claude_calls), 1)
        self.assertIn("тишина 50 мин", self.world.claude_calls[0])
        self.assertEqual(self.world.terminated, [[424242, 5001, 5002]])
        self.assertEqual(self.tick(), "случай уже разбирался")
        self.assertEqual(len(self.world.claude_calls), 1)

    def test_silence_below_the_threshold_is_a_working_night(self):
        # 40 минут — больше самой долгой паузы журнала (32.8), но ниже порога.
        self.report()
        self.run_state(1, "running", "alpha")
        self.world.alive = True
        self.age(40)
        self.assertEqual(self.tick(), "ночь идёт")
        self.assertEqual(self.world.claude_calls, [])

    def test_own_files_and_dependency_copies_are_not_activity(self):
        self.report()
        self.run_state(1, "running", "alpha")
        self.world.alive = True
        self.age(wd.SILENCE_MINUTES + 5)
        # Свежие файлы сторожа (архив снятой работы) и копии node_modules — не признак жизни ночи.
        (self.night / "watchdog-parked-1").mkdir()
        (self.night / "watchdog-parked-1/files.tar").write_text("свежий")
        (self.night / "run-1/wt-alpha/frontend_vue/node_modules/.vite").mkdir(parents=True)
        (self.night / "run-1/wt-alpha/frontend_vue/node_modules/.vite/deps.json").write_text("{}")
        self.assertEqual(self.tick(), "тишина разобрана")

    def test_fixed_silence_is_not_killed(self):
        self.report()
        self.run_state(1, "running", "alpha")
        self.world.alive = True
        self.world.verdict = {"status": "fixed", "summary": "погасил повисшего автора"}
        self.age(wd.SILENCE_MINUTES + 5)
        self.tick()
        self.assertEqual(self.world.terminated, [])

    def test_idle_batches_call_claude_once_per_streak(self):
        self.report(batches=[{"batch": 1, "completed": 1}, {"batch": 2, "completed": 0},
                             {"batch": 3, "completed": 0, "preflight": "Некорректный id"}])
        self.world.alive = True
        self.assertEqual(self.tick(), "холостые порции разобраны")
        self.assertEqual(self.tick(), "случай уже разбирался")
        self.assertEqual(len(self.world.claude_calls), 1)
        self.assertIn("порций подряд без принятых задач: 2", self.world.claude_calls[0])
        self.assertEqual(self.world.launched, [])
        # Полоса выросла — тот же случай; новая полоса после принятой задачи — новый.
        batches = json.loads((self.night / "supervisor.json").read_text())["batches"]
        self.report(batches=batches + [{"batch": 4, "completed": 0}])
        self.assertEqual(self.tick(), "случай уже разбирался")
        self.report(batches=batches + [{"batch": 4, "completed": 0}, {"batch": 5, "completed": 1},
                                       {"batch": 6, "completed": 0}, {"batch": 7, "completed": 0}])
        self.assertEqual(self.tick(), "холостые порции разобраны")
        self.assertEqual(len(self.world.claude_calls), 2)

    def test_one_idle_batch_is_not_an_alarm(self):
        self.report(batches=[{"batch": 1, "completed": 1}, {"batch": 2, "completed": 0}])
        self.world.alive = True
        self.assertEqual(self.tick(), "ночь идёт")

    # --- неизвестная поломка ---

    def test_unknown_stop_goes_to_claude_then_night_continues_without_the_task(self):
        self.report("ядро остановилось: Command '[aider-runner.py ...]' returned non-zero exit status 1.")
        self.run_state(2, "stopped", "beta", "Command '[aider-runner.py]' returned non-zero exit status 1.")
        self.world.dirty = True
        self.assertEqual(self.tick(), "продолжение")
        self.assertEqual(len(self.world.claude_calls), 1)
        self.assertEqual(self.world.parked, [3])
        self.assertEqual(self.world.launched, [None])
        parked = [e for e in self.journal() if "снята из checkout" in e["сделал"]]
        self.assertEqual(len(parked), 1)
        self.assertEqual(parked[0]["причина"], "не нашёл")

    def test_claude_fix_makes_the_stop_retryable(self):
        self.report("ядро остановилось: Expecting property name enclosed in double quotes")
        self.run_state(3, "stopped", "gamma", "Expecting property name enclosed in double quotes")
        self.world.dirty = True
        self.world.retry = [(False, "до правки"), (True, "")]
        self.world.verdict = {"status": "fixed", "summary": "разбор ответа с конца"}
        self.assertEqual(self.tick(), "повтор приёмки")
        self.assertEqual(self.world.launched, ["run-3"])
        self.assertEqual(self.world.parked, [])

    def test_core_stop_with_clean_tree_is_not_blindly_resumed(self):
        # Ночь 2026-09-27-0940: ядро упало на авторе, дерево чистое. Слепой подъём
        # повторил бы ту же ошибку; сначала разбор.
        self.report("ядро остановилось: Command '[aider-runner.py]' returned non-zero exit status 1.")
        self.run_state(2, "stopped", None, "Command '[aider-runner.py]' returned non-zero exit status 1.")
        self.world.verdict = {"status": "fixed", "summary": "починил aider-runner"}
        self.assertEqual(self.tick(), "продолжение")
        self.assertEqual(len(self.world.claude_calls), 1)
        self.assertEqual(self.world.launched, [None])

    def test_supervisor_that_finished_abnormally_is_not_blindly_resumed(self):
        # Итог записан, но не штатный: оператор не дал очередь. Прогон при этом чистый,
        # и без разбора сторож поднимал бы ночь на ту же ошибку каждые 15 минут.
        self.report("оператор не дал очередь: Command '[claude]' returned non-zero exit status 1.")
        self.run_state(1, "completed")
        self.tick()
        self.assertEqual(len(self.world.claude_calls), 1)
        self.assertIn("супервизор остановился: оператор не дал очередь", self.world.claude_calls[0])

    # --- ограничители ---

    def test_heal_limit_stops_raising_the_night(self):
        self.report()
        self.run_state(1, "completed")
        journal = wd.Journal(self.night)
        for _ in range(wd.MAX_HEALS):
            journal.write("супервизор умер до срока", "продолжение ночи", лечение="продолжение ночи")
        self.assertEqual(self.tick(), "лимит подъёмов")
        self.assertEqual(self.tick(), "лимит подъёмов")
        self.assertEqual(self.world.launched, [])
        self.assertEqual(sum(1 for e in self.journal() if "решение за владельцем" in e["сделал"]), 1)

    def test_owner_switch_and_deadline_leave_the_night_alone(self):
        self.report()
        self.run_state(1, "completed")
        (self.night / wd.OFF).write_text("")
        self.assertEqual(self.tick(), "сторож выключен владельцем")
        (self.night / wd.OFF).unlink()
        self.world.clock = self.meta["deadline"] - 10 * 60
        self.assertEqual(self.tick(), "срок ночи вышел")
        self.assertEqual(self.world.launched, [])

    def test_second_watchdog_does_not_act_while_the_first_works(self):
        self.report()
        self.run_state(1, "completed")
        with wd.night_lock(self.night) as locked:
            self.assertTrue(locked)
            self.assertEqual(self.tick(), "прошлый сторож ещё работает")
        self.assertEqual(self.world.launched, [])

    def test_latest_night_is_watched(self):
        older = self.nights / "night-2026-09-27-0130"
        older.mkdir()
        (older / "night.json").write_text(json.dumps(self.meta))
        self.assertEqual(wd.latest_night(self.nights), self.night)

    def test_summary_prints_what_the_watchdog_did(self):
        run = self.run_state(1, "completed")
        state = json.loads((run / "state.json").read_text())
        (run / "state.json").write_text(json.dumps({**state, "completed": [], "blocked": []}))
        wd.Journal(self.night).write("супервизор умер до срока", "продолжение ночи на 100 мин",
                                     причина="сломан разбор")
        report = subprocess.run([sys.executable, str(HERE / "night-report.py"), "--out", str(self.night)],
                                capture_output=True, text=True)
        self.assertEqual(report.returncode, 0, report.stderr)
        self.assertIn("## Сторож", report.stdout)
        self.assertIn("супервизор умер до срока → продолжение ночи на 100 мин (причина: сломан разбор)",
                      report.stdout)


class RealWorldTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="watchdog-world-")
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.repo = self.base / "repo"
        self.repo.mkdir()
        self.git("init", "-b", "auto/night-x")
        self.git("config", "user.name", "Тест")
        self.git("config", "user.email", "test@example.invalid")
        (self.repo / "plan.md").write_text("до\n")
        self.git("add", "-A")
        self.git("commit", "-m", "исходное")
        self.night = self.base / "night-x"
        self.night.mkdir()

    def git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.repo), *args], text=True,
                                       stderr=subprocess.DEVNULL).strip()

    def test_park_saves_the_work_and_cleans_the_checkout(self):
        (self.repo / "plan.md").write_text("работа автора\n")
        (self.repo / "новое.md").write_text("новый файл\n")
        world = wd.World()
        self.assertTrue(world.tree_dirty(self.repo))
        archive, stash = world.park(self.repo, self.night, 1)
        self.assertFalse(world.tree_dirty(self.repo))
        self.assertIn("работа автора", (archive / "changes.patch").read_text())
        with __import__("tarfile").open(archive / "files.tar") as tar:
            self.assertEqual(sorted(tar.getnames()), ["plan.md", "новое.md"])
        self.assertEqual(self.git("rev-parse", "refs/stash"), stash)
        self.git("stash", "pop")
        self.assertEqual((self.repo / "новое.md").read_text(), "новый файл\n")

    def sleeper(self, marker):
        proc = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)", marker])
        self.addCleanup(proc.kill)
        # Между fork и exec в /proc/<pid>/cmdline ещё командная строка родителя.
        stop = time.monotonic() + 10
        while marker.encode() not in Path(f"/proc/{proc.pid}/cmdline").read_bytes():
            self.assertLess(time.monotonic(), stop)
            time.sleep(0.01)
        return proc

    def test_night_processes_and_supervisor_liveness(self):
        world = wd.World()
        probe = self.sleeper(str(self.night / "run-1"))
        other = self.sleeper("/чужое")
        found = world.night_processes(self.repo, self.night)
        self.assertIn(probe.pid, found)
        self.assertNotIn(other.pid, found)
        # Живой процесс, но не супервизор (pid переиспользован) — супервизор мёртв.
        self.assertFalse(world.supervisor_alive(probe.pid))
        fake = self.sleeper("night-supervisor.py")
        self.assertTrue(world.supervisor_alive(fake.pid))
        fake.kill()
        fake.wait()
        self.assertFalse(world.supervisor_alive(fake.pid))

    def test_ask_claude_runs_a_writing_session_with_the_night_logs(self):
        claude = self.base / "claude"
        claude.write_text("#!/usr/bin/env python3\n"
                          "import json, os, sys, pathlib\n"
                          "pathlib.Path(os.environ['WD_ARGS']).write_text(json.dumps(sys.argv[1:]))\n"
                          "prompt = sys.stdin.read()\n"
                          "assert 'Беда: супервизор умер' in prompt and 'НЕ `pkill -f`' in prompt\n"
                          "print(json.dumps({'result': 'Готово.\\n{\"status\": \"fixed\", \"summary\": \"ок\"}'}))\n")
        claude.chmod(0o755)
        routing = self.base / "routing.json"
        routing.write_text(json.dumps({"review": {"backend": "claude", "binary": str(claude), "model": "m"}}))
        meta = {"workspace": str(self.repo), "branch": "auto/night-x", "routing": str(routing),
                "operator_model": None, "operator_binary": None}
        os.environ["WD_ARGS"] = str(self.base / "args.json")
        self.addCleanup(os.environ.pop, "WD_ARGS")
        verdict = wd.World().ask_claude(self.night, meta, "супервизор умер", "подробности", 1)
        self.assertEqual(verdict, {"status": "fixed", "summary": "ок"})
        argv = json.loads((self.base / "args.json").read_text())
        self.assertIn("bypassPermissions", argv)
        self.assertEqual(argv[argv.index("--model") + 1], "m")
        self.assertIn(str(self.night), argv)
        self.assertTrue((self.night / "watchdog-claude-1.prompt.txt").is_file())
        claude.write_text("#!/bin/sh\nsleep 5\n")
        verdict = wd.World(claude_timeout=0.5).ask_claude(self.night, meta, "супервизор умер", "", 2)
        self.assertEqual(verdict["status"], "failed")
        self.assertIn("не отработала", verdict["summary"])

    def test_claude_verdict_is_read_from_the_end(self):
        log = self.base / "out.log"
        log.write_text(json.dumps({"result": 'Разбор: в логе был {"status": "failed", "summary": "старое"}.\n'
                                             '{"status": "fixed", "summary": "починил"}'}))
        self.assertEqual(wd.claude_verdict(log), {"status": "fixed", "summary": "починил"})
        log.write_text(json.dumps({"result": "Не понял, что делать."}))
        self.assertEqual(wd.claude_verdict(log)["status"], "failed")
        log.write_text("не JSON")
        self.assertEqual(wd.claude_verdict(log)["status"], "failed")


SLOW_CLAUDE = sup.FAKE_CLAUDE.replace(
    "task = json.loads(",
    "import time; time.sleep(float(os.environ.get('NIGHT_TEST_SLEEP', '0')))\ntask = json.loads(", 1)


class NightFixture(unittest.TestCase):
    """Каталог и checkout из тестов супервизора — без их тестов (иначе прогон их задвоит)."""

    setUp = sup.SupervisorTest.setUp
    git = sup.SupervisorTest.git
    run_supervisor = sup.SupervisorTest.run_supervisor
    report = sup.SupervisorTest.report
    operator_prompt = sup.SupervisorTest.operator_prompt


class ResumeTest(NightFixture):
    """Продолжение ночи супервизором — то, чем сторож её поднимает."""

    def resume(self, *extra, mode=""):
        command = [sys.executable, str(sup.SUPERVISOR), "--resume", "--out", str(self.out), *extra]
        return subprocess.run(command, env={**self.env, "NIGHT_TEST_QUEUES": str(self.queues),
                                            "NIGHT_TEST_MODE": mode},
                              capture_output=True, text=True, timeout=120)

    def set_night(self, **changes):
        night = json.loads((self.out / "night.json").read_text())
        (self.out / "night.json").write_text(json.dumps({**night, **changes}))
        return night

    def test_night_started_before_the_finish_margin_still_resumes(self):
        result = self.run_supervisor([sup.queue_json("alpha"), sup.queue_json("beta", ["plan2.md"])], batches=1)
        self.assertEqual(result.returncode, 0, result.stderr)
        night = self.set_night(max_batches=2)
        del night["finish_minutes"]   # так выглядит night.json ночи, начатой до параметра
        (self.out / "night.json").write_text(json.dumps({**night, "max_batches": 2}))
        result = self.resume()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([b["tasks"] for b in self.report()["batches"]], [["alpha"], ["beta"]])
        self.assertEqual(json.loads((self.out / "night.json").read_text())["finish_minutes"], 0)

    def test_resume_continues_the_same_night(self):
        result = self.run_supervisor([sup.queue_json("alpha"), sup.queue_json("beta", ["plan2.md"])], batches=1)
        self.assertEqual(result.returncode, 0, result.stderr)
        before = self.set_night(max_batches=2)
        self.assertEqual(before["pid"] > 0 and before["branch"], "auto/pilot")
        result = self.resume()
        self.assertEqual(result.returncode, 0, result.stderr)
        report = self.report()
        self.assertEqual([b["tasks"] for b in report["batches"]], [["alpha"], ["beta"]])
        self.assertTrue((self.out / "run-2/state.json").is_file())
        self.assertEqual(len(report["resumes"]), 1)
        # Сделанное до подъёма дошло до оператора: иначе он выдал бы alpha снова.
        self.assertIn("alpha", self.operator_prompt(2))
        after = json.loads((self.out / "night.json").read_text())
        self.assertEqual(after["deadline"], before["deadline"], "продолжение не продлевает срок")
        self.assertEqual(after["resumes"], 1)
        self.assertEqual(self.git("log", "--format=%s", f"{self.baseline}..HEAD").split("\n"),
                         ["night: beta", "night: alpha"])

    def test_resume_retries_the_stopped_review_first(self):
        result = self.run_supervisor([sup.queue_json("alpha")], batches=1, mode="review-cli-error")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("ядро остановилось", self.report()["stopped"])
        self.assertEqual(self.git("status", "--porcelain"), "M plan.md")
        self.set_night(max_batches=2)
        result = self.resume("--retry-review", str(self.out / "run-1"))
        self.assertEqual(result.returncode, 0, result.stderr)
        report = self.report()
        self.assertEqual(report["batches"][1]["retry_of"], "run-1")
        self.assertEqual(report["batches"][1]["tasks"], ["alpha"])
        self.assertEqual(report["stopped"], "порции кончились")
        self.assertEqual(self.git("log", "--format=%s", "-1"), "night: alpha")
        # Автор не повторялся: повтор — только приёмка сохранённой работы.
        self.assertEqual((self.base / "calls").read_text().count("operator"), 1)

    def test_fresh_start_requires_its_parameters(self):
        result = subprocess.run([sys.executable, str(sup.SUPERVISOR), "--out", str(self.out)],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)
        self.assertIn("обязательны", result.stderr)


class LiveProbeTest(NightFixture):
    """Живая проба: настоящая ночь, супервизор убит по PID, сторож её поднимает."""

    def test_killed_supervisor_is_raised_by_the_watchdog(self):
        workflows = self.root / "roo_code/workflows"
        workflows.mkdir(parents=True)
        for name in ("night-run.sh", "night-supervisor.py", "codex-night.py", "headless_backends.py",
                     "night_db.py", "refs_shift.py", "night-report.py", "night-watchdog.py"):
            shutil.copy(HERE / name, workflows / name)
        # Скрипты импортируют друг друга, и __pycache__ иначе испачкал бы дерево ночи.
        (self.root / ".gitignore").write_text("__pycache__/\n")
        self.git("add", "-A")
        self.git("commit", "-m", "скрипты прогона")
        (self.bin / "claude").write_text(SLOW_CLAUDE)
        nights = self.base / "nights"
        self.out = nights / "night-probe"
        self.queues.write_text(json.dumps([sup.queue_json("alpha"), sup.queue_json("beta", ["plan2.md"])]))
        env = {**self.env, "NIGHT_TEST_QUEUES": str(self.queues), "NIGHT_TEST_SLEEP": "3"}
        supervisor = subprocess.Popen(
            [sys.executable, str(workflows / "night-supervisor.py"), "--workspace", str(self.root),
             "--routing", str(self.routing), "--operator-prompt", str(self.prompt), "--out", str(self.out),
             "--hours", "0.5", "--token-budget", "10000000", "--operator-binary", str(self.bin / "claude"),
             "--max-tasks", "1", "--max-batches", "2"],
            env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        self.addCleanup(lambda: supervisor.poll() is None and supervisor.kill())
        journal = self.out / "run-1/journal.jsonl"
        self.wait_for(lambda: journal.is_file() and "task-start" in journal.read_text(), "автор не начал")

        def watch():
            return subprocess.run([sys.executable, str(workflows / "night-watchdog.py"), "--nights", str(nights),
                                   "--launch", "direct"], env=env, capture_output=True, text=True, timeout=60)

        # Здоровая ночь: сторож видит живой супервизор и ничего не трогает.
        self.assertEqual(watch().stdout.strip(), "ночь идёт")
        os.kill(supervisor.pid, signal.SIGKILL)   # по PID, а не pkill -f
        supervisor.wait()

        # Пока ядро дописывает пачку, сторож ждёт; затем поднимает ночь.
        outcomes = []
        self.wait_for(lambda: outcomes.append((watch().stdout.strip().splitlines() or [""])[-1]) or outcomes[-1] == "продолжение",
                      f"сторож не поднял ночь: {outcomes}")
        self.wait_for(lambda: (self.out / "supervisor.json").is_file()
                      and json.loads((self.out / "supervisor.json").read_text()).get("stopped"),
                      "поднятая ночь не закончилась")
        report = json.loads((self.out / "supervisor.json").read_text())
        self.assertEqual(report["stopped"], "порции кончились")
        self.assertEqual([b["tasks"] for b in report["batches"]], [["alpha"], ["beta"]])
        self.assertEqual(self.git("log", "--format=%s", "-2").split("\n"), ["night: beta", "night: alpha"])
        entries = wd.Journal(self.out).entries()
        self.assertEqual(entries[-1]["лечение"], "продолжение ночи")
        self.assertEqual(entries[-1]["увидел"], "супервизор умер до срока")
        self.wait_for(lambda: "## Сторож" in (self.out / "СВОДКА.md").read_text()
                      if (self.out / "СВОДКА.md").is_file() else False, "сводка без сторожа")

    def wait_for(self, condition, message, seconds=90):
        stop = time.monotonic() + seconds
        while time.monotonic() < stop:
            if condition():
                return
            time.sleep(0.5)
        self.fail(message)


if __name__ == "__main__":
    unittest.main()
