"""Базы на задачу: порядок операторов — без Postgres, жизненный цикл — на живом сервере."""

import importlib.util
from pathlib import Path
import tempfile
import unittest


def _load(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


night_db = _load("night_db")

LIVE_URL = "postgresql+asyncpg://postgres:root@localhost:5433/flexiron"


def server_available():
    try:
        night_db.asyncpg_sql(night_db.url_for_database(LIVE_URL, "postgres"), [], ["SELECT 1"])
    except Exception:
        return False
    return True


class Recorder:
    """Исполнитель-протоколист: запоминает адрес и операторы, ничего не делает."""

    def __init__(self, rows=()):
        self.calls = []
        self.rows = list(rows)

    def __call__(self, url, statements, query=None):
        self.calls.append((url, list(statements), query))
        return self.rows if query else []

    def statements(self):
        return [statement for _, group in [(c[0], c[1]) for c in self.calls] for statement in group]


class NamingTest(unittest.TestCase):
    def test_name_is_deterministic_readable_and_within_the_identifier_limit(self):
        name = night_db.database_name("suppliers-schema-t2")
        self.assertEqual(name, night_db.database_name("suppliers-schema-t2"))
        self.assertTrue(name.startswith("nightdb_suppliers_schema_t2_"), name)
        self.assertLessEqual(len(name.encode()), night_db.MAX_IDENTIFIER)

    def test_long_ids_stay_distinct_after_truncation(self):
        # Обрезка слага без хвоста хеша дала бы двум задачам ОДНО имя базы, и вторая
        # работала бы в базе первой — ровно та беда, ради которой всё это написано.
        stem = "backend-" + "x" * 80
        first, second = night_db.database_name(stem + "-one"), night_db.database_name(stem + "-two")
        self.assertNotEqual(first, second)
        for name in (first, second):
            self.assertLessEqual(len(name.encode()), night_db.MAX_IDENTIFIER)

    def test_env_for_keeps_the_driver_because_it_is_a_database_url(self):
        """Автору уходит `DATABASE_URL`, а не DSN: без драйвера его alembic не поднимется."""
        pool = night_db.TaskDatabases("postgresql+asyncpg://user:pass@host:5433/flexiron",
                                      executor=lambda *a, **k: [])
        url = pool.env_for("some-task")["DATABASE_URL"]
        self.assertTrue(url.startswith("postgresql+asyncpg://"), url)
        self.assertTrue(url.endswith("/" + night_db.database_name("some-task")), url)
        # А внутренний DSN, которым ходит сам asyncpg, драйвера нести не должен.
        self.assertTrue(pool.url_for("some-task").startswith("postgresql://"))

    def test_url_keeps_server_and_credentials_and_drops_the_driver(self):
        url = night_db.url_for_database("postgresql+asyncpg://user:pass@host:5433/flexiron", "other")
        self.assertEqual(url, "postgresql://user:pass@host:5433/other")

    def test_database_url_is_read_from_the_backend_env_file(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            with self.assertRaises(ValueError):
                night_db.read_database_url(root)
            (root / "backend").mkdir()
            (root / "backend/.env").write_text("SECRET_KEY=x\nDATABASE_URL=postgresql://a:b@h:1/db\n")
            self.assertEqual(night_db.read_database_url(root), "postgresql://a:b@h:1/db")


class LifecycleTest(unittest.TestCase):
    """Порядок операторов проверяется здесь, потому что на машине без контейнера
    он иначе не проверяется ничем, а пропущенная проверка — не проверка."""

    def setUp(self):
        self.recorder = Recorder()
        self.pool = night_db.TaskDatabases(LIVE_URL, self.recorder)

    def test_admin_statements_go_to_the_maintenance_database(self):
        self.pool.url_for("plan")
        self.assertTrue(all(url.endswith("/postgres") for url, _, _ in self.recorder.calls))

    def test_prepare_sweeps_leftovers_then_builds_the_template(self):
        self.recorder.rows = [["nightdb_stale_abcdef12"], [night_db.TEMPLATE]]
        built = []
        with tempfile.TemporaryDirectory() as temp:
            self.pool.prepare(Path(temp), built.append)
        statements = self.recorder.statements()
        self.assertIn('DROP DATABASE IF EXISTS "nightdb_stale_abcdef12"', statements)
        self.assertIn(f'DROP DATABASE IF EXISTS "{night_db.TEMPLATE}"', statements)
        creation = statements.index(f'CREATE DATABASE "{night_db.TEMPLATE}"')
        self.assertLess(statements.index(f'DROP DATABASE IF EXISTS "{night_db.TEMPLATE}"'), creation)
        # Без alembic.ini накатывать нечего, и выдумывать миграции не из чего.
        self.assertEqual(built, [])

    def test_prepare_upgrades_the_template_when_the_backend_has_migrations(self):
        built = []
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "backend").mkdir()
            (root / "backend/alembic.ini").write_text("[alembic]\n")
            self.pool.prepare(root, built.append)
        # Драйвер обязан сохраниться: это `DATABASE_URL`, по которому `alembic/env.py`
        # строит АСИНХРОННЫЙ движок. Без него SQLAlchemy берёт psycopg2, которого в
        # зависимостях проекта нет, и прогон падает, не дойдя до первой задачи.
        self.assertEqual(built, [night_db.url_for_database(LIVE_URL, night_db.TEMPLATE,
                                                           keep_driver=True)])
        self.assertIn("+asyncpg", built[0])

    def test_task_database_is_a_clone_of_the_template_and_is_reused(self):
        first = self.pool.url_for("plan")
        calls_after_first = len(self.recorder.calls)
        self.assertEqual(self.pool.url_for("plan"), first)
        self.assertEqual(len(self.recorder.calls), calls_after_first, "повторный вызов создал базу заново")
        name = night_db.database_name("plan")
        self.assertIn(f'CREATE DATABASE "{name}" TEMPLATE "{night_db.TEMPLATE}"', self.recorder.statements())
        self.assertTrue(first.endswith("/" + name), first)

    def test_release_terminates_connections_before_dropping(self):
        self.pool.url_for("plan")
        self.recorder.calls.clear()
        self.pool.release("plan")
        name = night_db.database_name("plan")
        statements = self.recorder.statements()
        self.assertLess(statements.index(f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                                         f"WHERE datname = '{name}'"),
                        statements.index(f'DROP DATABASE IF EXISTS "{name}"'))

    def test_release_of_an_unknown_task_touches_nothing(self):
        self.pool.release("never-started")
        self.assertEqual(self.recorder.calls, [])

    def test_dispose_drops_every_live_database_even_when_one_drop_fails(self):
        self.pool.url_for("one")
        self.pool.url_for("two")
        failures = {"left": 1}

        def flaky(url, statements, query=None):
            if any("DROP DATABASE" in s for s in statements) and failures["left"]:
                failures["left"] -= 1
                raise RuntimeError("сервер ответил отказом")
            return self.recorder(url, statements, query)

        self.pool.executor = flaky
        self.pool.dispose()
        self.assertEqual(self.pool.live, {}, "после dispose остались базы, которые никто не удалит")

    def test_no_databases_mode_leaves_the_environment_alone(self):
        pool = night_db.NoDatabases()
        pool.prepare(Path("."), lambda url: self.fail("шаблон строить нечему"))
        self.assertEqual(pool.env_for("plan"), {})
        pool.release("plan")
        pool.dispose()


@unittest.skipUnless(server_available(),
                     f"нет Postgres на {LIVE_URL}: жизненный цикл баз не проверяется")
class LiveTest(unittest.TestCase):
    """То, чего протоколист не докажет: база действительно появляется и исчезает."""

    def setUp(self):
        self.pool = night_db.TaskDatabases(LIVE_URL)
        self.addCleanup(self.pool.dispose)
        self.addCleanup(lambda: self.pool._admin(*self.pool._drop(night_db.TEMPLATE)))

    def write(self, url, *statements):
        """Писать разрешено только в базу прогона.

        Сторож поставлен по факту: инверсия 2026-09-25, при которой `url_for` отдавал
        общую базу, прошла через эти же тесты и создала таблицы `probe` и
        `only_in_first` в РАБОЧЕЙ базе на 5433. Отравил её ровно тот механизм, который
        здесь и чинится, — `alembic check` после этого падал. Без сторожа сломанный
        `url_for` пачкает чужую базу каждый раз, когда тест им пользуется.
        """
        name = url.rsplit("/", 1)[-1]
        self.assertTrue(name.startswith(night_db.PREFIX),
                        f"тест собрался писать в чужую базу {name}")
        return night_db.asyncpg_sql(url, statements)

    def test_database_appears_on_acquire_and_is_gone_after_release(self):
        with tempfile.TemporaryDirectory() as temp:
            self.pool.prepare(Path(temp), lambda url: self.fail("миграций в пустом дереве нет"))
        name = night_db.database_name("live-probe")
        self.assertNotIn(name, self.pool.existing())
        url = self.pool.url_for("live-probe")
        self.assertIn(name, self.pool.existing())
        # Клон — рабочая база, а не запись в каталоге: в неё можно писать.
        self.write(url, "CREATE TABLE probe (id int)")
        self.assertEqual(night_db.asyncpg_sql(url, [], ["SELECT count(*) FROM probe"]), [[0]])
        self.pool.release("live-probe")
        self.assertNotIn(name, self.pool.existing())

    def test_two_tasks_do_not_see_each_others_tables(self):
        with tempfile.TemporaryDirectory() as temp:
            self.pool.prepare(Path(temp), lambda url: self.fail("миграций в пустом дереве нет"))
        first, second = self.pool.url_for("task-one"), self.pool.url_for("task-two")
        self.write(first, "CREATE TABLE only_in_first (id int)")
        self.assertEqual(night_db.asyncpg_sql(
            second, [], ["SELECT count(*) FROM pg_tables WHERE tablename = 'only_in_first'"]), [[0]])


if __name__ == "__main__":
    unittest.main()
