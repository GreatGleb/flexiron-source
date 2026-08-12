/**
 * Layer 7. Contract §7: "Хранить с запасом (мок — 10 знаков)".
 *
 * The mock keeps numbers as IEEE-754 doubles, i.e. ~17 significant digits. A
 * backend stores them in a column. If the guarantees only hold at 17 digits and
 * the contract tells the backend author to use 10, the guarantee does not travel.
 *
 * These are acceptance criteria, not a report. Each `it` states the behaviour the
 * money is supposed to have; the accumulated narration travels in the assertion
 * message so a failure still explains itself.
 */
import { describe, it, expect } from 'vitest'
import {
  type PricingLine,
  calcLine,
  round2,
  round4,
  roundTo,
  roundStored,
  rollupOrder,
  allocateTotal,
  allocateGrossTotal,
  applyPriceEdit,
  applyDiscountEdit,
  grossToNet,
} from '@/domain/orderPricing'
import { pricingSeedFor } from '@/services/orderLines'

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** What a numeric(_, d) column would give back. */
function store(line: PricingLine, digits: number): PricingLine {
  return {
    ...line,
    unitCost: roundTo(line.unitCost, digits),
    marginPercent: roundTo(line.marginPercent, digits),
    discountPercent: roundTo(line.discountPercent, digits),
    manualUnitPrice: line.manualUnitPrice === null ? null : roundTo(line.manualUnitPrice, digits),
    quantity: roundTo(line.quantity, 6),
  }
}

function decimalsOf(v: number): number {
  if (!Number.isFinite(v)) return 0
  const s = String(v)
  if (s.includes('e') || s.includes('E')) return 99
  const dot = s.indexOf('.')
  return dot === -1 ? 0 : s.length - dot - 1
}

/**
 * A line as the order builds it from "this costs C, we sell it at P" — the seam
 * every catalogue line goes through. Deliberately built through `pricingSeedFor`
 * and read back through `calcLine`, so the test states what the money must be and
 * not which field the line chose to keep it in.
 */
function seededLine(unitCost: number, sellingPrice: number, quantity: number): PricingLine {
  const seed = pricingSeedFor(unitCost, sellingPrice)
  return {
    id: 'seeded',
    quantity,
    unitCost,
    costSource: 'stock',
    marginPercent: seed.marginPercent,
    discountPercent: 0,
    manualUnitPrice: seed.manualUnitPrice,
    state: 'draft',
    shippedQuantity: 0,
    documentIssued: false,
  }
}

const log: string[] = []
const say = (...p: unknown[]) => log.push(p.map(String).join(' '))
/** The narration, as an assertion message. */
const why = (title: string) => `\n=== ${title} ===\n` + log.join('\n') + '\n'

describe('LAYER 7 — storage precision', () => {
  it('GUARD: a spread total still lands on the cent after the lines are stored', () => {
    log.length = 0
    const r = rng(4242)
    const DIGITS = [10, 12, 14]
    const broken = new Map<number, number>()
    const worst = new Map<number, number>()
    let tried = 0
    let maxDecimals = 0
    let maxSample = ''

    for (let i = 0; i < 6000; i++) {
      const count = 1 + Math.floor(r() * 4)
      const lines: PricingLine[] = Array.from({ length: count }, (_, k) => ({
        id: `l${k}`,
        quantity: r() < 0.5 ? 1 + Math.floor(r() * 40) : roundTo(0.1 + r() * 90, 2),
        unitCost: round2(1 + r() * 400),
        costSource: 'stock',
        marginPercent: roundTo(r() * 60, 4),
        discountPercent: 0,
        manualUnitPrice: null,
        state: 'draft',
        shippedQuantity: 0,
        documentIssued: false,
      }))
      const target = round2(100 + r() * 50000)
      let result
      try {
        result = allocateTotal(lines, target)
      } catch {
        continue
      }
      tried++

      // How many decimals the mock actually needs to keep.
      for (const l of result.lines) {
        if (l.manualUnitPrice === null) continue
        const d = decimalsOf(l.manualUnitPrice)
        if (d > maxDecimals) {
          maxDecimals = d
          maxSample = `${l.manualUnitPrice} (qty ${l.quantity})`
        }
      }

      for (const digits of DIGITS) {
        const persisted = result.lines.map((l) => store(l, digits))
        const after = persisted.reduce((s, l) => round2(s + calcLine(l).lineNet), 0)
        if (after !== target) {
          broken.set(digits, (broken.get(digits) ?? 0) + 1)
          const gap = Math.abs(round2(after - target))
          if (gap > (worst.get(digits) ?? 0)) worst.set(digits, gap)
        }
      }
    }

    say(`spread totals tried            : ${tried}`)
    say(`decimals the price really needs: up to ${maxDecimals}  e.g. ${maxSample}`)
    for (const d of DIGITS) {
      say(
        `stored at ${String(d).padStart(2)} decimals        : ` +
          `${broken.get(d) ?? 0} of ${tried} no longer hit the target` +
          ` (worst ${worst.get(d) ?? 0})`,
      )
    }

    // A guard that never ran would pass by accident.
    expect(tried, why('LAYER 7 — allocateTotal after storage')).toBeGreaterThan(5000)
    // The promise of allocateTotal is "the sum of the lines IS the target", and it
    // has to survive the column the backend will keep those lines in.
    expect(
      DIGITS.map((d) => `${d} decimals: ${broken.get(d) ?? 0} misses`).join(' | '),
      why('LAYER 7 — allocateTotal after storage'),
    ).toBe(DIGITS.map((d) => `${d} decimals: 0 misses`).join(' | '))
  })

  it('a price named on a line survives storage: the line total is price × quantity', () => {
    log.length = 0
    const r = rng(99)
    let worst = 0
    let worstCase = ''
    let off = 0
    let priceOff = 0
    const N = 20000
    for (let i = 0; i < N; i++) {
      const cost = round2(0.01 + r() * 500)
      const price = round2(cost * (0.5 + r() * 3))
      if (price <= 0) continue
      const qty = r() < 0.5 ? 1 + Math.floor(r() * 100) : roundTo(0.1 + r() * 200, 2)

      // Build the line the way the order builds it, store it at contract precision,
      // read the money back out.
      const persisted = store(seededLine(cost, price, qty), 10)
      const totals = calcLine(persisted)

      const honest = round2(price * qty)
      if (totals.unitPrice !== round4(price)) priceOff++
      if (totals.lineNet !== honest) {
        off++
        const gap = Math.abs(round2(totals.lineNet - honest))
        if (gap > worst) {
          worst = gap
          worstCase = `cost ${cost}, price ${price}, qty ${qty}: line says ${totals.lineNet}, the price says ${honest}`
        }
      }
    }
    say(`priced lines tried             : ${N}`)
    say(`unit price not the one named   : ${priceOff}`)
    say(`line total ≠ price × quantity  : ${off} (${((off / N) * 100).toFixed(2)}%)`)
    say(`worst gap                      : ${worst}`)
    say(`worst case                     : ${worstCase || '—'}`)
    say('')
    say('The line is seeded through pricingSeedFor() and read through calcLine():')
    say('the criterion is the money, not the field it is kept in. A price kept as a')
    say('percentage is rebuilt from cost × (1 + margin) and loses the cent; a price')
    say('kept as a price (as manualUnitPrice already is) does not.')

    expect(
      `${priceOff} lines lost the named price, ${off} lines lost the total (worst ${worst})`,
      why('LAYER 7 — a named price must reach the line total'),
    ).toBe('0 lines lost the named price, 0 lines lost the total (worst 0)')
  })

  it('GUARD: a hand-typed price survives storage — it is kept, not rebuilt', () => {
    log.length = 0
    // Two questions at once. The criterion: a price typed by hand still totals
    // price x quantity after the column has been through it. The narration: what
    // it would cost to rebuild that price from the percentage the edit derived,
    // measured at every storage precision — including none at all.
    const REBUILD_AT = [10, 12, 14, 17, Number.POSITIVE_INFINITY]
    const rebuiltOff = new Map<number, number>()
    let kept = 0
    let keptOff = 0
    let priceOff = 0
    let worst = 0
    let worstCase = ''

    for (const digits of REBUILD_AT) {
      const r = rng(7777)
      const first = digits === REBUILD_AT[0]
      for (let i = 0; i < 20000; i++) {
        const line: PricingLine = {
          id: 'x',
          quantity: r() < 0.5 ? 1 + Math.floor(r() * 60) : roundTo(0.1 + r() * 120, 2),
          unitCost: round2(0.01 + r() * 400),
          costSource: 'stock',
          marginPercent: roundTo(r() * 80, 4),
          discountPercent: 0,
          manualUnitPrice: null,
          state: 'draft',
          shippedQuantity: 0,
          documentIssued: false,
        }
        const typed = round2(0.01 + r() * 600)
        let edited
        try {
          edited = applyPriceEdit(line, typed)
        } catch {
          continue
        }
        const keep = (l: PricingLine) => (Number.isFinite(digits) ? store(l, digits) : l)
        const persisted = keep(edited)

        if (first) {
          // THE CRITERION. The price the client was quoted, after storage.
          kept++
          const totals = calcLine(store(edited, 10))
          const honest = round2(typed * line.quantity)
          if (totals.unitPrice !== round4(typed)) priceOff++
          if (totals.lineNet !== honest) {
            keptOff++
            const gap = Math.abs(round2(totals.lineNet - honest))
            if (gap > worst) {
              worst = gap
              worstCase = `qty ${line.quantity}, typed ${typed}: ${totals.lineNet} vs ${honest}`
            }
          }
        }

        // THE NARRATION. Drop the price and rebuild it from the discount the edit
        // derived — what a schema that keeps only percentages would have to do.
        const reapplied = applyDiscountEdit(
          { ...persisted, manualUnitPrice: null },
          persisted.discountPercent,
        )
        if (calcLine(edited).lineNet !== calcLine(keep(reapplied)).lineNet) {
          rebuiltOff.set(digits, (rebuiltOff.get(digits) ?? 0) + 1)
        }
      }
    }

    say(`hand-typed prices tried        : ${kept}`)
    say(`unit price not the one typed   : ${priceOff}`)
    say(`line total != price x quantity : ${keptOff}`)
    say(`worst gap                      : ${worst}  ${worstCase}`)
    say('')
    say('The same price, thrown away and rebuilt from the stored percentage:')
    for (const d of REBUILD_AT) {
      const label = Number.isFinite(d) ? `${String(d).padStart(2)} decimals` : `unrounded`
      say(
        `  rebuilt from ${label.padEnd(12)}: ${rebuiltOff.get(d) ?? 0} of ${kept} land a cent away`,
      )
    }
    say('')
    say('More digits do not help — the rebuild is worse unrounded than at ten. The')
    say('loss is not precision, it is the rebuild itself: base x (1 - d/100) is not')
    say('the price that produced d, and a total sitting exactly on a half-cent falls')
    say('the other way. This is why a quoted price has to be STORED as a price, the')
    say('way a hand-typed one already is and a catalogue one (finding 16) is not.')

    expect(kept, why('LAYER 7 — a hand-typed price after storage')).toBeGreaterThan(15000)
    expect(
      `${priceOff} lost the typed price, ${keptOff} lost the total (worst ${worst})`,
      why('LAYER 7 — a hand-typed price after storage'),
    ).toBe('0 lost the typed price, 0 lost the total (worst 0)')
  })

  it('GUARD: a gross allocation reaches the gross it promised after the lines are stored', () => {
    log.length = 0
    const r = rng(31)
    let tried = 0
    const DIGITS = [10, 12, 14]
    const broken = new Map<number, number>()
    for (let i = 0; i < 4000; i++) {
      const lines: PricingLine[] = Array.from({ length: 1 + Math.floor(r() * 3) }, (_, k) => ({
        id: `l${k}`,
        quantity: 1 + Math.floor(r() * 30),
        unitCost: round2(1 + r() * 200),
        costSource: 'stock',
        marginPercent: roundTo(r() * 40, 4),
        discountPercent: 0,
        manualUnitPrice: null,
        state: 'draft',
        shippedQuantity: 0,
        documentIssued: false,
      }))
      const targetGross = round2(100 + r() * 30000)
      let res
      try {
        res = allocateGrossTotal(lines, targetGross, 'standard', 21)
      } catch {
        continue
      }
      tried++
      for (const digits of DIGITS) {
        const rolled = rollupOrder(
          res.lines.map((l) => store(l, digits)),
          'standard',
          21,
        )
        if (rolled.totalGross !== res.achievedGross) {
          broken.set(digits, (broken.get(digits) ?? 0) + 1)
        }
      }
    }
    say(`gross allocations tried        : ${tried}`)
    for (const d of DIGITS) {
      say(
        `stored at ${String(d).padStart(2)} decimals        : ${broken.get(d) ?? 0} miss the promised gross`,
      )
    }
    say('')
    say(
      `net target check               : grossToNet(100, 21%) = ${grossToNet(100, 'standard', 21)}`,
    )
    say(`roundStored keeps              : ${roundStored(1 / 3)} (10 decimals)`)

    expect(tried, why('LAYER 7 — gross allocation after storage')).toBeGreaterThan(3000)
    expect(
      DIGITS.map((d) => `${d} decimals: ${broken.get(d) ?? 0} misses`).join(' | '),
      why('LAYER 7 — gross allocation after storage'),
    ).toBe(DIGITS.map((d) => `${d} decimals: 0 misses`).join(' | '))
    // The two constants the whole layer rests on — contract §7 says ten decimals.
    expect(grossToNet(100, 'standard', 21), why('LAYER 7 — gross allocation after storage')).toBe(
      82.64,
    )
    expect(roundStored(1 / 3), why('LAYER 7 — gross allocation after storage')).toBe(0.3333333333)
  })
})
