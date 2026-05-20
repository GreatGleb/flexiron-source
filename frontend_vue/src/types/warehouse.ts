import type { TranslatedString } from './i18n'
import type { PaginatedResponse } from './api'

// ─── Enums ──────────────────────────────────────────────────────────────────

/** Movement direction */
export type MovementType = 'receipt' | 'expense' | 'transfer' | 'write-off'

/** Batch status */
export type BatchStatus = 'available' | 'reserved' | 'partial' | 'depleted' | 'quarantine'

/** Offcut (обрезок) status */
export type OffcutStatus = 'available' | 'reserved' | 'used' | 'scrap'

/** Deficit urgency level */
export type DeficitPriority = 'critical' | 'high' | 'medium' | 'low'

/** Deficit status */
export type DeficitStatus = 'open' | 'in_progress' | 'ordered' | 'resolved' | 'cancelled'

/** Stock unit of measure */
export type StockUnit = 'kg' | 'm' | 'pcs' | 'm2'

// ─── Batch (Партия) ─────────────────────────────────────────────────────────

export interface WarehouseBatch {
  id: string
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
  /** Quantity received */
  quantity: number
  /** Remaining quantity */
  quantityRemaining: number
  unit: StockUnit
  /** Unit price (cost price for this batch) */
  unitPrice: number
  /** Total cost = quantity × unitPrice */
  totalCost: number
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
  createdAt: string
  updatedAt: string
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
  unitPrice: number
  receivedAt: string
  status: BatchStatus
}

export interface BatchCreatePayload {
  productId: string
  supplierId?: string | null
  batchNumber: string
  lotCode: string
  quantity: number
  unit: StockUnit
  unitPrice: number
  receivedAt: string
  expiresAt?: string | null
  location?: string | null
  certificateRef?: string | null
  notes?: string | null
}

export interface BatchPatchPayload {
  batchNumber?: string
  lotCode?: string
  quantity?: number
  unitPrice?: number
  location?: string | null
  certificateRef?: string | null
  status?: BatchStatus
  notes?: string | null
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
  createdAt: string
  updatedAt: string
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
}

// ─── Movement (Движение) ────────────────────────────────────────────────────

export interface WarehouseMovement {
  id: string
  type: MovementType
  /** Reference to batch */
  batchId: string
  batchNumber: string
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
}

export interface MovementListItem {
  id: string
  type: MovementType
  batchId: string
  batchNumber: string
  productId: string
  productName: TranslatedString
  quantity: number
  unit: StockUnit
  unitPrice: number
  referenceId: string | null
  referenceType: string | null
  notes: string | null
  movedAt: string
}

export interface MovementCreatePayload {
  type: MovementType
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

export interface StockAuditEntry {
  timestamp: string
  user: TranslatedString
  userInitials: string
  property: TranslatedString
  oldValue: string
  newValue: string
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
  sortBy: 'name' | 'totalQuantity' | 'availableQuantity' | 'unit' | 'avgUnitPrice' | 'totalValue' | 'minStock' | null
  sortDir: 'asc' | 'desc'
}

// ─── API response wrappers (for convenience) ────────────────────────────────

export type BatchListResponse = PaginatedResponse<BatchListItem>
export type OffcutListResponse = PaginatedResponse<OffcutListItem>
export type MovementListResponse = PaginatedResponse<MovementListItem>
export type DeficitListResponse = PaginatedResponse<DeficitListItem>
export type StockOverviewResponse = PaginatedResponse<StockOverviewItem>
