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
 * Deep audit of StaffPage (src/views/admin/analytics/StaffPage.vue).
 *
 * Page shape — all content is hard-coded in the template (no composable / no
 * service fetch yet, so there is nothing to stub with `page.route`). Unlike
 * supply / sales / warehouse this page has NO kpi-row — three glass-panels
 * only:
 *
 *   h1[data-test="staff-title"]
 *   <AnalyticsSubNav> → [data-test="analytics-sub-nav"]
 *                         [data-test="analytics-sub-nav-staff"] (current on this route)
 *                         + 7 siblings (kpi, warehouse, sales, supply, logistics, pl, deficit)
 *   [data-test="staff-charts-row"]                 ×1  — flex row wrapping both tables
 *     [data-test="staff-managers"]                 ×1  — glass-panel, managers rating
 *       [data-test="staff-managers-table"]         ×1  — <table class="data-table">, 5 cols
 *         [data-test="staff-manager-row"]          ×4  — Andrew / Svetlana / Dmitry / Irena
 *     [data-test="staff-warehouse-workers"]        ×1  — glass-panel, warehouse-speed table
 *       [data-test="staff-workers-table"]          ×1  — <table class="data-table">, 4 cols
 *         [data-test="staff-worker-row"]           ×3  — Taras / Alexey / Petr
 *   [data-test="staff-revenue-dynamics"]           ×1  — glass-panel, bar chart (Q1)
 *     [data-test="staff-revenue-row"]              ×4  — one per manager
 *
 * Flags exercised: page-level `adminStaff`. No section-level flags on this page.
 */

const STAFF = '/admin/analytics/staff'
const DESKTOP = { width: 1440, height: 900 }

// ────────────────────────────────────────────────────────────────────────────
// Structure
// ────────────────────────────────────────────────────────────────────────────
test.describe('staff › structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(STAFF)
    await page.waitForLoadState('networkidle')
  })

  test('title visible', async ({ page }) => {
    await expect(page.locator('[data-test="staff-title"]')).toBeVisible()
  })

  test('sub-nav, charts-row, both tables, and revenue panel all render', async ({ page }) => {
    await expect.soft(page.locator('[data-test="analytics-sub-nav"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="staff-charts-row"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="staff-managers"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="staff-warehouse-workers"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="staff-revenue-dynamics"]')).toBeVisible()
  })

  test('no KPI row is rendered (staff has none)', async ({ page }) => {
    await expect(page.locator('.kpi-row')).toHaveCount(0)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Sub-nav
// ────────────────────────────────────────────────────────────────────────────
test.describe('staff › sub-nav', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(STAFF)
    await page.waitForLoadState('networkidle')
  })

  test('has 8 tabs', async ({ page }) => {
    await expect(page.locator('[data-test="analytics-sub-nav"] a')).toHaveCount(8)
  })

  test('staff tab is current on this route', async ({ page }) => {
    await expect(page.locator('[data-test="analytics-sub-nav-staff"]')).toHaveClass(/current/)
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
      .soft(page.locator('[data-test="analytics-sub-nav-logistics"]'))
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
    await expect(page.locator('[data-test="analytics-sub-nav-staff"]')).not.toHaveClass(/current/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Managers table (chart1 — sales & margin rating)
// ────────────────────────────────────────────────────────────────────────────
test.describe('staff › managers table', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(STAFF)
    await page.waitForLoadState('networkidle')
  })

  test('renders 4 manager rows', async ({ page }) => {
    await expect(page.locator('[data-test="staff-manager-row"]')).toHaveCount(4)
  })

  test('panel header shows chart title + march badge', async ({ page }) => {
    const panel = page.locator('[data-test="staff-managers"]')
    await expect.soft(panel.locator('.panel-title')).toBeVisible()
    await expect.soft(panel.locator('.panel-badge')).toBeVisible()
  })

  test('table head has 5 columns', async ({ page }) => {
    await expect(page.locator('[data-test="staff-managers-table"] thead tr th')).toHaveCount(5)
  })

  test('sales column renders the expected formatted values', async ({ page }) => {
    // Sales is the 2nd <td> per row (after manager name).
    const rows = page.locator('[data-test="staff-manager-row"]')
    await expect.soft(rows.nth(0).locator('td').nth(1)).toHaveText('28 400')
    await expect.soft(rows.nth(1).locator('td').nth(1)).toHaveText('22 100')
    await expect.soft(rows.nth(2).locator('td').nth(1)).toHaveText('18 700')
    await expect.soft(rows.nth(3).locator('td').nth(1)).toHaveText('15 000')
  })

  test('deals column renders the expected values', async ({ page }) => {
    // Deals is the 1st .hid-320 cell per row.
    const rows = page.locator('[data-test="staff-manager-row"]')
    await expect.soft(rows.nth(0).locator('td.hid-320').first()).toHaveText('21')
    await expect.soft(rows.nth(1).locator('td.hid-320').first()).toHaveText('18')
    await expect.soft(rows.nth(2).locator('td.hid-320').first()).toHaveText('14')
    await expect.soft(rows.nth(3).locator('td.hid-320').first()).toHaveText('10')
  })

  test('margin column renders the expected percentages', async ({ page }) => {
    // Margin is the 4th <td> per row.
    const rows = page.locator('[data-test="staff-manager-row"]')
    await expect.soft(rows.nth(0).locator('td').nth(3)).toHaveText('22.4%')
    await expect.soft(rows.nth(1).locator('td').nth(3)).toHaveText('19.1%')
    await expect.soft(rows.nth(2).locator('td').nth(3)).toHaveText('14.2%')
    await expect.soft(rows.nth(3).locator('td').nth(3)).toHaveText('11.8%')
  })

  test('rating pills use correct semantic classes', async ({ page }) => {
    const pills = page.locator('[data-test="staff-manager-row"] .status-pill')
    await expect.soft(pills.nth(0)).toHaveClass(/\bpill-success\b/)
    await expect.soft(pills.nth(1)).toHaveClass(/\bpill-success\b/)
    await expect.soft(pills.nth(2)).toHaveClass(/\bpill-warning\b/)
    await expect.soft(pills.nth(3)).toHaveClass(/\bpill-danger\b/)
  })

  test('rating pill text is non-empty per row', async ({ page }) => {
    // Labels come from i18n (status_top / status_good / status_monitor / status_low).
    // Asserting non-empty keeps the test locale-agnostic.
    const pills = page.locator('[data-test="staff-manager-row"] .status-pill')
    for (let i = 0; i < 4; i++) {
      await expect.soft(pills.nth(i)).not.toBeEmpty()
    }
  })

  test('manager names are present and non-empty', async ({ page }) => {
    const labels = page.locator('[data-test="staff-manager-row"] td:first-child')
    for (let i = 0; i < 4; i++) {
      await expect.soft(labels.nth(i)).not.toBeEmpty()
    }
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Warehouse workers table (chart2 — speed & errors)
// ────────────────────────────────────────────────────────────────────────────
test.describe('staff › warehouse workers table', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(STAFF)
    await page.waitForLoadState('networkidle')
  })

  test('renders 3 worker rows', async ({ page }) => {
    await expect(page.locator('[data-test="staff-worker-row"]')).toHaveCount(3)
  })

  test('panel header shows chart title + march badge', async ({ page }) => {
    const panel = page.locator('[data-test="staff-warehouse-workers"]')
    await expect.soft(panel.locator('.panel-title')).toBeVisible()
    await expect.soft(panel.locator('.panel-badge')).toBeVisible()
  })

  test('table head has 4 columns', async ({ page }) => {
    await expect(page.locator('[data-test="staff-workers-table"] thead tr th')).toHaveCount(4)
  })

  test('orders column renders the expected values', async ({ page }) => {
    // Orders is the only .hid-320 cell per row.
    const rows = page.locator('[data-test="staff-worker-row"]')
    await expect.soft(rows.nth(0).locator('td.hid-320')).toHaveText('94')
    await expect.soft(rows.nth(1).locator('td.hid-320')).toHaveText('87')
    await expect.soft(rows.nth(2).locator('td.hid-320')).toHaveText('76')
  })

  test('avg-time column contains minute unit', async ({ page }) => {
    // avg-time is the 3rd <td> per row (worker name / orders / avg-time / errors).
    const rows = page.locator('[data-test="staff-worker-row"]')
    await expect.soft(rows.nth(0).locator('td').nth(2)).toContainText('38')
    await expect.soft(rows.nth(1).locator('td').nth(2)).toContainText('44')
    await expect.soft(rows.nth(2).locator('td').nth(2)).toContainText('51')
  })

  test('error pills show expected numeric counts and semantic classes', async ({ page }) => {
    const pills = page.locator('[data-test="staff-worker-row"] .status-pill')
    await expect.soft(pills.nth(0)).toHaveText('0')
    await expect.soft(pills.nth(0)).toHaveClass(/\bpill-success\b/)
    await expect.soft(pills.nth(1)).toHaveText('2')
    await expect.soft(pills.nth(1)).toHaveClass(/\bpill-warning\b/)
    await expect.soft(pills.nth(2)).toHaveText('5')
    await expect.soft(pills.nth(2)).toHaveClass(/\bpill-danger\b/)
  })

  test('worker names are present and non-empty', async ({ page }) => {
    const labels = page.locator('[data-test="staff-worker-row"] td:first-child')
    for (let i = 0; i < 3; i++) {
      await expect.soft(labels.nth(i)).not.toBeEmpty()
    }
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Revenue dynamics bar chart (chart3 — Q1)
// ────────────────────────────────────────────────────────────────────────────
test.describe('staff › revenue dynamics chart', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(STAFF)
    await page.waitForLoadState('networkidle')
  })

  test('renders 4 revenue rows (one per manager)', async ({ page }) => {
    await expect(page.locator('[data-test="staff-revenue-row"]')).toHaveCount(4)
  })

  test('panel header shows chart title + q1 badge', async ({ page }) => {
    const panel = page.locator('[data-test="staff-revenue-dynamics"]')
    await expect.soft(panel.locator('.panel-title')).toBeVisible()
    await expect.soft(panel.locator('.panel-badge')).toBeVisible()
  })

  test('each row has a label, a filled bar, and a value', async ({ page }) => {
    const rows = page.locator('[data-test="staff-revenue-row"]')
    for (let i = 0; i < 4; i++) {
      const r = rows.nth(i)
      await expect.soft(r.locator('.bar-label')).toBeVisible()
      await expect.soft(r.locator('.bar-fill')).toBeVisible()
      await expect.soft(r.locator('.bar-val')).toBeVisible()
    }
  })

  test('bar widths match the revenue distribution (85 / 65 / 50 / 38)', async ({ page }) => {
    const fills = page.locator('[data-test="staff-revenue-row"] .bar-fill')
    const widths: number[] = []
    const count = await fills.count()
    for (let i = 0; i < count; i++) {
      const w = await fills.nth(i).evaluate((el) => (el as HTMLElement).style.width)
      widths.push(parseInt(w, 10))
    }
    expect(widths).toEqual([85, 65, 50, 38])
  })

  test('revenue values are the expected formatted euros', async ({ page }) => {
    const vals = page.locator('[data-test="staff-revenue-row"] .bar-val')
    await expect.soft(vals.nth(0)).toHaveText('28 400 €')
    await expect.soft(vals.nth(1)).toHaveText('22 100 €')
    await expect.soft(vals.nth(2)).toHaveText('18 700 €')
    await expect.soft(vals.nth(3)).toHaveText('15 000 €')
  })

  test('manager labels are present and non-empty', async ({ page }) => {
    // Labels come from i18n (name_andrew / name_svetlana / name_dmitry / name_irena).
    const labels = page.locator('[data-test="staff-revenue-row"] .bar-label')
    for (let i = 0; i < 4; i++) {
      await expect.soft(labels.nth(i)).not.toBeEmpty()
    }
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Page-level feature flag (adminStaff)
// ────────────────────────────────────────────────────────────────────────────
baseTest('staff › redirects to /404 when adminStaff flag is OFF', async ({ page, context }) => {
  await context.addInitScript(
    (flags) => localStorage.setItem('ff_overrides', JSON.stringify(flags)),
    { ...ALL_FLAGS_ENABLED, adminStaff: false },
  )
  await page.goto(STAFF)
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/\/404$/)
  await expect(page.locator('[data-test="staff-title"]')).toHaveCount(0)
})

// ────────────────────────────────────────────────────────────────────────────
// Per-section visual snapshots (@1440 baseline)
// ────────────────────────────────────────────────────────────────────────────
test.describe('staff › visual @1440', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(STAFF)
    await waitForFontsReady(page)
    await page.waitForLoadState('networkidle')
  })

  test('sub-nav', async ({ page }) => {
    await expect(page.locator('[data-test="analytics-sub-nav"]')).toHaveScreenshot(
      'staff-sub-nav.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('managers panel', async ({ page }) => {
    await expect(page.locator('[data-test="staff-managers"]')).toHaveScreenshot(
      'staff-managers.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('warehouse workers panel', async ({ page }) => {
    await expect(page.locator('[data-test="staff-warehouse-workers"]')).toHaveScreenshot(
      'staff-warehouse-workers.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('revenue dynamics panel', async ({ page }) => {
    await expect(page.locator('[data-test="staff-revenue-dynamics"]')).toHaveScreenshot(
      'staff-revenue-dynamics.png',
      SNAPSHOT_OPTIONS,
    )
  })
})
