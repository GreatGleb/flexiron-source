/**
 * Layer 9 — is the wire payload a schema a backend can be built from?
 *
 *   green — `GET /orders/:id` is typed evenly: no leaf path carries two types
 *   red   — 20 (a) `heldReleased` is absent, not null, when nothing was held,
 *               so a schema read off one payload will never see the column
 *   green — 20 (b) the id convention itself: line and service ids are unique
 *               inside their order and repeat across orders; shipment, invoice
 *               and payment ids carry the order id and are unique globally
 *   red   — 19 two date formats in one array, so lexicographic order and
 *               chronological order are not the same order
 *   red   — 18 the audit log is addressed by position; contract §2 and §4.1
 *               require an id of its own on every entry
 */
import { describe, it, expect } from 'vitest'
import {
  mockGetOrder,
  mockCreateOrder,
  mockAddOrderItem,
  mockAddOrderService,
  mockCreateShipment,
  mockCreateInvoice,
  mockAddOrderPayment,
  mockPatchOrderStatus,
  mockReserveOrder,
  mockDeleteOrderAuditEntry,
  mockGetOrders,
} from './orders'
import { mockGetClients } from './clients'
import { allServices } from './services'
import { batchesForProduct } from './warehouse'
import type { Order } from '@/types/order'

const log: string[] = []
const say = (...p: unknown[]) =>
  log.push(p.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '))
/** The report the investigation used to print — now the failure message. */
const why = (t: string) => `\n=== ${t} ===\n` + log.join('\n') + '\n'

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

/** Every leaf path in the payload, with the JS type behind it. */
function shape(
  value: unknown,
  prefix = '',
  out = new Map<string, Set<string>>(),
): Map<string, Set<string>> {
  if (Array.isArray(value)) {
    value.forEach((v) => shape(v, `${prefix}[]`, out))
    return out
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      shape(v, prefix ? `${prefix}.${k}` : k, out)
    }
    return out
  }
  const key = prefix
  const t = value === null ? 'null' : typeof value
  if (!out.has(key)) out.set(key, new Set())
  out.get(key)!.add(t)
  return out
}

function fullOrder(reserve = false): Order {
  const productId = stocked(20)
  const order = mockCreateOrder({ clientId: mockGetClients()[0]!.id, documentType: 'local' })
  const a = mockAddOrderItem(order.id, { productId, quantity: 4, unit: 'pcs', unitPrice: 120 })
  mockAddOrderItem(order.id, { productId, quantity: 2, unit: 'pcs', unitPrice: 90 })
  mockAddOrderService(order.id, { serviceId: allServices()[0]!.id, quantity: 1, price: 50 })
  if (reserve) mockReserveOrder(order.id)
  const shp = mockCreateShipment(order.id, { lines: [{ lineId: a.id, quantity: 2 }] })
  mockCreateInvoice(order.id, { kind: 'regular', shipmentId: shp.id })
  mockAddOrderPayment(order.id, { amount: 100, purpose: 'advance' })
  return mockGetOrder(order.id)!
}

/** An audit entry as the contract wants it: addressed by its own id (§2). */
type AddressableEntry = { id?: string }

describe('LAYER 9 — the wire payload as a schema', () => {
  it('no field carries two types, and no optional field disappears instead of being null', () => {
    log.length = 0
    const order = fullOrder()
    const paths = shape(order)

    const multi = [...paths]
      .filter(([, types]) => [...types].filter((x) => x !== 'null').length > 1)
      .map(([p, t]) => `${p}: ${[...t].join('|')}`)
    say('leaf paths in GET /orders/:id  :', paths.size)
    say('paths with more than one type  :', multi.length ? multi : '—')
    expect(multi, why('LAYER 9 — payload shape')).toEqual([])
    expect(paths.size, why('LAYER 9 — payload shape')).toBeGreaterThanOrEqual(115)

    // A field that is `undefined` at the source vanishes through JSON, so nobody
    // deriving a schema from the payload learns it exists. Contract §3: "поле,
    // которое то есть, то отсутствует, не даст снять с ответа схему".
    const held = fullOrder(true).shipments[0]!.lines[0]!
    const notHeld = order.shipments[0]!.lines[0]!
    say('')
    say('shipment line, hold released   :', JSON.stringify(held))
    say('shipment line, nothing to hold :', JSON.stringify(notHeld))
    say('  heldReleased present?        :', 'heldReleased' in held, '/', 'heldReleased' in notHeld)

    expect(Array.isArray(held.heldReleased), why('LAYER 9 — payload shape')).toBe(true)
    expect('heldReleased' in notHeld, why('LAYER 9 — payload shape')).toBe(true)
    expect(notHeld.heldReleased ?? null, why('LAYER 9 — payload shape')).toBeNull()
  })

  it('one field, one date format — and sorting it by string sorts it by time', () => {
    log.length = 0
    const order = fullOrder()
    // Everything that writes history: creation (ISO), a status change, and the
    // generator's own entries on the seeded orders.
    mockPatchOrderStatus(order.id, 'confirmed')
    const withHistory = mockGetOrder(order.id)!
    const seeded = mockGetOrders(
      {
        search: '',
        status: 'all',
        clientId: null,
        dateFrom: '',
        dateTo: '',
        sortBy: 'orderNumber',
        sortDir: 'asc',
      },
      { page: 1, pageSize: 1 },
    ).items[0]!

    const samples: Array<[string, unknown]> = [
      ['order.createdAt', withHistory.createdAt],
      ['order.updatedAt', withHistory.updatedAt],
      ['shipments[].shippedAt', withHistory.shipments[0]?.shippedAt],
      ['invoices[].issuedAt', withHistory.invoices[0]?.issuedAt],
      ['payments[].paidAt', withHistory.payments[0]?.paidAt],
    ]
    for (const [k, v] of samples) say(`${k.padEnd(24)} ${JSON.stringify(v)}`)

    const stamps = withHistory.auditLog.map((e) => e.timestamp)
    say('')
    say('auditLog[].timestamp, in the order the entries were written:')
    for (const [i, t] of stamps.entries())
      say(`  ${i} ${JSON.stringify(t)} ${withHistory.auditLog[i]!.property.en}`)
    say(
      'the same on a seeded order     :',
      JSON.stringify(mockGetOrder(seeded.id)!.auditLog.map((e) => e.timestamp)),
    )

    const isIso = (v: unknown) =>
      typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(v)
    const oddEntities = samples
      .filter(([, v]) => v !== undefined && !isIso(v))
      .map(([k, v]) => `${k} = ${JSON.stringify(v)}`)
    expect(oddEntities, why('LAYER 9 — dates')).toEqual([])

    say('')
    say('Contract §3: "отметки времени всегда полные ISO-8601". A mixture has one')
    say('type, `string`, so no type check catches it — and sorted as strings the')
    say('short ones land before the long ones whatever the clock said.')
    const problems = stamps
      .filter((t) => !isIso(t))
      .map((t) => `not ISO-8601: ${JSON.stringify(t)}`)
    if (JSON.stringify([...stamps].sort()) !== JSON.stringify(stamps)) {
      problems.push(
        `sorted as strings the entries come out ${JSON.stringify([...stamps].sort())}, written order was ${JSON.stringify(stamps)}`,
      )
    }
    expect(problems, why('LAYER 9 — dates')).toEqual([])
  })

  it('id scope: line ids are unique inside their order, document ids globally', () => {
    log.length = 0
    const a = fullOrder()
    const b = fullOrder()
    say('order A / order B              :', a.id, '/', b.id)
    say(
      'A line ids / B line ids        :',
      a.items.map((i) => i.id),
      '/',
      b.items.map((i) => i.id),
    )
    say(
      'A service ids / B service ids  :',
      a.services.map((s) => s.id),
      '/',
      b.services.map((s) => s.id),
    )
    say(
      'A shipment / invoice / payment :',
      a.shipments[0]?.id,
      a.invoices[0]?.id,
      a.payments[0]?.id,
    )
    say(
      'B shipment / invoice / payment :',
      b.shipments[0]?.id,
      b.invoices[0]?.id,
      b.payments[0]?.id,
    )
    say('')
    say('Contract §2 names this convention and asks the schema to know it before a')
    say('primary key is chosen. It is a guard, not a defect: the rule is that line')
    say('ids repeat and document ids do not, and both halves must stay true.')

    // Rows of an order are addressed by the nested path, so their ids repeat.
    expect(
      a.items.map((i) => i.id),
      why('LAYER 9 — id scope'),
    ).toEqual(b.items.map((i) => i.id))
    expect(
      a.services.map((s) => s.id),
      why('LAYER 9 — id scope'),
    ).toEqual(b.services.map((s) => s.id))
    expect(new Set(a.items.map((i) => i.id)).size, why('LAYER 9 — id scope')).toBe(a.items.length)

    // Documents are addressed on their own, so their ids carry the order and differ.
    for (const [what, x, y] of [
      ['shipment', a.shipments[0]!.id, b.shipments[0]!.id],
      ['invoice', a.invoices[0]!.id, b.invoices[0]!.id],
      ['payment', a.payments[0]!.id, b.payments[0]!.id],
    ] as const) {
      expect(x.startsWith(a.id), why(`LAYER 9 — id scope (${what})`)).toBe(true)
      expect(y.startsWith(b.id), why(`LAYER 9 — id scope (${what})`)).toBe(true)
      expect(x, why(`LAYER 9 — id scope (${what})`)).not.toBe(y)
    }
  })

  it('a history entry is addressed by its own id, and an address that names nothing is refused', () => {
    log.length = 0
    const order = fullOrder()
    mockPatchOrderStatus(order.id, 'confirmed')
    const before = mockGetOrder(order.id)!.auditLog
    say(
      'audit log                      :',
      before.map((e) => e.property.en),
    )
    say(
      'ids on the entries             :',
      before.map((e) => (e as AddressableEntry).id ?? '(none)'),
    )
    say('')
    say('Contract §2: "у каждой записи собственный id; адресовать позицией в списке')
    say('нельзя". Two clients hold the same list, the first deletes entry 1, the')
    say('indices shift — and the second, asking for entry 2, deletes its neighbour')
    say('and keeps the one it meant to remove. Nobody is told.')

    // An address that names no record must be refused, not quietly ignored: a
    // silent success is indistinguishable from "the record was already gone".
    const nowhere = (() => {
      try {
        mockDeleteOrderAuditEntry(order.id, 'no-such-entry' as never)
        return 'ACCEPTED'
      } catch (e) {
        return String(e).replace(/^\w*Error: /, '')
      }
    })()
    say('DELETE an address that names nothing:', nowhere)

    const ids = before.map((e) => (e as AddressableEntry).id)
    const problems: string[] = []
    if (ids.filter((id) => typeof id === 'string' && id.length > 0).length !== before.length) {
      problems.push(
        `${before.length} entries, ${ids.filter((id) => typeof id === 'string').length} of them with an id of their own`,
      )
    } else if (new Set(ids).size !== before.length)
      problems.push('the ids are not distinct inside the order')
    if (nowhere === 'ACCEPTED')
      problems.push('an address naming no record was accepted and quietly did nothing')
    expect(problems, why('LAYER 9 — audit addressing')).toEqual([])

    // And a delete that does name a record removes that record and only it.
    const target = before[1]!
    const address = ((target as AddressableEntry).id ?? 1) as never
    mockDeleteOrderAuditEntry(order.id, address)
    const after = mockGetOrder(order.id)!.auditLog
    say(
      'after deleting entry 1         :',
      after.map((e) => e.property.en),
    )
    expect(after.length, why('LAYER 9 — audit addressing')).toBe(before.length - 1)
    expect(
      after.map((e) => e.property.en),
      why('LAYER 9 — audit addressing'),
    ).toEqual(before.filter((_, i) => i !== 1).map((e) => e.property.en))
  })
})
