import { STORE as PRODUCTS_STORE } from './products'
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
  StockAuditEntry,
  StockUnit,
  CuttingOperation,
} from '@/types/warehouse'
import type { TranslatedString } from '@/types/i18n'
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

export async function mockGetStockItem(productId: string): Promise<StockOverviewItem> {
  const item = stockStore.find((s) => s.productId === productId)
  if (!item) throw new Error('STOCK_ITEM_NOT_FOUND')
  return {
    ...item,
    auditLog: getOrCreateStockAudit(productId),
  }
}

export async function mockPatchStockItem(
  productId: string,
  delta: {
    productName?: TranslatedString
    unit?: StockUnit
    avgUnitPrice?: number
    minStock?: number | null
    categoryName?: TranslatedString | null
  },
): Promise<StockOverviewItem> {
  const item = stockStore.find((s) => s.productId === productId)
  if (!item) throw new Error('STOCK_ITEM_NOT_FOUND')
  if (delta.productName !== undefined) item.productName = delta.productName
  if (delta.unit !== undefined) item.unit = delta.unit
  if (delta.avgUnitPrice !== undefined) item.avgUnitPrice = delta.avgUnitPrice
  if (delta.minStock !== undefined) item.minStock = delta.minStock
  if (delta.categoryName !== undefined) item.categoryName = delta.categoryName
  return { ...item }
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
  filters: { search: string; productId?: string; supplierId?: string; status?: string; unit?: string; dateFrom?: string; dateTo?: string; sortBy?: string; sortDir?: string },
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
  if (filters.unit) filtered = filtered.filter((b) => b.unit === filters.unit)
  if (filters.dateFrom) filtered = filtered.filter((b) => b.receivedAt >= filters.dateFrom!)
  if (filters.dateTo) filtered = filtered.filter((b) => b.receivedAt <= filters.dateTo!)

  if (filters.sortBy) {
    filtered.sort((a, b) => {
      let cmp = 0
      if (filters.sortBy === 'productName') cmp = a.productName.en.localeCompare(b.productName.en)
      else if (filters.sortBy === 'batchNumber') cmp = a.batchNumber.localeCompare(b.batchNumber)
      else if (filters.sortBy === 'lotCode') cmp = a.lotCode.localeCompare(b.lotCode)
      else if (filters.sortBy === 'quantity') cmp = a.quantity - b.quantity
      else if (filters.sortBy === 'quantityRemaining') cmp = a.quantityRemaining - b.quantityRemaining
      else if (filters.sortBy === 'unit') cmp = a.unit.localeCompare(b.unit)
      else if (filters.sortBy === 'unitPrice') cmp = a.unitPrice - b.unitPrice
      else if (filters.sortBy === 'receivedAt') cmp = a.receivedAt.localeCompare(b.receivedAt)
      else if (filters.sortBy === 'status') cmp = a.status.localeCompare(b.status)
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
    categoryId: o.categoryId,
    offcutType: o.offcutType,
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
  filters: { search: string; productId?: string; status?: string; unit?: string; offcutType?: string; categoryIds?: string; batchNumber?: string; sortBy?: string; sortDir?: string },
  pagination: { page: number; pageSize: number },
): Promise<PaginatedResponse<OffcutListItem>> {
  let filtered = [...offcutStore]

  if (filters.search) {
    const q = filters.search.toLowerCase()
    filtered = filtered.filter((o) => matchSearch(o, q))
  }
  if (filters.productId) filtered = filtered.filter((o) => o.productId === filters.productId)
  if (filters.status) filtered = filtered.filter((o) => o.status === filters.status)
  if (filters.unit) filtered = filtered.filter((o) => o.unit === filters.unit)
  if (filters.offcutType) filtered = filtered.filter((o) => o.offcutType === filters.offcutType)
  if (filters.categoryIds) {
    const ids = filters.categoryIds.split(',')
    filtered = filtered.filter((o) => o.categoryId !== null && ids.includes(o.categoryId))
  }
  if (filters.batchNumber) filtered = filtered.filter((o) => o.batchNumber.toLowerCase().includes(filters.batchNumber!.toLowerCase()))

  // Sort
  if (filters.sortBy) {
    filtered.sort((a, b) => {
      let cmp = 0
      if (filters.sortBy === 'productName') cmp = a.productName.en.localeCompare(b.productName.en)
      else if (filters.sortBy === 'batchNumber') cmp = a.batchNumber.localeCompare(b.batchNumber)
      else if (filters.sortBy === 'lengthMm') cmp = (a.lengthMm ?? 0) - (b.lengthMm ?? 0)
      else if (filters.sortBy === 'weightKg') cmp = (a.weightKg ?? 0) - (b.weightKg ?? 0)
      else if (filters.sortBy === 'quantity') cmp = a.quantity - b.quantity
      else if (filters.sortBy === 'unit') cmp = a.unit.localeCompare(b.unit)
      else if (filters.sortBy === 'location') cmp = (a.location ?? '').localeCompare(b.location ?? '')
      else if (filters.sortBy === 'status') cmp = a.status.localeCompare(b.status)
      return filters.sortDir === 'desc' ? -cmp : cmp
    })
  }

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
  categoryId?: string | null
  offcutType?: 'sheet' | 'linear'
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
    categoryId: data.categoryId ?? null,
    offcutType: data.offcutType ?? 'sheet',
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
  filters: { search: string; type?: string; productId?: string; unit?: string; categoryIds?: string; batchNumber?: string; dateFrom?: string; dateTo?: string; sortBy?: string; sortDir?: string },
  pagination: { page: number; pageSize: number },
): Promise<PaginatedResponse<MovementListItem>> {
  let filtered = [...movementStore]

  if (filters.search) {
    const q = filters.search.toLowerCase()
    filtered = filtered.filter((m) => matchSearch(m, q))
  }
  if (filters.type) filtered = filtered.filter((m) => m.type === filters.type)
  if (filters.productId) filtered = filtered.filter((m) => m.productId === filters.productId)
  if (filters.unit) filtered = filtered.filter((m) => m.unit === filters.unit)
  if (filters.categoryIds) {
    const ids = filters.categoryIds.split(',')
    const productIdsInCategories = PRODUCTS_STORE
      .filter((p) => p.categoryId !== null && ids.includes(p.categoryId))
      .map((p) => p.id)
    filtered = filtered.filter((m) => productIdsInCategories.includes(m.productId))
  }
  if (filters.batchNumber) filtered = filtered.filter((m) => m.batchNumber.toLowerCase().includes(filters.batchNumber!.toLowerCase()))
  if (filters.dateFrom) filtered = filtered.filter((m) => m.movedAt >= filters.dateFrom!)
  if (filters.dateTo) filtered = filtered.filter((m) => m.movedAt <= filters.dateTo!)

  if (filters.sortBy) {
    filtered.sort((a, b) => {
      let cmp = 0
      if (filters.sortBy === 'movedAt') cmp = a.movedAt.localeCompare(b.movedAt)
      else if (filters.sortBy === 'type') cmp = a.type.localeCompare(b.type)
      else if (filters.sortBy === 'productName') cmp = a.productName.en.localeCompare(b.productName.en)
      else if (filters.sortBy === 'batchNumber') cmp = a.batchNumber.localeCompare(b.batchNumber)
      else if (filters.sortBy === 'quantity') cmp = a.quantity - b.quantity
      else if (filters.sortBy === 'unit') cmp = a.unit.localeCompare(b.unit)
      else if (filters.sortBy === 'unitPrice') cmp = a.unitPrice - b.unitPrice
      else if (filters.sortBy === 'totalCost') cmp = (a.quantity * a.unitPrice) - (b.quantity * b.unitPrice)
      else if (filters.sortBy === 'referenceId') cmp = (a.referenceId ?? '').localeCompare(b.referenceId ?? '')
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

export async function mockDeleteMovement(id: string): Promise<void> {
  const idx = movementStore.findIndex((m) => m.id === id)
  if (idx === -1) throw new Error('MOVEMENT_NOT_FOUND')
  movementStore.splice(idx, 1)
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
    categoryId: o.categoryId ?? null,
    offcutType: o.offcutType ?? 'sheet',
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
  filters: { search: string; priority?: string; status?: string; unit?: string; categoryIds?: string; sortBy?: string; sortDir?: string },
  pagination: { page: number; pageSize: number },
): Promise<PaginatedResponse<DeficitListItem>> {
  let filtered = [...deficitStore]

  if (filters.search) {
    const q = filters.search.toLowerCase()
    filtered = filtered.filter((d) => matchSearch(d, q))
  }
  if (filters.priority) filtered = filtered.filter((d) => d.priority === filters.priority)
  if (filters.status) filtered = filtered.filter((d) => d.status === filters.status)
  if (filters.unit) filtered = filtered.filter((d) => d.unit === filters.unit)
  if (filters.categoryIds) {
    const ids = filters.categoryIds.split(',')
    const productIdsInCategories = PRODUCTS_STORE
      .filter((p) => p.categoryId !== null && ids.includes(p.categoryId))
      .map((p) => p.id)
    filtered = filtered.filter((d) => productIdsInCategories.includes(d.productId))
  }

  if (filters.sortBy) {
    filtered.sort((a, b) => {
      let cmp = 0
      if (filters.sortBy === 'productName') {
        cmp = (a.productName.en ?? '').localeCompare(b.productName.en ?? '')
      } else if (filters.sortBy === 'currentStock') {
        cmp = a.currentStock - b.currentStock
      } else if (filters.sortBy === 'minRequired') {
        cmp = a.minRequired - b.minRequired
      } else if (filters.sortBy === 'deficitAmount') {
        cmp = a.deficitAmount - b.deficitAmount
      } else if (filters.sortBy === 'unit') {
        cmp = (a.unit ?? '').localeCompare(b.unit ?? '')
      } else if (filters.sortBy === 'priority') {
        cmp = ['critical', 'high', 'medium', 'low'].indexOf(a.priority) - ['critical', 'high', 'medium', 'low'].indexOf(b.priority)
      } else if (filters.sortBy === 'status') {
        cmp = (a.status ?? '').localeCompare(b.status ?? '')
      }
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

// ─── Stock Audit ────────────────────────────────────────────────────────────

const mockStockAuditStore: Map<string, StockAuditEntry[]> = new Map()

/**
 * Generates deterministic pseudo-random numbers based on productId.
 * Ensures each product gets unique but stable audit values.
 */
function auditSeed(productId: string): number {
  let hash = 0
  for (let i = 0; i < productId.length; i++) {
    hash = ((hash << 5) - hash) + productId.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function getOrCreateStockAudit(productId: string): StockAuditEntry[] {
  if (!mockStockAuditStore.has(productId)) {
    const seed = auditSeed(productId)
    const baseQty = 100 + (seed % 200)           // 100–299
    const inc1 = 30 + (seed % 50)                 // 30–79
    const dec1 = 25 + ((seed >> 6) % 45)          // 25–69
    const dec2 = 15 + ((seed >> 8) % 30)          // 15–44
    const reserved = 10 + ((seed >> 2) % 30)      // 10–39
    const price = 20 + (seed % 60)                // 20–79
    const minStock = 10 + ((seed >> 3) % 40)      // 10–49

    mockStockAuditStore.set(productId, [
      // ── Stock movements ──────────────────────────────────────────────
      {
        timestamp: '2026-05-20 09:15:00',
        user: { ru: 'Иван Петров', en: 'Ivan Petrov', lt: 'Ivan Petrov' },
        userInitials: 'ИП',
        property: { ru: 'Остаток', en: 'Stock', lt: 'Likutis' },
        oldValue: String(baseQty),
        newValue: String(baseQty + inc1),
      },
      {
        timestamp: '2026-05-18 14:30:00',
        user: { ru: 'Мария Сидорова', en: 'Maria Sidorova', lt: 'Maria Sidorova' },
        userInitials: 'МС',
        property: { ru: 'Резерв', en: 'Reserved', lt: 'Rezervuota' },
        oldValue: String(reserved - 5),
        newValue: String(reserved),
      },
      {
        timestamp: '2026-05-16 11:00:00',
        user: { ru: 'Алексей Иванов', en: 'Alexey Ivanov', lt: 'Alexey Ivanov' },
        userInitials: 'АИ',
        property: { ru: 'Доступно', en: 'Available', lt: 'Prieinama' },
        oldValue: String(baseQty + inc1 - reserved + 5),
        newValue: String(baseQty + inc1 - reserved),
      },
      {
        timestamp: '2026-05-14 08:45:00',
        user: { ru: 'Ольга Смирнова', en: 'Olga Smirnova', lt: 'Olga Smirnova' },
        userInitials: 'ОС',
        property: { ru: 'Остаток', en: 'Stock', lt: 'Likutis' },
        oldValue: String(baseQty + inc1),
        newValue: String(baseQty + inc1 - dec1),
      },
      {
        timestamp: '2026-05-12 16:20:00',
        user: { ru: 'Дмитрий Козлов', en: 'Dmitry Kozlov', lt: 'Dmitry Kozlov' },
        userInitials: 'ДК',
        property: { ru: 'Доступно', en: 'Available', lt: 'Prieinama' },
        oldValue: String(baseQty + inc1 - reserved - dec1),
        newValue: String(baseQty + inc1 - reserved - dec1 - dec2),
      },
      // ── Warehouse card field changes ─────────────────────────────────
      {
        timestamp: '2026-05-08 10:00:00',
        user: { ru: 'Иван Петров', en: 'Ivan Petrov', lt: 'Ivan Petrov' },
        userInitials: 'ИП',
        property: { ru: 'Мин. запас', en: 'Min. stock', lt: 'Min. atsargos' },
        oldValue: String(minStock),
        newValue: String(minStock + 10),
      },
      {
        timestamp: '2026-05-05 13:30:00',
        user: { ru: 'Мария Сидорова', en: 'Maria Sidorova', lt: 'Maria Sidorova' },
        userInitials: 'МС',
        property: { ru: 'Ср. цена', en: 'Avg. price', lt: 'Vid. kaina' },
        oldValue: String(price),
        newValue: String(price + 5),
      },
    ])
  }
  return mockStockAuditStore.get(productId)!
}

export async function mockGetStockAudit(productId: string): Promise<StockAuditEntry[]> {
  return [...getOrCreateStockAudit(productId)]
}

export async function mockDeleteStockAuditEntry(productId: string, entryIndex: number): Promise<void> {
  const entries = getOrCreateStockAudit(productId)
  if (entryIndex < 0 || entryIndex >= entries.length) throw new Error('AUDIT_ENTRY_NOT_FOUND')
  entries.splice(entryIndex, 1)
}
