# Refactor: Split Warehouse Mock Data into Separate Files

## Problem

The file [`frontend_vue/src/mocks/warehouse.ts`](frontend_vue/src/mocks/warehouse.ts) contains all mock data for all 5 warehouse tabs in a single file (2414 lines). During the previous task, when `mockBatches` was expanded to 74 items, the file became unwieldy. Additionally, when the file was truncated during a `write_to_file` operation, the `mockStockOverview` was restored with only 33 items instead of the original ~100, because the original data was lost.

## Solution

Split the monolithic file into 5 separate files, one per warehouse tab, plus a barrel export file.

## Plan

### Step 1: Create individual mock data files

Each file will export a single array with the correct type annotation.

| File | Export | Type | Items |
|------|--------|------|-------|
| [`frontend_vue/src/mocks/warehouse-batches.ts`](frontend_vue/src/mocks/warehouse-batches.ts) | `mockBatches` | `WarehouseBatch[]` | 74 |
| [`frontend_vue/src/mocks/warehouse-offcuts.ts`](frontend_vue/src/mocks/warehouse-offcuts.ts) | `mockOffcuts` | `WarehouseOffcut[]` | 3 |
| [`frontend_vue/src/mocks/warehouse-movements.ts`](frontend_vue/src/mocks/warehouse-movements.ts) | `mockMovements` | `WarehouseMovement[]` | 7 |
| [`frontend_vue/src/mocks/warehouse-deficit.ts`](frontend_vue/src/mocks/warehouse-deficit.ts) | `mockDeficit` | `WarehouseDeficit[]` | 3 |
| [`frontend_vue/src/mocks/warehouse-stock.ts`](frontend_vue/src/mocks/warehouse-stock.ts) | `mockStockOverview` | `StockOverviewItem[]` | 33 (currently) |

### Step 2: Update [`frontend_vue/src/mocks/warehouse.ts`](frontend_vue/src/mocks/warehouse.ts)

Replace the entire file content with a barrel export that re-exports from the individual files:

```typescript
export { mockBatches } from './warehouse-batches'
export { mockOffcuts } from './warehouse-offcuts'
export { mockMovements } from './warehouse-movements'
export { mockDeficit } from './warehouse-deficit'
export { mockStockOverview } from './warehouse-stock'
```

This ensures that the import path `@/mocks/warehouse` used by [`frontend_vue/src/services/mocks/warehouse.ts`](frontend_vue/src/services/mocks/warehouse.ts) continues to work without any changes.

### Step 3: Verify

Run `npx vue-tsc --noEmit` to ensure zero TypeScript errors.

## Dependency Graph

```
frontend_vue/src/mocks/warehouse-batches.ts  ─┐
frontend_vue/src/mocks/warehouse-offcuts.ts   ─┤
frontend_vue/src/mocks/warehouse-movements.ts ─┤──► frontend_vue/src/mocks/warehouse.ts ──► frontend_vue/src/services/mocks/warehouse.ts
frontend_vue/src/mocks/warehouse-deficit.ts   ─┤
frontend_vue/src/mocks/warehouse-stock.ts     ─┘
```

No changes needed to [`frontend_vue/src/services/mocks/warehouse.ts`](frontend_vue/src/services/mocks/warehouse.ts) — it still imports from `@/mocks/warehouse`.

## Future Improvement

Once the split is done, the `mockStockOverview` can be expanded back to ~100 items in its own file without affecting any other tab's data.
