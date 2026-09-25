"""Schemas for List Products feature (Responder / Boundary layer)."""

from datetime import datetime
from pydantic import BaseModel
from uuid import UUID

from app.core.schemas import PaginatedResponse, TranslatedString


class ProductListItem(BaseModel):
    """Row of the lightweight product catalog — id and name only."""

    id: UUID
    name: str

    model_config = {"from_attributes": True}


class ProductCatalogItem(BaseModel):
    """Row of `GET /api/products` — the fields the contract lists that the
    server actually has in storage (`roo_code/roo-context/api/products.md`,
    "GET /api/products"). `avgCostPrice` and `avgSalePrice` are contract
    fields with no backing column or schema anywhere server-side, so this
    item does not invent them — the same rule the card's `ProductDetailResponse`
    already applies to its own five unsupported fields.

    `name` travels as the plain string it is in storage (`Product.name`,
    a single column) rather than the contract's `TranslatedString` shape,
    which only fits `categoryName` here — that field genuinely comes from
    a JSONB `name_translations` column (`categories.name_translations`).
    """

    id: UUID
    name: str
    categoryId: UUID | None
    categoryName: TranslatedString | None
    sku: str | None
    price: float | None
    minStock: float | None
    createdAt: datetime
    saleUomId: UUID | None
    warehouseUomId: UUID | None
    warehouseToSaleFactor: float | None


# Конверт списка живёт в одном месте — `app.core.schemas.PaginatedResponse`.
# Здесь он только параметризуется товаром: сторож
# `tests/core/test_list_envelope_one_source.py` краснеет на любой схеме фичи,
# которая объявляет пятёрку ключей заново, и он прав — разошедшиеся копии
# конверта уже были корнем разбора в этом проекте (Л5).
ProductCatalogListResponse = PaginatedResponse[ProductCatalogItem]
