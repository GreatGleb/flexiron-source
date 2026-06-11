import { apiGet, apiPost, apiPatch, apiDelete } from './api'
import type {
  FinancePayment,
  FinancePaymentListItem,
  PaymentDocument,
  FinanceDocumentArchiveItem,
  PaymentDirection,
  FinancePaymentFilters,
} from '@/types/finance'
import type { PaginatedResponse, PaginationParams } from '@/types/api'

export async function getPayments(
  direction: PaymentDirection | 'all',
  filters: FinancePaymentFilters,
  pagination: PaginationParams,
): Promise<PaginatedResponse<FinancePaymentListItem>> {
  const params: Record<string, string> = {
    direction,
    search: filters.search,
    status: filters.status,
    page: String(pagination.page),
    pageSize: String(pagination.pageSize),
  }
  if (filters.counterpartyId) params.counterpartyId = filters.counterpartyId
  if (filters.dateFrom) params.dateFrom = filters.dateFrom
  if (filters.dateTo) params.dateTo = filters.dateTo
  return apiGet<PaginatedResponse<FinancePaymentListItem>>('/api/finance/payments', params)
}

export async function getPayment(id: string): Promise<FinancePayment> {
  return apiGet<FinancePayment>(`/api/finance/payments/${id}`)
}

export async function patchPayment(id: string, data: Partial<FinancePayment>): Promise<FinancePayment> {
  return apiPatch<FinancePayment>(`/api/finance/payments/${id}`, data)
}

export async function addPaymentDocument(paymentId: string, document: PaymentDocument): Promise<FinancePayment> {
  return apiPost<FinancePayment>(`/api/finance/payments/${paymentId}/documents`, document)
}

export async function removePaymentDocument(paymentId: string, documentId: string): Promise<void> {
  return apiDelete<void>(`/api/finance/payments/${paymentId}/documents/${documentId}`)
}

export async function getArchive(
  filters: { search: string; type: string; relatedEntityType: string },
  pagination: PaginationParams,
): Promise<PaginatedResponse<FinanceDocumentArchiveItem>> {
  const params: Record<string, string> = {
    search: filters.search,
    type: filters.type,
    relatedEntityType: filters.relatedEntityType,
    page: String(pagination.page),
    pageSize: String(pagination.pageSize),
  }
  return apiGet<PaginatedResponse<FinanceDocumentArchiveItem>>('/api/finance/archive', params)
}
