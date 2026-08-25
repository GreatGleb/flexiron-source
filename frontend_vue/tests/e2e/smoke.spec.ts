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
  { path: '/admin/products/categories', label: 'categories' },
  { path: '/admin/products/categories/cat-1', label: 'category-card' },
  { path: '/admin/products', label: 'products' },
  { path: '/admin/products/prod-001', label: 'product-card' },
  { path: '/admin/clients', label: 'clients-list' },
  { path: '/admin/clients/new', label: 'client-create' },
  { path: '/admin/clients/CL-001', label: 'client-card' },
  { path: '/admin/suppliers', label: 'suppliers-list' },
  { path: '/admin/suppliers/new', label: 'supplier-create' },
  { path: '/admin/suppliers/1', label: 'supplier-card' },
  { path: '/admin/suppliers/config', label: 'supplier-card-config' },
  { path: '/admin/suppliers/bcc-request', label: 'bcc-request' },
  // Its "recent orders" table shows figures that come from the orders module, and
  // nothing else covered this page at all.
  { path: '/admin/sales-crm', label: 'sales-crm' },
  { path: '/admin/orders', label: 'orders-list' },
  { path: '/admin/orders/new', label: 'order-create' },
  { path: '/admin/orders/ORD-001', label: 'order-card' },
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
    // Collected for the failure message only. Chromium reports a failed subresource
    // as the bare string "Failed to load resource: the server responded with a
    // status of 404 ()" — no URL, nothing to act on. That message is what this
    // suite showed for months while fonts.gstatic.com intermittently 404'd a font
    // subset under load, and it named neither the host nor the file. Whatever
    // breaks next, the report should say what did not load.
    const badResponses: string[] = []
    page.on('response', (r) => {
      if (r.status() >= 400)
        badResponses.push(`${r.status()} ${r.request().resourceType()} ${r.url()}`)
    })
    page.on('requestfailed', (r) => {
      badResponses.push(`FAILED ${r.failure()?.errorText} ${r.resourceType()} ${r.url()}`)
    })

    await page.goto(route.path)
    await page.waitForLoadState('networkidle')

    // AWAITED, and that matters: `expect.soft(locator).toBeVisible()` returns a
    // promise, and without awaiting it the assertion never gets its retry window —
    // it is settled against whatever the page happened to show in that same tick.
    // Every page here passed only by rendering fast enough; the order card, the
    // slowest of them, failed at random and was written off as a flake for three
    // stages. The generous timeout is for a cold dev server compiling the route.
    await expect.soft(page.locator('h1').first()).toBeVisible({ timeout: 15_000 })
    expect
      .soft(consoleErrors, `console errors on page; network: ${JSON.stringify(badResponses)}`)
      .toEqual([])
    expect.soft(pageErrors, 'uncaught JS errors').toEqual([])
  })
}
