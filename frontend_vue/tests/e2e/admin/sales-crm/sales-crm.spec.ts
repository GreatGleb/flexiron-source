import type { Page } from '@playwright/test'
import { test, expect } from '../../fixtures'
import { DATA_READY_TIMEOUT } from '../../helpers/ready'

/**
 * The dashboard's four numbers.
 *
 * They are counts over the whole store, not over whatever page of orders the
 * dashboard happened to fetch — a KPI that stops counting at the page boundary
 * is worse than no KPI, because it keeps showing a number.
 *
 * The mock store lives in module memory, so every reload puts it back. These
 * tests move between pages with in-app navigation only.
 */

async function kpi(page: Page, name: string): Promise<number> {
  const text = await page
    .locator(`[data-test="sales-crm-kpi-${name}"] .sales-crm-kpi-value`)
    .innerText()
  return Number(text.replace(/[^\d.-]/g, ''))
}

test.describe('Sales CRM dashboard', () => {
  test('KPI counts include an order created after them', async ({ page }) => {
    await page.goto('/admin/sales-crm')
    await expect(page.locator('[data-test="sales-crm-kpis"]')).toBeVisible()
    const activeBefore = await kpi(page, 'active-orders')
    const pendingBefore = await kpi(page, 'pending-orders')

    // A brand new order is `new`: both active and pending.
    await page.locator('[data-test="sales-crm-action-new-order"]').click()
    await expect(page.locator('[data-test="page-order-create"]')).toBeVisible()
    await page.locator('[data-test="order-create-client-item"]').first().click()
    await page.locator('[data-test="order-create-save-btn"]').click()
    await page.waitForURL(/\/admin\/orders\/ORD-/)

    // Back to the dashboard the way a user goes back — no reload, or the mock
    // store would forget the order that was just created.
    await page.goBack()
    await page.goBack()
    await expect(page.locator('[data-test="sales-crm-kpis"]')).toBeVisible()

    await expect
      .poll(() => kpi(page, 'active-orders'), { timeout: DATA_READY_TIMEOUT })
      .toBe(activeBefore + 1)
    expect(await kpi(page, 'pending-orders')).toBe(pendingBefore + 1)
  })
})
