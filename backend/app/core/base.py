import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, func, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""

    pass


class UUIDMixin:
    """Mixin that adds a UUID primary key column `id`.

    `server_default` здесь не украшение и не «на всякий случай»: все 54 таблицы,
    собранные этим миксином, УЖЕ несут в базе `DEFAULT gen_random_uuid()` — его
    выписали миграции. Модель об этом молчала, и `alembic check` молчал вместе с
    ней, потому что сравнение умолчаний было выключено (см. `alembic/env.py`).
    Как только оно включилось, расхождение всплыло разом у всех 54: автогенерация
    предлагала СНЯТЬ умолчание в базе, раз модель его не объявляет.

    Верным признан вариант базы: строка, вставленная в обход ORM (миграцией,
    сидом, psql), обязана получить ключ, а не упасть. Поэтому объявление
    добавлено в модель, а база не тронута — ни одной новой миграции эта строка
    не требует, и `alembic check` это подтверждает.

    `AuditEntry` и `IdempotencyKey` этот миксин НЕ используют: у них свой `id`
    без серверного умолчания, и в базе его тоже нет — то есть пара сходится и там.
    """

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )


class TimestampMixin:
    """Mixin that adds `created_at` and `updated_at` timestamp columns."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
