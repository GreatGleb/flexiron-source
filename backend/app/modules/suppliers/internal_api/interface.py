"""Suppliers Internal Service API — public contract for cross-module calls.

Other modules MUST call these functions to get supplier data.
They MUST NOT import from shared/ or features/ directly.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.suppliers.shared.models import Supplier
from app.modules.suppliers.features.supplier_reference.repository import (
    get_supplier_by_id as _get_supplier_by_id,
)
from app.modules.suppliers.features.supplier_reference.repository import (
    get_suppliers_by_ids as _get_suppliers_by_ids,
)


async def get_supplier_brief(
    db: AsyncSession, tenant_id: UUID, supplier_id: UUID
) -> Supplier | None:
    """Get a supplier entity by id, tenant-scoped.

    Cross-module access point — the ORM model is returned as-is, the
    calling module maps it to its own response schema.
    """
    return await _get_supplier_by_id(db, tenant_id, supplier_id)


async def get_suppliers_brief(
    db: AsyncSession, tenant_id: UUID, supplier_ids: list[UUID]
) -> list[Supplier]:
    """Get several supplier entities by id in one query, tenant-scoped."""
    return await _get_suppliers_by_ids(db, tenant_id, supplier_ids)
