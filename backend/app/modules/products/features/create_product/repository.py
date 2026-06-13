"""Repository for Create Product feature (Infrastructure / Data Access layer)."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.products.shared.models import Product


async def create_product(
    db: AsyncSession,
    tenant_id: UUID,
    name: str,
    category_id: UUID | None = None,
    sku: str | None = None,
    description: str | None = None,
    price: float | None = None,
    price_unit: str | None = None,
    min_stock: float | None = None,
) -> Product:
    """Insert a new product into the database."""
    product = Product(
        tenant_id=tenant_id,
        name=name,
        category_id=category_id,
        sku=sku,
        description=description,
        price=price,
        price_unit=price_unit,
        min_stock=min_stock,
    )
    db.add(product)
    await db.flush()
    return product
