"""Domain use case for the warehouse.batch_audit slice.

Contains pure business logic — no FastAPI, no DB session management.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError, NotFoundError
from app.core.schemas import TranslatedString

# `BatchNotFoundError` lives once, in the slice that first needed it
# (`warehouse.list_batches`): both slices mean the very same refusal — an unknown
# or foreign batch id — so a second copy here would be a second instance of one
# rule (Л5, `roo_code/skills/verify.md`). The code stays `BATCH_NOT_FOUND`, and
# `app.main`'s `AppError` handler still answers 404 for it.
from app.modules.warehouse.features.list_batches.domain import BatchNotFoundError

from .repository import (
    delete_audit_entry as delete_audit_entry_repo,
)
from .repository import (
    get_batch_by_id,
    list_audit_entries,
)
from .schemas import BatchAuditEntry


class AuditEntryNotFoundError(NotFoundError):
    """The batch exists, but it carries no journal entry with this `id`.

    The contract names this refusal for a repeated delete
    (`roo_code/roo-context/api/warehouse.md`, "DELETE
    /api/warehouse/batches/:batchId/audit/:entryId"): "Повторное удаление той
    же записи отвечает `AUDIT_ENTRY_NOT_FOUND`". The entry is addressed by its
    id, so a second delete of the same id finds nothing and must say so rather
    than answer a silent success — silence is indistinguishable from success.
    """

    def __init__(self, entry_id: UUID) -> None:
        AppError.__init__(
            self, f"Audit entry not found: {entry_id}", code="AUDIT_ENTRY_NOT_FOUND"
        )


def _to_entry(entry) -> BatchAuditEntry:
    return BatchAuditEntry(
        id=entry.id,
        timestamp=entry.timestamp,
        user=TranslatedString(**entry.user_name_translations),
        userInitials=entry.user_initials,
        property=TranslatedString(**entry.property_translations),
        oldValue=entry.old_value,
        newValue=entry.new_value,
    )


async def get_batch_audit(
    db: AsyncSession,
    tenant_id: UUID,
    batch_id: UUID,
) -> list[BatchAuditEntry]:
    """Execute the batch journal read use case.

    Reading never refuses: an unknown `batch_id` and a foreign tenant's batch
    both answer an empty list, not a refusal, and neither writes anything. The
    tenant filter alone makes both true, so no existence check is needed.
    """
    entries = await list_audit_entries(db, batch_id, tenant_id)
    return [_to_entry(entry) for entry in entries]


async def delete_batch_audit_entry(
    db: AsyncSession,
    tenant_id: UUID,
    batch_id: UUID,
    entry_id: UUID,
) -> None:
    """Execute the journal-entry delete use case.

    Two refusals, both 404: `BatchNotFoundError` when the batch is unknown or
    belongs to another tenant, and `AuditEntryNotFoundError` when the batch
    exists but carries no entry with this `id`. The order matters — the batch is
    checked first, so an unknown batch never answers `AUDIT_ENTRY_NOT_FOUND`.
    """
    batch = await get_batch_by_id(db, batch_id, tenant_id)
    if batch is None:
        raise BatchNotFoundError(batch_id)

    deleted = await delete_audit_entry_repo(db, entry_id, batch_id, tenant_id)
    if not deleted:
        raise AuditEntryNotFoundError(entry_id)
