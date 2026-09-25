"""Domain use cases for the notifications.feed slice.

List, unread count, mark-one-read, mark-all-read — no FastAPI, no DB session
management, pure business logic.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError

from .repository import count_notifications, count_unread, get_notification_by_id
from .repository import list_notifications as list_notifications_repo
from .repository import mark_all_read as mark_all_read_repo
from .repository import mark_read as mark_read_repo
from .schemas import NotificationListItem, NotificationListResponse

MAX_PAGE_SIZE = 100

#: `entityType` → `entityRouteName`, the five pairs the contract names
#: (`roo_code/roo-context/api/notifications.md`, "Производные значения", п.4).
ENTITY_ROUTE_NAMES: dict[str, str] = {
    "order": "admin-order-card",
    "client": "admin-client-card",
    "supplier": "admin-supplier-card",
    "product": "admin-product-card",
    "batch": "admin-warehouse-batch",
}

#: `sortBy` accepts exactly these two values (contract, `GET /api/notifications`).
SORT_FIELDS = ("createdAt", "type")


def _normalize_search(search: str | None) -> str | None:
    """Empty string means "no filter" (§13 conventions)."""
    if search is None or not search.strip():
        return None
    return search


def _normalize_type(type_: str | None) -> str | None:
    """Empty string and `all` both mean "no filter" (§13 conventions)."""
    if not type_ or type_ == "all":
        return None
    return type_


def _normalize_is_read(is_read: str | None) -> bool | None:
    """Three-valued filter: `''`/absent → all, `'true'`/`'false'` → one side."""
    if is_read == "true":
        return True
    if is_read == "false":
        return False
    return None


def _normalize_sort_by(sort_by: str | None) -> str:
    return sort_by if sort_by in SORT_FIELDS else "createdAt"


def _normalize_sort_dir(sort_dir: str | None) -> str:
    return sort_dir if sort_dir in ("asc", "desc") else "desc"


def _to_list_item(entity) -> NotificationListItem:
    return NotificationListItem(
        id=entity.id,
        type=entity.type,
        title=entity.title_translations,
        message=entity.message_translations,
        entityType=entity.entity_type,
        entityId=entity.entity_id,
        entityRouteName=ENTITY_ROUTE_NAMES.get(entity.entity_type, ""),
        isRead=entity.is_read,
        createdAt=entity.created_at,
    )


async def list_notifications(
    db: AsyncSession,
    tenant_id: UUID,
    user_id: UUID,
    *,
    search: str | None,
    type_: str | None,
    is_read: str | None,
    sort_by: str | None,
    sort_dir: str | None,
    page: int,
    page_size: int,
) -> NotificationListResponse:
    """Execute the list-feed use case — tenant- and user-scoped, paginated."""
    search = _normalize_search(search)
    type_ = _normalize_type(type_)
    is_read_value = _normalize_is_read(is_read)
    sort_by = _normalize_sort_by(sort_by)
    sort_dir = _normalize_sort_dir(sort_dir)
    page = max(page, 1)
    page_size = min(max(page_size, 1), MAX_PAGE_SIZE)

    total = await count_notifications(
        db, tenant_id, user_id, search=search, type_=type_, is_read=is_read_value
    )
    entities = await list_notifications_repo(
        db,
        tenant_id,
        user_id,
        search=search,
        type_=type_,
        is_read=is_read_value,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )

    return NotificationListResponse(
        items=[_to_list_item(entity) for entity in entities],
        total=total,
        page=page,
        pageSize=page_size,
        totalPages=max(1, -(-total // page_size)),
    )


async def get_unread_count(db: AsyncSession, tenant_id: UUID, user_id: UUID) -> int:
    """Execute the unread-count use case — global to the caller, ignores list filters."""
    return await count_unread(db, tenant_id, user_id)


async def mark_notification_read(
    db: AsyncSession, tenant_id: UUID, user_id: UUID, notification_id: UUID
) -> NotificationListItem:
    """Execute the mark-one-read use case.

    Scoped by `(user_id, tenant_id)`: an unknown or foreign id is simply not
    found by the repository query, so both cases raise the same refusal.
    """
    entity = await get_notification_by_id(db, notification_id, tenant_id, user_id)
    if entity is None:
        raise NotFoundError(entity="Notification", entity_id=str(notification_id))
    entity = await mark_read_repo(db, entity)
    return _to_list_item(entity)


async def mark_all_read(db: AsyncSession, tenant_id: UUID, user_id: UUID) -> None:
    """Execute the mark-all-read use case — always all, list filters do not apply."""
    await mark_all_read_repo(db, tenant_id, user_id)
