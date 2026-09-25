"""Services Internal Service API — public contract for cross-module calls.

Other modules MUST call these functions to get services data.
They MUST NOT import from shared/ or features/ directly.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.services.features.usage.repository import (
    count_services_by_currency as _count_services_by_currency,
    count_services_by_uom as _count_services_by_uom,
)


async def count_services_by_currency(
    db: AsyncSession, tenant_id: UUID, currency_id: UUID
) -> int:
    """Count services that reference a given currency — cross-module access point."""
    return await _count_services_by_currency(db, tenant_id, currency_id)


async def count_services_by_uom(
    db: AsyncSession, tenant_id: UUID, uom_id: UUID
) -> int:
    """Count services that reference a given UOM — cross-module access point."""
    return await _count_services_by_uom(db, tenant_id, uom_id)
