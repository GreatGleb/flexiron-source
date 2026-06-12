import uuid

from sqlalchemy import ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class Service(UUIDMixin, TimestampMixin, Base):
    """Service/ work item — price list entry, per-tenant."""

    __tablename__ = "services"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name_ru: Mapped[str] = mapped_column(String(255), nullable=False)
    name_en: Mapped[str] = mapped_column(String(255), nullable=False)
    name_lt: Mapped[str] = mapped_column(String(255), nullable=False)
    cost_price: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False, default=0, server_default="0"
    )
    selling_price: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False, default=0, server_default="0"
    )
    price_unit: Mapped[str] = mapped_column(
        String(20), nullable=False, default="EUR/vnt", server_default="EUR/vnt"
    )
    description_ru: Mapped[str | None] = mapped_column(Text, nullable=True)
    description_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    description_lt: Mapped[str | None] = mapped_column(Text, nullable=True)
