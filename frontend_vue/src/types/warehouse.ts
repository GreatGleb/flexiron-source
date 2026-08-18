import type { TranslatedString } from './i18n'
import type { PaginatedResponse } from './api'

// ─── Enums ──────────────────────────────────────────────────────────────────

/** Movement direction */
export type MovementType =
  | 'receipt'
  | 'expense'
  | 'transfer'
  | 'write-off'
  | 'return'
  | 'return-to-supplier'
  | 'correction'
  | 'production'
  | 'sale'
  | 'storage'
  | 'offcut'

/** Batch status — based on aggregate distribution */
export type BatchStatus =
  | 'available'
  | 'in_storage'
  | 'in_production'
  | 'sold'
  | 'scrapped'
  | 'expensed'
  | 'returned_to_supplier'
  | 'partial'
  | 'depleted'
  | 'reserved'
  | 'converted_to_offcuts'

/** Offcut (обрезок) status — analogous to BatchStatus */
export type OffcutStatus =
  | 'available'
  | 'reserved'
  | 'in_production'
  | 'sold'
  | 'scrapped'
  | 'expensed'
  | 'returned_to_supplier'
  | 'in_storage'

/** Deficit urgency level */
export type DeficitPriority = 'critical' | 'high' | 'medium' | 'low'

/** Deficit status */
export type DeficitStatus = 'open' | 'in_progress' | 'ordered' | 'resolved' | 'cancelled'

/** Stock unit of measure — now dynamic from settings */
export type StockUnit = string

// ─── Batch File ─────────────────────────────────────────────────────────────

export interface WarehouseBatchFile {
  id: string
  name: TranslatedString
  size: number
  type: string
  uploadedAt: string
}

// ─── Batch (Партия) ─────────────────────────────────────────────────────────

export interface WarehouseBatch {
  id: string
  files: WarehouseBatchFile[]
  /** Link to product */
  productId: string
  productName: TranslatedString
  /** Supplier reference */
  supplierId: string | null
  supplierName: TranslatedString | null
  /** Batch identifier from supplier (invoice/waybill №) */
  batchNumber: string
  /** Internal lot code (auto-generated or manual) */
  lotCode: string
  /** Quantity (in warehouse_uom of the product) */
  quantity: number
  /** Remaining quantity (in warehouse_uom) */
  quantityRemaining: number
  unit: StockUnit
  /**
   * Warehouse cost per warehouse_uom, ALWAYS in the base currency.
   *
   * `null` when nobody priced it: the purchase was in another currency and the
   * base-currency sum was left empty. There is no exchange rate in this system,
   * so the batch has no cost until a human names one — and `null` says exactly
   * that, where 0 would claim the goods were free.
   */
  unitPrice: number | null
  /** Total cost = quantity × unitPrice; `null` when the batch has no cost. */
  totalCost: number | null
  /** Currency of `unitPrice` — the base currency, and nothing else (§7.1). */
  currency: string
  /** Date of receipt */
  receivedAt: string
  /** Expiration / shelf-life date (nullable) */
  expiresAt: string | null
  /** Storage location (rack/shelf/zone) */
  location: string | null
  /** Quality certificate / document reference */
  certificateRef: string | null
  status: BatchStatus
  /** Notes */
  notes: string | null
  /** Link to order if batch is reserved/allocated to an order */
  orderId: string | null
  createdAt: string
  updatedAt: string
  /** Profit margin percent (editable, default from settings.constants.defaultMargin) */
  marginPercent: number | null

  /** Batch change audit log (empty for most batches) */
  auditLog?: StockAuditEntry[]

  // ═══════════════════════════════════════════════════════════════
  // Purchase audit trail (read-only, set at creation)
  // ═══════════════════════════════════════════════════════════════
  /** Original quantity at purchase (in supplier's unit) */
  receivedQuantity: number | null
  /** Supplier's unit of measure at purchase */
  receivedUnitId: string | null
  /** Original unit price in supplier's currency */
  receivedUnitPrice: number | null
  /** Original purchase currency */
  receivedCurrencyId: string | null
  /** Unit-of-measure factor used (received_qty → warehouse_qty). Not a currency rate. */
  purchaseToWarehouseRate: number | null
}

export interface BatchListItem {
  id: string
  productId: string
  productName: TranslatedString
  batchNumber: string
  lotCode: string
  quantity: number
  quantityRemaining: number
  unit: StockUnit
  /** `null` when nobody priced the batch — an unknown cost is not a zero one. */
  unitPrice: number | null
  currency: string
  receivedAt: string
  status: BatchStatus
  /** Link to order if batch is reserved/allocated to an order */
  orderId: string | null
}

export interface BatchCreatePayload {
  productId: string
  supplierId?: string | null
  batchNumber: string
  lotCode: string
  quantity: number
  unit: StockUnit
  /**
   * Warehouse cost in the BASE currency, named by a human.
   *
   * Optional on purpose: for a purchase in the base currency it is derived from
   * the purchase and nobody is asked for it, and for a purchase in another
   * currency it may be left empty — then the batch has no cost.
   */
  unitPrice?: number | null
  /** Must be the base currency if sent at all — the warehouse layer speaks no other. */
  currency?: string
  receivedAt: string
  expiresAt?: string | null
  location?: string | null
  certificateRef?: string | null
  notes?: string | null

  // Purchase audit trail (optional for backward compat)
  receivedQuantity?: number | null
  receivedUnitId?: string | null
  receivedUnitPrice?: number | null
  receivedCurrencyId?: string | null
  purchaseToWarehouseRate?: number | null
}

export interface BatchPatchPayload {
  batchNumber?: string
  lotCode?: string
  quantity?: number
  /** Warehouse cost in the base currency; `null` clears it. */
  unitPrice?: number | null
  /** Only the base currency is accepted — see WarehouseBatch.unitPrice. */
  currency?: string
  location?: string | null
  certificateRef?: string | null
  status?: BatchStatus
  notes?: string | null
  /** File IDs to attach (replaces existing) */
  fileIds?: string[]
}

// ─── Offcut (Обрезок / Atraiža) ─────────────────────────────────────────────

export interface WarehouseOffcut {
  id: string
  /** Source batch */
  batchId: string
  batchNumber: string
  /** Link to product */
  productId: string
  productName: TranslatedString
  /** Product category ID (for filtering / display) */
  categoryId: string | null
  /** Offcut type: 'sheet' for 2D materials, 'linear' for pipes/beams/etc. */
  offcutType: 'sheet' | 'linear'
  /** Dimensions */
  lengthMm: number | null
  widthMm: number | null
  thicknessMm: number | null
  /** Actual weight */
  weightKg: number | null
  /** Quantity (usually 1 piece) */
  quantity: number
  unit: StockUnit
  /** Storage location */
  location: string | null
  status: OffcutStatus
  /** Notes (e.g. "suitable for small parts") */
  notes: string | null
  /** QR code data (for scanning) */
  qrData: string | null
  /** Attached files (certificates, photos) */
  files: WarehouseBatchFile[]
  /** Link to order if offcut is reserved for an order */
  orderId: string | null
  createdAt: string
  updatedAt: string
  /** Offcut change audit log */
  auditLog: StockAuditEntry[]
}

export interface OffcutListItem {
  id: string
  batchId: string
  batchNumber: string
  productId: string
  productName: TranslatedString
  categoryId: string | null
  offcutType: 'sheet' | 'linear'
  lengthMm: number | null
  widthMm: number | null
  weightKg: number | null
  quantity: number
  unit: StockUnit
  location: string | null
  status: OffcutStatus
  /** Link to order if offcut is reserved for an order */
  orderId: string | null
}

export interface OffcutCreatePayload {
  batchId: string
  productId: string
  categoryId?: string | null
  offcutType?: 'sheet' | 'linear'
  lengthMm?: number | null
  widthMm?: number | null
  thicknessMm?: number | null
  weightKg?: number | null
  quantity: number
  unit: StockUnit
  location?: string | null
  notes?: string | null
  /** File IDs to attach to the offcut */
  fileIds?: string[]
}

export interface OffcutPatchPayload {
  status?: OffcutStatus
  notes?: string | null
  location?: string | null
  /** File IDs to attach (replaces existing) */
  fileIds?: string[]
}

// ─── Movement (Движение) ────────────────────────────────────────────────────

export interface WarehouseMovement {
  id: string
  type: MovementType
  /** Reference to batch */
  batchId: string
  batchNumber: string
  /** Reference to offcut (if movement belongs to an offcut) */
  offcutId: string | null
  /** Link to product */
  productId: string
  productName: TranslatedString
  /** Quantity moved */
  quantity: number
  unit: StockUnit
  /** Unit price at time of movement */
  unitPrice: number
  /** Total cost = quantity × unitPrice */
  totalCost: number
  /** For expense: reference to order / production order */
  referenceId: string | null
  referenceType: string | null
  /** For transfer: source/destination location */
  fromLocation: string | null
  toLocation: string | null
  /** Performer */
  performedBy: string | null
  /** Notes / reason */
  notes: string | null
  /** Timestamp */
  movedAt: string
  createdAt: string
  /** Movement change audit log */
  auditLog: StockAuditEntry[]
  /** Currency copied from batch.currency at creation */
  currency: string
}

export interface MovementListItem {
  id: string
  type: MovementType
  batchId: string
  batchNumber: string
  offcutId: string | null
  productId: string
  productName: TranslatedString
  quantity: number
  unit: StockUnit
  unitPrice: number
  referenceId: string | null
  referenceType: string | null
  notes: string | null
  movedAt: string
  currency: string
}

export interface MovementCreatePayload {
  type: MovementType
  batchId: string
  /** Reference to offcut (if movement belongs to an offcut) */
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
  currency?: string
}

// ─── Cutting (Резка) — special operation ────────────────────────────────────

export interface CuttingOperation {
  /** Source batch ID */
  sourceBatchId: string
  /** Quantity of source material consumed */
  sourceQuantity: number
  /** Kerf (ширина реза) in mm */
  kerfMm: number
  /** Resulting offcuts */
  offcuts: Omit<OffcutCreatePayload, 'batchId'>[]
  /** Waste / scrap quantity */
  wasteQuantity: number
  /** Notes */
  notes?: string | null
}

// ─── Deficit (Дефицит) ──────────────────────────────────────────────────────

export interface WarehouseDeficit {
  id: string
  /** Link to product that is in deficit */
  productId: string
  productName: TranslatedString
  /** Current stock quantity */
  currentStock: number
  /** Minimum required stock */
  minRequired: number
  /** Deficit amount = minRequired - currentStock (positive) */
  deficitAmount: number
  unit: StockUnit
  priority: DeficitPriority
  status: DeficitStatus
  /** Suggested order quantity */
  suggestedOrderQty: number | null
  /** Link to purchase order if ordered */
  purchaseOrderId: string | null
  /** Notes */
  notes: string | null
  createdAt: string
  updatedAt: string
  /** Deficit change audit log */
  auditLog: StockAuditEntry[]
}

export interface DeficitListItem {
  id: string
  productId: string
  productName: TranslatedString
  currentStock: number
  minRequired: number
  deficitAmount: number
  unit: StockUnit
  priority: DeficitPriority
  status: DeficitStatus
  /**
   * Why this is on the buying list — for a shortage an order filed, it names the
   * order (`Order ORD-…`).
   *
   * Declared because the row already carried it: the list endpoint hands the
   * whole record back, and a field a payload carries but a type does not name is
   * a column nobody reads off the schema (contract §3). It is also what ties a
   * shortage to the order that caused it, which is how it gets cleared again.
   */
  notes: string | null
}

export interface DeficitCreatePayload {
  productId: string
  minRequired: number
  priority: DeficitPriority
  notes?: string | null
}

export interface DeficitPatchPayload {
  minRequired?: number
  priority?: DeficitPriority
  status?: DeficitStatus
  suggestedOrderQty?: number | null
  purchaseOrderId?: string | null
  notes?: string | null
}

// ─── Stock Audit Entry ──────────────────────────────────────────────────────

/**
 * One recorded change, addressed by `id` and never by its place in the list.
 *
 * A position always names something, so a stale one deletes whatever slid into
 * it — silently. That happens without any concurrency at all: delete one entry
 * and every later position in the same log shifts under the rows still on
 * screen. The order card met this first and answered it the same way
 * (`OrderAuditEntry`, `types/order.ts`); the other eight entities follow it here,
 * so the whole system addresses a record the same way, and the audit feed can
 * name a row as entity type + entity id + entry id.
 *
 * The id is unique inside its own log, like an order line id and for the same
 * reason: the record is reached through its entity's path,
 * `DELETE /api/<entity>/:id/audit/:entryId`. The prefix says which kind of
 * entity the log belongs to, so a row in the merged feed can be read on sight.
 */
export interface StockAuditEntry {
  id: string
  timestamp: string
  user: TranslatedString
  userInitials: string
  property: TranslatedString
  oldValue: string
  newValue: string
}

/**
 * An entry as written in a mock seed file — everything but the id.
 *
 * The seeds carry no ids: 294 of them exist across eight files, and typing them
 * out by hand would be 294 chances to repeat one. `sealAuditIds` assigns them
 * when the store is built, which is also what a real backend does with a
 * generated column.
 */
export type StockAuditSeed = Omit<StockAuditEntry, 'id'>

// ─── Batch Status Aggregate (Агрегированные данные по статусам партии) ──────

export interface BatchStatusAggregate {
  type: MovementType
  quantity: number
  unit: StockUnit
}

// ─── Batch Active Sale (Активная продажа для возврата) ───────────────────────

export interface BatchActiveSale {
  id: string
  movementId: string
  quantity: number
  unit: StockUnit
  /** Customer / order reference */
  referenceId: string | null
  /** Sale date */
  soldAt: string
}

// ─── Stock Overview (Общий остаток) ─────────────────────────────────────────

export interface StockOverviewItem {
  productId: string
  productName: TranslatedString
  /** Total quantity across all batches */
  totalQuantity: number
  /** Reserved quantity */
  reservedQuantity: number
  /** Available quantity = total - reserved */
  availableQuantity: number
  unit: StockUnit
  /** Number of active batches */
  batchCount: number
  /** Weighted average unit price */
  avgUnitPrice: number
  /** Total stock value */
  totalValue: number
  /** Minimum stock threshold (from product) */
  minStock: number | null
  /** Whether this product is in deficit */
  isDeficit: boolean
  /** Product category ID (for filtering) */
  categoryId?: string | null
  /** Product category name (for display) */
  categoryName?: TranslatedString | null
  /** Stock change audit log */
  auditLog: StockAuditEntry[]
}

export interface StockPatchPayload {
  /** Product name (TranslatedString) */
  productName?: TranslatedString
  /** Unit of measure */
  unit?: StockUnit
  /** Weighted average unit price */
  avgUnitPrice?: number
  /** Minimum stock threshold */
  minStock?: number | null
  /** Product category name (for display) */
  categoryName?: TranslatedString | null
}

// ─── Filters ────────────────────────────────────────────────────────────────

// ─── Stock Reservation ──────────────────────────────────────────────────────

/**
 * Goods promised to an order but still physically in the warehouse.
 *
 * Deliberately NOT a movement: a reservation does not change how much is on the
 * shelf, it changes how much is available. And deliberately not a field on the
 * batch — one batch serves many orders at once, which a single `orderId` cannot
 * express. Available = quantityRemaining − sum of reservations.
 */
export interface StockReservation {
  id: string
  batchId: string | null
  offcutId: string | null
  orderId: string
  /** Which order line the reservation belongs to. */
  lineId: string
  quantity: number
  createdAt: string
}

export interface WarehouseFilters {
  search: string
  productId?: string
  supplierId?: string
  status?: BatchStatus | OffcutStatus | DeficitStatus
  type?: MovementType
  priority?: DeficitPriority
  unit?: string
  offcutType?: 'sheet' | 'linear'
  categoryIds?: string[]
  batchNumber?: string
  referenceId?: string
  offcutId?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

/** Filters specific to the Stock Overview tab (server-side) */
export interface StockFilters {
  search: string
  categoryIds: string[]
  unit: string
  showDeficitOnly: boolean
  showInStockOnly: boolean
  sortBy:
    | 'name'
    | 'totalQuantity'
    | 'availableQuantity'
    | 'unit'
    | 'avgUnitPrice'
    | 'totalValue'
    | 'minStock'
    | null
  sortDir: 'asc' | 'desc'
}

// ─── API response wrappers (for convenience) ────────────────────────────────

export type BatchListResponse = PaginatedResponse<BatchListItem>
export type OffcutListResponse = PaginatedResponse<OffcutListItem>
export type MovementListResponse = PaginatedResponse<MovementListItem>
export type DeficitListResponse = PaginatedResponse<DeficitListItem>
export type StockOverviewResponse = PaginatedResponse<StockOverviewItem>
