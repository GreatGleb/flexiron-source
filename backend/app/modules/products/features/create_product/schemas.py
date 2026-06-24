"""Schemas for Create Product feature (Responder / Boundary layer)."""

from pydantic import BaseModel, Field
from uuid import UUID
from typing import Any


class CreateProductInput(BaseModel):
    """Input for creating a new product."""

    name: str
    category_id: UUID | None = None
    sku: str | None = None
    description: str | None = None
    price: float | None = None
    min_stock: float | None = None

    # Currency & pricing
    currency_id: UUID | None = None
    price_quantity: int = Field(default=1, ge=1)

    # 3 separate UoM references
    purchase_uom_id: UUID | None = None
    warehouse_uom_id: UUID | None = None
    sale_uom_id: UUID | None = None

    # Conversion overrides (optional)
    purchase_to_warehouse_formula_type: str | None = None
    purchase_to_warehouse_factor: float | None = None
    warehouse_to_sale_formula_type: str | None = None
    warehouse_to_sale_factor: float | None = None


class CreateProductResponse(BaseModel):
    """Response after product creation."""

    id: UUID
    name: str
    sku: str | None
    message: str = "Product created successfully"
