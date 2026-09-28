"""Behaviour of `DELETE /api/clients/:id` and `DELETE /api/clients/:id/audit/:entryId`.

Same harness as `test_clients_write.py`: the real routers over ASGI against an
app assembled in the test, a private temporary SQLite database, real rows in
real tables; only `get_db` and `get_current_user` are overridden. No Postgres
and no Alembic — the fixture creates only the tables these routes touch.

Two things are checked the same way in every test: before asserting "now
nothing", the row is proven to have been there *first* — otherwise `0` is
satisfied by a store that has been silent all along, not by a deletion
(`roo_code/skills/verify.md` Л9, pitfalls #66 / #68).

    cd backend && python3 -m pytest tests/modules/clients/test_clients_delete.py -q
"""

from __future__ import annotations

import os
import tempfile
import unittest
from datetime import date, datetime, timezone
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/clients-delete-unused.sqlite"},
):
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient
    from sqlalchemy import insert, select
    from sqlalchemy.dialects.postgresql import JSONB
    from sqlalchemy.ext.compiler import compiles, deregister
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.core.database import get_db
    from app.core.exceptions import AppError
    from app.main import app_error_handler
    from app.modules.audit.shared.models import AuditEntry
    from app.modules.auth.internal_api.interface import CurrentUser, get_current_user
    from app.modules.auth.shared.models import Tenant, User
    from app.modules.clients.features.write_clients.action import router as write_router
    from app.modules.clients.shared.models import Client
    from app.modules.orders.shared.models import Order


TENANT_A = uuid4()
TENANT_B = uuid4()


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


def _client_row(client_id, tenant_id):
    return {
        "id": client_id,
        "tenant_id": tenant_id,
        "name": "Client",
        "company_code": f"CODE-{client_id}",
        "vat_code": f"VAT-{client_id}",
        "address": "Some street 1",
        "country": None,
        "phone": "+37060000000",
        "email": f"{client_id}@example.test",
        "status": "active",
        "payment_terms_days": 30,
        "notes": None,
        "created_at": date(2026, 1, 1),
    }


def _order_row(order_id, tenant_id, client_id):
    return {
        "id": order_id,
        "tenant_id": tenant_id,
        "client_id": client_id,
        "order_number": f"ORD-{order_id}",
        "document_type": "local",
        "status": "draft",
        "currency": "EUR",
        "vat_mode": "standard",
        "vat_percent": 21,
        "default_margin_percent": 15,
        "default_discount_percent": 0,
        "version": 1,
        "client_name": "Client",
        "client_vat_code": "VAT",
        "client_address": "Some street 1",
        "client_payment_terms_days": 30,
        "created_at": datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
    }


def _audit_row(entry_id, tenant_id, entity_id):
    return {
        "id": entry_id,
        "tenant_id": tenant_id,
        "entity_type": "client",
        "entity_id": entity_id,
        "user_id": None,
        "user_name_translations": {"ru": "Иван", "en": "Ivan", "lt": "Ivanas"},
        "user_initials": "IV",
        "property_translations": {"ru": "Статус", "en": "Status", "lt": "Bukle"},
        "old_value": "active",
        "new_value": "inactive",
        "sensitive": None,
        "timestamp": datetime(2026, 3, 1, 12, 0, 0, tzinfo=timezone.utc),
    }


class ClientsDeleteTestCase(unittest.IsolatedAsyncioTestCase):
    """Shared fixture: a private database with two tenants and their clients."""

    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="clients-delete-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

        # SQLite has no JSONB: compile it as plain JSON for the test database only.
        @compiles(JSONB, "sqlite")
        def sqlite_jsonb(type_, compiler, **kw):  # noqa: ARG001
            return "JSON"

        self.addCleanup(deregister, JSONB)

        self.engine = create_async_engine(
            "sqlite+aiosqlite:///" + str(self.root / "test.sqlite")
        )
        self.addAsyncCleanup(self.engine.dispose)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)

        self.client_a, self.client_b = uuid4(), uuid4()

        async with self.engine.begin() as conn:
            for model in (Tenant, User, Client, Order, AuditEntry):
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
            await conn.execute(
                insert(Client),
                [
                    _client_row(self.client_a, TENANT_A),
                    _client_row(self.client_b, TENANT_B),
                ],
            )

        self.client = await self._client(TENANT_A)

    def _build_app(self, tenant_id):
        app = FastAPI()
        app.add_exception_handler(AppError, app_error_handler)
        app.include_router(write_router)
        app.dependency_overrides[get_db] = _db_override(self.sessions)
        app.dependency_overrides[get_current_user] = _user_override(tenant_id)
        return app

    async def _client(self, tenant_id):
        client = AsyncClient(
            transport=ASGITransport(app=self._build_app(tenant_id), raise_app_exceptions=False),
            base_url="http://test",
        )
        self.addAsyncCleanup(client.aclose)
        return client

    async def _clients_in(self, tenant_id):
        async with self.sessions() as session:
            rows = (
                await session.execute(select(Client).where(Client.tenant_id == tenant_id))
            ).scalars().all()
        return list(rows)

    async def _audit_rows(self, entity_id):
        async with self.sessions() as session:
            rows = (
                await session.execute(
                    select(AuditEntry).where(AuditEntry.entity_id == entity_id)
                )
            ).scalars().all()
        return list(rows)

    async def _seed_order(self, client_id, tenant_id):
        order_id = uuid4()
        async with self.sessions() as session:
            await session.execute(insert(Order), [_order_row(order_id, tenant_id, client_id)])
            await session.commit()
        return order_id

    async def _seed_audit_entry(self, entity_id, tenant_id):
        entry_id = uuid4()
        async with self.sessions() as session:
            await session.execute(insert(AuditEntry), [_audit_row(entry_id, tenant_id, entity_id)])
            await session.commit()
        return entry_id


# ── DELETE /api/clients/:id ─────────────────────────────────────────────────


class DeleteClientTests(ClientsDeleteTestCase):
    async def test_delete_removes_the_row(self):
        self.assertEqual(1, len(await self._clients_in(TENANT_A)))

        response = await self.client.delete(f"/api/clients/{self.client_a}")

        self.assertEqual(200, response.status_code, response.text)
        self.assertTrue(response.json()["success"])
        self.assertEqual([], await self._clients_in(TENANT_A))

    async def test_a_client_with_an_order_is_refused_with_the_conflict_code(self):
        await self._seed_order(self.client_a, TENANT_A)

        response = await self.client.delete(f"/api/clients/{self.client_a}")

        self.assertEqual(409, response.status_code, response.text)
        # The refusal travels as a field, not as message text — the same shape
        # `00-conventions.md` §1 gives every refusal.
        self.assertEqual("CONFLICT", response.json()["detail"]["code"])
        self.assertEqual(1, len(await self._clients_in(TENANT_A)))

    async def test_an_unknown_client_is_client_not_found(self):
        response = await self.client.delete(f"/api/clients/{uuid4()}")

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("CLIENT_NOT_FOUND", response.json()["detail"]["code"])

    async def test_a_foreign_tenants_client_is_not_found_and_is_not_deleted(self):
        self.assertEqual(1, len(await self._clients_in(TENANT_B)))

        response = await self.client.delete(f"/api/clients/{self.client_b}")

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("CLIENT_NOT_FOUND", response.json()["detail"]["code"])
        self.assertEqual(1, len(await self._clients_in(TENANT_B)))


# ── DELETE /api/clients/:id/audit/:entryId ──────────────────────────────────


class DeleteClientAuditEntryTests(ClientsDeleteTestCase):
    async def test_delete_removes_the_entry(self):
        entry_id = await self._seed_audit_entry(self.client_a, TENANT_A)
        # Present first — `0` afterwards then means a deletion, not a store that
        # was empty all along.
        self.assertEqual(1, len(await self._audit_rows(self.client_a)))

        response = await self.client.delete(
            f"/api/clients/{self.client_a}/audit/{entry_id}"
        )

        self.assertEqual(200, response.status_code, response.text)
        self.assertEqual([], await self._audit_rows(self.client_a))

    async def test_an_unknown_entry_is_refused_and_nothing_is_removed(self):
        await self._seed_audit_entry(self.client_a, TENANT_A)
        self.assertEqual(1, len(await self._audit_rows(self.client_a)))

        response = await self.client.delete(
            f"/api/clients/{self.client_a}/audit/{uuid4()}"
        )

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("AUDIT_ENTRY_NOT_FOUND", response.json()["detail"]["code"])
        self.assertEqual(1, len(await self._audit_rows(self.client_a)))

    async def test_an_entry_of_another_client_of_the_same_tenant_is_not_deleted(self):
        """Ownership is checked per client, not per tenant: `delete_audit_entry`
        narrows by tenant only, so without the extra check a neighbor client's
        row would be removed with a 200."""
        other_client = uuid4()
        async with self.sessions() as session:
            await session.execute(insert(Client), [_client_row(other_client, TENANT_A)])
            await session.commit()
        entry_id = await self._seed_audit_entry(other_client, TENANT_A)
        self.assertEqual(1, len(await self._audit_rows(other_client)))

        response = await self.client.delete(
            f"/api/clients/{self.client_a}/audit/{entry_id}"
        )

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("AUDIT_ENTRY_NOT_FOUND", response.json()["detail"]["code"])
        self.assertEqual(1, len(await self._audit_rows(other_client)))

    async def test_an_entry_of_another_tenant_is_not_deleted(self):
        entry_id = await self._seed_audit_entry(self.client_b, TENANT_B)
        self.assertEqual(1, len(await self._audit_rows(self.client_b)))

        response = await self.client.delete(
            f"/api/clients/{self.client_a}/audit/{entry_id}"
        )

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("AUDIT_ENTRY_NOT_FOUND", response.json()["detail"]["code"])
        self.assertEqual(1, len(await self._audit_rows(self.client_b)))


if __name__ == "__main__":
    unittest.main()
