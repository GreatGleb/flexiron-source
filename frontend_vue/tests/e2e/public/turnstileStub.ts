import type { Page } from '@playwright/test'

/**
 * Подставной Cloudflare Turnstile для e2e лендинга. Настоящий скрипт — внешний
 * (challenges.cloudflare.com) и решает сам, показать ли вопрос; в тесте он подменён скриптом
 * с тем же API (`window.turnstile.render/reset/remove`), отданным через `page.route`.
 *
 * - `solve` — токен выдаётся сразу после render и после каждого reset (`e2e-token-<n>`);
 * - `manual` — токена нет, пока тест не вызовет `solveTurnstile(page)`;
 * - `blocked` — скрипт не грузится (как у посетителя с блокировщиком).
 *
 * Рисует некликабельный `div` — в обходе Tab он не участвует.
 */
export type TurnstileMode = 'solve' | 'manual' | 'blocked'

export const TURNSTILE_ROUTE = 'https://challenges.cloudflare.com/**'

const stubScript = (mode: 'solve' | 'manual') => `
(() => {
  let issued = 0
  const issue = (o) => o.callback('e2e-token-' + ++issued)
  window.__turnstile = { renders: 0, resets: 0, options: null }
  window.turnstile = {
    render(el, o) {
      const box = document.createElement('div')
      box.setAttribute('data-test', 'turnstile-stub')
      box.textContent = 'captcha'
      el.appendChild(box)
      window.__turnstile.renders++
      window.__turnstile.options = o
      if (${JSON.stringify(mode)} === 'solve') setTimeout(() => issue(o), 50)
      return 'w1'
    },
    reset() {
      window.__turnstile.resets++
      const o = window.__turnstile.options
      if (${JSON.stringify(mode)} === 'solve') setTimeout(() => issue(o), 50)
    },
    remove() {},
  }
  window.__solveTurnstile = () => issue(window.__turnstile.options)
})()
`

/** Подключить подставной Turnstile; возвращает счётчик запросов скрипта. */
export async function stubTurnstile(page: Page, mode: TurnstileMode = 'solve') {
  let requests = 0
  await page.route(TURNSTILE_ROUTE, async (route) => {
    requests += 1
    if (mode === 'blocked') return route.abort('blockedbyclient')
    return route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: stubScript(mode),
    })
  })
  return { requests: () => requests }
}

/** В режиме `manual` — пройти проверку. */
export async function solveTurnstile(page: Page) {
  await page.evaluate(() =>
    (window as unknown as { __solveTurnstile: () => void }).__solveTurnstile(),
  )
}

/** Сколько раз форма сбросила виджет (токен одноразовый). */
export async function turnstileResets(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as unknown as { __turnstile: { resets: number } }).__turnstile.resets,
  )
}
