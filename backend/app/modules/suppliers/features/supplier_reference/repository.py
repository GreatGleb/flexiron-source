"""Repository for Supplier Reference feature (Infrastructure / Data Access layer)."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.suppliers.shared.models import Supplier


async def list_suppliers_brief(db: AsyncSession, tenant_id: UUID) -> list[Supplier]:
    """Fetch every supplier of the tenant, ordered by company (en) then id."""
    result = await db.execute(
        select(Supplier)
        .where(Supplier.tenant_id == tenant_id)
        .order_by(Supplier.company_translations["en"].as_string(), Supplier.id.asc())
    )
    return list(result.scalars().all())


async def get_supplier_by_id(
    db: AsyncSession, tenant_id: UUID, supplier_id: UUID
) -> Supplier | None:
    """Fetch a single supplier by id, tenant-scoped."""
    result = await db.execute(
        select(Supplier).where(
            Supplier.id == supplier_id,
            Supplier.tenant_id == tenant_id,
        )
    )
    return result.scalar_one_or_none()


async def get_suppliers_by_ids(
    db: AsyncSession, tenant_id: UUID, supplier_ids: list[UUID]
) -> list[Supplier]:
    """Fetch several suppliers by id in one query, tenant-scoped."""
    if not supplier_ids:
        return []
    result = await db.execute(
        select(Supplier).where(
            Supplier.id.in_(supplier_ids),
            Supplier.tenant_id == tenant_id,
        )
    )
    return list(result.scalars().all())
