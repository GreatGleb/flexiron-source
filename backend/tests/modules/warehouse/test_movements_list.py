"""Behaviour of `GET /api/warehouse/movements`.

Real request, real query, real (private, temporary) SQLite database — the harness
committed in `test_products_tenancy.py` and already reused by
`test_batches_list.py`: only `get_db` and `get_current_user` are overridden, the
router and the `AppError` handler are the product's own. No mocked session and no
hand-picked fake statement evaluator: the repository's actual
`select(...)`/`JOIN`/`WHERE`/`ORDER BY`/`LIMIT` runs against real rows, so a
mutation that drops the tenant filter or breaks the `movedAt DESC` default
reddens these tests on its own.

    cd backend && python3 -m pytest tests/modules/warehouse/test_movements_list.py -q
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
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/warehouse-movements-list-unused.sqlite"},
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

    # Imported for its side effect only: `WarehouseBatch.supplier_id` carries a
    # `ForeignKey("suppliers.id")`, and SQLite's DDL compiler needs that table
    # registered on `Base.metadata` to create `warehouse_batches` at all —
    # mirrors `test_batches_list.py`.
    import app.modules.suppliers.shared.models  # noqa: F401
    from app.modules.warehouse.features.list_movements.action import (
        router as movements_router,
    )
    from app.modules.warehouse.features.list_movements.domain import (
        list_movements as list_movements_domain,
    )
    from app.modules.warehouse.features.list_movements.repository import (
        count_movements,
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


class MovementsListTestCase(unittest.IsolatedAsyncioTestCase):
    """Shared fixture: two tenants, each with a product, a batch and movements."""

    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="warehouse-movements-list-")
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

            self.batch_a = uuid4()
            self.batch_b_foreign = uuid4()
            await conn.execute(
                insert(WarehouseBatch),
                [
                    {
                        "id": self.batch_a,
                        "tenant_id": TENANT_A,
                        "product_id": self.product_a,
                        "batch_number": "BATCH-001",
                        "quantity": 100,
                        "quantity_remaining": 40,
                        "unit": "kg",
                        "currency": "EUR",
                        "status": "available",
                    },
                    {
                        "id": self.batch_b_foreign,
                        "tenant_id": TENANT_B,
                        "product_id": self.product_b,
                        "batch_number": "FOREIGN-1",
                        "quantity": 10,
                        "quantity_remaining": 10,
                        "unit": "kg",
                        "currency": "USD",
                        "status": "available",
                    },
                ],
            )

            self.older = uuid4()
            self.newer = uuid4()
            self.unpriced = uuid4()
            self.foreign = uuid4()
            self.cross_tenant_leak = uuid4()
            base_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
            await conn.execute(
                insert(WarehouseMovement),
                [
                    {
                        "id": self.older,
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
                        "id": self.newer,
                        "tenant_id": TENANT_A,
                        "batch_id": self.batch_a,
                        "type": "sale",
                        "quantity": 20,
                        "unit": "kg",
                        "unit_price": 15.0,
                        "reference_id": "order-1",
                        "reference_type": "order-shipment",
                        "notes": "sold",
                        "moved_at": base_time + timedelta(days=10),
                    },
                    {
                        "id": self.unpriced,
                        "tenant_id": TENANT_A,
                        "batch_id": self.batch_a,
                        "type": "transfer",
                        "quantity": 5,
                        "unit": "kg",
                        "unit_price": None,
                        "reference_id": None,
                        "reference_type": None,
                        "notes": None,
                        "moved_at": base_time + timedelta(days=5),
                    },
                    {
                        "id": self.foreign,
                        "tenant_id": TENANT_B,
                        "batch_id": self.batch_b_foreign,
                        "type": "receipt",
                        "quantity": 10,
                        "unit": "kg",
                        "unit_price": 1.0,
                        "reference_id": None,
                        "reference_type": None,
                        "notes": None,
                        "moved_at": base_time,
                    },
                    # `tenant_id` claims B while `batch_id` points at A's own
                    # batch — a row the batch JOIN's own tenant scoping alone
                    # would let through. Only a `WHERE WarehouseMovement.tenant_id
                    # == tenant_id` catches it; this is what makes the tenant
                    # mutation test below fail if that clause is dropped.
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


# ── Repository — tenant scoping, ordering, joined fields, price ────────────────


class RepositoryTenancyTests(MovementsListTestCase):
    """Mutation target: drop `WarehouseMovement.tenant_id == tenant_id` from the query."""

    async def test_a_foreign_tenants_movement_is_absent_from_the_list(self):
        async with self.sessions() as session:
            rows = await list_movements_repo(session, TENANT_A)

        ids = {row[0].id for row in rows}
        self.assertEqual({self.older, self.newer, self.unpriced}, ids)
        self.assertNotIn(self.foreign, ids)

    async def test_count_is_scoped_to_the_caller_tenant_too(self):
        async with self.sessions() as session:
            total = await count_movements(session, TENANT_A)

        self.assertEqual(3, total)

    async def test_a_movement_whose_own_tenant_id_disagrees_with_its_batch_is_excluded(self):
        """`cross_tenant_leak` has `tenant_id=TENANT_B` but points at tenant A's
        own batch — the batch JOIN's tenant scoping alone would let it through
        for a tenant-A request, so this only passes while the top-level
        `WarehouseMovement.tenant_id` filter is intact."""
        async with self.sessions() as session:
            ids_for_a = {row[0].id for row in await list_movements_repo(session, TENANT_A)}

        self.assertNotIn(self.cross_tenant_leak, ids_for_a)


class DefaultOrderingTests(MovementsListTestCase):
    """Contract default: `movedAt DESC` when no `sortBy`/`sortDir` is given.

    Mutation target: flip the default sort direction to ascending.
    """

    async def test_default_order_is_moved_at_descending(self):
        async with self.sessions() as session:
            rows = await list_movements_repo(session, TENANT_A)

        self.assertEqual(
            [self.newer, self.unpriced, self.older], [row[0].id for row in rows]
        )

    async def test_domain_default_matches_the_repository_default(self):
        async with self.sessions() as session:
            result = await list_movements_domain(
                session,
                TENANT_A,
                search=None,
                page=1,
                page_size=25,
                type=None,
                product_id=None,
                uom_id=None,
                reference_id=None,
                offcut_id=None,
                batch_number=None,
                date_from=None,
                date_to=None,
                sort_by=None,
                sort_dir=None,
            )

        self.assertEqual(
            [self.newer, self.unpriced, self.older],
            [item.id for item in result.items],
        )


class JoinedFieldsTests(MovementsListTestCase):
    """`batchNumber`, `productId` and `currency` are not movement columns — they
    are read off the joined batch."""

    async def test_list_item_carries_its_batchs_joined_fields(self):
        async with self.sessions() as session:
            result = await list_movements_domain(
                session,
                TENANT_A,
                search=None,
                page=1,
                page_size=25,
                type=None,
                product_id=None,
                uom_id=None,
                reference_id=None,
                offcut_id=None,
                batch_number=None,
                date_from=None,
                date_to=None,
                sort_by=None,
                sort_dir=None,
            )

        by_id = {item.id: item for item in result.items}
        for item in by_id.values():
            self.assertEqual("BATCH-001", item.batchNumber)
            self.assertEqual(self.product_a, item.productId)
            self.assertEqual("EUR", item.currency)


class UnpricedMovementTests(MovementsListTestCase):
    async def test_a_movement_of_an_unpriced_batch_reports_a_null_price_not_zero(self):
        async with self.sessions() as session:
            result = await list_movements_domain(
                session,
                TENANT_A,
                search=None,
                page=1,
                page_size=25,
                type=None,
                product_id=None,
                uom_id=None,
                reference_id=None,
                offcut_id=None,
                batch_number=None,
                date_from=None,
                date_to=None,
                sort_by=None,
                sort_dir=None,
            )

        by_id = {item.id: item for item in result.items}
        self.assertIsNone(by_id[self.unpriced].unitPrice)
        self.assertEqual(12.5, by_id[self.older].unitPrice)
        self.assertEqual(15.0, by_id[self.newer].unitPrice)


class SearchByProductNameTests(MovementsListTestCase):
    """The movement record has no product-name field of its own — the contract
    requires the catalog to be consulted through the batch, not a field read
    off the movement itself."""

    async def test_search_finds_a_movement_by_its_batchs_product_name(self):
        async with self.sessions() as session:
            result = await list_movements_domain(
                session,
                TENANT_A,
                search="steel",
                page=1,
                page_size=25,
                type=None,
                product_id=None,
                uom_id=None,
                reference_id=None,
                offcut_id=None,
                batch_number=None,
                date_from=None,
                date_to=None,
                sort_by=None,
                sort_dir=None,
            )

        self.assertEqual(3, result.total)

    async def test_search_still_matches_by_batch_number(self):
        async with self.sessions() as session:
            result = await list_movements_domain(
                session,
                TENANT_A,
                search="batch-001",
                page=1,
                page_size=25,
                type=None,
                product_id=None,
                uom_id=None,
                reference_id=None,
                offcut_id=None,
                batch_number=None,
                date_from=None,
                date_to=None,
                sort_by=None,
                sort_dir=None,
            )

        self.assertEqual(3, result.total)

    async def test_a_foreign_tenants_product_name_does_not_leak_the_match(self):
        async with self.sessions() as session:
            result = await list_movements_domain(
                session,
                TENANT_A,
                search="copper",
                page=1,
                page_size=25,
                type=None,
                product_id=None,
                uom_id=None,
                reference_id=None,
                offcut_id=None,
                batch_number=None,
                date_from=None,
                date_to=None,
                sort_by=None,
                sort_dir=None,
            )

        self.assertEqual([], result.items)


# ── HTTP — auth, envelope, tenant scoping over the wire ─────────────────────────


class MovementsHttpTests(MovementsListTestCase):
    async def test_missing_authorization_is_refused(self):
        app = self._build_app(authenticated=False)
        client = await self._client(app)

        response = await client.get("/api/warehouse/movements")

        self.assertEqual(401, response.status_code, response.text)

    async def test_list_envelope_carries_pagination_keys(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get("/api/warehouse/movements")

        self.assertEqual(200, response.status_code, response.text)
        payload = response.json()["data"]
        self.assertEqual(
            {"items", "total", "page", "pageSize", "totalPages"}, set(payload.keys())
        )
        self.assertEqual(3, payload["total"])

    async def test_a_foreign_tenants_movement_is_invisible_over_http(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get("/api/warehouse/movements")

        ids = {item["id"] for item in response.json()["data"]["items"]}
        self.assertNotIn(str(self.foreign), ids)

    async def test_list_item_carries_exactly_the_fourteen_contract_fields(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get("/api/warehouse/movements")

        item = response.json()["data"]["items"][0]
        self.assertEqual(
            {
                "id", "type", "batchId", "batchNumber", "offcutId", "productId",
                "quantity", "uomId", "unitPrice", "referenceId", "referenceType",
                "notes", "movedAt", "currency",
            },
            set(item.keys()),
        )

    async def test_no_excluded_fields_leak_into_the_list_item(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get("/api/warehouse/movements")

        item = response.json()["data"]["items"][0]
        for excluded in (
            "totalCost", "fromLocation", "toLocation", "performedBy",
            "createdAt", "auditLog",
        ):
            self.assertNotIn(excluded, item)

    async def test_search_by_product_name_works_over_http(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get(
            "/api/warehouse/movements", params={"search": "steel"}
        )

        self.assertEqual(200, response.status_code, response.text)
        self.assertEqual(3, response.json()["data"]["total"])

    async def test_oversized_page_size_is_rejected_at_the_route(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get(
            "/api/warehouse/movements", params={"pageSize": 1000}
        )

        self.assertEqual(422, response.status_code, response.text)


if __name__ == "__main__":
    unittest.main()
