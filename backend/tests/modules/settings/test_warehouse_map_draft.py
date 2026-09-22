"""П31 доказана поведением: `Save` (PUT карты) снимает черновик.

«Save lifts the draft mark» — утверждение о ПОВЕДЕНИИ, поэтому оно проверяется
здесь, а не поиском строки `is_draft` по файлам: до 2026-09-22 критерий приёмки
считал файлы, в которых встречается `is_draft`, одно из совпадений было прозой в
докстринге `shared/models.py`, и удаление самого `UPDATE` в
`warehouse_map/repository.py` оставляло критерий зелёным.

Харнесс тот же, что в `tests/modules/auth/test_current_user.py`: приватная
временная SQLite, реальный HTTP через ASGI, реальная аутентификация по Bearer;
подменяется только `get_db`. Postgres не нужен, миграции не нужны.
"""

import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from uuid import uuid4

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, insert, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles, deregister
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

# Импортирующий database создаёт ленивый движок. Даже он не должен смотреть в .env.
with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/warehouse-map-c9-unused.sqlite"},
):
    from app.core.database import get_db
    from app.core.exceptions import AppError
    from app.core.uploads.models import UploadedFile
    # Настоящий обработчик отказов берётся из приложения, а не переписывается
    # здесь: тест обязан доказывать поведение продукта, а не своё.
    from app.main import app_error_handler
    from app.modules.auth.shared.models import Tenant, User
    from app.modules.auth.shared.session_tokens import issue_session_token
    from app.modules.settings.features.warehouse_map.action import (
        router as warehouse_map_router,
    )
    from app.modules.settings.shared.models import WarehouseMap

IMAGE_MIME = "image/png"


class WarehouseMapDraftTests(unittest.IsolatedAsyncioTestCase):
    """П31: `PUT` карты — это `Save`, и он гасит черновик у файла своего арендатора."""

    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="warehouse-map-c9-")
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
        self.user_a = uuid4()
        self.file_a, self.file_b = uuid4(), uuid4()
        async with self.engine.begin() as conn:
            for model in (Tenant, User, UploadedFile, WarehouseMap):
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
            await conn.execute(
                insert(UploadedFile),
                [
                    self._file_row(self.file_a, self.tenant_a, "map-a.png"),
                    self._file_row(self.file_b, self.tenant_b, "map-b.png"),
                ],
            )

        self.statements = []
        event.listen(self.engine.sync_engine, "before_cursor_execute", self.record_sql)
        self.app = FastAPI()
        self.app.add_exception_handler(AppError, app_error_handler)
        self.app.include_router(warehouse_map_router)

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
            transport=ASGITransport(app=self.app), base_url="http://test"
        )
        self.addAsyncCleanup(self.client.aclose)
        self.token = issue_session_token(self.user_a)

    def _file_row(self, file_id, tenant_id, name: str) -> dict:
        """Черновик, как его кладёт загрузчик: `is_draft=True` и mime картинки."""
        return {
            "id": file_id,
            "tenant_id": tenant_id,
            "original_name": name,
            "storage_path": str(self.root / "uploads" / name),
            "size": 10,
            "mime": IMAGE_MIME,
            "is_draft": True,
        }

    def record_sql(self, conn, cursor, statement, parameters, context, executemany):
        # Параметры запоминаются рядом с текстом: по ним проверяется, что `WHERE`
        # целится в ожидаемый файл, а не в первое попавшееся (F5).
        self.statements.append((statement, parameters))

    async def draft_of(self, file_id) -> bool:
        async with self.sessions() as db:
            return (
                await db.execute(
                    select(UploadedFile.is_draft).where(UploadedFile.id == file_id)
                )
            ).scalar_one()

    async def save(self, file_id):
        return await self.client.put(
            "/api/settings/warehouse-map",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"fileId": str(file_id), "mime": IMAGE_MIME},
        )

    async def test_save_lifts_the_draft_mark_and_answers_the_map(self):
        response = await self.save(self.file_a)

        self.assertEqual(200, response.status_code, response.text)
        data = response.json()["data"]
        self.assertEqual(str(self.file_a), data["fileId"])
        # Ссылка выведена на чтении (П11), а не взята из тела.
        self.assertEqual("/static/uploads/map-a.png", data["url"])

        self.assertFalse(await self.draft_of(self.file_a))
        updates = [
            (sql, parameters)
            for sql, parameters in self.statements
            if sql.lstrip().upper().startswith("UPDATE UPLOADED_FILES")
        ]
        self.assertEqual(1, len(updates), self.statements)
        update_sql, update_parameters = updates[0]
        self.assertIn("is_draft", update_sql)
        # П31 держится не только на ЧТЕНИИ. Чужой файл до `UPDATE` не доходит —
        # отказ приходит на чтении, — поэтому снятие тенант-предиката из самого
        # `UPDATE` оставалось незамеченным (F5, 2026-09-22). Утверждение ниже
        # проверяет САМ `UPDATE`: он фильтрует по `tenant_id` и целится в свой файл.
        # Драйвер разворачивает UUID в hex без дефисов — сравниваем в одном виде.
        self.assertIn("tenant_id", update_sql)
        self.assertIn(
            str(self.file_a).replace("-", ""),
            [str(value).replace("-", "") for value in update_parameters],
        )
        async with self.sessions() as db:
            row = (
                await db.execute(
                    select(WarehouseMap).where(WarehouseMap.tenant_id == self.tenant_a)
                )
            ).scalar_one_or_none()
        self.assertIsNotNone(row, "карта арендатора A не записана")
        self.assertEqual(str(self.file_a), row.map_file_id)

    async def test_another_tenants_file_is_neither_saved_nor_confirmed(self):
        """`UPDATE` скоуплен арендатором: чужой файл не найден и остаётся черновиком."""
        response = await self.save(self.file_b)

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("NOT_FOUND", response.json()["detail"]["code"])
        self.assertTrue(await self.draft_of(self.file_b))
        self.assertEqual(
            [],
            [
                sql
                for sql, _ in self.statements
                if sql.lstrip().upper().startswith("UPDATE")
            ],
            self.statements,
        )
