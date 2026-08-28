/**
 * Layer 11b — the seeded ledger reconciles before anything in this process acts.
 *
 * GREEN GUARD. Model §7: "Остаток партии и её статус не хранятся как отдельная
 * правда, а выводятся из движений." This spec is the standing proof of that for
 * the seeded store, and it exists because the first audit pass got it wrong: it
 * counted `transfer` as an outgoing movement and `storage` as an incoming one and
 * reported "36 of 96 do not reconcile". The sets below are copied from
 * `writeMovement` itself (warehouse.ts:827+) — a movement type is not guessed at
 * here, and if a new type is added to `writeMovement` it has to be added here too.
 */
import { describe, it, expect } from 'vitest'
import { mockGetOrders, mockGetOrder } from './orders'
import { batchesForProduct, mockGetMovements } from './warehouse'
import { round2 } from '@/domain/orderPricing'

/**
 * "No filter at all" — spelled as the parameter the endpoint really takes.
 *
 * Cast to the endpoint's own signature rather than to the domain filter type:
 * the mock's list endpoints read every filter off the query string, so their
 * parameter is a bag of strings, and casting to the richer domain type made the
 * two silently disagree.
 */
const NO_FILTER = {
  search: '',
  status: '',
  priority: '',
  uomId: '',
  categoryIds: '',
  type: '',
  sortBy: undefined,
  sortDir: 'asc',
} as unknown as Parameters<typeof mockGetMovements>[0]

const log: string[] = []
const say = (...p: unknown[]) =>
  log.push(p.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '))
const report = (t: string) => `\n=== ${t} ===\n${log.join('\n')}\n`

/** Exactly the sets `writeMovement` uses. Anything else does not move the shelf. */
const OUT = [
  'sale',
  'expense',
  'write-off',
  'production',
  'return-to-supplier',
  'storage',
  'offcut',
]
const IN = ['return']
/** `receipt` is already inside `b.quantity`; `transfer` moves a batch, not stock. */
const NEUTRAL = ['receipt', 'transfer', 'correction']

describe('LAYER 11b — the seeded ledger, untouched', () => {
  it('every batch holds exactly what its own movements leave behind', async () => {
    log.length = 0
    // Nothing has been written by this process except the module-load scenario
    // shipments, which go through the real write-off and DO record movements.
    const movements = await mockGetMovements(NO_FILTER, { page: 1, pageSize: 100000 })
    say('movements in the journal       :', movements.items.length, 'of', movements.total)

    const byBatch = new Map<string, Map<string, number>>()
    for (const m of movements.items) {
      if (!m.batchId) continue
      if (!byBatch.has(m.batchId)) byBatch.set(m.batchId, new Map())
      const per = byBatch.get(m.batchId)!
      per.set(m.type, round2((per.get(m.type) ?? 0) + m.quantity))
    }
    const typesSeen = [...new Set(movements.items.map((m) => m.type))]
    say('movement types                 :', typesSeen)

    const productIds = new Set<string>()
    for (const row of mockGetOrders(
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
    ).items) {
      for (const i of mockGetOrder(row.id)!.items) productIds.add(i.productId)
    }
    const batches = [...productIds].flatMap((p) => batchesForProduct(p))

    let clean = 0
    let missingTotal = 0
    const off: string[] = []
    for (const b of batches) {
      const per = byBatch.get(b.id)
      const out = round2(OUT.reduce((sum, t) => sum + (per?.get(t) ?? 0), 0))
      const back = round2(IN.reduce((sum, t) => sum + (per?.get(t) ?? 0), 0))
      const expected = round2(b.quantity - out + back)
      const gap = round2(expected - b.quantityRemaining)
      if (Math.abs(gap) < 0.005) {
        clean++
        continue
      }
      missingTotal = round2(missingTotal + gap)
      off.push(
        `${b.id}: received ${b.quantity}, movements ${per ? [...per].map(([t, q]) => `${t}=${q}`).join(',') : 'none'} → expected ${expected}, stored ${round2(b.quantityRemaining)}, gap ${gap}`,
      )
    }
    say('')
    say('batches checked                :', batches.length)
    say('reconcile exactly              :', clean)
    say('units unaccounted for, total   :', missingTotal)
    say('')
    off.slice(0, 8).forEach((o) => say('  ' + o))

    // A movement type nobody has classified would be silently ignored above, and
    // the reconciliation would "pass" by not looking. Fail loudly instead.
    const unclassified = typesSeen.filter(
      (t) => !OUT.includes(t) && !IN.includes(t) && !NEUTRAL.includes(t),
    )
    expect(
      unclassified,
      report(
        'LAYER 11b — an unknown movement type is in the journal; classify it from writeMovement before trusting the sum',
      ),
    ).toEqual([])

    expect(
      batches.length,
      report('LAYER 11b — no batches to check; the sweep proves nothing'),
    ).toBeGreaterThan(0)
    expect(
      off,
      report('LAYER 11b — a batch holds a quantity its movements do not explain'),
    ).toEqual([])
    expect(clean, report('LAYER 11b — seeded ledger')).toBe(batches.length)
    expect(
      missingTotal,
      report('LAYER 11b — units on the shelf with no movement behind them'),
    ).toBe(0)
  })
})
