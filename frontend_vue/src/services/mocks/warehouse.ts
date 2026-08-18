import type {
  WarehouseBatch,
  WarehouseOffcut,
  WarehouseMovement,
  MovementListItem,
  MovementType,
  WarehouseDeficit,
  DeficitListResponse,
  StockOverviewItem,
  StockAuditEntry,
  StockUnit,
  CuttingOperation,
  BatchStatusAggregate,
  BatchActiveSale,
  StockOverviewResponse,
  StockPatchPayload,
  BatchListResponse,
  BatchListItem,
  BatchCreatePayload,
  BatchPatchPayload,
  OffcutListResponse,
  OffcutCreatePayload,
  OffcutPatchPayload,
  MovementListResponse,
  DeficitCreatePayload,
  DeficitPatchPayload,
} from '@/types/warehouse'
import type { PaginatedResponse } from '@/types/api'
import type { TranslatedString } from '@/types/i18n'
import type { Uom, Currency } from '@/types/settings'
import { STORE as PRODUCTS_STORE, registerProductBatchLookup } from './products'
import { MOCK_SETTINGS } from './settings'
import {
  mockBatches as mockBatchesData,
  mockOffcuts as mockOffcutsData,
  mockMovements as mockMovementsData,
  mockDeficit as mockDeficitData,
  mockStockOverview as mockStockOverviewData,
} from '@/mocks/warehouse'
import {
  allocateFifo,
  computeAvailable,
  round2,
  type FifoBatch,
  type FifoResult,
} from '@/domain/orderPricing'
import { reservedOn } from './reservations'
import { compareDocumentNumbers } from '@/services/documentNumbers'
import { sealAuditIds, type AuditSeeded } from '@/mocks/auditIds'

/**
 * The one currency the warehouse layer speaks (contract §7.1).
 *
 * Currencies coexist in this system and nothing converts between them — there is
 * no rate anywhere, and that is a decision, not a gap. So the border is drawn at
 * the warehouse: a batch is priced in the base currency or it is not priced at
 * all. A purchase in another currency stays on the purchase trail, where it is a
 * record of what was paid, and never becomes the price of goods on the shelf.
 */
const BASE_CURRENCY: string =
  (MOCK_SETTINGS.currencies as Currency[]).find((c) => c.isDefault)?.code ??
  MOCK_SETTINGS.constants.defaultCurrency

// ─── Helpers to resolve code strings to UUIDs from settings ──────────────
function _resolveUomId(code: string): string {
  const uom = (MOCK_SETTINGS.uoms as Uom[]).find(
    (u) => u.code.en === code || u.code.ru === code || u.code.lt === code,
  )
  return uom?.id ?? code
}
function _resolveCurrencyId(code: string): string {
  const cur = (MOCK_SETTINGS.currencies as Currency[]).find((c) => c.code === code)
  return cur?.id ?? code
}

// ─── In-memory stores ───────────────────────────────────────────────────────

/** Normalize static mock batch data: convert code strings like 'pcs'/'EUR'
 *  in receivedUnitId/receivedCurrencyId to proper UUIDs from settings,
 *  and set default marginPercent if missing. */
function _normalizeBatchAudit(b: WarehouseBatch): WarehouseBatch {
  if (
    b.receivedUnitId &&
    !b.receivedUnitId.startsWith('uom-') &&
    !b.receivedUnitId.startsWith('cur-')
  ) {
    b.receivedUnitId = _resolveUomId(b.receivedUnitId)
  }
  if (
    b.receivedCurrencyId &&
    !b.receivedCurrencyId.startsWith('cur-') &&
    !b.receivedCurrencyId.startsWith('uom-')
  ) {
    b.receivedCurrencyId = _resolveCurrencyId(b.receivedCurrencyId)
  }
  // Default marginPercent from settings if not set
  if (b.marginPercent == null) {
    b.marginPercent = MOCK_SETTINGS.constants.defaultMargin
  }
  return b
}

/**
 * A batch does not own the product's name — the catalogue does.
 *
 * Each seeded batch carried its own, and they had drifted: prod-001 was "Steel
 * Sheet 3mm" in the catalogue, "Лист стальной 2мм" on the batch and "Stainless
 * steel sheet 2mm" on the stock row. The warehouse journal then signed a steel
 * sheet write-off as "Oxygen gas". Resolved once, here, so every screen that shows
 * a batch shows the same name as the product page.
 */
function _resolveProductName(entity: { productId: string; productName: TranslatedString }): void {
  const product = PRODUCTS_STORE.find((p) => p.id === entity.productId)
  if (product?.name) entity.productName = product.name
}

/** Stable 0…1 from a string — so the same batch always costs the same. */
function _seedFrom(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 10000) / 10000
}

/**
 * A batch is bought to be sold, and the two numbers have to live in one world.
 *
 * The seeded batches were priced with no reference to the catalogue, so the
 * warehouse held a pipe at 1 000,00 that the catalogue sells at 45,00, and a coil
 * at 9,50 against a price of 185 000,00. Every order line drawing on them showed a
 * margin of −91% or +2 106%, and one demo line in six was sold below cost. The
 * arithmetic was right every time; the data it ran on was nonsense, in the one
 * place the demo exists to explain.
 *
 * Reconciled here for the same reason the drifted product names are, a few lines
 * up: one catalogue, one truth, settled at load. The spread between batches is
 * kept — that is what makes FIFO worth showing — and a product the catalogue does
 * not price keeps whatever it was seeded with, because there is nothing to anchor
 * it to.
 */
function _resolveBatchCost(batch: WarehouseBatch): void {
  const price = PRODUCTS_STORE.find((p) => p.id === batch.productId)?.price
  if (price == null || price <= 0) return
  // 58–84% of the selling price: a trade that pays for itself, with room for the
  // odd bad buy the deficit and margin reports exist to show.
  const unitPrice = round2(price * (0.58 + _seedFrom(batch.id) * 0.26))
  if (unitPrice <= 0) return
  // The purchase trail is a record of the same money in the supplier's currency
  // and unit, so it moves by the same factor rather than being invented afresh.
  const factor = batch.unitPrice != null && batch.unitPrice > 0 ? unitPrice / batch.unitPrice : 1
  if (batch.receivedUnitPrice != null) {
    batch.receivedUnitPrice = round2(batch.receivedUnitPrice * factor)
  }
  batch.unitPrice = unitPrice
  batch.totalCost = round2(batch.quantity * unitPrice)
}

// The batch seeds carry no ids either — they are sealed here rather than in the
// seed file only because that file has never been annotated with its own type.
const rawBatches = sealAuditIds(mockBatchesData as unknown as AuditSeeded<WarehouseBatch>[], 'bch')
for (const b of rawBatches) {
  _normalizeBatchAudit(b)
  _resolveProductName(b)
  _resolveBatchCost(b)
}
const batchStore: WarehouseBatch[] = rawBatches
const offcutStore: WarehouseOffcut[] = [...mockOffcutsData]
const movementStore: WarehouseMovement[] = [...mockMovementsData]
for (const m of movementStore) {
  _resolveProductName(m)
  // A movement is the batch changing hands, so it is priced at what the batch
  // costs. Left alone, the journal would go on quoting the figure the batch no
  // longer carries, and the two screens showing it would disagree.
  const batch = batchStore.find((b) => b.id === m.batchId)
  if (batch && batch.unitPrice != null) {
    m.unitPrice = batch.unitPrice
    m.totalCost = round2(m.quantity * batch.unitPrice)
  }
}
const deficitStore: WarehouseDeficit[] = [...mockDeficitData]
const stockStore: StockOverviewItem[] = [...mockStockOverviewData]

// Track IDs of pre-existing mock entities so we can distinguish them
// from dynamically created ones (e.g. to avoid generating fake audit data for new entities)
const preExistingMovementIds = new Set(mockMovementsData.map((m) => m.id))

let batchSeq = batchStore.length + 1
let offcutSeq = offcutStore.length + 1
let movementSeq = movementStore.length + 1
let deficitSeq = deficitStore.length + 1

// ─── Helper: get current value of a specific aggregate from movements ─────
function getAggregateQty(batchId: string, targetType: string): number {
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
  const outgoingTypes = new Set([
    'sale',
    'expense',
    'write-off',
    'production',
    'return-to-supplier',
    'storage',
    'offcut',
  ])
  const byType: Record<string, number> = {}

  for (const m of movements) {
    if (m.type === 'receipt' || m.type === 'transfer') continue
    if (m.type === 'correction') continue
    if (m.type === 'return') {
      const reduceType = m.referenceType || ''
      if (reduceType && outgoingTypes.has(reduceType))
        byType[reduceType] = (byType[reduceType] || 0) - m.quantity
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
  const outgoingTypes: ReadonlySet<string> = new Set([
    'sale',
    'expense',
    'write-off',
    'production',
    'return-to-supplier',
    'storage',
    'offcut',
  ])
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

// ─── Stock Overview ─────────────────────────────────────────────────────────

/**
 * A stock row is a PROJECTION of the batches behind it, not a record of its own.
 *
 * Everything a batch can answer is read off the batches: how much is there, in how
 * many of them, at what average price, worth what, in which unit. The seeded row
 * had its own numbers, and they had drifted into fiction — prod-001 claimed 150
 * pieces at 45 EUR where the batches hold 2 608 kg at 1,20. It had its own product
 * name too, a third one, different from both the catalogue and the batch.
 *
 * What stays on the row is what no batch knows: the minimum threshold, the
 * category and its own audit trail.
 */
function projectStockRow(row: StockOverviewItem): StockOverviewItem {
  const batches = batchesForProduct(row.productId)
  const product = PRODUCTS_STORE.find((p) => p.id === row.productId)
  const totalQuantity = round2(batches.reduce((sum, b) => sum + b.quantityRemaining, 0))
  // Money only from batches that have a cost. Every batch here is in the base
  // currency, so this is one currency added to itself; a batch nobody priced
  // contributes nothing, because an unknown cost is not zero and not NaN.
  const costed = batches.filter((b) => b.unitPrice != null)
  const costedQuantity = round2(costed.reduce((sum, b) => sum + b.quantityRemaining, 0))
  const totalValue = round2(
    costed.reduce((sum, b) => sum + b.quantityRemaining * (b.unitPrice ?? 0), 0),
  )
  const reserved = round2(batches.reduce((sum, b) => sum + reservedOn(b.id), 0))
  return {
    ...row,
    productName: product?.name ?? row.productName,
    totalQuantity,
    batchCount: batches.length,
    // Weighted by what is left, not by what arrived: the cheap batch that sold out
    // stops being part of the average the moment it does. Weighted over the priced
    // batches only — an unpriced one would otherwise drag the average towards zero.
    avgUnitPrice: costedQuantity > 0 ? round2(totalValue / costedQuantity) : 0,
    totalValue,
    unit: (batches[0]?.unit as StockUnit) ?? row.unit,
    // Reserved and available are derived for the same reason: a hold belongs to an
    // order, and a number copied here would lie the moment that order shipped.
    reservedQuantity: reserved,
    availableQuantity: computeAvailable(totalQuantity, reserved),
    isDeficit: row.minStock !== null && totalQuantity < row.minStock,
  }
}

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
  let filtered = stockStore.map(projectStockRow)

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

function paginateStock(
  items: StockOverviewItem[],
  page: number,
  pageSize: number,
): StockOverviewResponse {
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
  // Through the same projection as the list: the card and the list disagreeing
  // about the same shelf is how neither gets believed.
  return projectStockRow(item)
}

export async function mockPatchStockItem(
  productId: string,
  delta: StockPatchPayload,
): Promise<StockOverviewItem> {
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
    // A batch number is a document number, and it hits the same wall an order
    // number does at the thousandth — see `compareDocumentNumbers`.
    if (sortBy === 'batchNumber') cmp = compareDocumentNumbers(a.batchNumber, b.batchNumber)
    else if (sortBy === 'productName') cmp = a.productName.en.localeCompare(b.productName.en)
    else if (sortBy === 'quantity') cmp = a.quantity - b.quantity
    else if (sortBy === 'quantityRemaining') cmp = a.quantityRemaining - b.quantityRemaining
    else if (sortBy === 'unit') cmp = a.unit.localeCompare(b.unit)
    else if (sortBy === 'unitPrice') cmp = (a.unitPrice ?? 0) - (b.unitPrice ?? 0)
    else if (sortBy === 'status') cmp = a.status.localeCompare(b.status)
    else if (sortBy === 'supplierName')
      cmp = (a.supplierName?.en ?? '').localeCompare(b.supplierName?.en ?? '')
    else if (sortBy === 'receivedAt') cmp = a.receivedAt.localeCompare(b.receivedAt)
    return sortDir === 'desc' ? -cmp : cmp
  })

  return paginate(filtered.map(toBatchListItem), pagination.page, pagination.pageSize)
}

/**
 * The list row of a batch.
 *
 * `unitPrice` carries `null` through rather than falling back to 0: a batch
 * nobody priced has no cost, and a zero here would read as "free" in the column
 * and in anything that sums it. Nothing in the seeded store is unpriced, so no
 * row shows it today; a receipt in a foreign currency with the base-currency sum
 * left empty would be the first.
 */
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
    currency: b.currency,
    receivedAt: b.receivedAt,
    status: b.status,
    orderId: b.orderId,
  }
}

export async function mockGetBatch(id: string): Promise<WarehouseBatch> {
  const batch = batchStore.find((b) => b.id === id)
  if (!batch) throw new Error('BATCH_NOT_FOUND')
  return { ...batch }
}

// ─── Location parse helper (mirrors useWarehouseBatch) ─────────────────────
// Format: "Rack: X | Row: Y | Cell: Z\nNotes: ..."
const LOCATION_RACK_RE = /Rack:\s*(.*?)\s*\|/
const LOCATION_ROW_RE = /\|\s*Row:\s*(.*?)\s*\|/
const LOCATION_CELL_RE = /\|\s*Cell:\s*(.*?)(?:\n|$)/
const LOCATION_NOTES_RE = /\nNotes:\s*(.*)$/

function parseLocation(raw: string | null): {
  locationRack: string
  locationRow: string
  locationCell: string
  locationNotes: string
} {
  const fallback = { locationRack: '', locationRow: '', locationCell: '', locationNotes: '' }
  if (!raw) return fallback

  const rackMatch = raw.match(LOCATION_RACK_RE)
  const rowMatch = raw.match(LOCATION_ROW_RE)
  const cellMatch = raw.match(LOCATION_CELL_RE)
  const notesMatch = raw.match(LOCATION_NOTES_RE)

  if (rackMatch || rowMatch || cellMatch) {
    return {
      locationRack: rackMatch?.[1]?.trim() ?? '',
      locationRow: rowMatch?.[1]?.trim() ?? '',
      locationCell: cellMatch?.[1]?.trim() ?? '',
      locationNotes: notesMatch?.[1]?.trim() ?? '',
    }
  }

  return { ...fallback, locationRack: raw }
}

export async function mockCreateBatch(
  data: BatchCreatePayload & { fileIds?: string[] },
): Promise<WarehouseBatch> {
  const id = `whb-${String(batchSeq++).padStart(3, '0')}`
  const now = new Date().toISOString()

  const parsed = parseLocation(data.location ?? null)
  const locParts: string[] = []
  if (parsed.locationRack || parsed.locationRow || parsed.locationCell) {
    locParts.push(
      `Rack: ${parsed.locationRack} | Row: ${parsed.locationRow} | Cell: ${parsed.locationCell}`,
    )
  }
  if (parsed.locationNotes) {
    locParts.push(`Notes: ${parsed.locationNotes}`)
  }

  // ── The purchase is the fact; the warehouse cost is derived from it ──────
  //
  // How much arrived, and in which unit, is the same physical event either way,
  // so those still auto-fill from the receipt. The PRICE does not: it used to be
  // copied backwards (`receivedUnitPrice = data.receivedUnitPrice ?? data.unitPrice`),
  // which invented a supplier price nobody paid — and, with a currency free to be
  // anything, put dollars on a shelf that is kept in euro. The arrow points one
  // way only: an empty purchase price stays empty.
  const receivedQuantity = data.receivedQuantity ?? data.quantity
  const receivedUnitId = data.receivedUnitId ?? _resolveUomId(data.unit)
  const receivedUnitPrice = data.receivedUnitPrice ?? null
  // A currency is a caption to a number; with no purchase price there is nothing
  // to caption. When a price came without one, it came in the base currency.
  const receivedCurrencyId =
    data.receivedCurrencyId ??
    (receivedUnitPrice != null ? _resolveCurrencyId(BASE_CURRENCY) : null)
  const purchaseToWarehouseRate =
    data.purchaseToWarehouseRate ??
    (receivedUnitId !== data.unit
      ? data.quantity && receivedQuantity
        ? receivedQuantity / data.quantity
        : null
      : null)

  // The warehouse layer speaks the base currency and no other. A price labelled
  // in a foreign currency cannot be stored — and must not be quietly relabelled:
  // 250 USD is not 250 EUR, and nothing in this system may say it is.
  if (data.currency != null && data.currency !== BASE_CURRENCY) {
    throw new Error('BATCH_CURRENCY_NOT_BASE')
  }

  const purchaseCurrencyCode =
    receivedCurrencyId == null
      ? null
      : ((MOCK_SETTINGS.currencies as Currency[]).find((c) => c.id === receivedCurrencyId)?.code ??
        receivedCurrencyId)
  const purchaseInBaseCurrency =
    receivedUnitPrice != null &&
    (purchaseCurrencyCode == null || purchaseCurrencyCode === BASE_CURRENCY)

  /**
   * base currency, same unit    → the warehouse cost IS the purchase cost
   * base currency, other unit   → the same money spread over the other unit
   * another currency            → a human names the base-currency sum, or there is none
   *
   * Converting the UNIT is arithmetic and the machine may do it; converting the
   * MONEY is a judgement, and there is no rate to make it with.
   */
  let warehouseUnitPrice: number | null = null
  if (data.unitPrice != null && data.unitPrice > 0) {
    // Named by a human, in the base currency (validated just above).
    warehouseUnitPrice = data.unitPrice
  } else if (purchaseInBaseCurrency && data.quantity > 0) {
    // The money that arrived, spread over the unit the shelf keeps. 1000 kg at
    // 2,00 is 2 000,00 whether it is stored as kilogrammes or as a tonne.
    warehouseUnitPrice = round2((receivedUnitPrice! * receivedQuantity) / data.quantity)
  }

  const batch: WarehouseBatch = {
    id,
    productId: data.productId,
    productName: (() => {
      const product = PRODUCTS_STORE.find((p) => p.id === data.productId)
      return product ? { ...product.name } : { ru: '', en: '', lt: '' }
    })(),
    supplierId: data.supplierId || null,
    supplierName: null,
    batchNumber: data.batchNumber,
    lotCode: data.lotCode,
    quantity: data.quantity,
    quantityRemaining: data.quantity,
    unit: data.unit as StockUnit,
    unitPrice: warehouseUnitPrice,
    // No cost means no total. NaN and 0 both claim something nobody knows.
    totalCost: warehouseUnitPrice == null ? null : round2(data.quantity * warehouseUnitPrice),
    currency: BASE_CURRENCY,
    receivedAt: data.receivedAt,
    expiresAt: data.expiresAt ?? null,
    location: locParts.length > 0 ? locParts.join('\n') : null,
    certificateRef: data.certificateRef ?? null,
    status: 'available',
    notes: data.notes ?? null,
    orderId: null,
    files: [],
    createdAt: now,
    updatedAt: now,
    marginPercent: MOCK_SETTINGS.constants.defaultMargin,
    auditLog: [],
    // ── Purchase audit trail (auto-filled from main fields) ──
    receivedQuantity,
    receivedUnitId,
    receivedUnitPrice,
    receivedCurrencyId,
    purchaseToWarehouseRate,
  }
  batchStore.push(batch)
  return batch
}

export async function mockPatchBatch(
  id: string,
  delta: BatchPatchPayload,
): Promise<WarehouseBatch> {
  const batch = batchStore.find((b) => b.id === id)
  if (!batch) throw new Error('BATCH_NOT_FOUND')
  // The same border as on creation: a batch cannot be re-labelled into a currency
  // the warehouse layer does not speak, on the way in or later.
  if (delta.currency != null && delta.currency !== BASE_CURRENCY) {
    throw new Error('BATCH_CURRENCY_NOT_BASE')
  }
  Object.assign(batch, delta, { updatedAt: new Date().toISOString() })
  // The total follows the cost it is a total of.
  if (delta.unitPrice !== undefined || delta.quantity !== undefined) {
    batch.totalCost = batch.unitPrice == null ? null : round2(batch.quantity * batch.unitPrice)
  }
  // If location changed, auto-create a transfer movement
  if (delta.location && delta.location !== batch.location) {
    // (This is handled by useWarehouseBatch composable)
  }
  return { ...batch }
}

export async function mockDeleteBatch(id: string): Promise<void> {
  const batch = batchStore.find((b) => b.id === id)
  if (!batch) throw new Error('BATCH_NOT_FOUND')
  if (batch.orderId) throw new Error('BATCH_LINKED_TO_ORDER')
  batchStore.splice(batchStore.indexOf(batch), 1)
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
    if (cats.length > 0)
      filtered = filtered.filter((o) => o.categoryId != null && cats.includes(o.categoryId))
  }
  if (filters.batchNumber)
    filtered = filtered.filter((o) =>
      o.batchNumber?.toLowerCase().includes(filters.batchNumber!.toLowerCase()),
    )
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

export async function mockPatchOffcut(
  id: string,
  data: OffcutPatchPayload,
): Promise<WarehouseOffcut> {
  const offcut = offcutStore.find((o) => o.id === id)
  if (!offcut) throw new Error('OFFCUT_NOT_FOUND')
  Object.assign(offcut, data, { updatedAt: new Date().toISOString() })
  return { ...offcut }
}

export async function mockDeleteOffcut(id: string): Promise<void> {
  const offcut = offcutStore.find((o) => o.id === id)
  if (!offcut) throw new Error('OFFCUT_NOT_FOUND')
  if (offcut.orderId) throw new Error('OFFCUT_LINKED_TO_ORDER')
  offcutStore.splice(offcutStore.indexOf(offcut), 1)
}

// ─── Movements ──────────────────────────────────────────────────────────────

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
    currency: m.currency,
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
  if (filters.batchNumber)
    filtered = filtered.filter((m) =>
      m.batchNumber.toLowerCase().includes(filters.batchNumber!.toLowerCase()),
    )
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
    else if (sortBy === 'totalCost') cmp = a.quantity * a.unitPrice - b.quantity * b.unitPrice
    else if (sortBy === 'referenceId')
      cmp = (a.referenceId ?? '').localeCompare(b.referenceId ?? '')
    return sortDir === 'desc' ? -cmp : cmp
  })

  return paginate(filtered.map(toMovementListItem), pagination.page, pagination.pageSize)
}

/**
 * Writes a movement and moves the batch, synchronously.
 *
 * A shipment has to record itself and write off the stock in one go: with an
 * `await` in the middle, a failure between the two leaves goods sold and still
 * on the shelf. The async export below is the API-facing wrapper.
 */
export function writeMovement(data: {
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
}): WarehouseMovement {
  // Every movement — an offcut's included — is recorded against a batch: the record
  // copies its number, product, unit, price and currency from there, so a batch is
  // not decoration but the only place those fields exist. `batchId` is required by
  // the payload type and by `WarehouseOffcut` itself, so a movement without one is
  // unrepresentable; an unknown one fails here, BEFORE anything is written, and in
  // particular before any location is moved. Nothing is left half-done.
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
    // A movement is priced at what the batch costs; a batch with no cost moves
    // goods without moving a known amount of money.
    unitPrice: data.unitPrice ?? batch.unitPrice ?? 0,
    totalCost: data.quantity * (data.unitPrice ?? batch.unitPrice ?? 0),
    referenceId: data.referenceId ?? null,
    referenceType: data.referenceType ?? null,
    fromLocation: data.fromLocation ?? null,
    toLocation: data.toLocation ?? null,
    performedBy: data.performedBy ?? null,
    notes: data.notes ?? null,
    movedAt: data.movedAt ?? now,
    createdAt: now,
    auditLog: [],
    currency: batch.currency,
  }

  // ─── For non-receipt correction: compute delta BEFORE movement added ──
  // (getAggregateQty would include the new movement and return delta=0)
  let correctionDelta = 0
  const outgoingTypes = new Set([
    'sale',
    'expense',
    'write-off',
    'production',
    'return-to-supplier',
    'storage',
    'offcut',
  ])
  if (data.type === 'correction' && data.referenceType && data.referenceType !== 'receipt') {
    if (outgoingTypes.has(data.referenceType)) {
      const currentQty = getAggregateQty(batch.id, data.referenceType)
      correctionDelta = data.quantity - currentQty
    }
  }

  movementStore.push(movement)

  // ─── Update batch quantity remaining based on movement type ──────────
  if (
    data.type === 'sale' ||
    data.type === 'expense' ||
    data.type === 'write-off' ||
    data.type === 'production' ||
    data.type === 'return-to-supplier' ||
    data.type === 'storage' ||
    data.type === 'offcut'
  ) {
    batch.quantityRemaining = Math.max(0, batch.quantityRemaining - data.quantity)
  } else if (data.type === 'receipt') {
    batch.quantityRemaining += data.quantity
    batch.quantity += data.quantity
    if (batch.totalCost != null && batch.unitPrice != null) {
      batch.totalCost += data.quantity * batch.unitPrice
    }
  } else if (data.type === 'return') {
    batch.quantityRemaining += data.quantity
  } else if (data.type === 'correction') {
    if (data.referenceType === 'receipt') {
      // receipt correction: set remaining directly and adjust total by delta
      const oldRemaining = batch.quantityRemaining
      batch.quantityRemaining = Math.max(0, data.quantity)
      batch.quantity += batch.quantityRemaining - oldRemaining
    } else if (correctionDelta !== 0) {
      // Non-receipt correction: adjusts total batch quantity and cost, NOT remaining.
      // Goods are added/removed from inventory, not transferred from receipt.
      batch.quantity += correctionDelta
      if (batch.totalCost != null && batch.unitPrice != null) {
        batch.totalCost += correctionDelta * batch.unitPrice
      }
    }
  } else if (data.type === 'transfer') {
    // A transfer moves metal, not stock: the quantities stay as they are. What it
    // moves is the place the metal is found in — and a location is free text (there
    // is no sector reference), so that string is the whole guarantee the metal gets
    // found again. A stale one is worse than an empty one: it points the wrong way.
    //
    // With no destination named there is nothing better to write, so the known place
    // is kept rather than blanked.
    const destination =
      typeof data.toLocation === 'string' && data.toLocation !== '' ? data.toLocation : null
    if (destination != null) {
      if (data.offcutId != null) {
        // An offcut is ONE physical piece: it cannot be in two places, so there is no
        // partial move to weigh — any transfer takes all of it. `batchId` on the
        // movement is its parent, carried for provenance; the parent stays put.
        // An unknown offcutId writes nothing: the movement is recorded, but a piece
        // the warehouse has never heard of is not given a shelf.
        const offcut = offcutStore.find((o) => o.id === data.offcutId)
        if (offcut) {
          offcut.location = destination
          offcut.updatedAt = now
        }
      } else if (data.quantity >= batch.quantityRemaining) {
        // A batch is divisible, so this one is weighed: the field follows the metal
        // only when the WHOLE remainder goes. On a partial transfer the batch is in
        // two places at once, and overwriting the origin would claim it had all left
        // — the field is left alone and the second place is written by hand.
        batch.location = destination
      }
    }
  }

  // Auto-update batch status based on aggregate distribution
  batch.status = computeBatchStatus(batch) as WarehouseBatch['status']
  batch.updatedAt = now

  return movement
}

export async function mockCreateMovement(
  data: Parameters<typeof writeMovement>[0],
): Promise<WarehouseMovement> {
  return writeMovement(data)
}

/** Batches of one product, oldest first — the order FIFO consumes them in. */
export function batchesForProduct(productId: string): WarehouseBatch[] {
  return batchStore
    .filter((b) => b.productId === productId)
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
}

/**
 * "What is on the shelf, at what cost?" is a question about the warehouse, so the
 * warehouse answers it.
 *
 * Registered rather than imported the other way round. The catalogue used to read
 * the raw seed array itself and average it at module load — the same array this
 * module reprices a moment later, and always afterwards, because warehouse imports
 * products and not the reverse. One mutable array with two owners: whoever read it
 * first kept prices that no longer existed anywhere. Now it has one owner, and the
 * average is asked for when it is needed instead of frozen at import time.
 */
registerProductBatchLookup((productId) =>
  batchesForProduct(productId).map((b) => ({
    quantityRemaining: b.quantityRemaining,
    unitPrice: b.unitPrice,
    currency: b.currency,
  })),
)

/** Movements written against one reference — a shipment, for instance. */
export function mockGetMovementsFor(
  referenceType: string,
  referenceId: string,
): WarehouseMovement[] {
  return movementStore.filter(
    (m) => m.referenceType === referenceType && m.referenceId === referenceId,
  )
}

/** One batch, or undefined. For callers that hold an allocation and need its cost. */
export function batchById(batchId: string): WarehouseBatch | undefined {
  return batchStore.find((b) => b.id === batchId)
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
  const outgoingTypes = new Set([
    'sale',
    'expense',
    'write-off',
    'production',
    'return-to-supplier',
    'storage',
  ])
  const byType: Record<string, number> = {}

  for (const m of movements) {
    if (m.type === 'receipt' || m.type === 'transfer') continue
    if (m.type === 'correction') continue // applied in second pass
    if (m.type === 'return') {
      const reduceType = m.referenceType || ''
      if (reduceType && outgoingTypes.has(reduceType))
        byType[reduceType] = (byType[reduceType] || 0) - m.quantity
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
    const returnedQty = s.referenceId ? returnQtyByRef[s.referenceId] || 0 : 0
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

export async function mockExecuteCutting(
  data: CuttingOperation,
): Promise<{ offcuts: WarehouseOffcut[]; wasteQuantity: number }> {
  const batch = batchStore.find((b) => b.id === data.sourceBatchId)
  if (!batch) throw new Error('BATCH_NOT_FOUND')
  batch.quantityRemaining = Math.max(0, batch.quantityRemaining - data.sourceQuantity)
  batch.updatedAt = new Date().toISOString()
  return { offcuts: [], wasteQuantity: 0 }
}

// ─── Audit helpers & generators ─────────────────────────────────────────────

function getOrCreateMovementAudit(movementId: string): StockAuditEntry[] {
  if (!movementAuditStore[movementId]) {
    const movement = movementStore.find((m) => m.id === movementId)
    movementAuditStore[movementId] = movement?.auditLog ? structuredClone(movement.auditLog) : []
  }
  return movementAuditStore[movementId]
}

const movementAuditStore: Record<string, StockAuditEntry[]> = {}

// ─── Deficit ────────────────────────────────────────────────────────────────

export async function mockGetDeficitList(
  filters: {
    search: string
    priority?: string
    status?: string
    unit?: string
    categoryIds?: string
    sortBy?: string
    sortDir?: string
  },
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

/**
 * Records that an order asked for more than the warehouse can cover.
 *
 * Synchronous so it can happen inside the same operation that accepted the line:
 * a shortage nobody wrote down is a shortage nobody buys, and the order would sit
 * there un-shippable with no trace of why.
 */
export function recordShortage(data: {
  productId: string
  productName: string
  quantity: number
  unit: string
  orderId: string
}): WarehouseDeficit {
  const now = new Date().toISOString()
  // Matched on the whole note, not a substring: "Order ORD-1" is contained in
  // "Order ORD-10", and one order's shortage would quietly overwrite another's.
  const note = `Order ${data.orderId}`
  const existing = deficitStore.find(
    (d) => d.productId === data.productId && d.status === 'open' && d.notes === note,
  )
  if (existing) {
    // The same order asking again is the same shortage, not a second one.
    existing.deficitAmount = round2(Math.max(existing.deficitAmount, data.quantity))
    existing.minRequired = existing.deficitAmount
    existing.updatedAt = now
    return existing
  }

  const deficit: WarehouseDeficit = {
    id: `whd-${String(deficitSeq++).padStart(3, '0')}`,
    productId: data.productId,
    productName: { ru: data.productName, en: data.productName, lt: data.productName },
    currentStock: 0,
    minRequired: round2(data.quantity),
    deficitAmount: round2(data.quantity),
    unit: data.unit,
    priority: 'high',
    status: 'open',
    suggestedOrderQty: round2(data.quantity),
    purchaseOrderId: null,
    notes: note,
    createdAt: now,
    updatedAt: now,
    auditLog: [],
  }
  deficitStore.push(deficit)
  return deficit
}

/**
 * Takes back what an order filed, for one product or for all of them.
 *
 * A shortage is something a line PRODUCED, exactly as its reservation is, and it
 * has to go the same way: the line that asked for more than the shelf holds is
 * deleted, the order is deleted, and the record must not outlive either. Left
 * behind, it sits on the buying list asking somebody to purchase goods for an
 * order that cannot even be opened (contract §4.2).
 *
 * Only records this module filed itself are touched — a shortage entered by hand
 * carries no order note and is nobody's to remove.
 */
export function clearShortages(filter: { orderId: string; productId?: string }): void {
  const note = `Order ${filter.orderId}`
  for (let i = deficitStore.length - 1; i >= 0; i--) {
    const deficit = deficitStore[i]!
    if (deficit.notes !== note) continue
    if (filter.productId && deficit.productId !== filter.productId) continue
    deficitStore.splice(i, 1)
  }
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

export async function mockPatchDeficitItem(
  id: string,
  delta: DeficitPatchPayload,
): Promise<WarehouseDeficit> {
  const deficit = deficitStore.find((d) => d.id === id)
  if (!deficit) throw new Error('DEFICIT_NOT_FOUND')
  Object.assign(deficit, delta, { updatedAt: new Date().toISOString() })
  return { ...deficit }
}

export async function mockDeleteDeficitItem(id: string): Promise<void> {
  const idx = deficitStore.findIndex((d) => d.id === id)
  if (idx === -1) throw new Error('DEFICIT_NOT_FOUND')
  deficitStore.splice(idx, 1)
}

// ─── FIFO Cost Calculation ──────────────────────────────────────────────────

/**
 * Which batches a quantity would consume, oldest first — and what it would cost.
 *
 * Runs on what is AVAILABLE, not on what is on the shelf: a batch already
 * promised to another order cannot also be promised here, or two orders would
 * both price the same tonne and only one could ever write it off.
 *
 * `exceptLine` excludes one line's own hold, so a line asking about itself is not
 * blocked by the goods it is already holding. Everyone else's holds count —
 * including other lines of the same order, which are separate claims.
 *
 * `claimed` is the other half of that same sentence, and it was missing. A hold
 * is not the only way a line stands on a batch: its breakdown claims those units
 * too, from the moment the line is written down and long before anybody reserves
 * anything. Asked for more without being told, FIFO offered a line the very batch
 * it was already standing on — 305 units handed out twice, a breakdown of 405
 * against a batch of 305, and a cost 3,1% under the truth wearing the label
 * "from stock".
 *
 * A shortage is REPORTED, never quietly averaged over: the caller decides whether
 * to accept the order and mark the cost as an estimate, and the goods still
 * cannot be shipped.
 */
export function mockFifoAllocation(
  productId: string,
  quantity: number,
  options?: {
    exceptLine?: { orderId: string; lineId: string }
    /** Per batch: what the asking line already claims and has not shipped. */
    claimed?: ReadonlyMap<string, number>
  },
): FifoResult {
  const batches: FifoBatch[] = batchesForProduct(productId).map((b) => ({
    batchId: b.id,
    offcutId: null,
    receivedAt: b.receivedAt,
    availableQuantity: computeAvailable(
      b.quantityRemaining,
      round2(
        reservedOn(b.id, { exceptLine: options?.exceptLine }) + (options?.claimed?.get(b.id) ?? 0),
      ),
    ),
    // A batch with no cost still holds goods, so FIFO must still see it. What it
    // cannot do is name a price: the order module has no "unknown" to carry, so
    // it reads 0 here. See the note in the audit report — the line should sell at
    // the price it was given and show "—" for margin (model §11.9), and that needs
    // a cost of `null` in FifoBatch, which lives outside this module.
    unitCost: b.unitPrice ?? 0,
    currency: b.currency,
  }))
  return allocateFifo(batches, quantity)
}

/**
 * The cost of a quantity, for the card to show before the line exists. Same
 * function the order module uses, so the preview and the stored line agree.
 */
export function mockCalculateFifoCost(
  productId: string,
  quantity: number,
  options?: { exceptLine?: { orderId: string; lineId: string } },
): { unitPrice: number; totalCost: number; shortageQuantity: number } {
  const fifo = mockFifoAllocation(productId, quantity, options)
  const covered = round2(quantity - fifo.shortageQuantity)
  return {
    // The shortage is priced at what the covered part costs — there is nothing
    // better to price it at — but it is reported so it can be called an estimate.
    unitPrice: fifo.weightedUnitCost,
    totalCost: round2(fifo.weightedUnitCost * covered),
    shortageQuantity: fifo.shortageQuantity,
  }
}

// ─── Export ─────────────────────────────────────────────────────────────────

export async function mockExportWarehouseCsv(_tab: string): Promise<string> {
  return 'mock-csv-data'
}

// ─── Audit endpoints ────────────────────────────────────────────────────────

export async function mockGetStockAudit(productId: string): Promise<StockAuditEntry[]> {
  const item = stockStore.find((s) => s.productId === productId)
  return item?.auditLog ? structuredClone(item.auditLog) : []
}

export async function mockDeleteStockAuditEntry(productId: string, entryId: string): Promise<void> {
  const item = stockStore.find((s) => s.productId === productId)
  if (!item?.auditLog) throw new Error('STOCK_NOT_FOUND')
  const idx = item.auditLog.findIndex((entry) => entry.id === entryId)
  if (idx === -1) throw new Error('AUDIT_ENTRY_NOT_FOUND')
  item.auditLog.splice(idx, 1)
}

export async function mockGetBatchAudit(batchId: string): Promise<StockAuditEntry[]> {
  const batch = batchStore.find((b) => b.id === batchId)
  // A read hands out a copy, like every other read here: returning the live array
  // let a caller edit the store by editing what it had merely asked to look at,
  // and made a deletion look as though it had not happened — the caller's own
  // array had already changed underneath it.
  return batch?.auditLog ? structuredClone(batch.auditLog) : []
}

export async function mockDeleteBatchAuditEntry(batchId: string, entryId: string): Promise<void> {
  const batch = batchStore.find((b) => b.id === batchId)
  if (!batch?.auditLog) throw new Error('BATCH_NOT_FOUND')
  const idx = batch.auditLog.findIndex((entry) => entry.id === entryId)
  if (idx === -1) throw new Error('AUDIT_ENTRY_NOT_FOUND')
  batch.auditLog.splice(idx, 1)
}

export async function mockGetOffcutAudit(offcutId: string): Promise<StockAuditEntry[]> {
  const offcut = offcutStore.find((o) => o.id === offcutId)
  return offcut?.auditLog ? structuredClone(offcut.auditLog) : []
}

export async function mockDeleteOffcutAuditEntry(offcutId: string, entryId: string): Promise<void> {
  const offcut = offcutStore.find((o) => o.id === offcutId)
  if (!offcut?.auditLog) throw new Error('OFFCUT_NOT_FOUND')
  const idx = offcut.auditLog.findIndex((entry) => entry.id === entryId)
  if (idx === -1) throw new Error('AUDIT_ENTRY_NOT_FOUND')
  offcut.auditLog.splice(idx, 1)
}

export async function mockGetMovementAudit(movementId: string): Promise<StockAuditEntry[]> {
  return structuredClone(getOrCreateMovementAudit(movementId))
}

export async function mockDeleteMovementAuditEntry(
  movementId: string,
  entryId: string,
): Promise<void> {
  const audit = getOrCreateMovementAudit(movementId)
  const idx = audit.findIndex((entry) => entry.id === entryId)
  if (idx === -1) throw new Error('AUDIT_ENTRY_NOT_FOUND')
  audit.splice(idx, 1)
}

export async function mockGetDeficitAudit(deficitId: string): Promise<StockAuditEntry[]> {
  const deficit = deficitStore.find((d) => d.id === deficitId)
  return deficit?.auditLog ? structuredClone(deficit.auditLog) : []
}

export async function mockDeleteDeficitAuditEntry(
  deficitId: string,
  entryId: string,
): Promise<void> {
  const deficit = deficitStore.find((d) => d.id === deficitId)
  if (!deficit?.auditLog) throw new Error('DEFICIT_NOT_FOUND')
  const idx = deficit.auditLog.findIndex((entry) => entry.id === entryId)
  if (idx === -1) throw new Error('AUDIT_ENTRY_NOT_FOUND')
  deficit.auditLog.splice(idx, 1)
}
