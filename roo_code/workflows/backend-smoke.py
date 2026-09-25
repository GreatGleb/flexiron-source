#!/usr/bin/env python3
"""Check the local backend test environment, never the configured application DB.

This is an environment check, not acceptance of auth C0 or PostgreSQL migrations.
"""

import asyncio
import os
from pathlib import Path
import sys
import tempfile
from uuid import uuid4


sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))


async def smoke(directory):
    os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///" + str(Path(directory) / "smoke.sqlite")
    os.environ["SECRET_KEY"] = "isolated-test-environment-only"
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient
    from itsdangerous import URLSafeTimedSerializer
    from passlib.context import CryptContext
    from sqlalchemy import insert, select
    from app.core.database import engine
    from app.modules.auth.shared.models import Tenant, User
    from app.modules.auth.features.me.action import router as me
    from app.modules.settings.features.crud.action import router as crud
    from app.modules.settings.features.profile.action import router as profile
    from app.core.uploads.action import router as uploads

    try:
        routes = sum(len(router.routes) for router in (me, crud, profile, uploads))
        assert routes == 26, f"Unexpected auth consumer inventory: {routes}"
        signer = URLSafeTimedSerializer("test", salt="session")
        assert signer.loads(signer.dumps({"user_id": str(uuid4())}), max_age=60)["user_id"]
        passwords = CryptContext(schemes=["bcrypt"], deprecated="auto")
        assert passwords.verify("test-password", passwords.hash("test-password"))

        tenant_a, tenant_b, user_a, user_b = [uuid4() for _ in range(4)]
        async with engine.begin() as connection:
            await connection.run_sync(lambda conn: Tenant.__table__.create(conn))
            await connection.run_sync(lambda conn: User.__table__.create(conn))
            await connection.execute(insert(Tenant), [
                {"id": tenant_a, "name": "A", "slug": "a"},
                {"id": tenant_b, "name": "B", "slug": "b"},
            ])
            await connection.execute(insert(User), [
                {"id": user, "tenant_id": tenant, "email": "same@example.test",
                 "password_hash": "fixture", "first_name": "Test", "last_name": "User"}
                for user, tenant in ((user_a, tenant_a), (user_b, tenant_b))
            ])
            assert set((await connection.execute(select(User.id))).scalars().all()) == {user_a, user_b}
            assert (await connection.execute(select(User.id).where(
                User.id == user_b, User.tenant_id == tenant_a))).first() is None

        app = FastAPI()
        app.include_router(me)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/auth/me")
        assert response.status_code == 401, response.text
        assert response.json()["detail"]["code"] == "MISSING_TOKEN", response.text
        print("Backend environment OK: 26 routes, signing, password hashing, HTTP 401, isolated SQLite A/B")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="flexiron-backend-smoke-") as directory:
        asyncio.run(smoke(directory))
