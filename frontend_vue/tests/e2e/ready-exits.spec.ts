import { testBare as test, expect } from './fixtures'
import { ALL_FLAGS_ENABLED } from './helpers/flags'
import { waitForDataReady, readyExitOf, type ReadyExit } from './helpers/ready'

/**
 * Which pages leave `waitForDataReady` by a branch that believes a clock.
 *
 * Two of its four exits are guesses: "idle held for 400ms and no traffic was seen"
 * and "the mocks module never loaded within 2s". Both mean *asked for nothing* — and
 * both would wave through a page whose first request merely starts late. Measured
 * data delays under load are 1.7–2.2s, an order of magnitude past the 400ms window,
 * so the assumption is worth checking rather than asserting.
 *
 * This walks every route and records the exit. A page with data leaving by a timed
 * branch is a lie in the helper, and the helper is what gets fixed — not this list.
 */

/** Pages that genuinely ask the API for nothing. */
const DATA_FREE = ['/', '/login', '/register', '/about', '/support', '/terms', '/screens', '/404']

/** Every admin route: all of these load data and must exit by `traffic-seen`. */
const ADMIN = [
  '/admin/analytics/dashboard',
  '/admin/analytics/warehouse',
  '/admin/analytics/sales',
  '/admin/analytics/supply',
  '/admin/analytics/staff',
  '/admin/analytics/logistics',
  '/admin/analytics/pl-report',
  '/admin/analytics/deficit',
  '/admin/products',
  '/admin/products/prod-001',
  '/admin/products/categories',
  '/admin/products/categories/cat-1',
  '/admin/products/services',
  '/admin/clients',
  '/admin/clients/CL-001',
  '/admin/clients/new',
  '/admin/suppliers',
  '/admin/suppliers/1',
  '/admin/suppliers/new',
  '/admin/suppliers/config',
  '/admin/suppliers/bcc-request',
  '/admin/orders',
  '/admin/orders/ORD-001',
  '/admin/orders/new',
  '/admin/sales-crm',
  '/admin/warehouse',
  '/admin/warehouse/map',
  '/admin/warehouse/batches/whb-001',
  '/admin/warehouse/stock/prod-001',
  '/admin/warehouse/offcuts/who-001',
  '/admin/warehouse/movements/whm-001',
  '/admin/warehouse/deficit/whd-001',
  '/admin/finance/incoming',
  '/admin/finance/outgoing',
  '/admin/finance/archive',
  '/admin/notifications',
  '/admin/settings/profile',
  '/admin/settings/company',
  '/admin/settings/finance',
  '/admin/settings/units',
  '/admin/settings/order-statuses',
  '/admin/settings/logs',
]

async function exitFor(
  page: import('@playwright/test').Page,
  path: string,
): Promise<ReadyExit | string> {
  await page.goto(path)
  try {
    await waitForDataReady(page, 8000)
  } catch {
    // A page whose skeletons never clear is a finding of its own — report it by name
    // rather than letting the whole census die on it.
    const stuck = await page
      .locator(
        '.panel-skeleton, .glass-panel.loading, .skeleton, .sales-crm-loading, .settings-loading, .stock-loading',
      )
      .filter({ visible: true })
      .count()
    return `NEVER-READY (${stuck} loading markers still visible)`
  }
  return readyExitOf(page)
}

test.beforeEach(async ({ context }) => {
  await context.addInitScript(
    (flags) => localStorage.setItem('ff_overrides', JSON.stringify(flags)),
    ALL_FLAGS_ENABLED,
  )
})

test('every admin page leaves by the honest branch, having seen its traffic', async ({ page }) => {
  test.setTimeout(300_000)
  const timed: string[] = []
  for (const path of ADMIN) {
    const exit = await exitFor(page, path)
    if (exit !== 'traffic-seen') timed.push(`${path} → ${exit}`)
  }
  console.log(
    timed.length ? `NOT traffic-seen:\n${timed.join('\n')}` : 'all admin pages: traffic-seen',
  )
  // A page with data that exits on a timer is the helper lying, not a page to list.
  expect(timed, `admin pages leaving waitForDataReady on a clock:\n${timed.join('\n')}`).toEqual([])
})

test('the timed branches belong to pages that ask for nothing', async ({ page }) => {
  const exits = new Map<string, ReadyExit>()
  for (const path of DATA_FREE) exits.set(path, await exitFor(page, path))

  for (const [path, exit] of exits) {
    expect(['no-mock-module', 'idle-timeout'], `${path} exited via ${exit}`).toContain(exit)
  }
  console.log('data-free exits:', JSON.stringify(Object.fromEntries(exits), null, 1))
})
