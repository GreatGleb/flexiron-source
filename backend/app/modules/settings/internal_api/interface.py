"""Settings Internal Service API — public contract for cross-module calls.

Other modules MUST call these functions to get settings data.
They MUST NOT import from shared/ or features/ directly.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.settings.features.crud.repository import (
    get_currency_by_code as _get_currency_by_code,
    get_currency as _get_currency,
    get_uom_by_code as _get_uom_by_code,
    get_uom as _get_uom,
    create_company as _create_company,
)
from app.modules.settings.shared.models import Currency, Uom


async def get_currency_by_code(
    db: AsyncSession, tenant_id: UUID, code: str
) -> UUID | None:
    """Get currency ID by code for a tenant. Returns None if not found."""
    currency = await _get_currency_by_code(db, tenant_id, code)
    return currency.id if currency else None


async def get_currency_by_id(
    db: AsyncSession, currency_id: UUID
) -> Currency | None:
    """Get currency ORM object by ID. Returns None if not found."""
    return await _get_currency(db, currency_id)


async def get_uom_by_id(
    db: AsyncSession, uom_id: UUID
) -> Uom | None:
    """Get UOM ORM object by ID. Returns None if not found."""
    return await _get_uom(db, uom_id)


async def get_default_currency(
    db: AsyncSession, tenant_id: UUID
) -> UUID | None:
    """Get the tenant's default currency ID. Returns None if not set."""
    from app.modules.settings.features.crud.repository import (
        get_currencies as _get_currencies,
    )
    currencies = await _get_currencies(db, tenant_id)
    for c in currencies:
        if c.is_default:
            return c.id
    # Fallback: return first currency
    return currencies[0].id if currencies else None


async def get_uom_by_code(
    db: AsyncSession, tenant_id: UUID, code: str
) -> UUID | None:
    """Get UOM ID by short code for a tenant. Returns None if not found."""
    uom = await _get_uom_by_code(db, tenant_id, code)
    return uom.id if uom else None


async def init_company_info(
    db: AsyncSession, tenant_id: UUID, name: str, vat_code: str
) -> None:
    """Initialize company info for a new tenant (called during registration).

    Creates the singleton CompanyInfo row with the company name and VAT code
    that were provided during registration.
    """
    await _create_company(
        db,
        tenant_id,
        {"name": name, "vat_code": vat_code},
    )
