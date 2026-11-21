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
 * ЗАГЛУШКИ. Настоящих контактов в репозитории нет — владелец заменит значения здесь
 * и снимет флаг isPlaceholder. Этот объект — единственное место, где они записаны:
 * остальной код берёт контакты только отсюда.
 */
export const CONTACTS = {
  email: 'hello@flexiron.example',
  phone: '+000 00 000 000',
  telegram: 'flexiron_example',
  company: 'Flexiron (реквизиты — заглушка)',
  isPlaceholder: true,
} as const
