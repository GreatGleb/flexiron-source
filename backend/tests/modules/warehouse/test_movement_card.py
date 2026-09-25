"""Behaviour of `GET /api/warehouse/movements/:movementId` and
`GET /api/warehouse/movements/:movementId/audit`.

Same harness as `test_movements_list.py`: real request, real query, real
(private, temporary) SQLite database — only `get_db` and `get_current_user`
are overridden, the router and the `AppError` handler are the product's own.
The card is built off the same `_base_query`/`_to_list_item` the list uses, so
a mutation that drops the tenant filter, forgets the `MOVEMENT_NOT_FOUND`
refusal, or forks a second projection reddens these tests on its own. The
journal comes from the audit module's own `audit_entries` table through its
`internal_api.interface`, so that table is created here too.

    cd backend && python3 -m pytest tests/modules/warehouse/test_movement_card.py -q
"""

from __future__ import annotations

import os
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/warehouse-movement-card-unused.sqlite"},
):
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient
    from sqlalchemy import func, insert, select
    from sqlalchemy.dialects.postgresql import JSONB
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.ext.compiler import compiles, deregister

    from app.core.database import get_db
    from app.core.exceptions import AppError
    from app.main import app_error_handler
    from app.modules.audit.shared.models import AuditEntry
    from app.modules.auth.internal_api.interface import CurrentUser, get_current_user
    from app.modules.auth.shared.models import Tenant
    from app.modules.products.shared.models import Product

    # Imported for its side effect only: `WarehouseBatch.supplier_id` carries a
    # `ForeignKey("suppliers.id")`, and SQLite's DDL compiler needs that table
    # registered on `Base.metadata` to create `warehouse_batches` at all —
    # mirrors `test_movements_list.py`.
    import app.modules.suppliers.shared.models  # noqa: F401
    from app.modules.warehouse.features.list_movements.action import (
        router as movements_router,
    )
    from app.modules.warehouse.features.list_movements.domain import (
        MovementNotFoundError,
        get_movement_audit as get_movement_audit_domain,
        get_movement_card as get_movement_card_domain,
    )
    from app.modules.warehouse.features.list_movements.repository import (
        list_movements as list_movements_repo,
    )
    from app.modules.warehouse.shared.models import WarehouseBatch, WarehouseMovement


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


class MovementCardTestCase(unittest.IsolatedAsyncioTestCase):
    """Shared fixture: two tenants, one movement each, a journal on tenant A's
    own movement, and one movement whose own `tenant_id` disagrees with its
    batch — the same cross-tenant-leak trick `test_movements_list.py` uses."""

    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="warehouse-movement-card-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

        # SQLite has no JSONB: compile it as plain JSON for the test database
        # only — `AuditEntry.user_name_translations`/`.property_translations`
        # are JSONB (`app/modules/audit/shared/models.py`).
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
            for model in (Tenant, Product, WarehouseBatch, WarehouseMovement, AuditEntry):
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
                        "batch_number": "BATCH-CARD-1",
                        "quantity": 100,
                        "quantity_remaining": 40,
                        "unit": "kg",
                        "currency": "EUR",
                        "status": "available",
                    },
                    {
                        "id": self.batch_b,
                        "tenant_id": TENANT_B,
                        "product_id": self.product_b,
                        "batch_number": "BATCH-CARD-2",
                        "quantity": 10,
                        "quantity_remaining": 10,
                        "unit": "kg",
                        "currency": "USD",
                        "status": "available",
                    },
                ],
            )

            base_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
            self.movement_a = uuid4()
            self.movement_b = uuid4()
            # `tenant_id` claims B while `batch_id` points at A's own batch —
            # a row the batch JOIN's own tenant scoping alone would let
            # through for a tenant-A request to see. Only a top-level
            # `WarehouseMovement.tenant_id` filter catches it, which is what
            # makes the tenant mutation test below fail if that clause is
            # ever dropped from the shared query the card reuses.
            self.cross_tenant_leak = uuid4()
            await conn.execute(
                insert(WarehouseMovement),
                [
                    {
                        "id": self.movement_a,
                        "tenant_id": TENANT_A,
                        "batch_id": self.batch_a,
                        "type": "receipt",
                        "quantity": 60,
                        "unit": "kg",
                        "unit_price": 12.5,
                        "reference_id": None,
                        "reference_type": None,
                        "notes": None,
                        "moved_at": base_time,
                    },
                    {
                        "id": self.movement_b,
                        "tenant_id": TENANT_B,
                        "batch_id": self.batch_b,
                        "type": "receipt",
                        "quantity": 10,
                        "unit": "kg",
                        "unit_price": 1.0,
                        "reference_id": None,
                        "reference_type": None,
                        "notes": None,
                        "moved_at": base_time,
                    },
                    {
                        "id": self.cross_tenant_leak,
                        "tenant_id": TENANT_B,
                        "batch_id": self.batch_a,
                        "type": "receipt",
                        "quantity": 1,
                        "unit": "kg",
                        "unit_price": 1.0,
                        "reference_id": None,
                        "reference_type": None,
                        "notes": None,
                        "moved_at": base_time,
                    },
                ],
            )

            self.audit_entry = uuid4()
            await conn.execute(
                insert(AuditEntry),
                [
                    {
                        "id": self.audit_entry,
                        "tenant_id": TENANT_A,
                        "entity_type": "movement",
                        "entity_id": self.movement_a,
                        "user_id": None,
                        "user_name_translations": {"en": "Alice"},
                        "user_initials": "AL",
                        "property_translations": {"en": "Quantity"},
                        "old_value": "50",
                        "new_value": "60",
                        "sensitive": None,
                        "timestamp": base_time,
                    }
                ],
            )

    def _build_app(self, *, tenant_id=TENANT_A, authenticated=True):
        app = FastAPI()
        app.add_exception_handler(AppError, app_error_handler)
        app.include_router(movements_router)
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

    async def _audit_row_count(self) -> int:
        async with self.sessions() as session:
            result = await session.execute(select(func.count()).select_from(AuditEntry))
            return result.scalar() or 0


# ── Card matches the list projection, plus the journal field ────────────────


class CardMatchesListProjectionTests(MovementCardTestCase):
    async def test_cards_own_keys_without_audit_log_equal_the_list_items_keys(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        list_response = await client.get("/api/warehouse/movements")
        card_response = await client.get(f"/api/warehouse/movements/{self.movement_a}")

        list_item = next(
            item
            for item in list_response.json()["data"]["items"]
            if item["id"] == str(self.movement_a)
        )
        card = card_response.json()["data"]
        card_without_log = {k: v for k, v in card.items() if k != "auditLog"}

        self.assertEqual(set(list_item.keys()), set(card_without_log.keys()))
        self.assertEqual(list_item, card_without_log)

    async def test_card_carries_an_audit_log_field(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get(f"/api/warehouse/movements/{self.movement_a}")

        self.assertIn("auditLog", response.json()["data"])


# ── Not-found refusal — 404 with the domain code, never an empty body ───────


class MovementNotFoundTests(MovementCardTestCase):
    async def test_domain_raises_movement_not_found_for_an_unknown_id(self):
        async with self.sessions() as session:
            with self.assertRaises(MovementNotFoundError):
                await get_movement_card_domain(session, TENANT_A, uuid4())

    async def test_domain_raises_movement_not_found_for_a_foreign_tenants_movement(self):
        """Mutation target: dropping the tenant filter from `get_movement_by_id`
        (reused from `_base_query`) would let this answer tenant B's own
        movement instead of refusing it."""
        async with self.sessions() as session:
            with self.assertRaises(MovementNotFoundError):
                await get_movement_card_domain(session, TENANT_A, self.movement_b)

    async def test_http_answers_404_movement_not_found_not_empty_body(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get(f"/api/warehouse/movements/{uuid4()}")

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("MOVEMENT_NOT_FOUND", response.json()["detail"]["code"])

    async def test_a_foreign_tenants_movement_answers_404_not_its_data(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get(f"/api/warehouse/movements/{self.movement_b}")

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("MOVEMENT_NOT_FOUND", response.json()["detail"]["code"])

    async def test_a_movement_whose_own_tenant_id_disagrees_with_its_batch_is_refused(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get(f"/api/warehouse/movements/{self.cross_tenant_leak}")

        self.assertEqual(404, response.status_code, response.text)

    async def test_missing_authorization_is_refused(self):
        app = self._build_app(authenticated=False)
        client = await self._client(app)

        response = await client.get(f"/api/warehouse/movements/{self.movement_a}")

        self.assertEqual(401, response.status_code, response.text)


# ── Journal — same rows through both the card field and the standalone route ─


class JournalConsistencyTests(MovementCardTestCase):
    async def test_the_two_endpoints_agree_element_for_element(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        card_response = await client.get(f"/api/warehouse/movements/{self.movement_a}")
        audit_response = await client.get(
            f"/api/warehouse/movements/{self.movement_a}/audit"
        )

        self.assertEqual(200, card_response.status_code, card_response.text)
        self.assertEqual(200, audit_response.status_code, audit_response.text)
        self.assertEqual(
            card_response.json()["data"]["auditLog"], audit_response.json()["data"]
        )

    async def test_the_seeded_entry_carries_its_seven_fields(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get(
            f"/api/warehouse/movements/{self.movement_a}/audit"
        )

        entry = response.json()["data"][0]
        self.assertEqual(
            {
                "id", "timestamp", "user", "userInitials", "property",
                "oldValue", "newValue",
            },
            set(entry.keys()),
        )
        self.assertEqual(str(self.audit_entry), entry["id"])
        self.assertEqual("AL", entry["userInitials"])
        self.assertEqual("50", entry["oldValue"])
        self.assertEqual("60", entry["newValue"])

    async def test_a_foreign_tenants_journal_entry_is_invisible(self):
        """`self.audit_entry` belongs to tenant A's own movement — a tenant-B
        request for the same movement id is already refused as not found, so
        there is nothing to read; this asserts the audit read itself is
        tenant-scoped independently of that refusal."""
        async with self.sessions() as session:
            entries = await get_movement_audit_domain(session, TENANT_B, self.movement_a)

        self.assertEqual([], entries)


# ── Reading a journal never writes ───────────────────────────────────────────


class ReadHasNoSideEffectTests(MovementCardTestCase):
    async def test_an_unknown_movements_audit_is_an_empty_list_not_a_refusal(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get(f"/api/warehouse/movements/{uuid4()}/audit")

        self.assertEqual(200, response.status_code, response.text)
        self.assertEqual([], response.json()["data"])

    async def test_reading_an_unknown_movements_audit_twice_stays_empty_and_writes_nothing(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)
        unknown_id = uuid4()

        before = await self._audit_row_count()
        first = await client.get(f"/api/warehouse/movements/{unknown_id}/audit")
        second = await client.get(f"/api/warehouse/movements/{unknown_id}/audit")
        after = await self._audit_row_count()

        self.assertEqual([], first.json()["data"])
        self.assertEqual([], second.json()["data"])
        self.assertEqual(before, after)

    async def test_reading_the_card_of_an_unknown_movement_writes_nothing(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        before = await self._audit_row_count()
        await client.get(f"/api/warehouse/movements/{uuid4()}")
        after = await self._audit_row_count()

        self.assertEqual(before, after)


# ── The card is built off the list's own query, no second projection ────────


class NoParallelProjectionTests(MovementCardTestCase):
    async def test_card_and_a_hand_built_list_row_agree_on_every_shared_field(self):
        async with self.sessions() as session:
            rows = await list_movements_repo(session, TENANT_A)
            card = await get_movement_card_domain(session, TENANT_A, self.movement_a)

        row = next(r for r in rows if r[0].id == self.movement_a)
        movement, batch_number, product_id, currency = row

        self.assertEqual(movement.id, card.id)
        self.assertEqual(movement.type, card.type)
        self.assertEqual(batch_number, card.batchNumber)
        self.assertEqual(product_id, card.productId)
        self.assertEqual(currency, card.currency)
        self.assertEqual(float(movement.quantity), card.quantity)


if __name__ == "__main__":
    unittest.main()
