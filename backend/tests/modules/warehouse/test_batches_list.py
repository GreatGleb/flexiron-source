"""Behaviour of `GET /api/warehouse/batches`.

Real request, real query, real (private, temporary) SQLite database — the harness
committed in `test_products_tenancy.py`: only `get_db` and `get_current_user` are
overridden, the router and the `AppError` handler are the product's own. No mocked
session and no hand-picked fake statement evaluator: the repository's actual
`select(...)`/`WHERE`/`ORDER BY`/`LIMIT` runs against real rows, so a mutation that
drops the tenant filter, breaks the `receivedAt DESC` default, or turns the search
into a plain-field match instead of a join with the product catalog reddens these
tests on its own.

    cd backend && python3 -m pytest tests/modules/warehouse/test_batches_list.py -q
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
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/warehouse-batches-list-unused.sqlite"},
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
    # registered on `Base.metadata` to create `warehouse_batches` at all — no
    # route in `app.main` currently pulls the suppliers module in, unlike
    # settings' `uoms`/`currencies`, which `app.main` already registers via its
    # own feature imports.
    import app.modules.suppliers.shared.models  # noqa: F401
    from app.modules.warehouse.features.list_batches.action import (
        router as batches_router,
    )
    from app.modules.warehouse.features.list_batches.domain import (
        list_batches as list_batches_domain,
    )
    from app.modules.warehouse.features.list_batches.repository import (
        count_batches,
        list_batches as list_batches_repo,
    )
    from app.modules.warehouse.shared.models import WarehouseBatch


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


class BatchesListTestCase(unittest.IsolatedAsyncioTestCase):
    """Shared fixture: two tenants, each with a product and batches."""

    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="warehouse-batches-list-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

        self.engine = create_async_engine(
            "sqlite+aiosqlite:///" + str(self.root / "test.sqlite")
        )
        self.addAsyncCleanup(self.engine.dispose)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)

        async with self.engine.begin() as conn:
            for model in (Tenant, Product, WarehouseBatch):
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

            self.older = uuid4()
            self.newer = uuid4()
            self.foreign = uuid4()
            base_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
            await conn.execute(
                insert(WarehouseBatch),
                [
                    {
                        "id": self.older,
                        "tenant_id": TENANT_A,
                        "product_id": self.product_a,
                        "batch_number": "BATCH-001",
                        "lot_code": "LOT-1",
                        "quantity": 100,
                        "quantity_remaining": 100,
                        "unit": "kg",
                        "unit_price": None,
                        "currency": "EUR",
                        "received_at": base_time,
                        "status": "available",
                    },
                    {
                        "id": self.newer,
                        "tenant_id": TENANT_A,
                        "product_id": self.product_a,
                        "batch_number": "BATCH-002",
                        "lot_code": "LOT-2",
                        "quantity": 50,
                        "quantity_remaining": 50,
                        "unit": "kg",
                        "unit_price": 12.5,
                        "currency": "EUR",
                        "received_at": base_time + timedelta(days=10),
                        "status": "available",
                    },
                    {
                        "id": self.foreign,
                        "tenant_id": TENANT_B,
                        "product_id": self.product_b,
                        "batch_number": "FOREIGN-1",
                        "lot_code": "LOT-F",
                        "quantity": 10,
                        "quantity_remaining": 10,
                        "unit": "kg",
                        "unit_price": 1,
                        "currency": "EUR",
                        "received_at": base_time,
                        "status": "available",
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


# ── Repository — tenant scoping, ordering, uom filter, price ───────────────────


class RepositoryTenancyTests(BatchesListTestCase):
    """Mutation target: drop `WarehouseBatch.tenant_id == tenant_id` from the query."""

    async def test_a_foreign_tenants_batch_is_absent_from_the_list(self):
        async with self.sessions() as session:
            items = await list_batches_repo(session, TENANT_A)

        self.assertEqual({self.older, self.newer}, {item.id for item in items})
        self.assertNotIn(self.foreign, {item.id for item in items})

    async def test_count_is_scoped_to_the_caller_tenant_too(self):
        async with self.sessions() as session:
            total = await count_batches(session, TENANT_A)

        self.assertEqual(2, total)


class DefaultOrderingTests(BatchesListTestCase):
    """Contract default: `receivedAt DESC` when no `sortBy`/`sortDir` is given."""

    async def test_default_order_is_received_at_descending(self):
        async with self.sessions() as session:
            items = await list_batches_repo(session, TENANT_A)

        self.assertEqual([self.newer, self.older], [item.id for item in items])

    async def test_domain_default_matches_the_repository_default(self):
        async with self.sessions() as session:
            result = await list_batches_domain(
                session,
                TENANT_A,
                search=None,
                page=1,
                page_size=25,
                product_id=None,
                supplier_id=None,
                status=None,
                uom_id=None,
                date_from=None,
                date_to=None,
                sort_by=None,
                sort_dir=None,
            )

        self.assertEqual(
            [self.newer, self.older], [item.id for item in result.items]
        )


class UnpricedBatchTests(BatchesListTestCase):
    async def test_a_batch_nobody_priced_reports_a_null_price_not_zero(self):
        async with self.sessions() as session:
            result = await list_batches_domain(
                session,
                TENANT_A,
                search=None,
                page=1,
                page_size=25,
                product_id=None,
                supplier_id=None,
                status=None,
                uom_id=None,
                date_from=None,
                date_to=None,
                sort_by=None,
                sort_dir=None,
            )

        by_id = {item.id: item for item in result.items}
        self.assertIsNone(by_id[self.older].unitPrice)
        self.assertEqual(12.5, by_id[self.newer].unitPrice)


class SearchByProductNameTests(BatchesListTestCase):
    """The batch record has no product-name field of its own — the contract
    requires the catalog to be consulted, not a field read off the batch."""

    async def test_search_finds_a_batch_by_its_own_product_name(self):
        async with self.sessions() as session:
            result = await list_batches_domain(
                session,
                TENANT_A,
                search="steel",
                page=1,
                page_size=25,
                product_id=None,
                supplier_id=None,
                status=None,
                uom_id=None,
                date_from=None,
                date_to=None,
                sort_by=None,
                sort_dir=None,
            )

        self.assertEqual(
            {self.older, self.newer}, {item.id for item in result.items}
        )

    async def test_search_still_matches_by_batch_number(self):
        async with self.sessions() as session:
            result = await list_batches_domain(
                session,
                TENANT_A,
                search="batch-002",
                page=1,
                page_size=25,
                product_id=None,
                supplier_id=None,
                status=None,
                uom_id=None,
                date_from=None,
                date_to=None,
                sort_by=None,
                sort_dir=None,
            )

        self.assertEqual([self.newer], [item.id for item in result.items])

    async def test_a_foreign_tenants_product_name_does_not_leak_the_match(self):
        """Product-name search must not cross tenants either: tenant A's search
        for tenant B's product name must not surface tenant B's batch."""
        async with self.sessions() as session:
            result = await list_batches_domain(
                session,
                TENANT_A,
                search="copper",
                page=1,
                page_size=25,
                product_id=None,
                supplier_id=None,
                status=None,
                uom_id=None,
                date_from=None,
                date_to=None,
                sort_by=None,
                sort_dir=None,
            )

        self.assertEqual([], result.items)

    async def test_a_product_name_search_that_matches_nothing_returns_empty(self):
        async with self.sessions() as session:
            result = await list_batches_domain(
                session,
                TENANT_A,
                search="does-not-exist-anywhere",
                page=1,
                page_size=25,
                product_id=None,
                supplier_id=None,
                status=None,
                uom_id=None,
                date_from=None,
                date_to=None,
                sort_by=None,
                sort_dir=None,
            )

        self.assertEqual([], result.items)


# ── HTTP — auth, envelope, tenant scoping over the wire ─────────────────────────


class BatchesHttpTests(BatchesListTestCase):
    async def test_missing_authorization_is_refused(self):
        app = self._build_app(authenticated=False)
        client = await self._client(app)

        response = await client.get("/api/warehouse/batches")

        self.assertEqual(401, response.status_code, response.text)

    async def test_list_envelope_carries_pagination_keys(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get("/api/warehouse/batches")

        self.assertEqual(200, response.status_code, response.text)
        payload = response.json()["data"]
        self.assertEqual(
            {"items", "total", "page", "pageSize", "totalPages"}, set(payload.keys())
        )
        self.assertEqual(2, payload["total"])

    async def test_a_foreign_tenants_batch_is_invisible_over_http(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get("/api/warehouse/batches")

        ids = {item["id"] for item in response.json()["data"]["items"]}
        self.assertNotIn(str(self.foreign), ids)

    async def test_list_item_carries_exactly_the_twelve_contract_fields(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get("/api/warehouse/batches")

        item = response.json()["data"]["items"][0]
        self.assertEqual(
            {
                "id", "productId", "batchNumber", "lotCode", "quantity",
                "quantityRemaining", "uomId", "unitPrice", "currency",
                "receivedAt", "status", "orderId",
            },
            set(item.keys()),
        )

    async def test_no_product_or_supplier_name_in_the_list_item(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get("/api/warehouse/batches")

        item = response.json()["data"]["items"][0]
        self.assertNotIn("productName", item)
        self.assertNotIn("supplierName", item)

    async def test_search_by_product_name_works_over_http(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get(
            "/api/warehouse/batches", params={"search": "steel"}
        )

        self.assertEqual(200, response.status_code, response.text)
        self.assertEqual(2, response.json()["data"]["total"])

    async def test_oversized_page_size_is_rejected_at_the_route(self):
        app = self._build_app(tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.get(
            "/api/warehouse/batches", params={"pageSize": 1000}
        )

        self.assertEqual(422, response.status_code, response.text)


if __name__ == "__main__":
    unittest.main()
