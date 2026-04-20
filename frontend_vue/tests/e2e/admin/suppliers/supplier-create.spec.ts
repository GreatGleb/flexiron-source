import { test as base } from '@playwright/test'
import { test, expect } from '../../fixtures'
import { ALL_FLAGS_ENABLED } from '../../helpers/flags'
import { freezeTime } from '../../helpers/mocks'
import { waitForFontsReady, SNAPSHOT_OPTIONS } from '../../helpers/visual'

/**
 * Deep audit of SupplierCreatePage (src/views/admin/suppliers/SupplierCreatePage.vue).
 *
 * Page shape — thin shell around SupplierFormSections (same sections/data-tests as
 * SupplierCardPage, but without the right column: no Pricing / Files / Audit):
 *
 *   h1[data-test="supplier-create-title"]
 *   [data-test="supplier-create-action-bar"]
 *     button[data-test="supplier-create-cancel-btn"]
 *     button[data-test="supplier-create-save-btn"]  (hard-coded .dirty, toggles .loading)
 *   [data-test="supplier-create-content"]
 *     SupplierFormSections:
 *       LEFT  → [data-test="supplier-form-status"]
 *                 [data-test="supplier-form-status-select"]
 *                 [data-test="supplier-form-rating"]
 *                 [data-test="supplier-form-status-reason"]
 *                 [data-test="supplier-form-contract-date"]
 *             [data-test="supplier-form-requisites"]
 *                 [data-test="supplier-form-company"]
 *                 [data-test="supplier-form-vat"]
 *                 [data-test="supplier-form-address"]
 *             [data-test="supplier-form-contact"]
 *                 [data-test="supplier-form-contact-name"]
 *                 [data-test="supplier-form-contact-email"]
 *                 [data-test="supplier-form-contact-phone"]
 *       CENTER→ [data-test="supplier-form-procurement"]
 *                 [data-test="supplier-form-categories"]
 *                 [data-test="supplier-form-bcc-emails"]
 *                 [data-test="supplier-form-currency"]
 *                 [data-test="supplier-form-payment"]
 *                 [data-test="supplier-form-lead-time"]
 *                 [data-test="supplier-form-min-order"]
 *             [data-test="supplier-form-notes"]
 *                 [data-test="supplier-form-notes-input"]
 *                 [data-test="supplier-form-notes-add-btn"]
 *                 [data-test="supplier-form-note-item"] × N
 *
 * Data flow:
 *   - useSupplierCreate() seeds `supplier` via emptyCard(): status='new', currency='EUR',
 *     paymentTerms='30 Days Net', rating=0, one empty Legal address, every other field
 *     blank. Validation requires company AND email (in that order).
 *   - Save → createSupplier() → apiPost('/api/suppliers') → mockCreateSupplier when
 *     VITE_USE_MOCKS=true. Mock pushes into MOCK_SUPPLIERS and returns a card with a
 *     server-assigned id = max(existing) + 1. With the default mock (ids 1..6), the
 *     FIRST create in a fresh browser context → id '7'. Playwright gives each test its
 *     own context, so JS modules reload and MOCK_SUPPLIERS resets to the initial 6 —
 *     the assertion `toHaveURL(/\/admin\/suppliers\/7$/)` is deterministic.
 *   - On success: router.push({ name: 'admin-supplier-card', params: { id } }) +
 *     success toast. On validation failure: error toast, stay on page.
 *   - Cancel → router.push({ name: 'admin-suppliers' }), no API call.
 *
 * Save route-intercept caveat:
 *   apiPost routes through postMock (NOT real fetch) under VITE_USE_MOCKS=true — so
 *   `page.route('**\/api/suppliers', …)` will NOT fire. Save is verified through
 *   observable side effects: URL redirect to /admin/suppliers/7, success toast, and
 *   the new row appearing in the suppliers list on navigation back.
 *
 * `baseTest` bypasses the fixtures wrapper (which forces ALL_FLAGS_ENABLED) so the
 * flag-OFF check can install its own override. Pattern matches supplier-card.spec.ts.
 */

const baseTest = base

const CREATE_URL = '/admin/suppliers/new'
const DESKTOP = { width: 1440, height: 900 }

// Expected new id for the FIRST create in a fresh browser context (MOCK_SUPPLIERS has
// ids 1..6 → mockCreateSupplier returns id '7' for the first call).
const NEW_ID = '7'

async function loadCreate(page: import('@playwright/test').Page) {
  await page.setViewportSize(DESKTOP)
  await freezeTime(page)
  await page.goto(CREATE_URL)
  await expect(page.locator('[data-test="supplier-create-content"]')).toBeVisible()
  await page.waitForLoadState('networkidle')
}

// ────────────────────────────────────────────────────────────────────────────
// Structure
// ────────────────────────────────────────────────────────────────────────────
test.describe('supplier-create › structure', () => {
  test.beforeEach(async ({ page }) => {
    await loadCreate(page)
  })

  test('title + action bar + content render', async ({ page }) => {
    await expect.soft(page.locator('[data-test="supplier-create-title"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-create-action-bar"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-create-content"]')).toBeVisible()
  })

  test('all five form sections render (status / requisites / contact / procurement / notes)', async ({
    page,
  }) => {
    await expect.soft(page.locator('[data-test="supplier-form-status"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-form-requisites"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-form-contact"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-form-procurement"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-form-notes"]')).toBeVisible()
  })

  test('right-column panels (pricing / files / audit) are NOT rendered on the create page', async ({
    page,
  }) => {
    await expect.soft(page.locator('[data-test="supplier-card-pricing"]')).toHaveCount(0)
    await expect.soft(page.locator('[data-test="supplier-card-files"]')).toHaveCount(0)
    await expect.soft(page.locator('[data-test="supplier-card-audit"]')).toHaveCount(0)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Action bar — both buttons visible + save carries the hard-coded .dirty class
// ────────────────────────────────────────────────────────────────────────────
test.describe('supplier-create › action bar', () => {
  test.beforeEach(async ({ page }) => {
    await loadCreate(page)
  })

  test('cancel + save buttons render and are enabled', async ({ page }) => {
    const cancel = page.locator('[data-test="supplier-create-cancel-btn"]')
    const save = page.locator('[data-test="supplier-create-save-btn"]')
    await expect.soft(cancel).toBeVisible()
    await expect.soft(cancel).toBeEnabled()
    await expect.soft(save).toBeVisible()
    await expect.soft(save).toBeEnabled()
  })

  test('save button is hard-coded .dirty (unlike SupplierCard it does not depend on diff)', async ({
    page,
  }) => {
    // SupplierCreatePage template renders :class="btn btn-save dirty" statically.
    await expect(page.locator('[data-test="supplier-create-save-btn"]')).toHaveClass(/\bdirty\b/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Default values — emptyCard() from useSupplierCreate
// ────────────────────────────────────────────────────────────────────────────
test.describe('supplier-create › default values', () => {
  test.beforeEach(async ({ page }) => {
    await loadCreate(page)
  })

  test('status defaults to "new" (pill-mint)', async ({ page }) => {
    const trigger = page
      .locator('[data-test="supplier-form-status-select"] .custom-select-trigger')
      .locator('.status-pill')
    await expect(trigger).toHaveClass(/\bpill-mint\b/)
  })

  test('currency defaults to EUR and payment defaults to "30 Days Net"', async ({ page }) => {
    await expect
      .soft(page.locator('[data-test="supplier-form-currency"] .custom-select-trigger'))
      .toContainText('EUR')
    await expect
      .soft(page.locator('[data-test="supplier-form-payment"] .custom-select-trigger'))
      .toContainText('30 Days Net')
  })

  test('company / vat / contact-name / email / phone inputs are all empty', async ({ page }) => {
    await expect.soft(page.locator('[data-test="supplier-form-company"]')).toHaveValue('')
    await expect.soft(page.locator('[data-test="supplier-form-vat"]')).toHaveValue('')
    await expect.soft(page.locator('[data-test="supplier-form-contact-name"]')).toHaveValue('')
    await expect.soft(page.locator('[data-test="supplier-form-contact-email"]')).toHaveValue('')
    await expect.soft(page.locator('[data-test="supplier-form-contact-phone"]')).toHaveValue('')
  })

  test('categories + bcc-emails chip containers render with zero chips', async ({ page }) => {
    await expect.soft(page.locator('[data-test="supplier-form-categories"] .tag')).toHaveCount(0)
    await expect.soft(page.locator('[data-test="supplier-form-bcc-emails"] .tag')).toHaveCount(0)
  })

  test('rating defaults to 0 (RatingSelect renders the "any rating" placeholder)', async ({
    page,
  }) => {
    // RatingSelect shows <span class="rating-any"> when modelValue === 0.
    await expect(
      page.locator('[data-test="supplier-form-rating"] .custom-select-trigger .rating-any'),
    ).toBeVisible()
  })

  test('address block renders with a single empty Legal address (emptyCard default)', async ({
    page,
  }) => {
    await expect(page.locator('[data-test="supplier-form-address"]')).toHaveValue('')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Validation — save with empty / half-filled form surfaces the proper toast,
// stays on the same URL, does NOT create a supplier.
// ────────────────────────────────────────────────────────────────────────────
test.describe('supplier-create › validation', () => {
  test.beforeEach(async ({ page }) => {
    await loadCreate(page)
  })

  test('empty form → clicking Save shows the company-required error toast and stays on /new', async ({
    page,
  }) => {
    await page.locator('[data-test="supplier-create-save-btn"]').click()
    const toast = page.locator('.toast-container .toast.show.toast-error')
    await expect.soft(toast).toBeVisible()
    // EN (default locale) validation copy per src/i18n/admin.ts.
    await expect.soft(toast).toContainText('Please enter the company name')
    await expect.soft(page).toHaveURL(/\/admin\/suppliers\/new$/)
  })

  test('company filled but email missing → email-required error toast', async ({ page }) => {
    await page.locator('[data-test="supplier-form-company"]').fill('Pretty Co')
    await page.locator('[data-test="supplier-create-save-btn"]').click()
    const toast = page.locator('.toast-container .toast.show.toast-error')
    await expect.soft(toast).toBeVisible()
    await expect.soft(toast).toContainText('Please enter the email')
    await expect.soft(page).toHaveURL(/\/admin\/suppliers\/new$/)
  })

  test('email filled but company blank → still company-required (validated first)', async ({
    page,
  }) => {
    // useSupplierCreate.validate() checks company BEFORE email — missing company wins
    // regardless of whether email is present.
    await page.locator('[data-test="supplier-form-contact-email"]').fill('foo@bar.co')
    await page.locator('[data-test="supplier-create-save-btn"]').click()
    const toast = page.locator('.toast-container .toast.show.toast-error')
    await expect.soft(toast).toBeVisible()
    await expect.soft(toast).toContainText('Please enter the company name')
  })

  test('whitespace-only company is treated as empty (validate() uses .trim())', async ({
    page,
  }) => {
    await page.locator('[data-test="supplier-form-company"]').fill('   ')
    await page.locator('[data-test="supplier-form-contact-email"]').fill('foo@bar.co')
    await page.locator('[data-test="supplier-create-save-btn"]').click()
    const toast = page.locator('.toast-container .toast.show.toast-error')
    await expect.soft(toast).toBeVisible()
    await expect.soft(toast).toContainText('Please enter the company name')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Happy path — valid form → POST /api/suppliers → redirect to new card + toast
// ────────────────────────────────────────────────────────────────────────────
test.describe('supplier-create › save happy-path', () => {
  test.beforeEach(async ({ page }) => {
    await loadCreate(page)
  })

  test('filling company + email then Save redirects to the new supplier card', async ({ page }) => {
    await page.locator('[data-test="supplier-form-company"]').fill('Playwright Steel UAB')
    await page.locator('[data-test="supplier-form-contact-email"]').fill('hello@playwright.test')
    await page.locator('[data-test="supplier-create-save-btn"]').click()
    // mockCreateSupplier pushes a row with id = max(existing) + 1 → '7' in a fresh context.
    await expect(page).toHaveURL(new RegExp(`/admin/suppliers/${NEW_ID}$`))
  })

  test('success toast appears after a valid save', async ({ page }) => {
    await page.locator('[data-test="supplier-form-company"]').fill('Playwright Steel UAB')
    await page.locator('[data-test="supplier-form-contact-email"]').fill('hello@playwright.test')
    await page.locator('[data-test="supplier-create-save-btn"]').click()
    await expect(page).toHaveURL(new RegExp(`/admin/suppliers/${NEW_ID}$`))
    // The success variant does not carry .toast-error — filter it out to be explicit.
    const successToast = page.locator('.toast-container .toast.show:not(.toast-error)')
    await expect.soft(successToast).toBeVisible()
    await expect.soft(successToast).toContainText('Supplier created')
  })

  test('the newly created card renders the data that was submitted', async ({ page }) => {
    const company = 'Playwright Steel UAB'
    const email = 'hello@playwright.test'
    await page.locator('[data-test="supplier-form-company"]').fill(company)
    await page.locator('[data-test="supplier-form-contact-email"]').fill(email)
    await page.locator('[data-test="supplier-create-save-btn"]').click()
    await expect(page).toHaveURL(new RegExp(`/admin/suppliers/${NEW_ID}$`))
    // The card page mounts SupplierFormSections with the freshly-created record.
    await expect(page.locator('[data-test="supplier-form-company"]')).toHaveValue(company)
    await expect(page.locator('[data-test="supplier-form-contact-email"]')).toHaveValue(email)
  })

  test('the new supplier appears in the suppliers list (in-SPA back-navigation)', async ({
    page,
  }) => {
    // MOCK_SUPPLIERS is module-level state — it survives SPA route changes but NOT a
    // full reload (which re-evaluates JS modules). page.goto() forces a full reload, so
    // navigate via the sidebar router-link to stay within the same module graph.
    const company = 'Playwright Steel UAB'
    await page.locator('[data-test="supplier-form-company"]').fill(company)
    await page.locator('[data-test="supplier-form-contact-email"]').fill('hello@playwright.test')
    await page.locator('[data-test="supplier-create-save-btn"]').click()
    await expect(page).toHaveURL(new RegExp(`/admin/suppliers/${NEW_ID}$`))
    // Sidebar nav link → /admin/suppliers (router-link, no reload).
    await page.locator('a[href="/admin/suppliers"]').first().click()
    await expect(page).toHaveURL(/\/admin\/suppliers$/)
    await expect(page.locator('[data-test="suppliers-row"]')).toHaveCount(7)
    await expect(page.locator('[data-test="suppliers-table"]')).toContainText(company)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Cancel — router.push({ name: 'admin-suppliers' }), no record created
// ────────────────────────────────────────────────────────────────────────────
test.describe('supplier-create › cancel', () => {
  test.beforeEach(async ({ page }) => {
    await loadCreate(page)
  })

  test('clicking Cancel returns to /admin/suppliers', async ({ page }) => {
    await page.locator('[data-test="supplier-create-cancel-btn"]').click()
    await expect(page).toHaveURL(/\/admin\/suppliers$/)
  })

  test('Cancel does NOT create a supplier (list still has the original 6 rows)', async ({
    page,
  }) => {
    // Fill something to prove Cancel discards it.
    await page.locator('[data-test="supplier-form-company"]').fill('Discarded Co')
    await page.locator('[data-test="supplier-create-cancel-btn"]').click()
    await expect(page).toHaveURL(/\/admin\/suppliers$/)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-test="suppliers-row"]')).toHaveCount(6)
    await expect(page.locator('[data-test="suppliers-table"]')).not.toContainText('Discarded Co')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Page-level feature flag (supplierCreate) — OFF → /404
// ────────────────────────────────────────────────────────────────────────────
baseTest(
  'supplier-create › redirects to /404 when supplierCreate flag is OFF',
  async ({ page, context }) => {
    await context.addInitScript(
      (flags) => localStorage.setItem('ff_overrides', JSON.stringify(flags)),
      { ...ALL_FLAGS_ENABLED, supplierCreate: false },
    )
    await page.goto(CREATE_URL)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/404$/)
    await expect(page.locator('[data-test="supplier-create-title"]')).toHaveCount(0)
  },
)

// ────────────────────────────────────────────────────────────────────────────
// Per-section visual snapshots (@1440 baseline)
// ────────────────────────────────────────────────────────────────────────────
test.describe('supplier-create › visual @1440', () => {
  test.beforeEach(async ({ page }) => {
    await loadCreate(page)
    await waitForFontsReady(page)
  })

  test('action bar', async ({ page }) => {
    await expect(page.locator('[data-test="supplier-create-action-bar"]')).toHaveScreenshot(
      'supplier-create-action-bar.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('status section', async ({ page }) => {
    await expect(page.locator('[data-test="supplier-form-status"]')).toHaveScreenshot(
      'supplier-create-status.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('requisites section', async ({ page }) => {
    await expect(page.locator('[data-test="supplier-form-requisites"]')).toHaveScreenshot(
      'supplier-create-requisites.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('contact section', async ({ page }) => {
    await expect(page.locator('[data-test="supplier-form-contact"]')).toHaveScreenshot(
      'supplier-create-contact.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('procurement section', async ({ page }) => {
    await expect(page.locator('[data-test="supplier-form-procurement"]')).toHaveScreenshot(
      'supplier-create-procurement.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('notes section', async ({ page }) => {
    await expect(page.locator('[data-test="supplier-form-notes"]')).toHaveScreenshot(
      'supplier-create-notes.png',
      SNAPSHOT_OPTIONS,
    )
  })
})
