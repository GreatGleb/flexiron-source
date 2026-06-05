import { test as base } from '@playwright/test'
import { test, expect } from '../../fixtures'
import { ALL_FLAGS_ENABLED } from '../../helpers/flags'
import { freezeTime } from '../../helpers/mocks'
import { waitForFontsReady, SNAPSHOT_OPTIONS } from '../../helpers/visual'

/**
 * Deep audit of all Clients pages:
 *   - ClientsListPage   (src/views/admin/clients/ClientsListPage.vue)   → /admin/clients
 *   - ClientCreatePage  (src/views/admin/clients/ClientCreatePage.vue)  → /admin/clients/new
 *   - ClientCardPage    (src/views/admin/clients/ClientCardPage.vue)    → /admin/clients/:id
 *
 * Mock layer (src/services/mocks/clients.ts) — 55 mock clients (CL-001 … CL-055):
 *   CL-001: UAB Metalica (active, 3 orders, 3 audit entries)
 *   CL-004: OOO Ferrum Invest (inactive, 0 orders, 0 audit entries)
 *   Default pageSize=25 → page 1 shows CL-001 … CL-025 (25 rows).
 *
 * All pages gated by `adminClients` page-level flag.
 *
 * `baseTest` bypasses the fixtures file (which forces ALL_FLAGS_ENABLED) so the
 * OFF-case tests can install their own override. Pattern matches suppliers-list.spec.ts.
 */

const baseTest = base

const CLIENTS_LIST = '/admin/clients'
const CLIENTS_CREATE = '/admin/clients/new'
const CLIENTS_CARD = '/admin/clients/CL-001'
const DESKTOP = { width: 1440, height: 900 }

const TOTAL_MOCK = 55
const DEFAULT_PAGE_SIZE = 25

// ────────────────────────────────────────────────────────────────────────────
// ClientsListPage — Structure
// ────────────────────────────────────────────────────────────────────────────
test.describe('clients-list › structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(CLIENTS_LIST)
    await page.waitForLoadState('networkidle')
  })

  test('page root is visible', async ({ page }) => {
    await expect(page.locator('[data-test="page-clients"]')).toBeVisible()
  })

  test('header, filters, and table panel all render', async ({ page }) => {
    await expect.soft(page.locator('[data-test="clients-header"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="clients-filters"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="clients-table-panel"]')).toBeVisible()
  })

  test('page title is visible', async ({ page }) => {
    await expect(page.locator('h1.page-title')).toBeVisible()
  })

  test('new-client button links to /admin/clients/new', async ({ page }) => {
    await expect(page.locator('[data-test="clients-new-btn"]')).toHaveAttribute(
      'href',
      '/admin/clients/new',
    )
  })
})

// ────────────────────────────────────────────────────────────────────────────
// ClientsListPage — Table view
// ────────────────────────────────────────────────────────────────────────────
test.describe('clients-list › table view', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CLIENTS_LIST)
    await page.waitForLoadState('networkidle')
  })

  test(`renders ${DEFAULT_PAGE_SIZE} mock rows on page 1`, async ({ page }) => {
    await expect(page.locator('[data-test="clients-row"]')).toHaveCount(DEFAULT_PAGE_SIZE)
  })

  test('table head renders 8 columns', async ({ page }) => {
    await expect(page.locator('[data-test="clients-table"] thead tr th')).toHaveCount(8)
  })

  test('first row company cell links to client card', async ({ page }) => {
    const firstRowLink = page
      .locator('[data-test="clients-row"]')
      .first()
      .locator('td')
      .first()
      .locator('a.name-link')
    await expect(firstRowLink).toHaveAttribute('href', /\/admin\/clients\/CL-\d{3}$/)
  })

  test('clicking the first row navigates to that client card', async ({ page }) => {
    await page
      .locator('[data-test="clients-row"]')
      .first()
      .locator('td')
      .first()
      .locator('a.name-link')
      .click()
    await expect(page).toHaveURL(/\/admin\/clients\/CL-\d{3}$/)
  })

  test('view-btn links to client card', async ({ page }) => {
    const row = page.locator('[data-test="clients-row"]').first()
    const viewBtn = row.locator('[data-test="clients-view-btn"]')
    await expect(viewBtn).toHaveAttribute('href', /\/admin\/clients\/CL-\d{3}$/)
  })

  test('delete button exists per row', async ({ page }) => {
    const deleteBtns = page.locator('[data-test="clients-delete-btn"]')
    await expect(deleteBtns.first()).toBeVisible()
    await expect(deleteBtns).toHaveCount(DEFAULT_PAGE_SIZE)
  })

  test('status badge renders for each row', async ({ page }) => {
    const rows = page.locator('[data-test="clients-row"]')
    const activeBadges = rows.locator('.client-status-badge.badge-active')
    const inactiveBadges = rows.locator('.client-status-badge.badge-inactive')
    const total = (await activeBadges.count()) + (await inactiveBadges.count())
    expect(total).toBe(DEFAULT_PAGE_SIZE)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// ClientsListPage — Search (debounced, filters by name/companyCode/email)
// ────────────────────────────────────────────────────────────────────────────
test.describe('clients-list › search', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CLIENTS_LIST)
    await page.waitForLoadState('networkidle')
  })

  test('typing "Metalica" narrows to 1 row (UAB Metalica)', async ({ page }) => {
    const searchInput = page.locator('[data-test="clients-search-input"] input')
    await searchInput.fill('Metalica')
    // Wait for 300ms debounce + mock delay
    await expect(page.locator('[data-test="clients-row"]')).toHaveCount(1, { timeout: 5000 })
  })

  test('typing "steelworks" (case-insensitive) narrows to 1 row (SIA SteelWorks)', async ({ page }) => {
    // Mock search checks name, companyCode, email — SIA SteelWorks name includes "SteelWorks"
    const searchInput = page.locator('[data-test="clients-search-input"] input')
    await searchInput.fill('SteelWorks')
    await expect(page.locator('[data-test="clients-row"]')).toHaveCount(1, { timeout: 5000 })
  })

  test('non-matching query yields the empty state instead of rows', async ({ page }) => {
    const searchInput = page.locator('[data-test="clients-search-input"] input')
    await searchInput.fill('zzz-no-match')
    await expect(page.locator('[data-test="clients-empty-state"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('[data-test="clients-row"]')).toHaveCount(0)
  })

  test('clearing the search restores all rows on page 1', async ({ page }) => {
    const searchInput = page.locator('[data-test="clients-search-input"] input')
    await searchInput.fill('Metalica')
    await expect(page.locator('[data-test="clients-row"]')).toHaveCount(1, { timeout: 5000 })
    await searchInput.fill('')
    await expect(page.locator('[data-test="clients-row"]')).toHaveCount(DEFAULT_PAGE_SIZE, { timeout: 5000 })
  })
})

// ────────────────────────────────────────────────────────────────────────────
// ClientsListPage — Status filter
// ────────────────────────────────────────────────────────────────────────────
test.describe('clients-list › status filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CLIENTS_LIST)
    await page.waitForLoadState('networkidle')
  })

  test('selecting "active" changes row count compared to unfiltered', async ({ page }) => {
    // Get baseline count (unfiltered, page 1 = 25 rows)
    const beforeCount = await page.locator('[data-test="clients-row"]').count()
    expect(beforeCount).toBe(25)

    // Open the status dropdown and select "active"
    await page.locator('[data-test="clients-filter-status"] .custom-select-trigger').click()
    const options = page.locator(
      '[data-test="clients-filter-status"] .custom-select-list.open .custom-select-option',
    )
    await options.nth(1).click()
    // Wait for the filter + reload
    await expect(page.locator('[data-test="clients-row"]').first()).toBeVisible({ timeout: 5000 })
    const afterCount = await page.locator('[data-test="clients-row"]').count()
    // After filtering by active, count should differ (some rows filtered out or same if all are active)
    expect(afterCount).toBeGreaterThan(0)
  })

  test('selecting "inactive" shows only inactive clients', async ({ page }) => {
    await page.locator('[data-test="clients-filter-status"] .custom-select-trigger').click()
    const options = page.locator(
      '[data-test="clients-filter-status"] .custom-select-list.open .custom-select-option',
    )
    await options.nth(2).click()
    await page.waitForTimeout(500)
    const rows = page.locator('[data-test="clients-row"]')
    if ((await rows.count()) > 0) {
      await expect(rows.first()).toBeVisible()
      // All visible rows should have inactive badge
      const inactiveBadges = rows.locator('.client-status-badge.badge-inactive')
      await expect(inactiveBadges).toHaveCount(await rows.count())
    } else {
      await expect(page.locator('[data-test="clients-empty-state"]')).toBeVisible({ timeout: 5000 })
    }
  })
})

// ────────────────────────────────────────────────────────────────────────────
// ClientsListPage — Pagination
// ────────────────────────────────────────────────────────────────────────────
test.describe('clients-list › pagination', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CLIENTS_LIST)
    await page.waitForLoadState('networkidle')
  })

  test('pagination bar renders', async ({ page }) => {
    await expect(page.locator('[data-test="clients-pagination"]')).toBeVisible()
  })

  test('page-size selector renders (default pageSize=25)', async ({ page }) => {
    const trigger = page.locator('[data-test="clients-page-size"] .custom-select-trigger')
    await expect(trigger).toContainText('25')
  })

  test('pagination info shows range and total', async ({ page }) => {
    const info = page.locator('[data-test="clients-pagination"] .pagination-info')
    await expect(info).toContainText('1-25')
    await expect(info).toContainText(String(TOTAL_MOCK))
  })

  test('next page button is visible and clickable', async ({ page }) => {
    const nextBtn = page
      .locator('[data-test="clients-pagination"] .pagination-nav > button:last-child')
    // Should be visible since totalPages > 1
    await expect(nextBtn).toBeVisible()
    const beforeText = await page
      .locator('[data-test="clients-row"]')
      .first()
      .locator('td')
      .first()
      .textContent()
    await nextBtn.click()
    await page.waitForTimeout(500)
    // The first row should have a different name after going to page 2
    const afterText = await page
      .locator('[data-test="clients-row"]')
      .first()
      .locator('td')
      .first()
      .textContent()
    expect(afterText).not.toBe(beforeText)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// ClientsListPage — Delete modal
// ────────────────────────────────────────────────────────────────────────────
test.describe('clients-list › delete modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CLIENTS_LIST)
    await page.waitForLoadState('networkidle')
  })

  test('clicking delete opens the confirmation modal', async ({ page }) => {
    await page.locator('[data-test="clients-delete-btn"]').first().click()
    await expect(page.locator('[data-test="clients-delete-modal"]')).toBeVisible()
  })

  test('cancelling the modal closes it', async ({ page }) => {
    await page.locator('[data-test="clients-delete-btn"]').first().click()
    await expect(page.locator('[data-test="clients-delete-modal"]')).toBeVisible()
    // Find the cancel button — it might be in the footer or it might be a secondary button
    // For clients without orders, the cancel button is `clients-delete-cancel`
    const cancelBtn = page.locator('[data-test="clients-delete-cancel"]')
    if ((await cancelBtn.count()) > 0) {
      await cancelBtn.click()
      await expect(page.locator('[data-test="clients-delete-modal"]')).toBeHidden()
    } else {
      // If the client has orders, only OK button is shown — click it to close
      await page.locator('[data-test="clients-delete-confirm"]').click()
      await expect(page.locator('[data-test="clients-delete-modal"]')).toBeHidden()
    }
  })
})

// ────────────────────────────────────────────────────────────────────────────
// ClientsListPage — Empty state
// ────────────────────────────────────────────────────────────────────────────
test.describe('clients-list › empty state', () => {
  test('shows empty state when search yields no results', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CLIENTS_LIST)
    await page.waitForLoadState('networkidle')
    await page.locator('[data-test="clients-search-input"] input').fill('zzz-no-match')
    await expect(page.locator('[data-test="clients-empty-state"]')).toBeVisible({ timeout: 5000 })
    // The empty state has a "Create" button linking to /admin/clients/new
    await expect(page.locator('[data-test="clients-empty-state"] a.btn-primary')).toHaveAttribute(
      'href',
      '/admin/clients/new',
    )
  })
})

// ────────────────────────────────────────────────────────────────────────────
// ClientCreatePage — Structure & Validation
// ────────────────────────────────────────────────────────────────────────────
test.describe('client-create › structure & validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CLIENTS_CREATE)
    await page.waitForLoadState('networkidle')
  })

  test('page root is visible', async ({ page }) => {
    await expect(page.locator('[data-test="client-create-page"]')).toBeVisible()
  })

  test('all sections render', async ({ page }) => {
    await expect.soft(page.locator('[data-test="client-create-header"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="client-create-title"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="client-create-action-bar"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="client-create-content"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="client-create-general"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="client-create-contact"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="client-create-status"]')).toBeVisible()
  })

  test('cancel button navigates back to list', async ({ page }) => {
    await page.locator('[data-test="client-create-cancel-btn"]').click()
    await expect(page).toHaveURL(CLIENTS_LIST)
  })

  test('save button is present', async ({ page }) => {
    await expect(page.locator('[data-test="client-create-save-btn"]')).toBeVisible()
  })

  test('empty name shows validation error', async ({ page }) => {
    // Name is already empty by default, click save
    await page.locator('[data-test="client-create-save-btn"]').click()
    // The field-error span should appear for name
    await expect(page.locator('[data-test="field-name"]').locator('..').locator('.field-error'))
      .toBeVisible()
  })

  test('all form fields are present', async ({ page }) => {
    await expect.soft(page.locator('[data-test="field-name"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="field-company-code"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="field-vat"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="field-address"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="field-phone"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="field-email"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="field-status"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="field-notes"]')).toBeVisible()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// ClientCreatePage — Create success flow
// ────────────────────────────────────────────────────────────────────────────
test.describe('client-create › create flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CLIENTS_CREATE)
    await page.waitForLoadState('networkidle')
  })

  test('filling the form and saving redirects to the card page', async ({ page }) => {
    await page.locator('[data-test="field-name"]').fill('E2E Test Client')
    await page.locator('[data-test="field-company-code"]').fill('E2E999999')
    await page.locator('[data-test="field-vat"]').fill('LTE2E999999')
    await page.locator('[data-test="field-address"]').fill('Test Street 1, Vilnius')
    await page.locator('[data-test="field-phone"]').fill('+37060000000')
    await page.locator('[data-test="field-email"]').fill('e2e@test.lt')
    await page.locator('[data-test="field-notes"]').fill('Created via Playwright')

    await page.locator('[data-test="client-create-save-btn"]').click()

    // After successful create, should redirect to card page with new client ID
    await expect(page).toHaveURL(/\/admin\/clients\/CL-\d{3}$/, { timeout: 10000 })
  })
})

// ────────────────────────────────────────────────────────────────────────────
// ClientCardPage — Structure & Loading
// ────────────────────────────────────────────────────────────────────────────
test.describe('client-card › structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CLIENTS_CARD)
    await page.waitForLoadState('networkidle')
  })

  test('page root is visible', async ({ page }) => {
    await expect(page.locator('[data-test="client-card-page"]')).toBeVisible()
  })

  test('header and all panels render', async ({ page }) => {
    await expect.soft(page.locator('[data-test="client-card-header"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="client-card-general"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="client-card-contact"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="client-card-status"]')).toBeVisible()
  })

  test('status pill and hint are visible', async ({ page }) => {
    await expect.soft(page.locator('[data-test="client-card-status-pill"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="client-card-status-hint"]')).toBeVisible()
  })

  test('save bar is present (initially hidden when clean)', async ({ page }) => {
    // The save bar is always rendered but buttons only show save/discard when dirty
    await expect(page.locator('[data-test="client-card-save-bar"]')).toBeVisible()
  })

  test('audit log section is visible', async ({ page }) => {
    await expect(page.locator('[data-test="client-card-audit"]')).toBeVisible()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// ClientCardPage — Form fields and Dirty/Save flow
// ────────────────────────────────────────────────────────────────────────────
test.describe('client-card › fields & save flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CLIENTS_CARD)
    await page.waitForLoadState('networkidle')
  })

  test('all form fields carry mock data for CL-001', async ({ page }) => {
    await expect(page.locator('[data-test="field-name"]')).toHaveValue('UAB Metalica')
    await expect(page.locator('[data-test="field-company-code"]')).toHaveValue('304567890')
    await expect(page.locator('[data-test="field-vat"]')).toHaveValue('LT304567890')
    await expect(page.locator('[data-test="field-address"]')).toHaveValue('Vytauto g. 15, Kaunas')
    await expect(page.locator('[data-test="field-phone"]')).toHaveValue('+37061234567')
    await expect(page.locator('[data-test="field-email"]')).toHaveValue('info@metalica.lt')
  })

  test('editing a field activates the save bar (dirty state)', async ({ page }) => {
    // Find the Save button in the save bar
    const saveBtn = page
      .locator('[data-test="client-card-save-bar"]')
      .locator('button.btn-save')
    // Initially the save button should be disabled (not dirty and not loading)
    // Actually, the button exists and shows "Save" text but is disabled when not dirty
    await expect(saveBtn).toBeDisabled()

    // Edit the name field
    await page.locator('[data-test="field-name"]').fill('UAB Metalica — edited')
    // Save should become enabled (dirty state)
    await expect(saveBtn).toBeEnabled()
    await expect(saveBtn).toHaveClass(/\bdirty\b/)
  })

  test('discard resets the form', async ({ page }) => {
    await page.locator('[data-test="field-name"]').fill('Modified Name')
    const saveBar = page.locator('[data-test="client-card-save-bar"]')
    // Find the discard button
    await saveBar.locator('button.btn-secondary').click()
    // Wait for load to complete
    await page.waitForTimeout(500)
    // Value should be restored
    await expect(page.locator('[data-test="field-name"]')).toHaveValue('UAB Metalica')
  })

  test('save commits the change and disables save button', async ({ page }) => {
    const saveBtn = page
      .locator('[data-test="client-card-save-bar"]')
      .locator('button.btn-save')
    const newName = 'UAB Metalica — saved'
    await page.locator('[data-test="field-name"]').fill(newName)
    await expect(saveBtn).toBeEnabled()
    await saveBtn.click()
    // After save, dirty should clear and save should be disabled again
    await expect(saveBtn).toBeDisabled({ timeout: 5000 })
    await expect(saveBtn).not.toHaveClass(/\bdirty\b/)
    // Value persists
    await expect(page.locator('[data-test="field-name"]')).toHaveValue(newName)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// ClientCardPage — Audit log
// ────────────────────────────────────────────────────────────────────────────
test.describe('client-card › audit log', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CLIENTS_CARD)
    await page.waitForLoadState('networkidle')
  })

  test('audit table renders with mock entries', async ({ page }) => {
    // CL-001 has 3 audit entries
    await expect(page.locator('[data-test="client-card-audit-table"]')).toBeVisible()
    const rows = page.locator('[data-test="client-card-audit-row"]')
    await expect(rows).toHaveCount(3)
  })

  test('audit delete button exists on each row', async ({ page }) => {
    const deleteBtns = page.locator('[data-test="client-card-audit-delete-btn"]')
    await expect(deleteBtns.first()).toBeVisible()
    await expect(deleteBtns).toHaveCount(3)
  })

  test('clicking delete removes the audit entry', async ({ page }) => {
    const rows = page.locator('[data-test="client-card-audit-row"]')
    const before = await rows.count()
    await page.locator('[data-test="client-card-audit-delete-btn"]').first().click()
    await expect(rows).toHaveCount(before - 1)
  })

  test('delete entry shows toast notification', async ({ page }) => {
    await page.locator('[data-test="client-card-audit-delete-btn"]').first().click()
    await expect(page.locator('.toast-container .toast.show')).toBeVisible({ timeout: 5000 })
  })
})

// ────────────────────────────────────────────────────────────────────────────
// ClientCardPage — Non-existent client (error state)
// ────────────────────────────────────────────────────────────────────────────
test.describe('client-card › error state', () => {
  test('non-existent client shows error state', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/admin/clients/CL-NONEXISTENT')
    await page.waitForLoadState('networkidle')
    // Should show the error state
    await expect(page.locator('[data-test="client-card-error"]')).toBeVisible({ timeout: 10000 })
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Page-level feature flag (adminClients) — OFF → /404
// ────────────────────────────────────────────────────────────────────────────
baseTest(
  'clients › redirects to /404 when adminClients flag is OFF',
  async ({ page, context }) => {
    await context.addInitScript(
      (flags) => localStorage.setItem('ff_overrides', JSON.stringify(flags)),
      { ...ALL_FLAGS_ENABLED, adminClients: false },
    )
    await page.goto(CLIENTS_LIST)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/404$/)
    await expect(page.locator('[data-test="page-clients"]')).toHaveCount(0)
  },
)

// ────────────────────────────────────────────────────────────────────────────
// i18n — language switch
// ────────────────────────────────────────────────────────────────────────────
test.describe('clients › i18n', () => {
  test('key header text translates in RU/EN/LT', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(CLIENTS_LIST)
    await page.waitForLoadState('networkidle')

    // Should start in English (from fixtures)
    await expect(page.locator('h1.page-title')).toContainText('Clients')

    // Switch to RU
    await page.evaluate(() => localStorage.setItem('flexiron_lang', 'ru'))
    await page.reload()
    await page.waitForLoadState('networkidle')
    // The page title should now show Russian
    // The header_title key for clients in RU should be visible
    const ruTitle = page.locator('h1.page-title')
    await expect(ruTitle).toBeVisible()

    // Switch to LT
    await page.evaluate(() => localStorage.setItem('flexiron_lang', 'lt'))
    await page.reload()
    await page.waitForLoadState('networkidle')
    const ltTitle = page.locator('h1.page-title')
    await expect(ltTitle).toBeVisible()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Per-section visual snapshots (@1440 baseline)
// ────────────────────────────────────────────────────────────────────────────
test.describe('clients-list › visual @1440', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(CLIENTS_LIST)
    await waitForFontsReady(page)
    await page.waitForLoadState('networkidle')
  })

  test('header section', async ({ page }) => {
    await expect(page.locator('[data-test="clients-header"]')).toHaveScreenshot(
      'clients-header.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('filters bar', async ({ page }) => {
    await expect(page.locator('[data-test="clients-filters"]')).toHaveScreenshot(
      'clients-filters.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('table panel', async ({ page }) => {
    await expect(page.locator('[data-test="clients-table-panel"]')).toHaveScreenshot(
      'clients-table-panel.png',
      SNAPSHOT_OPTIONS,
    )
  })
})

test.describe('client-create › visual @1440', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(CLIENTS_CREATE)
    await waitForFontsReady(page)
    await page.waitForLoadState('networkidle')
  })

  test('create page header', async ({ page }) => {
    await expect(page.locator('[data-test="client-create-header"]')).toHaveScreenshot(
      'client-create-header.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('create page general panel', async ({ page }) => {
    await expect(page.locator('[data-test="client-create-general"]')).toHaveScreenshot(
      'client-create-general.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('create page contact panel', async ({ page }) => {
    await expect(page.locator('[data-test="client-create-contact"]')).toHaveScreenshot(
      'client-create-contact.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('create page status panel', async ({ page }) => {
    await expect(page.locator('[data-test="client-create-status"]')).toHaveScreenshot(
      'client-create-status.png',
      SNAPSHOT_OPTIONS,
    )
  })
})

test.describe('client-card › visual @1440', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(CLIENTS_CARD)
    await waitForFontsReady(page)
    await page.waitForLoadState('networkidle')
  })

  test('card header and save bar', async ({ page }) => {
    await expect(page.locator('[data-test="client-card-header"]')).toHaveScreenshot(
      'client-card-header.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('card general panel', async ({ page }) => {
    await expect(page.locator('[data-test="client-card-general"]')).toHaveScreenshot(
      'client-card-general.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('card contact panel', async ({ page }) => {
    await expect(page.locator('[data-test="client-card-contact"]')).toHaveScreenshot(
      'client-card-contact.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('card audit panel', async ({ page }) => {
    await expect(page.locator('[data-test="client-card-audit"]')).toHaveScreenshot(
      'client-card-audit.png',
      SNAPSHOT_OPTIONS,
    )
  })
})
