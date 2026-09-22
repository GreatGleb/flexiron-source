"""Mine under `app/core/uploads/service.py`: reads and deletes are tenant-scoped.

The slice is about the SIGNATURE as much as about the query.  `tenant_id` is a
required parameter with no default in both functions, so a caller that forgets it
fails on the signature (`TypeError`) instead of being quietly handed another
tenant's file.  That half is proved by calling the functions the forgetful way and
asserting the failure — not by a comment.

Harness: a private temporary SQLite database, real tables, real calls into the
service, no Postgres, no mocks of the product.  The same shape as
`tests/modules/settings/test_warehouse_map_draft.py`.
"""

import inspect
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from sqlalchemy import insert, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles, deregister
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

# The uploaded-file record carries foreign keys to `tenants` and `users`, so the
# auth models are imported for their metadata.  Importing them (like importing
# `app.core.database`) must not make the lazy engine read `.env`.
with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/uploads-service-unused.sqlite"},
):
    from app.core.uploads.models import UploadedFile
    from app.core.uploads.service import delete_file, get_file_by_id
    from app.modules.auth.shared.models import Tenant, User


class UploadsServiceTenantScopeTests(unittest.IsolatedAsyncioTestCase):
    """A file is found and deleted inside its own tenant — and only there."""

    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="uploads-service-")
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
        self.file_a, self.file_b = uuid4(), uuid4()
        async with self.engine.begin() as conn:
            for model in (Tenant, User, UploadedFile):
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
                insert(UploadedFile),
                [
                    self._row(self.file_a, self.tenant_a, "a.png"),
                    self._row(self.file_b, self.tenant_b, "b.png"),
                ],
            )

    def _row(self, file_id, tenant_id, name: str) -> dict:
        return {
            "id": file_id,
            "tenant_id": tenant_id,
            "original_name": name,
            "storage_path": str(self.root / "uploads" / name),
            "size": 11,
            "mime": "image/png",
            "is_draft": False,
        }

    async def exists(self, file_id) -> bool:
        async with self.sessions() as db:
            found = (
                await db.execute(
                    select(UploadedFile.id).where(UploadedFile.id == file_id)
                )
            ).scalar_one_or_none()
        return found is not None

    async def test_own_file_is_found(self):
        async with self.sessions() as db:
            found = await get_file_by_id(db, self.tenant_a, self.file_a)

        self.assertIsNotNone(found)
        self.assertEqual(self.file_a, found.id)

    async def test_another_tenants_file_is_not_found(self):
        async with self.sessions() as db:
            found = await get_file_by_id(db, self.tenant_a, self.file_b)

        self.assertIsNone(found, "чужой файл найден под своим арендатором")

    async def test_own_file_is_deleted(self):
        async with self.sessions() as db:
            deleted = await delete_file(db, self.tenant_a, self.file_a)
            await db.commit()

        self.assertTrue(deleted)
        self.assertFalse(await self.exists(self.file_a), "свой файл не удалён")

    async def test_another_tenants_file_is_not_deleted_and_survives(self):
        async with self.sessions() as db:
            deleted = await delete_file(db, self.tenant_a, self.file_b)
            await db.commit()

        self.assertFalse(deleted, "чужой файл удалён")
        self.assertTrue(await self.exists(self.file_b), "чужой файл исчез из БД")

    async def test_tenant_id_is_required_by_signature(self):
        """Забывчивый вызов падает на сигнатуре, а не отдаёт чужой файл."""
        for func in (get_file_by_id, delete_file):
            parameter = inspect.signature(func).parameters["tenant_id"]
            self.assertIs(
                parameter.default,
                inspect.Parameter.empty,
                f"{func.__name__}: у tenant_id появилось значение по умолчанию",
            )

        async with self.sessions() as db:
            with self.assertRaises(TypeError):
                await get_file_by_id(db, self.file_a)
            with self.assertRaises(TypeError):
                await delete_file(db, self.file_a)
