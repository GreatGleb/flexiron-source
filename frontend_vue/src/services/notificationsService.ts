import { apiGet, apiPatch } from './api'
import type { Notification, NotificationFilters } from '@/types/notifications'
import type { PaginatedResponse, PaginationParams } from '@/types/api'

export async function getNotifications(
  filters: NotificationFilters,
  pagination: PaginationParams,
): Promise<PaginatedResponse<Notification>> {
  return apiGet<PaginatedResponse<Notification>>('/api/notifications', {
    page: String(pagination.page),
    pageSize: String(pagination.pageSize),
    search: filters.search,
    type: filters.type,
    isRead: filters.isRead === null ? '' : String(filters.isRead),
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
  })
}

export async function getUnreadCount(): Promise<number> {
  return apiGet<number>('/api/notifications/unread-count')
}

export async function markAsRead(id: string): Promise<void> {
  return apiPatch<void>(`/api/notifications/${id}/read`, {})
}

export async function markAllAsRead(): Promise<void> {
  return apiPatch<void>('/api/notifications/read-all', {})
}
