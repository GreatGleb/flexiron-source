# Phase 6, Subtask 2: `warehouse.spec.ts` — E2E test cases

## What needs to be done

Create Playwright E2E tests for the warehouse module covering the main user flows: viewing tabs, navigating to batch card, creating batches/movements/offcuts, and deleting items.

## Files to create

- [`frontend_vue/tests/e2e/admin/warehouse/warehouse.spec.ts`](frontend_vue/tests/e2e/admin/warehouse/warehouse.spec.ts) — new test file

## Context

### Existing test patterns

Reference existing E2E tests for patterns:
- [`tests/e2e/admin/products/service-card.spec.ts`](frontend_vue/tests/e2e/admin/products/service-card.spec.ts)
- [`tests/e2e/admin/products/services.spec.ts`](frontend_vue/tests/e2e/admin/products/services.spec.ts)
- [`tests/e2e/admin/suppliers/bcc-request.spec.ts`](frontend_vue/tests/e2e/admin/suppliers/bcc-request.spec.ts)

### Test helpers available

- [`tests/e2e/fixtures.ts`](frontend_vue/tests/e2e/fixtures.ts) — `test` and `expect` with custom fixtures
- [`tests/e2e/helpers/admin.ts`](frontend_vue/tests/e2e/helpers/admin.ts) — `loginAsAdmin`, `navigateTo`
- [`tests/e2e/helpers/flags.ts`](frontend_vue/tests/e2e/helpers/flags.ts) — `enableFeatureFlag`, `disableFeatureFlag`
- [`tests/e2e/helpers/mocks.ts`](frontend_vue/tests/e2e/helpers/mocks.ts) — general mock utilities
- [`tests/e2e/helpers/visual.ts`](frontend_vue/tests/e2e/helpers/visual.ts) — `assertVisualSnapshot`

### Mock file (being created in Subtask 1)

- [`tests/e2e/mocks/warehouse.ts`](frontend_vue/tests/e2e/mocks/warehouse.ts) — `mockWarehouseEndpoints(page)` and individual mock functions

### Test IDs available (from components)

All warehouse components should have `data-test` attributes as specified in previous subtasks.

## Test scenarios

### 1. Warehouse page loads with all tabs

```ts
test('should display all warehouse tabs', async ({ page }) => {
  await mockWarehouseEndpoints(page)
  await enableFeatureFlag(page, 'adminWarehouse')
  await loginAsAdmin(page)
  await navigateTo(page, '/admin/warehouse')

  // Verify all 5 tabs are visible
  await expect(page.getByTestId('tab-stock')).toBeVisible()
  await expect(page.getByTestId('tab-batches')).toBeVisible()
  await expect(page.getByTestId('tab-offcuts')).toBeVisible()
  await expect(page.getByTestId('tab-movements')).toBeVisible()
  await expect(page.getByTestId('tab-deficit')).toBeVisible()
})
```

### 2. Batches tab shows batch list

```ts
test('should display batches list', async ({ page }) => {
  await mockWarehouseEndpoints(page)
  await enableFeatureFlag(page, 'adminWarehouse')
  await loginAsAdmin(page)
  await navigateTo(page, '/admin/warehouse/batches')

  // Verify batch rows are visible
  await expect(page.getByTestId('batches-table')).toBeVisible()
  await expect(page.getByTestId('batch-row-0')).toBeVisible()
})
```

### 3. Clicking a batch navigates to batch card

```ts
test('should navigate to batch card on click', async ({ page }) => {
  await mockWarehouseEndpoints(page)
  await enableFeatureFlag(page, 'adminWarehouse')
  await loginAsAdmin(page)
  await navigateTo(page, '/admin/warehouse/batches')

  // Click first batch row
  await page.getByTestId('batch-row-0').click()

  // Verify batch card page loaded
  await expect(page.getByTestId('page-batch-card')).toBeVisible()
  await expect(page.getByTestId('batch-card-panel')).toBeVisible()
})
```

### 4. Batch card displays batch details

```ts
test('should display batch details', async ({ page }) => {
  await mockWarehouseEndpoints(page)
  await enableFeatureFlag(page, 'adminWarehouse')
  await loginAsAdmin(page)
  await navigateTo(page, '/admin/warehouse/batches/some-batch-id')

  await expect(page.getByTestId('batch-card-content')).toBeVisible()
  await expect(page.getByTestId('batch-card-movements-section')).toBeVisible()
  await expect(page.getByTestId('batch-card-offcuts-section')).toBeVisible()
  await expect(page.getByTestId('batch-card-audit-section')).toBeVisible()
})
```

### 5. Create batch modal

```ts
test('should create a new batch', async ({ page }) => {
  await mockWarehouseEndpoints(page)
  await enableFeatureFlag(page, 'adminWarehouse')
  await loginAsAdmin(page)
  await navigateTo(page, '/admin/warehouse/batches')

  // Click create batch button
  await page.getByTestId('btn-create-batch').click()
  await expect(page.getByTestId('create-batch-modal')).toBeVisible()

  // Fill form
  await page.getByTestId('create-batch-number-input').fill('BATCH-001')
  // ... fill other fields

  // Submit
  await page.getByTestId('create-batch-save-btn').click()

  // Verify success
  await expect(page.getByTestId('create-batch-modal')).not.toBeVisible()
  // Toast should appear
})
```

### 6. Delete batch from card

```ts
test('should delete batch from card', async ({ page }) => {
  await mockWarehouseEndpoints(page)
  await enableFeatureFlag(page, 'adminWarehouse')
  await loginAsAdmin(page)
  await navigateTo(page, '/admin/warehouse/batches/test-batch-id')

  await page.getByTestId('batch-card-delete-btn').click()
  await expect(page.getByTestId('batch-card-delete-modal')).toBeVisible()
  await page.getByTestId('modal-confirm-btn').click()

  // Should navigate back to batches list
  await expect(page.getByTestId('batches-table')).toBeVisible()
})
```

### 7. Create movement

```ts
test('should create a movement', async ({ page }) => {
  await mockWarehouseEndpoints(page)
  await enableFeatureFlag(page, 'adminWarehouse')
  await loginAsAdmin(page)
  await navigateTo(page, '/admin/warehouse/movements')

  await page.getByTestId('btn-create-movement').click()
  await expect(page.getByTestId('create-movement-modal')).toBeVisible()

  // Select type, batch, fill quantity, submit
  // Verify success toast and modal close
})
```

### 8. Execute cutting operation

```ts
test('should execute cutting operation', async ({ page }) => {
  await mockWarehouseEndpoints(page)
  await enableFeatureFlag(page, 'adminWarehouse')
  await loginAsAdmin(page)
  await navigateTo(page, '/admin/warehouse/offcuts')

  await page.getByTestId('btn-cutting').click()
  await expect(page.getByTestId('create-offcut-modal')).toBeVisible()

  // Select source batch, fill consumption, add offcut, submit
  // Verify success toast and modal close
})
```

### 9. Deficit tab operations

```ts
test('should display deficit list', async ({ page }) => {
  await mockWarehouseEndpoints(page)
  await enableFeatureFlag(page, 'adminWarehouse')
  await loginAsAdmin(page)
  await navigateTo(page, '/admin/warehouse/deficit')

  await expect(page.getByTestId('deficit-table')).toBeVisible()
})
```

### 10. Feature flag blocks warehouse when disabled

```ts
test('should redirect to 404 when warehouse feature is disabled', async ({ page }) => {
  await disableFeatureFlag(page, 'adminWarehouse')
  await loginAsAdmin(page)
  await navigateTo(page, '/admin/warehouse')

  await expect(page.getByTestId('not-found-page')).toBeVisible()
})
```

## Test structure

```ts
import { test, expect } from '../../fixtures'
import { mockWarehouseEndpoints } from '../../mocks/warehouse'
import { enableFeatureFlag, disableFeatureFlag } from '../../helpers/flags'
import { loginAsAdmin, navigateTo } from '../../helpers/admin'

test.describe('Warehouse module', () => {
  test.beforeEach(async ({ page }) => {
    await mockWarehouseEndpoints(page)
    await enableFeatureFlag(page, 'adminWarehouse')
    await loginAsAdmin(page)
  })

  test.describe('Page layout', () => {
    test('should display all tabs', async ({ page }) => { ... })
    test('should redirect to 404 when disabled', async ({ page }) => { ... })
  })

  test.describe('Batches tab', () => {
    test('should display batch list', async ({ page }) => { ... })
    test('should navigate to batch card', async ({ page }) => { ... })
    test('should create batch via modal', async ({ page }) => { ... })
  })

  test.describe('Batch card', () => {
    test('should display batch details', async ({ page }) => { ... })
    test('should edit batch', async ({ page }) => { ... })
    test('should delete batch', async ({ page }) => { ... })
  })

  test.describe('Movements tab', () => {
    test('should create movement', async ({ page }) => { ... })
  })

  test.describe('Offcuts tab', () => {
    test('should execute cutting', async ({ page }) => { ... })
  })

  test.describe('Deficit tab', () => {
    test('should display deficit list', async ({ page }) => { ... })
  })
})
```

## Acceptance criteria

- [ ] Test file created at [`frontend_vue/tests/e2e/admin/warehouse/warehouse.spec.ts`](frontend_vue/tests/e2e/admin/warehouse/warehouse.spec.ts)
- [ ] Covers all 5 tabs (Stock, Batches, Offcuts, Movements, Deficit)
- [ ] Covers batch card view, edit, and delete
- [ ] Covers create batch/movement/offcut modals
- [ ] Covers feature flag guard
- [ ] Uses route interception mocks
- [ ] Follows existing test patterns and conventions
- [ ] All tests pass when run with `npx playwright test`
