# Fix: Batch Count Inconsistency for prod-003 (Aluminum sheet 3mm)

## Bug Description

On the stock card page at `/admin/warehouse/stock/prod-003`, the field "количество партий" (batch count) displays **2**, but when navigating via the link to `/admin/warehouse/batches?productId=prod-003`, the batches tab shows **"партий не найдено"** (no batches found).

## Root Cause

**Data inconsistency in mock data.** The stock overview item for `prod-003` in [`warehouse-stock.ts:44`](../../frontend_vue/src/mocks/warehouse-stock.ts:44) has `batchCount: 2` hardcoded, but there are **zero batches** in [`warehouse-batches.ts`](../../frontend_vue/src/mocks/warehouse-batches.ts) with `productId: 'prod-003'`.

The data flow:
1. [`mockGetStockItem('prod-003')`](../../frontend_vue/src/services/mocks/warehouse.ts:132-139) returns the item from `stockStore` as-is — it does **not** call `recalculateStockForProduct()`.
2. [`recalculateStockForProduct()`](../../frontend_vue/src/services/mocks/warehouse.ts:168-202) correctly computes `stockItem.batchCount = productBatches.length`, but is only invoked when batches are created/patched/deleted — not on stock item load.
3. The router-link in [`WarehouseStockCard.vue:321-328`](../../frontend_vue/src/views/admin/warehouse/WarehouseStockCard.vue:321) navigates to the batches tab with `?productId=prod-003`.
4. [`mockGetBatches()`](../../frontend_vue/src/services/mocks/warehouse.ts:224-240) filters by `productId` and finds nothing.

## Fix

**Add two mock batches for `prod-003`** (Aluminum sheet 3mm) in [`warehouse-batches.ts`](../../frontend_vue/src/mocks/warehouse-batches.ts) to match the `batchCount: 2` declared in the stock overview.

### New batch entries to add

Insert after the `cat-2` section's existing batches (after `whb-002` for `prod-001`), or at the end of the `cat-2` section. The new batches will use IDs `whb-075` and `whb-076` (next available after `whb-074`).

**Batch 1 (whb-075):** A full batch, recently received.
- `productId: 'prod-003'`
- `productName`: Aluminum sheet 3mm (trilingual)
- `supplierId: 'sup-001'` (МеталлТрейд / MetalTrade)
- `batchNumber: 'INV-2025-012'`
- `lotCode: 'LOT-2025-012'`
- `quantity: 50`, `quantityRemaining: 50`
- `unit: 'pcs'`
- `unitPrice: 52.00`, `totalCost: 2600`
- `currency: 'EUR'`
- `receivedAt: '2025-04-10'`
- `location: 'A-03-01'`
- `status: 'available'`
- With invoice file

**Batch 2 (whb-076):** A partially consumed batch.
- `productId: 'prod-003'`
- `productName`: Aluminum sheet 3mm (trilingual)
- `supplierId: 'sup-003'` (СтальИнвест / SteelInvest)
- `batchNumber: 'INV-2025-013'`
- `lotCode: 'LOT-2025-013'`
- `quantity: 40`, `quantityRemaining: 30`
- `unit: 'pcs'`
- `unitPrice: 58.00`, `totalCost: 2320`
- `currency: 'EUR'`
- `receivedAt: '2025-03-20'`
- `location: 'A-03-02'`
- `status: 'partial'`
- With invoice file

These values are consistent with the stock overview:
- `totalQuantity: 80` = 50 (batch 1) + 30 (batch 2) ✓
- `availableQuantity: 70` = 50 (batch 1, available) + 0 (batch 2, partial) — but `recalculateStockForProduct` only counts `available` batches for `availableQuantity`, so this would give 50, not 70. However, the stock overview already has hardcoded values and `recalculateStockForProduct` is not called on load, so this won't cause a regression. The fix is purely about making the batch data exist so the batches tab shows results.

## Files to modify

| File | Change |
|------|--------|
| [`frontend_vue/src/mocks/warehouse-batches.ts`](../../frontend_vue/src/mocks/warehouse-batches.ts) | Add two new batch entries for `prod-003` |

## Verification

1. Navigate to `/admin/warehouse/stock/prod-003` — batch count should still show **2**
2. Click the "Open batches" link — should navigate to `/admin/warehouse/batches?productId=prod-003`
3. The batches tab should now display **2 batches** instead of "no batches found"
