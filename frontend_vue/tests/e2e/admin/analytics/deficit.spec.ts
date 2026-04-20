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
 * Deep audit of DeficitPage (src/views/admin/analytics/DeficitPage.vue).
 *
 * Page shape — all content is hard-coded in the template (no composable / no
 * service fetch yet, so there is nothing to stub with `page.route`):
 *
 *   h1[data-test="deficit-title"]
 *   <AnalyticsSubNav> → [data-test="analytics-sub-nav"]
 *                         [data-test="analytics-sub-nav-deficit"] (current on this route)
 *                         + 7 siblings (kpi, warehouse, sales, supply, staff, logistics, pl)
 *   [data-test="deficit-kpi-row"]              ×1
 *     [data-test="deficit-kpi-card"]           ×4  — Critical items (pcs., down),
 *                                                    Lost revenue (EUR, down),
 *                                                    Autolist queue (items, neutral),
 *                                                    Restocked (items, up)
 *   [data-test="deficit-charts-row"]           ×1  — flex row wrapping both panels
 *     [data-test="deficit-items"]              ×1  — glass-panel, critical-signal table
 *       [data-test="deficit-items-table"]      ×1  — <table class="data-table">, 5 cols
 *         [data-test="deficit-item-row"]       ×5  — pipe_60 / sheet_3 / profile_80 / rod_30 / angle_63
 *     [data-test="deficit-refusals"]           ×1  — glass-panel, bar chart (autolist by refusals)
 *       [data-test="deficit-refusals-row"]     ×5  — one per item, same order as the table
 *
 * Flags exercised: page-level `adminDeficit`. No section-level flags on this page.
 */

const DEFICIT = '/admin/analytics/deficit'
const DESKTOP = { width: 1440, height: 900 }

// ────────────────────────────────────────────────────────────────────────────
// Structure
// ────────────────────────────────────────────────────────────────────────────
test.describe('deficit › structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(DEFICIT)
    await page.waitForLoadState('networkidle')
  })

  test('title visible', async ({ page }) => {
    await expect(page.locator('[data-test="deficit-title"]')).toBeVisible()
  })

  test('sub-nav, kpi-row, charts-row, both panels all render', async ({ page }) => {
    await expect.soft(page.locator('[data-test="analytics-sub-nav"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="deficit-kpi-row"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="deficit-charts-row"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="deficit-items"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="deficit-refusals"]')).toBeVisible()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// KPI row
// ────────────────────────────────────────────────────────────────────────────
test.describe('deficit › kpi cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(DEFICIT)
    await page.waitForLoadState('networkidle')
  })

  test('renders exactly 4 KPI cards', async ({ page }) => {
    await expect(page.locator('[data-test="deficit-kpi-card"]')).toHaveCount(4)
  })

  test('each card shows label, value, and delta', async ({ page }) => {
    const cards = page.locator('[data-test="deficit-kpi-card"]')
    for (let i = 0; i < 4; i++) {
      const c = cards.nth(i)
      await expect.soft(c.locator('.kpi-label')).toBeVisible()
      await expect.soft(c.locator('.kpi-value')).toBeVisible()
      await expect.soft(c.locator('.kpi-delta')).toBeVisible()
    }
  })

  test('per-card unit suffixes (pcs. / EUR / items / items)', async ({ page }) => {
    // Units are hard-coded in the template — one per card in that order.
    const units = page.locator('[data-test="deficit-kpi-card"] .kpi-value span')
    await expect.soft(units.nth(0)).toHaveText('pcs.')
    await expect.soft(units.nth(1)).toHaveText('EUR')
    await expect.soft(units.nth(2)).toHaveText('items')
    await expect.soft(units.nth(3)).toHaveText('items')
  })

  test('values are the expected numbers', async ({ page }) => {
    const values = page.locator('[data-test="deficit-kpi-card"] .kpi-value')
    await expect.soft(values.nth(0)).toContainText('8')
    await expect.soft(values.nth(1)).toContainText('4 800')
    await expect.soft(values.nth(2)).toContainText('5')
    await expect.soft(values.nth(3)).toContainText('3')
  })

  test('icon tint classes match the card role', async ({ page }) => {
    // Icon colour communicates severity: red (critical), gold (money),
    // blue (queue), green (success).
    const icons = page.locator('[data-test="deficit-kpi-card"] .kpi-icon')
    await expect.soft(icons.nth(0)).toHaveClass(/\bicon-red\b/)
    await expect.soft(icons.nth(1)).toHaveClass(/\bicon-gold\b/)
    await expect.soft(icons.nth(2)).toHaveClass(/\bicon-blue\b/)
    await expect.soft(icons.nth(3)).toHaveClass(/\bicon-green\b/)
  })

  test('delta classes communicate direction', async ({ page }) => {
    const deltas = page.locator('[data-test="deficit-kpi-card"] .kpi-delta')
    await expect.soft(deltas.nth(0)).toHaveClass(/\bdown\b/)
    await expect.soft(deltas.nth(1)).toHaveClass(/\bdown\b/)
    await expect.soft(deltas.nth(2)).toHaveClass(/\bneutral\b/)
    await expect.soft(deltas.nth(3)).toHaveClass(/\bup\b/)
  })

  test('labels and delta strings are non-empty (i18n translated)', async ({ page }) => {
    // All labels + deltas come from i18n. Non-empty check is locale-agnostic.
    const labels = page.locator('[data-test="deficit-kpi-card"] .kpi-label')
    const deltas = page.locator('[data-test="deficit-kpi-card"] .kpi-delta')
    for (let i = 0; i < 4; i++) {
      await expect.soft(labels.nth(i)).not.toBeEmpty()
      await expect.soft(deltas.nth(i)).not.toBeEmpty()
    }
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Sub-nav
// ────────────────────────────────────────────────────────────────────────────
test.describe('deficit › sub-nav', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(DEFICIT)
    await page.waitForLoadState('networkidle')
  })

  test('has 8 tabs', async ({ page }) => {
    await expect(page.locator('[data-test="analytics-sub-nav"] a')).toHaveCount(8)
  })

  test('deficit tab is current on this route', async ({ page }) => {
    await expect(page.locator('[data-test="analytics-sub-nav-deficit"]')).toHaveClass(/current/)
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
    await expect.soft(page.locator('[data-test="analytics-sub-nav-pl"]')).not.toHaveClass(/current/)
  })

  test('clicking kpi tab navigates to dashboard and swaps current', async ({ page }) => {
    await page.locator('[data-test="analytics-sub-nav-kpi"]').click()
    await expect(page).toHaveURL('/admin/analytics/dashboard')
    await expect(page.locator('[data-test="analytics-sub-nav-kpi"]')).toHaveClass(/current/)
    await expect(page.locator('[data-test="analytics-sub-nav-deficit"]')).not.toHaveClass(/current/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Critical-items signal table (chart1)
// ────────────────────────────────────────────────────────────────────────────
test.describe('deficit › items table', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(DEFICIT)
    await page.waitForLoadState('networkidle')
  })

  test('renders 5 item rows', async ({ page }) => {
    await expect(page.locator('[data-test="deficit-item-row"]')).toHaveCount(5)
  })

  test('panel header shows chart title + signal badge', async ({ page }) => {
    const panel = page.locator('[data-test="deficit-items"]')
    await expect.soft(panel.locator('.panel-title')).toBeVisible()
    await expect.soft(panel.locator('.panel-badge')).toBeVisible()
    await expect.soft(panel.locator('.panel-title')).not.toBeEmpty()
    await expect.soft(panel.locator('.panel-badge')).not.toBeEmpty()
  })

  test('table head has 5 columns', async ({ page }) => {
    await expect(page.locator('[data-test="deficit-items-table"] thead tr th')).toHaveCount(5)
  })

  test('item labels are present and non-empty', async ({ page }) => {
    // Labels come from i18n (item_pipe_60 / _sheet_3 / _profile_80 / _rod_30 / _angle_63).
    const labels = page.locator('[data-test="deficit-item-row"] td:first-child')
    for (let i = 0; i < 5; i++) {
      await expect.soft(labels.nth(i)).not.toBeEmpty()
    }
  })

  test('stock column renders the expected tonnage', async ({ page }) => {
    // Stock is the 1st .hid-320 cell per row — value includes the i18n tonne unit.
    const rows = page.locator('[data-test="deficit-item-row"]')
    await expect.soft(rows.nth(0).locator('td.hid-320').first()).toContainText('0.4')
    await expect.soft(rows.nth(1).locator('td.hid-320').first()).toContainText('0.8')
    await expect.soft(rows.nth(2).locator('td.hid-320').first()).toContainText('1.1')
    await expect.soft(rows.nth(3).locator('td.hid-320').first()).toContainText('0.6')
    await expect.soft(rows.nth(4).locator('td.hid-320').first()).toContainText('1.8')
  })

  test('min column renders the expected thresholds', async ({ page }) => {
    // Min is the 2nd .hid-320 cell per row.
    const rows = page.locator('[data-test="deficit-item-row"]')
    await expect.soft(rows.nth(0).locator('td.hid-320').nth(1)).toContainText('2')
    await expect.soft(rows.nth(1).locator('td.hid-320').nth(1)).toContainText('3')
    await expect.soft(rows.nth(2).locator('td.hid-320').nth(1)).toContainText('2')
    await expect.soft(rows.nth(3).locator('td.hid-320').nth(1)).toContainText('1.5')
    await expect.soft(rows.nth(4).locator('td.hid-320').nth(1)).toContainText('2')
  })

  test('refusals column renders the expected counts', async ({ page }) => {
    // Refusals is the 4th <td> per row (item / stock / min / refusals / status).
    const rows = page.locator('[data-test="deficit-item-row"]')
    await expect.soft(rows.nth(0).locator('td').nth(3)).toHaveText('4')
    await expect.soft(rows.nth(1).locator('td').nth(3)).toHaveText('3')
    await expect.soft(rows.nth(2).locator('td').nth(3)).toHaveText('2')
    await expect.soft(rows.nth(3).locator('td').nth(3)).toHaveText('2')
    await expect.soft(rows.nth(4).locator('td').nth(3)).toHaveText('1')
  })

  test('status pills use correct semantic classes', async ({ page }) => {
    const pills = page.locator('[data-test="deficit-item-row"] .status-pill')
    await expect.soft(pills.nth(0)).toHaveClass(/\bpill-danger\b/)
    await expect.soft(pills.nth(1)).toHaveClass(/\bpill-danger\b/)
    await expect.soft(pills.nth(2)).toHaveClass(/\bpill-warning\b/)
    await expect.soft(pills.nth(3)).toHaveClass(/\bpill-warning\b/)
    await expect.soft(pills.nth(4)).toHaveClass(/\bpill-warning\b/)
  })

  test('status text is non-empty per row', async ({ page }) => {
    // Labels come from i18n (status_critical / _low). Non-empty keeps it locale-agnostic.
    const pills = page.locator('[data-test="deficit-item-row"] .status-pill')
    for (let i = 0; i < 5; i++) {
      await expect.soft(pills.nth(i)).not.toBeEmpty()
    }
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Refusals bar chart (chart2 — autolist priority by refusals)
// ────────────────────────────────────────────────────────────────────────────
test.describe('deficit › refusals chart', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(DEFICIT)
    await page.waitForLoadState('networkidle')
  })

  test('renders 5 bar rows', async ({ page }) => {
    await expect(page.locator('[data-test="deficit-refusals-row"]')).toHaveCount(5)
  })

  test('panel header shows chart title + autolist badge', async ({ page }) => {
    const panel = page.locator('[data-test="deficit-refusals"]')
    await expect.soft(panel.locator('.panel-title')).toBeVisible()
    await expect.soft(panel.locator('.panel-badge')).toBeVisible()
    await expect.soft(panel.locator('.panel-title')).not.toBeEmpty()
    await expect.soft(panel.locator('.panel-badge')).not.toBeEmpty()
  })

  test('each row has a label, a filled bar, and a value', async ({ page }) => {
    const rows = page.locator('[data-test="deficit-refusals-row"]')
    for (let i = 0; i < 5; i++) {
      const r = rows.nth(i)
      await expect.soft(r.locator('.bar-label')).toBeVisible()
      await expect.soft(r.locator('.bar-fill')).toBeVisible()
      await expect.soft(r.locator('.bar-val')).toBeVisible()
    }
  })

  test('bar widths match the refusal distribution (90 / 75 / 50 / 40 / 25)', async ({ page }) => {
    const fills = page.locator('[data-test="deficit-refusals-row"] .bar-fill')
    const widths: number[] = []
    const count = await fills.count()
    for (let i = 0; i < count; i++) {
      const w = await fills.nth(i).evaluate((el) => (el as HTMLElement).style.width)
      widths.push(parseInt(w, 10))
    }
    expect(widths).toEqual([90, 75, 50, 40, 25])
  })

  test('bar fills are tinted by severity (red / red / gold / gold / blue)', async ({ page }) => {
    // The template encodes severity via inline background gradients — danger reds
    // for the top two refusal counts, warning gold for the middle pair, and a
    // blue accent for the lowest. Browsers serialise the hex seeds back to rgb()
    // when re-reading .style.background, so assert on the rgb form.
    const fills = page.locator('[data-test="deficit-refusals-row"] .bar-fill')
    const bgs: string[] = []
    const count = await fills.count()
    for (let i = 0; i < count; i++) {
      const bg = await fills.nth(i).evaluate((el) => (el as HTMLElement).style.background)
      bgs.push(bg)
    }
    expect(bgs[0]).toContain('rgb(255, 77, 79)') // #ff4d4f — danger red
    expect(bgs[1]).toContain('rgb(255, 77, 79)')
    expect(bgs[2]).toContain('rgb(250, 173, 20)') // #faad14 — warning gold
    expect(bgs[3]).toContain('rgb(250, 173, 20)')
    expect(bgs[4]).toContain('rgb(24, 144, 255)') // #1890FF — info blue
  })

  test('tonnage values are the expected formatted numbers', async ({ page }) => {
    const vals = page.locator('[data-test="deficit-refusals-row"] .bar-val')
    await expect.soft(vals.nth(0)).toHaveText('4 t')
    await expect.soft(vals.nth(1)).toHaveText('5 t')
    await expect.soft(vals.nth(2)).toHaveText('2 t')
    await expect.soft(vals.nth(3)).toHaveText('1.5 t')
    await expect.soft(vals.nth(4)).toHaveText('1 t')
  })

  test('item labels are present and non-empty', async ({ page }) => {
    // Labels share i18n keys with the table above (same item names).
    const labels = page.locator('[data-test="deficit-refusals-row"] .bar-label')
    for (let i = 0; i < 5; i++) {
      await expect.soft(labels.nth(i)).not.toBeEmpty()
    }
  })

  test('refusals chart lists items in the same order as the items table', async ({ page }) => {
    // Both panels are meant to describe the same ranked list — order must match so
    // the user can visually cross-reference rows.
    const tableLabels = await page
      .locator('[data-test="deficit-item-row"] td:first-child')
      .allTextContents()
    const barLabels = await page
      .locator('[data-test="deficit-refusals-row"] .bar-label')
      .allTextContents()
    expect(barLabels.map((s) => s.trim())).toEqual(tableLabels.map((s) => s.trim()))
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Page-level feature flag (adminDeficit)
// ────────────────────────────────────────────────────────────────────────────
baseTest('deficit › redirects to /404 when adminDeficit flag is OFF', async ({ page, context }) => {
  await context.addInitScript(
    (flags) => localStorage.setItem('ff_overrides', JSON.stringify(flags)),
    { ...ALL_FLAGS_ENABLED, adminDeficit: false },
  )
  await page.goto(DEFICIT)
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/\/404$/)
  await expect(page.locator('[data-test="deficit-title"]')).toHaveCount(0)
})

// ────────────────────────────────────────────────────────────────────────────
// Per-section visual snapshots (@1440 baseline)
// ────────────────────────────────────────────────────────────────────────────
test.describe('deficit › visual @1440', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await page.goto(DEFICIT)
    await waitForFontsReady(page)
    await page.waitForLoadState('networkidle')
  })

  test('sub-nav', async ({ page }) => {
    await expect(page.locator('[data-test="analytics-sub-nav"]')).toHaveScreenshot(
      'deficit-sub-nav.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('kpi row', async ({ page }) => {
    await expect(page.locator('[data-test="deficit-kpi-row"]')).toHaveScreenshot(
      'deficit-kpi-row.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('items panel', async ({ page }) => {
    await expect(page.locator('[data-test="deficit-items"]')).toHaveScreenshot(
      'deficit-items.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('refusals panel', async ({ page }) => {
    await expect(page.locator('[data-test="deficit-refusals"]')).toHaveScreenshot(
      'deficit-refusals.png',
      SNAPSHOT_OPTIONS,
    )
  })
})
