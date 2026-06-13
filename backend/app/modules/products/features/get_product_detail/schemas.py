"""Schemas for Get Product Detail feature (Responder / Boundary layer)."""

from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Any


class ProductFieldValueResponse(BaseModel):
    """Dynamic field value on a product."""

    field_id: UUID
    field_name: str
    value: str | None


class CategoryBriefResponse(BaseModel):
    """Brief category info for product detail."""

    id: UUID
    name: str
    level: int


class ProductDetailResponse(BaseModel):
    """Full product detail response."""

    id: UUID
    name: str
    sku: str | None
    description: str | None
    price: float | None
    price_unit: str | None
    min_stock: float | None
    category: CategoryBriefResponse | None
    field_values: list[ProductFieldValueResponse]
    created_at: datetime
    updated_at: datetime


class GetProductInput(BaseModel):
    """Input for get product detail use case."""

    product_id: UUID
