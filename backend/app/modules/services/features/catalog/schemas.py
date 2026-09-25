"""Schemas for the services catalog feature (Responder / Boundary layer)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.core.schemas import TranslatedString


class ServiceCreateInput(BaseModel):
    """Body for `POST /api/services` — five required fields, `description` optional."""

    name: TranslatedString
    cost_price: float = Field(alias="costPrice")
    selling_price: float = Field(alias="sellingPrice")
    currency_id: UUID = Field(alias="currencyId")
    uom_id: UUID = Field(alias="uomId")
    description: TranslatedString | None = None

    model_config = {"populate_by_name": True}

    @field_validator("cost_price", "selling_price")
    @classmethod
    def _not_negative(cls, value: float) -> float:
        if value < 0:
            raise ValueError("price must not be negative")
        return value


class ServicePatchInput(BaseModel):
    """Body for `PATCH /api/services/{id}` — merge-patch, dirty fields only."""

    name: TranslatedString | None = None
    cost_price: float | None = Field(alias="costPrice", default=None)
    selling_price: float | None = Field(alias="sellingPrice", default=None)
    currency_id: UUID | None = Field(alias="currencyId", default=None)
    uom_id: UUID | None = Field(alias="uomId", default=None)
    description: TranslatedString | None = None

    model_config = {"populate_by_name": True}

    @field_validator("cost_price", "selling_price")
    @classmethod
    def _not_negative(cls, value: float | None) -> float | None:
        if value is not None and value < 0:
            raise ValueError("price must not be negative")
        return value


class ServiceResponse(BaseModel):
    """A catalog service — GET/POST/PATCH share this wire shape.

    `description` is built with `exclude_none` at the action layer: when the
    service has no description the key is absent from the envelope, not `null`.
    """

    id: UUID
    name: TranslatedString
    cost_price: float = Field(alias="costPrice")
    selling_price: float = Field(alias="sellingPrice")
    currency_id: UUID | None = Field(alias="currencyId")
    uom_id: UUID | None = Field(alias="uomId")
    description: TranslatedString | None = None
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = {"populate_by_name": True}
