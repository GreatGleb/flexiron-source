// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { translations } from '@/i18n/translations'

/**
 * БАГ-02 / БАГ-05 (roo_code/plans/bugs/contract-sync-notifications-bugs.md): the dropdown used
 * to reuse the notifications-page singleton's `load()` (shared `filters`/`page`) and then held
 * stale references into its `items`, so filtering the page changed what the bell showed, and
 * "mark all read" from the dropdown never repainted its own rows. This spec pins the fix: the
 * dropdown fetches its own first page of five, unaffected by the page's state, and re-fetches
 * after marking all as read.
 */
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/services/notificationsService', () => ({
  getNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
}))

import { getNotifications, getUnreadCount, markAllAsRead } from '@/services/notificationsService'
import { useNotifications } from '@/composables/useNotifications'
import NotificationDropdown from '@/components/admin/NotificationDropdown.vue'
import type { Notification } from '@/types/notifications'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: translations,
})

function makeNotification(id: string, isRead: boolean): Notification {
  return {
    id,
    type: 'order_status',
    title: { ru: 'т', en: 'title', lt: 't' },
    message: { ru: 'с', en: 'message', lt: 'm' },
    entityType: 'order',
    entityId: 'ORD-1',
    entityRouteName: 'admin-order-card',
    isRead,
    createdAt: '2026-09-01T00:00:00.000Z',
  }
}

function mountDropdown() {
  return mount(NotificationDropdown, {
    global: {
      plugins: [i18n],
      stubs: { SvgIcon: true, RouterLink: true },
    },
  })
}

async function openDropdown(wrapper: ReturnType<typeof mountDropdown>) {
  await wrapper.get('[data-test="topbar-notifications"]').trigger('click')
  await flushPromises()
}

beforeEach(async () => {
  // resetAllMocks (not clearAllMocks) — a test that queues
  // `mockResolvedValueOnce` must not leave it for the next test to consume
  // if it never got called (e.g. under a mutation of the code under test).
  vi.resetAllMocks()
  vi.mocked(getUnreadCount).mockResolvedValue(0)
  vi.mocked(getNotifications).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 5,
    totalPages: 1,
  })
  // Reset the module-level singleton state so a previous test's filters/page
  // don't leak — the dropdown must not depend on it either way, but a clean
  // slate keeps each test's own assertions unambiguous. Settling the watchers
  // this triggers, then clearing the mock's call log, keeps each test's own
  // `getNotifications` assertions free of setup noise.
  const { filters, pagination, error } = useNotifications()
  filters.type = 'all'
  filters.isRead = null
  filters.search = ''
  pagination.reset()
  error.value = null
  await flushPromises()
  vi.mocked(getNotifications).mockClear()
})

describe('NotificationDropdown — своя выборка, независимая от страницы', () => {
  it('запрашивает первую страницу из 5 без фильтров, даже когда страница уведомлений отфильтрована и не на первой странице', async () => {
    const { filters, page } = useNotifications()
    filters.type = 'stock_deficit'
    filters.isRead = true
    filters.search = 'metal'
    page.value = 3
    await flushPromises()
    vi.mocked(getNotifications).mockClear()

    vi.mocked(getNotifications).mockResolvedValue({
      items: [makeNotification('n1', false)],
      total: 1,
      page: 1,
      pageSize: 5,
      totalPages: 1,
    })

    const wrapper = mountDropdown()
    await openDropdown(wrapper)

    expect(getNotifications).toHaveBeenCalledTimes(1)
    expect(getNotifications).toHaveBeenCalledWith(
      { type: 'all', isRead: null, search: '', sortBy: 'createdAt', sortDir: 'desc' },
      { page: 1, pageSize: 5 },
    )
  })

  it('после «прочитать всё» строки дропдауна показаны прочитанными', async () => {
    vi.mocked(getNotifications)
      .mockResolvedValueOnce({
        items: [makeNotification('n1', false), makeNotification('n2', false)],
        total: 2,
        page: 1,
        pageSize: 5,
        totalPages: 1,
      })
      .mockResolvedValueOnce({
        items: [makeNotification('n1', true), makeNotification('n2', true)],
        total: 2,
        page: 1,
        pageSize: 5,
        totalPages: 1,
      })
    vi.mocked(markAllAsRead).mockResolvedValue(undefined)

    const wrapper = mountDropdown()
    await openDropdown(wrapper)

    expect(wrapper.findAll('.notif-item--unread')).toHaveLength(2)

    await wrapper.get('.notif-footer-btn').trigger('click')
    await flushPromises()

    expect(markAllAsRead).toHaveBeenCalledTimes(1)
    expect(getNotifications).toHaveBeenCalledTimes(2)
    expect(wrapper.findAll('.notif-item--unread')).toHaveLength(0)
  })

  it('отказ «прочитать всё» доходит до поля ошибки композабла и не помечает строки прочитанными', async () => {
    vi.mocked(getNotifications).mockResolvedValue({
      items: [makeNotification('n1', false)],
      total: 1,
      page: 1,
      pageSize: 5,
      totalPages: 1,
    })
    vi.mocked(markAllAsRead).mockRejectedValue(new Error('mark-all refused'))

    const wrapper = mountDropdown()
    await openDropdown(wrapper)

    const { error } = useNotifications()
    expect(error.value).toBeNull()

    await wrapper.get('.notif-footer-btn').trigger('click')
    await flushPromises()

    expect(error.value).toBe('mark-all refused')
    expect(wrapper.findAll('.notif-item--unread')).toHaveLength(1)
  })
})
