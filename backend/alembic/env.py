import asyncio
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Alembic Config object
config = context.config

# Logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ── Add alembic directory to sys.path for local imports ──
sys.path.insert(0, str(Path(__file__).parent.resolve()))

# ── Import all models so Base.metadata is fully populated ──
from app.core.base import Base  # noqa: E402
import _alembic_imports  # noqa: F401, E402

target_metadata = Base.metadata

# ── Database URL from app config ──
from app.core.config import settings  # noqa: E402

config.set_main_option("sqlalchemy.url", settings.database_url)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (generate SQL script, no DB connection)."""
    url = config.get_section(config.config_ini_section)["sqlalchemy.url"]
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Настроить контекст и прогнать миграции.

    `compare_server_default=True` — это линза Б2, доведённая до машины. Без него
    `alembic check` сравнивает имена, типы и `nullable`, но НЕ умолчания, и
    расхождение модели со схемой живёт сколько угодно долго, никого не тревожа.
    Цена такой слепоты уже заплачена дважды, и оба раза одинаково: миграция
    выписала одно, модель со временем стала утверждать другое, ревизии между ними
    не случилось.

      * матрица прав — три разных ответа про `can_read`, разобрано `f1c4a8e07b26`;
      * `users.role` — база `'user'`, модель `'owner'` с самой первой миграции
        `3a0b5d31bde7`; нашлось ровно в тот момент, когда флаг включили.

    Почему флага не было раньше: на этой схеме он ПАДАЛ. Сравнивая умолчания,
    Alembic при расхождении строк спрашивает сервер
    `SELECT <умолчание базы> = <умолчание модели>`
    (`alembic/ddl/postgresql.py`, `compare_server_default`), а три колонки
    `suppliers` — `categories`, `tags`, `bcc_emails` — были `jsonb` с умолчанием
    типа `json` (`'[]'::json`): наследство от смены типа, которую
    `ALTER COLUMN ... TYPE` умолчанию не передаёт. У типа `json` в Postgres нет
    оператора `=`, и весь `check` валился с
    `operator does not exist: json = unknown`. Лечилось это не обходом
    JSON-колонок в сравнении, а починкой самих трёх умолчаний — ревизия
    `a3f70b219c84`. Обход спрятал бы дефект вместе с симптомом.

    Шаг введён ЗЕЛЁНЫМ, по правилу из `verify.md`: к моменту включения все
    расхождения разобраны (54 ключа `id` через `UUIDMixin`, `company_info.name`,
    два поля `order_items`, `users.role`), и `python3 -m alembic check` печатает
    `No new upgrade operations detected.` с кодом 0.
    """
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create engine and run migrations asynchronously."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
