import { apiGet, apiPost, apiPatch, apiDelete } from './api'
import type { PaginationParams } from '@/types/api'
import type {
  WarehouseBatch,
  BatchCreatePayload,
  BatchPatchPayload,
  WarehouseOffcut,
  OffcutCreatePayload,
  OffcutPatchPayload,
  WarehouseMovement,
  MovementCreatePayload,
  CuttingOperation,
  WarehouseDeficit,
  DeficitCreatePayload,
  DeficitPatchPayload,
  StockPatchPayload,
  StockAuditEntry,
  WarehouseFilters,
  StockFilters,
  StockOverviewItem,
  BatchListResponse,
  OffcutListResponse,
  MovementListResponse,
  DeficitListResponse,
  StockOverviewResponse,
  BatchStatusAggregate,
  BatchActiveSale,
} from '@/types/warehouse'

// ─── Stock Overview ─────────────────────────────────────────────────────────

export async function getStockOverview(
  filters: StockFilters,
  pagination: PaginationParams,
): Promise<StockOverviewResponse> {
  const params: Record<string, string> = {
    search: filters.search,
    page: String(pagination.page),
    pageSize: String(pagination.pageSize),
  }
  if (filters.categoryIds.length > 0) params.categoryIds = filters.categoryIds.join(',')
  if (filters.unit) params.unit = filters.unit
  if (filters.showDeficitOnly) params.showDeficitOnly = 'true'
  if (filters.showInStockOnly) params.showInStockOnly = 'true'
  if (filters.sortBy) {
    params.sortBy = filters.sortBy
    params.sortDir = filters.sortDir
  }
  return apiGet<StockOverviewResponse>('/api/warehouse/stock', params)
}

export async function getStockItem(productId: string): Promise<StockOverviewItem> {
  return apiGet<StockOverviewItem>(`/api/warehouse/stock/${productId}`)
}

export async function patchStockItem(
  productId: string,
  delta: StockPatchPayload,
): Promise<StockOverviewItem> {
  return apiPatch<StockOverviewItem>(`/api/warehouse/stock/${productId}`, delta)
}

export async function getBatchCostBreakdown(
  productId: string,
  quantity: number,
): Promise<{ unitPrice: number; totalCost: number }> {
  return apiGet(`/api/warehouse/stock/${productId}/cost`, {
    quantity: String(quantity),
  })
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
  if (filters.unit) params.unit = filters.unit
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
  if (filters.unit) params.unit = filters.unit
  if (filters.offcutType) params.offcutType = filters.offcutType
  if (filters.categoryIds && filters.categoryIds.length > 0)
    params.categoryIds = filters.categoryIds.join(',')
  if (filters.batchNumber) params.batchNumber = filters.batchNumber
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

export async function patchOffcut(id: string, data: OffcutPatchPayload): Promise<WarehouseOffcut> {
  return apiPatch<WarehouseOffcut>(`/api/warehouse/offcuts/${id}`, data)
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
  if (filters.unit) params.unit = filters.unit
  if (filters.categoryIds && filters.categoryIds.length > 0)
    params.categoryIds = filters.categoryIds.join(',')
  if (filters.batchNumber) params.batchNumber = filters.batchNumber
  if (filters.referenceId) params.referenceId = filters.referenceId
  if (filters.offcutId) params.offcutId = filters.offcutId
  if (filters.dateFrom) params.dateFrom = filters.dateFrom
  if (filters.dateTo) params.dateTo = filters.dateTo
  if (filters.sortBy) params.sortBy = filters.sortBy
  if (filters.sortDir) params.sortDir = filters.sortDir
  return apiGet<MovementListResponse>('/api/warehouse/movements', params)
}

export async function createMovement(data: MovementCreatePayload): Promise<WarehouseMovement> {
  return apiPost<WarehouseMovement>('/api/warehouse/movements', data)
}

export async function getMovement(id: string): Promise<WarehouseMovement> {
  return apiGet<WarehouseMovement>(`/api/warehouse/movements/${id}`)
}

// ─── Batch Aggregates & Active Sales ────────────────────────────────────────

export async function getBatchAggregates(batchId: string): Promise<BatchStatusAggregate[]> {
  return apiGet<BatchStatusAggregate[]>(`/api/warehouse/batches/${batchId}/aggregates`)
}

export async function getBatchActiveSales(batchId: string): Promise<BatchActiveSale[]> {
  return apiGet<BatchActiveSale[]>(`/api/warehouse/batches/${batchId}/active-sales`)
}

// ─── Cutting Operation ──────────────────────────────────────────────────────

export async function executeCutting(
  data: CuttingOperation,
): Promise<{ offcuts: WarehouseOffcut[]; wasteQuantity: number }> {
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
  if (filters.unit) params.unit = filters.unit
  if (filters.categoryIds && filters.categoryIds.length > 0)
    params.categoryIds = filters.categoryIds.join(',')
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

export async function patchDeficitItem(
  id: string,
  delta: DeficitPatchPayload,
): Promise<WarehouseDeficit> {
  return apiPatch<WarehouseDeficit>(`/api/warehouse/deficit/${id}`, delta)
}

export async function deleteDeficitItem(id: string): Promise<void> {
  return apiDelete(`/api/warehouse/deficit/${id}`)
}

// ─── Export ────────────────────────────────────────────────────────────────

export async function exportWarehouseData(
  tab: string,
  filters: StockFilters | WarehouseFilters,
  locale?: string,
): Promise<string> {
  const params: Record<string, string> = {}
  if (locale) params._locale = locale

  // Common params
  if ('search' in filters && filters.search) params.search = filters.search

  // Stock-specific params
  if (tab === 'stock') {
    const sf = filters as StockFilters
    if (sf.categoryIds.length > 0) params.categoryIds = sf.categoryIds.join(',')
    if (sf.unit) params.unit = sf.unit
    if (sf.showDeficitOnly) params.showDeficitOnly = 'true'
    if (sf.showInStockOnly) params.showInStockOnly = 'true'
  }

  // Batches-specific params
  if (tab === 'batches') {
    const bf = filters as WarehouseFilters
    if (bf.productId) params.productId = bf.productId
    if (bf.supplierId) params.supplierId = bf.supplierId
    if (bf.status) params.status = bf.status
    if (bf.unit) params.unit = bf.unit
    if (bf.dateFrom) params.dateFrom = bf.dateFrom
    if (bf.dateTo) params.dateTo = bf.dateTo
  }

  // Offcuts-specific params
  if (tab === 'offcuts') {
    const of = filters as WarehouseFilters
    if (of.status) params.status = of.status
    if (of.unit) params.unit = of.unit
    if (of.offcutType) params.offcutType = of.offcutType
    if (of.categoryIds?.length) params.categoryIds = of.categoryIds.join(',')
    if (of.batchNumber) params.batchNumber = of.batchNumber
  }

  // Movements-specific params
  if (tab === 'movements') {
    const mf = filters as WarehouseFilters
    if (mf.type) params.type = mf.type
    if (mf.unit) params.unit = mf.unit
    if (mf.categoryIds?.length) params.categoryIds = mf.categoryIds.join(',')
    if (mf.batchNumber) params.batchNumber = mf.batchNumber
    if (mf.dateFrom) params.dateFrom = mf.dateFrom
    if (mf.dateTo) params.dateTo = mf.dateTo
  }

  // Deficit-specific params
  if (tab === 'deficit') {
    const df = filters as WarehouseFilters
    if (df.status) params.status = df.status
    if (df.priority) params.priority = df.priority
    if (df.unit) params.unit = df.unit
    if (df.categoryIds?.length) params.categoryIds = df.categoryIds.join(',')
  }

  return apiGet<string>(`/api/warehouse/export/${tab}`, params)
}

// ─── Stock Audit ────────────────────────────────────────────────────────────

export async function getStockAudit(productId: string): Promise<StockAuditEntry[]> {
  return apiGet<StockAuditEntry[]>(`/api/warehouse/stock/${productId}/audit`)
}

export async function deleteStockAuditEntry(productId: string, entryIndex: number): Promise<void> {
  return apiDelete<void>(`/api/warehouse/stock/${productId}/audit/${entryIndex}`)
}

// ─── Batch Audit ────────────────────────────────────────────────────────────

export async function getBatchAudit(batchId: string): Promise<StockAuditEntry[]> {
  return apiGet<StockAuditEntry[]>(`/api/warehouse/batches/${batchId}/audit`)
}

export async function deleteBatchAuditEntry(batchId: string, entryIndex: number): Promise<void> {
  return apiDelete<void>(`/api/warehouse/batches/${batchId}/audit/${entryIndex}`)
}

// ─── Offcut Audit ───────────────────────────────────────────────────────────

export async function getOffcutAudit(offcutId: string): Promise<StockAuditEntry[]> {
  return apiGet<StockAuditEntry[]>(`/api/warehouse/offcuts/${offcutId}/audit`)
}

export async function deleteOffcutAuditEntry(offcutId: string, entryIndex: number): Promise<void> {
  return apiDelete<void>(`/api/warehouse/offcuts/${offcutId}/audit/${entryIndex}`)
}

// ─── Movement Audit ─────────────────────────────────────────────────────────

export async function getMovementAudit(movementId: string): Promise<StockAuditEntry[]> {
  return apiGet<StockAuditEntry[]>(`/api/warehouse/movements/${movementId}/audit`)
}

export async function deleteMovementAuditEntry(
  movementId: string,
  entryIndex: number,
): Promise<void> {
  return apiDelete<void>(`/api/warehouse/movements/${movementId}/audit/${entryIndex}`)
}

// ─── Deficit Audit ──────────────────────────────────────────────────────────

export async function getDeficitAudit(deficitId: string): Promise<StockAuditEntry[]> {
  return apiGet<StockAuditEntry[]>(`/api/warehouse/deficit/${deficitId}/audit`)
}

export async function deleteDeficitAuditEntry(
  deficitId: string,
  entryIndex: number,
): Promise<void> {
  return apiDelete<void>(`/api/warehouse/deficit/${deficitId}/audit/${entryIndex}`)
}
