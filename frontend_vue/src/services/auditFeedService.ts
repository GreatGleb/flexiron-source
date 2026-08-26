import { apiGet } from './api'
import { deleteProductAuditEntry } from './productsService'
import { deleteClientAuditEntry } from './clientsService'
import { deleteAuditEntry as deleteSupplierAuditEntry } from './suppliersService'
import { deleteOrderAuditEntry } from './ordersService'
import {
  deleteStockAuditEntry,
  deleteBatchAuditEntry,
  deleteOffcutAuditEntry,
  deleteMovementAuditEntry,
  deleteDeficitAuditEntry,
} from './warehouseService'
import type {
  AuditFeedFilters,
  AuditFeedResponse,
  AuditFeedRow,
  AuditFeedUser,
} from '@/types/audit'

function authHeaders(): Record<string, string> | undefined {
  const token = localStorage.getItem('auth_token')
  if (!token) return undefined
  return { Authorization: `Bearer ${token}` }
}

export async function getAuditFeed(
  filters: AuditFeedFilters,
  pagination: { page: number; pageSize: number },
): Promise<AuditFeedResponse> {
  return apiGet<AuditFeedResponse>(
    '/api/audit-feed',
    {
      entityType: filters.entityType,
      user: filters.user,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      search: filters.search,
      page: String(pagination.page),
      pageSize: String(pagination.pageSize),
    },
    { headers: authHeaders() },
  )
}

export async function getAuditFeedUsers(): Promise<AuditFeedUser[]> {
  return apiGet<AuditFeedUser[]>('/api/audit-feed/users', undefined, { headers: authHeaders() })
}

/**
 * Deleting from the feed is deleting from the entity — the same endpoint the card
 * calls, chosen by the row's own `entityType`.
 *
 * There is deliberately no `DELETE /api/audit-feed/...`: a second path to the same
 * record is a second rule about who may remove it and what happens when they do,
 * and the two would drift. The feed is a view; the record belongs to its entity.
 */
export async function deleteAuditFeedEntry(row: AuditFeedRow): Promise<void> {
  switch (row.entityType) {
    case 'product':
      return deleteProductAuditEntry(row.entityId, row.entryId)
    case 'order':
      return deleteOrderAuditEntry(row.entityId, row.entryId)
    case 'client':
      return deleteClientAuditEntry(row.entityId, row.entryId)
    case 'supplier':
      return deleteSupplierAuditEntry(row.entityId, row.entryId)
    case 'stock':
      return deleteStockAuditEntry(row.entityId, row.entryId)
    case 'batch':
      return deleteBatchAuditEntry(row.entityId, row.entryId)
    case 'offcut':
      return deleteOffcutAuditEntry(row.entityId, row.entryId)
    case 'movement':
      return deleteMovementAuditEntry(row.entityId, row.entryId)
    case 'deficit':
      return deleteDeficitAuditEntry(row.entityId, row.entryId)
  }
}
