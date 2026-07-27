/**
 * Route smoke test.
 *
 * Every other spec calls the mock functions directly, which means a typo in a
 * path regex would pass all of them and only break in the running app. These
 * tests go through the same router the app uses.
 *
 * The router adds an artificial 300 ms per call to imitate a network, so a flow
 * of a dozen requests needs a longer timeout than the default.
 */
import { describe, it, expect } from 'vitest'
import { getMock, postMock, patchMock, deleteMock } from './index'
import { mockGetClients } from './clients'
import type { Order, OrderItem, Shipment, Invoice, Payment } from '@/types/order'
import type { StockReservation } from '@/types/warehouse'

async function newOrder(): Promise<Order> {
  const client = mockGetClients()[0]!
  return postMock<Order>('/api/orders', { clientId: client.id, documentType: 'local' })
}

describe('order routes', () => {
  it('carry a line through the whole flow', { timeout: 30_000 }, async () => {
    const order = await newOrder()

    const item = await postMock<OrderItem>(`/api/orders/${order.id}/items`, {
      productId: 'prod-001',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 120,
      unitCost: 100,
    })
    expect(item.totalPrice).toBe(1200)

    // PATCH a line — a price edit becomes a discount.
    const edited = await patchMock<OrderItem>(`/api/orders/${order.id}/items/${item.id}`, {
      manualUnitPrice: 108,
    })
    expect(edited.discountPercent).toBe(10)

    // Allocate a manual gross total.
    const allocation = await postMock<{ achievedGross: number; order: Order }>(
      `/api/orders/${order.id}/allocate-total`,
      { targetGross: 1210 },
    )
    expect(allocation.achievedGross).toBe(1210)
    expect(allocation.order.totalAmount).toBe(1000)

    // Reserve, then ship half.
    await postMock<StockReservation[]>(`/api/orders/${order.id}/reserve`, {})
    const shipment = await postMock<Shipment>(`/api/orders/${order.id}/shipments`, {
      lines: [{ lineId: item.id, quantity: 6 }],
    })
    expect(shipment.number).toContain('/1')
    expect((await getMock<Shipment[]>(`/api/orders/${order.id}/shipments`)).length).toBe(1)

    // Split the partially shipped line.
    const split = await postMock<{ shipped: OrderItem; remainder: OrderItem }>(
      `/api/orders/${order.id}/items/${item.id}/split`,
      { shippedQuantity: 6 },
    )
    expect(split.shipped.quantity).toBe(6)
    expect(split.remainder.quantity).toBe(4)

    // Invoice the shipment.
    const invoice = await postMock<Invoice>(`/api/orders/${order.id}/invoices`, {
      shipmentId: shipment.id,
    })
    expect((await getMock<Invoice[]>(`/api/orders/${order.id}/invoices`))[0]!.id).toBe(invoice.id)

    // Pay part of it, then take the payment back.
    const payment = await postMock<Payment>(`/api/orders/${order.id}/payments`, {
      amount: 500,
      purpose: 'advance',
    })
    expect((await getMock<Payment[]>(`/api/orders/${order.id}/payments`)).length).toBe(1)
    await deleteMock(`/api/orders/${order.id}/payments/${payment.id}`)
    expect((await getMock<Payment[]>(`/api/orders/${order.id}/payments`)).length).toBe(0)

    // Cancel a shipment by reversal — the second one, because the first has been
    // invoiced and an issued document is corrected, not silently withdrawn.
    const second = await postMock<Shipment>(`/api/orders/${order.id}/shipments`, {
      lines: [{ lineId: split.remainder.id, quantity: 4 }],
    })
    const cancelled = await postMock<Shipment>(
      `/api/orders/${order.id}/shipments/${second.id}/cancel`,
      {},
    )
    expect(cancelled.cancelled).toBe(true)

    // The invoiced one goes too, but only with a reason — and the reason has to
    // survive the trip through the router. A body dropped there is invisible to
    // every spec that calls the mock directly: the correction simply never
    // happens and the cancellation is refused.
    const corrected = await postMock<Shipment>(
      `/api/orders/${order.id}/shipments/${shipment.id}/cancel`,
      { correctionReason: 'Client refused the load' },
    )
    expect(corrected.cancelled).toBe(true)
    const afterCorrection = await getMock<Invoice[]>(`/api/orders/${order.id}/invoices`)
    expect(afterCorrection.filter((i) => i.kind === 'correction').length).toBe(1)

    // An advance invoice through the same route: no shipment, amount as gross.
    const advance = await postMock<Invoice>(`/api/orders/${order.id}/invoices`, {
      kind: 'advance',
      amountGross: 242,
    })
    expect([advance.amountNet, advance.shipmentId]).toEqual([200, null])

    // Reservations are readable through their own route.
    expect(
      Array.isArray(await getMock<StockReservation[]>(`/api/orders/${order.id}/reservations`)),
    ).toBe(true)

    // The card route still returns the order itself, not one of the above.
    const reloaded = await getMock<Order>(`/api/orders/${order.id}`)
    expect(reloaded.id).toBe(order.id)
    // Both trucks are on record: the invoiced one and the cancelled one. Nothing
    // is ever removed from the history — a cancellation is another entry.
    expect(reloaded.shipments.length).toBe(2)
  })

  it(
    'patch a service line through its own route, not the items one',
    { timeout: 15_000 },
    async () => {
      const order = await newOrder()
      const svc = await postMock<{ id: string }>(`/api/orders/${order.id}/services`, {
        serviceId: 'svc-001',
        quantity: 2,
        price: 12,
      })
      const edited = await patchMock<{ price: number; totalPrice: number }>(
        `/api/orders/${order.id}/services/${svc.id}`,
        { discountPercent: 10 },
      )
      expect(edited.price).toBe(10.8)
      expect(edited.totalPrice).toBe(21.6)
    },
  )

  it('keep the order patch route honest about derived numbers', { timeout: 15_000 }, async () => {
    const order = await newOrder()
    await postMock<OrderItem>(`/api/orders/${order.id}/items`, {
      productId: 'prod-001',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 100,
      unitCost: 100,
    })
    const patched = await patchMock<Order>(`/api/orders/${order.id}`, {
      notes: 'kept',
      totalAmount: 1,
    })
    expect(patched.notes).toBe('kept')
    expect(patched.totalAmount).toBe(100)
  })
})
