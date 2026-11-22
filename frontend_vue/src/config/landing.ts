/**
 * Настройки лендинга `/`, которые меняет владелец перед публикацией
 * (roo_code/plans/landing/landing-plan.md, «Публикация»).
 */

/**
 * Адрес веб-приложения Google Apps Script (`…/exec`), куда уходят заявки.
 * Пусто → форма не отправляет, а показывает контакты (решение 4 плана) — это законное
 * состояние, а не ошибка. Значение — из frontend_vue/.env.
 */
const rawLeadsUrl: unknown = import.meta.env.VITE_LANDING_LEADS_URL
export const LEADS_URL: string = typeof rawLeadsUrl === 'string' ? rawLeadsUrl.trim() : ''

/**
 * Адрес опубликованного сайта без слэша на конце — для canonical, hreflang, Open Graph и sitemap.xml
 * (этап 2 лендинга, SEO). Поисковикам нужны полные адреса, относительные они не принимают.
 */
const rawSiteUrl: unknown = import.meta.env.VITE_SITE_URL
export const SITE_URL: string = (
  typeof rawSiteUrl === 'string' && rawSiteUrl.trim()
    ? rawSiteUrl.trim()
    : 'https://greatgleb.github.io/Flexiron-Enterprise'
).replace(/\/+$/, '')

/** Код подтверждения Google Search Console (мета-тег `google-site-verification`); пусто — тега нет. */
const rawGsc: unknown = import.meta.env.VITE_GSC_VERIFICATION
export const GSC_VERIFICATION: string = typeof rawGsc === 'string' ? rawGsc.trim() : ''

/**
 * Публичный site key виджета Cloudflare Turnstile (капча формы заявки). Публичный по замыслу —
 * он виден в коде любой страницы с виджетом; секретная пара к нему живёт только в свойствах
 * скрипта Apps Script (`TURNSTILE_SECRET`). Пусто → виджета нет и токен не уходит.
 */
const rawTurnstileKey: unknown = import.meta.env.VITE_TURNSTILE_SITE_KEY
export const TURNSTILE_SITE_KEY: string =
  typeof rawTurnstileKey === 'string' ? rawTurnstileKey.trim() : ''

/**
 * Контакты лендинга (решение владельца 2026-11-22): почта сайта и телефон владельца. Telegram и
 * реквизиты фирмы убраны — появятся, когда будут. Этот объект — единственное место, где контакты
 * записаны: подвал и форма заявки берут их только отсюда (LandingContacts.vue).
 */
export const CONTACTS = {
  email: 'flexiron.erp@gmail.com',
  phone: '+370 688 97926',
} as const
