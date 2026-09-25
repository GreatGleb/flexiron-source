"""Behaviour of `GET /api/clients/:id/audit`.

Same harness as `test_clients_read.py`: a private temporary SQLite database,
the real router over ASGI, real Bearer authentication; only `get_db` is
replaced. Audit rows are seeded directly into the shared `audit_entries`
table (`app.modules.audit.shared.models.AuditEntry`) — this slice reads them
through `app.modules.audit.internal_api.interface.read_audit_entries_for_entity`,
never through a module-local copy.

    cd backend && python3 -m pytest tests/modules/clients/test_client_audit_read.py -q
"""

import os
import tempfile
import unittest
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import insert
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles, deregister
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/clients-audit-read-unused.sqlite"},
):
    from app.core.database import get_db
    from app.core.exceptions import AppError
    from app.main import app_error_handler
    from app.modules.audit.shared.models import AuditEntry
    from app.modules.auth.shared.models import Tenant, User
    from app.modules.auth.shared.session_tokens import issue_session_token
    from app.modules.clients.features.read_clients.action import (
        router as clients_read_router,
    )
    from app.modules.clients.shared.models import Client


class ClientAuditReadTests(unittest.IsolatedAsyncioTestCase):
    """Client audit journal — flat array, newest first, tenant-scoped."""

    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="clients-audit-read-")
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
        self.client_a = uuid4()
        self.client_b = uuid4()

        async with self.engine.begin() as conn:
            for model in (Tenant, User, Client, AuditEntry):
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

            def _client(id_, tenant_id):
                return {
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

            await conn.execute(
                insert(Client),
                [_client(self.client_a, self.tenant_a), _client(self.client_b, self.tenant_b)],
            )

            base = datetime(2026, 3, 1, 12, 0, 0, tzinfo=timezone.utc)

            def _entry(id_, tenant_id, entity_id, ts, old, new):
                return {
                    "id": id_,
                    "tenant_id": tenant_id,
                    "entity_type": "client",
                    "entity_id": entity_id,
                    "user_id": None,
                    "user_name_translations": {"ru": "Иван", "en": "Ivan", "lt": "Ivanas"},
                    "user_initials": "IV",
                    "property_translations": {
                        "ru": "Статус", "en": "Status", "lt": "Bukle",
                    },
                    "old_value": old,
                    "new_value": new,
                    "sensitive": None,
                    "timestamp": ts,
                }

            self.entry_oldest = uuid4()
            self.entry_middle = uuid4()
            self.entry_newest = uuid4()
            self.entry_foreign_tenant_same_entity = uuid4()
            self.entry_client_b = uuid4()

            await conn.execute(
                insert(AuditEntry),
                [
                    _entry(
                        self.entry_oldest, self.tenant_a, self.client_a,
                        base, "active", "inactive",
                    ),
                    _entry(
                        self.entry_middle, self.tenant_a, self.client_a,
                        base + timedelta(hours=1), "inactive", "active",
                    ),
                    _entry(
                        self.entry_newest, self.tenant_a, self.client_a,
                        base + timedelta(hours=2), "0", "30",
                    ),
                    # Same `entity_id` as client A's own rows, but a
                    # different `tenant_id` — a mutation guard. If the
                    # tenant filter were ever dropped from the read (kept
                    # only `entity_id`), this row would leak into tenant
                    # A's journal and, being the newest, would surface
                    # first — breaking both the count and the order
                    # assertions below.
                    _entry(
                        self.entry_foreign_tenant_same_entity, self.tenant_b,
                        self.client_a, base + timedelta(hours=3), "leaked", "leaked",
                    ),
                    _entry(
                        self.entry_client_b, self.tenant_b, self.client_b,
                        base, "x", "y",
                    ),
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

    async def test_missing_authorization_is_refused(self):
        response = await self.client.get(f"/api/clients/{self.client_a}/audit")

        self.assertEqual(401, response.status_code, response.text)

    async def test_response_is_a_flat_array_not_a_paginated_envelope(self):
        response = await self.client.get(
            f"/api/clients/{self.client_a}/audit", headers=self.auth_a
        )

        self.assertEqual(200, response.status_code, response.text)
        data = response.json()["data"]
        self.assertIsInstance(data, list)

    async def test_entry_carries_exactly_the_seven_wire_fields(self):
        response = await self.client.get(
            f"/api/clients/{self.client_a}/audit", headers=self.auth_a
        )

        entry = response.json()["data"][0]
        self.assertEqual(
            {"id", "timestamp", "user", "userInitials", "property", "oldValue", "newValue"},
            set(entry.keys()),
        )
        self.assertNotIn("user_name_translations", entry)
        self.assertNotIn("property_translations", entry)
        self.assertEqual({"ru", "en", "lt"}, set(entry["user"].keys()))
        self.assertEqual("Ivan", entry["user"]["en"])
        self.assertEqual("IV", entry["userInitials"])

    async def test_entries_are_ordered_newest_first(self):
        response = await self.client.get(
            f"/api/clients/{self.client_a}/audit", headers=self.auth_a
        )

        ids = [item["id"] for item in response.json()["data"]]
        # Three legitimate tenant-A entries, newest timestamp first. The
        # foreign-tenant row sharing the same `entity_id` (`base + 3h`,
        # which would sort first of all four) must not appear at all —
        # see the seeding comment above.
        self.assertEqual(
            [str(self.entry_newest), str(self.entry_middle), str(self.entry_oldest)],
            ids,
        )

    async def test_a_foreign_tenants_client_audit_is_empty(self):
        response = await self.client.get(
            f"/api/clients/{self.client_b}/audit", headers=self.auth_a
        )

        self.assertEqual(200, response.status_code, response.text)
        self.assertEqual([], response.json()["data"])

    async def test_unknown_client_id_is_an_empty_array_not_an_error(self):
        response = await self.client.get(
            f"/api/clients/{uuid4()}/audit", headers=self.auth_a
        )

        self.assertEqual(200, response.status_code, response.text)
        self.assertEqual([], response.json()["data"])


if __name__ == "__main__":
    unittest.main()
