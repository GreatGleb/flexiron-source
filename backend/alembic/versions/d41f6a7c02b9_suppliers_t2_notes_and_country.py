"""suppliers_t2_notes_and_country

T2 of the suppliers domain plan — schema migration: notes as records, country as a code.

Two changes:

1. `Supplier.notes` (`Text`) — dropped. П35: internal notes become records, each with its
   own date and author, unlimited in number; the old column held them glued into one string
   with no author at all. Саму таблицу `supplier_notes` завела ревизия `e7a3c81b04f6` —
   здесь снимается только колонка, которую она заменила, второй раз таблицу не создаём.
2. `Supplier.country` / `SupplierAddress.country` — narrowed from `String(100)` to
   `String(2)`. П67: country is an ISO 3166-1 alpha-2 code, not free text. No enum/CHECK is
   added here — nothing writes these columns yet, since the module has no routes.

Revision ID: d41f6a7c02b9
Revises: d4c8a1f37b62
Create Date: 2026-09-25 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "d41f6a7c02b9"
down_revision: Union[str, Sequence[str], None] = "d4c8a1f37b62"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. остаток П35: сама таблица заметок уже создана ревизией e7a3c81b04f6,
    # здесь снимается только колонка, которую она заменила ──
    op.drop_column("suppliers", "notes")

    # ── 2. country becomes an ISO 3166-1 alpha-2 code (П67) ──
    op.alter_column(
        "suppliers",
        "country",
        existing_type=sa.String(100),
        type_=sa.String(2),
        nullable=True,
    )
    op.alter_column(
        "supplier_addresses",
        "country",
        existing_type=sa.String(100),
        type_=sa.String(2),
        nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "supplier_addresses",
        "country",
        existing_type=sa.String(2),
        type_=sa.String(100),
        nullable=False,
    )
    op.alter_column(
        "suppliers",
        "country",
        existing_type=sa.String(2),
        type_=sa.String(100),
        nullable=True,
    )

    op.add_column(
        "suppliers",
        sa.Column("notes", sa.Text(), nullable=True),
    )
