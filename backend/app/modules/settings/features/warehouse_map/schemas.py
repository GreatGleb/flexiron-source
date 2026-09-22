"""Schemas for the settings warehouse-map slice.

camelCase aliases match `WarehouseMapFile` in
`frontend_vue/src/types/settings.ts:111-119`, the same way the rest of the
domain does.  The type on both sides is one object: `fileId`, `name`, `mime`,
`size`, `url`, `uploadedAt`.

Two fields of the body carry the whole point of П11:

* `fileId` is the **identifier** the map stores — never the link;
* `url` is **accepted and thrown away**.  The link is derived and assembled on
  read, so a client cannot put one into storage.  `size` and `uploadedAt` are
  thrown away for the same reason: the contract says the server "has no right to
  believe" those three (`settings.md`, PUT section), and the truth is read from
  the `uploaded_files` row that `fileId` names.
"""

from pydantic import BaseModel, Field


class WarehouseMapInput(BaseModel):
    """Body of `PUT` — the whole `WarehouseMapFile` the uploader answered with.

    `name`, `size`, `url` and `uploadedAt` are read off the wire and ignored:
    the answer is built from the stored file record, not from the body.  They
    stay declared — and optional — so that the client may keep sending the
    object whole, as it does today.
    """

    file_id: str = Field(alias="fileId")
    mime: str
    name: str | None = None
    size: int | None = None
    url: str | None = None
    uploaded_at: str | None = Field(alias="uploadedAt", default=None)

    model_config = {"populate_by_name": True}


class WarehouseMapResponse(BaseModel):
    """The map as the page reads it — this is the map, `null` is the empty state."""

    file_id: str = Field(alias="fileId")
    name: str
    mime: str
    size: int
    url: str
    uploaded_at: str = Field(alias="uploadedAt")

    model_config = {"populate_by_name": True}
