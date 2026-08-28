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
 *
 * Тип — половина правила. Вторая половина: движение, назвавшее КУСОК, партию не двигает
 * (см. `movesOffcut` там же). Она переписана здесь словами, а не импортирована, — этот
 * файл сверяет склад со своим независимым счётом, и счёт, взятый у проверяемого,
 * сошёлся бы всегда.
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
    const skippedForPiece: typeof movements.items = []
    for (const m of movements.items) {
      if (!m.batchId) continue
      // Движение, назвавшее КУСОК, партию не двигает. Материал куска уходит с партии
      // ровно один раз — движением `offcut`, то есть самой резкой; всё, что случается с
      // куском после неё, случается с куском, а партия в такой записи названа для
      // происхождения. Посчитать её здесь значило бы вычесть один и тот же металл дважды.
      if (m.offcutId && m.type !== 'offcut') {
        skippedForPiece.push(m)
        continue
      }
      if (!byBatch.has(m.batchId)) byBatch.set(m.batchId, new Map())
      const per = byBatch.get(m.batchId)!
      per.set(m.type, round2((per.get(m.type) ?? 0) + m.quantity))
    }

    // ПОСЫЛКА самого пропуска, а не следствие из неё. Пропуск оправдан ровно тем, что
    // движение `offcut` по этому куску уже есть; нет его — и «уже вычли» становится
    // ложью, а сумма сходится только потому, что проверка отвернулась. Ровно так и было
    // до 2026-08-28: у трёх кусков резка записана как `production`/`write-off`, движения
    // `offcut` не было вовсе, и их количество осталось внутри остатка партии.
    const cutFrom = new Map<string, string>()
    for (const m of movements.items) {
      if (m.type === 'offcut' && m.offcutId) cutFrom.set(m.offcutId, m.batchId)
    }
    // Партия сверяется, а не только наличие резки: движение говорит «эту партию я не
    // трогаю, кусок с неё уже ушёл», и уйти он должен был именно С НЕЁ. Резка, списанная
    // с чужой партии, оставляет названную здесь партию нетронутой навсегда — в сидах так
    // было у двух кусков из трёх, у которых движение `offcut` вообще существовало.
    const unexplained = skippedForPiece
      .filter((m) => cutFrom.get(m.offcutId!) !== m.batchId)
      .map(
        (m) =>
          `${m.id}: ${m.type} по куску ${m.offcutId} (партия ${m.batchId}, резка с ${cutFrom.get(m.offcutId!) ?? 'ниоткуда'})`,
      )
    say('movements skipped as an offcut :', skippedForPiece.length)
    say('…whose piece never left a batch:', unexplained.length)
    unexplained.slice(0, 8).forEach((o) => say('  ' + o))
    expect(
      skippedForPiece.length,
      report('LAYER 11b — nothing was skipped, so the premise below proves nothing'),
    ).toBeGreaterThan(0)
    expect(
      unexplained,
      report(
        'LAYER 11b — a movement was skipped as "the piece already left its batch", and the piece never did',
      ),
    ).toEqual([])
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
