"""phase_4_services

Per-tenant: services (work/service price list).

Revision ID: d730d0aa32ef
Revises: 25245d4bf874
Create Date: 2026-06-11 23:05:32.202850

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "d730d0aa32ef"
down_revision: Union[str, Sequence[str], None] = "25245d4bf874"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "services",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name_ru", sa.String(255), nullable=False),
        sa.Column("name_en", sa.String(255), nullable=False),
        sa.Column("name_lt", sa.String(255), nullable=False),
        sa.Column("cost_price", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("selling_price", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("price_unit", sa.String(20), nullable=False, server_default="EUR/vnt"),
        sa.Column("description_ru", sa.Text(), nullable=True),
        sa.Column("description_en", sa.Text(), nullable=True),
        sa.Column("description_lt", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("services")
