/**
 * Layer 10 — the list endpoint against contract §4.1 and §4.7.
 *
 *   red   — 21 (a) an unknown sort key silently returns the storage order,
 *               which is neither the order asked for nor the default
 *   red   — 21 (b) a page number below one answers with the tail of the list
 *               (`page=-1`) or with nothing (`page=0`) instead of refusing
 *   red   — 21 (c) a date that does not parse silently filters everything out,
 *               or, at the other end, silently filters nothing out
 *   green — paging: a hundred rows over fifteen pages, no duplicate, no gap,
 *               an honest `total`, an empty page past the end
 *   green — all eight sort keys, including the three §4.1 names outright
 *   green — the date filter, both ends inclusive, `from + to − both = total`
 *   green — a client's whole history pages; filter, sort and page compose
 *   green — every row of the list agrees with the order behind it
 */
import { describe, it, expect } from 'vitest'
import { mockGetOrders, mockGetOrder, mockCreateOrder, mockAddOrderItem } from './orders'
import { mockGetClients } from './clients'
import type { PaginatedResponse } from '@/types/api'
import type { OrderListItem } from '@/types/order'

const log: string[] = []
const say = (...p: unknown[]) =>
  log.push(p.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '))
/** The report the investigation used to print — now the failure message. */
const why = (t: string) => `\n=== ${t} ===\n` + log.join('\n') + '\n'

const BASE = {
  search: '',
  status: 'all',
  clientId: null as string | null,
  dateFrom: '',
  dateTo: '',
  sortBy: null as string | null,
  sortDir: 'asc',
}
function list(
  over: Partial<typeof BASE> = {},
  page = 1,
  pageSize = 20,
): PaginatedResponse<OrderListItem> {
  return mockGetOrders({ ...BASE, ...over }, { page, pageSize })
}
function verdictOf(fn: () => unknown): string {
  try {
    fn()
    return 'ACCEPTED'
  } catch (e) {
    return String(e).replace(/^\w*Error: /, '')
  }
}
/** Reads a sort key off a row without pretending to know the row's type. */
const cell = (row: OrderListItem, key: string): string | number =>
  (row as unknown as Record<string, string | number>)[key]!

describe('LAYER 10 — the list', () => {
  it('an unknown sort key is refused, and named in the refusal', () => {
    log.length = 0
    const natural = list({}, 1, 10).items.map((o) => o.orderNumber)
    const byNumber = list({ sortBy: 'orderNumber', sortDir: 'asc' }, 1, 10).items.map(
      (o) => o.orderNumber,
    )
    say('no sortBy (default createdAt↓) :', natural.join(' '))
    say('sortBy=orderNumber             :', byNumber.join(' '))

    for (const key of ['totalCost', 'clientNmae']) {
      const rows = verdictOf(() => list({ sortBy: key, sortDir: 'asc' }, 1, 10))
      const order =
        rows === 'ACCEPTED'
          ? list({ sortBy: key, sortDir: 'asc' }, 1, 10).items.map((o) => o.orderNumber)
          : []
      say(`sortBy=${key.padEnd(23)}: ${rows}`)
      if (order.length) {
        say('  what came back              :', order.join(' '))
        say('  same as the default?         ', JSON.stringify(order) === JSON.stringify(natural))
      }
    }
    say('')
    say('Contract §4.1: "Неизвестный ключ сортировки не должен молча возвращать')
    say('исходный порядок: это неотличимо от «сортировка сломана»." `totalCost` is')
    say('a real column that never reached the switch; `clientNmae` is a typo. Both')
    say('come back in storage order — not the order asked for, and not the default.')

    // A real column missing from the switch, and a typo, must both be refused.
    for (const key of ['totalCost', 'clientNmae']) {
      const verdict = verdictOf(() => list({ sortBy: key, sortDir: 'asc' }, 1, 10))
      expect(verdict, why('LAYER 10 — unknown sort key')).toContain('UNKNOWN_SORT_KEY')
      expect(verdict, why('LAYER 10 — unknown sort key')).toContain(key)
    }
    // …and a key that exists must go on working.
    expect(
      verdictOf(() => list({ sortBy: 'orderNumber' }, 1, 10)),
      why('LAYER 10 — unknown sort key'),
    ).toBe('ACCEPTED')
  })

  it('every sort key the contract names really sorts, both ways', () => {
    log.length = 0
    const keys = [
      'totalWithVat',
      'paidPercent',
      'shippedPercent',
      'totalAmount',
      'createdAt',
      'status',
      'clientName',
      'orderNumber',
    ]
    const broken: string[] = []
    for (const key of keys) {
      const asc = list({ sortBy: key, sortDir: 'asc' }, 1, 1000).items
      const desc = list({ sortBy: key, sortDir: 'desc' }, 1, 1000).items
      // The mock compares raw values with < and >; so does this, on purpose —
      // the question here is "is it sorted", not "by whose collation".
      const rising = asc.every((row, i) => i === 0 || !(cell(row, key) < cell(asc[i - 1]!, key)))
      const falling = desc.every((row, i) => i === 0 || !(cell(row, key) > cell(desc[i - 1]!, key)))
      const complete = asc.length === desc.length && asc.length === list({}, 1, 1000).total
      say(`${key.padEnd(16)} asc sorted: ${rising}  desc sorted: ${falling}  rows: ${asc.length}`)
      if (!rising) broken.push(`${key} asc is not in ascending order`)
      if (!falling) broken.push(`${key} desc is not in descending order`)
      if (!complete) broken.push(`${key} lost or gained rows while sorting`)
    }
    say('')
    say('§4.1 names totalWithVat, paidPercent and shippedPercent outright: they are')
    say('columns the user sees, so they are columns the server has to sort by.')
    expect(broken, why('LAYER 10 — required sort keys')).toEqual([])
  })

  it('paging: every row appears exactly once, total is honest, past the end is empty', () => {
    log.length = 0
    const first = list({}, 1, 7)
    const pages = Math.ceil(first.total / 7)
    const seen: string[] = []
    for (let p = 1; p <= pages; p++) seen.push(...list({}, p, 7).items.map((o) => o.id))
    const unique = new Set(seen)
    say('total reported                 :', first.total)
    say('totalPages reported            :', first.totalPages, '(computed', pages + ')')
    say('rows collected over all pages  :', seen.length)
    say('distinct rows                  :', unique.size)
    const beyond = list({}, pages + 5, 7)
    say(
      'page beyond the end            :',
      JSON.stringify({ items: beyond.items.length, total: beyond.total }),
    )

    expect(first.totalPages, why('LAYER 10 — paging')).toBe(pages)
    expect(seen.length, why('LAYER 10 — paging')).toBe(first.total)
    expect(unique.size, why('LAYER 10 — paging')).toBe(first.total)
    expect(beyond.items.length, why('LAYER 10 — paging')).toBe(0)
    expect(beyond.total, why('LAYER 10 — paging')).toBe(first.total)
  })

  it('a page number below one is refused, not answered with the wrong page', () => {
    log.length = 0
    const zero = verdictOf(() => list({}, 0, 7))
    const negative = verdictOf(() => list({}, -1, 7))
    say(
      'page 0                         :',
      zero,
      zero === 'ACCEPTED' ? JSON.stringify({ items: list({}, 0, 7).items.length }) : '',
    )
    say(
      'page -1                        :',
      negative,
      negative === 'ACCEPTED'
        ? JSON.stringify({ items: list({}, -1, 7).items.map((o) => o.orderNumber) })
        : '',
    )
    say(
      'last real page                 :',
      JSON.stringify(
        list({}, Math.ceil(list({}, 1, 7).total / 7), 7).items.map((o) => o.orderNumber),
      ),
    )
    // `pageSize` is now named alongside `page` in §4.1: a size below one used to
    // answer with `totalPages: Infinity`, a number that goes on to be rendered.
    const zeroSize = verdictOf(() => list({}, 1, 0))
    say(
      'pageSize 0                     :',
      zeroSize,
      zeroSize === 'ACCEPTED'
        ? `items ${list({}, 1, 0).items.length}, totalPages ${String(list({}, 1, 0).totalPages)}`
        : '',
    )
    say('')
    say('`page=-1` becomes slice(-14, -7) and hands back the tail of the list; a')
    say('client that asked for a page it can name gets a page it did not. Contract')
    say('§4.1: "Неразбираемые параметры списка тоже отказ, а не пустой ответ."')
    expect(zero, why('LAYER 10 — page below one')).not.toBe('ACCEPTED')
    expect(negative, why('LAYER 10 — page below one')).not.toBe('ACCEPTED')
    expect(zeroSize, why('LAYER 10 — page below one')).not.toBe('ACCEPTED')
  })

  it('a client s whole history pages, and filter, sort and page compose', () => {
    log.length = 0
    const client = mockGetClients()[0]!
    const all = list({ clientId: client.id }, 1, 1000)
    say('orders for the first client    :', all.total)
    const paged: string[] = []
    for (let p = 1; p <= Math.ceil(all.total / 3); p++) {
      paged.push(...list({ clientId: client.id }, p, 3).items.map((o) => o.id))
    }
    say('same, walked 3 at a time       :', paged.length, 'distinct', new Set(paged).size)
    expect(paged.length, why('LAYER 10 — history')).toBe(all.total)
    expect(new Set(paged).size, why('LAYER 10 — history')).toBe(all.total)

    // Filter + sort together: the filter must apply BEFORE the page is cut.
    const top5 = list({ status: 'delivered', sortBy: 'totalWithVat', sortDir: 'desc' }, 1, 5)
    const allDelivered = list(
      { status: 'delivered', sortBy: 'totalWithVat', sortDir: 'desc' },
      1,
      1000,
    )
    say(
      'status=delivered, top 5 by gross:',
      top5.items.map((o) => o.totalWithVat),
    )
    expect(
      top5.items.map((o) => o.id),
      why('LAYER 10 — history'),
    ).toEqual(allDelivered.items.slice(0, 5).map((o) => o.id))
    expect(
      allDelivered.items.every((o) => o.status === 'delivered'),
      why('LAYER 10 — history'),
    ).toBe(true)
    expect(top5.total, why('LAYER 10 — history')).toBe(allDelivered.total)

    // A brand-new order must show up in the client's history immediately.
    const created = mockCreateOrder({ clientId: client.id, documentType: 'local' })
    const after = list({ clientId: client.id }, 1, 1000)
    say('after creating one more        :', after.total, '(was', all.total + ')')
    expect(after.total, why('LAYER 10 — history')).toBe(all.total + 1)
    expect(
      after.items.some((o) => o.id === created.id),
      why('LAYER 10 — history'),
    ).toBe(true)
  })

  it('the date filter takes both ends inclusively', () => {
    log.length = 0
    const all = list({}, 1, 1000).items
    const dates = all.map((o) => o.createdAt.slice(0, 10)).sort()
    const mid = dates[Math.floor(dates.length / 2)]!
    const from = list({ dateFrom: mid }, 1, 1000)
    const to = list({ dateTo: mid }, 1, 1000)
    const both = list({ dateFrom: mid, dateTo: mid }, 1, 1000)
    say('orders in the store            :', all.length)
    say(`dateFrom=${mid}            : ${from.total}`)
    say(`dateTo=${mid}              : ${to.total}`)
    say(`both ends = ${mid}         : ${both.total} (that day, inclusive)`)
    say(
      'from + to − both               :',
      from.total + to.total - both.total,
      '(must equal the total)',
    )

    expect(both.total, why('LAYER 10 — dates')).toBeGreaterThan(0)
    expect(from.total + to.total - both.total, why('LAYER 10 — dates')).toBe(all.length)
    expect(
      from.items.every((o) => o.createdAt.slice(0, 10) >= mid),
      why('LAYER 10 — dates'),
    ).toBe(true)
    expect(
      to.items.every((o) => o.createdAt.slice(0, 10) <= mid),
      why('LAYER 10 — dates'),
    ).toBe(true)

    // A range that is real but holds nothing is an empty answer, not an error.
    const reversed = list({ dateFrom: '2030-01-01', dateTo: '2020-01-01' }, 1, 1000)
    say('dateFrom after dateTo          :', reversed.total)
    expect(reversed.total, why('LAYER 10 — dates')).toBe(0)
  })

  it('a date that does not parse is refused, at either end', () => {
    log.length = 0
    const total = list({}, 1, 1000).total
    const badFrom = verdictOf(() => list({ dateFrom: 'not-a-date' }, 1, 1000))
    const badTo = verdictOf(() => list({ dateTo: 'garbage' }, 1, 1000))
    say('orders in the store            :', total)
    say(
      'dateFrom="not-a-date"          :',
      badFrom,
      badFrom === 'ACCEPTED' ? `→ ${list({ dateFrom: 'not-a-date' }, 1, 1000).total} rows` : '',
    )
    say(
      'dateTo="garbage"               :',
      badTo,
      badTo === 'ACCEPTED' ? `→ ${list({ dateTo: 'garbage' }, 1, 1000).total} rows` : '',
    )
    say('')
    say('The two failures are opposite and both silent: compared as strings,')
    say('"not-a-date" is above every date and hides everything, "garbage" is above')
    say('every date at the other end and hides nothing. An empty list as the answer')
    say('to a broken request reads as "nothing found" (§4.1).')
    expect(badFrom, why('LAYER 10 — unparseable dates')).not.toBe('ACCEPTED')
    expect(badTo, why('LAYER 10 — unparseable dates')).not.toBe('ACCEPTED')
  })

  it('every row of the list agrees with the order behind it, and moves when it moves', () => {
    log.length = 0
    const rows = list({}, 1, 1000).items
    const bad: string[] = []
    for (const row of rows) {
      const order = mockGetOrder(row.id)!
      if (row.totalAmount !== order.totalAmount)
        bad.push(`${row.id} totalAmount ${row.totalAmount} vs ${order.totalAmount}`)
      if (row.totalWithVat !== order.totalWithVat)
        bad.push(`${row.id} totalWithVat ${row.totalWithVat} vs ${order.totalWithVat}`)
      if (row.paidPercent !== order.paidPercent)
        bad.push(`${row.id} paidPercent ${row.paidPercent} vs ${order.paidPercent}`)
      if (row.itemCount !== order.items.length + order.services.length)
        bad.push(`${row.id} itemCount ${row.itemCount}`)
      if (row.status !== order.status) bad.push(`${row.id} status ${row.status} vs ${order.status}`)
      if (row.clientName !== order.clientName) bad.push(`${row.id} clientName`)
      if (row.createdAt !== order.createdAt) bad.push(`${row.id} createdAt`)
    }
    say('rows checked                   :', rows.length)
    say('rows disagreeing with the order:', bad.length ? bad.slice(0, 5) : '—')
    expect(bad, why('LAYER 10 — list vs order')).toEqual([])

    // And a line added to an order must move its row.
    const target = rows.find((r) => r.itemCount > 0)!
    const ord = mockGetOrder(target.id)!
    mockAddOrderItem(target.id, {
      productId: ord.items[0]!.productId,
      quantity: 1,
      unit: 'pcs',
      unitPrice: 777,
    })
    const now = list({}, 1, 1000).items.find((r) => r.id === target.id)!
    const reread = mockGetOrder(target.id)!
    say('row before / after adding a line:', target.totalWithVat, '/', now.totalWithVat)
    expect(now.totalWithVat, why('LAYER 10 — list vs order')).not.toBe(target.totalWithVat)
    expect(now.totalWithVat, why('LAYER 10 — list vs order')).toBe(reread.totalWithVat)
    expect(now.itemCount, why('LAYER 10 — list vs order')).toBe(target.itemCount + 1)
  })
})
