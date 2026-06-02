# Plan: Default movements sort by date descending

## Goal
Make the movements table (and batch card movements section) sort by `movedAt` in descending order by default — newest movement appears first.

## Changes

### 1. [`useWarehouse.ts`](frontend_vue/src/composables/useWarehouse.ts:164) — composable

Change the `movementsSort` reactive default from:
```ts
const movementsSort = reactive<{ sortBy: string | null; sortDir: 'asc' | 'desc' }>({
  sortBy: null,
  sortDir: 'asc',
})
```
to:
```ts
const movementsSort = reactive<{ sortBy: string | null; sortDir: 'asc' | 'desc' }>({
  sortBy: 'movedAt',
  sortDir: 'desc',
})
```

This ensures:
- On initial load, `loadMovements()` passes `sortBy: 'movedAt'` and `sortDir: 'desc'` to the API
- The Date column's desc sort icon lights up immediately (the template already checks `movementsSort.sortBy === 'movedAt' && movementsSort.sortDir === 'desc'`)
- When user clicks the Date column header, `toggleMovementsSort('movedAt')` toggles to `asc` (since `sortBy` already equals `'movedAt'`, it flips `sortDir`)

### 2. [`warehouse.ts` mock](frontend_vue/src/services/mocks/warehouse.ts:758) — mock service

In `mockGetMovements`, when `filters.sortBy` is not provided, default to sorting by `movedAt` descending:

```ts
// Before:
if (filters.sortBy) {
  filtered.sort(...)
}

// After:
const sortBy = filters.sortBy || 'movedAt'
const sortDir = filters.sortDir || 'desc'
filtered.sort((a, b) => {
  let cmp = 0
  if (sortBy === 'movedAt') cmp = a.movedAt.localeCompare(b.movedAt)
  else if (sortBy === 'type') cmp = a.type.localeCompare(b.type)
  // ... rest of sort cases
  return sortDir === 'desc' ? -cmp : cmp
})
```

This ensures the mock data also returns newest-first by default, matching real backend behavior.

### 3. [`WarehousePage.vue`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue:2453-2468) — template

No changes needed. The sort icon logic already handles the `desc` state correctly:
```html
:class="{ active: movementsSort.sortBy === 'movedAt' && movementsSort.sortDir === 'desc' }"
```
Once `movementsSort` defaults to `{ sortBy: 'movedAt', sortDir: 'desc' }`, the down-chevron will be active.

### 4. [`useWarehouseBatch.ts`](frontend_vue/src/composables/useWarehouseBatch.ts:290) — batch card movements

Add sort params to the `getMovements` call so batch card movements are also newest-first:

```ts
const response = await getMovements(
  { search: '', batchNumber: batch.value.batchNumber, sortBy: 'movedAt', sortDir: 'desc' },
  { page: 1, pageSize: 50 },
)
```

## Files to modify
1. `frontend_vue/src/composables/useWarehouse.ts` — line 164-167
2. `frontend_vue/src/services/mocks/warehouse.ts` — lines 758-772
3. `frontend_vue/src/composables/useWarehouseBatch.ts` — line 290-291
