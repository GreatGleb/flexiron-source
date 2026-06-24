import { ref, reactive, watch } from 'vue'
import { usePagination } from './usePagination'
import * as notificationsService from '@/services/notificationsService'
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
let initialized = false

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
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

async function loadUnreadCount() {
  try {
    unreadCount.value = await notificationsService.getUnreadCount()
  } catch {
    // silently fail on count polling
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
  } catch {
    // ignore
  }
}

async function markAllAsRead() {
  try {
    await notificationsService.markAllAsRead()
    items.value = items.value.map((n) => ({ ...n, isRead: true }))
    unreadCount.value = 0
  } catch {
    // ignore
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

function startPolling(intervalMs = 30_000) {
  stopPolling()
  loadUnreadCount()
  pollTimer = setInterval(loadUnreadCount, intervalMs)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// ─── Auto-start polling at module level ───────────────────────────────────
// (onMounted/onUnmounted skipped because singleton state outlives any single
//  component; polling runs as long as the module is loaded.)
loadUnreadCount()
pollTimer = setInterval(loadUnreadCount, 30_000)

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
