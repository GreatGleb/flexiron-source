import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import { DATA_READY_TIMEOUT } from '../helpers/ready'
import { SNAPSHOT_OPTIONS, waitForFontsReady } from '../helpers/visual'

/**
 * Сквозная спека лендинга `/` (задача L-09, roo_code/plans/landing/landing-plan.md):
 * загрузка без ошибок, порядок секций, переходы из шапки, демо и подвала, снимки по секциям.
 * Содержимое секций проверяют спеки L-03…L-08 рядом (landing-*.spec.ts).
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

/** Пункт шапки → секция, к которой он ведёт (первая секция цели по порядку плана). */
const HEADER_ANCHORS = [
  { label: 'Возможности', href: '#features', section: 'landing-feature-warehouse' },
  { label: 'Как это работает', href: '#flow', section: 'landing-flow' },
  { label: 'Что уже есть', href: '#roadmap', section: 'landing-roadmap' },
  { label: 'Заявка', href: '#lead', section: 'landing-lead' },
]

const FOOTER_LINKS = [
  { label: 'Поддержка', path: '/support' },
  { label: 'О продукте', path: '/about' },
  { label: 'Условия', path: '/terms' },
]

const DEMO_PATH = '/admin/analytics/dashboard'

async function openLanding(page: Page) {
  await page.goto('/ru')
  await expect(page.getByTestId('landing-hero')).toBeVisible({ timeout: DATA_READY_TIMEOUT })
}

/** Ушли с лендинга на `path`: адрес тот, а разметки лендинга больше нет. */
async function expectLeftTo(page: Page, path: string) {
  await expect(page).toHaveURL(path, { timeout: DATA_READY_TIMEOUT })
  await expect(page.getByTestId('page-landing')).toHaveCount(0)
}

test.describe('landing — whole page', () => {
  test('loads without console errors, page errors or failed requests', async ({ page }) => {
    const problems: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') problems.push(`console: ${msg.text()}`)
    })
    page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
    page.on('requestfailed', (req) => problems.push(`requestfailed: ${req.url()}`))
    page.on('response', (res) => {
      if (res.status() >= 400) problems.push(`${res.status()}: ${res.url()}`)
    })
    await openLanding(page)
    // Картинки ниже первого экрана ленивые: без прокрутки они не запрашивались бы вовсе,
    // и 404 по ним прошёл бы мимо. Каждая обязана загрузиться.
    const images = page.getByTestId('page-landing').locator('img')
    expect(await images.count()).toBeGreaterThan(1)
    for (const img of await images.all()) {
      await img.scrollIntoViewIfNeeded()
      await expect
        .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth), {
          timeout: DATA_READY_TIMEOUT,
        })
        .toBeGreaterThan(0)
    }
    expect(problems).toEqual([])
  })

  test('sections 0–14 in plan order', async ({ page }) => {
    await openLanding(page)
    const order = await page.getByTestId('page-landing').evaluate((root, ids) => {
      const wanted = new Set(ids)
      return [...root.querySelectorAll('[data-test]')]
        .map((el) => el.getAttribute('data-test') ?? '')
        .filter((id) => wanted.has(id))
    }, SECTION_ORDER)
    expect(order).toEqual(SECTION_ORDER)
  })
})

test.describe('landing — header anchors', () => {
  test('the header holds exactly these anchors, «Оставить заявку» included', async ({ page }) => {
    await openLanding(page)
    const hrefs = await page
      .getByTestId('landing-header')
      .locator('a[href^="#"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''))
    expect(hrefs).toEqual([...HEADER_ANCHORS.map((a) => a.href), '#lead'])
  })

  for (const anchor of HEADER_ANCHORS) {
    test(`«${anchor.label}» scrolls its section under the header`, async ({ page }) => {
      await openLanding(page)
      const section = page.getByTestId(anchor.section)
      const header = page.getByTestId('landing-header')
      // До клика секция ниже окна — иначе «доехали» было бы правдой без всякого перехода.
      const viewportHeight = page.viewportSize()!.height
      expect(await section.evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThan(
        viewportHeight,
      )
      await header.getByTestId('landing-nav-link').filter({ hasText: anchor.label }).click()
      await expect(page).toHaveURL(new RegExp(`${anchor.href}$`), { timeout: DATA_READY_TIMEOUT })
      // Верх секции встаёт сразу под липкой шапкой (scroll-margin-top = высота шапки + 16).
      // Одно условие с двумя краями: «ниже шапки» без верхнего края устроило бы и бездействие.
      const headerBottom = await header.evaluate((el) => el.getBoundingClientRect().bottom)
      await expect
        .poll(
          () =>
            section.evaluate((el, bottom) => {
              const top = el.getBoundingClientRect().top
              return top >= bottom - 1 && top < bottom + 40
            }, headerBottom),
          { timeout: DATA_READY_TIMEOUT },
        )
        .toBe(true)
    })
  }
})

test.describe('landing — ways out', () => {
  test('«Войти» opens /login', async ({ page }) => {
    await openLanding(page)
    await page.getByTestId('landing-login').click()
    await expectLeftTo(page, '/login')
  })

  for (const button of ['landing-hero-demo', 'landing-demo-open']) {
    test(`«Открыть демо» (${button}) opens ${DEMO_PATH} with its data`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await openLanding(page)
      const link = page.getByTestId(button)
      await expect(link).toHaveText('Открыть демо')
      await link.click()
      await expectLeftTo(page, DEMO_PATH)
      await expect(page.getByTestId('dashboard-kpi-card').first()).toBeVisible({
        timeout: DATA_READY_TIMEOUT,
      })
    })
  }

  test('footer holds exactly the plan links', async ({ page }) => {
    await openLanding(page)
    const links = page.getByTestId('landing-footer-link')
    await expect(links).toHaveText(FOOTER_LINKS.map((l) => l.label))
  })

  for (const link of FOOTER_LINKS) {
    test(`footer «${link.label}» opens ${link.path}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await openLanding(page)
      await page.getByTestId('landing-footer-link').filter({ hasText: link.label }).click()
      await expectLeftTo(page, link.path)
    })
  }
})

/**
 * Снимки по секциям. Анимации отключены: `reducedMotion: 'reduce'` — появление при прокрутке
 * не скрывает ничего (раздел «Движение» плана), `SNAPSHOT_OPTIONS` гасит CSS-переходы.
 *
 * Липкая шапка в снимках чужих секций спрятана (`visibility`, место за ней остаётся): иначе
 * она лежала бы поверх верха секции, и пиксели зависели бы от прокрутки. Опции `style` у
 * `toHaveScreenshot` нет (только `stylePath`) — поэтому стиль ставится на страницу.
 *
 * Окно выше самой высокой секции (деньги заказа — 971 px при 1280): секция, не влезшая в
 * окно, снимается за его краем, где фиксированного фона `.bg-image` уже нет.
 *
 * Две нижние секции (форма заявки, подвал) к верху окна не докручиваются — ниже не хватает
 * страницы, и их место в окне задаёт высота подвала. Поэтому правка подвала меняет и снимок
 * формы: фон за её стеклом сдвигается. Замер 2026-11-22: телефон в контактах — подвал 140 → 138 px,
 * форма краснеет без единого изменённого пикселя в ней самой.
 */
const HIDE_HEADER = '[data-test="landing-header"] { visibility: hidden !important; }'
const VISUAL_VIEWPORT = { width: 1280, height: 1100 }

test.describe('landing — visual @1280', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VISUAL_VIEWPORT)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openLanding(page)
    await waitForFontsReady(page)
  })

  for (const id of SECTION_ORDER) {
    test(`section ${id}`, async ({ page }) => {
      const section = page.getByTestId(id)
      // Верх секции — к верху окна. Фон `.bg-image` фиксирован, и то, что просвечивает сквозь
      // стекло, зависит от места секции в окне. `scrollIntoViewIfNeeded` ставил её туда, куда
      // выходило, — и сдвиг вёрстки в hero красил снимки шести нетронутых секций ниже.
      await section.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY))
      const images = section.locator('img')
      for (const img of await images.all()) {
        await expect
          .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth), {
            timeout: DATA_READY_TIMEOUT,
          })
          .toBeGreaterThan(0)
      }
      if (id !== 'landing-header') await page.addStyleTag({ content: HIDE_HEADER })
      await expect(section).toHaveScreenshot(`${id}.png`, SNAPSHOT_OPTIONS)
    })
  }
})
