/**
 * Randomised invariant search over the pricing domain, kept as an acceptance
 * criterion rather than a report.
 *
 * The first `it` is a guard: ~60 000 random cases across every edit, rollup, VAT
 * conversion and payment, all of which already hold. The second states the one
 * invariant that does not — splitting a line must not move money.
 */
import { describe, it, expect } from 'vitest'
import {
  type PricingLine,
  calcLine,
  round2,
  round4,
  rollupOrder,
  allocateTotal,
  allocateGrossTotal,
  applyPriceEdit,
  applyDiscountEdit,
  applyMarginEdit,
  applyLineTotalEdit,
  applyCostCorrection,
  resetLinePrice,
  splitLine,
  effectiveDiscountPercent,
  grossToNet,
  netToGross,
  achievableGross,
  isAllocatable,
  paymentSummary,
} from '@/domain/orderPricing'

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A plausible line: money-shaped costs, ordinary margins, ordinary quantities. */
function randomLine(r: () => number, id: string): PricingLine {
  const costless = r() < 0.2
  const unitCost = costless ? 0 : round2(0.01 + r() * 500)
  const quantity = r() < 0.5 ? 1 + Math.floor(r() * 200) : round2(0.1 + r() * 500)
  const marginPercent = costless ? 0 : round4(-40 + r() * 200)
  const discountPercent = r() < 0.4 ? round4(r() * 60) : 0
  const manual = costless || r() < 0.3 ? round2(0.01 + r() * 900) : null
  return {
    id,
    quantity,
    unitCost,
    costSource: 'stock',
    marginPercent,
    discountPercent: manual !== null && costless ? 0 : discountPercent,
    manualUnitPrice: manual,
    state: 'draft',
    shippedQuantity: 0,
    documentIssued: false,
  }
}

describe('domain invariants under random input', () => {
  it('GUARD: holds for 20 000 random lines and 4 000 random orders', () => {
    const problems: string[] = []
    const check = (ok: boolean, message: string) => {
      if (!ok && problems.length < 25) problems.push(message)
    }
    const r = rng(20260808)
    let lineCases = 0

    for (let i = 0; i < 20000; i++) {
      const line = randomLine(r, `L${i}`)
      const t = calcLine(line)
      lineCases++

      // 1. The line total never disagrees with the shown unit price by more than
      //    the rounding of one unit price.
      const shownProduct = round2(t.unitPrice * line.quantity)
      if (Math.abs(shownProduct - t.lineNet) > 0.005 * Math.max(1, line.quantity)) {
        check(
          false,
          `#${i} shown price ${t.unitPrice} x ${line.quantity} = ${shownProduct} vs net ${t.lineNet}`,
        )
      }
      // 2. Margin amount = net − cost.
      check(t.marginAmount === round2(t.lineNet - t.lineCost), `#${i} marginAmount != net-cost`)

      // 3. A price edit lands on exactly the price asked for.
      if (line.quantity > 0) {
        const p = round2(0.01 + r() * 900)
        const edited = applyPriceEdit(line, p)
        check(
          calcLine(edited).lineNet === round2(p * line.quantity),
          `#${i} price edit to ${p} gives net ${calcLine(edited).lineNet} not ${round2(p * line.quantity)}`,
        )
        // …and the stored discount/margin rebuild that same price.
        check(round4(edited.manualUnitPrice!) === round4(p), `#${i} price edit lost the price`)
      }

      // 4. A line-total edit lands on exactly that total.
      if (line.quantity > 0) {
        const target = round2(1 + r() * 90000)
        const edited = applyLineTotalEdit(line, target)
        check(
          calcLine(edited).lineNet === target,
          `#${i} lineTotal edit to ${target} gives ${calcLine(edited).lineNet}`,
        )
      }

      // 5. A discount edit produces base*(1-d) exactly.
      if (line.unitCost > 0) {
        const d = round4(r() * 90)
        const edited = applyDiscountEdit(line, d)
        const expected = round2(
          line.unitCost * (1 + line.marginPercent / 100) * (1 - d / 100) * line.quantity,
        )
        check(
          calcLine(edited).lineNet === expected,
          `#${i} discount ${d} gives ${calcLine(edited).lineNet} not ${expected}`,
        )
      }

      // 6. A margin edit unlocks the price and produces cost*(1+m)*(1-disc).
      if (line.unitCost > 0) {
        const m = round4(-50 + r() * 200)
        const edited = applyMarginEdit(line, m)
        check(edited.manualUnitPrice === null, `#${i} margin edit kept the lock`)
        const expected = round2(
          line.unitCost * (1 + m / 100) * (1 - line.discountPercent / 100) * line.quantity,
        )
        check(
          calcLine(edited).lineNet === expected,
          `#${i} margin ${m} gives ${calcLine(edited).lineNet} not ${expected}`,
        )
      }

      // 7. Reset goes back to cost + margin, with the order default discount.
      if (line.unitCost > 0) {
        const dd = round4(r() * 30)
        const reset = resetLinePrice(line, dd)
        const expected = round2(
          line.unitCost * (1 + line.marginPercent / 100) * (1 - dd / 100) * line.quantity,
        )
        check(
          calcLine(reset).lineNet === expected,
          `#${i} reset gives ${calcLine(reset).lineNet} not ${expected}`,
        )
      }

      // 8. Correcting the cost must not move the client price.
      {
        const before = calcLine(line)
        const after = calcLine(applyCostCorrection(line, round2(r() * 400)))
        check(
          after.lineNet === before.lineNet,
          `#${i} cost correction moved the price ${before.lineNet}->${after.lineNet}`,
        )
      }

      // 9. Splitting must not create or destroy quantity. (The money it moves is
      //    the next test — it is a finding, not a guard.)
      if (line.quantity > 1) {
        const cut = round2(
          Math.max(0.01, Math.min(line.quantity - 0.01, line.quantity * (0.1 + r() * 0.8))),
        )
        if (cut > 0 && cut < line.quantity) {
          const s = splitLine(line, cut)
          check(
            round2(s.shipped.quantity + s.remainder.quantity) === round2(line.quantity),
            `#${i} split lost quantity ${line.quantity} -> ${s.shipped.quantity}+${s.remainder.quantity}`,
          )
        }
      }
    }

    // ── Orders ──
    let orderCases = 0
    for (let o = 0; o < 4000; o++) {
      const count = 1 + Math.floor(r() * 5)
      const lines = Array.from({ length: count }, (_, k) => randomLine(r, `o${o}l${k}`))
      const vatPercent = 21
      const rolled = rollupOrder(lines, 'standard', vatPercent)
      orderCases++

      // 10. Total = sum of lines, to the cent.
      const sum = lines.reduce((s, l) => round2(s + calcLine(l).lineNet), 0)
      check(rolled.totalNet === sum, `order#${o} total ${rolled.totalNet} != sum ${sum}`)
      check(
        rolled.totalGross === round2(rolled.totalNet + rolled.totalVat),
        `order#${o} gross != net+vat`,
      )
      check(rolled.totalVat === round2(rolled.totalNet * 0.21), `order#${o} vat wrong`)

      // 11. The effective discount is a share, never absurd.
      const eff = effectiveDiscountPercent(lines)
      check(eff <= 100.0001, `order#${o} effective discount ${eff} > 100%`)

      // 12. Spreading a target lands on it EXACTLY.
      const allocatable = lines.filter(isAllocatable)
      const frozenNet = 0
      if (allocatable.length > 0 && lines.some((l) => calcLine(l).lineNet !== 0)) {
        const target = round2(1 + r() * 200000)
        try {
          const res = allocateTotal(lines, target)
          const after = res.lines.reduce((s, l) => round2(s + calcLine(l).lineNet), 0)
          check(
            after === target,
            `order#${o} allocate ${target} landed on ${after} (${lines.length} lines)`,
          )
          check(
            res.rows.reduce((s, x) => round2(s + x.after), frozenNet) === target,
            `order#${o} allocate rows do not sum to ${target}`,
          )
        } catch (e) {
          const msg = String(e)
          check(
            /ZERO_BASE_TOTAL|BELOW_FROZEN_MINIMUM|NO_EDITABLE_LINES|NEGATIVE_TARGET/.test(msg),
            `order#${o} allocate threw ${msg}`,
          )
        }
      }

      // 13. A gross target reports the gross it will really reach.
      if (allocatable.length > 0 && lines.some((l) => calcLine(l).lineNet !== 0)) {
        const targetGross = round2(1 + r() * 200000)
        try {
          const res = allocateGrossTotal(lines, targetGross, 'standard', vatPercent)
          const after = rollupOrder(res.lines, 'standard', vatPercent)
          check(
            after.totalGross === res.achievedGross,
            `order#${o} gross allocate promised ${res.achievedGross}, got ${after.totalGross}`,
          )
        } catch {
          /* covered above */
        }
      }
    }

    // ── VAT conversions ──
    let vatCases = 0
    for (let i = 0; i < 20000; i++) {
      const gross = round2(0.01 + r() * 500000)
      const net = grossToNet(gross, 'standard', 21)
      const back = netToGross(net, 'standard', 21)
      vatCases++
      check(back === achievableGross(gross, 'standard', 21), `vat roundtrip mismatch at ${gross}`)
      check(Math.abs(back - gross) <= 0.0101, `vat roundtrip moved ${gross} -> ${back}`)
    }

    // ── Payments ──
    let paymentCases = 0
    for (let i = 0; i < 10000; i++) {
      const total = round2(r() * 100000)
      const pays = Array.from({ length: Math.floor(r() * 4) }, () => round2(-500 + r() * 40000))
      const s = paymentSummary(total, pays)
      paymentCases++
      check(s.paidAmount === round2(pays.reduce((a, b) => a + b, 0)), `payments sum wrong at ${i}`)
      check(s.outstanding === round2(total - s.paidAmount), `outstanding wrong at ${i}`)
    }

    // A guard that stopped generating cases would pass by saying nothing.
    expect(
      `${lineCases} lines, ${orderCases} orders, ${vatCases} vat, ${paymentCases} payments`,
    ).toBe('20000 lines, 4000 orders, 20000 vat, 10000 payments')
    expect(problems.join('\n')).toBe('')
  })

  it('splitting a line moves no money: the pieces still sum to the line', () => {
    const r = rng(20260808)
    let tried = 0
    let moved = 0
    let shippedMoved = 0
    let worst = 0
    const samples: string[] = []

    for (let i = 0; i < 20000; i++) {
      const line = randomLine(r, `S${i}`)
      if (line.quantity <= 1) continue
      const cut = round2(
        Math.max(0.01, Math.min(line.quantity - 0.01, line.quantity * (0.1 + r() * 0.8))),
      )
      if (cut <= 0 || cut >= line.quantity) continue

      const s = splitLine(line, cut)
      const remainder: PricingLine = { ...s.remainder, id: 'rem' }
      tried++

      const before = calcLine(line).lineNet
      const after = round2(calcLine(s.shipped).lineNet + calcLine(remainder).lineNet)
      if (after !== before) {
        moved++
        worst = Math.max(worst, Math.abs(round2(after - before)))
        if (samples.length < 5)
          samples.push(`qty ${line.quantity} cut ${cut}: ${before} -> ${after}`)
      }

      // The shipped piece is the one that left on a waybill: its money is the
      // line priced at the shipped quantity, and the residual belongs to the
      // remainder — the same rule allocateTotal already follows.
      const shippedAlone = calcLine({ ...line, quantity: cut }).lineNet
      if (calcLine(s.shipped).lineNet !== shippedAlone) {
        shippedMoved++
        if (samples.length < 8) {
          samples.push(
            `qty ${line.quantity} cut ${cut}: shipped piece ${calcLine(s.shipped).lineNet}, alone it is ${shippedAlone}`,
          )
        }
      }
    }

    const narrative =
      `\n=== SPLIT — money conservation ===\n` +
      `splits tried                   : ${tried}\n` +
      `pieces do not sum to the line  : ${moved} (${((moved / tried) * 100).toFixed(1)}%)\n` +
      `shipped piece repriced         : ${shippedMoved}\n` +
      `worst gap                      : ${worst}\n` +
      samples.join('\n') +
      `\n\nround2 is applied to each piece instead of to the line, so the two halves\n` +
      `of a cent can round the same way twice. The remainder is the piece that has\n` +
      `not been on a document yet — the residual belongs there.\n`

    expect(tried, narrative).toBeGreaterThan(15000)
    expect(
      `${moved} splits moved money, ${shippedMoved} repriced the shipped piece (worst ${worst})`,
      narrative,
    ).toBe('0 splits moved money, 0 repriced the shipped piece (worst 0)')
  })
})
