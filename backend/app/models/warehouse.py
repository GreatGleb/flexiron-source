import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class WarehouseBatch(UUIDMixin, TimestampMixin, Base):
    """Warehouse batch — tracked inventory lot, per-tenant."""

    __tablename__ = "warehouse_batches"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("suppliers.id", ondelete="SET NULL"),
        nullable=True,
    )
    batch_number: Mapped[str] = mapped_column(String(100), nullable=False)
    lot_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    quantity_remaining: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False
    )
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    unit_price: Mapped[float | None] = mapped_column(
        Numeric(12, 4), nullable=True
    )
    total_cost: Mapped[float | None] = mapped_column(
        Numeric(14, 2), nullable=True
    )
    currency: Mapped[str] = mapped_column(
        String(10), nullable=False, default="EUR", server_default="EUR"
    )
    received_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    location: Mapped[str | None] = mapped_column(Text, nullable=True)
    certificate_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="available", server_default="available"
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_ids: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class WarehouseMovement(UUIDMixin, Base):
    """Inventory movement — tracks stock changes, per-tenant."""

    __tablename__ = "warehouse_movements"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("warehouse_batches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    unit_price: Mapped[float | None] = mapped_column(
        Numeric(12, 4), nullable=True
    )
    total_cost: Mapped[float | None] = mapped_column(
        Numeric(14, 2), nullable=True
    )
    reference_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reference_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    from_location: Mapped[str | None] = mapped_column(Text, nullable=True)
    to_location: Mapped[str | None] = mapped_column(Text, nullable=True)
    performed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    moved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class WarehouseOffcut(UUIDMixin, TimestampMixin, Base):
    """Offcut / remnant from a batch, per-tenant."""

    __tablename__ = "warehouse_offcuts"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("warehouse_batches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
    )
    parent_batch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("warehouse_batches.id", ondelete="SET NULL"),
        nullable=True,
    )
    offcut_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="available", server_default="available"
    )
    location: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class WarehouseDeficit(UUIDMixin, TimestampMixin, Base):
    """Stock deficit alert — per product, per-tenant."""

    __tablename__ = "warehouse_deficits"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    batch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("warehouse_batches.id", ondelete="SET NULL"),
        nullable=True,
    )
    current_stock: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False
    )
    min_required: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="critical", server_default="critical"
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class StockItem(UUIDMixin, Base):
    """Aggregated stock overview per product, per-tenant."""

    __tablename__ = "stock_items"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    total_quantity: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False, default=0, server_default="0"
    )
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class StockAuditEntry(UUIDMixin, Base):
    """Audit log for warehouse batch changes, per-tenant."""

    __tablename__ = "stock_audit_entries"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("warehouse_batches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    user_name_ru: Mapped[str] = mapped_column(String(255), nullable=False)
    user_name_en: Mapped[str] = mapped_column(String(255), nullable=False)
    user_name_lt: Mapped[str] = mapped_column(String(255), nullable=False)
    user_initials: Mapped[str] = mapped_column(String(10), nullable=False)
    property_ru: Mapped[str] = mapped_column(String(255), nullable=False)
    property_en: Mapped[str] = mapped_column(String(255), nullable=False)
    property_lt: Mapped[str] = mapped_column(String(255), nullable=False)
    old_value: Mapped[str] = mapped_column(Text, nullable=False)
    new_value: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
