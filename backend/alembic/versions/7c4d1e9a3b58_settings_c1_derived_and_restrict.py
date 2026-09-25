"""settings_c1_derived_and_restrict

Слайс C1 домена `settings` — снятие лишнего. Три изменения одной ревизией, потому что
источник у них один и тот же: схема настроек.

**П23 — у валюты снят хранимый курс.** Конверсии валют в проекте нет нигде, курс никем не
читается и никем не считается; колонка удаляется целиком, а не помечается устаревшей.
БАГ-05 (создание валюты падало на обязательном поле, которого фронт не шлёт) закрывается
вместе с ней.

**П22 + П68 — `default_currency` перестаёт быть хранимой колонкой.** Валюта по умолчанию —
та, у которой поднят флаг `currencies.is_default`; хранимых колонок под производные домен не
заводит. Инвариант «ровно одна валюта с флагом» и выработка значения этой ревизией **не
строятся** — это работа слайса C6, и здесь снимается только колонка.

**П44 — обе ссылки правила пересчёта на `uoms.id` переведены с `CASCADE` на `RESTRICT`.**
Справочник, на который ссылаются, не должен утаскивать ссылающихся за собой: удаление
единицы с живым правилом пересчёта обязано стать отказом, а не молчаливым уничтожением
правила. Ссылок ровно две, и обе в этой ревизии. Доменного кода отказа здесь ещё нет —
он приходит слайсом C4, эта ревизия снимает только каскад.

Revision ID: 7c4d1e9a3b58
Revises: 1c9d4f7b2e83
Create Date: 2026-09-21 20:21:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "7c4d1e9a3b58"
down_revision: Union[str, Sequence[str], None] = "1c9d4f7b2e83"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Имена внешних ключей — умолчание PostgreSQL для безымянного inline-FK вида
# `sa.ForeignKey("uoms.id", ondelete=...)`, которым таблица и была заведена
# (`57ba67dda78c_phase_2_settings.py:84-85`). Имя названо явно: `drop_constraint`
# без него не найдёт ограничение, а пересоздание обязано сохранить прежнее имя.
FROM_UOM_FK = "uom_conversions_from_uom_id_fkey"
TO_UOM_FK = "uom_conversions_to_uom_id_fkey"


def upgrade() -> None:
    """Снять курс валюты и колонку валюты по умолчанию, перевести ссылки на `RESTRICT`."""
    # П23: курса в проекте нет
    op.drop_column("currencies", "exchange_rate")

    # П22 + П68: производное не хранится, источник — флаг валюты
    op.drop_column("global_constants", "default_currency")

    # П44: справочник не уносит ссылающихся за собой
    op.drop_constraint(FROM_UOM_FK, "uom_conversions", type_="foreignkey")
    op.create_foreign_key(
        FROM_UOM_FK, "uom_conversions", "uoms", ["from_uom_id"], ["id"], ondelete="RESTRICT"
    )
    op.drop_constraint(TO_UOM_FK, "uom_conversions", type_="foreignkey")
    op.create_foreign_key(
        TO_UOM_FK, "uom_conversions", "uoms", ["to_uom_id"], ["id"], ondelete="RESTRICT"
    )


def downgrade() -> None:
    """Вернуть прежнюю политику ссылок и обе снятые колонки."""
    # П44 обратно: прежняя политика ссылок — каскад
    op.drop_constraint(FROM_UOM_FK, "uom_conversions", type_="foreignkey")
    op.create_foreign_key(
        FROM_UOM_FK, "uom_conversions", "uoms", ["from_uom_id"], ["id"], ondelete="CASCADE"
    )
    op.drop_constraint(TO_UOM_FK, "uom_conversions", type_="foreignkey")
    op.create_foreign_key(
        TO_UOM_FK, "uom_conversions", "uoms", ["to_uom_id"], ["id"], ondelete="CASCADE"
    )

    # П22 + П68 обратно: колонка возвращается вместе с прежним умолчанием
    op.add_column(
        "global_constants",
        sa.Column("default_currency", sa.String(10), nullable=False, server_default="EUR"),
    )

    # П23 обратно: прежнее умолчание курса — единица
    op.add_column(
        "currencies",
        sa.Column("exchange_rate", sa.Numeric(12, 6), nullable=False, server_default="1"),
    )
