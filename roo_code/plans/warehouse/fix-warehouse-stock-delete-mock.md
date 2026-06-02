# Fix: Warehouse Stock Tab Delete — Missing Mock Handler

## Bug Description

The delete button on the **Warehouse Stock tab** (`/admin/warehouse/stock`) shows a confirmation modal, but when the user confirms deletion, the API call fails with the error `[mock] DELETE /api/warehouse/stock/{productId} not found`. This happens because the mock handler for `DELETE /api/warehouse/stock/{productId}` is missing from the mock routing layer.

## Root Cause

The call chain is:

1. [`WarehousePage.vue`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue) — `confirmDeleteStock(item)` sets `deletingItem` with `type: 'stock'`
2. [`handleDelete()`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue) — dispatches to `deleteStock(id)` from `useWarehouse()`
3. [`useWarehouse.ts:353`](frontend_vue/src/composables/useWarehouse.ts) — calls `deleteStockItemApi(id)` (imported from service)
4. [`warehouseService.ts:58`](frontend_vue/src/services/warehouseService.ts) — calls `apiDelete('/api/warehouse/stock/${productId}')`
5. [`api.ts`](frontend_vue/src/services/api.ts) — routes to `deleteMock()` since mocks are enabled
6. [`index.ts:545-613`](frontend_vue/src/services/mocks/index.ts) — **no handler matches** `/api/warehouse/stock/{id}`
7. **Throws error**: `[mock] DELETE /api/warehouse/stock/{productId} not found`

## What's Missing (3 Changes)

### 1. `mockDeleteStockItem` function — not defined in [`warehouse.ts`](frontend_vue/src/services/mocks/warehouse.ts)

### 2. Import of `mockDeleteStockItem` — not present in [`index.ts`](frontend_vue/src/services/mocks/index.ts)

### 3. Route handler in `deleteMock` function — no regex matching `/api/warehouse/stock/{id}`

---

## Fix Plan (3 Layers)

### Layer 1: Add `mockDeleteStockItem` function

**File:** [`frontend_vue/src/services/mocks/warehouse.ts`](frontend_vue/src/services/mocks/warehouse.ts)

**Where to add:** After the `mockPatchStockItem` function (after line ~159), before the `// ─── Batches ───` section comment (line ~161).

**Code to add:**

```typescript
export async function mockDeleteStockItem(productId: string): Promise<void> {
  const idx = stockStore.findIndex((s) => s.productId === productId)
  if (idx === -1) throw new Error('STOCK_ITEM_NOT_FOUND')
  stockStore.splice(idx, 1)
}
```

**Pattern reference:** This follows the exact same pattern as [`mockDeleteBatch`](frontend_vue/src/services/mocks/warehouse.ts:327), [`mockDeleteOffcut`](frontend_vue/src/services/mocks/warehouse.ts:470), [`mockDeleteMovement`](frontend_vue/src/services/mocks/warehouse.ts:590), and [`mockDeleteDeficitItem`](frontend_vue/src/services/mocks/warehouse.ts:783):

| Function | Store | ID field | Error code |
|---|---|---|---|
| `mockDeleteBatch` | `batchStore` | `id` | `BATCH_NOT_FOUND` |
| `mockDeleteOffcut` | `offcutStore` | `id` | `OFFCUT_NOT_FOUND` |
| `mockDeleteMovement` | `movementStore` | `id` | `MOVEMENT_NOT_FOUND` |
| `mockDeleteDeficitItem` | `deficitStore` | `id` | `DEFICIT_NOT_FOUND` |
| **`mockDeleteStockItem`** | **`stockStore`** | **`productId`** | **`STOCK_ITEM_NOT_FOUND`** |

**Key difference:** Stock items use `productId` as their identifier (not `id`), consistent with [`mockGetStockItem`](frontend_vue/src/services/mocks/warehouse.ts:132) and [`mockPatchStockItem`](frontend_vue/src/services/mocks/warehouse.ts:141) which also use `productId`.

---

### Layer 2: Add import in `index.ts`

**File:** [`frontend_vue/src/services/mocks/index.ts`](frontend_vue/src/services/mocks/index.ts)

**Where to add:** Add `mockDeleteStockItem` to the existing warehouse import block (lines 2-27), between `mockPatchStockItem` (line 23) and `mockDeleteDeficitItem` (line 24).

**Change:** Insert `mockDeleteStockItem,` after `mockPatchStockItem,` on line 23.

The import block will look like this after the change:

```typescript
import {
  mockGetStockOverview,
  mockGetStockItem,
  mockGetBatches,
  mockGetBatch,
  mockCreateBatch,
  mockPatchBatch,
  mockDeleteBatch,
  mockGetOffcuts,
  mockGetOffcut,
  mockCreateOffcut,
  mockPatchOffcut,
  mockDeleteOffcut,
  mockGetMovements,
  mockCreateMovement,
  mockDeleteMovement,
  mockExecuteCutting,
  mockGetDeficitList,
  mockGetDeficitItem,
  mockCreateDeficitItem,
  mockPatchDeficitItem,
  mockPatchStockItem,
  mockDeleteStockItem,       // <-- ADD THIS LINE
  mockDeleteDeficitItem,
  mockGetStockAudit,
  mockDeleteStockAuditEntry,
} from './warehouse'
```

---

### Layer 3: Add route handler in `deleteMock` function

**File:** [`frontend_vue/src/services/mocks/index.ts`](frontend_vue/src/services/mocks/index.ts)

**Where to add:** Inside the `deleteMock` function (lines 545-613), in the `// ── Warehouse DELETE ──` section (lines 591-610). Add the stock delete handler **after** the deficit delete handler (line 610) and **before** the `throw new Error(...)` on line 612.

**Code to add:**

```typescript
  const stockDeleteMatch = path.match(/^\/api\/warehouse\/stock\/([^/]+)$/)
  if (stockDeleteMatch) {
    return delay(mockDeleteStockItem(stockDeleteMatch[1] as string) as T)
  }
```

**Placement context** (showing the full Warehouse DELETE section after the change):

```typescript
  // ── Warehouse DELETE ──
  const batchDeleteMatch = path.match(/^\/api\/warehouse\/batches\/([^/]+)$/)
  if (batchDeleteMatch) {
    return delay(mockDeleteBatch(batchDeleteMatch[1] as string) as T)
  }

  const offcutDeleteMatch = path.match(/^\/api\/warehouse\/offcuts\/([^/]+)$/)
  if (offcutDeleteMatch) {
    return delay(mockDeleteOffcut(offcutDeleteMatch[1] as string) as T)
  }

  const movementDeleteMatch = path.match(/^\/api\/warehouse\/movements\/([^/]+)$/)
  if (movementDeleteMatch) {
    return delay(mockDeleteMovement(movementDeleteMatch[1] as string) as T)
  }

  const deficitDeleteMatch = path.match(/^\/api\/warehouse\/deficit\/([^/]+)$/)
  if (deficitDeleteMatch) {
    return delay(mockDeleteDeficitItem(deficitDeleteMatch[1] as string) as T)
  }

  // NEW: Stock delete handler
  const stockDeleteMatch = path.match(/^\/api\/warehouse\/stock\/([^/]+)$/)
  if (stockDeleteMatch) {
    return delay(mockDeleteStockItem(stockDeleteMatch[1] as string) as T)
  }

  throw new Error(`[mock] DELETE ${path} not found`)
```

---

## Verification Steps

After implementing the 3 changes above, verify the fix:

1. **TypeScript compilation:** Run `npx vue-tsc --noEmit` (or the project's type-check script) to ensure no type errors from the new function or import.

2. **Manual test in browser:**
   - Navigate to `/admin/warehouse/stock`
   - Click the delete button on any stock row
   - Confirm the deletion in the modal
   - Verify the success toast appears (message: `warehouse.toast_stock_deleted`)
   - Verify the deleted item is removed from the table

3. **Check other warehouse tabs still work:**
   - Batches tab — delete should still work
   - Offcuts tab — delete should still work
   - Movements tab — delete should still work
   - Deficit tab — delete should still work

4. **Edge case:** Try deleting a stock item with a non-existent `productId` (should not be possible via UI, but the mock should throw `STOCK_ITEM_NOT_FOUND`).

---

## Summary

| # | File | Change |
|---|---|---|
| 1 | [`frontend_vue/src/services/mocks/warehouse.ts`](frontend_vue/src/services/mocks/warehouse.ts) | Add `mockDeleteStockItem(productId)` function after `mockPatchStockItem` |
| 2 | [`frontend_vue/src/services/mocks/index.ts`](frontend_vue/src/services/mocks/index.ts) | Add `mockDeleteStockItem` to the import from `./warehouse` |
| 3 | [`frontend_vue/src/services/mocks/index.ts`](frontend_vue/src/services/mocks/index.ts) | Add stock delete route handler in `deleteMock()` before the final `throw` |
