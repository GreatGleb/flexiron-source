"""categories_derived_columns

`Category.field_count`, `Category.product_count` and `Category.level` are all
derived at read time and nothing writes them today (П68): `field_count` and
`product_count` are recomputed by the client on every mutation and never by a
write path on this table, and `level` is a pure function of `parent_id`. Same
class of change as `b8f3d0c62a71_suppliers_t1_derived_and_types.py`.

Revision ID: c1a7d9e4f2b3
Revises: d41f6a7c02b9
Create Date: 2026-09-25 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "c1a7d9e4f2b3"
down_revision: Union[str, Sequence[str], None] = "d41f6a7c02b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("categories", "field_count")
    op.drop_column("categories", "product_count")
    op.drop_column("categories", "level")


def downgrade() -> None:
    op.add_column(
        "categories",
        sa.Column("level", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "categories",
        sa.Column("product_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "categories",
        sa.Column("field_count", sa.Integer(), nullable=False, server_default="0"),
    )
