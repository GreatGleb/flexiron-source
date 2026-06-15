"""Schemas for Settings CRUD operations.

Uses camelCase aliases to match the frontend TypeScript interfaces.
"""

from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime

from app.core.schemas import TranslatedString


# ─── Company ──────────────────────────────────────────────────────────────

class CompanyInfoResponse(BaseModel):
    """Company info — matches frontend CompanyInfo type."""

    name: str
    legal_address: str = Field(alias="legalAddress", default="")
    vat_code: str = Field(alias="vatCode", default="")
    bank_name: str = Field(alias="bankName", default="")
    bank_account: str = Field(alias="bankAccount", default="")
    logo_url: str | None = Field(alias="logoUrl", default=None)

    model_config = {"populate_by_name": True, "from_attributes": True}


class CompanyPatchInput(BaseModel):
    """Partial update for company info."""

    name: str | None = None
    legal_address: str | None = Field(alias="legalAddress", default=None)
    vat_code: str | None = Field(alias="vatCode", default=None)
    bank_name: str | None = Field(alias="bankName", default=None)
    bank_account: str | None = Field(alias="bankAccount", default=None)
    logo_url: str | None = Field(alias="logoUrl", default=None)

    model_config = {"populate_by_name": True}


# ─── Constants ────────────────────────────────────────────────────────────

class ConstantsResponse(BaseModel):
    """Global financial constants — matches frontend GlobalConstants type."""

    vat_rate: float = Field(alias="vatRate")
    default_margin: float = Field(alias="defaultMargin")
    default_currency: str = Field(alias="defaultCurrency")
    default_discount_percent: float = Field(alias="defaultDiscountPercent")

    model_config = {"populate_by_name": True, "from_attributes": True}


class ConstantsPatchInput(BaseModel):
    """Partial update for global constants."""

    vat_rate: float | None = Field(alias="vatRate", default=None)
    default_margin: float | None = Field(alias="defaultMargin", default=None)
    default_currency: str | None = Field(alias="defaultCurrency", default=None)
    default_discount_percent: float | None = Field(alias="defaultDiscountPercent", default=None)

    model_config = {"populate_by_name": True}


# ─── Currency ─────────────────────────────────────────────────────────────

class CurrencyResponse(BaseModel):
    """Currency — matches frontend Currency type."""

    id: str
    code: str
    name: TranslatedString
    exchange_rate: float = Field(alias="exchangeRate")
    is_default: bool = Field(alias="isDefault")
    updated_at: str | None = Field(alias="updatedAt", default=None)

    model_config = {"populate_by_name": True, "from_attributes": True}


class CurrencyCreateInput(BaseModel):
    """Input for creating a new currency."""

    code: str
    name: TranslatedString
    exchange_rate: float = Field(alias="exchangeRate")
    is_default: bool = Field(alias="isDefault", default=False)

    model_config = {"populate_by_name": True}


class CurrencyPatchInput(BaseModel):
    """Partial update for a currency."""

    code: str | None = None
    name: TranslatedString | None = None
    exchange_rate: float | None = Field(alias="exchangeRate", default=None)
    is_default: bool | None = Field(alias="isDefault", default=None)

    model_config = {"populate_by_name": True}


# ─── UOM ──────────────────────────────────────────────────────────────────

class UomResponse(BaseModel):
    """Unit of measure — matches frontend Uom type."""

    id: str
    code: TranslatedString
    name: TranslatedString
    category: str

    model_config = {"populate_by_name": True, "from_attributes": True}


class UomCreateInput(BaseModel):
    """Input for creating a new UOM."""

    code: TranslatedString
    name: TranslatedString
    category: str

    model_config = {"populate_by_name": True}


class UomPatchInput(BaseModel):
    """Partial update for a UOM."""

    code: TranslatedString | None = None
    name: TranslatedString | None = None
    category: str | None = None

    model_config = {"populate_by_name": True}


# ─── Conversion ───────────────────────────────────────────────────────────

class ConversionResponse(BaseModel):
    """Conversion rule — matches frontend UomConversion type."""

    id: str
    from_uom_id: str = Field(alias="fromUomId")
    to_uom_id: str = Field(alias="toUomId")
    type: str  # 'static' | 'dynamic'
    factor: float | None = None
    formula_type: str | None = Field(alias="formulaType", default=None)

    model_config = {"populate_by_name": True, "from_attributes": True}


class ConversionCreateInput(BaseModel):
    """Input for creating a new conversion rule."""

    from_uom_id: str = Field(alias="fromUomId")
    to_uom_id: str = Field(alias="toUomId")
    type: str
    factor: float | None = None
    formula_type: str | None = Field(alias="formulaType", default=None)

    model_config = {"populate_by_name": True}


class ConversionPatchInput(BaseModel):
    """Partial update for a conversion rule."""

    from_uom_id: str | None = Field(alias="fromUomId", default=None)
    to_uom_id: str | None = Field(alias="toUomId", default=None)
    type: str | None = None
    factor: float | None = None
    formula_type: str | None = Field(alias="formulaType", default=None)

    model_config = {"populate_by_name": True}


# ─── Order Status ─────────────────────────────────────────────────────────

class OrderStatusResponse(BaseModel):
    """Order status setting — matches frontend OrderStatusSetting type."""

    id: str
    name: TranslatedString
    color: str
    order: int
    system: bool = False
    reserve_on_transition: bool = Field(alias="reserveOnTransition", default=False)
    write_off_on_transition: bool = Field(alias="writeOffOnTransition", default=False)

    model_config = {"populate_by_name": True, "from_attributes": True}


class OrderStatusCreateInput(BaseModel):
    """Input for creating a new order status."""

    name: TranslatedString
    color: str
    order: int
    reserve_on_transition: bool = Field(alias="reserveOnTransition", default=False)
    write_off_on_transition: bool = Field(alias="writeOffOnTransition", default=False)

    model_config = {"populate_by_name": True}


class OrderStatusPatchInput(BaseModel):
    """Partial update for an order status."""

    name: TranslatedString | None = None
    color: str | None = None
    order: int | None = None
    reserve_on_transition: bool | None = Field(alias="reserveOnTransition", default=None)
    write_off_on_transition: bool | None = Field(alias="writeOffOnTransition", default=None)

    model_config = {"populate_by_name": True}


class OrderStatusReorderInput(BaseModel):
    """Reorder input — list of status IDs in new order."""

    ordered_ids: list[str] = Field(alias="orderedIds")

    model_config = {"populate_by_name": True}
