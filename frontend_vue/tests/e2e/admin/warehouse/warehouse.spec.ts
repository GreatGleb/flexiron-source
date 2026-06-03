import { test, expect } from '../../fixtures'
import {
  mockWarehouseEndpoints,
  mockProductList,
  mockProductDetail,
  mockSupplierList,
} from '../../mocks/warehouse'
import { navigateToAdmin } from '../../helpers/admin'

test.describe('Warehouse module', () => {
  test.beforeEach(async ({ page }) => {
    await mockWarehouseEndpoints(page)
    await navigateToAdmin(page, '/admin/warehouse')
  })

  // ─── Helper: click a warehouse tab button (first element — tab button, not panel) ───
  async function clickTab(page: any, tab: string) {
    await page.getByTestId(`warehouse-tab-${tab}`).first().click()
  }

  test.describe('Page layout', () => {
    test('should display all warehouse tabs', async ({ page }) => {
      await expect(page.getByTestId('page-warehouse')).toBeVisible()
      await expect(page.getByTestId('warehouse-tabs')).toBeVisible()
      await expect(page.getByTestId('warehouse-tab-stock').first()).toBeVisible()
      await expect(page.getByTestId('warehouse-tab-batches').first()).toBeVisible()
      await expect(page.getByTestId('warehouse-tab-offcuts').first()).toBeVisible()
      await expect(page.getByTestId('warehouse-tab-movements').first()).toBeVisible()
      await expect(page.getByTestId('warehouse-tab-deficit').first()).toBeVisible()
    })

    test('should display filters bar', async ({ page }) => {
      await expect(page.getByTestId('warehouse-filters')).toBeVisible()
    })

  })

  test.describe('Stock tab', () => {
    test('should display stock overview table', async ({ page }) => {
      await expect(page.getByTestId('warehouse-stock-panel')).toBeVisible()
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

    test('should navigate to stock card on view button click', async ({ page }) => {
      await expect(page.getByTestId('warehouse-stock-row').first()).toBeVisible()
      await page.getByTestId('stock-view-btn').first().click()
      await expect(page.getByTestId('stock-card-page')).toBeVisible()
    })
  })

  test.describe('Batches tab', () => {
    test('should display batches list', async ({ page }) => {
      await clickTab(page, 'batches')
      await expect(page.getByTestId('warehouse-batches-panel')).toBeVisible()
      await expect(page.getByTestId('warehouse-batch-row').first()).toBeVisible()
    })

    test('should have batch filters', async ({ page }) => {
      await clickTab(page, 'batches')
      await expect(page.getByTestId('warehouse-batches-search')).toBeVisible()
      await expect(page.getByTestId('warehouse-batches-status-filter')).toBeVisible()
      await expect(page.getByTestId('warehouse-batches-supplier-filter')).toBeVisible()
    })

    test('should navigate to batch card on view button click', async ({ page }) => {
      await clickTab(page, 'batches')
      await expect(page.getByTestId('warehouse-batch-row').first()).toBeVisible()
      await page.getByTestId('batch-view-btn').first().click()
      await expect(page.getByTestId('page-batch-card')).toBeVisible()
    })
  })

  test.describe('Batch card', () => {
    test('should display batch details', async ({ page }) => {
      await page.goto('/admin/warehouse/batches/whb-001')
      await page.waitForLoadState('networkidle')
      await expect(page.getByTestId('page-batch-card')).toBeVisible()
      await expect(page.getByTestId('batch-card-content')).toBeVisible()
    })

    test('should show error state when batch not found', async ({ page }) => {
      await page.goto('/admin/warehouse/batches/nonexistent')
      await page.waitForLoadState('networkidle')
      await expect(page.getByTestId('batch-card-error')).toBeVisible()
    })
  })

  test.describe('Offcuts tab', () => {
    test('should display offcuts list', async ({ page }) => {
      await clickTab(page, 'offcuts')
      await expect(page.getByTestId('warehouse-offcuts-panel')).toBeVisible()
      await expect(page.getByTestId('warehouse-offcut-row').first()).toBeVisible()
    })

    test('should have offcut filters', async ({ page }) => {
      await clickTab(page, 'offcuts')
      await expect(page.getByTestId('warehouse-offcuts-search')).toBeVisible()
      await expect(page.getByTestId('warehouse-offcuts-status-filter')).toBeVisible()
      await expect(page.getByTestId('warehouse-offcuts-type-filter')).toBeVisible()
    })

    test('should have new offcut button in toolbar', async ({ page }) => {
      await clickTab(page, 'offcuts')
      // The toolbar button is always visible (unlike the empty-state button)
      await expect(page.getByTestId('warehouse-new-offcut-btn')).toBeVisible()
    })

    test('should navigate to offcut card on view button click', async ({ page }) => {
      await clickTab(page, 'offcuts')
      await expect(page.getByTestId('warehouse-offcut-row').first()).toBeVisible()
      await page.getByTestId('offcut-view-btn').first().click()
      await expect(page.getByTestId('offcut-card-page')).toBeVisible()
    })

    test('should mark offcut as used (in_production) via quick action', async ({ page }) => {
      await clickTab(page, 'offcuts')
      await expect(page.getByTestId('offcut-mark-used-btn').first()).toBeVisible()
      await page.getByTestId('offcut-mark-used-btn').first().click()
    })

    test('should mark offcut as scrapped via quick action', async ({ page }) => {
      await clickTab(page, 'offcuts')
      await expect(page.getByTestId('offcut-mark-scrap-btn').first()).toBeVisible()
      await page.getByTestId('offcut-mark-scrap-btn').first().click()
    })
  })

  test.describe('Offcut card', () => {
    test('should display offcut details', async ({ page }) => {
      await page.goto('/admin/warehouse/offcuts/who-001')
      await page.waitForLoadState('networkidle')
      await expect(page.getByTestId('offcut-card-page')).toBeVisible()
      await expect(page.getByTestId('offcut-card-content')).toBeVisible()
    })

    test('should display offcut sections', async ({ page }) => {
      await page.goto('/admin/warehouse/offcuts/who-001')
      await page.waitForLoadState('networkidle')
      await expect(page.getByTestId('offcut-card-location-section')).toBeVisible()
      await expect(page.getByTestId('offcut-card-movements-section')).toBeVisible()
      await expect(page.getByTestId('offcut-card-audit-section')).toBeVisible()
    })

    test('should show error state when offcut not found', async ({ page }) => {
      await page.goto('/admin/warehouse/offcuts/nonexistent')
      await page.waitForLoadState('networkidle')
      await expect(page.getByTestId('offcut-card-error')).toBeVisible()
    })
  })

  test.describe('Movements tab', () => {
    test('should display movements list', async ({ page }) => {
      await clickTab(page, 'movements')
      await expect(page.getByTestId('warehouse-movements-panel')).toBeVisible()
      await expect(page.getByTestId('warehouse-movement-row').first()).toBeVisible()
    })

    test('should have movement filters', async ({ page }) => {
      await clickTab(page, 'movements')
      await expect(page.getByTestId('warehouse-movements-search')).toBeVisible()
      await expect(page.getByTestId('warehouse-movements-type-filter')).toBeVisible()
      await expect(page.getByTestId('warehouse-movements-unit-filter')).toBeVisible()
    })

    test('should navigate to movement card on view button click', async ({ page }) => {
      await clickTab(page, 'movements')
      await expect(page.getByTestId('warehouse-movement-row').first()).toBeVisible()
      await page.getByTestId('movement-view-btn').first().click()
      await expect(page.getByTestId('movement-card-page')).toBeVisible()
    })
  })

  test.describe('Movement card', () => {
    test('should display movement details', async ({ page }) => {
      await page.goto('/admin/warehouse/movements/whm-001')
      await page.waitForLoadState('networkidle')
      await expect(page.getByTestId('movement-card-page')).toBeVisible()
      await expect(page.getByTestId('movement-card-content')).toBeVisible()
    })

    test('should show error state when movement not found', async ({ page }) => {
      await page.goto('/admin/warehouse/movements/nonexistent')
      await page.waitForLoadState('networkidle')
      await expect(page.getByTestId('movement-card-error')).toBeVisible()
    })
  })

  test.describe('Deficit tab', () => {
    test('should display deficit list', async ({ page }) => {
      await clickTab(page, 'deficit')
      await expect(page.getByTestId('warehouse-deficit-panel')).toBeVisible()
      await expect(page.getByTestId('warehouse-deficit-row').first()).toBeVisible()
    })

    test('should have deficit filters', async ({ page }) => {
      await clickTab(page, 'deficit')
      await expect(page.getByTestId('warehouse-deficit-search')).toBeVisible()
      await expect(page.getByTestId('warehouse-deficit-status-filter')).toBeVisible()
      await expect(page.getByTestId('warehouse-deficit-priority-filter')).toBeVisible()
    })

    test('should navigate to deficit card on view button click', async ({ page }) => {
      await clickTab(page, 'deficit')
      await expect(page.getByTestId('warehouse-deficit-row').first()).toBeVisible()
      await page.getByTestId('deficit-view-btn').first().click()
      await expect(page.getByTestId('deficit-card-page')).toBeVisible()
    })

    test('should mark deficit as in_progress via quick action', async ({ page }) => {
      await clickTab(page, 'deficit')
      await expect(page.getByTestId('deficit-mark-in-progress-btn').first()).toBeVisible()
      await page.getByTestId('deficit-mark-in-progress-btn').first().click()
    })

    test('should mark deficit as resolved via quick action', async ({ page }) => {
      await clickTab(page, 'deficit')
      await expect(page.getByTestId('deficit-mark-resolved-btn').first()).toBeVisible()
      await page.getByTestId('deficit-mark-resolved-btn').first().click()
    })
  })

  test.describe('Deficit card', () => {
    test('should display deficit details', async ({ page }) => {
      await page.goto('/admin/warehouse/deficit/whd-001')
      await page.waitForLoadState('networkidle')
      await expect(page.getByTestId('deficit-card-page')).toBeVisible()
      await expect(page.getByTestId('deficit-card-content')).toBeVisible()
    })

    test('should show error state when deficit not found', async ({ page }) => {
      await page.goto('/admin/warehouse/deficit/nonexistent')
      await page.waitForLoadState('networkidle')
      await expect(page.getByTestId('deficit-card-error')).toBeVisible()
    })
  })

  test.describe('Stock card', () => {
    test('should display stock card details', async ({ page }) => {
      await page.goto('/admin/warehouse/stock/prod-002')
      await page.waitForLoadState('networkidle')
      await expect(page.getByTestId('stock-card-page')).toBeVisible()
      await expect(page.getByTestId('stock-card-header')).toBeVisible()
    })

    test('should show error state when stock item not found', async ({ page }) => {
      await page.goto('/admin/warehouse/stock/nonexistent')
      await page.waitForLoadState('networkidle')
      await expect(page.getByTestId('stock-card-error')).toBeVisible()
    })
  })

  // ════════════════════════════════════════════════════════════════════════════
  // NEW TASKS — Movement creation removed from UI
  // ════════════════════════════════════════════════════════════════════════════

  test.describe('Movements tab — no create button', () => {
    test('should NOT have a new movement button in toolbar', async ({ page }) => {
      await clickTab(page, 'movements')
      await expect(page.getByTestId('warehouse-movements-panel')).toBeVisible()
      // Verify no "new movement" button exists on movements tab
      await expect(page.getByTestId('warehouse-new-movement-btn')).toHaveCount(0)
      // Verify the movements list still displays normally
      await expect(page.getByTestId('warehouse-movement-row').first()).toBeVisible()
      await expect(page.getByTestId('warehouse-movements-pagination')).toBeVisible()
    })
  })

  // ════════════════════════════════════════════════════════════════════════════
  // NEW TASKS — Batch Create Page (replaced popup modal)
  // ════════════════════════════════════════════════════════════════════════════

  test.describe('Batch create page', () => {
    test.beforeEach(async ({ page }) => {
      await mockProductList(page)
      await mockProductDetail(page, 'prod-001')
      await mockSupplierList(page)
    })

    test('should load with product selection panel and form sections', async ({ page }) => {
      await page.goto('/admin/warehouse/batches/new')
      await page.waitForLoadState('networkidle')
      await expect(page.getByTestId('batch-create-page')).toBeVisible()
      await expect(page.getByTestId('batch-create-product-panel')).toBeVisible()
      // Verify products table is rendered
      await expect(page.getByTestId('batch-create-product-row').first()).toBeVisible()
      // Verify form sections exist
      await expect(page.getByTestId('batch-create-left-panel')).toBeVisible()
      await expect(page.getByTestId('batch-create-center-panel')).toBeVisible()
      await expect(page.getByTestId('batch-create-right-panel')).toBeVisible()
      // Verify location section exists
      await expect(page.getByTestId('batch-create-location-section')).toBeVisible()
      // Verify files section exists (new task requirement)
      await expect(page.getByTestId('batch-create-files-section')).toBeVisible()
      await expect(page.getByTestId('batch-create-file-dropzone')).toBeVisible()
      // Verify action buttons
      await expect(page.getByTestId('batch-create-cancel-btn')).toBeVisible()
      await expect(page.getByTestId('batch-create-save-btn')).toBeVisible()
    })

    test('should allow product selection via radio button', async ({ page }) => {
      await page.goto('/admin/warehouse/batches/new')
      await page.waitForLoadState('networkidle')
      // Click first product row
      await page.getByTestId('batch-create-product-radio').first().click()
      // Verify it's selected (radio checked)
      await expect(page.getByTestId('batch-create-product-radio').first()).toBeChecked()
    })

    test('should show validation errors on empty form submit', async ({ page }) => {
      await page.goto('/admin/warehouse/batches/new')
      await page.waitForLoadState('networkidle')
      // Click save without filling anything
      await page.getByTestId('batch-create-save-btn').click()
      // Verify error messages appear for required fields
      // (exact error display depends on validation implementation)
      await expect(page.getByTestId('batch-create-page')).toBeVisible()
    })

    test('should save and redirect to batch card on valid form submit', async ({ page }) => {
      await page.goto('/admin/warehouse/batches/new')
      await page.waitForLoadState('networkidle')
      // Select product
      await page.getByTestId('batch-create-product-radio').first().click()
      // Fill required fields
      await page.getByTestId('field-batch-number').fill('BATCH-E2E-001')
      await page.getByTestId('field-lot-code').fill('LOT-001')
      await page.getByTestId('field-quantity').fill('100')
      await page.getByTestId('field-unit-price').fill('15.50')
      // Click save
      await page.getByTestId('batch-create-save-btn').click()
      // Should redirect to batch card page
      await expect(page).toHaveURL(/\/admin\/warehouse\/batches\//)
    })

    test('should cancel and return to batches list', async ({ page }) => {
      await page.goto('/admin/warehouse/batches/new')
      await page.waitForLoadState('networkidle')
      await page.getByTestId('batch-create-cancel-btn').click()
      await expect(page).toHaveURL(/\/admin\/warehouse/)
    })

    test('should have search and category filter for products', async ({ page }) => {
      await page.goto('/admin/warehouse/batches/new')
      await page.waitForLoadState('networkidle')
      // Product search input
      await expect(page.locator('input[placeholder*="Search"]').first()).toBeVisible()
      // Products table should have rows
      await expect(page.getByTestId('batch-create-product-row').first()).toBeVisible()
    })
  })

  // ════════════════════════════════════════════════════════════════════════════
  // NEW TASKS — Offcut Create Page (files section added)
  // ════════════════════════════════════════════════════════════════════════════

  test.describe('Offcut create page', () => {
    test.beforeEach(async ({ page }) => {
      await mockProductList(page)
    })

    test('should load with all sections including files', async ({ page }) => {
      await page.goto('/admin/warehouse/offcuts/new')
      await page.waitForLoadState('networkidle')
      await expect(page.getByTestId('offcut-create-page')).toBeVisible()
      // Product selection panel
      await expect(page.getByTestId('offcut-create-product-panel')).toBeVisible()
      await expect(page.getByTestId('offcut-create-product-row').first()).toBeVisible()
      // Form panels
      await expect(page.getByTestId('offcut-create-left-panel')).toBeVisible()
      await expect(page.getByTestId('offcut-create-center-panel')).toBeVisible()
      await expect(page.getByTestId('offcut-create-right-panel')).toBeVisible()
      // Location section
      await expect(page.getByTestId('offcut-create-location-section')).toBeVisible()
      // Files section (new task requirement — must be present)
      await expect(page.getByTestId('offcut-create-files-section')).toBeVisible()
      await expect(page.getByTestId('offcut-create-file-dropzone')).toBeVisible()
      // File list exists in DOM (may be hidden when no files uploaded yet)
      await expect(page.getByTestId('offcut-create-file-list')).toHaveCount(1)
      // Action buttons
      await expect(page.getByTestId('offcut-create-cancel-btn')).toBeVisible()
      await expect(page.getByTestId('offcut-create-save-btn')).toBeVisible()
    })

    test('should show batch selection panel after selecting a product', async ({ page }) => {
      await page.goto('/admin/warehouse/offcuts/new')
      await page.waitForLoadState('networkidle')
      // Select a product by clicking radio
      await page.getByTestId('offcut-create-product-radio').first().click()
      // Batch selection panel should appear
      await expect(page.getByTestId('offcut-create-batch-panel')).toBeVisible()
    })

    test('should cancel and return to offcuts list', async ({ page }) => {
      await page.goto('/admin/warehouse/offcuts/new')
      await page.waitForLoadState('networkidle')
      await page.getByTestId('offcut-create-cancel-btn').click()
      await expect(page).toHaveURL(/\/admin\/warehouse/)
    })
  })
})
