"""Schemas for Create Product feature (Responder / Boundary layer)."""

from pydantic import BaseModel
from uuid import UUID
from typing import Any


class CreateProductInput(BaseModel):
    """Input for creating a new product."""

    name: str
    category_id: UUID | None = None
    sku: str | None = None
    description: str | None = None
    price: float | None = None
    price_unit: str | None = None
    min_stock: float | None = None


class CreateProductResponse(BaseModel):
    """Response after product creation."""

    id: UUID
    name: str
    sku: str | None
    message: str = "Product created successfully"
