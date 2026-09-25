import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, func
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
    time_zone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    country_code: Mapped[str | None] = mapped_column(String(2), nullable=True)
    confirmation_code: Mapped[str] = mapped_column(
        String(4), nullable=False, default="", server_default=""
    )
    logo_file_id: Mapped[str | None] = mapped_column(String(255), nullable=True)


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
    default_discount_percent: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, default=0, server_default="0"
    )
    payment_deferral_days: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    default_kerf_mm: Mapped[float] = mapped_column(
        Numeric(6, 2), nullable=False, default=3, server_default="3"
    )
    reservation_hold_days: Mapped[int] = mapped_column(
        Integer, nullable=False, default=3, server_default="3"
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
    is_default: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    __table_args__ = (
        Index("ix_currencies_tenant_code", "tenant_id", "code", unique=True),
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
        ForeignKey("uoms.id", ondelete="RESTRICT"),
        nullable=False,
    )
    to_uom_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("uoms.id", ondelete="RESTRICT"),
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


class MailSettings(UUIDMixin, TimestampMixin, Base):
    """Mail server parameters — singleton per tenant.

    The form behind these columns is the `Почта` tab
    (`views/admin/settings/MailSettings.vue`); the fields are exactly the ones
    the already-written SMTP transport in `bcc` expects to be handed.

    `password_encrypted` is the one field the frontend type does not have: by
    П59 the password is written and never read back, and it is stored
    **encrypted** rather than as-is — anybody with database access would
    otherwise read the company's mail password. Encryption lives in
    `app/core/crypto.py`.
    """

    __tablename__ = "mail_settings"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # singleton: one row per tenant
        index=True,
    )
    host: Mapped[str] = mapped_column(
        String(255), nullable=False, default="", server_default=""
    )
    port: Mapped[int] = mapped_column(
        Integer, nullable=False, default=587, server_default="587"
    )
    encryption: Mapped[str] = mapped_column(
        String(20), nullable=False, default="starttls", server_default="starttls"
    )
    username: Mapped[str] = mapped_column(
        String(255), nullable=False, default="", server_default=""
    )
    password_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    from_email: Mapped[str] = mapped_column(
        String(255), nullable=False, default="", server_default=""
    )
    from_name: Mapped[str] = mapped_column(
        String(255), nullable=False, default="", server_default=""
    )


class WarehouseMap(UUIDMixin, TimestampMixin, Base):
    """Warehouse map — one image per tenant, no version history (П65 а).

    The owner's decision leaves the storage form to the server ("просто картинка,
    хранить как удобно") and binds it to two things that are not columns:

    * **П11 — the column keeps a file identifier, never a link.** The reference is
      derived, signed and short-lived (~15 minutes), and it is assembled on read;
      a stored link would be a stored derived value, which this domain does not
      keep (П68). The column below is therefore named for the identifier, and no
      column holds the link at all — it is built in `domain.py`, on every read.
    * **П31 — the `PUT` that writes this row *is* the `Save` that lifts the draft
      mark.** The mark is not a column here: it lives on
      `uploaded_files.is_draft`, and this table only names the file. A map
      uploaded and never confirmed therefore stays a draft and leaves by TTL.

    The four metadata fields travel as a JSON document rather than four columns:
    П65 leaves the shape to the server, and name, mime, size and uploadedAt are
    the `WarehouseMapFile` the frontend already holds as one object
    (`types/settings.ts:111-119`). The attribute is **not** named `metadata` —
    that name belongs to `Base.metadata` on every declarative class.

    Who deletes the binary of a map that was attached and then orphaned by a
    replacement or a deletion is owner question **В4** and it is open: neither
    this table nor its endpoints decide it.
    """

    __tablename__ = "warehouse_map"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # singleton: one map per tenant
        index=True,
    )
    map_file_id: Mapped[str] = mapped_column(String(255), nullable=False)
    file_metadata: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )


class OrderPermissions(UUIDMixin, TimestampMixin, Base):
    """Order pricing permission matrix — three role lists, singleton per tenant.

    Backs `GET /api/settings/order-permissions` (contract, "Права заказа"): a
    transitional form (П15) kept apart from the general CRUD permission matrix
    (`PermissionItem`/`RolePermission`/`UserPermission` in `auth/shared/models.py`)
    until that matrix covers every domain. There is no write endpoint — the row
    is seeded once, on first read, with the values the frontend mock has carried
    since before this table existed (`mocks/settings.ts:64-68`).
    """

    __tablename__ = "order_permissions"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # singleton: one row per tenant
        index=True,
    )
    see_cost_roles: Mapped[list] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    manual_cost_roles: Mapped[list] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    correction_roles: Mapped[list] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
