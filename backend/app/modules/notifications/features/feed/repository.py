"""Repository for the notifications.feed slice (Infrastructure / Data Access layer)."""

from uuid import UUID

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notifications.shared.models import Notification

#: The six JSONB keys `search` matches against — title/message × three locales.
SEARCH_LOCALES = ("ru", "en", "lt")

#: `sortBy` accepts exactly these two values; anything else falls back upstream.
SORT_COLUMNS = {
    "createdAt": Notification.created_at,
    "type": Notification.type,
}


def _search_predicate(search: str):
    """Case-insensitive substring match across all six translation keys."""
    pattern = f"%{search}%"
    conditions = [
        column[locale].astext.ilike(pattern)
        for column in (Notification.title_translations, Notification.message_translations)
        for locale in SEARCH_LOCALES
    ]
    return or_(*conditions)


async def _filtered_query(
    tenant_id: UUID,
    user_id: UUID,
    *,
    search: str | None,
    type_: str | None,
    is_read: bool | None,
):
    """Shared WHERE clause for both the count and the page — one place for the rule.

    Scoped by `tenant_id` *and* `user_id`: a notification is addressed to one
    user, not shared across the tenant (`shared/models.py`, both columns
    `nullable=False, index=True`).
    """
    query = select(Notification).where(
        Notification.tenant_id == tenant_id,
        Notification.user_id == user_id,
    )
    if type_:
        query = query.where(Notification.type == type_)
    if is_read is not None:
        query = query.where(Notification.is_read == is_read)
    if search:
        query = query.where(_search_predicate(search))
    return query


async def count_notifications(
    db: AsyncSession,
    tenant_id: UUID,
    user_id: UUID,
    *,
    search: str | None = None,
    type_: str | None = None,
    is_read: bool | None = None,
) -> int:
    """Total rows matching the filters, scoped to this caller."""
    query = await _filtered_query(tenant_id, user_id, search=search, type_=type_, is_read=is_read)
    count_stmt = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_stmt)
    return result.scalar() or 0


async def list_notifications(
    db: AsyncSession,
    tenant_id: UUID,
    user_id: UUID,
    *,
    search: str | None = None,
    type_: str | None = None,
    is_read: bool | None = None,
    sort_by: str = "createdAt",
    sort_dir: str = "desc",
    page: int = 1,
    page_size: int = 25,
) -> list[Notification]:
    """One page of the caller's own feed, tie-broken by `id` (contract, `sortBy`)."""
    query = await _filtered_query(tenant_id, user_id, search=search, type_=type_, is_read=is_read)
    column = SORT_COLUMNS.get(sort_by, Notification.created_at)
    ordered = column.desc() if sort_dir == "desc" else column.asc()
    query = query.order_by(ordered, Notification.id.asc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all())


async def count_unread(db: AsyncSession, tenant_id: UUID, user_id: UUID) -> int:
    """Bare count of the caller's unread notifications — no list filters applied.

    Shares `_filtered_query`'s WHERE clause (tenant + user scoping) rather than
    a second copy of it — only `is_read` is fixed, `search`/`type_` stay unset.
    """
    query = await _filtered_query(tenant_id, user_id, search=None, type_=None, is_read=False)
    count_stmt = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_stmt)
    return result.scalar() or 0


async def get_notification_by_id(
    db: AsyncSession, notification_id: UUID, tenant_id: UUID, user_id: UUID
) -> Notification | None:
    """Fetch one notification, scoped to `(user_id, tenant_id)`.

    A foreign or unknown id simply is not found by this query — there is no
    separate ownership check to bypass.
    """
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.tenant_id == tenant_id,
            Notification.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def mark_read(db: AsyncSession, notification: Notification) -> Notification:
    """Flip one already-fetched, already-owned notification to read."""
    notification.is_read = True
    # `flush`, а не `commit`: границу транзакции держит `get_db`, и она в проекте одна.
    # Сторож `tests/test_transaction_boundary.py` ловит размножение границы — сосед по
    # тому же правилу, `finance/payments/repository.py:172`, тоже обходится `flush`.
    await db.flush()
    await db.refresh(notification)
    return notification


async def mark_all_read(db: AsyncSession, tenant_id: UUID, user_id: UUID) -> None:
    """Mark every one of the caller's own notifications read, one `UPDATE`."""
    await db.execute(
        update(Notification)
        .where(
            Notification.tenant_id == tenant_id,
            Notification.user_id == user_id,
        )
        .values(is_read=True)
    )
    await db.flush()
