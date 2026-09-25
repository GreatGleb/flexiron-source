"""Behaviour of `GET /api/warehouse/batches/:batchId/aggregates`.

Same harness as `test_batches_list.py`: real request, real query, real
(private, temporary) SQLite database — only `get_db` and `get_current_user`
are overridden, the router and the `AppError` handler are the product's own.
No mocked session and no hand-picked fake statement evaluator: the domain's
actual two-pass bucketing runs against real `warehouse_movements` rows, so a
mutation that drops the offcut skip, folds a `correction` into the bucket
instead of overriding it, or answers an unknown batch with data instead of a
refusal reddens these tests on its own.

    cd backend && python3 -m pytest tests/modules/warehouse/test_batch_aggregates.py -q
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
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/warehouse-batch-aggregates-unused.sqlite"},
):
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient
    from sqlalchemy import insert
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.core.database import get_db
    from app.core.exceptions import AppError
    from app.main import app_error_handler
    from app.modules.auth.internal_api.interface import CurrentUser, get_current_user
    from app.modules.auth.shared.models import Tenant
    from app.modules.products.shared.models import Product

    # Imported for their side effect only: `WarehouseBatch.supplier_id`,
    # `.uom_id`, `.received_uom_id` and `.received_currency_id` all carry
    # foreign keys, and SQLite's DDL compiler needs those tables registered on
    # `Base.metadata` to create `warehouse_batches` at all — mirrors
    # `test_batches_list.py`'s own `suppliers` import.
    import app.modules.suppliers.shared.models  # noqa: F401
    import app.modules.settings.shared.models  # noqa: F401
    from app.modules.warehouse.features.list_batches.action import (
        router as batches_router,
    )
    from app.modules.warehouse.features.list_batches.domain import (
        BatchNotFoundError,
        get_batch_aggregates as get_batch_aggregates_domain,
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


class AggregatesTestCase(unittest.IsolatedAsyncioTestCase):
    """Shared fixture: one tenant-A batch with a mixed journal, one bare
    tenant-B batch used only to prove cross-tenant isolation."""

    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="warehouse-batch-aggregates-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

        self.engine = create_async_engine(
            "sqlite+aiosqlite:///" + str(self.root / "test.sqlite")
        )
        self.addAsyncCleanup(self.engine.dispose)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)

        async with self.engine.begin() as conn:
            for model in (Tenant, Product, WarehouseBatch, WarehouseMovement):
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

            base_time = datetime(2026, 1, 1, tzinfo=timezone.utc)

            # ── Tenant A: the batch the journal tests read ──────────────────
            self.batch = uuid4()
            self.uom_id = uuid4()
            await conn.execute(
                insert(WarehouseBatch),
                [
                    {
                        "id": self.batch,
                        "tenant_id": TENANT_A,
                        "product_id": self.product_a,
                        "batch_number": "BATCH-AGG-1",
                        "quantity": 100,
                        "quantity_remaining": 42,
                        "unit": "kg",
                        "uom_id": self.uom_id,
                        "currency": "EUR",
                        "received_at": base_time,
                        "status": "available",
                    }
                ],
            )

            real_offcut_id = uuid4()
            moved_offcut_id = uuid4()

            def _movement(**overrides) -> dict:
                row = {
                    "id": uuid4(),
                    "tenant_id": TENANT_A,
                    "batch_id": self.batch,
                    "unit": "kg",
                    "reference_id": None,
                    "reference_type": None,
                    "offcut_id": None,
                    "moved_at": base_time,
                }
                row.update(overrides)
                return row

            await conn.execute(
                insert(WarehouseMovement),
                [
                    # Ignored entirely — neither type takes metal off the batch.
                    _movement(type="receipt", quantity=100),
                    _movement(type="transfer", quantity=5),
                    # A real sale: 50 into the `sale` bucket.
                    _movement(type="sale", quantity=50),
                    # A returned sale, reducing the same bucket: 50 - 10 = 40.
                    _movement(type="return", quantity=10, reference_type="sale"),
                    # A return whose referenceType is NOT an outgoing type —
                    # ignored, not subtracted from anything (rule 3).
                    _movement(
                        type="return", quantity=3, reference_type="order-shipment"
                    ),
                    # Moves an OFFCUT (offcut_id set, type != 'offcut') — must
                    # be excluded, or the same metal is double-counted.
                    _movement(
                        type="write-off", quantity=7, offcut_id=moved_offcut_id
                    ),
                    # The cut itself: offcut_id set AND type == 'offcut' — this
                    # one DOES move the batch and must be counted.
                    _movement(
                        type="offcut", quantity=8, offcut_id=real_offcut_id
                    ),
                ],
            )

            # ── Tenant B: bare batch, no journal — cross-tenant isolation ───
            self.foreign_batch = uuid4()
            await conn.execute(
                insert(WarehouseBatch),
                [
                    {
                        "id": self.foreign_batch,
                        "tenant_id": TENANT_B,
                        "product_id": self.product_b,
                        "batch_number": "BATCH-AGG-FOREIGN",
                        "quantity": 10,
                        "quantity_remaining": 10,
                        "unit": "kg",
                        "currency": "EUR",
                        "received_at": base_time,
                        "status": "available",
                    }
                ],
            )

            # ── Tenant A: separate batch isolating the `correction` rule ────
            # Sale gives 30, then a correction to 10 must SET the bucket, not
            # add to it — final answer is 10, never 40 and never 30.
            self.corrected_batch = uuid4()
            await conn.execute(
                insert(WarehouseBatch),
                [
                    {
                        "id": self.corrected_batch,
                        "tenant_id": TENANT_A,
                        "product_id": self.product_a,
                        "batch_number": "BATCH-AGG-CORRECTED",
                        "quantity": 30,
                        "quantity_remaining": 0,
                        "unit": "kg",
                        "currency": "EUR",
                        "received_at": base_time,
                        "status": "depleted",
                    }
                ],
            )
            await conn.execute(
                insert(WarehouseMovement),
                [
                    {
                        "id": uuid4(),
                        "tenant_id": TENANT_A,
                        "batch_id": self.corrected_batch,
                        "type": "sale",
                        "quantity": 30,
                        "unit": "kg",
                        "reference_id": None,
                        "reference_type": None,
                        "offcut_id": None,
                        "moved_at": base_time,
                    },
                    {
                        "id": uuid4(),
                        "tenant_id": TENANT_A,
                        "batch_id": self.corrected_batch,
                        "type": "correction",
                        "quantity": 10,
                        "unit": "kg",
                        "reference_id": None,
                        "reference_type": "sale",
                        "offcut_id": None,
                        "moved_at": base_time,
                    },
                ],
            )

    def _build_app(self, *, tenant_id=TENANT_A, authenticated=True):
        app = FastAPI()
        app.add_exception_handler(AppError, app_error_handler)
        app.include_router(batches_router)
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


# ── Domain — bucketing rules, offcut exclusion, correction override ─────────


class DomainAggregationTests(AggregatesTestCase):
    async def test_receipt_uses_remaining_quantity_and_sorts_first(self):
        async with self.sessions() as session:
            result = await get_batch_aggregates_domain(session, TENANT_A, self.batch)

        self.assertEqual("receipt", result[0].type)
        self.assertEqual(42, result[0].quantity)
        self.assertEqual(self.uom_id, result[0].uomId)

    async def test_buckets_are_sorted_by_quantity_descending_after_receipt(self):
        async with self.sessions() as session:
            result = await get_batch_aggregates_domain(session, TENANT_A, self.batch)

        # receipt=42, sale=50-10=40, offcut=8 — write-off is excluded (moves
        # an offcut), the mismatched-referenceType return changes nothing.
        self.assertEqual(
            [("receipt", 42), ("sale", 40), ("offcut", 8)],
            [(item.type, item.quantity) for item in result],
        )

    async def test_a_movement_that_moves_an_offcut_is_excluded_from_the_batch(self):
        """Mutation target: removing the `_moves_offcut` skip in
        `get_batch_aggregates` (`domain.py`). Without it this test reddens,
        because the excluded `write-off` movement (quantity 7, `offcut_id`
        set) would surface as its own bucket."""
        async with self.sessions() as session:
            result = await get_batch_aggregates_domain(session, TENANT_A, self.batch)

        types = {item.type for item in result}
        self.assertNotIn("write-off", types)

    async def test_the_offcut_movement_itself_is_included(self):
        """The cut itself (type == 'offcut', offcut_id set) DOES move the
        batch and must be counted — unlike the movement above."""
        async with self.sessions() as session:
            result = await get_batch_aggregates_domain(session, TENANT_A, self.batch)

        by_type = {item.type: item.quantity for item in result}
        self.assertEqual(8, by_type["offcut"])

    async def test_return_with_an_unlisted_reference_type_changes_nothing(self):
        """`reference_type="order-shipment"` is not in `OUTGOING_MOVEMENT_TYPES`
        — the 3-quantity return must not create or reduce any bucket."""
        async with self.sessions() as session:
            result = await get_batch_aggregates_domain(session, TENANT_A, self.batch)

        types = {item.type for item in result}
        self.assertNotIn("order-shipment", types)

    async def test_zero_quantity_buckets_are_dropped(self):
        async with self.sessions() as session:
            result = await get_batch_aggregates_domain(session, TENANT_A, self.batch)

        for item in result:
            self.assertGreater(item.quantity, 0)

    async def test_correction_sets_the_bucket_instead_of_adding_to_it(self):
        async with self.sessions() as session:
            result = await get_batch_aggregates_domain(
                session, TENANT_A, self.corrected_batch
            )

        # quantity_remaining is 0 on this batch, so `receipt` is absent and
        # the corrected `sale` bucket is the only entry.
        self.assertEqual([("sale", 10)], [(item.type, item.quantity) for item in result])

    async def test_zero_remaining_omits_the_receipt_entry(self):
        async with self.sessions() as session:
            result = await get_batch_aggregates_domain(
                session, TENANT_A, self.corrected_batch
            )

        self.assertNotIn("receipt", {item.type for item in result})


class DomainTenancyTests(AggregatesTestCase):
    async def test_unknown_batch_raises_batch_not_found(self):
        async with self.sessions() as session:
            with self.assertRaises(BatchNotFoundError):
                await get_batch_aggregates_domain(session, TENANT_A, uuid4())

    async def test_a_foreign_tenants_batch_raises_batch_not_found_not_empty_data(self):
        async with self.sessions() as session:
            with self.assertRaises(BatchNotFoundError):
                await get_batch_aggregates_domain(session, TENANT_A, self.foreign_batch)


# ── HTTP — envelope, auth, tenant-scoped refusal ─────────────────────────────


class AggregatesHttpTests(AggregatesTestCase):
    async def test_missing_authorization_is_refused(self):
        app = self._build_app(authenticated=False)
        client = await self._client(app)

        response = await client.get(f"/api/warehouse/batches/{self.batch}/aggregates")

        self.assertEqual(401, response.status_code, response.text)

    async def test_envelope_carries_type_quantity_uomid_keys(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get(f"/api/warehouse/batches/{self.batch}/aggregates")

        self.assertEqual(200, response.status_code, response.text)
        payload = response.json()["data"]
        self.assertIsInstance(payload, list)
        for row in payload:
            self.assertEqual({"type", "quantity", "uomId"}, set(row.keys()))

    async def test_receipt_row_is_first_over_the_wire(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get(f"/api/warehouse/batches/{self.batch}/aggregates")

        payload = response.json()["data"]
        self.assertEqual("receipt", payload[0]["type"])
        self.assertEqual(42, payload[0]["quantity"])

    async def test_unknown_batch_answers_404_batch_not_found_not_empty_array(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get(f"/api/warehouse/batches/{uuid4()}/aggregates")

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("BATCH_NOT_FOUND", response.json()["detail"]["code"])

    async def test_a_foreign_tenants_batch_answers_404_not_its_data(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get(
            f"/api/warehouse/batches/{self.foreign_batch}/aggregates"
        )

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("BATCH_NOT_FOUND", response.json()["detail"]["code"])


if __name__ == "__main__":
    unittest.main()
