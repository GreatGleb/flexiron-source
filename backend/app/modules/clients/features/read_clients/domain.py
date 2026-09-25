"""Domain use cases for the clients.read_clients slice.

Contains pure business logic — no FastAPI, no DB session management.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError, NotFoundError
from app.core.schemas import PaginatedResponse, TranslatedString
from app.modules.audit.internal_api.interface import read_audit_entries_for_entity
from app.modules.clients.shared.models import Client

from .repository import (
    count_clients,
    get_client_by_id,
    list_interactions,
)
from .repository import list_clients as list_clients_repo
from .schemas import (
    ClientAuditEntryResponse,
    ClientDetailResponse,
    ClientInteractionResponse,
    ClientListItem,
)

#: The `entity_type` this slice's clients are registered under in the shared
#: audit journal (`app.modules.audit.shared.models.AUDIT_ENTITY_TYPES`).
CLIENT_AUDIT_ENTITY_TYPE = "client"

MAX_PAGE_SIZE = 100

#: `sortBy` values the contract admits (`roo_code/roo-context/api/clients.md`,
#: "GET /api/clients"). Anything else — including an absent value — is treated
#: as "no sort requested" rather than raising.
SORTABLE_FIELDS = {"name", "email", "status", "createdAt"}

#: Default order when `sortBy` is absent. The mock — this endpoint's source of
#: truth while it stays unimplemented — applies no sort at all in that case
#: and returns clients in whatever order the store already holds them
#: (`mocks/index.ts:602-615`, the `if (sortBy)` guard skipped entirely). A SQL
#: table has no such "storage order" without an explicit `ORDER BY`, so this
#: reads the mock's intent as "creation order" — `createdAt` ascending, the
#: order the mock's own seed array happens to be in — with `id` as a stable
#: tie-break so pagination doesn't reshuffle rows sharing a timestamp.
DEFAULT_SORT_BY = "createdAt"
DEFAULT_SORT_DESC = False


class ClientNotFoundError(NotFoundError):
    """Unknown or foreign `client_id` — the domain's own refusal code.

    `NotFoundError.__init__` hardcodes `code="NOT_FOUND"`, so this bypasses it
    and calls `AppError.__init__` directly with the domain code the contract
    names (`roo_code/roo-context/api/clients.md`, "GET /api/clients/:id").
    `isinstance(exc, NotFoundError)` still holds, so `app.main`'s `AppError`
    handler answers 404 without any change to `app/core/exceptions.py`.
    """

    def __init__(self, client_id: UUID) -> None:
        AppError.__init__(self, f"Client not found: {client_id}", code="CLIENT_NOT_FOUND")


def _normalize_search(search: str | None) -> str | None:
    if search is None or not search.strip():
        return None
    return search.strip()


def _normalize_status(status: str | None) -> str | None:
    """Empty or missing `status` means "any" (contract `clients.md`, rule)."""
    if not status:
        return None
    return status


def _to_list_item(entity: Client) -> ClientListItem:
    return ClientListItem(
        id=entity.id,
        name=entity.name,
        companyCode=entity.company_code,
        vatCode=entity.vat_code,
        address=entity.address,
        country=entity.country,
        phone=entity.phone,
        email=entity.email,
        status=entity.status,
        paymentTermsDays=entity.payment_terms_days,
        notes=entity.notes,
        createdAt=entity.created_at,
    )


async def list_clients(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    search: str | None,
    status: str | None,
    sort_by: str | None,
    sort_dir: str | None,
    page: int,
    page_size: int,
) -> PaginatedResponse[ClientListItem]:
    """Execute the list clients use case."""
    search = _normalize_search(search)
    status = _normalize_status(status)
    page = max(page, 1)
    page_size = min(max(page_size, 1), MAX_PAGE_SIZE)

    if sort_by in SORTABLE_FIELDS:
        effective_sort_by = sort_by
        effective_sort_desc = (sort_dir or "asc").lower() == "desc"
    else:
        effective_sort_by = DEFAULT_SORT_BY
        effective_sort_desc = DEFAULT_SORT_DESC

    total = await count_clients(db, tenant_id, search=search, status=status)
    entities = await list_clients_repo(
        db,
        tenant_id,
        search=search,
        status=status,
        sort_by=effective_sort_by,
        sort_desc=effective_sort_desc,
        page=page,
        page_size=page_size,
    )

    return PaginatedResponse[ClientListItem](
        items=[_to_list_item(entity) for entity in entities],
        total=total,
        page=page,
        pageSize=page_size,
        totalPages=max(1, -(-total // page_size)),
    )


async def get_client_detail(
    db: AsyncSession, tenant_id: UUID, client_id: UUID
) -> ClientDetailResponse:
    """Execute the get client detail use case.

    Raises `ClientNotFoundError` (code `CLIENT_NOT_FOUND`) for an unknown id
    or one that belongs to another tenant — the two are indistinguishable by
    design (`get_client_by_id` filters by `tenant_id` itself).
    """
    client = await get_client_by_id(db, client_id, tenant_id)
    if client is None:
        raise ClientNotFoundError(client_id)

    interactions = await list_interactions(db, client_id, tenant_id)

    return ClientDetailResponse(
        id=client.id,
        name=client.name,
        companyCode=client.company_code,
        vatCode=client.vat_code,
        address=client.address,
        country=client.country,
        phone=client.phone,
        email=client.email,
        status=client.status,
        paymentTermsDays=client.payment_terms_days,
        notes=client.notes,
        createdAt=client.created_at,
        interactionHistory=[
            ClientInteractionResponse(
                date=entry.date,
                type=entry.type,
                summary=entry.summary,
                user=entry.user_name,
            )
            for entry in interactions
        ],
    )


async def get_client_audit(
    db: AsyncSession, tenant_id: UUID, client_id: UUID
) -> list[ClientAuditEntryResponse]:
    """Execute the client audit-journal use case.

    An unknown or foreign `client_id` yields an empty list, never a refusal:
    the contract names no error for this endpoint (`roo_code/roo-context/api/clients.md`,
    "GET /api/clients/:id/audit", "Ошибки: ни одной"). No existence check is
    needed to get that behaviour — `read_audit_entries_for_entity` already
    filters by `tenant_id` *and* `entity_id`, so a client id from another
    tenant (or one that doesn't exist at all) simply matches zero rows.
    """
    entries = await read_audit_entries_for_entity(
        db,
        tenant_id=tenant_id,
        entity_type=CLIENT_AUDIT_ENTITY_TYPE,
        entity_id=client_id,
    )
    return [
        ClientAuditEntryResponse(
            id=entry.id,
            timestamp=entry.timestamp,
            user=TranslatedString(**entry.user_name_translations),
            userInitials=entry.user_initials,
            property=TranslatedString(**entry.property_translations),
            oldValue=entry.old_value,
            newValue=entry.new_value,
        )
        for entry in entries
    ]
