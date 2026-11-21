import { test, expect } from '../fixtures'
import { DATA_READY_TIMEOUT } from '../helpers/ready'

/**
 * Секции 1–3 лендинга `/` (задача L-04, roo_code/plans/landing/landing-plan.md):
 * hero, боли, контур. Тексты сверяет landing.ru.spec.ts; здесь — поведение и разметка:
 * единственный h1, кнопки hero, язык демо (решение 3), акцент резки, отсутствие внешних
 * ресурсов.
 */

const LANG_KEY = 'flexiron_lang'

test.describe('landing hero, pains, flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ru')
    await expect(page.getByTestId('landing-hero')).toBeVisible({ timeout: DATA_READY_TIMEOUT })
  })

  test('exactly one h1 on the page, and it is in the hero', async ({ page }) => {
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.getByTestId('landing-hero').locator('h1')).toHaveText(
      'Склад, резка, заказы и деньги металлобазы — в одной системе',
    )
  })

  test('"Заказать показ" is an anchor to the lead form', async ({ page }) => {
    const lead = page.getByTestId('landing-hero-lead')
    await expect(lead).toHaveAttribute('href', '#lead')
    await expect(page.locator('#lead')).toHaveCount(1)
  })

  test('hero screenshot sits in the window frame with size, alt and caption', async ({ page }) => {
    const shot = page.getByTestId('landing-hero').getByTestId('landing-shot')
    await expect(shot.locator('.landing-shot-dot')).toHaveCount(3)
    const img = shot.locator('img')
    await expect(img).toHaveAttribute('alt', 'Панель управления')
    await expect(img).toHaveAttribute('width', /^\d+$/)
    await expect(img).toHaveAttribute('height', /^\d+$/)
    // Первый экран — без lazy: картинка hero нужна сразу.
    await expect(img).toHaveAttribute('loading', 'eager')
    await expect(shot.locator('figcaption')).toHaveText(
      'Из работающей программы на демонстрационных данных',
    )
  })

  test('pains: four cards with an icon each and the origin note', async ({ page }) => {
    const cards = page.getByTestId('landing-pain')
    await expect(cards).toHaveCount(4)
    for (const card of await cards.all()) {
      await expect(card.locator('svg')).toHaveCount(1)
      await expect(card.locator('h3')).not.toHaveText('')
    }
    await expect(page.getByTestId('landing-pains-note')).toContainText(
      'спроектирован по рабочим Excel-таблицам действующей металлобазы',
    )
  })

  test('flow: six steps, only "Резка" carries the accent colour', async ({ page }) => {
    const steps = page.getByTestId('landing-flow-step')
    await expect(steps).toHaveCount(6)
    const accent = await page.getByTestId('page-landing').evaluate((root) => {
      // Значение токена, переведённое в rgb() тем же способом, каким браузер отдаёт фон.
      const probe = document.createElement('span')
      probe.style.color = getComputedStyle(root).getPropertyValue('--landing-accent')
      root.appendChild(probe)
      const rgb = getComputedStyle(probe).color
      probe.remove()
      return rgb
    })
    expect(accent).toBe('rgb(242, 153, 74)')
    const painted = await steps.evaluateAll((els) =>
      els.map((el) => ({
        title: el.querySelector('h3')?.textContent?.trim() ?? '',
        bg: getComputedStyle(el.querySelector('[data-test="landing-flow-step-icon"]')!)
          .backgroundColor,
      })),
    )
    expect(painted.filter((s) => s.bg === accent).map((s) => s.title)).toEqual(['Резка'])
    // Остальные пять — не прозрачные, а свой цвет: акцент отличает шаг, а не отсутствие фона.
    for (const s of painted.filter((p) => p.title !== 'Резка')) {
      expect(s.bg, s.title).not.toBe('rgba(0, 0, 0, 0)')
    }
    await expect(page.getByTestId('landing-flow-note')).toContainText(
      'Аналитика видит весь контур.',
    )
  })

  test('icons are inline SVG and the page loads nothing from other origins', async ({ page }) => {
    const foreign: string[] = []
    const origin = new URL(page.url()).origin
    page.on('request', (req) => {
      const url = req.url()
      if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) {
        foreign.push(url)
      }
    })
    await page.reload()
    await expect(page.getByTestId('landing-flow')).toBeVisible({ timeout: DATA_READY_TIMEOUT })
    // Картинка hero дошла до конца загрузки — значит запросы первого экрана уже ушли.
    await expect
      .poll(
        () =>
          page
            .getByTestId('landing-hero')
            .locator('img')
            .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
        { timeout: DATA_READY_TIMEOUT },
      )
      .toBe(true)
    expect(foreign).toEqual([])
    // Иконки секций 1–3 — инлайн: <svg> с собственными фигурами, без <use href> и <img>.
    const icons = page.locator(
      '[data-test="landing-pains"] .landing-icon-circle, [data-test="landing-flow"] .landing-icon-circle',
    )
    await expect(icons).toHaveCount(4 + 6 + 1)
    const bad = await icons.evaluateAll((els) =>
      els
        .filter((el) => !el.querySelector('svg path') || el.querySelector('use, img'))
        .map((el) => el.outerHTML),
    )
    expect(bad).toEqual([])
  })
})

test.describe('landing hero — demo opens in Russian (decision 3)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ru')
    await expect(page.getByTestId('landing-hero-demo')).toBeVisible({
      timeout: DATA_READY_TIMEOUT,
    })
  })

  test('without a saved language the demo sets ru', async ({ page }) => {
    // fixtures.ts кладёт 'en' до загрузки; «человек язык не выбирал» — ключа нет вовсе.
    await page.evaluate((key) => localStorage.removeItem(key), LANG_KEY)
    await page.getByTestId('landing-hero-demo').click()
    await expect(page).toHaveURL(/\/admin\//, { timeout: DATA_READY_TIMEOUT })
    expect(await page.evaluate((key) => localStorage.getItem(key), LANG_KEY)).toBe('ru')
    // Демо и правда русское: локаль i18n сменилась вместе с ключом, без перезагрузки.
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  })

  test('the demo follows the landing language even over an earlier choice', async ({ page }) => {
    // Решение владельца 2026-11-21: пришёл с /ru — программа по-русски, что бы ни было выбрано раньше.
    expect(await page.evaluate((key) => localStorage.getItem(key), LANG_KEY)).toBe('en')
    await page.getByTestId('landing-hero-demo').click()
    await expect(page).toHaveURL(/\/admin\//, { timeout: DATA_READY_TIMEOUT })
    expect(await page.evaluate((key) => localStorage.getItem(key), LANG_KEY)).toBe('ru')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  })
})
