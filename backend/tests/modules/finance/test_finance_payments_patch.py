"""Behaviour of `PATCH /api/finance/payments/{id}`.

No database anywhere in this file, by the same design as the read slice's own
`test_finance_payments.py`: `FakeSession` never opens a connection or an
engine. It walks the *real* `sqlalchemy.select(...)` statements that
`repository.py` builds — one against `finance_payments`, one against
`uploaded_files` (the upload registry `_build_document` reads through
`app.core.uploads.service.get_file_by_id`) — and evaluates each against a
fixed table of transient ORM objects, dispatching by the statement's own
table name. `commit()`/`flush()`/`refresh()`/relationship assignment are no-ops
or plain Python attribute mutation: nothing here reaches a real engine, so what
changed is read back off the same in-memory object the domain mutated.

    cd backend && python3 -m pytest tests/modules/finance/test_finance_payments_patch.py -q
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
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/finance-payments-patch-unused.sqlite"},
):
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    from app.core.database import get_db
    from app.core.exceptions import AppError, NotFoundError
    from app.core.uploads.models import UploadedFile
    from app.main import app_error_handler
    from app.modules.auth.internal_api.interface import CurrentUser, get_current_user
    from app.modules.finance.features.payments.action import router as payments_router
    from app.modules.finance.features.payments.domain import (
        PaymentNotFoundError,
        patch_payment,
    )
    from app.modules.finance.features.payments.repository import get_payment_by_id
    from app.modules.finance.features.payments.schemas import PaymentPatchInput
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
        "notes": "original note",
        "documents": [],
        "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "updated_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
    }
    values.update(overrides)
    return FinancePayment(**values)


def make_uploaded_file(**overrides) -> UploadedFile:
    values = {
        "id": uuid.uuid4(),
        "tenant_id": uuid.uuid4(),
        "original_name": "contract-signed.pdf",
        "storage_path": "/srv/flexiron/uploads/abc123.pdf",
        "size": 4096,
        "mime": "application/pdf",
        "is_draft": True,
        "uploaded_by": None,
        "uploaded_at": datetime(2026, 3, 1, tzinfo=timezone.utc),
        "expires_at": None,
    }
    values.update(overrides)
    return UploadedFile(**values)


# ── Fake session — evaluates the real statements, touches no database ──────────────


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


def _table_name(stmt) -> str | None:
    froms = stmt.get_final_froms()
    if not froms:
        return None
    table = froms[0]
    return getattr(table, "name", None)


class FakeSession:
    """Two fixed tables (`finance_payments`, `uploaded_files`); `execute()`
    interprets the real statement and dispatches by the table it names.

    Writes never touch a real engine: `commit()`/`flush()`/`refresh()` are
    no-ops, and the domain's own attribute/relationship mutations on the
    transient `FinancePayment` it fetched earlier are already the "persisted"
    state — the same object is read back afterwards.
    """

    def __init__(self, payments=(), uploads=()):
        self.payments = list(payments)
        self.uploads = list(uploads)
        self.committed = False

    async def execute(self, stmt):
        table = _table_name(stmt)
        if table == "finance_payments":
            rows = self.payments
        elif table == "uploaded_files":
            rows = self.uploads
        else:
            raise AssertionError(f"fake session has no table {table!r}")

        where = _effective_whereclause(stmt)
        matching = [row for row in rows if where is None or _eval_clause(where, row)]
        return _FakeResult(rows=matching)

    async def commit(self):
        self.committed = True

    async def flush(self):
        return None

    async def refresh(self, obj):
        return None

    def add(self, obj):
        return None

    async def delete(self, obj):
        return None


TENANT_A = uuid.uuid4()
TENANT_B = uuid.uuid4()


# ── Domain — whitelist, tenant scoping / 404, response shape ───────────────────────


class WhitelistTests(unittest.IsolatedAsyncioTestCase):
    """Mutation target: add `status`/`amount` to `PaymentPatchInput` and read
    them in `domain.patch_payment` — these tests are built to redden on that."""

    async def test_status_and_amount_in_the_body_do_not_change_the_record(self):
        payment = make_payment(tenant_id=TENANT_A, status="pending", amount=100.0)
        session = FakeSession(payments=[payment])
        body = PaymentPatchInput.model_validate(
            {"notes": "updated", "fileIds": [], "status": "completed", "amount": 999.99}
        )

        result = await patch_payment(session, TENANT_A, payment.id, body)

        self.assertEqual("pending", result.status)
        self.assertEqual(100.0, result.amount)
        self.assertEqual("pending", payment.status)
        self.assertEqual(100.0, payment.amount)

    async def test_payment_number_in_the_body_does_not_change_the_record(self):
        payment = make_payment(tenant_id=TENANT_A, payment_number="PO-1001")
        session = FakeSession(payments=[payment])
        body = PaymentPatchInput.model_validate(
            {"notes": None, "fileIds": [], "paymentNumber": "PO-9999"}
        )

        result = await patch_payment(session, TENANT_A, payment.id, body)

        self.assertEqual("PO-1001", result.paymentNumber)


class NotesMergeTests(unittest.IsolatedAsyncioTestCase):
    async def test_notes_is_replaced_by_the_sent_value(self):
        payment = make_payment(tenant_id=TENANT_A, notes="old note")
        session = FakeSession(payments=[payment])
        body = PaymentPatchInput.model_validate({"notes": "new note", "fileIds": []})

        result = await patch_payment(session, TENANT_A, payment.id, body)

        self.assertEqual("new note", result.notes)

    async def test_notes_sent_as_null_clears_it(self):
        payment = make_payment(tenant_id=TENANT_A, notes="old note")
        session = FakeSession(payments=[payment])
        body = PaymentPatchInput.model_validate({"notes": None, "fileIds": []})

        result = await patch_payment(session, TENANT_A, payment.id, body)

        self.assertIsNone(result.notes)

    async def test_notes_key_absent_leaves_it_untouched(self):
        payment = make_payment(tenant_id=TENANT_A, notes="untouched note")
        session = FakeSession(payments=[payment])
        body = PaymentPatchInput.model_validate({"fileIds": []})

        result = await patch_payment(session, TENANT_A, payment.id, body)

        self.assertEqual("untouched note", result.notes)


class DocumentReplaceTests(unittest.IsolatedAsyncioTestCase):
    """The three replace-semantics cases named by the task: kept, added, removed."""

    async def test_a_document_whose_file_id_is_resent_is_kept_as_the_same_row(self):
        kept_doc = make_document(file_id=uuid.uuid4(), name="kept.pdf")
        payment = make_payment(tenant_id=TENANT_A, documents=[kept_doc])
        session = FakeSession(payments=[payment])
        body = PaymentPatchInput.model_validate(
            {"notes": None, "fileIds": [str(kept_doc.file_id)]}
        )

        result = await patch_payment(session, TENANT_A, payment.id, body)

        self.assertEqual(1, len(result.documents))
        self.assertEqual(kept_doc.id, result.documents[0].id)
        self.assertEqual("kept.pdf", result.documents[0].name)

    async def test_a_new_file_id_adds_a_document_built_from_the_upload_registry(self):
        payment = make_payment(tenant_id=TENANT_A, documents=[])
        uploaded = make_uploaded_file(
            tenant_id=TENANT_A,
            original_name="signed-contract.pdf",
            size=2048,
            mime="application/pdf",
            storage_path="/srv/flexiron/uploads/xyz789.pdf",
        )
        session = FakeSession(payments=[payment], uploads=[uploaded])
        body = PaymentPatchInput.model_validate(
            {"notes": None, "fileIds": [str(uploaded.id)]}
        )

        result = await patch_payment(session, TENANT_A, payment.id, body)

        self.assertEqual(1, len(result.documents))
        added = result.documents[0]
        self.assertEqual(uploaded.id, added.fileId)
        self.assertEqual("signed-contract.pdf", added.name)
        self.assertEqual(2048, added.size)
        self.assertEqual("application/pdf", added.mime)

    async def test_a_file_id_missing_from_the_new_list_is_dropped(self):
        gone_doc = make_document(file_id=uuid.uuid4(), name="gone.pdf")
        kept_doc = make_document(file_id=uuid.uuid4(), name="stays.pdf")
        payment = make_payment(tenant_id=TENANT_A, documents=[gone_doc, kept_doc])
        session = FakeSession(payments=[payment])
        body = PaymentPatchInput.model_validate(
            {"notes": None, "fileIds": [str(kept_doc.file_id)]}
        )

        result = await patch_payment(session, TENANT_A, payment.id, body)

        self.assertEqual(["stays.pdf"], [doc.name for doc in result.documents])

    async def test_an_empty_file_ids_list_clears_every_document(self):
        payment = make_payment(
            tenant_id=TENANT_A, documents=[make_document(), make_document()]
        )
        session = FakeSession(payments=[payment])
        body = PaymentPatchInput.model_validate({"notes": None, "fileIds": []})

        result = await patch_payment(session, TENANT_A, payment.id, body)

        self.assertEqual([], result.documents)

    async def test_a_missing_file_ids_key_leaves_documents_untouched(self):
        untouched_doc = make_document(name="untouched.pdf")
        payment = make_payment(tenant_id=TENANT_A, documents=[untouched_doc])
        session = FakeSession(payments=[payment])
        body = PaymentPatchInput.model_validate({"notes": "just a note"})

        result = await patch_payment(session, TENANT_A, payment.id, body)

        self.assertEqual(["untouched.pdf"], [doc.name for doc in result.documents])

    async def test_an_unknown_file_id_becomes_a_same_id_placeholder_not_a_refusal(self):
        payment = make_payment(tenant_id=TENANT_A, documents=[])
        unknown_id = str(uuid.uuid4())
        session = FakeSession(payments=[payment], uploads=[])
        body = PaymentPatchInput.model_validate(
            {"notes": None, "fileIds": [unknown_id]}
        )

        result = await patch_payment(session, TENANT_A, payment.id, body)

        self.assertEqual(1, len(result.documents))
        placeholder = result.documents[0]
        self.assertEqual(unknown_id, placeholder.name)
        self.assertEqual(0, placeholder.size)

    async def test_a_file_id_belonging_to_another_tenant_is_also_a_placeholder(self):
        """The upload registry read is itself tenant-scoped (`get_file_by_id`),
        so a real id that belongs to a foreign tenant reads as unknown here too."""
        payment = make_payment(tenant_id=TENANT_A, documents=[])
        foreign_upload = make_uploaded_file(tenant_id=TENANT_B)
        session = FakeSession(payments=[payment], uploads=[foreign_upload])
        body = PaymentPatchInput.model_validate(
            {"notes": None, "fileIds": [str(foreign_upload.id)]}
        )

        result = await patch_payment(session, TENANT_A, payment.id, body)

        self.assertEqual(1, len(result.documents))
        self.assertEqual(str(foreign_upload.id), result.documents[0].name)
        self.assertEqual(0, result.documents[0].size)


class NotFoundTests(unittest.IsolatedAsyncioTestCase):
    async def test_an_unknown_id_raises_payment_not_found_with_the_domain_code(self):
        session = FakeSession(payments=[])
        body = PaymentPatchInput.model_validate({"notes": "x", "fileIds": []})

        with self.assertRaises(PaymentNotFoundError) as ctx:
            await patch_payment(session, TENANT_A, uuid.uuid4(), body)

        self.assertEqual("PAYMENT_NOT_FOUND", ctx.exception.code)
        self.assertIsInstance(ctx.exception, NotFoundError)
        self.assertIsInstance(ctx.exception, AppError)

    async def test_a_foreign_tenants_payment_also_raises_payment_not_found(self):
        foreign = make_payment(tenant_id=TENANT_B)
        session = FakeSession(payments=[foreign])
        body = PaymentPatchInput.model_validate({"notes": "x", "fileIds": []})

        with self.assertRaises(PaymentNotFoundError):
            await patch_payment(session, TENANT_A, foreign.id, body)

    async def test_a_refused_patch_leaves_the_record_unchanged(self):
        foreign = make_payment(tenant_id=TENANT_B, notes="original")
        session = FakeSession(payments=[foreign])
        body = PaymentPatchInput.model_validate({"notes": "hijacked", "fileIds": []})

        with self.assertRaises(PaymentNotFoundError):
            await patch_payment(session, TENANT_A, foreign.id, body)

        self.assertEqual("original", foreign.notes)


class ResponseShapeTests(unittest.IsolatedAsyncioTestCase):
    async def test_response_carries_exactly_the_same_fields_as_the_card(self):
        payment = make_payment(tenant_id=TENANT_A)
        session = FakeSession(payments=[payment])
        body = PaymentPatchInput.model_validate({"notes": "x", "fileIds": []})

        patch_result = await patch_payment(session, TENANT_A, payment.id, body)
        card_result = await get_payment_by_id(session, payment.id, TENANT_A)

        self.assertEqual(
            {
                "id", "paymentNumber", "direction", "status", "amount", "currency",
                "counterpartyId", "counterpartyName", "counterpartyVatCode", "orderId",
                "orderNumber", "supplierInvoiceRef", "description", "dueDate", "paidAt",
                "documents", "notes", "createdAt", "updatedAt",
            },
            set(patch_result.model_dump().keys()),
        )
        self.assertIsNotNone(card_result)

    async def test_updated_at_is_newer_than_before_the_patch(self):
        original_updated_at = datetime(2020, 1, 1, tzinfo=timezone.utc)
        payment = make_payment(tenant_id=TENANT_A, updated_at=original_updated_at)
        session = FakeSession(payments=[payment])
        body = PaymentPatchInput.model_validate({"notes": "bumped", "fileIds": []})

        result = await patch_payment(session, TENANT_A, payment.id, body)

        self.assertGreater(result.updatedAt, original_updated_at)


# ── Action — same checks over real routing and dependency wiring ───────────────────


def _db_override(session):
    async def _get_db():
        yield session

    return _get_db


def _user_override(tenant_id):
    async def _get_current_user():
        return CurrentUser(user_id=uuid.uuid4(), tenant_id=tenant_id, user=None)

    return _get_current_user


class PatchHttpTests(unittest.IsolatedAsyncioTestCase):
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
        app = self._build_app(FakeSession(payments=[]), authenticated=False)
        client = await self._client(app)

        response = await client.patch(
            f"/api/finance/payments/{uuid.uuid4()}", json={"notes": "x", "fileIds": []}
        )

        self.assertEqual(401, response.status_code, response.text)

    async def test_status_and_amount_are_ignored_over_http(self):
        payment = make_payment(tenant_id=TENANT_A, status="pending", amount=50.0)
        app = self._build_app(FakeSession(payments=[payment]))
        client = await self._client(app)

        response = await client.patch(
            f"/api/finance/payments/{payment.id}",
            json={"notes": "x", "fileIds": [], "status": "completed", "amount": 12345.0},
        )

        self.assertEqual(200, response.status_code, response.text)
        data = response.json()["data"]
        self.assertEqual("pending", data["status"])
        self.assertEqual(50.0, data["amount"])

    async def test_a_foreign_tenants_payment_is_404_with_the_domain_code(self):
        foreign = make_payment(tenant_id=TENANT_B)
        app = self._build_app(FakeSession(payments=[foreign]), tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.patch(
            f"/api/finance/payments/{foreign.id}", json={"notes": "x", "fileIds": []}
        )

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("PAYMENT_NOT_FOUND", response.json()["detail"]["code"])

    async def test_an_unknown_id_is_404_with_the_domain_code(self):
        app = self._build_app(FakeSession(payments=[]))
        client = await self._client(app)

        response = await client.patch(
            f"/api/finance/payments/{uuid.uuid4()}", json={"notes": "x", "fileIds": []}
        )

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("PAYMENT_NOT_FOUND", response.json()["detail"]["code"])

    async def test_document_replace_over_http_covers_kept_added_and_removed(self):
        kept_doc = make_document(file_id=uuid.uuid4(), name="stays.pdf")
        gone_doc = make_document(file_id=uuid.uuid4(), name="gone.pdf")
        payment = make_payment(tenant_id=TENANT_A, documents=[kept_doc, gone_doc])
        uploaded = make_uploaded_file(
            tenant_id=TENANT_A, original_name="new-file.pdf", size=99, mime="application/pdf"
        )
        app = self._build_app(FakeSession(payments=[payment], uploads=[uploaded]))
        client = await self._client(app)

        response = await client.patch(
            f"/api/finance/payments/{payment.id}",
            json={
                "notes": None,
                "fileIds": [str(kept_doc.file_id), str(uploaded.id)],
            },
        )

        self.assertEqual(200, response.status_code, response.text)
        names = {doc["name"] for doc in response.json()["data"]["documents"]}
        self.assertEqual({"stays.pdf", "new-file.pdf"}, names)

    async def test_response_envelope_carries_the_full_card_shape(self):
        payment = make_payment(tenant_id=TENANT_A)
        app = self._build_app(FakeSession(payments=[payment]))
        client = await self._client(app)

        response = await client.patch(
            f"/api/finance/payments/{payment.id}", json={"notes": "x", "fileIds": []}
        )

        self.assertEqual(200, response.status_code, response.text)
        data = response.json()["data"]
        self.assertEqual(
            {
                "id", "paymentNumber", "direction", "status", "amount", "currency",
                "counterpartyId", "counterpartyName", "counterpartyVatCode", "orderId",
                "orderNumber", "supplierInvoiceRef", "description", "dueDate", "paidAt",
                "documents", "notes", "createdAt", "updatedAt",
            },
            set(data.keys()),
        )


if __name__ == "__main__":
    unittest.main()
