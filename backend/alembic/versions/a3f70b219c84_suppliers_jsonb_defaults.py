"""suppliers_jsonb_defaults

Три умолчания на `suppliers` приводятся к типу своей колонки: `'[]'::json` → `'[]'::jsonb`.

ОТКУДА ВЗЯЛОСЬ. `a8dd7d7ba74b` завела `categories`, `tags` и `bcc_emails` как
`JSON` с `server_default="[]"` — Postgres записал умолчание как `'[]'::json`.
Позже `b8f3d0c62a71` сменила ТИП колонок на `JSONB`, а `ALTER COLUMN ... TYPE`
умолчание не переписывает: выражение осталось прежним, лишь перепривязалось к
новой колонке. Так и вышло `jsonb`-колонка с `json`-умолчанием. Остальные 32
`jsonb`-колонки схемы несут `'{}'::jsonb` / `'[]'::jsonb` — эти три были
единственным исключением (замер по `information_schema.columns`).

ПОЧЕМУ ЭТО НЕ КОСМЕТИКА. Пока умолчание имеет тип `json`, `alembic check` с
`compare_server_default=True` не проходит вовсе: сравнивая умолчания, Alembic
спрашивает сервер `SELECT <умолчание в базе> = <умолчание в модели>`
(`alembic/ddl/postgresql.py`, `compare_server_default`), а у типа `json` в
Postgres оператора `=` нет — только у `jsonb`. Отсюда
`operator does not exist: json = unknown` на `SELECT '[]'::json = '[]'`, и
отсюда же то, что сравнение умолчаний было выключено для ВСЕЙ схемы.

Ценой этой слепоты уже заплачено: `f1c4a8e07b26` разбирала три расходящихся
ответа про умолчания матрицы прав, которые `check` не видел именно потому, что
`compare_server_default` не был включён. После этой ревизии он включён
(`alembic/env.py`) и сторожит умолчания у всех моделей, а не у одной таблицы.

Данные не трогаются: умолчание применяется только к новым строкам, а `'[]'`
в обоих типах — один и тот же пустой массив. Проверено: `alembic upgrade head`
и `alembic downgrade -1` на схеме 5433, `check` чист в обе стороны.

Revision ID: a3f70b219c84
Revises: f1c4a8e07b26
Create Date: 2026-09-25 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "a3f70b219c84"
down_revision: Union[str, Sequence[str], None] = "f1c4a8e07b26"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUMNS = ("categories", "tags", "bcc_emails")


def upgrade() -> None:
    for column in COLUMNS:
        op.alter_column(
            "suppliers",
            column,
            existing_type=postgresql.JSONB(astext_type=sa.Text()),
            existing_nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        )


def downgrade() -> None:
    for column in COLUMNS:
        op.alter_column(
            "suppliers",
            column,
            existing_type=postgresql.JSONB(astext_type=sa.Text()),
            existing_nullable=False,
            server_default=sa.text("'[]'::json"),
        )
