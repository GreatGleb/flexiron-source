"""Schema guard: config field-library storage matches `roo_code/roo-context/api/config.md`.

`FieldDefinition.name` used to be a plain `String(255)` — nowhere to put a second
locale — and is now `name_translations`, JSONB with the `_translations` suffix
already used by `section_configs.name_translations` and
`services.name_translations`. `FieldDefinition.options` used to be a JSON array of
plain strings and is now a JSONB array of translation objects. `FieldDefinition`
also carries a `hidden` flag ("hide at the library level") and `SectionConfig` a
`system` flag, both boolean with an explicit `server_default` of "not set".
Reintroducing a bare `name` column, dropping either `server_default`, or losing
the tenant-scoped name-uniqueness index reddens this test.
"""

import re
import unittest
from pathlib import Path

from sqlalchemy.dialects.postgresql import JSONB

from app.modules.suppliers.shared.models import FieldDefinition, SectionConfig

REVISION_PATH = (
    Path(__file__).resolve().parents[3]
    / "alembic"
    / "versions"
    / "d8b3f1c25a60_config_field_library_form.py"
)


class FieldDefinitionNameIsTranslatedTests(unittest.TestCase):
    def test_plain_name_column_is_gone(self):
        self.assertFalse(hasattr(FieldDefinition, "name"))
        self.assertNotIn("name", FieldDefinition.__table__.c)

    def test_name_translations_is_jsonb_not_null(self):
        column = FieldDefinition.__table__.c["name_translations"]
        self.assertIsInstance(column.type, JSONB)
        self.assertFalse(column.nullable)

    def test_tenant_name_uniqueness_still_enforced(self):
        indexes = {
            index.name: index for index in FieldDefinition.__table__.indexes
        }
        self.assertIn("uq_field_definitions_tenant_name", indexes)
        index = indexes["uq_field_definitions_tenant_name"]
        self.assertTrue(index.unique)
        self.assertEqual(
            {"tenant_id", "name_translations"},
            {column.name for column in index.columns},
        )


class FieldDefinitionOptionsAreTranslatedTests(unittest.TestCase):
    def test_options_is_jsonb_nullable(self):
        column = FieldDefinition.__table__.c["options"]
        self.assertIsInstance(column.type, JSONB)
        self.assertTrue(column.nullable)


class FieldDefinitionHiddenFlagTests(unittest.TestCase):
    def test_hidden_column_exists_not_null(self):
        column = FieldDefinition.__table__.c["hidden"]
        self.assertFalse(column.nullable)

    def test_hidden_defaults_to_not_hidden(self):
        column = FieldDefinition.__table__.c["hidden"]
        self.assertIsNotNone(column.server_default)
        self.assertIn("false", str(column.server_default.arg).lower())


class SectionConfigSystemFlagTests(unittest.TestCase):
    def test_system_column_exists_not_null(self):
        column = SectionConfig.__table__.c["system"]
        self.assertFalse(column.nullable)

    def test_system_defaults_to_not_system(self):
        column = SectionConfig.__table__.c["system"]
        self.assertIsNotNone(column.server_default)
        self.assertIn("false", str(column.server_default.arg).lower())


class RevisionFileTests(unittest.TestCase):
    """The revision file itself: identity, single head, a real downgrade."""

    @classmethod
    def setUpClass(cls):
        cls.text = REVISION_PATH.read_text()

    def test_revision_identity_and_parent(self):
        self.assertIn('revision: str = "d8b3f1c25a60"', self.text)

    def test_type_changes_use_postgresql_using(self):
        # name (upgrade) + name (downgrade) = 2. `options` goes through a sibling
        # column + plain UPDATE instead — `ALTER COLUMN ... USING` rejects the
        # subquery `jsonb_agg` needs.
        self.assertEqual(self.text.count("postgresql_using="), 2)

    def test_downgrade_is_not_a_stub(self):
        match = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL)
        self.assertIsNotNone(match, "downgrade() not found in revision file")
        body = match.group(1)

        stripped_first_statement = body.strip().splitlines()[0].strip()
        self.assertNotEqual(
            stripped_first_statement, "pass", "downgrade() must not be a bare pass"
        )
        self.assertGreaterEqual(body.count("op."), 4)

    def test_downgrade_restores_original_column_name(self):
        match = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL)
        body = match.group(1)

        self.assertIn('new_column_name="name"', body)

    def test_downgrade_drops_added_columns(self):
        match = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL)
        body = match.group(1)

        self.assertIn('drop_column("field_definitions", "hidden")', body)
        self.assertIn('drop_column("section_configs", "system")', body)

    def test_only_config_field_library_tables_touched(self):
        untouched = [
            "suppliers",
            "supplier_addresses",
            "supplier_contacts",
            "supplier_files",
            "supplier_audit_entries",
            "supplier_price_entries",
        ]
        for table in untouched:
            self.assertNotIn(f'"{table}"', self.text)


if __name__ == "__main__":
    unittest.main()
