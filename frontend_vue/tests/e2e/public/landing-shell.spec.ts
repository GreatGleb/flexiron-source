import { test, expect } from '../fixtures'
import { DATA_READY_TIMEOUT } from '../helpers/ready'

/**
 * Каркас лендинга `/` (задача L-03, roo_code/plans/landing/landing-plan.md):
 * порядок секций, якоря шапки, язык страницы, липкий фон шапки.
 * Содержимое секций проверяют спеки L-04…L-09.
 */

/** Таблица «Структура страницы» плана — порядок обязательный. */
const SECTION_ORDER = [
  'landing-header',
  'landing-hero',
  'landing-pains',
  'landing-flow',
  'landing-feature-warehouse',
  'landing-feature-cutting',
  'landing-feature-order',
  'landing-feature-money',
  'landing-feature-suppliers',
  'landing-feature-analytics',
  'landing-config',
  'landing-demo',
  'landing-roadmap',
  'landing-lead',
  'landing-footer',
]

test.describe('landing shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('page-landing')).toBeVisible({ timeout: DATA_READY_TIMEOUT })
  })

  test('sections 0–14 in plan order', async ({ page }) => {
    const order = await page.getByTestId('page-landing').evaluate((root, ids) => {
      const wanted = new Set(ids)
      return [...root.querySelectorAll('[data-test]')]
        .map((el) => el.getAttribute('data-test') ?? '')
        .filter((id) => wanted.has(id))
    }, SECTION_ORDER)
    expect(order).toEqual(SECTION_ORDER)
  })

  test('every header anchor leads to an element on the page', async ({ page }) => {
    const hrefs = await page
      .getByTestId('landing-header')
      .locator('a[href^="#"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''))
    // Четыре пункта навигации и «Оставить заявку».
    expect(hrefs).toEqual(['#features', '#flow', '#roadmap', '#lead', '#lead'])
    for (const href of new Set(hrefs)) {
      await expect(page.locator(href), `target of ${href}`).toHaveCount(1)
    }
  })

  test('html lang is ru on the landing and returns to the app locale after leaving', async ({
    page,
  }) => {
    // fixtures.ts ставит flexiron_lang = 'en': до лендинга документ был английским.
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
    await page.getByTestId('landing-login').click()
    await expect(page).toHaveURL('/login', { timeout: DATA_READY_TIMEOUT })
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
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
