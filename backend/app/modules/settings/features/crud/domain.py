"""Domain use cases for Settings CRUD operations."""
from app.core.exceptions import (
    ValidationError as CoreValidationError,
    ConflictError,
    ForbiddenError,
)

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.modules.settings.features.crud.schemas import (
    CompanyInfoResponse,
    CompanyPatchInput,
    ConstantsResponse,
    ConstantsPatchInput,
    CurrencyResponse,
    CurrencyCreateInput,
    CurrencyPatchInput,
    UomResponse,
    UomCreateInput,
    UomPatchInput,
    ConversionResponse,
    ConversionCreateInput,
    ConversionPatchInput,
    OrderStatusResponse,
    OrderStatusCreateInput,
    OrderStatusPatchInput,
)
from app.modules.settings.features.crud.repository import (
    get_company,
    patch_company,
    create_company,
    get_constants,
    patch_constants,
    create_constants,
    get_currencies,
    get_currency,
    get_currency_by_code,
    create_currency as create_currency_repo,
    patch_currency as patch_currency_repo,
    delete_currency,
    get_uoms,
    get_uom,
    create_uom as create_uom_repo,
    patch_uom as patch_uom_repo,
    delete_uom,
    get_conversions,
    get_conversion,
    get_conversion_by_uom_pair,
    create_conversion as create_conversion_repo,
    patch_conversion as patch_conversion_repo,
    delete_conversion,
    get_order_statuses,
    get_order_status,
    create_order_status as create_order_status_repo,
    patch_order_status as patch_order_status_repo,
    delete_order_status,
    reorder_order_statuses,
)
from app.modules.auth.internal_api.interface import get_tenant_registration_data


# C5: each body check answers with its OWN code, not the shared `VALIDATION_ERROR`.
# The core `ValidationError` hardcodes the shared code and takes no `code` argument,
# and `app/core/` is outside this slice — so the domain extends it here. The global
# `AppError` handler in `app/main.py` matches by MRO, so this still answers 422.
class ValidationError(CoreValidationError):
    """422 carrying a code of its own."""

    def __init__(self, message: str, code: str | None = None) -> None:
        super().__init__(message)
        if code is not None:
            self.code = code


# Категорий восемь, и перечень закрыт (contract §Единицы измерения): девятая
# категория отвергается, а не принимается любой строкой.
UOM_CATEGORIES: frozenset[str] = frozenset(
    {"weight", "length", "area", "volume", "quantity", "density", "thickness", "time"}
)


def _validate_conversion_binding(
    conv_type: str | None, factor: float | None, formula_type: str | None
) -> None:
    """A `static` rule needs a factor, a `dynamic` one needs a formula — БАГ-20."""
    if conv_type == "static" and factor is None:
        raise ValidationError(
            "A static conversion rule requires a factor", code="CONVERSION_FACTOR_REQUIRED"
        )
    if conv_type == "dynamic" and not formula_type:
        raise ValidationError(
            "A dynamic conversion rule requires a formula type",
            code="CONVERSION_FORMULA_REQUIRED",
        )


_UPLOAD_URL_PREFIXES: tuple[str, ...] = ("http://", "https://", "/")


def _is_upload_url(value: str) -> bool:
    """A link from `POST /api/uploads`, never an inlined base64 preview (БАГ-18)."""
    return value.startswith(_UPLOAD_URL_PREFIXES)


# ─── Company ──────────────────────────────────────────────────────────────

async def get_company_info(
    db: AsyncSession, tenant_id: UUID
) -> CompanyInfoResponse:
    company = await get_company(db, tenant_id)
    if company is None:
        # Auto-create singleton if missing — pull tenant name + vat_code
        init_data = await get_tenant_registration_data(db, tenant_id)
        company = await create_company(db, tenant_id, init_data)
    return CompanyInfoResponse(
        name=company.name,
        legal_address=company.legal_address or "",
        vat_code=company.vat_code or "",
        bank_name=company.bank_name or "",
        bank_account=company.bank_account or "",
        logo_url=company.logo_url,
    )


async def patch_company_info(
    db: AsyncSession, tenant_id: UUID, input_data: CompanyPatchInput
) -> CompanyInfoResponse:
    company = await get_company(db, tenant_id)
    if company is None:
        company = await create_company(db, tenant_id, {})

    if input_data.logo_url is not None and input_data.logo_url.strip():
        if not _is_upload_url(input_data.logo_url.strip()):
            raise ValidationError(
                "logoUrl must be a link from POST /api/uploads, not embedded base64",
                code="LOGO_URL_NOT_A_URL",
            )

    updates: dict = {}
    field_map = {
        "name": "name",
        "legal_address": "legal_address",
        "vat_code": "vat_code",
        "bank_name": "bank_name",
        "bank_account": "bank_account",
        "logo_url": "logo_url",
    }
    for py_field, db_field in field_map.items():
        val = getattr(input_data, py_field, None)
        if val is not None:
            updates[db_field] = val

    if updates:
        updated = await patch_company(db, tenant_id, updates)
        if updated is None:
            raise NotFoundError(entity="Company")
        company = updated

    return CompanyInfoResponse(
        name=company.name,
        legal_address=company.legal_address or "",
        vat_code=company.vat_code or "",
        bank_name=company.bank_name or "",
        bank_account=company.bank_account or "",
        logo_url=company.logo_url,
    )


# ─── Constants ────────────────────────────────────────────────────────────

async def get_global_constants(
    db: AsyncSession, tenant_id: UUID
) -> ConstantsResponse:
    obj = await get_constants(db, tenant_id)
    if obj is None:
        obj = await create_constants(db, tenant_id, {})
    return ConstantsResponse(
        vat_rate=float(obj.vat_rate),
        default_margin=float(obj.default_margin),
        default_currency=obj.default_currency,
        default_discount_percent=float(obj.default_discount_percent),
    )


async def patch_global_constants(
    db: AsyncSession, tenant_id: UUID, input_data: ConstantsPatchInput
) -> ConstantsResponse:
    obj = await get_constants(db, tenant_id)
    if obj is None:
        obj = await create_constants(db, tenant_id, {})

    if input_data.default_currency is not None:
        codes = {c.code for c in await get_currencies(db, tenant_id)}
        if input_data.default_currency not in codes:
            raise ValidationError(
                f"Unknown currency code: {input_data.default_currency}",
                code="DEFAULT_CURRENCY_UNKNOWN",
            )

    updates: dict = {}
    field_map = {
        "vat_rate": "vat_rate",
        "default_margin": "default_margin",
        "default_currency": "default_currency",
        "default_discount_percent": "default_discount_percent",
    }
    for py_field, db_field in field_map.items():
        val = getattr(input_data, py_field, None)
        if val is not None:
            updates[db_field] = val

    if updates:
        updated = await patch_constants(db, tenant_id, updates)
        if updated is None:
            raise NotFoundError(entity="Constants")
        obj = updated

    return ConstantsResponse(
        vat_rate=float(obj.vat_rate),
        default_margin=float(obj.default_margin),
        default_currency=obj.default_currency,
        default_discount_percent=float(obj.default_discount_percent),
    )


# ─── Currencies ───────────────────────────────────────────────────────────

async def list_currencies(
    db: AsyncSession, tenant_id: UUID
) -> list[CurrencyResponse]:
    items = await get_currencies(db, tenant_id)
    return [
        CurrencyResponse(
            id=str(c.id),
            code=c.code,
            name=c.name_translations,
            exchange_rate=float(c.exchange_rate),
            is_default=c.is_default,
            updated_at=c.updated_at.isoformat() if c.updated_at else None,
        )
        for c in items
    ]


async def create_currency_item(
    db: AsyncSession, tenant_id: UUID, input_data: CurrencyCreateInput
) -> CurrencyResponse:
    # Gap 6: validate code is not empty
    if not input_data.code or not input_data.code.strip():
        raise ValidationError("Currency code is required")

    # Gap 6: check for duplicate code within tenant
    existing = await get_currency_by_code(db, tenant_id, input_data.code.strip())
    if existing is not None:
        raise ConflictError(
            f"Currency with code '{input_data.code}' already exists",
            code="CURRENCY_CODE_TAKEN",
        )

    data = {
        "code": input_data.code.strip().upper(),
        "name_translations": input_data.name.model_dump() if hasattr(input_data.name, "model_dump") else input_data.name,
        "exchange_rate": input_data.exchange_rate,
        "is_default": input_data.is_default,
    }
    obj = await create_currency_repo(db, tenant_id, data)
    return CurrencyResponse(
        id=str(obj.id),
        code=obj.code,
        name=obj.name_translations,
        exchange_rate=float(obj.exchange_rate),
        is_default=obj.is_default,
        updated_at=obj.updated_at.isoformat() if obj.updated_at else None,
    )


async def update_currency_item(
    db: AsyncSession, currency_id: UUID, tenant_id: UUID, input_data: CurrencyPatchInput
) -> CurrencyResponse:
    existing = await get_currency(db, currency_id, tenant_id)
    if existing is None:
        raise NotFoundError(entity="Currency", entity_id=str(currency_id))

    updates: dict = {}
    if input_data.code is not None:
        new_code = input_data.code.strip().upper()
        if new_code != existing.code:
            duplicate = await get_currency_by_code(db, tenant_id, new_code)
            if duplicate is not None:
                raise ConflictError(
                    f"Currency with code '{new_code}' already exists",
                    code="CURRENCY_CODE_TAKEN",
                )
        updates["code"] = new_code
    if input_data.name is not None:
        updates["name_translations"] = (
            input_data.name.model_dump() if hasattr(input_data.name, "model_dump") else input_data.name
        )
    if input_data.exchange_rate is not None:
        updates["exchange_rate"] = input_data.exchange_rate
    if input_data.is_default is not None:
        updates["is_default"] = input_data.is_default

    if updates:
        obj = await patch_currency_repo(db, currency_id, tenant_id, updates)
        if obj is None:
            raise NotFoundError(entity="Currency", entity_id=str(currency_id))
    else:
        obj = existing

    return CurrencyResponse(
        id=str(obj.id),
        code=obj.code,
        name=obj.name_translations,
        exchange_rate=float(obj.exchange_rate),
        is_default=obj.is_default,
        updated_at=obj.updated_at.isoformat() if obj.updated_at else None,
    )


async def remove_currency_item(db: AsyncSession, currency_id: UUID, tenant_id: UUID) -> None:
    existing = await get_currency(db, currency_id, tenant_id)
    if existing is None:
        raise NotFoundError(entity="Currency", entity_id=str(currency_id))

    # Gap 4: 409 if this is the tenant default — checked BEFORE the reference count
    if existing.is_default:
        raise ConflictError("Cannot delete the default currency", code="CURRENCY_IS_DEFAULT")

    # Gap 3: 409 if currency is used in products
    from app.modules.products.internal_api.interface import count_products_by_currency
    product_count = await count_products_by_currency(db, existing.tenant_id, currency_id)
    if product_count > 0:
        raise ConflictError(f"Cannot delete currency: used by {product_count} product(s)", code="CURRENCY_IN_USE")

    await delete_currency(db, currency_id, tenant_id)


# ─── UOMs ─────────────────────────────────────────────────────────────────

async def list_uoms(db: AsyncSession, tenant_id: UUID) -> list[UomResponse]:
    items = await get_uoms(db, tenant_id)
    return [
        UomResponse(
            id=str(u.id),
            code=u.code_translations,
            name=u.name_translations,
            category=u.category,
        )
        for u in items
    ]


async def create_uom_item(
    db: AsyncSession, tenant_id: UUID, input_data: UomCreateInput
) -> UomResponse:
    if input_data.category not in UOM_CATEGORIES:
        raise ValidationError(
            f"Unknown unit category: {input_data.category}", code="UOM_CATEGORY_UNKNOWN"
        )

    data = {
        "code_translations": input_data.code.model_dump() if hasattr(input_data.code, "model_dump") else input_data.code,
        "name_translations": input_data.name.model_dump() if hasattr(input_data.name, "model_dump") else input_data.name,
        "category": input_data.category,
    }
    obj = await create_uom_repo(db, tenant_id, data)
    return UomResponse(
        id=str(obj.id),
        code=obj.code_translations,
        name=obj.name_translations,
        category=obj.category,
    )


async def update_uom_item(
    db: AsyncSession, uom_id: UUID, tenant_id: UUID, input_data: UomPatchInput
) -> UomResponse:
    existing = await get_uom(db, uom_id, tenant_id)
    if existing is None:
        raise NotFoundError(entity="UOM", entity_id=str(uom_id))

    if input_data.category is not None and input_data.category not in UOM_CATEGORIES:
        raise ValidationError(
            f"Unknown unit category: {input_data.category}", code="UOM_CATEGORY_UNKNOWN"
        )

    updates: dict = {}
    if input_data.code is not None:
        updates["code_translations"] = input_data.code.model_dump() if hasattr(input_data.code, "model_dump") else input_data.code
    if input_data.name is not None:
        updates["name_translations"] = input_data.name.model_dump() if hasattr(input_data.name, "model_dump") else input_data.name
    if input_data.category is not None:
        updates["category"] = input_data.category

    if updates:
        obj = await patch_uom_repo(db, uom_id, tenant_id, updates)
        if obj is None:
            raise NotFoundError(entity="UOM", entity_id=str(uom_id))
    else:
        obj = existing

    return UomResponse(
        id=str(obj.id),
        code=obj.code_translations,
        name=obj.name_translations,
        category=obj.category,
    )


async def remove_uom_item(db: AsyncSession, uom_id: UUID, tenant_id: UUID) -> None:
    existing = await get_uom(db, uom_id, tenant_id)
    if existing is None:
        raise NotFoundError(entity="UOM", entity_id=str(uom_id))

    # Gap 3: 409 if UOM is used in products
    from app.modules.products.internal_api.interface import count_products_by_uom
    product_count = await count_products_by_uom(db, existing.tenant_id, uom_id)
    if product_count > 0:
        raise ConflictError(f"Cannot delete UOM: used by {product_count} product(s)", code="UOM_IN_USE")

    await delete_uom(db, uom_id, tenant_id)


# ─── Conversions ──────────────────────────────────────────────────────────

async def list_conversions(
    db: AsyncSession, tenant_id: UUID
) -> list[ConversionResponse]:
    items = await get_conversions(db, tenant_id)
    return [
        ConversionResponse(
            id=str(c.id),
            from_uom_id=str(c.from_uom_id),
            to_uom_id=str(c.to_uom_id),
            type=c.type,
            factor=float(c.factor) if c.factor else None,
            formula_type=c.formula_type,
        )
        for c in items
    ]


async def create_conversion_item(
    db: AsyncSession, tenant_id: UUID, input_data: ConversionCreateInput
) -> ConversionResponse:
    from_uom_id = UUID(input_data.from_uom_id) if isinstance(input_data.from_uom_id, str) else input_data.from_uom_id
    to_uom_id = UUID(input_data.to_uom_id) if isinstance(input_data.to_uom_id, str) else input_data.to_uom_id

    # Gap 1: 422 if fromUomId === toUomId
    if from_uom_id == to_uom_id:
        raise ValidationError("Cannot create a conversion rule between the same unit of measure")

    # C5/БАГ-20: `static` needs a factor, `dynamic` needs a formula.
    _validate_conversion_binding(input_data.type, input_data.factor, input_data.formula_type)

    # Gap 2: 409 if duplicate conversion exists
    existing = await get_conversion_by_uom_pair(db, tenant_id, from_uom_id, to_uom_id)
    if existing is not None:
        raise ConflictError(
            "A conversion rule between these units already exists",
            code="CONVERSION_PAIR_TAKEN",
        )

    data = {
        "from_uom_id": from_uom_id,
        "to_uom_id": to_uom_id,
        "type": input_data.type,
        "factor": input_data.factor,
        "formula_type": input_data.formula_type,
    }
    obj = await create_conversion_repo(db, tenant_id, data)
    return ConversionResponse(
        id=str(obj.id),
        from_uom_id=str(obj.from_uom_id),
        to_uom_id=str(obj.to_uom_id),
        type=obj.type,
        factor=float(obj.factor) if obj.factor else None,
        formula_type=obj.formula_type,
    )


async def update_conversion_item(
    db: AsyncSession, conv_id: UUID, tenant_id: UUID, input_data: ConversionPatchInput
) -> ConversionResponse:
    existing = await get_conversion(db, conv_id, tenant_id)
    if existing is None:
        raise NotFoundError(entity="Conversion", entity_id=str(conv_id))

    # C5/БАГ-20: the binding is checked on the MERGED rule, not only on the delta.
    effective_type = input_data.type if input_data.type is not None else existing.type
    effective_factor = input_data.factor if input_data.factor is not None else existing.factor
    effective_formula = (
        input_data.formula_type if input_data.formula_type is not None else existing.formula_type
    )
    _validate_conversion_binding(effective_type, effective_factor, effective_formula)

    updates: dict = {}
    if input_data.from_uom_id is not None:
        updates["from_uom_id"] = UUID(input_data.from_uom_id) if isinstance(input_data.from_uom_id, str) else input_data.from_uom_id
    if input_data.to_uom_id is not None:
        updates["to_uom_id"] = UUID(input_data.to_uom_id) if isinstance(input_data.to_uom_id, str) else input_data.to_uom_id
    if input_data.type is not None:
        updates["type"] = input_data.type
    if input_data.factor is not None:
        updates["factor"] = input_data.factor
    if input_data.formula_type is not None:
        updates["formula_type"] = input_data.formula_type

    if updates:
        obj = await patch_conversion_repo(db, conv_id, tenant_id, updates)
        if obj is None:
            raise NotFoundError(entity="Conversion", entity_id=str(conv_id))
    else:
        obj = existing

    return ConversionResponse(
        id=str(obj.id),
        from_uom_id=str(obj.from_uom_id),
        to_uom_id=str(obj.to_uom_id),
        type=obj.type,
        factor=float(obj.factor) if obj.factor else None,
        formula_type=obj.formula_type,
    )


async def remove_conversion_item(db: AsyncSession, conv_id: UUID, tenant_id: UUID) -> None:
    existing = await get_conversion(db, conv_id, tenant_id)
    if existing is None:
        raise NotFoundError(entity="Conversion", entity_id=str(conv_id))
    await delete_conversion(db, conv_id, tenant_id)


# ─── Order Statuses ───────────────────────────────────────────────────────

async def list_order_statuses(
    db: AsyncSession, tenant_id: UUID
) -> list[OrderStatusResponse]:
    items = await get_order_statuses(db, tenant_id)
    return [
        OrderStatusResponse(
            id=str(s.id),
            name=s.name_translations,
            color=s.color,
            sort_order=s.sort_order,
            system=s.is_system,
            reserve_on_transition=s.reserve_on_transition,
            write_off_on_transition=s.write_off_on_transition,
        )
        for s in items
    ]


async def create_order_status_item(
    db: AsyncSession, tenant_id: UUID, input_data: OrderStatusCreateInput
) -> OrderStatusResponse:
    data = {
        "name_translations": input_data.name.model_dump() if hasattr(input_data.name, "model_dump") else input_data.name,
        "color": input_data.color,
        "sort_order": input_data.sort_order,
        "is_system": False,
        "reserve_on_transition": input_data.reserve_on_transition,
        "write_off_on_transition": input_data.write_off_on_transition,
    }
    obj = await create_order_status_repo(db, tenant_id, data)
    return OrderStatusResponse(
        id=str(obj.id),
        name=obj.name_translations,
        color=obj.color,
        sort_order=obj.sort_order,
        system=obj.is_system,
        reserve_on_transition=obj.reserve_on_transition,
        write_off_on_transition=obj.write_off_on_transition,
    )


async def update_order_status_item(
    db: AsyncSession, status_id: UUID, tenant_id: UUID, input_data: OrderStatusPatchInput
) -> OrderStatusResponse:
    existing = await get_order_status(db, status_id, tenant_id)
    if existing is None:
        raise NotFoundError(entity="OrderStatus", entity_id=str(status_id))

    updates: dict = {}
    if input_data.name is not None:
        updates["name_translations"] = input_data.name.model_dump() if hasattr(input_data.name, "model_dump") else input_data.name
    if input_data.color is not None:
        updates["color"] = input_data.color
    if input_data.reserve_on_transition is not None:
        updates["reserve_on_transition"] = input_data.reserve_on_transition
    if input_data.write_off_on_transition is not None:
        updates["write_off_on_transition"] = input_data.write_off_on_transition

    if updates:
        obj = await patch_order_status_repo(db, status_id, tenant_id, updates)
        if obj is None:
            raise NotFoundError(entity="OrderStatus", entity_id=str(status_id))
    else:
        obj = existing

    return OrderStatusResponse(
        id=str(obj.id),
        name=obj.name_translations,
        color=obj.color,
        sort_order=obj.sort_order,
        system=obj.is_system,
        reserve_on_transition=obj.reserve_on_transition,
        write_off_on_transition=obj.write_off_on_transition,
    )


async def remove_order_status_item(db: AsyncSession, status_id: UUID, tenant_id: UUID) -> None:
    existing = await get_order_status(db, status_id, tenant_id)
    if existing is None:
        raise NotFoundError(entity="OrderStatus", entity_id=str(status_id))

    # Gap 4: 403 if system status — cannot delete
    if existing.is_system:
        raise ForbiddenError("Cannot delete a system-defined order status")

    # Gap 5: 409 if status is used in orders — skip check, Order model not yet implemented
    # TODO: Add check when Order module exists

    await delete_order_status(db, status_id, tenant_id)


async def reorder_statuses(
    db: AsyncSession, tenant_id: UUID, ordered_ids: list[str]
) -> None:
    """Reorder the tenant's statuses — or refuse, leaving the old order intact.

    The write below is a loop of `UPDATE`s with a single `commit`; on a partial or
    foreign list it silently left part of the statuses with their old `sort_order`,
    so two rows could end up with the same number. `PUT` carries the whole set by
    definition (§3 conventions), so anything else is refused rather than
    half-applied — that refusal is where the atomicity comes from (Н12).
    """
    existing = await get_order_statuses(db, tenant_id)
    known = {str(s.id) for s in existing}
    given = [str(i) for i in ordered_ids]
    if len(set(given)) != len(given) or set(given) != known:
        raise ValidationError(
            "The reorder list must list every status of the tenant exactly once",
            code="ORDER_STATUS_REORDER_INCOMPLETE",
        )
    await reorder_order_statuses(db, tenant_id, ordered_ids)
