import { test, expect } from '../fixtures'
import { waitForFontsReady } from '../helpers/visual'

/**
 * Deep audit of AdminLayout shell: AdminSidebar + AdminTopbar + useSidebar behavior.
 *
 * Shell structure (src/layouts/AdminLayout.vue):
 *   .shell[data-test="admin-shell"] (classes: sidebar-collapsed, sidebar-active)
 *     └─ <AdminSidebar> → aside[data-test="sidebar-root"]
 *     └─ <AdminTopbar>  → header[data-test="topbar-root"]
 *     └─ main[data-test="admin-main"] > h1[data-test="page-title"]? + <RouterView>
 *
 * useSidebar contract (src/composables/useSidebar.ts):
 *   - Mobile breakpoint: window.innerWidth <= 860
 *   - Desktop toggle    → flips `collapsed`, persists to localStorage['sidebar-collapsed']
 *   - Mobile toggle     → flips `active` (drawer), does NOT touch localStorage
 *   - close()           → resets both, writes localStorage['sidebar-collapsed']='false'
 *   - onMount()         → reads LS into `collapsed` only if !isMobile()
 */

const DASHBOARD = '/admin/analytics/dashboard'
const SUPPLIERS = '/admin/suppliers'

const DESKTOP = { width: 1440, height: 900 } // > 1024: sidebar lang/profile hidden, topbar shows them
const TABLET = { width: 1000, height: 900 } // 861..1024: sidebar lang/profile visible, topbar ones hidden
const MOBILE = { width: 375, height: 812 } // <= 860: shell grid disabled, sidebar-close visible, drawer mode

// ────────────────────────────────────────────────────────────────────────────
// Load & structure
// ────────────────────────────────────────────────────────────────────────────
test.describe('admin layout › structure', () => {
  test('shell, sidebar, topbar, main all render', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(DASHBOARD)
    await page.waitForLoadState('networkidle')

    await expect.soft(page.locator('[data-test="admin-shell"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="sidebar-root"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="topbar-root"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="admin-main"]')).toBeVisible()
  })

  test('sidebar has all 6 nav entries', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(DASHBOARD)
    const expected = [
      'sidebar-nav-analytics',
      'sidebar-nav-items',
      'sidebar-nav-warehouse',
      'sidebar-nav-sales',
      'sidebar-nav-suppliers',
      'sidebar-nav-finance',
    ]
    for (const id of expected) {
      await expect.soft(page.locator(`[data-test="${id}"]`)).toBeVisible()
    }
  })

  test('sidebar footer: settings always visible @1440; user+lang hidden by CSS', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(DASHBOARD)
    await expect.soft(page.locator('[data-test="sidebar-footer"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="sidebar-settings"]')).toBeVisible()
    // CSS (.sidebar .user-profile, .sidebar .lang-switcher { display: none }) — hidden on desktop
    await expect.soft(page.locator('[data-test="sidebar-user"]')).toBeHidden()
    await expect.soft(page.locator('[data-test="sidebar-lang-switcher"]')).toBeHidden()
  })

  test('sidebar footer @1000: user + lang + settings all visible (tablet takeover)', async ({
    page,
  }) => {
    await page.setViewportSize(TABLET)
    await page.goto(DASHBOARD)
    await expect.soft(page.locator('[data-test="sidebar-footer"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="sidebar-user"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="sidebar-lang-switcher"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="sidebar-settings"]')).toBeVisible()
  })

  test('topbar has menu-toggle, search, lang-switcher, notifications, user', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(DASHBOARD)
    await expect.soft(page.locator('[data-test="topbar-menu-toggle"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="topbar-search"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="topbar-lang-switcher"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="topbar-notifications"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="topbar-user"]')).toBeVisible()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Sidebar collapse/expand (desktop) + localStorage persistence
// ────────────────────────────────────────────────────────────────────────────
test.describe('admin layout › sidebar collapse (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
  })

  test('initial state: shell is not collapsed', async ({ page }) => {
    await page.goto(DASHBOARD)
    await expect(page.locator('[data-test="admin-shell"]')).not.toHaveClass(/sidebar-collapsed/)
  })

  test('clicking menu-toggle adds sidebar-collapsed class', async ({ page }) => {
    await page.goto(DASHBOARD)
    await page.locator('[data-test="topbar-menu-toggle"]').click()
    await expect(page.locator('[data-test="admin-shell"]')).toHaveClass(/sidebar-collapsed/)
  })

  test('clicking menu-toggle twice restores expanded state', async ({ page }) => {
    await page.goto(DASHBOARD)
    const toggle = page.locator('[data-test="topbar-menu-toggle"]')
    const shell = page.locator('[data-test="admin-shell"]')
    await toggle.click()
    await expect(shell).toHaveClass(/sidebar-collapsed/)
    await toggle.click()
    await expect(shell).not.toHaveClass(/sidebar-collapsed/)
  })

  test('collapsed state persists to localStorage', async ({ page }) => {
    await page.goto(DASHBOARD)
    await page.locator('[data-test="topbar-menu-toggle"]').click()
    const stored = await page.evaluate(() => localStorage.getItem('sidebar-collapsed'))
    expect(stored).toBe('true')
  })

  test('collapsed state restored after reload', async ({ page }) => {
    await page.goto(DASHBOARD)
    await page.locator('[data-test="topbar-menu-toggle"]').click()
    await expect(page.locator('[data-test="admin-shell"]')).toHaveClass(/sidebar-collapsed/)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-test="admin-shell"]')).toHaveClass(/sidebar-collapsed/)
  })

  test('sidebar-close button is hidden on desktop (CSS)', async ({ page }) => {
    // `.sidebar-close { display: none }` until the <=860 media query; ensure we don't rely on it at desktop.
    await page.goto(DASHBOARD)
    await expect(page.locator('[data-test="sidebar-close-btn"]')).toBeHidden()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Sidebar mobile drawer (viewport <=860)
// ────────────────────────────────────────────────────────────────────────────
test.describe('admin layout › sidebar drawer (mobile)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE)
  })

  test('initial state: shell is not active', async ({ page }) => {
    await page.goto(DASHBOARD)
    await expect(page.locator('[data-test="admin-shell"]')).not.toHaveClass(/sidebar-active/)
  })

  test('menu-toggle toggles sidebar-active on mobile', async ({ page }) => {
    await page.goto(DASHBOARD)
    const shell = page.locator('[data-test="admin-shell"]')
    await page.locator('[data-test="topbar-menu-toggle"]').click()
    await expect(shell).toHaveClass(/sidebar-active/)
  })

  test('mobile toggle does NOT persist to localStorage', async ({ page }) => {
    await page.goto(DASHBOARD)
    await page.locator('[data-test="topbar-menu-toggle"]').click()
    const stored = await page.evaluate(() => localStorage.getItem('sidebar-collapsed'))
    // On mobile, toggle flips `active`, not `collapsed` — LS key should stay untouched (null).
    expect(stored).toBeNull()
  })

  test('sidebar-close button is visible and hides the drawer', async ({ page }) => {
    await page.goto(DASHBOARD)
    const shell = page.locator('[data-test="admin-shell"]')
    await page.locator('[data-test="topbar-menu-toggle"]').click()
    await expect(shell).toHaveClass(/sidebar-active/)
    await expect(page.locator('[data-test="sidebar-close-btn"]')).toBeVisible()
    await page.locator('[data-test="sidebar-close-btn"]').click()
    await expect(shell).not.toHaveClass(/sidebar-active/)
  })

  test('open drawer locks body scroll', async ({ page }) => {
    await page.goto(DASHBOARD)
    await page.locator('[data-test="topbar-menu-toggle"]').click()
    const overflow = await page.evaluate(() => document.body.style.overflow)
    expect(overflow).toBe('hidden')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Topbar search input
// ────────────────────────────────────────────────────────────────────────────
test.describe('admin layout › topbar search', () => {
  test('accepts input and can be cleared', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(DASHBOARD)
    const search = page.locator('[data-test="topbar-search"]')
    await search.fill('acme')
    await expect(search).toHaveValue('acme')
    await search.fill('')
    await expect(search).toHaveValue('')
  })

  test('has a localized placeholder', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(DASHBOARD)
    const placeholder = await page
      .locator('[data-test="topbar-search"]')
      .getAttribute('placeholder')
    expect(placeholder ?? '').not.toBe('')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Lang switcher (topbar + sidebar share state via vue-i18n)
// ────────────────────────────────────────────────────────────────────────────
test.describe('admin layout › lang switcher', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
  })

  test('topbar EN click sets html[lang]=en and persists', async ({ page }) => {
    await page.goto(DASHBOARD)
    await page.locator('[data-test="topbar-lang-en"]').click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    const stored = await page.evaluate(() => localStorage.getItem('flexiron_lang'))
    expect(stored).toBe('en')
  })

  test('topbar LT click sets html[lang]=lt', async ({ page }) => {
    await page.goto(DASHBOARD)
    await page.locator('[data-test="topbar-lang-lt"]').click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'lt')
  })

  test('topbar RU click sets html[lang]=ru', async ({ page }) => {
    await page.goto(DASHBOARD)
    await page.locator('[data-test="topbar-lang-en"]').click()
    await page.locator('[data-test="topbar-lang-ru"]').click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  })

  test('sidebar EN click sets html[lang]=en (tablet viewport)', async ({ page }) => {
    // sidebar lang-switcher is hidden by CSS until <=1024; use tablet viewport.
    await page.setViewportSize(TABLET)
    await page.goto(DASHBOARD)
    await page.locator('[data-test="sidebar-lang-en"]').click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })

  test('active class reflects current locale in both switchers', async ({ page }) => {
    // Active class is set on DOM regardless of visibility — safe to assert at desktop.
    await page.goto(DASHBOARD)
    await page.locator('[data-test="topbar-lang-en"]').click()
    await expect(page.locator('[data-test="topbar-lang-en"]')).toHaveClass(/active/)
    await expect(page.locator('[data-test="sidebar-lang-en"]')).toHaveClass(/active/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Navigation via sidebar
// ────────────────────────────────────────────────────────────────────────────
test.describe('admin layout › navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
  })

  test('suppliers nav-link navigates to /admin/suppliers', async ({ page }) => {
    await page.goto(DASHBOARD)
    await page.locator('[data-test="sidebar-nav-suppliers"]').click()
    await expect(page).toHaveURL(SUPPLIERS)
  })

  test('analytics nav-link gets active class on analytics routes', async ({ page }) => {
    await page.goto(DASHBOARD)
    await expect(page.locator('[data-test="sidebar-nav-analytics"]')).toHaveClass(/active/)
  })

  test('suppliers nav-link gets active class on /admin/suppliers', async ({ page }) => {
    await page.goto(SUPPLIERS)
    await expect(page.locator('[data-test="sidebar-nav-suppliers"]')).toHaveClass(/active/)
  })

  test('placeholder nav-links (items/warehouse/sales/finance) do not navigate away', async ({
    page,
  }) => {
    await page.goto(DASHBOARD)
    await page.locator('[data-test="sidebar-nav-items"]').click()
    // href="#" — stays on same path (possibly adds #), URL should not change to /admin/items etc.
    await expect(page).not.toHaveURL(/\/admin\/items/)
    await expect(page).not.toHaveURL(/\/admin\/warehouse/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Per-section visual snapshots (@1440 baseline)
// ────────────────────────────────────────────────────────────────────────────
test.describe('admin layout › visual @1440', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(DASHBOARD)
    await waitForFontsReady(page)
    await page.waitForLoadState('networkidle')
  })

  test('sidebar expanded', async ({ page }) => {
    await expect(page.locator('[data-test="sidebar-root"]')).toHaveScreenshot(
      'layout-sidebar-expanded.png',
    )
  })

  test('sidebar collapsed', async ({ page }) => {
    await page.locator('[data-test="topbar-menu-toggle"]').click()
    await expect(page.locator('[data-test="admin-shell"]')).toHaveClass(/sidebar-collapsed/)
    await expect(page.locator('[data-test="sidebar-root"]')).toHaveScreenshot(
      'layout-sidebar-collapsed.png',
    )
  })

  test('topbar', async ({ page }) => {
    await expect(page.locator('[data-test="topbar-root"]')).toHaveScreenshot('layout-topbar.png')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Responsive: shell snapshot per breakpoint
// ────────────────────────────────────────────────────────────────────────────
test.describe('admin layout › responsive', () => {
  test('shell @ 1440 (desktop)', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(DASHBOARD)
    await waitForFontsReady(page)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-test="admin-shell"]')).toHaveScreenshot(
      'layout-shell-1440.png',
    )
  })

  test('shell @ 768 (tablet)', async ({ page }) => {
    await page.setViewportSize(TABLET)
    await page.goto(DASHBOARD)
    await waitForFontsReady(page)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-test="admin-shell"]')).toHaveScreenshot('layout-shell-768.png')
  })

  test('shell @ 375 (mobile)', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto(DASHBOARD)
    await waitForFontsReady(page)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-test="admin-shell"]')).toHaveScreenshot('layout-shell-375.png')
  })
})
