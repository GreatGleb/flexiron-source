"""Behaviour of `GET /api/categories`.

The harness is the one committed in `test_clients_read.py`, plus the JSONB→JSON
compile shim from `test_products_tenancy.py`: SQLite has no JSONB, and `Category`
carries `name_translations` as one. A private temporary SQLite database, the real
router over ASGI, real Bearer authentication; only `get_db` is replaced, and the
error handler is the product's own `app_error_handler` imported from `app.main`.
No Postgres and no Alembic; fixtures create only the tables the route touches.

    cd backend && python3 -m pytest tests/modules/products/test_categories_list.py -q
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
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles, deregister

with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/categories-list-unused.sqlite"},
):
    from app.core.database import get_db
    from app.core.exceptions import AppError
    from app.main import app_error_handler
    from app.modules.auth.shared.models import Tenant, User
    from app.modules.auth.shared.session_tokens import issue_session_token
    from app.modules.products.features.list_categories.action import (
        router as categories_list_router,
    )
    from app.modules.products.shared.models import Category, CategoryField, Product


class CategoriesListTests(unittest.IsolatedAsyncioTestCase):
    """List slice — tree order, search, tenancy, computed columns."""

    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="categories-list-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

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

        # A three-level tree under tenant A:
        #   Beta (root)
        #     Alpha Child (child of Beta)
        #       Grandchild (child of Alpha Child)
        #   Zeta (root, sorts after Beta by name.en)
        self.cat_beta = uuid4()
        self.cat_alpha_child = uuid4()
        self.cat_grandchild = uuid4()
        self.cat_zeta = uuid4()
        # Own fields and lying stored columns for the mutation-guard test.
        self.cat_with_fields = uuid4()
        self.field_1 = uuid4()
        self.field_2 = uuid4()
        # Findable only through its Lithuanian name — proves the 3-locale search.
        self.cat_lt_only = uuid4()
        # Its description contains the needle "onlyindescription" — must NOT match.
        self.cat_desc_only = uuid4()
        # Belongs to tenant B — must never surface for tenant A.
        self.cat_b = uuid4()

        async with self.engine.begin() as conn:
            for model in (Tenant, User, Category, CategoryField, Product):
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

            def _category(id_, tenant_id, name_en, parent_id=None, **overrides):
                values = {
                    "id": id_,
                    "tenant_id": tenant_id,
                    "name_translations": {"ru": "", "en": name_en, "lt": ""},
                    "parent_id": parent_id,
                    "description_translations": {},
                    # Deliberately wrong stored columns — the response must
                    # ignore them and compute level/field_count/product_count
                    # from the actual rows instead.
                    "field_count": 999,
                    "product_count": 999,
                    "level": 999,
                }
                values.update(overrides)
                return values

            await conn.execute(
                insert(Category),
                [
                    _category(self.cat_beta, self.tenant_a, "Beta"),
                    _category(
                        self.cat_alpha_child, self.tenant_a, "Alpha Child",
                        parent_id=self.cat_beta,
                    ),
                    _category(
                        self.cat_grandchild, self.tenant_a, "Grandchild",
                        parent_id=self.cat_alpha_child,
                    ),
                    _category(self.cat_zeta, self.tenant_a, "Zeta"),
                    _category(
                        self.cat_with_fields, self.tenant_a, "Fielded",
                    ),
                    _category(
                        self.cat_lt_only, self.tenant_a, "Nothing",
                        name_translations={"ru": "", "en": "", "lt": "Vienetas"},
                    ),
                    _category(
                        self.cat_desc_only, self.tenant_a, "PlainName",
                        description_translations={"en": "onlyindescription"},
                    ),
                    _category(self.cat_b, self.tenant_b, "Foreign"),
                ],
            )

            await conn.execute(
                insert(CategoryField),
                [
                    {
                        "id": self.field_1,
                        "tenant_id": self.tenant_a,
                        "category_id": self.cat_with_fields,
                        "name_translations": {"ru": "", "en": "F1", "lt": ""},
                        "field_type": "text",
                        "required": False,
                        "sort_order": 0,
                        "options": None,
                    },
                    {
                        "id": self.field_2,
                        "tenant_id": self.tenant_a,
                        "category_id": self.cat_with_fields,
                        "name_translations": {"ru": "", "en": "F2", "lt": ""},
                        "field_type": "text",
                        "required": False,
                        "sort_order": 1,
                        "options": None,
                    },
                ],
            )
            await conn.execute(
                insert(Product),
                [
                    {
                        "id": uuid4(),
                        "tenant_id": self.tenant_a,
                        "name": "Product 1",
                        "category_id": self.cat_with_fields,
                    },
                    {
                        "id": uuid4(),
                        "tenant_id": self.tenant_a,
                        "name": "Product 2",
                        "category_id": self.cat_with_fields,
                    },
                    {
                        "id": uuid4(),
                        "tenant_id": self.tenant_a,
                        "name": "Grandchild's product",
                        "category_id": self.cat_grandchild,
                    },
                ],
            )

        self.app = FastAPI()
        self.app.add_exception_handler(AppError, app_error_handler)
        self.app.include_router(categories_list_router)

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

    # ── auth, envelope, tenancy ───────────────────────────────────────────

    async def test_missing_authorization_is_refused(self):
        response = await self.client.get("/api/categories")

        self.assertEqual(401, response.status_code, response.text)

    async def test_envelope_carries_exactly_the_five_pagination_keys(self):
        response = await self.client.get("/api/categories", headers=self.auth_a)

        self.assertEqual(200, response.status_code, response.text)
        payload = response.json()["data"]
        self.assertEqual(
            {"items", "total", "page", "pageSize", "totalPages"}, set(payload.keys())
        )

    async def test_item_carries_exactly_the_seven_contract_fields(self):
        response = await self.client.get("/api/categories", headers=self.auth_a)

        item = response.json()["data"]["items"][0]
        self.assertEqual(
            {"id", "name", "parentId", "parentName", "fieldCount", "productCount", "level"},
            set(item.keys()),
        )

    async def test_a_foreign_tenants_category_is_absent_from_items_and_total(self):
        response = await self.client.get(
            "/api/categories", headers=self.auth_a, params={"pageSize": 100}
        )

        payload = response.json()["data"]
        ids = {item["id"] for item in payload["items"]}
        self.assertNotIn(str(self.cat_b), ids)
        # Only tenant A's 7 seeded categories may count toward total.
        self.assertEqual(7, payload["total"])

    # ── computed vs. stored columns ──────────────────────────────────────

    async def test_derived_columns_are_computed_not_the_lying_stored_ones(self):
        """Every seeded row's `level`, `field_count`, `product_count` columns are
        planted at 999 — a domain that read them instead of computing at read
        time would fail every assertion below."""
        response = await self.client.get(
            "/api/categories", headers=self.auth_a, params={"pageSize": 100}
        )
        items = {item["id"]: item for item in response.json()["data"]["items"]}

        self.assertEqual(0, items[str(self.cat_beta)]["level"])
        self.assertEqual(1, items[str(self.cat_alpha_child)]["level"])
        self.assertEqual(2, items[str(self.cat_grandchild)]["level"])

        self.assertEqual(2, items[str(self.cat_with_fields)]["fieldCount"])
        self.assertEqual(0, items[str(self.cat_beta)]["fieldCount"])

        self.assertEqual(2, items[str(self.cat_with_fields)]["productCount"])
        # Grandchild's own product counts for the grandchild only — productCount
        # is the row's own products, not the subtree (task brief for this slice).
        self.assertEqual(1, items[str(self.cat_grandchild)]["productCount"])
        self.assertEqual(0, items[str(self.cat_alpha_child)]["productCount"])

    async def test_parent_name_and_id_come_from_the_actual_parent_row(self):
        response = await self.client.get(
            "/api/categories", headers=self.auth_a, params={"pageSize": 100}
        )
        items = {item["id"]: item for item in response.json()["data"]["items"]}

        child = items[str(self.cat_alpha_child)]
        self.assertEqual(str(self.cat_beta), child["parentId"])
        self.assertEqual("Beta", child["parentName"]["en"])

        root = items[str(self.cat_beta)]
        self.assertIsNone(root["parentId"])
        self.assertIsNone(root["parentName"])

    # ── order: depth-first on empty search, flat on non-empty ────────────

    async def test_empty_search_is_depth_first_no_child_before_its_parent(self):
        response = await self.client.get(
            "/api/categories", headers=self.auth_a, params={"pageSize": 100}
        )
        items = response.json()["data"]["items"]
        order = [item["id"] for item in items]

        beta_idx = order.index(str(self.cat_beta))
        child_idx = order.index(str(self.cat_alpha_child))
        grandchild_idx = order.index(str(self.cat_grandchild))
        self.assertLess(beta_idx, child_idx)
        self.assertLess(child_idx, grandchild_idx)
        # The child sits immediately after its parent — not merely somewhere after.
        self.assertEqual(beta_idx + 1, child_idx)
        self.assertEqual(child_idx + 1, grandchild_idx)

    async def test_non_empty_search_is_flat_sorted_by_name_en(self):
        response = await self.client.get(
            "/api/categories",
            headers=self.auth_a,
            params={"search": "e", "pageSize": 100},
        )
        names = [item["name"]["en"] for item in response.json()["data"]["items"]]
        self.assertEqual(sorted(names), names)

    # ── search across three locales, description excluded ────────────────

    async def test_search_finds_a_name_only_present_in_lithuanian(self):
        response = await self.client.get(
            "/api/categories", headers=self.auth_a, params={"search": "vienetas"}
        )
        ids = {item["id"] for item in response.json()["data"]["items"]}
        self.assertIn(str(self.cat_lt_only), ids)

    async def test_search_does_not_match_the_description(self):
        response = await self.client.get(
            "/api/categories",
            headers=self.auth_a,
            params={"search": "onlyindescription"},
        )
        ids = {item["id"] for item in response.json()["data"]["items"]}
        self.assertNotIn(str(self.cat_desc_only), ids)

    # ── pagination clamp ───────────────────────────────────────────────

    async def test_empty_result_clamps_total_pages_to_one_not_zero(self):
        response = await self.client.get(
            "/api/categories",
            headers=self.auth_a,
            params={"search": "no-such-category-anywhere"},
        )
        payload = response.json()["data"]
        self.assertEqual(0, payload["total"])
        self.assertEqual([], payload["items"])
        self.assertEqual(1, payload["totalPages"])

    async def test_oversized_page_size_is_rejected_at_the_route(self):
        response = await self.client.get(
            "/api/categories", headers=self.auth_a, params={"pageSize": 1000}
        )
        self.assertEqual(422, response.status_code, response.text)


if __name__ == "__main__":
    unittest.main()
