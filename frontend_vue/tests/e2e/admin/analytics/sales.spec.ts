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
 * Deep audit of SalesPage (src/views/admin/analytics/SalesPage.vue).
 *
 * Page shape — all content is hard-coded in the template (no composable / no
 * service fetch yet, so there is nothing to stub with `page.route`):
 *
 *   h1[data-test="sales-title"]
 *   <AnalyticsSubNav> → [data-test="analytics-sub-nav"]
 *                         [data-test="analytics-sub-nav-sales"] (current on this route)
 *                         + 7 siblings (kpi, warehouse, supply, staff, logistics, pl, deficit)
 *   [data-test="sales-kpi-row"]                ×1
 *     [data-test="sales-kpi-card"]             ×4  — Revenue (EUR), Active clients (pcs.),
 *                                                   Deals closed (pcs.), Lost revenue (EUR)
 *   [data-test="sales-charts-row"]             ×1  — flex row wrapping both panels
 *     [data-test="sales-top-clients"]          ×1  — glass-panel, top-clients bar chart
 *       [data-test="sales-top-clients-row"]    ×5  — one per client
 *     [data-test="sales-refusal-reasons"]      ×1  — glass-panel, refusal-reasons bar chart
 *       [data-test="sales-refusal-row"]        ×3  — too-expensive / out-of-stock / long-delivery
 *
 * Flags exercised: page-level `adminSales`. No section-level flags on this page.
 */

const SALES = '/admin/analytics/sales'
const DESKTOP = { width: 1440, height: 900 }

// ────────────────────────────────────────────────────────────────────────────
// Structure
// ────────────────────────────────────────────────────────────────────────────
test.describe('sales › structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(SALES)
    await page.waitForLoadState('networkidle')
  })

  test('title visible', async ({ page }) => {
    await expect(page.locator('[data-test="sales-title"]')).toBeVisible()
  })

  test('sub-nav, kpi-row, charts-row, both panels all render', async ({ page }) => {
    await expect.soft(page.locator('[data-test="analytics-sub-nav"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="sales-kpi-row"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="sales-charts-row"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="sales-top-clients"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="sales-refusal-reasons"]')).toBeVisible()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// KPI row
// ────────────────────────────────────────────────────────────────────────────
test.describe('sales › kpi cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(SALES)
    await page.waitForLoadState('networkidle')
  })

  test('renders exactly 4 KPI cards', async ({ page }) => {
    await expect(page.locator('[data-test="sales-kpi-card"]')).toHaveCount(4)
  })

  test('each card shows label, value, and delta', async ({ page }) => {
    const cards = page.locator('[data-test="sales-kpi-card"]')
    for (let i = 0; i < 4; i++) {
      const c = cards.nth(i)
      await expect.soft(c.locator('.kpi-label')).toBeVisible()
      await expect.soft(c.locator('.kpi-value')).toBeVisible()
      await expect.soft(c.locator('.kpi-delta')).toBeVisible()
    }
  })

  test('per-card unit suffixes (EUR / pcs. / pcs. / EUR)', async ({ page }) => {
    // Units are hard-coded in the template — one per card in that order.
    const units = page.locator('[data-test="sales-kpi-card"] .kpi-value span')
    await expect.soft(units.nth(0)).toHaveText('EUR')
    await expect.soft(units.nth(1)).toHaveText('pcs.')
    await expect.soft(units.nth(2)).toHaveText('pcs.')
    await expect.soft(units.nth(3)).toHaveText('EUR')
  })

  test('values are the expected formatted numbers', async ({ page }) => {
    const values = page.locator('[data-test="sales-kpi-card"] .kpi-value')
    await expect.soft(values.nth(0)).toContainText('84')
    await expect.soft(values.nth(0)).toContainText('200')
    await expect.soft(values.nth(1)).toContainText('47')
    await expect.soft(values.nth(2)).toContainText('63')
    await expect.soft(values.nth(3)).toContainText('11')
    await expect.soft(values.nth(3)).toContainText('400')
  })

  test('delta classes communicate direction', async ({ page }) => {
    const deltas = page.locator('[data-test="sales-kpi-card"] .kpi-delta')
    await expect.soft(deltas.nth(0)).toHaveClass(/\bup\b/)
    await expect.soft(deltas.nth(1)).toHaveClass(/\bup\b/)
    await expect.soft(deltas.nth(2)).toHaveClass(/\bneutral\b/)
    await expect.soft(deltas.nth(3)).toHaveClass(/\bdown\b/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Sub-nav
// ────────────────────────────────────────────────────────────────────────────
test.describe('sales › sub-nav', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(SALES)
    await page.waitForLoadState('networkidle')
  })

  test('has 8 tabs', async ({ page }) => {
    await expect(page.locator('[data-test="analytics-sub-nav"] a')).toHaveCount(8)
  })

  test('sales tab is current on this route', async ({ page }) => {
    await expect(page.locator('[data-test="analytics-sub-nav-sales"]')).toHaveClass(/current/)
  })

  test('other tabs are not marked current', async ({ page }) => {
    await expect
      .soft(page.locator('[data-test="analytics-sub-nav-kpi"]'))
      .not.toHaveClass(/current/)
    await expect
      .soft(page.locator('[data-test="analytics-sub-nav-warehouse"]'))
      .not.toHaveClass(/current/)
    await expect
      .soft(page.locator('[data-test="analytics-sub-nav-deficit"]'))
      .not.toHaveClass(/current/)
  })

  test('clicking kpi tab navigates back to dashboard and swaps current', async ({ page }) => {
    await page.locator('[data-test="analytics-sub-nav-kpi"]').click()
    await expect(page).toHaveURL('/admin/analytics/dashboard')
    await expect(page.locator('[data-test="analytics-sub-nav-kpi"]')).toHaveClass(/current/)
    await expect(page.locator('[data-test="analytics-sub-nav-sales"]')).not.toHaveClass(/current/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Top clients bar chart
// ────────────────────────────────────────────────────────────────────────────
test.describe('sales › top clients chart', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(SALES)
    await page.waitForLoadState('networkidle')
  })

  test('renders 5 client rows', async ({ page }) => {
    await expect(page.locator('[data-test="sales-top-clients-row"]')).toHaveCount(5)
  })

  test('panel header shows chart title + march badge', async ({ page }) => {
    const panel = page.locator('[data-test="sales-top-clients"]')
    await expect.soft(panel.locator('.panel-title')).toBeVisible()
    await expect.soft(panel.locator('.panel-badge')).toBeVisible()
  })

  test('each row has a label, a filled bar, and a value', async ({ page }) => {
    const rows = page.locator('[data-test="sales-top-clients-row"]')
    for (let i = 0; i < 5; i++) {
      const r = rows.nth(i)
      await expect.soft(r.locator('.bar-label')).toBeVisible()
      await expect.soft(r.locator('.bar-fill')).toBeVisible()
      await expect.soft(r.locator('.bar-val')).toBeVisible()
    }
  })

  test('client names are the expected set (hard-coded)', async ({ page }) => {
    const labels = page.locator('[data-test="sales-top-clients-row"] .bar-label')
    await expect.soft(labels.nth(0)).toHaveText('UAB Metalis')
    await expect.soft(labels.nth(1)).toHaveText('SIA Steel Pro')
    await expect.soft(labels.nth(2)).toHaveText('Metallurg Ltd')
    await expect.soft(labels.nth(3)).toHaveText('AS Rauad OÜ')
    await expect.soft(labels.nth(4)).toHaveText('UAB Plieno')
  })

  test('bar widths decrease monotonically (88 → 62 → 45 → 30 → 19)', async ({ page }) => {
    // Highest-revenue client is first in the template, so widths should be non-increasing.
    const fills = page.locator('[data-test="sales-top-clients-row"] .bar-fill')
    const widths: number[] = []
    const count = await fills.count()
    for (let i = 0; i < count; i++) {
      const w = await fills.nth(i).evaluate((el) => (el as HTMLElement).style.width)
      widths.push(parseInt(w, 10))
    }
    expect(widths).toEqual([88, 62, 45, 30, 19])
  })

  test('EUR values are the expected formatted numbers', async ({ page }) => {
    const vals = page.locator('[data-test="sales-top-clients-row"] .bar-val')
    await expect.soft(vals.nth(0)).toHaveText('18 400 €')
    await expect.soft(vals.nth(1)).toHaveText('13 100 €')
    await expect.soft(vals.nth(2)).toHaveText('9 500 €')
    await expect.soft(vals.nth(3)).toHaveText('6 300 €')
    await expect.soft(vals.nth(4)).toHaveText('4 000 €')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Refusal reasons bar chart
// ────────────────────────────────────────────────────────────────────────────
test.describe('sales › refusal reasons chart', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(SALES)
    await page.waitForLoadState('networkidle')
  })

  test('renders 3 reason rows', async ({ page }) => {
    await expect(page.locator('[data-test="sales-refusal-row"]')).toHaveCount(3)
  })

  test('panel header shows chart title + deals badge', async ({ page }) => {
    const panel = page.locator('[data-test="sales-refusal-reasons"]')
    await expect.soft(panel.locator('.panel-title')).toBeVisible()
    await expect.soft(panel.locator('.panel-badge')).toBeVisible()
  })

  test('each row has a label, a filled bar, and a value', async ({ page }) => {
    const rows = page.locator('[data-test="sales-refusal-row"]')
    for (let i = 0; i < 3; i++) {
      const r = rows.nth(i)
      await expect.soft(r.locator('.bar-label')).toBeVisible()
      await expect.soft(r.locator('.bar-fill')).toBeVisible()
      await expect.soft(r.locator('.bar-val')).toBeVisible()
    }
  })

  test('bar widths match the refusal distribution (62 / 28 / 10)', async ({ page }) => {
    const fills = page.locator('[data-test="sales-refusal-row"] .bar-fill')
    const widths: number[] = []
    const count = await fills.count()
    for (let i = 0; i < count; i++) {
      const w = await fills.nth(i).evaluate((el) => (el as HTMLElement).style.width)
      widths.push(parseInt(w, 10))
    }
    expect(widths).toEqual([62, 28, 10])
  })

  test('values render as percentages summing to 100', async ({ page }) => {
    const vals = page.locator('[data-test="sales-refusal-row"] .bar-val')
    await expect.soft(vals.nth(0)).toHaveText('62%')
    await expect.soft(vals.nth(1)).toHaveText('28%')
    await expect.soft(vals.nth(2)).toHaveText('10%')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Page-level feature flag (adminSales)
// ────────────────────────────────────────────────────────────────────────────
baseTest('sales › redirects to /404 when adminSales flag is OFF', async ({ page, context }) => {
  await context.addInitScript(
    (flags) => localStorage.setItem('ff_overrides', JSON.stringify(flags)),
    { ...ALL_FLAGS_ENABLED, adminSales: false },
  )
  await page.goto(SALES)
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/\/404$/)
  await expect(page.locator('[data-test="sales-title"]')).toHaveCount(0)
})

// ────────────────────────────────────────────────────────────────────────────
// Per-section visual snapshots (@1440 baseline)
// ────────────────────────────────────────────────────────────────────────────
test.describe('sales › visual @1440', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(SALES)
    await waitForFontsReady(page)
    await page.waitForLoadState('networkidle')
  })

  test('sub-nav', async ({ page }) => {
    await expect(page.locator('[data-test="analytics-sub-nav"]')).toHaveScreenshot(
      'sales-sub-nav.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('kpi row', async ({ page }) => {
    await expect(page.locator('[data-test="sales-kpi-row"]')).toHaveScreenshot(
      'sales-kpi-row.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('top clients panel', async ({ page }) => {
    await expect(page.locator('[data-test="sales-top-clients"]')).toHaveScreenshot(
      'sales-top-clients.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('refusal reasons panel', async ({ page }) => {
    await expect(page.locator('[data-test="sales-refusal-reasons"]')).toHaveScreenshot(
      'sales-refusal-reasons.png',
      SNAPSHOT_OPTIONS,
    )
  })
})
