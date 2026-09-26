"""Repository for the clients.write_clients slice (Infrastructure / Data Access)."""

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.clients.shared.models import Client


async def get_client_record(db: AsyncSession, client_id: UUID, tenant_id: UUID) -> Client | None:
    """Fetch a client by id, tenant-scoped — the merge-patch target.

    An unknown id and one belonging to another tenant are indistinguishable by
    design: the tenant filter lives in this query, exactly as the read slice's
    own getter does it.
    """
    result = await db.execute(
        select(Client).where(Client.id == client_id, Client.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def find_client_by_company_code(
    db: AsyncSession, tenant_id: UUID, company_code: str, exclude_id: UUID | None = None
) -> Client | None:
    """First client of this tenant holding `company_code`, other than `exclude_id`."""
    query = select(Client).where(
        Client.tenant_id == tenant_id, Client.company_code == company_code
    )
    if exclude_id is not None:
        query = query.where(Client.id != exclude_id)
    result = await db.execute(query)
    return result.scalars().first()


async def find_client_by_vat_code(
    db: AsyncSession, tenant_id: UUID, vat_code: str, exclude_id: UUID | None = None
) -> Client | None:
    """First client of this tenant holding `vat_code`, other than `exclude_id`."""
    query = select(Client).where(Client.tenant_id == tenant_id, Client.vat_code == vat_code)
    if exclude_id is not None:
        query = query.where(Client.id != exclude_id)
    result = await db.execute(query)
    return result.scalars().first()


async def find_client_by_email(
    db: AsyncSession, tenant_id: UUID, email: str, exclude_id: UUID | None = None
) -> Client | None:
    """First client of this tenant holding `email`, other than `exclude_id`."""
    query = select(Client).where(Client.tenant_id == tenant_id, Client.email == email)
    if exclude_id is not None:
        query = query.where(Client.id != exclude_id)
    result = await db.execute(query)
    return result.scalars().first()


async def create_client_record(
    db: AsyncSession, tenant_id: UUID, values: dict[str, Any]
) -> Client:
    """Insert one client row, tagging it with the caller's tenant.

    A pure INSERT: the new row is stamped with `tenant_id` and has no existing row
    to leak, so there is nothing to filter here (`test_tenant_scope.py` treats
    INSERT-only functions as out of the filter rule by construction).
    """
    client = Client(tenant_id=tenant_id, **values)
    db.add(client)
    await db.flush()
    await db.refresh(client)
    return client


async def update_client_record(
    db: AsyncSession, client: Client, changes: dict[str, Any]
) -> Client:
    """Apply a merge-patch delta to a row the caller already loaded tenant-scoped."""
    for name, value in changes.items():
        setattr(client, name, value)
    await db.flush()
    await db.refresh(client)
    return client
