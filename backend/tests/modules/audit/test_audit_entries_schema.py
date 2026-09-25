"""M1 of the audit-feed domain plan — shared journal storage, no routes.

Checked against ORM metadata and the revision file's own text, same style as
`tests/modules/clients/test_clients_schema.py`. No database is needed for
any of it.
"""

import re
import unittest
from pathlib import Path

from sqlalchemy import Text
from sqlalchemy.dialects.postgresql import JSONB

from app.modules.audit.shared.models import AuditEntry, generate_uuid7

REVISION_PATH = (
    Path(__file__).resolve().parents[3]
    / "alembic"
    / "versions"
    / "6b1e9c4a70d2_audit_entries_table.py"
)


class AuditEntryColumnShapeTests(unittest.TestCase):
    """Exactly the columns M1 names, no more, no fewer."""

    EXPECTED_COLUMNS = {
        "id",
        "tenant_id",
        "entity_type",
        "entity_id",
        "user_id",
        "user_name_translations",
        "user_initials",
        "property_translations",
        "old_value",
        "new_value",
        "sensitive",
        "timestamp",
    }

    def test_column_set_is_exact(self):
        actual = {column.name for column in AuditEntry.__table__.c}
        self.assertEqual(self.EXPECTED_COLUMNS, actual)

    def test_entity_label_column_does_not_exist(self):
        self.assertFalse(hasattr(AuditEntry, "entity_label"))
        self.assertNotIn("entity_label", AuditEntry.__table__.c)

    def test_tenant_id_is_fk_cascade_not_null_indexed(self):
        column = AuditEntry.__table__.c["tenant_id"]
        fks = list(column.foreign_keys)
        self.assertEqual(1, len(fks))
        # `.target_fullname` reads the FK's own colspec string — unlike
        # `.column`, it never tries to resolve the target table, so this
        # test does not depend on `tenants` being registered in metadata.
        self.assertEqual("tenants.id", fks[0].target_fullname)
        self.assertEqual("CASCADE", fks[0].ondelete)
        self.assertFalse(column.nullable)
        self.assertTrue(column.index)

    def test_user_id_is_fk_set_null_and_nullable(self):
        column = AuditEntry.__table__.c["user_id"]
        fks = list(column.foreign_keys)
        self.assertEqual(1, len(fks))
        self.assertEqual("users.id", fks[0].target_fullname)
        self.assertEqual("SET NULL", fks[0].ondelete)
        self.assertTrue(column.nullable)

    def test_translation_columns_are_jsonb_not_null_with_empty_default(self):
        for name in ("user_name_translations", "property_translations"):
            with self.subTest(column=name):
                column = AuditEntry.__table__.c[name]
                self.assertIsInstance(column.type, JSONB)
                self.assertFalse(column.nullable)
                self.assertIsNotNone(column.server_default)

    def test_old_and_new_value_are_text_not_null(self):
        for name in ("old_value", "new_value"):
            with self.subTest(column=name):
                column = AuditEntry.__table__.c[name]
                self.assertIsInstance(column.type, Text)
                self.assertFalse(column.nullable)

    def test_sensitive_is_nullable(self):
        column = AuditEntry.__table__.c["sensitive"]
        self.assertTrue(column.nullable)

    def test_timestamp_is_timezone_aware_with_server_default(self):
        column = AuditEntry.__table__.c["timestamp"]
        self.assertTrue(column.type.timezone)
        self.assertFalse(column.nullable)
        self.assertIsNotNone(column.server_default)


class AuditEntryIndexTests(unittest.TestCase):
    """Two composite indexes named by M1, on the exact column pairs."""

    def _index_columns(self, name: str) -> list[str]:
        for index in AuditEntry.__table__.indexes:
            if index.name == name:
                return [c.name for c in index.columns]
        self.fail(f"index {name!r} not found")

    def test_feed_query_index_covers_tenant_timestamp_id(self):
        self.assertEqual(
            ["tenant_id", "timestamp", "id"],
            self._index_columns("ix_audit_entries_tenant_timestamp_id"),
        )

    def test_timestamp_component_of_feed_index_is_descending(self):
        index = next(
            i
            for i in AuditEntry.__table__.indexes
            if i.name == "ix_audit_entries_tenant_timestamp_id"
        )
        self.assertIn("DESC", str(list(index.expressions)[1]).upper())

    def test_entity_filter_index_covers_tenant_type_id(self):
        self.assertEqual(
            ["tenant_id", "entity_type", "entity_id"],
            self._index_columns("ix_audit_entries_tenant_entity"),
        )

    def test_both_named_indexes_are_declared_on_the_table(self):
        names = {index.name for index in AuditEntry.__table__.indexes}
        self.assertIn("ix_audit_entries_tenant_timestamp_id", names)
        self.assertIn("ix_audit_entries_tenant_entity", names)


class AuditEntryUuid7KeyTests(unittest.TestCase):
    """The primary key is UUIDv7 — sortable by generation order.

    Mutation criterion from the task's acceptance list: swapping the `id`
    column's default back to `uuid.uuid4` must redden this test.
    """

    def test_generated_id_is_version_7(self):
        generated = generate_uuid7()
        self.assertEqual(7, generated.version)

    def test_ids_generated_milliseconds_apart_sort_ascending_as_bytes(self):
        import time

        first = generate_uuid7()
        time.sleep(0.005)
        second = generate_uuid7()
        self.assertLess(first.bytes, second.bytes)

    def test_id_column_default_is_the_uuid7_generator(self):
        # Compared by name rather than identity: full-suite discovery can
        # load this module under two different paths, giving two distinct
        # function objects for the same source — identity would flag that
        # as a mismatch even though the generator is unchanged.
        column = AuditEntry.__table__.c["id"]
        self.assertEqual("generate_uuid7", column.default.arg.__name__)
        self.assertEqual(7, generate_uuid7().version)


class RevisionFileTests(unittest.TestCase):
    """The revision file itself: identity/parent, a real downgrade."""

    @classmethod
    def setUpClass(cls):
        cls.text = REVISION_PATH.read_text()

    def test_revision_identity_and_parent(self):
        self.assertIn('revision: str = "6b1e9c4a70d2"', self.text)
        self.assertIn('down_revision: Union[str, Sequence[str], None] = "c1d2e3f4a5b6"', self.text)

    def test_downgrade_is_not_a_stub(self):
        match = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL)
        self.assertIsNotNone(match, "downgrade() not found in revision file")
        body = match.group(1)

        stripped_first_statement = body.strip().splitlines()[0].strip()
        self.assertNotEqual(
            stripped_first_statement, "pass", "downgrade() must not be a bare pass"
        )

    def test_downgrade_drops_the_table(self):
        match = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL)
        body = match.group(1)
        self.assertIn('op.drop_table("audit_entries")', body)

    def test_legacy_audit_tables_are_not_touched_by_this_revision(self):
        for op_call in ("op.create_table", "op.drop_table", "op.alter_column", "op.drop_column"):
            for legacy_table in ("stock_audit_entries", "supplier_audit_entries"):
                with self.subTest(op_call=op_call, table=legacy_table):
                    self.assertNotIn(f'{op_call}("{legacy_table}"', self.text)


if __name__ == "__main__":
    unittest.main()
