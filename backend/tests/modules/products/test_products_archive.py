"""Behaviour of `DELETE /api/products/{product_id}` — П44 archive, not delete.

The row is never removed: `archived_at` is stamped, the catalog list stops
serving it, and `GET /api/products/{product_id}` keeps serving it — with a
derived `is_archived` flag — for old documents that still point at it. A
foreign tenant's product and a missing one answer the same `PRODUCT_NOT_FOUND`
404; archiving twice succeeds without a second write. There is no
`PRODUCT_IN_USE`: under П44 there is nothing left to refuse.

The harness is the one committed in `test_products_catalog.py`: a private
temporary SQLite database, the real routers over ASGI, real Bearer
authentication; only `get_db` is replaced, and the error handler is the
product's own `app_error_handler` imported from `app.main`.
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
from sqlalchemy.ext.compiler import compiles, deregister
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/products-archive-unused.sqlite"},
):
    from app.core.database import get_db
    from app.core.exceptions import AppError
    from app.main import app as main_app
    from app.main import app_error_handler
    from app.modules.auth.shared.models import Tenant, User
    from app.modules.auth.shared.session_tokens import issue_session_token
    from app.modules.products.features.archive_product.action import (
        router as archive_product_router,
    )
    from app.modules.products.features.get_product_detail.action import (
        router as get_product_detail_router,
    )
    from app.modules.products.features.list_products.action import (
        router as list_products_router,
    )
    from app.modules.products.shared.models import (
        Category,
        CategoryField,
        Product,
        ProductFieldValue,
    )


class ProductsArchiveTests(unittest.IsolatedAsyncioTestCase):
    """Archive-on-delete, exercised through real HTTP requests."""

    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="products-archive-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

        # У SQLite нет JSONB: для тестовой базы компилируем его как обычный JSON —

        # тот же приём, что в `test_products_tenancy.py`. Модель товара несёт JSONB-поля,

        # и без заглушки тест падает на компиляции типа, а не на поведении.

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

        self.product_a = uuid4()
        self.product_b = uuid4()

        async with self.engine.begin() as conn:
            for model in (
                Tenant,
                User,
                Category,
                CategoryField,
                Product,
                ProductFieldValue,
            ):
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
                insert(Product),
                [
                    {
                        "id": self.product_a,
                        "tenant_id": self.tenant_a,
                        "name": "Widget",
                    },
                    {
                        "id": self.product_b,
                        "tenant_id": self.tenant_b,
                        "name": "Other tenant's widget",
                    },
                ],
            )

        self.app = FastAPI()
        self.app.add_exception_handler(AppError, app_error_handler)
        # `list_products` MUST be registered before `get_product_detail` — see
        # the same comment in `app/main.py`.
        self.app.include_router(list_products_router)
        self.app.include_router(get_product_detail_router)
        self.app.include_router(archive_product_router)

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

    async def _row_archived_at(self, product_id):
        async with self.sessions() as session:
            result = await session.execute(
                select(Product.archived_at).where(Product.id == product_id)
            )
            return result.scalar_one()

    # ── auth ──────────────────────────────────────────────────────────────

    async def test_missing_authorization_is_refused(self):
        response = await self.client.delete(f"/api/products/{self.product_a}")

        self.assertEqual(401, response.status_code, response.text)

    # ── happy path: archive, don't delete ───────────────────────────────────

    async def test_archiving_stamps_archived_at_instead_of_deleting_the_row(self):
        response = await self.client.delete(
            f"/api/products/{self.product_a}", headers=self.auth_a
        )

        self.assertEqual(200, response.status_code, response.text)
        self.assertTrue(response.json()["data"]["is_archived"])
        self.assertIsNotNone(await self._row_archived_at(self.product_a))

    async def test_archived_product_disappears_from_the_catalog_list(self):
        await self.client.delete(f"/api/products/{self.product_a}", headers=self.auth_a)

        response = await self.client.get("/api/products/list", headers=self.auth_a)

        ids = {item["id"] for item in response.json()["data"]}
        self.assertNotIn(str(self.product_a), ids)

    async def test_archived_product_still_readable_by_id_with_archived_flag(self):
        await self.client.delete(f"/api/products/{self.product_a}", headers=self.auth_a)

        response = await self.client.get(
            f"/api/products/{self.product_a}", headers=self.auth_a
        )

        self.assertEqual(200, response.status_code, response.text)
        self.assertTrue(response.json()["data"]["is_archived"])

    async def test_live_product_detail_reports_not_archived(self):
        response = await self.client.get(
            f"/api/products/{self.product_a}", headers=self.auth_a
        )

        self.assertFalse(response.json()["data"]["is_archived"])

    # ── not found / cross-tenant ─────────────────────────────────────────

    async def test_missing_product_is_not_found(self):
        response = await self.client.delete(
            f"/api/products/{uuid4()}", headers=self.auth_a
        )

        self.assertEqual(404, response.status_code)
        self.assertEqual("NOT_FOUND", response.json()["detail"]["code"])

    async def test_foreign_tenant_product_answers_the_same_not_found(self):
        missing = await self.client.delete(
            f"/api/products/{uuid4()}", headers=self.auth_a
        )
        foreign = await self.client.delete(
            f"/api/products/{self.product_b}", headers=self.auth_a
        )

        self.assertEqual(missing.status_code, foreign.status_code)
        self.assertEqual(
            missing.json()["detail"]["code"], foreign.json()["detail"]["code"]
        )
        self.assertEqual(404, foreign.status_code)

        # The foreign product itself must remain untouched.
        self.assertIsNone(await self._row_archived_at(self.product_b))

    # ── idempotency ──────────────────────────────────────────────────────

    async def test_archiving_twice_succeeds_without_a_second_write(self):
        first = await self.client.delete(
            f"/api/products/{self.product_a}", headers=self.auth_a
        )
        first_timestamp = await self._row_archived_at(self.product_a)

        second = await self.client.delete(
            f"/api/products/{self.product_a}", headers=self.auth_a
        )
        second_timestamp = await self._row_archived_at(self.product_a)

        self.assertEqual(200, first.status_code)
        self.assertEqual(200, second.status_code, second.text)
        self.assertTrue(second.json()["data"]["is_archived"])
        self.assertEqual(first_timestamp, second_timestamp)


if __name__ == "__main__":
    unittest.main()
