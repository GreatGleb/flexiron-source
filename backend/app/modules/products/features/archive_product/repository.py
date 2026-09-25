"""Repository for Archive Product feature (Infrastructure / Data Access layer)."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.products.shared.models import Product


async def get_product_for_archive(
    db: AsyncSession, product_id: UUID, tenant_id: UUID
) -> Product | None:
    """Fetch a product by id, scoped to its tenant — archived or not."""
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def archive_product(db: AsyncSession, product: Product) -> Product:
    """Stamp `archived_at`. Never deletes the row."""
    product.archived_at = datetime.now(timezone.utc)
    await db.flush()
    return product
