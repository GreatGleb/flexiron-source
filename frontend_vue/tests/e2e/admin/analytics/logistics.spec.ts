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
 * Deep audit of LogisticsPage (src/views/admin/analytics/LogisticsPage.vue).
 *
 * Page shape — all content is hard-coded in the template (no composable / no
 * service fetch yet, so there is nothing to stub with `page.route`):
 *
 *   h1[data-test="logistics-title"]
 *   <AnalyticsSubNav> → [data-test="analytics-sub-nav"]
 *                         [data-test="analytics-sub-nav-logistics"] (current on this route)
 *                         + 7 siblings (kpi, warehouse, sales, supply, staff, pl, deficit)
 *   [data-test="logistics-kpi-row"]              ×1
 *     [data-test="logistics-kpi-card"]           ×4  — Trips (pcs., up),
 *                                                     Avg load (t, neutral),
 *                                                     Empty trips (pcs., down),
 *                                                     Delivery profitability (%, up)
 *   [data-test="logistics-charts-row"]           ×1  — flex row wrapping both panels
 *     [data-test="logistics-routes"]             ×1  — glass-panel, routes table
 *       [data-test="logistics-routes-table"]     ×1  — <table class="data-table">, 5 cols
 *         [data-test="logistics-route-row"]      ×5  — VK / VR / VW / KT / PL
 *     [data-test="logistics-load"]               ×1  — glass-panel, bar chart (weeks 1-4)
 *       [data-test="logistics-load-row"]         ×4  — one per week
 *
 * Flags exercised: page-level `adminLogistics`. No section-level flags on this page.
 */

const LOGISTICS = '/admin/analytics/logistics'
const DESKTOP = { width: 1440, height: 900 }

// ────────────────────────────────────────────────────────────────────────────
// Structure
// ────────────────────────────────────────────────────────────────────────────
test.describe('logistics › structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(LOGISTICS)
    await page.waitForLoadState('networkidle')
  })

  test('title visible', async ({ page }) => {
    await expect(page.locator('[data-test="logistics-title"]')).toBeVisible()
  })

  test('sub-nav, kpi-row, charts-row, both panels all render', async ({ page }) => {
    await expect.soft(page.locator('[data-test="analytics-sub-nav"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="logistics-kpi-row"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="logistics-charts-row"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="logistics-routes"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="logistics-load"]')).toBeVisible()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// KPI row
// ────────────────────────────────────────────────────────────────────────────
test.describe('logistics › kpi cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(LOGISTICS)
    await page.waitForLoadState('networkidle')
  })

  test('renders exactly 4 KPI cards', async ({ page }) => {
    await expect(page.locator('[data-test="logistics-kpi-card"]')).toHaveCount(4)
  })

  test('each card shows label, value, and delta', async ({ page }) => {
    const cards = page.locator('[data-test="logistics-kpi-card"]')
    for (let i = 0; i < 4; i++) {
      const c = cards.nth(i)
      await expect.soft(c.locator('.kpi-label')).toBeVisible()
      await expect.soft(c.locator('.kpi-value')).toBeVisible()
      await expect.soft(c.locator('.kpi-delta')).toBeVisible()
    }
  })

  test('per-card unit suffixes (pcs. / t / pcs. / %)', async ({ page }) => {
    // Units are hard-coded in the template — one per card in that order.
    const units = page.locator('[data-test="logistics-kpi-card"] .kpi-value span')
    await expect.soft(units.nth(0)).toHaveText('pcs.')
    await expect.soft(units.nth(1)).toHaveText('t')
    await expect.soft(units.nth(2)).toHaveText('pcs.')
    await expect.soft(units.nth(3)).toHaveText('%')
  })

  test('values are the expected numbers', async ({ page }) => {
    const values = page.locator('[data-test="logistics-kpi-card"] .kpi-value')
    await expect.soft(values.nth(0)).toContainText('34')
    await expect.soft(values.nth(1)).toContainText('7.4')
    await expect.soft(values.nth(2)).toContainText('5')
    await expect.soft(values.nth(3)).toContainText('62')
  })

  test('delta classes communicate direction', async ({ page }) => {
    const deltas = page.locator('[data-test="logistics-kpi-card"] .kpi-delta')
    await expect.soft(deltas.nth(0)).toHaveClass(/\bup\b/)
    await expect.soft(deltas.nth(1)).toHaveClass(/\bneutral\b/)
    await expect.soft(deltas.nth(2)).toHaveClass(/\bdown\b/)
    await expect.soft(deltas.nth(3)).toHaveClass(/\bup\b/)
  })

  test('hard-coded delta strings render verbatim (cards 3 & 4)', async ({ page }) => {
    // Cards 3 and 4 skip i18n for the delta — assert the literal template strings.
    const deltas = page.locator('[data-test="logistics-kpi-card"] .kpi-delta')
    await expect.soft(deltas.nth(2)).toHaveText('↑ 14.7%')
    await expect.soft(deltas.nth(3)).toHaveText('↑ +5%')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Sub-nav
// ────────────────────────────────────────────────────────────────────────────
test.describe('logistics › sub-nav', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(LOGISTICS)
    await page.waitForLoadState('networkidle')
  })

  test('has 8 tabs', async ({ page }) => {
    await expect(page.locator('[data-test="analytics-sub-nav"] a')).toHaveCount(8)
  })

  test('logistics tab is current on this route', async ({ page }) => {
    await expect(page.locator('[data-test="analytics-sub-nav-logistics"]')).toHaveClass(/current/)
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
    await expect.soft(page.locator('[data-test="analytics-sub-nav-pl"]')).not.toHaveClass(/current/)
    await expect
      .soft(page.locator('[data-test="analytics-sub-nav-deficit"]'))
      .not.toHaveClass(/current/)
  })

  test('clicking kpi tab navigates to dashboard and swaps current', async ({ page }) => {
    await page.locator('[data-test="analytics-sub-nav-kpi"]').click()
    await expect(page).toHaveURL('/admin/analytics/dashboard')
    await expect(page.locator('[data-test="analytics-sub-nav-kpi"]')).toHaveClass(/current/)
    await expect(page.locator('[data-test="analytics-sub-nav-logistics"]')).not.toHaveClass(
      /current/,
    )
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Routes table (chart1 — trips per route)
// ────────────────────────────────────────────────────────────────────────────
test.describe('logistics › routes table', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(LOGISTICS)
    await page.waitForLoadState('networkidle')
  })

  test('renders 5 route rows', async ({ page }) => {
    await expect(page.locator('[data-test="logistics-route-row"]')).toHaveCount(5)
  })

  test('panel header shows chart title + march badge', async ({ page }) => {
    const panel = page.locator('[data-test="logistics-routes"]')
    await expect.soft(panel.locator('.panel-title')).toBeVisible()
    await expect.soft(panel.locator('.panel-badge')).toBeVisible()
  })

  test('table head has 5 columns', async ({ page }) => {
    await expect(page.locator('[data-test="logistics-routes-table"] thead tr th')).toHaveCount(5)
  })

  test('route names are present and non-empty', async ({ page }) => {
    // Labels come from i18n (route_vk / _vr / _vw / _kt / _pl).
    const labels = page.locator('[data-test="logistics-route-row"] td:first-child')
    for (let i = 0; i < 5; i++) {
      await expect.soft(labels.nth(i)).not.toBeEmpty()
    }
  })

  test('trips column renders the expected values', async ({ page }) => {
    // Trips is the 1st .hid-320 cell per row.
    const rows = page.locator('[data-test="logistics-route-row"]')
    await expect.soft(rows.nth(0).locator('td.hid-320').first()).toHaveText('12')
    await expect.soft(rows.nth(1).locator('td.hid-320').first()).toHaveText('8')
    await expect.soft(rows.nth(2).locator('td.hid-320').first()).toHaveText('5')
    await expect.soft(rows.nth(3).locator('td.hid-320').first()).toHaveText('4')
    await expect.soft(rows.nth(4).locator('td.hid-320').first()).toHaveText('5')
  })

  test('load column renders the expected tonnage', async ({ page }) => {
    // Load is the 2nd .hid-320 cell per row.
    const rows = page.locator('[data-test="logistics-route-row"]')
    await expect.soft(rows.nth(0).locator('td.hid-320').nth(1)).toHaveText('8.2')
    await expect.soft(rows.nth(1).locator('td.hid-320').nth(1)).toHaveText('7.1')
    await expect.soft(rows.nth(2).locator('td.hid-320').nth(1)).toHaveText('9.4')
    await expect.soft(rows.nth(3).locator('td.hid-320').nth(1)).toHaveText('4.1')
    await expect.soft(rows.nth(4).locator('td.hid-320').nth(1)).toHaveText('2.3')
  })

  test('revenue column renders the expected formatted euros', async ({ page }) => {
    // Revenue is the 4th <td> per row (route / trips / load / revenue / status).
    const rows = page.locator('[data-test="logistics-route-row"]')
    await expect.soft(rows.nth(0).locator('td').nth(3)).toHaveText('4 800')
    await expect.soft(rows.nth(1).locator('td').nth(3)).toHaveText('3 600')
    await expect.soft(rows.nth(2).locator('td').nth(3)).toHaveText('5 200')
    await expect.soft(rows.nth(3).locator('td').nth(3)).toHaveText('1 200')
    await expect.soft(rows.nth(4).locator('td').nth(3)).toHaveText('400')
  })

  test('status pills use correct semantic classes', async ({ page }) => {
    const pills = page.locator('[data-test="logistics-route-row"] .status-pill')
    await expect.soft(pills.nth(0)).toHaveClass(/\bpill-success\b/)
    await expect.soft(pills.nth(1)).toHaveClass(/\bpill-success\b/)
    await expect.soft(pills.nth(2)).toHaveClass(/\bpill-success\b/)
    await expect.soft(pills.nth(3)).toHaveClass(/\bpill-warning\b/)
    await expect.soft(pills.nth(4)).toHaveClass(/\bpill-danger\b/)
  })

  test('status text is non-empty per row', async ({ page }) => {
    // Labels come from i18n (status_profitable / _breakeven / _loss).
    // Non-empty keeps the assertion locale-agnostic.
    const pills = page.locator('[data-test="logistics-route-row"] .status-pill')
    for (let i = 0; i < 5; i++) {
      await expect.soft(pills.nth(i)).not.toBeEmpty()
    }
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Load-by-week bar chart (chart2 — truck load per week)
// ────────────────────────────────────────────────────────────────────────────
test.describe('logistics › load-by-week chart', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(LOGISTICS)
    await page.waitForLoadState('networkidle')
  })

  test('renders 4 week rows', async ({ page }) => {
    await expect(page.locator('[data-test="logistics-load-row"]')).toHaveCount(4)
  })

  test('panel header shows chart title + march badge', async ({ page }) => {
    const panel = page.locator('[data-test="logistics-load"]')
    await expect.soft(panel.locator('.panel-title')).toBeVisible()
    await expect.soft(panel.locator('.panel-badge')).toBeVisible()
  })

  test('each row has a label, a filled bar, and a value', async ({ page }) => {
    const rows = page.locator('[data-test="logistics-load-row"]')
    for (let i = 0; i < 4; i++) {
      const r = rows.nth(i)
      await expect.soft(r.locator('.bar-label')).toBeVisible()
      await expect.soft(r.locator('.bar-fill')).toBeVisible()
      await expect.soft(r.locator('.bar-val')).toBeVisible()
    }
  })

  test('bar widths match the load distribution (82 / 74 / 69 / 61)', async ({ page }) => {
    const fills = page.locator('[data-test="logistics-load-row"] .bar-fill')
    const widths: number[] = []
    const count = await fills.count()
    for (let i = 0; i < count; i++) {
      const w = await fills.nth(i).evaluate((el) => (el as HTMLElement).style.width)
      widths.push(parseInt(w, 10))
    }
    expect(widths).toEqual([82, 74, 69, 61])
  })

  test('tonnage values are the expected formatted numbers', async ({ page }) => {
    const vals = page.locator('[data-test="logistics-load-row"] .bar-val')
    await expect.soft(vals.nth(0)).toHaveText('8.2 t')
    await expect.soft(vals.nth(1)).toHaveText('7.4 t')
    await expect.soft(vals.nth(2)).toHaveText('6.9 t')
    await expect.soft(vals.nth(3)).toHaveText('6.1 t')
  })

  test('week labels are present and non-empty', async ({ page }) => {
    // Labels come from i18n (week1 / week2 / week3 / week4).
    const labels = page.locator('[data-test="logistics-load-row"] .bar-label')
    for (let i = 0; i < 4; i++) {
      await expect.soft(labels.nth(i)).not.toBeEmpty()
    }
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Page-level feature flag (adminLogistics)
// ────────────────────────────────────────────────────────────────────────────
baseTest(
  'logistics › redirects to /404 when adminLogistics flag is OFF',
  async ({ page, context }) => {
    await context.addInitScript(
      (flags) => localStorage.setItem('ff_overrides', JSON.stringify(flags)),
      { ...ALL_FLAGS_ENABLED, adminLogistics: false },
    )
    await page.goto(LOGISTICS)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/404$/)
    await expect(page.locator('[data-test="logistics-title"]')).toHaveCount(0)
  },
)

// ────────────────────────────────────────────────────────────────────────────
// Per-section visual snapshots (@1440 baseline)
// ────────────────────────────────────────────────────────────────────────────
test.describe('logistics › visual @1440', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(LOGISTICS)
    await waitForFontsReady(page)
    await page.waitForLoadState('networkidle')
  })

  test('sub-nav', async ({ page }) => {
    await expect(page.locator('[data-test="analytics-sub-nav"]')).toHaveScreenshot(
      'logistics-sub-nav.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('kpi row', async ({ page }) => {
    await expect(page.locator('[data-test="logistics-kpi-row"]')).toHaveScreenshot(
      'logistics-kpi-row.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('routes panel', async ({ page }) => {
    await expect(page.locator('[data-test="logistics-routes"]')).toHaveScreenshot(
      'logistics-routes.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('load-by-week panel', async ({ page }) => {
    await expect(page.locator('[data-test="logistics-load"]')).toHaveScreenshot(
      'logistics-load.png',
      SNAPSHOT_OPTIONS,
    )
  })
})
