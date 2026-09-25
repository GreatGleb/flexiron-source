"""Repository for the clients.read_clients slice (Infrastructure / Data Access layer)."""

from typing import Any
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.clients.shared.models import Client, ClientInteraction

#: Fixed allow-list of sortable columns — never a bare `getattr(Model, sort_by)`
#: on request input.
SORTABLE_COLUMNS: dict[str, Any] = {
    "name": Client.name,
    "email": Client.email,
    "status": Client.status,
    "createdAt": Client.created_at,
}


async def _filtered_query(tenant_id: UUID, *, search: str | None, status: str | None):
    """Shared WHERE clause for both the count and the page — one place for the rule.

    `search` matches all three of `name`, `companyCode`, `email` at once
    (contract `clients.md`, "GET /api/clients", rule 13) — never just one of
    them, which is the exact gap the contract already flags between two
    frontend call sites. Declared `async` (it awaits nothing itself) so its
    tenant filter is visible to callers through a real `await`, the same
    shape `warehouse.list_batches.repository._filtered_query` already uses.
    """
    query = select(Client).where(Client.tenant_id == tenant_id)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                Client.name.ilike(pattern),
                Client.company_code.ilike(pattern),
                Client.email.ilike(pattern),
            )
        )
    if status:
        query = query.where(Client.status == status)
    return query


async def count_clients(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    search: str | None = None,
    status: str | None = None,
) -> int:
    """Total rows matching the filters, tenant-scoped."""
    query = await _filtered_query(tenant_id, search=search, status=status)
    count_stmt = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_stmt)
    return result.scalar() or 0


async def list_clients(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    search: str | None = None,
    status: str | None = None,
    sort_by: str | None = None,
    sort_desc: bool = False,
    page: int = 1,
    page_size: int = 25,
) -> list[Client]:
    """One page of clients, tenant-scoped, sorted, paginated.

    An unknown or absent `sort_by` falls back to `createdAt ASC` — the
    domain layer names why (`domain.py`, `DEFAULT_SORT_BY`). Ties break by
    `id` ascending so pagination stays stable across pages when the sort
    column repeats.
    """
    query = await _filtered_query(tenant_id, search=search, status=status)
    column = SORTABLE_COLUMNS.get(sort_by) if sort_by else None
    if column is not None:
        order = column.desc() if sort_desc else column.asc()
        query = query.order_by(order, Client.id.asc())
    else:
        query = query.order_by(Client.created_at.asc(), Client.id.asc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_client_by_id(db: AsyncSession, client_id: UUID, tenant_id: UUID) -> Client | None:
    """Fetch a client by its id, tenant-scoped.

    Mutation target: drop `Client.tenant_id == tenant_id` here and a foreign
    tenant's client becomes readable by id.
    """
    result = await db.execute(
        select(Client).where(Client.id == client_id, Client.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def list_interactions(
    db: AsyncSession, client_id: UUID, tenant_id: UUID
) -> list[ClientInteraction]:
    """All interaction-history entries of one client, tenant-scoped, oldest first."""
    result = await db.execute(
        select(ClientInteraction)
        .where(
            ClientInteraction.client_id == client_id,
            ClientInteraction.tenant_id == tenant_id,
        )
        .order_by(ClientInteraction.date.asc(), ClientInteraction.id.asc())
    )
    return list(result.scalars().all())
