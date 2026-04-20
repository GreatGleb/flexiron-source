import { test, expect } from './fixtures'

/**
 * Smoke suite — fast sanity pass over every page.
 *
 * Each route gets an independent `test()` so failures surface per-page
 * in the report (e.g. "smoke › /admin/suppliers/config fails to load").
 * This is the first thing to run; page-specific deep suites come later.
 */

type Route = { path: string; label: string }

const PUBLIC_ROUTES: Route[] = [
  { path: '/', label: 'landing' },
  { path: '/login', label: 'login' },
  { path: '/register', label: 'register' },
  { path: '/about', label: 'about' },
  { path: '/support', label: 'support' },
  { path: '/terms', label: 'terms' },
  { path: '/screens', label: 'screens' },
]

const ADMIN_ROUTES: Route[] = [
  { path: '/admin/analytics/dashboard', label: 'dashboard' },
  { path: '/admin/analytics/warehouse', label: 'warehouse' },
  { path: '/admin/analytics/sales', label: 'sales' },
  { path: '/admin/analytics/supply', label: 'supply' },
  { path: '/admin/analytics/staff', label: 'staff' },
  { path: '/admin/analytics/logistics', label: 'logistics' },
  { path: '/admin/analytics/pl-report', label: 'pl-report' },
  { path: '/admin/analytics/deficit', label: 'deficit' },
  { path: '/admin/suppliers', label: 'suppliers-list' },
  { path: '/admin/suppliers/new', label: 'supplier-create' },
  { path: '/admin/suppliers/S-001', label: 'supplier-card' },
  { path: '/admin/suppliers/config', label: 'supplier-card-config' },
  { path: '/admin/suppliers/bcc-request', label: 'bcc-request' },
]

const ALL_ROUTES = [...PUBLIC_ROUTES, ...ADMIN_ROUTES]

for (const route of ALL_ROUTES) {
  test(`${route.label} loads without errors`, async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    const pageErrors: string[] = []
    page.on('pageerror', (err) => {
      pageErrors.push(err.message)
    })

    await page.goto(route.path)
    await page.waitForLoadState('networkidle')

    expect.soft(page.locator('h1').first()).toBeVisible()
    expect.soft(consoleErrors, 'console errors on page').toEqual([])
    expect.soft(pageErrors, 'uncaught JS errors').toEqual([])
  })
}
