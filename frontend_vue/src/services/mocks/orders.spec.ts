import { describe, it, expect } from 'vitest'
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
  mockDeleteOrder,
} from './orders'
import { mockGetClients } from './clients'
import { mockGetSettings, mockSaveSettings } from './settings'
import { batchById, mockCalculateFifoCost, mockGetMovementsFor } from './warehouse'
import { calcLine, round2, validateLine, netToGross } from '@/domain/orderPricing'
import { toPricingLine } from '@/services/orderLines'
import type { Order } from '@/types/order'

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
    unitCost: 100,
  })
  return { order: mockGetOrder(created.id)!, lineId: item.id }
}

// ─── Generated data ─────────────────────────────────────────────────────────

describe('the generated store', () => {
  const orders = allOrders()

  it('produces 100 orders', () => {
    expect(orders.length).toBe(100)
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
    expect(order.effectiveDiscountPercent).toBe(5)
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
    expect(order.invoices.length).toBe(1)
    expect(order.invoices[0]!.shipmentId).toBe(order.shipments[0]!.id)
    expect(order.paidPercent).toBeCloseTo(40, 0)
    // The invoiced line is frozen by the document the client holds.
    expect(order.items[0]!.documentIssued).toBe(true)
    expect(order.items[1]!.state).toBe('partially_shipped')
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
      unitCost: 100,
    })
    mockAddOrderItem(created.id, {
      productId: 'prod-002',
      quantity: 7,
      unit: 'm',
      unitPrice: 100,
      unitCost: 100,
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
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 120,
      unitCost: 100,
    })
    mockUpdateOrderItem(created.id, item.id, {
      allocations: [
        {
          batchId: 'whb-001',
          offcutId: null,
          quantity: 6,
          unitCost: 100,
          currency: 'cur-eur',
          exchangeRate: 1,
          source: 'stock',
        },
        {
          batchId: 'whb-002',
          offcutId: null,
          quantity: 4,
          unitCost: 100,
          currency: 'cur-eur',
          exchangeRate: 1,
          source: 'stock',
        },
      ],
    })
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
      unitCost: 100,
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
      productId: 'prod-nothing-in-stock',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 120,
      unitCost: 100,
    })
    expect(mockGetOrder(created.id)!.items[0]!.allocations).toEqual([])
    mockReserveOrder(created.id)
    expect(mockGetReservations({ orderId: created.id }).length).toBe(0)
    expect(mockGetOrder(created.id)!.items[0]!.state).toBe('draft')
  })

  it('hold only what is left to ship, however many batches the line spans', () => {
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 120,
      unitCost: 100,
    })
    // FIFO took this line from two batches.
    mockUpdateOrderItem(created.id, item.id, {
      allocations: [
        {
          batchId: 'whb-001',
          offcutId: null,
          quantity: 6,
          unitCost: 100,
          currency: 'cur-eur',
          exchangeRate: 1,
          source: 'stock',
        },
        {
          batchId: 'whb-002',
          offcutId: null,
          quantity: 4,
          unitCost: 100,
          currency: 'cur-eur',
          exchangeRate: 1,
          source: 'stock',
        },
      ],
    })
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
      unitCost: 100,
    })
    expect(() =>
      mockUpdateOrderItem(created.id, item.id, {
        allocations: [
          {
            batchId: 'whb-001',
            offcutId: null,
            quantity: 9,
            unitCost: 100,
            currency: 'cur-eur',
            exchangeRate: 1,
            source: 'stock',
          },
        ],
      }),
    ).toThrow('ALLOCATION_EXCEEDS_QUANTITY')
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
      unitCost: 100,
    })
    // net 1000, gross 1210
    mockAddOrderPayment(created.id, { amount: 302.5, purpose: 'advance' })
    expect(mockGetOrder(created.id)!.paidPercent).toBe(25)

    mockAddOrderItem(created.id, {
      productId: 'prod-002',
      quantity: 10,
      unit: 'm',
      unitPrice: 100,
      unitCost: 100,
    })
    const grown = mockGetOrder(created.id)!
    expect(grown.paidPercent).toBe(12.5)
    expect(grown.outstandingAmount).toBe(round2(grown.totalWithVat - 302.5))
  })

  it('records a refund as a negative amount', () => {
    const { order } = orderWithLine()
    mockAddOrderPayment(order.id, { amount: -50, purpose: 'refund' })
    expect(mockGetOrderPayments(order.id)[0]!.amount).toBe(-50)
    expect(() => mockAddOrderPayment(order.id, { amount: 50, purpose: 'refund' })).toThrow(
      'REFUND_MUST_BE_NEGATIVE',
    )
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
    expect(invoice.amountNet).toBe(1200)
    expect(invoice.amountGross).toBe(netToGross(1200, 'standard', 21))

    const after = mockGetOrder(order.id)!
    expect(after.items[0]!.documentIssued).toBe(true)
    // The service never ships, so only the invoice can freeze it.
    expect(after.services.find((s) => s.id === svc.id)!.documentIssued).toBe(true)
    expect(() => mockUpdateOrderService(order.id, svc.id, { discountPercent: 5 })).toThrow(
      'PRICE_FROZEN_BY_SHIPMENT',
    )
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
      unitCost: 100,
    })
    const drop = mockAddOrderItem(created.id, {
      productId: 'prod-002',
      quantity: 3,
      unit: 'm',
      unitPrice: 100,
      unitCost: 100,
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
      unitCost: 100,
    })
    const svc = mockAddOrderService(created.id, { serviceId: 'svc-001', quantity: 1, price: 12 })
    expect(mockGetOrder(created.id)!.totalAmount).toBe(112)

    mockDeleteOrderService(created.id, svc.id)
    expect(mockGetOrder(created.id)!.totalAmount).toBe(100)
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
      unitCost: 100,
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
      unitCost: 800,
    })
    mockAddOrderItem(created.id, {
      productId: 'prod-007',
      quantity: 500,
      unit: 'kg',
      unitPrice: 1,
      unitCost: 0.8,
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
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 120,
      unitCost: 100,
    })
    mockUpdateOrderItem(created.id, item.id, {
      allocations: [
        {
          batchId: 'whb-001',
          offcutId: null,
          quantity: 6,
          unitCost: 100,
          currency: 'cur-eur',
          exchangeRate: 1,
          source: 'stock',
        },
        {
          batchId: 'whb-002',
          offcutId: null,
          quantity: 4,
          unitCost: 100,
          currency: 'cur-eur',
          exchangeRate: 1,
          source: 'stock',
        },
      ],
    })

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
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 12,
    })
    // The price is honoured exactly; the margin is whatever gets there from the
    // warehouse cost. Selling at cost is not a default anybody chose.
    expect(item.unitPrice).toBe(12)
    expect(item.unitCost).toBeLessThan(12)
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
    expect(item.unitPrice).toBe(round2(item.unitCost * 1.25))
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

describe('cost provenance', () => {
  it('marks a cost read off a batch as coming from stock', () => {
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 120,
      unitCost: 100,
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

  it('marks a guessed cost as an estimate rather than dressing it up', () => {
    const created = freshOrder()
    // Nothing in the warehouse under this product, so there is no cost to read.
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-no-batches-at-all',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 120,
    })
    expect(item.costSource).toBe('estimate')
    expect(item.unitCost).toBe(90)
    expect(item.allocations).toEqual([])
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
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 200,
    })
    mockUpdateOrderItem(created.id, item.id, {
      allocations: [
        {
          batchId: 'whb-001',
          offcutId: null,
          quantity: 6,
          unitCost: 100,
          currency: 'cur-eur',
          exchangeRate: 1,
          source: 'stock',
        },
        {
          batchId: 'whb-002',
          offcutId: null,
          quantity: 4,
          unitCost: 110,
          currency: 'cur-eur',
          exchangeRate: 1,
          source: 'stock',
        },
      ],
    })

    const first = mockCreateShipment(created.id, { lines: [{ lineId: item.id, quantity: 6 }] })
    const second = mockCreateShipment(created.id, { lines: [{ lineId: item.id, quantity: 4 }] })

    expect(mockGetMovementsFor('order-shipment', first.id).map((m) => m.batchId)).toEqual([
      'whb-001',
    ])
    expect(mockGetMovementsFor('order-shipment', second.id).map((m) => m.batchId)).toEqual([
      'whb-002',
    ])
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
    mockUpdateOrderItem(created.id, item.id, {
      allocations: [
        {
          batchId,
          offcutId: null,
          quantity: 10,
          unitCost: 100,
          currency: 'cur-eur',
          exchangeRate: 1,
          source: 'stock',
        },
      ],
    })
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
      productId: 'prod-nothing-in-stock',
      quantity: 5,
      unit: 'pcs',
      unitPrice: 200,
      unitCost: 100,
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

  it('treats a breakdown pointing at a batch that is gone as nothing at all', () => {
    // Goods on no shelf cannot leave one, and a batch that no longer exists is
    // exactly that. The line is not shippable, and it says so as a shortage
    // rather than by throwing.
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity: 5,
      unit: 'pcs',
      unitPrice: 200,
    })
    mockUpdateOrderItem(created.id, item.id, {
      allocations: [
        {
          batchId: 'whb-does-not-exist',
          offcutId: null,
          quantity: 5,
          unitCost: 100,
          currency: 'cur-eur',
          exchangeRate: 1,
          source: 'stock',
        },
      ],
    })
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
      mockUpdateOrderItem(order.id, lineId, {
        allocations: [
          {
            batchId: 'whb-001',
            offcutId: null,
            quantity: 10,
            unitCost: 100,
            currency: 'cur-eur',
            exchangeRate: 1,
            source: 'stock',
          },
        ],
      })
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
      unitCost: 100,
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
   * A line whose breakdown is stated outright. The batch ids are real ones from
   * the warehouse mock — a shipment writes goods off an actual shelf, and an
   * invented batch id would only prove that the test data is invented.
   */
  function lineWithBatches(
    allocations: Array<{ batchId: string; quantity: number; unitCost: number }>,
    quantity: number,
  ): { orderId: string; lineId: string } {
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: 'prod-001',
      quantity,
      unit: 'pcs',
      unitPrice: 200,
      unitCost: 100,
    })
    mockUpdateOrderItem(created.id, item.id, {
      allocations: allocations.map((a) => ({
        batchId: a.batchId,
        offcutId: null,
        quantity: a.quantity,
        unitCost: a.unitCost,
        currency: 'cur-eur',
        exchangeRate: 1,
        source: 'stock' as const,
      })),
    })
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
      productId: 'prod-nothing-in-stock',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 120,
      unitCost: 100,
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

  it('refuses a line total when there is no quantity to divide by', () => {
    const { orderId, svcId } = service()
    mockUpdateOrderService(orderId, svcId, { quantity: 0 })
    expect(() => mockUpdateOrderService(orderId, svcId, { lineTotal: 50 })).toThrow('ZERO_QUANTITY')
  })
})
