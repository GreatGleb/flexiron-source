"""The `products.category_card` vertical slice — `GET`/`DELETE /api/categories/:id`."""

from .domain import (
    CategoryHasChildrenError,
    CategoryHasProductsError,
    CategoryNotFoundError,
    delete_category,
    get_category_card,
)
from .schemas import (
    CategoryDetailResponse,
    CategoryFieldResponse,
    LinkedSupplierResponse,
)

__all__ = [
    "CategoryDetailResponse",
    "CategoryFieldResponse",
    "CategoryHasChildrenError",
    "CategoryHasProductsError",
    "CategoryNotFoundError",
    "LinkedSupplierResponse",
    "delete_category",
    "get_category_card",
]
