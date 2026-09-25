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
