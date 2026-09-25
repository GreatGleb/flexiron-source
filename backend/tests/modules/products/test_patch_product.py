"""Behaviour of `PATCH /api/products/{product_id}` — merge-patch, replace-semantics
field values, tenant isolation.

The harness is the one committed in `test_products_tenancy.py`: a private temporary
SQLite database, the real router over ASGI, real Bearer authentication; only `get_db`
is replaced, and the error handler is the product's own `app_error_handler` imported
from `app.main`. No Postgres and no Alembic; fixtures create only the tables the
route touches.
"""

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import insert, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles, deregister

with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/products-patch-unused.sqlite"},
):
    from app.core.database import get_db
    from app.core.exceptions import AppError
    from app.main import app_error_handler
    from app.modules.auth.shared.models import Tenant, User
    from app.modules.auth.shared.session_tokens import issue_session_token
    from app.modules.products.features.patch_product.action import (
        router as patch_product_router,
    )
    from app.modules.products.shared.models import (
        Category,
        CategoryField,
        Product,
        ProductFieldValue,
    )


class PatchProductTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="products-patch-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

        # У SQLite нет JSONB: для тестовой базы компилируем его как обычный JSON.
        # Тот же приём, что в `test_products_tenancy.py:56-61` — модель товара обзавелась
        # JSONB-полями позже этого теста, и без заглушки он падает не на поведении,
        # а на компиляции типа.
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
        self.product_a, self.product_b = uuid4(), uuid4()
        self.field_a = uuid4()
        self.field_b = uuid4()  # belongs to tenant B — must be rejected for tenant A

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
                insert(CategoryField),
                [
                    {
                        "id": self.field_a,
                        "tenant_id": self.tenant_a,
                        "category_id": uuid4(),
                        "name": "Color",
                        "field_type": "text",
                    },
                    {
                        "id": self.field_b,
                        "tenant_id": self.tenant_b,
                        "category_id": uuid4(),
                        "name": "Foreign field",
                        "field_type": "text",
                    },
                ],
            )
            await conn.execute(
                insert(Product),
                [
                    {
                        "id": self.product_a,
                        "tenant_id": self.tenant_a,
                        "name": "A's product",
                        "sku": "SKU-A",
                        "description": "Original description",
                        "min_stock": 5,
                    },
                    {
                        "id": self.product_b,
                        "tenant_id": self.tenant_b,
                        "name": "B's product",
                        "sku": "SKU-B",
                        "description": None,
                        "min_stock": None,
                    },
                ],
            )

        self.app = FastAPI()
        self.app.add_exception_handler(AppError, app_error_handler)
        self.app.include_router(patch_product_router)

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

    async def _load_product_a(self) -> Product:
        async with self.sessions() as session:
            result = await session.execute(
                select(Product).where(Product.id == self.product_a)
            )
            return result.scalar_one()

    async def _count_field_values(self, product_id) -> int:
        async with self.sessions() as session:
            result = await session.execute(
                select(ProductFieldValue).where(
                    ProductFieldValue.product_id == product_id
                )
            )
            return len(result.scalars().all())

    # ── auth ──────────────────────────────────────────────────────────────

    async def test_missing_authorization_is_refused(self):
        response = await self.client.patch(
            f"/api/products/{self.product_a}", json={"name": "New name"}
        )
        self.assertEqual(401, response.status_code, response.text)

    # ── merge-patch: only sent keys change ──────────────────────────────────

    async def test_single_key_patch_changes_only_that_field(self):
        response = await self.client.patch(
            f"/api/products/{self.product_a}",
            headers=self.auth_a,
            json={"sku": "SKU-CHANGED"},
        )
        self.assertEqual(200, response.status_code, response.text)

        row = await self._load_product_a()
        self.assertEqual("SKU-CHANGED", row.sku)
        # Untouched columns keep their original values.
        self.assertEqual("A's product", row.name)
        self.assertEqual("Original description", row.description)
        self.assertEqual(5, row.min_stock)

    async def test_empty_body_changes_nothing_and_returns_current_state(self):
        response = await self.client.patch(
            f"/api/products/{self.product_a}", headers=self.auth_a, json={}
        )
        self.assertEqual(200, response.status_code, response.text)
        self.assertEqual(str(self.product_a), response.json()["data"]["id"])

        row = await self._load_product_a()
        self.assertEqual("SKU-A", row.sku)
        self.assertEqual("Original description", row.description)

    async def test_null_clears_a_nullable_field_but_absent_key_preserves_it(self):
        response = await self.client.patch(
            f"/api/products/{self.product_a}",
            headers=self.auth_a,
            json={"description": None},
        )
        self.assertEqual(200, response.status_code, response.text)

        row = await self._load_product_a()
        self.assertIsNone(row.description)
        # sku wasn't in the body at all — it must survive untouched.
        self.assertEqual("SKU-A", row.sku)

    # ── fieldValues: full-array replace semantics ───────────────────────────

    async def test_field_values_replace_the_full_set(self):
        seed = await self.client.patch(
            f"/api/products/{self.product_a}",
            headers=self.auth_a,
            json={"fieldValues": [{"fieldId": str(self.field_a), "value": "red"}]},
        )
        self.assertEqual(200, seed.status_code, seed.text)
        self.assertEqual(1, await self._count_field_values(self.product_a))

        replace = await self.client.patch(
            f"/api/products/{self.product_a}",
            headers=self.auth_a,
            json={"fieldValues": []},
        )
        self.assertEqual(200, replace.status_code, replace.text)
        self.assertEqual(0, await self._count_field_values(self.product_a))

    async def test_field_values_ignore_materialized_definition_copies(self):
        response = await self.client.patch(
            f"/api/products/{self.product_a}",
            headers=self.auth_a,
            json={
                "fieldValues": [
                    {
                        "fieldId": str(self.field_a),
                        "value": "red",
                        "fieldName": {"ru": "Цвет", "en": "Color", "lt": "Spalva"},
                        "fieldType": "text",
                        "options": ["red", "blue"],
                        "inherited": False,
                    }
                ]
            },
        )
        self.assertEqual(200, response.status_code, response.text)

        async with self.sessions() as session:
            result = await session.execute(
                select(ProductFieldValue).where(
                    ProductFieldValue.product_id == self.product_a
                )
            )
            rows = result.scalars().all()
        self.assertEqual(1, len(rows))
        self.assertEqual("red", rows[0].value)
        self.assertEqual(self.field_a, rows[0].field_id)

    async def test_unknown_field_id_is_rejected_and_writes_nothing(self):
        before = await self._count_field_values(self.product_a)

        response = await self.client.patch(
            f"/api/products/{self.product_a}",
            headers=self.auth_a,
            json={"fieldValues": [{"fieldId": str(uuid4()), "value": "x"}]},
        )

        self.assertEqual(422, response.status_code, response.text)
        self.assertEqual("VALIDATION_ERROR", response.json()["detail"]["code"])
        self.assertEqual(before, await self._count_field_values(self.product_a))

    async def test_field_id_belonging_to_another_tenant_is_rejected(self):
        response = await self.client.patch(
            f"/api/products/{self.product_a}",
            headers=self.auth_a,
            json={"fieldValues": [{"fieldId": str(self.field_b), "value": "x"}]},
        )

        self.assertEqual(422, response.status_code, response.text)
        self.assertEqual("VALIDATION_ERROR", response.json()["detail"]["code"])
        self.assertEqual(0, await self._count_field_values(self.product_a))

    # ── tenant isolation ─────────────────────────────────────────────────────

    async def test_patch_of_another_tenant_s_product_is_not_found(self):
        response = await self.client.patch(
            f"/api/products/{self.product_b}",
            headers=self.auth_a,
            json={"sku": "HIJACKED"},
        )

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("NOT_FOUND", response.json()["detail"]["code"])

        async with self.sessions() as session:
            result = await session.execute(
                select(Product).where(Product.id == self.product_b)
            )
            row = result.scalar_one()
        self.assertEqual("SKU-B", row.sku)

    # ── response shape ───────────────────────────────────────────────────────

    async def test_response_matches_the_product_card_shape(self):
        response = await self.client.patch(
            f"/api/products/{self.product_a}",
            headers=self.auth_a,
            json={"sku": "SKU-CARD"},
        )
        self.assertEqual(200, response.status_code, response.text)

        data = response.json()["data"]
        for key in (
            "id",
            "name",
            "sku",
            "description",
            "price",
            "price_unit",
            "price_quantity",
            "currency_id",
            "min_stock",
            "purchase_uom_id",
            "warehouse_uom_id",
            "sale_uom_id",
            "category",
            "field_values",
            "created_at",
            "updated_at",
        ):
            self.assertIn(key, data)


if __name__ == "__main__":
    unittest.main()
