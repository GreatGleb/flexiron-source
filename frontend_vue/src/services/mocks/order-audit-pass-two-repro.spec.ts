/**
 * Audit repro — the four findings, each as an assertion that fails on the
 * current code. Drop into frontend_vue/src/services/mocks/ and run:
 *   npx vitest run src/services/mocks/zz-audit-repro.spec.ts
 */
import { describe, it, expect } from 'vitest'
import {
  mockGetOrder,
  mockCreateOrder,
  mockAddOrderItem,
  mockAddOrderService,
  mockCorrectOrderLine,
  mockCreateShipment,
  mockCreateInvoice,
  mockAddOrderPayment,
  mockUpdateOrderItem,
  mockUpdateOrderService,
  mockGetOrders,
} from './orders'
import { mockGetClients } from './clients'
import { allServices } from './services'
import { batchesForProduct } from './warehouse'
import { calcLine, round2 } from '@/domain/orderPricing'
import { toPricingLine } from '@/services/orderLines'
import type { Order } from '@/types/order'

function netOf(order: Order): number {
  return [...order.items, ...order.services].reduce(
    (sum, l) => round2(sum + calcLine(toPricingLine(l)).lineNet),
    0,
  )
}
function documentsNet(order: Order): number {
  return round2(order.invoices.reduce((s, i) => s + i.amountNet, 0))
}
function fresh(): Order {
  return mockCreateOrder({ clientId: mockGetClients()[0]!.id, documentType: 'local' })
}
function allProductIds(): string[] {
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
  const ids = new Set<string>()
  for (const r of page.items) for (const i of mockGetOrder(r.id)!.items) ids.add(i.productId)
  return [...ids]
}
function stocked(min: number): string {
  for (const id of allProductIds()) {
    if (batchesForProduct(id).reduce((s, b) => s + b.quantityRemaining, 0) >= min) return id
  }
  throw new Error('no stocked product')
}

describe('FINDING 1 — a refused correction has already repriced the line', () => {
  it('leaves the order total stale and the difference on no document', () => {
    const productId = stocked(4)
    const order = fresh()
    const a = mockAddOrderItem(order.id, { productId, quantity: 2, unit: 'pcs', unitPrice: 100 })
    const b = mockAddOrderItem(order.id, { productId, quantity: 2, unit: 'pcs', unitPrice: 200 })
    const shp = mockCreateShipment(order.id, {
      lines: [
        { lineId: a.id, quantity: 2 },
        { lineId: b.id, quantity: 2 },
      ],
    })
    mockCreateInvoice(order.id, { kind: 'regular', shipmentId: shp.id }) // 600,00

    mockCorrectOrderLine(order.id, a.id, { unitPrice: 110, reason: 'line A was wrong' })
    expect(mockGetOrder(order.id)!.totalAmount).toBe(620) // correcting invoice +20 — fine

    // The admin is told no…
    expect(() =>
      mockCorrectOrderLine(order.id, b.id, { unitPrice: 210, reason: 'line B was wrong too' }),
    ).toThrow('INVOICE_ALREADY_CORRECTED')

    const after = mockGetOrder(order.id)!
    // …but line B moved anyway.
    expect(after.items[1]!.unitPrice, 'the refused edit was applied').toBe(200)
    // …and the order no longer equals its own lines.
    expect(after.totalAmount, 'total = sum of lines').toBe(netOf(after))

    // The next unrelated write recalculates and the gap becomes money.
    mockAddOrderPayment(order.id, { amount: 1, purpose: 'advance' })
    const later = mockGetOrder(order.id)!
    expect(documentsNet(later), 'documents = order total').toBe(later.totalAmount)
  })
})

describe('FINDING 2 — the freeze does not cover a service quantity', () => {
  it('lets an invoiced service be zeroed out of the order', () => {
    const productId = stocked(2)
    const order = fresh()
    const a = mockAddOrderItem(order.id, { productId, quantity: 2, unit: 'pcs', unitPrice: 100 })
    const svc = mockAddOrderService(order.id, {
      serviceId: allServices()[0]!.id,
      quantity: 1,
      price: 302.5,
    })
    const shp = mockCreateShipment(order.id, { lines: [{ lineId: a.id, quantity: 2 }] })
    const invoice = mockCreateInvoice(order.id, { kind: 'regular', shipmentId: shp.id })
    expect(invoice.amountNet).toBe(502.5)
    expect(mockGetOrder(order.id)!.services[0]!.documentIssued).toBe(true)

    // Deletion is refused, as it should be.
    expect(() => mockUpdateOrderService(order.id, svc.id, { quantity: 0 })).toThrow()

    const after = mockGetOrder(order.id)!
    expect(after.totalAmount, 'the invoiced service is still in the order').toBe(502.5)
  })
})

describe('FINDING 3 — growing a line hands out the same batch twice', () => {
  it('understates the cost and claims warehouse provenance for a guess', () => {
    let target: string | null = null
    for (const id of allProductIds()) {
      const bs = batchesForProduct(id).filter((b) => b.quantityRemaining > 0)
      if (bs.length >= 2 && new Set(bs.map((b) => b.unitPrice)).size >= 2) {
        target = id
        break
      }
    }
    if (!target) return
    const batches = batchesForProduct(target)
      .filter((b) => b.quantityRemaining > 0)
      .sort((x, y) => x.receivedAt.localeCompare(y.receivedAt))
    const first = batches[0]!
    const second = batches[1]!

    const order = fresh()
    const line = mockAddOrderItem(order.id, {
      productId: target,
      quantity: first.quantityRemaining,
      unit: 'pcs',
      unitPrice: 9999,
    })
    const grown = mockUpdateOrderItem(order.id, line.id, {
      quantity: round2(first.quantityRemaining + 100),
    })

    const takenFromFirst = grown.allocations
      .filter((x) => x.batchId === first.id)
      .reduce((s, x) => s + x.quantity, 0)
    expect(takenFromFirst, 'the breakdown may not exceed the batch').toBeLessThanOrEqual(
      first.quantityRemaining,
    )
    expect(
      mockGetOrder(order.id)!.totalCost,
      'cost must be the real FIFO cost across both batches',
    ).toBe(round2(first.quantityRemaining * first.unitPrice! + 100 * second.unitPrice!))
  })
})

describe('FINDING 4 — a cent falls out between the invoices and the order', () => {
  it('bills more than the order says when one line ships in pieces', () => {
    const productId = stocked(6)
    const order = fresh()
    // Cost 10,05 + 15% = 11,5575 — an ordinary computed price. The cost is set
    // the only way a cost is set: named by a person, with a reason, on a line the
    // server already created (§4.2). `POST /items` does not take one.
    const created = mockAddOrderItem(order.id, {
      productId,
      quantity: 6,
      unit: 'pcs',
      unitPrice: 0,
      marginPercent: 15,
    })
    const line = mockUpdateOrderItem(order.id, created.id, {
      manualUnitCost: 10.05,
      manualCostReason: 'the price this repro is about',
    })
    let billed = 0
    for (let k = 0; k < 6; k++) {
      const shp = mockCreateShipment(order.id, { lines: [{ lineId: line.id, quantity: 1 }] })
      billed = round2(
        billed + mockCreateInvoice(order.id, { kind: 'regular', shipmentId: shp.id }).amountNet,
      )
    }
    expect(billed, 'documents = order total').toBe(mockGetOrder(order.id)!.totalAmount)
  })
})
