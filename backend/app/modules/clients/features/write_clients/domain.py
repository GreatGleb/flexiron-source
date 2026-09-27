"""Domain use cases for the clients.write_clients slice.

`POST /api/clients` (create) and `PATCH /api/clients/:id` (merge-patch). Pure
business logic — no FastAPI, no SQL, no session management.

Both endpoints take the same ten-key white list and reject anything else with
`VALIDATION_ERROR` (422); uniqueness repeats answer 409 with the field's own code
and the field name. The read slice owns `ClientNotFoundError` and the response
schema, and both are imported here rather than re-declared, so one rule and one
shape have one source (`roo_code/skills/verify.md`, lens L5).
"""

import re
from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ValidationError
from app.modules.clients.features.read_clients.domain import ClientNotFoundError
from app.modules.clients.features.read_clients.repository import list_interactions
from app.modules.clients.features.read_clients.schemas import (
    ClientDetailResponse,
    ClientInteractionResponse,
)
from app.modules.clients.shared.models import Client, ClientInteraction

from .countries import is_country_code
from .repository import (
    create_client_record,
    find_client_by_company_code,
    find_client_by_email,
    find_client_by_vat_code,
    get_client_record,
    update_client_record,
)
from .schemas import CLIENT_BODY_FIELDS, ClientCreateRequest, ClientPatchRequest

#: The two legal `status` values — the closed list the frontend type already
#: declares (`frontend_vue/src/types/client.ts`, `Client.status`), untill now
#: checked by nobody.
STATUS_VALUES = frozenset({"active", "inactive"})

#: Same address shape the create form checks (`ClientCreatePage.vue`,
#: `EMAIL_REGEX`). Non-emptiness is not enough: the contract calls the format the
#: server's own duty, and the rule today lives only in the frontend.
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

#: Defaults for an omitted field on creation — the form's own initial values
#: (`ClientCreatePage.vue`). Technical defaults, not new product rules: the
#: contract names only `name`, `companyCode`, `email` and `paymentTermsDays` as
#: mandatory, while the table's three text columns are `NOT NULL`.
_DEFAULT_STATUS = "active"
_DEFAULT_PAYMENT_TERMS_DAYS = 0
_TEXT_DEFAULTS = {"vatCode": "", "address": "", "phone": ""}


class ClientValidationError(ValidationError):
    """`VALIDATION_ERROR` (422) that also names the offending body field."""

    def __init__(self, message: str, field: str | None = None) -> None:
        super().__init__(message)
        self.field = field


class ClientFieldTakenError(ConflictError):
    """409 for a repeat of a unique field — carries the code and the field name."""

    def __init__(self, *, code: str, field: str, message: str) -> None:
        super().__init__(message, code=code)
        self.field = field


def _reject_unknown_keys(input_data: ClientCreateRequest | ClientPatchRequest) -> None:
    """The body accepts exactly the ten white-listed keys; anything else is refused."""
    extra = sorted((input_data.model_extra or {}).keys())
    if extra:
        raise ClientValidationError(
            "Unknown field(s): "
            + ", ".join(extra)
            + ". The body accepts exactly: "
            + ", ".join(sorted(CLIENT_BODY_FIELDS))
        )


def _require_text(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ClientValidationError(f"{field} is required", field=field)
    return value.strip()


def _validate_email(value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ClientValidationError("email is required", field="email")
    text = value.strip()
    if not EMAIL_PATTERN.match(text):
        raise ClientValidationError("email must be a valid address", field="email")
    return text


def _validate_payment_terms_days(value: Any) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ClientValidationError(
            "paymentTermsDays must be a non-negative whole number of days",
            field="paymentTermsDays",
        )
    return value


def _validate_country(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str) or not is_country_code(value):
        raise ClientValidationError(
            "country must be a two-letter ISO 3166-1 alpha-2 code or null",
            field="country",
        )
    return value


def _validate_status(value: Any) -> str:
    if value not in STATUS_VALUES:
        raise ClientValidationError(
            "status must be one of: " + ", ".join(sorted(STATUS_VALUES)), field="status"
        )
    return value


def _text_or_default(value: Any, default: str) -> str:
    return value if isinstance(value, str) else default


def _to_detail(
    client: Client, interactions: list[ClientInteraction]
) -> ClientDetailResponse:
    """Map the ORM row to the card's own response — the one shape for the entity."""
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


async def _ensure_unique(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    company_code: str,
    vat_code: str,
    email: str,
    exclude_id: UUID | None = None,
) -> None:
    """Refuse a repeat of `companyCode`/`vatCode`/`email` inside one tenant.

    Uniqueness is a pair with the tenant — exactly the three constraints the model
    already declares (`uq_clients_tenant_company_code` / `_vat_code` / `_email`),
    and nothing else is checked. `exclude_id` lets a `PATCH` keep its own value.
    """
    if company_code and await find_client_by_company_code(
        db, tenant_id, company_code, exclude_id
    ):
        raise ClientFieldTakenError(
            code="CLIENT_COMPANY_CODE_TAKEN",
            field="companyCode",
            message="companyCode is already taken",
        )
    if vat_code and await find_client_by_vat_code(db, tenant_id, vat_code, exclude_id):
        raise ClientFieldTakenError(
            code="CLIENT_VAT_CODE_TAKEN",
            field="vatCode",
            message="vatCode is already taken",
        )
    if email and await find_client_by_email(db, tenant_id, email, exclude_id):
        raise ClientFieldTakenError(
            code="CLIENT_EMAIL_TAKEN",
            field="email",
            message="email is already taken",
        )


async def create_client(
    db: AsyncSession, tenant_id: UUID, input_data: ClientCreateRequest
) -> ClientDetailResponse:
    """Execute the create-client use case."""
    _reject_unknown_keys(input_data)

    name = _require_text(input_data.name, "name")
    company_code = _require_text(input_data.companyCode, "companyCode")
    email = _validate_email(input_data.email)
    payment_terms_days = _validate_payment_terms_days(
        _DEFAULT_PAYMENT_TERMS_DAYS
        if input_data.paymentTermsDays is None
        else input_data.paymentTermsDays
    )
    country = _validate_country(input_data.country)
    status = _validate_status(
        _DEFAULT_STATUS if input_data.status is None else input_data.status
    )
    vat_code = _text_or_default(input_data.vatCode, _TEXT_DEFAULTS["vatCode"])
    address = _text_or_default(input_data.address, _TEXT_DEFAULTS["address"])
    phone = _text_or_default(input_data.phone, _TEXT_DEFAULTS["phone"])

    await _ensure_unique(
        db, tenant_id, company_code=company_code, vat_code=vat_code, email=email
    )

    client = await create_client_record(
        db,
        tenant_id,
        {
            "name": name,
            "company_code": company_code,
            "vat_code": vat_code,
            "address": address,
            "country": country,
            "phone": phone,
            "email": email,
            "status": status,
            "payment_terms_days": payment_terms_days,
            "notes": input_data.notes,
            # The server stamps the date; the column is a `Date`, so no time part.
            "created_at": date.today(),
        },
    )
    return _to_detail(client, [])


async def patch_client(
    db: AsyncSession,
    tenant_id: UUID,
    client_id: UUID,
    input_data: ClientPatchRequest,
) -> ClientDetailResponse:
    """Execute the merge-patch use case.

    Only the keys present in the body change; an absent key keeps its stored
    value. The same checks and the same three uniqueness codes apply as on
    creation — through `PATCH` they are otherwise bypassed, which the contract
    names as a finding rather than a permission.
    """
    _reject_unknown_keys(input_data)

    client = await get_client_record(db, client_id, tenant_id)
    if client is None:
        raise ClientNotFoundError(client_id)

    provided = input_data.model_fields_set

    changes: dict[str, Any] = {}
    if "name" in provided:
        changes["name"] = _require_text(input_data.name, "name")
    if "companyCode" in provided:
        changes["company_code"] = _require_text(input_data.companyCode, "companyCode")
    if "email" in provided:
        changes["email"] = _validate_email(input_data.email)
    if "vatCode" in provided:
        changes["vat_code"] = _text_or_default(input_data.vatCode, _TEXT_DEFAULTS["vatCode"])
    if "address" in provided:
        changes["address"] = _text_or_default(input_data.address, _TEXT_DEFAULTS["address"])
    if "phone" in provided:
        changes["phone"] = _text_or_default(input_data.phone, _TEXT_DEFAULTS["phone"])
    if "paymentTermsDays" in provided:
        changes["payment_terms_days"] = _validate_payment_terms_days(
            input_data.paymentTermsDays
        )
    if "country" in provided:
        changes["country"] = _validate_country(input_data.country)
    if "status" in provided:
        changes["status"] = _validate_status(input_data.status)
    if "notes" in provided:
        changes["notes"] = input_data.notes

    await _ensure_unique(
        db,
        tenant_id,
        company_code=changes.get("company_code", client.company_code),
        vat_code=changes.get("vat_code", client.vat_code),
        email=changes.get("email", client.email),
        exclude_id=client_id,
    )

    if changes:
        client = await update_client_record(db, client, changes)

    interactions = await list_interactions(db, client_id, tenant_id)
    return _to_detail(client, interactions)
