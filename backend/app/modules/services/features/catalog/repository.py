"""Repository for the services catalog feature (Infrastructure / Data Access layer)."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.services.shared.models import Service


async def get_service_by_id(
    db: AsyncSession, service_id: UUID, tenant_id: UUID
) -> Service | None:
    """Fetch a service by its ID and tenant_id. A foreign row reads as absent."""
    result = await db.execute(
        select(Service).where(
            Service.id == service_id,
            Service.tenant_id == tenant_id,
        )
    )
    return result.scalar_one_or_none()


async def create_service(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    name_translations: dict,
    cost_price: float,
    selling_price: float,
    currency_id: UUID,
    uom_id: UUID,
    description_translations: dict | None,
) -> Service:
    """Insert a new service into the tenant's catalog."""
    service = Service(
        tenant_id=tenant_id,
        name_translations=name_translations,
        cost_price=cost_price,
        selling_price=selling_price,
        currency_id=currency_id,
        uom_id=uom_id,
        description_translations=description_translations,
    )
    db.add(service)
    await db.flush()
    await db.refresh(service)
    return service


async def update_service(
    db: AsyncSession,
    service_id: UUID,
    tenant_id: UUID,
    data: dict,
) -> Service | None:
    """Merge-patch a service's columns from `data`, tenant-scoped."""
    service = await get_service_by_id(db, service_id, tenant_id)
    if service is None:
        return None
    for key, value in data.items():
        setattr(service, key, value)
    await db.flush()
    await db.refresh(service)
    return service


# ── List and archive ────────────────────────────────────────────────────────
# Appended below the card/create/patch block rather than merged into the top
# imports, so the addition doesn't shift the line numbers any document cites.
from datetime import datetime  # noqa: E402

from sqlalchemy import func, or_  # noqa: E402

#: The three locale keys `search` matches — the contract's "во всех трёх переводах
#: имени" (`roo_code/roo-context/api/services.md`, "GET /api/services").
SEARCH_LOCALES = ("ru", "en", "lt")

#: Fixed allow-list of sortable columns — never a bare `getattr(Service, sort_by)`
#: on request input. `name` is handled separately: it sorts by the ENGLISH variant
#: at any reader language, and an unknown sort key adds no `ORDER BY` at all.
SORTABLE_COLUMNS = {
    "costPrice": Service.cost_price,
    "sellingPrice": Service.selling_price,
    "createdAt": Service.created_at,
}


def _name_sort_column():
    """The English name — the one translation the name sort is defined in.

    `coalesce(..., "")` gives a row without an English key the same standing as
    the mock's `a.name.en.localeCompare(b.name.en)` for an empty string: a missing
    key reads NULL out of `->>`, and NULL would order apart from `""`.
    """
    return func.coalesce(Service.name_translations["en"].as_string(), "")


def _search_predicate(search: str):
    """Substring match over all three translations of the name.

    Each locale is read out of the JSONB column (`->>`) rather than the whole
    column being cast: a cast would also match the language KEYS (`en`, `ru`,
    `lt`), which is not what "search the name" means.
    """
    pattern = f"%{search}%"
    return or_(
        *(
            Service.name_translations[locale].as_string().ilike(pattern)
            for locale in SEARCH_LOCALES
        )
    )


async def list_services(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    search: str | None = None,
    sort_by: str | None = None,
    sort_desc: bool = False,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[Service], int]:
    """One page of live services plus the filtered total, tenant-scoped.

    Two conditions are in every list query: the caller's tenant (Б3) and the live
    rows only — `archived_at IS NULL`, the pair the `(tenant_id, archived_at)`
    index exists for (П44). No recognised `sort_by` means no `ORDER BY` at all —
    the rows keep the storage order, which is what an unknown sort key must
    produce rather than a refusal. Ties on a recognised column break by `id` so
    paging stays stable. `total` is computed here, on read.
    """
    query = select(Service).where(
        Service.tenant_id == tenant_id,
        Service.archived_at.is_(None),
    )
    if search:
        query = query.where(_search_predicate(search))

    count_stmt = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    column = _name_sort_column() if sort_by == "name" else SORTABLE_COLUMNS.get(sort_by)
    if column is not None:
        order = column.desc() if sort_desc else column.asc()
        query = query.order_by(order, Service.id.asc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def archive_service(
    db: AsyncSession,
    service_id: UUID,
    tenant_id: UUID,
    archived_at: datetime,
) -> Service | None:
    """Stamp `archived_at` on a live row, tenant-scoped.

    The `archived_at IS NULL` guard is what makes this DELETE non-idempotent: a
    missing row, a foreign one and an already archived one all read as absent, and
    the domain turns that into the contract's 404 (П44).
    """
    result = await db.execute(
        select(Service).where(
            Service.id == service_id,
            Service.tenant_id == tenant_id,
            Service.archived_at.is_(None),
        )
    )
    service = result.scalar_one_or_none()
    if service is None:
        return None
    service.archived_at = archived_at
    await db.flush()
    await db.refresh(service)
    return service
