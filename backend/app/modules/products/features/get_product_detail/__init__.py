"""Get Product Detail feature — `GET /api/products/{product_id}`."""

from app.modules.products.features.get_product_detail.action import router
from app.modules.products.features.get_product_detail.domain import get_product_detail
from app.modules.products.features.get_product_detail.schemas import (
    GetProductInput,
    ProductDetailResponse,
)

__all__ = [
    "router",
    "GetProductInput",
    "ProductDetailResponse",
    "get_product_detail",
]
