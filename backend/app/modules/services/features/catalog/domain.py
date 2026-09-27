"""Domain use cases for the services catalog feature.

Currency and UOM are validated against the `settings` module's tenant-scoped
reference tables via `internal_api/interface.py` — never through a direct
import of that module's models or repository.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError as CoreValidationError
from app.modules.settings.internal_api.interface import get_currency_by_id, get_uom_by_id

from .repository import (
    create_service as _create_service,
    get_service_by_id,
    update_service as _update_service,
)
from .schemas import ServiceCreateInput, ServicePatchInput, ServiceResponse


class CatalogServiceNotFoundError(NotFoundError):
    """404 carrying the domain's own code — `CATALOG_SERVICE_NOT_FOUND`.

    Named so it cannot read as a substring of `ORDER_SERVICE_NOT_FOUND` — the
    frontend compares some codes by substring (`orderLineEdits.ts`), and the two
    refusals must never be confused.
    """

    def __init__(self, service_id: str) -> None:
        super().__init__(entity="Service", entity_id=service_id)
        self.code = "CATALOG_SERVICE_NOT_FOUND"


class ServiceCurrencyNotFoundError(CoreValidationError):
    """422 carrying the domain's own code — `SERVICE_CURRENCY_NOT_FOUND`."""

    def __init__(self, currency_id: str) -> None:
        super().__init__(f"Currency not found: {currency_id}")
        self.code = "SERVICE_CURRENCY_NOT_FOUND"


class ServiceUomNotFoundError(CoreValidationError):
    """422 carrying the domain's own code — `SERVICE_UOM_NOT_FOUND`."""

    def __init__(self, uom_id: str) -> None:
        super().__init__(f"UOM not found: {uom_id}")
        self.code = "SERVICE_UOM_NOT_FOUND"


async def get_service_detail(
    db: AsyncSession, tenant_id: UUID, service_id: UUID
) -> ServiceResponse:
    """Execute the get-service-detail use case."""
    service = await get_service_by_id(db, service_id, tenant_id)
    if service is None:
        raise CatalogServiceNotFoundError(str(service_id))
    return _to_response(service)


async def create_service_catalog_entry(
    db: AsyncSession, tenant_id: UUID, input_data: ServiceCreateInput
) -> ServiceResponse:
    """Execute the create-service use case."""
    await _assert_known_pricing(db, tenant_id, input_data.currency_id, input_data.uom_id)

    service = await _create_service(
        db,
        tenant_id,
        name_translations=input_data.name.model_dump(),
        cost_price=input_data.cost_price,
        selling_price=input_data.selling_price,
        currency_id=input_data.currency_id,
        uom_id=input_data.uom_id,
        description_translations=_translations_or_none(input_data.description),
    )
    return _to_response(service)


async def patch_service_catalog_entry(
    db: AsyncSession, tenant_id: UUID, service_id: UUID, input_data: ServicePatchInput
) -> ServiceResponse:
    """Execute the patch-service use case — merge-patch, dirty fields only.

    The final pair (currency, UOM) is validated whenever either half changes —
    not just the half the client sent — because a valid currency next to a
    now-unknown UOM is still an invalid price.
    """
    current = await get_service_by_id(db, service_id, tenant_id)
    if current is None:
        raise CatalogServiceNotFoundError(str(service_id))

    dirty = input_data.model_dump(exclude_unset=True)

    if "currency_id" in dirty or "uom_id" in dirty:
        final_currency_id = input_data.currency_id if "currency_id" in dirty else current.currency_id
        final_uom_id = input_data.uom_id if "uom_id" in dirty else current.uom_id
        await _assert_known_pricing(db, tenant_id, final_currency_id, final_uom_id)

    data: dict = {}
    if "name" in dirty:
        data["name_translations"] = input_data.name.model_dump()
    if "cost_price" in dirty:
        data["cost_price"] = input_data.cost_price
    if "selling_price" in dirty:
        data["selling_price"] = input_data.selling_price
    if "currency_id" in dirty:
        data["currency_id"] = input_data.currency_id
    if "uom_id" in dirty:
        data["uom_id"] = input_data.uom_id
    if "description" in dirty:
        data["description_translations"] = _translations_or_none(input_data.description)

    if not data:
        return _to_response(current)

    service = await _update_service(db, service_id, tenant_id, data)
    if service is None:
        raise CatalogServiceNotFoundError(str(service_id))
    return _to_response(service)


async def _assert_known_pricing(
    db: AsyncSession, tenant_id: UUID, currency_id: UUID | None, uom_id: UUID | None
) -> None:
    """Reject a currency or UOM this tenant's settings do not know about."""
    if currency_id is None or await get_currency_by_id(db, currency_id, tenant_id) is None:
        raise ServiceCurrencyNotFoundError(str(currency_id))
    if uom_id is None or await get_uom_by_id(db, uom_id, tenant_id) is None:
        raise ServiceUomNotFoundError(str(uom_id))


def _translations_or_none(value) -> dict | None:
    return value.model_dump() if value is not None else None


def _to_response(service) -> ServiceResponse:
    """Map the ORM model to the wire response — snake_case columns to camelCase."""
    description = service.description_translations
    return ServiceResponse(
        id=service.id,
        name=service.name_translations,
        cost_price=service.cost_price,
        selling_price=service.selling_price,
        currency_id=service.currency_id,
        uom_id=service.uom_id,
        description=description if description else None,
        created_at=service.created_at,
        updated_at=service.updated_at,
    )


# ── List and archive ────────────────────────────────────────────────────────
# Appended below the card/create/patch use cases rather than merged into the top
# imports, so the addition doesn't shift the line numbers any document cites.
from datetime import datetime, timezone  # noqa: E402

from app.core.schemas import PaginatedResponse  # noqa: E402

from .repository import (  # noqa: E402
    archive_service as _archive_service,
    list_services as _list_services,
)

#: Upper bound for `pageSize`, named by the second consumer: the add-services
#: modal pulls the whole catalogue in one request with `pageSize=1000`
#: (`AddOrderServicesModal.vue`), so that value must be allowed.
MAX_PAGE_SIZE = 1000

#: Contract default when `sortBy` is absent (`roo_code/roo-context/api/services.md`,
#: "GET /api/services"). An empty string is not absent — it means "do not sort".
DEFAULT_SORT_BY = "name"


def _as_int(value: str | None, default: int) -> int:
    """Read a query string as an int, falling back to the default.

    The list declares no errors at all, so neither an empty value nor a
    non-numeric one may raise here: both fall back to the default.
    """
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


async def list_service_catalog(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    search: str | None = None,
    sort_by: str | None = None,
    sort_dir: str | None = None,
    page: str | None = None,
    page_size: str | None = None,
) -> PaginatedResponse[ServiceResponse]:
    """Execute the list-services use case.

    All five query params may arrive empty; an empty string means "no filter". An
    absent `sortBy` defaults to `name`, while an empty or unknown one means "do not
    sort" — the rows keep the storage order and nothing is refused. Both `total`
    and `totalPages` are derived at read time, never stored.
    """
    normalized_search = search or None
    page_number = max(_as_int(page, 1), 1)
    page_size_number = min(max(_as_int(page_size, 25), 1), MAX_PAGE_SIZE)
    effective_sort_by = DEFAULT_SORT_BY if sort_by is None else sort_by
    sort_desc = (sort_dir or "asc") == "desc"

    entities, total = await _list_services(
        db,
        tenant_id,
        search=normalized_search,
        sort_by=effective_sort_by,
        sort_desc=sort_desc,
        page=page_number,
        page_size=page_size_number,
    )

    return PaginatedResponse[ServiceResponse](
        items=[_to_response(service) for service in entities],
        total=total,
        page=page_number,
        pageSize=page_size_number,
        totalPages=-(-total // page_size_number),
    )


async def archive_service_catalog_entry(
    db: AsyncSession, tenant_id: UUID, service_id: UUID
) -> None:
    """Execute the archive-service use case (П44 — DELETE means archive).

    The row is never removed and stays readable to old orders. A missing service,
    a foreign tenant's service and an already archived one are indistinguishable
    and all raise the contract's 404 `CATALOG_SERVICE_NOT_FOUND`: this DELETE is
    deliberately not idempotent.
    """
    archived = await _archive_service(
        db, service_id, tenant_id, datetime.now(timezone.utc)
    )
    if archived is None:
        raise CatalogServiceNotFoundError(str(service_id))
