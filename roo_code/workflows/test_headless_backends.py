"""Тесты слоя исполнителей: маршрутизация ролей и разбор ответов.

Модель не вызывается: Claude Code подменён скриптом, который печатает такой же JSON
сессии. Проверяется то, что ломается молча, — форма команды, разбор вывода и запрет
отдавать обе роли одному и тому же исполнителю.
"""

import importlib.util
import json
import os
import signal
from pathlib import Path
import subprocess
import sys
import tempfile
import time
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


# Подменяет питон окружения aider для обёртки: получает `aider-agent.py <config>` и
# оставляет в checkout то же, что настоящий aider, — кэш карты в корне и пустые заготовки
# под новые outputs. Решения самого драйвера проверяет AiderDriverTest на настоящей
# библиотеке. Режим — AIDER_TEST_MODE.
FAKE_AIDER = r"""#!/usr/bin/env python3
import json, os, pathlib, sys
agent, config_path = sys.argv[1:3]
assert agent.endswith('aider-agent.py'), agent
config = json.loads(pathlib.Path(config_path).read_text())
pathlib.Path(os.environ['NIGHT_TEST_CALLS']).open('a').write('aider ' + json.dumps(config) + '\n')
assert 'Задание (JSON):' in pathlib.Path(config['message']).read_text()
pathlib.Path(config['chat_history']).write_text('# чат\n')
cache = pathlib.Path('.aider.tags.cache.v4')
cache.mkdir(exist_ok=True)
(cache / 'cache.db').write_text('x')
for name in config['outputs']:
    pathlib.Path(name).parent.mkdir(parents=True, exist_ok=True)
    pathlib.Path(name).touch()   # как utils.touch_file у настоящего aider
mode = os.environ.get('AIDER_TEST_MODE', '')
if mode == 'fail':
    raise SystemExit(3)
if mode == 'auth':
    # Так 0.86.2 отвечает на неверный ключ: печатает ошибку и работает дальше.
    print('litellm.AuthenticationError: AuthenticationError: DeepseekException - Authentication Fails')
    raise SystemExit(0)
if mode != 'no-edit':
    for name in config['outputs']:
        pathlib.Path(name).write_text('prepared by aider\n')
if mode == 'outside':
    pathlib.Path('unrelated.md').write_text('чужое\n')
pathlib.Path(config['stats']).write_text(json.dumps({'checks_green': None, 'checks_runs': 0}))
"""


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

    def test_reviewer_on_claude_can_read_the_check_logs(self):
        # Логи проверок лежат в run_dir, вне checkout, а --restricted пускает файловые
        # инструменты только в каталоги --add-dir. Промпт велит их прочитать.
        argv = backends.ClaudeBackend({}).build("review", Path("/repo"), Path("/run"), Path("/run/r.json"))
        dirs = [argv[i + 1] for i, a in enumerate(argv) if a == "--add-dir"]
        self.assertEqual(dirs, ["/repo", "/run"])

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


class AiderRunTest(unittest.TestCase):
    """Прогон целиком: автор на aider, приёмка на Codex."""

    def setUp(self):
        _pilot.PilotTest.setUp(self)
        aider = self.bin / "aider"
        aider.write_text(FAKE_AIDER)
        aider.chmod(0o755)
        self.routing = self.base / "routing.json"
        self.routing.write_text(json.dumps({
            "work": {"backend": "aider", "binary": str(aider), "python": str(aider),
                     "model": "deepseek/deepseek-chat"},
            "review": {"backend": "codex", "binary": str(self.bin / "codex")}}))

    git = _pilot.PilotTest.git
    state = _pilot.PilotTest.state

    def invoke(self, mode=""):
        command = [sys.executable, str(RUNNER), "--workspace", str(self.root), "--queue", str(self.queue),
                   "--routing", str(self.routing), "--run", "--run-dir", str(self.logs),
                   "--minutes", "1", "--max-tasks", "1"]
        return subprocess.run(command, env={**self.env, "AIDER_TEST_MODE": mode},
                              capture_output=True, text=True, timeout=30)

    def aider_config(self):
        line = next(x for x in (self.base / "calls").read_text().splitlines() if x.startswith("aider "))
        return json.loads(line[len("aider "):])

    def test_author_on_aider_is_accepted_and_only_the_task_is_committed(self):
        result = self.invoke()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.state()["status"], "completed", self.state())
        # В коммит попала задача и ничего больше — ни кэша карты, ни истории чата.
        self.assertEqual(self.git("show", "--name-only", "--format=", "HEAD"), "plan.md")
        self.assertEqual((self.root / "plan.md").read_text(), "prepared by aider\n")
        self.assertFalse(list(self.root.glob(".aider*")))
        self.assertFalse(self.git("status", "--porcelain"))
        work = json.loads((self.logs / "plan-work.json").read_text())
        self.assertEqual(work["status"], "done")
        self.assertIn("изменён plan.md", work["evidence"])
        self.assertTrue((self.logs / "plan-work.aider.chat.md").is_file())

    def test_outputs_are_editable_and_sources_read_only(self):
        self.queue.write_text(json.dumps({"tasks": [{"id": "plan", "sources": ["plan.md"],
                                                     "outputs": ["docs/new.md"], "task": "prepare"}]}))
        result = self.invoke()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.root / "docs/new.md").read_text(), "prepared by aider\n")
        config = self.aider_config()
        self.assertEqual(config["outputs"], ["docs/new.md"])
        self.assertEqual(config["sources"], ["plan.md"])
        self.assertEqual(config["model"], "deepseek/deepseek-chat")

    def test_no_edit_blocks_the_task_and_leaves_no_empty_files(self):
        self.queue.write_text(json.dumps({"tasks": [{"id": "plan", "sources": ["plan.md"],
                                                     "outputs": ["docs/new.md"], "task": "prepare"}]}))
        result = self.invoke("no-edit")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([b["task"] for b in self.state()["blocked"]], ["plan"])
        self.assertIn("не изменил ни одного файла", self.state()["blocked"][0]["reason"])
        # Пустая заготовка, которую aider создаёт под --file, не остаётся в дереве.
        self.assertFalse((self.root / "docs/new.md").exists())
        self.assertEqual(self.git("rev-parse", "HEAD"), self.baseline)
        self.assertFalse(self.git("status", "--porcelain"))

    def test_aider_failure_blocks_the_task_not_the_night(self):
        result = self.invoke("fail")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("кодом 3", self.state()["blocked"][0]["reason"])
        self.assertEqual(self.git("rev-parse", "HEAD"), self.baseline)
        self.assertFalse(self.git("status", "--porcelain"))

    def test_edit_format_defaults_to_diff(self):
        # Незнакомое имя модели aider встречает форматом whole — файл целиком в ответ.
        self.assertEqual(self.invoke().returncode, 0)
        self.assertEqual(self.aider_config()["edit_format"], "diff")
        # Свой потолок aider — 8192 токена истории; в агентском цикле это два-три вывода.
        self.assertEqual(self.aider_config()["history_tokens"], 65536)
        # Потолки — решение владельца: 100 ходов, 60 минут на команду и на проверку.
        self.assertEqual({k: self.aider_config()[k] for k in ("max_reflections", "command_timeout", "check_timeout")},
                         {"max_reflections": 100, "command_timeout": 3600, "check_timeout": 3600})

    def test_parallel_authors_on_aider_each_get_their_worktree(self):
        self.queue.write_text(json.dumps({"tasks": [
            {"id": "alpha", "sources": ["plan.md"], "outputs": ["plan.md"], "task": "prepare"},
            {"id": "beta", "sources": ["plan.md"], "outputs": ["plan2.md"], "task": "prepare"}]}))
        command = [sys.executable, str(RUNNER), "--workspace", str(self.root), "--queue", str(self.queue),
                   "--routing", str(self.routing), "--run", "--run-dir", str(self.logs),
                   "--minutes", "2", "--max-tasks", "2", "--parallel", "2"]
        result = subprocess.run(command, env=self.env, capture_output=True, text=True, timeout=60)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(sorted(x["task"] for x in self.state()["completed"]), ["alpha", "beta"], self.state())
        roots = {json.loads(x[len("aider "):])["root"] for x in (self.base / "calls").read_text().splitlines()
                 if x.startswith("aider ")}
        self.assertEqual(len(roots), 2)   # каждый автор — в своём worktree
        self.assertNotIn(str(self.root.resolve()), roots)
        self.assertFalse(list(self.root.glob(".aider*")))
        self.assertFalse(self.git("status", "--porcelain"))

    def test_model_error_with_exit_zero_is_named_in_the_reason(self):
        result = self.invoke("auth")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("AuthenticationError", self.state()["blocked"][0]["reason"])

    def test_edit_outside_outputs_is_blocked_by_the_core(self):
        result = self.invoke("outside")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("вне задачи", self.state()["blocked"][0]["reason"])
        self.assertFalse((self.root / "unrelated.md").exists())
        self.assertEqual(self.git("rev-parse", "HEAD"), self.baseline)


class AiderRoutingTest(unittest.TestCase):
    def test_aider_cannot_review(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "routing.json"
            path.write_text(json.dumps({"work": {"backend": "claude"},
                                        "review": {"backend": "aider", "model": "deepseek/deepseek-chat"}}))
            with self.assertRaises(ValueError):
                backends.load_routing(path)

    def test_ceilings_from_the_routing_reach_the_runner(self):
        argv = backends.AiderBackend({"model": "deepseek/deepseek-chat", "max_reflections": 7,
                                      "command_timeout": 11, "check_timeout": 13, "history_tokens": 17,
                                      "edit_format": "whole", "timeout_seconds": 19}).build(
            "work", Path("/r"), Path("/d"), Path("/d/t.json"))
        pairs = dict(zip(argv, argv[1:]))
        self.assertEqual({k: pairs[k] for k in ("--max-reflections", "--command-timeout", "--check-timeout",
                                                "--history-tokens", "--edit-format", "--timeout")},
                         {"--max-reflections": "7", "--command-timeout": "11", "--check-timeout": "13",
                          "--history-tokens": "17", "--edit-format": "whole", "--timeout": "19"})

    def test_aider_without_model_is_refused_on_preflight(self):
        with self.assertRaises(ValueError):
            backends.AiderBackend({"binary": sys.executable}).check()


_agent_spec = importlib.util.spec_from_file_location("aider_agent", Path(__file__).with_name("aider-agent.py"))
aider_agent = importlib.util.module_from_spec(_agent_spec)
_agent_spec.loader.exec_module(aider_agent)


class GitFilterTest(unittest.TestCase):
    """Фильтр команд автора на формах, которые реально встречались в сессиях Zoo Code."""

    def test_read_only_forms_from_zoo_sessions_pass(self):
        for command in ("git -C /home/x/repo diff --stat", "git --no-pager diff -- a.ts",
                        "cd frontend_vue && git --no-pager diff --stat && echo '---'",
                        "git check-ignore -v frontend_vue/node_modules", "git show HEAD:frontend_vue/a.ts | head",
                        "git log --oneline -5", "grep -rn git README.md", "git -c core.pager=cat log -1"):
            self.assertIsNone(aider_agent.command_refusal(command), command)

    def test_cleanup_of_stubborn_groups_fits_the_core_kill_window(self):
        """Ядро шлёт SIGTERM и через 5 с SIGKILL. Уборка трёх групп, глухих к SIGTERM, обязана
        уложиться раньше, иначе её прервут и часть процессов переживёт задачу."""
        procs = [subprocess.Popen(["bash", "-c", "trap '' TERM; exec sleep 300"], start_new_session=True)
                 for _ in range(3)]
        time.sleep(0.3)
        aider_agent.GROUPS.update(p.pid for p in procs)
        started = time.monotonic()
        aider_agent.kill_groups()
        self.assertLess(time.monotonic() - started, 4.5)
        for proc in procs:
            self.assertIsNotNone(proc.wait(timeout=2))
        self.assertEqual(aider_agent.GROUPS, set())

    def test_writing_git_is_refused_wherever_it_hides(self):
        for command in ("git commit -am x", "git -C /home/x/repo add .", "cd a; git stash",
                        "echo x && git checkout -- f", "ls | xargs git rm", "git", "python3 roo_code/workflows/refs_shift.py --fix"):
            self.assertIsNotNone(aider_agent.command_refusal(command), command)

    def test_git_guard_decides_on_the_parsed_command(self):
        for args in (["add", "."], ["-C", "/x", "commit", "-m", "y"], ["--git-dir=.git", "stash"], ["-c", "a=b", "reset"]):
            self.assertIsNotNone(aider_agent.guard_refusal(args), args)
        for args in (["--no-pager", "diff"], ["-C", "/x", "status"], ["-c", "core.pager=cat", "log", "-1"], ["--version"]):
            self.assertIsNone(aider_agent.guard_refusal(args), args)

AIDER_PYTHON = Path.home() / ".local/share/uv/tools/aider-chat/bin/python"
AIDER_RUNNER = Path(__file__).with_name("aider-runner.py").resolve()
# Питон aider с подменённой моделью: ответы берутся по порядку из AIDER_TEST_SCRIPT,
# каждый запрос к модели пишется строкой в AIDER_TEST_LLM_LOG. Всё остальное — настоящий
# aider: разбор правок, вопросы, карта репозитория, запуск команд.
HARNESS = r"""#!{python}
import importlib.util, json, os, sys
import litellm
script = json.load(open(os.environ['AIDER_TEST_SCRIPT']))
log = os.environ['AIDER_TEST_LLM_LOG']
real = litellm.completion
def fake(**kwargs):
    with open(log, 'a') as stream:
        stream.write(json.dumps(kwargs['messages'], ensure_ascii=False) + '\n')
    turn = sum(1 for _ in open(log)) - 1
    reply = script[turn] if turn < len(script) else 'Готово.'
    return real(**{{**kwargs, 'mock_response': reply}})
litellm.completion = fake
spec = importlib.util.spec_from_file_location('agent', sys.argv[1])
agent = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent)
sys.exit(agent.main(sys.argv[2]))
"""


def edit(path, search, replace):
    return f"{path}\n```\n<<<<<<< SEARCH\n{search}\n=======\n{replace}\n>>>>>>> REPLACE\n```\n"


@unittest.skipUnless(AIDER_PYTHON.is_file(), "aider не установлен: uv tool install aider-chat")
class AiderDriverTest(unittest.TestCase):
    """Решения драйвера на настоящем aider 0.86 — без сети, модель подменена сценарием."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="aider-driver-")
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / "repo"
        self.root.mkdir()
        (self.root / "calc.py").write_text("def add(a, b):\n    return a - b\n")
        (self.root / "other.py").write_text("VALUE = 1\n")
        (self.root / "helper.py").write_text("MAGIC_NUMBER = 42\n")
        (self.root / "notes.md").write_text("Число: ?\n")
        for args in (("init", "-q", "-b", "auto/t"), ("add", "."),
                     ("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "base")):
            subprocess.run(["git", "-C", str(self.root), *args], check=True)
        self.head, self.index = self.git("rev-parse", "HEAD"), self.git("write-tree")
        self.run_dir = self.base / "run"
        self.run_dir.mkdir()
        self.harness = self.base / "aider-python"
        self.harness.write_text(HARNESS.format(python=AIDER_PYTHON))
        self.harness.chmod(0o755)

    def git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.root), *args], text=True).strip()

    def drive(self, script, outputs, checks=(), sources=(), text="Задача.", **options):
        (self.base / "script.json").write_text(json.dumps(script, ensure_ascii=False))
        task = {"id": "t", "outputs": list(outputs), "sources": list(sources), "checks": list(checks),
                "task": "по сценарию"}
        argv = [sys.executable, str(AIDER_RUNNER), "--python", str(self.harness), "--binary", str(self.harness),
                "--model", "deepseek/deepseek-chat", "--root", str(self.root),
                "--result", str(self.run_dir / "t-work.json"), "--timeout", "120"]
        for key, value in options.items():
            argv += ["--" + key.replace("_", "-"), str(value)]
        started = time.monotonic()
        subprocess.run(argv, input=text + "\nЗадание (JSON):\n" + json.dumps(task, ensure_ascii=False),
                       text=True, cwd=self.root, timeout=150, check=True,
                       env={**os.environ, "AIDER_TEST_SCRIPT": str(self.base / "script.json"),
                            "AIDER_TEST_LLM_LOG": str(self.base / "llm.jsonl"),
                            "DEEPSEEK_API_KEY": "test"})
        self.elapsed = time.monotonic() - started
        result = json.loads((self.run_dir / "t-work.json").read_text())
        stats_path = self.run_dir / "t-work.aider.stats.json"
        stats = json.loads(stats_path.read_text()) if stats_path.is_file() else {}
        return result, stats

    def prompts(self):
        return [json.dumps(json.loads(line), ensure_ascii=False)
                for line in (self.base / "llm.jsonl").read_text().splitlines()]

    def assertGitUntouched(self):
        self.assertEqual(self.git("rev-parse", "HEAD"), self.head)
        self.assertEqual(self.git("write-tree"), self.index, "индекс Git изменён — ядро остановило бы ночь")

    # -B: правки «a * b» и «a + b» одной длины и в одну секунду — без него второй прогон
    # взял бы устаревший .pyc и краснел на уже починенном коде.
    CHECK = {"cwd": ".", "argv": [sys.executable, "-B", "-c",
                                  "import calc; assert calc.add(2, 3) == 5, calc.add(2, 3)"]}

    def test_failed_checks_go_back_to_the_model_until_green(self):
        result, stats = self.drive([edit("calc.py", "    return a - b", "    return a * b"),
                                    edit("calc.py", "    return a * b", "    return a + b")],
                                   ["calc.py"], checks=[self.CHECK])
        self.assertEqual((self.root / "calc.py").read_text(), "def add(a, b):\n    return a + b\n")
        self.assertEqual(result["status"], "done", result)
        self.assertEqual((stats["checks_runs"], stats["checks_green"]), (2, True), stats)
        self.assertIn("Машинные проверки задачи упали", self.prompts()[1])
        self.assertGitUntouched()

    def test_command_output_gives_the_model_another_turn(self):
        result, stats = self.drive(["Поищу.\n```bash\ngrep -rn MAGIC_NUMBER .\n```\n",
                                    edit("notes.md", "Число: ?", "Число: 42")], ["notes.md"])
        self.assertEqual((self.root / "notes.md").read_text(), "Число: 42\n")
        self.assertIn("MAGIC_NUMBER = 42", self.prompts()[1])
        # Ровно один запуск: aider копит команды за весь прогон и гонял бы их на каждом
        # ходу заново — цикл до потолка отражений. Ходов три: команда, правка, отчёт.
        self.assertEqual(stats["commands"], ["grep -rn MAGIC_NUMBER ."])
        self.assertEqual(len(self.prompts()), 3)
        # Число пришло выводом команды, а не подтянутым файлом: команда файла не называет.
        self.assertEqual(stats["read_added"], [])
        self.assertEqual(result["status"], "done", result)

    def test_command_naming_a_file_runs_and_the_file_opens_after(self):
        """Упоминание файла в ответе с командой: раньше команда терялась молча."""
        _, stats = self.drive(["```bash\ngrep -n MAGIC helper.py\n```\n", "Понял."], ["notes.md"])
        self.assertEqual(stats["commands"], ["grep -n MAGIC helper.py"])
        self.assertEqual(stats["read_added"], ["helper.py"])
        self.assertIn("ТОЛЬКО ДЛЯ ЧТЕНИЯ: helper.py", self.prompts()[1])

    def test_file_asked_for_next_to_an_edit_is_delivered(self):
        """Живая проба: модель вписала заглушку и попросила файл — и не получила его."""
        result, stats = self.drive([edit("notes.md", "Число: ?", "Число: <из helper.py>")
                                    + "\nНужен helper.py, чтобы вписать число.\n",
                                    edit("notes.md", "Число: <из helper.py>", "Число: 42"), "Вписал 42."],
                                   ["notes.md"])
        self.assertEqual(stats["read_added"], ["helper.py"])
        self.assertIn("MAGIC_NUMBER = 42", self.prompts()[1])
        self.assertEqual((self.root / "notes.md").read_text(), "Число: 42\n")

    def test_edit_is_applied_even_when_the_reply_mentions_another_file(self):
        self.drive([edit("notes.md", "Число: ?", "Число: 42") + "\nЧисло взял из helper.py.\n"], ["notes.md"])
        self.assertEqual((self.root / "notes.md").read_text(), "Число: 42\n")

    def test_git_commands_that_write_are_refused_and_the_model_is_told(self):
        result, stats = self.drive(["```bash\ngit add -A && git commit -m x\n```\n", "Понял."], ["notes.md"])
        self.assertGitUntouched()
        self.assertTrue(stats["refused"], stats)
        self.assertIn("Отклонено ночным контроллером", self.prompts()[1])
        self.assertEqual(result["status"], "blocked")

    def test_model_key_is_not_visible_to_commands(self):
        """Ключ нужен aider, а не командам: из журнала команд он ушёл бы в доказательства —
        в каталог прогона и в промпт приёмщика."""
        keys = self.base / "aider.env"
        keys.write_text("NIGHT_SECRET_TOKEN=s3cr3t-9z\n")
        result, stats = self.drive(['```bash\necho "[${NIGHT_SECRET_TOKEN:-нет}] [${DEEPSEEK_API_KEY:-нет}]"\n```\n',
                                    "Понял."], ["notes.md"], env_file=keys)
        self.assertIn("[нет] [нет]", stats["command_log"][0])
        self.assertNotIn("s3cr3t-9z", json.dumps([result, stats, self.prompts()], ensure_ascii=False))

    def test_command_block_runs_as_one_script(self):
        """aider гонит блок построчно: `cd` не доживал до следующей строки, а heredoc и
        многострочный цикл — формы, которыми Zoo-автор пользовался 40 раз, — рвались."""
        (self.root / "sub").mkdir()
        _, stats = self.drive(["```bash\ncd sub\npwd\nfor f in a b; do\n  echo item-$f\ndone\n"
                               "python3 - <<'PY'\nprint('heredoc-' + 'ok')\nPY\n```\n", "Понял."], ["notes.md"])
        answer = self.prompts()[1]
        for expected in ("repo/sub", "item-a", "item-b", "heredoc-ok"):
            self.assertIn(expected, answer)
        self.assertNotIn("syntax error", answer)
        self.assertEqual(len(stats["command_log"]), 1, stats["command_log"])

    def test_exit_code_reaches_the_model_even_without_output(self):
        """Команда без вывода не давала модели хода, а код возврата aider не показывает вовсе."""
        self.drive(["```bash\ntest -e no-such-file\n```\n", "Понял."], ["notes.md"])
        self.assertIn("код возврата 1", self.prompts()[1])
        self.assertIn("Продолжай задачу", self.prompts()[1])

    def test_writing_git_is_refused_however_the_shell_hides_it(self):
        """Разбор строки эти формы пропускал; изменённый индекс ядро считает концом ночи."""
        # stash — первым: стоя после add, он откатывал индекс сам, и тест был слеп к add.
        block = ("true;git stash; echo x > scratch.txt; bash -c 'git add -A'; (git add scratch.txt); "
                 "{ git add .; }; timeout 5 git add .; git status --short")
        _, stats = self.drive([f"```bash\n{block}\n```\n", "Понял."], ["notes.md"])
        self.assertEqual(stats["refused"], [], "эти формы разбор строки не видит — ловить обязана обёртка")
        self.assertGitUntouched()
        self.assertEqual(self.prompts()[1].count("отклонено ночным контроллером"), 5)
        self.assertIn("?? scratch.txt", self.prompts()[1])   # читающий git при этом работает

    def test_read_only_git_commands_are_allowed(self):
        _, stats = self.drive(["```bash\ngit log --oneline -1\n```\n", "Понял."], ["notes.md"])
        self.assertEqual(stats["refused"], [])
        self.assertIn("base", self.prompts()[1])

    def test_edit_outside_the_chat_is_refused_without_git_add(self):
        """«Да» здесь — это git add, а изменённый индекс ядро считает порчей Git."""
        result, _ = self.drive([edit("other.py", "VALUE = 1", "VALUE = 2")
                                + edit("fresh.py", "", "NEW = 1"), "Понял."], ["notes.md"])
        self.assertEqual((self.root / "other.py").read_text(), "VALUE = 1\n")
        self.assertFalse((self.root / "fresh.py").exists())
        self.assertGitUntouched()
        self.assertEqual(result["status"], "blocked")

    def test_model_is_told_its_edit_of_a_source_was_dropped(self):
        """aider отбрасывал правку файла вне outputs, сообщая только в лог: модель считала
        её сделанной и отчитывалась о ней."""
        self.drive([edit("helper.py", "MAGIC_NUMBER = 42", "MAGIC_NUMBER = 0"), "Понял."], ["notes.md"],
                   sources=["helper.py"])
        self.assertIn("Правка helper.py ОТКЛОНЕНА", self.prompts()[1])
        self.assertEqual((self.root / "helper.py").read_text(), "MAGIC_NUMBER = 42\n")

    def test_dropped_edit_note_survives_failed_checks(self):
        """Упавшие проверки ставятся после команд и затирали заметку хода."""
        self.drive([edit("helper.py", "MAGIC_NUMBER = 42", "MAGIC_NUMBER = 0")
                    + edit("calc.py", "    return a - b", "    return a * b"), "Понял."],
                   ["calc.py"], checks=[self.CHECK], sources=["helper.py"])
        self.assertIn("Машинные проверки задачи упали", self.prompts()[1])
        self.assertIn("Правка helper.py ОТКЛОНЕНА", self.prompts()[1])

    def test_hanging_command_is_killed_by_the_timeout(self):
        _, stats = self.drive(["```bash\nsleep 60\n```\n", "Понял."], ["notes.md"], command_timeout=2)
        self.assertLess(self.elapsed, 40)
        self.assertIn("прервана ночным контроллером", self.prompts()[1])

    def test_background_child_holding_the_output_does_not_hang_the_command(self):
        """Форма Zoo-автора: нагрузка `(yes > /dev/null &)` со stderr в канал команды.
        Чтение до конца канала ждало фон весь таймаут команды — у Zoo так ушло 40 минут."""
        _, stats = self.drive(["```bash\nfor i in 1 2; do (sleep 313 &); done; echo started\n```\n", "Понял."],
                              ["notes.md"], command_timeout=60)
        self.assertLess(self.elapsed, 30)
        self.assertEqual(stats["command_log"], ["$ for i in 1 2; do (sleep 313 &); done; echo started → код 0; started"])
        alive = subprocess.run(["pgrep", "-f", "^sleep 313$"], capture_output=True, text=True).stdout
        self.assertEqual(alive, "", "фоновый процесс пережил задачу")

    def test_timed_out_command_with_a_term_deaf_child_does_not_hang(self):
        """После таймаута чтение канала без срока ждало вечно: потомок, глухой к SIGTERM,
        держал канал, и драйвер висел до таймаута всей задачи."""
        _, stats = self.drive(["```bash\n(trap '' TERM; exec sleep 314) & sleep 60\n```\n", "Понял."],
                              ["notes.md"], command_timeout=2)
        self.assertLess(self.elapsed, 40)
        self.assertIn("прервана ночным контроллером", self.prompts()[1])
        alive = subprocess.run(["pgrep", "-f", "^sleep 314$"], capture_output=True, text=True).stdout
        self.assertEqual(alive, "", "глухой к SIGTERM потомок пережил задачу")

    def test_core_stopping_the_author_takes_its_commands_along(self):
        """Ядро гасит группу обёртки (SIGTERM, через 5 с SIGKILL), а команды автора живут в
        своих сессиях — их гасит только обработчик сигнала в драйвере."""
        (self.base / "script.json").write_text(json.dumps(["```bash\nsleep 316\n```\n"]))
        task = {"id": "t", "outputs": ["notes.md"], "sources": [], "checks": [], "task": "по сценарию"}
        argv = [sys.executable, str(AIDER_RUNNER), "--python", str(self.harness), "--binary", str(self.harness),
                "--model", "deepseek/deepseek-chat", "--root", str(self.root),
                "--result", str(self.run_dir / "t-work.json"), "--timeout", "120"]
        proc = subprocess.Popen(argv, stdin=subprocess.PIPE, cwd=self.root, start_new_session=True,
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                env={**os.environ, "AIDER_TEST_SCRIPT": str(self.base / "script.json"),
                                     "AIDER_TEST_LLM_LOG": str(self.base / "llm.jsonl"), "DEEPSEEK_API_KEY": "test"})
        proc.stdin.write(("Задача.\nЗадание (JSON):\n" + json.dumps(task)).encode())
        proc.stdin.close()
        pgrep = lambda: subprocess.run(["pgrep", "-f", "^sleep 316$"], capture_output=True, text=True).stdout
        deadline = time.monotonic() + 60
        while not pgrep() and time.monotonic() < deadline:
            time.sleep(0.2)
        self.assertTrue(pgrep(), "команда автора так и не запустилась")
        os.killpg(proc.pid, signal.SIGTERM)   # ровно как execute() в codex-night.py
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(proc.pid, signal.SIGKILL)
            proc.wait()
        time.sleep(0.5)
        self.assertEqual(pgrep(), "", "команда автора пережила остановку задачи ядром")

    def test_checks_run_at_the_end_even_without_edits(self):
        """Правок не было — auto_test не срабатывал ни разу, а итог проверок нужен приёмщику."""
        red = {"cwd": ".", "argv": [sys.executable, "-c", "raise SystemExit(1)"]}
        result, stats = self.drive(["Менять нечего."], ["notes.md"], checks=[red])
        self.assertEqual((stats["checks_runs"], stats["checks_green"]), (1, False), stats)
        self.assertTrue(any("проверки задачи у автора: КРАСНЫЕ" in e for e in result["evidence"]), result)

    def test_turn_ceiling_from_the_routing_is_applied(self):
        """Потолок ходов — решение владельца, и дойти до aider он обязан: у самого aider их 3."""
        turns = [f"```bash\necho turn-{n}\n```\n" for n in range(6)]
        _, stats = self.drive(turns, ["notes.md"], max_reflections=1)
        # Два хода основного запуска (первый и одно отражение) и два — просьбы об отчёте.
        self.assertEqual(stats["commands"], ["echo turn-0", "echo turn-1", "echo turn-2", "echo turn-3"])

    def test_mentioned_file_is_opened_read_only(self):
        result, stats = self.drive(["Мне нужен helper.py, чтобы узнать число.",
                                    edit("helper.py", "MAGIC_NUMBER = 42", "MAGIC_NUMBER = 0")
                                    + edit("notes.md", "Число: ?", "Число: 42")], ["notes.md"])
        self.assertEqual(stats["read_added"], ["helper.py"])
        self.assertIn("MAGIC_NUMBER = 42", self.prompts()[1])
        # Открыт для чтения, а не для правки: helper.py цел, notes.md исправлен.
        self.assertEqual((self.root / "helper.py").read_text(), "MAGIC_NUMBER = 42\n")
        self.assertEqual((self.root / "notes.md").read_text(), "Число: 42\n")
        self.assertGitUntouched()

    def test_file_over_the_ceiling_is_refused_out_loud(self):
        """Файл сверх потолка пропускался молча: модель просила его и не получала ни файла,
        ни ответа. Zoo-автор читал до 44 разных файлов за сессию."""
        _, stats = self.drive(["Мне нужны helper.py и other.py.", "Понял."], ["notes.md"], max_read_files=1)
        self.assertEqual(stats["read_added"], ["helper.py"])
        self.assertIn("НЕ открыл (потолок 1 файлов", self.prompts()[1])
        self.assertIn("other.py", self.prompts()[1].split("НЕ открыл", 1)[1])
        self.assertNotIn("VALUE = 1", self.prompts()[1])

    def test_prompt_mentions_are_not_pulled_into_the_chat(self):
        # Промпт ядра упоминает десятки документов; подтянуть их все — лишние токены.
        self.drive([edit("notes.md", "Число: ?", "Число: 1")], ["notes.md"],
                   text="Сверься с other.py и helper.py, потом поправь notes.md.")
        self.assertIn("other.py", self.prompts()[0])   # упоминание дошло до модели…
        self.assertNotIn("VALUE = 1", self.prompts()[0])   # …а содержимое файла — нет

    def test_author_report_and_command_log_reach_the_reviewer(self):
        """Приёмщик читает отчёт автора целиком; без прогонов автора в нём он бракует
        «мутация не подтверждена» даже верную работу."""
        result, _ = self.drive(["```bash\ngrep -rn MAGIC_NUMBER helper.py\n```\n",
                                edit("notes.md", "Число: ?", "Число: 42"),
                                "Вписал 42 в notes.md: grep по helper.py показал MAGIC_NUMBER = 42."],
                               ["notes.md"])
        self.assertEqual(result["status"], "done", result)
        self.assertIn("grep по helper.py показал", result["summary"])
        self.assertTrue(any(e.startswith("команда автора: $ grep -rn MAGIC_NUMBER helper.py → код 0")
                            for e in result["evidence"]), result["evidence"])

    def test_author_who_ends_with_an_edit_is_asked_for_a_report(self):
        result, _ = self.drive([edit("notes.md", "Число: ?", "Число: 1"), "Вписал 1 в notes.md."], ["notes.md"])
        self.assertEqual(result["summary"], "Вписал 1 в notes.md.")
        self.assertIn("Ответь без правок и команд отчётом", self.prompts()[1])

    def test_author_can_say_the_task_cannot_be_done(self):
        result, _ = self.drive(["НЕ МОГУ: в задании нет решения владельца о формате числа."], ["notes.md"])
        self.assertEqual(result["status"], "blocked")
        self.assertEqual(result["summary"], "автор: в задании нет решения владельца о формате числа.")

    def test_author_explanation_survives_when_nothing_was_changed(self):
        result, _ = self.drive(["В коде нет таймаута архивации, число выдумывать не стану."], ["notes.md"])
        self.assertEqual(result["status"], "blocked")
        self.assertIn("автор: В коде нет таймаута архивации", result["summary"])

    def test_background_server_lives_between_commands_and_dies_with_the_task(self):
        """Zoo-автор запускал `nohup npm run dev & disown` и ходил на сервер следующими
        командами. Гасить после команды нельзя, оставлять после задачи — тоже: займёт порт."""
        self.drive(["```bash\n(nohup sleep 377 > /dev/null 2>&1 & disown); echo started\n```\n",
                    "```bash\npgrep -f '^sleep 377$' > /dev/null && echo ALIVE\n```\n", "Понял."], ["notes.md"])
        self.assertIn("ALIVE", self.prompts()[2])
        # Якоря обязательны: `pgrep -f 'sleep 377'` находит и любую оболочку, в чьей
        # командной строке этот текст есть, — тест краснел на живой уборке.
        alive = subprocess.run(["pgrep", "-f", "^sleep 377$"], capture_output=True, text=True).stdout
        self.assertEqual(alive, "", "фоновый процесс пережил задачу")

    def test_leftovers_are_cleaned_and_stats_reported(self):
        result, stats = self.drive([edit("notes.md", "Число: ?", "Число: 1")], ["notes.md", "docs/empty.md"])
        self.assertFalse(list(self.root.glob(".aider*")))
        self.assertFalse((self.root / "docs/empty.md").exists())
        self.assertEqual(self.git("status", "--porcelain"), "M notes.md")
        self.assertTrue(any("проверки задачи у автора: не запускались" in e for e in result["evidence"]), result)


if __name__ == "__main__":
    unittest.main()
