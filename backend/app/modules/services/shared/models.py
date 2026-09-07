import uuid

from sqlalchemy import ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, TimestampMixin, UUIDMixin


class Service(UUIDMixin, TimestampMixin, Base):
    """Service / work item — price list entry, per-tenant."""

    __tablename__ = "services"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name_translations: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    cost_price: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False, default=0, server_default="0"
    )
    selling_price: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False, default=0, server_default="0"
    )
    # Валюта цены — ссылка в справочник арендатора. Раньше здесь стояла сваренная
    # строка `price_unit` ("EUR/vnt"), из-за которой услуга в валюте, отличной от
    # евро, была невыразима. Nullable и RESTRICT — как у `products.currency_id`.
    currency_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("currencies.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    # За что берётся цена — единица из справочника арендатора.
    uom_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("uoms.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    description_translations: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=dict, server_default="{}")
