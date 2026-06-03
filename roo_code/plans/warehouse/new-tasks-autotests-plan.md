# Plan: New Auto-Tests for Warehouse Tasks

## Context

The user completed 3 warehouse tasks and needs:
1. **New auto-tests** to cover the implemented features
2. **Verification** that existing auto-tests still pass

All 3 tasks are **already implemented** in the codebase. This plan focuses on test coverage gaps.

---

## Task 1: Remove movement creation window/button on `/warehouse/movements`

**Status: ✅ Already implemented**

The [`CreateMovementModal.vue`](frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue) is marked DEPRECATED. The [`WarehousePage.vue`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue) no longer imports or renders it. The [`useWarehouse.ts`](frontend_vue/src/composables/useWarehouse.ts) has `showCreateMovementModal` commented out. No "new movement" button exists on the movements tab toolbar.

### Required test changes:
- **Verify no "new movement" button exists** in the movements toolbar (negative assertion)
- **No test for movement creation** (previously there was none, so nothing to remove)

---

## Task 2: Add files section to `/warehouse/offcuts/new`

**Status: ✅ Already implemented**

The [`WarehouseOffcutCreatePage.vue`](frontend_vue/src/views/admin/warehouse/WarehouseOffcutCreatePage.vue) (lines 715-736) has a full files section with:
- [`FileItem`](frontend_vue/src/components/admin/FileItem.vue) list showing uploaded files
- [`DropZone`](frontend_vue/src/components/admin/ui/DropZone.vue) for uploading new files
- data-test attributes: `offcut-create-files-section`, `offcut-create-file-list`, `offcut-create-file-dropzone`

### Required test changes:
- Add tests for the **Offcut Create Page** verifying:
  - Page loads with correct layout
  - Product selection works
  - Files section is visible with DropZone
  - Save and redirect to offcut card

---

## Task 3: Rework batch creation from popup to new page

**Status: ✅ Already implemented**

- [`WarehouseBatchCreatePage.vue`](frontend_vue/src/views/admin/warehouse/WarehouseBatchCreatePage.vue) — a full-page batch creation form
- [`useWarehouseBatchCreate.ts`](frontend_vue/src/composables/useWarehouseBatchCreate.ts) — form logic, validation, save
- Route: `/admin/warehouse/batches/new` → `admin-warehouse-batch-create`
- The toolbar "New Batch" button routes to this page
- [`CreateBatchModal.vue`](frontend_vue/src/views/admin/warehouse/CreateBatchModal.vue) marked DEPRECATED

### Required test changes:
- Add comprehensive tests for the **Batch Create Page**:
  - Page loads with all sections (product selection, form, location, files)
  - Product selection works (search, category filter, pagination)
  - Form validation (required fields, errors display)
  - Filling form and saving → redirect to batch card
  - Files section is present

---

## Current Test Coverage

[`warehouse.spec.ts`](frontend_vue/tests/e2e/admin/warehouse/warehouse.spec.ts) currently covers:

| Feature | Tested? |
|---------|---------|
| Page layout (tabs) | ✅ Yes |
| Stock tab (table, filters, pagination) | ✅ Yes |
| Batches tab (list, filters, navigation) | ✅ Yes |
| Batch card (details, error) | ✅ Yes |
| **Batch create page** | ❌ **No** |
| Offcuts tab (list, filters, new btn, quick actions) | ✅ Yes |
| Offcut card (details, sections, error) | ✅ Yes |
| **Offcut create page** | ❌ **No** |
| Movements tab (list, filters, navigation) | ✅ Yes (no create btn test) |
| Movement card (details, error) | ✅ Yes |
| Deficit tab (list, filters, navigation, quick actions) | ✅ Yes |
| Deficit card (details, error) | ✅ Yes |
| Stock card (details, error) | ✅ Yes |

---

## Mock Requirements for New Tests

The current [`mockWarehouseEndpoints`](frontend_vue/tests/e2e/mocks/warehouse.ts) only mocks warehouse API endpoints. The batch create page also calls:

| Service | Endpoint | Used For |
|---------|----------|----------|
| `getProducts()` | `GET /api/products?...` | Product list with pagination |
| `getProduct(id)` | `GET /api/products/{id}` | Product detail (linkedSuppliers, priceUnit) |
| `getSupplierList()` | `GET /api/suppliers/list` | Supplier dropdown options |

For e2e tests, we need to add mock route handlers for these endpoints in the test (or in the mock helper).

The offcut create page also calls:
- `getProducts()` → `GET /api/products?...` (with category filter)
- `getBatches()` → `GET /api/warehouse/batches?...` (already mocked)

---

## Actionable Steps

### Step 1: Add mock helpers for Products & Suppliers in e2e tests

Add functions to [`frontend_vue/tests/e2e/mocks/warehouse.ts`](frontend_vue/tests/e2e/mocks/warehouse.ts) or a new file:

- `mockProductList(page, data?)` — mocks `GET /api/products?...`
- `mockProductDetail(page, productId, data?)` — mocks `GET /api/products/{id}`
- `mockSupplierList(page, data?)` — mocks `GET /api/suppliers/list`

These mocks should return data compatible with what [`useWarehouseBatchCreate.ts`](frontend_vue/src/composables/useWarehouseBatchCreate.ts) expects.

### Step 2: Add Batch Create Page tests

In [`warehouse.spec.ts`](frontend_vue/tests/e2e/admin/warehouse/warehouse.spec.ts), add a new `test.describe('Batch create page')` block:

1. **Page loads correctly**
   - Navigate to `/admin/warehouse/batches/new`
   - Verify `batch-create-page` is visible
   - Verify `batch-create-product-panel` is visible (product selection)
   - Verify product search input and category filter are present
   - Verify products table is displayed

2. **Product selection works**
   - Click a product row → verify radio is checked
   - Verify supplier dropdown becomes enabled
   - Use search to filter products
   - Verify category filter narrows results

3. **Form fields render correctly**
   - Verify all form fields: batch number, lot code, quantity, unit (readonly), unit price, currency, received date, expiry date, certificate, notes
   - Verify location section fields: rack, row, cell, notes
   - Verify files section with DropZone

4. **Form validation shows errors**
   - Click save with empty form
   - Verify validation errors appear
   - Fill required fields and verify `isFormValid` changes

5. **Successful save redirects to batch card**
   - Select a product
   - Fill all required fields
   - Click save
   - Verify redirect to batch card page (`admin-warehouse-batch`)

6. **Cancel returns to batches list**
   - Click cancel button
   - Verify redirect to warehouse page with batches tab

### Step 3: Add Offcut Create Page tests

In [`warehouse.spec.ts`](frontend_vue/tests/e2e/admin/warehouse/warehouse.spec.ts), add a new `test.describe('Offcut create page')` block:

1. **Page loads with files section**
   - Navigate to `/admin/warehouse/offcuts/new`
   - Verify `offcut-create-page` is visible
   - Verify `offcut-create-files-section` is visible
   - Verify `offcut-create-file-dropzone` is visible
   - Verify `offcut-create-file-list` is present (empty initially)

2. **Product and batch selection works**
   - Verify product search and category filter
   - Select a product → batch selection panel appears
   - Select a batch

3. **Form fields work**
   - Dimensions: length, width, thickness, weight
   - Quantity, unit (readonly), notes
   - Location section fields

4. **Cancel returns to offcuts list**
   - Click cancel → verify redirect to warehouse with offcuts tab

### Step 4: Add movement tab verification (no create button)

In the existing `'Movements tab'` describe block, add a test:

- **No new movement button in toolbar**
  - Switch to movements tab
  - Verify there is NO element with `warehouse-new-movement-btn` test-id
  - (Contrast with batches tab which HAS `warehouse-new-batch-btn`)

### Step 5: Verify existing tests pass

Run the full warehouse test suite to confirm existing tests are not broken:

```bash
cd frontend_vue
npx playwright test tests/e2e/admin/warehouse/warehouse.spec.ts
```

---

## Implementation Notes

### Mock data for products (e2e)

The product mock should return items compatible with `ProductListItem` type used by the composable:

```typescript
// Minimal product mock for batch create page tests
const MOCK_PRODUCTS_FOR_BATCH = [
  {
    id: 'prod-001',
    name: { en: 'Steel Plate', ru: 'Стальной лист', lt: 'Plieno lakštas' },
    categoryId: 'cat-001',
    categoryName: { en: 'Metals', ru: 'Металлы', lt: 'Metalai' },
  },
  // ... more products
]
```

### Mock data for single product detail (linkedSuppliers, priceUnit)

```typescript
const MOCK_PRODUCT_DETAIL = {
  id: 'prod-001',
  name: { en: 'Steel Plate', ru: 'Стальной лист', lt: 'Plieno lakštas' },
  priceUnit: 'EUR/kg',
  linkedSuppliers: [{ id: '1', company: 'Supplier A' }],
  // ... other product fields
}
```

### Mock data for suppliers list

```typescript
const MOCK_SUPPLIERS_FOR_BATCH = [
  { id: 'sup-001', company: 'Supplier A' },
  { id: 'sup-002', company: 'Supplier B' },
]
```

---

## Files to Modify

| File | Change |
|------|--------|
| [`frontend_vue/tests/e2e/mocks/warehouse.ts`](frontend_vue/tests/e2e/mocks/warehouse.ts) | Add `mockProductList`, `mockProductDetail`, `mockSupplierList` helpers |
| [`frontend_vue/tests/e2e/admin/warehouse/warehouse.spec.ts`](frontend_vue/tests/e2e/admin/warehouse/warehouse.spec.ts) | Add new test blocks for batch create, offcut create, movement verification |
