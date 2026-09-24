"""Schemas for List Products feature (Responder / Boundary layer)."""

from pydantic import BaseModel
from uuid import UUID


class ProductListItem(BaseModel):
    """Row of the lightweight product catalog — id and name only."""

    id: UUID
    name: str

    model_config = {"from_attributes": True}
