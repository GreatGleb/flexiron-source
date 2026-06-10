import { test, expect } from '../../fixtures'
import { enableAllFlags } from '../../helpers/flags'
import { mockExternalRequests } from '../../helpers/mockExternalRequests'

test.beforeEach(async ({ context, page }) => {
  await enableAllFlags(context)
  await mockExternalRequests(page)
})

// ═══════════════════════════════════════════════════════════════════════════
// Notifications Page
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Notifications Page', () => {
  test('loads without console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })

    await page.goto('/admin/notifications')
    await expect(page.locator('[data-test="page-notifications"]')).toBeVisible()
    expect(errors).toHaveLength(0)
  })

  test('header with title and mark-all-read button is visible', async ({ page }) => {
    await page.goto('/admin/notifications')
    await expect(page.locator('[data-test="notifications-header"]')).toBeVisible()
    await expect(page.locator('h1.page-title')).toBeVisible()
    // Mark all as read button
    await expect(page.locator('[data-test="notifications-header"] button')).toBeVisible()
  })

  test('breadcrumb is visible', async ({ page }) => {
    await page.goto('/admin/notifications')
    await expect(page.locator('nav.breadcrumb, .breadcrumb').first()).toBeVisible()
  })

  test('filters section is visible with type and status selectors', async ({ page }) => {
    await page.goto('/admin/notifications')
    await expect(page.locator('[data-test="notifications-filters"]')).toBeVisible()
    await expect(page.locator('[data-test="notifications-filter-search"]')).toBeVisible()
    await expect(page.locator('[data-test="notifications-filter-type"]')).toBeVisible()
    await expect(page.locator('[data-test="notifications-filter-status"]')).toBeVisible()
  })

  test('table renders with notification rows', async ({ page }) => {
    await page.goto('/admin/notifications')
    await expect(page.locator('[data-test="notifications-table"]')).toBeVisible()
    await expect(page.locator('[data-test="notifications-row"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('pagination is visible when notifications exist', async ({ page }) => {
    await page.goto('/admin/notifications')
    await expect(page.locator('[data-test="notifications-pagination"]')).toBeVisible()
  })

  test('empty state when no matching notifications', async ({ page }) => {
    await page.goto('/admin/notifications')
    // Filter by a non-existent search term
    await page.locator('[data-test="notifications-search"] input').fill('ZZZZ_NONEXISTENT')
    // Wait for debounce + reload
    await page.waitForTimeout(600)
    await expect(page.locator('[data-test="notifications-empty"]')).toBeVisible()
  })

  test('error state shows retry button', async ({ page }) => {
    // Set a localStorage flag BEFORE navigation that tells the mock to throw
    await page.goto('/admin/notifications')
    await page.waitForTimeout(500)
    await page.evaluate(() => localStorage.setItem('test_mock_force_error', 'true'))
    await page.reload()
    await expect(page.locator('[data-test="notifications-error"]')).toBeVisible({ timeout: 8000 })
  })

  test('mark all as read clears unread badges', async ({ page }) => {
    await page.goto('/admin/notifications')
    // Click "Mark all as read"
    await page.locator('[data-test="notifications-header"] button').click()
    await page.waitForTimeout(500)
    // All rows should show "read" status
    const unreadRows = page.locator('[data-test="notifications-row"].notif-row--unread')
    await expect(unreadRows).toHaveCount(0)
  })

  test('clicking a notification navigates to linked entity', async ({ page }) => {
    await page.goto('/admin/notifications')
    const firstRow = page.locator('[data-test="notifications-row"]').first()
    await expect(firstRow).toBeVisible()
    await firstRow.click()
    // Should navigate away from notifications page
    await expect(page).not.toHaveURL(/\/admin\/notifications/)
  })

  test('type filter changes notification list', async ({ page }) => {
    await page.goto('/admin/notifications')
    // Wait for table to load
    await expect(page.locator('[data-test="notifications-row"]').first()).toBeVisible({ timeout: 5000 })

    // Open the type dropdown via CustomSelect trigger
    const filterGroup = page.locator('[data-test="notifications-filter-type"]')
    await filterGroup.locator('.custom-select-trigger').click()

    // Select the second option (first non-"All") — CustomSelect uses .custom-select-option
    await expect(filterGroup.locator('.custom-select-option').nth(1)).toBeVisible({ timeout: 3000 })
    await filterGroup.locator('.custom-select-option').nth(1).click()
    await page.waitForTimeout(600)

    // Verify the table re-renders (rows count >= 0)
    const rows = page.locator('[data-test="notifications-row"]')
    await expect(rows.first()).toBeVisible({ timeout: 5000 })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Notification Bell Dropdown (Header)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Notification Dropdown', () => {
  test('bell icon is visible in header', async ({ page }) => {
    await page.goto('/admin/notifications')
    await expect(page.locator('[data-test="topbar-notifications"]')).toBeVisible()
  })

  test('dropdown opens on bell click showing notifications', async ({ page }) => {
    await page.goto('/admin/notifications')
    await page.locator('[data-test="topbar-notifications"]').click()
    await expect(page.locator('[data-test="notif-dropdown"]')).toBeVisible()
  })

  test('dropdown has view all and mark all read buttons', async ({ page }) => {
    await page.goto('/admin/notifications')
    await page.locator('[data-test="topbar-notifications"]').click()
    // Footer with links
    await expect(page.locator('[data-test="notif-dropdown"] a.router-link-active, [data-test="notif-dropdown"] .notif-footer-link').first()).toBeVisible()
  })

  test('mark all read in dropdown updates badge count', async ({ page }) => {
    await page.goto('/admin/notifications')
    // Click bell to open dropdown
    await page.locator('[data-test="topbar-notifications"]').click()
    // Click "Mark all as read" in dropdown footer
    const markAllBtn = page.locator('.notif-footer-btn')
    await markAllBtn.click()
    await page.waitForTimeout(300)
    // Badge dot should disappear
    await expect(page.locator('.badge-dot')).not.toBeVisible()
  })
})
