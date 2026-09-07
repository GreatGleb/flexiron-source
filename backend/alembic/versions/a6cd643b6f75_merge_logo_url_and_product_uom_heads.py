"""merge_logo_url_and_product_uom_heads

Сводит две головы, разошедшиеся от bbd27a3881a5: `15f2c7d4e9b0`
(enlarge_logo_url_to_text) и `a1b2c3d4e5f6` (phase_15_product_uom_restructure).
Обе созданы одним коммитом 34e94f6 с проставленными руками id, и обе объявили
`down_revision = 'bbd27a3881a5'` — то есть развилка сделана не осознанным
ветвлением, а недосмотром.

Пока голов две, `alembic upgrade head` падает с «Multiple head revisions are
present», а это шаг приёмки бэкенда из `roo_code/skills/verify.md`. Схему эта
ревизия не меняет ничем: она только возвращает графу одну голову, чтобы
последующие ревизии могли к ней прицепиться.

Revision ID: a6cd643b6f75
Revises: 15f2c7d4e9b0, a1b2c3d4e5f6
Create Date: 2026-09-07 14:28:38.189668

"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "a6cd643b6f75"
down_revision: Union[str, Sequence[str], None] = ("15f2c7d4e9b0", "a1b2c3d4e5f6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Схему не меняет — только сводит две головы в одну."""


def downgrade() -> None:
    """Схему не меняет — граф снова расходится на две головы."""
