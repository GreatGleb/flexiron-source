import type { TranslatedString } from './i18n'

export type NotificationType =
  | 'order_status'
  | 'stock_deficit'
  | 'supplier_response'
  | 'batch_received'
  | 'reserve_expiring'
  | 'payment_overdue'
  | 'payment_received'
  | 'warehouse_ready'

export type NotificationEntityType = 'order' | 'product' | 'batch' | 'client' | 'supplier'

export interface Notification {
  id: string
  type: NotificationType
  title: TranslatedString
  message: TranslatedString
  entityType: NotificationEntityType
  entityId: string
  entityRouteName: string
  isRead: boolean
  createdAt: string
}

export interface NotificationFilters {
  type: string
  isRead: boolean | null
  search: string
  sortBy: string
  sortDir: 'asc' | 'desc'
}

export const NOTIFICATION_TYPE_ICONS: Record<NotificationType, string> = {
  order_status: 'refresh-cw',
  stock_deficit: 'alert-triangle',
  supplier_response: 'email',
  batch_received: 'package',
  reserve_expiring: 'clock',
  payment_overdue: 'alert-triangle',
  payment_received: 'check',
  warehouse_ready: 'warehouse-box',
}
