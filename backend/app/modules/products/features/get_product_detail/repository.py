"""Repository for Get Product Detail feature (Infrastructure / Data Access layer)."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.products.shared.models import Product, ProductFieldValue
from app.modules.products.shared.models import Category, CategoryField


async def get_product_by_id(
    db: AsyncSession, product_id: UUID, tenant_id: UUID
) -> Product | None:
    """Fetch a product with its field values, scoped to its tenant."""
    result = await db.execute(
        select(Product)
        .where(Product.id == product_id, Product.tenant_id == tenant_id)
        .options(selectinload(Product.field_values))
    )
    return result.scalar_one_or_none()


async def get_category_by_id(
    db: AsyncSession, category_id: UUID, tenant_id: UUID
) -> Category | None:
    """Fetch a category by ID, scoped to its tenant."""
    result = await db.execute(
        select(Category).where(
            Category.id == category_id, Category.tenant_id == tenant_id
        )
    )
    return result.scalar_one_or_none()


async def get_category_fields_by_ids(
    db: AsyncSession, field_ids: list[UUID], tenant_id: UUID
) -> dict[UUID, CategoryField]:
    """Fetch field definitions for the given ids in one query, scoped to tenant."""
    if not field_ids:
        return {}
    result = await db.execute(
        select(CategoryField).where(
            CategoryField.id.in_(field_ids), CategoryField.tenant_id == tenant_id
        )
    )
    return {field.id: field for field in result.scalars().all()}
