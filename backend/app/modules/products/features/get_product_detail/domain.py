"""Domain use case for Get Product Detail feature.

Contains pure business logic — no FastAPI, no DB session management.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.modules.products.features.get_product_detail.repository import (
    get_product_by_id,
    get_category_by_id,
)
from app.modules.products.features.get_product_detail.schemas import (
    ProductDetailResponse,
    CategoryBriefResponse,
    ProductFieldValueResponse,
)


async def get_product_detail(
    db: AsyncSession, product_id: UUID
) -> ProductDetailResponse:
    """Execute the get product detail use case."""
    product = await get_product_by_id(db, product_id)
    if product is None:
        raise NotFoundError(entity="Product", entity_id=str(product_id))

    # Fetch category if present
    category: CategoryBriefResponse | None = None
    if product.category_id:
        cat = await get_category_by_id(db, product.category_id)
        if cat:
            category = CategoryBriefResponse(
                id=cat.id,
                name=cat.name,
                level=cat.level,
            )

    # Map field values
    field_values = [
        ProductFieldValueResponse(
            field_id=fv.field_id,
            field_name=str(fv.field_id),  # placeholder — resolve field name
            value=fv.value,
        )
        for fv in product.field_values
    ]

    return ProductDetailResponse(
        id=product.id,
        name=product.name,
        sku=product.sku,
        description=product.description,
        price=float(product.price) if product.price else None,
        price_unit=product.price_unit,
        min_stock=float(product.min_stock) if product.min_stock else None,
        category=category,
        field_values=field_values,
        created_at=product.created_at,
        updated_at=product.updated_at,
    )
