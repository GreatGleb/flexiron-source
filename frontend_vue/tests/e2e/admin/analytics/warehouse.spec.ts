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
 * Deep audit of WarehousePage (src/views/admin/analytics/WarehousePage.vue).
 *
 * Page shape — all content is hard-coded in the template (no composable / no
 * service fetch yet, so there is nothing to stub with `page.route`):
 *
 *   h1[data-test="warehouse-title"]
 *   <AnalyticsSubNav> → [data-test="analytics-sub-nav"]
 *                         [data-test="analytics-sub-nav-warehouse"] (current on this route)
 *                         + 7 siblings (kpi, sales, supply, staff, logistics, pl, deficit)
 *   [data-test="warehouse-kpi-row"]            ×1
 *     [data-test="warehouse-kpi-card"]         ×4  — Stock value (EUR), Deadstock (items),
 *                                                   Turnover (days), Scrap % (%)
 *   [data-test="warehouse-charts-row"]         ×1  — flex row wrapping both panels
 *     [data-test="warehouse-deadstock"]        ×1  — glass-panel, illiquid-items table
 *       [data-test="warehouse-deadstock-row"]  ×5
 *     [data-test="warehouse-turnover"]         ×1  — glass-panel, turnover bar chart
 *       [data-test="warehouse-chart-row"]      ×5  — one per category
 *
 * Flags exercised: page-level `adminWarehouse`. No section-level flags on this page
 * (unlike DashboardPage), so there are no in-page toggle tests.
 */

const WAREHOUSE = '/admin/analytics/warehouse'
const DESKTOP = { width: 1440, height: 900 }

// ────────────────────────────────────────────────────────────────────────────
// Structure
// ────────────────────────────────────────────────────────────────────────────
test.describe('warehouse › structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(WAREHOUSE)
    await page.waitForLoadState('networkidle')
  })

  test('title visible', async ({ page }) => {
    await expect(page.locator('[data-test="warehouse-title"]')).toBeVisible()
  })

  test('sub-nav, kpi-row, charts-row, both panels all render', async ({ page }) => {
    await expect.soft(page.locator('[data-test="analytics-sub-nav"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="warehouse-kpi-row"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="warehouse-charts-row"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="warehouse-deadstock"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="warehouse-turnover"]')).toBeVisible()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// KPI row
// ────────────────────────────────────────────────────────────────────────────
test.describe('warehouse › kpi cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(WAREHOUSE)
    await page.waitForLoadState('networkidle')
  })

  test('renders exactly 4 KPI cards', async ({ page }) => {
    await expect(page.locator('[data-test="warehouse-kpi-card"]')).toHaveCount(4)
  })

  test('each card shows label, value, and delta', async ({ page }) => {
    const cards = page.locator('[data-test="warehouse-kpi-card"]')
    for (let i = 0; i < 4; i++) {
      const c = cards.nth(i)
      await expect.soft(c.locator('.kpi-label')).toBeVisible()
      await expect.soft(c.locator('.kpi-value')).toBeVisible()
      await expect.soft(c.locator('.kpi-delta')).toBeVisible()
    }
  })

  test('per-card unit suffixes (EUR / items / days / %)', async ({ page }) => {
    // Units are hard-coded in the template — one per card in that order.
    const units = page.locator('[data-test="warehouse-kpi-card"] .kpi-value span')
    await expect.soft(units.nth(0)).toHaveText('EUR')
    await expect.soft(units.nth(1)).toHaveText('items')
    await expect.soft(units.nth(2)).toHaveText('days')
    await expect.soft(units.nth(3)).toHaveText('%')
  })

  test('values are the expected formatted numbers', async ({ page }) => {
    const values = page.locator('[data-test="warehouse-kpi-card"] .kpi-value')
    await expect.soft(values.nth(0)).toContainText('127')
    await expect.soft(values.nth(0)).toContainText('400')
    await expect.soft(values.nth(1)).toContainText('12')
    await expect.soft(values.nth(2)).toContainText('38')
    await expect.soft(values.nth(3)).toContainText('8.4')
  })

  test('delta classes communicate direction', async ({ page }) => {
    const deltas = page.locator('[data-test="warehouse-kpi-card"] .kpi-delta')
    await expect.soft(deltas.nth(0)).toHaveClass(/\bup\b/)
    await expect.soft(deltas.nth(1)).toHaveClass(/\bdown\b/)
    await expect.soft(deltas.nth(2)).toHaveClass(/\bneutral\b/)
    await expect.soft(deltas.nth(3)).toHaveClass(/\bup\b/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Sub-nav
// ────────────────────────────────────────────────────────────────────────────
test.describe('warehouse › sub-nav', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(WAREHOUSE)
    await page.waitForLoadState('networkidle')
  })

  test('has 8 tabs', async ({ page }) => {
    await expect(page.locator('[data-test="analytics-sub-nav"] a')).toHaveCount(8)
  })

  test('warehouse tab is current on this route', async ({ page }) => {
    await expect(page.locator('[data-test="analytics-sub-nav-warehouse"]')).toHaveClass(/current/)
  })

  test('other tabs are not marked current', async ({ page }) => {
    await expect
      .soft(page.locator('[data-test="analytics-sub-nav-kpi"]'))
      .not.toHaveClass(/current/)
    await expect
      .soft(page.locator('[data-test="analytics-sub-nav-sales"]'))
      .not.toHaveClass(/current/)
    await expect
      .soft(page.locator('[data-test="analytics-sub-nav-deficit"]'))
      .not.toHaveClass(/current/)
  })

  test('clicking kpi tab navigates back to dashboard and swaps current', async ({ page }) => {
    await page.locator('[data-test="analytics-sub-nav-kpi"]').click()
    await expect(page).toHaveURL('/admin/analytics/dashboard')
    await expect(page.locator('[data-test="analytics-sub-nav-kpi"]')).toHaveClass(/current/)
    await expect(page.locator('[data-test="analytics-sub-nav-warehouse"]')).not.toHaveClass(
      /current/,
    )
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Deadstock table
// ────────────────────────────────────────────────────────────────────────────
test.describe('warehouse › deadstock table', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(WAREHOUSE)
    await page.waitForLoadState('networkidle')
  })

  test('renders 5 deadstock rows', async ({ page }) => {
    await expect(page.locator('[data-test="warehouse-deadstock-row"]')).toHaveCount(5)
  })

  test('has 4 column headers', async ({ page }) => {
    await expect(page.locator('[data-test="warehouse-deadstock"] thead th')).toHaveCount(4)
  })

  test('each row has item, zone, sum, age pill', async ({ page }) => {
    const rows = page.locator('[data-test="warehouse-deadstock-row"]')
    for (let i = 0; i < 5; i++) {
      const r = rows.nth(i)
      await expect.soft(r.locator('td').nth(0)).not.toBeEmpty()
      await expect.soft(r.locator('td').nth(1)).not.toBeEmpty()
      await expect.soft(r.locator('td').nth(2)).not.toBeEmpty()
      await expect.soft(r.locator('.status-pill')).toBeVisible()
    }
  })

  test('first row shows hard-coded "Sheet 2×1000×2000" / zone A2 / 4 200', async ({ page }) => {
    const first = page.locator('[data-test="warehouse-deadstock-row"]').nth(0)
    await expect.soft(first.locator('td').nth(0)).toHaveText('Sheet 2×1000×2000')
    await expect.soft(first.locator('td').nth(1)).toHaveText('A2')
    await expect.soft(first.locator('td').nth(2)).toHaveText('4 200')
  })

  test('status pill variants (danger / warning / success) are all present', async ({ page }) => {
    const panel = page.locator('[data-test="warehouse-deadstock"]')
    await expect.soft(panel.locator('.pill-danger').first()).toBeVisible()
    await expect.soft(panel.locator('.pill-warning').first()).toBeVisible()
    await expect.soft(panel.locator('.pill-success').first()).toBeVisible()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Turnover bar chart
// ────────────────────────────────────────────────────────────────────────────
test.describe('warehouse › turnover chart', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(WAREHOUSE)
    await page.waitForLoadState('networkidle')
  })

  test('renders 5 chart rows (one per category)', async ({ page }) => {
    await expect(page.locator('[data-test="warehouse-chart-row"]')).toHaveCount(5)
  })

  test('each row has a label, a filled bar, and a value', async ({ page }) => {
    const rows = page.locator('[data-test="warehouse-chart-row"]')
    for (let i = 0; i < 5; i++) {
      const r = rows.nth(i)
      await expect.soft(r.locator('.bar-label')).toBeVisible()
      await expect.soft(r.locator('.bar-fill')).toBeVisible()
      await expect.soft(r.locator('.bar-val')).toBeVisible()
    }
  })

  test('bar fills all have non-zero widths (inline style)', async ({ page }) => {
    const rows = page.locator('[data-test="warehouse-chart-row"]')
    const count = await rows.count()
    for (let i = 0; i < count; i++) {
      const width = await rows
        .nth(i)
        .locator('.bar-fill')
        .evaluate((el) => (el as HTMLElement).style.width)
      expect.soft(width, `row ${i} bar-fill width`).toMatch(/^\d+%$/)
      expect.soft(parseInt(width, 10), `row ${i} bar-fill numeric`).toBeGreaterThan(0)
    }
  })

  test('bar widths decrease monotonically (85 → 65 → 50 → 35 → 20)', async ({ page }) => {
    // Worst turnover is last in the template, so widths should be non-increasing.
    const fills = page.locator('[data-test="warehouse-chart-row"] .bar-fill')
    const widths: number[] = []
    const count = await fills.count()
    for (let i = 0; i < count; i++) {
      const w = await fills.nth(i).evaluate((el) => (el as HTMLElement).style.width)
      widths.push(parseInt(w, 10))
    }
    expect(widths).toEqual([85, 65, 50, 35, 20])
  })

  test('values are the expected day counts', async ({ page }) => {
    const vals = page.locator('[data-test="warehouse-chart-row"] .bar-val')
    await expect.soft(vals.nth(0)).toHaveText('22 days')
    await expect.soft(vals.nth(1)).toHaveText('31 day')
    await expect.soft(vals.nth(2)).toHaveText('38 days')
    await expect.soft(vals.nth(3)).toHaveText('54 days')
    await expect.soft(vals.nth(4)).toHaveText('78 days')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Page-level feature flag (adminWarehouse)
// ────────────────────────────────────────────────────────────────────────────
baseTest(
  'warehouse › redirects to /404 when adminWarehouse flag is OFF',
  async ({ page, context }) => {
    await context.addInitScript(
      (flags) => localStorage.setItem('ff_overrides', JSON.stringify(flags)),
      { ...ALL_FLAGS_ENABLED, adminWarehouse: false },
    )
    await page.goto(WAREHOUSE)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/404$/)
    await expect(page.locator('[data-test="warehouse-title"]')).toHaveCount(0)
  },
)

// ────────────────────────────────────────────────────────────────────────────
// Per-section visual snapshots (@1440 baseline)
// ────────────────────────────────────────────────────────────────────────────
test.describe('warehouse › visual @1440', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(WAREHOUSE)
    await waitForFontsReady(page)
    await page.waitForLoadState('networkidle')
  })

  test('sub-nav', async ({ page }) => {
    await expect(page.locator('[data-test="analytics-sub-nav"]')).toHaveScreenshot(
      'warehouse-sub-nav.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('kpi row', async ({ page }) => {
    await expect(page.locator('[data-test="warehouse-kpi-row"]')).toHaveScreenshot(
      'warehouse-kpi-row.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('deadstock panel', async ({ page }) => {
    await expect(page.locator('[data-test="warehouse-deadstock"]')).toHaveScreenshot(
      'warehouse-deadstock.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('turnover panel', async ({ page }) => {
    await expect(page.locator('[data-test="warehouse-turnover"]')).toHaveScreenshot(
      'warehouse-turnover.png',
      SNAPSHOT_OPTIONS,
    )
  })
})
