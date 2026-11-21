import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { DATA_READY_TIMEOUT, ROUTES_WITHOUT_DATA_PATHS, waitForDataReady } from './helpers/ready'
import { ALL_FLAGS_ENABLED } from './helpers/flags'
import { ADMIN_ROUTES } from './helpers/adminRoutes'

/**
 * Русский скрыт от литовского и английского посетителя (этап 2 лендинга, пункт 4 — решение
 * владельца 2026-11-21; src/i18n/ruVisibility.ts): в Литве русский многими воспринимается
 * болезненно, и программа не должна выдавать, что он в ней есть.
 *
 * Перепись: каждая страница программы на lt и на en — ни кириллицы в видимом тексте, в
 * значениях полей и в подписях (placeholder, title, aria-label, alt), ни кнопки RU в переключателях. Так ловится
 * любой источник: забытый перевод, запасной вариант `tf()`, русская строка в демо-данных.
 *
 * Чего перепись НЕ видит: открытые окна, вкладки и выпадающие списки — только первый экран
 * страницы после загрузки данных.
 */

const CYRILLIC = /[А-Яа-яЁё]/

/** Русский на странице: строки текста и подписи с кириллицей, кнопки RU. */
async function russianOn(page: Page) {
  return page.evaluate((re) => {
    const cyr = new RegExp(re)
    const lines = document.body.innerText.split('\n').filter((l) => cyr.test(l))
    const labels = [...document.querySelectorAll('[placeholder],[title],[aria-label],img[alt]')]
      .map(
        (e) =>
          e.getAttribute('placeholder') ??
          e.getAttribute('title') ??
          e.getAttribute('aria-label') ??
          e.getAttribute('alt') ??
          '',
      )
      .filter((v) => cyr.test(v))
    // Значения полей в innerText не попадают — а заметка или имя в форме видны человеку так же.
    const fields = [...document.querySelectorAll('input, textarea')]
      .map((e) => (e as HTMLInputElement).value)
      .concat([...document.querySelectorAll('select')].map((e) => e.selectedOptions[0]?.text ?? ''))
      .filter((v) => cyr.test(v))
    const ruButtons = [...document.querySelectorAll('.lang-switcher a, .landing-lang a')].filter(
      (e) => e.textContent?.trim().toUpperCase() === 'RU',
    ).length
    return {
      lines: lines.slice(0, 5),
      labels: labels.slice(0, 5),
      fields: fields.slice(0, 5),
      ruButtons,
    }
  }, CYRILLIC.source)
}

const PUBLIC = ROUTES_WITHOUT_DATA_PATHS.filter((p) => p !== '/ru' && p !== '/404')

for (const lang of ['lt', 'en'] as const) {
  test(`no Russian anywhere in the app for a ${lang} visitor`, async ({ page, context }) => {
    test.setTimeout(600_000)
    await context.addInitScript(
      ({ code, flags }) => {
        localStorage.setItem('flexiron_lang', code)
        localStorage.removeItem('flexiron_ru')
        localStorage.setItem('ff_overrides', JSON.stringify(flags))
      },
      { code: lang, flags: ALL_FLAGS_ENABLED },
    )
    const found: string[] = []
    const routes = [...PUBLIC, ...ADMIN_ROUTES]
    for (const path of routes) {
      await page.goto(path)
      await waitForDataReady(page)
      const r = await russianOn(page)
      if (r.lines.length || r.labels.length || r.ruButtons)
        found.push(`${path}: ${JSON.stringify(r)}`)
    }
    // Перепись не пустая: пустой список маршрутов дал бы зелёный тест без единой проверки.
    expect(routes.length).toBeGreaterThan(40)
    expect(found).toEqual([])
  })
}

test.describe('RU in the app follows the landing it came from', () => {
  test('from /lt: no RU in the admin switchers', async ({ page }) => {
    await page.goto('/lt')
    await page.getByTestId('landing-hero-demo').click()
    await expect(page).toHaveURL(/\/admin\//, { timeout: DATA_READY_TIMEOUT })
    await expect(page.getByTestId('topbar-lang-lt')).toBeVisible()
    await expect(page.getByTestId('topbar-lang-ru')).toHaveCount(0)
    await expect(page.getByTestId('sidebar-lang-ru')).toHaveCount(0)
  })

  test('from /ru: RU is there and active', async ({ page }) => {
    await page.goto('/ru')
    await page.getByTestId('landing-hero-demo').click()
    await expect(page).toHaveURL(/\/admin\//, { timeout: DATA_READY_TIMEOUT })
    await expect(page.getByTestId('topbar-lang-ru')).toHaveClass(/active/)
  })

  test('/ru, then /en: RU is hidden again', async ({ page }) => {
    await page.goto('/ru')
    await page.getByTestId('landing-hero-demo').click()
    await expect(page.getByTestId('topbar-lang-ru')).toBeVisible({ timeout: DATA_READY_TIMEOUT })
    await page.goto('/en')
    await page.getByTestId('landing-login').first().click()
    await expect(page).toHaveURL('/login', { timeout: DATA_READY_TIMEOUT })
    await expect(page.locator('.lang-switcher')).toBeVisible()
    await expect(page.locator('.lang-switcher a')).toHaveText(['EN', 'LT'])
  })
})
