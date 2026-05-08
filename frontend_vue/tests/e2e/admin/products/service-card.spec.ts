import { test, expect } from '../../fixtures'

test.describe('Service card page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/products/services/svc-001')
    await page.waitForLoadState('networkidle')
  })

  test('should display service card with header and breadcrumbs', async ({ page }) => {
    await expect(page.locator('[data-test="page-service-card"]')).toBeVisible()
    await expect(page.locator('[data-test="service-card-header"]')).toBeVisible()
    await expect(page.locator('.breadcrumb')).toBeVisible()
    await expect(page.locator('[data-test="service-save-bar"]')).toBeVisible()
  })

  test('should show service info panel', async ({ page }) => {
    await expect(page.locator('[data-test="service-card-info"]')).toBeVisible()
    await expect(page.locator('[data-test="service-name-input"]')).toBeVisible()
    await expect(page.locator('[data-test="service-cost-input"]')).toBeVisible()
    await expect(page.locator('[data-test="service-selling-input"]')).toBeVisible()
    await expect(page.locator('[data-test="service-unit-select"]')).toBeVisible()
    await expect(page.locator('[data-test="service-description-input"]')).toBeVisible()
  })

  test('save button is disabled initially (no changes)', async ({ page }) => {
    const saveBtn = page.locator('[data-test="service-save-bar"] .btn-save')
    await expect(saveBtn).toBeDisabled()
  })

  test('editing name enables save button', async ({ page }) => {
    const nameInput = page.locator('[data-test="service-name-input"]')
    await nameInput.fill('Updated service name')
    const saveBtn = page.locator('[data-test="service-save-bar"] .btn-save')
    await expect(saveBtn).toBeEnabled()
  })

  test('clicking discard after edit resets save button to disabled', async ({ page }) => {
    const nameInput = page.locator('[data-test="service-name-input"]')
    await nameInput.fill('Updated service name')
    const discardBtn = page.locator('[data-test="service-save-bar"] .btn-secondary')
    await discardBtn.click()
    const saveBtn = page.locator('[data-test="service-save-bar"] .btn-save')
    await expect(saveBtn).toBeDisabled()
  })

  test('breadcrumb navigates back to services list', async ({ page }) => {
    const breadcrumbLinks = page.locator('.breadcrumb-link')
    // Second breadcrumb link is "Services"
    await breadcrumbLinks.nth(1).click()
    await expect(page).toHaveURL(/\/admin\/products\/services$/)
  })
})
