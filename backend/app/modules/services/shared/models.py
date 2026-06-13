import uuid

from sqlalchemy import ForeignKey, Numeric, String
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
    price_unit: Mapped[str] = mapped_column(
        String(20), nullable=False, default="EUR/vnt", server_default="EUR/vnt"
    )
    description_translations: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=dict, server_default="{}")
