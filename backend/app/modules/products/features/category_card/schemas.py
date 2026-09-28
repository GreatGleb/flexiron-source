"""Schemas for the products.category_card slice (Responder / Boundary layer).

The columns are renamed to the shape the contract names them in
(`roo_code/roo-context/api/categories.md`, `GET /api/categories/:id`):
`name_translations` → `name`, `field_type` → `type`, `sort_order` → `order`.
"""

from uuid import UUID

from pydantic import BaseModel, Field

from app.core.schemas import TranslatedString


class CategoryFieldResponse(BaseModel):
    """One field definition of a category, in the contract's own shape."""

    id: UUID
    name: TranslatedString
    type: str
    required: bool
    order: int
    options: list[TranslatedString]


class LinkedSupplierResponse(BaseModel):
    """The category ↔ supplier link, as the contract describes it.

    No table backs this link on the backend yet, so the response always carries
    an empty list — the absence is named in the contract as unfinished backend
    rather than an open question.
    """

    id: UUID
    name: TranslatedString
    price: float | None = None
    priceUomId: UUID | None = None
    leadDays: int | None = None
    currency: str | None = None


class CategoryDetailResponse(BaseModel):
    """A category in full for the card (`GET /api/categories/:id`).

    `inheritedFields` is the flat union of every ancestor's own fields, farthest
    ancestor first; two fields sharing a name across generations are both kept,
    not merged into one.
    """

    id: UUID
    name: TranslatedString
    parentId: UUID | None
    description: TranslatedString | None
    fieldCount: int
    productCount: int
    inheritedFields: list[CategoryFieldResponse]
    fields: list[CategoryFieldResponse]
    linkedSuppliers: list[LinkedSupplierResponse] = Field(default_factory=list)
