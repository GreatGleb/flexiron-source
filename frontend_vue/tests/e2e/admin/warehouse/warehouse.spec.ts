import { test, expect } from '../../fixtures'
import { mockWarehouseEndpoints } from '../../mocks/warehouse'
import { disableFeatureFlag } from '../../helpers/flags'
import { navigateToAdmin } from '../../helpers/admin'

test.describe('Warehouse module', () => {
  test.beforeEach(async ({ page }) => {
    await mockWarehouseEndpoints(page)
    await navigateToAdmin(page, '/admin/warehouse')
  })

  test.describe('Page layout', () => {
    test('should display all warehouse tabs', async ({ page }) => {
      await expect(page.getByTestId('page-warehouse')).toBeVisible()
      await expect(page.getByTestId('warehouse-tabs')).toBeVisible()

      // Verify all 5 tabs are present
      await expect(page.getByTestId('warehouse-tab-stock')).toBeVisible()
      await expect(page.getByTestId('warehouse-tab-batches')).toBeVisible()
      await expect(page.getByTestId('warehouse-tab-offcuts')).toBeVisible()
      await expect(page.getByTestId('warehouse-tab-movements')).toBeVisible()
      await expect(page.getByTestId('warehouse-tab-deficit')).toBeVisible()
    })

    test('should display filters bar', async ({ page }) => {
      await expect(page.getByTestId('warehouse-filters')).toBeVisible()
    })

    test('should redirect to 404 when warehouse feature is disabled', async ({ page }) => {
      await disableFeatureFlag(page, 'adminWarehouse')
      await page.goto('/admin/warehouse')
      await page.waitForLoadState('networkidle')
      await expect(page.getByTestId('not-found-page')).toBeVisible()
    })
  })

  test.describe('Stock tab', () => {
    test('should display stock overview table', async ({ page }) => {
      await expect(page.getByTestId('warehouse-tab-stock')).toBeVisible()
      await expect(page.getByTestId('warehouse-stock-panel')).toBeVisible()
      // Stock rows should be rendered
      await expect(page.getByTestId('warehouse-stock-row').first()).toBeVisible()
    })

    test('should have stock filters', async ({ page }) => {
      await expect(page.getByTestId('warehouse-stock-search')).toBeVisible()
      await expect(page.getByTestId('warehouse-stock-category-filter')).toBeVisible()
      await expect(page.getByTestId('warehouse-stock-unit-filter')).toBeVisible()
    })

    test('should have pagination for stock', async ({ page }) => {
      await expect(page.getByTestId('warehouse-stock-pagination')).toBeVisible()
    })
  })

  test.describe('Batches tab', () => {
    test('should display batches list', async ({ page }) => {
      await page.getByTestId('warehouse-tab-batches').click()
      await expect(page.getByTestId('warehouse-tab-batches')).toBeVisible()
      await expect(page.getByTestId('warehouse-batches-panel')).toBeVisible()
      // Batch rows should be rendered
      await expect(page.getByTestId('warehouse-batch-row').first()).toBeVisible()
    })

    test('should have batch filters', async ({ page }) => {
      await page.getByTestId('warehouse-tab-batches').click()
      await expect(page.getByTestId('warehouse-batches-search')).toBeVisible()
      await expect(page.getByTestId('warehouse-batches-status-filter')).toBeVisible()
      await expect(page.getByTestId('warehouse-batches-supplier-filter')).toBeVisible()
    })

    test('should navigate to batch card on view button click', async ({ page }) => {
      await page.getByTestId('warehouse-tab-batches').click()
      await expect(page.getByTestId('warehouse-batch-row').first()).toBeVisible()

      // Click the view button on the first batch row
      await page.getByTestId('batch-view-btn').first().click()

      // Should navigate to batch card page
      await expect(page.getByTestId('page-batch-card')).toBeVisible()
    })
  })

  test.describe('Batch card', () => {
    test('should display batch details', async ({ page }) => {
      await page.goto('/admin/warehouse/batches/whb-001')
      await page.waitForLoadState('networkidle')

      await expect(page.getByTestId('page-batch-card')).toBeVisible()
      await expect(page.getByTestId('batch-card-panel')).toBeVisible()
      await expect(page.getByTestId('batch-card-content')).toBeVisible()
    })

    test('should display batch sections', async ({ page }) => {
      await page.goto('/admin/warehouse/batches/whb-001')
      await page.waitForLoadState('networkidle')

      await expect(page.getByTestId('batch-card-movements-section')).toBeVisible()
      await expect(page.getByTestId('batch-card-offcuts-section')).toBeVisible()
      await expect(page.getByTestId('batch-card-audit-section')).toBeVisible()
    })

    test('should show edit and delete buttons', async ({ page }) => {
      await page.goto('/admin/warehouse/batches/whb-001')
      await page.waitForLoadState('networkidle')

      await expect(page.getByTestId('batch-card-edit-btn')).toBeVisible()
      await expect(page.getByTestId('batch-card-delete-btn')).toBeVisible()
    })

    test('should toggle edit mode', async ({ page }) => {
      await page.goto('/admin/warehouse/batches/whb-001')
      await page.waitForLoadState('networkidle')

      // Click edit
      await page.getByTestId('batch-card-edit-btn').click()
      await expect(page.getByTestId('batch-card-form')).toBeVisible()
      await expect(page.getByTestId('batch-card-save-btn')).toBeVisible()
      await expect(page.getByTestId('batch-card-discard-btn')).toBeVisible()
    })

    test('should show delete confirmation modal', async ({ page }) => {
      await page.goto('/admin/warehouse/batches/whb-001')
      await page.waitForLoadState('networkidle')

      // Click delete
      await page.getByTestId('batch-card-delete-btn').click()
      await expect(page.getByTestId('batch-card-delete-modal')).toBeVisible()
    })
  })

  test.describe('Offcuts tab', () => {
    test('should display offcuts list', async ({ page }) => {
      await page.getByTestId('warehouse-tab-offcuts').click()
      await expect(page.getByTestId('warehouse-tab-offcuts')).toBeVisible()
      await expect(page.getByTestId('warehouse-offcuts-panel')).toBeVisible()
      await expect(page.getByTestId('warehouse-offcut-row').first()).toBeVisible()
    })

    test('should have offcut filters', async ({ page }) => {
      await page.getByTestId('warehouse-tab-offcuts').click()
      await expect(page.getByTestId('warehouse-offcuts-search')).toBeVisible()
      await expect(page.getByTestId('warehouse-offcuts-status-filter')).toBeVisible()
      await expect(page.getByTestId('warehouse-offcuts-type-filter')).toBeVisible()
    })

    test('should have cutting button', async ({ page }) => {
      await page.getByTestId('warehouse-tab-offcuts').click()
      await expect(page.getByTestId('warehouse-offcuts-cut-btn')).toBeVisible()
    })

    test('should open cutting modal', async ({ page }) => {
      await page.getByTestId('warehouse-tab-offcuts').click()
      await page.getByTestId('warehouse-offcuts-cut-btn').click()
      await expect(page.getByTestId('create-offcut-modal')).toBeVisible()
    })
  })

  test.describe('Movements tab', () => {
    test('should display movements list', async ({ page }) => {
      await page.getByTestId('warehouse-tab-movements').click()
      await expect(page.getByTestId('warehouse-tab-movements')).toBeVisible()
      await expect(page.getByTestId('warehouse-movements-panel')).toBeVisible()
      await expect(page.getByTestId('warehouse-movement-row').first()).toBeVisible()
    })

    test('should have movement filters', async ({ page }) => {
      await page.getByTestId('warehouse-tab-movements').click()
      await expect(page.getByTestId('warehouse-movements-search')).toBeVisible()
      await expect(page.getByTestId('warehouse-movements-type-filter')).toBeVisible()
      await expect(page.getByTestId('warehouse-movements-unit-filter')).toBeVisible()
    })
  })

  test.describe('Deficit tab', () => {
    test('should display deficit list', async ({ page }) => {
      await page.getByTestId('warehouse-tab-deficit').click()
      await expect(page.getByTestId('warehouse-tab-deficit')).toBeVisible()
      await expect(page.getByTestId('warehouse-deficit-panel')).toBeVisible()
      await expect(page.getByTestId('warehouse-deficit-row').first()).toBeVisible()
    })

    test('should have deficit filters', async ({ page }) => {
      await page.getByTestId('warehouse-tab-deficit').click()
      await expect(page.getByTestId('warehouse-deficit-search')).toBeVisible()
      await expect(page.getByTestId('warehouse-deficit-status-filter')).toBeVisible()
      await expect(page.getByTestId('warehouse-deficit-priority-filter')).toBeVisible()
    })
  })
})
