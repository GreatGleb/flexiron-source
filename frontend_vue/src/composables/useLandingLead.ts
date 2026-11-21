import { reactive, ref, watch, type Ref } from 'vue'
import { LEADS_URL } from '@/config/landing'
import {
  isHoneypot,
  toPayload,
  validateLead,
  type LeadDraft,
  type LeadField,
  type LeadValidation,
} from '@/domain/landingLead'
import { submitLead } from '@/services/landingLeadService'

/**
 * Форма заявки лендинга (roo_code/plans/landing/landing-plan.md, «Форма заявки»; задача L-06).
 *
 * Состояния:
 * - `disabled` — адрес Apps Script пуст (решение 4): форма не отправляет, вместо кнопки — контакты.
 *   Законное состояние, а не ошибка, и из него не выходят;
 * - `idle` → `sending` → `success` | `error`. Из `error` можно отправить ещё раз, введённое не
 *   теряется.
 *
 * Правило валидации — только `validateLead` из домена; здесь его не повторяют, а спрашивают.
 *
 * Капча (этап 2, пункт 1): верная заявка без токена не уходит — `captchaMissing` поднимается,
 * и заявка уходит сама, как только токен появится (человек нажал «Отправить» до конца проверки
 * или прошёл её вручную). После неудачной отправки токен израсходован — `captcha.reset()`.
 */
export type LeadFormState = 'idle' | 'sending' | 'success' | 'error' | 'disabled'

/** Порядок полей на форме — фокус уходит на первое неверное в этом порядке. */
const LEAD_FIELDS: readonly LeadField[] = ['name', 'company', 'contact', 'message']

/** Что форме нужно от капчи; живой вариант — useTurnstile. */
export interface LeadCaptcha {
  /** Нужен ли токен для отправки (капча включена). */
  required: () => boolean
  token: Readonly<Ref<string>>
  reset: () => void
}

const NO_CAPTCHA: LeadCaptcha = { required: () => false, token: ref(''), reset: () => {} }

export function useLandingLead(url: string = LEADS_URL, captcha: LeadCaptcha = NO_CAPTCHA) {
  const draft = reactive<LeadDraft>({
    name: '',
    company: '',
    contact: '',
    message: '',
    website: '',
  })
  const errors = ref<LeadValidation['errors']>({})
  const state = ref<LeadFormState>(url ? 'idle' : 'disabled')
  /** Нажали «Отправить», заявка верна, а токена капчи ещё нет. */
  const captchaMissing = ref(false)

  /** Проверка одного поля (по blur и при правке поля, у которого уже стоит ошибка). */
  function validateField(field: LeadField) {
    const code = validateLead(draft).errors[field]
    const next = { ...errors.value }
    if (code) next[field] = code
    else delete next[field]
    errors.value = next
  }

  /** Первое неверное поле в порядке формы; `null` — ошибок нет. */
  function firstInvalid(): LeadField | null {
    return LEAD_FIELDS.find((field) => errors.value[field]) ?? null
  }

  async function submit() {
    if (state.value === 'disabled' || state.value === 'sending') return
    // Ловушка заполнена — бот: тихий «успех», запроса нет.
    if (isHoneypot(draft)) {
      state.value = 'success'
      return
    }
    const result = validateLead(draft)
    errors.value = result.errors
    if (!result.ok) return
    if (captcha.required() && !captcha.token.value) {
      captchaMissing.value = true
      return
    }
    captchaMissing.value = false

    state.value = 'sending'
    const payload = toPayload(draft, location.href, navigator.userAgent, captcha.token.value)
    const sent = await submitLead(payload, url)
    state.value = sent === 'sent' ? 'success' : 'error'
    if (sent !== 'sent') captcha.reset()
  }

  // Токен пришёл, а человек уже нажимал «Отправить» — отправляем, не заставляя жать снова.
  watch(captcha.token, (value) => {
    if (value && captchaMissing.value) void submit()
  })

  return { draft, errors, state, captchaMissing, validateField, firstInvalid, submit }
}
