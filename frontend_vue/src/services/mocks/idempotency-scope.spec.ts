/**
 * П46 (`roo_code/roo-context/api/00-conventions.md:867-876`): "тем же самым"
 * считается пара "ключ и операция, на которую он послан" — один и тот же
 * `Idempotency-Key`, посланный на два разных пути (или на один и тот же путь
 * заказа с разным id — id входит в путь), выполняет операцию заново, а не
 * возвращает чужой ответ. Кэш живёт 24 часа.
 *
 * Эти три вещи доказываются здесь поведением диспетчера (`getMock`/`postMock`
 * из `./index`), а не чтением `withIdempotency`: один ключ на двух разных
 * путях выполняет обе операции; тот же ключ на том же пути второй раз
 * операцию не повторяет; запись старше суток не переиспользуется.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getMock, postMock } from './index'
import { mockGetClients } from './clients'
import { MOCK_SENT_EMAILS, MOCK_BCC_HISTORY } from './bcc'
import { cancelOrderShipment } from '../ordersService'
import { acceptBccResponse, markBccNoResponse } from '../bccService'
import type { Order, Payment, Shipment } from '@/types/order'
import type { BccRequest } from '@/types/bcc'

async function newOrder(): Promise<Order> {
  const client = mockGetClients()[0]!
  return postMock<Order>('/api/orders', { clientId: client.id, documentType: 'local' })
}

const KEY_HEADER = (key: string) => ({ 'Idempotency-Key': key })

describe('idempotency scope (П46)', () => {
  beforeEach(() => {
    MOCK_SENT_EMAILS.length = 0
  })

  it('the same key on two different paths runs both operations', async () => {
    const key = KEY_HEADER('idem-cross-path')

    const logged = await postMock<{ requestId: string }>(
      '/api/bcc/log',
      { productIds: [], recipientIds: [], source: 'test' },
      key,
    )
    const sentBefore = MOCK_SENT_EMAILS.length
    const sent = await postMock<{ requestId: string }>(
      '/api/bcc/send',
      { productIds: [], recipientIds: [], subject: 'subj', body: 'body' },
      key,
    )

    // Different operation, own answer — not the cached answer of the first path.
    expect(sent.requestId).not.toBe(logged.requestId)
    // And it actually ran: an envelope was queued, which only `/api/bcc/send` does.
    expect(MOCK_SENT_EMAILS.length).toBe(sentBefore + 1)
  })

  it('the same key on the same path does not repeat the operation', async () => {
    const key = KEY_HEADER('idem-same-path')

    const first = await postMock<{ requestId: string }>(
      '/api/bcc/log',
      { productIds: [], recipientIds: [], source: 'test' },
      key,
    )
    const second = await postMock<{ requestId: string }>(
      '/api/bcc/log',
      { productIds: [], recipientIds: [], source: 'test' },
      key,
    )

    // Second call gets its own answer back, not a fresh one.
    expect(second.requestId).toBe(first.requestId)
  })

  it('an entry older than 24h is not reused — the operation runs again', async () => {
    // Only `Date.now()` is faked — `delay()` still uses a real `setTimeout`, and
    // `vi.useFakeTimers()` would freeze that too and hang the test forever.
    const realNow = Date.now()
    let clock = realNow
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => clock)
    try {
      const key = KEY_HEADER('idem-ttl')

      const first = await postMock<{ requestId: string }>(
        '/api/bcc/log',
        { productIds: [], recipientIds: [], source: 'test' },
        key,
      )

      // Sits inside the 24h window — still the cached answer.
      clock = realNow + 23 * 60 * 60 * 1000
      const stillCached = await postMock<{ requestId: string }>(
        '/api/bcc/log',
        { productIds: [], recipientIds: [], source: 'test' },
        key,
      )
      expect(stillCached.requestId).toBe(first.requestId)

      // A day and a minute later — the entry is stale, the operation runs again.
      clock = realNow + 24 * 60 * 60 * 1000 + 60 * 1000
      const afterTtl = await postMock<{ requestId: string }>(
        '/api/bcc/log',
        { productIds: [], recipientIds: [], source: 'test' },
        key,
      )
      expect(afterTtl.requestId).not.toBe(first.requestId)
    } finally {
      nowSpy.mockRestore()
    }
  })

  it('the same key on the same order path does not repeat a shipment', async () => {
    const order = await newOrder()
    await postMock<{ id: string }>(`/api/orders/${order.id}/items`, {
      productId: 'prod-001',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 120,
    })
    const key = KEY_HEADER('idem-shipment')

    // Reads the real line id off the order rather than guessing it.
    const withItem = await getMock<Order>(`/api/orders/${order.id}`)
    const lineId = withItem.items[0]!.id
    const body = { lines: [{ lineId, quantity: 5 }] }

    await postMock<Shipment>(`/api/orders/${order.id}/shipments`, body, key)
    await postMock<Shipment>(`/api/orders/${order.id}/shipments`, body, key)

    const shipments = await getMock<Shipment[]>(`/api/orders/${order.id}/shipments`)
    expect(shipments.length).toBe(1)
  })

  it('the same key on two different orders is two different operations — the id is part of the path', async () => {
    const orderA = await newOrder()
    const orderB = await newOrder()
    const key = KEY_HEADER('idem-shared-across-orders')
    const body = { amount: 100, purpose: 'balance' as const }

    const paymentA = await postMock<Payment>(`/api/orders/${orderA.id}/payments`, body, key)
    const paymentB = await postMock<Payment>(`/api/orders/${orderB.id}/payments`, body, key)

    // Each order got its own payment record — the second call was not answered
    // out of the first order's cache entry.
    expect(paymentA.orderId).toBe(orderA.id)
    expect(paymentB.orderId).toBe(orderB.id)
    expect(paymentA.id).not.toBe(paymentB.id)

    const paymentsA = await getMock<Payment[]>(`/api/orders/${orderA.id}/payments`)
    const paymentsB = await getMock<Payment[]>(`/api/orders/${orderB.id}/payments`)
    expect(paymentsA.length).toBe(1)
    expect(paymentsB.length).toBe(1)
  })

  it('the same key on the same order path does not repeat a shipment cancellation', async () => {
    const order = await newOrder()
    await postMock<{ id: string }>(`/api/orders/${order.id}/items`, {
      productId: 'prod-001',
      quantity: 10,
      unit: 'pcs',
      unitPrice: 120,
    })
    const withItem = await getMock<Order>(`/api/orders/${order.id}`)
    const lineId = withItem.items[0]!.id
    const shipment = await postMock<Shipment>(`/api/orders/${order.id}/shipments`, {
      lines: [{ lineId, quantity: 5 }],
    })
    const key = KEY_HEADER('idem-cancel-shipment')

    // Without the guard the second call would hit `SHIPMENT_ALREADY_CANCELLED` —
    // the shipment is already cancelled by the first call. A cached answer means
    // no second attempt was made at all.
    const first = await postMock<Shipment>(
      `/api/orders/${order.id}/shipments/${shipment.id}/cancel`,
      {},
      key,
    )
    const second = await postMock<Shipment>(
      `/api/orders/${order.id}/shipments/${shipment.id}/cancel`,
      {},
      key,
    )
    expect(second).toEqual(first)
    expect(second.cancelled).toBe(true)
  })

  it('the same key on accept-response does not add a second row to the event feed', async () => {
    const key = KEY_HEADER('idem-accept-response')
    const before = MOCK_BCC_HISTORY.length

    const first = await postMock<BccRequest>(
      '/api/bcc/events/evt-001/response',
      { price: 100, unit: 'ton' },
      key,
    )
    const second = await postMock<BccRequest>(
      '/api/bcc/events/evt-001/response',
      { price: 100, unit: 'ton' },
      key,
    )
    expect(second.id).toBe(first.id)
    expect(MOCK_BCC_HISTORY.length).toBe(before + 1)
  })

  it('the same key on no-response does not add a second row to the event feed', async () => {
    const key = KEY_HEADER('idem-no-response')
    const before = MOCK_BCC_HISTORY.length

    const first = await postMock<BccRequest>('/api/bcc/events/evt-006/no-response', {}, key)
    const second = await postMock<BccRequest>('/api/bcc/events/evt-006/no-response', {}, key)
    expect(second.id).toBe(first.id)
    expect(MOCK_BCC_HISTORY.length).toBe(before + 1)
  })

  /**
   * The three client functions never let a test hand them a key — they mint one
   * themselves with `newIdempotencyKey()`. So proving the header actually leaves
   * the service layer means pinning that generator to one value across two calls
   * and watching the mock behave the way it only can when it saw the same key
   * twice: no second cancellation, no second feed row. Remove the header from
   * the service function and the second call stops being a repeat — it becomes
   * a fresh request the mock executes for real, and these assertions redden.
   */
  describe('the client functions actually deliver the header, not just the mock', () => {
    it('cancelOrderShipment', async () => {
      const order = await newOrder()
      await postMock<{ id: string }>(`/api/orders/${order.id}/items`, {
        productId: 'prod-001',
        quantity: 10,
        unit: 'pcs',
        unitPrice: 120,
      })
      const withItem = await getMock<Order>(`/api/orders/${order.id}`)
      const lineId = withItem.items[0]!.id
      const shipment = await postMock<Shipment>(`/api/orders/${order.id}/shipments`, {
        lines: [{ lineId, quantity: 5 }],
      })

      const spy = vi
        .spyOn(crypto, 'randomUUID')
        .mockReturnValue('fixed-client-key-cancel' as ReturnType<typeof crypto.randomUUID>)
      try {
        // Without a real header this throws SHIPMENT_ALREADY_CANCELLED on the
        // second call, exactly like the dispatcher-level test above.
        const first = await cancelOrderShipment(order.id, shipment.id)
        const second = await cancelOrderShipment(order.id, shipment.id)
        expect(second).toEqual(first)
      } finally {
        spy.mockRestore()
      }
    })

    it('acceptBccResponse', async () => {
      const spy = vi
        .spyOn(crypto, 'randomUUID')
        .mockReturnValue('fixed-client-key-accept' as ReturnType<typeof crypto.randomUUID>)
      try {
        const before = MOCK_BCC_HISTORY.length
        const first = await acceptBccResponse('evt-002', { price: 100, unit: 'ton' })
        const second = await acceptBccResponse('evt-002', { price: 100, unit: 'ton' })
        expect(second.id).toBe(first.id)
        expect(MOCK_BCC_HISTORY.length).toBe(before + 1)
      } finally {
        spy.mockRestore()
      }
    })

    it('markBccNoResponse', async () => {
      const spy = vi
        .spyOn(crypto, 'randomUUID')
        .mockReturnValue('fixed-client-key-no-response' as ReturnType<typeof crypto.randomUUID>)
      try {
        const before = MOCK_BCC_HISTORY.length
        const first = await markBccNoResponse('evt-007')
        const second = await markBccNoResponse('evt-007')
        expect(second.id).toBe(first.id)
        expect(MOCK_BCC_HISTORY.length).toBe(before + 1)
      } finally {
        spy.mockRestore()
      }
    })
  })
})
