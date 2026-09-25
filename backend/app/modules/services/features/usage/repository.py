"""Count services referencing a settings row — backs the `settings` delete refusals."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.services.shared.models import Service


async def count_services_by_currency(
    db: AsyncSession, tenant_id: UUID, currency_id: UUID
) -> int:
    """Count the tenant's services that price in a given currency."""
    result = await db.execute(
        select(func.count()).where(
            Service.tenant_id == tenant_id,
            Service.currency_id == currency_id,
        )
    )
    return result.scalar() or 0


async def count_services_by_uom(
    db: AsyncSession, tenant_id: UUID, uom_id: UUID
) -> int:
    """Count the tenant's services priced per a given unit of measure."""
    result = await db.execute(
        select(func.count()).where(
            Service.tenant_id == tenant_id,
            Service.uom_id == uom_id,
        )
    )
    return result.scalar() or 0
