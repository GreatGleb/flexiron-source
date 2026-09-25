"""services_archive_and_price_checks

Услуги переводятся с необратимого удаления на архивирование (П44) и получают
две проверки неотрицательности цены (решение 6 «Что осталось нерешённым»,
`roo_code/roo-context/api/services.md:608-611`).

`archived_at` — момент перевода в архив, `nullable=True`, без значения по
умолчанию: форма выбрана меткой времени, а не булевым флагом, потому что метка
сама отвечает на «когда», а признак архива на проводе выводится из неё. Второй
колонки под тот же факт не заводится (правило домена 3,
`roo_code/roo-context/api/services.md:385-389`).

Составной индекс `(tenant_id, archived_at)` — список услуг по умолчанию отдаёт
живые строки одного арендатора, то есть это условие каждого запроса списка.

`CHECK (cost_price >= 0)` и `CHECK (selling_price >= 0)` — деньги
неотрицательны, и без ограничения в базе проверка живёт только в слайсе, а
миграция и ручная правка проходят мимо неё.

Уникальности имени услуги эта ревизия не заводит: её не требуют ни схема, ни
контракт, и её введение — решение владельца, которого нет.

Revision ID: a9d3c81b6f24
Revises: b8f3d0c62a71
Create Date: 2026-09-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a9d3c81b6f24"
down_revision: Union[str, Sequence[str], None] = "c3f81a26d740"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "services",
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_services_tenant_id_archived_at",
        "services",
        ["tenant_id", "archived_at"],
    )
    op.create_check_constraint(
        "ck_services_cost_price_non_negative",
        "services",
        "cost_price >= 0",
    )
    op.create_check_constraint(
        "ck_services_selling_price_non_negative",
        "services",
        "selling_price >= 0",
    )


def downgrade() -> None:
    op.drop_constraint("ck_services_selling_price_non_negative", "services", type_="check")
    op.drop_constraint("ck_services_cost_price_non_negative", "services", type_="check")
    op.drop_index("ix_services_tenant_id_archived_at", table_name="services")
    op.drop_column("services", "archived_at")
