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
    min_stock: float | None = None,
    currency_id: UUID | None = None,
    price_quantity: int = 1,
    purchase_uom_id: UUID | None = None,
    warehouse_uom_id: UUID | None = None,
    sale_uom_id: UUID | None = None,
    purchase_to_warehouse_formula_type: str | None = None,
    purchase_to_warehouse_factor: float | None = None,
    warehouse_to_sale_formula_type: str | None = None,
    warehouse_to_sale_factor: float | None = None,
) -> Product:
    """Insert a new product into the database."""
    product = Product(
        tenant_id=tenant_id,
        name=name,
        category_id=category_id,
        sku=sku,
        description=description,
        price=price,
        min_stock=min_stock,
        currency_id=currency_id,
        price_quantity=price_quantity,
        purchase_uom_id=purchase_uom_id,
        warehouse_uom_id=warehouse_uom_id,
        sale_uom_id=sale_uom_id,
        purchase_to_warehouse_formula_type=purchase_to_warehouse_formula_type,
        purchase_to_warehouse_factor=purchase_to_warehouse_factor,
        warehouse_to_sale_formula_type=warehouse_to_sale_formula_type,
        warehouse_to_sale_factor=warehouse_to_sale_factor,
    )
    db.add(product)
    await db.flush()
    return product
