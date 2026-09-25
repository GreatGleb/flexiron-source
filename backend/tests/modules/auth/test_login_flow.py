"""POST /api/auth/login domain use case, against the shared temporary SQLite fixture.

Reuses AuthDatabaseCase (real signatures, real SQL) from test_current_user.py and adds
the one table it doesn't create by default: sessions.
"""

import hashlib
from contextlib import asynccontextmanager
from uuid import uuid4

from sqlalchemy import insert, select

from tests.modules.auth.test_current_user import AuthDatabaseCase, User
from app.core.exceptions import UnauthorizedError
from app.modules.auth.features.login.domain import login, _pwd_context
from app.modules.auth.features.login.schemas import LoginInput
from app.modules.auth.shared.models import Session
from app.modules.auth.shared.session_tokens import decode_session_token


class LoginFlowCase(AuthDatabaseCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        async with self.engine.begin() as conn:
            await conn.run_sync(Session.__table__.create)

        self.login_password = "correct horse battery staple"
        self.login_user_id = uuid4()
        async with self.engine.begin() as conn:
            await conn.execute(insert(User), [{
                "id": self.login_user_id, "tenant_id": self.tenant_a,
                "email": "login-user@example.test",
                "password_hash": _pwd_context.hash(self.login_password),
                "first_name": "Login", "last_name": "User",
            }])

    @asynccontextmanager
    async def transactional_db(self):
        """Mirrors app.core.database.get_db: commit on success, rollback on error."""
        async with self.sessions() as db:
            try:
                yield db
                await db.commit()
            except Exception:
                await db.rollback()
                raise

    async def add_user(self, **overrides):
        user_id = uuid4()
        row = {
            "id": user_id, "tenant_id": self.tenant_a, "email": "extra@example.test",
            "password_hash": _pwd_context.hash("whatever-password"),
            "first_name": "Extra", "last_name": "User",
        }
        row.update(overrides)
        async with self.engine.begin() as conn:
            await conn.execute(insert(User), [row])
        return user_id

    async def sessions_for(self, user_id):
        async with self.sessions() as db:
            rows = (await db.execute(select(Session).where(Session.user_id == user_id))).scalars().all()
        return rows


class LoginFlowTest(LoginFlowCase):
    async def test_successful_login_issues_matching_token_and_one_session_row(self):
        async with self.transactional_db() as db:
            result = await login(db, LoginInput(email="login-user@example.test", password=self.login_password))

        self.assertEqual(self.login_user_id, decode_session_token(result.session.token))

        rows = await self.sessions_for(self.login_user_id)
        self.assertEqual(1, len(rows))
        self.assertEqual(hashlib.sha256(result.session.token.encode()).hexdigest(), rows[0].token_hash)
        self.assertNotEqual(result.session.token, rows[0].token_hash)

    async def test_unknown_email_and_wrong_password_give_the_same_refusal(self):
        async with self.transactional_db() as db:
            with self.assertRaises(UnauthorizedError) as unknown:
                await login(db, LoginInput(email="nobody@example.test", password="whatever"))
        async with self.transactional_db() as db:
            with self.assertRaises(UnauthorizedError) as wrong_password:
                await login(db, LoginInput(email="login-user@example.test", password="not-the-password"))

        self.assertEqual("UNAUTHORIZED", unknown.exception.code)
        self.assertEqual(unknown.exception.code, wrong_password.exception.code)
        self.assertEqual(unknown.exception.message, wrong_password.exception.message)

        self.assertEqual([], await self.sessions_for(self.login_user_id))

    async def test_disabled_user_is_refused_and_creates_no_session_row(self):
        disabled_id = await self.add_user(
            email="disabled@example.test", is_active=False,
            password_hash=_pwd_context.hash("secret-pass"),
        )
        async with self.transactional_db() as db:
            with self.assertRaises(UnauthorizedError):
                await login(db, LoginInput(email="disabled@example.test", password="secret-pass"))

        self.assertEqual([], await self.sessions_for(disabled_id))

    async def test_user_without_tenant_is_refused(self):
        no_tenant_id = await self.add_user(
            email="no-tenant@example.test", tenant_id=None,
            password_hash=_pwd_context.hash("secret-pass"),
        )
        async with self.transactional_db() as db:
            with self.assertRaises(UnauthorizedError):
                await login(db, LoginInput(email="no-tenant@example.test", password="secret-pass"))

        self.assertEqual([], await self.sessions_for(no_tenant_id))

    async def test_email_is_matched_case_and_whitespace_insensitively(self):
        async with self.transactional_db() as db:
            result = await login(
                db, LoginInput(email="  LOGIN-User@Example.TEST  ", password=self.login_password))

        self.assertEqual(self.login_user_id, decode_session_token(result.session.token))
