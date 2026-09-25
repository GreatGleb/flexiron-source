"""matrix_can_read_defaults_false

`role_permissions.can_read` и `user_permissions.can_read` получают
`server_default = false` — тот же, что у трёх соседних действий.

Зачем ревизия, если модель это уже говорила. Две принятые ревизии спорили друг с
другом: `c1d2e3f4a5b6` поставила роли `false`, а более поздняя `d4c8a1f37b62`
сняла умолчание с ОБЕИХ таблиц, объяснив это тем, что прежний `true` расходился
с контрактом. В базе осталось «умолчания нет», в модели роли — `false`, и
`alembic check` промолчал: он НЕ сравнивает `server_default` (это требует
`compare_server_default=True`, а он на этой схеме падает на JSON-колонках —
`SELECT '[]'::json = '[]'`).

Верным принят `false`, а не его отсутствие: П33 говорит «новый элемент видит
только админ», и строка, заведённая без явного значения, обязана быть
НЕчитаемой, а не отказывать вставкой. Оба уровня матрицы (6.1) живут по одному
правилу, значит и умолчание у них одно.

Revision ID: f1c4a8e07b26
Revises: e7a2c5b41d09
Create Date: 2026-09-25 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "f1c4a8e07b26"
down_revision: Union[str, Sequence[str], None] = "e7a2c5b41d09"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for table in ("role_permissions", "user_permissions"):
        op.alter_column(
            table,
            "can_read",
            existing_type=sa.Boolean(),
            existing_nullable=False,
            server_default=sa.text("false"),
        )


def downgrade() -> None:
    for table in ("role_permissions", "user_permissions"):
        op.alter_column(
            table,
            "can_read",
            existing_type=sa.Boolean(),
            existing_nullable=False,
            server_default=None,
        )
