import { test, expect } from '../fixtures'
import { DATA_READY_TIMEOUT } from '../helpers/ready'

/**
 * Секции 4–10 лендинга `/` (задача L-05, roo_code/plans/landing/landing-plan.md):
 * шесть фич и настройка — один компонент LandingFeature по данным landing.ru.ts.
 * Тексты дословно сверяет landing.ru.spec.ts; здесь — то, что видно только в отрисовке:
 * data-test и порядок, общая разметка, тёмная резка с плашкой, чередование сторон,
 * единственный dashboard.jpg и lazy/width/height у картинок ниже hero.
 */

/** Секции 4–10 в порядке таблицы плана, с ожидаемым составом. */
const SECTIONS = [
  {
    id: 'landing-feature-warehouse',
    title: 'Склад: каждая партия со своей себестоимостью',
    points: 4,
    icons: 0,
    steps: 0,
    cards: false,
  },
  {
    id: 'landing-feature-cutting',
    title: 'Резка: остаток после резки не теряется',
    points: 0,
    icons: 0,
    steps: 3,
    cards: false,
  },
  {
    id: 'landing-feature-order',
    title: 'Заказ: товары и услуги, маржа по каждой строке',
    points: 3,
    icons: 3,
    steps: 0,
    cards: false,
  },
  {
    id: 'landing-feature-money',
    title: 'Деньги заказа считаются, а не вводятся',
    points: 4,
    icons: 0,
    steps: 0,
    cards: true,
  },
  {
    id: 'landing-feature-suppliers',
    title: 'Закупка: запрос цен сразу нескольким поставщикам',
    points: 3,
    icons: 3,
    steps: 0,
    cards: false,
  },
  {
    id: 'landing-feature-analytics',
    title: 'Аналитика: прибыль и проблемы видны без выгрузок',
    points: 2,
    icons: 0,
    steps: 0,
    cards: false,
  },
  {
    id: 'landing-config',
    title: 'Настраивается под то, как работает ваша компания',
    points: 4,
    icons: 4,
    steps: 0,
    cards: false,
  },
] as const

const SECTION_IDS = SECTIONS.map((s) => s.id)

test.describe('landing features and config (sections 4–10)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('landing-config')).toBeVisible({ timeout: DATA_READY_TIMEOUT })
  })

  test('seven sections in plan order inside #features, each with its title', async ({ page }) => {
    const ids = await page
      .locator('#features > section')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-test')))
    expect(ids).toEqual(SECTION_IDS)
    for (const s of SECTIONS) {
      await expect(page.getByTestId(s.id).locator('h2'), s.id).toHaveText(s.title)
    }
  })

  test('all seven are drawn by one component: the same markup skeleton', async ({ page }) => {
    // Один компонент — одна разметка: у каждой секции та же обёртка, тело и рамка скриншота.
    const skeletons = await page
      .locator('#features > section')
      .evaluateAll((els) =>
        els.map((el) =>
          [
            el.classList.contains('landing-feature'),
            el.querySelectorAll(':scope > .landing-feature-inner').length,
            el.querySelectorAll('.landing-feature-inner > .landing-feature-body').length,
            el.querySelectorAll('.landing-feature-inner > [data-test="landing-shot"]').length,
          ].join(','),
        ),
      )
    expect(skeletons).toEqual(SECTION_IDS.map(() => 'true,1,1,1'))
  })

  test('each section shows its own points, steps and icons', async ({ page }) => {
    for (const s of SECTIONS) {
      const section = page.getByTestId(s.id)
      await expect(section.getByTestId('landing-feature-point'), s.id).toHaveCount(s.points)
      await expect(section.getByTestId('landing-feature-step'), s.id).toHaveCount(s.steps)
      await expect(section.locator('.landing-feature-point svg'), s.id).toHaveCount(s.icons)
      await expect(section.locator('.landing-feature-point.landing-card'), s.id).toHaveCount(
        s.cards ? s.points : 0,
      )
    }
  })

  test('cutting is the dark variant: numbered steps and the offcut plaque', async ({ page }) => {
    const cutting = page.getByTestId('landing-feature-cutting')
    await expect(cutting).toHaveClass(/landing-feature--dark/)
    // Тёмная полоса видна по фону, а не только по классу; у соседей фона нет.
    const backgrounds = await page
      .locator('#features > section')
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor))
    const transparent = 'rgba(0, 0, 0, 0)'
    expect(backgrounds.filter((bg) => bg !== transparent)).toHaveLength(1)
    expect(backgrounds[SECTION_IDS.indexOf('landing-feature-cutting')]).not.toBe(transparent)

    await expect(cutting.locator('.landing-feature-step-num')).toHaveText(['1', '2', '3'])
    const note = cutting.getByTestId('landing-feature-note')
    await expect(note).toHaveClass(/landing-feature-plaque/)
    await expect(note).toContainText('Обрезок становится отдельной позицией склада')
    // Плашка у страницы одна — сноска заказа остаётся сноской.
    await expect(page.locator('.landing-feature-plaque')).toHaveCount(1)
    const orderNote = page.getByTestId('landing-feature-order').getByTestId('landing-feature-note')
    await expect(orderNote).toHaveClass(/landing-note/)
    await expect(orderNote).toContainText('система сама предлагает подходящие обрезки')
  })

  test('dashboard.jpg appears on the page exactly once — in the hero', async ({ page }) => {
    const srcs = await page
      .locator('img')
      .evaluateAll((els) => els.map((el) => (el as HTMLImageElement).getAttribute('src') ?? ''))
    // Секции 4–10 отрисовались со своими картинками — иначе «один раз» было бы пустым фактом.
    expect(srcs.length).toBeGreaterThanOrEqual(1 + SECTIONS.length)
    expect(srcs.filter((src) => /dashboard/.test(src))).toHaveLength(1)
    await expect(page.getByTestId('landing-hero').locator('img')).toHaveAttribute(
      'src',
      /dashboard/,
    )
  })

  test('every image below the hero is lazy and has width and height', async ({ page }) => {
    const below = await page.locator('[data-test="page-landing"] img').evaluateAll((els) =>
      els
        .filter((el) => !el.closest('[data-test="landing-hero"], [data-test="landing-header"]'))
        .map((el) => ({
          src: el.getAttribute('src') ?? '',
          loading: el.getAttribute('loading'),
          width: Number(el.getAttribute('width')),
          height: Number(el.getAttribute('height')),
          alt: el.getAttribute('alt') ?? '',
        })),
    )
    expect(below.length).toBeGreaterThanOrEqual(SECTIONS.length)
    const bad = below.filter(
      (img) => img.loading !== 'lazy' || !(img.width > 0) || !(img.height > 0) || !img.alt,
    )
    expect(bad).toEqual([])
  })

  test('screenshots alternate sides on a wide screen', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const sides = await page.locator('#features > section').evaluateAll((els) =>
      els.map((el) => {
        const body = el.querySelector('.landing-feature-body')!.getBoundingClientRect()
        const shot = el.querySelector('[data-test="landing-shot"]')!.getBoundingClientRect()
        return shot.left < body.left ? 'left' : 'right'
      }),
    )
    expect(sides).toEqual(['left', 'right', 'left', 'right', 'left', 'right', 'left'])
  })

  test('on a narrow screen the screenshot goes under the text', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 })
    const below = await page.locator('#features > section').evaluateAll((els) =>
      els.map((el) => {
        const body = el.querySelector('.landing-feature-body')!.getBoundingClientRect()
        const shot = el.querySelector('[data-test="landing-shot"]')!.getBoundingClientRect()
        return shot.top >= body.bottom
      }),
    )
    expect(below).toEqual(SECTION_IDS.map(() => true))
  })
})
