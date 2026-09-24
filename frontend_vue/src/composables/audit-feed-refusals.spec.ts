// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { translations } from '@/i18n/translations'
import { useToast } from './useToast'
import type { AuditFeedResponse, AuditFeedRow, AuditFeedUser } from '@/types/audit'

/**
 * БАГ-02, БАГ-04, БАГ-05 и «лента показывает текст исключения» —
 * roo_code/plans/bugs/contract-sync-audit-feed-bugs.md.
 *
 * `getAuditFeed`/`getAuditFeedUsers` заглушены, `deleteAuditFeedEntry` — настоящий:
 * первая группа тестов проверяет именно его `switch`, и подменять его нечем — это
 * и есть предмет проверки.
 */
vi.mock('@/services/auditFeedService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/auditFeedService')>()
  return {
    ...actual,
    getAuditFeed: vi.fn(),
    getAuditFeedUsers: vi.fn(),
  }
})

import { getAuditFeed, getAuditFeedUsers, deleteAuditFeedEntry } from '@/services/auditFeedService'
import { useAuditFeed } from './useAuditFeed'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: translations,
})

/**
 * Локаль `ru` — намеренно, для одного теста ниже: в `en` перевод текстуально совпадает
 * со старым хардкодом `'Failed to load the audit feed'`, и там строковое совпадение
 * ничего не отличило бы. В `ru` совпадения нет — так тест ловит именно возврат к
 * `e.message`/хардкоду, а не устраивает бездействие (питфолл #68).
 */
const ruI18n = createI18n({
  legacy: false,
  locale: 'ru',
  fallbackLocale: 'ru',
  messages: translations,
})

/** Композабл зовёт `useI18n()`, а тот требует setup — отсюда обёртка, а не прямой вызов. */
function inSetup<T>(factory: () => T, plugin = i18n): T {
  let result!: T
  mount(
    {
      setup() {
        result = factory()
        return () => null
      },
    },
    { global: { plugins: [plugin] } },
  )
  return result
}

/**
 * Перевод, а не ключ — см. apiErrorCode.consumers.spec.ts: `toBe(t(key))` без этой
 * проверки остаётся зелёным, даже если перевода нет ни в одной локали.
 */
function t(key: string): string {
  const value = i18n.global.t(key)
  if (value === key) throw new Error(`перевода нет: ${key}`)
  return value
}

const toasts = useToast().toasts

function lastToast(): string {
  return toasts[toasts.length - 1]?.message ?? '<тоста не было>'
}

function feedResponse(overrides: Partial<AuditFeedResponse> = {}): AuditFeedResponse {
  return {
    items: [],
    total: 0,
    page: 1,
    pageSize: 25,
    totalPages: 1,
    ...overrides,
  }
}

const SOME_USER: AuditFeedUser = {
  key: 'john.en',
  name: { ru: 'Джон', en: 'John', lt: 'Džonas' },
  initials: 'JD',
}

beforeEach(() => {
  toasts.splice(0, toasts.length)
  vi.clearAllMocks()
})

describe('БАГ-02 — switch по entityType, пришедшему от сервера, не молчит на неизвестном виде', () => {
  it('неизвестный entityType бросает, а не разрешает промис успешно', async () => {
    const row = {
      entityType: 'contract',
      entityId: 'x-1',
      entityLabel: 'X',
      entryId: 'e-1',
      timestamp: '2026-01-01T00:00:00Z',
      user: { ru: '', en: '', lt: '' },
      userInitials: '',
      property: { ru: '', en: '', lt: '' },
      oldValue: '',
      newValue: '',
    } as unknown as AuditFeedRow

    await expect(deleteAuditFeedEntry(row)).rejects.toThrow()
  })
})

describe('БАГ-05 — упавший список авторов не подменяется пустым', () => {
  it('прежние авторы остаются в users, а человек видит фразу об отказе', async () => {
    vi.mocked(getAuditFeedUsers).mockResolvedValueOnce([SOME_USER])
    const feed = inSetup(() => useAuditFeed())

    await feed.loadUsers()
    expect(feed.users.value).toEqual([SOME_USER])

    vi.mocked(getAuditFeedUsers).mockRejectedValueOnce(new Error('users endpoint exploded'))
    await feed.loadUsers()

    expect(feed.users.value).toEqual([SOME_USER])
    expect(lastToast()).toBe(t('auditLog.error_users_load'))
  })
})

describe('лента объясняет отказ загрузки переводом, а не текстом исключения', () => {
  it('error несёт перевод из auditLog, не Error#message', async () => {
    vi.mocked(getAuditFeed).mockRejectedValueOnce(new Error('ECONNRESET: internal detail'))
    const feed = inSetup(() => useAuditFeed())

    await feed.load()

    expect(feed.error.value).toBe(t('auditLog.error_load'))
    expect(feed.error.value).not.toContain('ECONNRESET')
  })

  it('на локали ru отдаёт русскую фразу — не английский хардкод из кода', async () => {
    vi.mocked(getAuditFeed).mockRejectedValueOnce(new Error('boom'))
    const feed = inSetup(() => useAuditFeed(), ruI18n)

    await feed.load()

    expect(feed.error.value).toBe('Не удалось загрузить ленту аудита')
    expect(feed.error.value).not.toBe('Failed to load the audit feed')
  })
})

describe('БАГ-04 — зажатая сервером страница не вызывает второй запрос', () => {
  it('page.value от ответа сервера вызывает ровно один getAuditFeed', async () => {
    vi.mocked(getAuditFeed).mockImplementation(async (_filters, pagination) =>
      feedResponse({
        total: 10,
        page: Math.min(pagination.page, 3),
        pageSize: pagination.pageSize,
        totalPages: 3,
      }),
    )

    const feed = inSetup(() => useAuditFeed())

    await feed.load()
    expect(getAuditFeed).toHaveBeenCalledTimes(1)

    vi.mocked(getAuditFeed).mockClear()
    // Пользователь просит страницу вне диапазона — сервер её зажмёт до 3.
    feed.page.value = 99
    await flushPromises()
    await flushPromises()

    expect(feed.page.value).toBe(3)
    expect(getAuditFeed).toHaveBeenCalledTimes(1)
  })
})
