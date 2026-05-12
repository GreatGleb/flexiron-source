# Plan: Add remaining filters to Offcuts tab

## Current state

The Offcuts tab already has these filters implemented:
- ✅ Search (free-text)
- ✅ Status (OffcutStatus dropdown: available, reserved, used, scrap)
- ✅ Unit (dropdown: kg, m, pcs, m2)
- ✅ Offcut Type (dropdown: sheet, linear)
- ✅ Save View button

## What needs to be added

The user wants to add 3 more filters:
1. **Product** — select a product from a dropdown
2. **Category** — select a product category from a dropdown
3. **Batch** — search by batch number (free-text input)

## Changes

### 1. [`types/warehouse.ts`](frontend_vue/src/types/warehouse.ts:332) — Add fields to `WarehouseFilters`

Add `categoryId?: string` and `batchNumber?: string` to the interface.

`productId?: string` already exists.

### 2. [`composables/useWarehouse.ts`](frontend_vue/src/composables/useWarehouse.ts:82) — Add fields to `offcutFilters`

Add `productId: undefined`, `categoryId: undefined`, `batchNumber: undefined` to the reactive object.

### 3. [`services/warehouseService.ts`](frontend_vue/src/services/warehouseService.ts:90) — Add params to `getOffcuts()`

```typescript
if (filters.productId) params.productId = filters.productId
if (filters.categoryId) params.categoryId = filters.categoryId
if (filters.batchNumber) params.batchNumber = filters.batchNumber
```

### 4. [`services/mocks/warehouse.ts`](frontend_vue/src/services/mocks/warehouse.ts:319) — Add filtering to `mockGetOffcuts()`

- Add `productId`, `categoryId`, `batchNumber` to the filter type signature
- Add filtering logic:
  ```typescript
  if (filters.productId) filtered = filtered.filter((o) => o.productId === filters.productId)
  if (filters.categoryId) filtered = filtered.filter((o) => o.categoryId === filters.categoryId)
  if (filters.batchNumber) filtered = filtered.filter((o) => o.batchNumber.toLowerCase().includes(filters.batchNumber!.toLowerCase()))
  ```

### 5. [`services/mocks/index.ts`](frontend_vue/src/services/mocks/index.ts:255) — Forward new params

Add `productId`, `categoryId`, `batchNumber` to the mock handler call.

### 6. [`WarehousePage.vue`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue) — Add filter UI

Add 3 new filter groups to the offcuts template section (after the existing Offcut Type filter):

- **Product** — `CustomSelect` with product options. Need to load product list. Since there's no lightweight `getProductList()` endpoint, we can either:
  - Option A: Create a simple `getProductList()` service + mock handler (like `getSupplierList()`)
  - Option B: Use the existing `getProducts()` with a large pageSize to get all products
  - **Recommendation**: Option A — add a lightweight `/api/products/list` mock endpoint returning `{ id, name }` pairs, similar to `/api/suppliers/list`

- **Category** — `CustomSelect` reusing the existing `categoryFilterOptions` computed (already available in the page)

- **Batch** — `SearchInput` bound to `offcutFilters.batchNumber`

### 7. [`services/mocks/index.ts`](frontend_vue/src/services/mocks/index.ts) — Add `/api/products/list` mock handler

Similar to `/api/suppliers/list`, return a simple list of `{ id, name }` from `MOCK_PRODUCTS`.

### 8. [`i18n/admin/warehouse.ts`](frontend_vue/src/i18n/admin/warehouse.ts) — Add i18n keys

Add `filter_product_all` and `filter_batch_placeholder` keys to all 3 locales.

## Files to modify (8 total)

| # | File | Change |
|---|------|--------|
| 1 | `types/warehouse.ts` | Add `categoryId`, `batchNumber` to `WarehouseFilters` |
| 2 | `composables/useWarehouse.ts` | Add fields to `offcutFilters` reactive |
| 3 | `services/warehouseService.ts` | Add params to `getOffcuts()` |
| 4 | `services/mocks/warehouse.ts` | Add filtering to `mockGetOffcuts()` |
| 5 | `services/mocks/index.ts` | Forward params + add `/api/products/list` handler |
| 6 | `views/admin/warehouse/WarehousePage.vue` | Add Product, Category, Batch filter UI |
| 7 | `services/productsService.ts` | Add `getProductList()` function |
| 8 | `i18n/admin/warehouse.ts` | Add i18n keys |
