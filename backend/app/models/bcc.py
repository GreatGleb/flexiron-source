import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class BccCategory(UUIDMixin, TimestampMixin, Base):
    """BCC catalog category — tree structure, per-tenant."""

    __tablename__ = "bcc_categories"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name_ru: Mapped[str] = mapped_column(String(255), nullable=False)
    name_en: Mapped[str] = mapped_column(String(255), nullable=False)
    name_lt: Mapped[str] = mapped_column(String(255), nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bcc_categories.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    product_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )

    children: Mapped[list["BccCategory"]] = relationship(
        "BccCategory", back_populates="parent",
        cascade="all, delete-orphan",
        remote_side="BccCategory.id",
    )
    parent: Mapped["BccCategory | None"] = relationship(
        "BccCategory", back_populates="children", remote_side="BccCategory.id"
    )


class BccEvent(UUIDMixin, Base):
    """BCC event — event-sourcing row for request/response tracking, per-tenant."""

    __tablename__ = "bcc_events"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    request_id: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("suppliers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(50), nullable=False
    )
    source: Mapped[str] = mapped_column(
        String(50), nullable=False
    )
    price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    subject: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    attachment_file_ids: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    sender_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
