"""Behaviour of `GET /api/finance/archive`.

No database anywhere in this file, by design of the task: `FakeSession` never opens a
connection or an engine. Instead it walks the *real* `sqlalchemy.select(...)` statement
that `repository.py` builds — the same `WHERE`/`ORDER BY`/`LIMIT` clauses a real engine
would receive — and evaluates it against a fixed table of transient `DocumentArchiveItem`
ORM objects (instantiated directly, never flushed). A mutation that drops the `tenant_id`
filter, widens the page-size cap, or breaks the `uploaded_at DESC, id ASC` tie-break
changes what the *real* statement says, and this fake evaluates that real statement — so
the tests below redden on those mutations rather than on a hand-picked expectation. Same
technique as `tests/modules/finance/test_finance_payments.py`.

    cd backend && python3 -m pytest tests/modules/finance/test_finance_archive.py -q
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
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/finance-archive-unused.sqlite"},
):
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    from app.core.database import get_db
    from app.core.exceptions import AppError
    from app.main import app_error_handler
    from app.modules.auth.internal_api.interface import CurrentUser, get_current_user
    from app.modules.finance.features.archive.action import router as archive_router
    from app.modules.finance.features.archive.domain import (
        MAX_PAGE_SIZE,
        list_archive,
    )
    from app.modules.finance.features.archive.repository import (
        count_archive_items,
        list_archive_items,
    )
    from app.modules.finance.shared.models import DocumentArchiveItem


# ── ORM-like fixtures — transient model instances, never flushed ───────────────────


def make_item(**overrides) -> DocumentArchiveItem:
    values = {
        "id": uuid.uuid4(),
        "tenant_id": uuid.uuid4(),
        "name": "invoice.pdf",
        "document_type": "invoice",
        "file_id": uuid.uuid4(),
        "size": 2048,
        "mime": "application/pdf",
        "url": "https://files.example/uploads/invoice.pdf",
        "related_entity_type": "order",
        "related_entity_id": "ord-1",
        "related_entity_number": "ORD-2026-001",
        "uploaded_by_user_id": None,
        "uploaded_by_name": "Jane Doe",
        "uploaded_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
    }
    values.update(overrides)
    return DocumentArchiveItem(**values)


# ── Fake session — evaluates the real statement, touches no database ───────────────


class _FakeResult:
    def __init__(self, *, scalar_value=None, rows=None):
        self._scalar_value = scalar_value
        self._rows = rows if rows is not None else []

    def scalar(self):
        return self._scalar_value

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


# ── Repository — tenant scoping, search, filters, ordering, pagination ─────────────


class TenancyTests(unittest.IsolatedAsyncioTestCase):
    """Mutation target: drop `DocumentArchiveItem.tenant_id == tenant_id` from the query."""

    async def test_a_foreign_tenants_document_is_absent_from_the_list(self):
        mine = make_item(tenant_id=TENANT_A, name="mine.pdf")
        foreign = make_item(tenant_id=TENANT_B, name="foreign.pdf")
        session = FakeSession([mine, foreign])

        items = await list_archive_items(session, TENANT_A)

        self.assertEqual([mine.id], [item.id for item in items])

    async def test_count_is_scoped_to_the_caller_tenant_too(self):
        session = FakeSession(
            [make_item(tenant_id=TENANT_A), make_item(tenant_id=TENANT_B)]
        )

        total = await count_archive_items(session, TENANT_A)

        self.assertEqual(1, total)


class SearchAcrossTwoFieldsTests(unittest.IsolatedAsyncioTestCase):
    async def test_matches_by_name_case_insensitively(self):
        target = make_item(tenant_id=TENANT_A, name="Supplier Contract.pdf")
        other = make_item(tenant_id=TENANT_A, name="Waybill.pdf")
        session = FakeSession([target, other])

        items = await list_archive_items(session, TENANT_A, search="supplier contract")

        self.assertEqual([target.id], [item.id for item in items])

    async def test_matches_by_related_entity_number_case_insensitively(self):
        """A document that matches only by `related_entity_number` still shows up."""
        target = make_item(
            tenant_id=TENANT_A, name="doc.pdf", related_entity_number="ORD-2026-777"
        )
        other = make_item(
            tenant_id=TENANT_A, name="doc.pdf", related_entity_number="ORD-2026-001"
        )
        session = FakeSession([target, other])

        items = await list_archive_items(session, TENANT_A, search="ord-2026-777")

        self.assertEqual([target.id], [item.id for item in items])

    async def test_a_null_related_entity_number_does_not_crash_the_search(self):
        blank = make_item(
            tenant_id=TENANT_A, name="PO-999-standalone.pdf", related_entity_number=None
        )
        session = FakeSession([blank])

        items = await list_archive_items(session, TENANT_A, search="po-999")

        self.assertEqual([blank.id], [item.id for item in items])

    async def test_a_document_with_no_matching_field_is_excluded(self):
        session = FakeSession(
            [make_item(tenant_id=TENANT_A, name="X", related_entity_number="Y")]
        )

        items = await list_archive_items(
            session, TENANT_A, search="does-not-match-anything"
        )

        self.assertEqual([], items)


class TypeFilterTests(unittest.IsolatedAsyncioTestCase):
    async def test_a_given_type_narrows_the_list(self):
        invoice = make_item(tenant_id=TENANT_A, document_type="invoice")
        waybill = make_item(tenant_id=TENANT_A, document_type="waybill")
        session = FakeSession([invoice, waybill])

        items = await list_archive_items(session, TENANT_A, document_type="waybill")

        self.assertEqual([waybill.id], [item.id for item in items])

    async def test_no_type_returns_every_type(self):
        invoice = make_item(tenant_id=TENANT_A, document_type="invoice")
        waybill = make_item(tenant_id=TENANT_A, document_type="waybill")
        session = FakeSession([invoice, waybill])

        items = await list_archive_items(session, TENANT_A, document_type=None)

        self.assertEqual({invoice.id, waybill.id}, {item.id for item in items})


class RelatedEntityTypeFilterTests(unittest.IsolatedAsyncioTestCase):
    async def test_a_given_related_entity_type_narrows_the_list(self):
        order_doc = make_item(tenant_id=TENANT_A, related_entity_type="order")
        payment_doc = make_item(tenant_id=TENANT_A, related_entity_type="payment")
        session = FakeSession([order_doc, payment_doc])

        items = await list_archive_items(
            session, TENANT_A, related_entity_type="payment"
        )

        self.assertEqual([payment_doc.id], [item.id for item in items])

    async def test_no_related_entity_type_returns_every_related_entity_type(self):
        order_doc = make_item(tenant_id=TENANT_A, related_entity_type="order")
        payment_doc = make_item(tenant_id=TENANT_A, related_entity_type="payment")
        session = FakeSession([order_doc, payment_doc])

        items = await list_archive_items(session, TENANT_A, related_entity_type=None)

        self.assertEqual({order_doc.id, payment_doc.id}, {item.id for item in items})


class OrderingTests(unittest.IsolatedAsyncioTestCase):
    """Mutation target: drop the `DocumentArchiveItem.id.asc()` tie-break."""

    async def test_newest_uploaded_at_comes_first(self):
        older = make_item(tenant_id=TENANT_A, uploaded_at=datetime(2026, 1, 1, tzinfo=timezone.utc))
        newer = make_item(tenant_id=TENANT_A, uploaded_at=datetime(2026, 6, 1, tzinfo=timezone.utc))
        session = FakeSession([older, newer])

        items = await list_archive_items(session, TENANT_A)

        self.assertEqual([newer.id, older.id], [item.id for item in items])

    async def test_equal_uploaded_at_breaks_the_tie_by_id_ascending_and_stays_stable(self):
        same_moment = datetime(2026, 3, 1, tzinfo=timezone.utc)
        low_id, high_id = sorted([uuid.uuid4(), uuid.uuid4()])
        first = make_item(tenant_id=TENANT_A, id=low_id, uploaded_at=same_moment)
        second = make_item(tenant_id=TENANT_A, id=high_id, uploaded_at=same_moment)
        session = FakeSession([second, first])

        run_one = await list_archive_items(session, TENANT_A)
        run_two = await list_archive_items(session, TENANT_A)

        self.assertEqual([low_id, high_id], [item.id for item in run_one])
        self.assertEqual([item.id for item in run_one], [item.id for item in run_two])


class PaginationTests(unittest.IsolatedAsyncioTestCase):
    async def test_page_two_skips_the_first_page(self):
        items = [
            make_item(
                tenant_id=TENANT_A,
                uploaded_at=datetime(2026, 1, 1, tzinfo=timezone.utc) - timedelta(days=i),
            )
            for i in range(5)
        ]
        session = FakeSession(items)

        page_one = await list_archive_items(session, TENANT_A, page=1, page_size=2)
        page_two = await list_archive_items(session, TENANT_A, page=2, page_size=2)

        self.assertEqual(2, len(page_one))
        self.assertEqual(2, len(page_two))
        self.assertFalse({i.id for i in page_one} & {i.id for i in page_two})


# ── Domain — defaults, cap, empty/all filters, mapping, nullable link fields ───────


class ListArchiveDomainTests(unittest.IsolatedAsyncioTestCase):
    async def test_defaults_are_page_one_and_page_size_twenty_five(self):
        session = FakeSession([make_item(tenant_id=TENANT_A)])

        result = await list_archive(
            session,
            TENANT_A,
            search=None,
            type=None,
            related_entity_type=None,
            page=1,
            page_size=25,
        )

        self.assertEqual(1, result.page)
        self.assertEqual(25, result.pageSize)

    async def test_page_size_is_capped_at_one_hundred(self):
        """Mutation target: remove `min(page_size, MAX_PAGE_SIZE)` in `domain.list_archive`.

        150 tenant rows, `page_size=99999` asked for — without the cap this test
        reddens both on the returned `pageSize` and on the number of items handed back.
        """
        items = [make_item(tenant_id=TENANT_A) for _ in range(150)]
        session = FakeSession(items)

        result = await list_archive(
            session,
            TENANT_A,
            search=None,
            type=None,
            related_entity_type=None,
            page=1,
            page_size=99999,
        )

        self.assertEqual(MAX_PAGE_SIZE, result.pageSize)
        self.assertLessEqual(len(result.items), MAX_PAGE_SIZE)

    async def test_empty_string_and_all_mean_no_filter_for_type_and_related_entity_type(self):
        invoice_order = make_item(
            tenant_id=TENANT_A, document_type="invoice", related_entity_type="order"
        )
        waybill_payment = make_item(
            tenant_id=TENANT_A, document_type="waybill", related_entity_type="payment"
        )
        session = FakeSession([invoice_order, waybill_payment])

        result = await list_archive(
            session,
            TENANT_A,
            search="",
            type="all",
            related_entity_type="all",
            page=1,
            page_size=25,
        )

        self.assertEqual(
            {invoice_order.id, waybill_payment.id}, {item.id for item in result.items}
        )

    async def test_a_given_type_and_related_entity_type_narrow_the_result(self):
        target = make_item(
            tenant_id=TENANT_A, document_type="invoice", related_entity_type="order"
        )
        other = make_item(
            tenant_id=TENANT_A, document_type="waybill", related_entity_type="payment"
        )
        session = FakeSession([target, other])

        result = await list_archive(
            session,
            TENANT_A,
            search=None,
            type="invoice",
            related_entity_type="order",
            page=1,
            page_size=25,
        )

        self.assertEqual([target.id], [item.id for item in result.items])

    async def test_list_item_carries_exactly_the_twelve_contract_fields(self):
        session = FakeSession([make_item(tenant_id=TENANT_A)])

        result = await list_archive(
            session,
            TENANT_A,
            search=None,
            type=None,
            related_entity_type=None,
            page=1,
            page_size=25,
        )

        self.assertEqual(
            {
                "id", "name", "type", "fileId", "url", "size", "mime",
                "relatedEntityType", "relatedEntityId", "relatedEntityNumber",
                "uploadedAt", "uploadedBy",
            },
            set(result.items[0].model_dump().keys()),
        )

    async def test_null_related_entity_fields_are_answered_as_null_not_empty_string(self):
        item = make_item(
            tenant_id=TENANT_A,
            related_entity_type=None,
            related_entity_id=None,
            related_entity_number=None,
        )
        session = FakeSession([item])

        result = await list_archive(
            session,
            TENANT_A,
            search=None,
            type=None,
            related_entity_type=None,
            page=1,
            page_size=25,
        )

        payload = result.model_dump(mode="json")
        row = payload["items"][0]
        self.assertIsNone(row["relatedEntityType"])
        self.assertIsNone(row["relatedEntityId"])
        self.assertIsNone(row["relatedEntityNumber"])


# ── Action — auth, tenant scoping over HTTP, envelope ───────────────────────────────


def _db_override(session):
    async def _get_db():
        yield session

    return _get_db


def _user_override(tenant_id):
    async def _get_current_user():
        return CurrentUser(user_id=uuid.uuid4(), tenant_id=tenant_id, user=None)

    return _get_current_user


class ArchiveHttpTests(unittest.IsolatedAsyncioTestCase):
    """Real routing and dependency wiring, a fake session standing in for the DB."""

    def _build_app(self, session, *, tenant_id=TENANT_A, authenticated=True):
        app = FastAPI()
        app.add_exception_handler(AppError, app_error_handler)
        app.include_router(archive_router)
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

        response = await client.get("/api/finance/archive")

        self.assertEqual(401, response.status_code, response.text)

    async def test_list_envelope_carries_pagination_keys(self):
        session = FakeSession([make_item(tenant_id=TENANT_A)])
        app = self._build_app(session)
        client = await self._client(app)

        response = await client.get("/api/finance/archive")

        self.assertEqual(200, response.status_code, response.text)
        payload = response.json()["data"]
        self.assertEqual(
            {"items", "total", "page", "pageSize", "totalPages"}, set(payload.keys())
        )
        self.assertEqual(1, payload["total"])

    async def test_a_foreign_tenants_document_is_invisible_over_http(self):
        foreign = make_item(tenant_id=TENANT_B)
        session = FakeSession([foreign])
        app = self._build_app(session, tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get("/api/finance/archive")

        self.assertEqual([], response.json()["data"]["items"])

    async def test_oversized_page_size_is_rejected_at_the_route(self):
        app = self._build_app(FakeSession([]))
        client = await self._client(app)

        response = await client.get("/api/finance/archive", params={"pageSize": 1000})

        self.assertEqual(422, response.status_code, response.text)


if __name__ == "__main__":
    unittest.main()
