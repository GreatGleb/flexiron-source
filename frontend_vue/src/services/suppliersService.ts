import { apiGet, apiPost, apiPatch, apiDelete } from './api'
import type { Supplier, SupplierCardData, SupplierFilters } from '@/types/supplier'
import type { PaginatedResponse, PaginationParams } from '@/types/api'

export async function getSuppliers(
  filters: SupplierFilters,
  pagination: PaginationParams,
): Promise<PaginatedResponse<Supplier>> {
  const params: Record<string, string> = {
    page: String(pagination.page),
    pageSize: String(pagination.pageSize),
    search: filters.search,
    status: filters.status,
    rating: String(filters.rating),
  }
  if (filters.categories.length > 0) {
    params.categories = filters.categories.join(',')
  }
  return apiGet<PaginatedResponse<Supplier>>('/api/suppliers', params)
}

export async function getSupplier(id: string): Promise<SupplierCardData> {
  return apiGet<SupplierCardData>(`/api/suppliers/${id}`)
}

/** PATCH supplier card. Send ONLY dirty fields — merge happens server-side. */
export async function patchSupplier(
  id: string,
  patch: Partial<SupplierCardData>,
): Promise<SupplierCardData> {
  return apiPatch<SupplierCardData>(`/api/suppliers/${id}`, patch)
}

/** Quick status change (drag-drop in kanban). */
export async function patchSupplierStatus(id: string, status: string): Promise<void> {
  await apiPatch<void>(`/api/suppliers/${id}/status`, { status })
}

export async function createSupplier(
  payload: Partial<SupplierCardData>,
): Promise<SupplierCardData> {
  return apiPost<SupplierCardData>('/api/suppliers', payload)
}

export async function deleteAuditEntry(supplierId: string, entryIndex: number): Promise<void> {
  await apiDelete<void>(`/api/suppliers/${supplierId}/audit/${entryIndex}`)
}

export async function exportSuppliersCsv(filters: SupplierFilters): Promise<string> {
  const params: Record<string, string> = {
    search: filters.search,
    status: filters.status,
    rating: String(filters.rating),
  }
  if (filters.categories.length > 0) params.categories = filters.categories.join(',')
  return apiGet<string>('/api/suppliers/export.csv', params)
}
