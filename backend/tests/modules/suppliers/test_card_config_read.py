"""Behaviour of `GET /api/config/fields` and `GET /api/config/sections`.

Real router, real request, real (private, temporary) SQLite database, the harness
committed in `test_batches_list.py`: the router and the `AppError` handler are the
product's own, only `get_db` and `get_current_user` are overridden. No mocked
session and no hand-picked fake statement evaluator — the repository's actual
`select(...)` / `WHERE` / `ORDER BY` runs against real rows, so a mutation that
drops the tenant filter, drops the `sort_order` ordering, or sends `options` as
`null` instead of leaving the key out reddens these tests on its own.

Supplier card config columns are JSONB, so — like `test_supplier_reference.py` —
JSONB is compiled as plain SQLite `JSON` for this test database only, then
deregistered on cleanup.

    cd backend && python3 -m pytest tests/modules/suppliers/test_card_config_read.py -q
"""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import insert
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles, deregister

with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/config-card-read-unused.sqlite"},
):
    from app.core.database import get_db
    from app.core.exceptions import AppError
    from app.main import app_error_handler
    from app.modules.auth.internal_api.interface import CurrentUser, get_current_user
    from app.modules.auth.shared.models import Tenant
    from app.modules.suppliers.features.card_config.action import router as config_router
    from app.modules.suppliers.features.card_config.repository import (
        list_field_definitions,
        list_section_fields,
        list_sections,
    )
    from app.modules.suppliers.shared.models import (
        FieldDefinition,
        SectionConfig,
        SectionField,
    )


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


class CardConfigReadTestCase(unittest.IsolatedAsyncioTestCase):
    """Shared fixture: two tenants, each with a field library, sections and links.

    Rows are seeded in the *reverse* of the order the contract demands — for the
    sections and for the links inside `General` alike — so returned order is
    caused by the query's `ORDER BY`, not by the insertion order.
    """

    async def asyncSetUp(self):
        @compiles(JSONB, "sqlite")
        def sqlite_jsonb(type_, compiler, **kw):
            return "JSON"

        self.addCleanup(deregister, JSONB)

        self.directory = tempfile.TemporaryDirectory(prefix="config-card-read-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

        self.engine = create_async_engine(
            "sqlite+aiosqlite:///" + str(self.root / "test.sqlite")
        )
        self.addAsyncCleanup(self.engine.dispose)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)

        async with self.engine.begin() as conn:
            for model in (Tenant, FieldDefinition, SectionConfig, SectionField):
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

            # `field_status` has translated options; `field_notes` has a NULL
            # `options` column — the one that must arrive without the key at all.
            # `field_country` carries the opposite `is_builtin` value on purpose:
            # whatever the flag means, it must not appear in the response.
            self.field_status = uuid4()
            self.field_notes = uuid4()
            self.field_country = uuid4()
            self.field_foreign = uuid4()

            await conn.execute(
                insert(FieldDefinition),
                [
                    {
                        "id": self.field_status,
                        "tenant_id": TENANT_A,
                        "name_translations": {
                            "ru": "Статус",
                            "en": "Status",
                            "lt": "Būsena",
                        },
                        "field_type": "enum",
                        "required": True,
                        "is_builtin": False,
                        "usage_count": 3,
                        "hidden": False,
                        "options": [
                            {"ru": "Новый", "en": "New", "lt": "Naujas"},
                            {"ru": "Старый", "en": "Old", "lt": "Senas"},
                        ],
                    },
                    {
                        "id": self.field_notes,
                        "tenant_id": TENANT_A,
                        "name_translations": {
                            "ru": "Заметки",
                            "en": "Notes",
                            "lt": "Pastabos",
                        },
                        "field_type": "text",
                        "required": False,
                        "is_builtin": False,
                        "usage_count": 0,
                        "hidden": True,
                        "options": None,
                    },
                    {
                        "id": self.field_country,
                        "tenant_id": TENANT_A,
                        "name_translations": {
                            "ru": "Страна",
                            "en": "Country",
                            "lt": "Šalis",
                        },
                        "field_type": "enum",
                        "required": False,
                        "is_builtin": True,
                        "usage_count": 1,
                        "hidden": False,
                        "options": [
                            {"ru": "Литва", "en": "Lithuania", "lt": "Lietuva"}
                        ],
                    },
                    {
                        "id": self.field_foreign,
                        "tenant_id": TENANT_B,
                        "name_translations": {
                            "ru": "Чужое",
                            "en": "Foreign",
                            "lt": "Svetimas",
                        },
                        "field_type": "text",
                        "required": False,
                        "is_builtin": False,
                        "usage_count": 9,
                        "hidden": False,
                        "options": None,
                    },
                ],
            )

            self.section_general = uuid4()
            self.section_logistics = uuid4()
            self.section_notes = uuid4()
            self.section_foreign = uuid4()

            await conn.execute(
                insert(SectionConfig),
                [
                    {
                        "id": self.section_notes,
                        "tenant_id": TENANT_A,
                        "name_translations": {
                            "ru": "Заметки",
                            "en": "Notes",
                            "lt": "Pastabos",
                        },
                        "sort_order": 2,
                        "collapsed": False,
                        "visible": True,
                        "system": True,
                    },
                    {
                        "id": self.section_general,
                        "tenant_id": TENANT_A,
                        "name_translations": {
                            "ru": "Общее",
                            "en": "General",
                            "lt": "Bendra",
                        },
                        "sort_order": 0,
                        "collapsed": False,
                        "visible": True,
                        "system": True,
                    },
                    {
                        "id": self.section_logistics,
                        "tenant_id": TENANT_A,
                        "name_translations": {
                            "ru": "Логистика",
                            "en": "Logistics",
                            "lt": "Logistika",
                        },
                        "sort_order": 1,
                        "collapsed": True,
                        "visible": False,
                        "system": False,
                    },
                    {
                        "id": self.section_foreign,
                        "tenant_id": TENANT_B,
                        "name_translations": {
                            "ru": "Чужое",
                            "en": "Foreign",
                            "lt": "Svetimas",
                        },
                        "sort_order": 0,
                        "collapsed": False,
                        "visible": True,
                        "system": False,
                    },
                ],
            )

            # `General` holds two links, inserted in reverse `sort_order`; one of
            # them is hidden, so `visible` is proven to travel per link. `Notes`
            # holds a third, to prove links are matched to their own section.
            await conn.execute(
                insert(SectionField),
                [
                    {
                        "id": uuid4(),
                        "tenant_id": TENANT_A,
                        "section_id": self.section_general,
                        "field_id": self.field_notes,
                        "sort_order": 1,
                        "visible": False,
                    },
                    {
                        "id": uuid4(),
                        "tenant_id": TENANT_A,
                        "section_id": self.section_general,
                        "field_id": self.field_status,
                        "sort_order": 0,
                        "visible": True,
                    },
                    {
                        "id": uuid4(),
                        "tenant_id": TENANT_A,
                        "section_id": self.section_notes,
                        "field_id": self.field_country,
                        "sort_order": 0,
                        "visible": True,
                    },
                    {
                        "id": uuid4(),
                        "tenant_id": TENANT_B,
                        "section_id": self.section_foreign,
                        "field_id": self.field_foreign,
                        "sort_order": 0,
                        "visible": True,
                    },
                ],
            )

    def _build_app(self, *, tenant_id=TENANT_A, authenticated=True):
        app = FastAPI()
        app.add_exception_handler(AppError, app_error_handler)
        app.include_router(config_router)
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

    async def _get(self, path, *, tenant_id=TENANT_A):
        client = await self._client(self._build_app(tenant_id=tenant_id))
        return await client.get(path)


# ── Repository — tenant scoping and the two orderings ──────────────────────────


class RepositoryTenancyTests(CardConfigReadTestCase):
    """Mutation target: drop `<Model>.tenant_id == tenant_id` from a query."""

    async def test_a_foreign_tenants_field_definition_is_absent(self):
        async with self.sessions() as session:
            items = await list_field_definitions(session, TENANT_A)

        self.assertEqual(
            {self.field_status, self.field_notes, self.field_country},
            {item.id for item in items},
        )

    async def test_a_foreign_tenants_section_is_absent(self):
        async with self.sessions() as session:
            sections = await list_sections(session, TENANT_A)
            links = await list_section_fields(
                session, TENANT_A, [section.id for section in sections]
            )

        self.assertNotIn(self.section_foreign, {section.id for section in sections})
        self.assertNotIn(self.field_foreign, {link.field_id for link in links})

    async def test_a_foreign_sections_links_stay_out_even_when_asked_for_by_id(self):
        async with self.sessions() as session:
            links = await list_section_fields(
                session, TENANT_A, [self.section_general, self.section_foreign]
            )

        self.assertEqual(
            {self.field_status, self.field_notes}, {link.field_id for link in links}
        )


class SectionOrderingTests(CardConfigReadTestCase):
    """Mutation target: drop `.order_by(SectionConfig.sort_order ...)` from the query."""

    async def test_sections_come_back_in_sort_order_not_insertion_order(self):
        async with self.sessions() as session:
            sections = await list_sections(session, TENANT_A)

        self.assertEqual(
            [self.section_general, self.section_logistics, self.section_notes],
            [section.id for section in sections],
        )
        self.assertEqual([0, 1, 2], [section.sort_order for section in sections])

    async def test_a_sections_links_come_back_in_their_own_sort_order(self):
        async with self.sessions() as session:
            links = await list_section_fields(
                session, TENANT_A, [self.section_general]
            )

        self.assertEqual(
            [self.field_status, self.field_notes], [link.field_id for link in links]
        )
        self.assertEqual([0, 1], [link.sort_order for link in links])


# ── HTTP — auth, envelope, field library shape ─────────────────────────────────


class FieldLibraryHttpTests(CardConfigReadTestCase):
    async def test_missing_authorization_is_refused(self):
        app = self._build_app(authenticated=False)
        client = await self._client(app)

        response = await client.get("/api/config/fields")

        self.assertEqual(401, response.status_code, response.text)

    async def test_library_is_a_bare_array_in_the_envelope(self):
        response = await self._get("/api/config/fields")

        self.assertEqual(200, response.status_code, response.text)
        payload = response.json()
        self.assertTrue(payload["success"])
        self.assertIsInstance(payload["data"], list)
        self.assertEqual(3, len(payload["data"]))

    async def test_field_item_carries_exactly_the_contract_fields(self):
        response = await self._get("/api/config/fields")

        item = {row["id"]: row for row in response.json()["data"]}[
            str(self.field_status)
        ]
        self.assertEqual(
            {"id", "name", "type", "required", "usageCount", "hidden", "options"},
            set(item.keys()),
        )

    async def test_no_builtin_flag_leaves_the_server(self):
        """`is_builtin` differs between `field_status` and `field_country` in the
        seed — neither value, nor the key holding it, may reach the wire."""
        response = await self._get("/api/config/fields")

        for row in response.json()["data"]:
            for key in ("is_builtin", "isBuiltin", "builtin"):
                self.assertNotIn(key, row)

    async def test_options_is_absent_when_the_column_is_null(self):
        response = await self._get("/api/config/fields")

        by_id = {row["id"]: row for row in response.json()["data"]}
        # `field_notes` is the row whose `options` column is NULL; the other two
        # carry a value, so their key must be there and this is a real difference.
        self.assertNotIn("options", by_id[str(self.field_notes)])
        self.assertIn("options", by_id[str(self.field_status)])

    async def test_options_with_values_is_an_array_of_translations(self):
        response = await self._get("/api/config/fields")

        item = {row["id"]: row for row in response.json()["data"]}[
            str(self.field_status)
        ]
        self.assertEqual(
            [
                {"ru": "Новый", "en": "New", "lt": "Naujas"},
                {"ru": "Старый", "en": "Old", "lt": "Senas"},
            ],
            item["options"],
        )

    async def test_name_is_a_translation_object_and_type_comes_from_field_type(self):
        response = await self._get("/api/config/fields")

        by_id = {row["id"]: row for row in response.json()["data"]}
        status = by_id[str(self.field_status)]
        notes = by_id[str(self.field_notes)]

        self.assertEqual({"ru", "en", "lt"}, set(status["name"].keys()))
        self.assertEqual("Статус", status["name"]["ru"])
        self.assertEqual("Status", status["name"]["en"])
        self.assertEqual("Būsena", status["name"]["lt"])

        # The column, not the flag: `field_type` is "enum" for one row and
        # "text" for the other, and each value arrives under the wire name `type`.
        self.assertEqual("enum", status["type"])
        self.assertEqual("text", notes["type"])
        self.assertNotIn("fieldType", status)
        self.assertNotIn("field_type", status)

    async def test_required_usage_count_and_hidden_come_from_their_own_columns(self):
        response = await self._get("/api/config/fields")

        by_id = {row["id"]: row for row in response.json()["data"]}
        status = by_id[str(self.field_status)]
        notes = by_id[str(self.field_notes)]

        self.assertIs(True, status["required"])
        self.assertEqual(3, status["usageCount"])
        self.assertIs(False, status["hidden"])

        self.assertIs(False, notes["required"])
        self.assertEqual(0, notes["usageCount"])
        self.assertIs(True, notes["hidden"])

    async def test_a_foreign_tenants_definition_is_invisible_over_http(self):
        response = await self._get("/api/config/fields")

        ids = {row["id"] for row in response.json()["data"]}
        self.assertNotIn(str(self.field_foreign), ids)


# ── HTTP — sections shape, ordering and tenant scoping ─────────────────────────


class SectionsHttpTests(CardConfigReadTestCase):
    async def test_missing_authorization_is_refused(self):
        app = self._build_app(authenticated=False)
        client = await self._client(app)

        response = await client.get("/api/config/sections")

        self.assertEqual(401, response.status_code, response.text)

    async def test_sections_are_a_bare_array_in_the_envelope(self):
        response = await self._get("/api/config/sections")

        self.assertEqual(200, response.status_code, response.text)
        payload = response.json()
        self.assertTrue(payload["success"])
        self.assertIsInstance(payload["data"], list)
        self.assertEqual(3, len(payload["data"]))

    async def test_sections_arrive_in_sort_order_over_http(self):
        response = await self._get("/api/config/sections")

        rows = response.json()["data"]
        self.assertEqual(
            [str(self.section_general), str(self.section_logistics), str(self.section_notes)],
            [row["id"] for row in rows],
        )
        self.assertEqual([0, 1, 2], [row["order"] for row in rows])

    async def test_section_item_names_the_order_field_order_not_sort_order(self):
        response = await self._get("/api/config/sections")

        row = {item["id"]: item for item in response.json()["data"]}[
            str(self.section_general)
        ]
        self.assertEqual(
            {"id", "name", "order", "collapsed", "visible", "system", "fields"},
            set(row.keys()),
        )
        self.assertNotIn("sort_order", row)
        self.assertNotIn("sortOrder", row)
        self.assertEqual({"ru", "en", "lt"}, set(row["name"].keys()))
        self.assertIs(True, row["system"])
        self.assertIs(False, row["collapsed"])

    async def test_section_fields_are_ordered_links_of_that_section(self):
        response = await self._get("/api/config/sections")

        rows = {item["id"]: item for item in response.json()["data"]}
        general = rows[str(self.section_general)]
        notes = rows[str(self.section_notes)]

        self.assertEqual(
            [
                {"fieldId": str(self.field_status), "order": 0, "visible": True},
                {"fieldId": str(self.field_notes), "order": 1, "visible": False},
            ],
            general["fields"],
        )
        for link in general["fields"]:
            self.assertEqual({"fieldId", "order", "visible"}, set(link.keys()))
            self.assertNotIn("sort_order", link)
            self.assertNotIn("sortOrder", link)

        self.assertEqual(
            [{"fieldId": str(self.field_country), "order": 0, "visible": True}],
            notes["fields"],
        )

    async def test_the_fields_the_section_carries_are_not_the_whole_library(self):
        response = await self._get("/api/config/sections")

        rows = {item["id"]: item for item in response.json()["data"]}
        carried = {
            link["fieldId"] for row in rows.values() for link in row["fields"]
        }
        self.assertEqual(
            {str(self.field_status), str(self.field_notes), str(self.field_country)},
            carried,
        )

    async def test_a_foreign_tenants_section_is_invisible_over_http(self):
        response = await self._get("/api/config/sections")

        ids = {row["id"] for row in response.json()["data"]}
        self.assertNotIn(str(self.section_foreign), ids)


if __name__ == "__main__":
    unittest.main()
