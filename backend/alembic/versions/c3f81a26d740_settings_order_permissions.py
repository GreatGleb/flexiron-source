"""settings_order_permissions

Storage for `GET /api/settings/order-permissions` (contract, "Права заказа"):
the model of rights is decided (§6 conventions, П15) but the module had no
permission model of its own — the six existing classes in
`settings/shared/models.py` are `CompanyInfo`, `GlobalConstants`, `Currency`,
`Uom`, `UomConversion`, `OrderStatusSetting`. This is a transitional table,
one row per tenant, three role-name lists: `see_cost_roles`, `manual_cost_roles`,
`correction_roles`. It is not the general CRUD permission matrix
(`permission_items` / `role_permissions` / `user_permissions`) and does not
replace it — the three become elements of that matrix later (П15).

Revision ID: c3f81a26d740
Revises: b4e7c02a91d3
Create Date: 2026-09-25 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "c3f81a26d740"
down_revision: Union[str, Sequence[str], None] = "b4e7c02a91d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "order_permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),
        sa.Column("see_cost_roles", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("manual_cost_roles", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("correction_roles", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("order_permissions")
