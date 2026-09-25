"""Repository for the finance.payments read slice (Infrastructure / Data Access layer)."""

from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.finance.shared.models import FinancePayment


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
