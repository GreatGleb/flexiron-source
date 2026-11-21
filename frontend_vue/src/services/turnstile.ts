/**
 * Cloudflare Turnstile — капча формы заявки лендинга
 * (roo_code/plans/landing/landing-stage-2-plan.md, пункт 1).
 *
 * Скрипт виджета грузится с challenges.cloudflare.com и только по требованию — при первом
 * касании формы, а не при загрузке страницы: так страница не тянет чужой скрипт ради тех,
 * кто заявку не оставляет, и e2e, не трогающие форму, в сеть не ходят. Cloudflare запрещает
 * копировать или проксировать api.js — поэтому внешний адрес, а не пакет.
 */

export const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export interface TurnstileRenderOptions {
  sitekey: string
  callback: (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
  theme?: 'light' | 'dark' | 'auto'
  language?: string
  size?: 'normal' | 'flexible' | 'compact'
}

/** Ровно та часть API виджета, которую мы зовём. */
export interface TurnstileApi {
  render: (el: HTMLElement, options: TurnstileRenderOptions) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

/** То, что нужно загрузчику от документа; в тестах — подставной объект. */
export interface ScriptHost {
  createElement: (tag: 'script') => HTMLScriptElement
  head: { appendChild: (node: HTMLScriptElement) => unknown }
}

let loading: Promise<TurnstileApi> | null = null

/**
 * API виджета; скрипт добавляется на страницу один раз. Не загрузился — промис отклоняется,
 * и следующий вызов пробует снова (адблок сняли, сеть вернулась).
 */
export function loadTurnstile(host: ScriptHost = document): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (loading) return loading
  const attempt = new Promise<TurnstileApi>((resolve, reject) => {
    const script = host.createElement('script')
    script.src = TURNSTILE_SCRIPT_URL
    script.async = true
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile)
      else reject(new Error('turnstile: скрипт загрузился, но API нет'))
    }
    script.onerror = () => reject(new Error('turnstile: скрипт не загрузился'))
    host.head.appendChild(script)
  })
  loading = attempt
  // Загрузка закончилась — дальше источник правды `window.turnstile`, а не запомненный промис.
  const settle = () => {
    if (loading === attempt) loading = null
  }
  attempt.then(settle, settle)
  return attempt
}
