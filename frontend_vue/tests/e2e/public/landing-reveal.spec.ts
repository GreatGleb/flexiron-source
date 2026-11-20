import { test, expect } from '../fixtures'
import type { Page } from '@playwright/test'
import { DATA_READY_TIMEOUT } from '../helpers/ready'

/**
 * Появление блоков лендинга при прокрутке (задача L-07, roo_code/plans/landing/landing-plan.md,
 * «Движение»; механизм — src/composables/useReveal.ts). Параметры и размонтирование сверяет
 * useReveal.spec.ts; здесь — настоящий браузер: что скрыто при загрузке, что видно без
 * анимации и что проявляется после прокрутки.
 */

const PENDING = 'reveal-pending'
const TALL = { width: 1280, height: 1200 }

type RevealState = { top: number; pending: boolean; opacity: string; inHero: boolean }

/** Состояние каждого помеченного элемента страницы — одним чтением. */
async function revealStates(page: Page): Promise<RevealState[]> {
  return page.locator('[data-reveal]').evaluateAll(
    (els, pendingClass) =>
      els.map((el) => ({
        top: el.getBoundingClientRect().top,
        pending: el.classList.contains(pendingClass),
        opacity: getComputedStyle(el).opacity,
        inHero: Boolean(el.closest('[data-test="landing-hero"]')),
      })),
    PENDING,
  )
}

async function openLanding(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('landing-hero')).toBeVisible({ timeout: DATA_READY_TIMEOUT })
}

test.describe('landing reveal on scroll', () => {
  test('on load nothing on the first screen is hidden, everything below the window is', async ({
    page,
  }) => {
    // Высокое окно: на первый экран попадает не только hero (он не скрывается никогда), но и
    // заголовок с карточками болей — их и проверяем; при 720 px там один hero (#66).
    await page.setViewportSize(TALL)
    await openLanding(page)
    const states = await revealStates(page)
    const firstScreen = states.filter((s) => s.top < TALL.height)
    const below = states.filter((s) => s.top >= TALL.height)

    // Обе группы непусты — иначе утверждения ниже выполнялись бы на пустом месте (#66).
    expect(firstScreen.filter((s) => !s.inHero).length).toBeGreaterThan(0)
    expect(below.length).toBeGreaterThan(10)

    expect(firstScreen.filter((s) => s.pending)).toEqual([])
    expect(firstScreen.filter((s) => !s.inHero && s.opacity !== '1')).toEqual([])
    expect(below.filter((s) => !s.pending)).toEqual([])
    // Скрытые — действительно невидимы до прокрутки.
    expect(below.filter((s) => s.opacity !== '0')).toEqual([])
  })

  test('hero is shown on load without scrolling', async ({ page }) => {
    await openLanding(page)
    const h1 = page.getByTestId('landing-hero').locator('h1')
    await expect(h1).not.toHaveClass(new RegExp(PENDING))
    await expect
      .poll(() => h1.evaluate((el) => getComputedStyle(el).opacity), {
        timeout: DATA_READY_TIMEOUT,
      })
      .toBe('1')
  })

  test('an element below the window becomes visible after scrollIntoView', async ({ page }) => {
    await openLanding(page)
    const title = page.getByTestId('landing-lead').locator('h2')
    // До прокрутки — скрыт: иначе «стал видимым» ничего бы не доказывало (#68).
    await expect(title).toHaveClass(new RegExp(PENDING))
    expect(await title.evaluate((el) => getComputedStyle(el).opacity)).toBe('0')

    await title.evaluate((el) => el.scrollIntoView({ block: 'center' }))

    await expect
      .poll(() => title.evaluate((el) => getComputedStyle(el).opacity), {
        timeout: DATA_READY_TIMEOUT,
      })
      .toBe('1')
    await expect(title).not.toHaveClass(new RegExp(PENDING))
  })

  test('prefers-reduced-motion: every section is visible without scrolling', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openLanding(page)
    const states = await revealStates(page)
    const viewport = page.viewportSize()!

    // Ниже окна есть что скрывать — без reduce эти элементы были бы скрыты (тест выше).
    expect(states.filter((s) => s.top >= viewport.height).length).toBeGreaterThan(10)
    expect(states.filter((s) => s.pending || s.opacity !== '1')).toEqual([])
    const animated = await page
      .locator('[data-reveal]')
      .evaluateAll((els) => els.filter((el) => el.getAnimations().length > 0).length)
    expect(animated).toBe(0)
  })
})
