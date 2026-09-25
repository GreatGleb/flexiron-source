"""GET /api/auth/link domain use case, against the shared temporary SQLite fixture.

Reuses AuthDatabaseCase (real signatures, real SQL) from test_current_user.py and adds
the one table it doesn't create by default: sessions.
"""

from sqlalchemy import select, update

from tests.modules.auth.test_current_user import AuthDatabaseCase, User
from app.core.exceptions import UnauthorizedError
from app.modules.auth.features.magic_link.domain import verify_secret_link
from app.modules.auth.shared.models import Session


class MagicLinkFlowCase(AuthDatabaseCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        async with self.engine.begin() as conn:
            await conn.run_sync(Session.__table__.create)

    async def session_count(self):
        async with self.sessions() as db:
            rows = (await db.execute(select(Session))).scalars().all()
        return len(rows)


class MagicLinkFlowTest(MagicLinkFlowCase):
    async def test_valid_token_returns_email_and_creates_no_session(self):
        async with self.sessions() as db:
            result = await verify_secret_link(db, "secret-A")

        self.assertEqual("same@example.test", result.email)
        self.assertEqual(0, await self.session_count())

    async def test_unknown_token_and_disabled_user_get_different_refusals(self):
        async with self.sessions() as db:
            with self.assertRaises(UnauthorizedError) as unknown:
                await verify_secret_link(db, "no-such-token")

        async with self.engine.begin() as conn:
            await conn.execute(update(User).where(User.id == self.user_a).values(is_active=False))
        async with self.sessions() as db:
            with self.assertRaises(UnauthorizedError) as disabled:
                await verify_secret_link(db, "secret-A")

        self.assertEqual("UNAUTHORIZED", unknown.exception.code)
        self.assertEqual("UNAUTHORIZED", disabled.exception.code)
        self.assertNotEqual(unknown.exception.message, disabled.exception.message)
        self.assertEqual(0, await self.session_count())
