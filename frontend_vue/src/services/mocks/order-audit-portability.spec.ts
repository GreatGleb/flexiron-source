/**
 * What in the mock a real server could not do.
 *
 *   red   — 14 (the mock server reads the reader's UI language out of
 *               localStorage and freezes it into the order)
 *   green — two identical POSTs are two events, and every consequence of them
 *           agrees with every other: stock, line, movements, money
 *
 * Finding 13 — the missing `Idempotency-Key` on POST shipment and payment
 * (contract §3) — has no test here, and cannot have one: neither the mock nor
 * `ordersService` has anywhere to put the key, so there is nothing to assert
 * against without first inventing the signature the fix will use. What this
 * file can do is hold the consequences of the second POST to being exactly the
 * consequences of a second, deliberate shipment — see the last test.
 */
import { describe, it, expect } from 'vitest'

// The mock server reads the reader's UI language out of localStorage. Node has
// none — which is itself the point — so give it one.
const store = new Map<string, string>()
const reads: string[] = []
;(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => {
    reads.push(k)
    return store.get(k) ?? null
  },
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
}
import {
  mockGetOrder,
  mockCreateOrder,
  mockAddOrderItem,
  mockAddOrderService,
  mockCreateShipment,
  mockAddOrderPayment,
  mockGetOrders,
} from './orders'
import { mockGetClients } from './clients'
import { allServices } from './services'
import { batchesForProduct, batchById, mockGetMovementsFor } from './warehouse'
import { round2 } from '@/domain/orderPricing'
import type { Order } from '@/types/order'

const log: string[] = []
const say = (...p: unknown[]) =>
  log.push(p.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '))
/** The report the investigation used to print — now the failure message. */
const why = (t: string) => `\n=== ${t} ===\n` + log.join('\n') + '\n'

function fresh(): Order {
  return mockCreateOrder({ clientId: mockGetClients()[0]!.id, documentType: 'local' })
}
function stocked(min: number): string {
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
    { page: 1, pageSize: 200 },
  )
  const ids = new Set<string>()
  for (const r of page.items) for (const i of mockGetOrder(r.id)!.items) ids.add(i.productId)
  for (const id of ids) {
    if (batchesForProduct(id).reduce((s, b) => s + b.quantityRemaining, 0) >= min) return id
  }
  throw new Error('none')
}

describe('PORTABILITY', () => {
  it('what is stored does not depend on the language the person who stored it was reading', () => {
    log.length = 0
    const productId = stocked(20)
    const svc = allServices()[0]!
    const order = fresh()

    localStorage.setItem('flexiron_lang', 'ru')
    const ru = mockAddOrderItem(order.id, { productId, quantity: 1, unit: 'pcs', unitPrice: 100 })
    const ruSvc = mockAddOrderService(order.id, { serviceId: svc.id, quantity: 1, price: 50 })

    localStorage.setItem('flexiron_lang', 'lt')
    const lt = mockAddOrderItem(order.id, { productId, quantity: 1, unit: 'pcs', unitPrice: 100 })
    const ltSvc = mockAddOrderService(order.id, { serviceId: svc.id, quantity: 1, price: 50 })
    localStorage.removeItem('flexiron_lang')

    say('same product, two admins:')
    say('  added while reading RU       :', JSON.stringify(ru.productName))
    say('  added while reading LT       :', JSON.stringify(lt.productName))
    say('same service, two admins:')
    say('  added while reading RU       :', JSON.stringify(ruSvc.serviceName))
    say('  added while reading LT       :', JSON.stringify(ltSvc.serviceName))
    say('')
    say('Both are stored on the order and frozen there, in whatever language the')
    say('adder happened to be reading. Which one is right is not the question — a')
    say('server has no reader, so it cannot be either.')

    expect(lt.productName, why('PORTABILITY — language')).toBe(ru.productName)
    expect(ltSvc.serviceName, why('PORTABILITY — language')).toBe(ruSvc.serviceName)
  })

  it('the server side reads no browser storage at all', () => {
    log.length = 0
    const productId = stocked(20)
    const svc = allServices()[0]!
    localStorage.setItem('flexiron_lang', 'lt')

    reads.length = 0
    const order = fresh()
    mockAddOrderItem(order.id, { productId, quantity: 1, unit: 'pcs', unitPrice: 100 })
    mockAddOrderService(order.id, { serviceId: svc.id, quantity: 1, price: 50 })
    mockGetOrder(order.id)
    mockGetOrders(
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
    const touched = [...new Set(reads)]
    localStorage.removeItem('flexiron_lang')

    say('keys the mock server read while serving four requests:')
    say('  ', JSON.stringify(touched))
    say('')
    say('This is the root of the finding above, stated directly: on the server there')
    say('is no localStorage to read, so anything read from it here is a decision that')
    say('will have to be made somewhere else — or made by the caller and sent.')
    expect(touched, why('PORTABILITY — browser storage')).toEqual([])
  })

  it('two identical POSTs are two events, and every consequence of them agrees', () => {
    log.length = 0
    const productId = stocked(20)
    const order = fresh()
    const line = mockAddOrderItem(order.id, { productId, quantity: 6, unit: 'pcs', unitPrice: 100 })
    const batchId = line.allocations[0]!.batchId!
    const before = batchById(batchId)!.quantityRemaining
    say('batch before                   :', before)

    // The same request, sent twice — a retry, a double click past the guard, a
    // proxy replay. Contract §3 names shipments and payments as the two that
    // MUST be idempotent on a real server, and the key that would make them so
    // exists nowhere: not in the mock, not in ordersService.
    const body = { lines: [{ lineId: line.id, quantity: 3 }] }
    const a = mockCreateShipment(order.id, body)
    const b = mockCreateShipment(order.id, body)
    const after = batchById(batchId)!.quantityRemaining
    const shipped = mockGetOrder(order.id)!.items[0]!.shippedQuantity
    const movements =
      mockGetMovementsFor('order-shipment', a.id).length +
      mockGetMovementsFor('order-shipment', b.id).length

    say('shipments created              :', a.id, b.id)
    say(
      'batch after                    :',
      after,
      `(taken ${round2(before - after)} for two requests of 3)`,
    )
    say('line shippedQuantity           :', shipped)
    say('sale movements                 :', movements)

    // Until a key exists, the second POST is a second shipment — and a second
    // shipment has to be right in every place a shipment shows up.
    expect(a.id, why('PORTABILITY — repeat')).not.toBe(b.id)
    expect(round2(before - after), why('PORTABILITY — repeat')).toBe(6)
    expect(shipped, why('PORTABILITY — repeat')).toBe(6)
    expect(movements, why('PORTABILITY — repeat')).toBe(2)

    // And the line is now fully shipped, so a third one has nothing left to take.
    const third = (() => {
      try {
        mockCreateShipment(order.id, body)
        return 'ACCEPTED'
      } catch (e) {
        return String(e).replace(/^\w*Error: /, '')
      }
    })()
    // The same line named twice inside ONE request is the other half of the same
    // danger, and it is caught — on an order with room left, so the answer is
    // about the duplicate and not about the remainder.
    const roomy = fresh()
    const roomyLine = mockAddOrderItem(roomy.id, {
      productId,
      quantity: 6,
      unit: 'pcs',
      unitPrice: 100,
    })
    const doubled = (() => {
      try {
        mockCreateShipment(roomy.id, {
          lines: [
            { lineId: roomyLine.id, quantity: 1 },
            { lineId: roomyLine.id, quantity: 1 },
          ],
        })
        return 'ACCEPTED'
      } catch (e) {
        return String(e).replace(/^\w*Error: /, '')
      }
    })()
    say('a third identical POST         :', third)
    say('one POST naming a line twice   :', doubled)
    expect(third, why('PORTABILITY — repeat')).toContain('SHIPMENT_EXCEEDS_REMAINING')
    expect(doubled, why('PORTABILITY — repeat')).toContain('DUPLICATE_SHIPMENT_LINE')

    const p1 = mockAddOrderPayment(order.id, { amount: 500, purpose: 'advance' })
    const p2 = mockAddOrderPayment(order.id, { amount: 500, purpose: 'advance' })
    const paid = mockGetOrder(order.id)!.paidAmount
    say('payments created               :', p1.id, p2.id, '→ paid', paid)
    say('')
    say('withIdempotency() exists in mocks/index.ts but is wired to /api/bcc/* only;')
    say('ordersService never sends an Idempotency-Key at all. Contract §3 requires')
    say('both. No assertion here can stand in for that: there is no key to send.')
    expect(p1.id, why('PORTABILITY — repeat')).not.toBe(p2.id)
    expect(paid, why('PORTABILITY — repeat')).toBe(1000)
  })
})
