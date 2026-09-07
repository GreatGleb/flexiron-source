"""phase_16_service_currency_uom

Услуги переводятся с сваренной строки `price_unit` ("EUR/vnt") на две ссылки в
справочники арендатора: `currency_id` → `currencies.id` и `uom_id` → `uoms.id`.

Тот же путь товары прошли двумя ревизиями: bbd27a3881a5 добавила им FK на валюту
и единицу, a1b2c3d4e5f6 удалила `price_unit`. Услуги остались в виде phase_4
(d730d0aa32ef), где `price_unit` — `String(20)` со `server_default 'EUR/vnt'`, а
колонок под справочники нет вовсе. Фронт союз `'EUR/vnt' | 'EUR/kg' | ...` уже
снял и держит три отдельных поля (`frontend_vue/src/types/service.ts:19-31`).

Nullable и `ondelete="RESTRICT"` взяты у товаров (`products.currency_id`,
`products.sale_uom_id`), а не выбраны заново: NOT NULL на существующих строках не
гарантируется — у арендатора может не оказаться валюты или единицы под свой же
`price_unit`, и тогда ссылка останется пустой.

Перенос значений разбирает `price_unit` как `<код валюты>/<код единицы>`:
- валюта — по `currencies.code` того же арендатора (колонка есть, `String(10)`);
- единица — у `uoms` колонки `code` НЕТ, код лежит в `code_translations` JSONB,
  поэтому сопоставление идёт по любой из трёх локалей. Это не изобретение: то же
  правило уже записано в `app/modules/settings/features/crud/repository.py:174-190`
  (`get_uom_by_code` — "in any language"). Иначе `'vnt'` (литовское «шт.») не
  нашёлся бы ни по одной локали, кроме lt.

Revision ID: 7fff8d1e5810
Revises: a6cd643b6f75
Create Date: 2026-09-07 14:31:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "7fff8d1e5810"
down_revision: Union[str, Sequence[str], None] = "a6cd643b6f75"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Ссылки в справочники арендатора
    op.add_column(
        "services",
        sa.Column(
            "currency_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("currencies.id", ondelete="RESTRICT"),
            nullable=True,
            index=True,
        ),
    )
    op.add_column(
        "services",
        sa.Column(
            "uom_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("uoms.id", ondelete="RESTRICT"),
            nullable=True,
            index=True,
        ),
    )

    # 2. Перенос значений: "<код валюты>/<код единицы>" → две ссылки.
    #    Валюта — по code того же арендатора.
    op.execute(
        """
        UPDATE services AS s
        SET currency_id = c.id
        FROM currencies AS c
        WHERE c.tenant_id = s.tenant_id
          AND c.code = split_part(s.price_unit, '/', 1)
          AND split_part(s.price_unit, '/', 1) <> ''
        """
    )
    #    Единица — по code_translations в любой из трёх локалей
    #    (правило get_uom_by_code, settings/features/crud/repository.py).
    op.execute(
        """
        UPDATE services AS s
        SET uom_id = u.id
        FROM uoms AS u
        WHERE u.tenant_id = s.tenant_id
          AND split_part(s.price_unit, '/', 2) <> ''
          AND split_part(s.price_unit, '/', 2) IN (
              u.code_translations ->> 'en',
              u.code_translations ->> 'ru',
              u.code_translations ->> 'lt'
          )
        """
    )

    # 3. Сваренная строка больше не нужна
    op.drop_column("services", "price_unit")


def downgrade() -> None:
    # Строка восстанавливается со потерями и поэтому nullable: код единицы
    # собирается по en → ru → lt, как это делает
    # `_reconstruct_price_unit` (products/features/get_product_detail/domain.py:26-44),
    # то есть исходная локаль не сохраняется. Значение 'EUR/vnt' вернётся как
    # 'EUR/pcs', если у единицы заполнен английский код.
    op.add_column(
        "services",
        sa.Column("price_unit", sa.String(20), nullable=True),
    )
    op.execute(
        """
        UPDATE services AS s
        SET price_unit = c.code || '/' || COALESCE(
                u.code_translations ->> 'en',
                u.code_translations ->> 'ru',
                u.code_translations ->> 'lt'
            )
        FROM currencies AS c, uoms AS u
        WHERE c.id = s.currency_id
          AND u.id = s.uom_id
          AND COALESCE(
                u.code_translations ->> 'en',
                u.code_translations ->> 'ru',
                u.code_translations ->> 'lt'
            ) IS NOT NULL
        """
    )
    op.drop_column("services", "uom_id")
    op.drop_column("services", "currency_id")
