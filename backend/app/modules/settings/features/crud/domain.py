"""Domain use cases for Settings CRUD operations."""
import secrets
from decimal import Decimal

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


# Ссылку собирает `POST /api/uploads` как `<base>/static/uploads/<имя файла>`
# (`app/core/uploads/action.py:89`). Значит «свой файл» опознаётся по этому пути,
# а не по одной лишь схеме: строка вида `http://…/что-угодно` загрузкой не является
# и идентификатора не несёт.
_UPLOAD_PATH_MARKER = "/static/uploads/"


def _logo_file_id(value: str) -> str | None:
    """Идентификатор файла из ссылки `POST /api/uploads`; `None` — файл не опознан.

    Превью-строка base64 сюда не попадает по построению (БАГ-18): в ней нет пути
    загрузчика. Ссылка, собранная этим же доменом при чтении, опознаётся повторно —
    PATCH целой секции (клиент шлёт её целиком) не портит логотип.
    """
    path = value.split("?", 1)[0].split("#", 1)[0]
    marker_at = path.rfind(_UPLOAD_PATH_MARKER)
    if marker_at == -1:
        return None
    name = path[marker_at + len(_UPLOAD_PATH_MARKER):].strip("/")
    return name or None


def _logo_link(file_id: str | None) -> str | None:
    """Ссылка собирается при чтении — колонка хранит идентификатор файла (П11).

    Форма пути та же, что у ссылки загрузчика: иначе значение, вернувшееся на PATCH
    целой секции, не опозналось бы. Подписанная ссылка со сроком жизни — механизм
    `backend/app/core/uploads`, общий для всех доменов; эта задача его не строит, и
    здесь стоит путь к файлу как он есть.
    """
    return f"{_UPLOAD_PATH_MARKER}{file_id}" if file_id else None


# ─── Company ──────────────────────────────────────────────────────────────

# Поля карточки, которые пишутся «как есть»: `None` в теле означает «не менять».
# Логотипа здесь нет — у него своя обработка (П11): на проводе ссылка, в колонке
# идентификатор файла. Кода подтверждения здесь тоже нет: П73 называет его
# постоянным и не перевыпускаемым, поэтому телом запроса он не меняется — как
# `system` у статусов заказа, поле не описывается там, где сервер обязан его
# игнорировать.
_COMPANY_FIELDS: dict[str, str] = {
    "name": "name",
    "legal_address": "legal_address",
    "vat_code": "vat_code",
    "bank_name": "bank_name",
    "bank_account": "bank_account",
    "time_zone": "time_zone",
    "country_code": "country_code",
}


def _company_response(company, confirmation_code: str) -> CompanyInfoResponse:
    """Ответ карточки; ссылка на логотип собирается здесь, а не хранится (П11)."""
    return CompanyInfoResponse(
        name=company.name,
        legal_address=company.legal_address or "",
        vat_code=company.vat_code or "",
        bank_name=company.bank_name or "",
        bank_account=company.bank_account or "",
        time_zone=company.time_zone or "",
        country_code=company.country_code or "",
        confirmation_code=confirmation_code,
        logo_link=_logo_link(company.logo_file_id),
    )


async def _issue_confirmation_code(db: AsyncSession, tenant_id: UUID) -> str:
    """Четыре цифры, код постоянный (П73); потерянный — генерируется заново.

    Приём тот же, каким достраивается отсутствующая строка компании: чтение не
    отдаёт пустое значение. Дальше код не перевыпускается — он лежит в колонке.
    """
    code = f"{secrets.randbelow(10_000):04d}"
    await patch_company(db, tenant_id, {"confirmation_code": code})
    return code


async def get_company_info(
    db: AsyncSession, tenant_id: UUID
) -> CompanyInfoResponse:
    company = await get_company(db, tenant_id)
    if company is None:
        # Auto-create singleton if missing — pull tenant name + vat_code
        init_data = await get_tenant_registration_data(db, tenant_id)
        company = await create_company(db, tenant_id, init_data)
    confirmation_code = company.confirmation_code or await _issue_confirmation_code(db, tenant_id)
    return _company_response(company, confirmation_code)


async def patch_company_info(
    db: AsyncSession, tenant_id: UUID, input_data: CompanyPatchInput
) -> CompanyInfoResponse:
    company = await get_company(db, tenant_id)
    if company is None:
        company = await create_company(db, tenant_id, {})

    updates: dict = {}
    if input_data.logo_link is not None:
        # П11: пустая строка стирает логотип, `None` — «не менять».
        raw = input_data.logo_link.strip()
        if raw:
            file_id = _logo_file_id(raw)
            if file_id is None:
                raise ValidationError(
                    "logoUrl must be a link from POST /api/uploads, not embedded base64",
                    code="LOGO_URL_NOT_A_URL",
                )
            updates["logo_file_id"] = file_id
        else:
            updates["logo_file_id"] = None

    for py_field, db_field in _COMPANY_FIELDS.items():
        val = getattr(input_data, py_field, None)
        if val is not None:
            updates[db_field] = val

    if updates:
        updated = await patch_company(db, tenant_id, updates)
        if updated is None:
            raise NotFoundError(entity="Company")
        company = updated

    confirmation_code = company.confirmation_code or await _issue_confirmation_code(db, tenant_id)
    return _company_response(company, confirmation_code)


# ─── Constants ────────────────────────────────────────────────────────────

# Перечень полей ответа и записи берётся из схемы, а не переписывается здесь списком
# имён: список был бы вторым экземпляром того же перечня рядом со схемой, и каждое
# новое поле пришлось бы вписывать в оба места. Колонки модели названы так же, как
# поля схемы, поэтому имя поля сразу и имя колонки.
#
# Границы ниже относятся к трём финансовым величинам (П108–П110) и на прочие
# скаляры ресурса не распространяются: владелец назначил границы только им, а
# назначать их самому — не работа исполнителя.


def _constants_response(obj) -> ConstantsResponse:
    """Собрать ответ по полям схемы; `Numeric` приводится к `float`, как и раньше."""
    values: dict = {}
    for name in ConstantsResponse.model_fields:
        value = getattr(obj, name)
        values[name] = float(value) if isinstance(value, Decimal) else value
    return ConstantsResponse(**values)


async def get_global_constants(
    db: AsyncSession, tenant_id: UUID
) -> ConstantsResponse:
    obj = await get_constants(db, tenant_id)
    if obj is None:
        obj = await create_constants(db, tenant_id, {})
    return _constants_response(obj)


async def patch_global_constants(
    db: AsyncSession, tenant_id: UUID, input_data: ConstantsPatchInput
) -> ConstantsResponse:
    obj = await get_constants(db, tenant_id)
    if obj is None:
        obj = await create_constants(db, tenant_id, {})

    _validate_constant_bounds(input_data)  # C15 — границы, см. CONSTANT_BOUNDS ниже

    # C1: до ревизии `7c4d1e9a3b58` здесь сверялся `defaultCurrency` со списком кодов
    # валют арендатора (C5, `DEFAULT_CURRENCY_UNKNOWN`). Колонка снята по П22 + П68, поля
    # в схеме больше нет — проверять нечего, пришедшее поле тело игнорирует.
    updates: dict = {}
    for name in ConstantsPatchInput.model_fields:
        value = getattr(input_data, name)
        if value is not None:
            updates[name] = value

    if updates:
        updated = await patch_constants(db, tenant_id, updates)
        if updated is None:
            raise NotFoundError(entity="Constants")
        obj = updated

    return _constants_response(obj)


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
        "is_default": input_data.is_default,
    }
    obj = await create_currency_repo(db, tenant_id, data)
    return CurrencyResponse(
        id=str(obj.id),
        code=obj.code,
        name=obj.name_translations,
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


# ─── Constants: owner-assigned bounds (C15) ───────────────────────────────
#
# Границы назначены владельцем (П108–П110) и лежат здесь ОДНИМ словарём, а не тремя
# отдельными проверками: второй экземпляр того же правила рядом с первым — корень трёх
# аудитов подряд (линза Л5). Пара — включительные пределы; `None` на месте предела
# значит «предела нет»: у наценки делового верхнего предела не существует (П109), и
# подгонять её под «0…100» двух соседей нельзя.
CONSTANT_BOUNDS: dict[str, tuple[float | None, float | None]] = {
    "vat_rate": (0.0, 100.0),  # П108
    "default_margin": (-100.0, None),  # П109 — верхнего делового предела нет
    "default_discount_percent": (0.0, 100.0),  # П110
}


def _validate_constant_bounds(input_data: ConstantsPatchInput) -> None:
    """Reject a constant outside its owner-assigned range — `CONSTANT_OUT_OF_RANGE`.

    The refusal names the offending field in `message`, so the caller can tell which of
    the numbers was rejected.
    """
    for field, (low, high) in CONSTANT_BOUNDS.items():
        value = getattr(input_data, field)
        if value is None:
            continue
        if low is not None and value < low:
            raise ValidationError(
                f"{field} must be at least {low}", code="CONSTANT_OUT_OF_RANGE"
            )
        if high is not None and value > high:
            raise ValidationError(
                f"{field} must be at most {high}", code="CONSTANT_OUT_OF_RANGE"
            )
