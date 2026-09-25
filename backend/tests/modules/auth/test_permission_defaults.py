"""Behaviour of the П33 default-rights rule — real rows in a real database.

`00-conventions.md` §6.4 says a new matrix item is not born rightless: the
moment it appears, the server computes its default permissions from the
tenant's existing rows in the *same domain* and writes them as ordinary
`role_permissions` / `user_permissions` rows. This file is the behavioural
proof — it reads those rows back from the database, not from the return
value of the function under test, and its two-domain fixture is built so
that swapping the denominator (domain items → whole-matrix items) or the
threshold (90% → 50%) changes at least one assertion's outcome.

The harness is the one committed in `test_settings_refusals.py`: a private
temporary SQLite database with the real ORM models — but this feature has
no route, so there is no ASGI app here, just a session handed straight to
the domain function.
"""

from pathlib import Path
import tempfile
import unittest
from uuid import uuid4

from sqlalchemy import insert, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles, deregister
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.modules.auth.features.permission_defaults.domain import (
    create_permission_item_with_defaults,
)
from app.modules.auth.shared.models import PermissionItem, RolePermission, UserPermission


class PermissionDefaultsTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="permission-defaults-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

        # SQLite has no JSONB: compile it as plain JSON for the test database only.
        @compiles(JSONB, "sqlite")
        def sqlite_jsonb(type_, compiler, **kw):
            return "JSON"

        self.addCleanup(deregister, JSONB)
        self.engine = create_async_engine(
            "sqlite+aiosqlite:///" + str(self.root / "test.sqlite")
        )
        self.addAsyncCleanup(self.engine.dispose)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)

        self.tenant = uuid4()
        self.user_override = uuid4()

        async with self.engine.begin() as conn:
            for model in (PermissionItem, RolePermission, UserPermission):
                await conn.run_sync(
                    lambda sync, model=model: model.__table__.create(sync)
                )

            # ── domain "suppliers": 10 items ──
            await conn.execute(
                insert(PermissionItem),
                [
                    self._item(f"s-{n}", "suppliers", "field")
                    for n in range(1, 11)
                ],
            )
            # role "sales": read on 9/10 (90%), edit on 5/10 (50%)
            await conn.execute(
                insert(RolePermission),
                [
                    self._role_perm(f"s-{n}", "sales", can_read=True, can_edit=n <= 5)
                    for n in range(1, 10)
                ]
                + [self._role_perm("s-10", "sales", can_read=False, can_edit=False)],
            )
            # role "accounting": read on 3/10 (30%) — below the threshold everywhere
            await conn.execute(
                insert(RolePermission),
                [
                    self._role_perm(f"s-{n}", "accounting", can_read=True, can_edit=False)
                    for n in range(1, 4)
                ],
            )
            # a personal override, independent of any role: edit on 9/10 (90%)
            await conn.execute(
                insert(UserPermission),
                [
                    self._user_perm(f"s-{n}", can_read=False, can_edit=True)
                    for n in range(1, 10)
                ],
            )

            # ── domain "warehouse": 5 items, "sales" has nothing there ──
            await conn.execute(
                insert(PermissionItem),
                [self._item(f"w-{n}", "warehouse", "field") for n in range(1, 6)],
            )

    # ── fixtures ─────────────────────────────────────────────────────────

    def _item(self, item_id: str, domain: str, item_type: str) -> dict:
        return {
            "id": uuid4(),
            "tenant_id": self.tenant,
            "item_id": item_id,
            "domain": domain,
            "name_translations": {},
            "item_type": item_type,
            "parent_id": None,
        }

    def _role_perm(
        self, item_id: str, role: str, *, can_read: bool, can_edit: bool
    ) -> dict:
        return {
            "id": uuid4(),
            "tenant_id": self.tenant,
            "item_id": item_id,
            "role": role,
            "can_read": can_read,
            "can_edit": can_edit,
            "can_create": False,
            "can_delete": False,
        }

    def _user_perm(self, item_id: str, *, can_read: bool, can_edit: bool) -> dict:
        return {
            "id": uuid4(),
            "tenant_id": self.tenant,
            "item_id": item_id,
            "user_id": self.user_override,
            "can_read": can_read,
            "can_edit": can_edit,
            "can_create": False,
            "can_delete": False,
        }

    async def _role_row(self, session, item_id: str, role: str) -> RolePermission | None:
        result = await session.execute(
            select(RolePermission).where(
                RolePermission.tenant_id == self.tenant,
                RolePermission.item_id == item_id,
                RolePermission.role == role,
            )
        )
        return result.scalar_one_or_none()

    async def _user_row(self, session, item_id: str, user_id) -> UserPermission | None:
        result = await session.execute(
            select(UserPermission).where(
                UserPermission.tenant_id == self.tenant,
                UserPermission.item_id == item_id,
                UserPermission.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    # ── tests ────────────────────────────────────────────────────────────

    async def test_new_item_gets_a_domain_column_and_ordinary_rows(self):
        """The item itself carries its domain, and rights land as plain rows."""
        async with self.sessions() as session:
            item = await create_permission_item_with_defaults(
                session,
                self.tenant,
                item_id="s-11",
                domain="suppliers",
                item_type="field",
            )
            await session.commit()

            self.assertEqual("suppliers", item.domain)

            row = await self._role_row(session, "s-11", "sales")
            self.assertIsNotNone(row)
            self.assertIsInstance(row.can_read, bool)

    async def test_admin_gets_full_rights_unconditionally(self):
        """Base layer: `admin` sees the new item fully, with no prior data at all."""
        async with self.sessions() as session:
            await create_permission_item_with_defaults(
                session,
                self.tenant,
                item_id="s-11",
                domain="suppliers",
                item_type="field",
            )
            await session.commit()

            row = await self._role_row(session, "s-11", "admin")
            self.assertIsNotNone(row)
            self.assertTrue(row.can_read)
            self.assertTrue(row.can_edit)
            self.assertTrue(row.can_create)
            self.assertTrue(row.can_delete)

    async def test_role_below_the_threshold_on_every_action_gets_nothing(self):
        """`accounting` reads 30% of the domain — below 90% on every action."""
        async with self.sessions() as session:
            await create_permission_item_with_defaults(
                session,
                self.tenant,
                item_id="s-11",
                domain="suppliers",
                item_type="field",
            )
            await session.commit()

            row = await self._role_row(session, "s-11", "accounting")
            self.assertIsNone(row)

    async def test_actions_are_granted_one_at_a_time(self):
        """`sales` is at 90% read and 50% edit — the new item gets read, not edit.

        This is also the mutation-sensitive case: with the denominator
        counted across the whole matrix (10 suppliers + 5 warehouse items,
        where `sales` has no warehouse rights at all) read would drop to
        9/15 = 60% and fail; with the threshold lowered to 50%, edit at
        50% would pass. Either mutation flips one of the two assertions
        below.
        """
        async with self.sessions() as session:
            await create_permission_item_with_defaults(
                session,
                self.tenant,
                item_id="s-11",
                domain="suppliers",
                item_type="field",
            )
            await session.commit()

            row = await self._role_row(session, "s-11", "sales")
            self.assertIsNotNone(row)
            self.assertTrue(row.can_read, "90% read coverage must grant read")
            self.assertFalse(row.can_edit, "50% edit coverage must not grant edit")
            self.assertFalse(row.can_create)
            self.assertFalse(row.can_delete)

    async def test_rule_applies_to_a_personal_override_independent_of_role(self):
        """A user's own override at 90% edit grants edit — no role carries it."""
        async with self.sessions() as session:
            await create_permission_item_with_defaults(
                session,
                self.tenant,
                item_id="s-11",
                domain="suppliers",
                item_type="field",
            )
            await session.commit()

            row = await self._user_row(session, "s-11", self.user_override)
            self.assertIsNotNone(row)
            self.assertTrue(row.can_edit)
            self.assertFalse(row.can_read)
            self.assertFalse(row.can_create)
            self.assertFalse(row.can_delete)

    async def test_a_second_new_item_does_not_rewrite_the_first(self):
        """Rows written for one new item are not recomputed when the next appears."""
        async with self.sessions() as session:
            await create_permission_item_with_defaults(
                session,
                self.tenant,
                item_id="s-11",
                domain="suppliers",
                item_type="field",
            )
            await session.commit()

            first_row = await self._role_row(session, "s-11", "sales")
            before = (
                first_row.can_read,
                first_row.can_edit,
                first_row.can_create,
                first_row.can_delete,
            )

            await create_permission_item_with_defaults(
                session,
                self.tenant,
                item_id="s-12",
                domain="suppliers",
                item_type="field",
            )
            await session.commit()

            first_row_again = await self._role_row(session, "s-11", "sales")
            after = (
                first_row_again.can_read,
                first_row_again.can_edit,
                first_row_again.can_create,
                first_row_again.can_delete,
            )
            self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()
