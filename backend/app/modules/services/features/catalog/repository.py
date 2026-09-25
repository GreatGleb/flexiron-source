"""Repository for the services catalog feature (Infrastructure / Data Access layer)."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.services.shared.models import Service


async def get_service_by_id(
    db: AsyncSession, service_id: UUID, tenant_id: UUID
) -> Service | None:
    """Fetch a service by its ID and tenant_id. A foreign row reads as absent."""
    result = await db.execute(
        select(Service).where(
            Service.id == service_id,
            Service.tenant_id == tenant_id,
        )
    )
    return result.scalar_one_or_none()


async def create_service(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    name_translations: dict,
    cost_price: float,
    selling_price: float,
    currency_id: UUID,
    uom_id: UUID,
    description_translations: dict | None,
) -> Service:
    """Insert a new service into the tenant's catalog."""
    service = Service(
        tenant_id=tenant_id,
        name_translations=name_translations,
        cost_price=cost_price,
        selling_price=selling_price,
        currency_id=currency_id,
        uom_id=uom_id,
        description_translations=description_translations,
    )
    db.add(service)
    await db.flush()
    await db.refresh(service)
    return service


async def update_service(
    db: AsyncSession,
    service_id: UUID,
    tenant_id: UUID,
    data: dict,
) -> Service | None:
    """Merge-patch a service's columns from `data`, tenant-scoped."""
    service = await get_service_by_id(db, service_id, tenant_id)
    if service is None:
        return None
    for key, value in data.items():
        setattr(service, key, value)
    await db.flush()
    await db.refresh(service)
    return service
