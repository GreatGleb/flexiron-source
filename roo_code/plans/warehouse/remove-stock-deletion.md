# Plan: Remove Stock Deletion Functionality from warehouse/stock

## Overview

Remove all UI elements (buttons, modals) and backend logic (service functions, mock handlers, composable functions) related to deleting stock items from the Stock Overview tab. The deletion of batches, offcuts, movements, and deficit items should remain untouched.

## Files to Modify

### 1. [`frontend_vue/src/views/admin/warehouse/WarehousePage.vue`](../../frontend_vue/src/views/admin/warehouse/WarehousePage.vue)

**What to remove:**

1. **Delete button in stock table** (lines ~1489-1496) — Remove the trash button with `data-test="stock-delete-btn"` and its `@click.stop="confirmDeleteStock(item)"` handler.

2. **`confirmDeleteStock` function** (lines ~553-556) — Remove the entire function.

3. **`'stock'` case from `handleDelete`** (line ~565) — Remove the `else if (type === 'stock') await deleteStock(id)` branch.

4. **`deleteStock` from destructured imports** (line ~70) — Remove `deleteStock` from the `useWarehouse()` destructuring.

### 2. [`frontend_vue/src/composables/useWarehouse.ts`](../../frontend_vue/src/composables/useWarehouse.ts)

**What to remove:**

1. **Import of `deleteStockItem`** (line ~13) — Remove `deleteStockItem as deleteStockItemApi` from the import.

2. **`deleteStock` function** (lines ~353-361) — Remove the entire function.

3. **`deleteStock` from return object** (line ~599) — Remove `deleteStock` from the returned properties.

### 3. [`frontend_vue/src/services/warehouseService.ts`](../../frontend_vue/src/services/warehouseService.ts)

**What to remove:**

1. **`deleteStockItem` function** (lines ~58-60) — Remove the entire function.

### 4. [`frontend_vue/src/services/mocks/warehouse.ts`](../../frontend_vue/src/services/mocks/warehouse.ts)

**What to remove:**

1. **`mockDeleteStockItem` function** (lines ~161-165) — Remove the entire function.

### 5. [`frontend_vue/src/services/mocks/index.ts`](../../frontend_vue/src/services/mocks/index.ts)

**What to remove:**

1. **Import of `mockDeleteStockItem`** (line ~25) — Remove `mockDeleteStockItem` from the warehouse imports.

2. **Stock delete route handler** (lines ~697-700) — Remove the `stockDeleteMatch` block inside `deleteMock()`.

### 6. [`frontend_vue/src/i18n/admin/warehouse.ts`](../../frontend_vue/src/i18n/admin/warehouse.ts)

**What to remove:**

1. **`toast_stock_deleted`** translation keys (3 locales: ru line 362, en line 756, lt line 1150) — Remove these entries.

## Files NOT to Modify

- `WarehouseStockCard.vue` — This is the stock item detail card; it does NOT contain stock deletion UI (only audit log deletion, which is separate).
- `useWarehouseStockCard.ts` — Contains `deleteAuditEntry` for audit log, not stock deletion.
- `types/warehouse.ts` — No types need to be removed; `StockOverviewItem` and `StockPatchPayload` are still used for viewing/editing stock.

## Summary of Changes

| # | File | Change |
|---|------|--------|
| 1 | `WarehousePage.vue` | Remove delete button in stock table, `confirmDeleteStock()`, stock case in `handleDelete()`, and `deleteStock` from destructuring |
| 2 | `useWarehouse.ts` | Remove `deleteStock` function, its import, and its return export |
| 3 | `warehouseService.ts` | Remove `deleteStockItem` API function |
| 4 | `mocks/warehouse.ts` | Remove `mockDeleteStockItem` mock function |
| 5 | `mocks/index.ts` | Remove `mockDeleteStockItem` import and its route handler |
| 6 | `i18n/admin/warehouse.ts` | Remove `toast_stock_deleted` translations (3 locales) |

## Verification

After changes, verify:
- Stock tab loads and displays correctly
- Stock item cards open and edit properly
- Other tabs (batches, offcuts, movements, deficit) still have their delete buttons working
- No TypeScript/compilation errors
