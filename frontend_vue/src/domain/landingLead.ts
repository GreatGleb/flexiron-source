import type { LandingLeadErrorCode } from '@/types/landing'

/**
 * Заявка с лендинга `/` — единственное место правила валидации
 * (roo_code/plans/landing/landing-plan.md, «Форма заявки»).
 *
 * Вторая среда исполнения того же правила — Google Apps Script
 * (`apps-script/landing-leads/Code.gs`): лимиты и выражения там продублированы,
 * и `landingLead.spec.ts` сверяет их с этим файлом разбором Code.gs (Л5).
 * Поменял число здесь — поменяй и там, иначе спека покраснеет.
 */
export const LIMITS = {
  name: 100,
  company: 150,
  contact: 150,
  message: 1000,
  /** Телефон — не меньше стольких цифр. */
  phoneMinDigits: 7,
} as const

/** E-mail: что-то до `@`, после — домен с точкой; без пробелов. */
export const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/
/** Телефон: только цифры и привычные разделители (`+ - ( ) .` и пробел). */
export const PHONE_RE = /^[\d\s()+.-]+$/

/** Поля, которые человек вводит сам. */
export type LeadField = 'name' | 'company' | 'contact' | 'message'

/** Состояние формы как есть — с непостриженными строками и полем-ловушкой. */
export interface LeadDraft {
  name: string
  company: string
  contact: string
  message: string
  /** Скрытое поле-ловушка: человек его не видит и не заполняет. */
  website: string
}

/** Что уходит в Apps Script; лист `Leads` хранит эти поля (кроме `captcha`) и дату. */
export interface LeadPayload {
  name: string
  company: string
  contact: string
  message: string
  page: string
  userAgent: string
  /** Токен Cloudflare Turnstile; сервер проверяет его до записи. Пусто — капча на сайте выключена. */
  captcha: string
}

export interface LeadValidation {
  ok: boolean
  errors: Partial<Record<LeadField, LandingLeadErrorCode>>
}

const REQUIRED: readonly LeadField[] = ['name', 'contact']
const FIELDS: readonly LeadField[] = ['name', 'company', 'contact', 'message']

/** `value` уже постриженный — его стрижёт validateLead. */
function isValidContact(value: string): boolean {
  if (value.includes('@')) return EMAIL_RE.test(value)
  return PHONE_RE.test(value) && value.replace(/\D/g, '').length >= LIMITS.phoneMinDigits
}

function fieldError(field: LeadField, value: string): LandingLeadErrorCode | undefined {
  if (!value) return REQUIRED.includes(field) ? 'required' : undefined
  if (value.length > LIMITS[field]) return 'tooLong'
  if (field === 'contact' && !isValidContact(value)) return 'invalidContact'
  return undefined
}

/** Проверка всех полей после `trim()`; пустой `errors` ⇔ `ok`. */
export function validateLead(draft: LeadDraft): LeadValidation {
  const errors: LeadValidation['errors'] = {}
  for (const field of FIELDS) {
    const code = fieldError(field, draft[field].trim())
    if (code) errors[field] = code
  }
  return { ok: Object.keys(errors).length === 0, errors }
}

/** Заполнена ловушка — это бот: форма показывает «успех» и ничего не отправляет. */
export function isHoneypot(draft: LeadDraft): boolean {
  return draft.website.trim() !== ''
}

/** Тело запроса: строки постриженные, ловушка не уходит. */
export function toPayload(
  draft: LeadDraft,
  page: string,
  userAgent: string,
  captcha = '',
): LeadPayload {
  return {
    name: draft.name.trim(),
    company: draft.company.trim(),
    contact: draft.contact.trim(),
    message: draft.message.trim(),
    page,
    userAgent,
    captcha,
  }
}
