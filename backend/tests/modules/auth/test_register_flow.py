"""POST /api/auth/register domain use case, against the shared temporary SQLite fixture.

Reuses AuthDatabaseCase (real signatures, real SQL) from test_current_user.py and adds
the tables it doesn't create by default: user_roles, sessions, company_info.
"""

from contextlib import asynccontextmanager

from sqlalchemy import select

from tests.modules.auth.test_current_user import AuthDatabaseCase, Tenant, User
from app.core.exceptions import ConflictError, ValidationError
from app.modules.auth.features.register.domain import register
from app.modules.auth.features.register.schemas import RegisterInput
from app.modules.auth.shared.models import Session, UserRole
from app.modules.auth.shared.session_tokens import decode_session_token
from app.modules.settings.shared.models import CompanyInfo


class RegisterFlowCase(AuthDatabaseCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        async with self.engine.begin() as conn:
            for model in (UserRole, Session, CompanyInfo):
                await conn.run_sync(model.__table__.create)

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

    def register_input(self, **overrides):
        data = dict(
            email="new-owner@example.test", password="s3cret-pass",
            company_name="Acme Inc", vat_code="LT123456789",
            first_name="New", last_name="Owner",
        )
        data.update(overrides)
        return RegisterInput(**data)

    async def all_tenant_and_user_ids(self):
        async with self.sessions() as db:
            tenants = (await db.execute(select(Tenant.id))).scalars().all()
            users = (await db.execute(select(User.id))).scalars().all()
        return set(tenants), set(users)


class RegisterFlowTest(RegisterFlowCase):
    async def test_registration_creates_tenant_user_and_session(self):
        async with self.transactional_db() as db:
            result = await register(db, self.register_input())

        async with self.sessions() as db:
            tenant = await db.get(Tenant, result.tenant_id)
            user = await db.get(User, result.id)
            session_rows = (
                await db.execute(select(Session).where(Session.user_id == result.id))
            ).scalars().all()

        self.assertIsNotNone(tenant)
        self.assertEqual("Acme Inc", tenant.name)
        self.assertIsNotNone(user)
        self.assertEqual(tenant.id, user.tenant_id)
        self.assertEqual("new-owner@example.test", user.email)
        self.assertEqual(result.id, decode_session_token(result.session.token))
        self.assertEqual(1, len(session_rows))

        # Первый пользователь арендатора — ВЛАДЕЛЕЦ, и это утверждение появилось
        # здесь не для полноты. До 2026-09-25 роль держалась на двух опорах сразу:
        # `repository.py` передавал `role="owner"` явно, а модель на всякий случай
        # объявляла тот же `"owner"` умолчанием. Вторая опора скрывала пропажу
        # первой — убери явную строку, и роль осталась бы прежней.
        #
        # Решением владельца оба умолчания приведены к `"user"` (наименьшее право
        # для строки, заведённой в обход приложения). Опора осталась одна, и
        # теперь её пропажа МЕНЯЕТ поведение: первый пользователь молча перестал
        # бы быть владельцем. Значит её надо сторожить, а не подразумевать.
        self.assertEqual("owner", user.role)

    async def test_duplicate_email_is_conflict_and_creates_nothing(self):
        async with self.transactional_db() as db:
            await register(db, self.register_input(email="dup@example.test", company_name="First Co"))

        tenants_before, users_before = await self.all_tenant_and_user_ids()

        async with self.transactional_db() as db:
            with self.assertRaises(ConflictError):
                await register(db, self.register_input(email="dup@example.test", company_name="Second Co"))

        tenants_after, users_after = await self.all_tenant_and_user_ids()
        self.assertEqual(tenants_before, tenants_after)
        self.assertEqual(users_before, users_after)

    async def test_invalid_vat_format_is_validation_error_and_creates_nothing(self):
        tenants_before, users_before = await self.all_tenant_and_user_ids()

        async with self.transactional_db() as db:
            with self.assertRaises(ValidationError):
                await register(db, self.register_input(vat_code="not-a-vat"))

        tenants_after, users_after = await self.all_tenant_and_user_ids()
        self.assertEqual(tenants_before, tenants_after)
        self.assertEqual(users_before, users_after)

    async def test_same_company_name_gets_a_second_slug(self):
        async with self.transactional_db() as db:
            first = await register(db, self.register_input(email="owner-one@example.test", company_name="Acme Inc"))
        async with self.transactional_db() as db:
            second = await register(db, self.register_input(email="owner-two@example.test", company_name="Acme Inc"))

        async with self.sessions() as db:
            tenant_one = await db.get(Tenant, first.tenant_id)
            tenant_two = await db.get(Tenant, second.tenant_id)

        self.assertNotEqual(tenant_one.slug, tenant_two.slug)
        self.assertTrue(tenant_two.slug.startswith(tenant_one.slug))
