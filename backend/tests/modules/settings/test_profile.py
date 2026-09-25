"""Behaviour of `settings.profile` — the secret link, partial-patch merge and
the three password-change refusals that nothing exercises today.

`test_current_user.py` and `test_auth_consumers.py` already hit `/api/settings/profile`,
but only to prove authentication and tenant-from-token — none of them read the
profile twice, patch it, or touch `/api/settings/change-password` at all.

The harness is the one committed in `test_batches_list.py`: a real request, the
real router over ASGI, a private temporary SQLite database — only `get_db` and
`get_current_user` are overridden, and the error handler is the product's own
`app_error_handler` imported from `app.main`.

Email-uniqueness scoping (whole table vs. per-tenant) is a known open question in
the contract (§4) — this file does not assert either way; the profile-patch test
below only sends an email the fixture doesn't already use, so that branch never
fires.

    cd backend && python3 -m pytest tests/modules/settings/test_profile.py -q
"""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/profile-unused.sqlite"},
):
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient
    from passlib.context import CryptContext
    from sqlalchemy import insert, select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.core.database import get_db
    from app.core.exceptions import AppError
    from app.main import app_error_handler
    from app.modules.auth.internal_api.interface import CurrentUser, get_current_user
    from app.modules.auth.shared.models import Tenant, User
    from app.modules.settings.features.profile.action import router as profile_router


_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

TENANT_A = uuid4()
TENANT_B = uuid4()
CURRENT_PASSWORD = "correct-horse"


class ProfileTestCase(unittest.IsolatedAsyncioTestCase):
    """Shared fixture: one user in tenant A, a second user in tenant B."""

    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="profile-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

        self.engine = create_async_engine(
            "sqlite+aiosqlite:///" + str(self.root / "test.sqlite")
        )
        self.addAsyncCleanup(self.engine.dispose)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)

        self.user_a = uuid4()
        self.user_b = uuid4()

        async with self.engine.begin() as conn:
            for model in (Tenant, User):
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
                insert(User),
                [
                    {
                        "id": self.user_a,
                        "tenant_id": TENANT_A,
                        "email": "a@example.test",
                        "first_name": "Ann",
                        "last_name": "Owner",
                        "phone": "+1000",
                        "password_hash": _pwd_context.hash(CURRENT_PASSWORD),
                        "secret_link_token": None,
                    },
                    {
                        "id": self.user_b,
                        "tenant_id": TENANT_B,
                        "email": "b@example.test",
                        "first_name": "Bea",
                        "last_name": "Other",
                        "phone": None,
                        "password_hash": _pwd_context.hash(CURRENT_PASSWORD),
                        "secret_link_token": "secret-b",
                    },
                ],
            )

        self.app = FastAPI()
        self.app.add_exception_handler(AppError, app_error_handler)
        self.app.include_router(profile_router)

        async def isolated_db():
            async with self.sessions() as session:
                try:
                    yield session
                    await session.commit()
                except Exception:
                    await session.rollback()
                    raise

        self.app.dependency_overrides[get_db] = isolated_db
        self._current_user_id = self.user_a
        self._current_tenant_id = TENANT_A

        async def current_user():
            return CurrentUser(
                user_id=self._current_user_id,
                tenant_id=self._current_tenant_id,
                user=None,
            )

        self.app.dependency_overrides[get_current_user] = current_user
        self.client = AsyncClient(
            transport=ASGITransport(app=self.app, raise_app_exceptions=False),
            base_url="http://test",
        )
        self.addAsyncCleanup(self.client.aclose)

    async def _stored_user(self, user_id):
        async with self.sessions() as session:
            result = await session.execute(select(User).where(User.id == user_id))
            return result.scalar_one()

    # ── The secret link is permanent ────────────────────────────────────────

    async def test_second_read_returns_the_same_permanent_link(self):
        """The user starts with no `secret_link_token` — the first read must
        generate one, and the second read must return the identical link,
        not a freshly reissued one."""
        first = await self.client.get("/api/settings/profile")
        self.assertEqual(200, first.status_code, first.text)
        first_link = first.json()["data"]["secretLink"]
        self.assertTrue(first_link)

        second = await self.client.get("/api/settings/profile")
        self.assertEqual(200, second.status_code, second.text)
        second_link = second.json()["data"]["secretLink"]

        self.assertEqual(first_link, second_link)

    # ── Partial patch merges, doesn't clobber ───────────────────────────────

    async def test_partial_patch_changes_only_the_supplied_field(self):
        response = await self.client.patch(
            "/api/settings/profile", json={"firstName": "Annette"}
        )

        self.assertEqual(200, response.status_code, response.text)
        data = response.json()["data"]
        self.assertEqual("Annette", data["firstName"])
        self.assertEqual("Owner", data["lastName"])
        self.assertEqual("a@example.test", data["email"])
        self.assertEqual("+1000", data["phone"])

    async def test_empty_patch_body_leaves_the_profile_unchanged(self):
        response = await self.client.patch("/api/settings/profile", json={})

        self.assertEqual(200, response.status_code, response.text)
        data = response.json()["data"]
        self.assertEqual("Ann", data["firstName"])
        self.assertEqual("Owner", data["lastName"])
        self.assertEqual("a@example.test", data["email"])
        self.assertEqual("+1000", data["phone"])

    # ── Password change: three refusals, one success ────────────────────────

    async def test_password_change_with_wrong_current_password_is_refused(self):
        response = await self.client.post(
            "/api/settings/change-password",
            json={
                "currentPassword": "not-the-password",
                "newPassword": "brand-new-pass",
                "confirmPassword": "brand-new-pass",
            },
        )

        self.assertEqual(422, response.status_code, response.text)
        self.assertEqual("VALIDATION_ERROR", response.json()["detail"]["code"])

    async def test_password_change_with_mismatched_confirmation_is_refused(self):
        response = await self.client.post(
            "/api/settings/change-password",
            json={
                "currentPassword": CURRENT_PASSWORD,
                "newPassword": "brand-new-pass",
                "confirmPassword": "does-not-match",
            },
        )

        self.assertEqual(422, response.status_code, response.text)
        self.assertEqual("VALIDATION_ERROR", response.json()["detail"]["code"])

    async def test_password_change_with_too_short_new_password_is_refused(self):
        response = await self.client.post(
            "/api/settings/change-password",
            json={
                "currentPassword": CURRENT_PASSWORD,
                "newPassword": "abc",
                "confirmPassword": "abc",
            },
        )

        self.assertEqual(422, response.status_code, response.text)
        self.assertEqual("VALIDATION_ERROR", response.json()["detail"]["code"])

    async def test_successful_password_change_updates_the_hash_and_retires_the_old_one(self):
        new_password = "brand-new-pass"

        before = await self._stored_user(self.user_a)
        old_hash = before.password_hash

        response = await self.client.post(
            "/api/settings/change-password",
            json={
                "currentPassword": CURRENT_PASSWORD,
                "newPassword": new_password,
                "confirmPassword": new_password,
            },
        )
        self.assertEqual(200, response.status_code, response.text)

        after = await self._stored_user(self.user_a)
        self.assertNotEqual(old_hash, after.password_hash)

        # The old password must no longer be accepted as the "current" one.
        retry = await self.client.post(
            "/api/settings/change-password",
            json={
                "currentPassword": CURRENT_PASSWORD,
                "newPassword": "yet-another-pass",
                "confirmPassword": "yet-another-pass",
            },
        )
        self.assertEqual(422, retry.status_code, retry.text)
        self.assertEqual("VALIDATION_ERROR", retry.json()["detail"]["code"])

    # ── Tenant isolation ─────────────────────────────────────────────────────

    async def test_a_foreign_tenants_profile_reads_as_not_found(self):
        """A token whose tenant doesn't match the row's tenant must read as
        absent, never as another tenant's fields."""
        self._current_user_id = self.user_a
        self._current_tenant_id = TENANT_B

        response = await self.client.get("/api/settings/profile")

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("NOT_FOUND", response.json()["detail"]["code"])


if __name__ == "__main__":
    unittest.main()
