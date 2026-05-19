# Add Column Sorting to Deficit Tab

## Overview

Add column sorting to the Deficit tab in the warehouse page, following the exact same pattern already established for Batches, Offcuts, and Movements tabs.

## Changes Required

### 1. [`frontend_vue/src/composables/useWarehouse.ts`](frontend_vue/src/composables/useWarehouse.ts)

**a) Add `deficitSort` reactive state** (after `movementsSort`, ~line 96):

```ts
// Deficit-specific sort state
const deficitSort = reactive<{ sortBy: string | null; sortDir: 'asc' | 'desc' }>({
  sortBy: null,
  sortDir: 'asc',
})
```

**b) Update `loadDeficit()`** to pass sort params (lines 199-215):

Replace:
```ts
async function loadDeficit() {
  if (!deficitInitialized.value) deficitLoading.value = true
  deficitError.value = null
  try {
    const res = await getDeficitList(filters, {
      page: deficitPagination.page.value,
      pageSize: deficitPagination.pageSize.value,
    })
```

With:
```ts
async function loadDeficit() {
  if (!deficitInitialized.value) deficitLoading.value = true
  deficitError.value = null
  try {
    const deficitFilters: WarehouseFilters = {
      ...filters,
      sortBy: deficitSort.sortBy ?? undefined,
      sortDir: deficitSort.sortDir,
    }
    const res = await getDeficitList(deficitFilters, {
      page: deficitPagination.page.value,
      pageSize: deficitPagination.pageSize.value,
    })
```

**c) Add `toggleDeficitSort()` function** (after `toggleMovementsSort`, ~line 352):

```ts
function toggleDeficitSort(col: string) {
  if (deficitSort.sortBy === col) {
    deficitSort.sortDir = deficitSort.sortDir === 'asc' ? 'desc' : 'asc'
  } else {
    deficitSort.sortBy = col
    deficitSort.sortDir = 'asc'
  }
}
```

**d) Add watcher for deficit sort** (after movements watcher, ~line 359):

```ts
// Watch deficit sort — reload deficit tab
watch(deficitSort, () => {
  suppressPageWatch = deficitPagination.page.value !== 1
  deficitPagination.reset()
  loadDeficit()
}, { deep: true })
```

**e) Export `deficitSort` and `toggleDeficitSort`** (in return statement, ~lines 407-409):

Add after `movementsSort`:
```ts
deficitSort,
```

Add after `toggleMovementsSort`:
```ts
toggleDeficitSort,
```

### 2. [`frontend_vue/src/views/admin/warehouse/WarehousePage.vue`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue)

**a) Destructure new exports** (after `toggleMovementsSort`, line 52):

```ts
deficitSort,
toggleDeficitSort,
```

**b) Replace deficit table `<th>` headers** (lines 2186-2261) with sort buttons.

The deficit table has these columns:
| Column | Field | Has tooltip? | Sort key |
|--------|-------|-------------|----------|
| Product | `productName` | No | `productName` |
| Current Stock | `currentStock` | Yes (`col_current_stock_hint`) | `currentStock` |
| Min Required | `minRequired` | Yes (`col_min_required_hint`) | `minRequired` |
| Deficit Amount | `deficitAmount` | Yes (`col_deficit_amount_hint`) | `deficitAmount` |
| Unit | `unit` | Yes (`col_unit_hint`) | `unit` |
| Priority | `priority` | Yes (`col_priority_hint`) | `priority` |
| Status | `status` | Yes (`col_status_hint`) | `status` |
| Actions | — | No | — (no sort) |

**Pattern for columns WITHOUT tooltips** (productName):
```html
<th>
  <button class="th-sort-btn" @click="toggleDeficitSort('productName')">
    {{ t('warehouse.col_product') }}
    <span class="sort-icon-group">
      <SvgIcon
        name="chevron-up"
        :width="16"
        :height="16"
        class="sort-icon"
        :class="{ active: deficitSort.sortBy === 'productName' && deficitSort.sortDir === 'asc' }"
      />
      <SvgIcon
        name="chevron-down"
        :width="16"
        :height="16"
        class="sort-icon"
        :class="{ active: deficitSort.sortBy === 'productName' && deficitSort.sortDir === 'desc' }"
      />
    </span>
  </button>
</th>
```

**Pattern for columns WITH tooltips** (currentStock, minRequired, deficitAmount, unit, priority, status):
```html
<th>
  <button class="th-sort-btn" @click="toggleDeficitSort('currentStock')">
    <div class="th-content">
      {{ t('warehouse.col_current_stock') }}
      <span v-tooltip="t('warehouse.col_current_stock_hint')" class="info-hint">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </span>
    </div>
    <span class="sort-icon-group">
      <SvgIcon
        name="chevron-up"
        :width="16"
        :height="16"
        class="sort-icon"
        :class="{ active: deficitSort.sortBy === 'currentStock' && deficitSort.sortDir === 'asc' }"
      />
      <SvgIcon
        name="chevron-down"
        :width="16"
        :height="16"
        class="sort-icon"
        :class="{ active: deficitSort.sortBy === 'currentStock' && deficitSort.sortDir === 'desc' }"
      />
    </span>
  </button>
</th>
```

**Actions column** — unchanged:
```html
<th class="th-actions">{{ t('warehouse.col_actions') }}</th>
```

### 3. [`frontend_vue/src/services/mocks/warehouse.ts`](frontend_vue/src/services/mocks/warehouse.ts)

**Extend `mockGetDeficitList` sorting** (lines 609-616) to handle all columns:

Replace the current sort block:
```ts
if (filters.sortBy) {
  filtered.sort((a, b) => {
    let cmp = 0
    if (filters.sortBy === 'deficitAmount') cmp = a.deficitAmount - b.deficitAmount
    else if (filters.sortBy === 'priority') cmp = ['critical', 'high', 'medium', 'low'].indexOf(a.priority) - ['critical', 'high', 'medium', 'low'].indexOf(b.priority)
    return filters.sortDir === 'desc' ? -cmp : cmp
  })
}
```

With:
```ts
if (filters.sortBy) {
  filtered.sort((a, b) => {
    let cmp = 0
    if (filters.sortBy === 'productName') {
      cmp = (a.productName.en ?? '').localeCompare(b.productName.en ?? '')
    } else if (filters.sortBy === 'currentStock') {
      cmp = a.currentStock - b.currentStock
    } else if (filters.sortBy === 'minRequired') {
      cmp = a.minRequired - b.minRequired
    } else if (filters.sortBy === 'deficitAmount') {
      cmp = a.deficitAmount - b.deficitAmount
    } else if (filters.sortBy === 'unit') {
      cmp = (a.unit ?? '').localeCompare(b.unit ?? '')
    } else if (filters.sortBy === 'priority') {
      cmp = ['critical', 'high', 'medium', 'low'].indexOf(a.priority) - ['critical', 'high', 'medium', 'low'].indexOf(b.priority)
    } else if (filters.sortBy === 'status') {
      cmp = (a.status ?? '').localeCompare(b.status ?? '')
    }
    return filters.sortDir === 'desc' ? -cmp : cmp
  })
}
```

## Summary of All Changes

| File | Change |
|------|--------|
| `useWarehouse.ts` | Add `deficitSort` state, update `loadDeficit()`, add `toggleDeficitSort()`, add watcher, export |
| `WarehousePage.vue` | Destructure `deficitSort`/`toggleDeficitSort`, replace 7 `<th>` headers with sort buttons |
| `warehouse.ts` (mock) | Add sort cases for `productName`, `currentStock`, `minRequired`, `unit`, `status` |
