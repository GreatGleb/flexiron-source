"""Create Product feature — `POST /api/products`."""

from app.modules.products.features.create_product.action import router
from app.modules.products.features.create_product.domain import create_product
from app.modules.products.features.create_product.schemas import (
    CreateProductInput,
    CreateProductResponse,
)

__all__ = ["router", "CreateProductInput", "CreateProductResponse", "create_product"]
