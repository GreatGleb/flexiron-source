import type {
  Order,
  OrderListItem,
  OrderItem,
  OrderLineAllocation,
  OrderService,
  OrderFile,
  OrderStatus,
  OrderDocumentType,
  Shipment,
  Invoice,
  Payment,
  InvoiceKind,
  PaymentPurpose,
  ShippableLine,
  ShipmentShortage,
  StatusTransitionPlan,
  SalesCrmStats,
  OrderAuditEntry,
  LineEditEnvelope,
} from '@/types/order'
import type { CostSource } from '@/types/order'
import type { StockReservation } from '@/types/warehouse'
import type { PaginatedResponse, PaginationParams } from '@/types/api'
import {
  type PricingLine,
  calcLine,
  round2,
  roundStored,
  rollupOrder,
  validateLine,
  paidPercent,
  outstandingAmount,
  allocateGrossTotal,
  netToGross,
  grossToNet,
  splitLine as splitPricingLine,
  applyPriceEdit,
  applyDiscountEdit,
  applyCorrection,
  applyCostCorrection,
  canEditPrice,
  formatCents,
  isCostFrozen,
  computeAvailable,
  syncLineState,
} from '@/domain/orderPricing'
import {
  baseCurrencyOf,
  buildOrderItem as buildItem,
  buildOrderService as buildService,
  toPricingLine,
  applyPricing,
  projectItem,
  projectService,
  pricingSeedFor,
  marginFor,
  splitAllocations,
  stockCostFor,
} from '@/services/orderLines'
import {
  applyLineEdit,
  canDeleteLine,
  deltaToOps,
  type LineEditContext,
  type LineEditDelta,
} from '@/services/orderLineEdits'

/**
 * The body of one line edit as it arrives — the edit itself plus the envelope
 * around it. Same type `ordersService` sends under the name `LineEditPayload`;
 * spelled out here rather than imported so the reference implementation of the
 * server does not depend on the client that talks to it.
 */
type LineEditPayload = LineEditDelta & LineEditEnvelope
import {
  findReservations,
  holdOnBatch,
  releaseFromLine,
  releaseFromLineOnBatches,
  releaseLine,
  releaseOrder,
  reservedForLine,
  reservedForLineOnBatch,
  reservedOn,
} from './reservations'
import { mockGetClients, registerClientOrderLookup } from './clients'
import { shiftDemoDate } from './demoClock'
import { mockGetSettings } from './settings'
import { STORE as PRODUCTS_STORE, registerProductSalesLookup } from './products'
import { compareDocumentNumbers } from '@/services/documentNumbers'
import {
  batchById,
  batchesForProduct,
  clearShortages,
  mockFifoAllocation,
  mockGetMovementsFor,
  recordShortage,
  writeMovement,
} from './warehouse'
import { allServices, serviceById } from './services'

interface StoreOrder extends Order {
  /**
   * Always a number in the store, even though the wire type calls it optional —
   * absent there means "the client never read one", which is a statement only a
   * request can make.
   */
  version: number
  _nextLineSeq: number
  _nextServiceSeq: number
  _nextShipmentSeq: number
  _nextInvoiceSeq: number
  _nextPaymentSeq: number
  /**
   * Numbers the history entries. Counts entries ever written, not entries held:
   * a counter derived from `auditLog.length` would hand a deleted entry's name
   * to the next one written, and a deletion aimed at the first would land on the
   * second (§2, the ids are unique inside the order).
   */
  _nextAuditSeq: number
  /** Scenario setup: a payment sized as a share of the total, known only after the rollup. */
  _pendingAdvanceShare?: number
  /** Scenario setup: issue an invoice for this shipment once the prices are projected. */
  _pendingInvoiceForShipment?: string
  /**
   * Scenario setup: shipments to create for real once the store exists.
   *
   * A shipment object pushed straight onto the order would say the goods left
   * while the shelf still held them — the demo would contradict the one rule the
   * warehouse runs on.
   */
  _pendingShipments?: Array<{
    lines: Array<{ lineId: string; quantity: number }>
    carrier?: string | null
    vehicle?: string | null
    shippedAt?: string
  }>
}

function orderPricingLines(order: StoreOrder): PricingLine[] {
  return [...order.items, ...order.services].map(toPricingLine)
}

/**
 * Single place where an order's derived numbers are produced. Everything here is
 * computed — nothing is trusted from the caller.
 */
function recalcOrder(order: StoreOrder): void {
  order.items.forEach(projectItem)
  order.services.forEach(projectService)

  const lines = orderPricingLines(order)
  // Bad data fails at the door instead of quietly becoming wrong money.
  lines.forEach(validateLine)

  // Lines are addressed by id (allocation, shipments, invoices), so a duplicate
  // would quietly send money or goods to the wrong place.
  const ids = new Set<string>()
  for (const line of lines) {
    if (ids.has(line.id)) throw new Error(`DUPLICATE_LINE_ID: ${line.id}`)
    ids.add(line.id)
  }

  // A breakdown can cover less than the line (a shortage priced as an estimate)
  // but never more — that would write off stock the order never asked for.
  for (const item of order.items) {
    const allocated = round2(item.allocations.reduce((sum, a) => sum + a.quantity, 0))
    if (allocated > item.quantity) {
      throw new Error(`ALLOCATION_EXCEEDS_QUANTITY: ${item.id}`)
    }
  }

  const totals = rollupOrder(lines, order.vatMode, order.vatPercent)
  order.totalCost = totals.totalCost
  order.totalAmount = totals.totalNet
  order.totalVat = totals.totalVat
  order.totalWithVat = totals.totalGross
  order.actualMarginPercent = totals.actualMarginPercent
  order.effectiveDiscountPercent = totals.effectiveDiscountPercent

  const amounts = order.payments.map((p) => p.amount)
  order.paidAmount = round2(amounts.reduce((sum, a) => sum + a, 0))
  order.paidPercent = paidPercent(order.totalWithVat, amounts)
  order.outstandingAmount = outstandingAmount(order.totalWithVat, amounts)

  // Weight only from lines that actually carry one. No product has a weight yet,
  // so in practice this leaves the hand-entered value alone — which beats the
  // invented "quantity × 0.5" it replaces.
  const weighed = order.items.filter((i) => i.weightPerUnitKg !== null)
  if (weighed.length > 0) {
    order.totalWeight = round2(
      weighed.reduce((sum, i) => sum + i.quantity * (i.weightPerUnitKg ?? 0), 0),
    )
  }
}

/**
 * Share of the order that has left the warehouse, measured in money.
 *
 * Quantities cannot be summed across lines — pieces, tonnes and metres are not
 * the same thing, and adding them gives a number that means nothing. Money is
 * the one unit every line shares.
 */
function shippedPercentOf(order: StoreOrder): number {
  const ordered = order.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
  if (ordered <= 0) return 0
  const shipped = order.items.reduce((sum, i) => sum + i.shippedQuantity * i.unitPrice, 0)
  return round2((shipped / ordered) * 100)
}

// ─── Reservations ───────────────────────────────────────────────────────────
// The store itself lives in `./reservations` — the warehouse has to subtract
// reservations to show what is available, and neither module can import the other.

export function mockGetReservations(filter?: {
  orderId?: string
  batchId?: string
  lineId?: string
}): StockReservation[] {
  return findReservations(filter).map((r) => ({ ...r }))
}

/** What every order has promised itself out of this batch. */
export function mockReservedQuantity(batchId: string): number {
  return reservedOn(batchId)
}

// ── Product catalog for generating realistic line items ────────────────────
interface ProductSpec {
  id: string
  name: string
  unit: string
  price: number
}

/**
 * Mulberry32 — a simple seeded PRNG that produces deterministic output
 * for the same seed value.
 */
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Quantity for a generated line.
 *
 * Ordering more than the shelf holds is NOT a lie — that is ordinary trade, and the
 * deficit report exists for it. The lie was the seeded shipment claiming to have
 * moved goods nobody had, and that is fixed where shipments are created: every one
 * of them now goes through the write-off and takes only what is there.
 *
 * What is left is a question of proportion. Forty-odd generated orders drawing on
 * the same batches at 10–500 units each empty the warehouse the demo exists to
 * show, and then nothing can be shipped, reserved or costed off a batch anywhere.
 * So the FILLER orders take a slice of what is really on the shelf.
 *
 * The nine hand-built scenarios take the same slice, and they especially need to:
 * each one is a story about goods moving — a truck that took part of a line, two
 * trucks against one order — and a scenario whose quantities the shelf cannot back
 * simply does not happen. They used to be exempt so that one order came to a
 * figure quoted in the plans; the figure is not worth a demo that cannot ship.
 */
function generatedQuantity(prod: ProductSpec, rng: () => number): number {
  const fractional = prod.unit === 'kg' || prod.unit === 'm'
  const invented = fractional
    ? Math.round((10 + rng() * 490) * 10) / 10
    : 1 + Math.floor(rng() * 50)
  const round = (value: number) =>
    fractional ? Math.max(0.1, Math.round(value * 10) / 10) : Math.max(1, Math.floor(value))

  // Sized by money as well as by the shelf. A quantity drawn from 1–50 without
  // looking at the price put forty overhead cranes at 185 000 apiece on one order
  // and reported it as a two-million-euro sale; nobody places that order, and a
  // demo that says otherwise teaches the reader to distrust the figures.
  const affordable = prod.price > 0 ? Math.max(1, Math.floor(LINE_BUDGET / prod.price)) : invented
  const wanted = Math.min(invented, affordable)

  const onShelf = batchesForProduct(prod.id).reduce((sum, b) => sum + b.quantityRemaining, 0)
  if (onShelf <= 0) return round(wanted)
  return round(Math.min(wanted, onShelf * (0.02 + rng() * 0.08)))
}

/** Roughly what one generated line is worth. Demo proportion, nothing more. */
const LINE_BUDGET = 25000

/**
 * The products the demo trades in — read from the catalogue, not copied.
 *
 * The copy that used to sit here listed thirty products with their own names and
 * their own prices, and the ids meant different things in the two lists: prod-007
 * was "Rebar 12mm" at 0,85 here and "Angle Grinder 125mm" at 89,00 in the
 * catalogue. Lines were priced from this list and costed from the warehouse, and
 * the two had never heard of each other — which is where margins of −91% and
 * +2 106% came from, and why one demo line in six was sold below cost.
 */
function catalogueProducts(): ProductSpec[] {
  return PRODUCTS_STORE.filter((p) => p.price != null && p.price > 0).map((p) => ({
    id: p.id,
    name: p.name?.en ?? p.id,
    // 'uom-pcs' → 'pcs'; the table and the pickers label units by this code.
    unit: (p.saleUomId ?? p.warehouseUomId ?? 'uom-pcs').replace(/^uom-/, ''),
    price: p.price as number,
  }))
}

const PRODUCTS: ProductSpec[] = catalogueProducts()

/**
 * The service catalogue, read live — see `serviceById`.
 *
 * There is no copy of it here on purpose. The copy that used to live in this file
 * knew five services and fell back to the first of them for anything else, so a
 * service created later came into an order under someone else's name and someone
 * else's cost, and a cost corrected in the services page never arrived at all.
 */
/**
 * The language the catalogue is kept in, and the only one the server writes in.
 *
 * `productName` and `serviceName` on a line are a snapshot: what this thing was
 * called at the moment it entered the order, kept so a later rename of the
 * catalogue cannot rewrite a document that has already gone out. A snapshot has
 * to be one thing, and it was three — the server read `flexiron_lang` out of the
 * browser and wrote whichever language the admin who typed happened to be
 * reading, so one product sat in one order twice, as "Электроды ESAB OK 48.00
 * 4мм" and as "ESAB OK 48.00 Elektrodai 4mm", forever (contract §4.2).
 *
 * It is also code a backend cannot run: a server has no `localStorage` and no
 * reader, so there is no language there to pick up. The choice belongs to the
 * catalogue, is made once, and the reader's language is applied where reading
 * happens — in the interface, off the catalogue, and never onto the record.
 */
const CATALOGUE_LANGUAGE = 'en' as const

function serviceEntry(id: string): { name: string; cost: number; price: number } {
  const svc = serviceById(id)
  // Named so it is not a substring of `ORDER_SERVICE_NOT_FOUND`: the frontend
  // matches error codes by substring (§6), so "the service is not in the
  // catalogue" and "this order has no such service line" would read as one.
  if (!svc) throw new Error('CATALOG_SERVICE_NOT_FOUND')
  return {
    name: svc.name[CATALOGUE_LANGUAGE] ?? svc.name.en,
    cost: svc.costPrice,
    price: svc.sellingPrice,
  }
}

// ── Generate 100 realistic orders (deterministic — same seed = same data) ────
const TOTAL_ORDERS = 100

function generateOrders(): StoreOrder[] {
  const clients = mockGetClients()
  const orders: StoreOrder[] = []
  const allStatuses: OrderStatus[] = [
    'new',
    'confirmed',
    'picking',
    'packing',
    'shipped',
    'delivered',
    'paid',
    'cancelled',
  ]
  const statusWeights = [0.08, 0.1, 0.1, 0.08, 0.2, 0.28, 0.08, 0.08]

  for (let i = 0; i < TOTAL_ORDERS; i++) {
    const seq = String(i + 1).padStart(3, '0')
    const client = clients[i % clients.length]!
    const docType: OrderDocumentType = i % 2 === 0 ? 'local' : 'export'

    // Seeded PRNG — every order index always produces the same "random" values
    const rng = mulberry32(i * 9973 + 1)

    // Weighted random status
    const totalW = statusWeights.reduce((s, w) => s + w, 0)
    let r = rng() * totalW
    let statusIdx = 0
    for (let si = 0; si < statusWeights.length; si++) {
      r -= statusWeights[si]!
      if (r <= 0) {
        statusIdx = si
        break
      }
    }
    const status = allStatuses[statusIdx]!

    // 1–4 line items
    const itemCount = 1 + Math.floor(rng() * 4)
    const usedIds = new Set<string>()
    const items: OrderItem[] = []
    for (let j = 0; j < itemCount; j++) {
      let prod = PRODUCTS[Math.floor(rng() * PRODUCTS.length)]!
      let attempts = 0
      while (usedIds.has(prod.id) && attempts < 30) {
        prod = PRODUCTS[Math.floor(rng() * PRODUCTS.length)]!
        attempts++
      }
      usedIds.add(prod.id)

      const fullProd = PRODUCTS_STORE.find((p) => p.id === prod.id)
      // The first nine are the hand-built scenarios — see `applyScenario`.
      const qty = generatedQuantity(prod, rng)
      const discount = rng() < 0.15 ? Math.round(rng() * 15) : 0
      const costRatio = 0.6 + rng() * 0.25 // 60–85% of selling price
      // Costed off the warehouse, oldest batches first — and carrying the
      // breakdown, because a line with no batches behind it cannot ship, and a
      // cost of "catalogue price × a ratio" is exactly the invented number the
      // model refuses. A product the warehouse does not stock keeps the seeded
      // figure and says it is an estimate.
      const fifo = mockFifoAllocation(prod.id, qty)
      const fromStock = fifo.weightedUnitCost > 0
      // Partial coverage is kept, not discarded: the warehouse rarely holds a
      // whole order, and the part it does hold has real batches behind it and can
      // really be shipped. Only the gap is an estimate.
      const unitCost = fromStock
        ? round2(fifo.weightedUnitCost)
        : Math.round(prod.price * costRatio * 100) / 100

      // The price stays the catalogue price; the margin is whatever gets there
      // from the real cost.
      items.push(
        buildItem({
          id: `oi-${i * 20 + j}`,
          lineNumber: j + 1,
          productId: prod.id,
          productName: fullProd?.name?.[CATALOGUE_LANGUAGE] ?? fullProd?.name?.en ?? prod.name,
          quantity: qty,
          unit: prod.unit,
          unitCost,
          costSource: fifo.shortageQuantity > 0 || !fromStock ? 'estimate' : 'stock',
          allocations: fromStock
            ? fifo.allocations.map((a) => ({
                batchId: a.batchId,
                offcutId: a.offcutId,
                quantity: a.quantity,
                unitCost: a.unitCost,
                currency: a.currency,
                source: a.source,
              }))
            : undefined,
          ...pricingSeedFor(unitCost, prod.price),
          discountPercent: discount,
          receivedCurrency: baseCurrencyOf(mockGetSettings()),
        }),
      )
    }

    // 0–1 services (30% chance)
    const services: OrderService[] = []
    const catalogue = allServices()
    if (rng() < 0.3 && catalogue.length > 0) {
      const picked = catalogue[Math.floor(rng() * catalogue.length)]!
      const svc = serviceEntry(picked.id)
      services.push(
        buildService({
          id: `os-${i * 10}`,
          serviceId: picked.id,
          serviceName: svc.name,
          quantity: 1,
          unitCost: svc.cost,
          ...pricingSeedFor(svc.cost, svc.price),
        }),
      )
    }

    // Weight is entered by hand until products carry one — see recalcOrder.
    const totalWeight = 0

    // Half a year of trading, ending on the day the demo is opened — see
    // `demoClock`. Written as a fixed calendar it went stale on its own, and a
    // dashboard whose month-to-date numbers are permanently zero teaches the
    // reader that the numbers are broken.
    const dayOffset = Math.floor((i / TOTAL_ORDERS) * 180)
    const orderDate = shiftDemoDate(
      new Date(2026, 0, 1 + dayOffset, 8 + Math.floor(rng() * 10), Math.floor(rng() * 60)),
    )
    const createdAt = orderDate.toISOString()

    const updatedOffset =
      status === 'delivered' || status === 'shipped'
        ? dayOffset + 1 + Math.floor(rng() * 5)
        : dayOffset
    const updatedDate = shiftDemoDate(
      new Date(
        2026,
        0,
        1 + Math.min(updatedOffset, 180),
        8 + Math.floor(rng() * 10),
        Math.floor(rng() * 60),
      ),
    )
    const updatedAt = updatedDate.toISOString()

    // Written the way the endpoints write it: an id of its own on every entry,
    // and the same full ISO-8601 stamp the order's own dates carry — the demo
    // store is held to the rules the API is held to, or it is not a demo of it.
    const auditLog: OrderAuditEntry[] = [
      {
        id: 'au-1',
        timestamp: createdAt,
        user: { ru: 'Система', en: 'System', lt: 'Sistema' },
        userInitials: 'SY',
        property: { ru: 'Заказ создан', en: 'Order created', lt: 'Užsakymas sukurtas' },
        oldValue: '',
        newValue: `ORD-2026-${seq}`,
        sensitive: null,
      },
    ]
    if (status !== 'new') {
      auditLog.push({
        id: 'au-2',
        timestamp: updatedAt,
        user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
        userInitials: 'IN',
        property: { ru: 'Статус', en: 'Status', lt: 'Būsena' },
        oldValue: 'new',
        newValue: status,
        sensitive: null,
      })
    }

    const notesPool: Array<string | null> = [
      null,
      null,
      null,
      null,
      'Urgent — priority processing',
      'Export documentation required',
      'Delivery to construction site required',
      'Quality certificate needed',
      'Weekend delivery requested',
      'Partial delivery allowed',
      'Consolidate with next week order',
      null,
      null,
      null,
    ]
    const note = notesPool[Math.floor(rng() * notesPool.length)]!

    const order: StoreOrder = {
      id: `ORD-${seq}`,
      orderNumber: `ORD-2026-${seq}`,
      clientId: client.id,
      clientName: client.name,
      clientVatCode: client.vatCode,
      clientAddress: client.address,
      documentType: docType,
      status,
      items,
      services,
      defaultMarginPercent: mockGetSettings().constants.defaultMargin,
      defaultDiscountPercent: 0,
      vatMode: 'standard',
      vatPercent: 21,
      currency: 'EUR',
      totalCost: 0,
      totalAmount: 0,
      totalVat: 0,
      totalWithVat: 0,
      actualMarginPercent: 0,
      effectiveDiscountPercent: 0,
      paidAmount: 0,
      paidPercent: 0,
      outstandingAmount: 0,
      totalWeight,
      shipments: [],
      invoices: [],
      payments: [],
      notes: note,
      documents: [],
      files: [],
      auditLog,
      createdAt,
      updatedAt,
      // Where every order starts. The generator writes to it below through the
      // ordinary paths, so a freshly generated order does not claim to be
      // untouched.
      version: 1,
      _nextLineSeq: items.length + 1,
      _nextServiceSeq: services.length + 1,
      _nextShipmentSeq: 1,
      _nextInvoiceSeq: 1,
      _nextPaymentSeq: 1,
      _nextAuditSeq: auditLog.length + 1,
    }

    applyScenario(order, i)
    if (i >= 9) makeStatusConsistent(order)
    recalcOrder(order)
    // Payments and invoices are sized from the total, so they need a second pass.
    resolvePendingScenario(order)
    recalcOrder(order)
    // Only now are the real amounts known, so the status can follow the facts.
    if (i < 9) order.status = statusFromFacts(order)
    orders.push(order)
  }

  return orders
}

/**
 * The first orders get fixed, hand-built situations so every case in the model
 * can be opened by number. The store lives in memory and resets on reload, so
 * building these by hand each time is not an option.
 */
const SCENARIOS: Record<number, string> = {
  0: 'plain — nothing edited',
  1: 'order-wide discount of 5%',
  2: 'manual price on the first line only',
  3: 'partially shipped: 6 of 10 gone',
  4: '25% advance paid',
  5: 'paid in full',
  6: 'manual cost with a reason',
  7: 'export — VAT 0%',
  8: 'two shipments, an invoice and a part payment',
  // ORD-100 — built after the store exists, through the endpoints. See
  // `buildShowcaseOrder`: this entry only gives it a name in the scenario list.
  99: 'the full picture — every state the module can show',
}

export function mockOrderScenarios(): Array<{ id: string; scenario: string }> {
  return Object.entries(SCENARIOS).map(([index, scenario]) => ({
    id: `ORD-${String(Number(index) + 1).padStart(3, '0')}`,
    scenario,
  }))
}

/**
 * Backs a randomly chosen status with facts.
 *
 * 'shipped' and 'delivered' are statements about goods, so they need a shipment
 * — otherwise the list shows "Delivered" next to "0% shipped" and nobody trusts
 * the data again. 'paid' is a statement about money only: paying in full before
 * anything leaves the warehouse is an ordinary prepayment, not a contradiction.
 */
function makeStatusConsistent(order: StoreOrder): void {
  if (!order.items.length) return

  if (order.status === 'shipped' || order.status === 'delivered') {
    // RECORDED, not performed — the same mechanism the hand-built scenarios use.
    // A shipment object pushed straight onto the order says the goods left while
    // the shelf still holds them, and the demo then contradicts the one rule the
    // warehouse runs on. What the shelf cannot back simply does not go, and the
    // status follows the facts afterwards: a demo warehouse holding 5 units cannot
    // send 1500, and pretending otherwise is the falsehood, not the empty truck.
    order._pendingShipments = [
      {
        lines: order.items.map((i) => ({ lineId: i.id, quantity: i.quantity })),
        carrier: 'Own transport',
        shippedAt: order.updatedAt,
      },
    ]
  }

  if (order.status === 'paid') {
    order.payments.push({
      id: `${order.id}-PAY-1`,
      orderId: order.id,
      amount: 0,
      paidAt: order.updatedAt,
      purpose: 'balance',
      invoiceId: null,
      note: null,
    })
    order._nextPaymentSeq = 2
    order._pendingAdvanceShare = 1
  }
}

/**
 * The other direction, for the hand-built scenarios: their facts are the point,
 * so the status follows them instead of the other way round.
 */
function statusFromFacts(order: StoreOrder): OrderStatus {
  if (order.status === 'cancelled') return 'cancelled'
  // Paid in full outranks the rest: a fully prepaid order that has not shipped
  // yet is still a paid order.
  if (order.paidPercent >= 100) return 'paid'

  const shipped = order.items.reduce((sum, i) => sum + i.shippedQuantity, 0)
  const ordered = order.items.reduce((sum, i) => sum + i.quantity, 0)

  if (shipped <= 0) return order.payments.length > 0 ? 'confirmed' : 'new'
  if (shipped < ordered) return 'shipped'
  return 'delivered'
}

function resolvePendingScenario(order: StoreOrder): void {
  const share = order._pendingAdvanceShare
  if (share !== undefined) {
    const amount = round2(order.totalWithVat * share)
    order.payments.forEach((p) => {
      if (p.amount === 0) p.amount = amount
    })
    delete order._pendingAdvanceShare
  }

  issuePendingInvoice(order)
}

/**
 * Issues the scenario's invoice for its first real shipment.
 *
 * Split out because an invoice is issued FOR a shipment, and the seeded shipments
 * only become real once the store exists — until then there is nothing to invoice.
 */
function issuePendingInvoice(order: StoreOrder): void {
  if (!order._pendingInvoiceForShipment) return
  const shipment = order.shipments[0]
  if (!shipment) return
  // Through the same path an admin's invoice takes. Pushing the record directly
  // would skip the freeze it puts on the lines it covers, and the demo would show
  // a freely editable line against a document the client is holding — the same
  // trap the seeded shipments fell into before they were made real.
  mockCreateInvoice(order.id, { kind: 'regular', shipmentId: shipment.id })
  const issued = order.invoices[order.invoices.length - 1]
  // Dated with the delivery, not with page load: the panel sorts by this.
  if (issued) issued.issuedAt = shipment.shippedAt
  delete order._pendingInvoiceForShipment
}

function applyScenario(order: StoreOrder, index: number): void {
  const first = order.items[0]
  if (!first) return

  switch (index) {
    // ORD-001 — plain order, nothing edited. Left as generated.
    case 0:
      order.items.forEach((i) => {
        i.discountPercent = 0
      })
      return

    // ORD-002 — one discount agreed for the whole order.
    case 1:
      order.defaultDiscountPercent = 5
      order.items.forEach((i) => applyPricing(i, applyDiscountEdit(toPricingLine(i), 5)))
      order.services.forEach((s) => applyPricing(s, applyDiscountEdit(toPricingLine(s), 5)))
      return

    // ORD-003 — the admin typed a price on the first line only.
    case 2:
      applyPricing(first, applyPriceEdit(toPricingLine(first), round2(first.unitCost * 1.1)))
      return

    // ORD-004 — the first truck took part of the first line.
    case 3: {
      const shippedQty = round2(first.quantity * 0.6)
      if (shippedQty <= 0 || shippedQty >= first.quantity) return
      // Recorded, not performed: a seeded shipment object would say goods left
      // while the shelf still held them, and a shipment is the only thing that
      // moves the warehouse. The real one is created once the store exists.
      order._pendingShipments = [
        {
          lines: [{ lineId: first.id, quantity: shippedQty }],
          carrier: 'Own transport',
          vehicle: 'ABC-123',
          shippedAt: order.updatedAt,
        },
      ]
      order.status = 'shipped'
      return
    }

    // ORD-005 — a quarter paid up front. The percentage is never stored.
    case 4:
      order.payments.push({
        id: `${order.id}-PAY-1`,
        orderId: order.id,
        amount: 0, // filled in below, once the total is known
        paidAt: order.createdAt,
        purpose: 'advance',
        invoiceId: null,
        note: 'Advance 25%',
      })
      order._nextPaymentSeq = 2
      // The total is not computed yet, so the amount is set after the rollup.
      order._pendingAdvanceShare = 0.25
      return

    // ORD-006 — paid in full.
    case 5:
      order.status = 'paid'
      order.payments.push({
        id: `${order.id}-PAY-1`,
        orderId: order.id,
        amount: 0,
        paidAt: order.updatedAt,
        purpose: 'balance',
        invoiceId: null,
        note: 'Paid in full',
      })
      order._nextPaymentSeq = 2
      order._pendingAdvanceShare = 1
      return

    // ORD-007 — the batch was not booked in yet, so the cost was typed by hand.
    //
    // Through the very edit `PATCH /items/:id` runs, not by assignment: a cost
    // written straight onto the line leaves the price behind on the old figure,
    // and the demo then shows a line whose stated margin does not produce its own
    // price. Scenario data is held to the model like everything else — one rule,
    // one path, here as well.
    case 6:
      applyLineEdit(
        first,
        {
          field: 'unitCost',
          value: round2(first.unitCost * 1.08),
          reason: 'Batch not booked in — supplier invoice price used',
        },
        { defaultDiscountPercent: order.defaultDiscountPercent },
      )
      // Nothing was booked in, so there is no batch breakdown behind this cost.
      first.allocations = []
      return

    // ORD-008 — export, zero-rated.
    case 7:
      order.documentType = 'export'
      order.vatMode = 'export_zero'
      return

    // ORD-009 — the full story: two trucks, an invoice, a part payment.
    case 8: {
      // Chosen by what the shelf can back, not by position: this scenario is a
      // story about two trucks, and a line the warehouse has never stocked cannot
      // be on either of them. Picked blindly, it put an overhead crane nobody
      // holds on the second truck and the scenario quietly became a one-truck one.
      const canShip = order.items.filter((i) => i.allocations.length > 0)
      if (canShip.length === 0) return
      if (canShip.length < 2) {
        const template = canShip[0]!
        const quantity = 4
        const fifo = mockFifoAllocation(template.productId, quantity)
        if (fifo.allocations.length === 0) return
        const extra = buildItem({
          id: `${order.id}-oi-extra`,
          lineNumber: order.items.length + 1,
          productId: template.productId,
          productName: template.productName,
          quantity,
          unit: template.unit,
          unitCost: round2(fifo.weightedUnitCost),
          marginPercent: template.marginPercent,
          receivedCurrency: template.receivedCurrency,
          allocations: fifo.allocations.map((a) => ({
            batchId: a.batchId,
            offcutId: a.offcutId,
            quantity: a.quantity,
            unitCost: a.unitCost,
            currency: a.currency,
            source: a.source,
          })),
        })
        order.items.push(extra)
        canShip.push(extra)
        order._nextLineSeq = order.items.length + 1
      }
      const [lineA, lineB] = [canShip[0]!, canShip[1]!]
      // Nothing is marked as invoiced here: the invoice below does that, and only
      // if its truck really goes. A flag set by hand would claim a document the
      // scenario failed to issue.
      order.status = 'shipped'
      // Two trucks, created for real once the store exists — see `_pendingShipments`.
      order._pendingShipments = [
        {
          lines: [{ lineId: lineA.id, quantity: lineA.quantity }],
          carrier: 'Own transport',
          vehicle: 'ABC-123',
          shippedAt: order.createdAt,
        },
        {
          lines: [{ lineId: lineB.id, quantity: round2(lineB.quantity / 2) }],
          carrier: 'Hired carrier',
          vehicle: 'XYZ-987',
          shippedAt: order.updatedAt,
        },
      ]
      order.payments.push({
        id: `${order.id}-PAY-1`,
        orderId: order.id,
        amount: 0,
        paidAt: order.updatedAt,
        purpose: 'advance',
        invoiceId: null,
        note: 'Part payment',
      })
      order._nextPaymentSeq = 2
      order._pendingAdvanceShare = 0.4
      order._pendingInvoiceForShipment = `${order.id}-SHP-1`
      return
    }

    default:
      return
  }
}

const STORE: StoreOrder[] = generateOrders()

/**
 * Turns the scenarios' intended shipments into real ones.
 *
 * Runs after the store exists, because a shipment goes through the same code an
 * admin's does — that is the point. Seeding a shipment object directly would put
 * "shipped" on the order while the warehouse still held the goods, and the demo
 * would contradict the rule the whole warehouse runs on.
 *
 * A shipment the shelf cannot back is skipped rather than thrown: this runs while
 * the module is loading, and a demo order that is one truck short beats an
 * application that will not start.
 */
function createScenarioShipments(): void {
  for (const order of STORE) {
    const pending = order._pendingShipments
    if (!pending) continue
    delete order._pendingShipments
    for (const shipment of pending) {
      // Cut to what the shelf can actually back. Demo data is written against
      // quantities somebody made up; the warehouse is the one that decides.
      const shippable = new Map(
        mockPlanOrderShipment(order.id).map((line) => [line.lineId, line.shippable]),
      )
      const lines = shipment.lines
        .map((line) => ({
          lineId: line.lineId,
          quantity: round2(Math.min(line.quantity, shippable.get(line.lineId) ?? 0)),
        }))
        .filter((line) => line.quantity > 0)
      if (lines.length === 0) continue
      try {
        mockCreateShipment(order.id, { ...shipment, lines })
      } catch {
        // The shelf moved under us; this seeded truck simply does not go.
      }
    }
    // Only now is there a shipment to invoice.
    issuePendingInvoice(order)
    // The scenario said what the order should look like; the facts now say it.
    order.status = statusFromFacts(order)
  }
}

createScenarioShipments()

/**
 * ORD-100 — the order that shows everything.
 *
 * The list opens on it (newest first), so it is the first thing anybody sees, and
 * the demo is worth more if that first order exercises every state the module can
 * express rather than being two plain lines. What it carries: a line shipped and
 * invoiced, a line half gone, a hand-priced line, a hand-costed line with its
 * reason, a line the shelf cannot cover, a service already billed and a service
 * that is not, three deliveries of which one came back, four documents including
 * a correction, three payments including a refund, held stock, files and a
 * history that wrote itself.
 *
 * Built by CALLING THE ENDPOINTS, never by assembling objects. That is the same
 * rule the hand-built scenarios follow and it is the whole point: a demo assembled
 * by hand says goods left while the shelf still holds them, prices that no margin
 * produces, and invoices whose amount no delivery backs. Everything below goes
 * through the code an admin's click goes through, so every figure on the screen is
 * one the application really computed.
 *
 * Defensive throughout, like `createScenarioShipments`: this runs while the module
 * is loading, the shelf is shared with a hundred other orders, and a demo one
 * truck short beats an application that will not start.
 */
function buildShowcaseOrder(): void {
  const order = STORE.find((o) => o.id === SHOWCASE_ORDER_ID)
  if (!order) return

  // ── Clean ground ──────────────────────────────────────────────────────────
  // The generated content goes back where it came from: its holds to the shelf
  // and its shortages to the buying list. Dropping the lines without this would
  // leave both pointing at rows that no longer exist.
  releaseOrder(order.id)
  clearShortages({ orderId: order.id })
  order.items = []
  order.services = []
  order.shipments = []
  order.invoices = []
  order.payments = []
  order.files = []
  order.auditLog = []
  order._nextLineSeq = 1
  order._nextServiceSeq = 1
  order._nextShipmentSeq = 1
  order._nextInvoiceSeq = 1
  order._nextPaymentSeq = 1
  order._nextAuditSeq = 1
  order.status = 'confirmed'
  order.notes =
    'Showcase order — every state the module can show. Built through the endpoints, not seeded.'
  // No weight, deliberately. Products carry none, so an order's total weight is
  // hand-entered — and a seeded figure would be exactly the invention the store's
  // own spec forbids. A showcase is worth nothing if it decorates.
  order.defaultMarginPercent = 22
  order.defaultDiscountPercent = 5

  /** The goods this order trades in: real catalogue rows the shelf can back. */
  const pick = (id: string) => PRODUCTS.find((p) => p.id === id)
  const onShelf = (id: string) =>
    batchesForProduct(id).reduce((sum, b) => sum + b.quantityRemaining, 0)

  /** Adds a line only if the shelf can really cover it. */
  function addLine(productId: string, quantity: number, price?: number): OrderItem | null {
    const spec = pick(productId)
    if (!spec || onShelf(productId) < quantity) return null
    try {
      return mockAddOrderItem(order!.id, {
        productId,
        quantity,
        unit: spec.unit,
        unitPrice: price ?? spec.price,
      })
    } catch {
      return null
    }
  }

  // ── The lines ─────────────────────────────────────────────────────────────
  const shipped = addLine('prod-001', 12) // goes out whole, then gets invoiced
  const partial = addLine('prod-021', 40) // one truck takes part of it
  const handPriced = addLine('prod-107', 300) // a price agreed by hand
  const handCosted = addLine('prod-036', 60) // a cost typed by hand, with a reason
  const plain = addLine('prod-009', 8) // an ordinary draft line

  // An ordinary draft line, touched by nothing — the state the other five are
  // read against.
  addLine('prod-021', 5)

  // A line the warehouse cannot cover: the covered part is real, the rest is a
  // guess (`costSource: 'estimate'`) and goes on the buying list. Asking for more
  // than the shelf holds is the only way to produce that state honestly — which
  // means picking a product the shelf is genuinely short of rather than one with
  // no price, whose line would say nothing about cost at all.
  const short = PRODUCTS.find((p) => {
    const stock = onShelf(p.id)
    return stock > 0 && stock < 40
  })
  if (short) {
    try {
      mockAddOrderItem(order.id, {
        productId: short.id,
        quantity: round2(onShelf(short.id) + 25),
        unit: short.unit,
        unitPrice: short.price,
      })
    } catch {
      // The catalogue moved; the demo does without this one.
    }
  }

  // A price somebody named. Through the edit, so the discount it implies is the
  // one the model derives rather than a number written next to it.
  if (handPriced) {
    try {
      mockUpdateOrderItem(order.id, handPriced.id, {
        manualUnitPrice: round2(handPriced.unitPrice * 0.92),
      })
    } catch {
      /* refused — the line simply keeps its computed price */
    }
  }

  // A cost somebody typed, and the sentence that says why. The right is checked
  // by the endpoint, and the entry it writes is the first row of the history.
  if (handCosted) {
    try {
      mockUpdateOrderItem(order.id, handCosted.id, {
        manualUnitCost: round2(handCosted.unitCost * 1.15),
        manualCostReason: 'Batch not booked in yet — supplier invoice price used',
      })
    } catch {
      /* the acting role may not type costs; the line keeps the warehouse figure */
    }
  }

  if (plain) {
    try {
      mockUpdateOrderItem(order.id, plain.id, { discountPercent: 12 })
    } catch {
      /* out of range for this line — it stays at the order default */
    }
  }

  // ── Services ──────────────────────────────────────────────────────────────
  // The first two ride on the invoice below. The third is added AFTER it, which
  // is the case §4.6 exists for: a live order may gain a service, and it has to
  // be billable on a later document rather than stranded.
  const service = (serviceId: string, quantity: number, price: number) => {
    try {
      return mockAddOrderService(order!.id, { serviceId, quantity, price })
    } catch {
      return null
    }
  }
  service('svc-001', 6, 45)
  service('svc-002', 1, 180)

  // ── Deliveries ────────────────────────────────────────────────────────────
  const truck = (lines: Array<{ lineId: string; quantity: number }>, vehicle: string) => {
    const shippable = new Map(
      mockPlanOrderShipment(order!.id).map((line) => [line.lineId, line.shippable]),
    )
    const real = lines
      .map((l) => ({
        lineId: l.lineId,
        quantity: round2(Math.min(l.quantity, shippable.get(l.lineId) ?? 0)),
      }))
      .filter((l) => l.quantity > 0)
    if (real.length === 0) return null
    try {
      return mockCreateShipment(order!.id, { lines: real, carrier: 'Own transport', vehicle })
    } catch {
      return null
    }
  }

  const truck1 = shipped
    ? truck([{ lineId: shipped.id, quantity: shipped.quantity }], 'ABC-123')
    : null
  // Part of a line, so it lands in `partially_shipped` — the state that offers
  // the split, and the only one from which a remainder can be repriced.
  if (partial) truck([{ lineId: partial.id, quantity: 16 }], 'XYZ-987')
  // A third delivery that came back. Cancelled through the endpoint, so the goods
  // return by opposite movements instead of the record quietly disappearing.
  const truck3 = plain ? truck([{ lineId: plain.id, quantity: 3 }], 'LMN-456') : null
  if (truck3) {
    try {
      mockCancelShipment(order.id, truck3.id)
    } catch {
      /* it stays on the road */
    }
  }

  // ── Documents ─────────────────────────────────────────────────────────────
  // The regular invoice takes its amount off the delivery and carries the two
  // services that exist at this moment — which is what makes the third one below
  // an unbilled service rather than a duplicate.
  let regular: Invoice | null = null
  if (truck1) {
    try {
      regular = mockCreateInvoice(order.id, { kind: 'regular', shipmentId: truck1.id })
    } catch {
      /* the delivery is already billed */
    }
  }
  // Added after the document: the service §4.6 is about.
  service('svc-003', 2, 95)

  // A price put right after the client already held the document — the one door
  // through the freeze (§4.2.1). It writes the history entry with author, before,
  // after and reason, AND issues the correcting invoice for the difference, which
  // is why it comes before anything else that might correct that document: one
  // invoice is corrected once, and a rebate drawn by hand here simply took the
  // slot and left the line uncorrected with nothing to say so.
  if (shipped && regular) {
    try {
      mockCorrectOrderLine(order.id, shipped.id, {
        unitPrice: round2(shipped.unitPrice * 0.97),
        reason: 'Price agreed lower after the truck had left',
      })
    } catch {
      /* the acting role may not correct; the line keeps its price */
    }
  }

  try {
    mockCreateInvoice(order.id, { kind: 'advance', amountGross: 1500 })
  } catch {
    /* nothing to advance against */
  }

  // ── Money ─────────────────────────────────────────────────────────────────
  const pay = (amount: number, purpose: PaymentPurpose, note: string, invoiceId?: string) => {
    try {
      mockAddOrderPayment(order!.id, { amount, purpose, note, invoiceId: invoiceId ?? null })
    } catch {
      /* refused — the demo does without this record */
    }
  }
  pay(1500, 'advance', 'Advance against the proforma')
  pay(2000, 'balance', 'Part payment on the first delivery', regular?.id)
  // A refund is a negative amount, never a deleted payment: money that went back
  // is a fact, and facts are not removed from the record.
  pay(-120, 'refund', 'Rebate returned to the client')

  // ── Held stock, files ─────────────────────────────────────────────────────
  try {
    mockReserveOrder(order.id)
  } catch {
    /* nothing left to hold */
  }
  mockAddOrderFile(order.id, 'showcase-file-1', 'Signed order confirmation.pdf')
  mockAddOrderFile(order.id, 'showcase-file-2', 'Delivery photos.zip')

  recalcOrder(order)
  order.status = statusFromFacts(order)
}

/** The order the list opens on — see `buildShowcaseOrder`. */
const SHOWCASE_ORDER_ID = 'ORD-100'

// "Can this client be deleted?" is a question about orders, so the orders module
// answers it. Registered rather than imported the other way round: clients know
// nothing about orders, and a cycle here would decide at import time whether the
// demo store exists.
registerClientOrderLookup((clientId) =>
  STORE.filter((o) => o.clientId === clientId).map((o) => ({ id: o.id })),
)

// "What did this product actually sell for?" is a question about orders too, and
// it is answered the same way — the catalogue asks, it does not import.
//
// Only what SHIPPED counts, and only from orders that were not cancelled: an
// average sale price built from what was merely ordered would move every time
// somebody drafts a line and abandons it. The net is recomputed for the shipped
// quantity rather than taken from the line total, because a partly shipped line
// bills the part that left, not the whole.
registerProductSalesLookup((productId) => {
  let quantity = 0
  let net = 0
  for (const order of STORE) {
    if (order.status === 'cancelled') continue
    for (const item of order.items) {
      if (item.productId !== productId || item.shippedQuantity <= 0) continue
      quantity = round2(quantity + item.shippedQuantity)
      net = round2(
        net + calcLine({ ...toPricingLine(item), quantity: item.shippedQuantity }).lineNet,
      )
    }
  }
  return quantity > 0 ? { quantity, net } : null
})

let nextSeq = TOTAL_ORDERS + 1

function nextId(): string {
  return `ORD-${String(nextSeq++).padStart(3, '0')}`
}

function clone<T>(data: T): T {
  return JSON.parse(JSON.stringify(data))
}

/**
 * Strips the store's own bookkeeping — a real server would not send it — and
 * adds back the one thing that is computed rather than kept: what the shelf
 * would give each goods line next.
 */
function publicOrder(order: StoreOrder): Order {
  const copy = clone(order) as StoreOrder & Record<string, unknown>
  for (const key of Object.keys(copy)) {
    if (key.startsWith('_')) delete copy[key]
  }
  copy.costTopUp = Object.fromEntries(order.items.map((i) => [i.id, topUpLadder(order, i)]))
  // A history entry that names a cost is a cost, and §5 says the server does not
  // send one to a user who may not see it. Hiding it in the card would be the
  // curtain the contract calls out by name — the card hides it too, but that is
  // the second lock, not the first.
  //
  // Everything else §5 asks for — `unitCost`, `costSource`, `allocations`,
  // `marginPercent` on the lines — is still sent to everyone, deliberately: the
  // card recomputes prices from the cost, and stripping those needs the other
  // half of §5 (the server sending computed prices, the card ceasing to compute)
  // which is not built. The history has no such tie: nothing is derived from it.
  if (!maySeeCost()) {
    copy.auditLog = copy.auditLog.filter((entry) => entry.sensitive !== 'cost')
  }
  return copy as Order
}

/** The `seeCost` right of whoever is asking — model §12, contract §5. */
function maySeeCost(): boolean {
  const settings = mockGetSettings()
  return (settings.orderPermissions.seeCost ?? []).includes(settings.profile.role)
}

// ─── List ───

/**
 * The columns the list can be ordered by — the ones the user actually sees.
 *
 * A key outside this set is refused rather than ignored. `default: return 0` is
 * how it used to end, and that answers a request nobody made: `totalCost` (a
 * real column that never reached the switch) and the typo `clientNmae` both came
 * back in raw storage order — not the order asked for, and not even the default
 * of newest first. Indistinguishable from "sorting is broken" (contract §4.1).
 */
const ORDER_SORT_KEYS = [
  'orderNumber',
  'clientName',
  'status',
  'totalAmount',
  'totalWithVat',
  'paidPercent',
  'shippedPercent',
  'createdAt',
] as const

type OrderSortKey = (typeof ORDER_SORT_KEYS)[number]

/** A day, as the filter means it: `YYYY-MM-DD` that is a real date on a calendar. */
function isCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

/**
 * The list parameters, checked before they are believed — contract §4.1.
 *
 * Every one of these used to fail silently, and two of them failed in opposite
 * directions from the same cause: compared as strings, `dateFrom="not-a-date"`
 * sits above every date and hid everything, while a broken `dateTo` sits above
 * every date at the other end and hid nothing. An empty list is the answer to
 * "nothing matched"; it must never also be the answer to "your request is
 * broken", because then neither the user nor the developer can tell them apart.
 */
function validateListRequest(
  filters: { dateFrom: string; dateTo: string; sortBy: string | null; sortDir: string },
  pagination: PaginationParams,
): { sortBy: OrderSortKey | null; descending: boolean } {
  if (filters.sortBy && !ORDER_SORT_KEYS.includes(filters.sortBy as OrderSortKey)) {
    // The key is named in the refusal: "sorting failed" without it sends whoever
    // reads the log looking through eight columns for the one that was asked for.
    throw new Error(`UNKNOWN_SORT_KEY: ${filters.sortBy}`)
  }
  const dir = filters.sortDir || 'asc'
  if (dir !== 'asc' && dir !== 'desc') throw new Error(`UNKNOWN_SORT_DIRECTION: ${filters.sortDir}`)

  for (const [name, value] of [
    ['dateFrom', filters.dateFrom],
    ['dateTo', filters.dateTo],
  ] as const) {
    if (value && !isCalendarDay(value)) throw new Error(`INVALID_DATE_FILTER: ${name}=${value}`)
  }

  // `page = -1` became `slice(-14, -7)` and handed back the tail of the list: a
  // client that asked for a page it can name got a page it did not. `pageSize` is
  // the same request read from the other end, and it was left out of the same
  // check: a size below one answered with `totalPages: Infinity`, a number that
  // goes on to be rendered. One rule, so one refusal — §4.1 now names both.
  for (const [name, value] of [
    ['page', pagination.page],
    ['pageSize', pagination.pageSize],
  ] as const) {
    if (!Number.isInteger(value) || value < 1) throw new Error(`INVALID_PAGE: ${name}=${value}`)
  }

  return { sortBy: (filters.sortBy as OrderSortKey | null) || null, descending: dir === 'desc' }
}

export function mockGetOrders(
  filters: {
    search: string
    status: string
    clientId: string | null
    dateFrom: string
    dateTo: string
    sortBy: string | null
    sortDir: string
  },
  pagination: PaginationParams,
): PaginatedResponse<OrderListItem> {
  const { sortBy, descending } = validateListRequest(filters, pagination)

  let filtered = STORE.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    clientId: o.clientId,
    clientName: o.clientName,
    status: o.status,
    totalAmount: o.totalAmount,
    totalWithVat: o.totalWithVat,
    currency: o.currency,
    itemCount: o.items.length + o.services.length,
    createdAt: o.createdAt,
    paidPercent: o.paidPercent,
    shippedPercent: shippedPercentOf(o),
  }))

  const search = filters.search?.toLowerCase() ?? ''
  if (search) {
    filtered = filtered.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(search) || o.clientName.toLowerCase().includes(search),
    )
  }

  const status = filters.status ?? ''
  if (status && status !== 'all') {
    filtered = filtered.filter((o) => o.status === status)
  }

  if (filters.clientId) {
    filtered = filtered.filter((o) => o.clientId === filters.clientId)
  }

  // Both ends are inclusive, and both are days rather than instants: an order
  // placed at 17:00 on the day named in `dateTo` was placed on that day. The
  // parameters were accepted and thrown away before, which is the worst of the
  // three possible behaviours — a filter that answers with the unfiltered list
  // is indistinguishable from a range that happens to hold everything.
  if (filters.dateFrom) {
    filtered = filtered.filter((o) => o.createdAt.slice(0, 10) >= filters.dateFrom)
  }
  if (filters.dateTo) {
    filtered = filtered.filter((o) => o.createdAt.slice(0, 10) <= filters.dateTo)
  }

  // Apply sorting. The key was checked against `ORDER_SORT_KEYS` before a single
  // row was read, so every key that gets here names a column of the row — sorted
  // by what the column actually shows: with VAT modes differing per order, the
  // net order and the gross order are not the same order.
  const sortDir = descending ? -1 : 1
  if (sortBy) {
    filtered.sort((a, b) => {
      const va: string | number = a[sortBy]
      const vb: string | number = b[sortBy]
      // The order number is a counter written as text, and text order stops
      // being counter order at the thousandth — see `compareDocumentNumbers`.
      if (sortBy === 'orderNumber') {
        return compareDocumentNumbers(String(va), String(vb)) * sortDir
      }
      if (va < vb) return -1 * sortDir
      if (va > vb) return 1 * sortDir
      return 0
    })
  } else {
    // Default sort by createdAt DESC
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  const page = pagination.page
  const pageSize = pagination.pageSize
  const start = (page - 1) * pageSize
  const items = filtered.slice(start, start + pageSize)

  return {
    items: clone(items),
    total: filtered.length,
    page,
    pageSize,
    totalPages: Math.ceil(filtered.length / pageSize),
  }
}

// ─── Dashboard statistics ───

/**
 * The sales dashboard's numbers, counted over the whole store.
 *
 * They are the server's to compute for the same reason the order totals are:
 * the client only ever holds a page. The dashboard used to count "active" and
 * "pending" over the first hundred orders it fetched, which is every order
 * there was — so the hundred-and-first pushed the oldest out of the window and
 * the counts stood still while the business grew.
 */
export function mockGetSalesCrmStats(): SalesCrmStats {
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const salesMtd = STORE.filter(
    (o) =>
      (o.status === 'confirmed' || o.status === 'shipped' || o.status === 'delivered') &&
      new Date(o.createdAt) >= monthStart,
  ).reduce((sum, o) => round2(sum + o.totalAmount), 0)

  return {
    activeOrders: STORE.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').length,
    pendingOrders: STORE.filter((o) => o.status === 'new' || o.status === 'confirmed').length,
    salesMtd,
    newClientsThisMonth: mockGetClients().filter((c) => new Date(c.createdAt) >= monthStart).length,
  }
}

// ─── Single ───

export function mockGetOrder(id: string): Order | undefined {
  const order = STORE.find((o) => o.id === id)
  return order ? publicOrder(order) : undefined
}

// ─── Create ───

export function mockCreateOrder(data: {
  clientId: string
  documentType: 'local' | 'export'
  currency?: string
}): Order {
  const clients = mockGetClients()
  const client = clients.find((c) => c.id === data.clientId)
  if (!client) throw new Error('CLIENT_NOT_FOUND')

  // Derived from the same counter as the id: taking it from STORE.length would
  // repeat a number after a deletion, and waybill and invoice numbers are built
  // from it.
  const id = nextId()
  const orderNumber = `ORD-2026-${id.slice('ORD-'.length)}`
  const order: StoreOrder = {
    id,
    orderNumber,
    clientId: data.clientId,
    clientName: client.name,
    clientVatCode: client.vatCode,
    clientAddress: client.address,
    documentType: data.documentType,
    status: 'new',
    items: [],
    services: [],
    defaultMarginPercent: mockGetSettings().constants.defaultMargin,
    defaultDiscountPercent: 0,
    // Export documents are zero-rated by default; the admin can override.
    vatMode: data.documentType === 'export' ? 'export_zero' : 'standard',
    vatPercent: 21,
    currency: data.currency ?? 'EUR',
    totalCost: 0,
    totalAmount: 0,
    totalVat: 0,
    totalWithVat: 0,
    actualMarginPercent: 0,
    effectiveDiscountPercent: 0,
    paidAmount: 0,
    paidPercent: 0,
    outstandingAmount: 0,
    totalWeight: 0,
    shipments: [],
    invoices: [],
    payments: [],
    notes: null,
    documents: [],
    files: [],
    auditLog: [
      {
        id: 'au-1',
        timestamp: new Date().toISOString(),
        user: { ru: 'Система', en: 'System', lt: 'Sistema' },
        userInitials: 'SY',
        property: { ru: 'Заказ создан', en: 'Order created', lt: 'Užsakymas sukurtas' },
        oldValue: '',
        newValue: orderNumber,
        sensitive: null,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    _nextLineSeq: 1,
    _nextServiceSeq: 1,
    _nextShipmentSeq: 1,
    _nextInvoiceSeq: 1,
    _nextPaymentSeq: 1,
    _nextAuditSeq: 2,
  }
  STORE.push(order)
  return publicOrder(order)
}

// ─── Patch ───

/**
 * Fields the client is allowed to set. Everything else on an order is derived —
 * totals, VAT, margin, the paid share — and is produced here, never accepted
 * from the caller. A client that could dictate the total would make the invoice
 * and the lines disagree.
 */
export function mockPatchOrder(
  id: string,
  // The two legacy aliases are what the current card still sends; they go away
  // with the form rework.
  delta: Partial<Order> & { marginPercent?: number; orderDiscount?: number },
): Order {
  const order = STORE.find((o) => o.id === id)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  assertVersion(order, delta.version)
  requireFiniteNumbers({
    vatPercent: delta.vatPercent,
    defaultMarginPercent: delta.defaultMarginPercent,
    defaultDiscountPercent: delta.defaultDiscountPercent,
    totalWeight: delta.totalWeight,
    marginPercent: delta.marginPercent,
    orderDiscount: delta.orderDiscount,
  })

  if (delta.notes !== undefined) order.notes = delta.notes
  if (delta.documentType !== undefined) order.documentType = delta.documentType
  if (delta.currency !== undefined) order.currency = delta.currency
  if (delta.vatMode !== undefined) order.vatMode = delta.vatMode
  if (delta.vatPercent !== undefined) order.vatPercent = delta.vatPercent
  if (delta.defaultMarginPercent !== undefined)
    order.defaultMarginPercent = delta.defaultMarginPercent
  if (delta.defaultDiscountPercent !== undefined)
    order.defaultDiscountPercent = delta.defaultDiscountPercent
  // Hand-entered until products carry a weight.
  if (delta.totalWeight !== undefined) order.totalWeight = delta.totalWeight

  if (delta.marginPercent !== undefined) order.defaultMarginPercent = delta.marginPercent
  if (delta.orderDiscount !== undefined) order.defaultDiscountPercent = delta.orderDiscount

  // Everything else on an order is derived and is produced below, never taken
  // from the caller: a client that could dictate the total would make the
  // invoice and the lines disagree — `version` included, which is the server's
  // count of its own writes and is never read out of the body.
  recalcOrder(order)
  bumpVersion(order)
  return publicOrder(order)
}

function statusRules(status: OrderStatus): { reserves: boolean; writesOff: boolean } {
  const settings = mockGetSettings()
  const entry = settings.orderStatuses?.find((s) => s.id === `st-${status}`)
  return {
    reserves: entry?.reserveOnTransition === true,
    writesOff: entry?.writeOffOnTransition === true,
  }
}

/** Lines with something still to ship. Services are not goods and never appear. */
function unshippedLines(order: StoreOrder): Array<{ lineId: string; quantity: number }> {
  return order.items
    .map((item) => ({ lineId: item.id, quantity: round2(item.quantity - item.shippedQuantity) }))
    .filter((line) => line.quantity > 0)
}

export function mockPlanStatusTransition(
  orderId: string,
  status: OrderStatus,
): StatusTransitionPlan {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  const rules = statusRules(status)

  const requested = rules.writesOff ? unshippedLines(order) : []
  const plan = requested.length > 0 ? planShipment(order, requested) : { lines: [], shortages: [] }

  return {
    status,
    reserves: rules.reserves,
    // An order of nothing but services creates no shipment at all.
    writesOff: rules.writesOff && requested.length > 0,
    lines: plan.lines.map(({ lineId, productName, unit, quantity }) => ({
      lineId,
      productName,
      unit,
      quantity,
    })),
    shortages: plan.shortages,
  }
}

export function mockPatchOrderStatus(
  id: string,
  status: OrderStatus,
  /** The order version the caller was looking at — contract §3. */
  version?: number,
): Order {
  const order = STORE.find((o) => o.id === id)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  assertVersion(order, version)
  const oldStatus = order.status
  const rules = statusRules(status)

  // The warehouse moves BEFORE the status is recorded: if the goods are not there,
  // the order must not end up saying they left.
  if (rules.writesOff) {
    const requested = unshippedLines(order)
    if (requested.length > 0) {
      const plan = planShipment(order, requested)
      // Written down to the last unit or not at all — nobody may ship what is not
      // on the shelf, in any scenario.
      if (plan.shortages.length > 0) throw new Error('STATUS_BLOCKED_BY_STOCK')
      mockCreateShipment(id, { lines: requested })
    }
  }
  if (rules.reserves) mockReserveOrder(id)

  order.status = status
  bumpVersion(order)
  appendHistory(order, {
    user: { ru: 'Система', en: 'System', lt: 'Sistema' },
    userInitials: 'SY',
    property: { ru: 'Статус', en: 'Status', lt: 'Būsena' },
    oldValue: oldStatus,
    newValue: status,
  })
  return publicOrder(order)
}

// ─── Rights ─────────────────────────────────────────────────────────────────
// Model section 12. The server is the one that has to refuse, not the button: a
// hidden button is a suggestion, and anything that talks to this API directly —
// the next client, a script, a curl — is not looking at buttons.

/** Who is acting. One user in the mock; a real server takes this from the session. */
function actingUser(): { role: string; name: string; initials: string } {
  const profile = mockGetSettings().profile
  const name = `${profile.firstName} ${profile.lastName}`.trim() || profile.email
  const initials =
    (profile.firstName?.[0] ?? '') + (profile.lastName?.[0] ?? '') || profile.email.slice(0, 2)
  return { role: profile.role, name, initials: initials.toUpperCase() }
}

function requireRight(right: 'manualCost' | 'correction'): { name: string; initials: string } {
  const user = actingUser()
  const allowed = mockGetSettings().orderPermissions[right] ?? []
  if (!allowed.includes(user.role)) throw new Error('FORBIDDEN_' + right.toUpperCase())
  return user
}

/**
 * Appends one entry to an order's history — the only way an entry gets written.
 *
 * It hands out the two things the entry owes whoever reads it back. A name of
 * its own, because a history is deleted from while other people are reading it,
 * and a position is not a name (§2, §4.1). And a timestamp in the one format
 * every other timestamp in the payload uses: full ISO-8601. The stamp used to be
 * cut to `"2026-08-08 17:30"` here and left whole in `mockCreateOrder`, so one
 * array carried two formats — same type, `string`, so nothing type-checked
 * catches it, and sorted as strings the short ones land ahead of the long ones
 * whatever the clock said (§3).
 */
function appendHistory(
  order: StoreOrder,
  entry: Omit<OrderAuditEntry, 'id' | 'timestamp' | 'sensitive'> & { sensitive?: 'cost' | null },
): OrderAuditEntry {
  const stored: OrderAuditEntry = {
    id: `au-${order._nextAuditSeq++}`,
    timestamp: new Date().toISOString(),
    ...entry,
    // Never `undefined`: an absent key and a key holding null read the same
    // through JSON and differently to everything else (§3).
    sensitive: entry.sensitive ?? null,
  }
  order.auditLog.push(stored)
  return stored
}

/**
 * Writes the order's own history entry.
 *
 * The model asks for all three gated actions to be recorded with author and
 * reason — a right that leaves no trace is a right nobody can audit.
 */
function recordInHistory(
  order: StoreOrder,
  property: { ru: string; en: string; lt: string },
  oldValue: string,
  newValue: string,
  user: { name: string; initials: string },
  /** Set when the values are a cost — the card hides those without `seeCost`. */
  sensitive: 'cost' | null = null,
): void {
  appendHistory(order, {
    user: { ru: user.name, en: user.name, lt: user.name },
    userInitials: user.initials,
    property,
    oldValue,
    newValue,
    sensitive,
  })
}

// ─── Two people, one order ──────────────────────────────────────────────────
// Contract §3: the order carries a version, the server counts it up on every
// write, and a client sends back the version it was looking at.
//
// Why it is CHECKED only when one was sent, rather than demanded: a version is a
// statement about what the caller read, and a caller that never read the order
// cannot make it. The mock's own functions are called directly — by the demo
// generator that fills the store, by the shipping code that creates an invoice
// while it works, and by every test that drives the server without a card in
// front of it — and none of those has a version to send. Demanding one would not
// make those callers safe, it would only stop them working. Two tabs on one
// order is what this exists for, and a tab always has a version, because it
// always read the order first.
//
// What it costs to leave out is written down in §3 and was reproduced whole:
// 130,00 and 80,00 typed into the same line in two tabs, saved one after the
// other, leave the order worth 800,00 with nobody told anything and the first
// card still showing 1 300,00.

/**
 * Refuses a write made against an order the caller has not seen — and refuses it
 * BEFORE anything is written, so the order is left byte for byte as it was.
 */
function assertVersion(order: StoreOrder, sent: number | undefined): void {
  if (sent === undefined) return
  if (sent !== order.version) throw new Error('ORDER_VERSION_CONFLICT')
}

/**
 * One accepted write, one step. Called exactly once at the end of each endpoint
 * that changes an order, which is what lets a client that is sending several
 * requests for one save follow along: it knows the version it is on after each
 * answer without asking again.
 *
 * `updatedAt` moves with it — they say the same thing, and a version that had
 * moved while the timestamp had not would let a reader believe either.
 */
function bumpVersion(order: StoreOrder): void {
  order.version += 1
  order.updatedAt = new Date().toISOString()
}

// ─── Input validation ───────────────────────────────────────────────────────
// Contract §1, rule 6: the input is checked before anything believes it.
//
// Written once and called from everywhere, on purpose. The checks that stood
// here before were comparisons spelled out at each call site — and a comparison
// with NaN is false, so `NaN` and `Infinity` walked through every one of them:
// a line stored with `quantity: NaN` goes on the wire as `null` and collapses
// the order's total to 0, which on a server is a NOT NULL numeric column and a
// 500. Spelled out per call site, the next endpoint added would miss it again;
// this is the same shape of defect as the unknown product below.

/**
 * Refuses anything that is not a finite number, and says which field it was.
 *
 * Absent is not the same as wrong: an optional field that was not sent is not an
 * edit, and `null` is how "clear this" travels — neither is a number to check.
 */
function requireFiniteNumbers(fields: Record<string, unknown>): void {
  for (const [field, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`NUMBER_NOT_FINITE: ${field}`)
    }
  }
}

/**
 * A cost stated on the line that is being created is refused — contract §4.2.
 *
 * There is no way to make it legitimate here: this endpoint asks for no right,
 * carries no reason, and would store the client's figure wearing the label
 * `stock`. One move around the right, the mandatory reason, the `manual` mark
 * and the history entry all at once. A cost is typed by hand through
 * `PATCH manualUnitCost` with a reason, and nowhere else.
 *
 * The right is still asked for first, so a role that does not have it hears the
 * very same `FORBIDDEN_MANUALCOST` it hears at the door that was already watched
 * — the two doors answer alike because they guard the same thing.
 */
function refuseStatedCost(stated: number | undefined): void {
  if (stated === undefined) return
  requireRight('manualCost')
  throw new Error('MANUAL_COST_REASON_REQUIRED')
}

/**
 * What "reset to computed" resets the line to.
 *
 * The number rides with the edit, because it belongs to the moment the button
 * was pressed and not to the moment the request is read (contract §4.2). This is
 * the ONE line edit whose result depends on a field of the order, so it is the
 * one that comes apart when the order fields and the line edits travel as
 * separate requests — and they do: the card sends its own fields first, so a
 * default typed AFTER the reset used to reach a line that had already been
 * settled without it. Deferring to the order's own field when nothing was sent
 * keeps every direct caller working exactly as before.
 */
function lineEditContext(order: StoreOrder, delta: LineEditPayload): LineEditContext {
  return { defaultDiscountPercent: delta.defaultDiscountPercent ?? order.defaultDiscountPercent }
}

/** Every number a line edit can carry, and the one field it may not carry. */
function validateLineEdit(delta: LineEditPayload): void {
  requireFiniteNumbers({
    defaultDiscountPercent: delta.defaultDiscountPercent,
    quantity: delta.quantity,
    manualUnitPrice: delta.manualUnitPrice,
    lineTotal: delta.lineTotal,
    discountPercent: delta.discountPercent,
    marginPercent: delta.marginPercent,
    manualUnitCost: delta.manualUnitCost,
    unitCost: delta.unitCost,
    weightPerUnitKg: delta.weightPerUnitKg,
  })
  // The batch breakdown is the warehouse's record of which batches this line
  // consumes, and warehouse data is not written through the orders API
  // (contract §4.2). Taken from the body, it let a client name a batch nobody
  // has: the line stored, and then could never ship — the planner skips an
  // unknown batch — with nothing anywhere saying why.
  const { allocations: stated } = delta
  if (stated !== undefined) throw new Error('ALLOCATIONS_NOT_ACCEPTED')
}

// ─── Delete ───

/**
 * Deleting an order is only allowed while nothing irreversible has happened to it.
 *
 * A document in the client's hands, goods off the shelf and money received are
 * facts outside this system: dropping the order would leave an invoice nobody can
 * explain, 'sale' movements pointing at an order that does not exist, and a
 * payment with nothing to attach it to. Each of them has a proper way back —
 * correct the invoice, cancel the shipment, delete the payment — and after that
 * the order deletes. The refusal says which one is in the way.
 */
export function mockDeleteOrder(
  id: string,
  /** The order version the caller was looking at — contract §3. */
  version?: number,
): void {
  const idx = STORE.findIndex((o) => o.id === id)
  if (idx === -1) return
  const order = STORE[idx]!
  assertVersion(order, version)
  if (order.invoices.some((i) => i.kind !== 'correction' && !isWithdrawn(order, i.id))) {
    throw new Error('ORDER_HAS_INVOICE')
  }
  if (order.shipments.some((s) => !s.cancelled)) throw new Error('ORDER_HAS_SHIPMENT')
  if (order.payments.length > 0) throw new Error('ORDER_HAS_PAYMENT')
  STORE.splice(idx, 1)
  // Everything this order was holding goes back on the shelf. Left behind, the
  // holds would belong to an order nobody can open, and nothing could ever
  // release them — the goods would be promised away for the rest of the session.
  releaseOrder(id)
  // And everything it asked somebody to buy is withdrawn with it, for the same
  // reason and by the same rule: a shortage naming an order that cannot be opened
  // is a purchase nobody can justify (§4.2).
  clearShortages({ orderId: id })
}

// ─── Items ───

export function mockAddOrderItem(
  orderId: string,
  data: {
    productId: string
    quantity: number
    unit: string
    /** Price from the catalogue. Ignored when `marginPercent` says how to price. */
    unitPrice: number
    unitCost?: number
    /** Markup to apply when the product carries no price to quote. */
    marginPercent?: number
    discountPercent?: number
    batchId?: string | null
    /** The order version the caller was looking at — see `assertVersion`. */
    version?: number
  },
): OrderItem {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  assertVersion(order, data.version)
  // Checked before a single figure is read — §1, rule 6. Nothing below writes
  // anything until every one of these has passed.
  requireFiniteNumbers({
    quantity: data.quantity,
    unitPrice: data.unitPrice,
    marginPercent: data.marginPercent,
    discountPercent: data.discountPercent,
  })
  // A line for nothing is not a line. The domain has always known this refusal —
  // it just was never asked for here, so the one endpoint that creates lines was
  // the one place it did not apply.
  if (data.quantity === 0) throw new Error('ZERO_QUANTITY')
  // Whatever cost came with the request is not a cost — see `refuseStatedCost`.
  const { unitCost: statedCost } = data
  refuseStatedCost(statedCost)
  // The catalogue names the product — in the catalogue's own language, not the
  // reader's (see `CATALOGUE_LANGUAGE`) — and it has to BE in the catalogue. An
  // unknown id used to become a line named after its own id with a cost of zero,
  // while an unknown service was refused: one rule, written for services and
  // forgotten next door (§1, rule 6).
  const fullProduct = PRODUCTS_STORE.find((p) => p.id === data.productId)
  if (!fullProduct) throw new Error('CATALOG_PRODUCT_NOT_FOUND')
  let productName = fullProduct.name?.[CATALOGUE_LANGUAGE] ?? fullProduct.name?.en
  if (!productName) productName = data.productId
  // The caller hands over a selling price; cost and margin are what the model
  // actually stores, so the margin is derived to land on that price.
  //
  // The cost itself is read off the warehouse, oldest batches first — through the
  // same `stockCostFor` the card runs before Save, so the row does not change
  // under the admin the moment it is stored. A product with no batches has no
  // cost, and gets none: an invented number dressed up as a warehouse figure is
  // worse than no number at all, and two sides inventing separately is worse still.
  const covered = coverFromStock(order, {
    id: null,
    productId: data.productId,
    quantity: data.quantity,
    shippedQuantity: 0,
    allocations: [],
  })
  const { unitCost, costSource } = covered

  // What the admin decided, not what was derived from it: a catalogue price, or
  // a markup when the product carries no price. Never both — two ways to say the
  // same thing can disagree, and then the line follows whichever is read first.
  const seed =
    data.marginPercent !== undefined
      ? { marginPercent: data.marginPercent, manualUnitPrice: null }
      : pricingSeedFor(unitCost, data.unitPrice)

  const item = buildItem({
    // A line the warehouse cannot fully cover is costed partly on a guess, and
    // says so — the covered part still carries its real batches.
    costSource,
    id: `oi-${order._nextLineSeq}`,
    lineNumber: order._nextLineSeq,
    productId: data.productId,
    productName: productName ?? data.productId,
    quantity: data.quantity,
    unit: data.unit,
    unitCost,
    ...seed,
    discountPercent: data.discountPercent ?? order.defaultDiscountPercent,
    // The caption on a warehouse cost is the base currency, not the currency the
    // product is SOLD in — see `baseCurrencyOf`. Reading it off the product put a
    // sale-price currency on a warehouse-derived number.
    receivedCurrency: baseCurrencyOf(mockGetSettings()),
    batchId: data.batchId ?? null,
    // Which batches this line consumes. FIFO routinely spans several, and without
    // the breakdown a partial shipment cannot write off the very batches it took.
    allocations: data.batchId ? undefined : covered.allocations,
  })
  // Checked BEFORE it goes into the store: `recalcOrder` validates every line and
  // throws, and a line pushed first would stay behind and take every later
  // recalculation of this order down with it.
  validateLine(toPricingLine(item))
  order._nextLineSeq++
  order.items.push(item)
  recalcOrder(order)
  bumpVersion(order)
  // What the warehouse cannot cover is written down as a shortage: the order can
  // be taken, but nobody may ship goods that are not there, and a shortage with
  // no record is one nobody will ever buy. Filed after the line is in the store,
  // not before — a refusal must not leave a purchase request behind it.
  syncShortages(order, data.productId)
  return clone(item)
}

/**
 * Line edit. Every price-moving field goes through the pricing module, so the
 * documented rules apply here too: a price edit becomes a discount, a margin
 * edit reprices, a cost change cannot move a locked price, and a frozen line
 * refuses the edit instead of accepting it quietly.
 *
 * `unitPrice` / `totalPrice` / `discount` are projections and are ignored as
 * input — the caller sends `manualUnitPrice`, `discountPercent`, `marginPercent`.
 */
export function mockUpdateOrderItem(
  orderId: string,
  lineId: string,
  delta: LineEditPayload,
): OrderItem {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  assertVersion(order, delta.version)
  const idx = order.items.findIndex((i) => i.id === lineId)
  if (idx === -1) throw new Error('ORDER_ITEM_NOT_FOUND')

  // Everything the body claims, checked before anything acts on it — §1, rule 6.
  validateLineEdit(delta)

  // Typing a cost by hand is behind a right, and it is refused here rather than in
  // the card: the button is a suggestion, the server is the answer.
  const before = order.items[idx]!
  // `manualUnitCost: null` is the wire form of "back to the warehouse figure" —
  // still a cost decision, so it goes through the same right.
  const settingCost = delta.manualUnitCost !== undefined
  const actor = settingCost ? requireRight('manualCost') : null

  // Applied to a copy and swapped in only once every edit went through: a delta
  // carrying two edits must not leave the first one applied and the second refused.
  const draft = clone(before)
  const ctx = lineEditContext(order, delta)
  for (const op of deltaToOps(delta, 'item')) {
    applyLineEdit(draft, op, ctx)
  }

  // Non-pricing fields pass through untouched.
  if (delta.productName !== undefined) draft.productName = delta.productName
  if (delta.unit !== undefined) draft.unit = delta.unit
  if (delta.weightPerUnitKg !== undefined) draft.weightPerUnitKg = delta.weightPerUnitKg

  order.items[idx] = draft
  if (actor && draft.unitCost !== before.unitCost) {
    // The line goes in the property, not smuggled into "old value": the history
    // table reads as date · who · what · from · to, and "what" is this line's cost.
    recordInHistory(
      order,
      {
        ru: `Себестоимость вручную — ${draft.productName}`,
        en: `Manual cost — ${draft.productName}`,
        lt: `Rankinė savikaina — ${draft.productName}`,
      },
      String(before.unitCost),
      `${draft.unitCost} — ${draft.manualCostReason ?? '—'}`,
      actor,
      'cost',
    )
  }
  // A grown line gets batches for the units it gained; a shrunk one gives its
  // surplus hold back. Holding MORE stays the reservation's job, not an edit's.
  topUpAllocation(order, draft)
  trimHoldToLine(orderId, draft)
  recalcOrder(order)
  bumpVersion(order)
  // Whatever the shelf still cannot cover, restated: growing a line files what it
  // could not get, and shrinking one takes back what it no longer needs.
  syncShortages(order, draft.productId)
  return clone(draft)
}

/** Same rules for services — they are lines like any other. */
export function mockUpdateOrderService(
  orderId: string,
  serviceLineId: string,
  delta: LineEditPayload,
): OrderService {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  assertVersion(order, delta.version)
  const idx = order.services.findIndex((s) => s.id === serviceLineId)
  if (idx === -1) throw new Error('ORDER_SERVICE_NOT_FOUND')

  // The same validator as goods: one rule written twice is how the last six of
  // these were missed.
  validateLineEdit(delta)

  const before = order.services[idx]!
  // The `manualCost` right, asked here for the same reason `PATCH /items/:id`
  // asks it: §5 says the server checks the two write rights itself, and §1 rule 6
  // says it checks them in the function that writes. A service's cost is typed by
  // hand by definition — that is not a reason to stop asking who may type it. The
  // card already refuses the cell to a role without the right, and a rule the
  // client keeps and the server does not is the shape this module keeps growing.
  //
  // A reason is not demanded, and that IS by definition: a reason exists to say
  // why a warehouse figure was overridden, and a service has no warehouse figure.
  const actor = delta.unitCost !== undefined ? requireRight('manualCost') : null

  const draft = clone(before)
  const ctx = lineEditContext(order, delta)
  for (const op of deltaToOps(delta, 'service')) {
    applyLineEdit(draft, op, ctx)
  }

  order.services[idx] = draft
  // A right that leaves no trace is a right nobody can audit — the same entry
  // goods get, and it was missing here alongside the check itself.
  if (actor && draft.unitCost !== before.unitCost) {
    recordInHistory(
      order,
      {
        ru: `Себестоимость вручную — ${draft.serviceName}`,
        en: `Manual cost — ${draft.serviceName}`,
        lt: `Rankinė savikaina — ${draft.serviceName}`,
      },
      String(before.unitCost),
      String(draft.unitCost),
      actor,
      'cost',
    )
  }
  recalcOrder(order)
  bumpVersion(order)
  return clone(draft)
}

/**
 * Refuses an id it does not know rather than reporting success.
 *
 * A deletion accepted as a no-op is indistinguishable from one that worked: the
 * card said "saved", reloaded, and the line the admin had just removed was back
 * on screen with the order's total still counting it.
 *
 * And refuses a line that has gone out on paper — see `assertDeletable`.
 */
export function mockDeleteOrderItem(
  orderId: string,
  lineId: string,
  /** The order version the caller was looking at — contract §3. */
  version?: number,
): void {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  assertVersion(order, version)
  const idx = order.items.findIndex((i) => i.id === lineId)
  if (idx === -1) throw new Error('ORDER_ITEM_NOT_FOUND')
  const removed = order.items[idx]!
  assertDeletable(removed)
  order.items.splice(idx, 1)
  // The line is gone; anything it was holding is nobody's and goes back — and so
  // is anything it asked somebody to buy. A reservation and a shortage are both
  // things the line produced, and a delete that takes back only one of them
  // leaves the buying list ordering goods for a line that no longer exists.
  releaseLine(orderId, lineId)
  recalcOrder(order)
  bumpVersion(order)
  syncShortages(order, removed.productId)
}

/**
 * The freeze covers removal too, and the server is where it is enforced: a hidden
 * button is a suggestion, and this one was not even hidden.
 *
 * Deleting a shipped line left the waybill naming a line that no longer existed,
 * the 'sale' movements holding goods off the shelf for it, and the client's
 * invoice asking for money the order no longer contained. The refusal names the
 * obstacle, because each one has its own way back — cancel the shipment, which
 * returns the goods and withdraws the document, and the line deletes freely.
 */
function assertDeletable(line: OrderItem | OrderService): void {
  const pricing = toPricingLine(line)
  if (canDeleteLine(pricing)) return
  // One predicate decides it — the card reads the same one. This only picks
  // which of the two obstacles to name.
  throw new Error(pricing.shippedQuantity > 0 ? 'LINE_HAS_SHIPMENT' : 'LINE_ON_INVOICE')
}

// ─── Services ───

export function mockAddOrderService(
  orderId: string,
  data: {
    serviceId: string
    quantity: number
    price?: number
    discountPercent?: number
    /** The order version the caller was looking at — see `assertVersion`. */
    version?: number
  },
): OrderService {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  assertVersion(order, data.version)
  requireFiniteNumbers({
    quantity: data.quantity,
    price: data.price,
    discountPercent: data.discountPercent,
  })
  // Same refusal as `mockAddOrderItem`. A rule written for one entity and
  // forgotten next door is the commonest defect in this module (contract §1,
  // rule 6) — and `validateLine` does not catch it: it tests `quantity < 0`.
  if (data.quantity === 0) throw new Error('ZERO_QUANTITY')
  // From the catalogue, and refused if it is not in it: falling back to some
  // other service stored the line under a name nobody picked.
  const svcEntry = serviceEntry(data.serviceId)
  const price = data.price ?? svcEntry.price
  const service = buildService({
    id: `os-${order._nextServiceSeq}`,
    serviceId: data.serviceId,
    serviceName: svcEntry.name,
    quantity: data.quantity,
    unitCost: svcEntry.cost,
    ...pricingSeedFor(svcEntry.cost, price),
    discountPercent: data.discountPercent ?? order.defaultDiscountPercent,
  })
  validateLine(toPricingLine(service))
  order._nextServiceSeq++
  order.services.push(service)
  recalcOrder(order)
  bumpVersion(order)
  return clone(service)
}

/** Same rules as `mockDeleteOrderItem`: an unknown id is a refusal, and a service
 *  the client has an invoice for is not removed behind the document's back. */
export function mockDeleteOrderService(
  orderId: string,
  serviceId: string,
  /** The order version the caller was looking at — contract §3. */
  version?: number,
): void {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  assertVersion(order, version)
  const idx = order.services.findIndex((s) => s.id === serviceId)
  if (idx === -1) throw new Error('ORDER_SERVICE_NOT_FOUND')
  assertDeletable(order.services[idx]!)
  order.services.splice(idx, 1)
  recalcOrder(order)
  bumpVersion(order)
}

// ─── Audit ───

/**
 * `DELETE /orders/:id/audit/:entryId` — one record, named by its own id.
 *
 * It used to take the entry's POSITION, and a position is not a name for a
 * record other people are deleting from. Two clients read the same four-entry
 * history; the first deletes entry 1, every index below it slides up by one, and
 * the second — asking, correctly, for what it read at 2 — takes the neighbour
 * and leaves its own. Nobody is told, because a position always names something.
 *
 * An address that names nothing is refused, for the reason `DELETE /items/:id`
 * refuses an unknown line: a silent success cannot be told apart from "it was
 * already gone", and the caller that got its id from a stale list needs to hear
 * that its list is stale (§4.1).
 */
export function mockDeleteOrderAuditEntry(
  orderId: string,
  entryId: string,
  /** The order version the caller was looking at — contract §3. */
  version?: number,
): void {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  assertVersion(order, version)
  const idx = order.auditLog.findIndex((entry) => entry.id === entryId)
  if (idx === -1) throw new Error('ORDER_AUDIT_ENTRY_NOT_FOUND')
  order.auditLog.splice(idx, 1)
  bumpVersion(order)
}

// ─── Files ───

let fileSeq = 1

export function mockAddOrderFile(
  orderId: string,
  fileId: string,
  originalName?: string,
  /** The order version the caller was looking at — contract §3. */
  version?: number,
): OrderFile {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  assertVersion(order, version)
  const file: OrderFile = {
    id: `ord-file-${fileSeq++}`,
    name: originalName ?? `File ${fileSeq - 1}`,
    fileId,
    url: '#',
    size: 0,
    mime: 'application/octet-stream',
    uploadedAt: new Date().toISOString(),
  }
  order.files.push(file)
  bumpVersion(order)
  return structuredClone(file)
}

export function mockRemoveOrderFile(
  orderId: string,
  fileId: string,
  /** The order version the caller was looking at — contract §3. */
  version?: number,
): void {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  assertVersion(order, version)
  const idx = order.files.findIndex((f) => f.fileId === fileId)
  // An id nobody knows is refused, like its two neighbours — the line deletion
  // and the history deletion both stopped answering "fine" to a request they had
  // not carried out. Here it was worse than untidy, and only the version made it
  // visible: the bump sat INSIDE the branch, so a removal that matched nothing
  // wrote nothing and stepped nothing, while the card stepped its own counter
  // regardless. From then on the card was a version ahead of the server, and
  // every later request of that save was refused as a conflict that never
  // happened.
  if (idx === -1) throw new Error('ORDER_FILE_NOT_FOUND')
  order.files.splice(idx, 1)
  bumpVersion(order)
}

// ─── Total allocation ───────────────────────────────────────────────────────

/**
 * Spreads a manually entered gross total across the editable lines.
 *
 * Returns the preview rows and the total the order will REALLY come to: with
 * VAT rounded to cents some gross amounts are unreachable (at 21% there is no
 * cent-exact net that grosses up to 100.00), and the admin has to be told rather
 * than handed a total a cent away from what they typed.
 */
export function mockAllocateOrderTotal(
  orderId: string,
  targetGross: number,
  /** The order version the caller was looking at — contract §3. */
  version?: number,
): {
  order: Order
  requestedGross: number
  achievedGross: number
  rows: Array<{ lineId: string; before: number; after: number }>
} {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  assertVersion(order, version)
  requireFiniteNumbers({ targetGross })

  const result = allocateGrossTotal(
    orderPricingLines(order),
    targetGross,
    order.vatMode,
    order.vatPercent,
  )

  // Matched by id, not by position: a positional match would silently put money
  // on the wrong line if the two lists were ever built in a different order.
  const byId = new Map<string, OrderItem | OrderService>(
    [...order.items, ...order.services].map((line) => [line.id, line]),
  )
  result.lines.forEach((pricing) => {
    const target = byId.get(pricing.id)
    if (!target) throw new Error('ALLOCATION_LINE_NOT_FOUND')
    applyPricing(target, pricing)
  })

  recalcOrder(order)
  bumpVersion(order)
  return {
    order: publicOrder(order),
    requestedGross: result.requestedGross,
    achievedGross: result.achievedGross,
    rows: result.rows,
  }
}

// ─── Correcting a frozen line ───────────────────────────────────────────────

/**
 * The only way past the freeze — model, sections 6, 11.4 and 12.
 *
 * A line goes rigid the moment it is named by a document the client holds: a
 * waybill for goods, an invoice for a service. That is the point of the freeze,
 * and it left exactly one problem — a price typed wrong before the truck left
 * could never be put right. The alternatives were both lies: split the line, which
 * only reaches the part that has not gone, or cancel the whole delivery, which
 * returns goods that never came back.
 *
 * So it is done in the open instead. Behind a right, with a reason that is
 * mandatory, written into the order's history, and — where the client is holding
 * a document — followed by a correcting invoice for the DIFFERENCE. The document
 * already issued is not rewritten; a second one adjusts it, and the two together
 * say what was really agreed.
 *
 * The warehouse is not touched at all. Nothing moved, so nothing moves back: this
 * corrects a figure, not a delivery. A wrong QUANTITY is a different operation —
 * cancel the shipment and send the right one.
 */
export function mockCorrectOrderLine(
  orderId: string,
  lineId: string,
  data: { unitPrice?: number; unitCost?: number; reason?: string; version?: number },
): OrderItem | OrderService {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  assertVersion(order, data.version)
  const item = order.items.find((i) => i.id === lineId)
  const service = item ? undefined : order.services.find((s) => s.id === lineId)
  const line = item ?? service
  if (!line) throw new Error('ORDER_ITEM_NOT_FOUND')
  requireFiniteNumbers({ unitPrice: data.unitPrice, unitCost: data.unitCost })

  const reason = data.reason?.trim() ?? ''
  // Checked before the right, so a user without it still learns what else is wrong.
  if (!reason) throw new Error('CORRECTION_REASON_REQUIRED')
  if (data.unitPrice === undefined && data.unitCost === undefined) {
    throw new Error('CORRECTION_NEEDS_CHANGE')
  }
  const actor = requireRight('correction')

  const before = toPricingLine(line)
  // An open line is edited the ordinary way. Letting this path touch one would put
  // a correcting document against a delivery that never happened, and skip every
  // check an ordinary edit makes on the way.
  if (canEditPrice(before) && !isCostFrozen(before)) throw new Error('LINE_NOT_FROZEN')

  // ── The plan ───────────────────────────────────────────────────────────────
  // Everything this operation would do is worked out before any of it is done —
  // §1 rule 3, and this is the one operation in the module that used to break it.
  // The price went onto the line, the correcting documents were issued after it
  // and the rollup came last, so a refusal from the second document left the line
  // repriced, the order's total stale and the difference on no document at all:
  // 20,00 € on a two-line invoice, 2 612,00 € once the fuzzer got hold of it
  // (contract §4.2.1). A refused correction has to leave the order untouched.

  // Cost first: the corrected price is expressed against the corrected cost, so
  // the margin that comes out of it is the one that was really earned.
  let pricing = before
  if (data.unitCost !== undefined) pricing = applyCostCorrection(pricing, data.unitCost, 'manual')
  if (data.unitPrice !== undefined) pricing = applyCorrection(pricing, data.unitPrice)
  // The corrected line has to be one the order can hold. `recalcOrder` validates
  // every line and it runs at the END of this operation — by which time the price
  // would already be stored.
  validateLine(pricing)

  // What each document that names this line would have said, before and after.
  // Through `calcLine` rather than a unit price multiplied out, for the reason
  // `shippedLineNet` exists: the stored price carries more decimals than it shows.
  const netFor = (state: PricingLine, quantity: number) => calcLine({ ...state, quantity }).lineNet

  const documents = item
    ? liveInvoicesCovering(order, item)
    : liveInvoicesCoveringService(order, line.id)

  // One correcting document per document the client is holding, each for the
  // difference on the quantity that document actually billed. A delivery that was
  // never invoiced needs none: there is nothing out there to adjust.
  const corrections =
    data.unitPrice === undefined
      ? []
      : documents
          .map((invoice) => {
            const quantity = item ? invoicedQuantityOf(order, invoice, item.id) : line.quantity
            return {
              invoice,
              delta: round2(netFor(pricing, quantity) - netFor(before, quantity)),
            }
          })
          .filter(({ delta }) => delta !== 0)

  // One document is adjusted once (§4.6). Asked here, where the answer still
  // costs nothing — this is the refusal that used to arrive after the write.
  for (const { invoice } of corrections) {
    if (hasCorrection(order, invoice.id)) throw new Error('INVOICE_ALREADY_CORRECTED')
  }

  // ── Everything is checked; from here on it only writes. ────────────────────
  applyPricing(line, pricing)
  if (item) projectItem(item)
  else projectService(line as OrderService)

  if (data.unitCost !== undefined && before.unitCost !== pricing.unitCost) {
    recordInHistory(
      order,
      {
        ru: `Корректировка себестоимости — ${lineNameOf(line)}`,
        en: `Cost correction — ${lineNameOf(line)}`,
        lt: `Savikainos korekcija — ${lineNameOf(line)}`,
      },
      String(before.unitCost),
      `${pricing.unitCost} — ${reason}`,
      actor,
      'cost',
    )
  }

  if (data.unitPrice !== undefined) {
    recordInHistory(
      order,
      {
        ru: `Корректировка цены — ${lineNameOf(line)}`,
        en: `Price correction — ${lineNameOf(line)}`,
        lt: `Kainos korekcija — ${lineNameOf(line)}`,
      },
      formatCents(netFor(before, 1)),
      `${formatCents(netFor(pricing, 1))} — ${reason}`,
      actor,
    )

    for (const { invoice, delta } of corrections) {
      mockCreateInvoice(order.id, {
        kind: 'correction',
        correctsInvoiceId: invoice.id,
        amountNet: delta,
        reason,
      })
    }
  }

  recalcOrder(order)
  bumpVersion(order)
  return clone(line)
}

function lineNameOf(line: OrderItem | OrderService): string {
  return 'productName' in line ? line.productName : line.serviceName
}

/** Documents the client still holds that name this goods line. */
function liveInvoicesCovering(order: StoreOrder, item: OrderItem): Invoice[] {
  return order.invoices.filter((invoice) => {
    if (invoice.kind === 'correction' || isWithdrawn(order, invoice.id)) return false
    const shipment = order.shipments.find((s) => s.id === invoice.shipmentId)
    return shipment?.lines.some((sl) => sl.lineId === item.id) ?? false
  })
}

/** How much of the line that document billed — the correction covers no more. */
function invoicedQuantityOf(order: StoreOrder, invoice: Invoice, lineId: string): number {
  const shipment = order.shipments.find((s) => s.id === invoice.shipmentId)
  return round2(
    shipment?.lines.reduce((sum, sl) => (sl.lineId === lineId ? sum + sl.quantity : sum), 0) ?? 0,
  )
}

// ─── Split a partially shipped line ─────────────────────────────────────────

/**
 * Cuts a partially shipped line into the part that left with the waybill and a
 * free remainder, so the remainder can be repriced without touching a printed
 * document.
 */
export function mockSplitOrderItem(
  orderId: string,
  lineId: string,
  shippedQuantity: number,
  /** The order version the caller was looking at — contract §3. */
  version?: number,
): { shipped: OrderItem; remainder: OrderItem } {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  assertVersion(order, version)
  const idx = order.items.findIndex((i) => i.id === lineId)
  if (idx === -1) throw new Error('ORDER_ITEM_NOT_FOUND')
  requireFiniteNumbers({ shippedQuantity })
  const item = order.items[idx]!

  const split = splitPricingLine(toPricingLine(item), shippedQuantity)
  // The batches follow the goods: the shipped part consumed the earliest ones.
  const allocations = splitAllocations(item.allocations, shippedQuantity)

  const shipped: OrderItem = { ...item, allocations: allocations.shipped }
  applyPricing(shipped, split.shipped)

  const remainder: OrderItem = {
    ...item,
    id: `oi-${order._nextLineSeq}`,
    lineNumber: order._nextLineSeq,
    allocations: allocations.remainder,
    documentIssued: false,
  }
  applyPricing(remainder, { ...split.remainder, id: remainder.id })
  order._nextLineSeq++

  order.items.splice(idx, 1, shipped, remainder)
  order.items.forEach((line, position) => {
    line.lineNumber = position + 1
  })
  // The shipped half owes nothing more, so it holds nothing; the remainder is a
  // fresh line and is reserved like any other.
  trimHoldToLine(orderId, shipped)
  recalcOrder(order)
  bumpVersion(order)
  return { shipped: clone(shipped), remainder: clone(remainder) }
}

// ─── Shipments ──────────────────────────────────────────────────────────────

export function mockGetShipments(orderId: string): Shipment[] {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  return clone(order.shipments)
}

/**
 * One truck leaves. This is the only thing that moves goods out of the order —
 * status-driven write-off calls it too, so there is a single path to the
 * warehouse instead of two.
 */
/**
 * Tops the batch breakdown up to cover the whole line — and re-reads what that
 * makes the line cost.
 *
 * A line that grows needs batches for the units it just gained, or they can be
 * neither reserved nor shipped and nobody is told why. Only the shortfall is
 * planned: the part already worked out — and especially the part already shipped
 * — is left exactly as it is, so an edit cannot re-plan goods that have gone.
 *
 * This runs on a partially shipped line too, and must: "the truck has left and
 * the client wants two more" is the case the whole model is built around. Adding
 * to the end of the breakdown cannot disturb the prefix the first truck took.
 *
 * The units that were just added come off real batches at real prices, so the
 * cost follows them — through `coverFromStock`, the one function that answers
 * this for every road a line gets stock by. The comment that used to stand here
 * said the cost was deliberately not re-read so the card's local preview would
 * agree with the server; what it actually bought was a line of 405 costed at the
 * first batch's 9,45, 123,00 under the truth and labelled "from stock". A preview
 * that agrees with a wrong number is not agreement.
 *
 * A cost named by a person is not re-read, and a cost that has gone out on paper
 * cannot move at all — that is what `correct` is for (§4.2.1).
 *
 * What it does NOT do is move the price. A quantity edit "keeps the price per
 * unit; the line total follows" — that is `applyQuantityEdit`'s own rule, and it
 * held until the cost started being re-read underneath it: on a line whose price
 * is computed, cost × margin IS the price, so a blend two cents dearer quietly
 * repriced goods the admin had already agreed. The units that were in the line
 * did not get more expensive; only the average did, because cheaper ones ran out
 * and dearer ones were added. So the price stays where it was and the planned
 * margin takes the difference — the same rule §4.2.1 states for a corrected cost
 * and the same shape `pricingSeedFor` uses at creation, where the price is the
 * decision and the margin is derived from it.
 *
 * This is also the only honest answer to a second question: the card cannot
 * predict this figure. Which batches the shelf offers next is warehouse
 * knowledge, and reproducing the blend in the browser would be a second copy of
 * this very function — the mistake at the root of every finding in this audit.
 * Holding the price means the card does not have to predict it: what it showed
 * is what gets stored, and the cost it could not know shows up where it belongs,
 * in the margin the server sends back.
 */
function topUpAllocation(order: StoreOrder, item: OrderItem): void {
  const before = round2(item.allocations.reduce((sum, a) => sum + a.quantity, 0))
  const covered = coverFromStock(order, item)
  item.allocations = covered.allocations
  // Only when the shelf really answered: an edit that added no batches has
  // nothing new to say about the cost, and rewriting it anyway would move the
  // figure on every unrelated save.
  const after = round2(item.allocations.reduce((sum, a) => sum + a.quantity, 0))
  if (after <= before) return
  if (item.costSource === 'manual' || isCostFrozen(toPricingLine(item))) return

  // The price as it stands, before the cost moves under it. A line that stores
  // its price — quoted or hand-named — already keeps it through a cost change;
  // one that computes it from the margin needs the margin restated, and both
  // numbers stay at storage precision so nothing is rebuilt a cent short (§7).
  const computesItsPrice = item.manualUnitPrice === null && item.namedUnitPrice === null
  const priceBefore = item.unitCost * (1 + item.marginPercent / 100)

  item.unitCost = covered.unitCost
  item.costSource = covered.costSource

  if (computesItsPrice && priceBefore > 0 && covered.unitCost > 0) {
    item.marginPercent = marginFor(covered.unitCost, priceBefore)
  }
}

/**
 * Which batches a line draws on, and what they make it cost.
 *
 * ONE function answers that, for every road a line gets stock by — being created,
 * and being grown (contract §4.2, rule 3). It used to be answered in two places,
 * and the second knew none of the first's rules: it read availability without
 * noticing that the line asking already stood on the batch in its own breakdown,
 * so it handed the same 305 units out a second time; it filed no shortage; and it
 * left `costSource` saying "stock" over a number the warehouse had never given.
 * The same order reached by two roads has to come back with the same figures.
 *
 * The cost is stored with room to spare and shown in cents (§7). Rounded to the
 * cent before it is multiplied by the quantity, a weighted 9,753703… becomes 9,75
 * and the order's cost lands 1,50 below the batches it is made of.
 */
/**
 * What this line already claims and has not shipped, per batch.
 *
 * Not free shelf, and the physical remainder cannot say so — a breakdown is not
 * a reservation — so the asking line has to declare it, or FIFO offers it the
 * batch it is already standing on. That is finding 3 in one sentence: the same
 * 305 units handed out twice, a cost 3,1% under the truth, labelled `stock`.
 */
function claimedByLine(
  allocations: OrderLineAllocation[],
  shippedQuantity: number,
): Map<string, number> {
  const claimed = new Map<string, number>()
  for (const a of splitAllocations(allocations, shippedQuantity).remainder) {
    if (a.batchId) claimed.set(a.batchId, round2((claimed.get(a.batchId) ?? 0) + a.quantity))
  }
  return claimed
}

/**
 * Everything the shelf would still give this line, oldest batch first.
 *
 * The same question `coverFromStock` asks, asked open-ended: not "cover these
 * four more" but "and then what?". It goes out with the order so a card can show
 * what a quantity change will really cost without asking again per keystroke and
 * without running FIFO itself — the rule (which batches, minus other orders'
 * holds, minus this line's own claims) is answered here, once, and the card only
 * takes units off the front of the answer.
 *
 * Never stored: the shelf moves under it, and a kept copy would be a promise the
 * warehouse never made (§1, rule 5).
 */
function topUpLadder(order: StoreOrder, item: OrderItem): OrderLineAllocation[] {
  const free = batchesForProduct(item.productId).reduce((sum, b) => sum + b.quantityRemaining, 0)
  if (free <= 0) return []
  const fifo = mockFifoAllocation(item.productId, free, {
    exceptLine: { orderId: order.id, lineId: item.id },
    claimed: claimedByLine(item.allocations, item.shippedQuantity),
  })
  return fifo.allocations.map((a) => ({
    batchId: a.batchId,
    offcutId: a.offcutId ?? null,
    quantity: a.quantity,
    unitCost: a.unitCost,
    currency: a.currency,
    source: a.source,
  }))
}

function coverFromStock(
  order: StoreOrder,
  line: {
    id: string | null
    productId: string
    quantity: number
    shippedQuantity: number
    allocations: OrderLineAllocation[]
  },
): { allocations: OrderLineAllocation[]; unitCost: number; costSource: CostSource } {
  const merged = line.allocations.map((a) => ({ ...a }))
  const missing = round2(line.quantity - merged.reduce((sum, a) => sum + a.quantity, 0))

  if (missing > 0) {
    const fifo = mockFifoAllocation(line.productId, missing, {
      exceptLine: line.id ? { orderId: order.id, lineId: line.id } : undefined,
      claimed: claimedByLine(merged, line.shippedQuantity),
    })
    // One entry per batch, kept in the order the batches are consumed. Two entries
    // for the same batch would still add up, but every rule expressed per entry —
    // how much of it is already shipped, how much of it is held — would then be
    // reading half the story.
    for (const a of fifo.allocations) {
      const existing = merged.find((m) => m.batchId === a.batchId && m.offcutId === a.offcutId)
      if (existing) {
        existing.quantity = round2(existing.quantity + a.quantity)
        continue
      }
      merged.push({
        batchId: a.batchId,
        offcutId: a.offcutId,
        quantity: a.quantity,
        unitCost: a.unitCost,
        currency: a.currency,
        source: a.source,
      })
    }
  }

  const covered = round2(merged.reduce((sum, a) => sum + a.quantity, 0))
  const spent = merged.reduce((sum, a) => sum + a.quantity * a.unitCost, 0)
  const weighted = covered > 0 ? roundStored(spent / covered) : 0
  // `stockCostFor` still decides WHAT the figure is — a cost of nothing is no
  // cost, and a line the shelf cannot fully cover carries an estimate. Only the
  // precision it is kept at differs; the cent is for showing.
  const { unitCost, costSource } = stockCostFor(weighted, round2(line.quantity - covered) > 0)
  return { allocations: merged, unitCost: unitCost === 0 ? 0 : weighted, costSource }
}

/**
 * Files what this order cannot cover for one product — and nothing else.
 *
 * The record says "Order X" and names a product, which is all it can say, so it
 * is rewritten from the lines rather than added to. That is what makes it
 * disappear when it should: a line that shrank, or went away, or an order that
 * was deleted, takes its share of the shortage with it (§4.2). Left behind, it
 * asks somebody to buy goods for an order nobody can open.
 *
 * The gap is read off the breakdown — quantity the batches did not cover — and
 * not asked of the warehouse a second time: the two questions would drift apart
 * the moment somebody else reserved something in between.
 */
function syncShortages(order: StoreOrder, productId: string): void {
  clearShortages({ orderId: order.id, productId })
  let missing = 0
  let productName = ''
  let unit = ''
  for (const item of order.items) {
    if (item.productId !== productId) continue
    const gap = round2(item.quantity - item.allocations.reduce((sum, a) => sum + a.quantity, 0))
    if (gap <= 0) continue
    // Two lines of one product are two claims on the same shelf, so what they
    // lack adds up — `max` of the two would send somebody shopping for less than
    // the order needs.
    missing = round2(missing + gap)
    productName = productName || item.productName
    unit = unit || item.unit
  }
  if (missing <= 0) return
  recordShortage({ productId, productName, quantity: missing, unit, orderId: order.id })
}

/**
 * A hold may never outlast what it is for.
 *
 * Shrink a line and the goods it no longer needs go back on the shelf. Without
 * this they stay promised to an order that will never take them — invisible to
 * everyone, because a reservation is only ever seen through what it subtracts.
 */
function trimHoldToLine(orderId: string, item: OrderItem): void {
  const owed = round2(item.quantity - item.shippedQuantity)
  const held = reservedForLine(orderId, item.id)
  if (held > owed) releaseFromLine(orderId, item.id, round2(held - owed))
}

/** One line of a shipment as it would happen, with the batches it would take. */
export interface ShipmentPlanLine {
  lineId: string
  productName: string
  unit: string
  quantity: number
  consume: OrderLineAllocation[]
}

export interface ShipmentPlan {
  lines: ShipmentPlanLine[]
  shortages: ShipmentShortage[]
}

/**
 * Works out what a shipment would consume, without moving anything.
 *
 * A shipment writes stock off the warehouse, and half a shipment — goods gone
 * from one batch, the next batch refusing — is not something a ledger recovers
 * from. So the whole thing is planned first and written afterwards.
 *
 * A shortage comes back as DATA, not as an exception: the admin has to be shown
 * what is missing and how much, and only then refused. A caller mistake — an
 * unknown line, a negative quantity, more than the line has left — still throws.
 */
export function planShipment(
  order: StoreOrder,
  requested: Array<{ lineId: string; quantity: number }>,
): ShipmentPlan {
  const lines: ShipmentPlanLine[] = []
  const shortages: ShipmentShortage[] = []
  const seen = new Set<string>()

  for (const shipLine of requested) {
    const item = order.items.find((i) => i.id === shipLine.lineId)
    if (!item) throw new Error('ORDER_ITEM_NOT_FOUND')
    // The same line twice in one shipment reads its remaining quantity twice from
    // the same starting point, so two 3s pass a check for 5 — and each takes the
    // same slice of the breakdown, writing the same units off the shelf twice.
    // Caught here, before the movements; the line validation at the end of the
    // operation would catch it only after the goods were gone.
    if (seen.has(shipLine.lineId)) throw new Error('DUPLICATE_SHIPMENT_LINE')
    seen.add(shipLine.lineId)
    // Before the comparison, because `NaN <= 0` is false and `Infinity <= 0` is
    // false: the quantity that is not a number is exactly the one the positive
    // check waves through. Planning happens before anything moves, so a refusal
    // here leaves the warehouse and the order untouched.
    requireFiniteNumbers({ quantity: shipLine.quantity })
    if (shipLine.quantity <= 0) throw new Error('SHIPMENT_QUANTITY_MUST_BE_POSITIVE')
    const remaining = round2(item.quantity - item.shippedQuantity)
    if (shipLine.quantity > remaining) throw new Error('SHIPMENT_EXCEEDS_REMAINING')

    // The part of the breakdown this shipment takes: whatever earlier shipments
    // already consumed is skipped, so the second truck writes off the next
    // batches rather than the same ones again.
    const unshipped = splitAllocations(item.allocations, item.shippedQuantity).remainder
    const consume: OrderLineAllocation[] = []
    let missing = shipLine.quantity

    for (const allocation of splitAllocations(unshipped, shipLine.quantity).shipped) {
      // A line costed on a guess has no batch behind it, and goods that are on no
      // shelf cannot leave one.
      const batch = allocation.batchId ? batchById(allocation.batchId) : undefined
      if (!batch) continue
      // Not just what is on the shelf — what is on the shelf and not promised to
      // somebody else. Shipping straight off the remainder would walk past every
      // reservation another order is holding, which is the same tonne sold twice
      // by a different route.
      const free = computeAvailable(
        batch.quantityRemaining,
        reservedOn(batch.id, { exceptLine: { orderId: order.id, lineId: item.id } }),
      )
      const take = round2(Math.min(allocation.quantity, free))
      if (take <= 0) continue
      consume.push({ ...allocation, quantity: take })
      missing = round2(missing - take)
    }

    if (missing > 0) {
      shortages.push({ lineId: item.id, productName: item.productName, unit: item.unit, missing })
    }
    lines.push({
      lineId: item.id,
      productName: item.productName,
      unit: item.unit,
      quantity: shipLine.quantity,
      consume,
    })
  }

  return { lines, shortages }
}

/**
 * The lines a shipment could take right now, and how much of each.
 *
 * Same planner as the shipment itself, so the dialog cannot offer a quantity the
 * write-off would then refuse.
 */
export function mockPlanOrderShipment(orderId: string): ShippableLine[] {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  const requested = unshippedLines(order)
  if (requested.length === 0) return []

  const plan = planShipment(order, requested)
  return plan.lines.map((line) => {
    const missing = plan.shortages.find((s) => s.lineId === line.lineId)?.missing ?? 0
    return {
      lineId: line.lineId,
      productName: line.productName,
      unit: line.unit,
      remaining: line.quantity,
      shippable: round2(line.quantity - missing),
    }
  })
}

export function mockCreateShipment(
  orderId: string,
  data: {
    lines: Array<{ lineId: string; quantity: number }>
    carrier?: string | null
    vehicle?: string | null
    waybillNumber?: string | null
    shippedAt?: string
    /** The order version the caller was looking at — contract §3. */
    version?: number
  },
): Shipment {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  assertVersion(order, data.version)
  if (!data.lines.length) throw new Error('SHIPMENT_HAS_NO_LINES')

  // Everything is checked before anything moves — see `planShipment`.
  const plan = planShipment(order, data.lines)
  if (plan.shortages.length > 0) throw new Error('SHIPMENT_EXCEEDS_STOCK')
  const planned = plan.lines

  const shipment: Shipment = {
    id: `${order.id}-SHP-${order._nextShipmentSeq}`,
    orderId: order.id,
    number: `${order.orderNumber}/${order._nextShipmentSeq}`,
    shippedAt: data.shippedAt ?? new Date().toISOString(),
    carrier: data.carrier ?? null,
    vehicle: data.vehicle ?? null,
    waybillNumber: data.waybillNumber ?? `WB-${order.orderNumber}-${order._nextShipmentSeq}`,
    // Field by field, and `heldReleased` starts at `null`: the shipment line is
    // the server's record, not the request's, so nothing rides in on a spread —
    // and the key is on the object from the first moment, because a field that
    // appears only sometimes is a column nobody reading one response can see (§3).
    lines: data.lines.map((l) => ({ lineId: l.lineId, quantity: l.quantity, heldReleased: null })),
    cancelled: false,
  }
  order._nextShipmentSeq++
  order.shipments.push(shipment)

  for (const shipLine of shipment.lines) {
    const item = order.items.find((i) => i.id === shipLine.lineId)!
    item.shippedQuantity = round2(item.shippedQuantity + shipLine.quantity)
    // State follows the quantities — never set by hand.
    applyPricing(item, syncLineState(toPricingLine(item)))
    // What shipped is no longer reserved: the hold is replaced by a real
    // write-off. Off the SAME batches the write-off takes, because it is one
    // decision and not two — see `releaseFromLineOnBatches`. Recorded on the line,
    // because cancelling has to put back exactly this much off exactly these
    // batches, and a record of the wrong batch puts it back in the wrong place.
    const consumed = planned.find((l) => l.lineId === item.id)?.consume ?? []
    const released = releaseFromLineOnBatches(order.id, item.id, consumed, shipLine.quantity)
    // Nothing held is `null`, not an absent key — see the shipment above.
    shipLine.heldReleased = released.length > 0 ? released : null
  }

  // ── The only thing in the system that takes goods off the shelf ──
  // One 'sale' movement per batch actually consumed, pointing back at this
  // shipment. Movements are never edited or deleted afterwards; a cancellation
  // adds the opposite ones, so the warehouse history always adds up.
  for (const line of planned) {
    for (const allocation of line.consume) {
      writeMovement({
        type: 'sale',
        batchId: allocation.batchId!,
        offcutId: allocation.offcutId,
        quantity: allocation.quantity,
        unitPrice: allocation.unitCost,
        referenceType: 'order-shipment',
        referenceId: shipment.id,
        // The day the goods left, not the moment the record was written. A
        // shipment entered late is still a January shipment, and a movement
        // stamped "now" puts January's sale in this month's report.
        movedAt: shipment.shippedAt,
        notes: `${order.orderNumber} · ${shipment.waybillNumber ?? shipment.number}`,
      })
    }
  }

  recalcOrder(order)
  bumpVersion(order)
  return clone(shipment)
}

/**
 * Reverse movements, never a deletion — the warehouse history has to add up.
 *
 * `correctionReason` is what makes an invoiced delivery cancellable: the document
 * in the client's hands is withdrawn by a correcting invoice, not silently. Both
 * happen here, in one call, for the reason every warehouse write does: a
 * correction issued and then a cancellation that fails leaves the client holding
 * a credit note for goods the system still says they have.
 */
export function mockCancelShipment(
  orderId: string,
  shipmentId: string,
  opts?: { correctionReason?: string | null; version?: number },
): Shipment {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  assertVersion(order, opts?.version)
  const shipment = order.shipments.find((s) => s.id === shipmentId)
  if (!shipment) throw new Error('SHIPMENT_NOT_FOUND')
  if (shipment.cancelled) throw new Error('SHIPMENT_ALREADY_CANCELLED')
  // An invoice for this delivery is already in the client's hands. Undoing the
  // delivery behind it would leave them holding a document for goods the system
  // says never left — and the model is explicit that an issued document is
  // corrected by a correcting one, never silently withdrawn.
  const live = liveInvoicesFor(order, shipment.id)
  const reason = opts?.correctionReason?.trim() ?? ''
  if (live.length > 0 && !reason) throw new Error('SHIPMENT_ALREADY_INVOICED')
  // Withdrawing a document the client holds is the "correction" of model section
  // 12, and it is behind a right. An ordinary cancellation of an uninvoiced truck
  // is not — nobody outside the warehouse has been told about it yet.
  const actor = live.length > 0 ? requireRight('correction') : null

  // The goods come back by an opposite movement, never by deleting the sale: the
  // sale happened, and a ledger that forgets it cannot be reconciled with the
  // waybill the client is holding.
  //
  // Checked before anything changes, for the same reason the shipment itself is:
  // a cancellation that marks the shipment cancelled and then fails to return the
  // goods leaves the order saying nothing shipped while the shelf still misses it.
  const returns = mockGetMovementsFor('order-shipment', shipment.id).filter(
    (m) => m.type === 'sale',
  )
  for (const movement of returns) {
    if (!batchById(movement.batchId)) throw new Error('SHIPMENT_BATCH_NOT_FOUND')
  }

  // Everything is checked; from here on it only writes — and it really does now.
  // The withdrawal below used to be refused whenever the invoice had already been
  // adjusted by a price correction ("one document is corrected once"), so a line
  // whose price had been put right could not be shipped back at all. Withdrawing a
  // document and fixing a figure on it are different events, and the second does
  // not close the first — see `mockCreateInvoice` and §4.5.
  for (const invoice of live) {
    mockCreateInvoice(order.id, {
      kind: 'correction',
      correctsInvoiceId: invoice.id,
      reason,
    })
  }

  shipment.cancelled = true
  for (const shipLine of shipment.lines) {
    const item = order.items.find((i) => i.id === shipLine.lineId)
    if (!item) continue
    item.shippedQuantity = Math.max(0, round2(item.shippedQuantity - shipLine.quantity))
    applyPricing(item, syncLineState(toPricingLine(item)))
  }

  for (const movement of returns) {
    writeMovement({
      type: 'return',
      batchId: movement.batchId,
      offcutId: movement.offcutId,
      quantity: movement.quantity,
      unitPrice: movement.unitPrice,
      referenceType: 'order-shipment-cancelled',
      referenceId: shipment.id,
      notes: `Cancelled ${shipment.waybillNumber ?? shipment.number}`,
    })
  }

  if (actor) {
    recordInHistory(
      order,
      { ru: 'Корректировка отгрузки', en: 'Shipment correction', lt: 'Išsiuntimo korekcija' },
      live.map((i) => i.number).join(', '),
      reason,
      actor,
    )
  }

  // The hold goes back on, now that the goods are back on the shelf.
  //
  // Without this the order still owes the client the quantity that came back, but
  // holds nothing against it, and the next order to look at that batch takes the
  // goods — the cancellation would quietly cost the client their place in the
  // queue. Capped by what is really free: while these goods were away somebody
  // else may have claimed the shelf, and a hold that cannot be honoured is worse
  // than none. Whatever cannot go back is left to the "reserve the remainder"
  // button, which is the same operation done deliberately.
  for (const shipLine of shipment.lines) {
    const item = order.items.find((i) => i.id === shipLine.lineId)
    if (!item || !shipLine.heldReleased) continue
    const owed = round2(item.quantity - item.shippedQuantity)
    let left = round2(Math.max(0, owed - reservedForLine(order.id, item.id)))
    for (const hold of shipLine.heldReleased) {
      if (left <= 0) break
      if (!hold.batchId) continue
      const batch = batchById(hold.batchId)
      if (!batch) continue
      const free = computeAvailable(batch.quantityRemaining, reservedOn(hold.batchId))
      const quantity = round2(Math.min(hold.quantity, left, free))
      if (quantity <= 0) continue
      holdOnBatch({
        orderId: order.id,
        lineId: item.id,
        batchId: hold.batchId,
        offcutId: hold.offcutId,
        quantity,
      })
      left = round2(left - quantity)
    }
  }

  recalcOrder(order)
  bumpVersion(order)
  return clone(shipment)
}

// ─── Reservations ───────────────────────────────────────────────────────────

export function mockReserveOrder(
  orderId: string,
  /** The order version the caller was looking at — contract §3. */
  version?: number,
): StockReservation[] {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  assertVersion(order, version)

  const created: StockReservation[] = []
  for (const item of order.items) {
    const unshipped = round2(item.quantity - item.shippedQuantity)
    if (unshipped <= 0) continue
    const already = reservedForLine(order.id, item.id)
    const toReserve = round2(unshipped - already)
    if (toReserve <= 0) continue

    // Reserve against the batches the line is allocated to — but only as much as
    // is REALLY free right now. The breakdown was worked out when the line was
    // added, before anybody had reserved anything, so two orders drafted off the
    // same shelf both planned the same goods. Holding on the strength of that plan
    // is how twenty units get promised out of a batch of ten.
    let left = toReserve
    for (const allocation of item.allocations) {
      if (left <= 0) break
      if (!allocation.batchId) continue
      const batch = batchById(allocation.batchId)
      if (!batch) continue

      // What nobody holds yet — including the holds of other lines of this same
      // order, which are separate claims on the same shelf.
      const free = computeAvailable(batch.quantityRemaining, reservedOn(allocation.batchId))
      const mine = reservedForLineOnBatch(order.id, item.id, allocation.batchId)
      // Never more than the breakdown says, never more than is left to hold, and
      // never more than the shelf can actually back.
      const quantity = round2(Math.min(round2(allocation.quantity - mine), left, free))
      if (quantity <= 0) continue

      created.push(
        holdOnBatch({
          orderId: order.id,
          lineId: item.id,
          batchId: allocation.batchId,
          offcutId: allocation.offcutId,
          quantity,
        }),
      )
      left = round2(left - quantity)
    }

    // The line state is deliberately not touched: reservation lives in its own
    // records, because a line can be partially shipped and hold a reserved
    // remainder at the same time — one enum cannot say both.
  }
  recalcOrder(order)
  bumpVersion(order)
  return created.map((r) => ({ ...r }))
}

export function mockReleaseOrderReservations(orderId: string): void {
  releaseOrder(orderId)
}

// ─── Payments ───────────────────────────────────────────────────────────────

export function mockGetOrderPayments(orderId: string): Payment[] {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  return clone(order.payments)
}

/** The paid percentage is never stored — it is recomputed from these records. */
export function mockAddOrderPayment(
  orderId: string,
  data: {
    amount: number
    purpose?: PaymentPurpose
    paidAt?: string
    invoiceId?: string | null
    note?: string | null
    /** The order version the caller was looking at — contract §3. */
    version?: number
  },
): Payment {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  assertVersion(order, data.version)
  // Before the zero check, because the zero check is where this used to be got
  // around: `round2(NaN)` is NaN, `NaN === 0` is false, and the payment was
  // written with an amount of zero — the very thing the next line refuses.
  requireFiniteNumbers({ amount: data.amount })
  if (data.amount === 0) throw new Error('PAYMENT_AMOUNT_REQUIRED')
  const purpose: PaymentPurpose = data.purpose ?? (data.amount < 0 ? 'refund' : 'balance')
  if (purpose === 'refund' && data.amount > 0) throw new Error('REFUND_MUST_BE_NEGATIVE')
  // A payment against a document nobody issued points at nothing: the panel would
  // show a dash where the invoice number belongs and never say why.
  if (data.invoiceId && !order.invoices.some((i) => i.id === data.invoiceId)) {
    throw new Error('PAYMENT_INVOICE_NOT_FOUND')
  }

  const payment: Payment = {
    id: `${order.id}-PAY-${order._nextPaymentSeq}`,
    orderId: order.id,
    amount: round2(data.amount),
    paidAt: data.paidAt ?? new Date().toISOString(),
    purpose,
    invoiceId: data.invoiceId ?? null,
    note: data.note ?? null,
  }
  order._nextPaymentSeq++
  order.payments.push(payment)
  recalcOrder(order)
  bumpVersion(order)
  return clone(payment)
}

export function mockDeleteOrderPayment(
  orderId: string,
  paymentId: string,
  /** The order version the caller was looking at — contract §3. */
  version?: number,
): void {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  assertVersion(order, version)
  const idx = order.payments.findIndex((p) => p.id === paymentId)
  if (idx === -1) throw new Error('PAYMENT_NOT_FOUND')
  order.payments.splice(idx, 1)
  recalcOrder(order)
  bumpVersion(order)
}

// ─── Invoices ───────────────────────────────────────────────────────────────

export function mockGetInvoices(orderId: string): Invoice[] {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  return clone(order.invoices)
}

/**
 * What a quantity off one line comes to — through the pricing module, from the
 * price the line actually stores.
 *
 * `line.unitPrice` is a projection rounded to four places for display; the price
 * itself is kept at full precision precisely so a spread total lands on the cent
 * (see `allocateTotal`). Billing off the projection put the invoice three cents
 * under its own waybill on a line of 396,1 and five over on one of 999,9.
 */
function shippedLineNet(line: OrderItem, quantity: number): number {
  return calcLine({ ...toPricingLine(line), quantity }).lineNet
}

/** How much of one line the documents the client still holds have charged for. */
function billedQuantityOf(order: StoreOrder, lineId: string): number {
  return order.invoices.reduce((sum, invoice) => {
    if (invoice.kind !== 'regular' || !invoice.shipmentId) return sum
    if (isWithdrawn(order, invoice.id)) return sum
    const shipment = order.shipments.find((s) => s.id === invoice.shipmentId)
    if (!shipment || shipment.cancelled) return sum
    return round2(sum + (shipment.lines.find((l) => l.lineId === lineId)?.quantity ?? 0))
  }, 0)
}

/**
 * What this document may charge for a quantity off one line.
 *
 * Rounding belongs where the sum is NAMED, not on every piece of it (§7), and the
 * sum a line is named at is the line — once, over its whole quantity. Rounded per
 * truck instead, a price of 11,5575 became 11,56 on each of six one-unit
 * shipments: 69,36 billed against an order that says 69,35, a cent on every
 * shipment after the first, and the documents no longer adding up to the order.
 *
 * Cured the way the order total is spread across lines — `allocateTotal` puts the
 * remainder in the last piece. Each document is the running total up to and
 * including it, less the running total before it; the last one absorbs whatever
 * the cent left over, and the documents come to the line exactly however many
 * pieces it left in.
 */
function billableLineNet(line: OrderItem, alreadyBilled: number, quantity: number): number {
  return round2(
    shippedLineNet(line, round2(alreadyBilled + quantity)) - shippedLineNet(line, alreadyBilled),
  )
}

/**
 * Has this document been WITHDRAWN by a correcting one?
 *
 * A corrected invoice is not deleted — the client received it — so "does the
 * client still hold a valid document for this" is a question about corrections,
 * not about the invoice itself.
 *
 * Withdrawn is not the same as corrected, and the difference decides real things.
 * A correction with the mirror amount takes the document back: the two together
 * come to zero and the client holds nothing. A correction with a stated smaller
 * amount only ADJUSTS it — a price fixed after the goods left — and the client is
 * still holding the original. Treated as withdrawn, that second kind would
 * unfreeze the line it just corrected, hand the order's services to the next
 * invoice to bill a second time, and let the order be deleted out from under a
 * document nobody had taken back.
 */
function isWithdrawn(order: StoreOrder, invoiceId: string): boolean {
  return order.invoices.some(
    (i) => i.kind === 'correction' && i.correctsInvoiceId === invoiceId && i.withdrawsOriginal,
  )
}

/**
 * Has it been corrected at all, whichever way?
 *
 * One document is corrected once (model, section 8) — otherwise one invoice would
 * be reversed twice over. That limit counts every correction, not just withdrawals.
 */
function hasCorrection(order: StoreOrder, invoiceId: string): boolean {
  return order.invoices.some((i) => i.kind === 'correction' && i.correctsInvoiceId === invoiceId)
}

/** Invoices the client still holds for this delivery. */
function liveInvoicesFor(order: StoreOrder, shipmentId: string): Invoice[] {
  return order.invoices.filter(
    (i) => i.shipmentId === shipmentId && i.kind !== 'correction' && !isWithdrawn(order, i.id),
  )
}

/**
 * Ordinary documents of this order the client is still holding.
 *
 * An advance is deliberately not one of them: it is a promise to pay ahead, not a
 * charge for work presented, and services do not travel on it.
 */
function liveRegularInvoices(order: StoreOrder): Invoice[] {
  return order.invoices.filter((i) => i.kind === 'regular' && !isWithdrawn(order, i.id))
}

/** Which services a live document has already charged for. */
function billedServiceIds(order: StoreOrder): Set<string> {
  const billed = new Set<string>()
  for (const invoice of liveRegularInvoices(order)) {
    for (const id of invoice.coveredServiceIds) billed.add(id)
  }
  return billed
}

/** Services no live document has charged for — what the next one carries. */
function unbilledServices(order: StoreOrder): OrderService[] {
  const billed = billedServiceIds(order)
  return order.services.filter((s) => !billed.has(s.id))
}

/** Documents the client still holds that charged for this service line. */
function liveInvoicesCoveringService(order: StoreOrder, serviceLineId: string): Invoice[] {
  return liveRegularInvoices(order).filter((i) => i.coveredServiceIds.includes(serviceLineId))
}

/** What a set of service lines comes to, net. */
function servicesNet(services: OrderService[]): number {
  return services.reduce((sum, s) => round2(sum + calcLine(toPricingLine(s)).lineNet), 0)
}

/**
 * What the client is still holding on this document — the invoice and whatever
 * correction has already adjusted it.
 *
 * Withdrawing it mirrors THIS, not the figure it was first issued for: an
 * adjustment left standing against a document that no longer exists is money on
 * no paper, which is the whole disease this module is being treated for.
 */
function outstandingNetOf(order: StoreOrder, invoice: Invoice): number {
  return order.invoices.reduce(
    (sum, i) => (i.correctsInvoiceId === invoice.id ? round2(sum + i.amountNet) : sum),
    invoice.amountNet,
  )
}

/**
 * An invoice is tied to a shipment, which is why adding lines after one is
 * issued is not a problem: the new lines leave on their own truck and land on
 * their own invoice. A correcting invoice is only for fixing an issued one.
 */
export function mockCreateInvoice(
  orderId: string,
  data: {
    kind?: InvoiceKind
    shipmentId?: string | null
    correctsInvoiceId?: string | null
    amountNet?: number
    /** What the client pays. Converted here, so the caller never does VAT arithmetic. */
    amountGross?: number
    reason?: string | null
    /** The order version the caller was looking at — contract §3. */
    version?: number
  },
): Invoice {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  assertVersion(order, data.version)
  const kind: InvoiceKind = data.kind ?? 'regular'
  const reason = data.reason?.trim() ?? ''

  // Services never ship, so no delivery can carry them: they ride on an ordinary
  // invoice of the order — the same document that freezes them, because the
  // amount and the freeze have to be one decision, or a service ends up frozen by
  // a document that never charged for it.
  //
  // WHICH services is decided here, once, and recorded: those no live document has
  // charged for yet. "The first regular invoice carries them" was one rule too
  // many — a service added to a live order afterwards (model §6 allows it) could
  // then never reach a document at all, while every correction froze it against
  // the document that had charged for none of it (§4.6).
  const carried = kind === 'regular' ? unbilledServices(order) : []

  // An ordinary invoice is billed off a delivery — for GOODS. Services do not
  // ship, so there is no waybill to demand of them: an invoice that carries
  // nothing but unbilled services stands on its own (§4.6), and its amount comes
  // from them. It is still an ordinary invoice and not an advance — an advance is
  // a promise to pay ahead, and this is work done and presented.
  if (kind === 'regular' && !data.shipmentId && carried.length === 0) {
    throw new Error('INVOICE_NEEDS_SHIPMENT')
  }
  // An advance is paid before anything ships — a shipment of its own would make
  // it an ordinary invoice, and the delivery would then be billed twice.
  if (kind === 'advance' && data.shipmentId) throw new Error('ADVANCE_HAS_NO_SHIPMENT')

  let original: Invoice | undefined
  if (kind === 'correction') {
    if (!data.correctsInvoiceId) throw new Error('CORRECTION_NEEDS_ORIGINAL')
    // The reason travels to the client's accountant with the document. "The
    // amount changed" is not something they can file, so it is mandatory.
    if (!reason) throw new Error('CORRECTION_REASON_REQUIRED')
    original = order.invoices.find((i) => i.id === data.correctsInvoiceId)
    if (!original) throw new Error('ORIGINAL_INVOICE_NOT_FOUND')
    // A correction corrects an issued document, not another correction.
    if (original.kind === 'correction') throw new Error('CANNOT_CORRECT_A_CORRECTION')
    // Taken back once: a second withdrawal would reverse the same document twice
    // over, and there is nothing left of it to take back anyway.
    if (isWithdrawn(order, original.id)) throw new Error('INVOICE_ALREADY_CORRECTED')
    // A stated amount ADJUSTS the document, and one document is adjusted once.
    // Withdrawing it afterwards is a different event and stays open: returning a
    // delivery must not be barred by a price somebody put right (§4.5). Read as
    // one rule, "corrected once" made a corrected line impossible to ship back.
    if (statedNet(order, data) !== undefined && hasCorrection(order, original.id)) {
      throw new Error('INVOICE_ALREADY_CORRECTED')
    }
  } else if (data.correctsInvoiceId) {
    throw new Error('CORRECTION_NEEDS_KIND')
  }

  // Mirror amount → the document is taken back. Stated amount → it is adjusted and
  // the client goes on holding it. See `withdrawsOriginal`.
  const stated = original ? statedNet(order, data) : undefined
  const withdrawsOriginal = original !== undefined && stated === undefined

  let net: number
  if (original) {
    // Withdrawing the document means the mirror image of what the client is
    // holding — see `outstandingNetOf`. An explicit amount is still allowed — a
    // price corrected downwards is a partial correction — but the default is the
    // whole thing, because that is what a cancellation is.
    net = stated ?? round2(-outstandingNetOf(order, original))
  } else if (data.shipmentId) {
    const shipment = order.shipments.find((s) => s.id === data.shipmentId)
    if (!shipment) throw new Error('SHIPMENT_NOT_FOUND')
    // Goods that came back cannot be billed.
    if (shipment.cancelled) throw new Error('SHIPMENT_CANCELLED')
    // One delivery, one invoice — a second one would bill the client twice. A
    // corrected one no longer counts: the client is not holding it any more.
    if (liveInvoicesFor(order, shipment.id).length > 0) {
      throw new Error('SHIPMENT_ALREADY_INVOICED')
    }
    // The amount comes from the delivery, not from the caller: an invoice that
    // disagrees with its own waybill is the thing this whole model avoids.
    const goods = shipment.lines.reduce((sum, sl) => {
      const line = order.items.find((i) => i.id === sl.lineId)
      if (!line) return sum
      return round2(sum + billableLineNet(line, billedQuantityOf(order, sl.lineId), sl.quantity))
    }, 0)
    net = round2(goods + servicesNet(carried))
  } else if (kind === 'regular') {
    // Nothing but services — the case above with no delivery under it.
    net = servicesNet(carried)
  } else {
    const amount = statedNet(order, data)
    if (amount === undefined) throw new Error('INVOICE_AMOUNT_REQUIRED')
    net = amount
  }

  const gross = netToGross(net, order.vatMode, order.vatPercent)
  const invoice: Invoice = {
    id: `${order.id}-INV-${order._nextInvoiceSeq}`,
    orderId: order.id,
    number: `${order.orderNumber}/INV-${order._nextInvoiceSeq}`,
    issuedAt: new Date().toISOString(),
    kind,
    // A correction belongs to the same delivery as the document it withdraws,
    // even when the caller only names the invoice.
    shipmentId: data.shipmentId ?? original?.shipmentId ?? null,
    correctsInvoiceId: data.correctsInvoiceId ?? null,
    withdrawsOriginal,
    // What this document charged for, decided once and travelling with it.
    coveredServiceIds: carried.map((s) => s.id),
    amountNet: net,
    amountVat: round2(gross - net),
    amountGross: gross,
    reason: reason || null,
  }
  order._nextInvoiceSeq++
  order.invoices.push(invoice)

  if (kind === 'correction') {
    // The document has been withdrawn, so what it froze is frozen no longer —
    // unless another live invoice still covers it. Without this the "correction"
    // operation would be pointless: the line it exists to fix stays uneditable.
    refreshDocumentFreeze(order)

    // A withdrawal takes the services it carried off paper with it, and they have
    // to land somewhere. While the client holds no other ordinary document for
    // this order, nothing is stranded: the next regular invoice picks them up the
    // ordinary way. But when other deliveries are already invoiced, that next
    // invoice need never come — every delivery has its document — and the money
    // sits on nothing at all (§4.6, finding 4). So the withdrawal puts it straight
    // back on an ordinary invoice of its own, which needs no delivery under it.
    const released = original?.coveredServiceIds ?? []
    if (
      withdrawsOriginal &&
      released.length > 0 &&
      liveRegularInvoices(order).length > 0 &&
      unbilledServices(order).length > 0
    ) {
      mockCreateInvoice(order.id, { kind: 'regular' })
    }
  } else {
    // Everything on an issued invoice is frozen from now on — including services,
    // which never ship and would otherwise stay editable forever.
    if (invoice.shipmentId) {
      const shipment = order.shipments.find((s) => s.id === invoice.shipmentId)
      shipment?.lines.forEach((sl) => {
        const item = order.items.find((i) => i.id === sl.lineId)
        if (item) item.documentIssued = true
      })
    }
    // Only the services this document actually billed, and no others: a service
    // the invoice predates was never charged for by it.
    carried.forEach((s) => {
      s.documentIssued = true
    })
  }

  recalcOrder(order)
  bumpVersion(order)
  return clone(invoice)
}

/** The amount the caller stated, net — from either field, never from both. */
function statedNet(
  order: StoreOrder,
  data: { amountNet?: number; amountGross?: number },
): number | undefined {
  if (data.amountNet !== undefined && data.amountGross !== undefined) {
    throw new Error('INVOICE_AMOUNT_AMBIGUOUS')
  }
  if (data.amountNet !== undefined) return round2(data.amountNet)
  if (data.amountGross !== undefined) {
    return round2(grossToNet(data.amountGross, order.vatMode, order.vatPercent))
  }
  return undefined
}

/**
 * Recomputes `documentIssued` on every line and service from the invoices that
 * are still live.
 *
 * Derived rather than toggled: a line can be covered by two invoices, and
 * clearing the flag when one of them is corrected would unfreeze a line the
 * client still holds a document for.
 */
function refreshDocumentFreeze(order: StoreOrder): void {
  const live = order.invoices.filter((i) => i.kind !== 'correction' && !isWithdrawn(order, i.id))
  const covered = new Set<string>()
  for (const invoice of live) {
    if (!invoice.shipmentId) continue
    const shipment = order.shipments.find((s) => s.id === invoice.shipmentId)
    shipment?.lines.forEach((sl) => covered.add(sl.lineId))
  }
  for (const item of order.items) {
    item.documentIssued = covered.has(item.id)
    applyPricing(item, syncLineState(toPricingLine(item)))
  }
  // A service is frozen by the one document that billed IT, and by no other — a
  // question about that service, never about "some invoice covers services".
  const billed = billedServiceIds(order)
  for (const service of order.services) {
    service.documentIssued = billed.has(service.id)
  }
}

// Last in the file, and it has to be: the showcase drives the real endpoints, and
// those read counters and helpers declared further down. Called any earlier it
// walks into the temporal dead zone of the first one it touches.
buildShowcaseOrder()
