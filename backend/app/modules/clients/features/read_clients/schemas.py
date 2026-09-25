"""Schemas for the clients.read_clients slice (Responder / Boundary layer).

Field names repeat the contract's own casing (`roo_code/roo-context/api/clients.md`,
`frontend_vue/src/types/client.ts` — `Client`), the same way `warehouse.list_batches`'s
schemas already do — no aliasing.
"""

from datetime import date, datetime

from pydantic import BaseModel
from uuid import UUID

from app.core.schemas import TranslatedString


class ClientListItem(BaseModel):
    """Row of `GET /api/clients` — the lightweight client record.

    No `auditLog`, no `interactionHistory`: the list row is deliberately lighter
    than the card (contract `clients.md`, "GET /api/clients", §13 decision
    2026-09-10 — the list is a directory row, the journal and interaction
    history belong to the card).
    """

    id: UUID
    name: str
    companyCode: str
    vatCode: str
    address: str
    country: str | None
    phone: str
    email: str
    status: str
    paymentTermsDays: int
    notes: str | None
    createdAt: date


class ClientInteractionResponse(BaseModel):
    """One entry of the client's interaction history — card only."""

    date: date
    type: str
    summary: str
    user: str


class ClientDetailResponse(BaseModel):
    """Full client record for the card.

    `auditLog` is deliberately absent: its source lives in another module
    (the shared audit log, `00-conventions.md` §9) and reaches the client
    through its own endpoint, not this read slice (task brief). `rejectionReason`
    is absent too — the `clients` table carries no such column (removed by
    П74, `roo_code/roo-context/api/clients.md`, "POST /api/clients").
    """

    id: UUID
    name: str
    companyCode: str
    vatCode: str
    address: str
    country: str | None
    phone: str
    email: str
    status: str
    paymentTermsDays: int
    notes: str | None
    createdAt: date
    interactionHistory: list[ClientInteractionResponse]


class ClientAuditEntryResponse(BaseModel):
    """One row of the client's change journal — `GET /api/clients/:id/audit`.

    Wire field names and shape follow `StockAuditEntry`
    (`roo_code/roo-context/api/clients.md`, "GET /api/clients/:id/audit");
    the storage columns (`user_name_translations`, `property_translations`)
    are mapped to `user`/`property` here, not exposed as-is.
    """

    id: UUID
    timestamp: datetime
    user: TranslatedString
    userInitials: str
    property: TranslatedString
    oldValue: str
    newValue: str
