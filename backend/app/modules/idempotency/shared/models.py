import uuid
from datetime import datetime, timedelta

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base

# П46 (сквозное: `roo_code/plans/general/сквозное-idempotency-план.md`, §3.2): срок
# жизни записи — 24 часа от момента, когда сервер её принял. Ни один домен не
# назначает себе другой срок, и число объявлено здесь один раз, а не литералом
# в каждом месте, которое его читает.
IDEMPOTENCY_KEY_TTL = timedelta(hours=24)

STATE_IN_PROGRESS = "in_progress"
STATE_COMPLETED = "completed"


class IdempotencyKey(Base):
    """One `Idempotency-Key` request, addressed by tenant + key + method + path.

    The request body is deliberately absent from the addressing tuple (§3.2):
    the same key with a different body on the same method and path still
    resolves to the first stored response, not to an error.
    """

    __tablename__ = "idempotency_keys"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    key: Mapped[str] = mapped_column(String(255), nullable=False)
    method: Mapped[str] = mapped_column(String(10), nullable=False)
    path: Mapped[str] = mapped_column(String(255), nullable=False)
    state: Mapped[str] = mapped_column(
        String(20), nullable=False, default=STATE_IN_PROGRESS
    )
    response_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    response_body: Mapped[dict | list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "key", "method", "path",
            name="uq_idempotency_keys_tenant_key_method_path",
        ),
    )
