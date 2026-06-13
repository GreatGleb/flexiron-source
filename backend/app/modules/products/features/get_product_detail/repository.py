"""Repository for Get Product Detail feature (Infrastructure / Data Access layer)."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.products.shared.models import Product, ProductFieldValue
from app.modules.products.shared.models import Category


async def get_product_by_id(
    db: AsyncSession, product_id: UUID
) -> Product | None:
    """Fetch a product with its field values."""
    result = await db.execute(
        select(Product)
        .where(Product.id == product_id)
        .options(selectinload(Product.field_values))
    )
    return result.scalar_one_or_none()


async def get_category_by_id(
    db: AsyncSession, category_id: UUID
) -> Category | None:
    """Fetch a category by ID."""
    result = await db.execute(
        select(Category).where(Category.id == category_id)
    )
    return result.scalar_one_or_none()
