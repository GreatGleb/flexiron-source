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
} from '@/types/order'
import type { StockAuditEntry, StockReservation } from '@/types/warehouse'
import type { PaginatedResponse, PaginationParams } from '@/types/api'
import {
  type PricingLine,
  calcLine,
  round2,
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
  computeAvailable,
  syncLineState,
} from '@/domain/orderPricing'
import {
  buildOrderItem as buildItem,
  buildOrderService as buildService,
  toPricingLine,
  applyPricing,
  projectItem,
  projectService,
  pricingSeedFor,
  splitAllocations,
  stockCostFor,
} from '@/services/orderLines'
import {
  applyLineEdit,
  canDeleteLine,
  deltaToOps,
  type LineEditDelta,
} from '@/services/orderLineEdits'
import {
  findReservations,
  holdOnBatch,
  releaseFromLine,
  releaseLine,
  releaseOrder,
  reservedForLine,
  reservedForLineOnBatch,
  reservedOn,
} from './reservations'
import { mockGetClients, registerClientOrderLookup } from './clients'
import { shiftDemoDate } from './demoClock'
import { mockGetSettings } from './settings'
import { STORE as PRODUCTS_STORE } from './products'
import {
  batchById,
  batchesForProduct,
  mockFifoAllocation,
  mockGetMovementsFor,
  recordShortage,
  writeMovement,
} from './warehouse'
import { allServices, serviceById } from './services'

interface StoreOrder extends Order {
  _nextLineSeq: number
  _nextServiceSeq: number
  _nextShipmentSeq: number
  _nextInvoiceSeq: number
  _nextPaymentSeq: number
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
 * The nine hand-built scenarios are exempt: their quantities are the illustration
 * itself — ORD-001 comes to 22 990,00, and that figure is quoted in the plans, in
 * the tests and in every explanation of what this rework fixed.
 */
function generatedQuantity(prod: ProductSpec, rng: () => number, isScenario: boolean): number {
  const fractional = prod.unit === 'kg' || prod.unit === 'm'
  const invented = fractional
    ? Math.round((10 + rng() * 490) * 10) / 10
    : 1 + Math.floor(rng() * 50)
  if (isScenario) return invented
  const onShelf = batchesForProduct(prod.id).reduce((sum, b) => sum + b.quantityRemaining, 0)
  if (onShelf <= 0) return invented
  const share = onShelf * (0.02 + rng() * 0.08)
  const capped = Math.min(invented, share)
  return fractional ? Math.max(0.1, Math.round(capped * 10) / 10) : Math.max(1, Math.floor(capped))
}

/** How many orders at the head of the store are hand-built illustrations. */
const SCENARIO_ORDER_COUNT = 9

const PRODUCTS: ProductSpec[] = [
  { id: 'prod-001', name: 'Steel Sheet 3mm', unit: 'pcs', price: 120.5 },
  { id: 'prod-002', name: 'Steel Pipe 50mm', unit: 'm', price: 45.0 },
  { id: 'prod-003', name: 'Aluminum Profile 2m', unit: 'pcs', price: 85.0 },
  { id: 'prod-004', name: 'Stainless Coil 304', unit: 'coil', price: 4500.0 },
  { id: 'prod-005', name: 'Beam HEA 200', unit: 'pcs', price: 320.0 },
  { id: 'prod-006', name: 'Galvanized Sheet 2mm', unit: 'pcs', price: 75.0 },
  { id: 'prod-007', name: 'Rebar 12mm A500C', unit: 'kg', price: 0.85 },
  { id: 'prod-008', name: 'Angle Bar 50x50mm', unit: 'm', price: 8.5 },
  { id: 'prod-009', name: 'Flat Bar 30x5mm', unit: 'm', price: 4.2 },
  { id: 'prod-010', name: 'Square Tube 40x40x2mm', unit: 'm', price: 6.75 },
  { id: 'prod-011', name: 'Steel Sheet 5mm S355', unit: 'pcs', price: 210.0 },
  { id: 'prod-012', name: 'Steel Sheet 8mm S355', unit: 'pcs', price: 340.0 },
  { id: 'prod-013', name: 'Steel Sheet 10mm S235', unit: 'pcs', price: 410.0 },
  { id: 'prod-014', name: 'Steel Sheet 12mm S355', unit: 'pcs', price: 540.0 },
  { id: 'prod-015', name: 'Steel Sheet 16mm S355', unit: 'pcs', price: 720.0 },
  { id: 'prod-016', name: 'Stainless Sheet AISI 304 2mm', unit: 'pcs', price: 380.0 },
  { id: 'prod-017', name: 'Aluminium Sheet AMg2 2mm', unit: 'pcs', price: 195.0 },
  { id: 'prod-018', name: 'Aluminium Sheet D16 4mm', unit: 'pcs', price: 280.0 },
  { id: 'prod-019', name: 'Steel Pipe 100x5', unit: 'm', price: 78.0 },
  { id: 'prod-020', name: 'Steel Pipe 25x3', unit: 'm', price: 18.5 },
  { id: 'prod-021', name: 'Steel Pipe 60x4', unit: 'm', price: 42.0 },
  { id: 'prod-022', name: 'Welding Wire 1.2mm', unit: 'kg', price: 3.5 },
  { id: 'prod-023', name: 'Beam IPE 300', unit: 'pcs', price: 580.0 },
  { id: 'prod-024', name: 'Beam HEB 200', unit: 'pcs', price: 460.0 },
  { id: 'prod-025', name: 'Channel UPN 200', unit: 'pcs', price: 310.0 },
  { id: 'prod-026', name: 'Galvanized Sheet 1.5mm', unit: 'pcs', price: 58.0 },
  { id: 'prod-027', name: 'Wire Rod 8mm', unit: 'kg', price: 0.72 },
  { id: 'prod-028', name: 'Mesh Reinforcement 100x100x6', unit: 'pcs', price: 95.0 },
  { id: 'prod-029', name: 'Round Bar 20mm', unit: 'm', price: 12.0 },
  { id: 'prod-030', name: 'Square Bar 15mm', unit: 'm', price: 9.8 },
]

/**
 * The service catalogue, read live — see `serviceById`.
 *
 * There is no copy of it here on purpose. The copy that used to live in this file
 * knew five services and fell back to the first of them for anything else, so a
 * service created later came into an order under someone else's name and someone
 * else's cost, and a cost corrected in the services page never arrived at all.
 */
function serviceEntry(id: string): { name: string; cost: number; price: number } {
  const svc = serviceById(id)
  if (!svc) throw new Error('SERVICE_NOT_FOUND')
  const lang =
    typeof localStorage !== 'undefined' ? localStorage.getItem('flexiron_lang') || 'en' : 'en'
  return {
    name: svc.name[lang as keyof typeof svc.name] ?? svc.name.en,
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
      const initLang =
        typeof localStorage !== 'undefined' ? localStorage.getItem('flexiron_lang') || 'en' : 'en'
      // The first nine are the hand-built scenarios — see `applyScenario`.
      const qty = generatedQuantity(prod, rng, i < SCENARIO_ORDER_COUNT)
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
          productName:
            fullProd?.name?.[initLang as keyof typeof fullProd.name] ??
            fullProd?.name?.en ??
            prod.name,
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
                exchangeRate: a.exchangeRate,
                source: a.source,
              }))
            : undefined,
          ...pricingSeedFor(unitCost, prod.price),
          discountPercent: discount,
          receivedCurrency: fullProd?.currencyId ?? 'cur-eur',
          exchangeRate: 1,
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

    const auditLog: StockAuditEntry[] = [
      {
        timestamp: createdAt.slice(0, 16).replace('T', ' '),
        user: { ru: 'Система', en: 'System', lt: 'Sistema' },
        userInitials: 'SY',
        property: { ru: 'Заказ создан', en: 'Order created', lt: 'Užsakymas sukurtas' },
        oldValue: '',
        newValue: `ORD-2026-${seq}`,
      },
    ]
    if (status !== 'new') {
      auditLog.push({
        timestamp: updatedAt.slice(0, 16).replace('T', ' '),
        user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
        userInitials: 'IN',
        property: { ru: 'Статус', en: 'Status', lt: 'Būsena' },
        oldValue: 'new',
        newValue: status,
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
      defaultMarginPercent: 15,
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
      _nextLineSeq: items.length + 1,
      _nextServiceSeq: services.length + 1,
      _nextShipmentSeq: 1,
      _nextInvoiceSeq: 1,
      _nextPaymentSeq: 1,
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
    case 6:
      first.manualUnitCost = round2(first.unitCost * 1.08)
      first.manualCostReason = 'Batch not booked in — supplier invoice price used'
      first.unitCost = first.manualUnitCost
      first.costSource = 'manual'
      first.allocations = []
      return

    // ORD-008 — export, zero-rated.
    case 7:
      order.documentType = 'export'
      order.vatMode = 'export_zero'
      return

    // ORD-009 — the full story: two trucks, an invoice, a part payment.
    case 8: {
      if (order.items.length < 2) {
        const template = order.items[0]!
        order.items.push(
          buildItem({
            id: `${order.id}-oi-extra`,
            lineNumber: order.items.length + 1,
            productId: template.productId,
            productName: template.productName,
            quantity: 4,
            unit: template.unit,
            unitCost: template.unitCost,
            marginPercent: template.marginPercent,
            receivedCurrency: template.receivedCurrency,
            exchangeRate: template.exchangeRate,
          }),
        )
        order._nextLineSeq = order.items.length + 1
      }
      const [lineA, lineB] = [order.items[0]!, order.items[1]!]
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

// "Can this client be deleted?" is a question about orders, so the orders module
// answers it. Registered rather than imported the other way round: clients know
// nothing about orders, and a cycle here would decide at import time whether the
// demo store exists.
registerClientOrderLookup((clientId) =>
  STORE.filter((o) => o.clientId === clientId).map((o) => ({ id: o.id })),
)

let nextSeq = TOTAL_ORDERS + 1

function nextId(): string {
  return `ORD-${String(nextSeq++).padStart(3, '0')}`
}

function clone<T>(data: T): T {
  return JSON.parse(JSON.stringify(data))
}

/** Strips the store's own bookkeeping — a real server would not send it. */
function publicOrder(order: StoreOrder): Order {
  const copy = clone(order) as StoreOrder & Record<string, unknown>
  for (const key of Object.keys(copy)) {
    if (key.startsWith('_')) delete copy[key]
  }
  return copy as Order
}

// ─── List ───

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

  // Apply sorting
  const sortBy = filters.sortBy
  const sortDir = filters.sortDir === 'desc' ? -1 : 1
  if (sortBy) {
    filtered.sort((a, b) => {
      let va: string | number
      let vb: string | number
      switch (sortBy) {
        case 'orderNumber':
          va = a.orderNumber
          vb = b.orderNumber
          break
        case 'clientName':
          va = a.clientName
          vb = b.clientName
          break
        case 'status':
          va = a.status
          vb = b.status
          break
        case 'totalAmount':
          va = a.totalAmount
          vb = b.totalAmount
          break
        // Sorted by what the column actually shows: with VAT modes differing per
        // order, the net order and the gross order are not the same order.
        case 'totalWithVat':
          va = a.totalWithVat
          vb = b.totalWithVat
          break
        case 'paidPercent':
          va = a.paidPercent
          vb = b.paidPercent
          break
        case 'shippedPercent':
          va = a.shippedPercent
          vb = b.shippedPercent
          break
        case 'createdAt':
          va = a.createdAt
          vb = b.createdAt
          break
        default:
          return 0
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
    defaultMarginPercent: 15,
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
        timestamp: new Date().toISOString(),
        user: { ru: 'Система', en: 'System', lt: 'Sistema' },
        userInitials: 'SY',
        property: { ru: 'Заказ создан', en: 'Order created', lt: 'Užsakymas sukurtas' },
        oldValue: '',
        newValue: orderNumber,
      } as StockAuditEntry,
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _nextLineSeq: 1,
    _nextServiceSeq: 1,
    _nextShipmentSeq: 1,
    _nextInvoiceSeq: 1,
    _nextPaymentSeq: 1,
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
  // invoice and the lines disagree.
  recalcOrder(order)
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

export function mockPatchOrderStatus(id: string, status: OrderStatus): Order {
  const order = STORE.find((o) => o.id === id)
  if (!order) throw new Error('ORDER_NOT_FOUND')
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
  order.updatedAt = new Date().toISOString()
  order.auditLog.push({
    timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
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
): void {
  order.auditLog.push({
    timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
    user: { ru: user.name, en: user.name, lt: user.name },
    userInitials: user.initials,
    property,
    oldValue,
    newValue,
  })
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
export function mockDeleteOrder(id: string): void {
  const idx = STORE.findIndex((o) => o.id === id)
  if (idx === -1) return
  const order = STORE[idx]!
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
  },
): OrderItem {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  // Look up product name from the full products STORE with current locale, fall back to local PRODUCTS catalog
  const currentLang =
    typeof localStorage !== 'undefined' ? localStorage.getItem('flexiron_lang') || 'en' : 'en'
  const fullProduct = PRODUCTS_STORE.find((p) => p.id === data.productId)
  let productName =
    fullProduct?.name?.[currentLang as keyof typeof fullProduct.name] ?? fullProduct?.name?.en
  if (!productName) {
    productName = PRODUCTS.find((p) => p.id === data.productId)?.name ?? data.productId
  }
  // The caller hands over a selling price; cost and margin are what the model
  // actually stores, so the margin is derived to land on that price.
  //
  // The cost itself is read off the warehouse, oldest batches first — through the
  // same `stockCostFor` the card runs before Save, so the row does not change
  // under the admin the moment it is stored. A product with no batches has no
  // cost, and gets none: an invented number dressed up as a warehouse figure is
  // worse than no number at all, and two sides inventing separately is worse still.
  const fifo = mockFifoAllocation(data.productId, data.quantity)
  const { unitCost, costSource } = stockCostFor(
    data.unitCost ?? fifo.weightedUnitCost,
    fifo.shortageQuantity > 0,
  )

  // What the warehouse cannot cover is written down as a shortage: the order can
  // be taken, but nobody may ship goods that are not there, and a shortage with
  // no record is one nobody will ever buy.
  if (fifo.shortageQuantity > 0) {
    recordShortage({
      productId: data.productId,
      productName: productName ?? data.productId,
      quantity: fifo.shortageQuantity,
      unit: data.unit,
      orderId: order.id,
    })
  }

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
    receivedCurrency: fullProduct?.currencyId ?? 'cur-eur',
    exchangeRate: 1,
    batchId: data.batchId ?? null,
    // Which batches this line consumes. FIFO routinely spans several, and without
    // the breakdown a partial shipment cannot write off the very batches it took.
    allocations: data.batchId
      ? undefined
      : fifo.allocations.map((a) => ({
          batchId: a.batchId,
          offcutId: a.offcutId,
          quantity: a.quantity,
          unitCost: a.unitCost,
          currency: a.currency,
          exchangeRate: a.exchangeRate,
          source: a.source,
        })),
  })
  // Checked BEFORE it goes into the store: `recalcOrder` validates every line and
  // throws, and a line pushed first would stay behind and take every later
  // recalculation of this order down with it.
  validateLine(toPricingLine(item))
  order._nextLineSeq++
  order.items.push(item)
  recalcOrder(order)
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
  delta: LineEditDelta,
): OrderItem {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  const idx = order.items.findIndex((i) => i.id === lineId)
  if (idx === -1) throw new Error('ORDER_ITEM_NOT_FOUND')

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
  for (const op of deltaToOps(delta, 'item')) {
    applyLineEdit(draft, op, { defaultDiscountPercent: order.defaultDiscountPercent })
  }

  // Non-pricing fields pass through untouched.
  if (delta.productName !== undefined) draft.productName = delta.productName
  if (delta.unit !== undefined) draft.unit = delta.unit
  if (delta.weightPerUnitKg !== undefined) draft.weightPerUnitKg = delta.weightPerUnitKg
  if (delta.allocations !== undefined) draft.allocations = delta.allocations.map((a) => ({ ...a }))

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
    )
  }
  // A grown line gets batches for the units it gained; a shrunk one gives its
  // surplus hold back. Holding MORE stays the reservation's job, not an edit's.
  topUpAllocation(orderId, draft)
  trimHoldToLine(orderId, draft)
  recalcOrder(order)
  return clone(draft)
}

/** Same rules for services — they are lines like any other. */
export function mockUpdateOrderService(
  orderId: string,
  serviceLineId: string,
  delta: LineEditDelta,
): OrderService {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  const idx = order.services.findIndex((s) => s.id === serviceLineId)
  if (idx === -1) throw new Error('ORDER_SERVICE_NOT_FOUND')

  const draft = clone(order.services[idx]!)
  for (const op of deltaToOps(delta, 'service')) {
    applyLineEdit(draft, op, { defaultDiscountPercent: order.defaultDiscountPercent })
  }

  order.services[idx] = draft
  recalcOrder(order)
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
export function mockDeleteOrderItem(orderId: string, lineId: string): void {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  const idx = order.items.findIndex((i) => i.id === lineId)
  if (idx === -1) throw new Error('ORDER_ITEM_NOT_FOUND')
  assertDeletable(order.items[idx]!)
  order.items.splice(idx, 1)
  // The line is gone; anything it was holding is nobody's and goes back.
  releaseLine(orderId, lineId)
  recalcOrder(order)
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
  data: { serviceId: string; quantity: number; price?: number; discountPercent?: number },
): OrderService {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
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
  return clone(service)
}

/** Same rules as `mockDeleteOrderItem`: an unknown id is a refusal, and a service
 *  the client has an invoice for is not removed behind the document's back. */
export function mockDeleteOrderService(orderId: string, serviceId: string): void {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  const idx = order.services.findIndex((s) => s.id === serviceId)
  if (idx === -1) throw new Error('ORDER_SERVICE_NOT_FOUND')
  assertDeletable(order.services[idx]!)
  order.services.splice(idx, 1)
  recalcOrder(order)
}

// ─── Audit ───

export function mockDeleteOrderAuditEntry(orderId: string, entryIndex: number): void {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  if (entryIndex >= 0 && entryIndex < order.auditLog.length) {
    order.auditLog.splice(entryIndex, 1)
  }
}

// ─── Files ───

let fileSeq = 1

export function mockAddOrderFile(
  orderId: string,
  fileId: string,
  originalName?: string,
): OrderFile {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
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
  return structuredClone(file)
}

export function mockRemoveOrderFile(orderId: string, fileId: string): void {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  const idx = order.files.findIndex((f) => f.fileId === fileId)
  if (idx !== -1) {
    order.files.splice(idx, 1)
  }
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
): {
  order: Order
  requestedGross: number
  achievedGross: number
  rows: Array<{ lineId: string; before: number; after: number }>
} {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')

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
  return {
    order: publicOrder(order),
    requestedGross: result.requestedGross,
    achievedGross: result.achievedGross,
    rows: result.rows,
  }
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
): { shipped: OrderItem; remainder: OrderItem } {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  const idx = order.items.findIndex((i) => i.id === lineId)
  if (idx === -1) throw new Error('ORDER_ITEM_NOT_FOUND')
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
 * Tops the batch breakdown up to cover the whole line.
 *
 * A line that grows needs batches for the units it just gained, or they can be
 * neither reserved nor shipped and nobody is told why. Only the shortfall is
 * planned: the part already worked out — and especially the part already shipped
 * — is left exactly as it is, so an edit cannot re-plan goods that have gone.
 *
 * This runs on a partially shipped line too, and must: "the truck has left and
 * the client wants two more" is the case the whole model is built around. Adding
 * to the end of the breakdown cannot disturb the prefix the first truck took.
 * Freezing applies to the COST, which is not touched here.
 *
 * The cost is deliberately NOT re-read. The card applies the same edit locally to
 * show the result at once, and it has no shelf to read; a cost that moved only on
 * the server would make the preview disagree with what was stored.
 */
function topUpAllocation(orderId: string, item: OrderItem): void {
  const covered = round2(item.allocations.reduce((sum, a) => sum + a.quantity, 0))
  const missing = round2(item.quantity - covered)
  if (missing <= 0) return

  const fifo = mockFifoAllocation(item.productId, missing, {
    exceptLine: { orderId, lineId: item.id },
  })
  if (fifo.allocations.length === 0) return

  // One entry per batch, kept in the order the batches are consumed. Two entries
  // for the same batch would still add up, but every rule expressed per entry —
  // how much of it is already shipped, how much of it is held — would then be
  // reading half the story.
  const merged = [...item.allocations]
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
      exchangeRate: a.exchangeRate,
      source: a.source,
    })
  }
  item.allocations = merged
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
  },
): Shipment {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
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
    lines: data.lines.map((l) => ({ ...l })),
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
    // write-off. Recorded on the line, because cancelling has to put back exactly
    // this much off exactly these batches.
    const released = releaseFromLine(order.id, item.id, shipLine.quantity)
    if (released.length > 0) shipLine.heldReleased = released
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
  opts?: { correctionReason?: string | null },
): Shipment {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
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

  // Everything is checked; from here on it only writes.
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
  return clone(shipment)
}

// ─── Reservations ───────────────────────────────────────────────────────────

export function mockReserveOrder(orderId: string): StockReservation[] {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')

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
  },
): Payment {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
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
  return clone(payment)
}

export function mockDeleteOrderPayment(orderId: string, paymentId: string): void {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  const idx = order.payments.findIndex((p) => p.id === paymentId)
  if (idx === -1) throw new Error('PAYMENT_NOT_FOUND')
  order.payments.splice(idx, 1)
  recalcOrder(order)
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
  },
): Invoice {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  const kind: InvoiceKind = data.kind ?? 'regular'
  const reason = data.reason?.trim() ?? ''

  if (kind === 'regular' && !data.shipmentId) throw new Error('INVOICE_NEEDS_SHIPMENT')
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
    // A correction corrects an issued document, not another correction — and only
    // once, or two withdrawals of one invoice would reverse it twice over.
    if (original.kind === 'correction') throw new Error('CANNOT_CORRECT_A_CORRECTION')
    if (hasCorrection(order, original.id)) throw new Error('INVOICE_ALREADY_CORRECTED')
  } else if (data.correctsInvoiceId) {
    throw new Error('CORRECTION_NEEDS_KIND')
  }

  // Services never ship, so no delivery can carry them: they go on the FIRST
  // regular invoice of the order — the same document that freezes them. Decided
  // once, here, and recorded on the invoice: worked out separately, the amount and
  // the freeze disagreed, and every service in the order was frozen by a document
  // that had charged for none of them.
  const coversServices =
    kind === 'regular' &&
    !order.invoices.some((i) => i.coversServices && !isWithdrawn(order, i.id))

  // Mirror amount → the document is taken back. Stated amount → it is adjusted and
  // the client goes on holding it. See `withdrawsOriginal`.
  const stated = original ? statedNet(order, data) : undefined
  const withdrawsOriginal = original !== undefined && stated === undefined

  let net: number
  if (original) {
    // Withdrawing the document means the mirror image of it. An explicit amount
    // is still allowed — a price corrected downwards is a partial correction —
    // but the default is the whole thing, because that is what a cancellation is.
    net = stated ?? round2(-original.amountNet)
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
      return line ? round2(sum + shippedLineNet(line, sl.quantity)) : sum
    }, 0)
    const services = coversServices
      ? order.services.reduce((sum, s) => round2(sum + calcLine(toPricingLine(s)).lineNet), 0)
      : 0
    net = round2(goods + services)
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
    coversServices,
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
    // Only the document that actually billed them freezes them — see `coversServices`.
    if (coversServices) {
      order.services.forEach((s) => {
        s.documentIssued = true
      })
    }
  }

  recalcOrder(order)
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
  // A service is frozen by the one document that billed it, and by no other.
  const servicesBilled = live.some((i) => i.coversServices)
  for (const service of order.services) {
    service.documentIssued = servicesBilled
  }
}
