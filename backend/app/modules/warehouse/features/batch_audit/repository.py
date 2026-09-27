"""Repository for the warehouse.batch_audit slice (Infrastructure / Data Access layer).

The journal's storage is the warehouse's own `stock_audit_entries` table — the
single warehouse table bound to a batch (`StockAuditEntry`,
`app/modules/warehouse/shared/models.py`): the author is the pair of the
`user_id` reference and the frozen name snapshot, the label texts are JSONB. No
other journal of the domain owns a table, and this slice touches none of them.
"""

from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.warehouse.shared.models import StockAuditEntry, WarehouseBatch


async def get_batch_by_id(
    db: AsyncSession,
    batch_id: UUID,
    tenant_id: UUID,
) -> WarehouseBatch | None:
    """Fetch one batch by id, tenant-scoped — the existence check the delete
    needs before it can tell "no batch" from "no entry" (same rule
    `warehouse.list_batches`'s `get_batch_by_id` uses)."""
    result = await db.execute(
        select(WarehouseBatch).where(
            WarehouseBatch.id == batch_id,
            WarehouseBatch.tenant_id == tenant_id,
        )
    )
    return result.scalar_one_or_none()


async def list_audit_entries(
    db: AsyncSession,
    batch_id: UUID,
    tenant_id: UUID,
) -> list[StockAuditEntry]:
    """One batch's journal, newest first, tenant-scoped.

    Order is `timestamp` descending with `id` descending as a stable tie-break —
    the same order the client journal answers with
    (`clients.read_clients`'s `get_client_audit`), so two journals of one
    application do not behave differently. The tenant is filtered here
    independently of any batch lookup: a batch id alone must never leak another
    tenant's rows.
    """
    result = await db.execute(
        select(StockAuditEntry)
        .where(
            StockAuditEntry.batch_id == batch_id,
            StockAuditEntry.tenant_id == tenant_id,
        )
        .order_by(StockAuditEntry.timestamp.desc(), StockAuditEntry.id.desc())
    )
    return list(result.scalars().all())


async def delete_audit_entry(
    db: AsyncSession,
    entry_id: UUID,
    batch_id: UUID,
    tenant_id: UUID,
) -> bool:
    """Delete one journal row, addressed by its own `id` — never by position —
    scoped to its batch and its tenant at once.

    Returns whether a row was found and removed, so the domain can raise
    `AUDIT_ENTRY_NOT_FOUND` instead of answering a silent success (§9 of
    `roo_code/roo-context/api/00-conventions.md`: "Неизвестный `entryId` —
    отказ, а не тихий no-op").
    """
    result = await db.execute(
        delete(StockAuditEntry).where(
            StockAuditEntry.id == entry_id,
            StockAuditEntry.batch_id == batch_id,
            StockAuditEntry.tenant_id == tenant_id,
        )
    )
    await db.flush()
    return result.rowcount > 0
