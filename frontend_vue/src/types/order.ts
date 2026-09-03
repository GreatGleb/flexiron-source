import type { StockAuditEntry } from './warehouse'
import type { CostSource, LineState, VatMode } from '@/domain/orderPricing'
import type { OrderStatus } from '@/domain/orderStatus'

export type { CostSource, LineState, VatMode }

/**
 * The lifecycle statuses live in `domain/orderStatus` — the list, the pill
 * classes and the predicates that read them are one module, the way the pricing
 * arithmetic is. Re-exported here so the dozens of `import type { OrderStatus }
 * from '@/types/order'` around the app keep pointing at the same thing.
 */
export type { OrderStatus }

export type OrderDocumentType = 'local' | 'export'

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
  /** Cost per unit. */
  unitCost: number
  /** Batch currency the cost came from — a label on the number, not a factor. */
  currency: string
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
  /**
   * The price the line was quoted at, stored as a price and NOT locked — a
   * catalogue price. It is what the line shows, totals and invoices; a real cost
   * change reprices it through `marginPercent`. Never set together with
   * `manualUnitPrice`: storing a price and locking it are different statements
   * (contract §7), and a line makes exactly one of them.
   */
  namedUnitPrice: number | null

  // ── Lifecycle ───────────────────────────────────────────────────────────
  state: LineState
  shippedQuantity: number
  /**
   * How much of what shipped has come back. Counted beside `shippedQuantity`
   * and never subtracted from it: the goods did leave, on a waybill the client
   * signed, and a line that forgets that cannot be reconciled with the movement
   * ledger. `state` therefore stays 'shipped' — the return is a separate fact.
   */
  returnedQuantity: number
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
  /**
   * The caption on `unitCost`. A label, never a multiplier.
   *
   * Always the BASE currency, and stated as the code (`EUR`), the way the
   * warehouse and `Order.currency` state it: the warehouse layer speaks the base
   * currency and no other, and a batch in anything else is refused outright
   * (`BATCH_CURRENCY_NOT_BASE`, contract §7.1). Not the currency the product is
   * sold in — that captions a different number.
   */
  receivedCurrency: string
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
  /** A quoted price that is stored but not locked — see `OrderItem`. */
  namedUnitPrice: number | null

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
   * records it.
   *
   * `null` — and never absent — when the line held nothing when it shipped. The
   * field used to be left off the object entirely, and through JSON that is a key
   * nobody sees: a schema read off one response would not know the column exists
   * (contract §3, "необязательное поле присутствует всегда со значением null").
   */
  heldReleased: ShipmentHold[] | null
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
  /**
   * Куски в разбивке строки, выраженные в количестве.
   *
   * Обрезок неделим: количество, попавшее СТРОГО внутрь такого отрезка, режет кусок
   * пополам, и списание его отклонит. Диалогу это нужно знать до отправки — иначе он
   * предлагает диапазон, часть которого откажут.
   */
  wholePieces: WholePieceRange[]
}

/** Отрезок количества, занятый одним неделимым куском: `(from; to)` — запретная зона. */
export interface WholePieceRange {
  from: number
  to: number
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

// ─── Returns ────────────────────────────────────────────────────────────────

/**
 * What came back — sellable stock, or a loss.
 *
 * Independent of whether the client gets their money back: goods can come back
 * damaged and still be refunded, and they can come back perfect and be kept
 * against a debt. One field per question, because they are two questions.
 */
export type ReturnCondition = 'good' | 'defective'

export interface OrderReturnLine {
  lineId: string
  quantity: number
  condition: ReturnCondition
  /** Whether the money for this quantity goes back to the client. */
  compensated: boolean
  /**
   * Which batches the goods went back onto, and how much of each — the mirror
   * of `heldReleased` on a shipment line, and there for the same reason: what
   * the return did has to be reproducible, and undoing it later has to put the
   * goods back exactly where they came from.
   *
   * Present always — `null` when nothing landed anywhere, never an absent key
   * (contract §3).
   */
  restored: ShipmentHold[] | null
}

/**
 * Goods coming back from the client.
 *
 * Deliberately not a cancelled shipment. A cancellation says the delivery never
 * effectively happened, so it takes `shippedQuantity` back down; a return says
 * it happened and was reversed, so the shipped quantity stands and the returned
 * one is counted beside it. The order total does not move either: the order was
 * for that much, and what the client owes after the return is derived.
 */
export interface OrderReturn {
  id: string
  orderId: string
  number: string
  returnedAt: string
  /** Mandatory. A return is an event somebody will be asked about. */
  reason: string
  lines: OrderReturnLine[]
  /**
   * The correcting invoices issued for the compensated part. Empty when nothing
   * was compensated, and also when the returned quantity had never been billed
   * — there is no document to correct.
   */
  correctionInvoiceIds: string[]
}

/**
 * A line with something that can still come back. The mirror of `ShippableLine`.
 */
export interface ReturnableLine {
  lineId: string
  productName: string
  unit: string
  shipped: number
  alreadyReturned: number
  /** `shipped − alreadyReturned` — what the dialog may offer. */
  returnable: number
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
   * Which of the order's services this document charged for, by service line id.
   *
   * Services never ship, so they cannot belong to a shipment — they ride on an
   * ordinary invoice, which is the same document that freezes them. Recorded on
   * the invoice rather than worked out again later: the amount and the freeze
   * have to be one decision, or a service ends up frozen by a document that never
   * charged for it.
   *
   * A list and not a flag, because both questions asked of it are per service.
   * "This invoice covers the services", handed out once, stranded any service
   * added to a live order afterwards — on no document, yet frozen by all of them
   * (contract §4.6, findings 4 and 7). Empty on a document that carries none.
   */
  coveredServiceIds: string[]
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
  /**
   * Условия оплаты клиента на момент создания заказа — отсрочка в днях от даты
   * счёта, 0 — оплата по счёту.
   *
   * Снимок, а не ссылка на клиента, по той же причине, по которой рядом лежат
   * копии кода НДС и адреса: заказ должен помнить условия, на которых он был
   * оформлен. Клиенту потом сократят отсрочку — счета прошлых заказов от этого
   * не станут просроченными задним числом.
   */
  clientPaymentTermsDays: number
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
  returns: OrderReturn[]
  invoices: Invoice[]
  payments: Payment[]

  notes: string | null
  documents: OrderDocument[]
  files: OrderFile[]
  auditLog: OrderAuditEntry[]
  createdAt: string
  updatedAt: string

  /**
   * What the shelf would give each goods line NEXT, by line id — oldest batch
   * first, and only what is still free to that line beyond what it already
   * claims.
   *
   * Computed by the server on the way out and never stored (§1, rule 5): it is
   * the warehouse's answer to "and if this line grew?", and the shelf moves
   * under it. Growing a line takes its extra units off real batches at real
   * prices and the line's cost becomes the blend of everything it then holds —
   * so a card without this cannot show what a quantity change will really store,
   * and two runs in six hundred of the randomised card fuzz ended with the admin
   * approving one figure and the order being worth another.
   *
   * Deliberately the ladder and not the answer. WHICH batches, in what order,
   * minus what other orders hold and what this line already claims, is a rule,
   * and it stays in the one place that owns it; what a client does with the
   * ladder is a weighted average, which is arithmetic. Handing a client the
   * shelf and letting it run FIFO for itself would be the second implementation
   * that every finding in this audit grew out of.
   *
   * Keyed by line id and kept off the line itself on purpose: a line is compared
   * field for field between what a client applied locally and what the server
   * stored, and a figure that depends on the shelf rather than on the line would
   * make those two disagree for a reason that is not about the edit at all.
   * Missing entry — including for a row that has never been to the server —
   * means "no word from the warehouse", and a client that has no word leaves the
   * cost alone rather than guessing.
   */
  costTopUp?: Record<string, OrderLineAllocation[]>

  /**
   * What the order is on, counted up by the server on every write (contract §3).
   *
   * The one thing two people on the same order can compare. A client sends back
   * the version it was looking at; a server that finds it behind refuses the
   * whole mutation with `ORDER_VERSION_CONFLICT` and writes nothing. Without it
   * two tabs pricing the same line at 130,00 and at 80,00 both hear "saved" and
   * the order is worth 800,00, with the first card still showing 1 300,00.
   *
   * Optional in the TYPE and never absent on the wire — the two are not the same
   * statement. A response always carries it; `undefined` here means "this client
   * never saw a version", which is also exactly what it means in a request: no
   * precondition was offered, so there is nothing to check. That is what lets a
   * caller that never read the order — a test harness, a migration — still write
   * through the same functions.
   */
  version?: number
}

/**
 * What a line-edit request carries besides the fields of the line itself.
 *
 * Both are about the CALL rather than the line, which is why they cannot live in
 * `LineEditDelta`: one says which order state the edit was made against, the
 * other supplies the order field the edit is settled with.
 */
export interface LineEditEnvelope {
  /**
   * The order default `resetPrice` resets the line to, as it stood at the moment
   * the button was pressed (contract §4.2).
   *
   * "Reset to computed" is the one edit whose result depends on a field of the
   * ORDER, and therefore the one that comes apart when the order fields and the
   * line edits travel in separate requests: the card worked the price out against
   * the default it was showing, sent `{ resetPrice: true }` with no number, and
   * the server redid it against the default this very save had just written a
   * moment earlier. A percentage the header calls "for new lines" reached a line
   * that already existed, 240,00 out of 1 200,00, in both directions. An edit is
   * an operation, not a final state, and the default is part of the operation.
   */
  defaultDiscountPercent?: number
  /** The order version this edit was made against — see `Order.version`. */
  version?: number
}

/**
 * One line of the order's history — a stock audit entry that can be named.
 *
 * The record is addressed by `id`, never by its place in the list: two clients
 * holding the same history and deleting different entries shift each other's
 * indices, and the second deletion then lands on whatever slid into the position
 * it read — silently, since a position always names something (contract §2, §4.1).
 * The id is unique inside its order, like a line id and for the same reason: the
 * record is reached through the order's path, `DELETE /orders/:id/audit/:entryId`.
 *
 * The order was the first to need this and is no longer the only one: `id` now
 * lives on `StockAuditEntry` itself, so all nine entities are addressed alike.
 * Declaring it again here would say the order's identity is its own rule; it is
 * not, it is the rule.
 */
export interface OrderAuditEntry extends StockAuditEntry {
  /**
   * What the entry gives away, if anything — for the rights in §5.
   *
   * A manual cost and a cost correction record the unit cost as a plain figure,
   * and the history table renders every entry it is given. Cost and margin are
   * withheld from a user without `seeCost` in every other place on the card and
   * were readable here: the same right, defeated by a different road.
   *
   * The entry has to say so itself. `property` is translated into three
   * languages, so recognising a cost entry by its words is not a rule; and the
   * caption on the value would still be a guess. Present always with `null`
   * rather than sometimes absent — §3, on the uniformity of the answer.
   */
  sensitive: 'cost' | null
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
