"""Schemas for Settings CRUD operations.

Uses camelCase aliases to match the frontend TypeScript interfaces.
"""

from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime

from app.core.schemas import TranslatedString


# ─── Company ──────────────────────────────────────────────────────────────

class CompanyInfoResponse(BaseModel):
    """Company info — matches frontend CompanyInfo type.

    `logoUrl` на проводе остаётся **ссылкой**, а колонка хранит идентификатор файла
    (`logo_file_id`, П11): ссылка производна и собирается при чтении. Поле схемы
    названо `logo_link`, потому что в ответе лежит именно ссылка, а не идентификатор.

    Часовой пояс (`timezone`, П62), страна кодом ISO 3166-1 alpha-2 (`countryCode`,
    П66) и код подтверждения (`confirmationCode`, П73) — новые поля карточки.
    """

    name: str
    legal_address: str = Field(alias="legalAddress", default="")
    vat_code: str = Field(alias="vatCode", default="")
    bank_name: str = Field(alias="bankName", default="")
    bank_account: str = Field(alias="bankAccount", default="")
    time_zone: str = Field(alias="timezone", default="")
    country_code: str = Field(alias="countryCode", default="")
    confirmation_code: str = Field(alias="confirmationCode", default="")
    logo_link: str | None = Field(alias="logoUrl", default=None)

    model_config = {"populate_by_name": True, "from_attributes": True}


class CompanyPatchInput(BaseModel):
    """Partial update for company info.

    `logoUrl` остаётся полем **запроса** (П11): клиент по-прежнему присылает ссылку от
    `POST /api/uploads`, а домен опознаёт в ней свой файл и пишет идентификатор.

    No `confirmationCode`: П73 calls the code constant and never re-issued, so this
    body does not carry it — the client's whole-section PATCH has the field ignored.
    """

    name: str | None = None
    legal_address: str | None = Field(alias="legalAddress", default=None)
    vat_code: str | None = Field(alias="vatCode", default=None)
    bank_name: str | None = Field(alias="bankName", default=None)
    bank_account: str | None = Field(alias="bankAccount", default=None)
    time_zone: str | None = Field(alias="timezone", default=None)
    country_code: str | None = Field(alias="countryCode", default=None)
    logo_link: str | None = Field(alias="logoUrl", default=None)

    model_config = {"populate_by_name": True}


# ─── Constants ────────────────────────────────────────────────────────────

class ConstantsResponse(BaseModel):
    """Global scalar constants — matches frontend GlobalConstants type.

    The default currency is not one of them: it is not a constant but a
    projection of the currency flag `Currency.is_default` (П22 + П68), so the
    stored column is gone and the value leaves this response with it — deriving
    it is slice C6, which also owns the "exactly one flag" invariant.

    The three non-financial scalars join the same resource by the owner's decision:
    the payment deferral in days (П32), the default kerf width in mm (П34) and the
    reservation hold in days (П52). They are written and read by the same two
    endpoints; no third endpoint is added for them.
    """

    vat_rate: float = Field(alias="vatRate")
    default_margin: float = Field(alias="defaultMargin")
    default_discount_percent: float = Field(alias="defaultDiscountPercent")
    payment_deferral_days: int = Field(alias="paymentDeferralDays")
    default_kerf_mm: float = Field(alias="defaultKerfMm")
    reservation_hold_days: int = Field(alias="reservationHoldDays")

    model_config = {"populate_by_name": True, "from_attributes": True}


class ConstantsPatchInput(BaseModel):
    """Partial update for the global scalar constants.

    No `defaultCurrency`: the stored column is gone (П22 + П68), so there is
    nothing for this body to write — a client that still sends the field has it
    ignored.

    No bounds are declared for the three scalars added by C2: the owner assigned
    bounds to three financial constants only (П108–П110), so this slice does not
    invent business limits for the others.
    """

    vat_rate: float | None = Field(alias="vatRate", default=None)
    default_margin: float | None = Field(alias="defaultMargin", default=None)
    default_discount_percent: float | None = Field(alias="defaultDiscountPercent", default=None)
    payment_deferral_days: int | None = Field(alias="paymentDeferralDays", default=None)
    default_kerf_mm: float | None = Field(alias="defaultKerfMm", default=None)
    reservation_hold_days: int | None = Field(alias="reservationHoldDays", default=None)

    model_config = {"populate_by_name": True}


# ─── Currency ─────────────────────────────────────────────────────────────

class CurrencyResponse(BaseModel):
    """Currency — matches frontend Currency type."""

    id: str
    code: str
    name: TranslatedString
    is_default: bool = Field(alias="isDefault")
    updated_at: str | None = Field(alias="updatedAt", default=None)

    model_config = {"populate_by_name": True, "from_attributes": True}


class CurrencyCreateInput(BaseModel):
    """Input for creating a new currency.

    No rate field: conversion between currencies was dropped from the project
    altogether (П23), so there is no rate to store and none to send.
    """

    code: str
    name: TranslatedString
    is_default: bool = Field(alias="isDefault", default=False)

    model_config = {"populate_by_name": True}


class CurrencyPatchInput(BaseModel):
    """Partial update for a currency."""

    code: str | None = None
    name: TranslatedString | None = None
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
    sort_order: int = Field(alias="order")
    system: bool = False
    reserve_on_transition: bool = Field(alias="reserveOnTransition", default=False)
    write_off_on_transition: bool = Field(alias="writeOffOnTransition", default=False)

    model_config = {"populate_by_name": True, "from_attributes": True}


class OrderStatusCreateInput(BaseModel):
    """Input for creating a new order status."""

    name: TranslatedString
    color: str
    sort_order: int = Field(alias="order")
    reserve_on_transition: bool = Field(alias="reserveOnTransition", default=False)
    write_off_on_transition: bool = Field(alias="writeOffOnTransition", default=False)

    model_config = {"populate_by_name": True}


class OrderStatusPatchInput(BaseModel):
    """Partial update for an order status."""

    name: TranslatedString | None = None
    color: str | None = None
    reserve_on_transition: bool | None = Field(alias="reserveOnTransition", default=None)
    write_off_on_transition: bool | None = Field(alias="writeOffOnTransition", default=None)

    model_config = {"populate_by_name": True}


class OrderStatusReorderInput(BaseModel):
    """Reorder input — list of status IDs in new order."""

    ids: list[str] = Field(alias="orderedIds")

    @property
    def ordered_ids(self) -> list[str]:
        """The route reads `.ordered_ids`; the wire name stays `orderedIds`."""
        return self.ids

    model_config = {"populate_by_name": True}
