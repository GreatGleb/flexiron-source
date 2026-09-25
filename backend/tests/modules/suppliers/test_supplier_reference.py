"""Behaviour of `GET /api/suppliers/list` and the `internal_api` brief functions.

`GET /api/suppliers/list` is a lightweight id+company catalog reference, tenant-scoped
from the token, with no parameters and no pagination. Owner decision П64 settled the
form of `company`: the server does not pick a locale, it returns all three keys
(`ru`, `en`, `lt`) and the client chooses which to show.

The harness is the one committed in `test_products_catalog.py` and
`test_settings_refusals.py`: a private temporary SQLite database, the real routers over
ASGI, real Bearer authentication; only `get_db` is replaced, and the error handler is
the product's own `app_error_handler` imported from `app.main`. Supplier columns are
JSONB, so — like `test_settings_refusals.py` — JSONB is compiled as plain SQLite `JSON`
for this test database only, then deregistered on cleanup.
"""

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, insert
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles, deregister

with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/suppliers-reference-unused.sqlite"},
):
    from app.core.database import get_db
    from app.core.exceptions import AppError
    from app.main import app as main_app
    from app.main import app_error_handler
    from app.modules.auth.shared.models import Tenant, User
    from app.modules.auth.shared.session_tokens import issue_session_token
    from app.modules.suppliers.features.supplier_reference.action import (
        router as supplier_reference_router,
    )
    from app.modules.suppliers.internal_api.interface import (
        get_supplier_brief,
        get_suppliers_brief,
    )
    from app.modules.suppliers.shared.models import Supplier


class SupplierReferenceRouteOrderTests(unittest.TestCase):
    """`/list` must resolve before any future `/{supplier_id}` catches it."""

    def test_list_route_is_registered(self):
        paths = list(main_app.openapi()["paths"].keys())

        self.assertIn("/api/suppliers/list", paths)


class SupplierReferenceTests(unittest.IsolatedAsyncioTestCase):
    """Catalog reference and internal_api brief functions, exercised through real HTTP."""

    async def asyncSetUp(self):
        @compiles(JSONB, "sqlite")
        def sqlite_jsonb(type_, compiler, **kw):
            return "JSON"

        self.addCleanup(deregister, JSONB)

        self.directory = tempfile.TemporaryDirectory(prefix="suppliers-reference-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

        self.engine = create_async_engine(
            "sqlite+aiosqlite:///" + str(self.root / "test.sqlite")
        )
        self.addAsyncCleanup(self.engine.dispose)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)

        self.tenant_a, self.tenant_b = uuid4(), uuid4()
        self.user_a = uuid4()

        # Three suppliers for tenant A, deliberately out of company-name order, plus a
        # tied pair to prove the id tie-break; one supplier for tenant B that must
        # never show up in A's catalog.
        self.supplier_charlie = uuid4()
        self.supplier_alpha = uuid4()
        self.supplier_same_1 = uuid4()
        self.supplier_same_2 = uuid4()
        self.supplier_b = uuid4()

        async with self.engine.begin() as conn:
            for model in (Tenant, User, Supplier):
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
                insert(Supplier),
                [
                    self._supplier(self.supplier_charlie, self.tenant_a, "Charlie Co"),
                    self._supplier(self.supplier_alpha, self.tenant_a, "Alpha Co"),
                    self._supplier(self.supplier_same_2, self.tenant_a, "Same Co"),
                    self._supplier(self.supplier_same_1, self.tenant_a, "Same Co"),
                    self._supplier(self.supplier_b, self.tenant_b, "B's Supplier"),
                ],
            )

        self.app = FastAPI()
        self.app.add_exception_handler(AppError, app_error_handler)
        self.app.include_router(supplier_reference_router)

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

    @staticmethod
    def _supplier(supplier_id, tenant_id, company_en: str) -> dict:
        return {
            "id": supplier_id,
            "tenant_id": tenant_id,
            "company_translations": {"ru": f"{company_en} RU", "en": company_en, "lt": f"{company_en} LT"},
            "email": f"{supplier_id}@example.test",
        }

    @property
    def auth_a(self) -> dict:
        return {"Authorization": f"Bearer {self.token_a}"}

    # ── GET /api/suppliers/list ────────────────────────────────────────────────

    async def test_missing_authorization_is_refused(self):
        response = await self.client.get("/api/suppliers/list")

        self.assertEqual(401, response.status_code, response.text)

    async def test_catalog_contains_only_the_caller_s_tenant_suppliers(self):
        response = await self.client.get("/api/suppliers/list", headers=self.auth_a)

        self.assertEqual(200, response.status_code, response.text)
        ids = {item["id"] for item in response.json()["data"]}

        self.assertIn(str(self.supplier_alpha), ids)
        self.assertNotIn(str(self.supplier_b), ids)

    async def test_catalog_items_expose_only_id_and_company(self):
        response = await self.client.get("/api/suppliers/list", headers=self.auth_a)

        item = response.json()["data"][0]
        self.assertEqual({"id", "company"}, set(item.keys()))

    async def test_company_is_a_translation_object_with_all_three_locales(self):
        response = await self.client.get("/api/suppliers/list", headers=self.auth_a)

        by_id = {item["id"]: item["company"] for item in response.json()["data"]}
        company = by_id[str(self.supplier_alpha)]

        self.assertEqual({"ru", "en", "lt"}, set(company.keys()))
        self.assertEqual("Alpha Co", company["en"])
        self.assertEqual("Alpha Co RU", company["ru"])
        self.assertEqual("Alpha Co LT", company["lt"])

    async def test_catalog_order_is_deterministic_by_company_en_then_id(self):
        response = await self.client.get("/api/suppliers/list", headers=self.auth_a)

        names_and_ids = [
            (item["company"]["en"], item["id"]) for item in response.json()["data"]
        ]
        expected = sorted(names_and_ids, key=lambda pair: (pair[0], pair[1]))

        self.assertEqual(expected, names_and_ids)
        # The tied pair ("Same Co", "Same Co") must come out ordered by id, not
        # insertion order.
        same_entries = [entry for entry in names_and_ids if entry[0] == "Same Co"]
        self.assertEqual(
            sorted(str(sid) for sid in (self.supplier_same_1, self.supplier_same_2)),
            [entry[1] for entry in same_entries],
        )

    # ── internal_api.interface — get_supplier_brief / get_suppliers_brief ──────

    async def test_get_supplier_brief_scopes_by_tenant(self):
        async with self.sessions() as session:
            own = await get_supplier_brief(session, self.tenant_a, self.supplier_alpha)
            foreign = await get_supplier_brief(session, self.tenant_a, self.supplier_b)

        self.assertIsNotNone(own)
        self.assertEqual(self.supplier_alpha, own.id)
        self.assertIsNone(foreign)

    async def test_get_suppliers_brief_scopes_by_tenant(self):
        async with self.sessions() as session:
            result = await get_suppliers_brief(
                session, self.tenant_a, [self.supplier_alpha, self.supplier_b]
            )
        ids = {supplier.id for supplier in result}

        self.assertIn(self.supplier_alpha, ids)
        self.assertNotIn(self.supplier_b, ids)

    async def test_get_suppliers_brief_on_foreign_tenant_ids_is_empty(self):
        async with self.sessions() as session:
            result = await get_suppliers_brief(session, self.tenant_b, [self.supplier_alpha])

        self.assertEqual([], result)

    async def test_get_suppliers_brief_issues_a_single_query(self):
        statements: list[str] = []

        def _record(conn, cursor, statement, parameters, context, executemany):
            statements.append(statement)

        event.listen(self.engine.sync_engine, "before_cursor_execute", _record)
        try:
            async with self.sessions() as session:
                await get_suppliers_brief(
                    session,
                    self.tenant_a,
                    [self.supplier_alpha, self.supplier_charlie, self.supplier_same_1],
                )
        finally:
            event.remove(self.engine.sync_engine, "before_cursor_execute", _record)

        select_statements = [s for s in statements if s.strip().upper().startswith("SELECT")]
        self.assertEqual(
            1,
            len(select_statements),
            f"expected exactly one SELECT, got {len(select_statements)}: {select_statements}",
        )


if __name__ == "__main__":
    unittest.main()
