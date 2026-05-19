# Refactoring Plan: Server-Side Filtering, Pagination & Sorting

## Current State Analysis

### ✅ Already Server-Side (No Changes Needed)

| Page | Composable | Service | Mock |
|------|-----------|---------|------|
| **ProductsPage** | [`useProducts()`](frontend_vue/src/composables/useProducts.ts) — passes `filters` + `pagination` to service | [`getProducts(filters, pagination)`](frontend_vue/src/services/productsService.ts:6) — sends `search`, `page`, `pageSize`, `categoryIds`, `sortBy`, `sortDir` | [`mockGetProducts()`](frontend_vue/src/services/mocks/products.ts:2202) — implements server-side filtering, sorting, pagination |
| **SuppliersListPage** | [`useSuppliers()`](frontend_vue/src/composables/useSuppliers.ts) — passes `filters` + `pagination` to service | [`getSuppliers(filters, pagination)`](frontend_vue/src/services/suppliersService.ts:6) — sends `search`, `status`, `categories`, `rating`, `page`, `pageSize` | [`mockGetSuppliers()`](frontend_vue/src/services/mocks/suppliers.ts) — implements server-side filtering, pagination |
| **ServicesPage** | [`useServices()`](frontend_vue/src/composables/useServices.ts) — passes `filters` + `pagination` to service | [`getServices(filters, pagination)`](frontend_vue/src/services/servicesService.ts:7) — sends `search`, `sortBy`, `sortDir`, `page`, `pageSize` | [`mockGetServices()`](frontend_vue/src/services/mocks/services.ts) — implements server-side filtering, sorting, pagination |

### ❌ Client-Side (Needs Refactoring)

| Page | Tab | Issue |
|------|-----|-------|
| **WarehousePage** | **Stock** | **Full client-side filtering + pagination** — `stockSearch`, `showDeficitOnly`, `showInStockOnly`, `stockUnitFilter`, `stockCategoryIds` are all local refs; `filteredStockItems` is a computed that filters in-memory; `paginatedStockItems` slices client-side; `stockPage`/`stockPageSize` are local refs with manual pagination logic |

### ⚠️ Partially Server-Side (Warehouse Non-Stock Tabs)

| Tab | Service | Status |
|-----|---------|--------|
| **Batches** | [`getBatches(filters, pagination)`](frontend_vue/src/services/warehouseService.ts:35) — already server-side ✅ | Uses `usePagination()` correctly |
| **Offcuts** | [`getOffcuts(filters, pagination)`](frontend_vue/src/services/warehouseService.ts:72) — already server-side ✅ | Uses `usePagination()` correctly |
| **Movements** | [`getMovements(filters, pagination)`](frontend_vue/src/services/warehouseService.ts:102) — already server-side ✅ | Uses `usePagination()` correctly |
| **Deficit** | [`getDeficitList(filters, pagination)`](frontend_vue/src/services/warehouseService.ts:132) — already server-side ✅ | Uses `usePagination()` correctly |

## Refactoring Plan: WarehousePage Stock Tab

### Problem

The Stock tab in [`WarehousePage.vue`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue) fetches ALL stock items via [`getStockOverview()`](frontend_vue/src/services/warehouseService.ts:25) (returns `StockOverviewItem[]` — no pagination), then filters and paginates entirely on the client:

- [`stockSearch`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue:72) — local `ref('')`
- [`showDeficitOnly`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue:73) — local `ref(false)`
- [`showInStockOnly`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue:74) — local `ref(false)`
- [`stockUnitFilter`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue:75) — local `ref('')`
- [`stockCategoryIds`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue:76) — local `ref<string[]>([])`
- [`filteredStockItems`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue:208) — computed that filters in-memory
- [`paginatedStockItems`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue:233) — computed that slices in-memory
- [`stockPage`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue:79) — local `ref(1)`
- [`stockPageSize`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue:80) — local `ref(25)`
- [`stockPageNumbers()`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue:102) — manual pagination logic
- [`stockTotalPages`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue:96) — computed from `filteredStockItems.length`

### Solution

#### Step 1: Update `StockOverviewItem` type to support paginated response

Change [`StockOverviewResponse`](frontend_vue/src/types/warehouse.ts:342) from `StockOverviewItem[]` to `PaginatedResponse<StockOverviewItem>`.

#### Step 2: Update `getStockOverview()` service to accept filters + pagination

Change [`getStockOverview()`](frontend_vue/src/services/warehouseService.ts:25) to accept `(filters: StockFilters, pagination: PaginationParams)` and pass query params.

#### Step 3: Update `mockGetStockOverview()` to implement server-side filtering

Update [`mockGetStockOverview()`](frontend_vue/src/services/mocks/warehouse.ts:60) to accept filters + pagination params and implement:
- `search` — filter by product name
- `categoryIds` — filter by category
- `unit` — filter by unit of measure
- `showDeficitOnly` — filter `isDeficit === true`
- `showInStockOnly` — filter `availableQuantity > 0`
- `page` / `pageSize` — paginate
- Return `PaginatedResponse<StockOverviewItem>`

#### Step 4: Update mock index to pass params to stock overview

Update [`getMock()`](frontend_vue/src/services/mocks/index.ts:209) for `/api/warehouse/stock` to extract and pass filter/pagination params.

#### Step 5: Update `useWarehouse()` composable

Add stock-specific filters to [`useWarehouse()`](frontend_vue/src/composables/useWarehouse.ts) and update [`loadStock()`](frontend_vue/src/composables/useWarehouse.ts:76) to pass filters + pagination.

#### Step 6: Update `WarehousePage.vue` Stock tab template

Replace all client-side filter refs, computed properties, and manual pagination with the composable's reactive filters + `usePagination()`.

### Detailed Changes

#### 1. [`frontend_vue/src/types/warehouse.ts`](frontend_vue/src/types/warehouse.ts)

```typescript
// Change line 342 from:
export type StockOverviewResponse = StockOverviewItem[]
// To:
export type StockOverviewResponse = PaginatedResponse<StockOverviewItem>

// Add StockFilters interface:
export interface StockFilters {
  search: string
  categoryIds: string[]
  unit: string
  showDeficitOnly: boolean
  showInStockOnly: boolean
}
```

#### 2. [`frontend_vue/src/services/warehouseService.ts`](frontend_vue/src/services/warehouseService.ts)

```typescript
// Change getStockOverview to accept filters + pagination
export async function getStockOverview(
  filters: StockFilters,
  pagination: PaginationParams,
): Promise<StockOverviewResponse> {
  const params: Record<string, string> = {
    search: filters.search,
    page: String(pagination.page),
    pageSize: String(pagination.pageSize),
  }
  if (filters.categoryIds.length > 0) params.categoryIds = filters.categoryIds.join(',')
  if (filters.unit) params.unit = filters.unit
  if (filters.showDeficitOnly) params.showDeficitOnly = 'true'
  if (filters.showInStockOnly) params.showInStockOnly = 'true'
  return apiGet<StockOverviewResponse>('/api/warehouse/stock', params)
}
```

#### 3. [`frontend_vue/src/services/mocks/warehouse.ts`](frontend_vue/src/services/mocks/warehouse.ts)

```typescript
export async function mockGetStockOverview(
  filters: {
    search: string
    categoryIds?: string
    unit?: string
    showDeficitOnly?: string
    showInStockOnly?: string
  },
  pagination: { page: number; pageSize: number },
): Promise<PaginatedResponse<StockOverviewItem>> {
  let filtered = [...stockStore]

  if (filters.search) {
    const q = filters.search.toLowerCase()
    filtered = filtered.filter((item) =>
      item.productName.ru.toLowerCase().includes(q) ||
      item.productName.en.toLowerCase().includes(q) ||
      item.productName.lt.toLowerCase().includes(q),
    )
  }
  if (filters.categoryIds) {
    const ids = filters.categoryIds.split(',')
    filtered = filtered.filter((item) => item.categoryId && ids.includes(item.categoryId))
  }
  if (filters.unit) {
    filtered = filtered.filter((item) => item.unit === filters.unit)
  }
  if (filters.showDeficitOnly === 'true') {
    filtered = filtered.filter((item) => item.isDeficit)
  }
  if (filters.showInStockOnly === 'true') {
    filtered = filtered.filter((item) => item.availableQuantity > 0)
  }

  return paginate(filtered, pagination.page, pagination.pageSize)
}
```

#### 4. [`frontend_vue/src/services/mocks/index.ts`](frontend_vue/src/services/mocks/index.ts)

```typescript
// Update the /api/warehouse/stock handler (line ~209)
if (path === '/api/warehouse/stock') {
  const page = Number(params?.page ?? 1)
  const pageSize = Number(params?.pageSize ?? 25)
  return delay(mockGetStockOverview({
    search: params?.search ?? '',
    categoryIds: params?.categoryIds,
    unit: params?.unit,
    showDeficitOnly: params?.showDeficitOnly,
    showInStockOnly: params?.showInStockOnly,
  }, { page, pageSize }) as T)
}
```

#### 5. [`frontend_vue/src/composables/useWarehouse.ts`](frontend_vue/src/composables/useWarehouse.ts)

Add stock-specific filters and update `loadStock()`:

```typescript
// Add stock filters
const stockFilters = reactive<StockFilters>({
  search: '',
  categoryIds: [],
  unit: '',
  showDeficitOnly: false,
  showInStockOnly: false,
})

// Update loadStock to pass filters + pagination
async function loadStock() {
  if (!stockInitialized.value) stockLoading.value = true
  stockError.value = null
  try {
    const res = await getStockOverview(stockFilters, {
      page: pagination.page.value,
      pageSize: pagination.pageSize.value,
    })
    stockItems.value = res.items
    pagination.total.value = res.total
    stockInitialized.value = true
  } catch (e) {
    stockError.value = e instanceof Error ? e.message : 'Failed to load stock overview'
  } finally {
    stockLoading.value = false
  }
}

// Add watchers for stock filters
watch(stockFilters, () => {
  pagination.reset()
  loadStock()
}, { deep: true })

// Return stockFilters
return { ..., stockFilters }
```

#### 6. [`frontend_vue/src/views/admin/warehouse/WarehousePage.vue`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue)

Remove all client-side stock filter refs, computed properties, and manual pagination. Replace with:

```typescript
// Remove these (lines 72-120):
// const stockSearch = ref('')
// const showDeficitOnly = ref(false)
// const showInStockOnly = ref(false)
// const stockUnitFilter = ref<string>('')
// const stockCategoryIds = ref<string[]>([])
// const stockPage = ref(1)
// const stockPageSize = ref(25)
// const STOCK_PAGE_SIZE_OPTIONS = [...]
// const stockPageSizeStr = computed(...)
// const stockTotalPages = computed(...)
// const stockHasPrev = computed(...)
// const stockHasNext = computed(...)
// const stockShowingFrom = computed(...)
// const stockShowingTo = computed(...)
// function stockPageNumbers() {...}
// function stockGoTo(p) {...}
// function stockPrev() {...}
// function stockNext() {...}
// const filteredStockItems = computed(...)
// const paginatedStockItems = computed(...)
// watch(filteredStockItems, () => { stockPage.value = 1 })
// watch(filteredStockItems, () => { startFilterTransition() })

// Destructure stockFilters from useWarehouse
const { ..., stockFilters } = useWarehouse()

// Use pagination from composable instead of local refs
// Replace stockPageSizeStr with pageSizeStr (already exists)
// Replace stockPageNumbers with pagination.pageNumbers
// Replace stockHasPrev with pagination.hasPrev
// Replace stockHasNext with pagination.hasNext
// Replace stockGoTo with pagination.goTo
// Replace stockPrev with pagination.prev
// Replace stockNext with pagination.next

// Update template:
// v-model="stockSearch" → v-model="stockFilters.search"
// v-model="stockCategoryIds" → v-model="stockFilters.categoryIds"
// v-model="stockUnitFilter" → v-model="stockFilters.unit"
// v-model="showInStockOnly" → v-model="stockFilters.showInStockOnly"
// v-model="showDeficitOnly" → v-model="stockFilters.showDeficitOnly"
// v-for="item in paginatedStockItems" → v-for="item in stockItems"
// stockPageSizeStr → pageSizeStr
// stockPageNumbers() → pagination.pageNumbers()
// stockHasPrev → pagination.hasPrev.value
// stockHasNext → pagination.hasNext.value
// stockGoTo(p) → pagination.goTo(p)
// stockPrev() → pagination.prev()
// stockNext() → pagination.next()
// stockPage → pagination.page.value
// stockShowingFrom → pagination.showingFrom
// stockShowingTo → pagination.showingTo
// filteredStockItems.length → pagination.total.value
```

### Files to Modify

1. [`frontend_vue/src/types/warehouse.ts`](frontend_vue/src/types/warehouse.ts) — Change `StockOverviewResponse` type, add `StockFilters`
2. [`frontend_vue/src/services/warehouseService.ts`](frontend_vue/src/services/warehouseService.ts) — Update `getStockOverview()` signature
3. [`frontend_vue/src/services/mocks/warehouse.ts`](frontend_vue/src/services/mocks/warehouse.ts) — Update `mockGetStockOverview()` with server-side filtering
4. [`frontend_vue/src/services/mocks/index.ts`](frontend_vue/src/services/mocks/index.ts) — Pass params to `mockGetStockOverview()`
5. [`frontend_vue/src/composables/useWarehouse.ts`](frontend_vue/src/composables/useWarehouse.ts) — Add `stockFilters`, update `loadStock()`
6. [`frontend_vue/src/views/admin/warehouse/WarehousePage.vue`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue) — Replace client-side logic with composable

### What NOT to Change

- **ProductsPage** — already server-side ✅
- **SuppliersListPage** — already server-side ✅
- **ServicesPage** — already server-side ✅
- **Warehouse non-stock tabs** (Batches, Offcuts, Movements, Deficit) — already server-side ✅
- **Filter transition flicker fix** — keep the `filteringStock` / `startFilterTransition()` logic, but adapt it to work with the composable's `stockLoading` state
