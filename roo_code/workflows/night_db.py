#!/usr/bin/env python3
"""База данных на задачу — изоляция общего изменяемого ресурса прогона (БАГ-05).

Откат заблокированной задачи откатывает ФАЙЛЫ. Миграция, которую задача успела
накатить, остаётся в базе, `alembic_version` продолжает указывать на исчезнувшую
ревизию, и `alembic check` падает у всех последующих задач кодом 255. Ночь
2026-09-24-2225 потеряла так двенадцать задач из тридцати двух заблокированных.

Второе направление из баг-файла — «откатывать миграции вместе с патчем» —
отвергнуто **замером, а не вкусом**: авторы пишут параллельно (`--parallel 4` в
`night-run.sh`), каждый в своём worktree, но база у них была одна, и задание само
велит автору выполнить `alembic upgrade head`. Значит в момент блокировки поверх
ревизии заблокированной задачи уже лежат ревизии соседей, её ревизия не обязана
быть головой, и `alembic downgrade` до базы задачи снёс бы чужую работу. Отката,
который трогает только свою задачу, при общей базе не существует.

Премиса того направления при этом верна, и это проверено отдельно: `downgrade()` у
ревизий настоящий — замер 2026-09-25 по 38 ревизиям дерева и 26 ревизиям в патчах
ночи не нашёл ни одного тела из одного `pass`. Направление отвергнуто не за это.

Цена выбранного направления измерена на контейнере `flexiron_pg_verify`: шаблон
строится один раз за прогон (`CREATE DATABASE` 0.34 с плюс `alembic upgrade head`
1.8 с), клон на задачу — 0.34 с, четыре клона одновременно — 0.68 с. На шестидесяти
пяти задачах это меньше полуминуты против семичасовой ночи.
"""

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote, urlsplit, urlunsplit


PREFIX = "nightdb_"
TEMPLATE = PREFIX + "template"
# Postgres режет идентификатор на 63 байтах МОЛЧА: два длинных id задач дали бы одно
# имя базы, и вторая задача работала бы в базе первой. Поэтому имя строится из
# обрезанного слага и хвоста хеша полного id, а не из одного слага.
MAX_IDENTIFIER = 63
SLUG_LIMIT = MAX_IDENTIFIER - len(PREFIX) - 1 - 8


def database_name(task_id):
    """Имя базы для задачи: читаемое, детерминированное и заведомо короче 63 байт."""
    slug = re.sub(r"[^a-z0-9]+", "_", task_id.lower()).strip("_")[:SLUG_LIMIT]
    digest = hashlib.sha256(task_id.encode()).hexdigest()[:8]
    name = f"{PREFIX}{slug}_{digest}" if slug else f"{PREFIX}{digest}"
    if len(name.encode()) > MAX_IDENTIFIER:
        raise ValueError(f"Имя базы длиннее {MAX_IDENTIFIER} байт: {name}")
    return name


def url_for_database(url, name, keep_driver=False):
    """Тот же сервер и те же учётные данные, другая база.

    Драйвер (`+asyncpg`) отбрасывается ПО УМОЛЧАНИЮ, потому что `asyncpg.connect`
    понимает только `postgresql://`. Но адрес, который уходит наружу как
    `DATABASE_URL` — шаблону под `alembic upgrade head` и каждому автору, — обязан
    драйвер СОХРАНИТЬ: `backend/alembic/env.py` кладёт переменную в
    `sqlalchemy.url` как есть и строит по ней АСИНХРОННЫЙ движок. Без драйвера
    SQLAlchemy выбирает psycopg2, которого в зависимостях проекта нет вовсе
    (`backend/requirements.txt` знает только `asyncpg`), и прогон падает на
    построении шаблона, не дойдя до первой задачи. Замер 2026-09-26.
    """
    scheme = url.partition("://")[0]
    target = scheme if keep_driver else scheme.split("+", 1)[0]
    parts = urlsplit(url.replace(scheme + "://", target + "://", 1))
    return urlunsplit((parts.scheme, parts.netloc, "/" + quote(name), parts.query, parts.fragment))


def read_database_url(root):
    """DATABASE_URL берётся из `backend/.env` — единственного места, где он записан."""
    env_file = Path(root) / "backend/.env"
    if not env_file.is_file():
        raise ValueError(f"Нет {env_file}: неоткуда взять DATABASE_URL для баз на задачу")
    for line in env_file.read_text().splitlines():
        key, sep, value = line.partition("=")
        if sep and key.strip() == "DATABASE_URL":
            return value.strip()
    raise ValueError(f"В {env_file} нет строки DATABASE_URL")


_SCRIPT = """
import asyncio, json, sys, asyncpg
async def main():
    url, statements, query = json.loads(sys.stdin.read())
    conn = await asyncpg.connect(url)
    try:
        for statement in statements:
            await conn.execute(statement)
        rows = await conn.fetch(*query) if query else []
    finally:
        await conn.close()
    print(json.dumps([list(row) for row in rows]))
asyncio.run(main())
"""


def asyncpg_sql(url, statements, query=None):
    """Служебные операторы — отдельным процессом.

    Отдельным потому, что `CREATE DATABASE` нельзя выполнить внутри транзакции, а
    держать в контроллере живой event loop asyncpg ради трёх операторов на задачу
    незачем. Возвращает строки последнего запроса (или пустой список).
    """
    proc = subprocess.run([sys.executable, "-c", _SCRIPT], capture_output=True, text=True,
                          input=json.dumps([url, list(statements), query]))
    if proc.returncode:
        raise RuntimeError(f"Служебный SQL не выполнен: {proc.stderr.strip() or proc.stdout.strip()}")
    return json.loads(proc.stdout or "[]")


class TaskDatabases:
    """База на задачу: клон шаблона, живущий ровно столько, сколько живёт задача.

    `executor` вынесен параметром не для красоты: без него порядок операторов
    (шаблон, клон, снятие соединений, удаление) проверяется только живым Postgres,
    то есть на машине без контейнера не проверяется никак.
    """

    def __init__(self, base_url, executor=asyncpg_sql):
        self.base_url = base_url
        self.executor = executor
        self.admin_url = url_for_database(base_url, "postgres")
        self.template_url = url_for_database(base_url, TEMPLATE)
        # Адрес шаблона в той форме, в какой его читает бэкенд: см. url_for_database.
        self.template_env_url = url_for_database(base_url, TEMPLATE, keep_driver=True)
        self.live = {}

    def _admin(self, *statements, query=None):
        return self.executor(self.admin_url, list(statements), query)

    @staticmethod
    def _drop(name):
        # Соединения снимаются ДО удаления: автор мог оставить открытое соединение, и
        # тогда DROP DATABASE падает, а база остаётся мусором до конца прогона.
        return [f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '{name}'",
                f'DROP DATABASE IF EXISTS "{name}"']

    def existing(self):
        """Базы прогона, уже имеющиеся на сервере, — включая шаблон и мусор прошлых ночей."""
        rows = self._admin(query=["SELECT datname FROM pg_database WHERE datname LIKE $1", PREFIX + "%"])
        return sorted(row[0] for row in rows)

    def prepare(self, root, run_alembic):
        """Собрать шаблон с нуля и вымести базы, оставшиеся от прошлых прогонов.

        Шаблон строится прогоном ревизий, а не клоном рабочей базы: так он заодно
        доказывает, что ревизии применяются на чистой базе (линза Б2), и не зависит
        от того, в каком состоянии человек оставил свою базу.
        """
        for name in self.existing():
            self._admin(*self._drop(name))
        self._admin(f'CREATE DATABASE "{TEMPLATE}"')
        if (Path(root) / "backend/alembic.ini").is_file():
            run_alembic(self.template_env_url)

    def url_for(self, task_id):
        """Идемпотентно: первый вызов создаёт базу, повторный отдаёт ту же."""
        if task_id not in self.live:
            name = database_name(task_id)
            self._admin(*self._drop(name))
            self._admin(f'CREATE DATABASE "{name}" TEMPLATE "{TEMPLATE}"')
            self.live[task_id] = url_for_database(self.base_url, name)
        return self.live[task_id]

    def env_for(self, task_id):
        """Окружение автора. Драйвер здесь обязателен — это `DATABASE_URL`, а не DSN."""
        self.url_for(task_id)
        return {"DATABASE_URL": url_for_database(self.base_url, database_name(task_id),
                                                 keep_driver=True)}

    def release(self, task_id):
        if self.live.pop(task_id, None) is None:
            return
        self._admin(*self._drop(database_name(task_id)))

    def dispose(self):
        """Остановка на середине не должна оставлять за собой баз."""
        for task_id in list(self.live):
            try:
                self.release(task_id)
            except Exception:  # уборка не должна подменять причину остановки
                self.live.pop(task_id, None)


class NoDatabases:
    """Прогон без изоляции: окружение задач не трогается вовсе."""

    def prepare(self, root, run_alembic):
        pass

    def env_for(self, task_id):
        return {}

    def release(self, task_id):
        pass

    def dispose(self):
        pass
