"""Domain use case for the settings warehouse-map slice.

Three rules steer this file, and each was written down before it:

* **П11 — the column keeps a file identifier, never a link.** The link is
  derived here, on every read, in one place (`_derived_link`).  The signing that
  will make it signed and short-lived lives in `app/core/uploads` and is shared
  by every domain; this slice does not build it, and until it exists the delivery
  is the previous static path — the temporary arrangement the brief names, not a
  second mechanism.
* **П31 — the `PUT` *is* the `Save`.**  Saving the map lifts the draft mark from
  the file the saved map names, in the same transaction as the map row.  A map
  uploaded and never confirmed therefore stays a draft and leaves by TTL, which
  is why the owner is not asked about it.
* **В4 — who deletes the binary of a map that was attached and then orphaned by
  a replacement or a deletion is an open owner question.**  `PUT` and `DELETE`
  do their work and the orphaned binary stays: that is the prescribed behaviour,
  not an omission.  Nothing here re-drafts the previous file and nothing deletes
  a binary — those are the two answers, and guessing either is forbidden.

The body is not believed about `url`, `size` and `uploadedAt` (the contract says
so out loud): every field of the answer except the identifier is read from the
stored file record of the named file.
"""

from __future__ import annotations

from pathlib import Path
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError as CoreValidationError
from app.core.uploads.models import UploadedFile
from app.modules.settings.features.warehouse_map.repository import (
    clear_draft_mark,
    delete_map as delete_map_repo,
    get_map as get_map_repo,
    get_uploaded_file,
    upsert_map,
)
from app.modules.settings.features.warehouse_map.schemas import (
    WarehouseMapInput,
    WarehouseMapResponse,
)
from app.modules.settings.shared.models import WarehouseMap

#: Where `app/main.py` mounts the upload directory.  The one prefix the derived
#: link is built with today, and the one that signing will replace.
STATIC_UPLOADS_PREFIX = "/static/uploads"


class MapNotAnImageError(CoreValidationError):
    """415 carrying the contract's own code — `MAP_NOT_AN_IMAGE`.

    The core `ValidationError` hardcodes the shared `VALIDATION_ERROR`, and the
    status the contract names for this code is 415, which no core class answers.
    So the domain extends the core class — the global `AppError` handler matches
    by MRO, so even an uncaught one would answer 422 rather than 500 — and the
    route maps it to 415, the shape `MAIL_NOT_CONFIGURED` uses for 409.
    """

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.code = "MAP_NOT_AN_IMAGE"


def _as_uuid(value: str) -> UUID | None:
    """Read a file identifier, or `None` when the text is not an identifier."""
    try:
        return UUID(value)
    except (TypeError, ValueError, AttributeError):
        return None


def _derived_link(storage_path: str | None) -> str:
    """Assemble the link **on read** — П11: no link is ever stored.

    No storage path means no link.  A map row on its own cannot produce one, and
    inventing a link to nothing would be worse than an empty string the page can
    see through.
    """
    if not storage_path:
        return ""
    return f"{STATIC_UPLOADS_PREFIX}/{Path(storage_path).name}"


def to_response(
    row: WarehouseMap, file_row: UploadedFile | None
) -> WarehouseMapResponse:
    """Map the stored row to the answer, deriving the link on the way out."""
    meta = row.file_metadata or {}
    return WarehouseMapResponse(
        file_id=row.map_file_id,
        name=str(meta.get("name", "")),
        mime=str(meta.get("mime", "")),
        size=int(meta.get("size", 0) or 0),
        url=_derived_link(file_row.storage_path if file_row is not None else None),
        uploaded_at=str(meta.get("uploadedAt", "")),
    )


async def _find_file(
    db: AsyncSession, tenant_id: UUID, file_id: str
) -> UploadedFile | None:
    """The stored identifier back to a file record of this tenant."""
    parsed = _as_uuid(file_id)
    if parsed is None:
        return None
    return await get_uploaded_file(db, tenant_id, parsed)


async def get_warehouse_map(
    db: AsyncSession, tenant_id: UUID
) -> WarehouseMapResponse | None:
    """Read the map — `None` is a **success** answer, not a 404.

    The empty state of the page is built on it, so a tenant with no map gets a
    null, never a refusal.  The metadata is served from the stored row, so it
    survives a file record that can no longer be read; the link comes from the
    file record, because that is where the storage path is.
    """
    row = await get_map_repo(db, tenant_id)
    if row is None:
        return None
    file_row = await _find_file(db, tenant_id, row.map_file_id)
    return to_response(row, file_row)


async def save_warehouse_map(
    db: AsyncSession,
    tenant_id: UUID,
    input_data: WarehouseMapInput,
) -> WarehouseMapResponse:
    """Save the map — and, by П31, lift the draft mark from the file it names.

    The `fileId` must name an uploaded file **of this tenant**: the size, the
    name, the mime and the timestamp of the answer are all read from that record
    rather than from the body, which is what the contract asks for when it says
    the server has no right to believe them.  An identifier that names nothing
    would leave a map that can never be shown, so it is refused — with the core
    `NOT_FOUND`, no new code name invented.
    """
    file_id = _as_uuid(input_data.file_id)
    file_row = (
        await get_uploaded_file(db, tenant_id, file_id)
        if file_id is not None
        else None
    )
    if file_row is None:
        raise NotFoundError(entity="UploadedFile", entity_id=input_data.file_id)

    # Two checks, one code.  The first is the contract's own rule — the type is
    # verified on the server, not only by the uploader's `accept` attribute; the
    # second is the truth the answer is built from, so a body that claims
    # `image/png` over a stored non-image cannot put a PDF behind an <img>.
    if not (input_data.mime or "").startswith("image/"):
        raise MapNotAnImageError("The warehouse map must be an image")
    if not (file_row.mime or "").startswith("image/"):
        raise MapNotAnImageError("The warehouse map must be an image")

    # П31: the mark is lifted here, and it is committed together with the row
    # written below — a save that fails must not leave a file looking confirmed.
    await clear_draft_mark(db, tenant_id, file_row.id)

    metadata = {
        "name": file_row.original_name,
        "mime": file_row.mime,
        "size": file_row.size,
        "uploadedAt": file_row.uploaded_at.isoformat() if file_row.uploaded_at else "",
    }
    row = await upsert_map(db, tenant_id, str(file_row.id), metadata)
    return to_response(row, file_row)


async def delete_warehouse_map(db: AsyncSession, tenant_id: UUID) -> None:
    """Remove the map.  Idempotent, and the file is left where it is.

    The page returns to its empty state; the uploaded file keeps its row and its
    binary, because the contract appoints nobody to delete either (В4, open).
    """
    await delete_map_repo(db, tenant_id)
