/**
 * Audit pass three — the two new findings, each an assertion that fails on the
 * current code. Drop into frontend_vue/src/services/mocks/ and run:
 *   npx vitest run src/services/mocks/zz-new-repro.spec.ts
 */
import { describe, it, expect } from 'vitest'
import {
  mockGetOrder,
  mockCreateOrder,
  mockAddOrderItem,
  mockAddOrderService,
  mockCreateShipment,
  mockCreateInvoice,
  mockReserveOrder,
  mockGetOrders,
} from './orders'
import { mockGetClients } from './clients'
import { allServices } from './services'
import { batchesForProduct, batchById } from './warehouse'
import { reservedOn } from './reservations'
import { round2 } from '@/domain/orderPricing'
import type { Order } from '@/types/order'

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

describe('FINDING 6 — the write-off and the hold pick different batches', () => {
  it('never promises more of a batch than the shelf holds', () => {
    let target: string | null = null
    for (const id of allProductIds()) {
      if (batchesForProduct(id).filter((b) => b.quantityRemaining > 2).length >= 2) {
        target = id
        break
      }
    }
    if (!target) return
    const batches = batchesForProduct(target)
      .filter((b) => b.quantityRemaining > 2)
      .sort((x, y) => x.receivedAt.localeCompare(y.receivedAt))
    const oldest = batches[0]!

    // One line spanning two batches, fully reserved.
    const order = fresh()
    const line = mockAddOrderItem(order.id, {
      productId: target,
      quantity: round2(oldest.quantityRemaining + 2),
      unit: 'pcs',
      unitPrice: 100,
    })
    mockReserveOrder(order.id)

    // Ship 2 units — FIFO takes them off the OLDEST batch.
    mockCreateShipment(order.id, { lines: [{ lineId: line.id, quantity: 2 }] })

    const shelf = batchById(oldest.id)!
    expect(
      reservedOn(oldest.id),
      `${oldest.id}: reserved must not exceed the ${shelf.quantityRemaining} on the shelf`,
    ).toBeLessThanOrEqual(shelf.quantityRemaining)
  })
})

describe('FINDING 7 — a service added after the services invoice', () => {
  it('can still be put on a document', () => {
    let target: string | null = null
    for (const id of allProductIds()) {
      if (batchesForProduct(id).reduce((s, b) => s + b.quantityRemaining, 0) >= 4) {
        target = id
        break
      }
    }
    if (!target) return
    const svcs = allServices()
    const order = fresh()
    const a = mockAddOrderItem(order.id, {
      productId: target,
      quantity: 2,
      unit: 'pcs',
      unitPrice: 100,
    })
    const b = mockAddOrderItem(order.id, {
      productId: target,
      quantity: 2,
      unit: 'pcs',
      unitPrice: 100,
    })
    mockAddOrderService(order.id, { serviceId: svcs[0]!.id, quantity: 1, price: 100 })

    const s1 = mockCreateShipment(order.id, { lines: [{ lineId: a.id, quantity: 2 }] })
    mockCreateInvoice(order.id, { kind: 'regular', shipmentId: s1.id }) // 300, coversServices

    // The client asks for another service on a live order — ordinary work.
    mockAddOrderService(order.id, { serviceId: svcs[1]!.id, quantity: 1, price: 450 })

    const s2 = mockCreateShipment(order.id, { lines: [{ lineId: b.id, quantity: 2 }] })
    mockCreateInvoice(order.id, { kind: 'regular', shipmentId: s2.id })

    const after = mockGetOrder(order.id)!
    const billed = round2(after.invoices.reduce((s, i) => s + i.amountNet, 0))
    expect(billed, 'everything shipped and invoiced — the documents must come to the order').toBe(
      after.totalAmount,
    )
  })
})
