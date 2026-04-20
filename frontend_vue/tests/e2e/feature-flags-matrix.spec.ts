import { test, expect } from '@playwright/test'
import { ALL_FLAGS_ENABLED } from './helpers/flags'

/**
 * Critical cross-page / multi-flag combinations that per-flag tests in
 * feature-flags.spec.ts cannot catch.
 *
 * Scenarios:
 *  1. Parent-route redirect: /admin → /admin/analytics/dashboard with adminDashboard OFF
 *     must still land on /404 (redirect chain passes through the guard).
 *  2. All page flags OFF simultaneously — every admin route resolves to /404, no crash.
 *  3. All section flags OFF + page flags ON — host pages still render, hidden sections
 *     are absent (v-if not crashing on unrelated render paths).
 *  4. Cross-page link follow-through: clicking a visible router-link on page A whose
 *     target flag is OFF must redirect to /404 (the page A link renders, since it's
 *     not guarded by the target flag; the guard fires on navigation).
 *  5. Sidebar cross-link with target page flag OFF.
 *
 * All tests use `test` directly (not fixtures) so each supplies its own flag override.
 */

async function setFlags(
  context: import('@playwright/test').BrowserContext,
  overrides: Partial<typeof ALL_FLAGS_ENABLED>,
) {
  await context.addInitScript(
    (flags) => {
      localStorage.setItem('ff_overrides', JSON.stringify(flags))
    },
    { ...ALL_FLAGS_ENABLED, ...overrides },
  )
}

test.describe('Parent-route redirect', () => {
  test('/admin with adminDashboard OFF lands on /404 via dashboard redirect', async ({
    page,
    context,
  }) => {
    await setFlags(context, { adminDashboard: false })
    await page.goto('/admin')
    await expect(page).toHaveURL('/404')
  })

  test('/admin with adminDashboard ON lands on dashboard', async ({ page, context }) => {
    await setFlags(context, {})
    await page.goto('/admin')
    await expect(page).toHaveURL('/admin/analytics/dashboard')
  })
})

test.describe('All page flags OFF', () => {
  const ALL_PAGE_FLAGS_OFF = {
    adminDashboard: false,
    adminWarehouse: false,
    adminSales: false,
    adminSupply: false,
    adminStaff: false,
    adminLogistics: false,
    adminPlReport: false,
    adminDeficit: false,
    suppliersList: false,
    supplierCard: false,
    supplierCreate: false,
    supplierCardConfig: false,
    bccRequest: false,
  }

  const ADMIN_ROUTES = [
    '/admin',
    '/admin/analytics/dashboard',
    '/admin/analytics/warehouse',
    '/admin/suppliers',
    '/admin/suppliers/new',
    '/admin/suppliers/config',
    '/admin/suppliers/bcc-request',
    '/admin/suppliers/S-001',
  ]

  for (const route of ADMIN_ROUTES) {
    test(`${route} redirects to /404 when all page flags are OFF`, async ({ page, context }) => {
      await setFlags(context, ALL_PAGE_FLAGS_OFF)
      await page.goto(route)
      await expect(page).toHaveURL('/404')
    })
  }
})

test.describe('All section flags OFF, page flags ON', () => {
  const ALL_SECTIONS_OFF = {
    dashboardAlerts: false,
    dashboardCharts: false,
    supplierKanbanView: false,
    supplierExport: false,
    bccHistory: false,
    permissionsEditor: false,
  }

  test('DashboardPage renders without alerts/charts panels', async ({ page, context }) => {
    await setFlags(context, ALL_SECTIONS_OFF)
    await page.goto('/admin/analytics/dashboard')
    await expect(page.locator('[data-test="dashboard-title"]')).toBeVisible()
    await expect(page.locator('[data-test="dashboard-charts"]')).toHaveCount(0)
    await expect(page.locator('[data-test="dashboard-alerts"]')).toHaveCount(0)
  })

  test('SuppliersListPage renders without kanban tabs / export button', async ({
    page,
    context,
  }) => {
    await setFlags(context, ALL_SECTIONS_OFF)
    await page.goto('/admin/suppliers')
    await expect(page.locator('[data-test="suppliers-table-view"]')).toBeVisible()
    await expect(page.locator('[data-test="suppliers-view-tabs"]')).toHaveCount(0)
    await expect(page.locator('[data-test="suppliers-export-btn"]')).toHaveCount(0)
  })

  test('BccRequestPage renders without history panel', async ({ page, context }) => {
    await setFlags(context, ALL_SECTIONS_OFF)
    await page.goto('/admin/suppliers/bcc-request')
    await expect(page.locator('[data-test="bcc-request-title"]')).toBeVisible()
    await expect(page.locator('[data-test="bcc-request-history-panel"]')).toHaveCount(0)
  })

  test('SupplierCardConfigPage renders without permissions editor', async ({ page, context }) => {
    await setFlags(context, ALL_SECTIONS_OFF)
    await page.goto('/admin/suppliers/config')
    await expect(page.locator('[data-test="supplier-card-config-title"]')).toBeVisible()
    await expect(page.locator('[data-test="supplier-card-config-permissions"]')).toHaveCount(0)
  })
})

test.describe('Cross-page link follow-through', () => {
  test('SupplierCard → BCC link redirects to /404 when bccRequest OFF', async ({
    page,
    context,
  }) => {
    await setFlags(context, { bccRequest: false })
    await page.goto('/admin/suppliers/S-001')
    const bccLink = page.locator('[data-test="supplier-card-bcc-link"]')
    await expect(bccLink).toBeVisible()
    await bccLink.click()
    await expect(page).toHaveURL('/404')
  })

  test('SupplierCard → Config link redirects to /404 when supplierCardConfig OFF', async ({
    page,
    context,
  }) => {
    await setFlags(context, { supplierCardConfig: false })
    await page.goto('/admin/suppliers/S-001')
    const configLink = page.locator('[data-test="supplier-card-config-link"]')
    await expect(configLink).toBeVisible()
    await configLink.click()
    await expect(page).toHaveURL('/404')
  })

  test('SuppliersList → BCC header button redirects to /404 when bccRequest OFF', async ({
    page,
    context,
  }) => {
    await setFlags(context, { bccRequest: false })
    await page.goto('/admin/suppliers')
    const bccBtn = page.locator('[data-test="suppliers-bcc-btn"]')
    await expect(bccBtn).toBeVisible()
    await bccBtn.click()
    await expect(page).toHaveURL('/404')
  })

  test('SuppliersList → New supplier button redirects to /404 when supplierCreate OFF', async ({
    page,
    context,
  }) => {
    await setFlags(context, { supplierCreate: false })
    await page.goto('/admin/suppliers')
    const newBtn = page.locator('[data-test="suppliers-new-btn"]')
    await expect(newBtn).toBeVisible()
    await newBtn.click()
    await expect(page).toHaveURL('/404')
  })
})

test.describe('Sidebar cross-link', () => {
  test('Sidebar → Suppliers link redirects to /404 when suppliersList OFF', async ({
    page,
    context,
  }) => {
    await setFlags(context, { suppliersList: false })
    await page.goto('/admin/analytics/dashboard')
    const link = page.locator('[data-test="sidebar-nav-suppliers"]')
    await expect(link).toBeVisible()
    await link.click()
    await expect(page).toHaveURL('/404')
  })

  test('Sidebar → Analytics link redirects to /404 when adminDashboard OFF', async ({
    page,
    context,
  }) => {
    // Need a non-dashboard admin page to start from, since dashboard itself would 404.
    await setFlags(context, { adminDashboard: false })
    await page.goto('/admin/suppliers')
    const link = page.locator('[data-test="sidebar-nav-analytics"]')
    await expect(link).toBeVisible()
    await link.click()
    await expect(page).toHaveURL('/404')
  })
})
