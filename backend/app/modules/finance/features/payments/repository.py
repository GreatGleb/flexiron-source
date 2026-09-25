"""Repository for the finance.payments read+patch slice (Infrastructure / Data Access layer)."""

import uuid as uuid_lib
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.uploads.service import get_file_by_id
from app.modules.finance.shared.models import FinancePayment, PaymentDocument

#: Where `app/main.py` mounts the upload directory — same convention as
#: `app/modules/settings/features/warehouse_map/domain.py`'s own derived link.
STATIC_UPLOADS_PREFIX = "/static/uploads"


def _search_predicate(search: str):
    """Case-insensitive substring match across the three searchable fields.

    `ilike` against a NULL `supplier_invoice_ref` evaluates to NULL/false in SQL —
    it never raises, so an empty reference simply does not match, no guard needed.
    """
    pattern = f"%{search}%"
    return or_(
        FinancePayment.payment_number.ilike(pattern),
        FinancePayment.counterparty_name.ilike(pattern),
        FinancePayment.supplier_invoice_ref.ilike(pattern),
    )


async def _filtered_query(tenant_id: UUID, *, search: str | None, status: str | None):
    """Shared WHERE clause for both the count and the page — one place for the rule."""
    query = (
        select(FinancePayment)
        .where(FinancePayment.tenant_id == tenant_id)
        .options(selectinload(FinancePayment.documents))
    )
    if status:
        query = query.where(FinancePayment.status == status)
    if search:
        query = query.where(_search_predicate(search))
    return query


async def count_payments(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    search: str | None = None,
    status: str | None = None,
) -> int:
    """Total rows matching the filters, tenant-scoped."""
    query = await _filtered_query(tenant_id, search=search, status=status)
    count_stmt = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_stmt)
    return result.scalar() or 0


async def list_payments(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    search: str | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> list[FinancePayment]:
    """One page of outgoing payments, tenant-scoped, newest first then by id."""
    query = await _filtered_query(tenant_id, search=search, status=status)
    query = query.order_by(FinancePayment.created_at.desc(), FinancePayment.id.asc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_payment_by_id(
    db: AsyncSession, payment_id: UUID, tenant_id: UUID
) -> FinancePayment | None:
    """Fetch a payment with its documents, scoped to its tenant."""
    result = await db.execute(
        select(FinancePayment)
        .where(
            FinancePayment.id == payment_id,
            FinancePayment.tenant_id == tenant_id,
        )
        .options(selectinload(FinancePayment.documents))
    )
    return result.scalar_one_or_none()


def _as_uuid(value: str) -> UUID | None:
    """Read a file identifier, or `None` when the text is not one at all."""
    try:
        return UUID(value)
    except (TypeError, ValueError, AttributeError):
        return None


def _derived_link(storage_path: str | None) -> str:
    """Assemble the public link from the upload's own storage path."""
    if not storage_path:
        return ""
    return f"{STATIC_UPLOADS_PREFIX}/{Path(storage_path).name}"


async def _build_document(
    db: AsyncSession, tenant_id: UUID, file_id: str
) -> PaymentDocument:
    """One new `PaymentDocument` row for `file_id`.

    Real metadata when this tenant's own upload registry knows the id;
    otherwise a same-id placeholder — an unknown `fileId` is not a refusal
    (`roo_code/roo-context/api/finance.md`, "PATCH /api/finance/payments/:id").
    """
    parsed = _as_uuid(file_id)
    uploaded = (
        await get_file_by_id(db, tenant_id, parsed) if parsed is not None else None
    )
    if uploaded is not None:
        return PaymentDocument(
            id=uuid_lib.uuid4(),
            tenant_id=tenant_id,
            file_id=uploaded.id,
            name=uploaded.original_name,
            size=uploaded.size,
            mime=uploaded.mime,
            url=_derived_link(uploaded.storage_path),
            uploaded_at=uploaded.uploaded_at,
        )
    return PaymentDocument(
        id=uuid_lib.uuid4(),
        tenant_id=tenant_id,
        file_id=parsed or uuid_lib.uuid4(),
        name=file_id,
        size=0,
        mime="application/octet-stream",
        url="",
        uploaded_at=datetime.now(timezone.utc),
    )


async def sync_payment_documents(
    db: AsyncSession,
    tenant_id: UUID,
    payment: FinancePayment,
    file_ids: list[str],
) -> None:
    """Replace `payment.documents` with rows matching `file_ids`, in that order.

    A `fileId` already attached (matched by its stored `file_id`) is kept as
    the same row; every other `fileId` gets a fresh document built by
    `_build_document`; a document whose `fileId` is absent from `file_ids`
    is dropped by the reassignment below, which the model's own
    `cascade="all, delete-orphan"` turns into a delete on flush — replace
    semantics, decided by the server (§15 conventions).
    """
    kept_by_file_id = {str(doc.file_id): doc for doc in payment.documents}
    documents: list[PaymentDocument] = []
    for file_id in file_ids:
        existing = kept_by_file_id.get(file_id)
        documents.append(
            existing if existing is not None else await _build_document(db, tenant_id, file_id)
        )
    payment.documents = documents


async def save_payment(db: AsyncSession, payment: FinancePayment) -> FinancePayment:
    """Persist the pending attribute/relationship changes on `payment`."""
    await db.commit()
    await db.refresh(payment)
    return payment
