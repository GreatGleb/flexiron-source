"""`GET /api/uploads/limits` — the server's own limits, read fresh each call.

The harness is the one committed in `test_settings_refusals.py`: a private
temporary SQLite database, the real uploads router over ASGI, real Bearer
authentication; only `get_db` is replaced.

The behavioural claim this file proves is not "the route returns 200" — a
route can do that with two hardcoded literals. It is that the two numbers in
the response come from `app.core.config.settings` on every request: patch
`max_upload_size_mb` and `upload_whitelist_mime` and the response changes
with them. A handler with `20` and five MIME strings written into it would
pass a plain 200-check and fail this one.
"""

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import insert
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

# Importing database builds a lazy engine that must not look into .env — same
# guard the other harnesses use.
with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/uploads-limits-unused.sqlite"},
):
    from app.core.config import settings as app_settings
    from app.core.database import get_db
    from app.core.uploads.action import router as uploads_router
    from app.modules.auth.shared.models import Tenant, User
    from app.modules.auth.shared.session_tokens import issue_session_token


class UploadLimitsTests(unittest.IsolatedAsyncioTestCase):
    """The read reflects config, requires the same Bearer as the upload, and nothing else."""

    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="uploads-limits-")
        self.addCleanup(self.directory.cleanup)
        root = Path(self.directory.name)

        self.engine = create_async_engine("sqlite+aiosqlite:///" + str(root / "test.sqlite"))
        self.addAsyncCleanup(self.engine.dispose)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)

        self.tenant_id = uuid4()
        self.user_id = uuid4()
        async with self.engine.begin() as conn:
            for model in (Tenant, User):
                await conn.run_sync(lambda sync, model=model: model.__table__.create(sync))
            await conn.execute(
                insert(Tenant), [{"id": self.tenant_id, "name": "A", "slug": "a"}]
            )
            await conn.execute(
                insert(User),
                [
                    {
                        "id": self.user_id,
                        "tenant_id": self.tenant_id,
                        "email": "a@example.test",
                        "first_name": "A",
                        "last_name": "User",
                        "password_hash": "fixture",
                        "secret_link_token": "secret-a",
                    }
                ],
            )

        self.app = FastAPI()
        self.app.include_router(uploads_router)

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
        self.token = issue_session_token(self.user_id)

    @property
    def auth(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"}

    async def test_limits_are_returned_in_the_envelope(self):
        response = await self.client.get("/api/uploads/limits", headers=self.auth)

        self.assertEqual(200, response.status_code, response.text)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual({"maxSizeMb", "allowedMime"}, set(body["data"].keys()))
        self.assertIsInstance(body["data"]["maxSizeMb"], (int, float))
        self.assertIsInstance(body["data"]["allowedMime"], list)
        self.assertTrue(all(isinstance(m, str) for m in body["data"]["allowedMime"]))

    async def test_draft_ttl_hours_is_not_exposed(self):
        response = await self.client.get("/api/uploads/limits", headers=self.auth)

        self.assertNotIn("draftTtlHours", response.json()["data"])

    async def test_missing_authorization_is_refused(self):
        response = await self.client.get("/api/uploads/limits")

        self.assertEqual(401, response.status_code, response.text)
        self.assertEqual("MISSING_TOKEN", response.json()["detail"]["code"])

    async def test_response_follows_config_not_literals(self):
        """A handler with `20` and five hardcoded MIME strings would fail this."""
        with (
            patch.object(app_settings, "max_upload_size_mb", 7),
            patch.object(app_settings, "upload_whitelist_mime", ["image/webp"]),
        ):
            response = await self.client.get("/api/uploads/limits", headers=self.auth)

        self.assertEqual(200, response.status_code, response.text)
        data = response.json()["data"]
        self.assertEqual(7, data["maxSizeMb"])
        self.assertEqual(["image/webp"], data["allowedMime"])


if __name__ == "__main__":
    unittest.main()
