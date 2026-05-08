import { test as base, type Page } from '@playwright/test'
import { test, testWithFlags, expect } from '../../fixtures'
import { ALL_FLAGS_ENABLED } from '../../helpers/flags'
import { navigateToAdmin, switchLanguage } from '../../helpers/admin'
import { waitForFontsReady, SNAPSHOT_OPTIONS, stabilizeForSnapshot } from '../../helpers/visual'

/**
 * E2E tests for Products pages.
 *
 * ProductsPage (list) — data-test markers:
 *   [data-test="page-products"]
 *   [data-test="products-header"]
 *   [data-test="products-btn-create"]
 *   [data-test="products-link-categories"]
 *   [data-test="products-link-services"]
 *   [data-test="products-filters"]
 *   [data-test="products-filter-search"]
 *   [data-test="products-filter-categories"]
 *   [data-test="products-page-size"]
 *   [data-test="products-table"]
 *   [data-test="products-error"]
 *   [data-test="products-empty"]
 *   [data-test="products-row"] × N
 *   [data-test="products-view-btn"]
 *   [data-test="products-delete-btn"]
 *   [data-test="products-pagination"]
 *   [data-test="modal-create-product"]
 *   [data-test="create-product-name"]
 *   [data-test="create-product-category"]
 *   [data-test="create-product-submit"]
 *   [data-test="modal-delete-product"]
 *   [data-test="confirm-delete-submit"]
 *
 * ProductCardPage (card) — data-test markers:
 *   [data-test="page-product-card"]
 *   [data-test="product-card-header"]
 *   [data-test="product-save-bar"]
 *   [data-test="product-card-info"]
 *   [data-test="product-card-price"]
 *   [data-test="product-card-fields"]
 *   [data-test="product-card-suppliers"]
 *   [data-test="field-name"]
 *   [data-test="field-category"]
 *   [data-test="field-sku"]
 *   [data-test="field-description"]
 *   [data-test="field-min-stock"]
 *   [data-test="field-price"]
 *   [data-test="field-price-unit"]
 *   [data-test="add-supplier-open"]
 *   [data-test="add-supplier-form"]
 *   [data-test="add-supplier-select"]
 *   [data-test="add-supplier-price"]
 *   [data-test="add-supplier-lead"]
 *   [data-test="add-supplier-confirm"]
 *   [data-test="modal-remove-supplier"]
 *   [data-test="confirm-remove-supplier"]
 */

const baseTest = base

const PRODUCTS_URL = '/admin/products'
const CARD_URL = (id: string) => `/admin/products/${id}`
const DESKTOP = { width: 1440, height: 900 }

/**
 * Navigate to the products list page and wait for data to finish loading.
 *
 * Strategy (mirrors categories.spec.ts approach):
 * 1. Set viewport
 * 2. Navigate and wait for network idle
 * 3. Wait for the page root to be present
 * 4. Wait for data rows to appear (or error/empty state)
 */
async function navigateToProductsList(page: Page) {
  await page.setViewportSize(DESKTOP)

  // DIAGNOSTIC: log before navigation
  console.log('[DIAG] Navigating to', PRODUCTS_URL)

  // Listen for console errors
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`[PAGE_ERROR] ${msg.text()}`)
    }
  })
  page.on('pageerror', (err) => {
    errors.push(`[PAGE_CRASH] ${err.message}`)
  })

  await page.goto(PRODUCTS_URL, { waitUntil: 'domcontentloaded' })

  // DIAGNOSTIC: check current URL after goto
  const url1 = page.url()
  console.log('[DIAG] URL after goto:', url1)

  // DIAGNOSTIC: check if admin shell rendered
  const shellCount = await page.locator('[data-test="admin-shell"]').count()
  console.log('[DIAG] admin-shell count:', shellCount)

  // DIAGNOSTIC: check if 404 page rendered
  const notFoundCount = await page.locator('.error-code:has-text("404")').count()
  console.log('[DIAG] 404 page count:', notFoundCount)

  // DIAGNOSTIC: check what top-level elements exist in #app
  const appHtml = await page.evaluate(() => {
    const app = document.querySelector('#app')
    if (!app) return 'NO #app FOUND'
    return Array.from(app.children).map((el) => `${el.tagName}${el.className ? '.' + el.className.split(' ').join('.') : ''}`).join(', ')
  })
  console.log('[DIAG] #app children:', appHtml)

  await page.waitForLoadState('networkidle')

  // DIAGNOSTIC: check URL after networkidle
  const url2 = page.url()
  console.log('[DIAG] URL after networkidle:', url2)

  // DIAGNOSTIC: check localStorage ff_overrides
  const overrides = await page.evaluate(() => localStorage.getItem('ff_overrides'))
  console.log('[DIAG] ff_overrides:', overrides)

  // DIAGNOSTIC: check page title
  const title = await page.title()
  console.log('[DIAG] page title:', title)

  // DIAGNOSTIC: check #app children again after networkidle
  const appHtml2 = await page.evaluate(() => {
    const app = document.querySelector('#app')
    if (!app) return 'NO #app FOUND'
    return Array.from(app.children).map((el) => `${el.tagName}${el.className ? '.' + el.className.split(' ').join('.') : ''}`).join(', ')
  })
  console.log('[DIAG] #app children after networkidle:', appHtml2)

  // DIAGNOSTIC: print any page errors
  for (const err of errors) {
    console.log(err)
  }

  // Wait for the products page root to be present
  await expect(page.locator('[data-test="page-products"]')).toBeVisible({ timeout: 10000 })
}

// ────────────────────────────────────────────────────────────────────────────
// List — structure
// ────────────────────────────────────────────────────────────────────────────
test.describe('products-list › structure', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToProductsList(page)
  })

  test('page-products root div is visible', async ({ page }) => {
    await expect(page.locator('[data-test="page-products"]')).toBeVisible()
  })

  test('header visible', async ({ page }) => {
    await expect(page.locator('[data-test="products-header"]')).toBeVisible()
  })

  test('create button visible', async ({ page }) => {
    await expect(page.locator('[data-test="products-btn-create"]')).toBeVisible()
  })

  test('links to categories visible', async ({ page }) => {
    await expect.soft(page.locator('[data-test="products-link-categories"]')).toBeVisible()
  })

  test('filters panel visible', async ({ page }) => {
    await expect(page.locator('[data-test="products-filters"]')).toBeVisible()
  })

  test('search input visible', async ({ page }) => {
    await expect(page.locator('[data-test="products-filter-search"]')).toBeVisible()
  })

  test('category filter visible', async ({ page }) => {
    await expect(page.locator('[data-test="products-filter-category"]')).toBeVisible()
  })

  test('table renders with rows', async ({ page }) => {
    await expect(page.locator('[data-test="products-row"]').first()).toBeVisible()
  })

  test('pagination visible', async ({ page }) => {
    await expect(page.locator('[data-test="products-pagination"]')).toBeVisible()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// List — search filter
// ────────────────────────────────────────────────────────────────────────────
test.describe('products-list › search', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToProductsList(page)
  })

  test('search narrows results', async ({ page }) => {
    const rows = page.locator('[data-test="products-row"]')
    const totalBefore = await rows.count()
    // Read the first row name to build a search term that is guaranteed to exist
    const firstName = (await rows.first().locator('td').first().textContent())!.trim()
    const searchTerm = firstName.split(' ')[0]!
    const input = page.locator('[data-test="products-filter-search"] input')
    await input.fill(searchTerm)
    await page.waitForTimeout(300)
    const countAfter = await rows.count()
    expect(countAfter).toBeGreaterThan(0)
    expect(countAfter).toBeLessThanOrEqual(totalBefore)
  })

  test('no match shows empty state', async ({ page }) => {
    const input = page.locator('[data-test="products-filter-search"] input')
    await input.fill('zzz-nomatch-xyz')
    await expect(page.locator('[data-test="products-empty"]')).toBeVisible()
    await expect(page.locator('[data-test="products-row"]')).toHaveCount(0)
  })

  test('clearing search restores results', async ({ page }) => {
    const rows = page.locator('[data-test="products-row"]')
    const totalBefore = await rows.count()
    const firstName = (await rows.first().locator('td').first().textContent())!.trim()
    const searchTerm = firstName.split(' ')[0]!
    const input = page.locator('[data-test="products-filter-search"] input')
    await input.fill(searchTerm)
    await page.waitForTimeout(300)
    await expect(rows).not.toHaveCount(totalBefore)
    await input.fill('')
    await page.waitForTimeout(300)
    await expect(rows).toHaveCount(totalBefore)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// List — create modal
// ────────────────────────────────────────────────────────────────────────────
test.describe('products-list › create modal', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToProductsList(page)
  })

  test('opens modal on create button click', async ({ page }) => {
    await page.locator('[data-test="products-btn-create"]').click()
    await expect(page.locator('[data-test="modal-create-product"]')).toBeVisible()
  })

  test('Escape closes modal', async ({ page }) => {
    await page.locator('[data-test="products-btn-create"]').click()
    await expect(page.locator('[data-test="modal-create-product"]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-test="modal-create-product"]')).toBeHidden()
  })

  test('Cancel button closes modal', async ({ page }) => {
    await page.locator('[data-test="products-btn-create"]').click()
    const modal = page.locator('[data-test="modal-create-product"]')
    await expect(modal).toBeVisible()
    await modal.locator('.btn-secondary').click()
    await expect(modal).toBeHidden()
  })

  test('submit with empty name stays open (validation)', async ({ page }) => {
    await page.locator('[data-test="products-btn-create"]').click()
    await expect(page.locator('[data-test="modal-create-product"]')).toBeVisible()
    // Button should be disabled when name is empty
    await expect(page.locator('[data-test="create-product-submit"]')).toBeDisabled()
  })

  test('submit with valid data creates product and navigates to card', async ({ page }) => {
    await page.locator('[data-test="products-btn-create"]').click()
    await page.locator('[data-test="create-product-name"]').fill('Test product')
    // Select the first category option if a category select is present
    const categorySelect = page.locator('[data-test="create-product-category"]')
    if (await categorySelect.isVisible()) {
      await categorySelect.locator('.custom-select-trigger').click()
      await categorySelect.locator('.custom-select-option').first().click()
    }
    await page.locator('[data-test="create-product-submit"]').click()
    await expect(page.locator('[data-test="modal-create-product"]')).toBeHidden()
    // After creation, should navigate to the product card
    await expect(page).toHaveURL(/\/admin\/products\/prod-\w+$/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// List — delete
// ────────────────────────────────────────────────────────────────────────────
test.describe('products-list › delete', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToProductsList(page)
  })

  test('delete button opens confirm modal', async ({ page }) => {
    await page.locator('[data-test="products-delete-btn"]').first().click()
    await expect(page.locator('[data-test="modal-delete-product"]')).toBeVisible()
  })

  test('cancel leaves row count unchanged', async ({ page }) => {
    const rows = page.locator('[data-test="products-row"]')
    const countBefore = await rows.count()
    await page.locator('[data-test="products-delete-btn"]').first().click()
    const modal = page.locator('[data-test="modal-delete-product"]')
    await expect(modal).toBeVisible()
    await modal.locator('.btn-secondary').click()
    await expect(modal).toBeHidden()
    await expect(rows).toHaveCount(countBefore)
  })

  test('confirm deletes and reloads list', async ({ page }) => {
    const deleteBtn = page.locator('[data-test="products-delete-btn"]').first()
    await deleteBtn.click()
    await expect(page.locator('[data-test="modal-delete-product"]')).toBeVisible()
    await page.locator('[data-test="confirm-delete-submit"]').click()
    await expect(page.locator('[data-test="modal-delete-product"]')).toBeHidden()
    // Toast should appear
    await expect(page.getByText('Product deleted').or(page.getByText('Товар удален'))).toBeVisible()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// List — navigation
// ────────────────────────────────────────────────────────────────────────────
test.describe('products-list › navigation', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToProductsList(page)
  })

  test('row click navigates to /admin/products/:id', async ({ page }) => {
    await page
      .locator('[data-test="products-row"]')
      .first()
      .locator('a.name-link')
      .click()
    await expect(page).toHaveURL(/\/admin\/products\/prod-\w+$/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Card — structure
// ────────────────────────────────────────────────────────────────────────────
test.describe('product-card › structure', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToAdmin(page, CARD_URL('prod-001'))
  })

  test('page-product-card root visible', async ({ page }) => {
    await expect(page.locator('[data-test="page-product-card"]')).toBeVisible()
  })

  test('header with breadcrumb visible', async ({ page }) => {
    await expect(page.locator('[data-test="product-card-header"]')).toBeVisible()
  })

  test('save bar visible', async ({ page }) => {
    await expect(page.locator('[data-test="product-save-bar"]')).toBeVisible()
  })

  test('save button disabled initially', async ({ page }) => {
    const saveBtn = page.locator('[data-test="product-save-bar"] .btn-save')
    await expect(saveBtn).toBeDisabled()
  })

  test('info section visible', async ({ page }) => {
    await expect(page.locator('[data-test="product-card-info"]')).toBeVisible()
  })

  test('price section visible', async ({ page }) => {
    await expect(page.locator('[data-test="product-card-price"]')).toBeVisible()
  })

  test('dynamic fields section visible', async ({ page }) => {
    await expect(page.locator('[data-test="product-card-fields"]')).toBeVisible()
  })

  test('suppliers section visible', async ({ page }) => {
    await expect(page.locator('[data-test="product-card-suppliers"]')).toBeVisible()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Card — basic fields
// ────────────────────────────────────────────────────────────────────────────
test.describe('product-card › basic fields', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToAdmin(page, CARD_URL('prod-001'))
  })

  test('name field visible and editable', async ({ page }) => {
    const nameField = page.locator('[data-test="field-name"]')
    await expect(nameField).toBeVisible()
    await nameField.fill('Updated product name')
    await expect(nameField).toHaveValue('Updated product name')
  })

  test('SKU field visible and editable', async ({ page }) => {
    const skuField = page.locator('[data-test="field-sku"]')
    await expect(skuField).toBeVisible()
    await skuField.fill('NEW-SKU-001')
    await expect(skuField).toHaveValue('NEW-SKU-001')
  })

  test('description field visible and editable', async ({ page }) => {
    const descField = page.locator('[data-test="field-description"]')
    await expect(descField).toBeVisible()
    await descField.fill('Updated description')
    await expect(descField).toHaveValue('Updated description')
  })

  test('min stock field visible and editable', async ({ page }) => {
    const minStockField = page.locator('[data-test="field-min-stock"]')
    await expect(minStockField).toBeVisible()
    await minStockField.fill('15')
    await expect(minStockField).toHaveValue('15')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Card — dirty check
// ────────────────────────────────────────────────────────────────────────────
test.describe('product-card › dirty check', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToAdmin(page, CARD_URL('prod-001'))
  })

  test('edit name → save button becomes enabled', async ({ page }) => {
    const saveBtn = page.locator('[data-test="product-save-bar"] .btn-save')
    await expect(saveBtn).toBeDisabled()
    await page.locator('[data-test="field-name"]').fill('Changed')
    await expect(saveBtn).toBeEnabled()
  })

  test('discard changes → save button becomes disabled again', async ({ page }) => {
    const saveBtn = page.locator('[data-test="product-save-bar"] .btn-save')
    await page.locator('[data-test="field-name"]').fill('Changed')
    await expect(saveBtn).toBeEnabled()
    await page.locator('[data-test="product-save-bar"] .btn-secondary').click()
    await expect(saveBtn).toBeDisabled()
  })

  test('edit price → save enabled', async ({ page }) => {
    const saveBtn = page.locator('[data-test="product-save-bar"] .btn-save')
    await expect(saveBtn).toBeDisabled()
    await page.locator('[data-test="field-price"]').fill('999')
    await expect(saveBtn).toBeEnabled()
  })

  test('edit SKU → save enabled', async ({ page }) => {
    const saveBtn = page.locator('[data-test="product-save-bar"] .btn-save')
    await expect(saveBtn).toBeDisabled()
    await page.locator('[data-test="field-sku"]').fill('CHANGED-SKU')
    await expect(saveBtn).toBeEnabled()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Card — save lifecycle
// ────────────────────────────────────────────────────────────────────────────
test.describe('product-card › save lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToAdmin(page, CARD_URL('prod-001'))
  })

  test('edit → save → button becomes disabled (saved)', async ({ page }) => {
    const saveBtn = page.locator('[data-test="product-save-bar"] .btn-save')
    await expect(saveBtn).toBeDisabled()
    await page.locator('[data-test="field-name"]').fill('Save test')
    await expect(saveBtn).toBeEnabled()
    await saveBtn.click()
    await expect(saveBtn).toBeDisabled({ timeout: 5000 })
  })

  test('toast "Changes saved" appears', async ({ page }) => {
    await page.locator('[data-test="field-name"]').fill('Toast test')
    await page.locator('[data-test="product-save-bar"] .btn-save').click()
    await expect(page.getByText('Changes saved')).toBeVisible({ timeout: 5000 })
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Card — suppliers
// ────────────────────────────────────────────────────────────────────────────
test.describe('product-card › suppliers', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToAdmin(page, CARD_URL('prod-001'))
  })

  test('suppliers section shows supplier list', async ({ page }) => {
    // prod-001 has linked suppliers: Steel Plus, Metal Trade
    await expect(page.locator('[data-test="product-card-suppliers"]')).toContainText('Steel Plus')
  })

  test('add supplier modal opens', async ({ page }) => {
    await page.locator('[data-test="add-supplier-open"]').click()
    await expect(page.locator('[data-test="add-supplier-form"]')).toBeVisible()
  })

  test('add supplier form has select, price, lead inputs', async ({ page }) => {
    await page.locator('[data-test="add-supplier-open"]').click()
    await expect(page.locator('[data-test="add-supplier-select"]')).toBeVisible()
    await expect(page.locator('[data-test="add-supplier-price"]')).toBeVisible()
    await expect(page.locator('[data-test="add-supplier-lead"]')).toBeVisible()
  })

  test('confirm adds supplier to list', async ({ page }) => {
    await page.locator('[data-test="add-supplier-open"]').click()
    await page.locator('[data-test="add-supplier-select"] .custom-select-trigger').click()
    await page.locator('[data-test="add-supplier-select"] .custom-select-option').first().click()
    await page.locator('[data-test="add-supplier-price"]').fill('150')
    await page.locator('[data-test="add-supplier-lead"]').fill('10')
    await page.locator('[data-test="add-supplier-confirm"]').click()
    await expect(page.locator('[data-test="add-supplier-form"]')).toBeHidden()
    // After adding, the "No suppliers linked" text should be gone
    await expect(page.locator('[data-test="product-card-suppliers"]')).not.toContainText(
      'No suppliers linked',
    )
  })

  test('remove supplier modal opens', async ({ page }) => {
    // prod-001 already has suppliers, click remove on the first one
    await page.locator('[data-test="product-card-suppliers"] .supplier-remove-btn').first().click()
    await expect(page.locator('[data-test="modal-remove-supplier"]')).toBeVisible()
  })

  test('confirm removes supplier', async ({ page }) => {
    // prod-001 already has suppliers, click remove on the first one
    await page.locator('[data-test="product-card-suppliers"] .supplier-remove-btn').first().click()
    await page.locator('[data-test="confirm-remove-supplier"]').click()
    await expect(page.locator('[data-test="modal-remove-supplier"]')).toBeHidden()
    // Supplier should no longer be in the table (remove is local, no save needed)
    await expect(page.locator('[data-test="product-card-suppliers"] .supplier-remove-btn')).toHaveCount(1)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Card — dynamic fields
// ────────────────────────────────────────────────────────────────────────────
test.describe('product-card › dynamic fields', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToAdmin(page, CARD_URL('prod-001'))
  })

  test('text field renders as <input type="text">', async ({ page }) => {
    const fields = page.locator('[data-test="product-card-fields"] .input-group')
    await expect(fields.first().locator('input[type="text"]').first()).toBeVisible()
  })

  test('number field renders as <input type="number">', async ({ page }) => {
    // prod-001 (cat-2 Sheets): fieldValues[2] = f-1-3 Density (number, inherited)
    const fields = page.locator('[data-test="product-card-fields"] .input-group')
    await expect(fields.nth(2).locator('input[type="number"]').first()).toBeVisible()
  })

  test('boolean field renders as checkbox', async ({ page }) => {
    // Navigate to prod-005 (cat-5 Consumables) which has a boolean field (f-5-2 Hazardous material)
    await page.goto(CARD_URL('prod-005'))
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-test="page-product-card"]')).toBeVisible()
    const fields = page.locator('[data-test="product-card-fields"] .input-group')
    await expect(fields.locator('input[type="checkbox"]').first()).toBeVisible()
  })

  test('enum field renders as CustomSelect', async ({ page }) => {
    // prod-001 (cat-2 Sheets): fieldValues[4] = f-2-2 Sheet type (enum)
    const fields = page.locator('[data-test="product-card-fields"] .input-group')
    await expect(fields.nth(4).locator('.custom-select-trigger').first()).toBeVisible()
  })

  test('editing a field enables save button', async ({ page }) => {
    const saveBtn = page.locator('[data-test="product-save-bar"] .btn-save')
    await expect(saveBtn).toBeDisabled()
    const fields = page.locator('[data-test="product-card-fields"] .input-group')
    await fields.first().locator('input').fill('Edited dynamic field')
    await expect(saveBtn).toBeEnabled()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// i18n — language switch (uses testWithFlags — no language lock, so reload works correctly)
// ────────────────────────────────────────────────────────────────────────────
testWithFlags.describe('products › i18n', () => {
  testWithFlags('switching language updates UI text', async ({ page }) => {
    // Navigate to products list and wait for data
    await navigateToProductsList(page)
    const header = page.locator('[data-test="products-header"]')
    const enText = await header.textContent()

    // Switch to RU
    await switchLanguage(page, 'ru')
    const ruText = await header.textContent()
    expect(ruText?.trim()).not.toBe(enText?.trim())

    // Switch to LT
    await switchLanguage(page, 'lt')
    const ltText = await header.textContent()
    expect(ltText?.trim()).not.toBe(enText?.trim())

    // Switch back to EN
    await switchLanguage(page, 'en')
    const enTextAgain = await header.textContent()
    expect(enTextAgain?.trim()).toBe(enText?.trim())
  })

  testWithFlags('product card section titles change with language', async ({ page }) => {
    // Navigate to product card
    await page.setViewportSize(DESKTOP)
    await navigateToAdmin(page, CARD_URL('prod-001'))
    const infoSection = page.locator('[data-test="product-card-info"]')
    const enInfoText = await infoSection.textContent()

    // Switch to RU
    await switchLanguage(page, 'ru')
    const ruInfoText = await infoSection.textContent()
    expect(ruInfoText?.trim()).not.toBe(enInfoText?.trim())

    // Switch to LT
    await switchLanguage(page, 'lt')
    const ltInfoText = await infoSection.textContent()
    expect(ltInfoText?.trim()).not.toBe(enInfoText?.trim())
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Visual snapshots @1440
// ────────────────────────────────────────────────────────────────────────────
test.describe('products › visual @1440', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToProductsList(page)
    await stabilizeForSnapshot(page, page.locator('[data-test="products-table"]'))
    await waitForFontsReady(page)
  })

  test('products list header visual @1440', async ({ page }) => {
    await expect(page.locator('[data-test="products-header"]')).toHaveScreenshot(
      'products-header.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('products list table visual @1440', async ({ page }) => {
    await expect(page.locator('[data-test="products-table"]')).toHaveScreenshot(
      'products-table.png',
      SNAPSHOT_OPTIONS,
    )
  })
})

test.describe('product-card › visual @1440', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await navigateToAdmin(page, CARD_URL('prod-001'))
    await stabilizeForSnapshot(page, page.locator('[data-test="product-card-info"]'))
    await waitForFontsReady(page)
  })

  test('product card header visual @1440', async ({ page }) => {
    await expect(page.locator('[data-test="product-card-header"]')).toHaveScreenshot(
      'product-card-header.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('product card info section visual @1440', async ({ page }) => {
    await expect(page.locator('[data-test="product-card-info"]')).toHaveScreenshot(
      'product-card-info.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('product card fields section visual @1440', async ({ page }) => {
    await expect(page.locator('[data-test="product-card-fields"]')).toHaveScreenshot(
      'product-card-fields.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('product card suppliers section visual @1440', async ({ page }) => {
    await expect(page.locator('[data-test="product-card-suppliers"]')).toHaveScreenshot(
      'product-card-suppliers.png',
      SNAPSHOT_OPTIONS,
    )
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Feature flag — adminProducts OFF → /404
// ────────────────────────────────────────────────────────────────────────────
baseTest(
  'products › redirects to /404 when adminProducts flag is OFF',
  async ({ page, context }) => {
    await context.addInitScript(
      (flags) => localStorage.setItem('ff_overrides', JSON.stringify(flags)),
      { ...ALL_FLAGS_ENABLED, adminProducts: false },
    )
    await page.goto(PRODUCTS_URL)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/404$/)
  },
)

// ────────────────────────────────────────────────────────────────────────────
// Feature flag — productSupplierLinks OFF → add supplier button hidden
// ────────────────────────────────────────────────────────────────────────────
baseTest(
  'product-card › add supplier button hidden when productSupplierLinks is OFF',
  async ({ page, context }) => {
    await context.addInitScript(
      (flags) => localStorage.setItem('ff_overrides', JSON.stringify(flags)),
      { ...ALL_FLAGS_ENABLED, productSupplierLinks: false },
    )
    await page.setViewportSize(DESKTOP)
    await page.goto(CARD_URL('prod-001'))
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-test="add-supplier-open"]')).toHaveCount(0)
  },
)
