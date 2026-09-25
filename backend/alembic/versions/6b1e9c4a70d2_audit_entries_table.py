"""audit_entries_table

Shared change-history journal (`audit` module, M1 of the audit-feed domain
plan). Nine domain modules will write to this one table through
`app.modules.audit.internal_api.interface`; no rows are migrated here and the
legacy `stock_audit_entries` / `supplier_audit_entries` tables are untouched
— that merge is a separate task.

Revision ID: 6b1e9c4a70d2
Revises: c1d2e3f4a5b6
Create Date: 2026-09-25 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "6b1e9c4a70d2"
down_revision: Union[str, Sequence[str], None] = "c1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "audit_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entity_type", sa.String(length=32), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "user_name_translations",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column("user_initials", sa.String(length=10), nullable=False),
        sa.Column(
            "property_translations",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column("old_value", sa.Text(), nullable=False),
        sa.Column("new_value", sa.Text(), nullable=False),
        sa.Column("sensitive", sa.String(length=32), nullable=True),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_audit_entries_tenant_entity",
        "audit_entries",
        ["tenant_id", "entity_type", "entity_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_audit_entries_tenant_id"),
        "audit_entries",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        "ix_audit_entries_tenant_timestamp_id",
        "audit_entries",
        ["tenant_id", sa.literal_column("timestamp DESC"), "id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_audit_entries_tenant_timestamp_id", table_name="audit_entries")
    op.drop_index(op.f("ix_audit_entries_tenant_id"), table_name="audit_entries")
    op.drop_index("ix_audit_entries_tenant_entity", table_name="audit_entries")
    op.drop_table("audit_entries")
