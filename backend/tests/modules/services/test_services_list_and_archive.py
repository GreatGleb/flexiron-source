"""Behaviour of `GET /api/services` and `DELETE /api/services/:id`.

Real request, real query, real (private, temporary) SQLite database — the same
harness as `tests/modules/warehouse/test_batches_list.py`: only `get_db` and
`get_current_user` are replaced, the router and the `AppError` handler are the
product's own. The repository's actual `select(...)`/`WHERE`/`ORDER BY`/`LIMIT`
runs against real rows, so dropping `archived_at IS NULL` from the list query,
sorting the names by the reader's translation instead of the English one, or
removing the row instead of stamping `archived_at` reddens a test here on its own.

    cd backend && python3 -m pytest tests/modules/services/test_services_list_and_archive.py -q
"""

from __future__ import annotations

import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/services-list-archive-unused.sqlite"},
):
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient
    from sqlalchemy import insert, select
    from sqlalchemy.dialects.postgresql import JSONB
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.ext.compiler import compiles, deregister

    from app.core.database import get_db
    from app.core.exceptions import AppError
    from app.main import app_error_handler
    from app.modules.auth.internal_api.interface import CurrentUser, get_current_user
    from app.modules.auth.shared.models import Tenant
    from app.modules.services.features.catalog.action import (
        router as catalog_router,
    )
    from app.modules.services.shared.models import Service
    from app.modules.settings.shared.models import Currency, Uom


TENANT_A = uuid4()
TENANT_B = uuid4()

#: The nine fields of the card — the list item is the card, there is no lighter
#: form (`roo_code/roo-context/api/services.md`, "GET /api/services").
CARD_FIELDS = {
    "id",
    "name",
    "costPrice",
    "sellingPrice",
    "currencyId",
    "uomId",
    "description",
    "createdAt",
    "updatedAt",
}


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


class ServicesListTestCase(unittest.IsolatedAsyncioTestCase):
    """Shared fixture: two tenants, one of them with four live and one archived service."""

    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="services-list-archive-")
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

        self.currency_a, self.uom_a = uuid4(), uuid4()

        # Insertion order is the storage order an unsorted list must return:
        # C, A, B, Widget. It differs from the English name order (A, B, C,
        # Widget) and from the Russian one (B, C, Widget, A), so "default",
        # "unknown sortBy" and "reader's translation" are never accidentally equal.
        self.service_c = uuid4()  # en "Charlie Sort", ru "Арбуз"
        self.service_a = uuid4()  # en "Alpha Sort",   ru "Якорь"  — has a description
        self.service_b = uuid4()  # en "Bravo Sort",   ru "Анкер"
        self.service_lt = uuid4()  # en "Widget", lt "Unikali detalė" — matchable only in lt
        self.service_archived = uuid4()  # archived_at already set — must stay invisible
        self.service_foreign = uuid4()  # tenant B — inaccessible to tenant A

        base = datetime(2026, 1, 1, tzinfo=timezone.utc)
        self.base = base

        async with self.engine.begin() as conn:
            for model in (Tenant, Currency, Uom, Service):
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
                insert(Service),
                [
                    self._service(
                        self.service_c,
                        TENANT_A,
                        {"en": "Charlie Sort", "ru": "Арбуз", "lt": ""},
                        cost=30,
                        selling=40,
                        created=base + timedelta(days=3),
                    ),
                    self._service(
                        self.service_a,
                        TENANT_A,
                        {"en": "Alpha Sort", "ru": "Якорь", "lt": ""},
                        cost=10,
                        selling=20,
                        created=base + timedelta(days=1),
                        description={"en": "Alpha work"},
                    ),
                    self._service(
                        self.service_b,
                        TENANT_A,
                        {"en": "Bravo Sort", "ru": "Анкер", "lt": ""},
                        cost=20,
                        selling=10,
                        created=base + timedelta(days=2),
                    ),
                    self._service(
                        self.service_lt,
                        TENANT_A,
                        {"en": "Widget", "ru": "Виджет", "lt": "Unikali detalė"},
                        cost=5,
                        selling=5,
                        created=base + timedelta(days=4),
                    ),
                    self._service(
                        self.service_archived,
                        TENANT_A,
                        {"en": "Archived One", "ru": "Архивная", "lt": ""},
                        cost=7,
                        selling=7,
                        created=base,
                        archived_at=base,
                    ),
                    self._service(
                        self.service_foreign,
                        TENANT_B,
                        {"en": "Foreign Service", "ru": "Чужая", "lt": ""},
                        cost=9,
                        selling=9,
                        created=base,
                    ),
                ],
            )

    def _service(
        self,
        service_id,
        tenant_id,
        name_translations,
        *,
        cost,
        selling,
        created,
        description=None,
        archived_at=None,
    ) -> dict:
        return {
            "id": service_id,
            "tenant_id": tenant_id,
            "name_translations": name_translations,
            "cost_price": cost,
            "selling_price": selling,
            "currency_id": self.currency_a,
            "uom_id": self.uom_a,
            "description_translations": description,
            "created_at": created,
            "updated_at": created,
            "archived_at": archived_at,
        }

    def _build_app(self, *, tenant_id=TENANT_A, authenticated=True):
        app = FastAPI()
        app.add_exception_handler(AppError, app_error_handler)
        app.include_router(catalog_router)
        app.dependency_overrides[get_db] = _db_override(self.sessions)
        if authenticated:
            app.dependency_overrides[get_current_user] = _user_override(tenant_id)
        return app

    async def _client(self, app):
        client = AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://test",
        )
        self.addAsyncCleanup(client.aclose)
        return client

    async def _authed_client(self):
        return await self._client(self._build_app())

    async def _listed_ids(self, client, **params) -> list[str]:
        response = await client.get("/api/services", params=params)
        self.assertEqual(200, response.status_code, response.text)
        return [item["id"] for item in response.json()["data"]["items"]]

    async def _row(self, service_id):
        async with self.sessions() as session:
            return (
                await session.execute(
                    select(Service).where(Service.id == service_id)
                )
            ).scalar_one_or_none()


# ── GET /api/services — auth, envelope, card shape ─────────────────────────────


class ServicesListShapeTests(ServicesListTestCase):
    async def test_missing_authorization_is_refused(self):
        client = await self._client(self._build_app(authenticated=False))

        response = await client.get("/api/services")

        self.assertEqual(401, response.status_code, response.text)

    async def test_envelope_carries_pagination_keys_and_only_live_own_rows(self):
        client = await self._authed_client()

        response = await client.get("/api/services")

        self.assertEqual(200, response.status_code, response.text)
        payload = response.json()["data"]
        self.assertEqual(
            {"items", "total", "page", "pageSize", "totalPages"}, set(payload.keys())
        )
        self.assertEqual(4, payload["total"])
        self.assertEqual(1, payload["page"])
        self.assertEqual(25, payload["pageSize"])
        self.assertEqual(1, payload["totalPages"])
        ids = {item["id"] for item in payload["items"]}
        self.assertEqual(
            {
                str(self.service_a),
                str(self.service_b),
                str(self.service_c),
                str(self.service_lt),
            },
            ids,
        )

    async def test_first_item_carries_exactly_the_nine_card_fields(self):
        client = await self._authed_client()

        response = await client.get("/api/services")

        items = {item["id"]: item for item in response.json()["data"]["items"]}
        described = items[str(self.service_a)]
        self.assertEqual(CARD_FIELDS, set(described.keys()))
        self.assertEqual({"en": "Alpha work", "ru": "", "lt": ""}, described["description"])
        self.assertNotIn("description", items[str(self.service_b)])

    async def test_card_shape_is_unchanged_and_matches_the_list_item(self):
        client = await self._authed_client()

        listed = (await client.get("/api/services")).json()["data"]["items"]
        listed_by_id = {item["id"]: item for item in listed}
        card = (await client.get(f"/api/services/{self.service_a}")).json()["data"]

        self.assertEqual(set(listed_by_id[str(self.service_a)].keys()), set(card.keys()))


# ── GET /api/services — search, sort, pagination ───────────────────────────────


class ServicesListSearchTests(ServicesListTestCase):
    async def test_search_finds_a_service_by_its_lithuanian_translation_only(self):
        client = await self._authed_client()

        ids = await self._listed_ids(client, search="unikali")

        self.assertEqual([str(self.service_lt)], ids)

    async def test_search_reads_all_three_translations(self):
        client = await self._authed_client()

        # The Cyrillic terms are given in the stored case on purpose: SQLite's
        # `lower()` is ASCII-only, so a case-insensitive Cyrillic match cannot be
        # proven there even though PostgreSQL's `ILIKE` does it. The Latin terms
        # carry the case-insensitivity assertion; the Cyrillic ones carry "the
        # ru key is read at all".
        for term, expected in (
            ("charlie", self.service_c),
            ("Арбуз", self.service_c),
            ("unikali", self.service_lt),
        ):
            with self.subTest(term=term):
                ids = await self._listed_ids(client, search=term)
                self.assertEqual([str(expected)], ids)


class ServicesListSortTests(ServicesListTestCase):
    async def test_default_order_is_english_name_ascending(self):
        client = await self._authed_client()

        ids = await self._listed_ids(client)

        self.assertEqual(
            [
                str(self.service_a),
                str(self.service_b),
                str(self.service_c),
                str(self.service_lt),
            ],
            ids,
        )

    async def test_name_sort_uses_english_variant_not_the_readers_translation(self):
        client = await self._authed_client()

        ids = await self._listed_ids(client, sortBy="name", sortDir="asc")

        self.assertEqual(
            [
                str(self.service_a),
                str(self.service_b),
                str(self.service_c),
                str(self.service_lt),
            ],
            ids,
        )
        # The reader's translation (ru) would order these B, C, Widget, A — so
        # asserting the English order is what reddens a locale-bound mutation.
        self.assertNotEqual(
            [
                str(self.service_b),
                str(self.service_c),
                str(self.service_lt),
                str(self.service_a),
            ],
            ids,
        )

    async def test_name_sort_descending_reverses(self):
        client = await self._authed_client()

        ids = await self._listed_ids(client, sortBy="name", sortDir="desc")

        self.assertEqual(
            [
                str(self.service_lt),
                str(self.service_c),
                str(self.service_b),
                str(self.service_a),
            ],
            ids,
        )

    async def test_unknown_sort_by_is_not_an_error_and_keeps_storage_order(self):
        client = await self._authed_client()

        ids = await self._listed_ids(client, sortBy="bogus")

        self.assertEqual(
            [
                str(self.service_c),
                str(self.service_a),
                str(self.service_b),
                str(self.service_lt),
            ],
            ids,
        )
        self.assertNotEqual(
            [
                str(self.service_a),
                str(self.service_b),
                str(self.service_c),
                str(self.service_lt),
            ],
            ids,
        )

    async def test_empty_sort_by_means_no_sort_too(self):
        client = await self._authed_client()

        ids = await self._listed_ids(client, sortBy="")

        self.assertEqual(
            [
                str(self.service_c),
                str(self.service_a),
                str(self.service_b),
                str(self.service_lt),
            ],
            ids,
        )

    async def test_all_five_params_may_arrive_empty(self):
        """The client sends all five always, possibly empty; the server must not
        require any param's absence, and an empty value means "no filter"."""
        client = await self._authed_client()

        response = await client.get(
            "/api/services",
            params={
                "search": "",
                "sortBy": "",
                "sortDir": "",
                "page": "",
                "pageSize": "",
            },
        )

        self.assertEqual(200, response.status_code, response.text)
        payload = response.json()["data"]
        self.assertEqual(1, payload["page"])
        self.assertEqual(25, payload["pageSize"])
        self.assertEqual(
            [
                str(self.service_c),
                str(self.service_a),
                str(self.service_b),
                str(self.service_lt),
            ],
            [item["id"] for item in payload["items"]],
        )


class ServicesListPaginationTests(ServicesListTestCase):
    async def test_page_size_1000_is_accepted(self):
        client = await self._authed_client()

        response = await client.get("/api/services", params={"pageSize": "1000"})

        self.assertEqual(200, response.status_code, response.text)
        self.assertEqual(1000, response.json()["data"]["pageSize"])

    async def test_page_beyond_the_end_returns_empty_items_not_404(self):
        client = await self._authed_client()

        response = await client.get("/api/services", params={"page": "5", "pageSize": "25"})

        self.assertEqual(200, response.status_code, response.text)
        payload = response.json()["data"]
        self.assertEqual([], payload["items"])
        self.assertEqual(4, payload["total"])

    async def test_pagination_splits_the_sorted_list(self):
        client = await self._authed_client()

        response = await client.get(
            "/api/services", params={"sortBy": "name", "page": "2", "pageSize": "2"}
        )

        payload = response.json()["data"]
        self.assertEqual([str(self.service_c), str(self.service_lt)],
                         [item["id"] for item in payload["items"]])
        self.assertEqual(4, payload["total"])
        self.assertEqual(2, payload["totalPages"])


# ── GET /api/services — archived and foreign rows ──────────────────────────────


class ServicesListVisibilityTests(ServicesListTestCase):
    async def test_archived_service_is_absent_from_the_list_but_stays_in_the_table(self):
        client = await self._authed_client()

        ids = await self._listed_ids(client)

        self.assertNotIn(str(self.service_archived), ids)
        row = await self._row(self.service_archived)
        self.assertIsNotNone(row, "the archived row must stay in the table")
        self.assertIsNotNone(row.archived_at)

    async def test_foreign_tenants_service_is_invisible(self):
        client = await self._authed_client()

        ids = await self._listed_ids(client)

        self.assertNotIn(str(self.service_foreign), ids)


# ── DELETE /api/services/:id — archive, not delete ─────────────────────────────


class ServicesArchiveTests(ServicesListTestCase):
    async def test_delete_archives_the_row_and_does_not_remove_it(self):
        client = await self._authed_client()

        response = await client.delete(f"/api/services/{self.service_a}")

        self.assertEqual(200, response.status_code, response.text)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertIsNone(body.get("data"))
        self.assertNotIn("id", body)

        row = await self._row(self.service_a)
        self.assertIsNotNone(row, "the row must stay in the table")
        self.assertIsNotNone(row.archived_at)

        # It leaves the list, but the card still reads it (П44).
        listed = await self._listed_ids(client)
        self.assertNotIn(str(self.service_a), listed)
        card = await client.get(f"/api/services/{self.service_a}")
        self.assertEqual(200, card.status_code, card.text)

    async def test_repeated_delete_of_the_same_service_is_404(self):
        client = await self._authed_client()

        first = await client.delete(f"/api/services/{self.service_a}")
        self.assertEqual(200, first.status_code, first.text)
        second = await client.delete(f"/api/services/{self.service_a}")

        self.assertEqual(404, second.status_code, second.text)
        self.assertEqual("CATALOG_SERVICE_NOT_FOUND", second.json()["detail"]["code"])

    async def test_delete_of_an_already_archived_service_is_404(self):
        client = await self._authed_client()

        response = await client.delete(f"/api/services/{self.service_archived}")

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("CATALOG_SERVICE_NOT_FOUND", response.json()["detail"]["code"])

    async def test_delete_of_a_foreign_tenants_service_is_404_and_changes_nothing(self):
        client = await self._authed_client()

        response = await client.delete(f"/api/services/{self.service_foreign}")

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("CATALOG_SERVICE_NOT_FOUND", response.json()["detail"]["code"])
        row = await self._row(self.service_foreign)
        self.assertIsNotNone(row)
        self.assertIsNone(row.archived_at, "a foreign row must not be touched")

    async def test_delete_of_an_unknown_service_is_404(self):
        client = await self._authed_client()

        response = await client.delete(f"/api/services/{uuid4()}")

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("CATALOG_SERVICE_NOT_FOUND", response.json()["detail"]["code"])


if __name__ == "__main__":
    unittest.main()
