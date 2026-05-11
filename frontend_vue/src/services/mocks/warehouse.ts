import type {
  WarehouseBatch,
  BatchListItem,
  WarehouseOffcut,
  OffcutListItem,
  WarehouseMovement,
  MovementListItem,
  WarehouseDeficit,
  DeficitListItem,
  StockOverviewItem,
  CuttingOperation,
} from '@/types/warehouse'
import type { PaginatedResponse } from '@/types/api'
import {
  mockBatches as mockBatchesData,
  mockOffcuts as mockOffcutsData,
  mockMovements as mockMovementsData,
  mockDeficit as mockDeficitData,
  mockStockOverview as mockStockOverviewData,
} from '@/mocks/warehouse'

// ─── In-memory stores ───────────────────────────────────────────────────────

const batchStore: WarehouseBatch[] = [...mockBatchesData]
const offcutStore: WarehouseOffcut[] = [...mockOffcutsData]
const movementStore: WarehouseMovement[] = [...mockMovementsData]
const deficitStore: WarehouseDeficit[] = [...mockDeficitData]
const stockStore: StockOverviewItem[] = [...mockStockOverviewData]

let batchSeq = batchStore.length + 1
let offcutSeq = offcutStore.length + 1
let movementSeq = movementStore.length + 1
let deficitSeq = deficitStore.length + 1

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
): Promise<PaginatedResponse<StockOverviewItem>> {
  let filtered = [...stockStore]

  if (filters.search) {
    const q = filters.search.toLowerCase()
    filtered = filtered.filter((item) => matchSearch(item, q))
  }
  if (filters.categoryIds) {
    const ids = filters.categoryIds.split(',')
    filtered = filtered.filter((item) => item.categoryId && ids.includes(item.categoryId))
  }
  if (filters.unit) {
    filtered = filtered.filter((item) => item.unit === filters.unit)
  }
  if (filters.showDeficitOnly === 'true') {
    filtered = filtered.filter((item) => item.isDeficit)
  }
  if (filters.showInStockOnly === 'true') {
    filtered = filtered.filter((item) => item.availableQuantity > 0)
  }

  // sort
  if (filters.sortBy) {
    const dir = filters.sortDir === 'desc' ? -1 : 1
    filtered.sort((a, b) => {
      let cmp = 0
      switch (filters.sortBy) {
        case 'name':
          cmp = a.productName.en.localeCompare(b.productName.en)
          break
        case 'totalQuantity':
          cmp = a.totalQuantity - b.totalQuantity
          break
        case 'availableQuantity':
          cmp = a.availableQuantity - b.availableQuantity
          break
        case 'unit':
          cmp = a.unit.localeCompare(b.unit)
          break
        case 'avgUnitPrice':
          cmp = a.avgUnitPrice - b.avgUnitPrice
          break
        case 'totalValue':
          cmp = a.totalValue - b.totalValue
          break
        case 'minStock':
          cmp = (a.minStock ?? 0) - (b.minStock ?? 0)
          break
      }
      return cmp * dir
    })
  }

  return paginate(filtered, pagination.page, pagination.pageSize)
}

// ─── Batches ────────────────────────────────────────────────────────────────

function toBatchListItem(b: WarehouseBatch): BatchListItem {
  return {
    id: b.id,
    productId: b.productId,
    productName: b.productName,
    batchNumber: b.batchNumber,
    lotCode: b.lotCode,
    quantity: b.quantity,
    quantityRemaining: b.quantityRemaining,
    unit: b.unit,
    unitPrice: b.unitPrice,
    receivedAt: b.receivedAt,
    status: b.status,
  }
}

export async function mockGetBatches(
  filters: { search: string; productId?: string; supplierId?: string; status?: string; dateFrom?: string; dateTo?: string; sortBy?: string; sortDir?: string },
  pagination: { page: number; pageSize: number },
): Promise<PaginatedResponse<BatchListItem>> {
  let filtered = [...batchStore]

  if (filters.search) {
    const q = filters.search.toLowerCase()
    filtered = filtered.filter(
      (b) =>
        matchSearch(b, q) ||
        b.batchNumber.toLowerCase().includes(q) ||
        b.lotCode.toLowerCase().includes(q),
    )
  }
  if (filters.productId) filtered = filtered.filter((b) => b.productId === filters.productId)
  if (filters.supplierId) filtered = filtered.filter((b) => b.supplierId === filters.supplierId)
  if (filters.status) filtered = filtered.filter((b) => b.status === filters.status)
  if (filters.dateFrom) filtered = filtered.filter((b) => b.receivedAt >= filters.dateFrom!)
  if (filters.dateTo) filtered = filtered.filter((b) => b.receivedAt <= filters.dateTo!)

  if (filters.sortBy) {
    filtered.sort((a, b) => {
      let cmp = 0
      if (filters.sortBy === 'receivedAt') cmp = a.receivedAt.localeCompare(b.receivedAt)
      else if (filters.sortBy === 'quantity') cmp = a.quantity - b.quantity
      else if (filters.sortBy === 'quantityRemaining') cmp = a.quantityRemaining - b.quantityRemaining
      else if (filters.sortBy === 'unitPrice') cmp = a.unitPrice - b.unitPrice
      return filters.sortDir === 'desc' ? -cmp : cmp
    })
  }

  return paginate(filtered.map(toBatchListItem), pagination.page, pagination.pageSize)
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
  receivedAt: string
  expiresAt?: string | null
  location?: string | null
  certificateRef?: string | null
  notes?: string | null
}): Promise<WarehouseBatch> {
  const id = `whb-${String(batchSeq++).padStart(3, '0')}`
  const now = new Date().toISOString()
  const batch: WarehouseBatch = {
    id,
    productId: data.productId,
    productName: { ru: '', en: '', lt: '' }, // will be resolved from product catalog
    supplierId: data.supplierId ?? null,
    supplierName: null,
    batchNumber: data.batchNumber,
    lotCode: data.lotCode,
    quantity: data.quantity,
    quantityRemaining: data.quantity,
    unit: data.unit as WarehouseBatch['unit'],
    unitPrice: data.unitPrice,
    totalCost: data.quantity * data.unitPrice,
    receivedAt: data.receivedAt,
    expiresAt: data.expiresAt ?? null,
    location: data.location ?? null,
    certificateRef: data.certificateRef ?? null,
    status: 'available',
    notes: data.notes ?? null,
    createdAt: now,
    updatedAt: now,
  }
  batchStore.push(batch)

  // Also create a receipt movement
  const movId = `whm-${String(movementSeq++).padStart(3, '0')}`
  movementStore.push({
    id: movId,
    type: 'receipt',
    batchId: id,
    batchNumber: data.batchNumber,
    productId: data.productId,
    productName: batch.productName,
    quantity: data.quantity,
    unit: batch.unit,
    unitPrice: data.unitPrice,
    totalCost: data.quantity * data.unitPrice,
    referenceId: null,
    referenceType: null,
    fromLocation: null,
    toLocation: data.location ?? null,
    performedBy: null,
    notes: 'Batch created',
    movedAt: now,
    createdAt: now,
  })

  return batch
}

export async function mockPatchBatch(
  id: string,
  data: {
    batchNumber?: string
    lotCode?: string
    quantity?: number
    unitPrice?: number
    location?: string | null
    certificateRef?: string | null
    status?: string
    notes?: string | null
  },
): Promise<WarehouseBatch> {
  const batch = batchStore.find((b) => b.id === id)
  if (!batch) throw new Error('BATCH_NOT_FOUND')
  if (data.batchNumber !== undefined) batch.batchNumber = data.batchNumber
  if (data.lotCode !== undefined) batch.lotCode = data.lotCode
  if (data.quantity !== undefined) {
    const diff = data.quantity - batch.quantity
    batch.quantity = data.quantity
    batch.quantityRemaining += diff
  }
  if (data.unitPrice !== undefined) {
    batch.unitPrice = data.unitPrice
    batch.totalCost = batch.quantity * data.unitPrice
  }
  if (data.location !== undefined) batch.location = data.location
  if (data.certificateRef !== undefined) batch.certificateRef = data.certificateRef
  if (data.status !== undefined) batch.status = data.status as WarehouseBatch['status']
  if (data.notes !== undefined) batch.notes = data.notes
  batch.updatedAt = new Date().toISOString()
  return { ...batch }
}

export async function mockDeleteBatch(id: string): Promise<void> {
  const idx = batchStore.findIndex((b) => b.id === id)
  if (idx === -1) throw new Error('BATCH_NOT_FOUND')
  batchStore.splice(idx, 1)
}

// ─── Offcuts ────────────────────────────────────────────────────────────────

function toOffcutListItem(o: WarehouseOffcut): OffcutListItem {
  return {
    id: o.id,
    batchId: o.batchId,
    batchNumber: o.batchNumber,
    productId: o.productId,
    productName: o.productName,
    lengthMm: o.lengthMm,
    widthMm: o.widthMm,
    weightKg: o.weightKg,
    quantity: o.quantity,
    unit: o.unit,
    location: o.location,
    status: o.status,
  }
}

export async function mockGetOffcuts(
  filters: { search: string; productId?: string; status?: string; sortBy?: string; sortDir?: string },
  pagination: { page: number; pageSize: number },
): Promise<PaginatedResponse<OffcutListItem>> {
  let filtered = [...offcutStore]

  if (filters.search) {
    const q = filters.search.toLowerCase()
    filtered = filtered.filter((o) => matchSearch(o, q))
  }
  if (filters.productId) filtered = filtered.filter((o) => o.productId === filters.productId)
  if (filters.status) filtered = filtered.filter((o) => o.status === filters.status)

  return paginate(filtered.map(toOffcutListItem), pagination.page, pagination.pageSize)
}

export async function mockGetOffcut(id: string): Promise<WarehouseOffcut> {
  const offcut = offcutStore.find((o) => o.id === id)
  if (!offcut) throw new Error('OFFCUT_NOT_FOUND')
  return { ...offcut }
}

export async function mockCreateOffcut(data: {
  batchId: string
  productId: string
  lengthMm?: number | null
  widthMm?: number | null
  thicknessMm?: number | null
  weightKg?: number | null
  quantity: number
  unit: string
  location?: string | null
  notes?: string | null
}): Promise<WarehouseOffcut> {
  const id = `who-${String(offcutSeq++).padStart(3, '0')}`
  const now = new Date().toISOString()
  const batch = batchStore.find((b) => b.id === data.batchId)
  const offcut: WarehouseOffcut = {
    id,
    batchId: data.batchId,
    batchNumber: batch?.batchNumber ?? '',
    productId: data.productId,
    productName: batch?.productName ?? { ru: '', en: '', lt: '' },
    lengthMm: data.lengthMm ?? null,
    widthMm: data.widthMm ?? null,
    thicknessMm: data.thicknessMm ?? null,
    weightKg: data.weightKg ?? null,
    quantity: data.quantity,
    unit: data.unit as WarehouseOffcut['unit'],
    location: data.location ?? null,
    status: 'available',
    notes: data.notes ?? null,
    qrData: `${id}-qr`,
    createdAt: now,
    updatedAt: now,
  }
  offcutStore.push(offcut)
  return offcut
}

export async function mockDeleteOffcut(id: string): Promise<void> {
  const idx = offcutStore.findIndex((o) => o.id === id)
  if (idx === -1) throw new Error('OFFCUT_NOT_FOUND')
  offcutStore.splice(idx, 1)
}

// ─── Movements ──────────────────────────────────────────────────────────────

function toMovementListItem(m: WarehouseMovement): MovementListItem {
  return {
    id: m.id,
    type: m.type,
    batchId: m.batchId,
    batchNumber: m.batchNumber,
    productName: m.productName,
    quantity: m.quantity,
    unit: m.unit,
    unitPrice: m.unitPrice,
    referenceId: m.referenceId,
    movedAt: m.movedAt,
  }
}

export async function mockGetMovements(
  filters: { search: string; type?: string; productId?: string; dateFrom?: string; dateTo?: string; sortBy?: string; sortDir?: string },
  pagination: { page: number; pageSize: number },
): Promise<PaginatedResponse<MovementListItem>> {
  let filtered = [...movementStore]

  if (filters.search) {
    const q = filters.search.toLowerCase()
    filtered = filtered.filter((m) => matchSearch(m, q))
  }
  if (filters.type) filtered = filtered.filter((m) => m.type === filters.type)
  if (filters.productId) filtered = filtered.filter((m) => m.productId === filters.productId)
  if (filters.dateFrom) filtered = filtered.filter((m) => m.movedAt >= filters.dateFrom!)
  if (filters.dateTo) filtered = filtered.filter((m) => m.movedAt <= filters.dateTo!)

  if (filters.sortBy) {
    filtered.sort((a, b) => {
      let cmp = 0
      if (filters.sortBy === 'movedAt') cmp = a.movedAt.localeCompare(b.movedAt)
      else if (filters.sortBy === 'quantity') cmp = a.quantity - b.quantity
      return filters.sortDir === 'desc' ? -cmp : cmp
    })
  }

  return paginate(filtered.map(toMovementListItem), pagination.page, pagination.pageSize)
}

export async function mockCreateMovement(data: {
  type: string
  batchId: string
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
  }
  movementStore.push(movement)

  // Update batch quantity remaining for expense/write-off
  if (data.type === 'expense' || data.type === 'write-off') {
    batch.quantityRemaining = Math.max(0, batch.quantityRemaining - data.quantity)
    if (batch.quantityRemaining === 0) batch.status = 'depleted'
    else if (batch.quantityRemaining < batch.quantity) batch.status = 'partial'
    batch.updatedAt = now
  }

  return movement
}

// ─── Cutting Operation ──────────────────────────────────────────────────────

export async function mockExecuteCutting(
  data: CuttingOperation,
): Promise<{ offcuts: WarehouseOffcut[]; wasteQuantity: number }> {
  const batch = batchStore.find((b) => b.id === data.sourceBatchId)
  if (!batch) throw new Error('BATCH_NOT_FOUND')

  // Reduce source batch quantity
  batch.quantityRemaining = Math.max(0, batch.quantityRemaining - data.sourceQuantity)
  if (batch.quantityRemaining === 0) batch.status = 'depleted'
  else if (batch.quantityRemaining < batch.quantity) batch.status = 'partial'
  batch.updatedAt = new Date().toISOString()

  // Create offcuts
  const offcuts: WarehouseOffcut[] = data.offcuts.map((o) => ({
    id: `who-${String(offcutSeq++).padStart(3, '0')}`,
    batchId: data.sourceBatchId,
    batchNumber: batch.batchNumber,
    productId: batch.productId,
    productName: batch.productName,
    lengthMm: o.lengthMm ?? null,
    widthMm: o.widthMm ?? null,
    thicknessMm: o.thicknessMm ?? null,
    weightKg: o.weightKg ?? null,
    quantity: o.quantity,
    unit: o.unit as WarehouseOffcut['unit'],
    location: o.location ?? null,
    status: 'available',
    notes: o.notes ?? null,
    qrData: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))

  offcutStore.push(...offcuts)

  // Create expense movement for source material
  const movId = `whm-${String(movementSeq++).padStart(3, '0')}`
  movementStore.push({
    id: movId,
    type: 'expense',
    batchId: data.sourceBatchId,
    batchNumber: batch.batchNumber,
    productId: batch.productId,
    productName: batch.productName,
    quantity: data.sourceQuantity,
    unit: batch.unit,
    unitPrice: batch.unitPrice,
    totalCost: data.sourceQuantity * batch.unitPrice,
    referenceId: null,
    referenceType: 'cutting',
    fromLocation: batch.location,
    toLocation: null,
    performedBy: null,
    notes: data.notes ?? 'Cutting operation',
    movedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  })

  return { offcuts, wasteQuantity: data.wasteQuantity }
}

// ─── Deficit ────────────────────────────────────────────────────────────────

function toDeficitListItem(d: WarehouseDeficit): DeficitListItem {
  return {
    id: d.id,
    productId: d.productId,
    productName: d.productName,
    currentStock: d.currentStock,
    minRequired: d.minRequired,
    deficitAmount: d.deficitAmount,
    unit: d.unit,
    priority: d.priority,
    status: d.status,
  }
}

export async function mockGetDeficitList(
  filters: { search: string; priority?: string; status?: string; sortBy?: string; sortDir?: string },
  pagination: { page: number; pageSize: number },
): Promise<PaginatedResponse<DeficitListItem>> {
  let filtered = [...deficitStore]

  if (filters.search) {
    const q = filters.search.toLowerCase()
    filtered = filtered.filter((d) => matchSearch(d, q))
  }
  if (filters.priority) filtered = filtered.filter((d) => d.priority === filters.priority)
  if (filters.status) filtered = filtered.filter((d) => d.status === filters.status)

  if (filters.sortBy) {
    filtered.sort((a, b) => {
      let cmp = 0
      if (filters.sortBy === 'deficitAmount') cmp = a.deficitAmount - b.deficitAmount
      else if (filters.sortBy === 'priority') cmp = ['critical', 'high', 'medium', 'low'].indexOf(a.priority) - ['critical', 'high', 'medium', 'low'].indexOf(b.priority)
      return filters.sortDir === 'desc' ? -cmp : cmp
    })
  }

  return paginate(filtered.map(toDeficitListItem), pagination.page, pagination.pageSize)
}

export async function mockGetDeficitItem(id: string): Promise<WarehouseDeficit> {
  const item = deficitStore.find((d) => d.id === id)
  if (!item) throw new Error('DEFICIT_NOT_FOUND')
  return { ...item }
}

export async function mockCreateDeficitItem(data: {
  productId: string
  minRequired: number
  priority: string
  notes?: string | null
}): Promise<WarehouseDeficit> {
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
    priority: data.priority as WarehouseDeficit['priority'],
    status: 'open',
    suggestedOrderQty: null,
    purchaseOrderId: null,
    notes: data.notes ?? null,
    createdAt: now,
    updatedAt: now,
  }
  deficitStore.push(deficit)
  return deficit
}

export async function mockPatchDeficitItem(
  id: string,
  data: {
    minRequired?: number
    priority?: string
    status?: string
    suggestedOrderQty?: number | null
    purchaseOrderId?: string | null
    notes?: string | null
  },
): Promise<WarehouseDeficit> {
  const item = deficitStore.find((d) => d.id === id)
  if (!item) throw new Error('DEFICIT_NOT_FOUND')
  if (data.minRequired !== undefined) {
    item.minRequired = data.minRequired
    item.deficitAmount = Math.max(0, item.minRequired - item.currentStock)
  }
  if (data.priority !== undefined) item.priority = data.priority as WarehouseDeficit['priority']
  if (data.status !== undefined) item.status = data.status as WarehouseDeficit['status']
  if (data.suggestedOrderQty !== undefined) item.suggestedOrderQty = data.suggestedOrderQty
  if (data.purchaseOrderId !== undefined) item.purchaseOrderId = data.purchaseOrderId
  if (data.notes !== undefined) item.notes = data.notes
  item.updatedAt = new Date().toISOString()
  return { ...item }
}

export async function mockDeleteDeficitItem(id: string): Promise<void> {
  const idx = deficitStore.findIndex((d) => d.id === id)
  if (idx === -1) throw new Error('DEFICIT_NOT_FOUND')
  deficitStore.splice(idx, 1)
}
