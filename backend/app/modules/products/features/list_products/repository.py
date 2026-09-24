"""Repository for List Products feature (Infrastructure / Data Access layer)."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.products.shared.models import Product


async def list_products(db: AsyncSession, tenant_id: UUID) -> list[Product]:
    """Fetch every product of the tenant, ordered by name then id."""
    result = await db.execute(
        select(Product)
        .where(Product.tenant_id == tenant_id)
        .order_by(Product.name.asc(), Product.id.asc())
    )
    return list(result.scalars().all())
