"""Repository for the finance.archive read slice (Infrastructure / Data Access layer)."""

from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.finance.shared.models import DocumentArchiveItem


def _search_predicate(search: str):
    """Case-insensitive substring match across the two searchable fields.

    `ilike` against a NULL `related_entity_number` evaluates to NULL/false in SQL —
    it never raises, so a document without a related entity simply does not match,
    no guard needed (same rule as `finance.features.payments.repository`).
    """
    pattern = f"%{search}%"
    return or_(
        DocumentArchiveItem.name.ilike(pattern),
        DocumentArchiveItem.related_entity_number.ilike(pattern),
    )


async def _filtered_query(
    tenant_id: UUID,
    *,
    search: str | None,
    document_type: str | None,
    related_entity_type: str | None,
):
    """Shared WHERE clause for both the count and the page — one place for the rule."""
    query = select(DocumentArchiveItem).where(DocumentArchiveItem.tenant_id == tenant_id)
    if document_type:
        query = query.where(DocumentArchiveItem.document_type == document_type)
    if related_entity_type:
        query = query.where(DocumentArchiveItem.related_entity_type == related_entity_type)
    if search:
        query = query.where(_search_predicate(search))
    return query


async def count_archive_items(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    search: str | None = None,
    document_type: str | None = None,
    related_entity_type: str | None = None,
) -> int:
    """Total rows matching the filters, tenant-scoped."""
    query = await _filtered_query(
        tenant_id,
        search=search,
        document_type=document_type,
        related_entity_type=related_entity_type,
    )
    count_stmt = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_stmt)
    return result.scalar() or 0


async def list_archive_items(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    search: str | None = None,
    document_type: str | None = None,
    related_entity_type: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> list[DocumentArchiveItem]:
    """One page of archive documents, tenant-scoped, newest upload first then by id."""
    query = await _filtered_query(
        tenant_id,
        search=search,
        document_type=document_type,
        related_entity_type=related_entity_type,
    )
    query = query.order_by(
        DocumentArchiveItem.uploaded_at.desc(), DocumentArchiveItem.id.asc()
    )
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all())
