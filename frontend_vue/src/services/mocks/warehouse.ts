import type {
  WarehouseBatch,
  WarehouseOffcut,
  WarehouseMovement,
  MovementListItem,
  MovementType,
  WarehouseDeficit,
  DeficitListResponse,
  DeficitListItem,
  StockOverviewItem,
  StockAuditEntry,
  StockUnit,
  CuttingOperation,
  BatchStatusAggregate,
  BatchActiveSale,
  StockOverviewResponse,
  StockPatchPayload,
  BatchListResponse,
  BatchPatchPayload,
  OffcutListResponse,
  OffcutCreatePayload,
  OffcutPatchPayload,
  MovementListResponse,
  DeficitCreatePayload,
  DeficitPatchPayload,
} from '@/types/warehouse'
import type { PaginatedResponse } from '@/types/api'
import { STORE as PRODUCTS_STORE } from './products'
import {
  mockBatches as mockBatchesData,
  mockOffcuts as mockOffcutsData,
  mockMovements as mockMovementsData,
  mockDeficit as mockDeficitData,
  mockStockOverview as mockStockOverviewData,
} from '@/mocks/warehouse'

// ─── In-memory stores ───────────────────────────────────────────────────────

const batchStore: WarehouseBatch[] = mockBatchesData as WarehouseBatch[]
const offcutStore: WarehouseOffcut[] = [...mockOffcutsData]
const movementStore: WarehouseMovement[] = [...mockMovementsData]
const deficitStore: WarehouseDeficit[] = [...mockDeficitData]
const stockStore: StockOverviewItem[] = [...mockStockOverviewData]

// Track IDs of pre-existing mock entities so we can distinguish them
// from dynamically created ones (e.g. to avoid generating fake audit data for new entities)
const preExistingOffcutIds = new Set(mockOffcutsData.map((o) => o.id))
const preExistingMovementIds = new Set(mockMovementsData.map((m) => m.id))
const preExistingDeficitIds = new Set(mockDeficitData.map((d) => d.id))

let batchSeq = batchStore.length + 1
let offcutSeq = offcutStore.length + 1
let movementSeq = movementStore.length + 1
let deficitSeq = deficitStore.length + 1

// ─── Helper: get current value of a specific aggregate from movements ─────
function getAggregateQty(batchId: string, targetType: string): number {
  const outgoingTypes = new Set(['sale', 'expense', 'write-off', 'production', 'return-to-supplier', 'storage', 'offcut'])
  const movements = movementStore.filter((m) => m.batchId === batchId)
  let qty = 0
  for (const m of movements) {
    if (m.type === 'receipt' || m.type === 'transfer') continue
    if (m.type === 'correction') continue
    if (m.type === targetType) qty += m.quantity
    else if (m.type === 'return' && m.referenceType === targetType) qty -= m.quantity
  }
  // Apply corrections for this type
  for (const m of movements) {
    if (m.type !== 'correction' || m.referenceType !== targetType) continue
    qty = m.quantity
  }
  return qty
}

// ─── Compute batch status from aggregate distribution ─────────────────────
// Rules:
//   receipt > 0 AND no other aggregates → 'available'
//   receipt > 0 AND other aggregates exist → 'partial'
//   receipt = 0 AND other aggregates exist → 'depleted'
/** Map aggregate type → batch status when 100% of goods are in that type */
const AGGREGATE_TO_STATUS: Record<string, string> = {
  receipt: 'available',
  storage: 'in_storage',
  production: 'in_production',
  sale: 'sold',
  'write-off': 'scrapped',
  expense: 'expensed',
  'return-to-supplier': 'returned_to_supplier',
  offcut: 'converted_to_offcuts',
}

function computeBatchStatus(batch: WarehouseBatch): string {
  const movements = movementStore.filter((m) => m.batchId === batch.id)
  const outgoingTypes = new Set(['sale', 'expense', 'write-off', 'production', 'return-to-supplier', 'storage', 'offcut'])
  const byType: Record<string, number> = {}

  for (const m of movements) {
    if (m.type === 'receipt' || m.type === 'transfer') continue
    if (m.type === 'correction') continue
    if (m.type === 'return') {
      const reduceType = m.referenceType || ''
      if (reduceType && outgoingTypes.has(reduceType)) byType[reduceType] = (byType[reduceType] || 0) - m.quantity
      continue
    }
    if (outgoingTypes.has(m.type)) byType[m.type] = (byType[m.type] || 0) + m.quantity
  }
  // Second pass: corrections set aggregate directly
  for (const m of movements) {
    if (m.type !== 'correction' || !m.referenceType || m.referenceType === 'receipt') continue
    if (outgoingTypes.has(m.referenceType)) byType[m.referenceType] = m.quantity
  }

  // Find which single aggregate has 100% of goods
  const nonZero = Object.entries(byType).filter(([, q]) => q > 0)
  const hasReceipt = batch.quantityRemaining > 0

  // If receipt is the ONLY aggregate → 'available'
  if (hasReceipt && nonZero.length === 0) return 'available' as const

  // If receipt + other aggregates → 'partial'
  if (hasReceipt && nonZero.length > 0) return 'partial' as const

  // No receipt: check if goods are 100% in one other aggregate
  if (!hasReceipt && nonZero.length === 1) {
    return AGGREGATE_TO_STATUS[nonZero[0]![0]] || 'depleted'
  }

  // No receipt, multiple aggregates or none → 'depleted'
  return 'depleted'
}

// ─── Sync batch quantities & statuses with movements ────────────────────────
// Runs once at module load to ensure all batches reflect their movements.
;(function syncBatchQuantities() {
  const outgoingTypes: ReadonlySet<string> = new Set(['sale', 'expense', 'write-off', 'production', 'return-to-supplier', 'storage', 'offcut'])
  for (const batch of batchStore) {
    const movements = movementStore.filter((m) => m.batchId === batch.id)
    let remaining = batch.quantity
    for (const m of movements) {
      if (outgoingTypes.has(m.type)) {
        remaining -= m.quantity
      } else if (m.type === 'return') {
        remaining += m.quantity
      }
    }
    batch.quantityRemaining = Math.max(0, remaining)
    batch.status = computeBatchStatus(batch) as WarehouseBatch['status']
  }
})()

// ─── Helpers ────────────────────────────────────────────────────────────────

function paginate<T>(items: T[], page: number, pageSize: number): PaginatedResponse<T> {
  const total = items.length
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

function matchSearch(item: { productName: { ru: string; en: string; lt: string } }, q: string): boolean {
  const query = q.toLowerCase()
  return (
    item.productName.ru.toLowerCase().includes(query) ||
    item.productName.en.toLowerCase().includes(query) ||
    item.productName.lt.toLowerCase().includes(query)
  )
}

// ─── Stock Overview ─────────────────────────────────────────────────────────

export async function mockGetStockOverview(
  filters: {
    search: string
    categoryIds?: string
    unit?: string
    showDeficitOnly?: string
    showInStockOnly?: string
    sortBy?: string
    sortDir?: string
  },
  pagination: { page: number; pageSize: number },
): Promise<StockOverviewResponse> {
  let filtered = [...stockStore]

  // Search
  if (filters.search) {
    const q = filters.search.toLowerCase()
    filtered = filtered.filter(
      (s) =>
        s.productName.ru.toLowerCase().includes(q) ||
        s.productName.en.toLowerCase().includes(q) ||
        s.productName.lt.toLowerCase().includes(q) ||
        s.productId.toLowerCase().includes(q),
    )
  }
  // Filter by category
  if (filters.categoryIds) {
    const cats = filters.categoryIds.split(',').filter(Boolean)
    if (cats.length > 0) filtered = filtered.filter((s) => cats.includes(s.categoryId!))
  }
  if (filters.unit) filtered = filtered.filter((s) => s.unit === filters.unit)
  if (filters.showDeficitOnly === 'true') filtered = filtered.filter((s) => s.isDeficit)
  if (filters.showInStockOnly === 'true') filtered = filtered.filter((s) => s.availableQuantity > 0)

  // Sort
  const sortBy = filters.sortBy || 'productName'
  const sortDir = filters.sortDir || 'asc'
  filtered.sort((a, b) => {
    let cmp = 0
    if (sortBy === 'productName') cmp = a.productName.en.localeCompare(b.productName.en)
    else if (sortBy === 'totalQuantity') cmp = a.totalQuantity - b.totalQuantity
    else if (sortBy === 'availableQuantity') cmp = a.availableQuantity - b.availableQuantity
    else if (sortBy === 'avgUnitPrice') cmp = a.avgUnitPrice - b.avgUnitPrice
    else if (sortBy === 'totalValue') cmp = a.totalValue - b.totalValue
    else if (sortBy === 'minStock') cmp = (a.minStock ?? 0) - (b.minStock ?? 0)
    return sortDir === 'desc' ? -cmp : cmp
  })

  return paginateStock(filtered, pagination.page, pagination.pageSize)
}

function paginateStock(items: StockOverviewItem[], page: number, pageSize: number): StockOverviewResponse {
  const total = items.length
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function mockGetStockItem(productId: string): Promise<StockOverviewItem> {
  const item = stockStore.find((s) => s.productId === productId)
  if (!item) throw new Error('STOCK_ITEM_NOT_FOUND')
  return { ...item }
}

export async function mockPatchStockItem(productId: string, delta: StockPatchPayload): Promise<StockOverviewItem> {
  const item = stockStore.find((s) => s.productId === productId)
  if (!item) throw new Error('STOCK_ITEM_NOT_FOUND')
  Object.assign(item, delta)
  return { ...item }
}

// ─── Batches ────────────────────────────────────────────────────────────────

export async function mockGetBatches(
  filters: {
    search: string
    productId?: string
    supplierId?: string
    status?: string
    unit?: string
    dateFrom?: string
    dateTo?: string
    sortBy?: string
    sortDir?: string
  },
  pagination: { page: number; pageSize: number },
): Promise<BatchListResponse> {
  let filtered = [...batchStore]
  if (filters.search) {
    const q = filters.search.toLowerCase()
    filtered = filtered.filter(
      (b) =>
        b.productName.ru.toLowerCase().includes(q) ||
        b.productName.en.toLowerCase().includes(q) ||
        b.productName.lt.toLowerCase().includes(q) ||
        b.batchNumber.toLowerCase().includes(q),
    )
  }
  if (filters.productId) filtered = filtered.filter((b) => b.productId === filters.productId)
  if (filters.supplierId) filtered = filtered.filter((b) => b.supplierId === filters.supplierId)
  if (filters.status) filtered = filtered.filter((b) => b.status === filters.status)
  if (filters.unit) filtered = filtered.filter((b) => b.unit === filters.unit)
  if (filters.dateFrom) filtered = filtered.filter((b) => b.receivedAt >= filters.dateFrom!)
  if (filters.dateTo) filtered = filtered.filter((b) => b.receivedAt <= filters.dateTo!)

  const sortBy = filters.sortBy || 'receivedAt'
  const sortDir = filters.sortDir || 'desc'
  filtered.sort((a, b) => {
    let cmp = 0
    if (sortBy === 'batchNumber') cmp = a.batchNumber.localeCompare(b.batchNumber)
    else if (sortBy === 'productName') cmp = a.productName.en.localeCompare(b.productName.en)
    else if (sortBy === 'quantity') cmp = a.quantity - b.quantity
    else if (sortBy === 'quantityRemaining') cmp = a.quantityRemaining - b.quantityRemaining
    else if (sortBy === 'unit') cmp = a.unit.localeCompare(b.unit)
    else if (sortBy === 'unitPrice') cmp = a.unitPrice - b.unitPrice
    else if (sortBy === 'status') cmp = a.status.localeCompare(b.status)
    else if (sortBy === 'supplierName') cmp = (a.supplierName?.en ?? '').localeCompare(b.supplierName?.en ?? '')
    else if (sortBy === 'receivedAt') cmp = a.receivedAt.localeCompare(b.receivedAt)
    return sortDir === 'desc' ? -cmp : cmp
  })

  return paginate(filtered, pagination.page, pagination.pageSize)
}

export async function mockGetBatch(id: string): Promise<WarehouseBatch> {
  const batch = batchStore.find((b) => b.id === id)
  if (!batch) throw new Error('BATCH_NOT_FOUND')
  return { ...batch }
}

export async function mockCreateBatch(data: {
  productId: string
  supplierId?: string | null
  batchNumber: string
  lotCode: string
  quantity: number
  unit: string
  unitPrice: number
  currency: string
  notes?: string | null
  locationRack?: string
  locationRow?: string
  locationCell?: string
  locationNotes?: string
}): Promise<WarehouseBatch> {
  const id = `whb-${String(batchSeq++).padStart(3, '0')}`
  const now = new Date().toISOString()
  const batch: WarehouseBatch = {
    id,
    productId: data.productId,
    productName: (() => {
      const product = PRODUCTS_STORE.find(p => p.id === data.productId)
      return product ? { ...product.name } : { ru: '', en: '', lt: '' }
    })(),
    supplierId: data.supplierId || null,
    supplierName: null,
    batchNumber: data.batchNumber,
    lotCode: data.lotCode,
    quantity: data.quantity,
    quantityRemaining: data.quantity,
    unit: data.unit as StockUnit,
    unitPrice: data.unitPrice,
    totalCost: data.quantity * data.unitPrice,
    currency: data.currency,
    receivedAt: now,
    expiresAt: null,
    location: null,
    certificateRef: null,
    status: 'available',
    notes: data.notes || null,
    orderId: null,
    files: [],
    createdAt: now,
    updatedAt: now,
  }
  batchStore.push(batch)
  return batch
}

export async function mockPatchBatch(id: string, delta: BatchPatchPayload): Promise<WarehouseBatch> {
  const batch = batchStore.find((b) => b.id === id)
  if (!batch) throw new Error('BATCH_NOT_FOUND')
  Object.assign(batch, delta, { updatedAt: new Date().toISOString() })
  // If location changed, auto-create a transfer movement
  if (delta.location && delta.location !== batch.location) {
    // (This is handled by useWarehouseBatch composable)
  }
  return { ...batch }
}

export async function mockDeleteBatch(id: string): Promise<void> {
  const idx = batchStore.findIndex((b) => b.id === id)
  if (idx === -1) throw new Error('BATCH_NOT_FOUND')
  batchStore.splice(idx, 1)
}

// ─── Offcuts ────────────────────────────────────────────────────────────────

export async function mockGetOffcuts(
  filters: {
    search: string
    productId?: string
    status?: string
    unit?: string
    offcutType?: string
    categoryIds?: string
    batchNumber?: string
    sortBy?: string
    sortDir?: string
  },
  pagination: { page: number; pageSize: number },
): Promise<OffcutListResponse> {
  let filtered = [...offcutStore]
  if (filters.search) {
    const q = filters.search.toLowerCase()
    filtered = filtered.filter(
      (o) =>
        o.productName.ru.toLowerCase().includes(q) ||
        o.productName.en.toLowerCase().includes(q) ||
        o.productName.lt.toLowerCase().includes(q),
    )
  }
  if (filters.productId) filtered = filtered.filter((o) => o.productId === filters.productId)
  if (filters.status) filtered = filtered.filter((o) => o.status === filters.status)
  if (filters.unit) filtered = filtered.filter((o) => o.unit === filters.unit)
  if (filters.offcutType) filtered = filtered.filter((o) => o.offcutType === filters.offcutType)
  if (filters.categoryIds) {
    const cats = filters.categoryIds.split(',').filter(Boolean)
    if (cats.length > 0) filtered = filtered.filter((o) => o.categoryId != null && cats.includes(o.categoryId))
  }
  if (filters.batchNumber) filtered = filtered.filter((o) => o.batchNumber?.toLowerCase() === filters.batchNumber!.toLowerCase())
  const sortBy = filters.sortBy || 'createdAt'
  const sortDir = filters.sortDir || 'desc'
  filtered.sort((a, b) => {
    let cmp = 0
    if (sortBy === 'createdAt') cmp = a.createdAt.localeCompare(b.createdAt)
    else if (sortBy === 'productName') cmp = a.productName.en.localeCompare(b.productName.en)
    else if (sortBy === 'quantity') cmp = a.quantity - b.quantity
    return sortDir === 'desc' ? -cmp : cmp
  })
  return paginate(filtered, pagination.page, pagination.pageSize)
}

export async function mockGetOffcut(id: string): Promise<WarehouseOffcut> {
  const offcut = offcutStore.find((o) => o.id === id)
  if (!offcut) throw new Error('OFFCUT_NOT_FOUND')
  return { ...offcut }
}

export async function mockCreateOffcut(data: OffcutCreatePayload): Promise<WarehouseOffcut> {
  const id = `offcut-${String(offcutSeq++).padStart(3, '0')}`
  const now = new Date().toISOString()

  // Find the source batch
  const batch = batchStore.find((b) => b.id === data.batchId)
  const batchNumber = batch?.batchNumber ?? ''

  const offcut: WarehouseOffcut = {
    id,
    batchId: data.batchId,
    batchNumber,
    productId: data.productId,
    productName: batch?.productName ?? { ru: '', en: '', lt: '' },
    categoryId: data.categoryId ?? null,
    offcutType: data.offcutType ?? 'sheet',
    lengthMm: data.lengthMm ?? null,
    widthMm: data.widthMm ?? null,
    thicknessMm: data.thicknessMm ?? null,
    weightKg: data.weightKg ?? null,
    quantity: data.quantity,
    unit: data.unit as StockUnit,
    location: data.location ?? null,
    status: 'available',
    notes: data.notes ?? null,
    qrData: null,
    orderId: null,
    files: [],
    createdAt: now,
    updatedAt: now,
    auditLog: [],
  }
  offcutStore.push(offcut)

  // Decrease batch remaining quantity
  if (batch) {
    batch.quantityRemaining = Math.max(0, batch.quantityRemaining - data.quantity)
    batch.updatedAt = now

    // Create a movement record for the offcut creation
    await mockCreateMovement({
      type: 'offcut',
      batchId: data.batchId,
      offcutId: id,
      quantity: data.quantity,
      movedAt: now,
      notes: `Offcut created from batch ${batchNumber}`,
    })
  }

  return offcut
}

export async function mockPatchOffcut(id: string, data: OffcutPatchPayload): Promise<WarehouseOffcut> {
  const offcut = offcutStore.find((o) => o.id === id)
  if (!offcut) throw new Error('OFFCUT_NOT_FOUND')
  Object.assign(offcut, data, { updatedAt: new Date().toISOString() })
  return { ...offcut }
}

export async function mockDeleteOffcut(id: string): Promise<void> {
  const idx = offcutStore.findIndex((o) => o.id === id)
  if (idx === -1) throw new Error('OFFCUT_NOT_FOUND')
  offcutStore.splice(idx, 1)
}

// ─── Movements ──────────────────────────────────────────────────────────────

const movementSortFieldMap: Record<string, string> = {
  movedAt: 'movedAt',
  type: 'type',
  productName: 'productName',
  batchNumber: 'batchNumber',
  quantity: 'quantity',
  unit: 'unit',
  unitPrice: 'unitPrice',
  totalCost: 'totalCost',
  referenceId: 'referenceId',
}

function toMovementListItem(m: WarehouseMovement): MovementListItem {
  return {
    id: m.id,
    type: m.type,
    batchId: m.batchId,
    batchNumber: m.batchNumber,
    offcutId: m.offcutId,
    productId: m.productId,
    productName: m.productName,
    quantity: m.quantity,
    unit: m.unit,
    unitPrice: m.unitPrice,
    referenceId: m.referenceId,
    referenceType: m.referenceType,
    notes: m.notes,
    movedAt: m.movedAt,
  }
}

export async function mockGetMovements(
  filters: {
    search: string
    type?: string
    productId?: string
    unit?: string
    categoryIds?: string
    batchNumber?: string
    referenceId?: string
    offcutId?: string
    dateFrom?: string
    dateTo?: string
    sortBy?: string
    sortDir?: string
  },
  pagination: { page: number; pageSize: number },
): Promise<MovementListResponse> {
  let filtered = [...movementStore]
  if (filters.search) {
    const q = filters.search.toLowerCase()
    filtered = filtered.filter(
      (m) =>
        m.productName.ru.toLowerCase().includes(q) ||
        m.productName.en.toLowerCase().includes(q) ||
        m.productName.lt.toLowerCase().includes(q) ||
        m.batchNumber.toLowerCase().includes(q),
    )
  }
  if (filters.type) filtered = filtered.filter((m) => m.type === filters.type)
  if (filters.productId) filtered = filtered.filter((m) => m.productId === filters.productId)
  if (filters.unit) filtered = filtered.filter((m) => m.unit === filters.unit)
  if (filters.batchNumber) filtered = filtered.filter((m) => m.batchNumber.toLowerCase() === filters.batchNumber!.toLowerCase())
  if (filters.referenceId) filtered = filtered.filter((m) => m.referenceId === filters.referenceId)
  if (filters.offcutId) filtered = filtered.filter((m) => m.offcutId === filters.offcutId)
  if (filters.dateFrom) filtered = filtered.filter((m) => m.movedAt >= filters.dateFrom!)
  if (filters.dateTo) filtered = filtered.filter((m) => m.movedAt <= filters.dateTo!)

  const sortBy = filters.sortBy || 'movedAt'
  const sortDir = filters.sortDir || 'desc'
  filtered.sort((a, b) => {
    let cmp = 0
    if (sortBy === 'movedAt') cmp = a.movedAt.localeCompare(b.movedAt)
    else if (sortBy === 'type') cmp = a.type.localeCompare(b.type)
    else if (sortBy === 'productName') cmp = a.productName.en.localeCompare(b.productName.en)
    else if (sortBy === 'batchNumber') cmp = a.batchNumber.localeCompare(b.batchNumber)
    else if (sortBy === 'quantity') cmp = a.quantity - b.quantity
    else if (sortBy === 'unit') cmp = a.unit.localeCompare(b.unit)
    else if (sortBy === 'unitPrice') cmp = a.unitPrice - b.unitPrice
    else if (sortBy === 'totalCost') cmp = (a.quantity * a.unitPrice) - (b.quantity * b.unitPrice)
    else if (sortBy === 'referenceId') cmp = (a.referenceId ?? '').localeCompare(b.referenceId ?? '')
    return sortDir === 'desc' ? -cmp : cmp
  })

  return paginate(filtered.map(toMovementListItem), pagination.page, pagination.pageSize)
}

export async function mockCreateMovement(data: {
  type: string
  batchId: string
  offcutId?: string | null
  quantity: number
  unitPrice?: number
  referenceId?: string | null
  referenceType?: string | null
  fromLocation?: string | null
  toLocation?: string | null
  performedBy?: string | null
  notes?: string | null
  movedAt?: string
}): Promise<WarehouseMovement> {
  const batch = batchStore.find((b) => b.id === data.batchId)
  if (!batch) throw new Error('BATCH_NOT_FOUND')

  const id = `whm-${String(movementSeq++).padStart(3, '0')}`
  const now = new Date().toISOString()
  const movement: WarehouseMovement = {
    id,
    type: data.type as WarehouseMovement['type'],
    batchId: data.batchId,
    batchNumber: batch.batchNumber,
    offcutId: data.offcutId ?? null,
    productId: batch.productId,
    productName: batch.productName,
    quantity: data.quantity,
    unit: batch.unit,
    unitPrice: data.unitPrice ?? batch.unitPrice,
    totalCost: data.quantity * (data.unitPrice ?? batch.unitPrice),
    referenceId: data.referenceId ?? null,
    referenceType: data.referenceType ?? null,
    fromLocation: data.fromLocation ?? null,
    toLocation: data.toLocation ?? null,
    performedBy: data.performedBy ?? null,
    notes: data.notes ?? null,
    movedAt: data.movedAt ?? now,
    createdAt: now,
    auditLog: [],
  }

  // ─── For non-receipt correction: compute delta BEFORE movement added ──
  // (getAggregateQty would include the new movement and return delta=0)
  let correctionDelta = 0
  const outgoingTypes = new Set(['sale', 'expense', 'write-off', 'production', 'return-to-supplier', 'storage', 'offcut'])
  if (data.type === 'correction' && data.referenceType && data.referenceType !== 'receipt') {
    if (outgoingTypes.has(data.referenceType)) {
      const currentQty = getAggregateQty(batch.id, data.referenceType)
      correctionDelta = data.quantity - currentQty
    }
  }

  movementStore.push(movement)

  // ─── Update batch quantity remaining based on movement type ──────────
  if (data.type === 'sale' || data.type === 'expense' || data.type === 'write-off' || data.type === 'production' || data.type === 'return-to-supplier' || data.type === 'storage' || data.type === 'offcut') {
    batch.quantityRemaining = Math.max(0, batch.quantityRemaining - data.quantity)
  }
  else if (data.type === 'receipt') {
    batch.quantityRemaining += data.quantity
    batch.quantity += data.quantity
    batch.totalCost += data.quantity * batch.unitPrice
  }
  else if (data.type === 'return') {
    batch.quantityRemaining += data.quantity
  }
  else if (data.type === 'correction') {
    if (data.referenceType === 'receipt') {
      // receipt correction: set remaining directly and adjust total by delta
      const oldRemaining = batch.quantityRemaining
      batch.quantityRemaining = Math.max(0, data.quantity)
      batch.quantity += batch.quantityRemaining - oldRemaining
    } else if (correctionDelta !== 0) {
      // Non-receipt correction: adjusts total batch quantity and cost, NOT remaining.
      // Goods are added/removed from inventory, not transferred from receipt.
      batch.quantity += correctionDelta
      batch.totalCost += correctionDelta * batch.unitPrice
    }
  }

  // Auto-update batch status based on aggregate distribution
  batch.status = computeBatchStatus(batch) as WarehouseBatch['status']
  batch.updatedAt = now

  return movement
}

export async function mockGetMovement(id: string): Promise<WarehouseMovement> {
  const movement = movementStore.find((m) => m.id === id)
  if (!movement) throw new Error('MOVEMENT_NOT_FOUND')
  const audit = preExistingMovementIds.has(id) ? [...getOrCreateMovementAudit(id)] : []
  return { ...movement, auditLog: audit }
}

export async function mockDeleteMovement(id: string): Promise<void> {
  const idx = movementStore.findIndex((m) => m.id === id)
  if (idx === -1) throw new Error('MOVEMENT_NOT_FOUND')
  movementStore.splice(idx, 1)
}

// ─── Batch Aggregates & Active Sales ────────────────────────────────────────

export async function mockGetBatchAggregates(batchId: string): Promise<BatchStatusAggregate[]> {
  const batch = batchStore.find((b) => b.id === batchId)
  if (!batch) return []

  const movements = movementStore.filter((m) => m.batchId === batchId)
  const outgoingTypes = new Set(['sale', 'expense', 'write-off', 'production', 'return-to-supplier', 'storage'])
  const byType: Record<string, number> = {}

  for (const m of movements) {
    if (m.type === 'receipt' || m.type === 'transfer') continue
    if (m.type === 'correction') continue // applied in second pass
    if (m.type === 'return') {
      const reduceType = m.referenceType || ''
      if (reduceType && outgoingTypes.has(reduceType)) byType[reduceType] = (byType[reduceType] || 0) - m.quantity
      continue
    }
    byType[m.type] = (byType[m.type] || 0) + m.quantity
  }
  // Second pass: corrections set aggregate directly
  for (const m of movements) {
    if (m.type !== 'correction' || !m.referenceType || m.referenceType === 'receipt') continue
    if (outgoingTypes.has(m.referenceType)) byType[m.referenceType] = m.quantity
  }

  const receiptQty = Math.max(0, batch.quantityRemaining)
  const result: BatchStatusAggregate[] = []
  if (receiptQty > 0) result.push({ type: 'receipt', quantity: receiptQty, unit: batch.unit })

  const sorted = Object.entries(byType)
    .filter(([, q]) => q > 0)
    .sort(([, a], [, b]) => b - a)
  for (const [type, quantity] of sorted) {
    result.push({ type: type as MovementType, quantity, unit: batch.unit })
  }
  return result
}

export async function mockGetBatchActiveSales(batchId: string): Promise<BatchActiveSale[]> {
  const batch = batchStore.find((b) => b.id === batchId)
  if (!batch) return []

  const returnQtyByRef: Record<string, number> = {}
  for (const m of movementStore) {
    if (m.batchId === batchId && m.type === 'return' && m.referenceId) {
      returnQtyByRef[m.referenceId] = (returnQtyByRef[m.referenceId] || 0) + m.quantity
    }
  }

  const sales = movementStore.filter((m) => m.batchId === batchId && m.type === 'sale')
  let idx = 0
  const result: BatchActiveSale[] = []
  for (const s of sales) {
    const returnedQty = s.referenceId ? (returnQtyByRef[s.referenceId] || 0) : 0
    const remaining = s.quantity - returnedQty
    if (remaining <= 0) continue
    idx++
    result.push({
      id: `sale-${batchId}-${String(idx).padStart(3, '0')}`,
      movementId: s.id,
      quantity: remaining,
      unit: s.unit,
      referenceId: s.referenceId ?? null,
      soldAt: s.movedAt,
    })
  }
  return result
}

// ─── Cutting Operation ──────────────────────────────────────────────────────

export async function mockExecuteCutting(data: CuttingOperation): Promise<{ offcuts: WarehouseOffcut[]; wasteQuantity: number }> {
  const batch = batchStore.find((b) => b.id === data.sourceBatchId)
  if (!batch) throw new Error('BATCH_NOT_FOUND')
  batch.quantityRemaining = Math.max(0, batch.quantityRemaining - data.sourceQuantity)
  batch.updatedAt = new Date().toISOString()
  return { offcuts: [], wasteQuantity: 0 }
}

// ─── Audit helpers & generators ─────────────────────────────────────────────

function getOrCreateMovementAudit(movementId: string): StockAuditEntry[] {
  if (!movementAuditStore[movementId]) {
    movementAuditStore[movementId] = []
  }
  return movementAuditStore[movementId]
}

const movementAuditStore: Record<string, StockAuditEntry[]> = {}

// ─── Deficit ────────────────────────────────────────────────────────────────

export async function mockGetDeficitList(
  filters: { search: string; priority?: string; status?: string; unit?: string; categoryIds?: string; sortBy?: string; sortDir?: string },
  pagination: { page: number; pageSize: number },
): Promise<DeficitListResponse> {
  let filtered = [...deficitStore]

  // Search by product name
  if (filters.search) {
    const q = filters.search.toLowerCase()
    filtered = filtered.filter(
      (d) =>
        d.productName.ru.toLowerCase().includes(q) ||
        d.productName.en.toLowerCase().includes(q) ||
        d.productName.lt.toLowerCase().includes(q),
    )
  }

  // Filter by priority
  if (filters.priority) {
    filtered = filtered.filter((d) => d.priority === filters.priority)
  }

  // Filter by status
  if (filters.status) {
    filtered = filtered.filter((d) => d.status === filters.status)
  }

  // Filter by unit
  if (filters.unit) {
    filtered = filtered.filter((d) => d.unit === filters.unit)
  }

  // Sort
  const sortBy = filters.sortBy || 'deficitAmount'
  const sortDir = filters.sortDir || 'desc'
  filtered.sort((a, b) => {
    let cmp = 0
    if (sortBy === 'productName') cmp = a.productName.en.localeCompare(b.productName.en)
    else if (sortBy === 'currentStock') cmp = a.currentStock - b.currentStock
    else if (sortBy === 'minRequired') cmp = a.minRequired - b.minRequired
    else if (sortBy === 'deficitAmount') cmp = a.deficitAmount - b.deficitAmount
    else if (sortBy === 'priority') {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
      cmp = (order[a.priority] ?? 0) - (order[b.priority] ?? 0)
    }
    return sortDir === 'desc' ? -cmp : cmp
  })

  return paginate(filtered, pagination.page, pagination.pageSize)
}

export async function mockGetDeficitItem(id: string): Promise<WarehouseDeficit> {
  const deficit = deficitStore.find((d) => d.id === id)
  if (!deficit) throw new Error('DEFICIT_NOT_FOUND')
  return { ...deficit }
}

export async function mockCreateDeficitItem(data: DeficitCreatePayload): Promise<WarehouseDeficit> {
  const id = `whd-${String(deficitSeq++).padStart(3, '0')}`
  const now = new Date().toISOString()
  const deficit: WarehouseDeficit = {
    id,
    productId: data.productId,
    productName: { ru: '', en: '', lt: '' },
    currentStock: 0,
    minRequired: data.minRequired,
    deficitAmount: data.minRequired,
    unit: 'pcs',
    priority: data.priority,
    status: 'open',
    suggestedOrderQty: null,
    purchaseOrderId: null,
    notes: data.notes ?? null,
    createdAt: now,
    updatedAt: now,
    auditLog: [],
  }
  deficitStore.push(deficit)
  return deficit
}

export async function mockPatchDeficitItem(id: string, delta: DeficitPatchPayload): Promise<WarehouseDeficit> {
  const deficit = deficitStore.find((d) => d.id === id)
  if (!deficit) throw new Error('DEFICIT_NOT_FOUND')
  Object.assign(deficit, delta, { updatedAt: new Date().toISOString() })
  return { ...deficit }
}

export async function mockDeleteDeficitItem(id: string): Promise<void> {}

// ─── Export ─────────────────────────────────────────────────────────────────

export async function mockExportWarehouseCsv(tab: string): Promise<string> {
  return 'mock-csv-data'
}

// ─── Audit endpoints ────────────────────────────────────────────────────────

export async function mockGetStockAudit(productId: string): Promise<StockAuditEntry[]> {
  return []
}

export async function mockDeleteStockAuditEntry(productId: string, entryIndex: number): Promise<void> {}

export async function mockGetBatchAudit(batchId: string): Promise<StockAuditEntry[]> {
  return []
}

export async function mockDeleteBatchAuditEntry(batchId: string, entryIndex: number): Promise<void> {}

export async function mockGetOffcutAudit(offcutId: string): Promise<StockAuditEntry[]> {
  return []
}

export async function mockDeleteOffcutAuditEntry(offcutId: string, entryIndex: number): Promise<void> {}

export async function mockGetMovementAudit(movementId: string): Promise<StockAuditEntry[]> {
  return getOrCreateMovementAudit(movementId)
}

export async function mockDeleteMovementAuditEntry(movementId: string, entryIndex: number): Promise<void> {
  const audit = getOrCreateMovementAudit(movementId)
  if (entryIndex >= 0 && entryIndex < audit.length) audit.splice(entryIndex, 1)
}

export async function mockGetDeficitAudit(deficitId: string): Promise<StockAuditEntry[]> {
  return []
}

export async function mockDeleteDeficitAuditEntry(deficitId: string, entryIndex: number): Promise<void> {}
