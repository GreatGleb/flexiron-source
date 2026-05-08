import { test as base } from '@playwright/test'
import { test, testWithFlags, expect } from '../../fixtures'
import { ALL_FLAGS_ENABLED } from '../../helpers/flags'
import { waitForFontsReady, SNAPSHOT_OPTIONS, stabilizeForSnapshot } from '../../helpers/visual'

/**
 * E2E tests for Categories pages.
 *
 * CategoriesPage (list) — data-test markers:
 *   [data-test="page-categories"]
 *   [data-test="categories-header"]
 *   [data-test="categories-create-btn"]
 *   [data-test="categories-filters"]
 *   [data-test="categories-search"]
 *   [data-test="categories-table"]
 *   [data-test="categories-row"] × N
 *   [data-test="categories-delete-btn"]
 *   [data-test="categories-empty"]
 *   [data-test="modal-create-category"]
 *   [data-test="modal-delete-category"]
 *
 * CategoryCardPage (card) — data-test markers:
 *   [data-test="page-category-card"]
 *   [data-test="category-card-header"]
 *   [data-test="category-save-bar"]
 *   [data-test="category-card-info"]
 *   [data-test="category-inherited-fields"]
 *   [data-test="category-own-fields"]
 *   [data-test="category-add-field-btn"]
 *   [data-test="category-field-row"] × N
 *   [data-test="modal-field"]
 *
 * Mock STORE: 13 categories — Metal (root, 3 fields), Sheets (child of Metal, productCount:12),
 *   Aluminium sheets (child of Sheets, productCount:4), Pipes (child of Metal),
 *   Consumables (root), Equipment (root), Beams (child of Metal), Channels (child of Metal),
 *   Angles (child of Metal), Rebars (child of Metal), Profiles (child of Metal),
 *   Wire (child of Metal), Fittings (child of Metal).
 */

const baseTest = base

const CATEGORIES_URL = '/admin/products/categories'
const CARD_URL = (id: string) => `/admin/products/categories/${id}`
const DESKTOP = { width: 1440, height: 900 }
const TOTAL_MOCK = 13

// ────────────────────────────────────────────────────────────────────────────
// List — structure
// ────────────────────────────────────────────────────────────────────────────
test.describe('categories-list › structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CATEGORIES_URL)
    await page.waitForLoadState('networkidle')
  })

  test('page container renders', async ({ page }) => {
    await expect(page.locator('[data-test="page-categories"]')).toBeVisible()
  })

  test('header, filters and table all render', async ({ page }) => {
    await expect.soft(page.locator('[data-test="categories-header"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="categories-filters"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="categories-table"]')).toBeVisible()
  })

  test(`renders all ${TOTAL_MOCK} mock rows`, async ({ page }) => {
    await expect(page.locator('[data-test="categories-row"]')).toHaveCount(TOTAL_MOCK)
  })

  test('table has 5 columns (name, parent, fields, products, actions)', async ({ page }) => {
    await expect(
      page.locator('[data-test="categories-table"] table thead tr th'),
    ).toHaveCount(5)
  })

  test('create button is visible in header', async ({ page }) => {
    await expect(page.locator('[data-test="categories-create-btn"]')).toBeVisible()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// List — search filter
// ────────────────────────────────────────────────────────────────────────────
test.describe('categories-list › search', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CATEGORIES_URL)
    await page.waitForLoadState('networkidle')
  })

  test('search narrows results — dynamic term from first row', async ({ page }) => {
    const rows = page.locator('[data-test="categories-row"]')
    const totalBefore = await rows.count()
    // Read the first row name to build a search term that is guaranteed to exist
    const firstName = (await rows.first().locator('td').first().textContent())!.trim()
    const searchTerm = firstName.split(' ')[0]! // first word — likely unique or narrows the list
    const input = page.locator('[data-test="categories-search"] input')
    await input.fill(searchTerm)
    const countAfter = await rows.count()
    expect(countAfter).toBeGreaterThan(0)
    expect(countAfter).toBeLessThanOrEqual(totalBefore)
  })

  test('search with no match shows empty state', async ({ page }) => {
    const input = page.locator('[data-test="categories-search"] input')
    await input.fill('zzz-nomatch-xyz')
    await expect(page.locator('[data-test="categories-empty"]')).toBeVisible()
    await expect(page.locator('[data-test="categories-row"]')).toHaveCount(0)
  })

  test('clearing search restores all rows', async ({ page }) => {
    const rows = page.locator('[data-test="categories-row"]')
    const totalBefore = await rows.count()
    const firstName = (await rows.first().locator('td').first().textContent())!.trim()
    const searchTerm = firstName.split(' ')[0]!
    const input = page.locator('[data-test="categories-search"] input')
    await input.fill(searchTerm)
    await expect(rows).not.toHaveCount(totalBefore)
    await input.fill('')
    await expect(rows).toHaveCount(totalBefore)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// List — create category modal
// ────────────────────────────────────────────────────────────────────────────
test.describe('categories-list › create modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CATEGORIES_URL)
    await page.waitForLoadState('networkidle')
  })

  test('clicking create button opens modal', async ({ page }) => {
    await page.locator('[data-test="categories-create-btn"]').click()
    await expect(page.locator('[data-test="modal-create-category"]')).toBeVisible()
  })

  test('pressing Escape closes modal', async ({ page }) => {
    await page.locator('[data-test="categories-create-btn"]').click()
    await expect(page.locator('[data-test="modal-create-category"]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-test="modal-create-category"]')).toBeHidden()
  })

  test('clicking cancel button closes modal', async ({ page }) => {
    await page.locator('[data-test="categories-create-btn"]').click()
    const modal = page.locator('[data-test="modal-create-category"]')
    await expect(modal).toBeVisible()
    await modal.locator('.btn-secondary').click()
    await expect(modal).toBeHidden()
  })

  test('creating a category adds it to the list', async ({ page }) => {
    await page.locator('[data-test="categories-create-btn"]').click()
    await page.locator('[data-test="create-cat-name"]').fill('Тестовая категория')
    await page.locator('[data-test="create-cat-submit"]').click()
    await expect(page.locator('[data-test="modal-create-category"]')).toBeHidden()
    await expect(page.locator('[data-test="categories-row"]')).toHaveCount(TOTAL_MOCK + 1)
  })

  test('submit without name does not close modal', async ({ page }) => {
    await page.locator('[data-test="categories-create-btn"]').click()
    await page.locator('[data-test="create-cat-submit"]').click()
    await expect(page.locator('[data-test="modal-create-category"]')).toBeVisible()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// List — delete category
// ────────────────────────────────────────────────────────────────────────────
test.describe('categories-list › delete', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CATEGORIES_URL)
    await page.waitForLoadState('networkidle')
  })

  test('clicking delete button opens confirm modal', async ({ page }) => {
    await page.locator('[data-test="categories-delete-btn"]').first().click()
    await expect(page.locator('[data-test="modal-delete-category"]')).toBeVisible()
  })

  test('cancelling delete leaves row count unchanged', async ({ page }) => {
    await page.locator('[data-test="categories-delete-btn"]').first().click()
    const modal = page.locator('[data-test="modal-delete-category"]')
    await expect(modal).toBeVisible()
    await modal.locator('.btn-secondary').click()
    await expect(modal).toBeHidden()
    await expect(page.locator('[data-test="categories-row"]')).toHaveCount(TOTAL_MOCK)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// List — row navigation
// ────────────────────────────────────────────────────────────────────────────
test.describe('categories-list › navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CATEGORIES_URL)
    await page.waitForLoadState('networkidle')
  })

  test('clicking a row navigates to the category card', async ({ page }) => {
    await page
      .locator('[data-test="categories-row"]')
      .first()
      .locator('a.name-link')
      .click()
    await expect(page).toHaveURL(/\/admin\/products\/categories\/cat-\w+$/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Card — structure
// ────────────────────────────────────────────────────────────────────────────
test.describe('category-card › structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CARD_URL('cat-1'))
    await page.waitForLoadState('networkidle')
  })

  test('page container renders', async ({ page }) => {
    await expect(page.locator('[data-test="page-category-card"]')).toBeVisible()
  })

  test('header and save bar render', async ({ page }) => {
    await expect.soft(page.locator('[data-test="category-card-header"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="category-save-bar"]')).toBeVisible()
  })

  test('general info section renders', async ({ page }) => {
    await expect(page.locator('[data-test="category-card-info"]')).toBeVisible()
  })

  test('own fields section renders', async ({ page }) => {
    await expect(page.locator('[data-test="category-own-fields"]')).toBeVisible()
  })

  test('save button is disabled initially (no changes)', async ({ page }) => {
    const saveBtn = page.locator('[data-test="category-save-bar"] .btn-save')
    await expect(saveBtn).toBeDisabled()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Card — inherited fields
// ────────────────────────────────────────────────────────────────────────────
test.describe('category-card › inherited fields', () => {
  test('inherited fields section visible when category has a parent (cat-2 → Sheets)', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CARD_URL('cat-2'))
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-test="category-inherited-fields"]')).toBeVisible()
  })

  test('inherited fields section hidden for root category (cat-1 → Metal)', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CARD_URL('cat-1'))
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-test="category-inherited-fields"]')).toHaveCount(0)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Card — dirty check / save bar
// ────────────────────────────────────────────────────────────────────────────
test.describe('category-card › dirty check', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CARD_URL('cat-1'))
    await page.waitForLoadState('networkidle')
  })

  test('editing name enables save button', async ({ page }) => {
    await page.locator('[data-test="category-name-input"]').fill('Metal — edited')
    const saveBtn = page.locator('[data-test="category-save-bar"] .btn-save')
    await expect(saveBtn).not.toBeDisabled()
    await expect(saveBtn).toHaveClass(/\bdirty\b/)
  })

  test('clicking discard after edit resets save button to disabled', async ({ page }) => {
    await page.locator('[data-test="category-name-input"]').fill('Edited')
    const saveBtn = page.locator('[data-test="category-save-bar"] .btn-save')
    await expect(saveBtn).not.toBeDisabled()
    await page.locator('[data-test="category-save-bar"] .btn-secondary').click()
    await page.waitForLoadState('networkidle')
    await expect(saveBtn).toBeDisabled()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Card — own fields CRUD
// ────────────────────────────────────────────────────────────────────────────
test.describe('category-card › own fields', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CARD_URL('cat-1'))
    await page.waitForLoadState('networkidle')
  })

  test('add field button is visible', async ({ page }) => {
    await expect(page.locator('[data-test="category-add-field-btn"]')).toBeVisible()
  })

  test('clicking add field opens the field modal', async ({ page }) => {
    await page.locator('[data-test="category-add-field-btn"]').click()
    await expect(page.locator('[data-test="modal-field"]')).toBeVisible()
  })

  test('choosing type=enum shows the options TagInput', async ({ page }) => {
    await page.locator('[data-test="category-add-field-btn"]').click()
    const modal = page.locator('[data-test="modal-field"]')
    await expect(modal).toBeVisible()
    await modal.locator('[data-test="field-type-select"] .custom-select-trigger').click()
    const enumOption = modal.locator('.custom-select-option').filter({ hasText: /enum|select list|список/i })
    await enumOption.first().click()
    await expect(modal.locator('[data-test="field-options-input"]')).toBeVisible()
  })

  test('choosing type=text hides the options TagInput', async ({ page }) => {
    await page.locator('[data-test="category-add-field-btn"]').click()
    const modal = page.locator('[data-test="modal-field"]')
    await modal.locator('[data-test="field-type-select"] .custom-select-trigger').click()
    await modal.locator('.custom-select-option').filter({ hasText: /text|текст/i }).first().click()
    await expect(modal.locator('[data-test="field-options-input"]')).toHaveCount(0)
  })

  test('adding a text field appends it to the own fields list', async ({ page }) => {
    const initialCount = await page.locator('[data-test="category-field-row"]').count()
    await page.locator('[data-test="category-add-field-btn"]').click()
    const modal = page.locator('[data-test="modal-field"]')
    await modal.locator('[data-test="field-name-input"]').fill('New field')
    await modal.locator('[data-test="field-modal-submit"]').click()
    await expect(modal).toBeHidden()
    await expect(page.locator('[data-test="category-field-row"]')).toHaveCount(initialCount + 1)
  })

  test('submit without field name does not close modal', async ({ page }) => {
    await page.locator('[data-test="category-add-field-btn"]').click()
    const modal = page.locator('[data-test="modal-field"]')
    await modal.locator('[data-test="field-modal-submit"]').click()
    await expect(modal).toBeVisible()
  })

  test('deleting a field removes it from the list', async ({ page }) => {
    const initialCount = await page.locator('[data-test="category-field-row"]').count()
    await page.locator('[data-test="category-field-row"]').first().locator('.action-danger').click()
    // Confirm deletion in the modal
    await expect(page.locator('[data-test="modal-delete-field"]')).toBeVisible()
    await page.locator('[data-test="confirm-delete-field"]').click()
    await expect(page.locator('[data-test="modal-delete-field"]')).toBeHidden()
    await expect(page.locator('[data-test="category-field-row"]')).toHaveCount(initialCount - 1)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Card — save bar disappears after save
// ────────────────────────────────────────────────────────────────────────────
test.describe('category-card › save lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CARD_URL('cat-1'))
    await page.waitForLoadState('networkidle')
  })

  test('save button activates on edit, goes disabled after save', async ({ page }) => {
    const saveBtn = page.locator('[data-test="category-save-bar"] .btn-save')
    await expect(saveBtn).toBeDisabled()
    await page.locator('[data-test="category-name-input"]').fill('Metal — updated')
    await expect(saveBtn).not.toBeDisabled()
    await saveBtn.click()
    await page.waitForLoadState('networkidle')
    await expect(saveBtn).toBeDisabled()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Card — drag-drop (categoryFieldReorder flag ON)
// ────────────────────────────────────────────────────────────────────────────
test.describe('category-card › drag-drop', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CARD_URL('cat-1'))
    await page.waitForLoadState('networkidle')
  })

  test('field rows are draggable when flag is ON', async ({ page }) => {
    const firstRow = page.locator('[data-test="category-field-row"]').first()
    await expect(firstRow).toHaveAttribute('draggable', 'true')
  })

  test('drag-drop changes field order', async ({ page }) => {
    const rows = page.locator('[data-test="category-field-row"]')
    const firstName = await rows.first().locator('td').first().textContent()
    const secondName = await rows.nth(1).locator('td').first().textContent()
    // fire dragstart on first, drop on second
    await rows.first().dispatchEvent('dragstart')
    await rows.nth(1).dispatchEvent('drop')
    // order should be swapped
    await expect(rows.first().locator('td').first()).toHaveText(secondName!)
    await expect(rows.nth(1).locator('td').first()).toHaveText(firstName!)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// i18n — language switch (uses testWithFlags — no language lock, so reload works correctly)
// ────────────────────────────────────────────────────────────────────────────
testWithFlags.describe('categories › i18n', () => {
  testWithFlags('switching language updates UI text', async ({ page }) => {
    await page.setViewportSize(DESKTOP)

    // load in EN (default)
    await page.goto(CATEGORIES_URL)
    await page.waitForLoadState('networkidle')
    const createBtn = page.locator('[data-test="categories-create-btn"]')
    const enText = await createBtn.textContent()

    // switch to RU via localStorage + reload
    await page.evaluate(() => localStorage.setItem('flexiron_lang', 'ru'))
    await page.reload()
    await page.waitForLoadState('networkidle')
    const ruText = await createBtn.textContent()
    expect(ruText?.trim()).not.toBe(enText?.trim())

    // switch to LT via localStorage + reload
    await page.evaluate(() => localStorage.setItem('flexiron_lang', 'lt'))
    await page.reload()
    await page.waitForLoadState('networkidle')
    const ltText = await createBtn.textContent()
    expect(ltText?.trim()).not.toBe(enText?.trim())
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Visual snapshots @1440
// ────────────────────────────────────────────────────────────────────────────
test.describe('categories › visual @1440', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CATEGORIES_URL)
    await stabilizeForSnapshot(page, page.locator('[data-test="categories-table"]'))
    await waitForFontsReady(page)
  })

  test('header', async ({ page }) => {
    await expect(page.locator('[data-test="categories-header"]')).toHaveScreenshot(
      'categories-header.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('filters', async ({ page }) => {
    await expect(page.locator('[data-test="categories-filters"]')).toHaveScreenshot(
      'categories-filters.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('table with mock data', async ({ page }) => {
    await expect(page.locator('[data-test="categories-table"]')).toHaveScreenshot(
      'categories-table.png',
      SNAPSHOT_OPTIONS,
    )
  })
})

test.describe('category-card › visual @1440', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CARD_URL('cat-1'))
    await stabilizeForSnapshot(page, page.locator('[data-test="category-card-info"]'))
    await waitForFontsReady(page)
  })

  test('card header', async ({ page }) => {
    await expect(page.locator('[data-test="category-card-header"]')).toHaveScreenshot(
      'category-card-header.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('info section', async ({ page }) => {
    await expect(page.locator('[data-test="category-card-info"]')).toHaveScreenshot(
      'category-card-info.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('own fields section', async ({ page }) => {
    await expect(page.locator('[data-test="category-own-fields"]')).toHaveScreenshot(
      'category-card-own-fields.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('inherited fields section (cat-2)', async ({ page }) => {
    await page.goto(CARD_URL('cat-2'))
    await stabilizeForSnapshot(page, page.locator('[data-test="category-inherited-fields"]'))
    await waitForFontsReady(page)
    await expect(page.locator('[data-test="category-inherited-fields"]')).toHaveScreenshot(
      'category-card-inherited-fields.png',
      SNAPSHOT_OPTIONS,
    )
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Feature flag — adminCategories OFF → /404
// ────────────────────────────────────────────────────────────────────────────
baseTest(
  'categories › redirects to /404 when adminCategories flag is OFF',
  async ({ page, context }) => {
    await context.addInitScript(
      (flags) => localStorage.setItem('ff_overrides', JSON.stringify(flags)),
      { ...ALL_FLAGS_ENABLED, adminCategories: false },
    )
    await page.goto(CATEGORIES_URL)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/404$/)
  },
)

// ────────────────────────────────────────────────────────────────────────────
// Feature flag — categoryFieldReorder OFF → rows not draggable
// ────────────────────────────────────────────────────────────────────────────
baseTest(
  'category-card › field rows not draggable when categoryFieldReorder is OFF',
  async ({ page, context }) => {
    await context.addInitScript(
      (flags) => localStorage.setItem('ff_overrides', JSON.stringify(flags)),
      { ...ALL_FLAGS_ENABLED, categoryFieldReorder: false },
    )
    await page.setViewportSize(DESKTOP)
    await page.goto(CARD_URL('cat-1'))
    await page.waitForLoadState('networkidle')
    const firstRow = page.locator('[data-test="category-field-row"]').first()
    await expect(firstRow).toHaveAttribute('draggable', 'false')
  },
)
