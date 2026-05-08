import { apiGet, apiPost, apiPatch, apiDelete } from './api'
import type { PaginationParams } from '@/types/api'
import type {
  WarehouseBatch,
  BatchCreatePayload,
  BatchPatchPayload,
  WarehouseOffcut,
  OffcutCreatePayload,
  WarehouseMovement,
  MovementCreatePayload,
  CuttingOperation,
  WarehouseDeficit,
  DeficitCreatePayload,
  DeficitPatchPayload,
  WarehouseFilters,
  BatchListResponse,
  OffcutListResponse,
  MovementListResponse,
  DeficitListResponse,
  StockOverviewResponse,
} from '@/types/warehouse'

// ─── Stock Overview ─────────────────────────────────────────────────────────

export async function getStockOverview(): Promise<StockOverviewResponse> {
  return apiGet<StockOverviewResponse>('/api/warehouse/stock')
}

export async function deleteStockItem(productId: string): Promise<void> {
  return apiDelete(`/api/warehouse/stock/${productId}`)
}

// ─── Batches ────────────────────────────────────────────────────────────────

export async function getBatches(
  filters: WarehouseFilters,
  pagination: PaginationParams,
): Promise<BatchListResponse> {
  const params: Record<string, string> = {
    search: filters.search,
    page: String(pagination.page),
    pageSize: String(pagination.pageSize),
  }
  if (filters.productId) params.productId = filters.productId
  if (filters.supplierId) params.supplierId = filters.supplierId
  if (filters.status) params.status = filters.status
  if (filters.dateFrom) params.dateFrom = filters.dateFrom
  if (filters.dateTo) params.dateTo = filters.dateTo
  if (filters.sortBy) params.sortBy = filters.sortBy
  if (filters.sortDir) params.sortDir = filters.sortDir
  return apiGet<BatchListResponse>('/api/warehouse/batches', params)
}

export async function getBatch(id: string): Promise<WarehouseBatch> {
  return apiGet<WarehouseBatch>(`/api/warehouse/batches/${id}`)
}

export async function createBatch(data: BatchCreatePayload): Promise<WarehouseBatch> {
  return apiPost<WarehouseBatch>('/api/warehouse/batches', data)
}

export async function patchBatch(id: string, delta: BatchPatchPayload): Promise<WarehouseBatch> {
  return apiPatch<WarehouseBatch>(`/api/warehouse/batches/${id}`, delta)
}

export async function deleteBatch(id: string): Promise<void> {
  return apiDelete(`/api/warehouse/batches/${id}`)
}

// ─── Offcuts ────────────────────────────────────────────────────────────────

export async function getOffcuts(
  filters: WarehouseFilters,
  pagination: PaginationParams,
): Promise<OffcutListResponse> {
  const params: Record<string, string> = {
    search: filters.search,
    page: String(pagination.page),
    pageSize: String(pagination.pageSize),
  }
  if (filters.productId) params.productId = filters.productId
  if (filters.status) params.status = filters.status
  if (filters.sortBy) params.sortBy = filters.sortBy
  if (filters.sortDir) params.sortDir = filters.sortDir
  return apiGet<OffcutListResponse>('/api/warehouse/offcuts', params)
}

export async function getOffcut(id: string): Promise<WarehouseOffcut> {
  return apiGet<WarehouseOffcut>(`/api/warehouse/offcuts/${id}`)
}

export async function createOffcut(data: OffcutCreatePayload): Promise<WarehouseOffcut> {
  return apiPost<WarehouseOffcut>('/api/warehouse/offcuts', data)
}

export async function deleteOffcut(id: string): Promise<void> {
  return apiDelete(`/api/warehouse/offcuts/${id}`)
}

// ─── Movements ──────────────────────────────────────────────────────────────

export async function getMovements(
  filters: WarehouseFilters,
  pagination: PaginationParams,
): Promise<MovementListResponse> {
  const params: Record<string, string> = {
    search: filters.search,
    page: String(pagination.page),
    pageSize: String(pagination.pageSize),
  }
  if (filters.type) params.type = filters.type
  if (filters.productId) params.productId = filters.productId
  if (filters.dateFrom) params.dateFrom = filters.dateFrom
  if (filters.dateTo) params.dateTo = filters.dateTo
  if (filters.sortBy) params.sortBy = filters.sortBy
  if (filters.sortDir) params.sortDir = filters.sortDir
  return apiGet<MovementListResponse>('/api/warehouse/movements', params)
}

export async function createMovement(data: MovementCreatePayload): Promise<WarehouseMovement> {
  return apiPost<WarehouseMovement>('/api/warehouse/movements', data)
}

// ─── Cutting Operation ──────────────────────────────────────────────────────

export async function executeCutting(data: CuttingOperation): Promise<{ offcuts: WarehouseOffcut[]; wasteQuantity: number }> {
  return apiPost('/api/warehouse/cutting', data)
}

// ─── Deficit ────────────────────────────────────────────────────────────────

export async function getDeficitList(
  filters: WarehouseFilters,
  pagination: PaginationParams,
): Promise<DeficitListResponse> {
  const params: Record<string, string> = {
    search: filters.search,
    page: String(pagination.page),
    pageSize: String(pagination.pageSize),
  }
  if (filters.priority) params.priority = filters.priority
  if (filters.status) params.status = filters.status
  if (filters.sortBy) params.sortBy = filters.sortBy
  if (filters.sortDir) params.sortDir = filters.sortDir
  return apiGet<DeficitListResponse>('/api/warehouse/deficit', params)
}

export async function getDeficitItem(id: string): Promise<WarehouseDeficit> {
  return apiGet<WarehouseDeficit>(`/api/warehouse/deficit/${id}`)
}

export async function createDeficitItem(data: DeficitCreatePayload): Promise<WarehouseDeficit> {
  return apiPost<WarehouseDeficit>('/api/warehouse/deficit', data)
}

export async function patchDeficitItem(id: string, delta: DeficitPatchPayload): Promise<WarehouseDeficit> {
  return apiPatch<WarehouseDeficit>(`/api/warehouse/deficit/${id}`, delta)
}

export async function deleteDeficitItem(id: string): Promise<void> {
  return apiDelete(`/api/warehouse/deficit/${id}`)
}
