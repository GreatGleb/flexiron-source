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
 * Deep audit of SupplyPage (src/views/admin/analytics/SupplyPage.vue).
 *
 * Page shape — all content is hard-coded in the template (no composable / no
 * service fetch yet, so there is nothing to stub with `page.route`):
 *
 *   h1[data-test="supply-title"]
 *   <AnalyticsSubNav> → [data-test="analytics-sub-nav"]
 *                         [data-test="analytics-sub-nav-supply"] (current on this route)
 *                         + 7 siblings (kpi, warehouse, sales, staff, logistics, pl, deficit)
 *   [data-test="supply-kpi-row"]                 ×1
 *     [data-test="supply-kpi-card"]              ×4  — Purchased (EUR, neutral),
 *                                                     On-time delivery (%, up),
 *                                                     Late deliveries (pcs., down),
 *                                                     Price growth (%, down)
 *   [data-test="supply-charts-row"]              ×1  — flex row wrapping both panels
 *     [data-test="supply-suppliers"]             ×1  — glass-panel, supplier reliability table
 *       [data-test="supply-suppliers-table"]     ×1  — <table class="data-table">
 *         [data-test="supply-supplier-row"]      ×4  — Metalis LT / ArcelorMittal /
 *                                                     StalProm LLC / SIA BalticMetal
 *     [data-test="supply-categories"]            ×1  — glass-panel, price-growth per category
 *       [data-test="supply-category-row"]        ×4  — pipe / sheet / angle / stainless
 *
 * Flags exercised: page-level `adminSupply`. No section-level flags on this page.
 */

const SUPPLY = '/admin/analytics/supply'
const DESKTOP = { width: 1440, height: 900 }

// ────────────────────────────────────────────────────────────────────────────
// Structure
// ────────────────────────────────────────────────────────────────────────────
test.describe('supply › structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(SUPPLY)
    await page.waitForLoadState('networkidle')
  })

  test('title visible', async ({ page }) => {
    await expect(page.locator('[data-test="supply-title"]')).toBeVisible()
  })

  test('sub-nav, kpi-row, charts-row, both panels all render', async ({ page }) => {
    await expect.soft(page.locator('[data-test="analytics-sub-nav"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supply-kpi-row"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supply-charts-row"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supply-suppliers"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supply-categories"]')).toBeVisible()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// KPI row
// ────────────────────────────────────────────────────────────────────────────
test.describe('supply › kpi cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(SUPPLY)
    await page.waitForLoadState('networkidle')
  })

  test('renders exactly 4 KPI cards', async ({ page }) => {
    await expect(page.locator('[data-test="supply-kpi-card"]')).toHaveCount(4)
  })

  test('each card shows label, value, and delta', async ({ page }) => {
    const cards = page.locator('[data-test="supply-kpi-card"]')
    for (let i = 0; i < 4; i++) {
      const c = cards.nth(i)
      await expect.soft(c.locator('.kpi-label')).toBeVisible()
      await expect.soft(c.locator('.kpi-value')).toBeVisible()
      await expect.soft(c.locator('.kpi-delta')).toBeVisible()
    }
  })

  test('per-card unit suffixes (EUR / % / pcs. / %)', async ({ page }) => {
    // Units are hard-coded in the template — one per card in that order.
    const units = page.locator('[data-test="supply-kpi-card"] .kpi-value span')
    await expect.soft(units.nth(0)).toHaveText('EUR')
    await expect.soft(units.nth(1)).toHaveText('%')
    await expect.soft(units.nth(2)).toHaveText('pcs.')
    await expect.soft(units.nth(3)).toHaveText('%')
  })

  test('values are the expected formatted numbers', async ({ page }) => {
    const values = page.locator('[data-test="supply-kpi-card"] .kpi-value')
    await expect.soft(values.nth(0)).toContainText('58')
    await expect.soft(values.nth(0)).toContainText('200')
    await expect.soft(values.nth(1)).toContainText('84')
    await expect.soft(values.nth(2)).toContainText('3')
    await expect.soft(values.nth(3)).toContainText('+4.2')
  })

  test('delta classes communicate direction', async ({ page }) => {
    const deltas = page.locator('[data-test="supply-kpi-card"] .kpi-delta')
    await expect.soft(deltas.nth(0)).toHaveClass(/\bneutral\b/)
    await expect.soft(deltas.nth(1)).toHaveClass(/\bup\b/)
    await expect.soft(deltas.nth(2)).toHaveClass(/\bdown\b/)
    await expect.soft(deltas.nth(3)).toHaveClass(/\bdown\b/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Sub-nav
// ────────────────────────────────────────────────────────────────────────────
test.describe('supply › sub-nav', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(SUPPLY)
    await page.waitForLoadState('networkidle')
  })

  test('has 8 tabs', async ({ page }) => {
    await expect(page.locator('[data-test="analytics-sub-nav"] a')).toHaveCount(8)
  })

  test('supply tab is current on this route', async ({ page }) => {
    await expect(page.locator('[data-test="analytics-sub-nav-supply"]')).toHaveClass(/current/)
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
      .soft(page.locator('[data-test="analytics-sub-nav-deficit"]'))
      .not.toHaveClass(/current/)
  })

  test('clicking kpi tab navigates back to dashboard and swaps current', async ({ page }) => {
    await page.locator('[data-test="analytics-sub-nav-kpi"]').click()
    await expect(page).toHaveURL('/admin/analytics/dashboard')
    await expect(page.locator('[data-test="analytics-sub-nav-kpi"]')).toHaveClass(/current/)
    await expect(page.locator('[data-test="analytics-sub-nav-supply"]')).not.toHaveClass(/current/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Supplier reliability table
// ────────────────────────────────────────────────────────────────────────────
test.describe('supply › suppliers table', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(SUPPLY)
    await page.waitForLoadState('networkidle')
  })

  test('renders 4 supplier rows', async ({ page }) => {
    await expect(page.locator('[data-test="supply-supplier-row"]')).toHaveCount(4)
  })

  test('panel header shows chart title + march badge', async ({ page }) => {
    const panel = page.locator('[data-test="supply-suppliers"]')
    await expect.soft(panel.locator('.panel-title')).toBeVisible()
    await expect.soft(panel.locator('.panel-badge')).toBeVisible()
  })

  test('table head has 4 columns', async ({ page }) => {
    await expect(page.locator('[data-test="supply-suppliers-table"] thead tr th')).toHaveCount(4)
  })

  test('supplier names are the expected hard-coded set', async ({ page }) => {
    const rows = page.locator('[data-test="supply-supplier-row"]')
    await expect.soft(rows.nth(0).locator('td').first()).toHaveText('Metalis LT')
    await expect.soft(rows.nth(1).locator('td').first()).toHaveText('ArcelorMittal')
    await expect.soft(rows.nth(2).locator('td').first()).toHaveText('StalProm LLC')
    await expect.soft(rows.nth(3).locator('td').first()).toHaveText('SIA BalticMetal')
  })

  test('deliveries count column renders expected values', async ({ page }) => {
    const rows = page.locator('[data-test="supply-supplier-row"]')
    await expect.soft(rows.nth(0).locator('td.hid-320')).toHaveText('8')
    await expect.soft(rows.nth(1).locator('td.hid-320')).toHaveText('5')
    await expect.soft(rows.nth(2).locator('td.hid-320')).toHaveText('6')
    await expect.soft(rows.nth(3).locator('td.hid-320')).toHaveText('4')
  })

  test('on-time percentage column renders expected values', async ({ page }) => {
    // The on-time column is the 3rd <td> in each row (after supplier name + deliveries).
    const rows = page.locator('[data-test="supply-supplier-row"]')
    await expect.soft(rows.nth(0).locator('td').nth(2)).toHaveText('87%')
    await expect.soft(rows.nth(1).locator('td').nth(2)).toHaveText('100%')
    await expect.soft(rows.nth(2).locator('td').nth(2)).toHaveText('50%')
    await expect.soft(rows.nth(3).locator('td').nth(2)).toHaveText('75%')
  })

  test('status pills use correct semantic classes', async ({ page }) => {
    const pills = page.locator('[data-test="supply-supplier-row"] .status-pill')
    await expect.soft(pills.nth(0)).toHaveClass(/\bpill-success\b/)
    await expect.soft(pills.nth(1)).toHaveClass(/\bpill-success\b/)
    await expect.soft(pills.nth(2)).toHaveClass(/\bpill-danger\b/)
    await expect.soft(pills.nth(3)).toHaveClass(/\bpill-warning\b/)
  })

  test('status text matches pill semantics', async ({ page }) => {
    // Reliable suppliers share one label, risky / monitored are distinct —
    // assert via non-empty visible text per row rather than hard-coding RU/EN/LT.
    const pills = page.locator('[data-test="supply-supplier-row"] .status-pill')
    for (let i = 0; i < 4; i++) {
      await expect.soft(pills.nth(i)).not.toBeEmpty()
    }
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Categories price-growth bar chart
// ────────────────────────────────────────────────────────────────────────────
test.describe('supply › categories chart', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(SUPPLY)
    await page.waitForLoadState('networkidle')
  })

  test('renders 4 category rows', async ({ page }) => {
    await expect(page.locator('[data-test="supply-category-row"]')).toHaveCount(4)
  })

  test('panel header shows chart title + q1 badge', async ({ page }) => {
    const panel = page.locator('[data-test="supply-categories"]')
    await expect.soft(panel.locator('.panel-title')).toBeVisible()
    await expect.soft(panel.locator('.panel-badge')).toBeVisible()
  })

  test('each row has a label, a filled bar, and a value', async ({ page }) => {
    const rows = page.locator('[data-test="supply-category-row"]')
    for (let i = 0; i < 4; i++) {
      const r = rows.nth(i)
      await expect.soft(r.locator('.bar-label')).toBeVisible()
      await expect.soft(r.locator('.bar-fill')).toBeVisible()
      await expect.soft(r.locator('.bar-val')).toBeVisible()
    }
  })

  test('bar widths match the price-growth distribution (72 / 45 / 30 / 90)', async ({ page }) => {
    const fills = page.locator('[data-test="supply-category-row"] .bar-fill')
    const widths: number[] = []
    const count = await fills.count()
    for (let i = 0; i < count; i++) {
      const w = await fills.nth(i).evaluate((el) => (el as HTMLElement).style.width)
      widths.push(parseInt(w, 10))
    }
    expect(widths).toEqual([72, 45, 30, 90])
  })

  test('percentage values are the expected formatted numbers', async ({ page }) => {
    const vals = page.locator('[data-test="supply-category-row"] .bar-val')
    await expect.soft(vals.nth(0)).toHaveText('+5.1%')
    await expect.soft(vals.nth(1)).toHaveText('+2.8%')
    await expect.soft(vals.nth(2)).toHaveText('+1.9%')
    await expect.soft(vals.nth(3)).toHaveText('+9.3%')
  })

  test('category labels are present and non-empty', async ({ page }) => {
    // Labels come from i18n (cat_pipe / cat_sheet / cat_angle / cat_stainless).
    // Asserting non-empty keeps the test locale-agnostic.
    const labels = page.locator('[data-test="supply-category-row"] .bar-label')
    for (let i = 0; i < 4; i++) {
      await expect.soft(labels.nth(i)).not.toBeEmpty()
    }
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Page-level feature flag (adminSupply)
// ────────────────────────────────────────────────────────────────────────────
baseTest('supply › redirects to /404 when adminSupply flag is OFF', async ({ page, context }) => {
  await context.addInitScript(
    (flags) => localStorage.setItem('ff_overrides', JSON.stringify(flags)),
    { ...ALL_FLAGS_ENABLED, adminSupply: false },
  )
  await page.goto(SUPPLY)
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/\/404$/)
  await expect(page.locator('[data-test="supply-title"]')).toHaveCount(0)
})

// ────────────────────────────────────────────────────────────────────────────
// Per-section visual snapshots (@1440 baseline)
// ────────────────────────────────────────────────────────────────────────────
test.describe('supply › visual @1440', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(SUPPLY)
    await waitForFontsReady(page)
    await page.waitForLoadState('networkidle')
  })

  test('sub-nav', async ({ page }) => {
    await expect(page.locator('[data-test="analytics-sub-nav"]')).toHaveScreenshot(
      'supply-sub-nav.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('kpi row', async ({ page }) => {
    await expect(page.locator('[data-test="supply-kpi-row"]')).toHaveScreenshot(
      'supply-kpi-row.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('suppliers panel', async ({ page }) => {
    await expect(page.locator('[data-test="supply-suppliers"]')).toHaveScreenshot(
      'supply-suppliers.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('categories panel', async ({ page }) => {
    await expect(page.locator('[data-test="supply-categories"]')).toHaveScreenshot(
      'supply-categories.png',
      SNAPSHOT_OPTIONS,
    )
  })
})
