import { test, expect } from './fixtures'

test.describe('Navigation', () => {
  test('landing renders at /', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/')
    await expect(page.locator('h1')).toBeVisible()
  })

  test('unknown route redirects to /404', async ({ page }) => {
    await page.goto('/definitely-not-a-route')
    await expect(page).toHaveURL('/404')
  })

  test('/admin redirects to dashboard', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL('/admin/analytics/dashboard')
  })

  test('deep link to supplier card works', async ({ page }) => {
    await page.goto('/admin/suppliers/1')
    await expect(page).toHaveURL('/admin/suppliers/1')
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('supplier create route resolves before :id', async ({ page }) => {
    await page.goto('/admin/suppliers/new')
    await expect(page).toHaveURL('/admin/suppliers/new')
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('deep link to category card works', async ({ page }) => {
    await page.goto('/admin/products/categories/cat-1')
    await expect(page).toHaveURL('/admin/products/categories/cat-1')
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('deep link to product card works', async ({ page }) => {
    await page.goto('/admin/products/prod-001')
    await expect(page.locator('[data-test=page-product-card]')).toBeVisible()
  })

  test('categories route resolves before :id', async ({ page }) => {
    await page.goto('/admin/products/categories')
    await expect(page).toHaveURL('/admin/products/categories')
    await expect(page.locator('h1').first()).toBeVisible()
  })
  test('deep link to client card works', async ({ page }) => {
    await page.goto('/admin/clients/CL-001')
    await expect(page).toHaveURL('/admin/clients/CL-001')
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('client create route resolves before :id', async ({ page }) => {
    await page.goto('/admin/clients/new')
    await expect(page).toHaveURL('/admin/clients/new')
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('clients list route works', async ({ page }) => {
    await page.goto('/admin/clients')
    await expect(page).toHaveURL('/admin/clients')
    await expect(page.locator('h1').first()).toBeVisible()
  })

  // ─── Orders navigation ──────────────────────────────────────────────

  test('orders list route works', async ({ page }) => {
    await page.goto('/admin/orders')
    await expect(page).toHaveURL('/admin/orders')
    await expect(page.locator('[data-test="page-orders"]')).toBeVisible()
  })

  test('order create route resolves before :id', async ({ page }) => {
    await page.goto('/admin/orders/new')
    await expect(page).toHaveURL('/admin/orders/new')
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('deep link to order card works', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page).toHaveURL('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="page-order-card"]')).toBeVisible()
  })

})
