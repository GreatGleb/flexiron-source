"""Schemas for the products.list_categories slice (Responder / Boundary layer)."""

from uuid import UUID

from pydantic import BaseModel

from app.core.schemas import TranslatedString


class CategoryListItem(BaseModel):
    """Row of `GET /api/categories` — a flat slice of the tree with its place in it.

    `parentName` and `level` are computed at read time from `parent_id`, not from
    the `level` column — the column is a second, stale record of the same value
    (contract `categories.md`, §17 "Производные значения").
    """

    id: UUID
    name: TranslatedString
    parentId: UUID | None
    parentName: TranslatedString | None
    fieldCount: int
    productCount: int
    level: int
