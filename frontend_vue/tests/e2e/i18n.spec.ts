import { test, expect } from './fixtures'

const LANGS = ['ru', 'en', 'lt'] as const

test.describe('Language switching — landing (via LangSwitcher)', () => {
  test('all three locales are reachable via switcher', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.lang-switcher')).toBeVisible()

    const title = page.locator('h1')
    const texts: Record<string, string> = {}
    for (const lang of LANGS) {
      await page.locator(`.lang-switcher .lang-btn:has-text("${lang.toUpperCase()}")`).click()
      await expect(page.locator('html')).toHaveAttribute('lang', lang)
      texts[lang] = (await title.textContent())?.trim() ?? ''
    }
    expect.soft(texts.ru, 'ru title non-empty').not.toBe('')
    expect.soft(texts.en, 'en title non-empty').not.toBe('')
    expect.soft(texts.lt, 'lt title non-empty').not.toBe('')
    expect.soft(texts.ru, 'ru and en titles differ').not.toBe(texts.en)
    expect.soft(texts.en, 'en and lt titles differ').not.toBe(texts.lt)
  })
})

test.describe('Language persistence (via localStorage) on admin pages', () => {
  for (const lang of LANGS) {
    test(`admin dashboard respects localStorage lang = ${lang}`, async ({ page, context }) => {
      await context.addInitScript((l) => {
        localStorage.setItem('flexiron_lang', l)
      }, lang)
      await page.goto('/admin/analytics/dashboard')
      await page.waitForLoadState('networkidle')
      await expect(page.locator('html')).toHaveAttribute('lang', lang)
    })
  }
})
