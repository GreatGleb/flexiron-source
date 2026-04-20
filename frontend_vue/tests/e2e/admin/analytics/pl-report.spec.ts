import { test as base } from '@playwright/test'
import { test, expect } from '../../fixtures'
import { ALL_FLAGS_ENABLED } from '../../helpers/flags'
import { freezeTime } from '../../helpers/mocks'
import { waitForFontsReady, SNAPSHOT_OPTIONS } from '../../helpers/visual'

/**
 * `baseTest` is the un-fixtured Playwright test, used for the page-flag-OFF
 * check below. The default `test` from ../../fixtures installs an init script
 * that forces ALL_FLAGS_ENABLED on every page load — which would undo any flag
 * flip. For the OFF-case check we install a different init script instead.
 */
const baseTest = base

/**
 * Deep audit of PlReportPage (src/views/admin/analytics/PlReportPage.vue).
 *
 * Page shape — all content is hard-coded in the template (no composable / no
 * service fetch yet, so there is nothing to stub with `page.route`):
 *
 *   h1[data-test="pl-report-title"]
 *   <AnalyticsSubNav> → [data-test="analytics-sub-nav"]
 *                         [data-test="analytics-sub-nav-pl"] (current on this route)
 *                         + 7 siblings (kpi, warehouse, sales, supply, staff, logistics, deficit)
 *   [data-test="pl-report-charts-row"]                ×1  — flex row wrapping both panels
 *     [data-test="pl-report-breakdown"]               ×1  — glass-panel, financial-result P&L
 *       [data-test="pl-report-breakdown-row"]         ×6  — sales, cogs, gross,
 *                                                           logistics, rent, salaries
 *       [data-test="pl-report-breakdown-total"]       ×1  — operating profit
 *     [data-test="pl-report-calendar"]                ×1  — glass-panel, payment calendar
 *       [data-test="pl-report-calendar-grid"]         ×1  — 2-col grid
 *         [data-test="pl-report-calendar-item"]       ×6  — one per scheduled payment
 *
 * Flags exercised: page-level `adminPlReport`. No section-level flags on this page.
 */

const PL_REPORT = '/admin/analytics/pl-report'
const DESKTOP = { width: 1440, height: 900 }

// ────────────────────────────────────────────────────────────────────────────
// Structure
// ────────────────────────────────────────────────────────────────────────────
test.describe('pl-report › structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(PL_REPORT)
    await page.waitForLoadState('networkidle')
  })

  test('title visible', async ({ page }) => {
    await expect(page.locator('[data-test="pl-report-title"]')).toBeVisible()
  })

  test('sub-nav, charts-row, both panels all render', async ({ page }) => {
    await expect.soft(page.locator('[data-test="analytics-sub-nav"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="pl-report-charts-row"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="pl-report-breakdown"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="pl-report-calendar"]')).toBeVisible()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Sub-nav
// ────────────────────────────────────────────────────────────────────────────
test.describe('pl-report › sub-nav', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(PL_REPORT)
    await page.waitForLoadState('networkidle')
  })

  test('has 8 tabs', async ({ page }) => {
    await expect(page.locator('[data-test="analytics-sub-nav"] a')).toHaveCount(8)
  })

  test('pl tab is current on this route', async ({ page }) => {
    await expect(page.locator('[data-test="analytics-sub-nav-pl"]')).toHaveClass(/current/)
  })

  test('other tabs are not marked current', async ({ page }) => {
    await expect
      .soft(page.locator('[data-test="analytics-sub-nav-kpi"]'))
      .not.toHaveClass(/current/)
    await expect
      .soft(page.locator('[data-test="analytics-sub-nav-warehouse"]'))
      .not.toHaveClass(/current/)
    await expect
      .soft(page.locator('[data-test="analytics-sub-nav-sales"]'))
      .not.toHaveClass(/current/)
    await expect
      .soft(page.locator('[data-test="analytics-sub-nav-supply"]'))
      .not.toHaveClass(/current/)
    await expect
      .soft(page.locator('[data-test="analytics-sub-nav-staff"]'))
      .not.toHaveClass(/current/)
    await expect
      .soft(page.locator('[data-test="analytics-sub-nav-logistics"]'))
      .not.toHaveClass(/current/)
    await expect
      .soft(page.locator('[data-test="analytics-sub-nav-deficit"]'))
      .not.toHaveClass(/current/)
  })

  test('clicking kpi tab navigates to dashboard and swaps current', async ({ page }) => {
    await page.locator('[data-test="analytics-sub-nav-kpi"]').click()
    await expect(page).toHaveURL('/admin/analytics/dashboard')
    await expect(page.locator('[data-test="analytics-sub-nav-kpi"]')).toHaveClass(/current/)
    await expect(page.locator('[data-test="analytics-sub-nav-pl"]')).not.toHaveClass(/current/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Financial-result breakdown (chart1 — P&L)
// ────────────────────────────────────────────────────────────────────────────
test.describe('pl-report › breakdown panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(PL_REPORT)
    await page.waitForLoadState('networkidle')
  })

  test('panel header shows chart title + march badge', async ({ page }) => {
    const panel = page.locator('[data-test="pl-report-breakdown"]')
    await expect.soft(panel.locator('.panel-title')).toBeVisible()
    await expect.soft(panel.locator('.panel-badge')).toBeVisible()
  })

  test('renders 6 line-item rows + 1 total row', async ({ page }) => {
    await expect.soft(page.locator('[data-test="pl-report-breakdown-row"]')).toHaveCount(6)
    await expect.soft(page.locator('[data-test="pl-report-breakdown-total"]')).toHaveCount(1)
  })

  test('each line-item row has a label and a value', async ({ page }) => {
    const rows = page.locator('[data-test="pl-report-breakdown-row"]')
    const count = await rows.count()
    for (let i = 0; i < count; i++) {
      const r = rows.nth(i)
      await expect.soft(r.locator('.pl-label')).toBeVisible()
      await expect.soft(r.locator('.pl-value')).toBeVisible()
    }
  })

  test('labels are non-empty (i18n translated)', async ({ page }) => {
    const labels = page.locator('[data-test="pl-report-breakdown-row"] .pl-label')
    const count = await labels.count()
    for (let i = 0; i < count; i++) {
      await expect.soft(labels.nth(i)).not.toBeEmpty()
    }
  })

  test('line-item values render the expected hard-coded amounts', async ({ page }) => {
    // Order in template: sales / cogs / gross / logistics / rent / salaries.
    const values = page.locator('[data-test="pl-report-breakdown-row"] .pl-value')
    await expect.soft(values.nth(0)).toHaveText('+ 84 200 €')
    await expect.soft(values.nth(1)).toHaveText('− 58 200 €')
    await expect.soft(values.nth(2)).toHaveText('= 26 000 €')
    await expect.soft(values.nth(3)).toHaveText('− 6 800 €')
    await expect.soft(values.nth(4)).toHaveText('− 2 100 €')
    await expect.soft(values.nth(5)).toHaveText('− 3 130 €')
  })

  test('value colours communicate positive / negative', async ({ page }) => {
    const values = page.locator('[data-test="pl-report-breakdown-row"] .pl-value')
    await expect.soft(values.nth(0)).toHaveClass(/\bgreen\b/) // sales
    await expect.soft(values.nth(1)).toHaveClass(/\bred\b/) // cogs
    await expect.soft(values.nth(2)).toHaveClass(/\bgreen\b/) // gross
    await expect.soft(values.nth(3)).toHaveClass(/\bred\b/) // logistics
    await expect.soft(values.nth(4)).toHaveClass(/\bred\b/) // rent
    await expect.soft(values.nth(5)).toHaveClass(/\bred\b/) // salaries
  })

  test('total row renders operating profit as green 14 870 €', async ({ page }) => {
    const total = page.locator('[data-test="pl-report-breakdown-total"]')
    await expect.soft(total.locator('.pl-label')).not.toBeEmpty()
    await expect.soft(total.locator('.pl-value')).toHaveText('14 870 €')
    await expect.soft(total.locator('.pl-value')).toHaveClass(/\bgreen\b/)
  })

  test('breakdown panel has 3 dividers separating the 3 groups', async ({ page }) => {
    // Groups: (sales) | (cogs, gross) | (logistics, rent, salaries) | (operating)
    // The template places <hr.pl-divider> between each group — 3 in total.
    await expect(page.locator('[data-test="pl-report-breakdown"] hr.pl-divider')).toHaveCount(3)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Payment calendar (chart2)
// ────────────────────────────────────────────────────────────────────────────
test.describe('pl-report › calendar panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(PL_REPORT)
    await page.waitForLoadState('networkidle')
  })

  test('panel header shows chart title + april badge', async ({ page }) => {
    const panel = page.locator('[data-test="pl-report-calendar"]')
    await expect.soft(panel.locator('.panel-title')).toBeVisible()
    await expect.soft(panel.locator('.panel-badge')).toBeVisible()
  })

  test('grid renders 6 calendar items', async ({ page }) => {
    await expect(page.locator('[data-test="pl-report-calendar-item"]')).toHaveCount(6)
  })

  test('each item has a date, client, and amount', async ({ page }) => {
    const items = page.locator('[data-test="pl-report-calendar-item"]')
    for (let i = 0; i < 6; i++) {
      const it = items.nth(i)
      await expect.soft(it.locator('.cal-date')).toBeVisible()
      await expect.soft(it.locator('.cal-client')).toBeVisible()
      await expect.soft(it.locator('.cal-amount')).toBeVisible()
    }
  })

  test('client names render as hard-coded counterparties', async ({ page }) => {
    // Counterparties are brand names, not i18n-translated.
    const clients = page.locator('[data-test="pl-report-calendar-item"] .cal-client')
    await expect.soft(clients.nth(0)).toHaveText('UAB Metalis')
    await expect.soft(clients.nth(1)).toHaveText('SIA Steel Pro')
    await expect.soft(clients.nth(2)).toHaveText('Metallurg LLC')
    await expect.soft(clients.nth(3)).toHaveText('AS Rauad OÜ')
    await expect.soft(clients.nth(4)).toHaveText('Metalis LT')
    await expect.soft(clients.nth(5)).toHaveText('UAB Plieno')
  })

  test('amounts render the expected signed euro values', async ({ page }) => {
    const amounts = page.locator('[data-test="pl-report-calendar-item"] .cal-amount')
    await expect.soft(amounts.nth(0)).toHaveText('+ 8 400 €')
    await expect.soft(amounts.nth(1)).toHaveText('+ 5 100 €')
    await expect.soft(amounts.nth(2)).toHaveText('+ 3 750 €')
    await expect.soft(amounts.nth(3)).toHaveText('+ 2 900 €')
    await expect.soft(amounts.nth(4)).toHaveText('− 18 000 €')
    await expect.soft(amounts.nth(5)).toHaveText('+ 1 600 €')
  })

  test('dates are non-empty (i18n translated)', async ({ page }) => {
    // Date labels come from i18n (plReport.date_apr2 … date_apr14).
    const dates = page.locator('[data-test="pl-report-calendar-item"] .cal-date')
    for (let i = 0; i < 6; i++) {
      await expect.soft(dates.nth(i)).not.toBeEmpty()
    }
  })

  test('negative amount carries the inline danger colour', async ({ page }) => {
    // Only row 5 (Metalis LT / − 18 000 €) uses the inline danger style.
    const amount = page.locator('[data-test="pl-report-calendar-item"] .cal-amount').nth(4)
    const color = await amount.evaluate((el) => (el as HTMLElement).style.color)
    expect(color).toContain('var(--danger)')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Page-level feature flag (adminPlReport)
// ────────────────────────────────────────────────────────────────────────────
baseTest(
  'pl-report › redirects to /404 when adminPlReport flag is OFF',
  async ({ page, context }) => {
    await context.addInitScript(
      (flags) => localStorage.setItem('ff_overrides', JSON.stringify(flags)),
      { ...ALL_FLAGS_ENABLED, adminPlReport: false },
    )
    await page.goto(PL_REPORT)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/404$/)
    await expect(page.locator('[data-test="pl-report-title"]')).toHaveCount(0)
  },
)

// ────────────────────────────────────────────────────────────────────────────
// Per-section visual snapshots (@1440 baseline)
// ────────────────────────────────────────────────────────────────────────────
test.describe('pl-report › visual @1440', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(PL_REPORT)
    await waitForFontsReady(page)
    await page.waitForLoadState('networkidle')
  })

  test('sub-nav', async ({ page }) => {
    await expect(page.locator('[data-test="analytics-sub-nav"]')).toHaveScreenshot(
      'pl-report-sub-nav.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('breakdown panel', async ({ page }) => {
    await expect(page.locator('[data-test="pl-report-breakdown"]')).toHaveScreenshot(
      'pl-report-breakdown.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('calendar panel', async ({ page }) => {
    await expect(page.locator('[data-test="pl-report-calendar"]')).toHaveScreenshot(
      'pl-report-calendar.png',
      SNAPSHOT_OPTIONS,
    )
  })
})
