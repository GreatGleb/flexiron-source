"""Schemas for the clients.write_clients slice (Responder / Boundary layer).

The **response** shape is imported, not re-declared: the contract requires the
`POST`/`PATCH` answer to carry exactly the field set of the client card
(`clients.read_clients`), and two hand-written copies of one shape drift silently
(`roo_code/skills/verify.md`, lens L5). The single source for it stays in
`..read_clients.schemas`.

The request models are deliberately permissive. A rejected value must leave the
process as `VALIDATION_ERROR` (422) with the offending field name, which means
the checks live in `domain.py`, not in Pydantic — `paymentTermsDays` is typed
`int | float` so `1.5` reaches the domain and is refused with a code, instead of
being stopped earlier by the request parser with no code at all. `extra="allow"`
keeps unknown top-level keys reachable so the domain can reject them rather than
drop them silently.
"""

from pydantic import BaseModel, ConfigDict

# Re-exported so the slice answers with the card's own schema — one field set for
# one entity, whichever endpoint produced it (task acceptance: key sets must match).
from app.modules.clients.features.read_clients.schemas import (  # noqa: F401
    ClientDetailResponse,
    ClientInteractionResponse,
)

#: The ten top-level body keys both endpoints accept. The server must take this
#: set and reject the rest (contract `clients.md`, "PATCH /api/clients/:id");
#: `rejectionReason` is not among them — П74 removed it from the type and the
#: creation body, and the table carries no column for it.
CLIENT_BODY_FIELDS: frozenset[str] = frozenset(
    {
        "name",
        "companyCode",
        "vatCode",
        "address",
        "country",
        "phone",
        "email",
        "status",
        "paymentTermsDays",
        "notes",
    }
)


class ClientCreateRequest(BaseModel):
    """Body of `POST /api/clients` — the ten-field white list."""

    model_config = ConfigDict(extra="allow")

    name: str | None = None
    companyCode: str | None = None
    vatCode: str | None = None
    address: str | None = None
    country: str | None = None
    phone: str | None = None
    email: str | None = None
    status: str | None = None
    paymentTermsDays: int | float | None = None
    notes: str | None = None


class ClientPatchRequest(ClientCreateRequest):
    """Body of `PATCH /api/clients/:id` — same white list, merge-patch semantics.

    Which keys arrived is read from `model_fields_set`, so an absent key keeps its
    stored value and only a sent key is validated and applied.
    """
