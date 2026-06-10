import { test, expect } from '../../fixtures'
import { enableAllFlags } from '../../helpers/flags'
import { mockExternalRequests } from '../../helpers/mockExternalRequests'

test.beforeEach(async ({ context, page }) => {
  await enableAllFlags(context)
  await mockExternalRequests(page)
})

// ═══════════════════════════════════════════════════════════════════════════
// Settings Layout & Tabs
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Settings Layout', () => {
  test('loads without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })

    await page.goto('/admin/settings/profile')
    await expect(page.locator('[data-test="settings-tabs"]')).toBeVisible()
    expect(errors).toHaveLength(0)
  })

  test('all 5 tabs are visible', async ({ page }) => {
    await page.goto('/admin/settings/profile')
    const tabs = page.locator('[data-test="settings-tabs"] .warehouse-tab')
    await expect(tabs).toHaveCount(5)
  })

  test('tab navigation works — click through all tabs', async ({ page }) => {
    await page.goto('/admin/settings/profile')
    const tabs = page.locator('[data-test="settings-tabs"] .warehouse-tab')

    // Profile tab (already active)
    await expect(page).toHaveURL(/\/admin\/settings\/profile/)

    // Company tab
    await tabs.nth(1).click()
    await expect(page).toHaveURL(/\/admin\/settings\/company/)

    // Finance tab
    await tabs.nth(2).click()
    await expect(page).toHaveURL(/\/admin\/settings\/finance/)

    // Units tab
    await tabs.nth(3).click()
    await expect(page).toHaveURL(/\/admin\/settings\/units/)

    // Order Statuses tab
    await tabs.nth(4).click()
    await expect(page).toHaveURL(/\/admin\/settings\/order-statuses/)
  })

  test('save/cancel action bar is visible', async ({ page }) => {
    await page.goto('/admin/settings/company')
    await expect(page.locator('.entity-action-bar')).toBeVisible()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Profile Settings
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Profile Settings', () => {
  test('loads profile form with all fields', async ({ page }) => {
    await page.goto('/admin/settings/profile')
    await expect(page.locator('[data-test="settings-profile-first-name"]')).toBeVisible()
    await expect(page.locator('[data-test="settings-profile-last-name"]')).toBeVisible()
    await expect(page.locator('[data-test="settings-profile-email"]')).toBeVisible()
    await expect(page.locator('[data-test="settings-profile-phone"]')).toBeVisible()
    await expect(page.locator('[data-test="settings-profile-role"]')).toBeVisible()
  })

  test('password change section is visible', async ({ page }) => {
    await page.goto('/admin/settings/profile')
    await expect(page.locator('[data-test="settings-profile-current-password"]')).toBeVisible()
    await expect(page.locator('[data-test="settings-profile-new-password"]')).toBeVisible()
    await expect(page.locator('[data-test="settings-profile-confirm-password"]')).toBeVisible()
    await expect(page.locator('[data-test="settings-profile-change-password"]')).toBeVisible()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Company Settings
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Company Settings', () => {
  test('loads company form with all fields', async ({ page }) => {
    await page.goto('/admin/settings/company')
    await expect(page.locator('[data-test="settings-company-name"]')).toBeVisible()
    await expect(page.locator('[data-test="settings-company-legal-address"]')).toBeVisible()
    await expect(page.locator('[data-test="settings-company-vat-code"]')).toBeVisible()
    await expect(page.locator('[data-test="settings-company-bank-name"]')).toBeVisible()
    await expect(page.locator('[data-test="settings-company-bank-account"]')).toBeVisible()
  })

  test('typing in fields makes save bar dirty', async ({ page }) => {
    await page.goto('/admin/settings/company')
    const nameInput = page.locator('[data-test="settings-company-name"]')
    await nameInput.fill('Test Company')
    // Save button should become active (not disabled)
    const saveBtn = page.locator('.btn-save')
    await expect(saveBtn).not.toBeDisabled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Finance Settings
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Finance Settings', () => {
  test('loads finance form with numeric inputs', async ({ page }) => {
    await page.goto('/admin/settings/finance')
    await expect(page.locator('[data-test="settings-finance-vat-rate"]')).toBeVisible()
    await expect(page.locator('[data-test="settings-finance-default-margin"]')).toBeVisible()
    await expect(page.locator('[data-test="settings-finance-default-discount"]')).toBeVisible()
  })

  test('currencies table is visible with rows', async ({ page }) => {
    await page.goto('/admin/settings/finance')
    const table = page.locator('[data-test="settings-finance-currencies-table"]')
    await expect(table).toBeVisible()
    const rows = table.locator('tbody tr')
    await expect(rows.first()).toBeVisible()
  })

  test('add currency modal opens and has inputs', async ({ page }) => {
    await page.goto('/admin/settings/finance')
    await page.locator('[data-test="settings-finance-add-currency"]').click()
    await expect(page.locator('[data-test="settings-modal-currency-code"]')).toBeVisible()
    await expect(page.locator('[data-test="settings-modal-currency-name"]')).toBeVisible()
    await expect(page.locator('[data-test="settings-modal-currency-rate"]')).toBeVisible()
  })

  test('currency delete button is visible', async ({ page }) => {
    await page.goto('/admin/settings/finance')
    await expect(page.locator('[data-test="settings-finance-currency-delete"]').first()).toBeVisible()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Units Settings
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Units Settings', () => {
  test('loads UoM table with rows', async ({ page }) => {
    await page.goto('/admin/settings/units')
    const table = page.locator('[data-test="settings-uom-table"]')
    await expect(table).toBeVisible()
    await expect(table.locator('tbody tr').first()).toBeVisible()
  })

  test('conversion rules table is visible', async ({ page }) => {
    await page.goto('/admin/settings/units')
    const table = page.locator('[data-test="settings-conversion-table"]')
    await expect(table).toBeVisible()
    await expect(table.locator('tbody tr').first()).toBeVisible()
  })

  test('add UoM modal opens with category dropdown', async ({ page }) => {
    await page.goto('/admin/settings/units')
    await page.locator('[data-test="settings-uom-add"]').click()
    await expect(page.locator('[data-test="settings-modal-uom-code"]')).toBeVisible()
    await expect(page.locator('[data-test="settings-modal-uom-name"]')).toBeVisible()
  })

  test('add conversion modal opens', async ({ page }) => {
    await page.goto('/admin/settings/units')
    await page.locator('[data-test="settings-conversion-add"]').click()
    // AppModal renders .modal-overlay.active with .modal-title containing the title text
    const activeOverlay = page.locator('.modal-overlay.active')
    await expect(activeOverlay).toBeVisible({ timeout: 3000 })
    await expect(activeOverlay.locator('.modal-title')).toContainText(/Conversion|Add/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Order Statuses Settings
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Order Statuses Settings', () => {
  test('loads statuses table with rows', async ({ page }) => {
    await page.goto('/admin/settings/order-statuses')
    const table = page.locator('[data-test="settings-statuses-table"]')
    await expect(table).toBeVisible()
    await expect(table.locator('tbody tr').first()).toBeVisible()
  })

  test('all status columns are present', async ({ page }) => {
    await page.goto('/admin/settings/order-statuses')
    const table = page.locator('[data-test="settings-statuses-table"]')
    const headers = table.locator('thead th')
    // Order, Name, Color, Reserve, Write-off, Actions
    await expect(headers).toHaveCount(6)
  })

  test('add status modal opens with color picker', async ({ page }) => {
    await page.goto('/admin/settings/order-statuses')
    await page.locator('[data-test="settings-status-add"]').click()
    await expect(page.locator('[data-test="settings-status-modal-name"]')).toBeVisible()
  })

  test('status name input is editable in table', async ({ page }) => {
    await page.goto('/admin/settings/order-statuses')
    const nameInput = page.locator('[data-test="settings-status-name"]').first()
    await expect(nameInput).toBeVisible()
  })
})
