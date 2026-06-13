"""Domain use case for Create Product feature.

Contains pure business logic — validates input and orchestrates creation.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationError
from app.modules.products.features.create_product.repository import (
    create_product as create_product_repo,
)
from app.modules.products.features.create_product.schemas import (
    CreateProductInput,
    CreateProductResponse,
)


async def create_product(
    db: AsyncSession,
    tenant_id: UUID,
    input_data: CreateProductInput,
) -> CreateProductResponse:
    """Execute the create product use case."""
    # Basic validation
    if not input_data.name or not input_data.name.strip():
        raise ValidationError("Product name is required")

    product = await create_product_repo(
        db=db,
        tenant_id=tenant_id,
        name=input_data.name.strip(),
        category_id=input_data.category_id,
        sku=input_data.sku,
        description=input_data.description,
        price=input_data.price,
        price_unit=input_data.price_unit,
        min_stock=input_data.min_stock,
    )

    return CreateProductResponse(
        id=product.id,
        name=product.name,
        sku=product.sku,
    )
