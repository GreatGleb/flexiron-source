# Plan: Add Filters to Batches Tab

## Problem

The Batches tab (and other non-Stock tabs) currently only has a single search filter, while the Stock tab has rich filters (search, category, unit, in-stock toggle, deficit toggle). The [`WarehouseFilters`](../frontend_vue/src/types/warehouse.ts:332) interface and [`getBatches()`](../frontend_vue/src/services/warehouseService.ts:52) service already support many filter parameters, but they are not exposed in the UI.

## Proposed Filters for Batches Tab

Based on discussion, we will add **4 filters** to the Batches tab:

1. **Status** — [`CustomSelect`](../frontend_vue/src/components/admin/ui/CustomSelect.vue) with `BatchStatus` options (available, reserved, partial, depleted, quarantine)
2. **Supplier** — [`CustomSelect`](../frontend_vue/src/components/admin/ui/CustomSelect.vue) with supplier list (loaded from API)
3. **Date Range** — two date inputs (dateFrom, dateTo) for filtering by `receivedAt`
4. **Unit** — [`CustomSelect`](../frontend_vue/src/components/admin/ui/CustomSelect.vue) with unit options (kg, m, pcs, m2) — same as Stock tab

## Architecture Decision

Currently, all non-Stock tabs (batches, offcuts, movements, deficit) share a single reactive [`filters`](../frontend_vue/src/composables/useWarehouse.ts:63) object. This is problematic because:
- Changing filters on one tab affects others
- Each tab needs different filter fields

**Solution:** Create a separate `batchesFilters` reactive object (similar to how `stockFilters` is separate), so batches get their own filter state independent of other tabs.

## Changes Required

### 1. [`frontend_vue/src/composables/useWarehouse.ts`](../frontend_vue/src/composables/useWarehouse.ts)

- Add a new `batchesFilters` reactive object with fields:
  ```ts
  const batchesFilters = reactive<WarehouseFilters>({
    search: '',
    status: undefined,
    supplierId: undefined,
    dateFrom: '',
    dateTo: '',
    unit: '',
    sortBy: undefined,
    sortDir: 'asc',
  })
  ```
  Note: `WarehouseFilters` already has `status` and `supplierId` fields, but we need to add `unit` to the interface.

- Update [`WarehouseFilters`](../frontend_vue/src/types/warehouse.ts:332) interface to include optional `unit?: string` field.

- Update `loadBatches()` to use `batchesFilters` instead of spreading `filters`.

- Add a watcher for `batchesFilters` (deep) that resets pagination and reloads batches (same pattern as `stockFilters` watcher).

- Return `batchesFilters` from the composable.

### 2. [`frontend_vue/src/types/warehouse.ts`](../frontend_vue/src/types/warehouse.ts)

- Add optional `unit?: string` to `WarehouseFilters` interface.

### 3. [`frontend_vue/src/views/admin/warehouse/WarehousePage.vue`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue)

- Destructure `batchesFilters` from `useWarehouse()`.

- In the filters bar template, replace the generic `v-else` block (which currently shows only search for all non-Stock tabs) with a **per-tab conditional**:

  - **Batches tab**: Show search + status + supplier + date range + unit
  - **Offcuts tab**: Keep only search (for now)
  - **Movements tab**: Keep only search (for now)
  - **Deficit tab**: Keep only search (for now)

- Add the following filter components for Batches:

  ```html
  <!-- Status filter -->
  <div class="filter-group">
    <label class="field-label">{{ t('warehouse.col_status') }}</label>
    <CustomSelect
      v-model="batchesFilters.status"
      :options="BATCH_STATUS_OPTIONS"
      :placeholder="t('warehouse.filter_status_all')"
    />
  </div>

  <!-- Supplier filter -->
  <div class="filter-group">
    <label class="field-label">{{ t('warehouse.col_supplier') }}</label>
    <CustomSelect
      v-model="batchesFilters.supplierId"
      :options="supplierFilterOptions"
      :placeholder="t('warehouse.filter_supplier_all')"
    />
  </div>

  <!-- Date range -->
  <div class="filter-group">
    <label class="field-label">{{ t('warehouse.col_date_from') }}</label>
    <input type="date" v-model="batchesFilters.dateFrom" class="glass-input" />
  </div>
  <div class="filter-group">
    <label class="field-label">{{ t('warehouse.col_date_to') }}</label>
    <input type="date" v-model="batchesFilters.dateTo" class="glass-input" />
  </div>

  <!-- Unit filter -->
  <div class="filter-group">
    <label class="field-label">{{ t('warehouse.col_unit') }}</label>
    <CustomSelect
      v-model="batchesFilters.unit"
      :options="UNIT_OPTIONS"
      :placeholder="t('warehouse.filter_unit_all')"
    />
  </div>
  ```

- Add computed `supplierFilterOptions` (similar to `categoryFilterOptions` for Stock tab). Need to load suppliers list — can use `useSuppliers()` composable or a dedicated API call.

- Add `BATCH_STATUS_OPTIONS` constant:
  ```ts
  const BATCH_STATUS_OPTIONS = [
    { value: '', label: t('warehouse.filter_status_all') },
    { value: 'available', label: t('warehouse.status_available') },
    { value: 'reserved', label: t('warehouse.status_reserved') },
    { value: 'partial', label: t('warehouse.status_partial') },
    { value: 'depleted', label: t('warehouse.status_depleted') },
    { value: 'quarantine', label: t('warehouse.status_quarantine') },
  ]
  ```

### 4. Supplier Data Loading

For the supplier filter dropdown, we need supplier options. Options:
- **A)** Use `useSuppliers()` composable — but this is designed for the suppliers list page with its own pagination/filters
- **B)** Create a lightweight API call to fetch a simple supplier list (id + name)
- **C)** Load suppliers in the WarehousePage using a dedicated method

**Recommendation:** Use a lightweight approach — add a `getSupplierList()` function to [`suppliersService.ts`](../frontend_vue/src/services/suppliersService.ts) that returns minimal supplier data (id, company name), and call it in `onMounted` of WarehousePage. This avoids coupling with the full suppliers composable.

### 5. Mock Data Updates

If using mocks, update the mock handler for batches to support the new filter parameters (`status`, `supplierId`, `dateFrom`, `dateTo`, `unit`).

### 6. i18n Keys

Add new translation keys:
- `warehouse.filter_status_all` — "All statuses"
- `warehouse.filter_supplier_all` — "All suppliers"
- `warehouse.col_date_from` — "From date"
- `warehouse.col_date_to` — "To date"
- `warehouse.col_supplier` — "Supplier" (may already exist)

## Implementation Order

1. Update `WarehouseFilters` type — add `unit` field
2. Update `useWarehouse.ts` — add `batchesFilters`, watcher, return it
3. Update `WarehousePage.vue` — add filter UI for batches tab
4. Add supplier loading logic
5. Update mock data handler for batches filtering
6. Add i18n keys
7. Test all filter combinations

## Files to Modify

| File | Change |
|------|--------|
| [`frontend_vue/src/types/warehouse.ts`](../frontend_vue/src/types/warehouse.ts) | Add `unit?: string` to `WarehouseFilters` |
| [`frontend_vue/src/composables/useWarehouse.ts`](../frontend_vue/src/composables/useWarehouse.ts) | Add `batchesFilters`, watcher, return it; update `loadBatches()` |
| [`frontend_vue/src/views/admin/warehouse/WarehousePage.vue`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue) | Add filter UI for batches tab, supplier loading, computed options |
| [`frontend_vue/src/services/suppliersService.ts`](../frontend_vue/src/services/suppliersService.ts) | Add `getSupplierList()` lightweight endpoint |
| Mock handler (if applicable) | Support new batch filter params |
| i18n files | Add new translation keys |
