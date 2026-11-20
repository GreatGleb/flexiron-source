import { test, expect } from '../fixtures'
import { DATA_READY_TIMEOUT } from '../helpers/ready'

/**
 * Каркас лендинга `/` (задача L-03, roo_code/plans/landing/landing-plan.md):
 * порядок секций, якоря шапки, язык страницы, мобильное меню, липкий фон шапки.
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

test.describe('landing header — mobile menu', () => {
  test.use({ viewport: { width: 375, height: 740 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('landing-menu-toggle')).toBeVisible({
      timeout: DATA_READY_TIMEOUT,
    })
  })

  test('toggle opens the menu and reports it in aria-expanded', async ({ page }) => {
    const toggle = page.getByTestId('landing-menu-toggle')
    const menu = page.getByTestId('landing-menu')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(menu).toBeHidden()
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(menu).toBeVisible()
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(menu).toBeHidden()
  })

  test('Escape closes the menu and returns focus to the toggle', async ({ page }) => {
    const toggle = page.getByTestId('landing-menu-toggle')
    await toggle.click()
    await expect(page.getByTestId('landing-menu')).toBeVisible()
    // Фокус уходит в меню: иначе он остался бы на кнопке после клика, и проверка возврата
    // фокуса прошла бы без всякого возврата.
    await page.getByTestId('landing-nav-link').first().focus()
    await expect(toggle).not.toBeFocused()
    await page.keyboard.press('Escape')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('landing-menu')).toBeHidden()
    await expect(toggle).toBeFocused()
  })

  test('clicking a menu link closes the menu', async ({ page }) => {
    const toggle = page.getByTestId('landing-menu-toggle')
    await toggle.click()
    await page.getByTestId('landing-nav-link').last().click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('landing-menu')).toBeHidden()
    await expect(page).toHaveURL(/#lead$/, { timeout: DATA_READY_TIMEOUT })
  })
})

/** Брейкпоинты плана (1200, 992, 768, 600, 375) с обеих сторон и края диапазона 320–1440. */
const WIDTHS = [320, 375, 600, 768, 769, 992, 993, 1200, 1440]

for (const width of WIDTHS) {
  test.describe(`landing shell at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } })

    test('nothing sticks out past the viewport', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByTestId('landing-header')).toBeVisible({ timeout: DATA_READY_TIMEOUT })
      // Не scrollWidth документа: public.css ставит body { overflow-x: hidden }, и вылезший
      // блок прокрутки не даёт — его просто обрезает. Меряется правый край каждого элемента.
      const sticking = await page.getByTestId('page-landing').evaluate((root) => {
        const limit = document.documentElement.clientWidth + 0.5
        return [root, ...root.querySelectorAll('*')]
          .filter((el) => el.getBoundingClientRect().right > limit)
          .map((el) => el.getAttribute('data-test') ?? el.className.toString())
      })
      expect(sticking).toEqual([])
    })
  })
}
