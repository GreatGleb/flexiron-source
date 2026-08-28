import { describe, it, expect, afterEach } from 'vitest'
import {
  mockGetOrders,
  mockGetOrder,
  mockCreateOrder,
  mockAddOrderItem,
  mockUpdateOrderItem,
  mockAddOrderService,
  mockUpdateOrderService,
  mockAllocateOrderTotal,
  mockSplitOrderItem,
  mockCorrectOrderLine,
  mockCreateShipment,
  mockCancelShipment,
  mockReserveOrder,
  mockGetReservations,
  mockAddOrderPayment,
  mockGetOrderPayments,
  mockCreateInvoice,
  mockOrderScenarios,
  mockPatchOrder,
  mockPatchOrderStatus,
  mockPlanOrderShipment,
  mockPlanStatusTransition,
  mockDeleteOrderItem,
  mockDeleteOrderService,
  mockDeleteOrderPayment,
  mockReservedQuantity,
  mockReleaseOrderReservations,
  mockGetShipments,
  mockGetInvoices,
  mockGetClientInvoiceSummary,
  mockDeleteOrder,
  mockGetSalesCrmStats,
  mockAddOrderFile,
  mockRemoveOrderFile,
} from './orders'
import { mockGetClients, mockPatchClient } from './clients'
import { mockGetSettings, mockSaveSettings } from './settings'
import { mockCreateService, mockPatchService } from './services'
import {
  batchById,
  batchesForProduct,
  mockCalculateFifoCost,
  mockCreateBatch,
  mockDeleteBatch,
  mockGetMovementsFor,
} from './warehouse'
import { calcLine, round2, validateLine, netToGross } from '@/domain/orderPricing'
import { invoiceBalances } from '@/domain/receivable'
import { countsAsSale } from '@/domain/orderStatus'
import { toPricingLine } from '@/services/orderLines'
import type { Order } from '@/types/order'
import type { UserProfile } from '@/types/settings'

// ─── The shelf these tests price against ────────────────────────────────────
//
// A line's cost is the warehouse's answer, and the orders API takes none from
// the body (contract §4.2): the cost, the batch breakdown and the provenance
// mark are all produced by FIFO over what is really on the shelf. So the 100,00
// this file has always costed its prod-001 lines at is stated where a cost
// actually lives — on the batches behind that product — and every line built
// below is handed exactly the figure it used to be sent with.
//
// Both batches are priced alike on purpose: how much of the older one is free
// varies as tests reserve and ship, and a line that spills into the second one
// must still come to the same cost per unit.
const STOCK_UNIT_COST = 100
for (const batch of batchesForProduct('prod-001')) {
  batch.unitPrice = STOCK_UNIT_COST
  batch.totalCost = batch.quantity * STOCK_UNIT_COST
}

/**
 * A catalogue product the warehouse holds nothing of.
 *
 * It has to be a real one. An id the catalogue does not know is refused outright
 * (`CATALOG_PRODUCT_NOT_FOUND`, the rule services have always had), so "nothing
 * in stock" cannot be said by inventing a product — only by naming one whose
 * shelf is empty.
 */
const PRODUCT_OUT_OF_STOCK = 'prod-043'

/**
 * Makes a batch hold exactly `quantity` free units, and cost that much a unit.
 *
 * Seeding the warehouse is the only way to ask for a particular breakdown: FIFO
 * produces it, the orders API cannot be told it. Returns the undo, because every
 * other test in this file reads the same shelves.
 */
function shelve(batchId: string, quantity: number, unitCost = STOCK_UNIT_COST): () => void {
  const batch = batchById(batchId)!
  const stashed = { unitPrice: batch.unitPrice, quantityRemaining: batch.quantityRemaining }
  batch.unitPrice = unitCost
  batch.quantityRemaining = round2(mockReservedQuantity(batchId) + quantity)
  return () => Object.assign(batch, stashed)
}

function allOrders(): Order[] {
  const page = mockGetOrders(
    {
      search: '',
      status: 'all',
      clientId: null,
      dateFrom: '',
      dateTo: '',
      sortBy: null,
      sortDir: 'asc',
    },
    { page: 1, pageSize: 1000 },
  )
  return page.items.map((i) => mockGetOrder(i.id)!).filter(Boolean)
}

function netOf(order: Order): number {
  return [...order.items, ...order.services].reduce(
    (sum, line) => round2(sum + calcLine(toPricingLine(line)).lineNet),
    0,
  )
}

/** A fresh order nobody else's test has touched. */
function freshOrder(): Order {
  const client = mockGetClients()[0]!
  return mockCreateOrder({ clientId: client.id, documentType: 'local' })
}

function orderWithLine(quantity = 10, unitPrice = 120): { order: Order; lineId: string } {
  const created = freshOrder()
  const item = mockAddOrderItem(created.id, {
    productId: 'prod-001',
    quantity,
    unit: 'pcs',
    unitPrice,
  })
  return { order: mockGetOrder(created.id)!, lineId: item.id }
}

// ─── Generated data ─────────────────────────────────────────────────────────

describe('the generated store', () => {
  const orders = allOrders()

  it('produces 100 orders', () => {
    expect(orders.length).toBe(100)
  })

  it('holds no refund that names no document', () => {
    // Линза Л4: мок держится того же правила, что приложение. Модель отказывает
    // безымянному возврату (пункт 14) — значит собственные данные демо не имеют
    // права его содержать, иначе первый же открытый заказ нарушает правило,
    // которое приложение объявляет.
    const unnamed = orders.flatMap((o) =>
      o.payments.filter((p) => p.amount < 0 && !p.invoiceId).map((p) => `${o.id}/${p.id}`),
    )
    expect(unnamed).toEqual([])
  })

  it('sells above cost, because a business that does not is not a demo of one', () => {
    // Every line was internally consistent and collectively absurd: the cost came
    // off warehouse batches priced with no reference to anything, and the price
    // came from a THIRD copy of the product catalogue in which the same ids meant
    // different goods — prod-007 was rebar at 0,85 in one and an angle grinder at
    // 89,00 in the other. One line in six was sold below cost, the worst at 115×
    // below, and every margin figure in the app was reporting it faithfully.
    const priced = orders
      .flatMap((order) => order.items)
      .filter((line) => line.unitCost > 0)
      .map((line) => ({ line, margin: calcLine(toPricingLine(line)).actualMarginPercent }))

    expect(priced.length).toBeGreaterThan(200)
    const belowCost = priced.filter((row) => row.margin < 0)
    expect(belowCost).toEqual([])
    // And not absurd in the other direction either: a 2 000% markup is the same
    // disconnect seen from the profitable side.
    expect(priced.every((row) => row.margin < 90)).toBe(true)
  })

  it('trades in quantities somebody could plausibly order', () => {
    // Quantity was drawn from 1–50 without looking at the price, so an order for
    // forty overhead cranes at 185 000 apiece came to two million euro and every
    // sales chart was shaped by it.
    for (const order of orders) {
      expect(order.totalWithVat).toBeLessThan(1_000_000)
    }
  })

  it('has no impossible line anywhere', () => {
    for (const order of orders) {
      for (const line of [...order.items, ...order.services]) {
        expect(() => validateLine(toPricingLine(line))).not.toThrow()
      }
    }
  })

  it('always has the total equal to the sum of its lines', () => {
    for (const order of orders) {
      expect(order.totalAmount).toBe(netOf(order))
      expect(order.totalWithVat).toBe(round2(order.totalAmount + order.totalVat))
    }
  })

  it('projects the legacy fields from the pricing fields, never independently', () => {
    for (const order of orders) {
      for (const item of order.items) {
        const totals = calcLine(toPricingLine(item))
        expect(item.unitPrice).toBe(totals.unitPrice)
        expect(item.totalPrice).toBe(totals.lineNet)
        expect(item.discount).toBe(item.discountPercent)
      }
      for (const svc of order.services) {
        const totals = calcLine(toPricingLine(svc))
        expect(svc.cost).toBe(svc.unitCost)
        expect(svc.price).toBe(totals.unitPrice)
        expect(svc.marginAmount).toBe(totals.marginAmount)
      }
    }
  })

  it('charges VAT on the net total, and nothing on a zero-rated order', () => {
    for (const order of orders) {
      const expected =
        order.vatMode === 'standard' ? round2(order.totalAmount * (order.vatPercent / 100)) : 0
      expect(order.totalVat).toBe(expected)
    }
  })

  it('never stores a paid percentage that could go stale', () => {
    for (const order of orders) {
      const paid = round2(order.payments.reduce((sum, p) => sum + p.amount, 0))
      expect(order.paidAmount).toBe(paid)
      expect(order.outstandingAmount).toBe(round2(order.totalWithVat - paid))
    }
  })

  it('exposes the list with paid and shipped shares', () => {
    const page = mockGetOrders(
      {
        search: '',
        status: 'all',
        clientId: null,
        dateFrom: '',
        dateTo: '',
        sortBy: null,
        sortDir: 'asc',
      },
      { page: 1, pageSize: 5 },
    )
    for (const row of page.items) {
      expect(typeof row.paidPercent).toBe('number')
      expect(typeof row.shippedPercent).toBe('number')
      // The list shows what the client pays, and it has to be the card's figure.
      const card = mockGetOrder(row.id)!
      expect(row.totalWithVat).toBe(card.totalWithVat)
      expect(row.paidPercent).toBe(card.paidPercent)
    }
  })

  it('sorts by the columns the list actually offers', () => {
    const sorted = (sortBy: string, sortDir: 'asc' | 'desc') =>
      mockGetOrders(
        { search: '', status: 'all', clientId: null, dateFrom: '', dateTo: '', sortBy, sortDir },
        { page: 1, pageSize: 100 },
      ).items
    // A sort key the mock does not know silently returns the store order, which
    // reads as "sorting is broken" and is impossible to tell from a tie.
    for (const key of ['totalWithVat', 'paidPercent', 'shippedPercent'] as const) {
      const asc = sorted(key, 'asc').map((r) => r[key])
      const desc = sorted(key, 'desc').map((r) => r[key])
      expect(asc).toEqual([...asc].sort((a, b) => a - b))
      expect(desc).toEqual([...desc].sort((a, b) => b - a))
    }
  })

  it('invents no weight — the value stays hand-entered while products have none', () => {
    for (const order of orders) {
      expect(order.items.every((i) => i.weightPerUnitKg === null)).toBe(true)
      expect(order.totalWeight).toBe(0)
    }
  })

  it("carries each client's own payment terms, not one value for the whole store", () => {
    const terms = new Map(mockGetClients().map((c) => [c.id, c.paymentTermsDays]))
    for (const order of orders) {
      expect(order.clientPaymentTermsDays).toBe(terms.get(order.clientId))
    }
    // Иначе утверждение выше устраивает константа: если бы каждый заказ и каждый
    // клиент несли одни и те же 30 дней, оно было бы верным и без подстановки.
    expect(new Set(orders.map((o) => o.clientPaymentTermsDays)).size).toBeGreaterThan(1)
  })
})

// ─── Условия оплаты клиента (пункт 9 плана `review-followups.md`) ────────────

describe('payment terms pulled from the client', () => {
  it('a new order takes the terms of the client it is created for', () => {
    // По одному клиенту на каждое встреченное значение отсрочки: совпадение с
    // константой так не проходит — значения заведомо разные.
    const byTerms = new Map(mockGetClients().map((c) => [c.paymentTermsDays, c]))
    expect(byTerms.size).toBeGreaterThan(1)

    for (const [days, client] of byTerms) {
      const order = mockCreateOrder({ clientId: client.id, documentType: 'local' })
      expect(order.clientPaymentTermsDays).toBe(days)
    }
  })

  it('keeps the terms the order was placed on when the client is renegotiated later', () => {
    const client = mockGetClients().find((c) => c.paymentTermsDays > 0)!
    const agreed = client.paymentTermsDays
    const order = mockCreateOrder({ clientId: client.id, documentType: 'local' })

    try {
      mockPatchClient(client.id, { paymentTermsDays: agreed + 15 })
      // Счёт этого заказа не становится просроченным задним числом оттого, что
      // клиенту сократили или продлили отсрочку после оформления.
      expect(mockGetOrder(order.id)!.clientPaymentTermsDays).toBe(agreed)
    } finally {
      mockPatchClient(client.id, { paymentTermsDays: agreed })
    }
  })

  it('refuses terms that no calendar can express', () => {
    const client = mockGetClients()[0]!
    expect(() => mockPatchClient(client.id, { paymentTermsDays: -1 })).toThrow(/paymentTermsDays/)
    expect(() => mockPatchClient(client.id, { paymentTermsDays: 14.5 })).toThrow(/paymentTermsDays/)
    expect(() => mockPatchClient(client.id, { paymentTermsDays: NaN })).toThrow(/paymentTermsDays/)
    // И запись не состоялась: отказ — это отказ, а не «записал и пожаловался».
    expect(mockGetClients().find((c) => c.id === client.id)!.paymentTermsDays).toBe(
      client.paymentTermsDays,
    )
  })
})

// ─── Scenarios on fixed numbers ─────────────────────────────────────────────

describe('scenario orders', () => {
  it('are listed so they can be opened by number', () => {
    expect(mockOrderScenarios().map((s) => s.id)).toEqual([
      'ORD-001',
      'ORD-002',
      'ORD-003',
      'ORD-004',
      'ORD-005',
      'ORD-006',
      'ORD-007',
      'ORD-008',
      'ORD-009',
      // The showcase, which the list opens on — see `buildShowcaseOrder`. Named
      // here so it can be found by number like the other nine.
      'ORD-100',
    ])
  })

  it('ORD-001 — plain, nothing edited', () => {
    const order = mockGetOrder('ORD-001')!
    expect(order.items.every((i) => i.manualUnitPrice === null)).toBe(true)
    expect(order.effectiveDiscountPercent).toBe(0)
  })

  it('ORD-002 — one discount for the whole order, and the money shows it', () => {
    const order = mockGetOrder('ORD-002')!
    expect(order.defaultDiscountPercent).toBe(5)
    // Not exactly 5: the effective discount is one number over the whole order,
    // and every line's money is rounded to cents on the way. It used to land on 5
    // exactly, which was the demo quantities being lucky rather than a rule.
    expect(order.effectiveDiscountPercent).toBeCloseTo(5, 2)
    expect(order.items.every((i) => i.discountPercent === 5)).toBe(true)

    // The total really is 95% of the undiscounted price — not just a flag saying so.
    const beforeDiscount = [...order.items, ...order.services].reduce(
      (sum, line) => sum + line.unitCost * (1 + line.marginPercent / 100) * line.quantity,
      0,
    )
    expect(order.totalAmount).toBeCloseTo(beforeDiscount * 0.95, 1)
    // A discount edit materialises into a manual price, so a later cost refresh
    // cannot move what was already promised.
    expect(order.items.every((i) => i.manualUnitPrice !== null)).toBe(true)
  })

  it('ORD-003 — a manual price on the first line only', () => {
    const order = mockGetOrder('ORD-003')!
    expect(order.items[0]!.manualUnitPrice).not.toBeNull()
    expect(order.items.slice(1).every((i) => i.manualUnitPrice === null)).toBe(true)
  })

  it('ORD-004 — partially shipped, and frozen because of it', () => {
    const order = mockGetOrder('ORD-004')!
    const line = order.items[0]!
    expect(line.state).toBe('partially_shipped')
    expect(line.shippedQuantity).toBeGreaterThan(0)
    expect(line.shippedQuantity).toBeLessThan(line.quantity)
    expect(order.shipments.length).toBe(1)
    expect(order.shipments[0]!.waybillNumber).toBeTruthy()
    // The waybill quantity and the line agree — otherwise the document lies.
    expect(order.shipments[0]!.lines[0]!.quantity).toBe(line.shippedQuantity)
    expect(() => mockUpdateOrderItem(order.id, line.id, { manualUnitPrice: 1 })).toThrow(
      'PRICE_FROZEN_BY_SHIPMENT',
    )
  })

  it('ORD-005 — a quarter paid up front', () => {
    const order = mockGetOrder('ORD-005')!
    expect(order.payments.length).toBe(1)
    expect(order.payments[0]!.purpose).toBe('advance')
    expect(order.paidPercent).toBeCloseTo(25, 1)
  })

  it('ORD-006 — paid in full leaves nothing outstanding, and says so', () => {
    const order = mockGetOrder('ORD-006')!
    expect(order.paidPercent).toBe(100)
    expect(order.outstandingAmount).toBe(0)
    // Prepaid in full before anything ships — an ordinary situation, and the
    // status has to reflect it rather than falling back to "confirmed".
    expect(order.status).toBe('paid')
  })

  it('ORD-007 — a manual cost carries its reason', () => {
    const line = mockGetOrder('ORD-007')!.items[0]!
    expect(line.costSource).toBe('manual')
    expect(line.manualUnitCost).not.toBeNull()
    expect(line.manualCostReason).toBeTruthy()
  })

  it('ORD-008 — export is zero-rated, so the client pays the net', () => {
    const order = mockGetOrder('ORD-008')!
    expect(order.vatMode).toBe('export_zero')
    expect(order.totalVat).toBe(0)
    expect(order.totalWithVat).toBe(order.totalAmount)
  })

  it('ORD-009 — two trucks, an invoice, a part payment', () => {
    const order = mockGetOrder('ORD-009')!
    expect(order.shipments.length).toBe(2)
    // Two documents, not one: the proforma the prepayment was made against, and
    // the invoice for the first truck. Money that names no document is money the
    // incoming registry cannot see — the order read "paid" while the registry
    // showed its own invoice overdue and nothing received (plan item 13).
    expect(order.invoices).toHaveLength(2)
    const proforma = order.invoices.find((i) => i.kind === 'advance')!
    expect(order.payments.map((p) => p.invoiceId)).toEqual([proforma.id])
    const forTheTruck = order.invoices.find((i) => i.kind === 'regular')!
    expect(forTheTruck.shipmentId).toBe(order.shipments[0]!.id)
    expect(order.paidPercent).toBeCloseTo(40, 0)
    // Found through the shipments rather than by position: which lines the two
    // trucks took depends on what the shelf could back.
    const invoiced = order.items.find((i) => i.id === order.shipments[0]!.lines[0]!.lineId)!
    // The invoiced line is frozen by the document the client holds.
    expect(invoiced.documentIssued).toBe(true)
    const secondTruck = order.items.find((i) => i.id === order.shipments[1]!.lines[0]!.lineId)!
    expect(secondTruck.state).toBe('partially_shipped')
  })
})

// ─── Line edits go through the pricing rules ────────────────────────────────

describe('line edits', () => {
  it('a price edit becomes a discount and keeps the planned margin', () => {
    const { order, lineId } = orderWithLine()
    const updated = mockUpdateOrderItem(order.id, lineId, { manualUnitPrice: 108 })
    expect(updated.discountPercent).toBe(10)
    expect(updated.marginPercent).toBe(20)
    expect(updated.totalPrice).toBe(1080)
  })

  it('a line-total edit is the same edit from the other side', () => {
    const { order, lineId } = orderWithLine()
    const updated = mockUpdateOrderItem(order.id, lineId, { lineTotal: 1080 })
    expect(updated.discountPercent).toBe(10)
    expect(updated.totalPrice).toBe(1080)
  })

  it('a margin edit reprices and releases the lock', () => {
    const { order, lineId } = orderWithLine()
    mockUpdateOrderItem(order.id, lineId, { manualUnitPrice: 108 })
    const updated = mockUpdateOrderItem(order.id, lineId, { marginPercent: 50 })
    expect(updated.manualUnitPrice).toBeNull()
    expect(updated.unitPrice).toBe(135) // 100 × 1.5 × 0.9 — the discount survives
  })

  it('reset takes the line back to cost plus margin', () => {
    const { order, lineId } = orderWithLine()
    mockUpdateOrderItem(order.id, lineId, { manualUnitPrice: 108 })
    const updated = mockUpdateOrderItem(order.id, lineId, { resetPrice: true })
    expect(updated.discountPercent).toBe(0)
    expect(updated.unitPrice).toBe(120)
  })

  it('a manual cost without a reason is refused', () => {
    const { order, lineId } = orderWithLine()
    expect(() => mockUpdateOrderItem(order.id, lineId, { manualUnitCost: 130 })).toThrow(
      'MANUAL_COST_REASON_REQUIRED',
    )
  })

  it('a manual cost with a reason moves the margin, not the price', () => {
    const { order, lineId } = orderWithLine()
    mockUpdateOrderItem(order.id, lineId, { manualUnitPrice: 108 })
    const updated = mockUpdateOrderItem(order.id, lineId, {
      manualUnitCost: 130,
      manualCostReason: 'Batch not booked in',
    })
    expect(updated.unitPrice).toBe(108)
    expect(updated.unitCost).toBe(130)
    expect(updated.costSource).toBe('manual')
  })

  it('services follow the same rules', () => {
    const created = freshOrder()
    const svc = mockAddOrderService(created.id, { serviceId: 'svc-001', quantity: 2, price: 12 })
    const updated = mockUpdateOrderService(created.id, svc.id, { discountPercent: 10 })
    expect(updated.price).toBe(10.8)
    expect(updated.totalPrice).toBe(21.6)
  })

  it('refuses to edit the price of a shipped line', () => {
    const { order, lineId } = orderWithLine()
    mockCreateShipment(order.id, { lines: [{ lineId, quantity: 10 }] })
    expect(() => mockUpdateOrderItem(order.id, lineId, { manualUnitPrice: 50 })).toThrow(
      'PRICE_FROZEN_BY_SHIPMENT',
    )
  })
})

// ─── Total allocation ───────────────────────────────────────────────────────

describe('allocating a manual total', () => {
  it('lands on the target and reports what the order really comes to', () => {
    const { order } = orderWithLine(10, 120) // net 1200, gross 1452
    const result = mockAllocateOrderTotal(order.id, 1210)
    expect(result.achievedGross).toBe(1210)
    expect(result.order.totalWithVat).toBe(1210)
    expect(result.order.totalAmount).toBe(1000)
    expect(netOf(result.order)).toBe(1000)
    expect(result.rows.length).toBe(1)
  })

  it('says so when the requested gross cannot exist', () => {
    const { order } = orderWithLine(10, 120)
    const result = mockAllocateOrderTotal(order.id, 100)
    expect(result.requestedGross).toBe(100)
    expect(result.achievedGross).toBe(99.99)
    expect(result.order.totalWithVat).toBe(99.99)
  })

  it('leaves shipped lines alone and refuses to go below them', () => {
    const created = freshOrder()
    const shippedLine = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 3,
      unit: 'pcs',
      unitPrice: 100,
    })
    mockAddOrderItem(created.id, {
      productId: 'prod-002',
      quantity: 7,
      unit: 'm',
      unitPrice: 100,
    })
    mockCreateShipment(created.id, { lines: [{ lineId: shippedLine.id, quantity: 3 }] })

    const result = mockAllocateOrderTotal(created.id, netToGross(900, 'standard', 21))
    expect(result.rows.map((r) => r.lineId)).toEqual([result.rows[0]!.lineId])
    expect(result.order.items[0]!.totalPrice).toBe(300)
    expect(result.order.items[1]!.totalPrice).toBe(600)

    expect(() => mockAllocateOrderTotal(created.id, netToGross(200, 'standard', 21))).toThrow(
      'BELOW_FROZEN_MINIMUM',
    )
  })
})

// ─── The mock stands in for the server ──────────────────────────────────────

describe('server authority', () => {
  it('ignores derived numbers a client tries to dictate', () => {
    const { order } = orderWithLine(10, 120) // net 1200
    const patched = mockPatchOrder(order.id, {
      totalAmount: 99,
      totalWithVat: 99,
      totalVat: 0,
      paidPercent: 100,
      effectiveDiscountPercent: 50,
      notes: 'kept',
    } as Partial<Order>)

    expect(patched.totalAmount).toBe(1200)
    expect(patched.totalWithVat).toBe(1452)
    expect(patched.paidPercent).toBe(0)
    expect(patched.effectiveDiscountPercent).toBe(0)
    expect(patched.notes).toBe('kept')
  })

  it('still accepts the legacy field names the current card sends', () => {
    const { order } = orderWithLine()
    const patched = mockPatchOrder(order.id, { marginPercent: 30, orderDiscount: 7 })
    expect(patched.defaultMarginPercent).toBe(30)
    expect(patched.defaultDiscountPercent).toBe(7)
  })

  it('reports a missing order instead of guessing', () => {
    expect(() => mockAllocateOrderTotal('nope', 100)).toThrow('ORDER_NOT_FOUND')
  })

  it('splits the batch breakdown along with the goods', () => {
    // Six free units on the older batch, so FIFO spans two of them: the breakdown
    // is the warehouse's, and the only way to ask for this one is to put the
    // goods where it would find them.
    const created = freshOrder()
    const unshelve = shelve('whb-001', 6)
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 120,
    })
    unshelve()
    expect(item.allocations.map((a) => [a.batchId, a.quantity])).toEqual([
      ['whb-001', 6],
      ['whb-002', 4],
    ])
    mockCreateShipment(created.id, { lines: [{ lineId: item.id, quantity: 6 }] })

    const { shipped, remainder } = mockSplitOrderItem(created.id, item.id, 6)
    expect(shipped.allocations.map((a) => [a.batchId, a.quantity])).toEqual([['whb-001', 6]])
    expect(remainder.allocations.map((a) => [a.batchId, a.quantity])).toEqual([['whb-002', 4]])
  })
})

// ─── Splitting ──────────────────────────────────────────────────────────────

describe('splitting a partially shipped line', () => {
  it('keeps the money and frees the remainder', () => {
    const { order, lineId } = orderWithLine(10, 120)
    mockCreateShipment(order.id, { lines: [{ lineId, quantity: 6 }] })
    const before = mockGetOrder(order.id)!.totalAmount

    const { shipped, remainder } = mockSplitOrderItem(order.id, lineId, 6)
    const after = mockGetOrder(order.id)!

    expect(shipped.quantity).toBe(6)
    expect(shipped.state).toBe('shipped')
    expect(remainder.quantity).toBe(4)
    expect(remainder.state).toBe('draft')
    expect(after.totalAmount).toBe(before)
    expect(after.items.map((i) => i.lineNumber)).toEqual([1, 2])

    // The freed remainder can be repriced; the shipped part cannot.
    expect(() =>
      mockUpdateOrderItem(order.id, remainder.id, { manualUnitPrice: 100 }),
    ).not.toThrow()
    expect(() => mockUpdateOrderItem(order.id, shipped.id, { manualUnitPrice: 100 })).toThrow(
      'PRICE_FROZEN_BY_SHIPMENT',
    )
  })
})

// ─── Shipments ──────────────────────────────────────────────────────────────

describe('shipments', () => {
  it('move the line state along with the quantities', () => {
    const { order, lineId } = orderWithLine(10)
    mockCreateShipment(order.id, { lines: [{ lineId, quantity: 6 }] })
    expect(mockGetOrder(order.id)!.items[0]!.state).toBe('partially_shipped')

    mockCreateShipment(order.id, { lines: [{ lineId, quantity: 4 }] })
    const finished = mockGetOrder(order.id)!
    expect(finished.items[0]!.state).toBe('shipped')
    expect(finished.shipments.length).toBe(2)
  })

  it('cannot ship more than is left', () => {
    const { order, lineId } = orderWithLine(10)
    expect(() => mockCreateShipment(order.id, { lines: [{ lineId, quantity: 11 }] })).toThrow(
      'SHIPMENT_EXCEEDS_REMAINING',
    )
    mockCreateShipment(order.id, { lines: [{ lineId, quantity: 10 }] })
    expect(() => mockCreateShipment(order.id, { lines: [{ lineId, quantity: 1 }] })).toThrow(
      'SHIPMENT_EXCEEDS_REMAINING',
    )
  })

  it('refuses an empty shipment', () => {
    const { order } = orderWithLine()
    expect(() => mockCreateShipment(order.id, { lines: [] })).toThrow('SHIPMENT_HAS_NO_LINES')
  })

  it('are cancelled by reversal, never deleted', () => {
    const { order, lineId } = orderWithLine(10)
    const shipment = mockCreateShipment(order.id, { lines: [{ lineId, quantity: 10 }] })

    mockCancelShipment(order.id, shipment.id)
    const after = mockGetOrder(order.id)!
    expect(after.shipments.length).toBe(1)
    expect(after.shipments[0]!.cancelled).toBe(true)
    expect(after.items[0]!.shippedQuantity).toBe(0)
    expect(after.items[0]!.state).toBe('draft')

    expect(() => mockCancelShipment(order.id, shipment.id)).toThrow('SHIPMENT_ALREADY_CANCELLED')
  })
})

// ─── Reservations ───────────────────────────────────────────────────────────

describe('reservations', () => {
  it('hold stock without moving it, and are released by the shipment', () => {
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 120,
      batchId: 'whb-001',
    })

    mockReserveOrder(created.id)
    expect(mockGetReservations({ orderId: created.id }).length).toBe(1)
    // Reservation is a record, not a line state — the line is still a draft.
    expect(mockGetOrder(created.id)!.items[0]!.state).toBe('draft')

    mockCreateShipment(created.id, { lines: [{ lineId: item.id, quantity: 10 }] })
    expect(mockGetReservations({ orderId: created.id }).length).toBe(0)
  })

  it('reserve nothing for a line with no batch behind it, and say so', () => {
    // Nothing of this product is in the warehouse, so the line has no breakdown —
    // there is no shelf to hold anything on.
    const created = freshOrder()
    mockAddOrderItem(created.id, {
      productId: PRODUCT_OUT_OF_STOCK,
      quantity: 10,
      unit: 'pcs',
      unitPrice: 120,
    })
    expect(mockGetOrder(created.id)!.items[0]!.allocations).toEqual([])
    mockReserveOrder(created.id)
    expect(mockGetReservations({ orderId: created.id }).length).toBe(0)
    expect(mockGetOrder(created.id)!.items[0]!.state).toBe('draft')
  })

  it('hold only what is left to ship, however many batches the line spans', () => {
    // Six free on the older shelf, so FIFO takes this line from two batches.
    const created = freshOrder()
    const unshelve = shelve('whb-001', 6)
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 120,
    })
    unshelve()
    expect(item.allocations.length).toBe(2)
    mockCreateShipment(created.id, { lines: [{ lineId: item.id, quantity: 6 }] })

    mockReserveOrder(created.id)
    const held = mockGetReservations({ orderId: created.id }).reduce((s, r) => s + r.quantity, 0)
    // 4 left to ship: walking the batches without decrementing would hold 10.
    expect(held).toBe(4)
  })

  it('refuse a breakdown bigger than the line itself', () => {
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 5,
      unit: 'pcs',
      unitPrice: 120,
    })
    // The breakdown is warehouse data and the orders API does not take it at all
    // any more (contract §4.2) — so a breakdown of nine against a line of five is
    // now refused one step earlier, by the field rather than by its size. The
    // line is untouched, which is the point either way.
    expect(() =>
      mockUpdateOrderItem(created.id, item.id, {
        allocations: [
          {
            batchId: 'whb-001',
            offcutId: null,
            quantity: 9,
            unitCost: 100,
            currency: 'cur-eur',
            source: 'stock',
          },
        ],
      }),
    ).toThrow('ALLOCATIONS_NOT_ACCEPTED')
    const after = mockGetOrder(created.id)!.items[0]!
    expect(round2(after.allocations.reduce((sum, a) => sum + a.quantity, 0))).toBe(5)
  })
})

// ─── Payments ───────────────────────────────────────────────────────────────

describe('payments', () => {
  it('the advance share falls by itself when the order grows', () => {
    const created = freshOrder()
    mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 100,
    })
    // net 1000, gross 1210
    mockAddOrderPayment(created.id, { amount: 302.5, purpose: 'advance' })
    expect(mockGetOrder(created.id)!.paidPercent).toBe(25)

    mockAddOrderItem(created.id, {
      productId: 'prod-002',
      quantity: 10,
      unit: 'm',
      unitPrice: 100,
    })
    const grown = mockGetOrder(created.id)!
    expect(grown.paidPercent).toBe(12.5)
    expect(grown.outstandingAmount).toBe(round2(grown.totalWithVat - 302.5))
  })

  it('records a refund as a negative amount, and only against a document', () => {
    const { order } = orderWithLine()
    // Пункт 14: пришедшие деньги могут не называть документ, ушедшие — обязаны.
    expect(() => mockAddOrderPayment(order.id, { amount: -50, purpose: 'refund' })).toThrow(
      'REFUND_INVOICE_REQUIRED',
    )
    const invoice = mockCreateInvoice(order.id, { kind: 'advance', amountGross: 500 })
    mockAddOrderPayment(order.id, { amount: -50, purpose: 'refund', invoiceId: invoice.id })
    expect(mockGetOrderPayments(order.id)[0]!.amount).toBe(-50)
    expect(() =>
      mockAddOrderPayment(order.id, { amount: 50, purpose: 'refund', invoiceId: invoice.id }),
    ).toThrow('REFUND_MUST_BE_NEGATIVE')
  })

  it('refuses a refund that names no document however the purpose was arrived at', () => {
    // Назначение платежа выводится из знака суммы, когда его не назвали: минус —
    // это возврат. Правило пункта 14 обязано держаться и на этом пути, иначе
    // безымянный возврат заходит через дверь, которую забыли запереть.
    const { order } = orderWithLine()
    expect(() => mockAddOrderPayment(order.id, { amount: -50 })).toThrow('REFUND_INVOICE_REQUIRED')
    expect(mockGetOrderPayments(order.id)).toEqual([])
  })

  it('refuses a payment of nothing', () => {
    const { order } = orderWithLine()
    expect(() => mockAddOrderPayment(order.id, { amount: 0 })).toThrow('PAYMENT_AMOUNT_REQUIRED')
  })
})

// ─── Invoices ───────────────────────────────────────────────────────────────

describe('invoices', () => {
  it('cover a shipment and freeze what the client now holds on paper', () => {
    const { order, lineId } = orderWithLine(10, 120)
    const svc = mockAddOrderService(order.id, { serviceId: 'svc-001', quantity: 1, price: 12 })
    const shipment = mockCreateShipment(order.id, { lines: [{ lineId, quantity: 10 }] })

    const invoice = mockCreateInvoice(order.id, { shipmentId: shipment.id })
    // 1200 of goods off the waybill plus the 12 of service that rides with them:
    // the service never ships, so this is the only document that can carry it —
    // and it is the same document that freezes it below.
    expect(invoice.coveredServiceIds).toHaveLength(1)
    expect(invoice.amountNet).toBe(1212)
    expect(invoice.amountGross).toBe(netToGross(1212, 'standard', 21))
    // Nothing is left unbilled: what the client owes is what the documents say.
    expect(invoice.amountGross).toBe(mockGetOrder(order.id)!.totalWithVat)

    const after = mockGetOrder(order.id)!
    expect(after.items[0]!.documentIssued).toBe(true)
    // The service never ships, so only the invoice can freeze it.
    expect(after.services.find((s) => s.id === svc.id)!.documentIssued).toBe(true)
    expect(() => mockUpdateOrderService(order.id, svc.id, { discountPercent: 5 })).toThrow(
      'PRICE_FROZEN_BY_SHIPMENT',
    )
  })

  it('adds up to the waybill to the cent on a quantity that hides decimals', () => {
    // A price with more than two decimals is the ordinary result of spreading a
    // manual total, and 396,1 units turn the hidden ones into cents. Billed off
    // the four-decimal display value, this invoice came to 39 999,97 against an
    // order of exactly 40 000,00 — the one thing an invoice may never do.
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 396.1,
      unit: 'pcs',
      unitPrice: 120.5,
    })
    mockAllocateOrderTotal(created.id, 40000)
    const stored = mockGetOrder(created.id)!.items[0]!
    // The premise: the price really does carry more than four decimals.
    expect(round2(stored.manualUnitPrice! * 396.1)).toBe(stored.totalPrice)
    expect(round2(stored.unitPrice * 396.1)).not.toBe(stored.totalPrice)

    const shipment = mockCreateShipment(created.id, {
      lines: [{ lineId: item.id, quantity: 396.1 }],
    })
    const invoice = mockCreateInvoice(created.id, { shipmentId: shipment.id })
    const order = mockGetOrder(created.id)!

    expect(invoice.amountNet).toBe(order.items[0]!.totalPrice)
    expect(invoice.amountNet).toBe(order.totalAmount)
    expect(invoice.amountGross).toBe(40000)

    // The shelf goes back to where the test found it — every other test in this
    // file reads the same batches, and a line this size would move their costs.
    mockCancelShipment(created.id, shipment.id, { correctionReason: 'Test teardown' })
  })

  it('carries the services on the first regular invoice and on no other', () => {
    const created = freshOrder()
    const a = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 4,
      unit: 'pcs',
      unitPrice: 100,
    })
    const b = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 6,
      unit: 'pcs',
      unitPrice: 100,
    })
    mockAddOrderService(created.id, { serviceId: 'svc-001', quantity: 1, price: 12 })

    const first = mockCreateShipment(created.id, { lines: [{ lineId: a.id, quantity: 4 }] })
    const invoiceA = mockCreateInvoice(created.id, { shipmentId: first.id })
    expect(invoiceA.coveredServiceIds).toHaveLength(1)
    expect(invoiceA.amountNet).toBe(412)

    const second = mockCreateShipment(created.id, { lines: [{ lineId: b.id, quantity: 6 }] })
    const invoiceB = mockCreateInvoice(created.id, { shipmentId: second.id })
    // Billed once, not once per truck.
    expect(invoiceB.coveredServiceIds).toEqual([])
    expect(invoiceB.amountNet).toBe(600)

    // Every cent of the order is on a document the client holds. The service used
    // to be on none of them and frozen by both.
    const order = mockGetOrder(created.id)!
    expect(round2(invoiceA.amountNet + invoiceB.amountNet)).toBe(order.totalAmount)

    mockCancelShipment(created.id, second.id, { correctionReason: 'Test teardown' })
    mockCancelShipment(created.id, first.id, { correctionReason: 'Test teardown' })
  })

  it('unfreezes the services when the document that billed them is withdrawn', () => {
    const created = freshOrder()
    const line = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 4,
      unit: 'pcs',
      unitPrice: 100,
    })
    const svc = mockAddOrderService(created.id, { serviceId: 'svc-001', quantity: 1, price: 12 })
    const shipment = mockCreateShipment(created.id, { lines: [{ lineId: line.id, quantity: 4 }] })
    const invoice = mockCreateInvoice(created.id, { shipmentId: shipment.id })
    expect(mockGetOrder(created.id)!.services[0]!.documentIssued).toBe(true)

    mockCreateInvoice(created.id, {
      kind: 'correction',
      correctsInvoiceId: invoice.id,
      reason: 'Wrong client address on the document',
    })
    // The client is not holding it any more, so the service is editable again —
    // and the next regular invoice will bill it.
    expect(mockGetOrder(created.id)!.services[0]!.documentIssued).toBe(false)
    expect(() => mockUpdateOrderService(created.id, svc.id, { discountPercent: 5 })).not.toThrow()

    mockCancelShipment(created.id, shipment.id)
  })

  it('an adjusting correction leaves the document standing, a mirror one takes it back', () => {
    const created = freshOrder()
    const line = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 4,
      unit: 'pcs',
      unitPrice: 100,
    })
    const shipment = mockCreateShipment(created.id, { lines: [{ lineId: line.id, quantity: 4 }] })
    const invoice = mockCreateInvoice(created.id, { shipmentId: shipment.id })
    expect(invoice.withdrawsOriginal).toBe(false)

    // A stated amount fixes a figure on a document the client is STILL holding.
    const adjustment = mockCreateInvoice(created.id, {
      kind: 'correction',
      correctsInvoiceId: invoice.id,
      amountNet: -40,
      reason: 'Price agreed at 90,00',
    })
    expect(adjustment.withdrawsOriginal).toBe(false)
    // Read as a withdrawal, this unfroze the line it had just corrected and freed
    // the order's services to be billed a second time.
    expect(mockGetOrder(created.id)!.items[0]!.documentIssued).toBe(true)
    // And the order still cannot be deleted: the client holds a document.
    expect(() => mockDeleteOrder(created.id)).toThrow('ORDER_HAS_INVOICE')
  })

  it('a regular invoice needs a shipment, a correction needs an original', () => {
    const { order } = orderWithLine()
    expect(() => mockCreateInvoice(order.id, { kind: 'regular' })).toThrow('INVOICE_NEEDS_SHIPMENT')
    expect(() => mockCreateInvoice(order.id, { kind: 'correction', amountNet: 10 })).toThrow(
      'CORRECTION_NEEDS_ORIGINAL',
    )
  })

  it('an advance invoice stands on its own amount', () => {
    const { order } = orderWithLine()
    const invoice = mockCreateInvoice(order.id, { kind: 'advance', amountNet: 500 })
    expect(invoice.shipmentId).toBeNull()
    expect(invoice.amountNet).toBe(500)
    expect(() => mockCreateInvoice(order.id, { kind: 'advance' })).toThrow(
      'INVOICE_AMOUNT_REQUIRED',
    )
  })
})

// ─── Removing lines ─────────────────────────────────────────────────────────

describe('removing a line', () => {
  it('drops the total by that line and leaves the others exactly as they were', () => {
    const created = freshOrder()
    const keep = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 5,
      unit: 'pcs',
      unitPrice: 100,
    })
    const drop = mockAddOrderItem(created.id, {
      productId: 'prod-002',
      quantity: 3,
      unit: 'm',
      unitPrice: 100,
    })
    // A negotiated price on the line that stays.
    mockUpdateOrderItem(created.id, keep.id, { manualUnitPrice: 90 })
    const before = mockGetOrder(created.id)!
    expect(before.totalAmount).toBe(750) // 450 + 300

    mockDeleteOrderItem(created.id, drop.id)
    const after = mockGetOrder(created.id)!

    expect(after.totalAmount).toBe(450)
    expect(after.items.length).toBe(1)
    // Nobody else's price moved — deleting one line must not reprice five.
    expect(after.items[0]!.unitPrice).toBe(90)
    expect(after.items[0]!.discountPercent).toBe(10)
  })

  it('drops a service the same way', () => {
    const created = freshOrder()
    mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 100,
    })
    const svc = mockAddOrderService(created.id, { serviceId: 'svc-001', quantity: 1, price: 12 })
    expect(mockGetOrder(created.id)!.totalAmount).toBe(112)

    mockDeleteOrderService(created.id, svc.id)
    expect(mockGetOrder(created.id)!.totalAmount).toBe(100)
  })

  it('refuses a line that has left the warehouse, and takes it once it comes back', () => {
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 3,
      unit: 'pcs',
      unitPrice: 100,
    })
    const svc = mockAddOrderService(created.id, { serviceId: 'svc-001', quantity: 1, price: 12 })
    const shipment = mockCreateShipment(created.id, {
      lines: [{ lineId: item.id, quantity: 3 }],
    })
    mockCreateInvoice(created.id, { shipmentId: shipment.id })

    // Deleting this used to succeed: the order fell to 0,00 while the invoice went
    // on asking for 312,00, the waybill went on naming a line that no longer
    // existed, and the 'sale' movements went on holding 3 units off the shelf.
    expect(() => mockDeleteOrderItem(created.id, item.id)).toThrow('LINE_HAS_SHIPMENT')
    // The service never ships; its document is what covers it.
    expect(() => mockDeleteOrderService(created.id, svc.id)).toThrow('LINE_ON_INVOICE')
    expect(mockGetOrder(created.id)!.totalAmount).toBe(312)

    // The way back is the one the model gives: undo the delivery, which returns
    // the goods and withdraws the document. Then the line goes.
    mockCancelShipment(created.id, shipment.id, { correctionReason: 'Wrong order' })
    expect(() => mockDeleteOrderItem(created.id, item.id)).not.toThrow()
    expect(() => mockDeleteOrderService(created.id, svc.id)).not.toThrow()
    expect(mockGetOrder(created.id)!.totalAmount).toBe(0)
  })

  it('refuses an id it does not know instead of reporting success', () => {
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 100,
    })
    const svc = mockAddOrderService(created.id, { serviceId: 'svc-001', quantity: 1, price: 12 })

    // Accepted as a no-op, this is indistinguishable from a deletion that worked:
    // the card said "saved", reloaded, and the line the admin had just removed
    // was back on screen with the order's total still counting it. The id it sent
    // was the temporary one the row carried before the server had issued its own.
    expect(() => mockDeleteOrderItem(created.id, 'temp-1786188470839-6ppdr2-0')).toThrow(
      'ORDER_ITEM_NOT_FOUND',
    )
    expect(() => mockDeleteOrderService(created.id, 'temp-svc-1')).toThrow(
      'ORDER_SERVICE_NOT_FOUND',
    )
    // Nothing was touched on the way to the refusal.
    const after = mockGetOrder(created.id)!
    expect(after.items.map((i) => i.id)).toEqual([item.id])
    expect(after.services.map((s) => s.id)).toEqual([svc.id])
  })
})

// ─── Status is not a freeze ─────────────────────────────────────────────────

describe('order status', () => {
  it('does not freeze or unfreeze a line — only shipment does', () => {
    const { order, lineId } = orderWithLine()
    mockPatchOrderStatus(order.id, 'paid')
    // Still editable: the goods never left.
    expect(() => mockUpdateOrderItem(order.id, lineId, { manualUnitPrice: 110 })).not.toThrow()

    mockCreateShipment(order.id, { lines: [{ lineId, quantity: 10 }] })
    mockPatchOrderStatus(order.id, 'new')
    // Rolling the status back does not unfreeze what already shipped.
    expect(() => mockUpdateOrderItem(order.id, lineId, { manualUnitPrice: 120 })).toThrow(
      'PRICE_FROZEN_BY_SHIPMENT',
    )
  })
})

// ─── Warehouse-facing helpers ───────────────────────────────────────────────

describe('reserved quantity', () => {
  it('is what FIFO must subtract before offering a batch to the next order', () => {
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 7,
      unit: 'pcs',
      unitPrice: 120,
      // A real batch with room to spare: goods cannot be held on a shelf that
      // does not exist, and a hold is capped by what is actually free.
      batchId: 'whb-002',
    })
    const before = mockReservedQuantity('whb-002')

    mockReserveOrder(created.id)
    expect(mockReservedQuantity('whb-002')).toBe(round2(before + 7))

    mockReleaseOrderReservations(created.id)
    expect(mockReservedQuantity('whb-002')).toBe(before)
    expect(mockGetReservations({ orderId: created.id }).length).toBe(0)
    void item
  })
})

// ─── Read endpoints ─────────────────────────────────────────────────────────

describe('read endpoints', () => {
  it('return copies, so a caller cannot reach into the store', () => {
    const order = mockGetOrder('ORD-009')!
    const shipments = mockGetShipments('ORD-009')
    const invoices = mockGetInvoices('ORD-009')

    expect(shipments.length).toBe(order.shipments.length)
    expect(invoices.length).toBe(order.invoices.length)

    shipments[0]!.waybillNumber = 'TAMPERED'
    invoices[0]!.amountNet = -1
    expect(mockGetShipments('ORD-009')[0]!.waybillNumber).not.toBe('TAMPERED')
    expect(mockGetInvoices('ORD-009')[0]!.amountNet).not.toBe(-1)
  })

  it('report a missing order rather than returning nothing', () => {
    expect(() => mockGetShipments('nope')).toThrow('ORDER_NOT_FOUND')
    expect(() => mockGetInvoices('nope')).toThrow('ORDER_NOT_FOUND')
    expect(() => mockGetOrderPayments('nope')).toThrow('ORDER_NOT_FOUND')
  })
})

describe('deleting a payment', () => {
  it('puts the outstanding amount back', () => {
    const { order } = orderWithLine(10, 120) // gross 1452
    const payment = mockAddOrderPayment(order.id, { amount: 363, purpose: 'advance' })
    expect(mockGetOrder(order.id)!.paidPercent).toBe(25)

    mockDeleteOrderPayment(order.id, payment.id)
    const after = mockGetOrder(order.id)!
    expect(after.paidPercent).toBe(0)
    expect(after.outstandingAmount).toBe(1452)
    expect(() => mockDeleteOrderPayment(order.id, payment.id)).toThrow('PAYMENT_NOT_FOUND')
  })
})

// ─── Found by review, kept honest by tests ──────────────────────────────────

describe('details that only show up on real data', () => {
  it('measures the shipped share in money, never by adding pieces to tonnes', () => {
    const created = freshOrder()
    const pieces = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 1000,
    })
    mockAddOrderItem(created.id, {
      productId: 'prod-007',
      quantity: 500,
      unit: 'kg',
      unitPrice: 1,
    })
    // Shipping the single 1000 EUR piece is half the money, but 1 of 501 "units".
    mockCreateShipment(created.id, { lines: [{ lineId: pieces.id, quantity: 1 }] })

    const row = mockGetOrders(
      {
        search: '',
        status: 'all',
        clientId: null,
        dateFrom: '',
        dateTo: '',
        sortBy: null,
        sortDir: 'asc',
      },
      { page: 1, pageSize: 1000 },
    ).items.find((o) => o.id === created.id)!

    expect(row.shippedPercent).toBeCloseTo(66.67, 1) // 1000 of 1500 in money
  })

  it('trims the batch breakdown when the quantity is reduced', () => {
    // Six free on the older shelf, so the line comes in spanning two batches.
    const created = freshOrder()
    const unshelve = shelve('whb-001', 6)
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 120,
    })
    unshelve()
    expect(item.allocations.length).toBe(2)

    // A perfectly ordinary edit that used to trip the "breakdown too big" guard.
    const shrunk = mockUpdateOrderItem(created.id, item.id, { quantity: 4 })
    expect(shrunk.quantity).toBe(4)
    expect(shrunk.allocations.map((a) => [a.batchId, a.quantity])).toEqual([['whb-001', 4]])
  })

  it('keeps order numbers unique after a deletion, since documents are built from them', () => {
    const first = freshOrder()
    mockDeleteOrder(first.id)
    const second = freshOrder()
    expect(second.orderNumber).not.toBe(first.orderNumber)
    expect(second.id).not.toBe(first.id)
  })

  it('puts the hold back when a shipment is cancelled', () => {
    // Cancelling returns the goods to the shelf, and the order owes them to the
    // client again — so it has to hold them again. Otherwise the cancellation
    // quietly costs the client their place in the queue: the next order to look at
    // that batch takes the goods.
    const { order, lineId } = orderWithLine(10, 120)
    mockReserveOrder(order.id)
    const held = mockGetReservations({ orderId: order.id }).reduce((s, r) => s + r.quantity, 0)
    expect(held).toBeGreaterThan(0)

    const shipment = mockCreateShipment(order.id, { lines: [{ lineId, quantity: 4 }] })
    // Shipping replaces the hold with a real write-off, and the shipment records
    // exactly what it took, off which batch.
    const shipped = mockGetShipments(order.id)[0]!
    expect(shipped.lines[0]!.heldReleased!.reduce((s, h) => s + h.quantity, 0)).toBe(4)
    expect(mockGetReservations({ orderId: order.id }).reduce((s, r) => s + r.quantity, 0)).toBe(
      round2(held - 4),
    )

    mockCancelShipment(order.id, shipment.id)
    expect(mockGetReservations({ orderId: order.id }).reduce((s, r) => s + r.quantity, 0)).toBe(
      held,
    )
    mockReleaseOrderReservations(order.id)
  })

  it('does not restore a hold the shelf can no longer back', () => {
    // While the goods were away another order claimed the batch. The cancellation
    // still returns them, but a hold that cannot be honoured is worse than none —
    // and what could not go back is left to "reserve the remainder".
    const { order, lineId } = orderWithLine(10, 120)
    mockReserveOrder(order.id)
    const batchId = mockGetReservations({ orderId: order.id })[0]!.batchId!
    const shipment = mockCreateShipment(order.id, { lines: [{ lineId, quantity: 4 }] })

    // Somebody else takes everything that is free on that batch.
    const other = freshOrder()
    const otherLine = mockAddOrderItem(other.id, {
      productId: mockGetOrder(order.id)!.items[0]!.productId,
      quantity: 1000,
      unit: 'pcs',
      unitPrice: 200,
    })
    mockReserveOrder(other.id)
    const freeBefore = mockReservedQuantity(batchId)

    mockCancelShipment(order.id, shipment.id)
    // The goods came back, and the hold could not: the shelf is spoken for.
    expect(mockGetOrder(order.id)!.items[0]!.shippedQuantity).toBe(0)
    expect(mockReservedQuantity(batchId)).toBeGreaterThanOrEqual(freeBefore)
    void otherLine

    // Both orders let go of the shelf: the store is shared with every test after
    // this one, and a thousand units held for a test that has finished is the very
    // leak this module spent a stage closing.
    mockReleaseOrderReservations(other.id)
    mockReleaseOrderReservations(order.id)
  })

  it('refuses to delete an order that left something behind, and says which', () => {
    // Each of these is a fact outside this system: a document the client holds,
    // goods off the shelf, money received. Each also has a proper way back, and
    // after it the order deletes — so the guard is not a dead end.
    const { order, lineId } = orderWithLine(10, 120)
    const payment = mockAddOrderPayment(order.id, { amount: 100, purpose: 'advance' })
    expect(() => mockDeleteOrder(order.id)).toThrow('ORDER_HAS_PAYMENT')

    const shipment = mockCreateShipment(order.id, { lines: [{ lineId, quantity: 10 }] })
    expect(() => mockDeleteOrder(order.id)).toThrow('ORDER_HAS_SHIPMENT')

    mockCreateInvoice(order.id, { shipmentId: shipment.id })
    // The document outranks the rest — it is the one the client can wave at you.
    expect(() => mockDeleteOrder(order.id)).toThrow('ORDER_HAS_INVOICE')

    // Cancelling with a correction withdraws the document and returns the goods,
    // so only the money is left in the way.
    mockCancelShipment(order.id, shipment.id, { correctionReason: 'Order cancelled' })
    expect(() => mockDeleteOrder(order.id)).toThrow('ORDER_HAS_PAYMENT')
    mockDeleteOrderPayment(order.id, payment.id)

    mockDeleteOrder(order.id)
    expect(mockGetOrder(order.id)).toBeUndefined()
  })

  it('does not leak the store’s own bookkeeping to the caller', () => {
    const order = mockGetOrder('ORD-001')! as unknown as Record<string, unknown>
    expect(Object.keys(order).some((k) => k.startsWith('_'))).toBe(false)
  })
})

// ─── Status and reality agree ───────────────────────────────────────────────

describe('generated statuses are backed by facts', () => {
  it('an order that says the goods are gone has a shipment behind it', () => {
    const gone = allOrders().filter((o) => o.status === 'shipped' || o.status === 'delivered')
    expect(gone.length).toBeGreaterThan(10)

    for (const order of gone) {
      if (!order.items.length) continue
      expect(order.shipments.length).toBeGreaterThan(0)
      // "Delivered" next to "0% shipped" is what makes people distrust the data.
      expect(order.items.some((i) => i.shippedQuantity > 0)).toBe(true)
    }
  })

  it('an order that says it is paid has the money recorded', () => {
    // Nothing is said about goods here: paying in full up front is ordinary.
    for (const order of allOrders().filter((o) => o.status === 'paid' && o.items.length)) {
      expect(order.payments.length).toBeGreaterThan(0)
      expect(order.paidPercent).toBeGreaterThan(0)
    }
  })

  it('a scenario order never claims more than its facts support', () => {
    for (const id of mockOrderScenarios().map((s) => s.id)) {
      const order = mockGetOrder(id)!
      const shipped = order.items.reduce((sum, i) => sum + i.shippedQuantity, 0)
      if (order.status === 'shipped' || order.status === 'delivered') {
        expect(shipped).toBeGreaterThan(0)
      }
      if (shipped <= 0) {
        expect(['new', 'confirmed', 'cancelled', 'paid']).toContain(order.status)
      }
    }
  })
})

// ─── Guessed costs say they are guesses ─────────────────────────────────────

describe('a new line takes the decision it was given, not a derived number', () => {
  it('prices from the catalogue price when one is sent', () => {
    const created = freshOrder()
    // Above what the warehouse holds it at, which is what selling means.
    const asking = round2(mockCalculateFifoCost('prod-001', 1).unitPrice * 1.4)
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 1,
      unit: 'pcs',
      unitPrice: asking,
    })
    // The price is honoured exactly; the margin is whatever gets there from the
    // warehouse cost. Selling at cost is not a default anybody chose.
    expect(item.unitPrice).toBe(asking)
    expect(item.unitCost).toBeLessThan(asking)
    expect(item.marginPercent).toBeGreaterThan(0)
  })

  it('prices from a markup when the product carries no price', () => {
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 999, // ignored — the markup is the decision
      marginPercent: 25,
    })
    expect(item.marginPercent).toBe(25)
    expect(item.manualUnitPrice).toBeNull()
    // The shown price is the computed one at display precision — comparing it to a
    // figure rounded to cents made this test a hostage to the seeded cost.
    expect(item.unitPrice).toBeCloseTo(item.unitCost * 1.25, 4)
  })

  it('takes the discount the add-mode chose over the order default', () => {
    const created = freshOrder()
    mockPatchOrder(created.id, { defaultDiscountPercent: 5 })
    const withTerms = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 100,
      discountPercent: 9.7,
    })
    expect(withTerms.discountPercent).toBe(9.7)
    expect(withTerms.unitPrice).toBe(90.3)

    // Nothing sent → the order default, which is what "no question asked" means.
    const plain = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 100,
    })
    expect(plain.discountPercent).toBe(5)
  })

  it('applies the same rule to services', () => {
    const created = freshOrder()
    mockPatchOrder(created.id, { defaultDiscountPercent: 5 })
    expect(
      mockAddOrderService(created.id, { serviceId: 'svc-001', quantity: 1, discountPercent: 9.7 })
        .discountPercent,
    ).toBe(9.7)
    expect(
      mockAddOrderService(created.id, { serviceId: 'svc-001', quantity: 1 }).discountPercent,
    ).toBe(5)
  })
})

describe('a service line comes from the service catalogue', () => {
  it('takes the name and the cost of the service that was picked', async () => {
    // A service created after this module was written. Against a copy of the
    // catalogue that knew five of them and fell back to the first, this line was
    // stored as "Metal cutting" at a cost of 5,00 — a different service at a
    // different cost, under a name the admin never chose.
    const picked = await mockCreateService({
      name: { ru: 'Гибка труб', en: 'Pipe bending', lt: 'Vamzdžių lankstymas' },
      costPrice: 40,
      sellingPrice: 90,
      currencyId: 'cur-eur',
      uomId: 'uom-pcs',
    })
    const created = freshOrder()
    const line = mockAddOrderService(created.id, {
      serviceId: picked.id,
      quantity: 2,
      price: 90,
    })

    expect(line.serviceName).toBe('Pipe bending')
    expect(line.unitCost).toBe(40)
    expect(line.price).toBe(90)
    expect(mockGetOrder(created.id)!.totalCost).toBe(80)
  })

  it('follows a cost corrected in the services page', async () => {
    const created = freshOrder()
    const before = mockAddOrderService(created.id, {
      serviceId: 'svc-002',
      quantity: 3,
      price: 25,
    })
    expect(before.unitCost).toBe(10)

    await mockPatchService('svc-002', { costPrice: 22 })
    const after = mockAddOrderService(created.id, {
      serviceId: 'svc-002',
      quantity: 3,
      price: 25,
    })
    // The card reads the same catalogue and showed 22,00 either way; the order
    // used to keep quoting the number frozen into this module.
    expect(after.unitCost).toBe(22)

    await mockPatchService('svc-002', { costPrice: 10 })
  })

  it('refuses a service nobody has heard of', () => {
    const created = freshOrder()
    expect(
      () =>
        mockAddOrderService(created.id, {
          serviceId: 'svc-does-not-exist',
          quantity: 1,
          price: 10,
        }),
      // The whole code, not the tail of it. `toThrow` matches by substring, and so
      // does the frontend — which is why this code was renamed: it used to fit
      // inside ORDER_SERVICE_NOT_FOUND, and a check written like this could not
      // tell the two apart (contract §6).
    ).toThrow('CATALOG_SERVICE_NOT_FOUND')
  })
})

describe('cost provenance', () => {
  it('marks a cost read off a batch as coming from stock', () => {
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 120,
    })
    expect(item.costSource).toBe('stock')
  })

  it('reads the cost off the warehouse when the product has batches', () => {
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 120,
    })
    // The same FIFO figure the card previewed before Save, so the row does not
    // change under the admin the moment it is stored.
    const fifo = mockCalculateFifoCost('prod-001', 1)
    expect(fifo.unitPrice).toBeGreaterThan(0)
    expect(item.unitCost).toBe(round2(fifo.unitPrice))
    expect(item.costSource).toBe('stock')
  })

  it('gives a product it cannot cost no cost at all, rather than inventing one', () => {
    const created = freshOrder()
    // Nothing in the warehouse under this product, so there is no cost to read.
    const item = mockAddOrderItem(created.id, {
      productId: PRODUCT_OUT_OF_STOCK,
      quantity: 1,
      unit: 'pcs',
      unitPrice: 120,
    })
    // A share of the selling price is not a cost, it is a number somebody made
    // up — and the card, making its own up, arrived at a different one. Without
    // a cost the model already knows what to do: the price was named outright.
    expect(item.unitCost).toBe(0)
    expect(item.costSource).toBe('estimate')
    expect(item.manualUnitPrice).toBe(120)
    expect(item.marginPercent).toBe(0)
    expect(item.unitPrice).toBe(120)
    expect(item.allocations).toEqual([])
    // And it stays out of every percentage, like any other line without a cost.
    expect(() => mockUpdateOrderItem(created.id, item.id, { marginPercent: 20 })).toThrow(
      'NO_COST_TO_MARK_UP',
    )
  })
})

describe('a shipment is the only thing that moves the warehouse', () => {
  /** A line drawing on real batches, with the breakdown the warehouse gave it. */
  function shippableLine(quantity = 10) {
    const created = freshOrder()
    mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity,
      unit: 'pcs',
      unitPrice: 200,
    })
    return { orderId: created.id, item: mockGetOrder(created.id)!.items[0]! }
  }

  it('gives a new line the breakdown of the batches it will consume', () => {
    const { item } = shippableLine(10)
    expect(item.allocations.length).toBeGreaterThan(0)
    const allocated = round2(item.allocations.reduce((sum, a) => sum + a.quantity, 0))
    expect(allocated).toBe(10)
    // Costed off real batches, so the source says so rather than guessing.
    expect(item.costSource).toBe('stock')
    expect(item.allocations.every((a) => a.batchId !== null)).toBe(true)
  })

  it('writes off exactly what left, from exactly the batches it took', () => {
    const { orderId, item } = shippableLine(10)
    const batchId = item.allocations[0]!.batchId!
    const before = batchById(batchId)!.quantityRemaining

    const shipment = mockCreateShipment(orderId, { lines: [{ lineId: item.id, quantity: 4 }] })

    const movements = mockGetMovementsFor('order-shipment', shipment.id)
    expect(movements.length).toBeGreaterThan(0)
    expect(movements.every((m) => m.type === 'sale')).toBe(true)
    expect(round2(movements.reduce((sum, m) => sum + m.quantity, 0))).toBe(4)
    // The shelf moved by the shipped quantity — no more, no less.
    expect(round2(before - batchById(batchId)!.quantityRemaining)).toBe(4)
    // And the movement points back at the shipment, so the write-off is traceable
    // to the waybill the client is holding.
    expect(movements.every((m) => m.referenceId === shipment.id)).toBe(true)
  })

  it('writes stock off once, not once per shipment of the same line', () => {
    const { orderId, item } = shippableLine(10)
    const batchId = item.allocations[0]!.batchId!
    const before = batchById(batchId)!.quantityRemaining

    mockCreateShipment(orderId, { lines: [{ lineId: item.id, quantity: 6 }] })
    mockCreateShipment(orderId, { lines: [{ lineId: item.id, quantity: 4 }] })

    // Ten units left the warehouse in total, however many trucks it took.
    expect(round2(before - batchById(batchId)!.quantityRemaining)).toBe(10)
    expect(mockGetOrder(orderId)!.items[0]!.state).toBe('shipped')
  })

  it('a second shipment takes the next batches, not the ones already gone', () => {
    // A line spanning two batches: the first truck empties the older one, and the
    // second must not write the same units off again.
    const created = freshOrder()
    const unshelve = shelve('whb-001', 6)
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 200,
    })
    unshelve()
    expect(item.allocations.map((a) => [a.batchId, a.quantity])).toEqual([
      ['whb-001', 6],
      ['whb-002', 4],
    ])

    const first = mockCreateShipment(created.id, { lines: [{ lineId: item.id, quantity: 6 }] })
    const second = mockCreateShipment(created.id, { lines: [{ lineId: item.id, quantity: 4 }] })

    expect(mockGetMovementsFor('order-shipment', first.id).map((m) => m.batchId)).toEqual([
      'whb-001',
    ])
    expect(mockGetMovementsFor('order-shipment', second.id).map((m) => m.batchId)).toEqual([
      'whb-002',
    ])
  })

  it('offers what the write-off takes when the first batch is only partly free', () => {
    // Рядовая отгрузка: ни одного обрезка в строке, просто два заказа на один товар.
    // Настоящий максимум лежит ВНУТРИ первой аллокации, а не на границе разбивки, и
    // ни то, ни другое из двух очевидных чисел им не является: «остаток минус
    // недостача» (9) обещает то, за чем не добраться — за занятой частью первой партии
    // стоит вторая, — а перебор границ разбивки (10, 12) не принимает ни одной и
    // назвал бы ноль, то есть погасил бы кнопку отгрузки на строке, где свободно семь.
    const unshelveFirst = shelve('whb-001', 10)
    const unshelveSecond = shelve('whb-002', 5)
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 12,
      unit: 'pcs',
      unitPrice: 200,
    })
    expect(item.allocations.map((a) => [a.batchId, a.quantity])).toEqual([
      ['whb-001', 10],
      ['whb-002', 2],
    ])
    // Строка БЕЗ куска — иначе проверялся бы край обрезков, а не основной поток.
    expect(item.allocations.every((a) => a.offcutId === null)).toBe(true)

    // Соперник забирает три с первой партии: свободных на ней остаётся семь.
    const rival = freshOrder()
    mockAddOrderItem(rival.id, {
      productId: 'prod-001',
      quantity: 3,
      unit: 'pcs',
      unitPrice: 200,
    })
    mockReserveOrder(rival.id)
    expect(mockGetReservations({ orderId: rival.id }).map((r) => [r.batchId, r.quantity])).toEqual([
      ['whb-001', 3],
    ])

    const planned = mockPlanOrderShipment(created.id).find((l) => l.lineId === item.id)!
    expect([planned.remaining, planned.shippable]).toEqual([12, 7])
    // Никаких запретных зон: их создаёт только неделимый кусок, а его тут нет.
    expect(planned.wholePieces).toEqual([])

    // «Остаток минус недостача» списание отклоняет — потому его и не предлагают…
    expect(() =>
      mockCreateShipment(created.id, { lines: [{ lineId: item.id, quantity: 9 }] }),
    ).toThrow('SHIPMENT_EXCEEDS_STOCK')
    // …а предложенное принимается.
    mockCreateShipment(created.id, { lines: [{ lineId: item.id, quantity: planned.shippable }] })
    expect(mockGetOrder(created.id)!.items[0]!.shippedQuantity).toBe(7)

    mockReleaseOrderReservations(rival.id)
    unshelveFirst()
    unshelveSecond()
  })

  it('refuses to ship goods the shelf no longer has', () => {
    // The breakdown was computed when the line was added; by shipping time another
    // order may have taken the goods. The shelf is the truth, not the plan.
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 200,
    })
    const batchId = 'whb-001'
    expect(item.allocations.map((a) => [a.batchId, a.quantity])).toEqual([[batchId, 10]])
    const batch = batchById(batchId)!
    const stashed = batch.quantityRemaining
    batch.quantityRemaining = 3

    expect(() =>
      mockCreateShipment(created.id, { lines: [{ lineId: item.id, quantity: 10 }] }),
    ).toThrow('SHIPMENT_EXCEEDS_STOCK')
    // Refused before anything moved: no movements, nothing shipped.
    expect(batchById(batchId)!.quantityRemaining).toBe(3)
    expect(mockGetOrder(created.id)!.items[0]!.shippedQuantity).toBe(0)

    batch.quantityRemaining = stashed
  })

  it('refuses to ship a line the warehouse never backed', () => {
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: PRODUCT_OUT_OF_STOCK,
      quantity: 5,
      unit: 'pcs',
      unitPrice: 200,
    })
    expect(item.allocations).toEqual([])
    expect(() =>
      mockCreateShipment(created.id, { lines: [{ lineId: item.id, quantity: 5 }] }),
    ).toThrow('SHIPMENT_EXCEEDS_STOCK')
  })

  it('records a shortage instead of quietly averaging over it', () => {
    // More than the warehouse holds: the order can be taken, but the gap is
    // written down and the cost stops claiming to come from stock.
    const created = freshOrder()
    const huge = 10_000_000
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: huge,
      unit: 'pcs',
      unitPrice: 200,
    })
    expect(item.costSource).toBe('estimate')
    const allocated = item.allocations.reduce((sum, a) => sum + a.quantity, 0)
    expect(allocated).toBeLessThan(huge)
  })

  it('returns the goods by an opposite movement, never by forgetting the sale', () => {
    const { orderId, item } = shippableLine(10)
    const batchId = item.allocations[0]!.batchId!
    const before = batchById(batchId)!.quantityRemaining

    const shipment = mockCreateShipment(orderId, { lines: [{ lineId: item.id, quantity: 4 }] })
    mockCancelShipment(orderId, shipment.id)

    // The shelf is whole again...
    expect(batchById(batchId)!.quantityRemaining).toBe(before)
    // ...and the sale is still on record, with its reversal beside it.
    expect(mockGetMovementsFor('order-shipment', shipment.id).length).toBeGreaterThan(0)
    const returns = mockGetMovementsFor('order-shipment-cancelled', shipment.id)
    expect(returns.length).toBeGreaterThan(0)
    expect(returns.every((m) => m.type === 'return')).toBe(true)
    expect(mockGetOrder(orderId)!.items[0]!.shippedQuantity).toBe(0)
  })

  it('never promises the same goods to two orders — drafted first, confirmed later', () => {
    // The order that matters: both orders are drafted BEFORE either is confirmed,
    // so both worked out their breakdown off the same untouched shelf. Holding on
    // the strength of that plan is how twenty units get promised out of ten.
    const batch = batchById('whb-001')!
    const stashed = batch.quantityRemaining
    const heldByOthers = mockReservedQuantity('whb-001')
    batch.quantityRemaining = round2(heldByOthers + 10)

    const first = freshOrder()
    mockAddOrderItem(first.id, { productId: 'prod-001', quantity: 10, unit: 'pcs', unitPrice: 200 })
    const second = freshOrder()
    mockAddOrderItem(second.id, {
      productId: 'prod-001',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 200,
    })

    mockReserveOrder(first.id)
    mockReserveOrder(second.id)

    const held = (orderId: string) =>
      round2(
        mockGetReservations({ orderId, batchId: 'whb-001' }).reduce(
          (sum, r) => sum + r.quantity,
          0,
        ),
      )
    expect(held(first.id)).toBe(10)
    expect(held(second.id)).toBe(0)
    // The shelf backs every hold on it, which is the whole point of a hold.
    expect(mockReservedQuantity('whb-001')).toBeLessThanOrEqual(batch.quantityRemaining)

    // Reserving again is not a second promise.
    mockReserveOrder(first.id)
    expect(held(first.id)).toBe(10)

    // And the goods held by one order cannot leave on another order's truck —
    // otherwise the hold would mean nothing.
    const secondLine = mockGetOrder(second.id)!.items[0]!
    expect(() =>
      mockCreateShipment(second.id, { lines: [{ lineId: secondLine.id, quantity: 10 }] }),
    ).toThrow('SHIPMENT_EXCEEDS_STOCK')

    const firstLine = mockGetOrder(first.id)!.items[0]!
    expect(() =>
      mockCreateShipment(first.id, { lines: [{ lineId: firstLine.id, quantity: 10 }] }),
    ).not.toThrow()

    mockReleaseOrderReservations(first.id)
    mockReleaseOrderReservations(second.id)
    batch.quantityRemaining = stashed
  })

  it('never lets two orders sell the same tonne', () => {
    // The first order holds its goods with reservations; the second only sees what
    // is left, and prices what it cannot get as an estimate.
    const batch = batchById('whb-001')!
    const stashed = batch.quantityRemaining
    batch.quantityRemaining = 12

    const first = freshOrder()
    const firstLine = mockAddOrderItem(first.id, {
      productId: 'prod-001',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 200,
    })
    mockReserveOrder(first.id)
    expect(mockGetReservations({ orderId: first.id }).length).toBeGreaterThan(0)

    const second = freshOrder()
    const secondLine = mockAddOrderItem(second.id, {
      productId: 'prod-001',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 200,
    })
    // Only what the first order left over is available to the second.
    const secondAllocated = round2(
      secondLine.allocations
        .filter((a) => a.batchId === 'whb-001')
        .reduce((sum, a) => sum + a.quantity, 0),
    )
    expect(secondAllocated).toBeLessThanOrEqual(round2(12 - 10))

    // And the first order can still ship everything it was promised.
    expect(() =>
      mockCreateShipment(first.id, { lines: [{ lineId: firstLine.id, quantity: 10 }] }),
    ).not.toThrow()

    batch.quantityRemaining = stashed
  })

  it('refuses the same line twice in one shipment, before anything moves', () => {
    // Two 3s pass a check for 5 when each reads the remaining quantity from the
    // same starting point, and each takes the same slice of the breakdown. The
    // line validation at the end of the operation catches the result — but only
    // after the goods are off the shelf and the order is left unusable.
    const { orderId, item } = shippableLine(5)
    const batchId = item.allocations[0]!.batchId!
    const before = batchById(batchId)!.quantityRemaining

    expect(() =>
      mockCreateShipment(orderId, {
        lines: [
          { lineId: item.id, quantity: 3 },
          { lineId: item.id, quantity: 3 },
        ],
      }),
    ).toThrow('DUPLICATE_SHIPMENT_LINE')

    expect(batchById(batchId)!.quantityRemaining).toBe(before)
    const after = mockGetOrder(orderId)!
    expect(after.items[0]!.shippedQuantity).toBe(0)
    expect(after.shipments.length).toBe(0)
  })

  it('never holds more than the line still owes', () => {
    // A hold is only ever seen through what it subtracts, so one left behind is
    // invisible: the goods are simply unavailable to everybody, for ever.
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 200,
    })
    mockReserveOrder(created.id)
    const held = (orderId: string) =>
      round2(mockGetReservations({ orderId }).reduce((sum, r) => sum + r.quantity, 0))
    expect(held(created.id)).toBe(10)

    // Shrink the line: the goods it no longer needs go back.
    mockUpdateOrderItem(created.id, item.id, { quantity: 4 })
    expect(held(created.id)).toBe(4)

    // Grow it again: holding more is the reservation's job, not an edit's.
    mockUpdateOrderItem(created.id, item.id, { quantity: 12 })
    expect(held(created.id)).toBe(4)
    mockReserveOrder(created.id)
    expect(held(created.id)).toBe(12)

    // Remove the line: nothing is left to hold anything for.
    mockDeleteOrderItem(created.id, item.id)
    expect(held(created.id)).toBe(0)
  })

  it('never promises the same goods to two lines of the SAME order', () => {
    // Two lines of one order asking for one product are two separate claims on
    // the same shelf. Capping a hold against "what other orders hold" counts a
    // sibling line nowhere at all — and sixteen units get promised out of ten.
    const batch = batchById('whb-001')!
    const stashed = batch.quantityRemaining
    batch.quantityRemaining = round2(mockReservedQuantity('whb-001') + 10)

    const created = freshOrder()
    const first = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 8,
      unit: 'pcs',
      unitPrice: 200,
    })
    const second = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 8,
      unit: 'pcs',
      unitPrice: 200,
    })
    mockReserveOrder(created.id)

    const heldBy = (lineId: string) =>
      round2(
        mockGetReservations({ orderId: created.id, lineId }).reduce(
          (sum, r) => sum + r.quantity,
          0,
        ),
      )
    expect(heldBy(first.id)).toBe(8)
    expect(heldBy(second.id)).toBe(2)
    expect(mockReservedQuantity('whb-001')).toBeLessThanOrEqual(batch.quantityRemaining)

    // Asking again promises nothing further.
    mockReserveOrder(created.id)
    expect(round2(heldBy(first.id) + heldBy(second.id))).toBe(10)

    mockReleaseOrderReservations(created.id)
    batch.quantityRemaining = stashed
  })

  it('gives a partially shipped line batches for what was added to it', () => {
    // "The truck has left and the client wants two more" — the case the whole
    // model is built around. Without a breakdown for the added units they can be
    // neither reserved nor shipped, and nobody is told why.
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 6,
      unit: 'pcs',
      unitPrice: 200,
    })
    mockCreateShipment(created.id, { lines: [{ lineId: item.id, quantity: 4 }] })
    expect(mockGetOrder(created.id)!.items[0]!.state).toBe('partially_shipped')

    mockUpdateOrderItem(created.id, item.id, { quantity: 10 })
    const grown = mockGetOrder(created.id)!.items[0]!
    expect(round2(grown.allocations.reduce((sum, a) => sum + a.quantity, 0))).toBe(10)
    // The prefix the first truck took is untouched — an edit may not re-plan
    // goods that have already gone.
    expect(grown.shippedQuantity).toBe(4)

    // And the rest really can go on the second truck.
    expect(mockPlanOrderShipment(created.id)[0]!.shippable).toBe(6)
    mockCreateShipment(created.id, { lines: [{ lineId: item.id, quantity: 6 }] })
    const done = mockGetOrder(created.id)!.items[0]!
    expect([done.shippedQuantity, done.state]).toEqual([10, 'shipped'])
  })

  it('merges a top-up into the entry the batch already has', () => {
    // prod-002 keeps its stock in a single batch, so growing the line has to add
    // to the entry that is already there rather than open a second one for the
    // same shelf.
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-002',
      quantity: 3,
      unit: 'pcs',
      unitPrice: 200,
    })
    const before = mockGetOrder(created.id)!.items[0]!.allocations
    expect(before.length).toBe(1)

    mockUpdateOrderItem(created.id, item.id, { quantity: 9 })
    const after = mockGetOrder(created.id)!.items[0]!.allocations
    expect(after.length).toBe(1)
    expect(after[0]!.batchId).toBe(before[0]!.batchId)
    expect(round2(after[0]!.quantity)).toBe(9)
  })

  it('treats a breakdown pointing at a batch that is gone as nothing at all', async () => {
    // Goods on no shelf cannot leave one, and a batch that no longer exists is
    // exactly that. The line is not shippable, and it says so as a shortage
    // rather than by throwing.
    //
    // The breakdown cannot be dictated, so the batch is real when the line takes
    // it and gone by the time the line tries to ship: received before every other
    // batch of this product, it is the one FIFO reaches for, and then it is
    // written off the warehouse entirely. That is the case as it actually
    // happens — a batch corrected away after an order was already planned on it.
    const doomed = await mockCreateBatch({
      productId: 'prod-001',
      batchNumber: 'INV-GONE-001',
      lotCode: 'LOT-GONE-001',
      quantity: 5,
      uomId: 'uom-kg',
      unitPrice: STOCK_UNIT_COST,
      receivedAt: '2000-01-01T00:00:00Z',
    })
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 5,
      unit: 'pcs',
      unitPrice: 200,
    })
    expect(item.allocations.map((a) => [a.batchId, a.quantity])).toEqual([[doomed.id, 5]])

    await mockDeleteBatch(doomed.id)
    expect(batchById(doomed.id)).toBeUndefined()

    expect(mockPlanOrderShipment(created.id)[0]!.shippable).toBe(0)
    expect(() =>
      mockCreateShipment(created.id, { lines: [{ lineId: item.id, quantity: 5 }] }),
    ).toThrow('SHIPMENT_EXCEEDS_STOCK')
  })

  it('refuses a shipment line of nothing', () => {
    const { orderId, item } = shippableLine(5)
    expect(() =>
      mockCreateShipment(orderId, { lines: [{ lineId: item.id, quantity: 0 }] }),
    ).toThrow('SHIPMENT_QUANTITY_MUST_BE_POSITIVE')
  })

  it('keeps one breakdown entry per batch when a line is topped up', () => {
    // Two entries for the same batch still add up, but every rule expressed per
    // entry — how much of it shipped, how much of it is held — would then be
    // reading half the story.
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 3,
      unit: 'pcs',
      unitPrice: 200,
    })
    mockUpdateOrderItem(created.id, item.id, { quantity: 9 })
    const grown = mockGetOrder(created.id)!.items[0]!
    const batchIds = grown.allocations.map((a) => a.batchId)
    expect(new Set(batchIds).size).toBe(batchIds.length)
    expect(round2(grown.allocations.reduce((sum, a) => sum + a.quantity, 0))).toBe(9)
  })

  it('gives everything back when the order itself is deleted', () => {
    // Otherwise the holds belong to an order nobody can open, and nothing in the
    // system can ever release them.
    const created = freshOrder()
    mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 6,
      unit: 'pcs',
      unitPrice: 200,
    })
    mockReserveOrder(created.id)
    const before = mockReservedQuantity('whb-001') + mockReservedQuantity('whb-002')
    expect(before).toBeGreaterThan(0)

    mockDeleteOrder(created.id)
    expect(mockGetReservations({ orderId: created.id })).toEqual([])
  })

  it('leaves services out of it — they never touch a shelf', () => {
    const created = freshOrder()
    const svc = mockAddOrderService(created.id, { serviceId: 'svc-001', quantity: 1 })
    expect(() =>
      mockCreateShipment(created.id, { lines: [{ lineId: svc.id, quantity: 1 }] }),
    ).toThrow('ORDER_ITEM_NOT_FOUND')
  })
})

describe("a document in the client's hands is not withdrawn quietly", () => {
  it('refuses to cancel a shipment that has already been invoiced', () => {
    // Cancelling it would leave the client holding an invoice for goods the
    // system says never left. The model is explicit: an issued document is
    // corrected by a correcting one, never silently undone.
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 4,
      unit: 'pcs',
      unitPrice: 200,
    })
    const shipment = mockCreateShipment(created.id, {
      lines: [{ lineId: item.id, quantity: 4 }],
    })
    mockCreateInvoice(created.id, { shipmentId: shipment.id })

    expect(() => mockCancelShipment(created.id, shipment.id)).toThrow('SHIPMENT_ALREADY_INVOICED')
    // And nothing moved: the shipment stands, the goods stay gone.
    const after = mockGetOrder(created.id)!
    expect(after.shipments[0]!.cancelled).toBe(false)
    expect(after.items[0]!.shippedQuantity).toBe(4)
  })

  it('still cancels a shipment nobody has invoiced', () => {
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 4,
      unit: 'pcs',
      unitPrice: 200,
    })
    const shipment = mockCreateShipment(created.id, {
      lines: [{ lineId: item.id, quantity: 4 }],
    })
    expect(mockCancelShipment(created.id, shipment.id).cancelled).toBe(true)
  })
})

describe('the seeded data obeys the same rule as everything else', () => {
  it('every shipment in the store really moved goods off a shelf', () => {
    // The scenarios used to push a shipment object straight onto the order, so
    // the demo showed "shipped" while the warehouse still held every gram of it —
    // the data contradicting the one rule the warehouse runs on.
    let checked = 0
    for (const scenario of mockOrderScenarios()) {
      const order = mockGetOrder(scenario.id)!
      for (const shipment of order.shipments) {
        const movements = mockGetMovementsFor('order-shipment', shipment.id)
        expect(movements.length).toBeGreaterThan(0)
        expect(movements.every((m) => m.type === 'sale')).toBe(true)
        // The waybill and the ledger agree on how much left.
        const shipped = round2(shipment.lines.reduce((sum, l) => sum + l.quantity, 0))
        const written = round2(movements.reduce((sum, m) => sum + m.quantity, 0))
        expect(written).toBe(shipped)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('never ships more of a line than it ordered', () => {
    for (const scenario of mockOrderScenarios()) {
      for (const line of mockGetOrder(scenario.id)!.items) {
        expect(line.shippedQuantity).toBeLessThanOrEqual(line.quantity)
      }
    }
  })
})

describe('the ordinary case: one truck, driven by the status', () => {
  /**
   * Turns the write-off flag on for one status, runs the body, and puts the
   * setting back — the store is shared with every other test in this file.
   */
  function withStatusRule(
    statusId: string,
    rule: { reserveOnTransition?: boolean; writeOffOnTransition?: boolean },
    body: () => void,
  ) {
    const settings = mockGetSettings()
    const entry = settings.orderStatuses!.find((s) => s.id === statusId)!
    const before = { ...entry }
    Object.assign(entry, rule)
    mockSaveSettings(settings)
    try {
      body()
    } finally {
      const restore = mockGetSettings()
      Object.assign(restore.orderStatuses!.find((s) => s.id === statusId)!, before)
      mockSaveSettings(restore)
    }
  }

  function orderReadyToShip(quantity = 10) {
    const created = freshOrder()
    mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity,
      unit: 'pcs',
      unitPrice: 200,
    })
    return mockGetOrder(created.id)!
  }

  it('says what the transition will do before it does it', () => {
    withStatusRule('st-shipped', { writeOffOnTransition: true }, () => {
      const order = orderReadyToShip(10)
      const plan = mockPlanStatusTransition(order.id, 'shipped')
      expect(plan.writesOff).toBe(true)
      expect(plan.shortages).toEqual([])
      expect(plan.lines.map((l) => l.quantity)).toEqual([10])
      // A plan changes nothing — that is the point of showing it first.
      expect(mockGetOrder(order.id)!.shipments.length).toBe(0)
      expect(mockGetOrder(order.id)!.items[0]!.shippedQuantity).toBe(0)
    })
  })

  it('creates one shipment for the whole remainder and writes it off', () => {
    withStatusRule('st-shipped', { writeOffOnTransition: true }, () => {
      const order = orderReadyToShip(10)
      const batchId = order.items[0]!.allocations[0]!.batchId!
      const before = batchById(batchId)!.quantityRemaining

      mockPatchOrderStatus(order.id, 'shipped')

      const after = mockGetOrder(order.id)!
      expect(after.shipments.length).toBe(1)
      expect(after.items[0]!.state).toBe('shipped')
      expect(round2(before - batchById(batchId)!.quantityRemaining)).toBe(10)
      expect(after.status).toBe('shipped')
    })
  })

  it('ships only the remainder when part has already gone', () => {
    withStatusRule('st-shipped', { writeOffOnTransition: true }, () => {
      const order = orderReadyToShip(10)
      mockCreateShipment(order.id, { lines: [{ lineId: order.items[0]!.id, quantity: 6 }] })

      const plan = mockPlanStatusTransition(order.id, 'shipped')
      expect(plan.lines.map((l) => l.quantity)).toEqual([4])

      mockPatchOrderStatus(order.id, 'shipped')
      const after = mockGetOrder(order.id)!
      expect(after.shipments.length).toBe(2)
      expect(after.items[0]!.shippedQuantity).toBe(10)
    })
  })

  it('refuses the transition when the goods are not there, and stays put', () => {
    withStatusRule('st-shipped', { writeOffOnTransition: true }, () => {
      const order = orderReadyToShip(10)
      const lineId = order.items[0]!.id
      // The whole line sits on the older batch — which is where FIFO put it.
      expect(order.items[0]!.allocations.map((a) => [a.batchId, a.quantity])).toEqual([
        ['whb-001', 10],
      ])
      const batch = batchById('whb-001')!
      const stashed = batch.quantityRemaining
      batch.quantityRemaining = 4
      // Whatever other orders are holding on this batch is not available here, so
      // the gap is computed from what is really free rather than assumed.
      const free = Math.max(0, 4 - mockReservedQuantity('whb-001'))

      const plan = mockPlanStatusTransition(order.id, 'shipped')
      expect(plan.shortages).toEqual([
        { lineId, productName: expect.any(String), unit: 'pcs', missing: round2(10 - free) },
      ])
      expect(() => mockPatchOrderStatus(order.id, 'shipped')).toThrow('STATUS_BLOCKED_BY_STOCK')

      // Nothing moved and the order did not pretend to ship.
      const after = mockGetOrder(order.id)!
      expect(after.status).not.toBe('shipped')
      expect(after.shipments.length).toBe(0)
      expect(batchById('whb-001')!.quantityRemaining).toBe(4)

      batch.quantityRemaining = stashed
    })
  })

  it('holds the remainder when the status reserves instead of shipping', () => {
    withStatusRule('st-confirmed', { reserveOnTransition: true }, () => {
      const order = orderReadyToShip(10)
      const plan = mockPlanStatusTransition(order.id, 'confirmed')
      expect([plan.reserves, plan.writesOff]).toEqual([true, false])

      mockPatchOrderStatus(order.id, 'confirmed')
      expect(mockGetReservations({ orderId: order.id }).length).toBeGreaterThan(0)
      // Reserving moves no goods: the shelf is untouched, only availability changed.
      expect(mockGetOrder(order.id)!.shipments.length).toBe(0)
      expect(mockGetOrder(order.id)!.items[0]!.state).toBe('draft')
    })
  })

  it('creates no shipment for an order of nothing but services', () => {
    withStatusRule('st-shipped', { writeOffOnTransition: true }, () => {
      const created = freshOrder()
      mockAddOrderService(created.id, { serviceId: 'svc-001', quantity: 1 })
      const plan = mockPlanStatusTransition(created.id, 'shipped')
      expect(plan.writesOff).toBe(false)
      expect(plan.lines).toEqual([])

      mockPatchOrderStatus(created.id, 'shipped')
      expect(mockGetOrder(created.id)!.shipments.length).toBe(0)
      expect(mockGetOrder(created.id)!.status).toBe('shipped')
    })
  })

  it('leaves the warehouse alone for a status that says nothing about it', () => {
    const order = orderReadyToShip(10)
    const plan = mockPlanStatusTransition(order.id, 'picking')
    expect([plan.reserves, plan.writesOff]).toEqual([false, false])
    mockPatchOrderStatus(order.id, 'picking')
    expect(mockGetOrder(order.id)!.shipments.length).toBe(0)
    expect(mockGetReservations({ orderId: order.id }).length).toBe(0)
  })
})

describe('invoices cannot lie about a delivery', () => {
  function shippedOrder(): { orderId: string; shipmentId: string } {
    const { order, lineId } = orderWithLine(10, 120)
    const shipment = mockCreateShipment(order.id, { lines: [{ lineId, quantity: 10 }] })
    return { orderId: order.id, shipmentId: shipment.id }
  }

  it('bills the amount of the delivery, not one the caller made up', () => {
    const { orderId, shipmentId } = shippedOrder()
    const invoice = mockCreateInvoice(orderId, { shipmentId, amountNet: 1 })
    expect(invoice.amountNet).toBe(1200)
  })

  it('refuses a second invoice for the same delivery', () => {
    const { orderId, shipmentId } = shippedOrder()
    mockCreateInvoice(orderId, { shipmentId })
    expect(() => mockCreateInvoice(orderId, { shipmentId })).toThrow('SHIPMENT_ALREADY_INVOICED')
  })

  it('refuses to bill goods that came back', () => {
    const { orderId, shipmentId } = shippedOrder()
    mockCancelShipment(orderId, shipmentId)
    expect(() => mockCreateInvoice(orderId, { shipmentId })).toThrow('SHIPMENT_CANCELLED')
  })

  it('lets a correcting invoice cover an already invoiced delivery', () => {
    const { orderId, shipmentId } = shippedOrder()
    const original = mockCreateInvoice(orderId, { shipmentId })
    const correction = mockCreateInvoice(orderId, {
      kind: 'correction',
      shipmentId,
      correctsInvoiceId: original.id,
      reason: 'Wrong price on the waybill',
    })
    expect(correction.kind).toBe('correction')
    expect(correction.correctsInvoiceId).toBe(original.id)
    // A withdrawal is the mirror image of the document it withdraws — the two
    // together come to nothing, which is what "corrected" means on paper.
    expect(correction.amountNet).toBe(-original.amountNet)
    expect(correction.reason).toBe('Wrong price on the waybill')
  })

  it('refuses to correct an invoice that does not exist', () => {
    const { orderId } = shippedOrder()
    expect(() =>
      mockCreateInvoice(orderId, {
        kind: 'correction',
        correctsInvoiceId: 'nope',
        amountNet: 10,
        reason: 'Whatever',
      }),
    ).toThrow('ORIGINAL_INVOICE_NOT_FOUND')
  })

  it('will not withdraw a document without saying why', () => {
    const { orderId, shipmentId } = shippedOrder()
    const original = mockCreateInvoice(orderId, { shipmentId })
    expect(() =>
      mockCreateInvoice(orderId, { kind: 'correction', correctsInvoiceId: original.id }),
    ).toThrow('CORRECTION_REASON_REQUIRED')
  })

  it('corrects an invoice once, and never a correction', () => {
    const { orderId, shipmentId } = shippedOrder()
    const original = mockCreateInvoice(orderId, { shipmentId })
    const correction = mockCreateInvoice(orderId, {
      kind: 'correction',
      correctsInvoiceId: original.id,
      reason: 'Returned',
    })
    // Twice would reverse the same document twice over.
    expect(() =>
      mockCreateInvoice(orderId, {
        kind: 'correction',
        correctsInvoiceId: original.id,
        reason: 'Again',
      }),
    ).toThrow('INVOICE_ALREADY_CORRECTED')
    expect(() =>
      mockCreateInvoice(orderId, {
        kind: 'correction',
        correctsInvoiceId: correction.id,
        reason: 'And again',
      }),
    ).toThrow('CANNOT_CORRECT_A_CORRECTION')
  })

  it('takes the advance amount as gross and works the VAT out itself', () => {
    const { orderId } = shippedOrder()
    // 1210 with 21% VAT is 1000 net — the admin types what the client pays.
    const invoice = mockCreateInvoice(orderId, { kind: 'advance', amountGross: 1210 })
    expect([invoice.amountNet, invoice.amountGross]).toEqual([1000, 1210])
    expect(invoice.shipmentId).toBeNull()
  })

  it('refuses an advance tied to a delivery, and an amount given twice', () => {
    const { orderId, shipmentId } = shippedOrder()
    expect(() =>
      mockCreateInvoice(orderId, { kind: 'advance', shipmentId, amountGross: 100 }),
    ).toThrow('ADVANCE_HAS_NO_SHIPMENT')
    expect(() =>
      mockCreateInvoice(orderId, { kind: 'advance', amountNet: 100, amountGross: 121 }),
    ).toThrow('INVOICE_AMOUNT_AMBIGUOUS')
  })

  it('freezes the lines it covers and lets them go again when corrected', () => {
    const { orderId, shipmentId } = shippedOrder()
    const original = mockCreateInvoice(orderId, { shipmentId })
    expect(mockGetOrder(orderId)!.items[0]!.documentIssued).toBe(true)
    mockCreateInvoice(orderId, {
      kind: 'correction',
      correctsInvoiceId: original.id,
      reason: 'Wrong goods',
    })
    // The client is no longer holding a document for these lines, so the freeze
    // it put on them is gone — otherwise the correction would fix nothing.
    expect(mockGetOrder(orderId)!.items[0]!.documentIssued).toBe(false)
  })

  it('a corrected delivery can be invoiced again', () => {
    const { orderId, shipmentId } = shippedOrder()
    const original = mockCreateInvoice(orderId, { shipmentId })
    mockCreateInvoice(orderId, {
      kind: 'correction',
      correctsInvoiceId: original.id,
      reason: 'Wrong price',
    })
    const reissued = mockCreateInvoice(orderId, { shipmentId })
    expect(reissued.amountNet).toBe(original.amountNet)
  })
})

describe('the three rights of model section 12', () => {
  function asRole(role: UserProfile['role']) {
    const settings = mockGetSettings()
    mockSaveSettings({ ...settings, profile: { ...settings.profile, role } })
  }

  afterEach(() => asRole('owner'))

  it('refuses a hand-typed cost to a role without the right, and records one with it', () => {
    const { order, lineId } = orderWithLine(10, 120)

    asRole('manager')
    expect(() =>
      mockUpdateOrderItem(order.id, lineId, {
        manualUnitCost: 90,
        manualCostReason: 'Supplier invoice',
      }),
    ).toThrow('FORBIDDEN_MANUALCOST')
    // Refused before anything was written.
    expect(mockGetOrder(order.id)!.items[0]!.manualUnitCost).toBeNull()

    asRole('admin')
    mockUpdateOrderItem(order.id, lineId, {
      manualUnitCost: 90,
      manualCostReason: 'Supplier invoice',
    })
    const after = mockGetOrder(order.id)!
    expect(after.items[0]!.unitCost).toBe(90)
    // A right that leaves no trace is a right nobody can audit.
    const entry = after.auditLog[after.auditLog.length - 1]!
    expect(entry.property.en).toContain('Manual cost')
    expect(entry.newValue).toContain('Supplier invoice')
    expect(entry.user.en).not.toBe('System')
  })

  // The same right, at the neighbouring entity. `PATCH /items/:id` asked for it;
  // `PATCH /services/:id` did not ask at all, and the card hides the cell for
  // both — a rule the client keeps and the server does not.
  it('refuses a hand-typed cost on a SERVICE line too', () => {
    const created = freshOrder()
    const svc = mockAddOrderService(created.id, { serviceId: 'svc-001', quantity: 2, price: 12 })

    asRole('manager')
    expect(() => mockUpdateOrderService(created.id, svc.id, { unitCost: 3 })).toThrow(
      'FORBIDDEN_MANUALCOST',
    )
    // Refused before anything was written.
    expect(mockGetOrder(created.id)!.services[0]!.unitCost).toBe(svc.unitCost)

    asRole('admin')
    const edited = mockUpdateOrderService(created.id, svc.id, { unitCost: 3 })
    expect(edited.unitCost).toBe(3)
    const after = mockGetOrder(created.id)!
    const entry = after.auditLog[after.auditLog.length - 1]!
    expect(entry.property.en).toContain('Manual cost')
    expect(entry.user.en).not.toBe('System')
  })

  // Contract §5: cost is not sent to a user who may not see it. A history entry
  // that names the unit cost is cost, and the card renders the history whole —
  // so a role outside `seeCost` was reading the figure in the "was"/"became"
  // columns of a table nobody thought to guard.
  it('keeps cost out of the history a role without `seeCost` is given', () => {
    const { order, lineId } = orderWithLine(10, 120)
    mockUpdateOrderItem(order.id, lineId, {
      manualUnitCost: 90,
      manualCostReason: 'Supplier invoice',
    })

    const asOwner = mockGetOrder(order.id)!.auditLog
    expect(asOwner.some((e) => e.sensitive === 'cost')).toBe(true)
    expect(asOwner.some((e) => e.newValue.includes('90'))).toBe(true)

    asRole('manager')
    const asManager = mockGetOrder(order.id)!.auditLog
    expect(asManager.some((e) => e.sensitive === 'cost')).toBe(false)
    expect(asManager.some((e) => e.newValue.includes('Supplier invoice'))).toBe(false)
    // Everything that is not a cost still reaches them: the entry is filtered,
    // not the log.
    expect(asManager.length).toBeGreaterThan(0)
    // And the field is present on every entry, never absent — §3.
    expect(asManager.every((e) => 'sensitive' in e)).toBe(true)
  })

  it('refuses to correct an issued document without the right', () => {
    const { order, lineId } = orderWithLine(10, 120)
    const shipment = mockCreateShipment(order.id, { lines: [{ lineId, quantity: 10 }] })
    mockCreateInvoice(order.id, { shipmentId: shipment.id })

    asRole('accounting')
    expect(() =>
      mockCancelShipment(order.id, shipment.id, { correctionReason: 'Client refused' }),
    ).toThrow('FORBIDDEN_CORRECTION')
    expect(mockGetOrder(order.id)!.shipments[0]!.cancelled).toBe(false)

    // An ordinary cancellation is not a correction: nobody outside the warehouse
    // has been told about an uninvoiced truck.
    const plain = orderWithLine(5, 100)
    const plainShipment = mockCreateShipment(plain.order.id, {
      lines: [{ lineId: plain.lineId, quantity: 5 }],
    })
    mockCancelShipment(plain.order.id, plainShipment.id)
    expect(mockGetOrder(plain.order.id)!.shipments[0]!.cancelled).toBe(true)

    asRole('owner')
    mockCancelShipment(order.id, shipment.id, { correctionReason: 'Client refused' })
    const after = mockGetOrder(order.id)!
    expect(after.shipments[0]!.cancelled).toBe(true)
    const entry = after.auditLog[after.auditLog.length - 1]!
    expect([entry.property.en, entry.newValue]).toEqual(['Shipment correction', 'Client refused'])
  })
})

describe('cancelling a delivery the client has an invoice for', () => {
  function invoicedOrder(): { orderId: string; shipmentId: string; invoiceId: string } {
    const { order, lineId } = orderWithLine(10, 120)
    const shipment = mockCreateShipment(order.id, { lines: [{ lineId, quantity: 10 }] })
    const invoice = mockCreateInvoice(order.id, { shipmentId: shipment.id })
    return { orderId: order.id, shipmentId: shipment.id, invoiceId: invoice.id }
  }

  it('is refused with nothing to say for itself', () => {
    const { orderId, shipmentId } = invoicedOrder()
    expect(() => mockCancelShipment(orderId, shipmentId)).toThrow('SHIPMENT_ALREADY_INVOICED')
    // Nothing moved: the refusal happens before any write.
    expect(mockGetOrder(orderId)!.shipments[0]!.cancelled).toBe(false)
    expect(mockGetOrder(orderId)!.items[0]!.shippedQuantity).toBe(10)
  })

  it('withdraws the document and returns the goods in one call', () => {
    const { orderId, shipmentId, invoiceId } = invoicedOrder()
    const before = mockGetOrder(orderId)!
    const batchId = before.items[0]!.allocations[0]!.batchId!
    const stockBefore = batchById(batchId)!.quantityRemaining

    mockCancelShipment(orderId, shipmentId, { correctionReason: 'Client returned the load' })

    const after = mockGetOrder(orderId)!
    const correction = after.invoices.find((i) => i.kind === 'correction')!
    expect(correction.correctsInvoiceId).toBe(invoiceId)
    expect(correction.reason).toBe('Client returned the load')
    // The document is withdrawn AND the goods are back — a correction on its own
    // would leave the client a credit note for goods the system says they have.
    expect(after.shipments[0]!.cancelled).toBe(true)
    expect(after.items[0]!.shippedQuantity).toBe(0)
    expect(batchById(batchId)!.quantityRemaining).toBe(round2(stockBefore + 10))
    // Free to be repriced again: that is the point of correcting.
    expect(after.items[0]!.documentIssued).toBe(false)
  })

  it('an advance invoice is not touched when a delivery invoice is corrected', () => {
    const { order, lineId } = orderWithLine(10, 120)
    mockAddOrderService(order.id, { serviceId: 'svc-001', quantity: 1, price: 50 })
    const advance = mockCreateInvoice(order.id, { kind: 'advance', amountGross: 121 })
    const shipment = mockCreateShipment(order.id, { lines: [{ lineId, quantity: 10 }] })
    const regular = mockCreateInvoice(order.id, { shipmentId: shipment.id })
    // A regular invoice bills the services too — they never ship, so nothing else
    // would ever freeze them.
    expect(mockGetOrder(order.id)!.services[0]!.documentIssued).toBe(true)

    mockCreateInvoice(order.id, {
      kind: 'correction',
      correctsInvoiceId: regular.id,
      reason: 'Load refused',
    })
    const after = mockGetOrder(order.id)!
    // The advance is a live document still, but it covers an amount rather than
    // lines — so it freezes neither the line nor the service.
    expect(after.invoices.find((i) => i.id === advance.id)!.kind).toBe('advance')
    expect(after.items[0]!.documentIssued).toBe(false)
    expect(after.services[0]!.documentIssued).toBe(false)
  })

  it('refuses the shapes that would leave a document meaning nothing', () => {
    const { order, lineId } = orderWithLine(10, 120)
    const shipment = mockCreateShipment(order.id, { lines: [{ lineId, quantity: 10 }] })
    const regular = mockCreateInvoice(order.id, { shipmentId: shipment.id })
    // An amount is the only thing an advance has to say for itself.
    expect(() => mockCreateInvoice(order.id, { kind: 'advance' })).toThrow(
      'INVOICE_AMOUNT_REQUIRED',
    )
    // Only a correction refers to an original — otherwise the reference is a lie
    // about what kind of document this is.
    expect(() =>
      mockCreateInvoice(order.id, { shipmentId: shipment.id, correctsInvoiceId: regular.id }),
    ).toThrow('CORRECTION_NEEDS_KIND')
    expect(() => mockCreateInvoice(order.id, { shipmentId: 'ghost' })).toThrow('SHIPMENT_NOT_FOUND')
  })

  it('withdrawing a document does not reprice the line it covered', () => {
    // The line goes back to being editable, which is the point — but nothing about
    // the money on it may move by itself. A correction says what was billed was
    // wrong, not what the line is worth.
    const { order, lineId } = orderWithLine(10, 120)
    const priced = mockUpdateOrderItem(order.id, lineId, { manualUnitPrice: 108 })
    const shipment = mockCreateShipment(order.id, { lines: [{ lineId, quantity: 10 }] })
    const invoice = mockCreateInvoice(order.id, { shipmentId: shipment.id })
    mockCreateInvoice(order.id, {
      kind: 'correction',
      correctsInvoiceId: invoice.id,
      reason: 'Billed at the wrong price',
    })
    const after = mockGetOrder(order.id)!.items[0]!
    expect([after.unitPrice, after.manualUnitPrice, after.discountPercent]).toEqual([
      priced.unitPrice,
      priced.manualUnitPrice,
      priced.discountPercent,
    ])
  })

  it('will not take a payment against an invoice nobody issued', () => {
    const { order } = orderWithLine(10, 120)
    expect(() => mockAddOrderPayment(order.id, { amount: 100, invoiceId: 'ghost' })).toThrow(
      'PAYMENT_INVOICE_NOT_FOUND',
    )
    expect(() => mockDeleteOrderPayment(order.id, 'ghost')).toThrow('PAYMENT_NOT_FOUND')
  })

  it('does not issue a correction when there is no document to withdraw', () => {
    const { order, lineId } = orderWithLine(10, 120)
    const shipment = mockCreateShipment(order.id, { lines: [{ lineId, quantity: 10 }] })
    mockCancelShipment(order.id, shipment.id, { correctionReason: 'Typed anyway' })
    expect(mockGetOrder(order.id)!.invoices.length).toBe(0)
  })
})

describe('services never ship', () => {
  it('a shipment cannot contain a service line', () => {
    const created = freshOrder()
    const svc = mockAddOrderService(created.id, { serviceId: 'svc-001', quantity: 1, price: 12 })
    // Services are not goods: there is nothing to put on a truck.
    expect(() =>
      mockCreateShipment(created.id, { lines: [{ lineId: svc.id, quantity: 1 }] }),
    ).toThrow('ORDER_ITEM_NOT_FOUND')
  })

  it('and are left out of the shipped share', () => {
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 2,
      unit: 'pcs',
      unitPrice: 100,
    })
    mockAddOrderService(created.id, { serviceId: 'svc-001', quantity: 1, price: 12 })
    mockCreateShipment(created.id, { lines: [{ lineId: item.id, quantity: 2 }] })

    const row = mockGetOrders(
      {
        search: '',
        status: 'all',
        clientId: null,
        dateFrom: '',
        dateTo: '',
        sortBy: null,
        sortDir: 'asc',
      },
      { page: 1, pageSize: 1000 },
    ).items.find((o) => o.id === created.id)!
    // Everything shippable has shipped, so the share is 100% — the service does
    // not drag it down to 94%.
    expect(row.shippedPercent).toBe(100)
  })
})

// ─── Clearing a manual cost ─────────────────────────────────────────────────

describe('taking a manual cost back off', () => {
  /**
   * A line with exactly this breakdown behind it — asked for by putting the goods
   * on the shelves that would produce it.
   *
   * The batch ids are real ones from the warehouse mock: a shipment writes goods
   * off an actual shelf, and an invented batch id would only prove that the test
   * data is invented. They are stated in FIFO order, and each is given exactly
   * the free quantity and the cost the line is supposed to read off it; the shelf
   * goes back to what it was as soon as the line has been costed, because every
   * other test in this file reads the same batches.
   */
  function lineWithBatches(
    allocations: Array<{ batchId: string; quantity: number; unitCost: number }>,
    quantity: number,
  ): { orderId: string; lineId: string } {
    const created = freshOrder()
    const undo = allocations.map((a) => shelve(a.batchId, a.quantity, a.unitCost))
    let item
    try {
      item = mockAddOrderItem(created.id, {
        productId: 'prod-001',
        quantity,
        unit: 'pcs',
        unitPrice: 200,
      })
    } finally {
      for (const restore of undo) restore()
    }
    expect(item.allocations.map((a) => [a.batchId, a.quantity, a.unitCost])).toEqual(
      allocations.map((a) => [a.batchId, a.quantity, a.unitCost]),
    )
    return { orderId: created.id, lineId: item.id }
  }

  it('restores the weighted cost of the batches behind the line', () => {
    const { orderId, lineId } = lineWithBatches(
      [
        { batchId: 'whb-001', quantity: 6, unitCost: 100 },
        { batchId: 'whb-002', quantity: 4, unitCost: 110 },
      ],
      10,
    )
    mockUpdateOrderItem(orderId, lineId, {
      manualUnitCost: 500,
      manualCostReason: 'Supplier invoice',
    })
    expect(mockGetOrder(orderId)!.items[0]!.unitCost).toBe(500)

    const restored = mockUpdateOrderItem(orderId, lineId, { manualUnitCost: null })
    expect(restored.unitCost).toBe(104) // (6×100 + 4×110) ÷ 10
    expect(restored.costSource).toBe('stock')
    expect(restored.manualCostReason).toBeNull()
  })

  it('divides by the real quantity, even when the line is a fraction of a unit', () => {
    // Guarding the divisor with Math.max(…, 1) halved the cost here.
    const { orderId, lineId } = lineWithBatches(
      [{ batchId: 'whb-001', quantity: 0.5, unitCost: 80 }],
      0.5,
    )
    mockUpdateOrderItem(orderId, lineId, {
      manualUnitCost: 500,
      manualCostReason: 'Supplier invoice',
    })
    const restored = mockUpdateOrderItem(orderId, lineId, { manualUnitCost: null })
    expect(restored.unitCost).toBe(80)
  })

  it('is refused when there are no batches to read a cost from', () => {
    // Dropping the marker while the typed number stays would leave a cost that
    // claims to come from the warehouse and no longer says who typed it.
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: PRODUCT_OUT_OF_STOCK,
      quantity: 10,
      unit: 'pcs',
      unitPrice: 120,
    })
    mockUpdateOrderItem(created.id, item.id, {
      manualUnitCost: 130,
      manualCostReason: 'why not',
    })
    expect(() => mockUpdateOrderItem(created.id, item.id, { manualUnitCost: null })).toThrow(
      'NO_STOCK_COST',
    )
    const after = mockGetOrder(created.id)!.items[0]!
    expect(after.unitCost).toBe(130)
    expect(after.manualCostReason).toBe('why not')
  })

  it('cannot be taken back off a frozen line', () => {
    const { orderId, lineId } = lineWithBatches(
      [{ batchId: 'whb-001', quantity: 5, unitCost: 90 }],
      5,
    )
    mockUpdateOrderItem(orderId, lineId, { manualUnitCost: 500, manualCostReason: 'r' })
    mockCreateShipment(orderId, { lines: [{ lineId, quantity: 5 }] })
    // Frozen: the cost stays as it was when the goods left, marker and all.
    expect(() => mockUpdateOrderItem(orderId, lineId, { manualUnitCost: null })).toThrow(
      'COST_FROZEN_BY_SHIPMENT',
    )
    const after = mockGetOrder(orderId)!.items[0]!
    expect(after.unitCost).toBe(500)
    expect(after.manualUnitCost).toBe(500)
  })
})

// ─── Service edits, all of them ─────────────────────────────────────────────

describe('every kind of service edit', () => {
  function service(): { orderId: string; svcId: string } {
    const created = freshOrder()
    const svc = mockAddOrderService(created.id, { serviceId: 'svc-001', quantity: 2, price: 12 })
    return { orderId: created.id, svcId: svc.id }
  }

  it('quantity', () => {
    const { orderId, svcId } = service()
    expect(mockUpdateOrderService(orderId, svcId, { quantity: 5 }).totalPrice).toBe(60)
  })

  it('price', () => {
    const { orderId, svcId } = service()
    const edited = mockUpdateOrderService(orderId, svcId, { manualUnitPrice: 10 })
    expect(edited.price).toBe(10)
    expect(edited.totalPrice).toBe(20)
  })

  it('line total', () => {
    const { orderId, svcId } = service()
    expect(mockUpdateOrderService(orderId, svcId, { lineTotal: 20 }).price).toBe(10)
  })

  it('margin', () => {
    const { orderId, svcId } = service()
    // Cost 5, margin 100% → price 10.
    expect(mockUpdateOrderService(orderId, svcId, { marginPercent: 100 }).price).toBe(10)
  })

  it('cost', () => {
    const { orderId, svcId } = service()
    const edited = mockUpdateOrderService(orderId, svcId, { unitCost: 8 })
    expect(edited.cost).toBe(8)
    expect(edited.costSource).toBe('manual')
  })

  it('reset back to the computed price', () => {
    const { orderId, svcId } = service()
    mockUpdateOrderService(orderId, svcId, { manualUnitPrice: 10 })
    expect(mockUpdateOrderService(orderId, svcId, { resetPrice: true }).price).toBe(12)
  })

  // This used to set the quantity to zero and then check that a line total was
  // refused for want of something to divide by. The zero is now refused where it
  // is set — the creating endpoints always refused it and the editing one did
  // not — so the setup is the assertion.
  it('refuses a quantity of zero on an edit, as it does on a create', () => {
    const { orderId, svcId } = service()
    expect(() => mockUpdateOrderService(orderId, svcId, { quantity: 0 })).toThrow('ZERO_QUANTITY')
    expect(mockGetOrder(orderId)!.services.find((s) => s.id === svcId)!.quantity).toBeGreaterThan(0)
  })
})

// ─── Dashboard counts ───────────────────────────────────────────────────────

describe('sales CRM statistics', () => {
  it('counts every order, not the ones that fit on a page', () => {
    const before = mockGetSalesCrmStats()
    // The store holds 100 orders and the dashboard used to read exactly 100:
    // the 101st entered its window from the top and the oldest fell out, so
    // the counts never moved.
    const created = mockCreateOrder({
      clientId: mockGetClients()[0]!.id,
      documentType: 'local',
    })
    expect(created.status).toBe('new')

    const after = mockGetSalesCrmStats()
    expect(after.activeOrders).toBe(before.activeOrders + 1)
    expect(after.pendingOrders).toBe(before.pendingOrders + 1)
  })

  it('agrees with counting the orders by hand', () => {
    const stats = mockGetSalesCrmStats()
    const orders = allOrders()
    expect(stats.activeOrders).toBe(
      orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').length,
    )
    expect(stats.pendingOrders).toBe(
      orders.filter((o) => o.status === 'new' || o.status === 'confirmed').length,
    )
  })

  it('sums this month sales net of VAT, and counts this month clients', () => {
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const stats = mockGetSalesCrmStats()
    const expectedSales = allOrders()
      // Named by the same predicate the server uses, not by a hand-kept list of
      // statuses: the list version silently dropped `paid` and would have gone
      // stale again on every status the module gained (§4.7).
      .filter((o) => countsAsSale(o.status) && new Date(o.createdAt) >= monthStart)
      .reduce((sum, o) => round2(sum + o.totalAmount), 0)
    expect(stats.salesMtd).toBe(expectedSales)
    expect(stats.newClientsThisMonth).toBe(
      mockGetClients().filter((c) => new Date(c.createdAt) >= monthStart).length,
    )
  })
})

// ─── When a movement happened ───────────────────────────────────────────────

describe('a movement is dated by the shipment, not by the moment it was recorded', () => {
  function shippableLine(quantity = 10) {
    const created = freshOrder()
    mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity,
      unit: 'pcs',
      unitPrice: 200,
    })
    return { orderId: created.id, item: mockGetOrder(created.id)!.items[0]! }
  }

  it('stamps the write-off with the day the goods left', () => {
    const { orderId, item } = shippableLine(10)
    const shippedAt = '2026-01-07T09:00:00.000Z'

    const shipment = mockCreateShipment(orderId, {
      lines: [{ lineId: item.id, quantity: 4 }],
      shippedAt,
    })

    const movements = mockGetMovementsFor('order-shipment', shipment.id)
    expect(movements.length).toBeGreaterThan(0)
    expect(movements.every((m) => m.movedAt === shippedAt)).toBe(true)
  })

  it('dates every seeded write-off by its own shipment', () => {
    for (const order of allOrders()) {
      for (const shipment of order.shipments) {
        if (shipment.cancelled) continue
        for (const movement of mockGetMovementsFor('order-shipment', shipment.id)) {
          expect(movement.movedAt).toBe(shipment.shippedAt)
        }
      }
    }
  })

  it('dates the reversal now, because that is when the goods came back', () => {
    const { orderId, item } = shippableLine(10)
    const shipment = mockCreateShipment(orderId, {
      lines: [{ lineId: item.id, quantity: 4 }],
      shippedAt: '2026-01-07T09:00:00.000Z',
    })
    const startedAt = new Date().toISOString()

    mockCancelShipment(orderId, shipment.id)

    const reversals = mockGetMovementsFor('order-shipment-cancelled', shipment.id)
    expect(reversals.length).toBeGreaterThan(0)
    expect(reversals.every((m) => m.movedAt >= startedAt)).toBe(true)
  })
})

// ─── The demo's clock ───────────────────────────────────────────────────────

describe('the seeded history is relative to today, not to a date it was written on', () => {
  // Read at collection time, before any test in this file creates an order of
  // its own: those are stamped `now` and would hide a history stuck in the past.
  const seeded = allOrders().map((o) => new Date(o.createdAt))

  function daysBefore(date: Date): number {
    return Math.round((Date.now() - date.getTime()) / 86_400_000)
  }

  it('ends today rather than on some month in the past', () => {
    const newest = [...seeded].sort((a, b) => b.getTime() - a.getTime())[0]!
    expect(daysBefore(newest)).toBeLessThanOrEqual(3)
    expect(newest.getTime()).toBeLessThanOrEqual(Date.now())
  })

  it('still starts about half a year back, so the history is a history', () => {
    const oldest = [...seeded].sort((a, b) => a.getTime() - b.getTime())[0]!
    expect(daysBefore(oldest)).toBeGreaterThan(150)
  })

  it('keeps the last month alive, which is what the dashboard reads', () => {
    // Deliberately a rolling 30 days rather than the calendar month the KPI
    // uses: on the 1st of a month the calendar month is legitimately near
    // empty, and a test must not depend on the day it runs.
    const monthAgo = Date.now() - 30 * 86_400_000
    const recent = allOrders().filter((o) => new Date(o.createdAt).getTime() >= monthAgo)
    expect(recent.length).toBeGreaterThan(0)
    expect(
      recent.filter((o) => ['confirmed', 'shipped', 'delivered'].includes(o.status)).length,
    ).toBeGreaterThan(0)
    expect(
      mockGetClients().filter((c) => new Date(c.createdAt).getTime() >= monthAgo).length,
    ).toBeGreaterThan(0)
  })
})

// ─── Filtering the list by date ─────────────────────────────────────────────

describe('the orders list filters by date', () => {
  function listBetween(dateFrom: string, dateTo: string) {
    return mockGetOrders(
      { search: '', status: 'all', clientId: null, dateFrom, dateTo, sortBy: null, sortDir: 'asc' },
      { page: 1, pageSize: 1000 },
    )
  }

  // Read inside each test, not once at collection time: other tests in this
  // file create orders of their own, and a baseline taken before them is a
  // baseline of a store that no longer exists.
  it('keeps only what was created on or after dateFrom', () => {
    const all = listBetween('', '')
    const cutoff = all.items[Math.floor(all.items.length / 2)]!.createdAt.slice(0, 10)
    const page = listBetween(cutoff, '')
    expect(page.items.length).toBeGreaterThan(0)
    expect(page.items.length).toBeLessThan(all.total)
    expect(page.items.every((o) => o.createdAt.slice(0, 10) >= cutoff)).toBe(true)
    // `total` is the size of the filtered set, or the pager lies about it.
    expect(page.total).toBe(page.items.length)
  })

  it('keeps only what was created on or before dateTo, that day included', () => {
    const all = listBetween('', '')
    const cutoff = all.items[Math.floor(all.items.length / 2)]!.createdAt.slice(0, 10)
    const page = listBetween('', cutoff)
    expect(page.items.length).toBeGreaterThan(0)
    expect(page.items.every((o) => o.createdAt.slice(0, 10) <= cutoff)).toBe(true)
    // The day named in `dateTo` belongs to the range: an order at 17:00 that day
    // is on that day, not after it.
    expect(page.items.some((o) => o.createdAt.slice(0, 10) === cutoff)).toBe(true)
  })

  it('a range of one day returns that day', () => {
    const all = listBetween('', '')
    const day = all.items[0]!.createdAt.slice(0, 10)
    const page = listBetween(day, day)
    expect(page.items.length).toBeGreaterThan(0)
    expect(page.items.every((o) => o.createdAt.slice(0, 10) === day)).toBe(true)
  })
})

// ─── Correcting a frozen line ───────────────────────────────────────────────

describe('correcting a line that has already gone out', () => {
  /** A shipped, invoiced line — the only state a correction applies to. */
  function shippedAndInvoiced(quantity = 4, unitPrice = 100) {
    const created = freshOrder()
    const line = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity,
      unit: 'pcs',
      unitPrice,
    })
    const shipment = mockCreateShipment(created.id, {
      lines: [{ lineId: line.id, quantity }],
    })
    const invoice = mockCreateInvoice(created.id, { shipmentId: shipment.id })
    return { orderId: created.id, lineId: line.id, shipment, invoice }
  }

  it('is the only way past the freeze, and it produces a document', () => {
    const { orderId, lineId, invoice } = shippedAndInvoiced()
    // The ordinary way is closed, and stays closed.
    expect(() => mockUpdateOrderItem(orderId, lineId, { manualUnitPrice: 90 })).toThrow(
      'PRICE_FROZEN_BY_SHIPMENT',
    )

    mockCorrectOrderLine(orderId, lineId, {
      unitPrice: 90,
      reason: 'Agreed at 90,00; the waybill was printed with 100,00',
    })

    const after = mockGetOrder(orderId)!
    expect(after.items[0]!.unitPrice).toBe(90)
    expect(after.totalAmount).toBe(360)
    // The issued document is not rewritten — a second one adjusts it by the
    // difference over the quantity that document actually billed: 4 × −10.
    const correction = after.invoices.find((i) => i.kind === 'correction')!
    expect(correction.correctsInvoiceId).toBe(invoice.id)
    expect(correction.amountNet).toBe(-40)
    expect(correction.withdrawsOriginal).toBe(false)
    expect(correction.reason).toContain('Agreed at 90,00')
    // The two documents together say what was really agreed.
    expect(round2(invoice.amountNet + correction.amountNet)).toBe(after.totalAmount)
    // The line stays frozen: the goods are still gone.
    expect(after.items[0]!.state).toBe('shipped')
    expect(after.items[0]!.documentIssued).toBe(true)
    // And it is in the history, with who and why.
    const entry = after.auditLog[after.auditLog.length - 1]!
    expect(entry.property.ru).toContain('Корректировка цены')
    expect(entry.newValue).toContain('Agreed at 90,00')
  })

  it('does not touch the warehouse — a wrong quantity is a different operation', () => {
    const { orderId, lineId, shipment } = shippedAndInvoiced()
    const before = mockGetMovementsFor('order-shipment', shipment.id).map((m) => m.quantity)
    mockCorrectOrderLine(orderId, lineId, { unitPrice: 90, reason: 'Price agreed lower' })
    expect(mockGetMovementsFor('order-shipment', shipment.id).map((m) => m.quantity)).toEqual(
      before,
    )
    expect(mockGetOrder(orderId)!.items[0]!.shippedQuantity).toBe(4)
  })

  it('moves only the margin when the cost is what was wrong', () => {
    const { orderId, lineId } = shippedAndInvoiced()
    const before = mockGetOrder(orderId)!
    mockCorrectOrderLine(orderId, lineId, {
      unitCost: 75,
      reason: 'Supplier invoice priced the batch at 75,00',
    })
    const after = mockGetOrder(orderId)!
    // The client sees nothing: no new document, and the price does not move.
    expect(after.invoices.filter((i) => i.kind === 'correction')).toHaveLength(0)
    expect(after.items[0]!.unitPrice).toBe(before.items[0]!.unitPrice)
    expect(after.totalAmount).toBe(before.totalAmount)
    // Only the profit does.
    expect(after.items[0]!.unitCost).toBe(75)
    expect(after.totalCost).toBe(300)
    expect(after.items[0]!.costSource).toBe('manual')
  })

  it('needs a reason, a change, a right, and a line that is actually frozen', () => {
    const { orderId, lineId } = shippedAndInvoiced()
    expect(() => mockCorrectOrderLine(orderId, lineId, { unitPrice: 90 })).toThrow(
      'CORRECTION_REASON_REQUIRED',
    )
    expect(() => mockCorrectOrderLine(orderId, lineId, { reason: 'why not' })).toThrow(
      'CORRECTION_NEEDS_CHANGE',
    )

    // An open line is edited the ordinary way; routing it through here would put a
    // correcting document against a delivery that never happened.
    const open = freshOrder()
    const draft = mockAddOrderItem(open.id, {
      productId: 'prod-001',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 100,
    })
    expect(() => mockCorrectOrderLine(open.id, draft.id, { unitPrice: 90, reason: 'no' })).toThrow(
      'LINE_NOT_FROZEN',
    )
  })

  it('is refused to a role without the right, whatever the buttons say', () => {
    const { orderId, lineId } = shippedAndInvoiced()
    const settings = mockGetSettings()
    mockSaveSettings({ ...settings, profile: { ...settings.profile, role: 'manager' } })
    try {
      expect(() =>
        mockCorrectOrderLine(orderId, lineId, { unitPrice: 90, reason: 'Agreed lower' }),
      ).toThrow('FORBIDDEN_CORRECTION')
    } finally {
      const now = mockGetSettings()
      mockSaveSettings({ ...now, profile: { ...now.profile, role: 'owner' } })
    }
    expect(mockGetOrder(orderId)!.items[0]!.unitPrice).toBe(100)
  })

  it('adjusts only the part each document billed', () => {
    // Two trucks, two invoices, one line: correcting the price owes each document
    // its own share of the difference, not the whole line's.
    const created = freshOrder()
    const line = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 100,
    })
    const first = mockCreateShipment(created.id, { lines: [{ lineId: line.id, quantity: 4 }] })
    const invoiceA = mockCreateInvoice(created.id, { shipmentId: first.id })
    const second = mockCreateShipment(created.id, { lines: [{ lineId: line.id, quantity: 6 }] })
    const invoiceB = mockCreateInvoice(created.id, { shipmentId: second.id })

    mockCorrectOrderLine(created.id, line.id, { unitPrice: 90, reason: 'Agreed at 90,00' })

    const after = mockGetOrder(created.id)!
    const corrections = after.invoices.filter((i) => i.kind === 'correction')
    expect(corrections.map((c) => c.amountNet).sort((a, b) => a - b)).toEqual([-60, -40])
    expect(corrections.map((c) => c.correctsInvoiceId).sort()).toEqual(
      [invoiceA.id, invoiceB.id].sort(),
    )
    // Everything issued, added up, is what the order now comes to.
    expect(round2(after.invoices.reduce((sum, i) => sum + i.amountNet, 0))).toBe(after.totalAmount)
  })

  it('needs nothing issued to correct when nothing was issued', () => {
    const created = freshOrder()
    const line = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 2,
      unit: 'pcs',
      unitPrice: 100,
    })
    mockCreateShipment(created.id, { lines: [{ lineId: line.id, quantity: 2 }] })

    mockCorrectOrderLine(created.id, line.id, { unitPrice: 90, reason: 'Agreed at 90,00' })
    const after = mockGetOrder(created.id)!
    expect(after.invoices).toHaveLength(0)
    expect(after.totalAmount).toBe(180)
  })
})

// ─── Contract §3: the version on every mutation ─────────────────────────────

describe('the order version guards every write, not five of them', () => {
  /**
   * §3: "клиент присылает ту версию, которую видел; если она отстала, сервер
   * отклоняет ORDER_VERSION_CONFLICT и не пишет ничего."
   *
   * It used to guard five endpoints out of twenty. The other fifteen — a status
   * change, a shipment, a payment, an invoice, a correction, every deletion —
   * took a stale write in silence, which is precisely the two-tabs case the
   * version exists for.
   */
  function twoTabs(): { orderId: string; lineId: string; stale: number } {
    const { order, lineId } = orderWithLine(10, 120)
    // Optional on the type — a server that predates the field sends none — but
    // this mock always has one, and a test that shrugged at its absence would
    // pass while checking nothing.
    const stale = mockGetOrder(order.id)!.version!
    // Somebody else writes. Both tabs were holding `stale`; only one still is.
    mockPatchOrder(order.id, { notes: 'the other tab got here first' })
    return { orderId: order.id, lineId, stale }
  }

  it('refuses a stale write on every mutating endpoint', () => {
    const cases: Array<[string, (o: string, l: string, v: number) => unknown]> = [
      ['patch order', (o, _l, v) => mockPatchOrder(o, { notes: 'mine', version: v })],
      ['patch status', (o, _l, v) => mockPatchOrderStatus(o, 'confirmed', v)],
      [
        'add item',
        (o, _l, v) =>
          mockAddOrderItem(o, {
            productId: 'prod-001',
            quantity: 1,
            unit: 'pcs',
            unitPrice: 10,
            version: v,
          }),
      ],
      ['update item', (o, l, v) => mockUpdateOrderItem(o, l, { quantity: 5, version: v })],
      ['delete item', (o, l, v) => mockDeleteOrderItem(o, l, v)],
      [
        'add service',
        (o, _l, v) =>
          mockAddOrderService(o, { serviceId: 'svc-001', quantity: 1, price: 10, version: v }),
      ],
      ['allocate total', (o, _l, v) => mockAllocateOrderTotal(o, 100, v)],
      [
        'create shipment',
        (o, l, v) => mockCreateShipment(o, { lines: [{ lineId: l, quantity: 1 }], version: v }),
      ],
      ['reserve', (o, _l, v) => mockReserveOrder(o, v)],
      ['add payment', (o, _l, v) => mockAddOrderPayment(o, { amount: 10, version: v })],
      [
        'create invoice',
        (o, _l, v) => mockCreateInvoice(o, { kind: 'advance', amountGross: 10, version: v }),
      ],
      ['delete order', (o, _l, v) => mockDeleteOrder(o, v)],
    ]
    for (const [name, run] of cases) {
      const { orderId, lineId, stale } = twoTabs()
      const before = structuredClone(mockGetOrder(orderId)!)
      expect(() => run(orderId, lineId, stale), name).toThrow('ORDER_VERSION_CONFLICT')
      // And nothing was written: a refused write leaves the order byte for byte.
      expect(mockGetOrder(orderId), name).toEqual(before)
    }
  })

  it('lets the same write through once the caller has caught up', () => {
    const { orderId } = twoTabs()
    const current = mockGetOrder(orderId)!.version!
    expect(() => mockPatchOrderStatus(orderId, 'confirmed', current)).not.toThrow()
    expect(mockGetOrder(orderId)!.status).toBe('confirmed')
  })

  it('checks nothing when the caller states no version — the mock is driven directly', () => {
    // The demo generator, the shipping code that invoices as it works, and a
    // hundred specs call these functions without ever reading an order. A version
    // is a claim about what was read; a caller that read nothing cannot make it.
    const { orderId } = twoTabs()
    expect(() => mockPatchOrderStatus(orderId, 'confirmed')).not.toThrow()
  })

  /**
   * The bookkeeping this rests on: one accepted write, one step. A mutation that
   * writes without stepping — or steps without writing — puts a card that counts
   * along out of phase, and from then on its own next request is refused as a
   * conflict that never happened.
   */
  it('steps exactly once per accepted write, and not at all per refused one', () => {
    const { order, lineId } = orderWithLine(4, 100)
    const v0 = mockGetOrder(order.id)!.version!

    mockUpdateOrderItem(order.id, lineId, { quantity: 5 })
    expect(mockGetOrder(order.id)!.version!).toBe(v0 + 1)

    expect(() => mockUpdateOrderItem(order.id, lineId, { quantity: 0 })).toThrow('ZERO_QUANTITY')
    expect(mockGetOrder(order.id)!.version!).toBe(v0 + 1)

    const file = mockAddOrderFile(order.id, 'file-abc', 'spec.pdf')
    expect(mockGetOrder(order.id)!.version!).toBe(v0 + 2)

    // Removing a file nobody attached used to write nothing, step nothing and
    // report success — the one mutation whose bump sat inside an `if`.
    expect(() => mockRemoveOrderFile(order.id, 'file-that-was-never-here')).toThrow(
      'ORDER_FILE_NOT_FOUND',
    )
    expect(mockGetOrder(order.id)!.version!).toBe(v0 + 2)

    mockRemoveOrderFile(order.id, file.fileId)
    expect(mockGetOrder(order.id)!.version!).toBe(v0 + 3)
  })
})

// ─── ORD-100 — the order the list opens on ──────────────────────────────────

describe('the showcase order', () => {
  /**
   * It exists so the first thing anybody opens shows every state the module can
   * express. That is only worth something if the states are really there — and
   * they are produced by driving the endpoints, so each assertion below is also a
   * statement that the path which produces it still works.
   *
   * Written as "at least one of each" rather than exact counts: the shelf is
   * shared with a hundred generated orders and a truck the warehouse cannot back
   * simply does not go. What must not happen is a state quietly disappearing.
   */
  const order = mockGetOrder('ORD-100')!

  it('is the newest of the seeded orders, so the demo opens on it', () => {
    // Asked of the SEEDED hundred, not of the whole store: the specs above this
    // one create orders as they go, and by the time this runs the newest row is
    // one of theirs. The claim being made is about the demo as it ships.
    const page = mockGetOrders(
      {
        search: '',
        status: 'all',
        clientId: null,
        dateFrom: '',
        dateTo: '',
        sortBy: null,
        sortDir: 'asc',
      },
      { page: 1, pageSize: 1000 },
    )
    const seeded = page.items.filter((o) => /^ORD-0\d\d$|^ORD-100$/.test(o.id))
    expect(seeded.length).toBe(100)
    expect(seeded[0]!.id).toBe('ORD-100')
  })

  it('carries a line in every state the table can render', () => {
    const items = order.items
    // Shipped whole and named by a document — no cell open, no bin.
    expect(items.some((i) => i.state === 'shipped' && i.documentIssued)).toBe(true)
    // Half gone — the state that offers the split.
    expect(items.some((i) => i.state === 'partially_shipped')).toBe(true)
    // A price somebody named: locked, and offering "back to computed".
    expect(items.some((i) => i.manualUnitPrice !== null)).toBe(true)
    // A cost somebody typed, with the sentence that says why.
    expect(items.some((i) => i.manualUnitCost !== null && i.manualCostReason !== null)).toBe(true)
    // More than the shelf holds: the covered part real, the rest a guess.
    expect(items.some((i) => i.costSource === 'estimate')).toBe(true)
    // And one ordinary draft the others are read against.
    expect(
      items.some(
        (i) =>
          i.state === 'draft' &&
          !i.documentIssued &&
          i.manualUnitPrice === null &&
          i.manualUnitCost === null,
      ),
    ).toBe(true)
  })

  it('carries a service already billed and one that is not', () => {
    expect(order.services.some((s) => s.documentIssued)).toBe(true)
    // The service added after the invoice — §4.6, the money that used to have
    // nowhere to go. It is what makes the card's "invoice services" button appear.
    expect(order.services.some((s) => !s.documentIssued)).toBe(true)
  })

  it('carries a delivery that went and one that came back', () => {
    expect(order.shipments.some((s) => !s.cancelled)).toBe(true)
    expect(order.shipments.some((s) => s.cancelled)).toBe(true)
  })

  it('carries all three kinds of document, and the correction adjusts rather than withdraws', () => {
    const kinds = new Set(order.invoices.map((i) => i.kind))
    expect([...kinds].sort()).toEqual(['advance', 'correction', 'regular'])
    const correction = order.invoices.find((i) => i.kind === 'correction')!
    // A stated amount, so the client goes on holding the original — which is why
    // the corrected line is still frozen.
    expect(correction.withdrawsOriginal).toBe(false)
    expect(correction.reason).toBeTruthy()
  })

  it('carries money in and money back', () => {
    expect(order.payments.some((p) => p.purpose === 'advance' && p.amount > 0)).toBe(true)
    expect(order.payments.some((p) => p.purpose === 'balance' && p.amount > 0)).toBe(true)
    // A refund is a negative amount, never a deleted payment.
    expect(order.payments.some((p) => p.purpose === 'refund' && p.amount < 0)).toBe(true)
  })

  it('says the same figure in the card and in the incoming registry', () => {
    // Пункт 14. Карточка считает деньги ЗАКАЗА, реестр «Входящих» — деньги по
    // ДОКУМЕНТАМ. Пока возврат на -120 не называл документа, первая цифра была
    // 3380, вторая 3500, и на экране ничто этого не объясняло. Проверяется не
    // «панель непустая», а то, что две цифры сошлись.
    const byDocument = round2(
      invoiceBalances(order.invoices, order.payments).reduce((sum, b) => sum + b.paidAmount, 0),
    )
    expect(order.paidAmount).toBe(byDocument)
  })

  it('carries a history that wrote itself, including one entry the cost right hides', () => {
    expect(order.auditLog.length).toBeGreaterThan(0)
    expect(order.auditLog.some((a) => a.sensitive === 'cost')).toBe(true)
    // Every entry says what it is, present or null — never absent (§3).
    expect(order.auditLog.every((a) => 'sensitive' in a)).toBe(true)
  })

  it('holds stock and carries files', () => {
    expect(mockGetReservations({ orderId: 'ORD-100' }).length).toBeGreaterThan(0)
    expect(order.files.length).toBeGreaterThan(0)
  })

  it('invents nothing: it is assembled by the endpoints, so it obeys the rollup', () => {
    const sum = [...order.items, ...order.services].reduce(
      (s, l) => round2(s + calcLine(toPricingLine(l)).lineNet),
      0,
    )
    expect(order.totalAmount).toBe(sum)
    // And no hand-written weight — products carry none, so neither does this.
    expect(order.totalWeight).toBe(0)
  })
})

describe("the client's issued invoices", () => {
  /**
   * The client card asks one question — "what has this client been billed and what
   * of it is still owed" — and the answer has to survive three things the demo
   * store really contains: a correction that takes a document back, a correction
   * that only moves its amount, and money that names no document at all.
   *
   * The last one is the reason this file counts money and not just rows. Thirteen
   * of the hundred seeded orders hold payments with `invoiceId: null`, eleven of
   * them have no invoice whatever — a summary that adds up only the payments with a
   * reference tells a client who has paid 6971,72 EUR that they have paid 2000.
   */

  /** Every currency the client's orders received money in, from the orders. */
  function paidByOrders(clientId: string): Map<string, number> {
    const page = mockGetOrders(
      {
        search: '',
        status: 'all',
        clientId,
        dateFrom: '',
        dateTo: '',
        sortBy: null,
        sortDir: 'asc',
      },
      { page: 1, pageSize: 500 },
    )
    const byCurrency = new Map<string, number>()
    for (const row of page.items) {
      const order = mockGetOrder(row.id)!
      byCurrency.set(
        order.currency,
        round2((byCurrency.get(order.currency) ?? 0) + order.paidAmount),
      )
    }
    return byCurrency
  }

  /** The same figure as the summary states it — rows plus money naming nothing. */
  function paidBySummary(clientId: string): Map<string, number> {
    const summary = mockGetClientInvoiceSummary(clientId)
    const byCurrency = new Map<string, number>()
    for (const row of summary.invoices) {
      byCurrency.set(row.currency, round2((byCurrency.get(row.currency) ?? 0) + row.paidAmount))
    }
    for (const loose of summary.unassignedPayments) {
      byCurrency.set(loose.currency, round2((byCurrency.get(loose.currency) ?? 0) + loose.amount))
    }
    return byCurrency
  }

  it('lists a document per order, with the money that went against it', () => {
    const client = mockGetClients()[0]!
    const created = mockCreateOrder({ clientId: client.id, documentType: 'local' })
    const line = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 4,
      unit: 'pcs',
      unitPrice: 100,
    })
    const shipment = mockCreateShipment(created.id, { lines: [{ lineId: line.id, quantity: 4 }] })
    const invoice = mockCreateInvoice(created.id, { shipmentId: shipment.id })
    mockAddOrderPayment(created.id, {
      amount: 100,
      purpose: 'advance',
      invoiceId: invoice.id,
    })

    const summary = mockGetClientInvoiceSummary(client.id)
    const rows = summary.invoices.filter((r) => r.orderId === created.id)
    expect(rows).toHaveLength(1)
    const row = rows[0]!
    expect(row.number).toBe(invoice.number)
    expect(row.orderNumber).toBe(mockGetOrder(created.id)!.orderNumber)
    expect(row.currency).toBe(mockGetOrder(created.id)!.currency)
    expect(row.amountGross).toBe(invoice.amountGross)
    expect(row.amountGrossCurrent).toBe(invoice.amountGross)
    expect(row.withdrawn).toBe(false)
    expect(row.paidAmount).toBe(100)
    expect(row.outstanding).toBe(round2(invoice.amountGross - 100))
    // Named money is named — it does not also turn up as money naming nothing.
    expect(summary.unassignedPayments.filter((u) => u.orderId === created.id)).toEqual([])

    mockCancelShipment(created.id, shipment.id, { correctionReason: 'Test teardown' })
  })

  it('a withdrawn document stays on the list but stops being owed', () => {
    const client = mockGetClients()[0]!
    const created = mockCreateOrder({ clientId: client.id, documentType: 'local' })
    const line = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 4,
      unit: 'pcs',
      unitPrice: 100,
    })
    const shipment = mockCreateShipment(created.id, { lines: [{ lineId: line.id, quantity: 4 }] })
    const invoice = mockCreateInvoice(created.id, { shipmentId: shipment.id })
    mockCreateInvoice(created.id, {
      kind: 'correction',
      correctsInvoiceId: invoice.id,
      reason: 'Goods came back',
    })

    const rows = mockGetClientInvoiceSummary(client.id).invoices.filter(
      (r) => r.orderId === created.id,
    )
    // The correction is not a document the client was billed on — it changes the
    // amount on one they already had, so it gets no row of its own.
    expect(rows).toHaveLength(1)
    const row = rows[0]!
    expect(row.withdrawn).toBe(true)
    // What the paper said stays readable; what is owed on it is nothing.
    expect(row.amountGross).toBe(invoice.amountGross)
    expect(row.amountGrossCurrent).toBe(0)
    expect(row.outstanding).toBe(0)

    mockCancelShipment(created.id, shipment.id)
  })

  it('a withdrawn document is exactly nothing, not a cent of rounding', () => {
    // The two papers cancel in NET; each is rounded to cents on its own, and the
    // halves can round the other way. 100,90 net at 21% is 122,09 gross, and the
    // two 50,45 halves are 61,04 each — a cent short of it. Added back up, the
    // client's summary would show one cent owed on a document nobody is holding,
    // and that cent is the kind of thing an accountant chases for an afternoon.
    const client = mockGetClients()[0]!
    const created = mockCreateOrder({ clientId: client.id, documentType: 'local' })
    mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 100,
    })
    const advance = mockCreateInvoice(created.id, { kind: 'advance', amountNet: 100.9 })
    const half = mockCreateInvoice(created.id, {
      kind: 'correction',
      correctsInvoiceId: advance.id,
      amountNet: -50.45,
      reason: 'Half given back',
    })
    const rest = mockCreateInvoice(created.id, {
      kind: 'correction',
      correctsInvoiceId: advance.id,
      reason: 'And the rest — the order fell through',
    })
    expect(rest.withdrawsOriginal).toBe(true)
    // The papers really do leave a cent behind when simply added up.
    expect(round2(advance.amountGross + half.amountGross + rest.amountGross)).not.toBe(0)

    const row = mockGetClientInvoiceSummary(client.id).invoices.find((r) => r.id === advance.id)!
    expect(row.withdrawn).toBe(true)
    expect(row.amountGrossCurrent).toBe(0)
    expect(row.outstanding).toBe(0)
  })

  it('an adjusting correction moves the amount without taking the document back', () => {
    const client = mockGetClients()[0]!
    const created = mockCreateOrder({ clientId: client.id, documentType: 'local' })
    const line = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 4,
      unit: 'pcs',
      unitPrice: 100,
    })
    const shipment = mockCreateShipment(created.id, { lines: [{ lineId: line.id, quantity: 4 }] })
    const invoice = mockCreateInvoice(created.id, { shipmentId: shipment.id })
    const adjustment = mockCreateInvoice(created.id, {
      kind: 'correction',
      correctsInvoiceId: invoice.id,
      amountNet: -40,
      reason: 'Price agreed at 90,00',
    })

    const rows = mockGetClientInvoiceSummary(client.id).invoices.filter(
      (r) => r.orderId === created.id,
    )
    expect(rows).toHaveLength(1)
    const row = rows[0]!
    // Still in the client's hands — struck through it would read as cancelled.
    expect(row.withdrawn).toBe(false)
    expect(row.amountGrossCurrent).toBe(round2(invoice.amountGross + adjustment.amountGross))
    expect(row.amountGrossCurrent).toBeLessThan(row.amountGross)

    mockCancelShipment(created.id, shipment.id, { correctionReason: 'Test teardown' })
  })

  it('money paid against a correction lands on the document that correction fixes', () => {
    // The row's amount already counts its corrections. If its paid figure did not,
    // the two halves of one balance would be computed by two different rules and a
    // refund issued on the correcting document would be money nobody can see.
    const client = mockGetClients()[0]!
    const created = mockCreateOrder({ clientId: client.id, documentType: 'local' })
    const line = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 4,
      unit: 'pcs',
      unitPrice: 100,
    })
    const shipment = mockCreateShipment(created.id, { lines: [{ lineId: line.id, quantity: 4 }] })
    const invoice = mockCreateInvoice(created.id, { shipmentId: shipment.id })
    mockAddOrderPayment(created.id, { amount: 200, purpose: 'balance', invoiceId: invoice.id })
    const adjustment = mockCreateInvoice(created.id, {
      kind: 'correction',
      correctsInvoiceId: invoice.id,
      amountNet: -40,
      reason: 'Price agreed at 90,00',
    })
    mockAddOrderPayment(created.id, {
      amount: -30,
      purpose: 'refund',
      invoiceId: adjustment.id,
      note: 'Returned on the correction',
    })

    const summary = mockGetClientInvoiceSummary(client.id)
    const rows = summary.invoices.filter((r) => r.orderId === created.id)
    expect(rows).toHaveLength(1)
    const row = rows[0]!
    expect(row.paidAmount).toBe(170)
    expect(row.outstanding).toBe(round2(row.amountGrossCurrent - 170))
    // And it is not parked as money naming no document either: the correction
    // names one, and the row it belongs to is the corrected invoice.
    expect(summary.unassignedPayments.filter((u) => u.orderId === created.id)).toEqual([])

    mockCancelShipment(created.id, shipment.id, { correctionReason: 'Test teardown' })
  })

  it('money that names no document comes back as its own line, not as nothing', () => {
    // `invoiceId` is optional by design: an advance arrives before the proforma and
    // "paid on account" names nothing at all. Such money is the client's all the
    // same, and a summary that quietly drops it under-reports what they have paid.
    const client = mockGetClients()[0]!
    const created = mockCreateOrder({ clientId: client.id, documentType: 'local' })
    mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 4,
      unit: 'pcs',
      unitPrice: 100,
    })
    mockAddOrderPayment(created.id, { amount: 250, purpose: 'advance', note: 'On account' })

    const summary = mockGetClientInvoiceSummary(client.id)
    // Nothing was issued on this order, so it has no document row at all…
    expect(summary.invoices.filter((r) => r.orderId === created.id)).toEqual([])
    // …and the money is still there, on the order it arrived with.
    const loose = summary.unassignedPayments.filter((u) => u.orderId === created.id)
    expect(loose).toHaveLength(1)
    expect(loose[0]!.amount).toBe(250)
    expect(loose[0]!.orderNumber).toBe(mockGetOrder(created.id)!.orderNumber)
    expect(loose[0]!.currency).toBe(mockGetOrder(created.id)!.currency)
  })

  it('every euro of the client money is in the summary exactly once — all 55 clients', () => {
    // The rule the card's totals stand on, checked against the orders themselves
    // rather than against a repeat of the same arithmetic: whatever an order says
    // it received, the summary of that client accounts for, in that currency, once.
    const clients = mockGetClients()
    expect(clients.length).toBeGreaterThan(0)
    let compared = 0
    for (const client of clients) {
      const expected = paidByOrders(client.id)
      const actual = paidBySummary(client.id)
      for (const [currency, amount] of expected) {
        expect(actual.get(currency) ?? 0).toBe(amount)
        compared += 1
      }
      // And nothing invented in a currency the orders never received.
      for (const currency of actual.keys()) expect(expected.has(currency)).toBe(true)
    }
    // Пустой прогон устраивает любое правило: сравнений должно быть больше нуля.
    expect(compared).toBeGreaterThan(0)
  })

  it('the showcase advance is shown paid, not as a debt on a document paid in full', () => {
    // The demo's own first order used to say exactly that: 1500 issued on the
    // proforma, 0 paid, 1500 owed — while the payment sat two records below in the
    // same order, its note naming that very document.
    const showcase = mockGetOrder('ORD-100')!
    const advanceRow = mockGetClientInvoiceSummary(showcase.clientId).invoices.find(
      (r) => r.orderId === showcase.id && r.kind === 'advance',
    )!
    expect(advanceRow).toBeDefined()
    const named = showcase.payments.filter((p) => p.invoiceId === advanceRow.id)
    expect(named.length).toBeGreaterThan(0)
    expect(advanceRow.paidAmount).toBe(advanceRow.amountGrossCurrent)
    expect(advanceRow.outstanding).toBe(0)
  })
})
