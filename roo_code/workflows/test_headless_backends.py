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
mode = os.environ.get('NIGHT_TEST_MODE', '')
if role == 'work':
    body = {'links-keep-broken': 'БИТАЯ ссылка досталась по наследству\nновый вердикт\n',
            'links-add-broken': 'БИТАЯ ссылка досталась по наследству\nи БИТАЯ своя\n',
            'links-no-report': 'новый вердикт\n'}.get(mode, 'prepared\n')
    for name in task['outputs']:
        path = pathlib.Path(name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body)
if mode == 'claude-prose':
    body = 'Вот результат:\n```json\n{"status": "done", "summary": "ок", "evidence": ["читал plan.md"]}\n```\n'
elif mode == 'claude-error':
    print(json.dumps({'is_error': True, 'result': 'ошибка сервиса'}))
    raise SystemExit(0)
else:
    body = json.dumps({'status': 'done', 'summary': 'ок', 'evidence': ['читал plan.md']}, ensure_ascii=False)
printed = {'type': 'result', 'is_error': False, 'result': body, 'total_cost_usd': 0.01}
if mode != 'no-usage':
    per_call = int(os.environ.get('NIGHT_TEST_TOKENS', '1000'))
    printed['modelUsage'] = {'claude-test': {'inputTokens': per_call, 'outputTokens': 0,
                                             'cacheCreationInputTokens': 0, 'cacheReadInputTokens': 0}}
print(json.dumps(printed))
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


# Считает битые ссылки так же, как настоящий резолвер печатает их в отчёте:
# одна строка «[ссылки] … битых N». Битой считается пометка в самом документе,
# поэтому тест управляет счётом содержимым файла, а не подсказкой снаружи.
FAKE_VITEST = r'''#!/usr/bin/env python3
import os, pathlib
if os.environ.get('NIGHT_TEST_MODE') == 'links-no-report':
    print('прогон без отчёта')
    raise SystemExit(0)
doc = pathlib.Path('..') / os.environ['CONTRACT_REFS']
broken = doc.read_text().count('БИТАЯ')
print(f'[ссылки] документов 1 · ссылок 5 · битых {broken}')
'''


class LinkGateTest(unittest.TestCase):
    """Проверка ссылок судит разницу, а не весь файл.

    Живой прогон 2026-09-22 заблокировал честную работу за ссылку, которая была
    битой до автора: строгая проверка судила документ целиком. Правильный критерий —
    «битых не стало больше».
    """

    def setUp(self):
        _pilot.PilotTest.setUp(self)
        claude = self.bin / "claude"
        claude.write_text(FAKE_CLAUDE)
        claude.chmod(0o755)
        resolver = self.root / "frontend_vue/src/services/contractRefs.spec.ts"
        resolver.parent.mkdir(parents=True, exist_ok=True)
        resolver.write_text("// резолвер ссылок\n")
        vitest = self.root / "frontend_vue/node_modules/.bin/vitest"
        vitest.parent.mkdir(parents=True, exist_ok=True)
        vitest.write_text(FAKE_VITEST)
        vitest.chmod(0o755)
        # В документе уже есть одна битая ссылка — чужая, до всякой задачи.
        (self.root / "plan.md").write_text("БИТАЯ ссылка досталась по наследству\n")
        self.git("add", "-A")
        self.git("commit", "-m", "документ с унаследованной битой ссылкой")
        self.baseline = self.git("rev-parse", "HEAD")
        self.routing = self.base / "routing.json"
        self.routing.write_text(json.dumps({"work": {"backend": "claude", "binary": str(claude)},
                                            "review": {"backend": "codex", "binary": str(self.bin / "codex")}}))

    git = _pilot.PilotTest.git
    state = _pilot.PilotTest.state

    def invoke(self, mode):
        command = [sys.executable, str(RUNNER), "--workspace", str(self.root), "--queue", str(self.queue),
                   "--routing", str(self.routing), "--run", "--run-dir", str(self.logs),
                   "--minutes", "1", "--max-tasks", "1"]
        return subprocess.run(command, env={**self.env, "NIGHT_TEST_MODE": mode},
                              capture_output=True, text=True, timeout=30)

    def test_inherited_broken_link_does_not_block_the_task(self):
        result = self.invoke("links-keep-broken")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.state()["status"], "completed")
        self.assertNotEqual(self.git("rev-parse", "HEAD"), self.baseline)
        self.assertEqual((self.root / "plan.md").read_text().count("БИТАЯ"), 1)

    def test_new_broken_link_blocks_the_task(self):
        result = self.invoke("links-add-broken")
        self.assertEqual(result.returncode, 0, result.stderr)
        blocked = self.state()["blocked"]
        self.assertEqual(len(blocked), 1)
        self.assertIn("битых ссылок стало больше", blocked[0]["reason"])
        self.assertIn("было 1, стало 2", blocked[0]["reason"])
        self.assertEqual(self.git("rev-parse", "HEAD"), self.baseline)
        self.assertFalse(self.git("status", "--porcelain"))

    def test_missing_link_report_stops_the_run_without_commit(self):
        result = self.invoke("links-no-report")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.git("rev-parse", "HEAD"), self.baseline)


class TokenCountTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="tokens-test-")
        self.addCleanup(self.temp.cleanup)
        self.prefix = Path(self.temp.name) / "call"

    def write(self, usage):
        self.prefix.with_suffix(".stdout.log").write_text(json.dumps({"modelUsage": usage}))
        return backends.ClaudeBackend({}).tokens(self.prefix)

    def test_cache_reads_are_not_counted(self):
        # Замер 2026-09-23: 33.8 млн чтения кэша сдвинули недельный лимит на 0.
        counted = self.write({"m": {"inputTokens": 10, "outputTokens": 3,
                                    "cacheCreationInputTokens": 7, "cacheReadInputTokens": 1_000_000}})
        self.assertEqual(counted, 20)

    def test_several_models_add_up(self):
        self.assertEqual(self.write({"a": {"inputTokens": 5, "outputTokens": 1,
                                           "cacheCreationInputTokens": 0, "cacheReadInputTokens": 9},
                                     "b": {"inputTokens": 2, "outputTokens": 2,
                                           "cacheCreationInputTokens": 1, "cacheReadInputTokens": 9}}), 11)

    def test_output_without_accounting_is_refused(self):
        with self.assertRaises(RuntimeError):
            self.write({})


class BudgetTest(unittest.TestCase):
    """Потолок токенов: он защищает недельный лимит, поэтому обязан срабатывать.

    Считается расход только тех бэкендов, что идут в счёт (claude): Codex и DeepSeek
    оплачиваются отдельно. Проверка между задачами, значит превышение возможно не
    больше чем на одну задачу — это поведение и закреплено тестом.
    """

    def setUp(self):
        _pilot.PilotTest.setUp(self)
        claude = self.bin / "claude"
        claude.write_text(FAKE_CLAUDE)
        claude.chmod(0o755)
        self.queue.write_text(json.dumps({"tasks": [
            {"id": "one", "sources": ["plan.md"], "outputs": ["plan.md"], "task": "первая"},
            {"id": "two", "sources": ["plan.md"], "outputs": ["plan2.md"], "task": "вторая"}]}))
        self.routing = self.base / "routing.json"
        self.routing.write_text(json.dumps({"work": {"backend": "claude", "binary": str(claude)},
                                            "review": {"backend": "codex", "binary": str(self.bin / "codex")}}))

    git = _pilot.PilotTest.git
    state = _pilot.PilotTest.state

    def invoke(self, budget=None, tokens="1000", mode=""):
        command = [sys.executable, str(RUNNER), "--workspace", str(self.root), "--queue", str(self.queue),
                   "--routing", str(self.routing), "--run", "--run-dir", str(self.logs),
                   "--minutes", "1", "--max-tasks", "2"]
        if budget is not None:
            command += ["--token-budget", str(budget)]
        return subprocess.run(command, env={**self.env, "NIGHT_TEST_TOKENS": tokens, "NIGHT_TEST_MODE": mode},
                              capture_output=True, text=True, timeout=30)

    def test_budget_room_lets_both_tasks_through(self):
        result = self.invoke(budget=100000)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.state()["status"], "completed")
        self.assertEqual(len(self.state()["completed"]), 2)

    def test_exhausted_budget_stops_before_the_next_task(self):
        result = self.invoke(budget=1000, tokens="1000")
        self.assertEqual(result.returncode, 0, result.stderr)
        state = self.state()
        self.assertEqual(state["status"], "token-budget")
        self.assertEqual(len(state["completed"]), 1)
        self.assertEqual(state["tokens"], 1000)
        self.assertIn("Потолок токенов исчерпан: 1000 из 1000", state["reason"])
        # Работа первой задачи принята и осталась — потолок не откатывает сделанное.
        self.assertNotEqual(self.git("rev-parse", "HEAD"), self.baseline)
        self.assertFalse(self.git("status", "--porcelain"))

    def test_budget_left_smaller_than_a_seen_task_stops_early(self):
        # Ночь 2026-09-23 перебрала потолок на 20%: остаток был положительный, но
        # задача стоила впятеро больше остатка. Теперь такой задачи не начинают.
        result = self.invoke(budget=1500, tokens="1000")
        self.assertEqual(result.returncode, 0, result.stderr)
        state = self.state()
        self.assertEqual(state["status"], "token-budget")
        self.assertEqual(state["tokens"], 1000)
        self.assertEqual(len(state["completed"]), 1)
        self.assertIn("Остатка не хватит на задачу: 500 из 1500", state["reason"])

    def test_run_without_budget_ignores_tokens(self):
        result = self.invoke(budget=None, tokens="999999")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.state()["status"], "completed")

    def test_output_without_token_accounting_stops_the_run(self):
        # Ноль вместо неизвестного расхода — это потолок, который никогда не сработает.
        result = self.invoke(budget=1000, mode="no-usage")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.state()["status"], "stopped")
        self.assertIn("нет учёта токенов", self.state()["reason"])

    def test_unmetered_backend_does_not_fill_the_budget(self):
        self.routing.write_text(json.dumps({"work": {"backend": "codex", "binary": str(self.bin / "codex")},
                                            "review": {"backend": "claude", "binary": str(self.bin / "claude")}}))
        # Потолок с запасом: смысл теста — что автор на Codex в счёт не идёт,
        # а не то, как потолок смотрит вперёд (это проверяет соседний тест).
        result = self.invoke(budget=5000, tokens="1000")
        self.assertEqual(result.returncode, 0, result.stderr)
        # Две приёмки на Claude по 1000; авторы на Codex не в счёт. Число снято
        # ПОСЛЕ последней задачи: раньше оно отставало на задачу, и супервизор по
        # нему начинал лишнюю порцию сверх потолка.
        self.assertEqual(self.state()["tokens"], 2000)
        self.assertEqual(len(self.state()["completed"]), 2)


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

    def test_reviewer_gets_the_diff_and_check_logs_in_the_prompt(self):
        # У проверяющего уходило 27-42 хода, половина — поиск того, что уже лежит
        # у контроллера. Дифф и хвосты проверок теперь приходят вместе с заданием.
        self.assertEqual(self.invoke().returncode, 0)
        prompt = (self.logs / "plan-review.prompt.txt").read_text()
        self.assertIn("=== Дифф работы (git diff HEAD) ===", prompt)
        self.assertIn("+prepared", prompt)
        self.assertIn("=== Хвосты машинных проверок ===", prompt)
        self.assertIn("fake verification", prompt)
        self.assertIn("Полные логи (включая stderr):", prompt)

    def test_author_is_told_how_a_reference_proves_anything(self):
        # Четыре задачи из восьми за 2026-09-23 забракованы за ссылки, которые ничего
        # не доказывают. Правило ушло автору, а не только в голову скептику.
        self.assertEqual(self.invoke().returncode, 0)
        prompt = (self.logs / "plan-work.prompt.txt").read_text()
        self.assertIn("обязана нести в том же предложении токен в бэктиках", prompt)
        self.assertIn("опровергнутое твоим же диффом", prompt)
        # Новые ссылки с номерами — единственная оставшаяся причина брака после того,
        # как перенумерацию забрал контроллер.
        self.assertIn("НОВЫХ ссылок с номерами строк не вводи", prompt)

    def test_author_prompt_carries_no_diff(self):
        # Автору дифф не нужен: он его и создаёт.
        self.assertEqual(self.invoke().returncode, 0)
        self.assertNotIn("=== Дифф работы", (self.logs / "plan-work.prompt.txt").read_text())

    def test_preflight_names_both_backends(self):
        result = self.invoke(run=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("work=claude, review=codex", result.stdout)


if __name__ == "__main__":
    unittest.main()
