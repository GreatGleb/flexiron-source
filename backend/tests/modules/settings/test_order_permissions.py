"""Behaviour of `GET /api/settings/order-permissions` — a real request, over ASGI.

The harness mirrors `test_settings_refusals.py`: a private temporary SQLite
database, the real router, real Bearer authentication; only `get_db` is
replaced. No Postgres and no Alembic — the fixture creates only the tables
this route touches.
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
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/order-permissions-unused.sqlite"},
):
    from app.core.database import get_db
    from app.core.exceptions import AppError
    from app.main import app_error_handler
    from app.modules.auth.shared.models import Tenant, User
    from app.modules.auth.shared.session_tokens import issue_session_token
    from app.modules.settings.features.crud.action import router as crud_router
    from app.modules.settings.shared.models import OrderPermissions


class OrderPermissionsTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="order-permissions-")
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
        self.user_a, self.user_b = uuid4(), uuid4()

        async with self.engine.begin() as conn:
            for model in (Tenant, User, OrderPermissions):
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
                    },
                    {
                        "id": self.user_b,
                        "tenant_id": self.tenant_b,
                        "email": "b@example.test",
                        "first_name": "B",
                        "last_name": "User",
                        "password_hash": "fixture",
                        "secret_link_token": "secret-b",
                    },
                ],
            )

        self.app = FastAPI()
        self.app.add_exception_handler(AppError, app_error_handler)
        self.app.include_router(crud_router)

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
        self.token_b = issue_session_token(self.user_b)

    def auth(self, token: str) -> dict:
        return {"Authorization": f"Bearer {token}"}

    async def test_first_read_seeds_the_row_from_the_mock_values(self):
        response = await self.client.get(
            "/api/settings/order-permissions", headers=self.auth(self.token_a)
        )

        self.assertEqual(200, response.status_code, response.text)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(
            {
                "seeCost": ["owner", "admin", "accounting"],
                "manualCost": ["owner", "admin"],
                "correction": ["owner", "admin"],
            },
            body["data"],
        )

    async def test_second_read_does_not_create_a_second_row(self):
        first = await self.client.get(
            "/api/settings/order-permissions", headers=self.auth(self.token_a)
        )
        self.assertEqual(200, first.status_code, first.text)

        second = await self.client.get(
            "/api/settings/order-permissions", headers=self.auth(self.token_a)
        )
        self.assertEqual(200, second.status_code, second.text)
        self.assertEqual(first.json()["data"], second.json()["data"])

        async with self.sessions() as session:
            rows = (
                await session.execute(
                    select(OrderPermissions).where(
                        OrderPermissions.tenant_id == self.tenant_a
                    )
                )
            ).scalars().all()
        self.assertEqual(1, len(rows))

    async def test_one_tenants_edit_is_invisible_to_another(self):
        await self.client.get(
            "/api/settings/order-permissions", headers=self.auth(self.token_a)
        )
        await self.client.get(
            "/api/settings/order-permissions", headers=self.auth(self.token_b)
        )

        async with self.sessions() as session:
            row_a = (
                await session.execute(
                    select(OrderPermissions).where(
                        OrderPermissions.tenant_id == self.tenant_a
                    )
                )
            ).scalar_one()
            row_a.see_cost_roles = ["owner"]
            await session.commit()

        response_a = await self.client.get(
            "/api/settings/order-permissions", headers=self.auth(self.token_a)
        )
        response_b = await self.client.get(
            "/api/settings/order-permissions", headers=self.auth(self.token_b)
        )

        self.assertEqual(["owner"], response_a.json()["data"]["seeCost"])
        self.assertEqual(
            ["owner", "admin", "accounting"], response_b.json()["data"]["seeCost"]
        )


if __name__ == "__main__":
    unittest.main()
