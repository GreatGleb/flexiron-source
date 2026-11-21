import type { Page, Route } from '@playwright/test'
import { test, expect } from '../fixtures'
import { DATA_READY_TIMEOUT } from '../helpers/ready'
import { solveTurnstile, stubTurnstile, turnstileResets } from './turnstileStub'

/**
 * Секции 11–13 лендинга `/` (задача L-06, roo_code/plans/landing/landing-plan.md):
 * полоса демо, дорожная карта, форма заявки.
 *
 * Адрес Apps Script в e2e — `https://leads.invalid/exec` (env первого webServer,
 * playwright.config.ts, решение 4). Запрос формы — настоящий `fetch`, мок-слой его не касается,
 * поэтому `page.route` его действительно перехватывает (#71). Каждый перехват считается:
 * «запроса нет» доказывается счётчиком, а не отсутствием экрана ошибки.
 *
 * Состояние `disabled` (адрес пуст) здесь не проверить — адрес задан на весь сервер; его
 * проверяет компонентный тест LandingLeadForm.spec.ts.
 *
 * Капча — подставной Turnstile (turnstileStub.ts): site key берётся из .env, а скрипт с
 * challenges.cloudflare.com перехвачен, так что в сеть тест не ходит.
 */

const LEADS = 'https://leads.invalid/**'
const CORS = { 'Access-Control-Allow-Origin': '*' }

const NAME = 'Иван Петров'
const COMPANY = 'Металл-Опт'
const CONTACT = 'ivan@metal-opt.lt'
const MESSAGE = 'Два склада, три менеджера'

interface Leads {
  calls: () => number
  bodies: string[]
}

/** Перехват адреса заявок со счётчиком; `reply` решает, чем ответить. */
async function interceptLeads(page: Page, reply: (route: Route) => Promise<void>): Promise<Leads> {
  let calls = 0
  const bodies: string[] = []
  await page.route(LEADS, async (route) => {
    calls += 1
    bodies.push(route.request().postData() ?? '')
    await reply(route)
  })
  return { calls: () => calls, bodies }
}

const okReply = (route: Route) => route.fulfill({ status: 200, headers: CORS, json: { ok: true } })

async function fillValid(page: Page) {
  await page.getByTestId('landing-lead-name').fill(NAME)
  await page.getByTestId('landing-lead-company').fill(COMPANY)
  await page.getByTestId('landing-lead-contact').fill(CONTACT)
  await page.getByTestId('landing-lead-message').fill(MESSAGE)
}

test.describe('landing demo strip and roadmap', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ru')
    await expect(page.getByTestId('landing-hero')).toBeVisible({ timeout: DATA_READY_TIMEOUT })
  })

  test('demo strip opens the demo in Russian when no language was chosen', async ({ page }) => {
    const strip = page.getByTestId('landing-demo')
    await expect(strip.locator('h2')).toHaveText('Посмотрите сами')
    await expect(strip).toContainText('Вся программа на демонстрационных данных, без регистрации')
    // fixtures.ts ставит язык 'en' — снимаем, чтобы проверить ветку «язык не выбирали».
    await page.evaluate(() => localStorage.removeItem('flexiron_lang'))
    // Полоса появляется при прокрутке (L-07): во время задержки анимации она стоит на месте
    // со сдвигом, и клик Playwright уходит мимо кнопки, когда она начинает подниматься.
    // Кликаем по проявившейся — как человек, который её видит.
    const revealed = strip.locator('[data-reveal]')
    await revealed.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await expect
      .poll(
        () =>
          revealed.evaluate(
            (el) => el.getAnimations().length + Number(el.classList.contains('reveal-pending')),
          ),
        { timeout: DATA_READY_TIMEOUT },
      )
      .toBe(0)
    await page.getByTestId('landing-demo-open').click()
    await expect(page).toHaveURL(/\/admin\//, { timeout: DATA_READY_TIMEOUT })
    expect(await page.evaluate(() => localStorage.getItem('flexiron_lang'))).toBe('ru')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  })

  test('roadmap: two columns, done is green and next is orange', async ({ page }) => {
    const done = page.getByTestId('landing-roadmap-done')
    const next = page.getByTestId('landing-roadmap-next')
    await expect(done.locator('h3')).toHaveText('Уже в системе')
    await expect(next.locator('h3')).toHaveText('В разработке')
    await expect(done.locator('li')).toHaveCount(5)
    await expect(next.locator('li')).toHaveCount(3)
    await expect(next.locator('li').first()).toHaveText('Печать счетов и CMR')
    await expect(done.locator('h3')).toHaveCSS('color', 'rgb(39, 174, 96)')
    await expect(next.locator('h3')).toHaveCSS('color', 'rgb(242, 153, 74)')
  })
})

test.describe('landing lead form', () => {
  test.beforeEach(async ({ page }) => {
    await stubTurnstile(page)
    await page.goto('/ru')
    await expect(page.getByTestId('landing-lead-form')).toHaveAttribute('data-state', 'idle', {
      timeout: DATA_READY_TIMEOUT,
    })
  })

  test('successful submit shows thanks and sends what was typed', async ({ page }) => {
    const leads = await interceptLeads(page, okReply)
    await fillValid(page)
    await page.getByTestId('landing-lead-submit').click()

    const form = page.getByTestId('landing-lead-form')
    await expect(form).toHaveAttribute('data-state', 'success')
    await expect(page.getByTestId('landing-lead-success')).toHaveText(
      'Спасибо! Свяжемся в течение рабочего дня',
    )
    await expect(page.getByTestId('landing-lead-name')).toHaveCount(0)

    expect(leads.calls()).toBe(1)
    const body = JSON.parse(leads.bodies[0]!) as Record<string, string>
    expect(body).toMatchObject({ name: NAME, company: COMPANY, contact: CONTACT, message: MESSAGE })
    expect(body.page).toBe(page.url())
    expect(body.captcha).toBe('e2e-token-1')
    expect(body).not.toHaveProperty('website')
  })

  test('{ok:false} → error, typed values kept, contacts shown', async ({ page }) => {
    const leads = await interceptLeads(page, (route) =>
      route.fulfill({ status: 200, headers: CORS, json: { ok: false, error: 'invalid' } }),
    )
    await fillValid(page)
    await page.getByTestId('landing-lead-submit').click()

    await expect(page.getByTestId('landing-lead-form')).toHaveAttribute('data-state', 'error')
    const failed = page.getByTestId('landing-lead-failed')
    await expect(failed).toContainText('Не удалось отправить. Напишите нам напрямую:')
    await expect(failed.locator('a[href^="mailto:"]')).toBeVisible()
    await expect(page.getByTestId('landing-lead-name')).toHaveValue(NAME)
    await expect(page.getByTestId('landing-lead-contact')).toHaveValue(CONTACT)
    await expect(page.getByTestId('landing-lead-message')).toHaveValue(MESSAGE)
    expect(leads.calls()).toBe(1)
    // Токен израсходован сервером — форма берёт новый, повторная отправка уходит с ним.
    expect(await turnstileResets(page)).toBe(1)
    await page.unroute(LEADS)
    const retry = await interceptLeads(page, okReply)
    await expect(page.getByTestId('landing-lead-captcha')).toHaveAttribute('data-status', 'solved')
    await page.getByTestId('landing-lead-submit').click()
    await expect(page.getByTestId('landing-lead-form')).toHaveAttribute('data-state', 'success')
    expect(retry.calls()).toBe(1)
    expect((JSON.parse(retry.bodies[0]!) as Record<string, string>).captcha).toBe('e2e-token-2')
  })

  test('network failure → error', async ({ page }) => {
    const leads = await interceptLeads(page, (route) => route.abort('failed'))
    await fillValid(page)
    await page.getByTestId('landing-lead-submit').click()

    await expect(page.getByTestId('landing-lead-form')).toHaveAttribute('data-state', 'error')
    await expect(page.getByTestId('landing-lead-failed')).toBeVisible()
    expect(leads.calls()).toBe(1)
  })

  test('empty name: error at the field, focus on it, no request', async ({ page }) => {
    const leads = await interceptLeads(page, okReply)
    await page.getByTestId('landing-lead-contact').fill(CONTACT)
    await page.getByTestId('landing-lead-submit').click()

    await expect(page.getByTestId('landing-lead-name-error')).toHaveText('Заполните это поле')
    await expect(page.getByTestId('landing-lead-name')).toBeFocused()
    await expect(page.getByTestId('landing-lead-name')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByTestId('landing-lead-contact-error')).toHaveCount(0)
    await expect(page.getByTestId('landing-lead-form')).toHaveAttribute('data-state', 'idle')
    expect(leads.calls()).toBe(0)
  })

  test('bad contact is flagged on blur, before any submit', async ({ page }) => {
    const contact = page.getByTestId('landing-lead-contact')
    await contact.fill('123')
    await expect(page.getByTestId('landing-lead-contact-error')).toHaveCount(0)
    await contact.blur()
    await expect(page.getByTestId('landing-lead-contact-error')).toHaveText(
      'Проверьте телефон или e-mail',
    )
    await contact.fill('+370 600 12345')
    await expect(page.getByTestId('landing-lead-contact-error')).toHaveCount(0)
  })

  test('honeypot filled → success without a request', async ({ page }) => {
    const leads = await interceptLeads(page, okReply)
    await fillValid(page)
    await page.getByTestId('landing-lead-website').fill('https://spam.example')
    await page.getByTestId('landing-lead-submit').click()

    await expect(page.getByTestId('landing-lead-form')).toHaveAttribute('data-state', 'success')
    expect(leads.calls()).toBe(0)
  })

  test('while sending the button is disabled and a second submit sends nothing', async ({
    page,
  }) => {
    let release!: () => void
    const held = new Promise<void>((resolve) => (release = resolve))
    const leads = await interceptLeads(page, async (route) => {
      await held
      await okReply(route)
    })
    await fillValid(page)
    const form = page.getByTestId('landing-lead-form')
    const submit = page.getByTestId('landing-lead-submit')
    await submit.click()

    await expect(form).toHaveAttribute('data-state', 'sending')
    await expect(submit).toBeDisabled()
    // Отключённую кнопку браузер не нажимает — шлём submit формы в обход неё, дважды.
    await form.evaluate((el) => {
      ;(el as HTMLFormElement).requestSubmit()
      ;(el as HTMLFormElement).requestSubmit()
    })
    // Дать второму запросу шанс появиться до того, как отпустим первый.
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 300)))
    release()

    await expect(form).toHaveAttribute('data-state', 'success')
    expect(leads.calls()).toBe(1)
  })
})

test.describe('landing lead form: captcha', () => {
  test('the captcha script loads on the first touch of the form, not with the page', async ({
    page,
  }) => {
    const turnstile = await stubTurnstile(page)
    await page.goto('/ru')
    const form = page.getByTestId('landing-lead-form')
    await expect(form).toHaveAttribute('data-state', 'idle', { timeout: DATA_READY_TIMEOUT })
    await form.scrollIntoViewIfNeeded()
    await expect(page.getByTestId('landing-lead-captcha')).toHaveCount(0)
    expect(turnstile.requests()).toBe(0)

    await page.getByTestId('landing-lead-name').focus()
    await expect(page.getByTestId('turnstile-stub')).toBeVisible()
    expect(turnstile.requests()).toBe(1)
  })

  test('submit before the check passes waits, then sends by itself', async ({ page }) => {
    await stubTurnstile(page, 'manual')
    await page.goto('/ru')
    await expect(page.getByTestId('landing-lead-form')).toHaveAttribute('data-state', 'idle', {
      timeout: DATA_READY_TIMEOUT,
    })
    const leads = await interceptLeads(page, okReply)
    await fillValid(page)
    await page.getByTestId('landing-lead-submit').click()

    await expect(page.getByTestId('landing-lead-captcha-required')).toHaveText(
      'Подтвердите, что вы не робот, — заявка уйдёт сразу после проверки',
    )
    await expect(page.getByTestId('landing-lead-form')).toHaveAttribute('data-state', 'idle')
    expect(leads.calls()).toBe(0)

    await solveTurnstile(page)
    await expect(page.getByTestId('landing-lead-form')).toHaveAttribute('data-state', 'success')
    expect(leads.calls()).toBe(1)
    expect((JSON.parse(leads.bodies[0]!) as Record<string, string>).captcha).toBe('e2e-token-1')
  })

  test('captcha script blocked: contacts instead, nothing is sent', async ({ page }) => {
    await stubTurnstile(page, 'blocked')
    await page.goto('/ru')
    await expect(page.getByTestId('landing-lead-form')).toHaveAttribute('data-state', 'idle', {
      timeout: DATA_READY_TIMEOUT,
    })
    const leads = await interceptLeads(page, okReply)
    await fillValid(page)

    const failed = page.getByTestId('landing-lead-captcha-failed')
    await expect(failed).toContainText('Проверка от ботов не загрузилась')
    await expect(failed.locator('a[href^="mailto:"]')).toBeVisible()
    await page.getByTestId('landing-lead-submit').click()
    await expect(page.getByTestId('landing-lead-form')).toHaveAttribute('data-state', 'idle')
    expect(leads.calls()).toBe(0)
  })
})
