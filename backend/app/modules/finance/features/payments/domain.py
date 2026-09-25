"""Domain use cases for the finance.payments slice — list, get, and patch.

Contains pure business logic — no FastAPI, no DB session management.
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError, NotFoundError
from app.core.schemas import PaginatedResponse
from app.modules.finance.shared.models import FinancePayment, PaymentDocument

from .repository import count_payments, get_payment_by_id, save_payment, sync_payment_documents
from .repository import list_payments as list_payments_repo
from .schemas import (
    PaymentDetailResponse,
    PaymentDocumentResponse,
    PaymentListItem,
    PaymentPatchInput,
)

MAX_PAGE_SIZE = 100


class PaymentNotFoundError(NotFoundError):
    """Unknown or foreign `payment_id` — the domain's own refusal code.

    `NotFoundError.__init__` hardcodes `code="NOT_FOUND"`, so this bypasses it and
    calls `AppError.__init__` directly with the domain code the contract names
    (`roo_code/roo-context/api/finance.md`, "Каталог кодов ошибок домена").
    `isinstance(exc, NotFoundError)` still holds, so `app.main`'s `AppError` handler
    answers 404 without any change to `app/core/exceptions.py`.
    """

    def __init__(self, payment_id: UUID) -> None:
        AppError.__init__(
            self, f"Payment not found: {payment_id}", code="PAYMENT_NOT_FOUND"
        )


def _normalize_status(status: str | None) -> str | None:
    """Empty string and `all` both mean "no filter" (§13 conventions)."""
    if not status or status == "all":
        return None
    return status


def _normalize_search(search: str | None) -> str | None:
    if search is None or not search.strip():
        return None
    return search


def _to_list_item(entity: FinancePayment) -> PaymentListItem:
    return PaymentListItem(
        id=entity.id,
        paymentNumber=entity.payment_number,
        direction=entity.direction,
        status=entity.status,
        amount=float(entity.amount),
        currency=entity.currency,
        counterpartyName=entity.counterparty_name,
        orderNumber=entity.order_number,
        supplierInvoiceRef=entity.supplier_invoice_ref,
        dueDate=entity.due_date,
        paidAt=entity.paid_at,
        documentCount=len(entity.documents),
    )


def _to_document(document: PaymentDocument) -> PaymentDocumentResponse:
    return PaymentDocumentResponse(
        id=document.id,
        name=document.name,
        fileId=document.file_id,
        url=document.url,
        size=document.size,
        mime=document.mime,
        uploadedAt=document.uploaded_at,
    )


def _to_detail(entity: FinancePayment) -> PaymentDetailResponse:
    return PaymentDetailResponse(
        id=entity.id,
        paymentNumber=entity.payment_number,
        direction=entity.direction,
        status=entity.status,
        amount=float(entity.amount),
        currency=entity.currency,
        counterpartyId=entity.counterparty_id,
        counterpartyName=entity.counterparty_name,
        counterpartyVatCode=entity.counterparty_vat_code,
        orderId=entity.order_id,
        orderNumber=entity.order_number,
        supplierInvoiceRef=entity.supplier_invoice_ref,
        description=entity.description,
        dueDate=entity.due_date,
        paidAt=entity.paid_at,
        documents=[_to_document(doc) for doc in entity.documents],
        notes=entity.notes,
        createdAt=entity.created_at,
        updatedAt=entity.updated_at,
    )


async def list_payments(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    search: str | None,
    status: str | None,
    page: int,
    page_size: int,
) -> PaginatedResponse[PaymentListItem]:
    """Execute the list outgoing payments use case."""
    search = _normalize_search(search)
    status = _normalize_status(status)
    page = max(page, 1)
    page_size = min(max(page_size, 1), MAX_PAGE_SIZE)

    total = await count_payments(db, tenant_id, search=search, status=status)
    entities = await list_payments_repo(
        db, tenant_id, search=search, status=status, page=page, page_size=page_size
    )

    return PaginatedResponse[PaymentListItem](
        items=[_to_list_item(entity) for entity in entities],
        total=total,
        page=page,
        pageSize=page_size,
        totalPages=max(1, -(-total // page_size)),
    )


async def get_payment_detail(
    db: AsyncSession, tenant_id: UUID, payment_id: UUID
) -> PaymentDetailResponse:
    """Execute the get payment card use case."""
    entity = await get_payment_by_id(db, payment_id, tenant_id)
    if entity is None:
        raise PaymentNotFoundError(payment_id)
    return _to_detail(entity)


async def patch_payment(
    db: AsyncSession,
    tenant_id: UUID,
    payment_id: UUID,
    input_data: PaymentPatchInput,
) -> PaymentDetailResponse:
    """Execute the patch payment card use case (Save button, §3/§15 conventions).

    Only `notes` and `fileIds` are ever read off `input_data` — the whitelist
    is `PaymentPatchInput` itself (it names no other field), so `status`,
    `amount` and `paymentNumber` cannot reach this function no matter what the
    client's own wider type sends. `model_fields_set` tells a present key
    (even `null`/`[]`) apart from an absent one: a key the client did not send
    leaves that part of the record untouched; `fileIds` present — including
    empty — replaces the full document set (§15 clean-slate, replace
    semantics decided by the server, not the client).
    """
    entity = await get_payment_by_id(db, payment_id, tenant_id)
    if entity is None:
        raise PaymentNotFoundError(payment_id)

    fields_set = input_data.model_fields_set
    if "notes" in fields_set:
        entity.notes = input_data.notes
    if "fileIds" in fields_set:
        await sync_payment_documents(db, tenant_id, entity, input_data.fileIds or [])

    entity.updated_at = datetime.now(timezone.utc)
    entity = await save_payment(db, entity)
    return _to_detail(entity)
