"""Behaviour of `GET /api/products`, `GET /api/products/list`, and the two card
fixes the latter travelled with.

`GET /api/products` is the paginated catalog — tenant-scoped from the token,
searchable by `sku` and `name` (never `description`), filterable by
`categoryIds`, and optionally sorted by `name`/`category`/`price`. Without
`sortBy` the order is not imposed at all (contract "GET /api/products",
domain rule 7).

`GET /api/products/list` is a lightweight id+name catalog reference, tenant-scoped from
the token, with no parameters and no pagination. It shares its module with two standing
defects in `get_product_detail`: `field_name` was a placeholder (`str(fv.field_id)`)
instead of the real `category_fields.name`, and `float(x) if x else None` turned a
genuine `0` (price, min stock, a conversion factor) into `null`.

The harness is the one committed in `test_products_tenancy.py`: a private temporary
SQLite database, the real routers over ASGI, real Bearer authentication; only `get_db`
is replaced, and the error handler is the product's own `app_error_handler` imported
from `app.main`. No Postgres and no Alembic; fixtures create only the tables the two
routes touch.
"""

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import insert
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles, deregister
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/products-catalog-unused.sqlite"},
):
    from app.core.database import get_db
    from app.core.exceptions import AppError
    from app.main import app as main_app
    from app.main import app_error_handler
    from app.modules.auth.shared.models import Tenant, User
    from app.modules.auth.shared.session_tokens import issue_session_token
    from app.modules.products.features.get_product_detail.action import (
        router as get_product_detail_router,
    )
    from app.modules.products.features.list_products.action import (
        router as list_products_router,
    )
    from app.modules.products.features.list_products.domain import (
        MAX_PAGE_SIZE,
        list_products_catalog,
    )
    from app.modules.products.shared.models import (
        Category,
        CategoryField,
        Product,
        ProductFieldValue,
    )


class ProductsCatalogRouteOrderTests(unittest.TestCase):
    """The assembled app must resolve `/list` before `/{product_id}` catches it."""

    def test_list_route_is_declared_before_the_detail_route(self):
        paths = list(main_app.openapi()["paths"].keys())

        list_index = paths.index("/api/products/list")
        detail_index = paths.index("/api/products/{product_id}")

        self.assertLess(
            list_index,
            detail_index,
            "GET /api/products/list must be registered before GET /api/products/{product_id}, "
            "otherwise the UUID-typed detail route captures the /list segment first",
        )


class ProductsCatalogTests(unittest.IsolatedAsyncioTestCase):
    """Catalog reference and card fixes, exercised through real HTTP requests."""

    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="products-catalog-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

        # SQLite has no JSONB: compile it as plain JSON for the test database only.
        @compiles(JSONB, "sqlite")
        def sqlite_jsonb(type_, compiler, **kw):
            return "JSON"

        self.addCleanup(deregister, JSONB)
        self.engine = create_async_engine(
            "sqlite+aiosqlite:///" + str(self.root / "test.sqlite")
        )
        self.addAsyncCleanup(self.engine.dispose)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)

        self.tenant_a, self.tenant_b = uuid4(), uuid4()
        self.user_a = uuid4()

        self.category_a = uuid4()
        self.category_a2 = uuid4()  # second category of tenant A — for the "excluded by filter" case
        self.field_owned = uuid4()  # tenant A's own field definition
        self.field_foreign = uuid4()  # field id referenced by A's product, defined only for B
        self.category_b = uuid4()

        # Three products for tenant A, deliberately out of name order, plus a tied
        # pair to prove the id tie-break; one product for tenant B that must never
        # show up in A's catalog.
        self.product_charlie = uuid4()
        self.product_alpha = uuid4()
        self.product_same_1 = uuid4()
        self.product_same_2 = uuid4()
        self.product_b = uuid4()

        # Fixtures for GET /api/products (paginated catalog). Names, in
        # insertion order, are the exact reverse of their alphabetical order,
        # so "default order" and "sortBy=name" are never accidentally equal:
        # insertion order Widget → GizmoNameToken → Doohickey; prices
        # 30/10/20 give a third, independent ordering for sortBy=price.
        # `-ORD` in every sku isolates these three from the rest of the
        # tenant's catalog via `search`, without depending on their count.
        self.product_widget = uuid4()  # sku match only; category_a; description carries an
        self.product_gizmo = uuid4()  # unsearchable word to prove description is not searched
        self.product_doohickey = uuid4()  # name match only; category_a2 (excluded by category_a filter)

        async with self.engine.begin() as conn:
            for model in (Tenant, User, Category, CategoryField, Product, ProductFieldValue):
                await conn.run_sync(
                    lambda sync, model=model: model.__table__.create(sync)
                )

            await conn.execute(
                insert(Tenant),
                [
                    {"id": self.tenant_a, "name": "A", "slug": "a"},
                    {"id": self.tenant_b, "name": "B", "slug": "b"},
                ],
            )
            await conn.execute(
                insert(User),
                [
                    {
                        "id": self.user_a,
                        "tenant_id": self.tenant_a,
                        "email": "a@example.test",
                        "first_name": "A",
                        "last_name": "User",
                        "password_hash": "fixture",
                        "secret_link_token": "secret-a",
                    }
                ],
            )
            await conn.execute(
                insert(Category),
                [
                    {
                        "id": self.category_a,
                        "tenant_id": self.tenant_a,
                        "name_translations": {"en": "A cat"},
                    },
                    {
                        "id": self.category_a2,
                        "tenant_id": self.tenant_a,
                        "name_translations": {"en": "A cat 2"},
                    },
                    {
                        "id": self.category_b,
                        "tenant_id": self.tenant_b,
                        "name_translations": {"en": "B cat"},
                    },
                ],
            )
            await conn.execute(
                insert(CategoryField),
                [
                    {
                        "id": self.field_owned,
                        "tenant_id": self.tenant_a,
                        "category_id": self.category_a,
                        "name_translations": {"en": "Color"},
                        "field_type": "text",
                    },
                    {
                        "id": self.field_foreign,
                        "tenant_id": self.tenant_b,
                        "category_id": self.category_b,
                        "name_translations": {"en": "Foreign field"},
                        "field_type": "text",
                    },
                ],
            )
            await conn.execute(
                insert(Product),
                [
                    {
                        "id": self.product_charlie,
                        "tenant_id": self.tenant_a,
                        "name": "Charlie",
                        "sku": None,
                        "description": None,
                        "category_id": None,
                        "price": 0,
                        "min_stock": 0,
                        "purchase_to_warehouse_factor": 0,
                    },
                    {
                        "id": self.product_alpha,
                        "tenant_id": self.tenant_a,
                        "name": "Alpha",
                        "sku": None,
                        "description": None,
                        "category_id": None,
                        "price": None,
                        "min_stock": None,
                        "purchase_to_warehouse_factor": None,
                    },
                    {
                        "id": self.product_same_2,
                        "tenant_id": self.tenant_a,
                        "name": "Same",
                        "sku": None,
                        "description": None,
                        "category_id": None,
                        "price": None,
                        "min_stock": None,
                        "purchase_to_warehouse_factor": None,
                    },
                    {
                        "id": self.product_same_1,
                        "tenant_id": self.tenant_a,
                        "name": "Same",
                        "sku": None,
                        "description": None,
                        "category_id": None,
                        "price": None,
                        "min_stock": None,
                        "purchase_to_warehouse_factor": None,
                    },
                    {
                        "id": self.product_b,
                        "tenant_id": self.tenant_b,
                        "name": "B's product",
                        "sku": None,
                        "description": None,
                        "category_id": None,
                        "price": None,
                        "min_stock": None,
                        "purchase_to_warehouse_factor": None,
                    },
                    {
                        "id": self.product_widget,
                        "tenant_id": self.tenant_a,
                        "name": "Widget",
                        "sku": "WID-UNIQUE-ORD",
                        "description": "mentions zzzdescriptionword nowhere else",
                        "category_id": self.category_a,
                        "price": 30,
                        "min_stock": None,
                        "purchase_to_warehouse_factor": None,
                    },
                    {
                        "id": self.product_gizmo,
                        "tenant_id": self.tenant_a,
                        "name": "GizmoNameToken-ORD",
                        "sku": "GIZ-999",
                        "description": None,
                        "category_id": None,
                        "price": 10,
                        "min_stock": None,
                        "purchase_to_warehouse_factor": None,
                    },
                    {
                        "id": self.product_doohickey,
                        "tenant_id": self.tenant_a,
                        "name": "Doohickey-ORD",
                        "sku": "DOO-1",
                        "description": None,
                        "category_id": self.category_a2,
                        "price": 20,
                        "min_stock": None,
                        "purchase_to_warehouse_factor": None,
                    },
                ],
            )
            # The zero-priced product carries two field values: one whose definition
            # belongs to its own tenant (real name expected), one whose definition
            # only exists for a foreign tenant (empty name expected, value kept).
            await conn.execute(
                insert(ProductFieldValue),
                [
                    {
                        "id": uuid4(),
                        "tenant_id": self.tenant_a,
                        "product_id": self.product_charlie,
                        "field_id": self.field_owned,
                        "value": "Red",
                    },
                    {
                        "id": uuid4(),
                        "tenant_id": self.tenant_a,
                        "product_id": self.product_charlie,
                        "field_id": self.field_foreign,
                        "value": "Ghost",
                    },
                ],
            )

        self.app = FastAPI()
        self.app.add_exception_handler(AppError, app_error_handler)
        self.app.include_router(list_products_router)
        self.app.include_router(get_product_detail_router)

        async def isolated_db():
            async with self.sessions() as session:
                try:
                    yield session
                    await session.commit()
                except Exception:
                    await session.rollback()
                    raise

        self.app.dependency_overrides[get_db] = isolated_db
        self.client = AsyncClient(
            transport=ASGITransport(app=self.app, raise_app_exceptions=False),
            base_url="http://test",
        )
        self.addAsyncCleanup(self.client.aclose)
        self.token_a = issue_session_token(self.user_a)

    @property
    def auth_a(self) -> dict:
        return {"Authorization": f"Bearer {self.token_a}"}

    # ── GET /api/products/list ───────────────────────────────────────────────

    async def test_missing_authorization_is_refused(self):
        response = await self.client.get("/api/products/list")

        self.assertEqual(401, response.status_code, response.text)

    async def test_catalog_contains_only_the_caller_s_tenant_products(self):
        response = await self.client.get("/api/products/list", headers=self.auth_a)

        self.assertEqual(200, response.status_code, response.text)
        ids = {item["id"] for item in response.json()["data"]}

        self.assertIn(str(self.product_alpha), ids)
        self.assertNotIn(str(self.product_b), ids)

    async def test_catalog_items_expose_only_id_and_name(self):
        response = await self.client.get("/api/products/list", headers=self.auth_a)

        item = response.json()["data"][0]
        self.assertEqual({"id", "name"}, set(item.keys()))

    async def test_catalog_order_is_deterministic_by_name_then_id(self):
        response = await self.client.get("/api/products/list", headers=self.auth_a)

        names_and_ids = [(item["name"], item["id"]) for item in response.json()["data"]]
        expected = sorted(names_and_ids, key=lambda pair: (pair[0], pair[1]))

        self.assertEqual(expected, names_and_ids)
        # The tied pair ("Same", "Same") must come out ordered by id, not insertion order.
        same_entries = [entry for entry in names_and_ids if entry[0] == "Same"]
        self.assertEqual(
            sorted(str(pid) for pid in (self.product_same_1, self.product_same_2)),
            [entry[1] for entry in same_entries],
        )

    # ── GET /api/products — paginated catalog ────────────────────────────────

    async def test_paginated_catalog_missing_authorization_is_refused(self):
        response = await self.client.get("/api/products")

        self.assertEqual(401, response.status_code, response.text)

    async def test_paginated_catalog_contains_only_the_caller_s_tenant_products(self):
        """Also the mutation guard: drop `Product.tenant_id == tenant_id` from
        `_catalog_query` in `repository.py` and `self.product_b` leaks in here."""
        response = await self.client.get(
            "/api/products", headers=self.auth_a, params={"pageSize": 100}
        )

        self.assertEqual(200, response.status_code, response.text)
        data = response.json()["data"]
        ids = {item["id"] for item in data["items"]}

        self.assertIn(str(self.product_widget), ids)
        self.assertNotIn(str(self.product_b), ids)

    async def test_search_matches_sku(self):
        response = await self.client.get(
            "/api/products", headers=self.auth_a, params={"search": "WID-UNIQUE"}
        )

        ids = {item["id"] for item in response.json()["data"]["items"]}
        self.assertEqual({str(self.product_widget)}, ids)

    async def test_search_matches_name(self):
        response = await self.client.get(
            "/api/products", headers=self.auth_a, params={"search": "GizmoNameToken"}
        )

        ids = {item["id"] for item in response.json()["data"]["items"]}
        self.assertEqual({str(self.product_gizmo)}, ids)

    async def test_search_does_not_match_description(self):
        response = await self.client.get(
            "/api/products",
            headers=self.auth_a,
            params={"search": "zzzdescriptionword"},
        )

        data = response.json()["data"]
        self.assertEqual(0, data["total"])
        self.assertEqual([], data["items"])

    async def test_category_filter_excludes_other_category_and_uncategorized(self):
        response = await self.client.get(
            "/api/products",
            headers=self.auth_a,
            params={"search": "-ORD", "categoryIds": str(self.category_a)},
        )

        ids = {item["id"] for item in response.json()["data"]["items"]}
        # product_gizmo has no category at all; product_doohickey belongs to
        # category_a2 — both must be excluded by a filter naming category_a.
        self.assertEqual({str(self.product_widget)}, ids)

    async def test_category_response_field_carries_translations(self):
        response = await self.client.get(
            "/api/products", headers=self.auth_a, params={"search": "WID-UNIQUE"}
        )

        item = response.json()["data"]["items"][0]
        self.assertEqual(str(self.category_a), item["categoryId"])
        self.assertEqual({"ru": "", "en": "A cat", "lt": ""}, item["categoryName"])

    async def test_uncategorized_product_reports_null_category(self):
        response = await self.client.get(
            "/api/products", headers=self.auth_a, params={"search": "GizmoNameToken"}
        )

        item = response.json()["data"]["items"][0]
        self.assertIsNone(item["categoryId"])
        self.assertIsNone(item["categoryName"])

    async def test_default_order_is_not_imposed(self):
        """No `sortBy` — the three fixtures come back in the order they were
        inserted (Widget, Gizmo, Doohickey), not name-ascending
        (Doohickey, Gizmo, Widget) and not price-descending either."""
        response = await self.client.get(
            "/api/products", headers=self.auth_a, params={"search": "-ORD"}
        )

        ids = [item["id"] for item in response.json()["data"]["items"]]
        self.assertEqual(
            [str(self.product_widget), str(self.product_gizmo), str(self.product_doohickey)],
            ids,
        )

    async def test_sort_by_name_ascending(self):
        response = await self.client.get(
            "/api/products",
            headers=self.auth_a,
            params={"search": "-ORD", "sortBy": "name", "sortDir": "asc"},
        )

        ids = [item["id"] for item in response.json()["data"]["items"]]
        self.assertEqual(
            [str(self.product_doohickey), str(self.product_gizmo), str(self.product_widget)],
            ids,
        )

    async def test_sort_by_price_descending_changes_the_order(self):
        response = await self.client.get(
            "/api/products",
            headers=self.auth_a,
            params={"search": "-ORD", "sortBy": "price", "sortDir": "desc"},
        )

        ids = [item["id"] for item in response.json()["data"]["items"]]
        self.assertEqual(
            [str(self.product_widget), str(self.product_doohickey), str(self.product_gizmo)],
            ids,
        )

    async def test_page_beyond_total_is_empty_but_total_is_unchanged(self):
        first = await self.client.get(
            "/api/products", headers=self.auth_a, params={"pageSize": 100}
        )
        total = first.json()["data"]["total"]

        response = await self.client.get(
            "/api/products", headers=self.auth_a, params={"page": 9999, "pageSize": 100}
        )

        data = response.json()["data"]
        self.assertEqual([], data["items"])
        self.assertEqual(total, data["total"])

    async def test_oversized_page_size_is_rejected_at_the_route(self):
        """`Query(..., le=100)` refuses before the domain ever runs — the same
        boundary `finance/payments` already enforces on its own `pageSize`."""
        response = await self.client.get(
            "/api/products", headers=self.auth_a, params={"pageSize": 1000}
        )

        self.assertEqual(422, response.status_code, response.text)

    async def test_page_size_is_capped_in_the_domain(self):
        """Mutation target: remove `min(page_size, MAX_PAGE_SIZE)` in
        `domain.list_products_catalog`. Called directly, bypassing the route's
        own `le=100` Query bound, so this guards the domain's own clamp."""
        async with self.sessions() as session:
            result = await list_products_catalog(
                session,
                self.tenant_a,
                search=None,
                category_ids_raw=None,
                sort_by=None,
                sort_dir="asc",
                page=1,
                page_size=99999,
            )

        self.assertEqual(MAX_PAGE_SIZE, result.pageSize)
        self.assertLessEqual(len(result.items), MAX_PAGE_SIZE)

    # ── GET /api/products/:id — field names ──────────────────────────────────

    async def test_card_resolves_real_field_names(self):
        response = await self.client.get(
            f"/api/products/{self.product_charlie}", headers=self.auth_a
        )

        self.assertEqual(200, response.status_code, response.text)
        by_field_id = {
            fv["field_id"]: fv["field_name"]
            for fv in response.json()["data"]["field_values"]
        }

        # `field_name` travels on the wire as a translated-string object — the
        # locale-keyed dict, not a bare string — matching the domain's
        # `name_translations` storage (types/category.ts expects the same shape).
        self.assertEqual(
            {"ru": "", "en": "Color", "lt": ""}, by_field_id[str(self.field_owned)]
        )

    async def test_card_field_value_without_a_tenant_definition_keeps_the_value(self):
        response = await self.client.get(
            f"/api/products/{self.product_charlie}", headers=self.auth_a
        )

        field_values = response.json()["data"]["field_values"]
        foreign_entry = next(
            fv for fv in field_values if fv["field_id"] == str(self.field_foreign)
        )

        self.assertEqual({"ru": "", "en": "", "lt": ""}, foreign_entry["field_name"])
        self.assertEqual("Ghost", foreign_entry["value"])

    # ── GET /api/products/:id — zero is not null ─────────────────────────────

    async def test_card_reports_zero_price_min_stock_and_factor_as_zero(self):
        response = await self.client.get(
            f"/api/products/{self.product_charlie}", headers=self.auth_a
        )

        data = response.json()["data"]
        self.assertEqual(0, data["price"])
        self.assertEqual(0, data["min_stock"])
        self.assertEqual(0, data["purchase_to_warehouse_factor"])


if __name__ == "__main__":
    unittest.main()
