"""Repository for the audit.feed read slice (Infrastructure / Data Access layer)."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.audit.shared.models import AuditEntry


async def list_feed_entries(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    entity_type: str | None = None,
    date_from: datetime | None = None,
    date_to_exclusive: datetime | None = None,
) -> list[AuditEntry]:
    """Every row within tenant/entity_type/date range, newest first, then by id.

    `user` and `search` are deliberately not pushed into this `WHERE`: dict-key
    equality on `user_name_translations['en']` and a substring match across
    `property_translations`'s three keys plus `old_value`/`new_value` would
    need Postgres-only JSON operators, which do not exist for this slice's own
    test session (a fake one, per this feature's test file). Both are applied
    by `domain.py` to the rows this returns, in Python, preserving the order
    established here. `tenant_id`, `entity_type` and the date range stay real
    SQL, and so does the `timestamp DESC, id ASC` order — without the second
    key, two rows sharing a `timestamp` would not have a stable position, and
    the page would stop being a slice of one list (contract, rule 7).
    """
    query = select(AuditEntry).where(AuditEntry.tenant_id == tenant_id)
    if entity_type:
        query = query.where(AuditEntry.entity_type == entity_type)
    if date_from is not None:
        query = query.where(AuditEntry.timestamp >= date_from)
    if date_to_exclusive is not None:
        query = query.where(AuditEntry.timestamp < date_to_exclusive)
    query = query.order_by(AuditEntry.timestamp.desc(), AuditEntry.id.asc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def list_feed_authors(db: AsyncSession, tenant_id: UUID) -> list[AuditEntry]:
    """Every row of the tenant, oldest first — source of the user filter.

    Independent of any feed filter (contract, rule 9: a filter that could
    narrow itself would strand the person who set it with no way back).
    Oldest-first order makes "first encountered" in `domain.py`'s
    de-duplication by key deterministic instead of database-order-dependent.
    """
    query = (
        select(AuditEntry)
        .where(AuditEntry.tenant_id == tenant_id)
        .order_by(AuditEntry.timestamp.asc(), AuditEntry.id.asc())
    )
    result = await db.execute(query)
    return list(result.scalars().all())
