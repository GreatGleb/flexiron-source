"""Behaviour of `GET /api/clients` and `GET /api/clients/:id`.

The harness is the one committed in `test_products_tenancy.py` and reused by
`test_products_catalog.py`: a private temporary SQLite database, the real
routers over ASGI, real Bearer authentication; only `get_db` is replaced, and
the error handler is the product's own `app_error_handler` imported from
`app.main`. No Postgres and no Alembic; fixtures create only the tables the
two routes touch.

    cd backend && python3 -m pytest tests/modules/clients/test_clients_read.py -q
"""

import os
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import insert
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/clients-read-unused.sqlite"},
):
    from app.core.database import get_db
    from app.core.exceptions import AppError
    from app.main import app as main_app
    from app.main import app_error_handler
    from app.modules.auth.shared.models import Tenant, User
    from app.modules.auth.shared.session_tokens import issue_session_token
    from app.modules.clients.features.read_clients.action import (
        router as clients_read_router,
    )
    from app.modules.clients.shared.models import Client, ClientInteraction


class ClientsRouteOrderTests(unittest.TestCase):
    """The assembled app must resolve `` before `{client_id}` catches it."""

    def test_list_route_is_declared_before_the_detail_route(self):
        paths = list(main_app.openapi()["paths"].keys())

        list_index = paths.index("/api/clients")
        detail_index = paths.index("/api/clients/{client_id}")

        self.assertLess(
            list_index,
            detail_index,
            "GET /api/clients must be registered before GET /api/clients/{client_id}",
        )


class ClientsReadTests(unittest.IsolatedAsyncioTestCase):
    """Read slice — list and card — exercised through real HTTP requests."""

    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="clients-read-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

        self.engine = create_async_engine(
            "sqlite+aiosqlite:///" + str(self.root / "test.sqlite")
        )
        self.addAsyncCleanup(self.engine.dispose)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)

        self.tenant_a, self.tenant_b = uuid4(), uuid4()
        self.user_a = uuid4()

        # Three clients whose *only* match against the search term "zephyr"
        # comes from a different one of the three searched fields each —
        # proof the search really covers all three, not just one.
        self.client_by_name = uuid4()
        self.client_by_code = uuid4()
        self.client_by_email = uuid4()
        # A tied-timestamp pair to prove the default order's id tie-break.
        self.client_same_1 = uuid4()
        self.client_same_2 = uuid4()
        # Owns two interaction-history entries, out of date order in the seed.
        self.client_with_history = uuid4()
        # Belongs to tenant B — must never surface for tenant A.
        self.client_b = uuid4()

        async with self.engine.begin() as conn:
            for model in (Tenant, User, Client, ClientInteraction):
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

            def _client(id_, tenant_id, **overrides):
                values = {
                    "id": id_,
                    "tenant_id": tenant_id,
                    "name": "Client",
                    "company_code": f"CODE-{id_}",
                    "vat_code": f"VAT-{id_}",
                    "address": "Some street 1",
                    "country": None,
                    "phone": "+37060000000",
                    "email": f"{id_}@example.test",
                    "status": "active",
                    "payment_terms_days": 30,
                    "notes": None,
                    "created_at": date(2026, 1, 1),
                }
                values.update(overrides)
                return values

            await conn.execute(
                insert(Client),
                [
                    _client(
                        self.client_by_name,
                        self.tenant_a,
                        name="Zephyr Trading",
                        company_code="AAA-1",
                        email="one@example.test",
                        created_at=date(2026, 1, 2),
                    ),
                    _client(
                        self.client_by_code,
                        self.tenant_a,
                        name="Other Co",
                        company_code="ZEPHYR-42",
                        email="two@example.test",
                        created_at=date(2026, 1, 3),
                    ),
                    _client(
                        self.client_by_email,
                        self.tenant_a,
                        name="Third Co",
                        company_code="BBB-2",
                        email="zephyr@thirdmail.test",
                        created_at=date(2026, 1, 4),
                    ),
                    _client(
                        self.client_same_1,
                        self.tenant_a,
                        name="Same",
                        company_code="SAME-1",
                        status="inactive",
                        created_at=date(2026, 2, 1),
                    ),
                    _client(
                        self.client_same_2,
                        self.tenant_a,
                        name="Same",
                        company_code="SAME-2",
                        status="inactive",
                        created_at=date(2026, 2, 1),
                    ),
                    _client(
                        self.client_with_history,
                        self.tenant_a,
                        name="History Holder",
                        company_code="HIST-1",
                        created_at=date(2026, 3, 1),
                    ),
                    _client(self.client_b, self.tenant_b, name="B's client"),
                ],
            )
            await conn.execute(
                insert(ClientInteraction),
                [
                    {
                        "id": uuid4(),
                        "tenant_id": self.tenant_a,
                        "client_id": self.client_with_history,
                        "date": date(2026, 3, 10),
                        "type": "call",
                        "summary": "Second call",
                        "user_id": None,
                        "user_name": "Alice",
                    },
                    {
                        "id": uuid4(),
                        "tenant_id": self.tenant_a,
                        "client_id": self.client_with_history,
                        "date": date(2026, 3, 5),
                        "type": "email",
                        "summary": "First email",
                        "user_id": None,
                        "user_name": "Bob",
                    },
                ],
            )

        self.app = FastAPI()
        self.app.add_exception_handler(AppError, app_error_handler)
        self.app.include_router(clients_read_router)

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

    # ── GET /api/clients — auth, envelope, tenancy ───────────────────────────

    async def test_missing_authorization_is_refused(self):
        response = await self.client.get("/api/clients")

        self.assertEqual(401, response.status_code, response.text)

    async def test_envelope_carries_exactly_the_five_pagination_keys(self):
        response = await self.client.get("/api/clients", headers=self.auth_a)

        self.assertEqual(200, response.status_code, response.text)
        payload = response.json()["data"]
        self.assertEqual(
            {"items", "total", "page", "pageSize", "totalPages"}, set(payload.keys())
        )

    async def test_list_item_carries_exactly_the_contract_fields_no_history_no_audit(self):
        response = await self.client.get("/api/clients", headers=self.auth_a)

        item = response.json()["data"]["items"][0]
        self.assertEqual(
            {
                "id", "name", "companyCode", "vatCode", "address", "country",
                "phone", "email", "status", "paymentTermsDays", "notes", "createdAt",
            },
            set(item.keys()),
        )

    async def test_a_foreign_tenants_client_is_absent_from_the_list(self):
        response = await self.client.get(
            "/api/clients", headers=self.auth_a, params={"pageSize": 100}
        )

        ids = {item["id"] for item in response.json()["data"]["items"]}
        self.assertNotIn(str(self.client_b), ids)

    # ── GET /api/clients — search across all three fields ───────────────────

    async def test_search_matches_by_name(self):
        response = await self.client.get(
            "/api/clients", headers=self.auth_a, params={"search": "zephyr"}
        )

        ids = {item["id"] for item in response.json()["data"]["items"]}
        self.assertIn(str(self.client_by_name), ids)

    async def test_search_matches_by_company_code(self):
        response = await self.client.get(
            "/api/clients", headers=self.auth_a, params={"search": "zephyr"}
        )

        ids = {item["id"] for item in response.json()["data"]["items"]}
        self.assertIn(str(self.client_by_code), ids)

    async def test_search_matches_by_email(self):
        response = await self.client.get(
            "/api/clients", headers=self.auth_a, params={"search": "zephyr"}
        )

        ids = {item["id"] for item in response.json()["data"]["items"]}
        self.assertIn(str(self.client_by_email), ids)

    async def test_search_is_case_insensitive_and_excludes_non_matches(self):
        response = await self.client.get(
            "/api/clients", headers=self.auth_a, params={"search": "ZEPHYR"}
        )

        ids = {item["id"] for item in response.json()["data"]["items"]}
        self.assertEqual(
            {str(self.client_by_name), str(self.client_by_code), str(self.client_by_email)},
            ids,
        )

    # ── GET /api/clients — status filter ─────────────────────────────────────

    async def test_absent_status_means_any(self):
        response = await self.client.get(
            "/api/clients", headers=self.auth_a, params={"pageSize": 100}
        )

        statuses = {item["status"] for item in response.json()["data"]["items"]}
        self.assertIn("active", statuses)
        self.assertIn("inactive", statuses)

    async def test_explicit_status_narrows_the_list(self):
        response = await self.client.get(
            "/api/clients",
            headers=self.auth_a,
            params={"status": "inactive", "pageSize": 100},
        )

        statuses = {item["status"] for item in response.json()["data"]["items"]}
        self.assertEqual({"inactive"}, statuses)
        ids = {item["id"] for item in response.json()["data"]["items"]}
        self.assertIn(str(self.client_same_1), ids)
        self.assertIn(str(self.client_same_2), ids)

    # ── GET /api/clients — sorting and the default order ─────────────────────

    async def test_default_order_is_created_at_ascending_with_id_tie_break(self):
        response = await self.client.get(
            "/api/clients", headers=self.auth_a, params={"pageSize": 100}
        )

        items = response.json()["data"]["items"]
        dates = [item["createdAt"] for item in items]
        self.assertEqual(sorted(dates), dates)

        same_entries = [
            (item["createdAt"], item["id"]) for item in items if item["name"] == "Same"
        ]
        self.assertEqual(
            sorted(str(cid) for cid in (self.client_same_1, self.client_same_2)),
            [entry[1] for entry in same_entries],
        )

    async def test_sort_by_name_ascending(self):
        response = await self.client.get(
            "/api/clients",
            headers=self.auth_a,
            params={"sortBy": "name", "sortDir": "asc", "pageSize": 100},
        )

        names = [item["name"] for item in response.json()["data"]["items"]]
        self.assertEqual(sorted(names), names)

    async def test_sort_by_name_descending(self):
        response = await self.client.get(
            "/api/clients",
            headers=self.auth_a,
            params={"sortBy": "name", "sortDir": "desc", "pageSize": 100},
        )

        names = [item["name"] for item in response.json()["data"]["items"]]
        self.assertEqual(sorted(names, reverse=True), names)

    # ── GET /api/clients — pagination clamp ──────────────────────────────────

    async def test_empty_result_clamps_total_pages_to_one_not_zero(self):
        response = await self.client.get(
            "/api/clients",
            headers=self.auth_a,
            params={"search": "no-such-client-anywhere"},
        )

        payload = response.json()["data"]
        self.assertEqual(0, payload["total"])
        self.assertEqual([], payload["items"])
        self.assertEqual(1, payload["totalPages"])

    async def test_oversized_page_size_is_rejected_at_the_route(self):
        response = await self.client.get(
            "/api/clients", headers=self.auth_a, params={"pageSize": 1000}
        )

        self.assertEqual(422, response.status_code, response.text)

    # ── GET /api/clients/:id — card, history, not-found, tenancy ─────────────

    async def test_card_missing_authorization_is_refused(self):
        response = await self.client.get(f"/api/clients/{self.client_with_history}")

        self.assertEqual(401, response.status_code, response.text)

    async def test_card_returns_the_client_and_its_history_oldest_first(self):
        response = await self.client.get(
            f"/api/clients/{self.client_with_history}", headers=self.auth_a
        )

        self.assertEqual(200, response.status_code, response.text)
        data = response.json()["data"]
        self.assertEqual(str(self.client_with_history), data["id"])
        history = data["interactionHistory"]
        self.assertEqual(["First email", "Second call"], [h["summary"] for h in history])
        self.assertEqual("Bob", history[0]["user"])
        self.assertEqual("email", history[0]["type"])

    async def test_card_carries_exactly_the_contract_fields_no_audit_log(self):
        response = await self.client.get(
            f"/api/clients/{self.client_with_history}", headers=self.auth_a
        )

        data = response.json()["data"]
        self.assertEqual(
            {
                "id", "name", "companyCode", "vatCode", "address", "country",
                "phone", "email", "status", "paymentTermsDays", "notes", "createdAt",
                "interactionHistory",
            },
            set(data.keys()),
        )

    async def test_unknown_id_is_client_not_found(self):
        response = await self.client.get(f"/api/clients/{uuid4()}", headers=self.auth_a)

        self.assertEqual(404, response.status_code, response.text)
        detail = response.json()["detail"]
        self.assertEqual({"message", "code"}, set(detail.keys()))
        self.assertEqual("CLIENT_NOT_FOUND", detail["code"])

    async def test_a_foreign_tenants_client_is_also_client_not_found(self):
        response = await self.client.get(
            f"/api/clients/{self.client_b}", headers=self.auth_a
        )

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("CLIENT_NOT_FOUND", response.json()["detail"]["code"])


if __name__ == "__main__":
    unittest.main()
