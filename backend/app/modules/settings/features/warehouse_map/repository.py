"""Repository for the settings warehouse-map slice (Infrastructure / Data Access).

One map per tenant, so there is no list, no pagination and no id in the path.
Every statement is scoped by `tenant_id` — that is the only scope either table
has here.

Two tables are touched:

* `warehouse_map` — this slice's own singleton; it keeps the file **identifier**
  (П11) and the metadata block, and it never keeps a link;
* `uploaded_files` — the shared file record of `app/core/uploads`.  It is read
  for the two things the map cannot answer on its own (the metadata the server
  is allowed to believe, and the storage path the derived link is assembled
  from), and it is written for the one thing П31 puts in this slice's hands:
  lifting the draft mark.

The file record is queried here rather than through
`app/core/uploads/service.py`.  That was once a safety reason — the helper
looked a file up by `id` alone and would have handed one tenant the file of
another — but it stopped being one in `6f4a8bf`: `get_file_by_id` now takes a
required `tenant_id` and carries it in the `WHERE`.  So `get_uploaded_file`
below is no longer a workaround, it is a **duplicate** of that helper, and the
only thing keeping it is the cost of removing it: the acceptance harness pins
the tenant predicate of the read at this address
(`roo_code/night-2026-09-21/самопроверка-приёмки.sh`, mutation M9), so
consolidating means moving that mutation too.  Do not copy this local read into
a new slice — call the helper.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.uploads.models import UploadedFile
from app.modules.settings.shared.models import WarehouseMap


async def get_map(db: AsyncSession, tenant_id: UUID) -> WarehouseMap | None:
    """Read the tenant's map row — `None` when nothing was ever saved."""
    result = await db.execute(
        select(WarehouseMap).where(WarehouseMap.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def get_uploaded_file(
    db: AsyncSession, tenant_id: UUID, file_id: UUID
) -> UploadedFile | None:
    """Read the tenant's own file record — another tenant's file reads as absent."""
    result = await db.execute(
        select(UploadedFile).where(
            UploadedFile.id == file_id,
            UploadedFile.tenant_id == tenant_id,
        )
    )
    return result.scalar_one_or_none()


async def clear_draft_mark(db: AsyncSession, tenant_id: UUID, file_id: UUID) -> int:
    """Lift the draft mark off the file — П31's `Save`, done in this slice.

    An `UPDATE`, not a read-modify-write: the mark is one boolean, and the point
    of doing it as a statement is that it is idempotent.  A file that carries no
    mark (the uploader hard-codes `is_draft=False` today, which is why the
    mechanism does not work yet) changes no row, and that is not an error — the
    file is simply not a draft.  Returns the number of rows changed.
    """
    result = await db.execute(
        update(UploadedFile)
        .where(
            UploadedFile.id == file_id,
            UploadedFile.tenant_id == tenant_id,
            UploadedFile.is_draft.is_(True),
        )
        .values(is_draft=False)
    )
    return result.rowcount or 0


async def upsert_map(
    db: AsyncSession,
    tenant_id: UUID,
    map_file_id: str,
    metadata: dict,
) -> WarehouseMap:
    """Write the tenant's single map row, creating it on first save.

    Replacing is the whole operation: there is no history and no second row, so
    the previous file identifier is simply overwritten.  The binary behind the
    overwritten identifier is **not** touched — who deletes it is В4, an open
    owner question, not a guess this repository is allowed to make.
    """
    row = await get_map(db, tenant_id)
    if row is None:
        row = WarehouseMap(
            tenant_id=tenant_id,
            map_file_id=map_file_id,
            file_metadata=metadata,
        )
        db.add(row)
    else:
        row.map_file_id = map_file_id
        row.file_metadata = metadata
    await db.commit()
    await db.refresh(row)
    return row


async def delete_map(db: AsyncSession, tenant_id: UUID) -> None:
    """Remove the tenant's map row if it is there.

    Idempotent by construction: a repeat on an empty map deletes nothing and is
    still a success.  The uploaded file keeps its row and its binary — the
    contract appoints nobody to delete either (В4).
    """
    row = await get_map(db, tenant_id)
    if row is not None:
        await db.delete(row)
        await db.commit()
