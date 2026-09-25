"""The closed catalogue of audit entity types, and single-entity journal I/O.

Real (private, temporary) SQLite database — same harness as
`tests/modules/warehouse/test_movements_list.py`: a bare engine with only the
tables this test needs, no HTTP layer. `write_audit_entry` and
`delete_audit_entries_for_entity` are exercised directly to prove they refuse
an unknown entity type before touching the session; the ordering and tenant
isolation of `read_audit_entries_for_entity` are proven against rows inserted
directly, so the test controls `timestamp` and `id` instead of racing the
generator.

    cd backend && python3 -m pytest tests/modules/audit/test_audit_entity_catalogue.py -q
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
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/audit-entity-catalogue-unused.sqlite"},
):
    from sqlalchemy import insert, select
    from sqlalchemy.dialects.postgresql import JSONB
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.ext.compiler import compiles, deregister

    from app.modules.audit.internal_api.interface import (
        delete_audit_entries_for_entity,
        read_audit_entries_for_entity,
        write_audit_entry,
    )
    from app.modules.audit.shared.models import AUDIT_ENTITY_TYPES, AuditEntry
    from app.modules.auth.shared.models import Tenant


TENANT_A = uuid4()
TENANT_B = uuid4()


class AuditEntityTypeCatalogueTests(unittest.TestCase):
    """The Python-side catalogue: same nine values as the frontend's."""

    EXPECTED_TYPES = {
        "product",
        "order",
        "client",
        "supplier",
        "batch",
        "stock",
        "offcut",
        "movement",
        "deficit",
    }

    def test_catalogue_has_exactly_the_nine_frontend_values(self):
        self.assertEqual(self.EXPECTED_TYPES, set(AUDIT_ENTITY_TYPES))
        self.assertEqual(9, len(AUDIT_ENTITY_TYPES))

    def test_catalogue_has_no_duplicates(self):
        self.assertEqual(len(AUDIT_ENTITY_TYPES), len(set(AUDIT_ENTITY_TYPES)))


def _seed_entry(*, tenant_id, entity_type, entity_id, timestamp, entry_id=None):
    return {
        "id": entry_id or uuid4(),
        "tenant_id": tenant_id,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "user_id": None,
        "user_name_translations": {},
        "user_initials": "AB",
        "property_translations": {},
        "old_value": "old",
        "new_value": "new",
        "sensitive": None,
        "timestamp": timestamp,
    }


class AuditEntityCatalogueDbTestCase(unittest.IsolatedAsyncioTestCase):
    """Shared fixture: two tenants, no HTTP layer, direct interface calls."""

    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="audit-entity-catalogue-")
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

        async with self.engine.begin() as conn:
            for model in (Tenant, AuditEntry):
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

    async def test_write_rejects_unknown_entity_type_without_touching_session(self):
        async with self.sessions() as session:
            with self.assertRaises(ValueError):
                await write_audit_entry(
                    session,
                    tenant_id=TENANT_A,
                    entity_type="not-a-real-type",
                    entity_id=uuid4(),
                    user_id=None,
                    user_name_translations={},
                    user_initials="AB",
                    property_translations={},
                    old_value="old",
                    new_value="new",
                )
            count = (
                await session.execute(select(AuditEntry))
            ).scalars().all()
            self.assertEqual([], count)

    async def test_delete_for_entity_rejects_unknown_entity_type(self):
        async with self.sessions() as session:
            with self.assertRaises(ValueError):
                await delete_audit_entries_for_entity(
                    session,
                    tenant_id=TENANT_A,
                    entity_type="not-a-real-type",
                    entity_id=uuid4(),
                )

    async def test_write_accepts_a_cataloged_entity_type(self):
        async with self.sessions() as session:
            entry = await write_audit_entry(
                session,
                tenant_id=TENANT_A,
                entity_type="product",
                entity_id=uuid4(),
                user_id=None,
                user_name_translations={},
                user_initials="AB",
                property_translations={},
                old_value="old",
                new_value="new",
            )
            await session.commit()
            self.assertEqual("product", entry.entity_type)

    async def test_read_does_not_see_another_tenants_row(self):
        entity_id = uuid4()
        now = datetime.now(timezone.utc)
        async with self.engine.begin() as conn:
            await conn.execute(
                insert(AuditEntry),
                [
                    _seed_entry(
                        tenant_id=TENANT_A,
                        entity_type="batch",
                        entity_id=entity_id,
                        timestamp=now,
                    ),
                    _seed_entry(
                        tenant_id=TENANT_B,
                        entity_type="batch",
                        entity_id=entity_id,
                        timestamp=now,
                    ),
                ],
            )

        async with self.sessions() as session:
            rows = await read_audit_entries_for_entity(
                session,
                tenant_id=TENANT_A,
                entity_type="batch",
                entity_id=entity_id,
            )
            self.assertEqual(1, len(rows))
            self.assertEqual(TENANT_A, rows[0].tenant_id)

    async def test_read_orders_newest_first_then_by_id_on_a_tie(self):
        entity_id = uuid4()
        base = datetime.now(timezone.utc)
        older_id = uuid4()
        tie_low_id = uuid4()
        tie_high_id = uuid4()
        if tie_low_id > tie_high_id:
            tie_low_id, tie_high_id = tie_high_id, tie_low_id

        async with self.engine.begin() as conn:
            await conn.execute(
                insert(AuditEntry),
                [
                    _seed_entry(
                        tenant_id=TENANT_A,
                        entity_type="order",
                        entity_id=entity_id,
                        timestamp=base - timedelta(minutes=10),
                        entry_id=older_id,
                    ),
                    _seed_entry(
                        tenant_id=TENANT_A,
                        entity_type="order",
                        entity_id=entity_id,
                        timestamp=base,
                        entry_id=tie_low_id,
                    ),
                    _seed_entry(
                        tenant_id=TENANT_A,
                        entity_type="order",
                        entity_id=entity_id,
                        timestamp=base,
                        entry_id=tie_high_id,
                    ),
                ],
            )

        async with self.sessions() as session:
            rows = await read_audit_entries_for_entity(
                session,
                tenant_id=TENANT_A,
                entity_type="order",
                entity_id=entity_id,
            )
            self.assertEqual(
                [tie_high_id, tie_low_id, older_id],
                [row.id for row in rows],
            )

    async def test_read_is_purely_read_only(self):
        entity_id = uuid4()
        async with self.engine.begin() as conn:
            await conn.execute(
                insert(AuditEntry),
                [
                    _seed_entry(
                        tenant_id=TENANT_A,
                        entity_type="client",
                        entity_id=entity_id,
                        timestamp=datetime.now(timezone.utc),
                    )
                ],
            )

        async with self.sessions() as session:
            before = await read_audit_entries_for_entity(
                session,
                tenant_id=TENANT_A,
                entity_type="client",
                entity_id=entity_id,
            )
            after = await read_audit_entries_for_entity(
                session,
                tenant_id=TENANT_A,
                entity_type="client",
                entity_id=entity_id,
            )
            self.assertEqual(len(before), len(after))
            self.assertEqual(1, len(after))


if __name__ == "__main__":
    unittest.main()
