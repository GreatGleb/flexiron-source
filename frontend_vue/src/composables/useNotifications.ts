import { ref, reactive, watch } from 'vue'
import { usePagination } from './usePagination'
import * as notificationsService from '@/services/notificationsService'
import { errorMessageKey } from '@/services/apiErrorCode'
import { ApiRequestError } from '@/types/api'
import type { Notification, NotificationFilters } from '@/types/notifications'

// ─── Module-level singleton state ─────────────────────────────────────────
// Shared across all consumers (NotificationsPage + NotificationDropdown)
const items = ref<Notification[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const unreadCount = ref(0)
const filters = reactive<NotificationFilters>({
  type: 'all',
  isRead: null,
  search: '',
  sortBy: 'createdAt',
  sortDir: 'desc',
})
const pagination = usePagination(25)
const { page, pageSize, total } = pagination

let pollTimer: ReturnType<typeof setInterval> | null = null
let pollConsumers = 0
let initialized = false

/**
 * Домен держит один каталог: код отказа сервера → ключ перевода домена (§2 общих
 * соглашений, `services/apiErrorCode.ts`). `NOTIFICATION_NOT_FOUND` — из мока
 * `markAsRead`; `UNAUTHORIZED`/`FORBIDDEN` — коды ядра, применимые к любому роуту.
 */
const NOTIFICATIONS_ERROR_KEYS: ReadonlyArray<readonly [string, string]> = [
  ['NOTIFICATION_NOT_FOUND', 'notifications.error_not_found'],
  ['UNAUTHORIZED', 'notifications.error_no_login'],
  ['FORBIDDEN', 'notifications.error_no_access'],
]

/**
 * Ключ перевода для настоящего отказа сервера (`ApiRequestError` — код в поле
 * `code`, а не в тексте), фолбэк — общий ключ домена, если код не в каталоге
 * выше. Что-то другое (сеть упала, программная ошибка) — не «отказ» в смысле §2,
 * и его сообщение проходит как есть: спрятать его за общей фразой значило бы
 * никогда не заметить, что оно вообще случилось.
 */
function refusalKey(e: unknown): string {
  if (e instanceof ApiRequestError) {
    return errorMessageKey(e, NOTIFICATIONS_ERROR_KEYS, 'notifications.error_generic')
  }
  return e instanceof Error ? e.message : String(e)
}

async function load() {
  if (!initialized) loading.value = true
  error.value = null
  try {
    const result = await notificationsService.getNotifications(
      { ...filters },
      { page: page.value, pageSize: pageSize.value },
    )
    items.value = result.items
    total.value = result.total
    initialized = true
  } catch (e) {
    error.value = refusalKey(e)
  } finally {
    loading.value = false
  }
}

async function loadUnreadCount() {
  try {
    unreadCount.value = await notificationsService.getUnreadCount()
  } catch {
    // Silent on purpose: this runs unattended every `startPolling` tick, with
    // no user action behind it and no error slot on the bell to show anything
    // in. A failed tick just leaves the badge stale until the next poll — or
    // the next `load()`/`markAsRead` — reports the real count.
  }
}

async function markAsRead(id: string) {
  try {
    await notificationsService.markAsRead(id)
    const notification = items.value.find((n) => n.id === id)
    if (notification) {
      notification.isRead = true
    }
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  } catch (e) {
    // A refusal used to be swallowed here without a trace, so the only visible
    // outcome of a failed mark was the badge disagreeing with the server until
    // the next poll. The local state is already left untouched — the two
    // assignments above sit after the await — and now the refusal is reported
    // too, through the same `error` the list load uses.
    error.value = refusalKey(e)
  }
}

async function markAllAsRead() {
  try {
    await notificationsService.markAllAsRead()
    items.value = items.value.map((n) => ({ ...n, isRead: true }))
    unreadCount.value = 0
  } catch (e) {
    // Same rule as markAsRead above: local state is only touched after the
    // await succeeds, and a refusal is reported through the shared `error`
    // field instead of being swallowed.
    error.value = refusalKey(e)
  }
}

// ─── Reactive: auto-reload on filter/page change ──
let skipNextPageWatch = false

watch(
  filters,
  () => {
    skipNextPageWatch = page.value !== 1
    pagination.reset()
    load()
  },
  { deep: true },
)

watch([page, pageSize], () => {
  if (skipNextPageWatch) {
    skipNextPageWatch = false
    return
  }
  load()
})

/**
 * Опрос счётчика непрочитанных — по числу потребителей, а не по времени жизни
 * модуля. Счётчик живёт здесь же (в замыкании singleton-состояния): второй и
 * третий вызов только увеличивают его и не трогают уже идущий таймер, а
 * `stopPolling` останавливает его, только когда ушёл последний. `30_000` —
 * единственное место в домене, где записан интервал опроса.
 */
function startPolling(intervalMs = 30_000) {
  pollConsumers += 1
  if (pollTimer) return
  loadUnreadCount()
  pollTimer = setInterval(loadUnreadCount, intervalMs)
}

function stopPolling() {
  pollConsumers = Math.max(0, pollConsumers - 1)
  if (pollConsumers > 0) return
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export function useNotifications() {
  return {
    items,
    loading,
    error,
    unreadCount,
    filters,
    pagination,
    page,
    pageSize,
    total,
    load,
    loadUnreadCount,
    markAsRead,
    markAllAsRead,
    startPolling,
    stopPolling,
  }
}
