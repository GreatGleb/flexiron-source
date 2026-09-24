"""Domain use case for List Products feature."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.products.features.list_products.repository import (
    list_products as list_products_repo,
)
from app.modules.products.features.list_products.schemas import ProductListItem


async def list_products(db: AsyncSession, tenant_id: UUID) -> list[ProductListItem]:
    """Execute the list products use case — id + name, deterministic order."""
    products = await list_products_repo(db, tenant_id)
    return [ProductListItem(id=product.id, name=product.name) for product in products]
