/**
 * FINDING 28 — order numbers past the thousandth.
 *
 * `nextId()` (orders.ts:896) pads to three digits, so numbering runs ORD-2026-001
 * … ORD-2026-100 … and then ORD-2026-1000. The list sorts `orderNumber` as a
 * string (orders.ts:978-981), so the thousandth order lands between the hundredth
 * and the hundred-and-first.
 *
 * What is asserted below is the ORDER THE USER SEES, not the width of the field:
 * sorting by order number ascending must put the orders in the sequence their
 * numbers were issued in. Whoever fixes it chooses how — a wider pad, a numeric
 * sort, or a different scheme altogether. The same three-wide pad also sits in
 * clients.ts:923, warehouse.ts:520, products.ts:14121 and services.ts:96.
 */
import { describe, it, expect } from 'vitest'
import { mockCreateOrder, mockGetOrders, mockAddOrderItem, mockGetOrder } from './orders'
import { mockGetClients } from './clients'

const log: string[] = []
const show = (x: unknown) =>
  typeof x === 'string' || typeof x === 'number' || x === undefined ? String(x) : JSON.stringify(x)
const say = (...p: unknown[]) => log.push(p.map(show).join(' '))
const report = (t: string) => `\n=== ${t} ===\n${log.join('\n')}\n`

const BASE = {
  search: '',
  status: 'all',
  clientId: null as string | null,
  dateFrom: '',
  dateTo: '',
  sortBy: null as string | null,
  sortDir: 'asc',
}

/** Numbers handed out in this run, in the sequence they were handed out. */
const issued: string[] = []

describe('FINDING 28 — a store that grew past its seeded hundred', () => {
  it('the list sorted by order number is the order the numbers were issued in', () => {
    log.length = 0
    const clientId = mockGetClients()[0]!.id
    const seeded = mockGetOrders(BASE, { page: 1, pageSize: 1 }).total
    say('orders already in the store    :', seeded)

    const t0 = Date.now()
    for (let i = 0; i < 950; i++) {
      issued.push(mockCreateOrder({ clientId, documentType: 'local' }).orderNumber)
    }
    // An observation, not a threshold: measured at ~190 ms for 950 on this
    // machine. A number here that fails a build would fail it on somebody's
    // laptop for reasons that have nothing to do with orders.
    say('created 950 more in            :', Date.now() - t0, 'ms')
    const all = mockGetOrders(BASE, { page: 1, pageSize: 5000 })
    say('total now                      :', all.total)

    const byNumber = mockGetOrders(
      { ...BASE, sortBy: 'orderNumber', sortDir: 'asc' },
      { page: 1, pageSize: 5000 },
    )
    // Only the ones this test created, so the comparison rests on facts this test
    // knows: these numbers were issued in this sequence, one after another.
    const mine = new Set(issued)
    const asListed = byNumber.items.map((o) => o.orderNumber).filter((n) => mine.has(n))
    const firstDiff = issued.findIndex((n, i) => n !== asListed[i])
    /** One line instead of a thousand-row diff; the log below carries the rest. */
    const divergence = (listed: string[], expected: string[]): string | null => {
      const at = expected.findIndex((n, i) => n !== listed[i])
      return at === -1
        ? null
        : `position ${at}: the list shows ${listed[at]} where ${expected[at]} belongs`
    }
    say('')
    say('sortBy=orderNumber ascending:')
    say('  first issued                 :', issued.slice(0, 3))
    say('  as the list shows them       :', asListed.slice(0, 3))
    if (firstDiff !== -1) {
      say(`  first divergence at position ${firstDiff}:`)
      say(
        '    issued in this order       :',
        issued.slice(Math.max(0, firstDiff - 2), firstDiff + 4),
      )
      say(
        '    listed in this order       :',
        asListed.slice(Math.max(0, firstDiff - 2), firstDiff + 4),
      )
    }

    // Descending must be the same statement read backwards.
    const desc = mockGetOrders(
      { ...BASE, sortBy: 'orderNumber', sortDir: 'desc' },
      { page: 1, pageSize: 5000 },
    )
      .items.map((o) => o.orderNumber)
      .filter((n) => mine.has(n))

    say('')
    const t1 = Date.now()
    mockGetOrders({ ...BASE, sortBy: 'totalWithVat', sortDir: 'desc' }, { page: 1, pageSize: 20 })
    say('one sorted page over', all.total, 'orders :', Date.now() - t1, 'ms')
    const t2 = Date.now()
    const one = mockGetOrder(all.items[0]!.id)!
    say('one GET /orders/:id            :', Date.now() - t2, 'ms', `(${one.items.length} lines)`)
    const t3 = Date.now()
    mockAddOrderItem(all.items.at(-1)!.id, {
      productId: 'prod-001',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 100,
    })
    say('one POST /items                :', Date.now() - t3, 'ms')

    expect(
      all.total,
      report('FINDING 28 — the store did not grow past a thousand, so nothing was tested'),
    ).toBeGreaterThan(1000)
    expect(
      asListed.length,
      report('FINDING 28 — the sorted list lost some of the orders this test created'),
    ).toBe(issued.length)
    expect(
      divergence(asListed, issued),
      report(
        'FINDING 28 — the thousandth order sorts between the hundredth and the hundred-and-first; a list ordered by number no longer runs in the order the numbers were given out',
      ),
    ).toBeNull()
    expect(
      divergence(desc, [...issued].reverse()),
      report('FINDING 28 — descending by order number is not ascending read backwards'),
    ).toBeNull()
  })

  it('every order keeps its own id and its own number past a thousand', () => {
    log.length = 0
    const all = mockGetOrders(BASE, { page: 1, pageSize: 5000 })
    const ids = all.items.map((o) => o.id)
    const numbers = all.items.map((o) => o.orderNumber)
    const dupId = ids.filter((v, i) => ids.indexOf(v) !== i)
    const dupNumber = numbers.filter((v, i) => numbers.indexOf(v) !== i)
    say('orders in the store            :', all.total)
    say('distinct ids                   :', new Set(ids).size)
    say('distinct order numbers         :', new Set(numbers).size)
    say('sample                         :', numbers.slice(0, 3), '…', numbers.slice(-3))

    expect(
      all.total,
      report('FINDING 28 — the store is too small for this to prove anything'),
    ).toBeGreaterThan(1000)
    expect(dupId, report('FINDING 28 — two orders share an id')).toEqual([])
    expect(
      dupNumber,
      report(
        'FINDING 28 — two orders share a number, and every waybill and invoice is built from it',
      ),
    ).toEqual([])
  })
})
