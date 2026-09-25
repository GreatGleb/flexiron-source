"""warehouse_batch_uom_link

Closes the schema/form gap the warehouse contract names for
`GET /api/warehouse/batches` (`roo_code/roo-context/api/warehouse.md`): the
list record's `uomId` is a reference to the settings UOM catalog
(`Uom.id`), while `warehouse_batches` only ever stored the unit as a plain
string, `unit`.

Adds `uom_id` — nullable FK to `uoms.id`, `ondelete="SET NULL"` — by the same
technique the table already uses for the purchase-side unit, `received_uom_id`.
`unit` is neither dropped nor renamed: what becomes of it (kept alongside the
reference, backfilled from it, retired later) is not a decision this task
makes; the column carries that in a comment in `shared/models.py`.

`margin_percent` is deliberately NOT added here — the contract holds it as a
separate, undecided question (`roo_code/roo-context/api/warehouse.md`, "POST
/api/warehouse/batches").

Revision ID: b4e7c02a91d3
Revises: b5e2f7a31c40
Create Date: 2026-09-25 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "b4e7c02a91d3"
down_revision: Union[str, Sequence[str], None] = "b5e2f7a31c40"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "warehouse_batches",
        sa.Column(
            "uom_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("uoms.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("warehouse_batches", "uom_id")
