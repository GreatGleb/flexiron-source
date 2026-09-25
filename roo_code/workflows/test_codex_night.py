"""Integration tests with fake Codex/npm; no network or model usage."""

import json
import importlib.util
import hashlib
from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile
import unittest


RUNNER = Path(__file__).with_name("codex-night.py").resolve()
_spec = importlib.util.spec_from_file_location("night_db", RUNNER.with_name("night_db.py"))
night_db = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(night_db)
LIVE_DB_URL = "postgresql+asyncpg://postgres:root@localhost:5433/flexiron"


def postgres_available():
    try:
        night_db.asyncpg_sql(night_db.url_for_database(LIVE_DB_URL, "postgres"), [], ["SELECT 1"])
    except Exception:
        return False
    return True
FAKE_CODEX = r'''#!/usr/bin/env python3
import json, os, pathlib, subprocess, sys, time
args = sys.argv[1:]
assert args[:3] == ['-a', 'never', 'exec']
assert '--json' in args and '--output-schema' in args
prompt = sys.stdin.read()
assert 'Актуальные решения владельца из реестра' in prompt
mode = os.environ.get('NIGHT_TEST_MODE', '')
task = json.loads(prompt.split('\nЗадание (JSON):\n', 1)[1])
if mode.startswith('{'):
    mode = json.loads(mode).get(task['id'], '')
work = args[args.index('--sandbox') + 1] == 'workspace-write'
with pathlib.Path(os.environ['NIGHT_TEST_CALLS']).open('a') as calls:
    calls.write(task['id'] + (':work' if work else ':review') + '\n')
if os.environ.get('NIGHT_TEST_DBLOG'):
    with pathlib.Path(os.environ['NIGHT_TEST_DBLOG']).open('a') as seen:
        seen.write('%s:%s=%s\n' % (task['id'], 'work' if work else 'review',
                                    os.environ.get('DATABASE_URL', '')))
    if os.environ.get('DATABASE_URL'):
        assert os.environ['DATABASE_URL'] in prompt, 'автору не сказан адрес его базы'
if work:
    if mode == 'must-not-repeat-author':
        sys.exit(55)
    if mode not in ('no-edit-blocked', 'no-edit-done'):
        for name in task['outputs']:
            path = pathlib.Path(name)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('prepared\n')
    if mode == 'delete-source':
        pathlib.Path('plan.md').unlink()
    if mode == 'mixed-blocked':
        pathlib.Path('plan.md').unlink()
        pathlib.Path('new.bin').write_bytes(b'\x00\xff\x01')
        pathlib.Path('script.sh').chmod(0o755)
        pathlib.Path('link').unlink()
        pathlib.Path('link').symlink_to('new.bin')
    if mode in ('outside', 'outside-blocked'):
        pathlib.Path('unrelated.md').write_text('outside\n')
    if mode == 'timeout':
        time.sleep(30)
    if mode == 'stage':
        subprocess.check_call(['git', 'add', 'plan.md'])
    if mode == 'branch':
        subprocess.check_call(['git', 'switch', '-c', 'auto/unexpected'])
if not work and mode in ('review-writes', 'review-writes-blocked'):
    pathlib.Path('plan.md').write_text('tampered\n')
if mode == 'cli-error' or (not work and mode == 'review-cli-error'):
    sys.exit(12)
if mode.startswith('service-') and (not work or mode == 'service-writer'):
    output = pathlib.Path(args[args.index('--output-last-message') + 1])
    if mode != 'service-once' or '-retry-2' not in output.name:
        if mode == 'service-mutates':
            pathlib.Path('plan.md').write_text('tampered\n')
        error = {'type': 'error', 'error': {'type': 'invalid_request_error',
            'code': 'unsupported_parameter', 'param': 'access_programs.cyber'}, 'status': 400}
        if mode == 'service-auth':
            error['error']['code'] = 'invalid_api_key'
        output.write_text('partial response')
        print(json.dumps({'type': 'turn.failed', 'error': {'message': json.dumps(error)}}))
        sys.exit(1)
blocked = (work and mode in ('work-blocked', 'no-edit-blocked', 'mixed-blocked', 'outside-blocked')) or (
    not work and mode in ('reject', 'review-writes-blocked'))
result = {'status': 'blocked' if blocked else 'done',
          'summary': 'test result', 'evidence': ['read plan.md']}
pathlib.Path(args[args.index('--output-last-message') + 1]).write_text(json.dumps(result))
print(json.dumps({'type': 'turn.completed', 'usage': {'input_tokens': 1}}))
'''
FAKE_NPM = r'''#!/usr/bin/env python3
import json, os, pathlib, sys
assert sys.argv[1:] == ['run', 'verify']
assert pathlib.Path.cwd().name == 'frontend_vue'
mode = os.environ.get('NIGHT_TEST_MODE', '')
if mode.startswith('{'):
    mode = json.loads(mode).get('_npm', '')
countfile = pathlib.Path(os.environ['NIGHT_TEST_COUNT'])
count = int(countfile.read_text()) if countfile.exists() else 0
countfile.write_text(str(count + 1))
print('fake verification', count)
sys.exit(1 if mode == 'baseline-red' or (mode == 'verify-red' and count > 0)
         or (mode == 'first-check-red' and count == 1) else 0)
'''


class PilotTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="codex-night-test-")
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / "repo"
        self.root.mkdir()
        (self.root / "frontend_vue").mkdir()
        (self.root / "plan.md").write_text("before\n")
        self.git("init", "-b", "auto/pilot")
        self.git("config", "user.name", "Pilot test")
        self.git("config", "user.email", "pilot@example.invalid")
        self.git("config", "commit.gpgsign", "false")
        self.git("config", "core.hooksPath", str(self.base / "empty-hooks"))
        self.git("add", "plan.md")
        self.git("commit", "-m", "baseline")
        self.baseline = self.git("rev-parse", "HEAD")
        self.bin = self.base / "bin"
        self.bin.mkdir()
        for name, body in (("codex", FAKE_CODEX), ("npm", FAKE_NPM)):
            path = self.bin / name
            path.write_text(body)
            path.chmod(0o755)
        self.queue = self.base / "queue.json"
        self.queue.write_text(json.dumps({"tasks": [{"id": "plan", "sources": ["plan.md"],
                                                   "outputs": ["plan.md"], "task": "prepare"}]}))
        self.logs = self.base / "results"
        self.env = {**os.environ, "PATH": str(self.bin) + os.pathsep + os.environ["PATH"],
                    "NIGHT_TEST_COUNT": str(self.base / "npm-count"),
                    "NIGHT_TEST_CALLS": str(self.base / "calls")}

    def git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.root), *args], text=True,
                                       stderr=subprocess.DEVNULL).strip()

    def invoke(self, mode="", run=True, minutes="1", previous=None, max_tasks=1):
        command = [sys.executable, str(RUNNER), "--workspace", str(self.root), "--queue", str(self.queue)]
        if run:
            command += ["--run", "--run-dir", str(self.logs), "--minutes", minutes, "--max-tasks", str(max_tasks)]
        if previous:
            command += ["--retry-review", str(previous)]
        return subprocess.run(command, env={**self.env, "NIGHT_TEST_MODE": json.dumps(mode) if isinstance(mode, dict) else mode},
                              capture_output=True, text=True, timeout=15)

    def state(self):
        return json.loads((self.logs / "state.json").read_text())


    # --- БАГ-05: общий изменяемый ресурс изолируется вместе с файлами ---

    def with_backend(self, checks):
        """Дерево с бэкендом и очередь, чья проверка записывает свой DATABASE_URL."""
        (self.root / "backend").mkdir()
        (self.root / "backend/.env").write_text(f"DATABASE_URL={LIVE_DB_URL}\n")
        self.git("add", "backend/.env")
        self.git("commit", "-m", "backend env")
        self.dblog = self.base / "dburls"
        self.env["NIGHT_TEST_DBLOG"] = str(self.dblog)
        self.env["NIGHT_TEST_DBLOG_CHECK"] = str(self.dblog)
        self.queue.write_text(json.dumps({"tasks": [
            {"id": "plan", "sources": ["plan.md"], "outputs": ["plan.md"], "task": "prepare",
             "checks": checks}]}))

    def seen_urls(self):
        return dict(line.split("=", 1) for line in self.dblog.read_text().splitlines())

    @unittest.skipUnless(postgres_available(),
                         f"нет Postgres на {LIVE_DB_URL}: изоляцию баз проверять не на чем")
    def test_task_gets_its_own_database_and_loses_it_when_the_task_ends(self):
        probe = ["python3", "-c", "import os, pathlib;"
                 "pathlib.Path(os.environ['NIGHT_TEST_DBLOG_CHECK']).open('a')"
                 ".write('plan:check=%s\\n' % os.environ.get('DATABASE_URL', ''))"]
        self.with_backend([{"cwd": "backend", "argv": probe}])
        pool = night_db.TaskDatabases(LIVE_DB_URL)
        self.addCleanup(lambda: [pool._admin(*pool._drop(name)) for name in pool.existing()])
        result = self.invoke()
        self.assertEqual(result.returncode, 0, result.stderr)
        # С драйвером: это `DATABASE_URL`, и по нему автор поднимает асинхронный движок.
        expected = night_db.url_for_database(LIVE_DB_URL, night_db.database_name("plan"),
                                             keep_driver=True)
        self.assertIn("+asyncpg", expected)
        seen = self.seen_urls()
        # Автор, проверка и приёмка работают в ОДНОЙ базе — своей, а не общей.
        self.assertEqual(seen["plan:work"], expected)
        self.assertEqual(seen["plan:check"], expected)
        self.assertEqual(seen["plan:review"], expected)
        self.assertNotIn("/flexiron", seen["plan:work"])
        # Задача кончилась — базы не стало; остаётся только шаблон.
        self.assertEqual(pool.existing(), [night_db.TEMPLATE])

    @unittest.skipUnless(postgres_available(),
                         f"нет Postgres на {LIVE_DB_URL}: изоляцию баз проверять не на чем")
    def test_blocked_task_takes_its_database_with_it(self):
        """Ровно случай БАГ-05: забракованная задача не оставляет за собой схему."""
        self.with_backend([])
        pool = night_db.TaskDatabases(LIVE_DB_URL)
        self.addCleanup(lambda: [pool._admin(*pool._drop(name)) for name in pool.existing()])
        result = self.invoke("work-blocked")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(self.state()["blocked"]), 1)
        self.assertEqual(pool.existing(), [night_db.TEMPLATE])

    @unittest.skipUnless(postgres_available(),
                         f"нет Postgres на {LIVE_DB_URL}: изоляцию баз проверять не на чем")
    def test_finished_task_loses_its_database_before_the_next_task_starts(self):
        """База отдаётся на КОНЦЕ задачи, а не на конце прогона.

        Уборка в `dispose()` делает конечное состояние одинаковым в обоих случаях, и
        проверка по нему слепа — инверсия 2026-09-25 это и показала: снятый
        `release` не покраснел ничего. Видно это только изнутри прогона, поэтому
        вторая задача перечисляет базы и записывает, что застала.
        """
        self.with_backend([])
        probe = self.base / "list-databases.py"
        probe.write_text(
            "import importlib.util, json, os, pathlib\n"
            f"spec = importlib.util.spec_from_file_location('night_db', {str(RUNNER.with_name('night_db.py'))!r})\n"
            "night_db = importlib.util.module_from_spec(spec)\n"
            "spec.loader.exec_module(night_db)\n"
            f"pool = night_db.TaskDatabases({LIVE_DB_URL!r})\n"
            "with pathlib.Path(os.environ['NIGHT_TEST_DBLOG_CHECK']).open('a') as out:\n"
            "    out.write('second:alive=%s\\n' % ','.join(pool.existing()))\n")
        self.queue.write_text(json.dumps({"tasks": [
            {"id": "first", "sources": ["plan.md"], "outputs": ["plan.md"], "task": "prepare"},
            {"id": "second", "sources": ["plan.md"], "outputs": ["other.md"], "task": "prepare",
             "checks": [{"cwd": "backend", "argv": ["python3", str(probe)]}]}]}))
        pool = night_db.TaskDatabases(LIVE_DB_URL)
        self.addCleanup(lambda: [pool._admin(*pool._drop(name)) for name in pool.existing()])
        result = self.invoke(max_tasks=2)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(self.state()["completed"]), 2)
        alive = self.seen_urls()["second:alive"].split(",")
        self.assertIn(night_db.database_name("second"), alive)
        self.assertNotIn(night_db.database_name("first"), alive,
                         "база законченной задачи дожила до следующей")

    @unittest.skipUnless(postgres_available(),
                         f"нет Postgres на {LIVE_DB_URL}: изоляцию баз проверять не на чем")
    def test_shared_db_flag_is_the_only_way_back_to_the_common_database(self):
        """Умолчание — изоляция. Общая база достижима только явным флагом."""
        self.with_backend([])
        pool = night_db.TaskDatabases(LIVE_DB_URL)
        self.addCleanup(lambda: [pool._admin(*pool._drop(name)) for name in pool.existing()])
        command = [sys.executable, str(RUNNER), "--workspace", str(self.root), "--queue", str(self.queue),
                   "--shared-db", "--run", "--run-dir", str(self.logs), "--minutes", "1", "--max-tasks", "1"]
        result = subprocess.run(command, env={**self.env, "NIGHT_TEST_MODE": ""},
                                capture_output=True, text=True, timeout=15)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.seen_urls()["plan:work"], "")
        self.assertEqual(pool.existing(), [])

    def test_preflight_does_not_call_model_or_write_results(self):
        result = self.invoke(run=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(self.logs.exists())
        self.assertEqual(self.git("rev-parse", "HEAD"), self.baseline)

    def test_dirty_checkout_is_preserved(self):
        (self.root / "plan.md").write_text("owner answer\n")
        result = self.invoke()
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertFalse(self.logs.exists())
        self.assertEqual((self.root / "plan.md").read_text(), "owner answer\n")

    def test_success_checks_and_commits_with_independent_review(self):
        result = self.invoke()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.state()["status"], "completed")
        self.assertEqual(len(self.state()["completed"]), 1)
        self.assertNotEqual(self.git("rev-parse", "HEAD"), self.baseline)
        self.assertFalse(self.git("status", "--porcelain"))
        self.assertTrue((self.logs / "plan-review.json").exists())
        self.assertEqual((self.base / "npm-count").read_text(), "2")
        journal = (self.logs / "journal.jsonl").read_text().splitlines()
        self.assertEqual([json.loads(x)["event"] for x in journal],
                         ["start", "task-start", "task-done", "finish"])

    def test_previous_log_directory_never_overwritten(self):
        self.logs.mkdir()
        (self.logs / "journal.jsonl").write_text("old journal")
        result = self.invoke()
        self.assertEqual(result.returncode, 2)
        self.assertEqual((self.logs / "journal.jsonl").read_text(), "old journal")

    def test_baseline_failure_stops_before_model(self):
        self.assertEqual(self.invoke("baseline-red").returncode, 1)
        self.assertEqual(self.state()["status"], "stopped")
        self.assertFalse((self.logs / "plan-work.prompt.txt").exists())
        self.assertEqual((self.root / "plan.md").read_text(), "before\n")

    def test_rejected_or_failed_work_is_not_committed_and_is_preserved(self):
        # Each subcase receives a fresh fixture and log directory.
        for mode in ("cli-error", "outside", "outside-blocked", "review-writes", "review-writes-blocked", "timeout", "stage", "branch"):
            with self.subTest(mode=mode):
                case = PilotTest()
                case.setUp()
                try:
                    result = case.invoke(mode, minutes="0.02" if mode == "timeout" else "1")
                    self.assertEqual(result.returncode, 1, result.stderr)
                    self.assertEqual(case.state()["status"], "stopped")
                    self.assertEqual(case.state()["completed"], [])
                    self.assertEqual(case.git("rev-parse", "HEAD"), case.baseline)
                    self.assertNotEqual((case.root / "plan.md").read_text(), "before\n")
                    self.assertTrue((case.logs / "report.md").exists())
                finally:
                    case.doCleanups()

    def test_main_branch_refused(self):
        self.git("branch", "-m", "main")
        self.assertEqual(self.invoke().returncode, 2)
        self.assertFalse(self.logs.exists())

    def test_commit_hook_changes_are_not_reported_as_accepted(self):
        hooks = self.base / "hooks"
        hooks.mkdir()
        hook = hooks / "pre-commit"
        hook.write_text('#!/bin/sh\nprintf "hook change\\n" > plan.md\ngit add plan.md\n')
        hook.chmod(0o755)
        self.git("config", "core.hooksPath", str(hooks))
        result = self.invoke()
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertEqual(self.state()["completed"], [])
        self.assertIn("hook", self.state()["reason"])

    def test_retry_rechecks_saved_work_without_repeating_author(self):
        self.assertEqual(self.invoke("review-cli-error").returncode, 1)
        previous = self.logs
        old_journal = (previous / "journal.jsonl").read_bytes()
        (self.root / "plan.md").write_text("corrected after review\n")
        self.logs = self.base / "retry"
        result = self.invoke("must-not-repeat-author", previous=previous)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.state()["status"], "completed")
        self.assertEqual((previous / "journal.jsonl").read_bytes(), old_journal)
        self.assertEqual((self.root / "plan.md").read_text(), "corrected after review\n")
        self.assertTrue((self.logs / "plan-check-verify.stdout.log").is_file())
        self.assertFalse((self.logs / "plan-work.prompt.txt").exists())

    def test_retry_rejects_unrelated_changes(self):
        self.assertEqual(self.invoke("review-cli-error").returncode, 1)
        previous = self.logs
        (self.root / "unrelated.txt").write_text("another session\n")
        self.logs = self.base / "retry"
        self.assertEqual(self.invoke(previous=previous).returncode, 2)
        self.assertFalse(self.logs.exists())

    def test_service_retry_does_not_repeat_author_and_preserves_attempts(self):
        result = self.invoke('service-once')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.state()['status'], 'completed')
        self.assertEqual((self.base / 'calls').read_text().splitlines(),
                         ['plan:work', 'plan:review', 'plan:review'])
        self.assertEqual((self.logs / 'plan-review-failed-1.json').read_text(), 'partial response')
        self.assertTrue((self.logs / 'plan-review-retry-2.stdout.log').exists())
        self.assertEqual(json.loads((self.logs / 'plan-review.json').read_text())['status'], 'done')

    def test_persistent_review_service_failure_archived_and_queue_continues(self):
        self.tasks(('plan', {}), ('independent', {}), ('dependent', {'depends_on': ['plan']}))
        result = self.invoke({'plan': 'service-persistent'}, max_tasks=3)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([x['task'] for x in self.state()['completed']], ['independent'])
        self.assertEqual([x['task'] for x in self.state()['blocked']], ['plan'])
        self.assertEqual([x['task'] for x in self.state()['waiting']], ['dependent'])
        self.assertEqual(len((self.logs / 'service-retries.jsonl').read_text().splitlines()), 2)
        self.assertEqual(json.loads((self.logs / 'plan-review.json').read_text())['status'], 'blocked')
        self.assertEqual((self.logs / 'plan-review-failed-1.json').read_text(), 'partial response')
        self.assertFalse(self.git('status', '--porcelain'))

    def test_service_retry_refuses_writer_mutation_auth_denial_and_expired_budget(self):
        for mode in ('service-writer', 'service-mutates', 'service-auth', 'service-deadline'):
            with self.subTest(mode=mode):
                case = PilotTest()
                case.setUp()
                try:
                    result = case.invoke(mode, minutes='0.02' if mode == 'service-deadline' else '1')
                    self.assertEqual(result.returncode, 1, result.stderr)
                    self.assertEqual(case.state()['status'], 'stopped')
                    self.assertEqual(case.git('rev-parse', 'HEAD'), case.baseline)
                    self.assertLessEqual((case.base / 'calls').read_text().count(':review'), 1)
                finally:
                    case.doCleanups()

    def test_service_classifier_only_accepts_last_real_cli_error(self):
        spec = importlib.util.spec_from_file_location('night_test_module', RUNNER)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        log = self.base / 'events.jsonl'
        transient = {'type': 'error', 'error': {'code': 'server_error'}}
        denial = {'type': 'turn.failed', 'error': {'code': 'insufficient_quota'}}
        for events, expected in (([transient], 'server_error'), ([transient, denial], None),
                                 ([{'type': 'item.completed', 'item': transient}], None)):
            log.write_text('\n'.join(json.dumps(x) for x in events))
            self.assertEqual(module.service_error_kind(log), expected)

    def test_legacy_watcher_recovers_once_without_repeating_author(self):
        self.assertEqual(self.invoke('review-cli-error').returncode, 1)
        (self.logs / 'plan-review.stdout.log').write_text(json.dumps(
            {'type': 'error', 'error': {'code': 'server_error'}}))
        guard = self.base / 'guard'
        guard.mkdir()
        shutil.copyfile(RUNNER, guard / 'controller.py')
        shutil.copyfile(RUNNER.with_name('headless_backends.py'), guard / 'headless_backends.py')
        shutil.copyfile(RUNNER.with_name('night_db.py'), guard / 'night_db.py')
        shutil.copyfile(RUNNER.with_name('refs_shift.py'), guard / 'refs_shift.py')
        shutil.copyfile(RUNNER.with_name('codex-night-watch.py'), guard / 'watch.py')
        shutil.copyfile(self.queue, guard / 'queue.json')
        pointer = self.base / 'active.json'
        metadata = {'unit': 'old.service', 'run_dir': str(self.logs), 'workspace': str(self.root),
                    'deadline': (datetime.now(timezone.utc) + timedelta(minutes=1)).isoformat(),
                    'queue_sha256': hashlib.sha256(self.queue.read_bytes()).hexdigest(), 'max_tasks': 1}
        pointer.write_text(json.dumps(metadata))
        for name, content in (
            ('systemctl', "#!/bin/sh\nprintf 'ActiveState=failed\\nResult=exit-code\\n'\n"),
            ('systemd-inhibit', '#!/usr/bin/env python3\nimport subprocess, sys\n'
             'raise SystemExit(subprocess.call(sys.argv[5:]))\n')):
            script = self.bin / name
            script.write_text(content)
            script.chmod(0o755)
        command = [sys.executable, str(guard / 'watch.py'), '--pointer', str(pointer),
                   '--unit', 'old.service', '--watch-unit', 'watch.service', '--codex', 'codex']
        result = subprocess.run(command, env={**self.env, 'NIGHT_TEST_MODE': 'must-not-repeat-author'},
                                capture_output=True, text=True, timeout=15)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads((guard / 'run/state.json').read_text())['status'], 'completed')
        active = json.loads(pointer.read_text())
        self.assertEqual(active['unit'], 'watch.service')
        self.assertEqual(active['deadline'], metadata['deadline'])
        self.assertLess(active['minutes'], 1)
        self.assertEqual((self.base / 'calls').read_text().count('plan:work'), 1)
        # The already handled pointer cannot cause another recovery.
        result = subprocess.run(command, env=self.env, capture_output=True, text=True, timeout=5)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.base / 'calls').read_text().count('plan:review'), 2)

    def test_legacy_watcher_does_not_restart_pause_checks_or_success(self):
        spec = importlib.util.spec_from_file_location('watch_test_module', RUNNER.with_name('codex-night-watch.py'))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        state = {'status': 'stopped', 'current': 'plan',
                 'reason': 'Команда завершилась с кодом 1: plan-review; см. логи'}
        self.assertTrue(module.eligible(state, 'exit-code', self.logs, lambda _: 'server_error'))
        for result in ('success', 'signal', 'timeout', None):
            self.assertFalse(module.eligible(state, result, self.logs, lambda _: 'server_error'))
        for changed in ({'status': 'completed'}, {'reason': 'signal 15'},
                        {'reason': 'Команда завершилась с кодом 1: plan-check-verify; см. логи'}):
            self.assertFalse(module.eligible({**state, **changed}, 'exit-code', self.logs, lambda _: 'server_error'))
        self.assertFalse(module.eligible(state, 'exit-code', self.logs, lambda _: None))

    def test_retry_rejects_changed_head(self):
        self.assertEqual(self.invoke("review-cli-error").returncode, 1)
        previous = self.logs
        self.git("commit", "--allow-empty", "-m", "unrelated commit")
        self.logs = self.base / "retry"
        self.assertEqual(self.invoke(previous=previous).returncode, 2)
        self.assertFalse(self.logs.exists())

    def tasks(self, *specs):
        tasks = [{"id": name, "sources": [], "outputs": [name + ".md"], "task": "prepare",
                  **extra} for name, extra in specs]
        self.queue.write_text(json.dumps({"tasks": tasks}))

    def test_blocked_task_is_archived_and_independent_task_committed(self):
        for mode, phase in (("work-blocked", "work"), ("reject", "review"),
                            ("verify-red", "checks"), ("no-edit-blocked", "work"), ("no-edit-done", "work")):
            with self.subTest(mode=mode):
                case = PilotTest()
                case.setUp()
                try:
                    case.tasks(("plan", {}), ("independent", {}))
                    modes = {"plan": mode} if mode != "verify-red" else {"_npm": "first-check-red"}
                    result = case.invoke(modes, max_tasks=2)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    state = case.state()
                    self.assertEqual(state["status"], "completed-with-blockers")
                    self.assertEqual([x["task"] for x in state["completed"]], ["independent"])
                    self.assertEqual(state["blocked"][0]["phase"], phase)
                    self.assertEqual(state["pending"], [])
                    self.assertFalse(case.git("status", "--porcelain"))
                    self.assertEqual(case.git("diff", "--name-only", case.baseline, "HEAD"), "independent.md")
                    item = state["blocked"][0]
                    expected_reason = ("без изменений" if mode == "no-edit-done" else
                                       "кодом 1" if phase == "checks" else "test result")
                    self.assertIn(expected_reason,
                                  (case.logs / "report.md").read_text())
                    if mode in ("no-edit-blocked", "no-edit-done"):
                        self.assertIsNone(item["stash"])
                    else:
                        case.git("stash", "apply", item["stash"])
                        self.assertEqual((case.root / "plan.md").read_text(), "prepared\n")
                finally:
                    case.doCleanups()

    def test_dependencies_wait_transitively_and_do_not_consume_attempts(self):
        self.tasks(("plan", {}), ("dependent", {"depends_on": ["plan"]}),
                   ("reader", {"sources": ["dependent.md"]}),
                   ("same-output", {"outputs": ["plan.md"]}), ("independent", {}))
        result = self.invoke({"plan": "work-blocked"}, max_tasks=2)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([x["task"] for x in self.state()["waiting"]],
                         ["dependent", "reader", "same-output"])
        self.assertEqual((self.base / "calls").read_text().splitlines(),
                         ["plan:work", "independent:work", "independent:review"])
        self.assertEqual(self.state()["status"], "completed-with-blockers")

    def test_two_consecutive_blockers_do_not_stop_third_task(self):
        self.tasks(("plan", {}), ("second", {}), ("third", {}))
        result = self.invoke({"plan": "work-blocked", "second": "reject"}, max_tasks=3)
        self.assertEqual(result.returncode, 0, result.stderr)
        state = self.state()
        self.assertEqual([x["task"] for x in state["blocked"]], ["plan", "second"])
        self.assertEqual([x["task"] for x in state["completed"]], ["third"])
        self.assertNotEqual(state["blocked"][0]["stash"], state["blocked"][1]["stash"])
        self.assertEqual(self.git("diff", "--name-only", self.baseline, "HEAD"), "third.md")

    def test_archive_preserves_deletion_binary_mode_and_symlink(self):
        self.tasks(("plan", {"outputs": ["plan.md", "new.bin", "script.sh", "link"]}),
                   ("independent", {}))
        result = self.invoke({"plan": "mixed-blocked"}, max_tasks=2)
        self.assertEqual(result.returncode, 0, result.stderr)
        item = self.state()["blocked"][0]
        archive = Path(item["archive"])
        self.assertEqual(json.loads((archive / "manifest.json").read_text())["plan.md"], "deleted")
        with tarfile.open(archive / "files.tar") as tar:
            self.assertEqual(tar.extractfile("new.bin").read(), b"\x00\xff\x01")
            self.assertEqual(tar.getmember("script.sh").mode, 0o755)
            self.assertTrue(tar.getmember("link").issym())
            self.assertEqual(tar.getmember("link").linkname, "new.bin")
        self.git("stash", "apply", item["stash"])
        self.assertFalse((self.root / "plan.md").exists())
        self.assertEqual((self.root / "new.bin").read_bytes(), b"\x00\xff\x01")
        self.assertTrue((self.root / "link").is_symlink())

    def test_task_limit_retains_pending_after_blocker(self):
        self.tasks(("plan", {}), ("dependent", {"depends_on": ["plan"]}), ("next", {}))
        result = self.invoke({"plan": "work-blocked"}, max_tasks=1)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.state()["status"], "task-limit")
        self.assertEqual(self.state()["pending"], ["next"])
        self.assertEqual([x["task"] for x in self.state()["waiting"]], ["dependent"])

    def test_invalid_dependencies_rejected_before_model(self):
        for deps in (["missing"], ["plan"], "other"):
            with self.subTest(deps=deps):
                self.tasks(("plan", {"depends_on": deps}))
                self.assertEqual(self.invoke().returncode, 2)
                self.assertFalse(self.logs.exists())
        self.tasks(("plan", {"depends_on": ["second"]}), ("second", {"depends_on": ["plan"]}))
        self.assertEqual(self.invoke().returncode, 2)
        self.assertFalse(self.logs.exists())

    def test_forward_dependency_is_run_before_consumer(self):
        self.tasks(("consumer", {"depends_on": ["producer"], "sources": ["producer.md"]}),
                   ("producer", {}))
        result = self.invoke(max_tasks=2)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([x["task"] for x in self.state()["completed"]], ["producer", "consumer"])

    def test_retry_after_earlier_blocker_keeps_archive_and_skips_author(self):
        self.tasks(("plan", {}), ("second", {}), ("third", {}))
        self.assertEqual(self.invoke({"plan": "work-blocked", "second": "review-cli-error"},
                                     max_tasks=3).returncode, 1)
        previous = self.logs
        old_journal = (previous / "journal.jsonl").read_bytes()
        archive = self.state()["blocked"][0]["archive"]
        self.logs = self.base / "retry"
        result = self.invoke({"second": "must-not-repeat-author"}, previous=previous, max_tasks=3)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.state()["status"], "completed-with-blockers")
        self.assertEqual([x["task"] for x in self.state()["completed"]], ["second", "third"])
        self.assertEqual(self.state()["blocked"][0]["archive"], archive)
        self.assertEqual((previous / "journal.jsonl").read_bytes(), old_journal)

    def test_failed_isolation_stops_before_next_task_and_keeps_archive(self):
        self.tasks(("plan", {}), ("independent", {}))
        git_wrapper = self.bin / "git"
        real_git = shutil.which("git")
        git_wrapper.write_text("#!/usr/bin/env python3\nimport os, sys\n"
                               "if sys.argv[1:3] == ['stash', 'push']: sys.exit(72)\n"
                               f"os.execv({real_git!r}, [{real_git!r}, *sys.argv[1:]])\n")
        git_wrapper.chmod(0o755)
        result = self.invoke({"plan": "work-blocked"}, max_tasks=2)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertEqual(self.state()["status"], "stopped")
        self.assertEqual((self.base / "calls").read_text(), "plan:work\n")
        self.assertEqual((self.root / "plan.md").read_text(), "prepared\n")
        archive = Path(self.state()["blocked"][0]["archive"])
        with tarfile.open(archive / "files.tar") as tar:
            self.assertEqual(tar.extractfile("plan.md").read(), b"prepared\n")

    def test_all_blocked_finishes_truthfully_without_commits(self):
        self.tasks(("plan", {}), ("second", {}))
        result = self.invoke({"plan": "work-blocked", "second": "reject"}, max_tasks=2)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.state()["status"], "completed-with-blockers")
        self.assertEqual(self.state()["completed"], [])
        self.assertEqual(self.state()["pending"], [])
        self.assertEqual(self.git("rev-parse", "HEAD"), self.baseline)
        self.assertFalse(self.git("status", "--porcelain"))

    def test_removed_source_blocks_consumer_without_calling_model(self):
        self.tasks(("plan", {}), ("reader", {"sources": ["plan.md"]}), ("independent", {}))
        result = self.invoke({"plan": "delete-source"}, max_tasks=3)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.state()["blocked"][0]["task"], "reader")
        self.assertEqual(self.state()["blocked"][0]["phase"], "sources")
        self.assertNotIn("reader", (self.base / "calls").read_text())
        self.assertEqual([x["task"] for x in self.state()["completed"]], ["plan", "independent"])

    def test_additional_checks_run_before_review(self):
        queue = json.loads(self.queue.read_text())
        marker = self.base / "extra-check"
        queue["tasks"][0]["checks"] = [{"cwd": ".", "argv": [sys.executable, "-c",
            "from pathlib import Path; assert Path('plan.md').read_text() == 'prepared\\n'; "
            f"assert not Path({str(self.logs / 'plan-review.json')!r}).exists(); "
            f"Path({str(marker)!r}).write_text('checked')"]}]
        self.queue.write_text(json.dumps(queue))
        result = self.invoke()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(marker.read_text(), "checked")
        self.assertTrue((self.logs / "plan-check-extra-0.stdout.log").exists())

    def test_failed_additional_check_blocks_only_its_task(self):
        self.tasks(("plan", {"checks": [{"cwd": ".", "argv": [sys.executable, "-c", "raise SystemExit(7)"]}]}),
                   ("independent", {}))
        result = self.invoke(max_tasks=2)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.state()["blocked"][0]["phase"], "checks")
        self.assertEqual([x["task"] for x in self.state()["completed"]], ["independent"])
        self.assertFalse((self.logs / "plan-review.json").exists())

    def test_failed_extra_baseline_stops_before_author(self):
        queue = json.loads(self.queue.read_text())
        queue["baseline_checks"] = [{"cwd": ".", "argv": [sys.executable, "-c", "raise SystemExit(4)"]}]
        self.queue.write_text(json.dumps(queue))
        self.assertEqual(self.invoke().returncode, 1)
        self.assertFalse((self.base / "calls").exists())

    def test_backend_without_checks_and_invalid_check_rejected(self):
        self.tasks(("plan", {"outputs": ["backend/app/example.py"]}))
        self.assertEqual(self.invoke().returncode, 2)
        for check in ({"cwd": "..", "argv": [sys.executable]},
                      {"cwd": ".", "argv": "python3"},
                      {"cwd": ".", "argv": ["missing-command-for-test"]}):
            with self.subTest(check=check):
                self.tasks(("plan", {"checks": [check]}))
                self.assertEqual(self.invoke().returncode, 2)
                self.assertFalse(self.logs.exists())

    def test_check_mutation_stops_instead_of_archiving(self):
        self.tasks(("plan", {"checks": [{"cwd": ".", "argv": [sys.executable, "-c",
            "from pathlib import Path; Path('plan.md').write_text('tampered'); raise SystemExit(1)"]}]}),
                   ("independent", {}))
        self.assertEqual(self.invoke(max_tasks=2).returncode, 1)
        self.assertEqual(self.state()["blocked"], [])
        self.assertIn("изменила", self.state()["reason"])
        self.assertEqual((self.base / "calls").read_text(), "plan:work\n")


if __name__ == "__main__":
    unittest.main(verbosity=2)
