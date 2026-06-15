"""Domain use cases for Settings CRUD operations."""

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


# ─── Company ──────────────────────────────────────────────────────────────

async def get_company_info(
    db: AsyncSession, tenant_id: UUID
) -> CompanyInfoResponse:
    company = await get_company(db, tenant_id)
    if company is None:
        # Auto-create singleton if missing
        company = await create_company(db, tenant_id, {})
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
    data = {
        "code": input_data.code,
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
    db: AsyncSession, currency_id: UUID, input_data: CurrencyPatchInput
) -> CurrencyResponse:
    existing = await get_currency(db, currency_id)
    if existing is None:
        raise NotFoundError(entity="Currency", entity_id=str(currency_id))

    updates: dict = {}
    if input_data.code is not None:
        updates["code"] = input_data.code
    if input_data.name is not None:
        updates["name_translations"] = (
            input_data.name.model_dump() if hasattr(input_data.name, "model_dump") else input_data.name
        )
    if input_data.exchange_rate is not None:
        updates["exchange_rate"] = input_data.exchange_rate
    if input_data.is_default is not None:
        updates["is_default"] = input_data.is_default

    if updates:
        obj = await patch_currency_repo(db, currency_id, updates)
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


async def remove_currency_item(db: AsyncSession, currency_id: UUID) -> None:
    existing = await get_currency(db, currency_id)
    if existing is None:
        raise NotFoundError(entity="Currency", entity_id=str(currency_id))
    await delete_currency(db, currency_id)


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
    db: AsyncSession, uom_id: UUID, input_data: UomPatchInput
) -> UomResponse:
    existing = await get_uom(db, uom_id)
    if existing is None:
        raise NotFoundError(entity="UOM", entity_id=str(uom_id))

    updates: dict = {}
    if input_data.code is not None:
        updates["code_translations"] = input_data.code.model_dump() if hasattr(input_data.code, "model_dump") else input_data.code
    if input_data.name is not None:
        updates["name_translations"] = input_data.name.model_dump() if hasattr(input_data.name, "model_dump") else input_data.name
    if input_data.category is not None:
        updates["category"] = input_data.category

    if updates:
        obj = await patch_uom_repo(db, uom_id, updates)
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


async def remove_uom_item(db: AsyncSession, uom_id: UUID) -> None:
    existing = await get_uom(db, uom_id)
    if existing is None:
        raise NotFoundError(entity="UOM", entity_id=str(uom_id))
    await delete_uom(db, uom_id)


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
    data = {
        "from_uom_id": UUID(input_data.from_uom_id) if isinstance(input_data.from_uom_id, str) else input_data.from_uom_id,
        "to_uom_id": UUID(input_data.to_uom_id) if isinstance(input_data.to_uom_id, str) else input_data.to_uom_id,
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
    db: AsyncSession, conv_id: UUID, input_data: ConversionPatchInput
) -> ConversionResponse:
    existing = await get_conversion(db, conv_id)
    if existing is None:
        raise NotFoundError(entity="Conversion", entity_id=str(conv_id))

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
        obj = await patch_conversion_repo(db, conv_id, updates)
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


async def remove_conversion_item(db: AsyncSession, conv_id: UUID) -> None:
    existing = await get_conversion(db, conv_id)
    if existing is None:
        raise NotFoundError(entity="Conversion", entity_id=str(conv_id))
    await delete_conversion(db, conv_id)


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
            order=s.sort_order,
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
        "sort_order": input_data.order,
        "is_system": False,
        "reserve_on_transition": input_data.reserve_on_transition,
        "write_off_on_transition": input_data.write_off_on_transition,
    }
    obj = await create_order_status_repo(db, tenant_id, data)
    return OrderStatusResponse(
        id=str(obj.id),
        name=obj.name_translations,
        color=obj.color,
        order=obj.sort_order,
        system=obj.is_system,
        reserve_on_transition=obj.reserve_on_transition,
        write_off_on_transition=obj.write_off_on_transition,
    )


async def update_order_status_item(
    db: AsyncSession, status_id: UUID, input_data: OrderStatusPatchInput
) -> OrderStatusResponse:
    existing = await get_order_status(db, status_id)
    if existing is None:
        raise NotFoundError(entity="OrderStatus", entity_id=str(status_id))

    updates: dict = {}
    if input_data.name is not None:
        updates["name_translations"] = input_data.name.model_dump() if hasattr(input_data.name, "model_dump") else input_data.name
    if input_data.color is not None:
        updates["color"] = input_data.color
    if input_data.order is not None:
        updates["sort_order"] = input_data.order
    if input_data.reserve_on_transition is not None:
        updates["reserve_on_transition"] = input_data.reserve_on_transition
    if input_data.write_off_on_transition is not None:
        updates["write_off_on_transition"] = input_data.write_off_on_transition

    if updates:
        obj = await patch_order_status_repo(db, status_id, updates)
        if obj is None:
            raise NotFoundError(entity="OrderStatus", entity_id=str(status_id))
    else:
        obj = existing

    return OrderStatusResponse(
        id=str(obj.id),
        name=obj.name_translations,
        color=obj.color,
        order=obj.sort_order,
        system=obj.is_system,
        reserve_on_transition=obj.reserve_on_transition,
        write_off_on_transition=obj.write_off_on_transition,
    )


async def remove_order_status_item(db: AsyncSession, status_id: UUID) -> None:
    existing = await get_order_status(db, status_id)
    if existing is None:
        raise NotFoundError(entity="OrderStatus", entity_id=str(status_id))
    await delete_order_status(db, status_id)


async def reorder_statuses(
    db: AsyncSession, tenant_id: UUID, ordered_ids: list[str]
) -> None:
    await reorder_order_statuses(db, tenant_id, ordered_ids)
