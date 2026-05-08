import { test, expect } from '../../fixtures'

test.describe('Services page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/products/services')
    await page.waitForLoadState('networkidle')
  })

  test('should display services page with header and table', async ({ page }) => {
    await expect(page.locator('[data-test="page-services"]')).toBeVisible()
    await expect(page.locator('[data-test="services-header"]')).toBeVisible()
    await expect(page.locator('[data-test="services-table"]')).toBeVisible()
  })

  test('should show create modal on button click', async ({ page }) => {
    await page.click('[data-test="services-btn-create"]')
    await expect(page.locator('[data-test="services-create-modal"]')).toBeVisible()
  })

  test('should show delete confirmation modal', async ({ page }) => {
    await page.locator('[data-test="services-btn-delete"]').first().click()
    await expect(page.locator('[data-test="services-delete-modal"]')).toBeVisible()
  })

  test('should navigate to service card on open button click', async ({ page }) => {
    await page.click('[data-test="services-btn-open"]:first-child')
    await expect(page).toHaveURL(/\/admin\/products\/services\/svc-/)
  })

  test('should navigate back to products page via breadcrumb', async ({ page }) => {
    await page.click('.breadcrumb-link')
    await expect(page).toHaveURL(/\/admin\/products$/)
  })
})
