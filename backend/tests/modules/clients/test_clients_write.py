"""Behaviour of `POST /api/clients` and `PATCH /api/clients/:id`.

Real router, real request, real (private, temporary) SQLite database — the harness
committed in `test_products_tenancy.py` and reused by `test_clients_read.py`: the
product's own routers and `AppError` handler, real rows in a real table; only
`get_db` and `get_current_user` are overridden. No Postgres and no Alembic;
fixtures create only the tables the routes touch.

    cd backend && python3 -m pytest tests/modules/clients/test_clients_write.py -q
"""

from __future__ import annotations

import os
import re
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch
from uuid import UUID, uuid4

with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/clients-write-unused.sqlite"},
):
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient
    from sqlalchemy import insert, select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.core.database import get_db
    from app.core.exceptions import AppError
    from app.main import app_error_handler
    from app.modules.auth.internal_api.interface import CurrentUser, get_current_user
    from app.modules.auth.shared.models import Tenant, User
    from app.modules.clients.features.read_clients.action import router as read_router
    from app.modules.clients.features.write_clients.action import router as write_router
    from app.modules.clients.features.write_clients.countries import COUNTRY_CODES
    from app.modules.clients.shared.models import Client, ClientInteraction


TENANT_A = uuid4()
TENANT_B = uuid4()

REPO_ROOT = Path(__file__).resolve().parents[4]
FRONTEND_COUNTRIES = REPO_ROOT / "frontend_vue" / "src" / "domain" / "countries.ts"


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


class ClientsWriteTestCase(unittest.IsolatedAsyncioTestCase):
    """Shared fixture: a private database with two tenants and neither client."""

    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="clients-write-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

        self.engine = create_async_engine(
            "sqlite+aiosqlite:///" + str(self.root / "test.sqlite")
        )
        self.addAsyncCleanup(self.engine.dispose)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)

        async with self.engine.begin() as conn:
            for model in (Tenant, User, Client, ClientInteraction):
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

        self.client = await self._client(TENANT_A)

    def _build_app(self, tenant_id):
        app = FastAPI()
        app.add_exception_handler(AppError, app_error_handler)
        app.include_router(read_router)
        app.include_router(write_router)
        app.dependency_overrides[get_db] = _db_override(self.sessions)
        app.dependency_overrides[get_current_user] = _user_override(tenant_id)
        return app

    async def _client(self, tenant_id):
        app = self._build_app(tenant_id)
        client = AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://test",
        )
        self.addAsyncCleanup(client.aclose)
        return client

    @staticmethod
    def _body(**overrides):
        """A valid ten-key creation body, with named keys overridden."""
        body = {
            "name": "Acme Trading",
            "companyCode": "ACME-1",
            "vatCode": "LT100000001",
            "address": "Vytauto g. 15, Kaunas",
            "country": "LT",
            "phone": "+37060000000",
            "email": "acme@example.test",
            "status": "active",
            "paymentTermsDays": 30,
            "notes": None,
        }
        body.update(overrides)
        return body

    async def _create(self, **overrides):
        response = await self.client.post("/api/clients", json=self._body(**overrides))
        self.assertEqual(201, response.status_code, response.text)
        return response.json()["data"]


# ── POST /api/clients — creation, envelope, the server's own id and createdAt ──


class CreateTests(ClientsWriteTestCase):
    async def test_create_answers_201_and_stores_the_row_with_a_date_only_created_at(self):
        response = await self.client.post("/api/clients", json=self._body())

        self.assertEqual(201, response.status_code, response.text)
        payload = response.json()
        self.assertTrue(payload["success"])
        data = payload["data"]
        self.assertRegex(data["createdAt"], r"^\d{4}-\d{2}-\d{2}$")
        self.assertEqual(date.today().isoformat(), data["createdAt"])
        self.assertNotIn("T", data["createdAt"])

        async with self.sessions() as session:
            rows = (
                await session.execute(select(Client).where(Client.id == UUID(data["id"])))
            ).scalars().all()
        self.assertEqual(1, len(rows))
        self.assertEqual(TENANT_A, rows[0].tenant_id)
        self.assertEqual("Acme Trading", rows[0].name)

    async def test_the_answer_carries_exactly_the_card_field_set(self):
        created = await self._create()
        patched = (
            await self.client.patch(
                f"/api/clients/{created['id']}", json={"name": "Renamed Co"}
            )
        ).json()["data"]
        card = (await self.client.get(f"/api/clients/{created['id']}")).json()["data"]

        self.assertEqual(set(card.keys()), set(created.keys()))
        self.assertEqual(set(card.keys()), set(patched.keys()))

    async def test_a_name_or_company_code_or_email_or_payment_terms_failure_is_validation_error(
        self,
    ):
        cases = (
            ("name", {"name": None}),
            ("name", {"name": "   "}),
            ("companyCode", {"companyCode": None}),
            ("companyCode", {"companyCode": ""}),
            ("email", {"email": None}),
            ("email", {"email": ""}),
            ("paymentTermsDays", {"paymentTermsDays": -1}),
            ("paymentTermsDays", {"paymentTermsDays": 1.5}),
        )
        for field, override in cases:
            with self.subTest(field=field, override=override):
                response = await self.client.post(
                    "/api/clients", json=self._body(**override)
                )
                self.assertEqual(422, response.status_code, response.text)
                self.assertEqual(
                    "VALIDATION_ERROR", response.json()["detail"]["code"]
                )
                self.assertIn(field, response.json()["fieldErrors"])

    async def test_status_outside_the_two_known_values_is_refused(self):
        response = await self.client.post("/api/clients", json=self._body(status="deleted"))

        self.assertEqual(422, response.status_code, response.text)
        self.assertEqual("VALIDATION_ERROR", response.json()["detail"]["code"])
        self.assertIn("status", response.json()["fieldErrors"])


# ── The ten-key white list ──────────────────────────────────────────────────────


class WhiteListTests(ClientsWriteTestCase):
    async def test_an_unknown_top_level_key_is_refused_on_post(self):
        for extra in (
            {"rejectionReason": "nope"},
            {"id": str(uuid4())},
            {"createdAt": "2026-01-01"},
        ):
            with self.subTest(key=next(iter(extra))):
                response = await self.client.post(
                    "/api/clients", json=self._body(**extra)
                )
                self.assertEqual(422, response.status_code, response.text)
                self.assertEqual(
                    "VALIDATION_ERROR", response.json()["detail"]["code"]
                )

    async def test_an_unknown_top_level_key_is_refused_on_patch(self):
        created = await self._create()

        response = await self.client.patch(
            f"/api/clients/{created['id']}", json={"rejectionReason": "nope"}
        )

        self.assertEqual(422, response.status_code, response.text)
        self.assertEqual("VALIDATION_ERROR", response.json()["detail"]["code"])


# ── email shape and country list ────────────────────────────────────────────────


class FieldShapeTests(ClientsWriteTestCase):
    async def test_an_address_that_is_not_an_address_is_refused_and_not_stored(self):
        response = await self.client.post(
            "/api/clients", json=self._body(email="not-an-address")
        )

        self.assertEqual(422, response.status_code, response.text)
        self.assertEqual("VALIDATION_ERROR", response.json()["detail"]["code"])
        self.assertIn("email", response.json()["fieldErrors"])

        async with self.sessions() as session:
            stored = (await session.execute(select(Client))).scalars().all()
        self.assertEqual([], stored)

    async def test_country_is_a_closed_list_code_or_null(self):
        refused = await self.client.post("/api/clients", json=self._body(country="UK"))
        self.assertEqual(422, refused.status_code, refused.text)
        self.assertEqual("VALIDATION_ERROR", refused.json()["detail"]["code"])
        self.assertIn("country", refused.json()["fieldErrors"])

        accepted = await self._create(
            companyCode="GB-1", vatCode="LT-GB-1", email="gb@example.test", country="GB"
        )
        self.assertEqual("GB", accepted["country"])

        no_country = await self._create(
            companyCode="NONE-1",
            vatCode="LT-NONE-1",
            email="none@example.test",
            country=None,
        )
        self.assertIsNone(no_country["country"])


# ── Uniqueness: three tenant-paired constraints, three codes ────────────────────


class UniquenessTests(ClientsWriteTestCase):
    async def test_a_repeat_of_each_unique_field_is_409_with_its_own_code_and_field(self):
        first = self._body()
        self.assertEqual(
            201, (await self.client.post("/api/clients", json=first)).status_code
        )

        repeats = (
            (
                "companyCode",
                {
                    "companyCode": first["companyCode"],
                    "vatCode": "LT-NEW-1",
                    "email": "new-1@example.test",
                },
                "CLIENT_COMPANY_CODE_TAKEN",
            ),
            (
                "vatCode",
                {
                    "companyCode": "NEW-2",
                    "vatCode": first["vatCode"],
                    "email": "new-2@example.test",
                },
                "CLIENT_VAT_CODE_TAKEN",
            ),
            (
                "email",
                {
                    "companyCode": "NEW-3",
                    "vatCode": "LT-NEW-3",
                    "email": first["email"],
                },
                "CLIENT_EMAIL_TAKEN",
            ),
        )
        for field, override, code in repeats:
            with self.subTest(field=field):
                response = await self.client.post(
                    "/api/clients", json=self._body(**override)
                )
                self.assertEqual(409, response.status_code, response.text)
                self.assertEqual(code, response.json()["detail"]["code"])
                self.assertEqual(
                    {field}, set(response.json()["fieldErrors"].keys())
                )

    async def test_the_same_company_code_in_another_tenant_is_accepted(self):
        response = await self.client.post("/api/clients", json=self._body())
        self.assertEqual(201, response.status_code, response.text)

        other = await self._client(TENANT_B)
        foreign = await other.post("/api/clients", json=self._body())
        self.assertEqual(201, foreign.status_code, foreign.text)

        async with self.sessions() as session:
            rows = (
                await session.execute(
                    select(Client).where(Client.company_code == "ACME-1")
                )
            ).scalars().all()
        self.assertEqual({TENANT_A, TENANT_B}, {row.tenant_id for row in rows})


# ── PATCH /api/clients/:id — merge, not-found, uniqueness through PATCH ─────────


class PatchTests(ClientsWriteTestCase):
    async def test_a_one_key_patch_changes_that_key_and_leaves_the_rest(self):
        created = await self._create()

        response = await self.client.patch(
            f"/api/clients/{created['id']}", json={"name": "Renamed Co"}
        )

        self.assertEqual(200, response.status_code, response.text)
        patched = response.json()["data"]
        self.assertEqual("Renamed Co", patched["name"])
        for key in (
            "companyCode",
            "vatCode",
            "address",
            "country",
            "phone",
            "email",
            "status",
            "paymentTermsDays",
            "notes",
        ):
            self.assertEqual(created[key], patched[key], key)

        card = (await self.client.get(f"/api/clients/{created['id']}")).json()["data"]
        self.assertEqual("Renamed Co", card["name"])

    async def test_an_empty_patch_body_is_a_no_op_that_returns_the_client(self):
        created = await self._create()

        response = await self.client.patch(f"/api/clients/{created['id']}", json={})

        self.assertEqual(200, response.status_code, response.text)
        self.assertEqual(created, response.json()["data"])

    async def test_patch_of_an_unknown_or_foreign_client_is_client_not_found(self):
        response = await self.client.patch(f"/api/clients/{uuid4()}", json={"name": "X"})
        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("CLIENT_NOT_FOUND", response.json()["detail"]["code"])

        other = await self._client(TENANT_B)
        foreign_created = await other.post("/api/clients", json=self._body())
        foreign_id = foreign_created.json()["data"]["id"]

        response = await self.client.patch(
            f"/api/clients/{foreign_id}", json={"name": "X"}
        )
        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("CLIENT_NOT_FOUND", response.json()["detail"]["code"])

    async def test_a_patch_repeat_of_a_unique_field_uses_the_same_code_as_post(self):
        first = await self._create()
        second = await self._create(
            companyCode="OTHER-1",
            vatCode="LT-OTHER-1",
            email="other@example.test",
        )

        response = await self.client.patch(
            f"/api/clients/{second['id']}", json={"companyCode": first["companyCode"]}
        )

        self.assertEqual(409, response.status_code, response.text)
        self.assertEqual("CLIENT_COMPANY_CODE_TAKEN", response.json()["detail"]["code"])
        self.assertEqual({"companyCode"}, set(response.json()["fieldErrors"].keys()))

    async def test_a_patch_re_sending_its_own_unique_value_is_accepted(self):
        created = await self._create()

        response = await self.client.patch(
            f"/api/clients/{created['id']}",
            json={"companyCode": created["companyCode"], "name": "Still Acme"},
        )

        self.assertEqual(200, response.status_code, response.text)
        self.assertEqual("Still Acme", response.json()["data"]["name"])


# ── The two country lists are one rule in two places ─────────────────────────────


class CountryListSyncTests(unittest.TestCase):
    def test_the_python_and_typescript_country_lists_hold_the_same_codes(self):
        source = FRONTEND_COUNTRIES.read_text(encoding="utf-8")
        block = source.split("export const COUNTRY_CODES = [", 1)[1].split("] as const", 1)[0]
        typescript_codes = set(re.findall(r"'([A-Z]{2})'", block))

        self.assertGreater(
            len(typescript_codes), 200, "разбор TS-списка сломан — кодов не нашлось"
        )
        self.assertEqual(typescript_codes, set(COUNTRY_CODES))


if __name__ == "__main__":
    unittest.main()
