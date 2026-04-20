import { test as base } from '@playwright/test'
import { test, expect } from '../../fixtures'
import { ALL_FLAGS_ENABLED } from '../../helpers/flags'
import { freezeTime } from '../../helpers/mocks'
import { waitForFontsReady, SNAPSHOT_OPTIONS } from '../../helpers/visual'

/**
 * `baseTest` is the un-fixtured Playwright test, used only by section-flag-OFF
 * cases below. The default `test` export from ../../fixtures installs an init
 * script that forces ALL_FLAGS_ENABLED on every page load — which would undo
 * any flag flip on reload. For the two OFF-case checks we need to install a
 * *different* init script instead.
 */
const baseTest = base

/**
 * Deep audit of DashboardPage (src/views/admin/analytics/DashboardPage.vue).
 *
 * Page shape (all content is hard-coded in the template — no service/composable
 * data fetch yet, so there is nothing to stub with `page.route`):
 *
 *   h1[data-test="dashboard-title"]
 *   <AnalyticsSubNav> → [data-test="analytics-sub-nav"]
 *                         [data-test="analytics-sub-nav-kpi"] (current on this route)
 *                         + 7 siblings (warehouse, sales, supply, staff, logistics, pl, deficit)
 *   [data-test="dashboard-kpi-row"]          ×1  — flex row
 *     [data-test="dashboard-kpi-card"]       ×4  — Warehouse, AR, Sales, Profit
 *   [data-test="dashboard-charts-row"]       ×1  — flex row wrapping both panels
 *     [data-test="dashboard-charts"]         ×1  — v-if showCharts (bar chart panel)
 *       [data-test="dashboard-chart-row"]    ×5  — one per category
 *     [data-test="dashboard-alerts"]         ×1  — v-if showAlerts (alerts table panel)
 *       [data-test="dashboard-alert-row"]    ×5
 *   [data-test="dashboard-analytics-grid"]   ×1
 *     [data-test="dashboard-acard"]          ×7  — 4 top-level + 3 nested in .row2
 *
 * Flags exercised: dashboardAlerts, dashboardCharts (section-level).
 * Both default-ON and fixtures force ALL_FLAGS_ENABLED, so section-flag toggle
 * tests use `setFlag` to flip one flag OFF and verify the section disappears.
 */

const DASHBOARD = '/admin/analytics/dashboard'
const DESKTOP = { width: 1440, height: 900 }

// ────────────────────────────────────────────────────────────────────────────
// Structure
// ────────────────────────────────────────────────────────────────────────────
test.describe('dashboard › structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(DASHBOARD)
    await page.waitForLoadState('networkidle')
  })

  test('title visible', async ({ page }) => {
    await expect(page.locator('[data-test="dashboard-title"]')).toBeVisible()
  })

  test('sub-nav, kpi-row, charts-row, analytics-grid all render', async ({ page }) => {
    await expect.soft(page.locator('[data-test="analytics-sub-nav"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="dashboard-kpi-row"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="dashboard-charts-row"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="dashboard-analytics-grid"]')).toBeVisible()
  })

  test('charts panel is visible (flag ON)', async ({ page }) => {
    await expect(page.locator('[data-test="dashboard-charts"]')).toBeVisible()
  })

  test('alerts panel is visible (flag ON)', async ({ page }) => {
    await expect(page.locator('[data-test="dashboard-alerts"]')).toBeVisible()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// KPI row
// ────────────────────────────────────────────────────────────────────────────
test.describe('dashboard › kpi cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(DASHBOARD)
    await page.waitForLoadState('networkidle')
  })

  test('renders exactly 4 KPI cards', async ({ page }) => {
    await expect(page.locator('[data-test="dashboard-kpi-card"]')).toHaveCount(4)
  })

  test('each card shows label, value (EUR), and delta', async ({ page }) => {
    const cards = page.locator('[data-test="dashboard-kpi-card"]')
    for (let i = 0; i < 4; i++) {
      const c = cards.nth(i)
      await expect.soft(c.locator('.kpi-label')).toBeVisible()
      await expect.soft(c.locator('.kpi-value')).toBeVisible()
      await expect.soft(c.locator('.kpi-delta')).toBeVisible()
      await expect.soft(c.locator('.kpi-value span')).toHaveText('EUR')
    }
  })

  test('values are the expected formatted numbers', async ({ page }) => {
    // Whitespace in the template is a non-breaking-ish mix (ASCII space + NBSP);
    // normalize with `toContainText` on the digits only.
    const values = page.locator('[data-test="dashboard-kpi-card"] .kpi-value')
    await expect.soft(values.nth(0)).toContainText('127')
    await expect.soft(values.nth(0)).toContainText('400')
    await expect.soft(values.nth(1)).toContainText('38')
    await expect.soft(values.nth(1)).toContainText('750')
    await expect.soft(values.nth(2)).toContainText('84')
    await expect.soft(values.nth(2)).toContainText('200')
    await expect.soft(values.nth(3)).toContainText('14')
    await expect.soft(values.nth(3)).toContainText('870')
  })

  test('delta classes communicate direction', async ({ page }) => {
    const deltas = page.locator('[data-test="dashboard-kpi-card"] .kpi-delta')
    await expect.soft(deltas.nth(0)).toHaveClass(/\bup\b/)
    await expect.soft(deltas.nth(1)).toHaveClass(/\bdown\b/)
    await expect.soft(deltas.nth(2)).toHaveClass(/\bup\b/)
    await expect.soft(deltas.nth(3)).toHaveClass(/\bneutral\b/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Sub-nav
// ────────────────────────────────────────────────────────────────────────────
test.describe('dashboard › sub-nav', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(DASHBOARD)
    await page.waitForLoadState('networkidle')
  })

  test('has 8 tabs', async ({ page }) => {
    await expect(page.locator('[data-test="analytics-sub-nav"] a')).toHaveCount(8)
  })

  test('dashboard tab (kpi) is current on this route', async ({ page }) => {
    await expect(page.locator('[data-test="analytics-sub-nav-kpi"]')).toHaveClass(/current/)
  })

  test('other tabs are not marked current', async ({ page }) => {
    await expect
      .soft(page.locator('[data-test="analytics-sub-nav-warehouse"]'))
      .not.toHaveClass(/current/)
    await expect
      .soft(page.locator('[data-test="analytics-sub-nav-sales"]'))
      .not.toHaveClass(/current/)
  })

  test('clicking warehouse tab navigates and swaps current', async ({ page }) => {
    await page.locator('[data-test="analytics-sub-nav-warehouse"]').click()
    await expect(page).toHaveURL('/admin/analytics/warehouse')
    await expect(page.locator('[data-test="analytics-sub-nav-warehouse"]')).toHaveClass(/current/)
    await expect(page.locator('[data-test="analytics-sub-nav-kpi"]')).not.toHaveClass(/current/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Alerts (feature flag: dashboardAlerts)
// ────────────────────────────────────────────────────────────────────────────
test.describe('dashboard › alerts table', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(DASHBOARD)
    await page.waitForLoadState('networkidle')
  })

  test('renders 5 alert rows', async ({ page }) => {
    await expect(page.locator('[data-test="dashboard-alert-row"]')).toHaveCount(5)
  })

  test('each row has type, description, status pill', async ({ page }) => {
    const rows = page.locator('[data-test="dashboard-alert-row"]')
    for (let i = 0; i < 5; i++) {
      const r = rows.nth(i)
      await expect.soft(r.locator('td').nth(0)).not.toBeEmpty()
      await expect.soft(r.locator('td').nth(1)).not.toBeEmpty()
      await expect.soft(r.locator('.status-pill')).toBeVisible()
    }
  })

  test('status pill variants (danger / warning / success) are present', async ({ page }) => {
    const panel = page.locator('[data-test="dashboard-alerts"]')
    await expect.soft(panel.locator('.pill-danger').first()).toBeVisible()
    await expect.soft(panel.locator('.pill-warning').first()).toBeVisible()
    await expect.soft(panel.locator('.pill-success').first()).toBeVisible()
  })
})

baseTest(
  'dashboard › alerts hidden when dashboardAlerts flag is OFF',
  async ({ page, context }) => {
    await context.addInitScript(
      (flags) => localStorage.setItem('ff_overrides', JSON.stringify(flags)),
      { ...ALL_FLAGS_ENABLED, dashboardAlerts: false },
    )
    await page.goto(DASHBOARD)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-test="dashboard-alerts"]')).toHaveCount(0)
    // Sanity: charts panel is unaffected.
    await expect(page.locator('[data-test="dashboard-charts"]')).toBeVisible()
  },
)

// ────────────────────────────────────────────────────────────────────────────
// Charts (feature flag: dashboardCharts)
// ────────────────────────────────────────────────────────────────────────────
test.describe('dashboard › bar chart', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(DASHBOARD)
    await page.waitForLoadState('networkidle')
  })

  test('renders 5 chart rows (one per category)', async ({ page }) => {
    await expect(page.locator('[data-test="dashboard-chart-row"]')).toHaveCount(5)
  })

  test('each row has a label, a filled bar, and a value', async ({ page }) => {
    const rows = page.locator('[data-test="dashboard-chart-row"]')
    for (let i = 0; i < 5; i++) {
      const r = rows.nth(i)
      await expect.soft(r.locator('.bar-label')).toBeVisible()
      await expect.soft(r.locator('.bar-fill')).toBeVisible()
      await expect.soft(r.locator('.bar-val')).toBeVisible()
    }
  })

  test('bar fill has a non-zero width (inline style)', async ({ page }) => {
    const fill = page.locator('[data-test="dashboard-chart-row"] .bar-fill').first()
    const width = await fill.evaluate((el) => (el as HTMLElement).style.width)
    expect(width).toMatch(/^\d+%$/)
    expect(parseInt(width, 10)).toBeGreaterThan(0)
  })
})

baseTest(
  'dashboard › charts hidden when dashboardCharts flag is OFF',
  async ({ page, context }) => {
    await context.addInitScript(
      (flags) => localStorage.setItem('ff_overrides', JSON.stringify(flags)),
      { ...ALL_FLAGS_ENABLED, dashboardCharts: false },
    )
    await page.goto(DASHBOARD)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-test="dashboard-charts"]')).toHaveCount(0)
    // Sanity: alerts panel is unaffected.
    await expect(page.locator('[data-test="dashboard-alerts"]')).toBeVisible()
  },
)

// ────────────────────────────────────────────────────────────────────────────
// Analytics grid (preview cards → other analytics pages)
// ────────────────────────────────────────────────────────────────────────────
test.describe('dashboard › analytics grid', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(DASHBOARD)
    await page.waitForLoadState('networkidle')
  })

  test('renders 7 preview cards', async ({ page }) => {
    await expect(page.locator('[data-test="dashboard-acard"]')).toHaveCount(7)
  })

  test('each card links to an /admin/analytics/ route', async ({ page }) => {
    const cards = page.locator('[data-test="dashboard-acard"]')
    const count = await cards.count()
    for (let i = 0; i < count; i++) {
      const href = await cards.nth(i).getAttribute('href')
      expect.soft(href, `card ${i} href`).toMatch(/^\/admin\/analytics\//)
    }
  })

  test('warehouse card navigates to /admin/analytics/warehouse', async ({ page }) => {
    await page.locator('[data-test="dashboard-acard"]').first().click()
    await expect(page).toHaveURL('/admin/analytics/warehouse')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Per-section visual snapshots (@1440 baseline)
// ────────────────────────────────────────────────────────────────────────────
test.describe('dashboard › visual @1440', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(DASHBOARD)
    await waitForFontsReady(page)
    await page.waitForLoadState('networkidle')
  })

  test('sub-nav', async ({ page }) => {
    await expect(page.locator('[data-test="analytics-sub-nav"]')).toHaveScreenshot(
      'dashboard-sub-nav.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('kpi row', async ({ page }) => {
    await expect(page.locator('[data-test="dashboard-kpi-row"]')).toHaveScreenshot(
      'dashboard-kpi-row.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('charts panel', async ({ page }) => {
    await expect(page.locator('[data-test="dashboard-charts"]')).toHaveScreenshot(
      'dashboard-charts.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('alerts panel', async ({ page }) => {
    await expect(page.locator('[data-test="dashboard-alerts"]')).toHaveScreenshot(
      'dashboard-alerts.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('analytics grid', async ({ page }) => {
    await expect(page.locator('[data-test="dashboard-analytics-grid"]')).toHaveScreenshot(
      'dashboard-analytics-grid.png',
      SNAPSHOT_OPTIONS,
    )
  })
})
