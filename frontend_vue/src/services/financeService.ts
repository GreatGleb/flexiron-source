import { apiGet, apiPatch } from './api'
import type {
  FinancePayment,
  FinancePaymentListItem,
  FinanceDocumentArchiveItem,
  FinanceListFilters,
  Receivable,
} from '@/types/finance'
import type { PaginatedResponse, PaginationParams } from '@/types/api'

/**
 * Реестр «Входящие» — счета заказов, а не отдельные платёжные записи: своего
 * хранилища у него нет, и потому это отдельный эндпоинт, а не направление
 * фильтра над `/payments` (пункт 13 плана `review-followups.md`).
 */
export async function getReceivables(
  filters: FinanceListFilters,
  pagination: PaginationParams,
): Promise<PaginatedResponse<Receivable>> {
  return apiGet<PaginatedResponse<Receivable>>('/api/finance/receivables', {
    search: filters.search,
    status: filters.status,
    page: String(pagination.page),
    pageSize: String(pagination.pageSize),
  })
}

/** Счета поставщиков — записи с ручным вводом, выводить их не из чего. */
export async function getPayments(
  filters: FinanceListFilters,
  pagination: PaginationParams,
): Promise<PaginatedResponse<FinancePaymentListItem>> {
  return apiGet<PaginatedResponse<FinancePaymentListItem>>('/api/finance/payments', {
    search: filters.search,
    status: filters.status,
    page: String(pagination.page),
    pageSize: String(pagination.pageSize),
  })
}

export async function getPayment(id: string): Promise<FinancePayment> {
  return apiGet<FinancePayment>(`/api/finance/payments/${id}`)
}

export async function patchPayment(
  id: string,
  data: Partial<FinancePayment> & { fileIds?: string[] },
): Promise<FinancePayment> {
  return apiPatch<FinancePayment>(`/api/finance/payments/${id}`, data)
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
