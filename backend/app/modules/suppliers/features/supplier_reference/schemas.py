"""Schemas for Supplier Reference feature (Responder / Boundary layer)."""

from pydantic import BaseModel
from uuid import UUID

from app.core.schemas import TranslatedString


class SupplierListItem(BaseModel):
    """Row of the lightweight supplier catalog — id and company name only.

    `company` carries all three locale keys (owner decision П64): the server
    does not pick a locale, the client does.
    """

    id: UUID
    company: TranslatedString

    model_config = {"from_attributes": True}
