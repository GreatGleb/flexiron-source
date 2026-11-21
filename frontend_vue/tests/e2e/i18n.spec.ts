import { test, expect } from './fixtures'
import { DATA_READY_TIMEOUT, waitForDataReady } from './helpers/ready'

const LANGS = ['ru', 'en', 'lt'] as const

// Переключатель проверяется на /login: лендинг `/` пока только русский и переключатель
// прячет (решение 2 roo_code/plans/landing/landing-plan.md, meta.hideLangSwitcher).
test.describe('Language switching — public page (via LangSwitcher)', () => {
  test('all three locales are reachable via switcher', async ({ page }) => {
    await page.goto('/login')
    // /login объявлен в `ROUTES_WITHOUT_DATA`: ждать нечего, и хелпер говорит это
    // прямо — в отличие от `networkidle`, который «ждал» и на страницах с данными.
    await waitForDataReady(page)
    await expect(page.locator('.lang-switcher')).toBeVisible()

    const title = page.locator('h1')
    const texts: Record<string, string> = {}
    for (const lang of LANGS) {
      await page.locator(`.lang-switcher .lang-btn:has-text("${lang.toUpperCase()}")`).click()
      await expect(page.locator('html')).toHaveAttribute('lang', lang, {
        timeout: DATA_READY_TIMEOUT,
      })
      texts[lang] = (await title.textContent())?.trim() ?? ''
    }
    expect.soft(texts.ru, 'ru title non-empty').not.toBe('')
    expect.soft(texts.en, 'en title non-empty').not.toBe('')
    expect.soft(texts.lt, 'lt title non-empty').not.toBe('')
    expect.soft(texts.ru, 'ru and en titles differ').not.toBe(texts.en)
    expect.soft(texts.en, 'en and lt titles differ').not.toBe(texts.lt)
  })

  test('landing hides the switcher, /login shows it', async ({ page }) => {
    await page.goto('/')
    // Отсутствие доказывает что-то, только когда страница уже нарисована (питфолл #66):
    // сначала шапка лендинга, потом — что переключателя рядом нет.
    await expect(page.getByTestId('landing-header')).toBeVisible({ timeout: DATA_READY_TIMEOUT })
    await expect(page.locator('.lang-switcher')).toHaveCount(0)

    // Тот же переход внутри SPA: переключатель появляется по смене маршрута, а не по перезагрузке.
    await page.getByTestId('landing-login').first().click()
    await expect(page).toHaveURL('/login', { timeout: DATA_READY_TIMEOUT })
    await expect(page.locator('.lang-switcher')).toBeVisible()
  })
})

test.describe('Language persistence (via localStorage) on admin pages', () => {
  for (const lang of LANGS) {
    test(`admin dashboard respects localStorage lang = ${lang}`, async ({ page, context }) => {
      await context.addInitScript((l) => {
        localStorage.setItem('flexiron_lang', l)
      }, lang)
      await page.goto('/admin/analytics/dashboard')
      await waitForDataReady(page)
      await expect(page.locator('html')).toHaveAttribute('lang', lang)
    })
  }
})
