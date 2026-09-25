// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createI18n } from 'vue-i18n'
import { translations } from '@/i18n/translations'
import { ApiRequestError } from '@/types/api'

/**
 * `load`, `markAsRead` и `markAllAsRead` клали в `error` текст исключения
 * (`(e as Error).message`) — английскую фразу сервера, зашитую в ответ, никак не
 * зависящую от локали. Здесь проверяется обратное, по образцу
 * `warehouse-refusals-are-translated.spec.ts`: настоящий отказ сервера
 * (`ApiRequestError` с кодом в поле `code`, как того требует §2 общих
 * соглашений) превращается в КЛЮЧ ПЕРЕВОДА домена, а не в текст сервера.
 *
 * `message` у каждого отказа — намеренно ЧУЖАЯ фраза, которой нет ни в одной
 * локали: если бы её текст совпал со случайно верным переводом, тест был бы
 * зелёным и до правки — тот самый питфолл #68.
 */

vi.mock('@/services/notificationsService', () => ({
  getNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
}))

import {
  getNotifications,
  getUnreadCount,
  markAsRead as markAsReadApi,
  markAllAsRead as markAllAsReadApi,
} from '@/services/notificationsService'
import { useNotifications } from '@/composables/useNotifications'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: translations,
})

/**
 * Перевод, а не ключ. `i18n.global.t('нет.такого.ключа')` возвращает САМ КЛЮЧ —
 * значит `toBe(t(key))` остался бы зелёным, даже если перевода нет ни в одной
 * локали. Используется только чтобы доказать, что ключ, положенный в `error`,
 * РЕАЛЬНО существует — сам `error` при этом остаётся ключом, не текстом:
 * перевод в текст делает шаблон (`NotificationsPage.vue`), не композабл.
 */
function assertTranslated(key: string): void {
  const value = i18n.global.t(key)
  if (value === key) throw new Error(`перевода нет: ${key}`)
}

/** Фраза сервера, которую не переводит ни одна локаль и не содержит машинного кода. */
const FOREIGN_PHRASE = 'The kraken ate the response before it reached the client'

function refusal(message: string, code?: string): ApiRequestError {
  return new ApiRequestError({ status: code ? 404 : 500, message, code })
}

beforeEach(() => {
  vi.clearAllMocks()
  const { filters, pagination, error } = useNotifications()
  filters.type = 'all'
  filters.isRead = null
  filters.search = ''
  pagination.reset()
  error.value = null
})

describe('load — отказ без кода становится общим ключом перевода', () => {
  it('не текстом исключения', async () => {
    vi.mocked(getNotifications).mockRejectedValue(refusal(FOREIGN_PHRASE))
    const { load, error } = useNotifications()

    await load()

    expect(error.value).toBe('notifications.error_generic')
    expect(error.value).not.toContain('kraken')
    assertTranslated(error.value!)
  })
})

describe('markAsRead — код отказа доводит до своего ключа', () => {
  it('NOTIFICATION_NOT_FOUND → ключ карточки, не текст сервера', async () => {
    vi.mocked(markAsReadApi).mockRejectedValue(refusal(FOREIGN_PHRASE, 'NOTIFICATION_NOT_FOUND'))
    const { markAsRead, error } = useNotifications()

    await markAsRead('notif-001')

    expect(error.value).toBe('notifications.error_not_found')
    expect(error.value).not.toContain('kraken')
    assertTranslated(error.value!)
  })

  it('незнакомый код остаётся общим ключом', async () => {
    vi.mocked(markAsReadApi).mockRejectedValue(refusal(FOREIGN_PHRASE, 'SOME_OTHER_CODE'))
    const { markAsRead, error } = useNotifications()

    await markAsRead('notif-001')

    expect(error.value).toBe('notifications.error_generic')
    assertTranslated(error.value!)
  })
})

describe('markAllAsRead — отказ сервера тоже становится ключом', () => {
  it('без кода — общий ключ, а не фраза сервера', async () => {
    vi.mocked(markAllAsReadApi).mockRejectedValue(refusal(FOREIGN_PHRASE))
    const { markAllAsRead, error } = useNotifications()

    await markAllAsRead()

    expect(error.value).toBe('notifications.error_generic')
    expect(error.value).not.toContain('kraken')
    assertTranslated(error.value!)
  })
})

describe('опрос счётчика — по числу потребителей, не по времени жизни модуля', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(getUnreadCount).mockResolvedValue(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('тикает, пока есть хотя бы один потребитель, и останавливается только с последним', async () => {
    const { startPolling, stopPolling } = useNotifications()

    // Первый потребитель — старт, плюс немедленный первый вызов.
    startPolling()
    await vi.advanceTimersByTimeAsync(0)
    vi.mocked(getUnreadCount).mockClear()

    await vi.advanceTimersByTimeAsync(30_000)
    expect(getUnreadCount).toHaveBeenCalledTimes(1)

    // Второй потребитель приходит и уходит — таймер не перезапускается и не гаснет,
    // потому что первый потребитель ещё здесь.
    startPolling()
    stopPolling()
    vi.mocked(getUnreadCount).mockClear()

    await vi.advanceTimersByTimeAsync(30_000)
    expect(getUnreadCount).toHaveBeenCalledTimes(1)

    // Уходит последний потребитель — таймер гаснет.
    stopPolling()
    vi.mocked(getUnreadCount).mockClear()

    await vi.advanceTimersByTimeAsync(60_000)
    expect(getUnreadCount).not.toHaveBeenCalled()
  })
})
