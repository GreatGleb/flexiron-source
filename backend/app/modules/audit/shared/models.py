import os
import time
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base


def generate_uuid7() -> uuid.UUID:
    """UUIDv7 (RFC 9562) primary key generator.

    `UUIDMixin` (app/core/base.py) defaults to `uuid.uuid4`, which scatters
    inserts across the primary key index at random. The feed's main query
    orders by insertion time, so this table's key needs to sort that way
    instead — hence a dedicated generator rather than the shared mixin.
    """
    unix_ts_ms = time.time_ns() // 1_000_000
    rand_a = int.from_bytes(os.urandom(2), "big") & 0x0FFF
    rand_b = int.from_bytes(os.urandom(8), "big") & 0x3FFFFFFFFFFFFFFF

    value = unix_ts_ms << 80
    value |= 0x7 << 76
    value |= rand_a << 64
    value |= 0b10 << 62
    value |= rand_b
    return uuid.UUID(int=value)


AUDIT_ENTITY_TYPES: tuple[str, ...] = (
    "product",
    "order",
    "client",
    "supplier",
    "batch",
    "stock",
    "offcut",
    "movement",
    "deficit",
)
"""The closed set of entity kinds the journal knows, same nine as
`AUDIT_ENTITY_TYPES` in `frontend_vue/src/types/audit.ts`. `entity_type`
itself stays a plain `String(32)` column — this is a Python-side guard, not
a DB constraint, so it adds no migration."""


class AuditEntry(Base):
    """One change record in the shared audit feed.

    Nine domain modules write here through `internal_api.interface`; no
    module owns a private copy of this table. `entity_label` is deliberately
    absent — it is derived at read time, not stored.
    """

    __tablename__ = "audit_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=generate_uuid7,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    user_name_translations: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )
    user_initials: Mapped[str] = mapped_column(String(10), nullable=False)
    property_translations: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )
    old_value: Mapped[str] = mapped_column(Text, nullable=False)
    new_value: Mapped[str] = mapped_column(Text, nullable=False)
    sensitive: Mapped[str | None] = mapped_column(String(32), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        Index(
            "ix_audit_entries_tenant_timestamp_id",
            "tenant_id",
            timestamp.desc(),
            "id",
        ),
        Index(
            "ix_audit_entries_tenant_entity",
            "tenant_id",
            "entity_type",
            "entity_id",
        ),
    )
