import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base, TimestampMixin, UUIDMixin


class FinancePayment(UUIDMixin, TimestampMixin, Base):
    """Payment record (incoming/outgoing), per-tenant."""

    __tablename__ = "finance_payments"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    payment_number: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    direction: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # 'incoming' | 'outgoing'
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending", server_default="pending"
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(10), nullable=False, default="EUR", server_default="EUR"
    )
    counterparty_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    counterparty_name: Mapped[str] = mapped_column(String(255), nullable=False)
    counterparty_vat_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    order_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    order_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    supplier_invoice_ref: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    document_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )

    documents: Mapped[list["PaymentDocument"]] = relationship(
        "PaymentDocument", back_populates="payment", cascade="all, delete-orphan"
    )


class PaymentDocument(UUIDMixin, Base):
    """Document attached to a payment, per-tenant."""

    __tablename__ = "payment_documents"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    payment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("finance_payments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("uploaded_files.id", ondelete="RESTRICT"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    mime: Mapped[str] = mapped_column(String(100), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    payment: Mapped["FinancePayment"] = relationship(
        "FinancePayment", back_populates="documents"
    )


class DocumentArchiveItem(UUIDMixin, Base):
    """Document archive entry (read-only view), per-tenant."""

    __tablename__ = "document_archive_items"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    document_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # 'invoice','facture','waybill','cmr','other'
    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("uploaded_files.id", ondelete="RESTRICT"),
        nullable=False,
    )
    size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    mime: Mapped[str] = mapped_column(String(100), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    related_entity_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    related_entity_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    related_entity_number: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    uploaded_by: Mapped[str] = mapped_column(String(255), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
