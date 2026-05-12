# Add Filters to Movements Tab

## Overview
Add rich filters to the Movements tab in WarehousePage, following the same pattern as Batches and Offcuts tabs. Currently Movements only has a shared search field.

## Filters to Add
- **Type** (MovementType: receipt, expense, transfer, write-off) — CustomSelect
- **Date Range** (date from / to) — DatePicker components
- **Unit** (kg, m, pcs, m2) — CustomSelect
- **Category** (product category) — MultiSelect with checkboxes (like Stock/Offcuts)
- **Batch** (search by batch number) — SearchInput
- **Save View** button

## Changes Required

### 1. [`types/warehouse.ts`](frontend_vue/src/types/warehouse.ts)
No changes needed — `WarehouseFilters` already has `type`, `unit`, `categoryIds`, `batchNumber`, `dateFrom`, `dateTo`.

### 2. [`composables/useWarehouse.ts`](frontend_vue/src/composables/useWarehouse.ts)
- Add `movementFilters` reactive object (separate from shared `filters`), initialized with:
  ```ts
  const movementFilters = reactive<WarehouseFilters>({
    search: '',
    type: undefined,
    unit: '',
    categoryIds: [],
    batchNumber: undefined,
    dateFrom: '',
    dateTo: '',
    sortBy: undefined,
    sortDir: 'asc',
  })
  ```
- Update `loadMovements()` to use `movementFilters` instead of spreading shared `filters`:
  ```ts
  async function loadMovements() {
    ...
    const movementFiltersForApi: WarehouseFilters = {
      ...movementFilters,
      sortBy: movementsSort.sortBy ?? undefined,
      sortDir: movementsSort.sortDir,
    }
    const res = await getMovements(movementFiltersForApi, { ... })
    ...
  }
  ```
- Add deep watcher for `movementFilters` (same pattern as `offcutFilters`):
  ```ts
  watch(movementFilters, () => {
    suppressPageWatch = movementsPagination.page.value !== 1
    movementsPagination.reset()
    loadMovements()
  }, { deep: true })
  ```
- Add `movementFilters` to the return statement

### 3. [`services/warehouseService.ts`](frontend_vue/src/services/warehouseService.ts)
- Add `unit`, `categoryIds`, `batchNumber` params to `getMovements()`:
  ```ts
  if (filters.unit) params.unit = filters.unit
  if (filters.categoryIds && filters.categoryIds.length > 0) params.categoryIds = filters.categoryIds.join(',')
  if (filters.batchNumber) params.batchNumber = filters.batchNumber
  ```

### 4. [`services/mocks/warehouse.ts`](frontend_vue/src/services/mocks/warehouse.ts)
- Update `mockGetMovements` filter signature to add `unit`, `categoryIds`, `batchNumber`:
  ```ts
  filters: { search: string; type?: string; productId?: string; unit?: string; categoryIds?: string; batchNumber?: string; dateFrom?: string; dateTo?: string; sortBy?: string; sortDir?: string }
  ```
- Add filtering logic:
  ```ts
  if (filters.unit) filtered = filtered.filter((m) => m.unit === filters.unit)
  if (filters.categoryIds) {
    const ids = filters.categoryIds.split(',')
    filtered = filtered.filter((m) => ids.includes(m.productId)) // filter by productId since movements don't have categoryId directly
  }
  if (filters.batchNumber) filtered = filtered.filter((m) => m.batchNumber.toLowerCase().includes(filters.batchNumber!.toLowerCase()))
  ```

**Note on Category filter**: Movements mock data doesn't have `categoryId` directly. The `MovementListItem` type only has `productId`. To filter by category, we'd need to look up the product's category. Since this is mock data, a simpler approach: filter movements by `productId` that belong to the selected categories. We can import `PRODUCTS_STORE` from `./products` and do a lookup. However, this adds complexity. A pragmatic approach: since movements reference `productId`, we can filter by looking up which products belong to the selected categories.

Actually, looking at the mock more carefully — `WarehouseMovement` has `productId` but no `categoryId`. The `MovementListItem` also only has `productId`. To filter by category, we need to:
1. Get the list of product IDs that belong to the selected categories
2. Filter movements by those product IDs

This requires importing `PRODUCTS_STORE` from `./products` in the mock file.

### 5. [`services/mocks/index.ts`](frontend_vue/src/services/mocks/index.ts)
- Forward `unit`, `categoryIds`, `batchNumber` params to `mockGetMovements`:
  ```ts
  unit: params?.unit,
  categoryIds: params?.categoryIds,
  batchNumber: params?.batchNumber,
  ```

### 6. [`WarehousePage.vue`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue)
- **Script section**:
  - Destructure `movementFilters` from composable
  - Add `MOVEMENT_TYPE_OPTIONS` constant:
    ```ts
    const MOVEMENT_TYPE_OPTIONS = [
      { value: '', label: t('warehouse.filter_type_all') },
      { value: 'receipt', label: t('warehouse.type_receipt') },
      { value: 'expense', label: t('warehouse.type_expense') },
      { value: 'transfer', label: t('warehouse.type_transfer') },
      { value: 'write-off', label: t('warehouse.type_write_off') },
    ]
    ```
  - Add `MOVEMENT_UNIT_OPTIONS` constant (same as `UNIT_OPTIONS` or `BATCH_UNIT_OPTIONS`):
    ```ts
    const MOVEMENT_UNIT_OPTIONS = [
      { value: '', label: t('warehouse.filter_unit_all') },
      { value: 'kg', label: t('warehouse.unit_kg') },
      { value: 'm', label: label: t('warehouse.unit_m') },
      { value: 'pcs', label: t('warehouse.unit_pcs') },
      { value: 'm2', label: t('warehouse.unit_m2') },
    ]
    ```
  - Add `MOVEMENT_PREFS_KEY` and `saveMovementsView()` function:
    ```ts
    const MOVEMENT_PREFS_KEY = 'warehouse_movements_prefs'
    
    function saveMovementsView() {
      const prefs = {
        search: movementFilters.search,
        type: movementFilters.type,
        unit: movementFilters.unit,
        categoryIds: movementFilters.categoryIds ? [...movementFilters.categoryIds] : [],
        batchNumber: movementFilters.batchNumber,
        dateFrom: movementFilters.dateFrom,
        dateTo: movementFilters.dateTo,
      }
      localStorage.setItem(MOVEMENT_PREFS_KEY, JSON.stringify(prefs))
      toast.show(t('msg.prefs_saved'))
    }
    ```

- **Template section** — Replace the shared search-only template for movements with a dedicated filter block:
  ```vue
  <template v-else-if="activeTab === 'movements'">
    <div class="filter-group" data-test="warehouse-filter-search">
      <label class="field-label">{{ t('warehouse.col_search') }}</label>
      <SearchInput
        v-model="movementFilters.search"
        :placeholder="t('warehouse.search_placeholder')"
        data-test="warehouse-movements-search"
      />
    </div>
    <div class="filter-group" data-test="warehouse-filter-type">
      <label class="field-label">{{ t('warehouse.col_type') }}</label>
      <CustomSelect
        :model-value="movementFilters.type ?? ''"
        :options="MOVEMENT_TYPE_OPTIONS"
        data-test="warehouse-movements-type-filter"
        @update:model-value="(v: string) => movementFilters.type = (v || undefined) as any"
      />
    </div>
    <div class="filter-group" data-test="warehouse-filter-date-from">
      <label class="field-label">{{ t('warehouse.filter_date_from') }}</label>
      <DatePicker
        :model-value="movementFilters.dateFrom ?? ''"
        :placeholder="t('warehouse.filter_date_from')"
        data-test="warehouse-movements-date-from"
        @update:model-value="(v: string) => movementFilters.dateFrom = v || undefined"
      />
    </div>
    <div class="filter-group" data-test="warehouse-filter-date-to">
      <label class="field-label">{{ t('warehouse.filter_date_to') }}</label>
      <DatePicker
        :model-value="movementFilters.dateTo ?? ''"
        :placeholder="t('warehouse.filter_date_to')"
        data-test="warehouse-movements-date-to"
        @update:model-value="(v: string) => movementFilters.dateTo = v || undefined"
      />
    </div>
    <div class="filter-group" data-test="warehouse-filter-unit">
      <label class="field-label">{{ t('warehouse.col_unit') }}</label>
      <CustomSelect
        :model-value="movementFilters.unit ?? ''"
        :options="MOVEMENT_UNIT_OPTIONS"
        data-test="warehouse-movements-unit-filter"
        @update:model-value="(v: string) => movementFilters.unit = v || undefined"
      />
    </div>
    <div class="filter-group" data-test="warehouse-filter-category">
      <label class="field-label">{{ t('warehouse.col_category') }}</label>
      <MultiSelect
        :model-value="movementFilters.categoryIds ?? []"
        @update:model-value="(v: string[]) => movementFilters.categoryIds = v"
        :options="categoryFilterOptions"
        :placeholder="t('warehouse.filter_category_all')"
        data-test="warehouse-movements-category-filter"
      />
    </div>
    <div class="filter-group" data-test="warehouse-filter-batch">
      <label class="field-label">{{ t('warehouse.col_batch_number') }}</label>
      <SearchInput
        :model-value="movementFilters.batchNumber ?? ''"
        :placeholder="t('warehouse.filter_batch_placeholder')"
        data-test="warehouse-movements-batch-filter"
        @update:model-value="(v: string) => movementFilters.batchNumber = v || undefined"
      />
    </div>
    <button class="btn btn-primary" data-test="warehouse-movements-save-view-btn" @click="saveMovementsView">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
      </svg>
      <span>{{ t('btn.save_view') }}</span>
    </button>
  </template>
  ```

- Update the `v-else` block to only apply to Deficit tab:
  ```vue
  <template v-else-if="activeTab === 'deficit'">
    ...
  </template>
  ```

### 7. [`services/mocks/warehouse.ts`](frontend_vue/src/services/mocks/warehouse.ts) — Category filter for movements
Since `WarehouseMovement` doesn't have `categoryId`, we need to look up products by category. Import `PRODUCTS_STORE` and filter movements by `productId` matching products in selected categories:

```ts
import { STORE as PRODUCTS_STORE } from './products'

// In mockGetMovements:
if (filters.categoryIds) {
  const ids = filters.categoryIds.split(',')
  const productIdsInCategories = PRODUCTS_STORE
    .filter((p) => p.categoryId !== null && ids.includes(p.categoryId))
    .map((p) => p.id)
  filtered = filtered.filter((m) => productIdsInCategories.includes(m.productId))
}
```

## Summary of Files to Modify
| # | File | Change |
|---|------|--------|
| 1 | `composables/useWarehouse.ts` | Add `movementFilters` reactive, update `loadMovements()`, add watcher, return it |
| 2 | `services/warehouseService.ts` | Add `unit`, `categoryIds`, `batchNumber` params |
| 3 | `services/mocks/warehouse.ts` | Update filter signature, add filtering logic, import PRODUCTS_STORE |
| 4 | `services/mocks/index.ts` | Forward new params |
| 5 | `WarehousePage.vue` | Add filter UI, constants, save function, update template |
