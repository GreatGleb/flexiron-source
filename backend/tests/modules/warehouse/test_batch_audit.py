"""Behaviour of `GET /api/warehouse/batches/:batchId/audit` and
`DELETE /api/warehouse/batches/:batchId/audit/:entryId`.

Same harness as `test_movement_card.py`: real request, real query, real
(private, temporary) SQLite database — only `get_db` and `get_current_user`
are overridden, the router and the `AppError` handler are the product's own.
The journal's storage is the warehouse's own `stock_audit_entries` table
(`StockAuditEntry`), so that table is created and seeded here directly.

    cd backend && python3 -m pytest tests/modules/warehouse/test_batch_audit.py -q
"""

from __future__ import annotations

import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/warehouse-batch-audit-unused.sqlite"},
):
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient
    from sqlalchemy import insert, select
    from sqlalchemy.dialects.postgresql import JSONB
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.ext.compiler import compiles, deregister

    from app.core.database import get_db
    from app.core.exceptions import AppError
    from app.main import app_error_handler
    from app.modules.auth.internal_api.interface import CurrentUser, get_current_user

    # Imported for its side effect only: `StockAuditEntry.user_id` carries a
    # `ForeignKey("users.id")`, and SQLite's DDL compiler needs that table
    # registered on `Base.metadata` to create `stock_audit_entries` at all.
    import app.modules.auth.shared.models  # noqa: F401
    from app.modules.auth.shared.models import Tenant

    # Imported for their side effect only: `WarehouseBatch` carries foreign
    # keys to `products`, `suppliers`, `uoms` and `currencies`, and SQLite's DDL
    # compiler needs those tables registered on `Base.metadata` to create
    # `warehouse_batches` at all — mirrors `test_batch_aggregates.py`.
    import app.modules.settings.shared.models  # noqa: F401
    import app.modules.suppliers.shared.models  # noqa: F401
    from app.modules.products.shared.models import Product
    from app.modules.warehouse.features.batch_audit.action import (
        router as audit_router,
    )
    from app.modules.warehouse.features.batch_audit.domain import (
        AuditEntryNotFoundError,
        BatchNotFoundError,
        delete_batch_audit_entry as delete_batch_audit_entry_domain,
    )
    from app.modules.warehouse.shared.models import StockAuditEntry, WarehouseBatch


TENANT_A = uuid4()
TENANT_B = uuid4()


def _db_override(sessions):
    async def _get_db():
        async with sessions() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    return _get_db


def _user_override(tenant_id):
    async def _get_current_user():
        return CurrentUser(user_id=uuid4(), tenant_id=tenant_id, user=None)

    return _get_current_user


class BatchAuditTestCase(unittest.IsolatedAsyncioTestCase):
    """Shared fixture: two tenants with a batch each, three tenant-A entries on
    tenant A's own batch, and one entry whose own `tenant_id` disagrees with the
    batch it points at — the same cross-tenant-leak trick `test_movement_card.py`
    uses, and the mutation guard for the read's tenant filter."""

    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="warehouse-batch-audit-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

        # SQLite has no JSONB: compile it as plain JSON for the test database
        # only — `StockAuditEntry.user_name_translations` / `.property_translations`
        # are JSONB (`app/modules/warehouse/shared/models.py`).
        @compiles(JSONB, "sqlite")
        def sqlite_jsonb(type_, compiler, **kw):
            return "JSON"

        self.addCleanup(deregister, JSONB)
        self.engine = create_async_engine(
            "sqlite+aiosqlite:///" + str(self.root / "test.sqlite")
        )
        self.addAsyncCleanup(self.engine.dispose)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)

        async with self.engine.begin() as conn:
            for model in (Tenant, Product, WarehouseBatch, StockAuditEntry):
                await conn.run_sync(
                    lambda sync, model=model: model.__table__.create(sync)
                )

            await conn.execute(
                insert(Tenant),
                [
                    {"id": TENANT_A, "name": "A", "slug": f"a-{uuid4()}"},
                    {"id": TENANT_B, "name": "B", "slug": f"b-{uuid4()}"},
                ],
            )

            self.product_a = uuid4()
            self.product_b = uuid4()
            await conn.execute(
                insert(Product),
                [
                    {"id": self.product_a, "tenant_id": TENANT_A, "name": "Steel Beam"},
                    {"id": self.product_b, "tenant_id": TENANT_B, "name": "Copper Wire"},
                ],
            )

            self.batch_a = uuid4()
            self.batch_b = uuid4()
            await conn.execute(
                insert(WarehouseBatch),
                [
                    {
                        "id": self.batch_a,
                        "tenant_id": TENANT_A,
                        "product_id": self.product_a,
                        "batch_number": "BATCH-AUDIT-1",
                        "quantity": 100,
                        "quantity_remaining": 100,
                        "unit": "kg",
                        "currency": "EUR",
                        "status": "available",
                    },
                    {
                        "id": self.batch_b,
                        "tenant_id": TENANT_B,
                        "product_id": self.product_b,
                        "batch_number": "BATCH-AUDIT-2",
                        "quantity": 10,
                        "quantity_remaining": 10,
                        "unit": "kg",
                        "currency": "EUR",
                        "status": "available",
                    },
                ],
            )

            base = datetime(2026, 1, 1, tzinfo=timezone.utc)

            def _entry(entry_id, tenant_id, batch_id, ts, old, new):
                return {
                    "id": entry_id,
                    "tenant_id": tenant_id,
                    "batch_id": batch_id,
                    "user_id": None,
                    "user_name_translations": {
                        "ru": "Иван",
                        "en": "Ivan",
                        "lt": "Ivanas",
                    },
                    "user_initials": "IV",
                    "property_translations": {
                        "ru": "Количество",
                        "en": "Quantity",
                        "lt": "Kiekis",
                    },
                    "old_value": old,
                    "new_value": new,
                    "timestamp": ts,
                }

            self.entry_oldest = uuid4()
            self.entry_middle = uuid4()
            self.entry_newest = uuid4()
            self.entry_leak_foreign_tenant = uuid4()
            self.entry_batch_b = uuid4()

            await conn.execute(
                insert(StockAuditEntry),
                [
                    _entry(
                        self.entry_oldest, TENANT_A, self.batch_a, base, "10", "20"
                    ),
                    _entry(
                        self.entry_middle,
                        TENANT_A,
                        self.batch_a,
                        base + timedelta(hours=1),
                        "20",
                        "30",
                    ),
                    _entry(
                        self.entry_newest,
                        TENANT_A,
                        self.batch_a,
                        base + timedelta(hours=2),
                        "30",
                        "40",
                    ),
                    # Same `batch_id` as tenant A's own rows, but a different
                    # `tenant_id` — a mutation guard. If the tenant filter were
                    # ever dropped from the read query (kept only `batch_id`),
                    # this row would leak into tenant A's journal and, being the
                    # newest, would surface first — breaking both the count and
                    # the order assertions below.
                    _entry(
                        self.entry_leak_foreign_tenant,
                        TENANT_B,
                        self.batch_a,
                        base + timedelta(hours=3),
                        "leaked",
                        "leaked",
                    ),
                    _entry(
                        self.entry_batch_b, TENANT_B, self.batch_b, base, "x", "y"
                    ),
                ],
            )

    def _build_app(self, *, tenant_id=TENANT_A, authenticated=True):
        app = FastAPI()
        app.add_exception_handler(AppError, app_error_handler)
        app.include_router(audit_router)
        app.dependency_overrides[get_db] = _db_override(self.sessions)
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

    async def _audit_ids(self) -> set:
        async with self.sessions() as session:
            result = await session.execute(select(StockAuditEntry.id))
            return {row[0] for row in result.all()}


# ── Reading — only the requested batch, newest first, id present ─────────────


class BatchAuditReadTests(BatchAuditTestCase):
    async def test_entries_are_only_the_requested_batchs_and_newest_first(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get(f"/api/warehouse/batches/{self.batch_a}/audit")

        self.assertEqual(200, response.status_code, response.text)
        ids = [item["id"] for item in response.json()["data"]]
        # Three legitimate tenant-A entries, newest timestamp first. The
        # foreign-tenant row sharing `batch_id` (`base + 3h`, which would sort
        # first of all four) must not appear at all.
        self.assertEqual(
            [str(self.entry_newest), str(self.entry_middle), str(self.entry_oldest)],
            ids,
        )

    async def test_every_entry_carries_its_id_and_the_seven_wire_fields(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get(f"/api/warehouse/batches/{self.batch_a}/audit")

        entry = response.json()["data"][0]
        self.assertEqual(
            {
                "id",
                "timestamp",
                "user",
                "userInitials",
                "property",
                "oldValue",
                "newValue",
            },
            set(entry.keys()),
        )
        self.assertNotIn("user_name_translations", entry)
        self.assertNotIn("property_translations", entry)
        self.assertEqual(str(self.entry_newest), entry["id"])
        self.assertEqual("IV", entry["userInitials"])
        self.assertEqual("30", entry["oldValue"])
        self.assertEqual("40", entry["newValue"])

    async def test_user_and_property_are_translation_objects_not_flat_strings(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get(f"/api/warehouse/batches/{self.batch_a}/audit")

        entry = response.json()["data"][0]
        self.assertIsInstance(entry["user"], dict)
        self.assertIsInstance(entry["property"], dict)
        self.assertEqual({"ru", "en", "lt"}, set(entry["user"].keys()))
        self.assertEqual("Ivan", entry["user"]["en"])
        self.assertEqual({"ru", "en", "lt"}, set(entry["property"].keys()))
        self.assertEqual("Quantity", entry["property"]["en"])

    async def test_response_is_a_flat_array_in_the_envelope(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get(f"/api/warehouse/batches/{self.batch_a}/audit")

        self.assertEqual(200, response.status_code, response.text)
        self.assertIsInstance(response.json()["data"], list)

    async def test_unknown_batch_is_an_empty_array_not_an_error(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get(f"/api/warehouse/batches/{uuid4()}/audit")

        self.assertEqual(200, response.status_code, response.text)
        self.assertEqual([], response.json()["data"])

    async def test_a_foreign_tenants_batch_is_an_empty_array(self):
        """Mutation target: dropping the tenant filter from `list_audit_entries`
        (keeping only `batch_id`) would make this answer tenant B's own entry."""
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get(f"/api/warehouse/batches/{self.batch_b}/audit")

        self.assertEqual(200, response.status_code, response.text)
        self.assertEqual([], response.json()["data"])

    async def test_missing_authorization_is_refused(self):
        app = self._build_app(authenticated=False)
        client = await self._client(app)

        response = await client.get(f"/api/warehouse/batches/{self.batch_a}/audit")

        self.assertEqual(401, response.status_code, response.text)


# ── Deleting — refusal instead of a silent success, id-addressed ─────────────


class BatchAuditDeleteTests(BatchAuditTestCase):
    async def test_deleting_an_entry_removes_it_from_the_read(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        delete_response = await client.delete(
            f"/api/warehouse/batches/{self.batch_a}/audit/{self.entry_newest}"
        )
        read_response = await client.get(f"/api/warehouse/batches/{self.batch_a}/audit")

        self.assertEqual(200, delete_response.status_code, delete_response.text)
        self.assertEqual(
            [str(self.entry_middle), str(self.entry_oldest)],
            [item["id"] for item in read_response.json()["data"]],
        )

    async def test_a_repeated_delete_answers_404_audit_entry_not_found(self):
        """Mutation target: returning a successful answer instead of raising
        `AuditEntryNotFoundError` for a missing entry would make the second
        delete 200."""
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)
        url = f"/api/warehouse/batches/{self.batch_a}/audit/{self.entry_oldest}"

        first = await client.delete(url)
        second = await client.delete(url)

        self.assertEqual(200, first.status_code, first.text)
        self.assertEqual(404, second.status_code, second.text)
        self.assertEqual("AUDIT_ENTRY_NOT_FOUND", second.json()["detail"]["code"])

    async def test_delete_of_an_unknown_entry_answers_404_audit_entry_not_found(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.delete(
            f"/api/warehouse/batches/{self.batch_a}/audit/{uuid4()}"
        )

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("AUDIT_ENTRY_NOT_FOUND", response.json()["detail"]["code"])

    async def test_delete_on_an_unknown_batch_answers_404_batch_not_found(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.delete(
            f"/api/warehouse/batches/{uuid4()}/audit/{uuid4()}"
        )

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("BATCH_NOT_FOUND", response.json()["detail"]["code"])

    async def test_delete_on_a_foreign_tenants_batch_answers_404_batch_not_found(self):
        """An unknown batch answers `BATCH_NOT_FOUND`, not
        `AUDIT_ENTRY_NOT_FOUND` — even when the entry id belongs to that other
        tenant's batch."""
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.delete(
            f"/api/warehouse/batches/{self.batch_b}/audit/{self.entry_batch_b}"
        )

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("BATCH_NOT_FOUND", response.json()["detail"]["code"])

    async def test_a_foreign_tenants_entry_on_my_batch_cannot_be_deleted(self):
        """The entry shares tenant A's `batch_id` but belongs to tenant B: for
        tenant A the batch exists and the entry does not, so the answer is
        `AUDIT_ENTRY_NOT_FOUND` and the row survives untouched."""
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)
        before = await self._audit_ids()

        response = await client.delete(
            f"/api/warehouse/batches/{self.batch_a}/audit/"
            f"{self.entry_leak_foreign_tenant}"
        )
        after = await self._audit_ids()

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("AUDIT_ENTRY_NOT_FOUND", response.json()["detail"]["code"])
        self.assertIn(self.entry_leak_foreign_tenant, after)
        self.assertEqual(before, after)

    async def test_missing_authorization_is_refused(self):
        app = self._build_app(authenticated=False)
        client = await self._client(app)

        response = await client.delete(
            f"/api/warehouse/batches/{self.batch_a}/audit/{self.entry_newest}"
        )

        self.assertEqual(401, response.status_code, response.text)


# ── Domain — the two refusals, raised rather than answered as success ────────


class BatchAuditDomainTests(BatchAuditTestCase):
    async def test_domain_raises_audit_entry_not_found_for_an_unknown_entry(self):
        async with self.sessions() as session:
            with self.assertRaises(AuditEntryNotFoundError):
                await delete_batch_audit_entry_domain(
                    session, TENANT_A, self.batch_a, uuid4()
                )

    async def test_domain_raises_batch_not_found_for_a_foreign_tenants_batch(self):
        async with self.sessions() as session:
            with self.assertRaises(BatchNotFoundError):
                await delete_batch_audit_entry_domain(
                    session, TENANT_A, self.batch_b, self.entry_batch_b
                )


if __name__ == "__main__":
    unittest.main()
