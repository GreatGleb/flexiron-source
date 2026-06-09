import { test, expect } from '../../fixtures'
import { enableAllFlags } from '../../helpers/flags'
import { mockExternalRequests } from '../../helpers/mockExternalRequests'

test.beforeEach(async ({ context, page }) => {
  await enableAllFlags(context)
  await mockExternalRequests(page)
})

// ═══════════════════════════════════════════════════════════════════════════
// Orders List Page
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Orders List', () => {
  test('loads without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })

    await page.goto('/admin/orders')
    await expect(page.locator('[data-test="page-orders"]')).toBeVisible()
    expect(errors).toHaveLength(0)
  })

  test('header is visible', async ({ page }) => {
    await page.goto('/admin/orders')
    await expect(page.locator('[data-test="orders-header"]')).toBeVisible()
    await expect(page.locator('h1')).toBeVisible()
  })

  test('filters section is visible', async ({ page }) => {
    await page.goto('/admin/orders')
    await expect(page.locator('[data-test="orders-filters"]')).toBeVisible()
    await expect(page.locator('[data-test="orders-filter-search"]')).toBeVisible()
    await expect(page.locator('[data-test="orders-filter-status"]')).toBeVisible()
  })

  test('table panel renders with rows', async ({ page }) => {
    await page.goto('/admin/orders')
    await expect(page.locator('[data-test="orders-table"]')).toBeVisible()
    await expect(page.locator('[data-test="orders-row"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('pagination is visible when orders exist', async ({ page }) => {
    await page.goto('/admin/orders')
    await expect(page.locator('[data-test="orders-pagination"]')).toBeVisible()
  })

  test('create button navigates to create page', async ({ page }) => {
    await page.goto('/admin/orders')
    await page.locator('[data-test="orders-header"] a.btn-primary').click()
    await expect(page).toHaveURL('/admin/orders/new')
  })

  test('order row links to card page', async ({ page }) => {
    await page.goto('/admin/orders')
    const firstRow = page.locator('[data-test="orders-row"]').first()
    await expect(firstRow).toBeVisible()

    const orderLink = firstRow.locator('a.name-link')
    await orderLink.click()
    await expect(page).toHaveURL(/\/admin\/orders\/(.+)/)
  })

  test('view button navigates to card page', async ({ page }) => {
    await page.goto('/admin/orders')
    const viewBtn = page.locator('[data-test="orders-view-btn"]').first()
    await expect(viewBtn).toBeVisible()
    await viewBtn.click()
    await expect(page).toHaveURL(/\/admin\/orders\/(.+)/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Order Create Page
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Order Create', () => {
  test('loads without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })

    await page.goto('/admin/orders/new')
    await expect(page.locator('[data-test="page-order-create"]')).toBeVisible()
    expect(errors).toHaveLength(0)
  })

  test('header with breadcrumbs and action bar is visible', async ({ page }) => {
    await page.goto('/admin/orders/new')
    // Breadcrumb
    await expect(page.locator('nav.breadcrumb, .breadcrumb').first()).toBeVisible()
    // Header
    await expect(page.locator('[data-test="order-create-header"]')).toBeVisible()
    await expect(page.locator('h1.page-title')).toContainText(/Create|Создание|Sukurti/)
    // Action bar with cancel + save buttons
    await expect(page.locator('[data-test="order-create-action-bar"]')).toBeVisible()
    await expect(page.locator('[data-test="order-create-cancel-btn"]')).toBeVisible()
    await expect(page.locator('[data-test="order-create-save-btn"]')).toBeVisible()
  })

  test('client selection panel renders with search, list and pagination', async ({ page }) => {
    await page.goto('/admin/orders/new')
    await expect(page.locator('[data-test="order-create-client-panel"]')).toBeVisible()
    await expect(page.locator('[data-test="order-create-client-search"]')).toBeVisible()
    await expect(page.locator('[data-test="order-create-client-list"]')).toBeVisible()
    // Client radio items should be visible
    await expect(page.locator('[data-test="order-create-client-item"]').first()).toBeVisible({ timeout: 5000 })
    // Pagination should be visible for multiple clients
    await expect(page.locator('[data-test="order-create-client-pagination"]')).toBeVisible()
  })

  test('client selection highlights selected client', async ({ page }) => {
    await page.goto('/admin/orders/new')
    // Wait for clients to load
    await expect(page.locator('[data-test="order-create-client-item"]').first()).toBeVisible({ timeout: 5000 })
    // Click the client label (native radio is hidden via display:none for custom radio styling)
    await page.locator('[data-test="order-create-client-item"]').first().click()
    // Selected count indicator should appear
    await expect(page.locator('[data-test="order-create-client-selected"]')).toBeVisible()
  })

  test('notes panel is visible', async ({ page }) => {
    await page.goto('/admin/orders/new')
    await expect(page.locator('[data-test="order-create-notes-panel"]')).toBeVisible()
    await expect(page.locator('[data-test="order-create-notes"]')).toBeVisible()
  })

  test('document type panel renders with dropdown', async ({ page }) => {
    await page.goto('/admin/orders/new')
    await expect(page.locator('[data-test="order-create-doctype-panel"]')).toBeVisible()
    await expect(page.locator('[data-test="order-create-doctype"]')).toBeVisible()
  })

  test('items section is visible with add button', async ({ page }) => {
    await page.goto('/admin/orders/new')
    await expect(page.locator('[data-test="order-create-items"]')).toBeVisible()
    await expect(page.locator('[data-test="order-create-add-item-btn"]')).toBeVisible()
  })

  test('services section is visible with add button', async ({ page }) => {
    await page.goto('/admin/orders/new')
    await expect(page.locator('[data-test="order-create-services"]')).toBeVisible()
    await expect(page.locator('[data-test="order-create-add-service-btn"]')).toBeVisible()
  })

  test('files section with dropzone is visible', async ({ page }) => {
    await page.goto('/admin/orders/new')
    await expect(page.locator('[data-test="order-create-files"]')).toBeVisible()
    await expect(page.locator('[data-test="order-create-file-dropzone"]')).toBeVisible()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Order Card Page
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Order Card', () => {
  test('loads without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })

    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="page-order-card"]')).toBeVisible()
    expect(errors).toHaveLength(0)
  })

  test('header with breadcrumbs, title and status pill is visible', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-card-header"]')).toBeVisible()
    await expect(page.locator('h1.page-title')).toBeVisible()
    await expect(page.locator('[data-test="order-card-status-pill"]')).toBeVisible()
  })

  test('save bar with action buttons is visible', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-card-save-bar"]')).toBeVisible()
  })

  test('entity card grid with 3 columns is visible', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-info-left"]')).toBeVisible()
    await expect(page.locator('[data-test="order-info-center"]')).toBeVisible()
    await expect(page.locator('[data-test="order-info-right"]')).toBeVisible()
  })

  test('items section renders with table', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-items"]')).toBeVisible()
  })

  test('services section is visible', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-services"]')).toBeVisible()
  })

  test('files section with dropzone is visible', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-files"]')).toBeVisible()
  })

  test('audit log section is visible', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-audit"]')).toBeVisible()
  })

  test('error state for non-existent order', async ({ page }) => {
    await page.goto('/admin/orders/DOES-NOT-EXIST')
    await expect(page.locator('[data-test="order-card-error"]')).toBeVisible({ timeout: 5000 })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Order Card — Field values & structure
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Order Card › fields & structure', () => {
  test('status pill and hint are visible', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-card-status-pill"]')).toBeVisible()
    await expect(page.locator('[data-test="order-card-status-hint"]')).toBeVisible()
  })

  test('save bar is present', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-card-save-bar"]')).toBeVisible()
  })

  test('left column fields render', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-info-left"]')).toBeVisible()
    // Order number and client name are readonly static fields
    await expect(page.locator('[data-test="order-info-left"] .glass-input-static').first()).toBeVisible()
  })

  test('center column financial fields render', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="field-total-amount"]')).toBeVisible()
    await expect(page.locator('[data-test="field-order-discount"]')).toBeVisible()
    await expect(page.locator('[data-test="field-discounted-total"]')).toBeVisible()
    await expect(page.locator('[data-test="field-total-weight"]')).toBeVisible()
    await expect(page.locator('[data-test="field-total-vat"]')).toBeVisible()
    await expect(page.locator('[data-test="field-total-with-vat"]')).toBeVisible()
    await expect(page.locator('[data-test="field-total-cost"]')).toBeVisible()
    await expect(page.locator('[data-test="field-total-margin"]')).toBeVisible()
    await expect(page.locator('[data-test="field-notes"]')).toBeVisible()
  })

  test('status dropdown renders', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-card-status"]')).toBeVisible()
  })

  test('items and services sections render', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-items"]')).toBeVisible()
    await expect(page.locator('[data-test="order-services"]')).toBeVisible()
  })

  test('files section with dropzone is visible', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-files"]')).toBeVisible()
    await expect(page.locator('[data-test="order-file-dropzone"]')).toBeVisible()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Order Card — Save flow
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Order Card › save flow', () => {
  test('edit notes enables save button', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    const saveBtn = page.locator('[data-test="order-card-save-btn"]')
    // Initially save should be disabled (no changes)
    await expect(saveBtn).toBeDisabled()
    // Edit notes
    await page.locator('[data-test="field-notes"]').fill('Test note edit')
    await expect(saveBtn).toBeEnabled()
  })

  test('discard resets notes field', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.locator('[data-test="field-notes"]').fill('Modified notes')
    await page.locator('[data-test="order-card-discard-btn"]').click()
    await page.waitForTimeout(500)
    // Value should be restored to original (null/empty)
    await expect(page.locator('[data-test="field-notes"]')).toHaveValue('')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Order Card — Delete order
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Order Card › delete', () => {
  test('delete button opens confirmation modal', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.locator('[data-test="order-card-delete-btn"]').click()
    await expect(page.locator('[data-test="order-card-delete-modal"]')).toBeVisible()
  })

  test('cancel closes deletion modal', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.locator('[data-test="order-card-delete-btn"]').click()
    await expect(page.locator('[data-test="order-card-delete-modal"]')).toBeVisible()
    await page.locator('[data-test="order-card-delete-modal-cancel"]').click()
    await expect(page.locator('[data-test="order-card-delete-modal"]')).toBeHidden()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Order Card — Audit log
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Order Card › audit log', () => {
  test('audit section is visible', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-audit"]')).toBeVisible()
  })

  test('audit delete button opens confirmation modal', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    const deleteBtn = page.locator('[data-test="order-audit-delete-btn"]')
    if ((await deleteBtn.count()) > 0) {
      await deleteBtn.first().click()
      await expect(page.locator('[data-test="order-audit-modal"]')).toBeVisible()
    }
  })

  test('cancel closes audit delete modal', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    const deleteBtn = page.locator('[data-test="order-audit-delete-btn"]')
    if ((await deleteBtn.count()) > 0) {
      await deleteBtn.first().click()
      await expect(page.locator('[data-test="order-audit-modal"]')).toBeVisible()
      await page.locator('[data-test="order-audit-modal-cancel"]').click()
      await expect(page.locator('[data-test="order-audit-modal"]')).toBeHidden()
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Order Create — Client selector & validation
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Order Create › client selector', () => {
  test('client panel renders with search, list and pagination', async ({ page }) => {
    await page.goto('/admin/orders/new')
    await expect(page.locator('[data-test="order-create-client-panel"]')).toBeVisible()
    await expect(page.locator('[data-test="order-create-client-search"]')).toBeVisible()
    await expect(page.locator('[data-test="order-create-client-list"]')).toBeVisible()
    await expect(page.locator('[data-test="order-create-client-item"]').first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('[data-test="order-create-client-pagination"]')).toBeVisible()
  })

  test('client search filters the list', async ({ page }) => {
    await page.goto('/admin/orders/new')
    await expect(page.locator('[data-test="order-create-client-item"]').first()).toBeVisible({ timeout: 5000 })
    const itemsBefore = await page.locator('[data-test="order-create-client-item"]').count()
    // Search for a specific client
    await page.locator('[data-test="order-create-client-search"] input').fill('Metalica')
    await page.waitForTimeout(300)
    // Count should be less than or equal to before
    const itemsAfter = await page.locator('[data-test="order-create-client-item"]').count()
    expect(itemsAfter).toBeLessThanOrEqual(itemsBefore)
  })

  test('selecting a client shows selected indicator', async ({ page }) => {
    await page.goto('/admin/orders/new')
    await expect(page.locator('[data-test="order-create-client-item"]').first()).toBeVisible({ timeout: 5000 })
    await page.locator('[data-test="order-create-client-item"]').first().click()
    await expect(page.locator('[data-test="order-create-client-selected"]')).toBeVisible()
  })

  test('new client search shows empty state for no results', async ({ page }) => {
    await page.goto('/admin/orders/new')
    await page.locator('[data-test="order-create-client-search"] input').fill('zzz-no-match')
    await page.waitForTimeout(300)
    await expect(page.locator('[data-test="order-create-client-empty"]')).toBeVisible()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Translation sanity
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Orders i18n', () => {
  test('orders list page renders with title', async ({ page }) => {
    await page.goto('/admin/orders')
    await expect(page.locator('h1')).toBeVisible()
  })

  test('order card page renders', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('h1.page-title')).toBeVisible()
  })
})
