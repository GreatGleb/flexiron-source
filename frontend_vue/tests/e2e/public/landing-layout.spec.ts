import { test, expect } from '../fixtures'
import { DATA_READY_TIMEOUT } from '../helpers/ready'
import { stubTurnstile } from './turnstileStub'

/**
 * Адаптив и доступность лендинга `/` (задача L-08, roo_code/plans/landing/landing-plan.md,
 * «Дизайн» — брейкпоинты 1200, 992, 768, 600, 375; горизонтальной прокрутки нет на 320–1440).
 * Меню-кнопка на ≤768, клавиатурная навигация до «Отправить заявку» с видимым фокусом,
 * alt у картинок, подписи и связанные ошибки у полей формы.
 */

/** Ширины задачи L-08. */
const PLAN_WIDTHS = [320, 375, 600, 768, 992, 1200, 1440]
/** Брейкпоинт с другой стороны: 769 — последняя ширина без меню-кнопки, 993 — с двумя колонками. */
const WIDTHS = [...PLAN_WIDTHS, 769, 993]
const MENU_MAX_WIDTH = 768

async function openLanding(page: import('@playwright/test').Page) {
  // Обход Tab касается формы — без подмены грузился бы настоящий скрипт Turnstile.
  await stubTurnstile(page)
  await page.goto('/ru')
  await expect(page.getByTestId('landing-header')).toBeVisible({ timeout: DATA_READY_TIMEOUT })
  // Последняя секция страницы отрисована — значит вся вёрстка на месте.
  await expect(page.getByTestId('landing-footer')).toBeAttached()
}

test('the width list covers every width of the task', () => {
  // Цикл ниже порождает тесты из списка: пустой список дал бы зелёный файл без единой проверки.
  expect(WIDTHS.length).toBeGreaterThan(0)
  for (const width of PLAN_WIDTHS) expect(WIDTHS).toContain(width)
})

for (const width of WIDTHS) {
  test.describe(`landing layout at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } })

    test('no horizontal scroll: the document is not wider than the window', async ({ page }) => {
      await openLanding(page)
      const size = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        innerWidth: window.innerWidth,
      }))
      expect(size.innerWidth).toBe(width)
      expect(size.documentWidth).toBeLessThanOrEqual(size.innerWidth)
      // Одного документа мало: у html и body свой overflow (public.css — body
      // { overflow-x: hidden }), прокручиваемая коробка — body, и scrollWidth документа равен
      // окну при любом содержимом (замер L-08: заголовок шириной 640 на 375 — документ 375,
      // body 656). scrollWidth самого body видит содержимое и под его обрезкой.
      expect(size.bodyWidth).toBeLessThanOrEqual(size.innerWidth)
    })

    test('nothing sticks out past the viewport', async ({ page }) => {
      await openLanding(page)
      // Второй замер — правый край каждого элемента: вылезание внутри контейнера с собственной
      // обрезкой scrollWidth документа не покажет.
      const sticking = await page.getByTestId('page-landing').evaluate((root) => {
        const limit = document.documentElement.clientWidth + 0.5
        return [root, ...root.querySelectorAll('*')]
          .filter((el) => el.getBoundingClientRect().right > limit)
          .map((el) => el.getAttribute('data-test') ?? el.className.toString())
      })
      expect(sticking).toEqual([])
    })

    test(`menu button is shown only at ≤${MENU_MAX_WIDTH}px`, async ({ page }) => {
      await openLanding(page)
      const toggle = page.getByTestId('landing-menu-toggle')
      const nav = page.getByTestId('landing-nav-link').first()
      if (width <= MENU_MAX_WIDTH) {
        await expect(toggle).toBeVisible()
        await expect(nav).toBeHidden()
      } else {
        await expect(toggle).toBeHidden()
        await expect(nav).toBeVisible()
      }
    })
  })
}

test.describe('landing header — mobile menu at 375px', () => {
  test.use({ viewport: { width: 375, height: 740 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/ru')
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

  test('menu works from the keyboard: Enter opens, Escape closes and returns focus', async ({
    page,
  }) => {
    const toggle = page.getByTestId('landing-menu-toggle')
    await toggle.focus()
    await page.keyboard.press('Enter')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByTestId('landing-menu')).toBeVisible()
    // Фокус уходит в меню Tab'ом: иначе он остался бы на кнопке, и проверка возврата фокуса
    // прошла бы без всякого возврата.
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('landing-nav-link').first()).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('landing-menu')).toBeHidden()
    await expect(toggle).toBeFocused()
  })

  test('clicking an anchor in the menu closes the menu', async ({ page }) => {
    const toggle = page.getByTestId('landing-menu-toggle')
    await toggle.click()
    await expect(page.getByTestId('landing-menu')).toBeVisible()
    await page.getByTestId('landing-nav-link').last().click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('landing-menu')).toBeHidden()
    await expect(page).toHaveURL(/#lead$/, { timeout: DATA_READY_TIMEOUT })
  })
})

type FocusStyle = { outline: string; boxShadow: string }

test.describe('landing — keyboard and focus', () => {
  test('Tab from the top reaches «Отправить заявку», and every focus is visible', async ({
    page,
  }) => {
    await openLanding(page)
    const submit = page.getByTestId('landing-lead-submit')
    await expect(submit).toHaveText('Отправить заявку')

    const steps: { label: string; focused: FocusStyle }[] = []
    let reached = false
    // Потолок шагов — с запасом над числом фокусируемых элементов страницы.
    for (let i = 0; i < 120 && !reached; i++) {
      await page.keyboard.press('Tab')
      const step = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        if (!el || el === document.body) return null
        const w = window as unknown as { __tabbed?: HTMLElement[] }
        w.__tabbed = [...(w.__tabbed ?? []), el]
        const style = getComputedStyle(el)
        return {
          label: el.getAttribute('data-test') ?? `${el.tagName}.${el.className}`,
          submit: el.getAttribute('data-test') === 'landing-lead-submit',
          focused: {
            outline:
              style.outlineStyle === 'none' || parseFloat(style.outlineWidth) === 0
                ? 'none'
                : `${style.outlineStyle} ${style.outlineWidth}`,
            boxShadow: style.boxShadow,
          },
        }
      })
      if (!step) continue
      steps.push({ label: step.label, focused: step.focused })
      reached = step.submit
    }
    expect(reached, `Tab sequence: ${steps.map((s) => s.label).join(' → ')}`).toBe(true)

    // Тот же элемент без фокуса — фокус обязан что-то менять, а не совпадать с обычным видом
    // (у основной кнопки, например, своя тень есть и без фокуса).
    const unfocused = await page.evaluate(() => {
      ;(document.activeElement as HTMLElement | null)?.blur()
      const w = window as unknown as { __tabbed?: HTMLElement[] }
      return (w.__tabbed ?? []).map((el) => {
        const style = getComputedStyle(el)
        return {
          outline:
            style.outlineStyle === 'none' || parseFloat(style.outlineWidth) === 0
              ? 'none'
              : `${style.outlineStyle} ${style.outlineWidth}`,
          boxShadow: style.boxShadow,
        }
      })
    })
    expect(unfocused).toHaveLength(steps.length)

    // Обход прошёл через ссылки, кнопки и поля формы, а не через один вид элементов.
    const labels = steps.map((s) => s.label)
    for (const kind of [
      'landing-nav-link',
      'landing-login',
      'landing-lead-name',
      'landing-lead-message',
    ]) {
      expect(labels).toContain(kind)
    }

    const invisible = steps
      .map((s, i) => ({ ...s, rest: unfocused[i]! }))
      .filter(
        (s) =>
          (s.focused.outline === 'none' && s.focused.boxShadow === 'none') ||
          (s.focused.outline === s.rest.outline && s.focused.boxShadow === s.rest.boxShadow),
      )
      .map((s) => s.label)
    expect(invisible).toEqual([])
  })
})

test.describe('landing — images and form semantics', () => {
  test('every img has a non-empty alt', async ({ page }) => {
    await openLanding(page)
    const alts = await page
      .getByTestId('page-landing')
      .locator('img')
      .evaluateAll((imgs) => imgs.map((img) => (img.getAttribute('alt') ?? '').trim()))
    expect(alts.length).toBeGreaterThan(0)
    expect(alts.filter((alt) => alt === '')).toEqual([])
  })

  test('every form field has a label with text', async ({ page }) => {
    await openLanding(page)
    const fields = await page
      .getByTestId('landing-lead-form')
      .locator('input:not([aria-hidden="true"]), textarea')
      .evaluateAll((els) =>
        els.map((el) => {
          const label = el.id ? document.querySelector(`label[for="${el.id}"]`) : null
          return {
            field: el.getAttribute('data-test') ?? '',
            label: (label?.textContent ?? '').trim(),
          }
        }),
      )
    expect(fields.map((f) => f.field)).toEqual([
      'landing-lead-name',
      'landing-lead-company',
      'landing-lead-contact',
      'landing-lead-message',
    ])
    expect(fields.filter((f) => f.label === '')).toEqual([])
  })

  test('validation errors are tied to their fields by aria-describedby', async ({ page }) => {
    await openLanding(page)
    const name = page.getByTestId('landing-lead-name')
    const contact = page.getByTestId('landing-lead-contact')
    // До ошибки поле ни на что не ссылается — связь появляется вместе с ошибкой.
    await expect(name).not.toHaveAttribute('aria-describedby', /.+/)
    await page.getByTestId('landing-lead-submit').click()

    for (const [field, testId] of [
      [name, 'landing-lead-name-error'],
      [contact, 'landing-lead-contact-error'],
    ] as const) {
      const error = page.getByTestId(testId)
      await expect(error).toBeVisible()
      await expect(error).not.toHaveText('')
      const errorId = await error.getAttribute('id')
      expect(errorId).toBeTruthy()
      await expect(field).toHaveAttribute('aria-describedby', errorId!)
      await expect(field).toHaveAttribute('aria-invalid', 'true')
    }
  })
})
