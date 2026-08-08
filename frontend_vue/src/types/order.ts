import type { StockAuditEntry } from './warehouse'
import type { CostSource, LineState, VatMode } from '@/domain/orderPricing'

export type { CostSource, LineState, VatMode }

export type OrderDocumentType = 'local' | 'export'

export type OrderStatus =
  | 'new'
  | 'confirmed'
  | 'picking'
  | 'packing'
  | 'shipped'
  | 'delivered'
  | 'paid'
  | 'cancelled'

export interface OrderListItem {
  id: string
  orderNumber: string
  clientId: string
  clientName: string
  status: OrderStatus
  /** Net, without VAT. Kept for anything that reports on turnover before tax. */
  totalAmount: number
  /**
   * What the client pays. This is the figure the list shows: the card's headline
   * is the gross total, and two screens naming the same order a different number
   * is how nobody trusts either.
   */
  totalWithVat: number
  currency: string
  itemCount: number
  createdAt: string
  /** Derived from payments — never stored as a number that can go stale. */
  paidPercent: number
  /** Share of the ordered quantity that has left the warehouse. */
  shippedPercent: number
}

/**
 * The sales dashboard's four numbers.
 *
 * Counted by the server over every order and every client there is. The client
 * cannot compute them from a page of the list — the page is a window, and a
 * count taken through a window stops moving the moment the window is full,
 * without ever saying so.
 */
export interface SalesCrmStats {
  /** Everything not delivered and not cancelled. */
  activeOrders: number
  /** Waiting on somebody: new or confirmed. */
  pendingOrders: number
  /** Net turnover since the 1st of the current month. VAT is not revenue. */
  salesMtd: number
  /** Clients registered since the 1st of the current month. */
  newClientsThisMonth: number
}

/**
 * Which batch or offcut a line's quantity was taken from. FIFO routinely spans
 * several, so a single `batchId` cannot express it — without this breakdown the
 * cost is not reproducible and a partial shipment cannot write off the very
 * batches it consumed.
 */
export interface OrderLineAllocation {
  batchId: string | null
  offcutId: string | null
  quantity: number
  /** Cost per unit, already converted into the order currency. */
  unitCost: number
  /** Batch currency the cost came from. */
  currency: string
  /** Rate batch currency → order currency, frozen together with the price. */
  exchangeRate: number | null
  source: CostSource
}

/**
 * An order line.
 *
 * The pricing fields are the truth. `unitPrice`, `totalPrice` and `discount` are
 * a projection computed by the pricing module on the way out — they exist so the
 * older parts of the UI keep working, and must never be written to directly.
 */
export interface OrderItem {
  id: string
  lineNumber: number
  productId: string
  productName: string
  quantity: number
  unit: string

  // ── Cost ────────────────────────────────────────────────────────────────
  /** Cost per unit in the ORDER currency, already converted. */
  unitCost: number
  costSource: CostSource
  /** Manual cost overrides the warehouse figure; the reason is mandatory. */
  manualUnitCost: number | null
  manualCostReason: string | null
  /** Which batches/offcuts this line consumes. */
  allocations: OrderLineAllocation[]

  // ── Price ───────────────────────────────────────────────────────────────
  /** Planned margin — markup over cost, before discount. */
  marginPercent: number
  discountPercent: number
  /** Set → the price is 🔒 locked and no longer follows cost or order defaults. */
  manualUnitPrice: number | null

  // ── Lifecycle ───────────────────────────────────────────────────────────
  state: LineState
  shippedQuantity: number
  /** Printed on a document the client already holds. Freezes the line. */
  documentIssued: boolean

  /** No product carries a weight yet, so this is null until one does. */
  weightPerUnitKg: number | null

  // ── Projection — computed, do not assign ────────────────────────────────
  /** Price per unit after discount. */
  unitPrice: number
  /** Line total excluding VAT. */
  totalPrice: number
  /** Same as `discountPercent`. */
  discount: number

  // ── Provenance ──────────────────────────────────────────────────────────
  /** First allocation, kept for older call sites; `allocations` is the truth. */
  batchId: string | null
  offcutId: string | null
  /** Currency of the batch the cost came from. */
  receivedCurrency: string
  /** Rate from `receivedCurrency` to the order currency. */
  exchangeRate: number | null
}

/**
 * A service line. Same pricing shape as goods, so it takes part in total
 * allocation and in freezing. `shippedQuantity` stays 0 — services never ship;
 * they are frozen by an issued invoice instead (`documentIssued`).
 */
export interface OrderService {
  id: string
  serviceId: string
  serviceName: string
  quantity: number

  unitCost: number
  costSource: CostSource
  manualUnitCost: number | null
  manualCostReason: string | null

  marginPercent: number
  discountPercent: number
  manualUnitPrice: number | null

  state: LineState
  shippedQuantity: number
  documentIssued: boolean

  // ── Projection — computed, do not assign ────────────────────────────────
  /** Same as `unitCost`. */
  cost: number
  /** Price per unit after discount. */
  price: number
  /** Profit in money: line total − line cost. */
  marginAmount: number
  /** Line total excluding VAT. */
  totalPrice: number
}

// ─── Shipments ──────────────────────────────────────────────────────────────

/**
 * A hold a shipment took over — a claim on a batch, and nothing else.
 *
 * Deliberately not an `OrderLineAllocation`: that carries a cost, a currency and a
 * rate, because it says what the goods cost. A reservation says only that somebody
 * asked for them first.
 */
export interface ShipmentHold {
  batchId: string | null
  offcutId: string | null
  quantity: number
}

export interface ShipmentLine {
  lineId: string
  quantity: number
  /**
   * The hold this shipment took over, per batch.
   *
   * Shipping replaces a reservation with a real write-off, so the hold is
   * released — and a cancellation has to put it back, or the goods return to the
   * shelf unclaimed and the next order can take them. How much was held, and off
   * which batch, is knowable only at the moment it is released, so the shipment
   * records it. Absent or empty means the line held nothing when it shipped.
   */
  heldReleased?: ShipmentHold[]
}

/**
 * One truck. A shipment is also the waybill, which is why status-driven
 * write-off creates one instead of touching the warehouse directly.
 */
/**
 * A line that still has goods to send, and how many of them can actually go.
 *
 * `remaining` is what the order still owes the client; `shippable` is what the
 * shelf can back right now. They differ whenever the warehouse is short, and a
 * dialog offering `remaining` would only be refused — so it offers `shippable`
 * and shows both.
 */
export interface ShippableLine {
  lineId: string
  productName: string
  unit: string
  remaining: number
  shippable: number
}

/** What the warehouse cannot cover — the numbers a confirmation dialog must show. */
export interface ShipmentShortage {
  lineId: string
  productName: string
  unit: string
  missing: number
}

/**
 * What a status change is about to do to the warehouse.
 *
 * One status may hold the remainder and one may write it off (the settings decide),
 * so for an ordinary order — one truck, everything at once — the status change IS
 * the shipping workflow. Which is exactly why it may not be silent: the card shows
 * this plan first, and a shortage refuses the change instead of shipping air.
 */
export interface StatusTransitionPlan {
  status: OrderStatus
  reserves: boolean
  writesOff: boolean
  /** Goods lines the shipment would carry. Services never ship. */
  lines: Array<{ lineId: string; productName: string; unit: string; quantity: number }>
  shortages: ShipmentShortage[]
}

export interface Shipment {
  id: string
  orderId: string
  number: string
  shippedAt: string
  carrier: string | null
  vehicle: string | null
  waybillNumber: string | null
  lines: ShipmentLine[]
  /** Cancelled by reverse movements — a shipment is never deleted. */
  cancelled: boolean
}

// ─── Invoices and payments ──────────────────────────────────────────────────

export type InvoiceKind = 'advance' | 'regular' | 'correction'

export interface Invoice {
  id: string
  orderId: string
  number: string
  issuedAt: string
  kind: InvoiceKind
  /** A regular invoice covers one shipment; an advance invoice covers none. */
  shipmentId: string | null
  correctsInvoiceId: string | null
  /**
   * This correction takes the original document back, rather than adjusting it.
   *
   * A correction for the mirror amount withdraws the invoice — the two together
   * come to zero and the client holds nothing. A correction for a stated smaller
   * amount only fixes a figure on a document the client is still holding: a price
   * corrected after the goods left. Only the first kind makes the original stop
   * counting, and conflating them unfroze corrected lines and billed the order's
   * services twice. Always false on anything that is not a correction.
   */
  withdrawsOriginal: boolean
  /**
   * The order's services are billed on this document.
   *
   * Services never ship, so they cannot belong to a shipment — they ride on the
   * first regular invoice of the order, which is the same document that freezes
   * them. Recorded on the invoice rather than worked out again later: the amount
   * and the freeze have to be one decision, or the services end up frozen by a
   * document that never charged for them.
   */
  coversServices: boolean
  amountNet: number
  amountVat: number
  amountGross: number
  /**
   * Why the document was corrected. Mandatory on a correction and empty on
   * everything else: a correcting invoice reaches the client's accountant, and
   * "the amount changed" is not an answer they can file.
   */
  reason: string | null
}

export type PaymentPurpose = 'advance' | 'balance' | 'refund'

export interface Payment {
  id: string
  orderId: string
  /** Negative for a refund — an overpaid order has to give money back. */
  amount: number
  paidAt: string
  purpose: PaymentPurpose
  invoiceId: string | null
  note: string | null
}

// ─── Order ──────────────────────────────────────────────────────────────────

export interface OrderDocument {
  id: string
  type: string
  generatedAt: string
  generatedBy: string
  url: string
}

export interface Order {
  id: string
  orderNumber: string
  clientId: string
  clientName: string
  clientVatCode: string
  clientAddress: string
  documentType: OrderDocumentType
  status: OrderStatus
  items: OrderItem[]
  services: OrderService[]

  // ── Defaults for NEW lines only — they never rewrite existing ones ───────
  defaultMarginPercent: number
  defaultDiscountPercent: number
  vatMode: VatMode
  /** Standard rate, used when `vatMode` is 'standard'. */
  vatPercent: number
  currency: string

  // ── Derived — recomputed on every write, never accepted from the client ──
  totalCost: number
  /** Total excluding VAT. */
  totalAmount: number
  totalVat: number
  /** What the client pays. */
  totalWithVat: number
  actualMarginPercent: number
  effectiveDiscountPercent: number
  paidAmount: number
  paidPercent: number
  outstandingAmount: number

  /**
   * Entered by hand: no product carries a weight, so nothing can compute it.
   * Once products have weights it becomes derived like the money totals.
   */
  totalWeight: number

  shipments: Shipment[]
  invoices: Invoice[]
  payments: Payment[]

  notes: string | null
  documents: OrderDocument[]
  files: OrderFile[]
  auditLog: StockAuditEntry[]
  createdAt: string
  updatedAt: string
}

export interface OrderFile {
  id: string
  name: string
  fileId: string
  url: string
  size: number
  mime: string
  uploadedAt: string
}

export interface OrderFilters {
  search: string
  status: string
  clientId: string | null
  dateFrom: string
  dateTo: string
  sortBy: string | null
  sortDir: string
}
