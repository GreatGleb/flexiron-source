"""warehouse_deficit_and_offcut_link

Closes two schema/client-type discrepancies named by the warehouse contract
(`roo_code/roo-context/api/warehouse.md`, БАГ-23 and БАГ-25).

**БАГ-23 — `warehouse_movements` had no `offcut_id`.** The whole offcut model
(write-off, status, journal) hangs on this field client-side, and the schema
had nowhere to put it. The FK is `ondelete="SET NULL"`, not `RESTRICT`: the
contract fixes that a movement record outlives the offcut it moved
("движения куска остаются висеть на удалённом offcutId") — a `RESTRICT`
policy would block an offcut deletion the domain allows. What happens to the
parent batch's quantity when an offcut is deleted is a separate,
owner-decided question this migration does not touch.

**БАГ-25 — `warehouse_deficits` was missing four columns from the client's
record type, and its `status` default (`"critical"`) was a value from the
*priority* enum (`DeficitPriority`), not the status enum (`DeficitStatus`).**
Adds `priority` (required, no default — the owner has not decided what an
unset priority defaults to), `suggested_order_qty`, `purchase_order_id`, and
`uom_id` (FK → `uoms.id`, `RESTRICT` — every reference to a tenant reference
table is `RESTRICT` per contract §22), and fixes the `status` default to
`"open"`, the value a record is born with per contract.

`product_name` and `deficit_amount` are deliberately NOT added: whether the
client's copy/derived fields become a stored snapshot or a join is still
owner-undecided, and the contract records that explicitly rather than
guessing a shape now.

Existing deficit rows get a backfilled `priority`: the old `status` default
was itself a priority-shaped value (`"critical"`), so any row whose `status`
happens to already be one of the four priority values carries it over as its
`priority`; everything else — including empty tables — falls back to
`"medium"`, the deliberately unremarkable middle value, since no source
column actually recorded a priority to recover.

Revision ID: b5e2f7a31c40
Revises: a7c1d4e90b21
Create Date: 2026-09-25 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "b5e2f7a31c40"
down_revision: Union[str, Sequence[str], None] = "a7c1d4e90b21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "warehouse_movements",
        sa.Column(
            "offcut_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("warehouse_offcuts.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )

    op.add_column(
        "warehouse_deficits",
        sa.Column("priority", sa.String(20), nullable=True),
    )
    op.execute(
        "UPDATE warehouse_deficits SET priority = "
        "CASE WHEN status IN ('critical', 'high', 'medium', 'low') "
        "THEN status ELSE 'medium' END"
    )
    op.alter_column("warehouse_deficits", "priority", nullable=False)

    op.add_column(
        "warehouse_deficits",
        sa.Column("suggested_order_qty", sa.Numeric(12, 2), nullable=True),
    )
    op.add_column(
        "warehouse_deficits",
        sa.Column("purchase_order_id", sa.String(100), nullable=True),
    )
    op.add_column(
        "warehouse_deficits",
        sa.Column(
            "uom_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("uoms.id", ondelete="RESTRICT"),
            nullable=True,
        ),
    )

    op.alter_column(
        "warehouse_deficits",
        "status",
        existing_type=sa.String(20),
        server_default="open",
    )


def downgrade() -> None:
    op.alter_column(
        "warehouse_deficits",
        "status",
        existing_type=sa.String(20),
        server_default="critical",
    )

    op.drop_column("warehouse_deficits", "uom_id")
    op.drop_column("warehouse_deficits", "purchase_order_id")
    op.drop_column("warehouse_deficits", "suggested_order_qty")
    op.drop_column("warehouse_deficits", "priority")

    op.drop_column("warehouse_movements", "offcut_id")
