"""Behaviour of products tenancy — a real request, the code read from the body.

БАГ-14 had two halves: the routes hardcoded a placeholder tenant instead of reading it
from the token, and the repository getters (`get_product_by_id`, `get_category_by_id`)
selected by `id` alone, without `tenant_id` in the `where`. Either half alone would still
leak: a fixed route with an unscoped getter reads any tenant's row by a guessed id, and a
scoped getter behind a hardcoded tenant always resolves to the same one tenant.

The harness is the one committed in `test_settings_refusals.py`: a private temporary
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
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/products-tenancy-unused.sqlite"},
):
    from app.core.database import get_db
    from app.core.exceptions import AppError
    from app.main import app_error_handler
    from app.modules.auth.shared.models import Tenant, User
    from app.modules.auth.shared.session_tokens import issue_session_token
    from app.modules.products.features.create_product.action import (
        router as create_product_router,
    )
    from app.modules.products.features.get_product_detail.action import (
        router as get_product_detail_router,
    )
    from app.modules.products.shared.models import Category, Product, ProductFieldValue


class ProductsTenancyTests(unittest.IsolatedAsyncioTestCase):
    """Tenant A never sees tenant B's product or category, only its own."""

    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="products-tenancy-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

        self.engine = create_async_engine(
            "sqlite+aiosqlite:///" + str(self.root / "test.sqlite")
        )
        self.addAsyncCleanup(self.engine.dispose)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)

        self.tenant_a, self.tenant_b = uuid4(), uuid4()
        self.user_a = uuid4()

        self.category_b = uuid4()
        self.product_a, self.product_b = uuid4(), uuid4()

        async with self.engine.begin() as conn:
            for model in (Tenant, User, Category, Product, ProductFieldValue):
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
            # A category belonging to tenant B — tenant A's product below points at
            # it, as if the ids had leaked; the card must not resolve it.
            await conn.execute(
                insert(Category),
                [{"id": self.category_b, "tenant_id": self.tenant_b, "name": "Foreign"}],
            )
            await conn.execute(
                insert(Product),
                [
                    {
                        "id": self.product_a,
                        "tenant_id": self.tenant_a,
                        "name": "A's product",
                        "category_id": self.category_b,
                    },
                    {
                        "id": self.product_b,
                        "tenant_id": self.tenant_b,
                        "name": "B's product",
                        "category_id": None,
                    },
                ],
            )

        self.app = FastAPI()
        self.app.add_exception_handler(AppError, app_error_handler)
        self.app.include_router(get_product_detail_router)
        self.app.include_router(create_product_router)

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

    # ── GET /api/products/:id ────────────────────────────────────────────────

    async def test_missing_authorization_is_refused(self):
        response = await self.client.get(f"/api/products/{self.product_a}")

        self.assertEqual(401, response.status_code, response.text)

    async def test_a_product_of_another_tenant_reads_as_absent(self):
        response = await self.client.get(
            f"/api/products/{self.product_b}", headers=self.auth_a
        )

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("NOT_FOUND", response.json()["detail"]["code"])

    async def test_own_product_is_returned(self):
        response = await self.client.get(
            f"/api/products/{self.product_a}", headers=self.auth_a
        )

        self.assertEqual(200, response.status_code, response.text)
        self.assertEqual(str(self.product_a), response.json()["data"]["id"])

    async def test_a_category_of_another_tenant_does_not_leak_into_the_card(self):
        """Tenant A's product points at tenant B's category — it must read as absent."""
        response = await self.client.get(
            f"/api/products/{self.product_a}", headers=self.auth_a
        )

        self.assertEqual(200, response.status_code, response.text)
        self.assertIsNone(response.json()["data"]["category"])

    # ── POST /api/products ───────────────────────────────────────────────────

    async def test_create_without_authorization_is_refused(self):
        response = await self.client.post(
            "/api/products", json={"name": "New product"}
        )

        self.assertEqual(401, response.status_code, response.text)

    async def test_created_product_belongs_to_the_caller_s_tenant(self):
        """The tenant comes from the token — not a shared placeholder tenant."""
        created = await self.client.post(
            "/api/products",
            headers=self.auth_a,
            json={"name": "New product", "currency_id": str(uuid4())},
        )
        self.assertEqual(201, created.status_code, created.text)
        new_id = created.json()["data"]["id"]

        own_read = await self.client.get(f"/api/products/{new_id}", headers=self.auth_a)
        self.assertEqual(200, own_read.status_code, own_read.text)

        # A second tenant's token must not be able to read it back.
        user_b = uuid4()
        async with self.sessions() as session:
            await session.execute(
                insert(User),
                [
                    {
                        "id": user_b,
                        "tenant_id": self.tenant_b,
                        "email": "b@example.test",
                        "first_name": "B",
                        "last_name": "User",
                        "password_hash": "fixture",
                        "secret_link_token": "secret-b",
                    }
                ],
            )
            await session.commit()
        token_b = issue_session_token(user_b)

        foreign_read = await self.client.get(
            f"/api/products/{new_id}", headers={"Authorization": f"Bearer {token_b}"}
        )
        self.assertEqual(404, foreign_read.status_code, foreign_read.text)


if __name__ == "__main__":
    unittest.main()
