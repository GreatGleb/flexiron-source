import { test, expect } from '@playwright/test'
import { ALL_FLAGS_ENABLED } from './helpers/flags'

/**
 * For each page-level flag: turning it OFF redirects the corresponding route to /404.
 *
 * Section-level flags (dashboardAlerts, supplierKanbanView, etc.) are tested
 * in their respective per-page deep specs once data-test attributes are in place.
 */

const PAGE_FLAG_ROUTES: Array<{ flag: keyof typeof ALL_FLAGS_ENABLED; route: string }> = [
  { flag: 'adminDashboard', route: '/admin/analytics/dashboard' },
  { flag: 'adminWarehouse', route: '/admin/analytics/warehouse' },
  { flag: 'adminSales', route: '/admin/analytics/sales' },
  { flag: 'adminSupply', route: '/admin/analytics/supply' },
  { flag: 'adminStaff', route: '/admin/analytics/staff' },
  { flag: 'adminLogistics', route: '/admin/analytics/logistics' },
  { flag: 'adminPlReport', route: '/admin/analytics/pl-report' },
  { flag: 'adminDeficit', route: '/admin/analytics/deficit' },
  { flag: 'suppliersList', route: '/admin/suppliers' },
  { flag: 'supplierCreate', route: '/admin/suppliers/new' },
  { flag: 'supplierCard', route: '/admin/suppliers/S-001' },
  { flag: 'supplierCardConfig', route: '/admin/suppliers/config' },
  { flag: 'bccRequest', route: '/admin/suppliers/bcc-request' },
]

for (const { flag, route } of PAGE_FLAG_ROUTES) {
  test(`${flag} OFF → ${route} redirects to /404`, async ({ page, context }) => {
    await context.addInitScript(
      (overrides) => {
        localStorage.setItem('ff_overrides', JSON.stringify(overrides))
      },
      { ...ALL_FLAGS_ENABLED, [flag]: false },
    )
    await page.goto(route)
    await expect(page).toHaveURL('/404')
  })
}

test('with all flags ON, every page loads (no 404)', async ({ page, context }) => {
  await context.addInitScript((flags) => {
    localStorage.setItem('ff_overrides', JSON.stringify(flags))
  }, ALL_FLAGS_ENABLED)
  for (const { route } of PAGE_FLAG_ROUTES) {
    await page.goto(route)
    expect.soft(page.url(), `flags ON: ${route} should NOT redirect`).toContain(route)
  }
})
