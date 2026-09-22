"""Тесты слоя исполнителей: маршрутизация ролей и разбор ответов.

Модель не вызывается: Claude Code подменён скриптом, который печатает такой же JSON
сессии. Проверяется то, что ломается молча, — форма команды, разбор вывода и запрет
отдавать обе роли одному и тому же исполнителю.
"""

import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import headless_backends as backends  # noqa: E402

RUNNER = Path(__file__).with_name("codex-night.py").resolve()
_spec = importlib.util.spec_from_file_location("pilot_fixtures", Path(__file__).with_name("test_codex_night.py"))
_pilot = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_pilot)

# Печатает то же, что настоящий `claude --print --output-format json`: результат строкой
# внутри поля result. Правки файлов делает сам, как это делал бы исполнитель.
FAKE_CLAUDE = r'''#!/usr/bin/env python3
import json, os, pathlib, sys
args = sys.argv[1:]
assert args[0] == '--print' and '--output-format' in args and 'json' in args
prompt = sys.stdin.read()
assert 'evidence — всегда массив строк' in prompt, 'нет явной схемы результата'
task = json.loads(prompt.split('\nЗадание (JSON):\n', 1)[1])
role = 'review' if '--restricted' in args else 'work'
assert (role == 'review') == ('--restricted' in args)
with pathlib.Path(os.environ['NIGHT_TEST_CALLS']).open('a') as calls:
    calls.write(f"{task['id']}:{role}:claude\n")
if role == 'work':
    for name in task['outputs']:
        path = pathlib.Path(name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text('prepared\n')
mode = os.environ.get('NIGHT_TEST_MODE', '')
if mode == 'claude-prose':
    body = 'Вот результат:\n```json\n{"status": "done", "summary": "ок", "evidence": ["читал plan.md"]}\n```\n'
elif mode == 'claude-error':
    print(json.dumps({'is_error': True, 'result': 'ошибка сервиса'}))
    raise SystemExit(0)
else:
    body = json.dumps({'status': 'done', 'summary': 'ок', 'evidence': ['читал plan.md']}, ensure_ascii=False)
print(json.dumps({'type': 'result', 'is_error': False, 'result': body, 'total_cost_usd': 0.01}))
'''


class ExtractTest(unittest.TestCase):
    def test_takes_object_out_of_prose_and_fences(self):
        text = 'Вот ответ:\n```json\n{"status": "done", "summary": "a{b}", "evidence": ["x"]}\n```\nконец'
        self.assertEqual(json.loads(backends.extract_json_object(text))["summary"], "a{b}")

    def test_brace_inside_string_does_not_end_the_object(self):
        text = '{"summary": "закрыл } скобку", "nested": {"a": 1}}'
        self.assertEqual(json.loads(backends.extract_json_object(text))["nested"], {"a": 1})

    def test_escaped_quote_does_not_end_the_string(self):
        text = r'{"summary": "он сказал \"да\" }", "evidence": []}'
        self.assertEqual(json.loads(backends.extract_json_object(text))["evidence"], [])

    def test_missing_and_unclosed_objects_are_refused(self):
        for text in ("совсем без объекта", '{"status": "done"'):
            with self.assertRaises(RuntimeError):
                backends.extract_json_object(text)


class RoutingTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="routing-test-")
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "routing.json"

    def write(self, routing):
        self.path.write_text(json.dumps(routing))
        return self.path

    def test_without_file_both_roles_stay_on_codex(self):
        built = backends.load_routing(None, "/usr/bin/codex")
        self.assertEqual({role: b.name for role, b in built.items()}, {"work": "codex", "review": "codex"})
        self.assertEqual(built["work"].binary, "/usr/bin/codex")

    def test_roles_go_to_different_backends(self):
        built = backends.load_routing(self.write({"work": {"backend": "zoo", "socket": "/tmp/s"},
                                                  "review": {"backend": "claude", "model": "claude-sonnet-5"}}))
        self.assertEqual(built["work"].name, "zoo")
        self.assertEqual(built["review"].options["model"], "claude-sonnet-5")

    def test_same_backend_and_options_for_both_roles_is_refused(self):
        # Политика прогона: приёмку делает не тот, кто писал.
        with self.assertRaises(ValueError):
            backends.load_routing(self.write({"work": {"backend": "claude", "model": "m"},
                                              "review": {"backend": "claude", "model": "m"}}))

    def test_same_backend_with_different_models_is_allowed(self):
        built = backends.load_routing(self.write({"work": {"backend": "claude", "model": "a"},
                                                  "review": {"backend": "claude", "model": "b"}}))
        self.assertEqual(built["work"].name, built["review"].name)

    def test_unknown_backend_and_missing_role_are_refused(self):
        for routing in ({"work": {"backend": "нет"}, "review": {"backend": "codex"}},
                        {"work": {"backend": "codex"}}):
            with self.assertRaises(ValueError):
                backends.load_routing(self.write(routing))


class CommandTest(unittest.TestCase):
    def test_reviewer_on_claude_cannot_run_commands_or_write(self):
        argv = backends.ClaudeBackend({}).build("review", Path("/repo"), Path("/run"), Path("/run/r.json"))
        self.assertIn("--restricted", argv)
        self.assertEqual(argv[argv.index("--disallowedTools") + 1:], ["Write", "Edit", "NotebookEdit"])
        self.assertNotIn("--permission-mode", argv)

    def test_author_on_claude_gets_write_access(self):
        argv = backends.ClaudeBackend({}).build("work", Path("/repo"), Path("/run"), Path("/run/r.json"))
        self.assertEqual(argv[argv.index("--permission-mode") + 1], "bypassPermissions")
        self.assertNotIn("--restricted", argv)

    def test_zoo_without_live_socket_is_refused(self):
        with self.assertRaises(ValueError):
            backends.ZooBackend({"socket": "/tmp/нет-такого.sock"}).check()

    def test_zoo_passes_configuration_and_result_path(self):
        argv = backends.ZooBackend({"socket": "/tmp/s", "configuration": {"apiProvider": "deepseek"}}).build(
            "work", Path("/repo"), Path("/run"), Path("/run/r.json"))
        self.assertEqual(argv[argv.index("--result") + 1], "/run/r.json")
        self.assertEqual(json.loads(argv[argv.index("--config") + 1]), {"apiProvider": "deepseek"})


class MixedRunTest(unittest.TestCase):
    """Прогон целиком: автор на Claude Code, приёмка на Codex."""

    def setUp(self):
        _pilot.PilotTest.setUp(self)
        claude = self.bin / "claude"
        claude.write_text(FAKE_CLAUDE)
        claude.chmod(0o755)
        self.routing = self.base / "routing.json"
        self.routing.write_text(json.dumps({"work": {"backend": "claude", "binary": str(claude)},
                                            "review": {"backend": "codex", "binary": str(self.bin / "codex")}}))

    git = _pilot.PilotTest.git
    state = _pilot.PilotTest.state

    def invoke(self, mode="", run=True):
        command = [sys.executable, str(RUNNER), "--workspace", str(self.root), "--queue", str(self.queue),
                   "--routing", str(self.routing)]
        if run:
            command += ["--run", "--run-dir", str(self.logs), "--minutes", "1", "--max-tasks", "1"]
        return subprocess.run(command, env={**self.env, "NIGHT_TEST_MODE": mode},
                              capture_output=True, text=True, timeout=30)

    def test_author_on_claude_is_accepted_by_codex_and_committed(self):
        result = self.invoke()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.state()["status"], "completed")
        self.assertNotEqual(self.git("rev-parse", "HEAD"), self.baseline)
        self.assertEqual((self.base / "calls").read_text().splitlines(),
                         ["plan:work:claude", "plan:review"])
        self.assertEqual(json.loads((self.logs / "backends.json").read_text())["work"]["backend"], "claude")

    def test_prose_around_the_object_still_yields_a_valid_result(self):
        self.assertEqual(self.invoke("claude-prose").returncode, 0)
        self.assertEqual(json.loads((self.logs / "plan-work.json").read_text())["status"], "done")

    def test_service_error_from_claude_stops_the_task(self):
        result = self.invoke("claude-error")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.git("rev-parse", "HEAD"), self.baseline)

    def test_preflight_names_both_backends(self):
        result = self.invoke(run=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("work=claude, review=codex", result.stdout)


if __name__ == "__main__":
    unittest.main()
