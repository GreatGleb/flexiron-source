"""Behaviour of the services catalog slice — GET/POST/PATCH over a real request.

Harness copied from `tests/modules/settings/test_settings_refusals.py`: a private
temporary SQLite database, the real router over ASGI, real Bearer authentication;
only `get_db` is replaced, and the error handler is the product's own
`app_error_handler` imported from `app.main` (so the test proves the product, not
a copy of it). No Postgres and no Alembic.

`raise_app_exceptions=False` is deliberate: an unregistered `AppError` handler
must show up as the 500 it is in production, not as a traceback inside the client.
"""

import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from uuid import uuid4

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import insert
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles, deregister
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

# Importing database builds a lazy engine that must not look into .env — same guard
# the other ASGI-harness tests use.
with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/services-catalog-unused.sqlite"},
):
    from app.core.database import get_db
    from app.core.exceptions import AppError
    from app.main import app_error_handler
    from app.modules.auth.shared.models import Tenant, User
    from app.modules.auth.shared.session_tokens import issue_session_token
    from app.modules.services.features.catalog.action import router as catalog_router
    from app.modules.services.shared.models import Service
    from app.modules.settings.shared.models import Currency, Uom


class ServicesCatalogTests(unittest.IsolatedAsyncioTestCase):
    """Each of the three endpoints is exercised through a real request."""

    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="services-catalog-")
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
        self.currency_a, self.currency_b = uuid4(), uuid4()
        self.uom_a, self.uom_b = uuid4(), uuid4()
        self.service_a, self.service_b = uuid4(), uuid4()

        async with self.engine.begin() as conn:
            for model in (Tenant, User, Currency, Uom, Service):
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
                    }
                ],
            )
            await conn.execute(
                insert(Currency),
                [
                    self._currency(self.currency_a, self.tenant_a, "EUR"),
                    self._currency(self.currency_b, self.tenant_b, "GBP"),
                ],
            )
            await conn.execute(
                insert(Uom),
                [
                    self._uom(self.uom_a, self.tenant_a, "pcs"),
                    self._uom(self.uom_b, self.tenant_b, "kg"),
                ],
            )
            await conn.execute(
                insert(Service),
                [
                    self._service(
                        self.service_a, self.tenant_a, "Cutting", self.currency_a, self.uom_a
                    ),
                    self._service(
                        self.service_b, self.tenant_b, "Foreign", self.currency_b, self.uom_b
                    ),
                ],
            )

        self.app = FastAPI()
        self.app.add_exception_handler(AppError, app_error_handler)
        self.app.include_router(catalog_router)

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
        self.token = issue_session_token(self.user_a)

    # ── fixtures ─────────────────────────────────────────────────────────────

    @staticmethod
    def _currency(currency_id, tenant_id, code: str) -> dict:
        return {
            "id": currency_id,
            "tenant_id": tenant_id,
            "code": code,
            "name_translations": {"en": code},
            "is_default": False,
        }

    @staticmethod
    def _uom(uom_id, tenant_id, code: str) -> dict:
        return {
            "id": uom_id,
            "tenant_id": tenant_id,
            "code_translations": {"en": code},
            "name_translations": {"en": code},
            "category": "quantity",
        }

    @staticmethod
    def _service(service_id, tenant_id, name: str, currency_id, uom_id, description=None) -> dict:
        return {
            "id": service_id,
            "tenant_id": tenant_id,
            "name_translations": {"en": name},
            "cost_price": 10,
            "selling_price": 20,
            "currency_id": currency_id,
            "uom_id": uom_id,
            "description_translations": description,
        }

    @property
    def auth(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"}

    # ── GET /api/services/{id} ───────────────────────────────────────────────

    async def test_get_without_token_is_401(self):
        response = await self.client.get(f"/api/services/{self.service_a}")

        self.assertEqual(401, response.status_code, response.text)

    async def test_get_own_service_reads_200(self):
        response = await self.client.get(
            f"/api/services/{self.service_a}", headers=self.auth
        )

        self.assertEqual(200, response.status_code, response.text)
        data = response.json()["data"]
        self.assertEqual({"en": "Cutting", "ru": "", "lt": ""}, data["name"])
        self.assertEqual(10.0, data["costPrice"])
        self.assertNotIn("description", data)

    async def test_get_a_service_of_another_tenant_is_404(self):
        """Tenant scoping runs in the repository query, not just in a filter after."""
        response = await self.client.get(
            f"/api/services/{self.service_b}", headers=self.auth
        )

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("CATALOG_SERVICE_NOT_FOUND", response.json()["detail"]["code"])

    async def test_get_unknown_service_is_404(self):
        response = await self.client.get(f"/api/services/{uuid4()}", headers=self.auth)

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("CATALOG_SERVICE_NOT_FOUND", response.json()["detail"]["code"])

    # ── POST /api/services ────────────────────────────────────────────────────

    async def test_create_with_unknown_currency_is_refused(self):
        response = await self.client.post(
            "/api/services",
            headers=self.auth,
            json={
                "name": {"en": "New"},
                "costPrice": 5,
                "sellingPrice": 8,
                "currencyId": str(uuid4()),
                "uomId": str(self.uom_a),
            },
        )

        self.assertEqual(422, response.status_code, response.text)
        self.assertEqual("SERVICE_CURRENCY_NOT_FOUND", response.json()["detail"]["code"])

    async def test_create_with_unknown_uom_is_refused(self):
        response = await self.client.post(
            "/api/services",
            headers=self.auth,
            json={
                "name": {"en": "New"},
                "costPrice": 5,
                "sellingPrice": 8,
                "currencyId": str(self.currency_a),
                "uomId": str(uuid4()),
            },
        )

        self.assertEqual(422, response.status_code, response.text)
        self.assertEqual("SERVICE_UOM_NOT_FOUND", response.json()["detail"]["code"])

    async def test_create_with_another_tenants_currency_is_refused(self):
        """The foreign tenant's own currency exists — but not for this tenant."""
        response = await self.client.post(
            "/api/services",
            headers=self.auth,
            json={
                "name": {"en": "New"},
                "costPrice": 5,
                "sellingPrice": 8,
                "currencyId": str(self.currency_b),
                "uomId": str(self.uom_a),
            },
        )

        self.assertEqual(422, response.status_code, response.text)
        self.assertEqual("SERVICE_CURRENCY_NOT_FOUND", response.json()["detail"]["code"])

    async def test_create_with_another_tenants_uom_is_refused(self):
        response = await self.client.post(
            "/api/services",
            headers=self.auth,
            json={
                "name": {"en": "New"},
                "costPrice": 5,
                "sellingPrice": 8,
                "currencyId": str(self.currency_a),
                "uomId": str(self.uom_b),
            },
        )

        self.assertEqual(422, response.status_code, response.text)
        self.assertEqual("SERVICE_UOM_NOT_FOUND", response.json()["detail"]["code"])

    async def test_create_rejects_negative_price(self):
        response = await self.client.post(
            "/api/services",
            headers=self.auth,
            json={
                "name": {"en": "New"},
                "costPrice": -1,
                "sellingPrice": 8,
                "currencyId": str(self.currency_a),
                "uomId": str(self.uom_a),
            },
        )

        self.assertEqual(422, response.status_code, response.text)

    async def test_create_without_description_key_omits_it_from_the_response(self):
        response = await self.client.post(
            "/api/services",
            headers=self.auth,
            json={
                "name": {"en": "Undescribed"},
                "costPrice": 5,
                "sellingPrice": 8,
                "currencyId": str(self.currency_a),
                "uomId": str(self.uom_a),
            },
        )

        self.assertEqual(201, response.status_code, response.text)
        self.assertNotIn("description", response.json()["data"])

    async def test_create_succeeds_with_known_currency_and_uom(self):
        response = await self.client.post(
            "/api/services",
            headers=self.auth,
            json={
                "name": {"en": "Assembly"},
                "costPrice": 12.5,
                "sellingPrice": 25,
                "currencyId": str(self.currency_a),
                "uomId": str(self.uom_a),
                "description": {"en": "Assembly work"},
            },
        )

        self.assertEqual(201, response.status_code, response.text)
        data = response.json()["data"]
        self.assertEqual({"en": "Assembly work", "ru": "", "lt": ""}, data["description"])
        self.assertEqual(str(self.currency_a), data["currencyId"])

    # ── PATCH /api/services/{id} ──────────────────────────────────────────────

    async def test_patch_unknown_uom_is_refused_even_when_currency_is_untouched(self):
        """Only `uomId` is sent — the final pair is checked, so it is still refused."""
        response = await self.client.patch(
            f"/api/services/{self.service_a}",
            headers=self.auth,
            json={"uomId": str(uuid4())},
        )

        self.assertEqual(422, response.status_code, response.text)
        self.assertEqual("SERVICE_UOM_NOT_FOUND", response.json()["detail"]["code"])

    async def test_patch_valid_currency_alone_succeeds(self):
        """Only `currencyId` changes — the untouched, still-valid `uomId` passes too."""
        response = await self.client.patch(
            f"/api/services/{self.service_a}",
            headers=self.auth,
            json={"currencyId": str(self.currency_a)},
        )

        self.assertEqual(200, response.status_code, response.text)
        self.assertEqual(str(self.uom_a), response.json()["data"]["uomId"])

    async def test_patch_a_service_of_another_tenant_is_404(self):
        response = await self.client.patch(
            f"/api/services/{self.service_b}",
            headers=self.auth,
            json={"costPrice": 99},
        )

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("CATALOG_SERVICE_NOT_FOUND", response.json()["detail"]["code"])

    async def test_patch_merges_only_sent_fields(self):
        response = await self.client.patch(
            f"/api/services/{self.service_a}",
            headers=self.auth,
            json={"sellingPrice": 30},
        )

        self.assertEqual(200, response.status_code, response.text)
        data = response.json()["data"]
        self.assertEqual(30.0, data["sellingPrice"])
        self.assertEqual(10.0, data["costPrice"])
        self.assertEqual({"en": "Cutting", "ru": "", "lt": ""}, data["name"])


if __name__ == "__main__":
    unittest.main()
