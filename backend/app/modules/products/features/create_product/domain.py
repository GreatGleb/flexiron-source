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
from app.modules.settings.internal_api.interface import (
    get_default_currency,
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

    # Resolve currency: use provided one, or fallback to tenant default
    currency_id = input_data.currency_id
    if currency_id is None:
        currency_id = await get_default_currency(db, tenant_id)

    # Resolve UoM defaults: if a UoM is not provided, cascade from sale ← warehouse ← purchase
    sale_uom_id = input_data.sale_uom_id
    warehouse_uom_id = input_data.warehouse_uom_id or sale_uom_id
    purchase_uom_id = input_data.purchase_uom_id or warehouse_uom_id

    product = await create_product_repo(
        db=db,
        tenant_id=tenant_id,
        name=input_data.name.strip(),
        category_id=input_data.category_id,
        sku=input_data.sku,
        description=input_data.description,
        price=input_data.price,
        min_stock=input_data.min_stock,
        currency_id=currency_id,
        price_quantity=input_data.price_quantity,
        purchase_uom_id=purchase_uom_id,
        warehouse_uom_id=warehouse_uom_id,
        sale_uom_id=sale_uom_id,
        purchase_to_warehouse_formula_type=input_data.purchase_to_warehouse_formula_type,
        purchase_to_warehouse_factor=input_data.purchase_to_warehouse_factor,
        warehouse_to_sale_formula_type=input_data.warehouse_to_sale_formula_type,
        warehouse_to_sale_factor=input_data.warehouse_to_sale_factor,
    )

    return CreateProductResponse(
        id=product.id,
        name=product.name,
        sku=product.sku,
    )
