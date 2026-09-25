"""Idempotency Internal Service API — public contract for cross-module calls.

Domains that need to honour `Idempotency-Key` (§11 of the API conventions,
detailed in `roo_code/plans/general/сквозное-idempotency-план.md` §3.2–3.3)
MUST go through these three functions. They MUST NOT import
`app.modules.idempotency.shared.models` directly.

No caller exists yet anywhere in the backend — this module is the mechanism
those callers will use, not a wired-up endpoint.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError
from app.modules.idempotency.shared.models import (
    IDEMPOTENCY_KEY_TTL,
    STATE_COMPLETED,
    STATE_IN_PROGRESS,
    IdempotencyKey,
)


@dataclass(frozen=True)
class CachedResponse:
    """The verbatim response of a completed attempt already stored under this key."""

    status_code: int
    body: Any


def _as_utc(value: datetime) -> datetime:
    """SQLite drops the offset on read-back; Postgres keeps it. Treat naive as UTC."""
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


async def begin_attempt(
    db: AsyncSession,
    tenant_id: UUID,
    key: str,
    method: str,
    path: str,
) -> CachedResponse | None:
    """Claim the right to execute, or hand back the previous outcome.

    Returns `None` when the caller must execute the operation (no record, or
    the record expired — an expired record counts as absent, §3.3.2). Returns
    the stored `CachedResponse` when a completed record already answers this
    exact key + method + path (§3.3.3), success or failure alike. Raises
    `ConflictError` when the same key + method + path is still in progress
    (§3.3.4, Р3 of the plan).
    """
    result = await db.execute(
        select(IdempotencyKey).where(
            IdempotencyKey.tenant_id == tenant_id,
            IdempotencyKey.key == key,
            IdempotencyKey.method == method,
            IdempotencyKey.path == path,
        )
    )
    record = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if record is not None and _as_utc(record.expires_at) < now:
        await db.execute(
            delete(IdempotencyKey).where(IdempotencyKey.id == record.id)
        )
        record = None

    if record is None:
        db.add(
            IdempotencyKey(
                tenant_id=tenant_id,
                key=key,
                method=method,
                path=path,
                state=STATE_IN_PROGRESS,
                expires_at=now + IDEMPOTENCY_KEY_TTL,
            )
        )
        await db.flush()
        return None

    if record.state == STATE_COMPLETED:
        return CachedResponse(status_code=record.response_status, body=record.response_body)

    raise ConflictError("Idempotency-Key request is still in progress")


async def complete_attempt(
    db: AsyncSession,
    tenant_id: UUID,
    key: str,
    method: str,
    path: str,
    status_code: int,
    body: Any,
) -> None:
    """Store the outcome — success or failure alike — under this exact key.

    A failed attempt is cached the same way a succeeded one is (§3.3.3, Р4):
    a repeat of a request that failed must fail the same way, not get a
    second try.
    """
    result = await db.execute(
        select(IdempotencyKey).where(
            IdempotencyKey.tenant_id == tenant_id,
            IdempotencyKey.key == key,
            IdempotencyKey.method == method,
            IdempotencyKey.path == path,
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        return

    record.response_status = status_code
    record.response_body = body
    record.state = STATE_COMPLETED
    await db.flush()


async def purge_expired_keys(db: AsyncSession, tenant_id: UUID) -> int:
    """Delete every expired record of one tenant. Returns the number removed."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        delete(IdempotencyKey).where(
            IdempotencyKey.tenant_id == tenant_id,
            IdempotencyKey.expires_at < now,
        )
    )
    await db.flush()
    return result.rowcount or 0
