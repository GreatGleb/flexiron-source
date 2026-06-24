import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, TimestampMixin, UUIDMixin


class CompanyInfo(UUIDMixin, TimestampMixin, Base):
    """Company legal info — singleton per tenant (one row per tenant)."""

    __tablename__ = "company_info"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # singleton: one row per tenant
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    legal_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    vat_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bank_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    bank_account: Mapped[str | None] = mapped_column(String(100), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)


class GlobalConstants(UUIDMixin, Base):
    """Financial constants — singleton per tenant."""

    __tablename__ = "global_constants"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # singleton
        index=True,
    )
    vat_rate: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, default=21, server_default="21"
    )
    default_margin: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, default=15, server_default="15"
    )
    default_currency: Mapped[str] = mapped_column(
        String(10), nullable=False, default="EUR", server_default="EUR"
    )
    default_discount_percent: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, default=0, server_default="0"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Currency(UUIDMixin, TimestampMixin, Base):
    """Currency definition — per tenant."""

    __tablename__ = "currencies"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code: Mapped[str] = mapped_column(String(10), nullable=False)
    name_translations: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    exchange_rate: Mapped[float] = mapped_column(
        Numeric(12, 6), nullable=False, default=1, server_default="1"
    )
    is_default: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_currencies_tenant_code"),
    )


class Uom(UUIDMixin, TimestampMixin, Base):
    """Unit of measure — per tenant."""

    __tablename__ = "uoms"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code_translations: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    name_translations: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    category: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # 'weight','length','area','volume','quantity','density','thickness'


class UomConversion(UUIDMixin, TimestampMixin, Base):
    """Conversion rule between two UOMs — per tenant."""

    __tablename__ = "uom_conversions"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_uom_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("uoms.id", ondelete="CASCADE"),
        nullable=False,
    )
    to_uom_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("uoms.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # 'static' | 'dynamic'
    factor: Mapped[float | None] = mapped_column(
        Numeric(20, 10), nullable=True
    )
    formula_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )


class OrderStatusSetting(UUIDMixin, TimestampMixin, Base):
    """Order status definition — per tenant."""

    __tablename__ = "order_statuses"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name_translations: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    color: Mapped[str] = mapped_column(String(7), nullable=False)
    sort_order: Mapped[int] = mapped_column(nullable=False)
    is_system: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    reserve_on_transition: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    write_off_on_transition: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
