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
import { MOCK_SENT_EMAILS } from './bcc'
import type { Order, Payment, Shipment } from '@/types/order'

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
})
