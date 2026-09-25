"""M(idempotency) — the server-side `Idempotency-Key` store, no routes yet.

A private temporary SQLite database, same style as
`tests/modules/auth/test_current_user.py`: JSONB is compiled to JSON for
SQLite only, production models are unchanged. No HTTP layer exists for this
module, so tests call `internal_api.interface` directly against a real
session.
"""

import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from sqlalchemy import insert, update
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles, deregister
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

with patch.dict(
    os.environ, {"DATABASE_URL": "sqlite+aiosqlite:////tmp/idempotency-c0-unused.sqlite"}
):
    from app.core.exceptions import ConflictError
    from app.modules.auth.shared.models import Tenant
    from app.modules.idempotency.internal_api.interface import (
        CachedResponse,
        begin_attempt,
        complete_attempt,
        purge_expired_keys,
    )
    from app.modules.idempotency.shared.models import IdempotencyKey


class IdempotencyStoreCase(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="idempotency-c0-")
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
        async with self.engine.begin() as conn:
            for model in (Tenant, IdempotencyKey):
                await conn.run_sync(lambda sync, model=model: model.__table__.create(sync))
            await conn.execute(
                insert(Tenant),
                [
                    {"id": self.tenant_a, "name": "A", "slug": "a"},
                    {"id": self.tenant_b, "name": "B", "slug": "b"},
                ],
            )

    async def _expire(self, tenant_id, key, method, path):
        """Backdate a record's expires_at, simulating the 24h TTL elapsing."""
        async with self.sessions() as db:
            await db.execute(
                update(IdempotencyKey)
                .where(
                    IdempotencyKey.tenant_id == tenant_id,
                    IdempotencyKey.key == key,
                    IdempotencyKey.method == method,
                    IdempotencyKey.path == path,
                )
                .values(expires_at=datetime.now(timezone.utc) - timedelta(hours=1))
            )
            await db.commit()


class FirstAttemptExecutes(IdempotencyStoreCase):
    async def test_no_record_means_execute(self):
        async with self.sessions() as db:
            decision = await begin_attempt(
                db, self.tenant_a, "key-1", "POST", "/api/orders/x/shipments"
            )
            await db.commit()
        self.assertIsNone(decision)


class AddressedByAllFourColumns(IdempotencyStoreCase):
    """Same key, different method or path — a different record entirely.

    Mutation criterion from the task: drop `method` or `path` from the
    lookup (or from the uniqueness), and one of these two assertions turns
    a real cache hit into a false one — the second call would come back as
    `None` here only if the code correctly treats method/path as part of
    the address.
    """

    async def test_same_key_different_method_is_a_different_record(self):
        path = "/api/orders/x/shipments/y"
        async with self.sessions() as db:
            await begin_attempt(db, self.tenant_a, "shared-key", "PATCH", path)
            await complete_attempt(
                db, self.tenant_a, "shared-key", "PATCH", path,
                200, {"id": "shipment-1", "status": "adjusted"},
            )
            await db.commit()

        async with self.sessions() as db:
            decision = await begin_attempt(db, self.tenant_a, "shared-key", "DELETE", path)
            await db.commit()
        self.assertIsNone(
            decision,
            "a key completed on PATCH must not answer a DELETE on the same path "
            "with the PATCH's cached response",
        )

    async def test_same_key_different_path_is_a_different_record(self):
        async with self.sessions() as db:
            await begin_attempt(db, self.tenant_a, "shared-key", "POST", "/api/orders/1/shipments")
            await complete_attempt(
                db, self.tenant_a, "shared-key", "POST", "/api/orders/1/shipments",
                201, {"id": "shipment-1"},
            )
            await db.commit()

        async with self.sessions() as db:
            decision = await begin_attempt(
                db, self.tenant_a, "shared-key", "POST", "/api/orders/2/shipments"
            )
            await db.commit()
        self.assertIsNone(
            decision,
            "the same key on a different order's path must not reuse order 1's "
            "cached response",
        )


class CompletedRecordReplaysVerbatim(IdempotencyStoreCase):
    async def test_completed_success_is_returned_without_re_executing(self):
        key, method, path = "key-2", "POST", "/api/orders/x/payments"
        async with self.sessions() as db:
            first = await begin_attempt(db, self.tenant_a, key, method, path)
            self.assertIsNone(first)
            await complete_attempt(
                db, self.tenant_a, key, method, path, 201, {"id": "payment-1", "paid": 500}
            )
            await db.commit()

        async with self.sessions() as db:
            replay = await begin_attempt(db, self.tenant_a, key, method, path)
            await db.commit()

        self.assertIsInstance(replay, CachedResponse)
        self.assertEqual(201, replay.status_code)
        self.assertEqual({"id": "payment-1", "paid": 500}, replay.body)

    async def test_a_cached_failure_replays_as_the_same_failure(self):
        key, method, path = "key-3", "POST", "/api/orders/x/returns"
        async with self.sessions() as db:
            await begin_attempt(db, self.tenant_a, key, method, path)
            await complete_attempt(
                db, self.tenant_a, key, method, path, 422,
                {"message": "Line already returned", "code": "VALIDATION_ERROR"},
            )
            await db.commit()

        async with self.sessions() as db:
            replay = await begin_attempt(db, self.tenant_a, key, method, path)
            await db.commit()

        self.assertIsInstance(replay, CachedResponse)
        self.assertEqual(422, replay.status_code)
        self.assertEqual("VALIDATION_ERROR", replay.body["code"])


class InProgressRecordConflicts(IdempotencyStoreCase):
    async def test_repeat_before_completion_raises_conflict(self):
        key, method, path = "key-4", "POST", "/api/orders/x/shipments"
        async with self.sessions() as db:
            first = await begin_attempt(db, self.tenant_a, key, method, path)
            self.assertIsNone(first)
            await db.commit()

        async with self.sessions() as db:
            with self.assertRaises(ConflictError):
                await begin_attempt(db, self.tenant_a, key, method, path)


class ExpiredRecordIsAbsent(IdempotencyStoreCase):
    async def test_expired_completed_record_allows_re_execution(self):
        key, method, path = "key-5", "POST", "/api/orders/x/payments"
        async with self.sessions() as db:
            await begin_attempt(db, self.tenant_a, key, method, path)
            await complete_attempt(db, self.tenant_a, key, method, path, 201, {"id": "payment-1"})
            await db.commit()

        await self._expire(self.tenant_a, key, method, path)

        async with self.sessions() as db:
            decision = await begin_attempt(db, self.tenant_a, key, method, path)
            await db.commit()
        self.assertIsNone(decision, "an expired record must be treated as absent, not replayed")

    async def test_expired_in_progress_record_allows_re_execution_instead_of_conflict(self):
        key, method, path = "key-6", "POST", "/api/orders/x/shipments"
        async with self.sessions() as db:
            await begin_attempt(db, self.tenant_a, key, method, path)
            await db.commit()

        await self._expire(self.tenant_a, key, method, path)

        async with self.sessions() as db:
            decision = await begin_attempt(db, self.tenant_a, key, method, path)
            await db.commit()
        self.assertIsNone(decision)


class TenantIsolation(IdempotencyStoreCase):
    async def test_same_key_of_another_tenant_does_not_collide(self):
        key, method, path = "key-7", "POST", "/api/orders/x/payments"
        async with self.sessions() as db:
            await begin_attempt(db, self.tenant_a, key, method, path)
            await complete_attempt(db, self.tenant_a, key, method, path, 201, {"id": "a-payment"})
            await db.commit()

        async with self.sessions() as db:
            decision = await begin_attempt(db, self.tenant_b, key, method, path)
            await db.commit()
        self.assertIsNone(
            decision,
            "tenant B must not see tenant A's completed record for the same key",
        )

    async def test_purge_only_removes_the_given_tenant_s_expired_rows(self):
        key, method, path = "key-8", "POST", "/api/orders/x/payments"
        async with self.sessions() as db:
            await begin_attempt(db, self.tenant_a, key, method, path)
            await complete_attempt(db, self.tenant_a, key, method, path, 201, {"id": "a"})
            await db.commit()
        async with self.sessions() as db:
            await begin_attempt(db, self.tenant_b, key, method, path)
            await complete_attempt(db, self.tenant_b, key, method, path, 201, {"id": "b"})
            await db.commit()

        await self._expire(self.tenant_a, key, method, path)

        async with self.sessions() as db:
            removed = await purge_expired_keys(db, self.tenant_a)
            await db.commit()
        self.assertEqual(1, removed)

        # Tenant B's still-fresh record must still answer as completed.
        async with self.sessions() as db:
            still_there = await begin_attempt(db, self.tenant_b, key, method, path)
            await db.commit()
        self.assertIsInstance(still_there, CachedResponse)


if __name__ == "__main__":
    unittest.main()
