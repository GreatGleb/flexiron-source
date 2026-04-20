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
    await page.goto('/admin/suppliers/S-001')
    await expect(page).toHaveURL('/admin/suppliers/S-001')
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('supplier create route resolves before :id', async ({ page }) => {
    await page.goto('/admin/suppliers/new')
    await expect(page).toHaveURL('/admin/suppliers/new')
    await expect(page.locator('h1').first()).toBeVisible()
  })
})
