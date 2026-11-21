import { test, expect } from '../fixtures'
import { DATA_READY_TIMEOUT } from '../helpers/ready'

/**
 * Каркас лендинга `/` (задача L-03, roo_code/plans/landing/landing-plan.md):
 * язык страницы, заголовок документа, липкий фон шапки.
 * Порядок секций и якоря шапки — tests/e2e/public/landing.spec.ts (L-09).
 */

test.describe('landing shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ru')
    await expect(page.getByTestId('page-landing')).toBeVisible({ timeout: DATA_READY_TIMEOUT })
  })

  test('html lang is ru on /ru and stays ru in the app after leaving', async ({ page }) => {
    // fixtures.ts ставит flexiron_lang = 'en'; уход с /ru переводит программу на русский
    // (решение владельца 2026-11-21: язык программы — по версии лендинга).
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
    await page.getByTestId('landing-login').click()
    await expect(page).toHaveURL('/login', { timeout: DATA_READY_TIMEOUT })
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  })

  test('document title comes from the landing content', async ({ page }) => {
    await expect(page).toHaveTitle('Flexiron — ERP/CRM для металлобаз и металлоцентров')
  })

  test('header gets its background only after scrolling', async ({ page }) => {
    const header = page.getByTestId('landing-header')
    await expect(header).not.toHaveClass(/landing-header--scrolled/)
    // Пустые секции L-03 не дают странице высоты — прокрутку обеспечивает сам тест.
    await page.evaluate(() => {
      document.body.style.minHeight = '3000px'
      window.scrollTo(0, 400)
    })
    await expect(header).toHaveClass(/landing-header--scrolled/)
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(header).not.toHaveClass(/landing-header--scrolled/)
  })
})

// Мобильное меню и ширины 320–1440 — tests/e2e/public/landing-layout.spec.ts (L-08).
