import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, UUIDMixin


class Notification(UUIDMixin, Base):
    """One row per event, per tenant — not per addressee (П10).

    Who has read it lives on `NotificationRead`, not on this row: a shared feed
    read by five people would otherwise need five copies of the same snapshot
    text. `event_key` is the dedup handle an emitter checks before writing again
    after a restart (П56) — the `UniqueConstraint` below is the mechanism, not
    just a marker: a second insert with the same key fails instead of being
    looked up first.
    """

    __tablename__ = "notifications"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    title_translations: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    message_translations: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(100), nullable=False)
    event_key: Mapped[str] = mapped_column(String(200), nullable=False)
    requires_action: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false",
    )
    email_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "event_key", name="uq_notifications_tenant_event_key"),
        Index(
            "ix_notifications_tenant_created_at_id",
            "tenant_id", created_at.desc(), "id",
        ),
    )


class NotificationRead(UUIDMixin, Base):
    """Per-reader read marker — the personal half of П10's split.

    A feed row is shared; whether *this* user has seen it is not, so it lives
    here instead of a flag on `Notification` that every addressee would fight
    over.
    """

    __tablename__ = "notification_reads"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    notification_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notifications.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    read_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "notification_id", "user_id",
            name="uq_notification_reads_tenant_notification_user",
        ),
        Index("ix_notification_reads_tenant_notification", "tenant_id", "notification_id"),
    )


class NotificationSubscription(UUIDMixin, Base):
    """Per-user opt-in for a notification type on a delivery channel (П54)."""

    __tablename__ = "notification_subscriptions"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    # Falls back to the user's account email when unset — not every channel row
    # needs its own address on record.
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "user_id", "type", "channel",
            name="uq_notification_subscriptions_tenant_user_type_channel",
        ),
    )
