"""Domain use case for the finance.archive slice — list only, no mutations.

Contains pure business logic — no FastAPI, no DB session management.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.finance.shared.models import DocumentArchiveItem

from .repository import count_archive_items, list_archive_items
from .schemas import ArchiveListItem, ArchiveListResponse

#: Same ceiling as `finance.features.payments.domain.MAX_PAGE_SIZE` — one project-wide
#: number, not a second one invented for this slice.
MAX_PAGE_SIZE = 100


def _normalize_filter(value: str | None) -> str | None:
    """Empty string and `all` both mean "no filter" (§13 conventions)."""
    if not value or value == "all":
        return None
    return value


def _normalize_search(search: str | None) -> str | None:
    if search is None or not search.strip():
        return None
    return search


def _to_list_item(entity: DocumentArchiveItem) -> ArchiveListItem:
    return ArchiveListItem(
        id=entity.id,
        name=entity.name,
        type=entity.document_type,
        fileId=entity.file_id,
        url=entity.url,
        size=entity.size,
        mime=entity.mime,
        relatedEntityType=entity.related_entity_type,
        relatedEntityId=entity.related_entity_id,
        relatedEntityNumber=entity.related_entity_number,
        uploadedAt=entity.uploaded_at,
        # Наружу уходит снимок имени: ссылка `uploaded_by_user_id` может стать NULL
        # вместе с удалённым пользователем, а подпись в архиве обязана остаться (П36).
        uploadedBy=entity.uploaded_by_name,
    )


async def list_archive(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    search: str | None,
    type: str | None,
    related_entity_type: str | None,
    page: int,
    page_size: int,
) -> ArchiveListResponse:
    """Execute the list archive documents use case."""
    search = _normalize_search(search)
    document_type = _normalize_filter(type)
    related_entity_type = _normalize_filter(related_entity_type)
    page = max(page, 1)
    page_size = min(max(page_size, 1), MAX_PAGE_SIZE)

    total = await count_archive_items(
        db,
        tenant_id,
        search=search,
        document_type=document_type,
        related_entity_type=related_entity_type,
    )
    entities = await list_archive_items(
        db,
        tenant_id,
        search=search,
        document_type=document_type,
        related_entity_type=related_entity_type,
        page=page,
        page_size=page_size,
    )

    return ArchiveListResponse(
        items=[_to_list_item(entity) for entity in entities],
        total=total,
        page=page,
        pageSize=page_size,
        totalPages=max(1, -(-total // page_size)),
    )
