"""Warehouse schema guards — `offcut_id` and the deficit columns the contract
named absent (БАГ-23, БАГ-25 in `roo_code/roo-context/api/warehouse.md`).

Checked against ORM metadata only; no database is needed for any of it.
"""

import unittest

from app.modules.warehouse.shared.models import WarehouseDeficit, WarehouseMovement

PRIORITY_VALUES = {"critical", "high", "medium", "low"}


def _foreign_key(column):
    for fk in column.foreign_keys:
        return fk
    return None


class MovementOffcutLinkTests(unittest.TestCase):
    """`WarehouseMovement.offcut_id` — the field the whole offcut model hangs on."""

    def test_offcut_id_column_exists(self):
        self.assertIn("offcut_id", WarehouseMovement.__table__.c)

    def test_offcut_id_is_nullable(self):
        column = WarehouseMovement.__table__.c["offcut_id"]
        self.assertTrue(column.nullable)

    def test_offcut_id_is_indexed(self):
        column = WarehouseMovement.__table__.c["offcut_id"]
        self.assertTrue(column.index)

    def test_offcut_id_targets_warehouse_offcuts(self):
        column = WarehouseMovement.__table__.c["offcut_id"]
        fk = _foreign_key(column)
        self.assertIsNotNone(fk, "offcut_id carries no foreign key")
        self.assertEqual(fk.target_fullname, "warehouse_offcuts.id")

    def test_offcut_id_ondelete_is_set_null(self):
        """A movement record outlives the offcut it moved — SET NULL, not RESTRICT."""
        column = WarehouseMovement.__table__.c["offcut_id"]
        fk = _foreign_key(column)
        self.assertEqual(fk.ondelete, "SET NULL")


class DeficitRecordTypeColumnsTests(unittest.TestCase):
    """The four columns the client's `WarehouseDeficit` type carries and the schema lacked."""

    def test_priority_column_exists_and_is_required(self):
        column = WarehouseDeficit.__table__.c["priority"]
        self.assertFalse(column.nullable)

    def test_priority_has_no_default(self):
        """The owner has not decided a default priority — the column must not guess one."""
        column = WarehouseDeficit.__table__.c["priority"]
        self.assertIsNone(column.server_default)
        self.assertIsNone(column.default)

    def test_suggested_order_qty_column_is_nullable(self):
        self.assertIn("suggested_order_qty", WarehouseDeficit.__table__.c)
        column = WarehouseDeficit.__table__.c["suggested_order_qty"]
        self.assertTrue(column.nullable)

    def test_purchase_order_id_column_is_nullable(self):
        self.assertIn("purchase_order_id", WarehouseDeficit.__table__.c)
        column = WarehouseDeficit.__table__.c["purchase_order_id"]
        self.assertTrue(column.nullable)

    def test_uom_id_targets_uoms_with_restrict(self):
        """Every reference to a tenant reference table is RESTRICT (contract §22)."""
        column = WarehouseDeficit.__table__.c["uom_id"]
        self.assertTrue(column.nullable)
        fk = _foreign_key(column)
        self.assertIsNotNone(fk, "uom_id carries no foreign key")
        self.assertEqual(fk.target_fullname, "uoms.id")
        self.assertEqual(fk.ondelete, "RESTRICT")

    def test_product_name_and_deficit_amount_stay_undecided(self):
        """Snapshot vs. join is an open owner decision — no column guesses it."""
        self.assertNotIn("product_name", WarehouseDeficit.__table__.c)
        self.assertNotIn("deficit_amount", WarehouseDeficit.__table__.c)


class DeficitStatusDefaultTests(unittest.TestCase):
    """`status` is born `open` (`DeficitStatus`), never a `DeficitPriority` value."""

    def test_status_default_is_open(self):
        column = WarehouseDeficit.__table__.c["status"]
        self.assertIsNotNone(column.server_default)
        self.assertEqual(column.server_default.arg, "open")

    def test_status_default_is_not_a_priority_value(self):
        column = WarehouseDeficit.__table__.c["status"]
        default_value = column.server_default.arg
        self.assertNotIn(default_value, PRIORITY_VALUES)


if __name__ == "__main__":
    unittest.main()
