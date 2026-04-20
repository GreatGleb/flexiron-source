import { test as base } from '@playwright/test'
import { test, expect } from '../../fixtures'
import { ALL_FLAGS_ENABLED } from '../../helpers/flags'
import { freezeTime } from '../../helpers/mocks'
import { waitForFontsReady, SNAPSHOT_OPTIONS } from '../../helpers/visual'

/**
 * Deep audit of SuppliersListPage (src/views/admin/suppliers/SuppliersListPage.vue).
 *
 * Page shape — composable-driven (useSuppliers → suppliersService → mocks/suppliers):
 *
 *   h1[data-test="suppliers-title"]
 *   [data-test="suppliers-toolbar"]
 *     ViewTabs[data-test="suppliers-view-tabs"]         ← gated by supplierKanbanView flag
 *     [data-test="suppliers-export-btn"]                ← gated by supplierExport flag
 *     [data-test="suppliers-bcc-btn"]                   (always)
 *     [data-test="suppliers-new-btn"]                   (always)
 *   [data-test="suppliers-filters"]
 *     [data-test="suppliers-filter-status"]             (CustomSelect — single)
 *     [data-test="suppliers-filter-category"]           (MultiSelect — chips)
 *     [data-test="suppliers-filter-rating"]             (RatingSelect — exact match)
 *     [data-test="suppliers-save-view-btn"]             (persists prefs to localStorage)
 *   [data-test="suppliers-table-view"] (v-show, active when view === 'table')
 *     GlassPanel[data-test="suppliers-table-panel"]
 *       [data-test="suppliers-error-state"]             (v-if error)
 *       [data-test="suppliers-empty-state"]             (v-else-if empty)
 *       table[data-test="suppliers-table"]
 *         input[data-test="suppliers-search-input"]     (300 ms debounce → filters.search)
 *         tr[data-test="suppliers-row"] × N             (6 mock rows, default)
 *         [data-test="suppliers-pagination"]
 *           [data-test="suppliers-page-size"]           (CustomSelect: 25/50/100)
 *   [data-test="suppliers-kanban-view"] (v-if kanban flag, v-show view === 'kanban')
 *     [data-test="suppliers-kanban-board"]
 *       GlassPanel[data-test="suppliers-kanban-column-${status}"] × 6  (active/preferred/new/under_review/suspended/blocked)
 *         KanbanCard[data-test="suppliers-kanban-card"] × N
 *   AppModal (confirm status move, `.modal-overlay.active` when open, title = modal.confirm_move_title)
 *
 * Mock (src/services/mocks/suppliers.ts) — 6 fixed rows:
 *   active: Steel Plus / Nordic Steel / IronBridge (3)
 *   preferred: Metal Trade (1, hasDeficit=true)
 *   new: Baltic Metal (1)
 *   under_review: Euro Metal (1)
 *   suspended/blocked: 0
 *
 * Flags exercised:
 *   - page-level `suppliersList` → /404 redirect
 *   - section `supplierKanbanView` → view-tabs + kanban-view hidden
 *   - section `supplierExport` → export-btn hidden
 *
 * `baseTest` bypasses the fixtures file (which forces ALL_FLAGS_ENABLED) so the
 * OFF-case tests can install their own override. Pattern matches deficit.spec.ts.
 */

const baseTest = base

const SUPPLIERS = '/admin/suppliers'
const DESKTOP = { width: 1440, height: 900 }
const PREFS_KEY = 'suppliers_list_prefs'

// Deterministic mock counts — these follow MOCK_SUPPLIERS in src/services/mocks/suppliers.ts.
const TOTAL_MOCK = 6

// ────────────────────────────────────────────────────────────────────────────
// Structure
// ────────────────────────────────────────────────────────────────────────────
test.describe('suppliers-list › structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(SUPPLIERS)
    await page.waitForLoadState('networkidle')
  })

  test('title visible', async ({ page }) => {
    await expect(page.locator('[data-test="suppliers-title"]')).toBeVisible()
  })

  test('toolbar, filters, and table view all render', async ({ page }) => {
    await expect.soft(page.locator('[data-test="suppliers-toolbar"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="suppliers-filters"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="suppliers-table-view"]')).toBeVisible()
  })

  test('kanban view is rendered in DOM but hidden by default (table is initial view)', async ({
    page,
  }) => {
    // v-if keeps the element in the DOM (flag is ON); v-show hides it via CSS until switched to.
    await expect.soft(page.locator('[data-test="suppliers-kanban-view"]')).toHaveCount(1)
    await expect.soft(page.locator('[data-test="suppliers-kanban-view"]')).toBeHidden()
  })

  test('table is the initial active view', async ({ page }) => {
    await expect(page.locator('[data-test="suppliers-table-view"]')).toBeVisible()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Toolbar
// ────────────────────────────────────────────────────────────────────────────
test.describe('suppliers-list › toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(SUPPLIERS)
    await page.waitForLoadState('networkidle')
  })

  test('view tabs, export, bcc, new-supplier buttons all present', async ({ page }) => {
    await expect.soft(page.locator('[data-test="suppliers-view-tabs"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="suppliers-export-btn"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="suppliers-bcc-btn"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="suppliers-new-btn"]')).toBeVisible()
  })

  test('view-tabs exposes exactly two buttons (table/kanban)', async ({ page }) => {
    await expect(page.locator('[data-test="suppliers-view-tabs"] button')).toHaveCount(2)
  })

  test('first tab (table) is active by default', async ({ page }) => {
    const tabs = page.locator('[data-test="suppliers-view-tabs"] button')
    await expect.soft(tabs.nth(0)).toHaveClass(/\bactive\b/)
    await expect.soft(tabs.nth(1)).not.toHaveClass(/\bactive\b/)
  })

  test('new-supplier button links to /admin/suppliers/new', async ({ page }) => {
    await expect(page.locator('[data-test="suppliers-new-btn"]')).toHaveAttribute(
      'href',
      '/admin/suppliers/new',
    )
  })

  test('bcc button links to /admin/suppliers/bcc-request', async ({ page }) => {
    await expect(page.locator('[data-test="suppliers-bcc-btn"]')).toHaveAttribute(
      'href',
      '/admin/suppliers/bcc-request',
    )
  })

  test('clicking new-supplier navigates to the create page', async ({ page }) => {
    await page.locator('[data-test="suppliers-new-btn"]').click()
    await expect(page).toHaveURL(/\/admin\/suppliers\/new$/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Table view — initial render
// ────────────────────────────────────────────────────────────────────────────
test.describe('suppliers-list › table view', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(SUPPLIERS)
    await page.waitForLoadState('networkidle')
  })

  test(`renders all ${TOTAL_MOCK} mock rows`, async ({ page }) => {
    await expect(page.locator('[data-test="suppliers-row"]')).toHaveCount(TOTAL_MOCK)
  })

  test('table head renders 8 columns', async ({ page }) => {
    await expect(page.locator('[data-test="suppliers-table"] thead tr th')).toHaveCount(8)
  })

  test('company cell links to the supplier card', async ({ page }) => {
    const firstRowLink = page
      .locator('[data-test="suppliers-row"]')
      .first()
      .locator('td')
      .first()
      .locator('a.link')
    await expect(firstRowLink).toHaveAttribute('href', /\/admin\/suppliers\/\w+$/)
  })

  test('deficit indicator renders only on suppliers with hasDeficit=true', async ({ page }) => {
    // Mock: only Metal Trade LT (id=2) has hasDeficit=true.
    const indicators = page.locator('[data-test="suppliers-row"] .deficit-indicator')
    await expect(indicators).toHaveCount(1)
  })

  test('status pills are coloured per status', async ({ page }) => {
    // Three active suppliers → three pill-success; one preferred → pill-info; etc.
    const rows = page.locator('[data-test="suppliers-row"]')
    await expect(rows.locator('.status-pill.pill-success')).toHaveCount(3)
    await expect(rows.locator('.status-pill.pill-info')).toHaveCount(1)
    await expect(rows.locator('.status-pill.pill-mint')).toHaveCount(1)
    await expect(rows.locator('.status-pill.pill-warning')).toHaveCount(1)
  })

  test('row action icons link to card and bcc-request with supplier id', async ({ page }) => {
    const row = page.locator('[data-test="suppliers-row"]').first()
    const actions = row.locator('.table-actions a')
    await expect(actions).toHaveCount(2)
    await expect.soft(actions.nth(0)).toHaveAttribute('href', /\/admin\/suppliers\/\w+$/)
    await expect
      .soft(actions.nth(1))
      .toHaveAttribute('href', /\/admin\/suppliers\/bcc-request\?supplier=\w+$/)
  })

  test('clicking a row navigates to that supplier card', async ({ page }) => {
    await page
      .locator('[data-test="suppliers-row"]')
      .first()
      .locator('td')
      .first()
      .locator('a.link')
      .click()
    await expect(page).toHaveURL(/\/admin\/suppliers\/\w+$/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Search (debounced, filters by company name, case-insensitive)
// ────────────────────────────────────────────────────────────────────────────
test.describe('suppliers-list › search', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(SUPPLIERS)
    await page.waitForLoadState('networkidle')
  })

  test('typing "Steel" narrows to 2 rows (Steel Plus + Nordic Steel)', async ({ page }) => {
    await page.locator('[data-test="suppliers-search-input"]').fill('Steel')
    // 300 ms debounce + reactive watcher — poll until the expected count lands.
    await expect(page.locator('[data-test="suppliers-row"]')).toHaveCount(2)
  })

  test('typing "metal" (case-insensitive) narrows to 3 rows', async ({ page }) => {
    // "Metal Trade", "Baltic Metal", "Euro Metal" — 3 rows.
    await page.locator('[data-test="suppliers-search-input"]').fill('metal')
    await expect(page.locator('[data-test="suppliers-row"]')).toHaveCount(3)
  })

  test('non-matching query yields the empty state instead of rows', async ({ page }) => {
    await page.locator('[data-test="suppliers-search-input"]').fill('zzz-no-match')
    await expect(page.locator('[data-test="suppliers-empty-state"]')).toBeVisible()
    await expect(page.locator('[data-test="suppliers-row"]')).toHaveCount(0)
  })

  test('clearing the search restores all rows', async ({ page }) => {
    const input = page.locator('[data-test="suppliers-search-input"]')
    await input.fill('Steel')
    await expect(page.locator('[data-test="suppliers-row"]')).toHaveCount(2)
    await input.fill('')
    await expect(page.locator('[data-test="suppliers-row"]')).toHaveCount(TOTAL_MOCK)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Filters
// ────────────────────────────────────────────────────────────────────────────
test.describe('suppliers-list › status filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(SUPPLIERS)
    await page.waitForLoadState('networkidle')
  })

  test('clicking a status opens the dropdown and shows 7 options (all + 6 statuses)', async ({
    page,
  }) => {
    const trigger = page.locator('[data-test="suppliers-filter-status"] .custom-select-trigger')
    await trigger.click()
    const options = page.locator(
      '[data-test="suppliers-filter-status"] .custom-select-list.open .custom-select-option',
    )
    await expect(options).toHaveCount(7)
  })

  test('selecting "active" narrows to 3 rows', async ({ page }) => {
    await page.locator('[data-test="suppliers-filter-status"] .custom-select-trigger').click()
    // Second option is 'active' — use the coloured pill class to disambiguate from i18n label.
    await page
      .locator(
        '[data-test="suppliers-filter-status"] .custom-select-option .status-pill.pill-success',
      )
      .click()
    await expect(page.locator('[data-test="suppliers-row"]')).toHaveCount(3)
  })

  test('selecting "preferred" narrows to 1 row', async ({ page }) => {
    await page.locator('[data-test="suppliers-filter-status"] .custom-select-trigger').click()
    await page
      .locator('[data-test="suppliers-filter-status"] .custom-select-option .status-pill.pill-info')
      .click()
    await expect(page.locator('[data-test="suppliers-row"]')).toHaveCount(1)
  })

  test('selecting "blocked" yields the empty state (0 mock rows with that status)', async ({
    page,
  }) => {
    await page.locator('[data-test="suppliers-filter-status"] .custom-select-trigger').click()
    await page
      .locator(
        '[data-test="suppliers-filter-status"] .custom-select-option .status-pill.pill-danger',
      )
      .click()
    await expect(page.locator('[data-test="suppliers-empty-state"]')).toBeVisible()
  })
})

test.describe('suppliers-list › category filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(SUPPLIERS)
    await page.waitForLoadState('networkidle')
  })

  test('renders 8 checkbox options (one per CATEGORY_KEY)', async ({ page }) => {
    await page.locator('[data-test="suppliers-filter-category"] .custom-select-trigger').click()
    const options = page.locator(
      '[data-test="suppliers-filter-category"] .multi-select-list.open .multi-select-option',
    )
    await expect(options).toHaveCount(8)
  })

  test('checking first category (Sheets) narrows to 2 rows (Steel Plus + Nordic Steel)', async ({
    page,
  }) => {
    await page.locator('[data-test="suppliers-filter-category"] .custom-select-trigger').click()
    await page
      .locator('[data-test="suppliers-filter-category"] .multi-select-option')
      .first()
      .locator('input[type="checkbox"]')
      .check()
    await expect(page.locator('[data-test="suppliers-row"]')).toHaveCount(2)
  })

  test('checking two categories uses OR semantics (union of matches)', async ({ page }) => {
    // Sheets (1,3) OR Beams (2,5) → 4 rows.
    await page.locator('[data-test="suppliers-filter-category"] .custom-select-trigger').click()
    const opts = page.locator('[data-test="suppliers-filter-category"] .multi-select-option')
    await opts.nth(0).locator('input[type="checkbox"]').check() // Sheets
    await opts.nth(2).locator('input[type="checkbox"]').check() // Beams
    await expect(page.locator('[data-test="suppliers-row"]')).toHaveCount(4)
  })

  test('selected categories render as chips inside the trigger', async ({ page }) => {
    await page.locator('[data-test="suppliers-filter-category"] .custom-select-trigger').click()
    await page
      .locator('[data-test="suppliers-filter-category"] .multi-select-option')
      .first()
      .locator('input[type="checkbox"]')
      .check()
    await expect(
      page.locator(
        '[data-test="suppliers-filter-category"] .custom-select-trigger .multi-select-tags .tag',
      ),
    ).toHaveCount(1)
  })
})

test.describe('suppliers-list › rating filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(SUPPLIERS)
    await page.waitForLoadState('networkidle')
  })

  test('renders 6 options (any + 5..1)', async ({ page }) => {
    await page.locator('[data-test="suppliers-filter-rating"] .custom-select-trigger').click()
    const options = page.locator(
      '[data-test="suppliers-filter-rating"] .custom-select-list.open .custom-select-option',
    )
    await expect(options).toHaveCount(6)
  })

  test('selecting 5-star narrows to 1 row (Steel Plus)', async ({ page }) => {
    await page.locator('[data-test="suppliers-filter-rating"] .custom-select-trigger').click()
    // Options order: [0 any, 5, 4, 3, 2, 1]. nth(1) = 5.
    await page.locator('[data-test="suppliers-filter-rating"] .custom-select-option').nth(1).click()
    await expect(page.locator('[data-test="suppliers-row"]')).toHaveCount(1)
  })

  test('selecting 4-star narrows to 3 rows', async ({ page }) => {
    await page.locator('[data-test="suppliers-filter-rating"] .custom-select-trigger').click()
    await page.locator('[data-test="suppliers-filter-rating"] .custom-select-option').nth(2).click()
    await expect(page.locator('[data-test="suppliers-row"]')).toHaveCount(3)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// View switch (table ↔ kanban)
// ────────────────────────────────────────────────────────────────────────────
test.describe('suppliers-list › view switch', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(SUPPLIERS)
    await page.waitForLoadState('networkidle')
  })

  test('clicking the kanban tab shows the kanban view and hides the table', async ({ page }) => {
    await page.locator('[data-test="suppliers-view-tabs"] button').nth(1).click()
    await expect.soft(page.locator('[data-test="suppliers-kanban-view"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="suppliers-table-view"]')).toBeHidden()
  })

  test('clicking the kanban tab marks it active and un-marks the table tab', async ({ page }) => {
    const tabs = page.locator('[data-test="suppliers-view-tabs"] button')
    await tabs.nth(1).click()
    await expect.soft(tabs.nth(1)).toHaveClass(/\bactive\b/)
    await expect.soft(tabs.nth(0)).not.toHaveClass(/\bactive\b/)
  })

  test('clicking the table tab after kanban restores the table view', async ({ page }) => {
    const tabs = page.locator('[data-test="suppliers-view-tabs"] button')
    await tabs.nth(1).click()
    await expect(page.locator('[data-test="suppliers-kanban-view"]')).toBeVisible()
    await tabs.nth(0).click()
    await expect.soft(page.locator('[data-test="suppliers-table-view"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="suppliers-kanban-view"]')).toBeHidden()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Kanban view (columns, counts, card rendering)
// ────────────────────────────────────────────────────────────────────────────
test.describe('suppliers-list › kanban view', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(SUPPLIERS)
    await page.waitForLoadState('networkidle')
    await page.locator('[data-test="suppliers-view-tabs"] button').nth(1).click()
    await expect(page.locator('[data-test="suppliers-kanban-view"]')).toBeVisible()
  })

  test('renders 6 columns (one per status)', async ({ page }) => {
    for (const status of ['active', 'preferred', 'new', 'under_review', 'suspended', 'blocked']) {
      await expect
        .soft(page.locator(`[data-test="suppliers-kanban-column-${status}"]`))
        .toBeVisible()
    }
  })

  test('active column holds 3 cards', async ({ page }) => {
    const col = page.locator('[data-test="suppliers-kanban-column-active"]')
    await expect(col.locator('[data-test="suppliers-kanban-card"]')).toHaveCount(3)
  })

  test('preferred/new/under_review columns hold exactly 1 card each', async ({ page }) => {
    await expect
      .soft(
        page
          .locator('[data-test="suppliers-kanban-column-preferred"]')
          .locator('[data-test="suppliers-kanban-card"]'),
      )
      .toHaveCount(1)
    await expect
      .soft(
        page
          .locator('[data-test="suppliers-kanban-column-new"]')
          .locator('[data-test="suppliers-kanban-card"]'),
      )
      .toHaveCount(1)
    await expect
      .soft(
        page
          .locator('[data-test="suppliers-kanban-column-under_review"]')
          .locator('[data-test="suppliers-kanban-card"]'),
      )
      .toHaveCount(1)
  })

  test('suspended and blocked columns are empty', async ({ page }) => {
    await expect
      .soft(
        page
          .locator('[data-test="suppliers-kanban-column-suspended"]')
          .locator('[data-test="suppliers-kanban-card"]'),
      )
      .toHaveCount(0)
    await expect
      .soft(
        page
          .locator('[data-test="suppliers-kanban-column-blocked"]')
          .locator('[data-test="suppliers-kanban-card"]'),
      )
      .toHaveCount(0)
  })

  test('column header badge shows the card count', async ({ page }) => {
    // Badge is the .panel-badge > span inside the GlassPanel header.
    const activeBadge = page.locator(
      '[data-test="suppliers-kanban-column-active"] .panel-badge span',
    )
    await expect(activeBadge).toHaveText('3')
  })

  test('kanban cards are draggable', async ({ page }) => {
    const card = page.locator('[data-test="suppliers-kanban-card"]').first()
    await expect(card).toHaveAttribute('draggable', 'true')
  })

  test('kanban card title links to the supplier card page', async ({ page }) => {
    const link = page
      .locator('[data-test="suppliers-kanban-card"]')
      .first()
      .locator('.kanban-card-title')
    await expect(link).toHaveAttribute('href', /\/admin\/suppliers\/\w+$/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Pagination
// ────────────────────────────────────────────────────────────────────────────
test.describe('suppliers-list › pagination', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(SUPPLIERS)
    await page.waitForLoadState('networkidle')
  })

  test('pagination bar renders', async ({ page }) => {
    await expect(page.locator('[data-test="suppliers-pagination"]')).toBeVisible()
  })

  test('page-size selector renders (default pageSize=25)', async ({ page }) => {
    const trigger = page.locator('[data-test="suppliers-page-size"] .custom-select-trigger')
    await expect(trigger).toContainText('25')
  })

  test(`showing info reports "1-${TOTAL_MOCK} … ${TOTAL_MOCK}" with the 6-row mock`, async ({
    page,
  }) => {
    const info = page.locator('[data-test="suppliers-pagination"] .pagination-info')
    await expect(info).toContainText(`1-${TOTAL_MOCK}`)
    await expect(info).toContainText(String(TOTAL_MOCK))
  })

  test('prev/next buttons are hidden for a single-page result (totalPages <= 1)', async ({
    page,
  }) => {
    // `:style="{ display: totalPages <= 1 ? 'none' : 'flex' }"` hides the buttons.
    const navButtons = page.locator('[data-test="suppliers-pagination"] .pagination-nav > button')
    await expect(navButtons.first()).toBeHidden()
    await expect(navButtons.last()).toBeHidden()
  })

  test('page-size dropdown opens upward and lists three options (25/50/100)', async ({ page }) => {
    await page.locator('[data-test="suppliers-page-size"] .custom-select-trigger').click()
    const list = page.locator('[data-test="suppliers-page-size"] .custom-select-list.open')
    await expect.soft(list).toHaveClass(/\bopen-up\b/)
    await expect.soft(list.locator('.custom-select-option')).toHaveCount(3)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Export CSV (section-level supplierExport flag ON by default)
// ────────────────────────────────────────────────────────────────────────────
test.describe('suppliers-list › export', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(SUPPLIERS)
    await page.waitForLoadState('networkidle')
  })

  test('export button is visible when flag is ON', async ({ page }) => {
    await expect(page.locator('[data-test="suppliers-export-btn"]')).toBeVisible()
  })

  test('clicking export triggers a CSV download named suppliers.csv', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-test="suppliers-export-btn"]').click(),
    ])
    expect(download.suggestedFilename()).toBe('suppliers.csv')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Save view — persists activeView + filters to localStorage under suppliers_list_prefs
// ────────────────────────────────────────────────────────────────────────────
test.describe('suppliers-list › save view', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(SUPPLIERS)
    await page.waitForLoadState('networkidle')
  })

  test('clicking save-view writes the current view + filters to localStorage', async ({ page }) => {
    // Switch to kanban, then save.
    await page.locator('[data-test="suppliers-view-tabs"] button').nth(1).click()
    await page.locator('[data-test="suppliers-save-view-btn"]').click()
    const raw = await page.evaluate((k) => localStorage.getItem(k), PREFS_KEY)
    expect(raw).not.toBeNull()
    const prefs = JSON.parse(raw!) as { activeView: string }
    expect(prefs.activeView).toBe('kanban')
  })

  test('stored kanban view is restored on reload (flag ON)', async ({ page }) => {
    await page.locator('[data-test="suppliers-view-tabs"] button').nth(1).click()
    await page.locator('[data-test="suppliers-save-view-btn"]').click()
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-test="suppliers-kanban-view"]')).toBeVisible()
    await expect(page.locator('[data-test="suppliers-table-view"]')).toBeHidden()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Page-level feature flag (suppliersList) — OFF → /404
// ────────────────────────────────────────────────────────────────────────────
baseTest(
  'suppliers-list › redirects to /404 when suppliersList flag is OFF',
  async ({ page, context }) => {
    await context.addInitScript(
      (flags) => localStorage.setItem('ff_overrides', JSON.stringify(flags)),
      { ...ALL_FLAGS_ENABLED, suppliersList: false },
    )
    await page.goto(SUPPLIERS)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/404$/)
    await expect(page.locator('[data-test="suppliers-title"]')).toHaveCount(0)
  },
)

// ────────────────────────────────────────────────────────────────────────────
// Section flag supplierKanbanView OFF — view-tabs + kanban-view removed, table still works
// ────────────────────────────────────────────────────────────────────────────
baseTest(
  'suppliers-list › hides view tabs and kanban view when supplierKanbanView is OFF',
  async ({ page, context }) => {
    await context.addInitScript(
      (flags) => localStorage.setItem('ff_overrides', JSON.stringify(flags)),
      { ...ALL_FLAGS_ENABLED, supplierKanbanView: false },
    )
    await page.goto(SUPPLIERS)
    await page.waitForLoadState('networkidle')
    await expect.soft(page.locator('[data-test="suppliers-view-tabs"]')).toHaveCount(0)
    await expect.soft(page.locator('[data-test="suppliers-kanban-view"]')).toHaveCount(0)
    await expect.soft(page.locator('[data-test="suppliers-table-view"]')).toBeVisible()
  },
)

baseTest(
  'suppliers-list › forces table view when supplierKanbanView is OFF even if prefs say kanban',
  async ({ page, context }) => {
    // Seed prefs with activeView=kanban, then flip flag off on a second load.
    await context.addInitScript(
      (payload) => {
        localStorage.setItem('ff_overrides', JSON.stringify(payload.flags))
        localStorage.setItem(payload.prefsKey, JSON.stringify({ activeView: 'kanban' }))
      },
      { flags: { ...ALL_FLAGS_ENABLED, supplierKanbanView: false }, prefsKey: PREFS_KEY },
    )
    await page.goto(SUPPLIERS)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-test="suppliers-table-view"]')).toBeVisible()
    await expect(page.locator('[data-test="suppliers-kanban-view"]')).toHaveCount(0)
  },
)

// ────────────────────────────────────────────────────────────────────────────
// Section flag supplierExport OFF — export button removed
// ────────────────────────────────────────────────────────────────────────────
baseTest(
  'suppliers-list › hides export button when supplierExport is OFF',
  async ({ page, context }) => {
    await context.addInitScript(
      (flags) => localStorage.setItem('ff_overrides', JSON.stringify(flags)),
      { ...ALL_FLAGS_ENABLED, supplierExport: false },
    )
    await page.goto(SUPPLIERS)
    await page.waitForLoadState('networkidle')
    await expect.soft(page.locator('[data-test="suppliers-export-btn"]')).toHaveCount(0)
    // BCC + New Supplier buttons are not flag-gated — they must remain.
    await expect.soft(page.locator('[data-test="suppliers-bcc-btn"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="suppliers-new-btn"]')).toBeVisible()
  },
)

// ────────────────────────────────────────────────────────────────────────────
// Per-section visual snapshots (@1440 baseline)
// ────────────────────────────────────────────────────────────────────────────
test.describe('suppliers-list › visual @1440', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(SUPPLIERS)
    await waitForFontsReady(page)
    await page.waitForLoadState('networkidle')
  })

  test('toolbar', async ({ page }) => {
    await expect(page.locator('[data-test="suppliers-toolbar"]')).toHaveScreenshot(
      'suppliers-list-toolbar.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('filters bar', async ({ page }) => {
    await expect(page.locator('[data-test="suppliers-filters"]')).toHaveScreenshot(
      'suppliers-list-filters.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('table panel', async ({ page }) => {
    await expect(page.locator('[data-test="suppliers-table-panel"]')).toHaveScreenshot(
      'suppliers-list-table-panel.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('kanban board', async ({ page }) => {
    await page.locator('[data-test="suppliers-view-tabs"] button').nth(1).click()
    const kanban = page.locator('[data-test="suppliers-kanban-board"]')
    await expect(kanban).toBeVisible()
    await expect(kanban).toHaveScreenshot('suppliers-list-kanban-board.png', SNAPSHOT_OPTIONS)
  })
})
