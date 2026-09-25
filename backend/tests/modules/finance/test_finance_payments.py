"""Behaviour of `GET /api/finance/payments` and `GET /api/finance/payments/{id}`.

No database anywhere in this file, by design of the task: `FakeSession` never opens a
connection or an engine. Instead it walks the *real* `sqlalchemy.select(...)` statement
that `repository.py` builds — the same `WHERE`/`ORDER BY`/`LIMIT` clauses a real engine
would receive — and evaluates it against a fixed table of transient `FinancePayment` /
`PaymentDocument` ORM objects (built the same way `make_row()` builds a `MailSettings`
row in `tests/modules/settings/test_mail_settings.py`: instantiated directly, never
flushed). A mutation that drops the `tenant_id` filter, widens the page-size cap, or
breaks the `created_at DESC, id ASC` tie-break changes what the *real* statement says,
and this fake evaluates that real statement — so the tests below redden on those
mutations rather than on a hand-picked expectation.

    cd backend && python3 -m pytest tests/modules/finance/test_finance_payments.py -q
"""

from __future__ import annotations

import operator as py_operator
import os
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from sqlalchemy.sql import operators as sa_operators

with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/finance-payments-unused.sqlite"},
):
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    from app.core.database import get_db
    from app.core.exceptions import AppError, NotFoundError
    from app.main import app_error_handler
    from app.modules.auth.internal_api.interface import CurrentUser, get_current_user
    from app.modules.finance.features.payments.action import router as payments_router
    from app.modules.finance.features.payments.domain import (
        MAX_PAGE_SIZE,
        PaymentNotFoundError,
        get_payment_detail,
        list_payments,
    )
    from app.modules.finance.features.payments.repository import (
        count_payments,
        get_payment_by_id,
    )
    from app.modules.finance.features.payments.repository import (
        list_payments as list_payments_repo,
    )
    from app.modules.finance.shared.models import FinancePayment, PaymentDocument


# ── ORM-like fixtures — transient model instances, never flushed ───────────────────


def make_document(**overrides) -> PaymentDocument:
    values = {
        "id": uuid.uuid4(),
        "tenant_id": uuid.uuid4(),
        "payment_id": uuid.uuid4(),
        "file_id": uuid.uuid4(),
        "name": "invoice.pdf",
        "size": 1024,
        "mime": "application/pdf",
        "url": "https://files.example/uploads/invoice.pdf",
        "uploaded_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
    }
    values.update(overrides)
    return PaymentDocument(**values)


def make_payment(**overrides) -> FinancePayment:
    values = {
        "id": uuid.uuid4(),
        "tenant_id": uuid.uuid4(),
        "payment_number": "PO-1001",
        "direction": "outgoing",
        "status": "pending",
        "amount": 199.90,
        "currency": "EUR",
        "counterparty_id": None,
        "counterparty_name": "Acme Metals",
        "counterparty_vat_code": None,
        "order_id": None,
        "order_number": None,
        "supplier_invoice_ref": "INV-2026-01",
        "description": None,
        "due_date": datetime(2026, 2, 1, tzinfo=timezone.utc),
        "paid_at": None,
        "notes": None,
        "documents": [],
        "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "updated_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
    }
    values.update(overrides)
    return FinancePayment(**values)


# ── Fake session — evaluates the real statement, touches no database ───────────────


class _FakeResult:
    def __init__(self, *, scalar_value=None, rows=None):
        self._scalar_value = scalar_value
        self._rows = rows if rows is not None else []

    def scalar(self):
        return self._scalar_value

    def scalar_one_or_none(self):
        if len(self._rows) > 1:
            raise AssertionError("fake table returned more than one row for a by-id query")
        return self._rows[0] if self._rows else None

    def scalars(self):
        return self

    def all(self):
        return self._rows


def _eval_clause(clause, row) -> bool:
    name = type(clause).__name__
    if name == "Grouping":
        return _eval_clause(clause.element, row)
    if name == "BooleanClauseList":
        parts = [_eval_clause(c, row) for c in clause.clauses]
        return any(parts) if clause.operator is py_operator.or_ else all(parts)
    if name == "BinaryExpression":
        value = getattr(row, clause.left.name)
        if clause.operator is py_operator.eq:
            return value == clause.right.value
        if clause.operator is sa_operators.ilike_op:
            if value is None:
                return False
            needle = str(clause.right.value).strip("%").lower()
            return needle in str(value).lower()
        raise AssertionError(f"fake session cannot evaluate operator {clause.operator!r}")
    raise AssertionError(f"fake session cannot evaluate clause type {name!r}")


def _effective_whereclause(stmt):
    if stmt.whereclause is not None:
        return stmt.whereclause
    froms = stmt.get_final_froms()
    if froms and hasattr(froms[0], "element"):
        return froms[0].element.whereclause
    return None


def _is_count_statement(stmt) -> bool:
    columns = list(stmt.selected_columns)
    return len(columns) == 1 and str(columns[0]) == "count(*)"


def _order_spec(stmt):
    spec = []
    for unary in getattr(stmt, "_order_by_clause", []).clauses if hasattr(stmt, "_order_by_clause") else []:
        spec.append((unary.element.name, unary.modifier is sa_operators.desc_op))
    return spec


class FakeSession:
    """A fixed table of ORM-like rows; `execute()` interprets the real statement."""

    def __init__(self, rows):
        self.rows = list(rows)
        self.statements = []

    async def execute(self, stmt):
        self.statements.append(stmt)
        where = _effective_whereclause(stmt)
        matching = [row for row in self.rows if where is None or _eval_clause(where, row)]

        if _is_count_statement(stmt):
            return _FakeResult(scalar_value=len(matching))

        for name, reverse in reversed(_order_spec(stmt)):
            matching.sort(key=lambda r, name=name: getattr(r, name), reverse=reverse)

        if stmt._limit is not None or stmt._offset:
            offset = stmt._offset or 0
            limit = stmt._limit
            matching = matching[offset : offset + limit] if limit is not None else matching[offset:]

        return _FakeResult(rows=matching)


TENANT_A = uuid.uuid4()
TENANT_B = uuid.uuid4()


# ── Repository — tenant scoping, search, ordering, pagination ──────────────────────


class ListPaymentsTenancyTests(unittest.IsolatedAsyncioTestCase):
    async def test_a_foreign_tenants_payment_is_absent_from_the_list(self):
        mine = make_payment(tenant_id=TENANT_A, payment_number="A-1")
        foreign = make_payment(tenant_id=TENANT_B, payment_number="B-1")
        session = FakeSession([mine, foreign])

        items = await list_payments_repo(session, TENANT_A)

        self.assertEqual([mine.id], [item.id for item in items])

    async def test_count_is_scoped_to_the_caller_tenant_too(self):
        session = FakeSession(
            [make_payment(tenant_id=TENANT_A), make_payment(tenant_id=TENANT_B)]
        )

        total = await count_payments(session, TENANT_A)

        self.assertEqual(1, total)


class GetPaymentByIdTenancyTests(unittest.IsolatedAsyncioTestCase):
    """Mutation target: drop `FinancePayment.tenant_id == tenant_id` from the query."""

    async def test_a_foreign_tenants_payment_reads_as_absent(self):
        foreign = make_payment(tenant_id=TENANT_B)
        session = FakeSession([foreign])

        result = await get_payment_by_id(session, foreign.id, TENANT_A)

        self.assertIsNone(result)

    async def test_the_callers_own_payment_is_found(self):
        mine = make_payment(tenant_id=TENANT_A)
        session = FakeSession([mine])

        result = await get_payment_by_id(session, mine.id, TENANT_A)

        self.assertEqual(mine.id, result.id)

    async def test_an_unknown_id_reads_as_absent(self):
        session = FakeSession([make_payment(tenant_id=TENANT_A)])

        result = await get_payment_by_id(session, uuid.uuid4(), TENANT_A)

        self.assertIsNone(result)


class SearchAcrossThreeFieldsTests(unittest.IsolatedAsyncioTestCase):
    async def test_matches_by_payment_number_case_insensitively(self):
        target = make_payment(tenant_id=TENANT_A, payment_number="PO-2026-777")
        other = make_payment(tenant_id=TENANT_A, payment_number="PO-2026-001")
        session = FakeSession([target, other])

        items = await list_payments_repo(session, TENANT_A, search="po-2026-777")

        self.assertEqual([target.id], [item.id for item in items])

    async def test_matches_by_counterparty_name_case_insensitively(self):
        target = make_payment(tenant_id=TENANT_A, counterparty_name="Baltic Steel UAB")
        other = make_payment(tenant_id=TENANT_A, counterparty_name="Nordic Metals")
        session = FakeSession([target, other])

        items = await list_payments_repo(session, TENANT_A, search="BALTIC STEEL")

        self.assertEqual([target.id], [item.id for item in items])

    async def test_matches_by_supplier_invoice_ref_case_insensitively(self):
        target = make_payment(tenant_id=TENANT_A, supplier_invoice_ref="SUP-INV-42")
        other = make_payment(tenant_id=TENANT_A, supplier_invoice_ref="SUP-INV-99")
        session = FakeSession([target, other])

        items = await list_payments_repo(session, TENANT_A, search="sup-inv-42")

        self.assertEqual([target.id], [item.id for item in items])

    async def test_a_blank_supplier_invoice_ref_does_not_crash_the_search(self):
        blank_ref = make_payment(
            tenant_id=TENANT_A, payment_number="PO-999", supplier_invoice_ref=None
        )
        session = FakeSession([blank_ref])

        items = await list_payments_repo(session, TENANT_A, search="po-999")

        self.assertEqual([blank_ref.id], [item.id for item in items])

    async def test_a_payment_with_no_matching_field_is_excluded(self):
        session = FakeSession(
            [make_payment(tenant_id=TENANT_A, payment_number="PO-1", counterparty_name="X",
                          supplier_invoice_ref="Y")]
        )

        items = await list_payments_repo(session, TENANT_A, search="does-not-match-anything")

        self.assertEqual([], items)


class StatusFilterTests(unittest.IsolatedAsyncioTestCase):
    async def test_a_given_status_narrows_the_list(self):
        pending = make_payment(tenant_id=TENANT_A, status="pending")
        overdue = make_payment(tenant_id=TENANT_A, status="overdue")
        session = FakeSession([pending, overdue])

        items = await list_payments_repo(session, TENANT_A, status="overdue")

        self.assertEqual([overdue.id], [item.id for item in items])

    async def test_no_status_returns_every_status(self):
        pending = make_payment(tenant_id=TENANT_A, status="pending")
        overdue = make_payment(tenant_id=TENANT_A, status="overdue")
        session = FakeSession([pending, overdue])

        items = await list_payments_repo(session, TENANT_A, status=None)

        self.assertEqual({pending.id, overdue.id}, {item.id for item in items})


class OrderingTests(unittest.IsolatedAsyncioTestCase):
    """Mutation target: drop the `FinancePayment.id.asc()` tie-break."""

    async def test_newest_created_at_comes_first(self):
        older = make_payment(tenant_id=TENANT_A, created_at=datetime(2026, 1, 1, tzinfo=timezone.utc))
        newer = make_payment(tenant_id=TENANT_A, created_at=datetime(2026, 6, 1, tzinfo=timezone.utc))
        session = FakeSession([older, newer])

        items = await list_payments_repo(session, TENANT_A)

        self.assertEqual([newer.id, older.id], [item.id for item in items])

    async def test_equal_created_at_breaks_the_tie_by_id_ascending_and_stays_stable(self):
        same_moment = datetime(2026, 3, 1, tzinfo=timezone.utc)
        low_id, high_id = sorted([uuid.uuid4(), uuid.uuid4()])
        first = make_payment(tenant_id=TENANT_A, id=low_id, created_at=same_moment)
        second = make_payment(tenant_id=TENANT_A, id=high_id, created_at=same_moment)
        session = FakeSession([second, first])

        run_one = await list_payments_repo(session, TENANT_A)
        run_two = await list_payments_repo(session, TENANT_A)

        self.assertEqual([low_id, high_id], [item.id for item in run_one])
        self.assertEqual([item.id for item in run_one], [item.id for item in run_two])


class PaginationTests(unittest.IsolatedAsyncioTestCase):
    async def test_page_two_skips_the_first_page(self):
        payments = [
            make_payment(
                tenant_id=TENANT_A,
                created_at=datetime(2026, 1, 1, tzinfo=timezone.utc) - timedelta(days=i),
            )
            for i in range(5)
        ]
        session = FakeSession(payments)

        page_one = await list_payments_repo(session, TENANT_A, page=1, page_size=2)
        page_two = await list_payments_repo(session, TENANT_A, page=2, page_size=2)

        self.assertEqual(2, len(page_one))
        self.assertEqual(2, len(page_two))
        self.assertFalse({p.id for p in page_one} & {p.id for p in page_two})


# ── Domain — defaults, cap, derived documentCount, refusal code, mapping ───────────


class ListPaymentsDomainTests(unittest.IsolatedAsyncioTestCase):
    async def test_defaults_are_page_one_and_page_size_twenty_five(self):
        session = FakeSession([make_payment(tenant_id=TENANT_A)])

        result = await list_payments(
            session, TENANT_A, search=None, status=None, page=1, page_size=25
        )

        self.assertEqual(1, result.page)
        self.assertEqual(25, result.pageSize)

    async def test_page_size_is_capped_at_one_hundred(self):
        """Mutation target: remove `min(page_size, MAX_PAGE_SIZE)` in `domain.list_payments`.

        150 tenant rows, `page_size=99999` asked for — without the cap this test
        reddens both on the returned `pageSize` and on the number of items handed back.
        """
        payments = [make_payment(tenant_id=TENANT_A) for _ in range(150)]
        session = FakeSession(payments)

        result = await list_payments(
            session, TENANT_A, search=None, status=None, page=1, page_size=99999
        )

        self.assertEqual(MAX_PAGE_SIZE, result.pageSize)
        self.assertLessEqual(len(result.items), MAX_PAGE_SIZE)

    async def test_empty_search_and_status_all_mean_no_filter(self):
        pending = make_payment(tenant_id=TENANT_A, status="pending", payment_number="PO-1")
        overdue = make_payment(tenant_id=TENANT_A, status="overdue", payment_number="PO-2")
        session = FakeSession([pending, overdue])

        result = await list_payments(
            session, TENANT_A, search="", status="all", page=1, page_size=25
        )

        self.assertEqual({pending.id, overdue.id}, {item.id for item in result.items})

    async def test_document_count_is_derived_not_the_stored_column(self):
        """Считается по загруженной связи `documents`, и хранить его негде (§17, П68).

        Колонки `document_count` на `FinancePayment` больше нет — её сняла ревизия
        `e5b2f47c9a10`. Пока она была, ответ и колонка расходились молча: ответ уже
        тогда считал по связи, а колонку не писал никто.
        """
        self.assertNotIn("document_count", FinancePayment.__table__.c)
        payment = make_payment(
            tenant_id=TENANT_A,
            documents=[make_document(), make_document()],
        )
        session = FakeSession([payment])

        result = await list_payments(
            session, TENANT_A, search=None, status=None, page=1, page_size=25
        )

        self.assertEqual(2, result.items[0].documentCount)

    async def test_list_item_carries_exactly_the_twelve_contract_fields(self):
        session = FakeSession([make_payment(tenant_id=TENANT_A)])

        result = await list_payments(
            session, TENANT_A, search=None, status=None, page=1, page_size=25
        )

        self.assertEqual(
            {
                "id", "paymentNumber", "direction", "status", "amount", "currency",
                "counterpartyName", "orderNumber", "supplierInvoiceRef", "dueDate",
                "paidAt", "documentCount",
            },
            set(result.items[0].model_dump().keys()),
        )

    async def test_amount_is_a_number_not_a_string(self):
        session = FakeSession([make_payment(tenant_id=TENANT_A, amount=42.5)])

        result = await list_payments(
            session, TENANT_A, search=None, status=None, page=1, page_size=25
        )

        payload = result.model_dump(mode="json")
        self.assertIsInstance(payload["items"][0]["amount"], float)
        self.assertEqual(42.5, payload["items"][0]["amount"])


class GetPaymentDetailDomainTests(unittest.IsolatedAsyncioTestCase):
    async def test_an_unknown_id_raises_payment_not_found_with_the_domain_code(self):
        session = FakeSession([])

        with self.assertRaises(PaymentNotFoundError) as ctx:
            await get_payment_detail(session, TENANT_A, uuid.uuid4())

        self.assertEqual("PAYMENT_NOT_FOUND", ctx.exception.code)
        self.assertIsInstance(ctx.exception, NotFoundError)
        self.assertIsInstance(ctx.exception, AppError)

    async def test_a_foreign_tenants_payment_also_raises_payment_not_found(self):
        foreign = make_payment(tenant_id=TENANT_B)
        session = FakeSession([foreign])

        with self.assertRaises(PaymentNotFoundError):
            await get_payment_detail(session, TENANT_A, foreign.id)

    async def test_detail_carries_the_nested_documents(self):
        doc = make_document(name="contract.pdf")
        payment = make_payment(tenant_id=TENANT_A, documents=[doc])
        session = FakeSession([payment])

        result = await get_payment_detail(session, TENANT_A, payment.id)

        self.assertEqual(1, len(result.documents))
        self.assertEqual("contract.pdf", result.documents[0].name)
        self.assertEqual(doc.file_id, result.documents[0].fileId)

    async def test_detail_carries_exactly_the_nineteen_contract_fields(self):
        payment = make_payment(tenant_id=TENANT_A)
        session = FakeSession([payment])

        result = await get_payment_detail(session, TENANT_A, payment.id)

        self.assertEqual(
            {
                "id", "paymentNumber", "direction", "status", "amount", "currency",
                "counterpartyId", "counterpartyName", "counterpartyVatCode", "orderId",
                "orderNumber", "supplierInvoiceRef", "description", "dueDate", "paidAt",
                "documents", "notes", "createdAt", "updatedAt",
            },
            set(result.model_dump().keys()),
        )


# ── Action — auth, tenant scoping over HTTP, envelope, refusal status ──────────────


def _db_override(session):
    async def _get_db():
        yield session

    return _get_db


def _user_override(tenant_id):
    async def _get_current_user():
        return CurrentUser(user_id=uuid.uuid4(), tenant_id=tenant_id, user=None)

    return _get_current_user


class PaymentsHttpTests(unittest.IsolatedAsyncioTestCase):
    """Real routing and dependency wiring, a fake session standing in for the DB."""

    def _build_app(self, session, *, tenant_id=TENANT_A, authenticated=True):
        app = FastAPI()
        app.add_exception_handler(AppError, app_error_handler)
        app.include_router(payments_router)
        app.dependency_overrides[get_db] = _db_override(session)
        if authenticated:
            app.dependency_overrides[get_current_user] = _user_override(tenant_id)
        return app

    async def _client(self, app):
        client = AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://test",
        )
        self.addAsyncCleanup(client.aclose)
        return client

    async def test_missing_authorization_is_refused(self):
        app = self._build_app(FakeSession([]), authenticated=False)
        client = await self._client(app)

        response = await client.get("/api/finance/payments")

        self.assertEqual(401, response.status_code, response.text)

    async def test_list_envelope_carries_pagination_keys(self):
        session = FakeSession([make_payment(tenant_id=TENANT_A)])
        app = self._build_app(session)
        client = await self._client(app)

        response = await client.get("/api/finance/payments")

        self.assertEqual(200, response.status_code, response.text)
        payload = response.json()["data"]
        self.assertEqual(
            {"items", "total", "page", "pageSize", "totalPages"}, set(payload.keys())
        )
        self.assertEqual(1, payload["total"])

    async def test_a_foreign_tenants_payment_is_invisible_over_http(self):
        foreign = make_payment(tenant_id=TENANT_B)
        session = FakeSession([foreign])
        app = self._build_app(session, tenant_id=TENANT_A)
        client = await self._client(app)

        list_response = await client.get("/api/finance/payments")
        card_response = await client.get(f"/api/finance/payments/{foreign.id}")

        self.assertEqual([], list_response.json()["data"]["items"])
        self.assertEqual(404, card_response.status_code, card_response.text)
        self.assertEqual("PAYMENT_NOT_FOUND", card_response.json()["detail"]["code"])

    async def test_card_not_found_is_404_with_the_domain_code(self):
        app = self._build_app(FakeSession([]))
        client = await self._client(app)

        response = await client.get(f"/api/finance/payments/{uuid.uuid4()}")

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("PAYMENT_NOT_FOUND", response.json()["detail"]["code"])

    async def test_card_returns_the_full_payload_with_documents(self):
        doc = make_document()
        payment = make_payment(tenant_id=TENANT_A, documents=[doc])
        app = self._build_app(FakeSession([payment]))
        client = await self._client(app)

        response = await client.get(f"/api/finance/payments/{payment.id}")

        self.assertEqual(200, response.status_code, response.text)
        data = response.json()["data"]
        self.assertEqual(str(payment.id), data["id"])
        self.assertEqual(1, len(data["documents"]))
        self.assertEqual(str(doc.id), data["documents"][0]["id"])

    async def test_oversized_page_size_is_rejected_at_the_route(self):
        app = self._build_app(FakeSession([]))
        client = await self._client(app)

        response = await client.get("/api/finance/payments", params={"pageSize": 1000})

        self.assertEqual(422, response.status_code, response.text)


if __name__ == "__main__":
    unittest.main()
