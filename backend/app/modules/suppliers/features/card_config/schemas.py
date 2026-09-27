"""Schemas for the suppliers.card_config read slice (Responder / Boundary layer).

Field names repeat the contract's own casing (`roo_code/roo-context/api/config.md`,
`frontend_vue/src/types/config.ts` — `FieldDefinition`, `SectionConfig`,
`SectionField`), the same way `warehouse.list_batches`'s schemas do — no aliasing.

Two columns are renamed on the way out, and only where the contract renames them:
`field_type` travels as `type`, and `sort_order` travels as `order` — for the
section itself and for each of its field links. A column is not added under the
wire name: the rename happens at response assembly, in `domain.py`.
"""

from uuid import UUID

from pydantic import BaseModel

from app.core.schemas import TranslatedString


class FieldDefinitionItem(BaseModel):
    """One row of the tenant's field library (`GET /api/config/fields`).

    `options` is nullable in the same sense as the contract's `options?`: a NULL
    column leaves the key out of the response entirely instead of sending `null`
    (the exclusion happens at dump time in `action.py`), so the client's optional
    field keeps meaning what it says.
    """

    id: UUID
    name: TranslatedString
    type: str
    required: bool
    usageCount: int
    hidden: bool
    options: list[TranslatedString] | None = None


class SectionFieldItem(BaseModel):
    """A field's place inside a section — `SectionField` on the wire."""

    fieldId: UUID
    order: int
    visible: bool


class SectionConfigItem(BaseModel):
    """A supplier card section with its links, each link already in order."""

    id: UUID
    name: TranslatedString
    order: int
    collapsed: bool
    visible: bool
    system: bool
    fields: list[SectionFieldItem]
