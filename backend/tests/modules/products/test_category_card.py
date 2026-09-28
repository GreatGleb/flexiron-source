"""Behaviour of `GET /api/categories/:id` and `DELETE /api/categories/:id`.

The harness is the one committed in `test_categories_list.py`: a private temporary
SQLite database, the real router over ASGI, real Bearer authentication; only
`get_db` is replaced, and the error handler is the product's own
`app_error_handler` imported from `app.main`. SQLite has no JSONB, so the
JSONB→JSON compile shim from `test_products_tenancy.py` is applied for the run.
No Postgres and no Alembic; fixtures create only the tables the routes touch.

    cd backend && python3 -m pytest tests/modules/products/test_category_card.py -q
"""

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, insert, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles, deregister

with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/category-card-unused.sqlite"},
):
    from app.core.database import get_db
    from app.core.exceptions import AppError
    from app.main import app_error_handler
    from app.modules.auth.shared.models import Tenant, User
    from app.modules.auth.shared.session_tokens import issue_session_token
    from app.modules.products.features.category_card.action import (
        router as category_card_router,
    )
    from app.modules.products.shared.models import Category, CategoryField, Product


class CategoryCardTests(unittest.IsolatedAsyncioTestCase):
    """Read the card; delete a category; both refusals of the delete."""

    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="category-card-")
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

        # A three-generation chain under tenant A:
        #   Root
        #     Mid
        #       Target   ← the card read; carries two products
        #   Empty        ← no products, no children: the only deletable category
        #   Foreign      ← tenant B, must never surface for tenant A
        self.cat_root = uuid4()
        self.cat_mid = uuid4()
        self.cat_target = uuid4()
        self.cat_empty = uuid4()
        self.cat_foreign = uuid4()

        self.field_root_shared = uuid4()
        self.field_root_only = uuid4()
        self.field_mid_shared = uuid4()
        self.field_mid_only = uuid4()
        # Target's own fields, inserted out of `sort_order` — the response must
        # come back ordered by the column, not by insertion order.
        self.field_target_b = uuid4()
        self.field_target_a = uuid4()

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
                        "email": "card@example.test",
                        "first_name": "A",
                        "last_name": "User",
                        "password_hash": "fixture",
                        "secret_link_token": "card-secret-a",
                    }
                ],
            )

            def _category(id_, tenant_id, name_en, parent_id=None):
                return {
                    "id": id_,
                    "tenant_id": tenant_id,
                    "name_translations": {"ru": "", "en": name_en, "lt": ""},
                    "parent_id": parent_id,
                    "description_translations": {},
                }

            await conn.execute(
                insert(Category),
                [
                    _category(self.cat_root, self.tenant_a, "Root"),
                    _category(self.cat_mid, self.tenant_a, "Mid", self.cat_root),
                    _category(self.cat_target, self.tenant_a, "Target", self.cat_mid),
                    _category(self.cat_empty, self.tenant_a, "Empty"),
                    _category(self.cat_foreign, self.tenant_b, "Foreign"),
                ],
            )

            def _field(id_, category_id, name_en, sort_order):
                return {
                    "id": id_,
                    "tenant_id": self.tenant_a,
                    "category_id": category_id,
                    "name_translations": {"ru": "", "en": name_en, "lt": ""},
                    "field_type": "text",
                    "required": False,
                    "sort_order": sort_order,
                    "options": None,
                }

            await conn.execute(
                insert(CategoryField),
                [
                    _field(self.field_root_shared, self.cat_root, "Shared", 0),
                    _field(self.field_root_only, self.cat_root, "RootOnly", 1),
                    _field(self.field_mid_shared, self.cat_mid, "Shared", 0),
                    _field(self.field_mid_only, self.cat_mid, "MidOnly", 1),
                    _field(self.field_target_b, self.cat_target, "OwnB", 1),
                    _field(self.field_target_a, self.cat_target, "OwnA", 0),
                ],
            )

            await conn.execute(
                insert(Product),
                [
                    {
                        "id": uuid4(),
                        "tenant_id": self.tenant_a,
                        "name": "Product 1",
                        "category_id": self.cat_target,
                        "price_quantity": 1,
                    },
                    {
                        "id": uuid4(),
                        "tenant_id": self.tenant_a,
                        "name": "Product 2",
                        "category_id": self.cat_target,
                        "price_quantity": 1,
                    },
                ],
            )

        self.app = FastAPI()
        self.app.add_exception_handler(AppError, app_error_handler)
        self.app.include_router(category_card_router)

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

    async def _get(self, category_id, headers=None):
        return await self.client.get(
            f"/api/categories/{category_id}", headers=headers or self.auth_a
        )

    async def _delete(self, category_id, headers=None):
        return await self.client.delete(
            f"/api/categories/{category_id}", headers=headers or self.auth_a
        )

    # ── premise: the seeded rows really are there ─────────────────────────

    async def test_seeded_rows_are_actually_present(self):
        """A green run over an empty store proves nothing — count what was made."""
        async with self.sessions() as session:
            categories = await session.execute(
                select(func.count())
                .select_from(Category)
                .where(Category.tenant_id == self.tenant_a)
            )
            fields = await session.execute(
                select(func.count())
                .select_from(CategoryField)
                .where(CategoryField.tenant_id == self.tenant_a)
            )
            products = await session.execute(
                select(func.count())
                .select_from(Product)
                .where(Product.tenant_id == self.tenant_a)
            )

        self.assertEqual(4, categories.scalar())
        self.assertEqual(6, fields.scalar())
        self.assertEqual(2, products.scalar())

    # ── read: own fields, their order, the computed counts ────────────────

    async def test_read_own_fields_are_ordered_by_sort_order(self):
        response = await self._get(self.cat_target)

        self.assertEqual(200, response.status_code, response.text)
        own = response.json()["data"]["fields"]
        self.assertEqual(["OwnA", "OwnB"], [field["name"]["en"] for field in own])
        self.assertEqual(
            [0, 1], [field["order"] for field in own], "order must follow sort_order"
        )

    async def test_read_counts_own_fields_and_products_only(self):
        """`fieldCount` is the category's own fields; `productCount` a count of rows.

        Both numbers are computed at read time — there is no stored column left to
        read, so a wrong answer here cannot be blamed on stale data.
        """
        response = await self._get(self.cat_target)

        data = response.json()["data"]
        self.assertEqual(2, data["fieldCount"], "own fields only, inherited excluded")
        self.assertEqual(2, data["productCount"])

    async def test_read_linked_suppliers_is_an_empty_list(self):
        response = await self._get(self.cat_target)

        self.assertEqual([], response.json()["data"]["linkedSuppliers"])

    async def test_read_parent_and_description_come_from_the_row(self):
        response = await self._get(self.cat_target)

        data = response.json()["data"]
        self.assertEqual(str(self.cat_mid), data["parentId"])
        self.assertIsNone(data["description"])

    # ── read: the inherited set ───────────────────────────────────────────

    async def test_read_inherited_fields_span_the_whole_chain_farthest_first(self):
        response = await self._get(self.cat_target)

        inherited = response.json()["data"]["inheritedFields"]
        self.assertEqual(
            ["Shared", "RootOnly", "Shared", "MidOnly"],
            [field["name"]["en"] for field in inherited],
        )

    async def test_read_inherited_duplicate_names_are_not_merged(self):
        """An ancestor and its child both define `Shared` — both must survive.

        Merging them would silently change the field set of every product in the
        subtree (`roo_code/roo-context/api/categories.md`, "Правила домена", rule 2).
        """
        response = await self._get(self.cat_target)

        inherited = response.json()["data"]["inheritedFields"]
        shared = [field for field in inherited if field["name"]["en"] == "Shared"]
        self.assertEqual(2, len(shared))
        self.assertEqual(
            {str(self.field_root_shared), str(self.field_mid_shared)},
            {field["id"] for field in shared},
        )

    # ── read: tenancy ─────────────────────────────────────────────────────

    async def test_read_foreign_tenant_category_is_not_found(self):
        response = await self._get(self.cat_foreign)

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("CATEGORY_NOT_FOUND", response.json()["detail"]["code"])

    async def test_read_unknown_category_is_not_found(self):
        response = await self._get(uuid4())

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("CATEGORY_NOT_FOUND", response.json()["detail"]["code"])

    async def test_read_requires_authentication(self):
        response = await self.client.get(f"/api/categories/{self.cat_target}")

        self.assertEqual(401, response.status_code, response.text)

    # ── delete ────────────────────────────────────────────────────────────

    async def test_delete_requires_authentication(self):
        response = await self.client.delete(f"/api/categories/{self.cat_empty}")

        self.assertEqual(401, response.status_code, response.text)

    async def test_delete_removes_a_category_without_products_or_children(self):
        response = await self._delete(self.cat_empty)

        self.assertEqual(200, response.status_code, response.text)
        self.assertTrue(response.json()["success"])

        # Gone for real, not merely answered with success.
        after = await self._get(self.cat_empty)
        self.assertEqual(404, after.status_code, after.text)

    async def test_delete_refuses_a_category_with_products(self):
        response = await self._delete(self.cat_target)

        self.assertEqual(409, response.status_code, response.text)
        self.assertEqual("CATEGORY_HAS_PRODUCTS", response.json()["detail"]["code"])

        after = await self._get(self.cat_target)
        self.assertEqual(200, after.status_code, "a refused delete must not delete")

    async def test_delete_refuses_a_category_with_children(self):
        response = await self._delete(self.cat_root)

        self.assertEqual(409, response.status_code, response.text)
        self.assertEqual("CATEGORY_HAS_CHILDREN", response.json()["detail"]["code"])

        after = await self._get(self.cat_root)
        self.assertEqual(200, after.status_code, "a refused delete must not delete")

    async def test_delete_unknown_category_is_not_found(self):
        response = await self._delete(uuid4())

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("CATEGORY_NOT_FOUND", response.json()["detail"]["code"])

    async def test_delete_foreign_tenant_category_is_not_found(self):
        response = await self._delete(self.cat_foreign)

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("CATEGORY_NOT_FOUND", response.json()["detail"]["code"])


if __name__ == "__main__":
    unittest.main()
