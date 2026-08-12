/**
 * Partial returns, checked against the shelf and the documents.
 *
 * Every test here asserts a number that moved, not that a call returned. A spec
 * that prints what happened is a report; the point of this one is that it fails
 * when a return stops putting goods back where they came from.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  mockCreateOrder,
  mockAddOrderItem,
  mockCreateShipment,
  mockCreateReturn,
  mockPlanReturn,
  mockGetReturns,
  mockGetOrder,
  mockCreateInvoice,
  mockPatchOrderStatus,
} from './orders'
import { batchesForProduct, mockGetMovementsFor, batchById } from './warehouse'
import { mockGetClients } from './clients'
import { STORE as PRODUCTS } from './products'
import type { Order, OrderItem } from '@/types/order'

/** An order with one line of a product the demo warehouse really holds. */
function orderWithShipment(quantity = 4): { order: Order; item: OrderItem; batchId: string } {
  const client = mockGetClients()[0]!
  const created = mockCreateOrder({ clientId: client.id, documentType: 'local' })

  // A batch with enough on the shelf, so the shipment is not refused for stock.
  // One batch and not several: the test is about where goods go back to, and a
  // line spread over two batches would be answering a second question at once.
  const batch = PRODUCTS.flatMap((p) => batchesForProduct(p.id)).find(
    (b) => b.quantityRemaining >= quantity + 1,
  )
  if (!batch) throw new Error('the demo warehouse holds nothing big enough for this test')

  const item = mockAddOrderItem(created.id, {
    productId: batch.productId,
    quantity,
    unit: 'pcs',
    unitPrice: 100,
    version: mockGetOrder(created.id)!.version,
  })

  mockCreateShipment(created.id, {
    lines: [{ lineId: item.id, quantity }],
    version: mockGetOrder(created.id)!.version,
  })

  return { order: mockGetOrder(created.id)!, item, batchId: batch.id }
}

function lineOf(orderId: string, lineId: string): OrderItem {
  return mockGetOrder(orderId)!.items.find((i) => i.id === lineId)!
}

function stockOf(orderId: string, lineId: string): number {
  const line = lineOf(orderId, lineId)
  return line.allocations.reduce((sum, a) => sum + (batchById(a.batchId!)?.quantityRemaining ?? 0), 0)
}

describe('partial returns — the shelf', () => {
  let ctx: ReturnType<typeof orderWithShipment>

  beforeEach(() => {
    ctx = orderWithShipment()
  })

  it('a sound return puts exactly the returned quantity back', () => {
    const before = stockOf(ctx.order.id, ctx.item.id)

    mockCreateReturn(ctx.order.id, {
      lines: [{ lineId: ctx.item.id, quantity: 2, condition: 'good', compensated: true }],
      reason: 'Wrong profile',
      version: mockGetOrder(ctx.order.id)!.version,
    })

    expect(stockOf(ctx.order.id, ctx.item.id)).toBe(before + 2)
  })

  it('a defective return leaves the shelf where it was, through two movements', () => {
    const before = stockOf(ctx.order.id, ctx.item.id)

    const ret = mockCreateReturn(ctx.order.id, {
      lines: [{ lineId: ctx.item.id, quantity: 2, condition: 'defective', compensated: false }],
      reason: 'Arrived bent',
      version: mockGetOrder(ctx.order.id)!.version,
    })

    // Back on the shelf and then written off — the balance is unchanged, but the
    // loss is a record somebody can find rather than a gap.
    expect(stockOf(ctx.order.id, ctx.item.id)).toBe(before)
    expect(mockGetMovementsFor('order-return', ret.id).map((m) => m.type)).toEqual(['return'])
    expect(mockGetMovementsFor('order-return-writeoff', ret.id).map((m) => m.type)).toEqual([
      'write-off',
    ])
  })

  it('the shipped quantity is not reduced — the goods did leave', () => {
    mockCreateReturn(ctx.order.id, {
      lines: [{ lineId: ctx.item.id, quantity: 2, condition: 'good', compensated: true }],
      reason: 'Wrong profile',
      version: mockGetOrder(ctx.order.id)!.version,
    })

    const line = lineOf(ctx.order.id, ctx.item.id)
    expect({ shipped: line.shippedQuantity, returned: line.returnedQuantity }).toEqual({
      shipped: 4,
      returned: 2,
    })
  })

  it('the goods go back onto the batch they left from, not onto any batch', () => {
    const ret = mockCreateReturn(ctx.order.id, {
      lines: [{ lineId: ctx.item.id, quantity: 2, condition: 'good', compensated: true }],
      reason: 'Wrong profile',
      version: mockGetOrder(ctx.order.id)!.version,
    })

    const sold = mockGetMovementsFor('order-shipment', mockGetOrder(ctx.order.id)!.shipments[0]!.id)
      .filter((m) => m.type === 'sale')
      .map((m) => m.batchId)
    const restored = (ret.lines[0]!.restored ?? []).map((h) => h.batchId)

    expect(restored.length).toBeGreaterThan(0)
    for (const batchId of restored) expect(sold).toContain(batchId)
  })
})

describe('partial returns — what is refused', () => {
  it('more than was shipped', () => {
    const ctx = orderWithShipment()
    expect(() =>
      mockCreateReturn(ctx.order.id, {
        lines: [{ lineId: ctx.item.id, quantity: 5, condition: 'good', compensated: true }],
        reason: 'Wrong profile',
        version: mockGetOrder(ctx.order.id)!.version,
      }),
    ).toThrow('RETURN_EXCEEDS_SHIPPED')
  })

  it('a second return that would take the line past what shipped', () => {
    const ctx = orderWithShipment()
    mockCreateReturn(ctx.order.id, {
      lines: [{ lineId: ctx.item.id, quantity: 3, condition: 'good', compensated: true }],
      reason: 'Wrong profile',
      version: mockGetOrder(ctx.order.id)!.version,
    })
    expect(() =>
      mockCreateReturn(ctx.order.id, {
        lines: [{ lineId: ctx.item.id, quantity: 2, condition: 'good', compensated: true }],
        reason: 'The rest',
        version: mockGetOrder(ctx.order.id)!.version,
      }),
    ).toThrow('RETURN_EXCEEDS_SHIPPED')
  })

  it('no reason', () => {
    const ctx = orderWithShipment()
    expect(() =>
      mockCreateReturn(ctx.order.id, {
        lines: [{ lineId: ctx.item.id, quantity: 1, condition: 'good', compensated: true }],
        reason: '   ',
        version: mockGetOrder(ctx.order.id)!.version,
      }),
    ).toThrow('RETURN_REASON_REQUIRED')
  })

  it('the same line twice in one return', () => {
    const ctx = orderWithShipment()
    expect(() =>
      mockCreateReturn(ctx.order.id, {
        lines: [
          { lineId: ctx.item.id, quantity: 1, condition: 'good', compensated: true },
          { lineId: ctx.item.id, quantity: 1, condition: 'good', compensated: true },
        ],
        reason: 'Wrong profile',
        version: mockGetOrder(ctx.order.id)!.version,
      }),
    ).toThrow('DUPLICATE_RETURN_LINE')
  })

  it('a quantity that is not a number — NaN slips past a bare comparison', () => {
    const ctx = orderWithShipment()
    expect(() =>
      mockCreateReturn(ctx.order.id, {
        lines: [{ lineId: ctx.item.id, quantity: NaN, condition: 'good', compensated: true }],
        reason: 'Wrong profile',
        version: mockGetOrder(ctx.order.id)!.version,
      }),
    ).toThrow('NUMBER_NOT_FINITE')
  })

  it('a refused return leaves the order byte-for-byte as it was', () => {
    const ctx = orderWithShipment()
    const before = JSON.stringify(mockGetOrder(ctx.order.id))
    try {
      mockCreateReturn(ctx.order.id, {
        lines: [{ lineId: ctx.item.id, quantity: 99, condition: 'good', compensated: true }],
        reason: 'Wrong profile',
        version: mockGetOrder(ctx.order.id)!.version,
      })
    } catch {
      // expected
    }
    expect(JSON.stringify(mockGetOrder(ctx.order.id))).toBe(before)
  })
})

describe('partial returns — the documents', () => {
  it('a second partial return against the same invoice is allowed', () => {
    const ctx = orderWithShipment()
    const shipmentId = mockGetOrder(ctx.order.id)!.shipments[0]!.id
    mockCreateInvoice(ctx.order.id, {
      shipmentId,
      version: mockGetOrder(ctx.order.id)!.version,
    })

    mockCreateReturn(ctx.order.id, {
      lines: [{ lineId: ctx.item.id, quantity: 1, condition: 'good', compensated: true }],
      reason: 'First piece back',
      version: mockGetOrder(ctx.order.id)!.version,
    })

    // The rule this replaced — "one document is corrected once" — refused here,
    // and a delivery could be returned in pieces exactly once.
    expect(() =>
      mockCreateReturn(ctx.order.id, {
        lines: [{ lineId: ctx.item.id, quantity: 1, condition: 'good', compensated: true }],
        reason: 'Second piece back',
        version: mockGetOrder(ctx.order.id)!.version,
      }),
    ).not.toThrow()

    const corrections = mockGetOrder(ctx.order.id)!.invoices.filter((i) => i.kind === 'correction')
    expect(corrections).toHaveLength(2)
    // Adjustments, not withdrawals: the client still holds the original.
    expect(corrections.every((c) => !c.withdrawsOriginal)).toBe(true)
  })

  it('corrections never add up past what the invoice is worth', () => {
    const ctx = orderWithShipment()
    const shipmentId = mockGetOrder(ctx.order.id)!.shipments[0]!.id
    const invoice = mockCreateInvoice(ctx.order.id, {
      shipmentId,
      version: mockGetOrder(ctx.order.id)!.version,
    })

    mockCreateReturn(ctx.order.id, {
      lines: [{ lineId: ctx.item.id, quantity: 4, condition: 'good', compensated: true }],
      reason: 'All of it back',
      version: mockGetOrder(ctx.order.id)!.version,
    })

    const order = mockGetOrder(ctx.order.id)!
    const outstanding = order.invoices
      .filter((i) => i.id === invoice.id || i.correctsInvoiceId === invoice.id)
      .reduce((sum, i) => sum + i.amountNet, 0)
    expect(outstanding).toBeCloseTo(0, 2)
  })

  it('an uncompensated return issues no correction at all', () => {
    const ctx = orderWithShipment()
    mockCreateInvoice(ctx.order.id, {
      shipmentId: mockGetOrder(ctx.order.id)!.shipments[0]!.id,
      version: mockGetOrder(ctx.order.id)!.version,
    })

    const ret = mockCreateReturn(ctx.order.id, {
      lines: [{ lineId: ctx.item.id, quantity: 2, condition: 'defective', compensated: false }],
      reason: 'Bent, kept against the debt',
      version: mockGetOrder(ctx.order.id)!.version,
    })

    expect(ret.correctionInvoiceIds).toEqual([])
    expect(mockGetOrder(ctx.order.id)!.invoices.filter((i) => i.kind === 'correction')).toEqual([])
  })
})

describe('partial returns — what the card reads', () => {
  it('the plan offers shipped minus already returned', () => {
    const ctx = orderWithShipment()
    mockCreateReturn(ctx.order.id, {
      lines: [{ lineId: ctx.item.id, quantity: 1, condition: 'good', compensated: true }],
      reason: 'One back',
      version: mockGetOrder(ctx.order.id)!.version,
    })

    const plan = mockPlanReturn(ctx.order.id).find((l) => l.lineId === ctx.item.id)!
    expect({ shipped: plan.shipped, returned: plan.alreadyReturned, left: plan.returnable }).toEqual(
      { shipped: 4, returned: 1, left: 3 },
    )
  })

  it('a fully returned line drops out of the plan', () => {
    const ctx = orderWithShipment()
    mockCreateReturn(ctx.order.id, {
      lines: [{ lineId: ctx.item.id, quantity: 4, condition: 'good', compensated: true }],
      reason: 'All back',
      version: mockGetOrder(ctx.order.id)!.version,
    })
    expect(mockPlanReturn(ctx.order.id).map((l) => l.lineId)).not.toContain(ctx.item.id)
  })

  it('the return is on the order and reads back whole', () => {
    const ctx = orderWithShipment()
    const created = mockCreateReturn(ctx.order.id, {
      lines: [{ lineId: ctx.item.id, quantity: 2, condition: 'good', compensated: true }],
      reason: 'Wrong profile',
      version: mockGetOrder(ctx.order.id)!.version,
    })

    const stored = mockGetReturns(ctx.order.id).find((r) => r.id === created.id)!
    expect({
      onOrder: mockGetOrder(ctx.order.id)!.returns.some((r) => r.id === created.id),
      reason: stored.reason,
      quantity: stored.lines[0]!.quantity,
      // Present always, never an absent key — §3.
      restoredIsStated: stored.lines[0]!.restored !== undefined,
    }).toEqual({ onOrder: true, reason: 'Wrong profile', quantity: 2, restoredIsStated: true })
  })
})

describe('order status — the list is checked now', () => {
  it('an unknown status is refused instead of recorded', () => {
    const ctx = orderWithShipment()
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockPatchOrderStatus(ctx.order.id, 'delivred' as any, mockGetOrder(ctx.order.id)!.version),
    ).toThrow('UNKNOWN_ORDER_STATUS')
  })

  it('the new statuses are accepted', () => {
    const ctx = orderWithShipment()
    for (const status of ['completed', 'return_requested', 'returned', 'refused'] as const) {
      const updated = mockPatchOrderStatus(
        ctx.order.id,
        status,
        mockGetOrder(ctx.order.id)!.version,
      )
      expect(updated.status).toBe(status)
    }
  })
})
