"""Integration tests with fake Codex/npm; no network or model usage."""

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


RUNNER = Path(__file__).with_name("codex-night.py").resolve()
FAKE_CODEX = r'''#!/usr/bin/env python3
import json, os, pathlib, subprocess, sys, time
args = sys.argv[1:]
assert args[:3] == ['-a', 'never', 'exec']
assert '--json' in args and '--output-schema' in args
prompt = sys.stdin.read()
assert 'П1–П129' in prompt
mode = os.environ.get('NIGHT_TEST_MODE', '')
work = args[args.index('--sandbox') + 1] == 'workspace-write'
if work:
    if mode == 'must-not-repeat-author':
        sys.exit(55)
    pathlib.Path('plan.md').write_text('prepared\n')
    if mode == 'outside':
        pathlib.Path('unrelated.md').write_text('outside\n')
    if mode == 'timeout':
        time.sleep(30)
    if mode == 'stage':
        subprocess.check_call(['git', 'add', 'plan.md'])
    if mode == 'branch':
        subprocess.check_call(['git', 'switch', '-c', 'auto/unexpected'])
if not work and mode == 'review-writes':
    pathlib.Path('plan.md').write_text('tampered\n')
if mode == 'cli-error':
    sys.exit(12)
result = {'status': 'blocked' if not work and mode == 'reject' else 'done',
          'summary': 'test result', 'evidence': ['read plan.md']}
pathlib.Path(args[args.index('--output-last-message') + 1]).write_text(json.dumps(result))
print(json.dumps({'type': 'turn.completed', 'usage': {'input_tokens': 1}}))
'''
FAKE_NPM = r'''#!/usr/bin/env python3
import os, pathlib, sys
assert sys.argv[1:] == ['run', 'verify']
assert pathlib.Path.cwd().name == 'frontend_vue'
mode = os.environ.get('NIGHT_TEST_MODE', '')
countfile = pathlib.Path(os.environ['NIGHT_TEST_COUNT'])
count = int(countfile.read_text()) if countfile.exists() else 0
countfile.write_text(str(count + 1))
print('fake verification', count)
sys.exit(1 if mode == 'baseline-red' or (mode == 'verify-red' and count > 0) else 0)
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
                    "NIGHT_TEST_COUNT": str(self.base / "npm-count")}

    def git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.root), *args], text=True,
                                       stderr=subprocess.DEVNULL).strip()

    def invoke(self, mode="", run=True, minutes="1", previous=None):
        command = [sys.executable, str(RUNNER), "--workspace", str(self.root), "--queue", str(self.queue)]
        if run:
            command += ["--run", "--run-dir", str(self.logs), "--minutes", minutes, "--max-tasks", "1"]
        if previous:
            command += ["--retry-review", str(previous)]
        return subprocess.run(command, env={**self.env, "NIGHT_TEST_MODE": mode},
                              capture_output=True, text=True, timeout=15)

    def state(self):
        return json.loads((self.logs / "state.json").read_text())

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
        for mode in ("reject", "cli-error", "outside", "review-writes", "verify-red", "timeout", "stage", "branch"):
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
        self.assertEqual(self.invoke("reject").returncode, 1)
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
        self.assertEqual(self.invoke("reject").returncode, 1)
        previous = self.logs
        (self.root / "unrelated.txt").write_text("another session\n")
        self.logs = self.base / "retry"
        self.assertEqual(self.invoke(previous=previous).returncode, 2)
        self.assertFalse(self.logs.exists())

    def test_retry_rejects_changed_head(self):
        self.assertEqual(self.invoke("reject").returncode, 1)
        previous = self.logs
        self.git("commit", "--allow-empty", "-m", "unrelated commit")
        self.logs = self.base / "retry"
        self.assertEqual(self.invoke(previous=previous).returncode, 2)
        self.assertFalse(self.logs.exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
