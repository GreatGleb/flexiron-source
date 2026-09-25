"""Schemas for Archive Product feature (Responder / Boundary layer)."""

from pydantic import BaseModel
from uuid import UUID


class ArchiveProductResponse(BaseModel):
    """Result of archiving a product — the id and its (now-archived) state."""

    id: UUID
    is_archived: bool = True
