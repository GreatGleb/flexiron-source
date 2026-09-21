"""Real HTTP, signatures and SQL against a private temporary SQLite database.

Only get_db and the upload storage directory are replaced. Authentication is real.
JSONB compilation is adapted for SQLite tests only; production models are unchanged.
"""

import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from uuid import uuid4

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from itsdangerous import URLSafeTimedSerializer
from sqlalchemy import delete, event, insert, select, update
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles, deregister
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

# Importing database creates a lazy engine. Even that engine must not target .env.
with patch.dict(os.environ, {"DATABASE_URL": "sqlite+aiosqlite:////tmp/auth-c0-unused.sqlite"}):
    from app.core.database import get_db
    from app.core.config import settings
    from app.core.uploads import action as uploads
    from app.core.uploads.models import UploadedFile
    from app.modules.auth.features.me.action import router as me_router
    from app.modules.auth.shared.models import Tenant, User
    from app.modules.auth.shared.session_tokens import issue_session_token
    from app.modules.settings.features.crud.action import router as crud_router
    from app.modules.settings.features.profile.action import router as profile_router
    from app.modules.settings.shared.models import Currency


class AuthDatabaseCase(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="auth-c0-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.files = self.root / "uploads"
        self.files.mkdir()
        self.upload_patch = patch.object(uploads, "UPLOAD_DIR", self.files)
        self.upload_patch.start()
        self.addCleanup(self.upload_patch.stop)

        @compiles(JSONB, "sqlite")
        def sqlite_jsonb(type_, compiler, **kw):
            return "JSON"

        self.addCleanup(deregister, JSONB)
        self.engine = create_async_engine("sqlite+aiosqlite:///" + str(self.root / "test.sqlite"))
        self.addAsyncCleanup(self.engine.dispose)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        self.tenant_a, self.tenant_b, self.user_a, self.user_b = [uuid4() for _ in range(4)]
        self.currency_a, self.currency_b = uuid4(), uuid4()
        async with self.engine.begin() as conn:
            for model in (Tenant, User, Currency, UploadedFile):
                await conn.run_sync(lambda sync, model=model: model.__table__.create(sync))
            await conn.execute(insert(Tenant), [
                {"id": self.tenant_a, "name": "A", "slug": "a"},
                {"id": self.tenant_b, "name": "B", "slug": "b"},
            ])
            await conn.execute(insert(User), [
                {"id": user_id, "tenant_id": tenant_id, "email": "same@example.test",
                 "first_name": name, "last_name": "User", "password_hash": "fixture",
                 "secret_link_token": "secret-" + name}
                for user_id, tenant_id, name in (
                    (self.user_a, self.tenant_a, "A"), (self.user_b, self.tenant_b, "B"))
            ])
            await conn.execute(insert(Currency), [
                {"id": currency, "tenant_id": tenant, "code": code,
                 "name_translations": {"en": name}, "is_default": True}
                for currency, tenant, code, name in (
                    (self.currency_a, self.tenant_a, "EUR", "A euro"),
                    (self.currency_b, self.tenant_b, "USD", "B dollar"))
            ])
        self.statements = []
        event.listen(self.engine.sync_engine, "before_cursor_execute", self.record_sql)
        self.app = FastAPI()
        for router in (me_router, crud_router, profile_router, uploads.router):
            self.app.include_router(router)

        async def isolated_db():
            async with self.sessions() as session:
                try:
                    yield session
                    await session.commit()
                except Exception:
                    await session.rollback()
                    raise

        self.app.dependency_overrides[get_db] = isolated_db
        self.client = AsyncClient(transport=ASGITransport(app=self.app), base_url="http://test")
        self.addAsyncCleanup(self.client.aclose)
        self.token = issue_session_token(self.user_a)

    def record_sql(self, conn, cursor, statement, parameters, context, executemany):
        self.statements.append(statement)

    async def request_consumer(self, consumer, authorization=None):
        headers = {"X-Tenant-ID": str(self.tenant_b)}
        if authorization is not None:
            headers["Authorization"] = authorization
        query = "?tenant_id=" + str(self.tenant_b)
        if consumer == "upload":
            return await self.client.post("/api/uploads" + query, headers=headers,
                data={"tenant_id": str(self.tenant_b)},
                files={"file": ("test.pdf", b"tenant A data", "application/pdf")})
        paths = {"me": "/api/auth/me", "settings": "/api/settings/currencies",
                 "profile": "/api/settings/profile"}
        return await self.client.get(paths[consumer] + query, headers=headers)

    async def assert_denied_everywhere(self, authorization, code):
        for consumer in ("me", "settings", "profile", "upload"):
            with self.subTest(consumer=consumer, code=code):
                self.statements.clear()
                response = await self.request_consumer(consumer, authorization)
                self.assertEqual(401, response.status_code, response.text)
                self.assertEqual(code, response.json()["detail"]["code"])
                # No business table access or mutation after a failed dependency.
                for sql in self.statements:
                    self.assertTrue(sql.lstrip().upper().startswith("SELECT"), sql)
                    self.assertIn("FROM users", sql)
                self.assertEqual([], list(self.files.iterdir()))
        async with self.sessions() as db:
            self.assertEqual([], (await db.execute(select(UploadedFile))).scalars().all())


class CurrentUserTest(AuthDatabaseCase):
    async def test_missing_and_invalid_headers(self):
        await self.assert_denied_everywhere(None, "MISSING_TOKEN")
        for header in ("", "Basic abc", "Bearer", "Bearer ", "Bearer   ", "Bearer broken"):
            await self.assert_denied_everywhere(header, "INVALID_TOKEN")

    async def test_bad_signature_and_payload(self):
        wrong = URLSafeTimedSerializer("wrong-key", salt="session")
        await self.assert_denied_everywhere(
            "Bearer " + wrong.dumps({"user_id": str(self.user_a)}), "INVALID_TOKEN")
        signer = URLSafeTimedSerializer(settings.secret_key, salt="session")
        for payload in ([], None, {}, "string", 4, {"user_id": None},
                        {"user_id": 1}, {"user_id": []}, {"user_id": {}},
                        {"user_id": "not-uuid"}):
            await self.assert_denied_everywhere("Bearer " + signer.dumps(payload), "INVALID_TOKEN")

    async def test_age_boundary_and_fresh_token(self):
        with patch("itsdangerous.timed.TimestampSigner.get_timestamp", return_value=1_800_000_000):
            token = issue_session_token(self.user_a)
        with patch("itsdangerous.timed.TimestampSigner.get_timestamp", return_value=1_800_086_401):
            await self.assert_denied_everywhere("Bearer " + token, "TOKEN_EXPIRED")
        for age in (0, 86400):
            with patch("itsdangerous.timed.TimestampSigner.get_timestamp", return_value=1_800_000_000 + age):
                for consumer in ("me", "settings", "profile", "upload"):
                    response = await self.request_consumer(consumer, "Bearer " + token)
                    self.assertEqual(200, response.status_code, response.text)

    async def test_inactive_after_issue(self):
        response = await self.request_consumer("me", "Bearer " + self.token)
        self.assertEqual(200, response.status_code)
        async with self.engine.begin() as conn:
            await conn.execute(update(User).where(User.id == self.user_a).values(is_active=False))
        await self.assert_denied_everywhere("Bearer " + self.token, "UNAUTHORIZED")

    async def test_deleted_user(self):
        async with self.engine.begin() as conn:
            await conn.execute(delete(User).where(User.id == self.user_a))
        await self.assert_denied_everywhere("Bearer " + self.token, "UNAUTHORIZED")

    async def test_user_without_company(self):
        async with self.engine.begin() as conn:
            await conn.execute(update(User).where(User.id == self.user_a).values(tenant_id=None))
        await self.assert_denied_everywhere("Bearer " + self.token, "UNAUTHORIZED")

    async def test_me_shape_one_query_and_same_email_accounts(self):
        for user, tenant, name in ((self.user_a, self.tenant_a, "A"), (self.user_b, self.tenant_b, "B")):
            self.statements.clear()
            response = await self.request_consumer("me", "bEaReR " + issue_session_token(user))
            self.assertEqual(200, response.status_code, response.text)
            data = response.json()["data"]
            self.assertEqual({"id", "email", "first_name", "last_name", "phone", "locale",
                              "role", "tenant_id", "is_active", "secret_link"}, set(data))
            self.assertEqual(str(user), data["id"])
            self.assertEqual(str(tenant), data["tenant_id"])
            self.assertEqual(name, data["first_name"])
            self.assertEqual("same@example.test", data["email"])
            self.assertEqual(1, len(self.statements), self.statements)

    async def test_infrastructure_failure_is_not_invalid_token(self):
        # An unavailable table is an SQL failure, not a signature rejection.
        async with self.engine.begin() as conn:
            await conn.run_sync(lambda sync: User.__table__.drop(sync))
        from sqlalchemy.exc import OperationalError
        with self.assertRaises(OperationalError):
            await self.request_consumer("me", "Bearer " + self.token)
