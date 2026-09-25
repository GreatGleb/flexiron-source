"""Slice 1 of the notifications domain plan — storage form only, no route.

П10 rewrites what a `notifications` row means: it stops being an addressee's
copy and becomes one row per event. `user_id` and `is_read` — the columns that
made a row personal — are dropped; who read it and when moves to
`notification_reads`. `event_key` plus its tenant-scoped uniqueness is the
dedup mechanism for П56 ("already notified" must survive a server restart);
`requires_action` is the alert flag for П55; `notification_subscriptions` is
the per-user, per-type, per-channel opt-in for П54.

None of this needs a database — SQLAlchemy's declarative metadata already
describes columns, nullability, server defaults and constraints without ever
opening a connection, and the migration file is checked as text. What the
tests below prove is the *shape*, not behaviour behind an endpoint: the
domain has zero routes at this slice.
"""

import re
import unittest
from pathlib import Path

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import operators

from app.modules.notifications.shared.models import (
    Notification,
    NotificationRead,
    NotificationSubscription,
)

MIGRATION_PATH = (
    Path(__file__).resolve().parents[3]
    / "alembic"
    / "versions"
    / "e7a2c5b41d09_notifications_slice1_addressing.py"
)


def _constraint_names(constraints, cls):
    return {c.name for c in constraints if type(c).__name__ == cls}


def _column_names(table):
    return {c.name for c in table.columns}


class NotificationAddresseeColumnsAreGoneTests(unittest.TestCase):
    """П10: the row is an event, not a personal copy — no addressee columns."""

    def test_is_read_is_gone(self):
        self.assertFalse(hasattr(Notification, "is_read"))
        self.assertNotIn("is_read", _column_names(Notification.__table__))

    def test_user_id_is_gone(self):
        self.assertFalse(hasattr(Notification, "user_id"))
        self.assertNotIn("user_id", _column_names(Notification.__table__))


class NotificationKeptColumnsTests(unittest.TestCase):
    """Everything not touched by П10 stays exactly as it was."""

    def test_kept_columns_present(self):
        kept = {
            "tenant_id",
            "type",
            "title_translations",
            "message_translations",
            "entity_type",
            "entity_id",
            "created_at",
        }
        self.assertTrue(kept.issubset(_column_names(Notification.__table__)))

    def test_translations_are_still_jsonb(self):
        for name in ("title_translations", "message_translations"):
            column = Notification.__table__.c[name]
            self.assertIsInstance(column.type, JSONB)
            self.assertFalse(column.nullable)


class NotificationNewColumnsTests(unittest.TestCase):
    """The three columns this slice adds, with the exact form the plan names."""

    def test_event_key(self):
        column = Notification.__table__.c["event_key"]
        self.assertIsInstance(column.type, String)
        self.assertEqual(column.type.length, 200)
        self.assertFalse(column.nullable)

    def test_requires_action(self):
        column = Notification.__table__.c["requires_action"]
        self.assertIsInstance(column.type, Boolean)
        self.assertFalse(column.nullable)
        self.assertIsNotNone(column.server_default)

    def test_email_sent_at(self):
        column = Notification.__table__.c["email_sent_at"]
        self.assertIsInstance(column.type, DateTime)
        self.assertTrue(column.nullable)


class NotificationDedupConstraintTests(unittest.TestCase):
    """П56: uniqueness on (tenant_id, event_key) IS the dedup mechanism."""

    def test_unique_tenant_event_key(self):
        uniques = _constraint_names(
            Notification.__table__.constraints, "UniqueConstraint"
        )
        self.assertIn("uq_notifications_tenant_event_key", uniques)
        constraint = next(
            c
            for c in Notification.__table__.constraints
            if type(c).__name__ == "UniqueConstraint"
        )
        self.assertEqual(
            {col.name for col in constraint.columns}, {"tenant_id", "event_key"}
        )


class NotificationFeedIndexTests(unittest.TestCase):
    """Second sort key: (tenant_id, created_at DESC, id) — no PARTITION here."""

    def test_composite_index_columns_and_order(self):
        indexes = {i.name: i for i in Notification.__table__.indexes}
        self.assertIn("ix_notifications_tenant_created_at_id", indexes)
        idx = indexes["ix_notifications_tenant_created_at_id"]
        self.assertEqual(
            [c.name for c in idx.columns], ["tenant_id", "created_at", "id"]
        )
        # Middle expression must be `created_at DESC`, not a plain ascending column.
        desc_expr = idx.expressions[1]
        self.assertEqual(desc_expr.modifier, operators.desc_op)


class NotificationReadShapeTests(unittest.TestCase):
    """`notification_reads` — the personal half of П10's split."""

    def test_columns(self):
        expected = {"tenant_id", "notification_id", "user_id", "read_at"}
        self.assertTrue(expected.issubset(_column_names(NotificationRead.__table__)))

    def test_foreign_keys_cascade(self):
        # `target_fullname` ("tenants.id") resolves from the FK spec alone —
        # no need for the referenced modules' tables to be registered too.
        fks = {fk.target_fullname: fk for fk in NotificationRead.__table__.foreign_keys}
        self.assertIn("notifications.id", fks)
        self.assertEqual(fks["notifications.id"].ondelete, "CASCADE")
        self.assertIn("users.id", fks)
        self.assertEqual(fks["users.id"].ondelete, "CASCADE")

    def test_unique_tenant_notification_user(self):
        uniques = [
            c
            for c in NotificationRead.__table__.constraints
            if type(c).__name__ == "UniqueConstraint"
        ]
        self.assertEqual(len(uniques), 1)
        self.assertEqual(
            {col.name for col in uniques[0].columns},
            {"tenant_id", "notification_id", "user_id"},
        )

    def test_index_for_unread_count(self):
        indexes = {i.name: i for i in NotificationRead.__table__.indexes}
        self.assertIn("ix_notification_reads_tenant_notification", indexes)
        idx = indexes["ix_notification_reads_tenant_notification"]
        self.assertEqual(
            {c.name for c in idx.columns}, {"tenant_id", "notification_id"}
        )


class NotificationSubscriptionShapeTests(unittest.TestCase):
    """`notification_subscriptions` — user × type × channel (П54)."""

    def test_columns(self):
        expected = {"tenant_id", "user_id", "type", "channel", "enabled", "email"}
        self.assertTrue(
            expected.issubset(_column_names(NotificationSubscription.__table__))
        )

    def test_email_is_nullable(self):
        column = NotificationSubscription.__table__.c["email"]
        self.assertTrue(column.nullable)

    def test_unique_tenant_user_type_channel(self):
        uniques = [
            c
            for c in NotificationSubscription.__table__.constraints
            if type(c).__name__ == "UniqueConstraint"
        ]
        self.assertEqual(len(uniques), 1)
        self.assertEqual(
            {col.name for col in uniques[0].columns},
            {"tenant_id", "user_id", "type", "channel"},
        )


class NotificationsMigrationFileTests(unittest.TestCase):
    """The revision itself: reversible, and honest about what it doesn't do."""

    @classmethod
    def setUpClass(cls):
        cls.text = MIGRATION_PATH.read_text(encoding="utf-8")

    def test_revision_id_matches_filename(self):
        self.assertIn('revision: str = "e7a2c5b41d09"', self.text)

    def test_downgrade_restores_dropped_columns(self):
        downgrade_body = self.text.split("def downgrade()", 1)[1]
        self.assertIn('"user_id"', downgrade_body)
        self.assertIn('"is_read"', downgrade_body)
        self.assertIn("add_column", downgrade_body)

    def test_downgrade_is_not_a_stub(self):
        downgrade_body = self.text.split("def downgrade()", 1)[1]
        # A bare `pass` body (optionally after only a docstring) is the "empty
        # stub" this test guards against — reversibility has to be real code.
        stripped = re.sub(r'"""(?:.|\n)*?"""', "", downgrade_body, count=1)
        first_statement = stripped.strip().splitlines()[0].strip()
        self.assertNotEqual(first_statement, "pass")

    def test_no_partitioning_introduced(self):
        self.assertNotIn("PARTITION BY RANGE", self.text)

    def test_dedup_unique_constraint_present_in_upgrade(self):
        upgrade_body = self.text.split("def downgrade()", 1)[0]
        self.assertIn("uq_notifications_tenant_event_key", upgrade_body)
        self.assertIn("event_key", upgrade_body)


if __name__ == "__main__":
    unittest.main()
