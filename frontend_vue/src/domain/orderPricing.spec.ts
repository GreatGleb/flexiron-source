import { describe, it, expect } from 'vitest'
import {
  type PricingLine,
  type FifoBatch,
  round2,
  formatCents,
  roundStored,
  calcLine,
  applyPriceEdit,
  applyLineTotalEdit,
  applyDiscountEdit,
  applyMarginEdit,
  applyQuantityEdit,
  applyCostChange,
  applyCorrection,
  applyCostCorrection,
  refreshCosts,
  syncLineState,
  validateLine,
  resetLinePrice,
  isPriceLocked,
  isCostFrozen,
  canEditPrice,
  canEditQuantity,
  round4,
  rollupOrder,
  effectiveDiscountPercent,
  grossToNet,
  netToGross,
  achievableGross,
  allocateTotal,
  allocateGrossTotal,
  addLineModes,
  applyOrderTerms,
  splitLine,
  paidPercent,
  outstandingAmount,
  paymentState,
  paymentSummary,
  computeAvailable,
  allocateFifo,
  allocationCost,
} from './orderPricing'

function line(over: Partial<PricingLine> = {}): PricingLine {
  return {
    id: 'l1',
    quantity: 10,
    unitCost: 100,
    costSource: 'stock',
    marginPercent: 20,
    discountPercent: 0,
    manualUnitPrice: null,
    state: 'draft',
    shippedQuantity: 0,
    documentIssued: false,
    ...over,
  }
}

function netOf(lines: PricingLine[]): number {
  return lines.reduce((sum, l) => round2(sum + calcLine(l).lineNet), 0)
}

// ─── Rounding ───────────────────────────────────────────────────────────────

describe('rounding', () => {
  it('rounds half away from zero despite binary representation', () => {
    expect(round2(1.005)).toBe(1.01)
    expect(round2(2.675)).toBe(2.68)
    expect(round2(-1.005)).toBe(-1.01)
  })
})

// ─── Line chain ─────────────────────────────────────────────────────────────

describe('calcLine', () => {
  it('follows cost → margin → discount', () => {
    const totals = calcLine(line({ marginPercent: 20, discountPercent: 10 }))
    expect(totals.basePrice).toBe(120)
    expect(totals.autoUnitPrice).toBe(108)
    expect(totals.lineNet).toBe(1080)
    expect(totals.lineCost).toBe(1000)
    expect(totals.marginAmount).toBe(80)
    expect(totals.actualMarginPercent).toBe(7.4074)
    expect(totals.priceLocked).toBe(false)
  })
})

// ─── Manual edits ───────────────────────────────────────────────────────────

describe('price edit', () => {
  it('down → becomes a discount, planned margin untouched', () => {
    const edited = applyPriceEdit(line(), 108)
    expect(edited.discountPercent).toBe(10)
    expect(edited.marginPercent).toBe(20)
    expect(isPriceLocked(edited)).toBe(true)
    expect(calcLine(edited).lineNet).toBe(1080)
  })

  it('up above the computed price → planned margin grows, no negative discount', () => {
    const edited = applyPriceEdit(line(), 150)
    expect(edited.discountPercent).toBe(0)
    expect(edited.marginPercent).toBe(50)
  })

  it('up clears an existing discount first', () => {
    const edited = applyPriceEdit(line({ discountPercent: 10 }), 150)
    expect(edited.discountPercent).toBe(0)
    expect(edited.marginPercent).toBe(50)
  })

  it('editing the line total is the same edit from the other side', () => {
    const edited = applyLineTotalEdit(line(), 1080)
    expect(edited.discountPercent).toBe(10)
    expect(calcLine(edited).lineNet).toBe(1080)
  })

  it('rejects a negative price', () => {
    expect(() => applyPriceEdit(line(), -1)).toThrow('NEGATIVE_PRICE')
  })

  it('survives zero cost — no margin can be derived, so it is left alone', () => {
    const edited = applyPriceEdit(line({ unitCost: 0 }), 50)
    expect(edited.discountPercent).toBe(0)
    expect(calcLine(edited).lineNet).toBe(500)
  })
})

describe('discount and margin edits', () => {
  it('discount edit locks the price so a later cost change cannot move it', () => {
    const discounted = applyDiscountEdit(line(), 10)
    expect(isPriceLocked(discounted)).toBe(true)
    const afterCost = applyCostChange(discounted, 200)
    expect(calcLine(afterCost).unitPrice).toBe(108)
  })

  it('margin edit reprices the line, releases the lock and keeps the discount', () => {
    const locked = applyPriceEdit(line(), 108) // 10% discount off a base of 120
    const remargined = applyMarginEdit(locked, 50)
    expect(isPriceLocked(remargined)).toBe(false)
    expect(remargined.discountPercent).toBe(10)
    expect(calcLine(remargined).unitPrice).toBe(135) // 100 × 1.5 × 0.9
  })

  it('rejects a discount outside 0..100', () => {
    expect(() => applyDiscountEdit(line(), -5)).toThrow('DISCOUNT_OUT_OF_RANGE')
    expect(() => applyDiscountEdit(line(), 101)).toThrow('DISCOUNT_OUT_OF_RANGE')
  })

  it('reset returns the line to cost + margin, dropping the derived discount', () => {
    const reset = resetLinePrice(applyPriceEdit(line(), 108))
    expect(isPriceLocked(reset)).toBe(false)
    expect(reset.discountPercent).toBe(0)
    expect(calcLine(reset).unitPrice).toBe(120)
  })

  it('reset can re-apply the order default discount', () => {
    const reset = resetLinePrice(applyPriceEdit(line(), 108), 5)
    expect(calcLine(reset).unitPrice).toBe(114) // 100 × 1.2 × 0.95
  })
})

// ─── Display ────────────────────────────────────────────────────────────────

describe('formatting money', () => {
  it('rounds the way the money rounds, which toFixed does not', () => {
    // The reason this function exists: 22.575 is 22.57499… in IEEE-754, so
    // toFixed reports 22.57 while the money is 22.58. Two cells of the same row
    // formatted differently is how a price ends up a cent under its own total.
    expect((22.575).toFixed(2)).toBe('22.57')
    expect(formatCents(22.575)).toBe('22.58')
    expect(formatCents(round2(22.575))).toBe('22.58')
  })

  it('leaves an already-rounded amount exactly as it is', () => {
    for (const value of [0, 0.01, 12, 19000, 22.58, 1664.57, -2547]) {
      expect(formatCents(value)).toBe(value.toFixed(2))
    }
  })

  it('formats a half-cent the same way whether it is multiplied before or after', () => {
    // A picker showing a per-unit price must not multiply the rounded one.
    expect(formatCents(22.575 * 2)).toBe('45.15')
    expect(formatCents(round2(22.575) * 2)).toBe('45.16') // the bug, kept as a warning
  })
})

// ─── A line with no cost is priced, not marked up ───────────────────────────

describe('a line with nothing to mark up', () => {
  // A service whose cost nobody knows: the price is stated outright.
  const priced = () => line({ unitCost: 0, marginPercent: 0, manualUnitPrice: 5 })

  it('is what it says it is', () => {
    expect(calcLine(priced()).unitPrice).toBe(5)
  })

  it('refuses a margin, instead of repricing itself to zero', () => {
    // Any percentage of nothing is nothing — and accepting it would ALSO release
    // the lock, so the 5.00 the client was quoted would silently become 0.00.
    expect(() => applyMarginEdit(priced(), 20)).toThrow('NO_COST_TO_MARK_UP')
    expect(calcLine(priced()).unitPrice).toBe(5)
  })

  it('refuses "back to computed" — there is nothing to compute from', () => {
    expect(() => resetLinePrice(priced())).toThrow('NO_COST_TO_MARK_UP')
  })

  it('is left alone by the order terms instead of blocking every other new line', () => {
    // "With the order's terms" runs over a whole batch of new lines. A costless
    // one has no computed price to discount, so it keeps its stated price rather
    // than taking the others down with it.
    const existing = [applyDiscountEdit(line(), 10)]
    expect(applyOrderTerms(priced(), existing)).toEqual(priced())
    expect(applyOrderTerms(line({ id: 'n' }), existing).discountPercent).toBe(10)
  })

  it('refuses a discount, which is a share OF the computed price', () => {
    // 10% off a computed price of zero is zero: the 5.00 the client was quoted
    // would vanish, and the line would read as a 10% discount on nothing.
    expect(() => applyDiscountEdit(priced(), 10)).toThrow('NO_COST_TO_MARK_UP')
  })

  it('still takes a price and a quantity — that is how such a line is sold', () => {
    expect(calcLine(applyPriceEdit(priced(), 7)).unitPrice).toBe(7)
    expect(calcLine(applyQuantityEdit(priced(), 3)).lineNet).toBe(15)
  })
})

describe('quantity edit', () => {
  it('keeps the price per unit and moves the line total', () => {
    const edited = applyQuantityEdit(applyPriceEdit(line(), 108), 5)
    expect(calcLine(edited).unitPrice).toBe(108)
    expect(calcLine(edited).lineNet).toBe(540)
  })

  it('cannot drop below the shipped quantity', () => {
    const partial = line({ state: 'partially_shipped', shippedQuantity: 6 })
    expect(() => applyQuantityEdit(partial, 4)).toThrow('BELOW_SHIPPED_QUANTITY')
  })
})

// ─── State consistency ──────────────────────────────────────────────────────

describe('line state', () => {
  it('becomes fully shipped when the quantity is cut down to what shipped', () => {
    const partial = line({ state: 'partially_shipped', shippedQuantity: 6 })
    const shrunk = applyQuantityEdit(partial, 6)
    expect(shrunk.state).toBe('shipped')
    // ...and can no longer be grown again through the back door
    expect(() => applyQuantityEdit(shrunk, 10)).toThrow('LINE_FULLY_SHIPPED')
  })

  it('becomes partially shipped when a shipped line is grown', () => {
    const partial = line({ state: 'partially_shipped', shippedQuantity: 6 })
    expect(applyQuantityEdit(partial, 14).state).toBe('partially_shipped')
  })

  it('derives the state purely from the quantities', () => {
    expect(syncLineState(line({ state: 'draft' })).state).toBe('draft')
    expect(syncLineState(line({ state: 'shipped', shippedQuantity: 0 })).state).toBe('draft')
    expect(syncLineState(line({ shippedQuantity: 4 })).state).toBe('partially_shipped')
    expect(syncLineState(line({ shippedQuantity: 10 })).state).toBe('shipped')
  })

  it('accepts every consistent line', () => {
    expect(() => validateLine(line())).not.toThrow()
    expect(() =>
      validateLine(line({ state: 'partially_shipped', shippedQuantity: 6 })),
    ).not.toThrow()
    expect(() => validateLine(line({ state: 'shipped', shippedQuantity: 10 }))).not.toThrow()
  })

  it('rejects lines that cannot exist', () => {
    expect(() => validateLine(line({ quantity: -1 }))).toThrow('negative quantity')
    expect(() => validateLine(line({ unitCost: -1 }))).toThrow('negative cost')
    expect(() => validateLine(line({ manualUnitPrice: -5 }))).toThrow('negative manual price')
    expect(() => validateLine(line({ discountPercent: 120 }))).toThrow('discount out of range')
    expect(() => validateLine(line({ marginPercent: -100 }))).toThrow('margin out of range')
    expect(() => validateLine(line({ shippedQuantity: -1 }))).toThrow('negative shipped quantity')
    expect(() => validateLine(line({ shippedQuantity: 12 }))).toThrow('shipped exceeds ordered')
    expect(() => validateLine(line({ state: 'shipped', shippedQuantity: 0 }))).toThrow(
      'contradicts quantities',
    )
    expect(() => validateLine(line({ state: 'draft', shippedQuantity: 5 }))).toThrow(
      'contradicts quantities',
    )
  })
})

// ─── Freeze guards ──────────────────────────────────────────────────────────

describe('freeze', () => {
  const shipped = line({ state: 'shipped', shippedQuantity: 10 })
  const partial = line({ state: 'partially_shipped', shippedQuantity: 6 })

  it('refuses every price edit on a shipped line', () => {
    expect(() => applyPriceEdit(shipped, 100)).toThrow('PRICE_FROZEN_BY_SHIPMENT')
    expect(() => applyLineTotalEdit(shipped, 1000)).toThrow('PRICE_FROZEN_BY_SHIPMENT')
    expect(() => applyDiscountEdit(shipped, 5)).toThrow('PRICE_FROZEN_BY_SHIPMENT')
    expect(() => applyMarginEdit(shipped, 5)).toThrow('PRICE_FROZEN_BY_SHIPMENT')
    expect(() => resetLinePrice(shipped)).toThrow('PRICE_FROZEN_BY_SHIPMENT')
  })

  it('refuses price edits once part of the line has shipped — split it instead', () => {
    expect(() => applyPriceEdit(partial, 100)).toThrow('PRICE_FROZEN_BY_SHIPMENT')
    expect(canEditPrice(partial)).toBe(false)
  })

  it('lets an explicit correction through — the documented way past the freeze', () => {
    expect(calcLine(applyCorrection(shipped, 100)).unitPrice).toBe(100)
  })

  it('still lets a partially shipped line grow — the rest goes on the next truck', () => {
    expect(canEditQuantity(partial)).toBe(true)
    expect(applyQuantityEdit(partial, 14).quantity).toBe(14)
  })

  it('refuses to grow a fully shipped line', () => {
    expect(canEditQuantity(shipped)).toBe(false)
    expect(() => applyQuantityEdit(shipped, 12)).toThrow('LINE_FULLY_SHIPPED')
  })

  it('freezes a service too, once it is on an invoice the client holds', () => {
    // A service never ships, so without the document flag it would stay editable
    // forever while the goods next to it on the same invoice are frozen.
    const service = line({ state: 'draft', documentIssued: true })
    expect(canEditPrice(service)).toBe(false)
    expect(() => applyPriceEdit(service, 100)).toThrow('PRICE_FROZEN_BY_SHIPMENT')
    expect(() => applyDiscountEdit(service, 5)).toThrow('PRICE_FROZEN_BY_SHIPMENT')
    expect(calcLine(applyCorrection(service, 100)).unitPrice).toBe(100)
  })

  it('leaves an invoiced line out of the total allocation', () => {
    const lines = [
      line({ id: 'invoiced', quantity: 3, unitCost: 100, marginPercent: 0, documentIssued: true }),
      line({ id: 'open', quantity: 7, unitCost: 100, marginPercent: 0 }),
    ]
    const result = allocateTotal(lines, 900)
    expect(result.rows.map((r) => r.lineId)).toEqual(['open'])
    expect(calcLine(result.lines[0]!).lineNet).toBe(300)
  })

  it('a split leaves the remainder off any document', () => {
    const partial = line({ state: 'partially_shipped', shippedQuantity: 6, documentIssued: true })
    expect(splitLine(partial, 6).remainder.documentIssued).toBe(false)
  })
})

// ─── Cost vs price ──────────────────────────────────────────────────────────

describe('cost change', () => {
  it('reprices a draft line whose price was never touched', () => {
    const updated = applyCostChange(line(), 110)
    expect(calcLine(updated).lineNet).toBe(1320)
  })

  it('does not move a locked price — only the actual margin, even into the red', () => {
    const locked = applyPriceEdit(line(), 108)
    const updated = applyCostChange(locked, 110)
    const totals = calcLine(updated)
    expect(totals.lineNet).toBe(1080)
    expect(totals.marginAmount).toBe(-20)
    expect(totals.actualMarginPercent).toBe(-1.8519)
  })

  it('is refused once the line has shipped — never silently ignored', () => {
    const shipped = line({ state: 'shipped', shippedQuantity: 10 })
    expect(() => applyCostChange(shipped, 500)).toThrow('COST_FROZEN_BY_SHIPMENT')
  })

  it('rejects a negative cost', () => {
    expect(() => applyCostChange(line(), -1)).toThrow('NEGATIVE_COST')
  })

  it('is frozen for an invoiced service too — closed profit must not drift', () => {
    const service = line({ state: 'draft', documentIssued: true })
    expect(isCostFrozen(service)).toBe(true)
    expect(() => applyCostChange(service, 50)).toThrow('COST_FROZEN_BY_SHIPMENT')
  })

  it('a correction still cannot make the cost negative', () => {
    expect(() => applyCostCorrection(line(), -1)).toThrow('NEGATIVE_COST')
  })

  it('can be corrected past the freeze when the supplier price was wrong', () => {
    const shipped = line({ state: 'shipped', shippedQuantity: 10, manualUnitPrice: 108 })
    const corrected = applyCostCorrection(shipped, 130)
    const totals = calcLine(corrected)
    expect(totals.unitPrice).toBe(108) // the client price does not move
    expect(totals.marginAmount).toBe(-220) // the margin does
    expect(corrected.costSource).toBe('manual')
  })

  it('holds the client price even on a line that was still computing it', () => {
    // Cost × margin IS the price here, so correcting the cost carried the price
    // with it — and re-billed a client holding the old figure on paper. Section
    // 11.4 says the price does not move, and that has to be made true.
    const computed = line({ state: 'shipped', shippedQuantity: 10, unitCost: 60 })
    expect(calcLine(computed).unitPrice).toBe(72) // 60 + 20%
    const corrected = applyCostCorrection(computed, 75)
    const totals = calcLine(corrected)
    expect(totals.unitPrice).toBe(72)
    expect(totals.lineNet).toBe(720)
    // What absorbs the correction is the margin, which is what it is for.
    expect(totals.marginAmount).toBe(-30)
    expect(corrected.marginPercent).toBe(computed.marginPercent)
  })

  it('a FIFO refresh reprices drafts and steps over frozen lines', () => {
    const lines = [
      line({ id: 'draft' }),
      line({ id: 'shipped', state: 'shipped', shippedQuantity: 10 }),
      line({ id: 'no-data' }),
    ]
    const refreshed = refreshCosts(lines, (l) => (l.id === 'no-data' ? null : 110))

    expect(refreshed[0]!.unitCost).toBe(110)
    expect(refreshed[1]!.unitCost).toBe(100) // frozen, untouched
    expect(refreshed[2]!.unitCost).toBe(100) // no cost available, left alone
    expect(calcLine(refreshed[0]!).lineNet).toBe(1320)
  })
})

// ─── VAT ────────────────────────────────────────────────────────────────────

describe('VAT', () => {
  const lines = [line({ marginPercent: 0, unitCost: 100, quantity: 10 })] // net 1000, cost 1000

  it('is charged on the net price, never on the cost', () => {
    const cheap = [line({ unitCost: 80, marginPercent: 25, quantity: 10 })] // cost 800, net 1000
    const totals = rollupOrder(cheap, 'standard', 21)
    expect(totals.totalNet).toBe(1000)
    expect(totals.totalCost).toBe(800)
    expect(totals.totalVat).toBe(210) // not 168 = 21% of cost
    expect(totals.totalGross).toBe(1210)
    expect(totals.marginAmount).toBe(200)
    expect(totals.actualMarginPercent).toBe(20)
  })

  it('zero-rated modes leave the gross equal to the net', () => {
    for (const mode of ['export_zero', 'reverse_charge', 'exempt'] as const) {
      const totals = rollupOrder(lines, mode, 21)
      expect(totals.vatRate).toBe(0)
      expect(totals.totalVat).toBe(0)
      expect(totals.totalGross).toBe(totals.totalNet)
    }
  })

  it('never touches the margin — that is counted on the net price alone', () => {
    const priced = [line({ unitCost: 80, marginPercent: 25, quantity: 10 })]
    const withVat = rollupOrder(priced, 'standard', 21)
    const zeroRated = rollupOrder(priced, 'export_zero', 21)

    expect(withVat.marginAmount).toBe(zeroRated.marginAmount)
    expect(withVat.actualMarginPercent).toBe(zeroRated.actualMarginPercent)
    expect(withVat.totalNet).toBe(zeroRated.totalNet)
  })

  it('converts between gross and net', () => {
    expect(grossToNet(1210, 'standard', 21)).toBe(1000)
    expect(netToGross(1000, 'standard', 21)).toBe(1210)
    expect(grossToNet(1000, 'export_zero', 21)).toBe(1000)
  })
})

// ─── Total allocation ───────────────────────────────────────────────────────

describe('allocateTotal', () => {
  const threeLines = [
    line({ id: 'a', quantity: 3, unitCost: 100, marginPercent: 0 }), // 300
    line({ id: 'b', quantity: 7, unitCost: 50, marginPercent: 0 }), // 350
    line({ id: 'c', quantity: 1, unitCost: 350.33, marginPercent: 0 }), // 350.33
  ]

  it('sums to the target down to the cent, on awkward numbers', () => {
    for (const target of [1000.01, 999.99, 1000.33, 1, 0.03, 12345.67, 777.77]) {
      const result = allocateTotal(threeLines, target)
      expect(netOf(result.lines)).toBe(target)
    }
  })

  it('preview rows match what the lines actually become', () => {
    const result = allocateTotal(threeLines, 950)
    for (const row of result.rows) {
      const updated = result.lines.find((l) => l.id === row.lineId)!
      expect(calcLine(updated).lineNet).toBe(row.after)
    }
    expect(result.rows.map((r) => r.before)).toEqual([300, 350, 350.33])
  })

  it('records the difference as a discount', () => {
    const result = allocateTotal([line({ marginPercent: 0 })], 900) // net was 1000
    expect(result.lines[0]!.discountPercent).toBe(10)
    expect(result.lines[0]!.marginPercent).toBe(0)
  })

  it('never touches frozen lines', () => {
    const mixed = [
      line({ id: 'shipped', quantity: 3, unitCost: 100, marginPercent: 0, state: 'shipped' }), // 300
      line({ id: 'draft', quantity: 7, unitCost: 100, marginPercent: 0 }), // 700
    ]
    const result = allocateTotal(mixed, 900)
    expect(result.rows.map((r) => r.lineId)).toEqual(['draft'])
    expect(calcLine(result.lines[0]!).lineNet).toBe(300)
    expect(calcLine(result.lines[1]!).lineNet).toBe(600)
  })

  it('a target equal to the frozen part gives the rest away at 100% discount', () => {
    const mixed = [
      line({ id: 'shipped', quantity: 3, unitCost: 100, marginPercent: 0, state: 'shipped' }),
      line({ id: 'draft', quantity: 7, unitCost: 100, marginPercent: 0 }),
    ]
    const result = allocateTotal(mixed, 300)
    expect(netOf(result.lines)).toBe(300)
    expect(result.lines[1]!.discountPercent).toBe(100)
  })

  it('refuses a target below the frozen part instead of going negative', () => {
    const mixed = [
      line({ id: 'shipped', quantity: 3, unitCost: 100, marginPercent: 0, state: 'shipped' }),
      line({ id: 'draft', quantity: 7, unitCost: 100, marginPercent: 0 }),
    ]
    expect(() => allocateTotal(mixed, 200)).toThrow('BELOW_FROZEN_MINIMUM')
  })

  it('refuses when everything is frozen, unless the target already matches', () => {
    const allShipped = [line({ quantity: 3, unitCost: 100, marginPercent: 0, state: 'shipped' })]
    expect(() => allocateTotal(allShipped, 400)).toThrow('NO_EDITABLE_LINES')
    expect(allocateTotal(allShipped, 300).rows).toEqual([])
  })

  it('stays cent-exact on fractional quantities — tonnes and metres, not pieces', () => {
    const metals = [
      line({ id: 'sheet', quantity: 3.75, unitCost: 812.4, marginPercent: 18 }),
      line({ id: 'rebar', quantity: 0.125, unitCost: 0.85, marginPercent: 22 }),
      line({ id: 'pipe', quantity: 12.4, unitCost: 45.9, marginPercent: 15 }),
      line({ id: 'wire', quantity: 1.333, unitCost: 3.5, marginPercent: 30 }),
    ]
    for (const target of [4000, 3999.99, 4123.45, 0.07, 12345.67]) {
      const result = allocateTotal(metals, target)
      expect(netOf(result.lines)).toBe(target)
      for (const row of result.rows) {
        const updated = result.lines.find((l) => l.id === row.lineId)!
        expect(calcLine(updated).lineNet).toBe(row.after)
      }
    }
  })

  it('the discount percent is a rounded readout — the money stays exact', () => {
    const awkward = [line({ id: 'a', quantity: 3, unitCost: 100, marginPercent: 0 })]
    const result = allocateTotal(awkward, 200.01)
    expect(netOf(result.lines)).toBe(200.01)
    // 33.33% is displayed; re-deriving money from that rounded percent would drift
    expect(result.lines[0]!.discountPercent).toBe(33.33)
  })

  it('survives a coil-sized order without losing cents', () => {
    const big = [
      line({ id: 'coil', quantity: 40, unitCost: 4500, marginPercent: 12 }),
      line({ id: 'beam', quantity: 250, unitCost: 580, marginPercent: 15 }),
    ]
    const result = allocateTotal(big, 1234567.89)
    expect(netOf(result.lines)).toBe(1234567.89)
    expect(rollupOrder(result.lines, 'standard', 21).totalGross).toBe(1493827.15)
  })

  it('puts the rounding residual on the largest line, wherever it sits', () => {
    // Deliberately smallest-first: with the big line first, the residual would
    // land on index 0 and this branch would never run.
    const lines = [
      line({ id: 'small', quantity: 1, unitCost: 7.77, marginPercent: 0 }),
      line({ id: 'medium', quantity: 1, unitCost: 13.13, marginPercent: 0 }),
      line({ id: 'large', quantity: 1, unitCost: 979.1, marginPercent: 0 }),
    ]
    const result = allocateTotal(lines, 900.24)
    expect(netOf(result.lines)).toBe(900.24)
    // 6.99 + 11.82 + 881.41 would be 900.22 — the missing cent goes on 'large'
    expect(result.rows.map((r) => [r.lineId, r.after])).toEqual([
      ['small', 6.99],
      ['medium', 11.82],
      ['large', 881.43],
    ])
  })

  it('is idempotent — allocating the same target twice changes nothing', () => {
    const once = allocateTotal(threeLines, 950).lines
    const twice = allocateTotal(once, 950).lines
    expect(netOf(twice)).toBe(950)
    expect(twice.map((l) => calcLine(l).lineNet)).toEqual(once.map((l) => calcLine(l).lineNet))
  })

  it('accepts a gross target and unwraps the VAT first', () => {
    const one = [line({ marginPercent: 0 })] // net 1000
    const result = allocateGrossTotal(one, 1089, 'standard', 21) // net 900
    expect(netOf(result.lines)).toBe(900)
    expect(rollupOrder(result.lines, 'standard', 21).totalGross).toBe(1089)
    expect(result.achievedGross).toBe(1089)
  })

  it('reports the real total when the requested gross is unreachable', () => {
    // With 21% VAT there is no net in whole cents that grosses up to 100.00:
    // 82.64 → 99.99 and 82.65 → 100.01.
    expect(achievableGross(100, 'standard', 21)).toBe(99.99)

    const result = allocateGrossTotal([line({ marginPercent: 0 })], 100, 'standard', 21)
    expect(result.requestedGross).toBe(100)
    expect(result.achievedGross).toBe(99.99)
    expect(rollupOrder(result.lines, 'standard', 21).totalGross).toBe(99.99)
  })

  it('a reachable gross round-trips exactly', () => {
    for (const gross of [1210, 1089, 99.99, 100.01, 12.1]) {
      expect(achievableGross(gross, 'standard', 21)).toBe(gross)
    }
  })

  it('round-tripping a total up and back down lands on the right money', () => {
    const start = [
      line({ id: 'a', quantity: 3, unitCost: 100, marginPercent: 0 }),
      line({ id: 'b', quantity: 7, unitCost: 50, marginPercent: 0 }),
    ] // net 650
    const up = allocateTotal(start, 800).lines
    const down = allocateTotal(up, 650).lines
    expect(netOf(up)).toBe(800)
    expect(netOf(down)).toBe(650)
  })
})

// ─── Effective discount and adding lines ────────────────────────────────────

describe('effective discount', () => {
  it('expresses a manual total edit as one percentage', () => {
    const edited = allocateTotal([line({ marginPercent: 0 })], 950).lines
    expect(effectiveDiscountPercent(edited)).toBe(5)
  })

  it('is zero on an untouched order', () => {
    expect(effectiveDiscountPercent([line()])).toBe(0)
  })

  /**
   * A line priced outright has no computed price to have landed below. Counting
   * its price against a base of zero made one such line say the order gave
   * −97% — and that number is both what the panel shows and what decides
   * whether a new line may inherit the order's terms.
   */
  it('leaves out a line that was priced outright, on both sides of the ratio', () => {
    const goods = line({ unitCost: 8, quantity: 10, marginPercent: 15, discountPercent: 10 })
    const namedPrice = line({ id: 'svc', unitCost: 0, quantity: 1, manualUnitPrice: 99 })

    expect(effectiveDiscountPercent([goods])).toBe(10)
    expect(effectiveDiscountPercent([goods, namedPrice])).toBe(10)
    // And it still counts towards the money — it is only the percentage it
    // takes no part in.
    expect(rollupOrder([goods, namedPrice], 'standard', 21).totalNet).toBe(181.8)
  })

  it('is zero when every line was priced outright', () => {
    const namedPrice = line({ unitCost: 0, manualUnitPrice: 99 })
    expect(effectiveDiscountPercent([namedPrice])).toBe(0)
  })

  it('lets a costless line sit beside goods without hiding the order terms', () => {
    const discounted = line({ unitCost: 8, quantity: 10, discountPercent: 10 })
    const namedPrice = line({ id: 'svc', unitCost: 0, quantity: 1, manualUnitPrice: 99 })
    // The 🔒 that raises the question comes from the costless line; the discount
    // that answers it comes from the goods.
    expect(addLineModes([discounted, namedPrice])).toEqual([
      'order_terms',
      'computed_price',
      'keep_total',
    ])
  })
})

describe('adding a line', () => {
  it('asks nothing when there are no manual prices', () => {
    expect(addLineModes([line()])).toEqual([])
  })

  it('offers order terms first when a discount was given', () => {
    const discounted = allocateTotal([line({ marginPercent: 0 })], 950).lines
    expect(addLineModes(discounted)).toEqual(['order_terms', 'computed_price', 'keep_total'])
  })

  it('drops order terms when the manual price carries no discount', () => {
    const raised = [applyPriceEdit(line(), 150)]
    expect(addLineModes(raised)).toEqual(['computed_price', 'keep_total'])
  })

  it('hides keep_total when nothing is left to redistribute', () => {
    const shipped = [line({ state: 'shipped', manualUnitPrice: 108, discountPercent: 10 })]
    expect(addLineModes(shipped)).toEqual(['order_terms', 'computed_price'])
  })

  it('offers only the computed price when a closed order has no discount', () => {
    const closed = [line({ state: 'shipped', shippedQuantity: 10, manualUnitPrice: 150 })]
    expect(addLineModes(closed)).toEqual(['computed_price'])
  })

  it('order terms on an order without a discount changes nothing', () => {
    const plain = [line()]
    const added = line({ id: 'new' })
    expect(applyOrderTerms(added, plain)).toBe(added)
    expect(applyOrderTerms(added, [])).toBe(added)
  })

  it('inherits the order discount onto the new line', () => {
    const existing = allocateTotal([line({ marginPercent: 0 })], 950).lines
    const added = applyOrderTerms(line({ id: 'new', quantity: 5 }), existing)
    expect(added.discountPercent).toBe(5)
    expect(calcLine(added).lineNet).toBe(570) // 5 × 120 × 0.95
  })
})

// ─── Splitting ──────────────────────────────────────────────────────────────

describe('splitLine', () => {
  it('splits into the shipped part and a free remainder', () => {
    const { shipped, remainder } = splitLine(applyPriceEdit(line(), 108), 6)
    expect(shipped.quantity).toBe(6)
    expect(shipped.shippedQuantity).toBe(6)
    expect(shipped.state).toBe('shipped')
    expect(remainder.quantity).toBe(4)
    expect(remainder.state).toBe('draft')
    expect(calcLine({ ...remainder, id: 'r' }).unitPrice).toBe(108)
  })

  it('rejects a split that is not a split', () => {
    expect(() => splitLine(line(), 0)).toThrow('INVALID_SPLIT_QUANTITY')
    expect(() => splitLine(line(), 10)).toThrow('INVALID_SPLIT_QUANTITY')
  })

  it('leaves the remainder as a plain draft — a reservation is its own record', () => {
    const { remainder } = splitLine(line({ state: 'partially_shipped', shippedQuantity: 6 }), 6)
    expect(remainder.state).toBe('draft')
    expect(remainder.shippedQuantity).toBe(0)
  })

  it('gives the remainder a quantity, not a float artefact', () => {
    // 396.1 − 237.66 is 158.44000000000003 in IEEE-754, and this number gets
    // written off the warehouse and shown to the admin.
    const { shipped, remainder } = splitLine(
      line({ quantity: 396.1, state: 'partially_shipped', shippedQuantity: 237.66 }),
      237.66,
    )
    expect(remainder.quantity).toBe(158.44)
    expect(round2(shipped.quantity + remainder.quantity)).toBe(396.1)
  })
})

// ─── Payments ───────────────────────────────────────────────────────────────

describe('payments', () => {
  it('the advance percentage falls by itself when the order grows', () => {
    expect(paidPercent(10000, [2500])).toBe(25)
    expect(paidPercent(12000, [2500])).toBe(20.83)
    expect(outstandingAmount(12000, [2500])).toBe(9500)
  })

  it('sums several payments and survives a zero total', () => {
    expect(paidPercent(1000, [250, 250, 500])).toBe(100)
    expect(paidPercent(0, [100])).toBe(0)
  })

  it('an unpaid order owes the whole amount', () => {
    expect(paidPercent(1000, [])).toBe(0)
    expect(outstandingAmount(1000, [])).toBe(1000)
  })

  it('shows an overpayment rather than clamping it away', () => {
    // Paid in full, then the price was lowered — the money has to go back.
    expect(paidPercent(900, [1000])).toBe(111.11)
    expect(outstandingAmount(900, [1000])).toBe(-100)
  })

  it('derives the state from the records, and a cent is not a debt', () => {
    expect(paymentState(1000, [])).toBe('unpaid')
    expect(paymentState(1000, [250])).toBe('partial')
    expect(paymentState(1000, [250, 750])).toBe('paid')
    expect(paymentState(1000, [1200])).toBe('overpaid')
    // Rounding leftovers are not an unpaid order: the client has settled.
    expect(paymentState(1000, [999.996])).toBe('paid')
    expect(paymentState(1000, [1000.004])).toBe('paid')
    // An order with no lines yet is unpaid, not paid — there is nothing to cover.
    expect(paymentState(0, [])).toBe('unpaid')
    // Money against an empty order still has to go back.
    expect(paymentState(0, [100])).toBe('overpaid')
    // A refund that undoes the whole advance leaves the order unpaid again.
    expect(paymentState(1000, [500, -500])).toBe('unpaid')
  })

  it('negative money survives every rounding path', () => {
    // A refund and a correcting invoice are the first negative amounts in the
    // system, and every helper here was written for money coming in.
    expect(round2(-22.575)).toBe(-22.58)
    expect(formatCents(-22.575)).toBe('-22.58')
    // Not "-0.00": a rounded-away cent is nothing, and a minus in front of nothing
    // reads as money owed.
    expect(formatCents(-0.004)).toBe('0.00')
    // A withdrawal of a document is its mirror image, VAT included.
    expect(netToGross(-1900.08, 'standard', 21)).toBe(-2299.1)
    expect(grossToNet(-2299.1, 'standard', 21)).toBe(-1900.08)
    expect(round2(netToGross(-1000, 'standard', 21) - -1000)).toBe(-210)
  })

  it('the same order goes from paid to partial when a line is added', () => {
    // The whole point of not storing the percentage: these are the same records.
    expect(paymentSummary(2500, [2500])).toEqual({
      paidAmount: 2500,
      paidPercent: 100,
      outstanding: 0,
      state: 'paid',
    })
    expect(paymentSummary(4500, [2500])).toEqual({
      paidAmount: 2500,
      paidPercent: 55.56,
      outstanding: 2000,
      state: 'partial',
    })
  })
})

// ─── What must be refused ───────────────────────────────────────────────────

describe('rejected input', () => {
  it('quantity cannot go negative', () => {
    expect(() => applyQuantityEdit(line(), -1)).toThrow('NEGATIVE_QUANTITY')
  })

  it('a line total cannot be edited when there is no quantity to divide by', () => {
    expect(() => applyLineTotalEdit(line({ quantity: 0 }), 100)).toThrow('ZERO_QUANTITY')
  })

  it('a negative margin is allowed — selling below cost is a real deal', () => {
    const loss = applyMarginEdit(line(), -20)
    const totals = calcLine(loss)
    expect(totals.unitPrice).toBe(80)
    expect(totals.marginAmount).toBe(-200)
    expect(totals.actualMarginPercent).toBe(-25)
  })

  it('but a margin at or below −100% would make the price zero or negative', () => {
    expect(() => applyMarginEdit(line(), -100)).toThrow('MARGIN_OUT_OF_RANGE')
    expect(() => applyMarginEdit(line(), -150)).toThrow('MARGIN_OUT_OF_RANGE')
  })

  it('a negative order total is refused', () => {
    expect(() => allocateTotal([line()], -1)).toThrow('NEGATIVE_TARGET')
  })

  it('a target cannot be spread over lines that are all worth nothing', () => {
    const free = [line({ unitCost: 0, marginPercent: 0 })]
    expect(() => allocateTotal(free, 500)).toThrow('ZERO_BASE_TOTAL')
  })

  it('cost is frozen by a partial shipment too, not only by a full one', () => {
    const partial = line({ state: 'partially_shipped', shippedQuantity: 6 })
    expect(isCostFrozen(partial)).toBe(true)
    expect(() => applyCostChange(partial, 500)).toThrow('COST_FROZEN_BY_SHIPMENT')
  })

  it('a split needs a real quantity on both sides', () => {
    expect(() => splitLine(line(), -1)).toThrow('INVALID_SPLIT_QUANTITY')
    expect(() => splitLine(line(), 11)).toThrow('INVALID_SPLIT_QUANTITY')
  })

  it('a split must land exactly on what already shipped, or goods go missing', () => {
    const partial = line({ state: 'partially_shipped', shippedQuantity: 6 })
    expect(() => splitLine(partial, 4)).toThrow('SPLIT_MUST_MATCH_SHIPPED')
    expect(() => splitLine(partial, 8)).toThrow('SPLIT_MUST_MATCH_SHIPPED')
    expect(splitLine(partial, 6).shipped.quantity).toBe(6)
  })

  it('a VAT rate that would divide by zero is refused', () => {
    expect(() => grossToNet(100, 'standard', -100)).toThrow('INVALID_VAT_RATE')
  })

  it('a nonsensical payment base does not produce a percentage', () => {
    expect(paidPercent(-100, [50])).toBe(0)
  })

  it('a FIFO request for nothing takes nothing', () => {
    expect(allocateFifo([], -5).allocations).toEqual([])
    expect(allocateFifo([], -5).shortageQuantity).toBe(0)
  })

  it('rounding survives non-finite input instead of spreading NaN', () => {
    expect(round2(Number.NaN)).toBe(0)
    expect(round2(Number.POSITIVE_INFINITY)).toBe(0)
    expect(round4(Number.NaN)).toBe(0)
  })
})

// ─── Empty order ────────────────────────────────────────────────────────────

describe('empty order', () => {
  it('rolls up to zeros rather than NaN', () => {
    const totals = rollupOrder([], 'standard', 21)
    expect(totals).toMatchObject({
      totalCost: 0,
      totalNet: 0,
      totalVat: 0,
      totalGross: 0,
      marginAmount: 0,
      actualMarginPercent: 0,
      effectiveDiscountPercent: 0,
    })
  })

  it('has no discount and asks nothing when a line is added', () => {
    expect(effectiveDiscountPercent([])).toBe(0)
    expect(addLineModes([])).toEqual([])
  })
})

// ─── Purity ─────────────────────────────────────────────────────────────────

describe('purity', () => {
  it('edits never mutate the line they are given', () => {
    const original = line()
    const snapshot = { ...original }

    applyPriceEdit(original, 108)
    applyDiscountEdit(original, 10)
    applyMarginEdit(original, 50)
    applyQuantityEdit(original, 5)
    applyCostChange(original, 200)
    resetLinePrice(original)
    splitLine(original, 6)

    expect(original).toEqual(snapshot)
  })

  it('allocation never mutates the array or the lines it is given', () => {
    const lines = [
      line({ id: 'a', quantity: 3, unitCost: 100, marginPercent: 0 }),
      line({ id: 'b', quantity: 7, unitCost: 50, marginPercent: 0 }),
    ]
    const snapshot = lines.map((l) => ({ ...l }))

    allocateTotal(lines, 500)

    expect(lines).toEqual(snapshot)
  })

  it('FIFO never reorders the caller’s batch array', () => {
    const batches: FifoBatch[] = [
      {
        batchId: 'new',
        receivedAt: '2026-03-01',
        availableQuantity: 5,
        unitCost: 110,
        currency: 'EUR',
      },
      {
        batchId: 'old',
        receivedAt: '2026-01-01',
        availableQuantity: 5,
        unitCost: 100,
        currency: 'EUR',
      },
    ]

    allocateFifo(batches, 8)

    expect(batches.map((b) => b.batchId)).toEqual(['new', 'old'])
  })
})

// ─── The whole deal, end to end ─────────────────────────────────────────────

describe('the documented deal: 10 t, 25% advance, two trucks', () => {
  it('holds together across every step', () => {
    // 1. Order created — 10 t at cost 100, margin 20%.
    let lines = [line({ id: 'steel', quantity: 10, unitCost: 100, marginPercent: 20 })]
    expect(rollupOrder(lines, 'standard', 21).totalGross).toBe(1452)

    // 2. Negotiated down to 1100 including VAT.
    const negotiated = allocateGrossTotal(lines, 1100, 'standard', 21)
    lines = negotiated.lines
    expect(negotiated.achievedGross).toBe(1100)
    expect(rollupOrder(lines, 'standard', 21).totalNet).toBe(909.09)
    expect(effectiveDiscountPercent(lines)).toBe(24.2425)

    // 3. Advance of 275 — a quarter of the deal. Nothing to do with the warehouse.
    expect(paidPercent(1100, [275])).toBe(25)

    // 4. First truck takes 6 t. The line splits; the money must not move a cent.
    const { shipped, remainder } = splitLine(lines[0]!, 6)
    lines = [shipped, { ...remainder, id: 'steel-rest' }]
    expect(calcLine(shipped).lineNet).toBe(545.45)
    expect(calcLine(lines[1]!).lineNet).toBe(363.64)
    expect(rollupOrder(lines, 'standard', 21).totalNet).toBe(909.09)
    expect(canEditPrice(shipped)).toBe(false)
    expect(canEditPrice(lines[1]!)).toBe(true)

    // 5. The client asks for 2 t more, on the same terms as the rest of the deal.
    const extra = applyOrderTerms(
      line({ id: 'extra', quantity: 2, unitCost: 100, marginPercent: 20 }),
      lines,
    )
    lines = [...lines, extra]
    expect(calcLine(extra).lineNet).toBe(181.82)

    const totals = rollupOrder(lines, 'standard', 21)
    expect(totals.totalNet).toBe(1090.91)
    expect(totals.totalGross).toBe(1320)

    // 6. The advance percentage falls on its own — nobody edits it.
    expect(paidPercent(totals.totalGross, [275])).toBe(20.83)
    expect(outstandingAmount(totals.totalGross, [275])).toBe(1045)

    // 7. Every line is still a line that can exist.
    lines.forEach((l) => expect(() => validateLine(l)).not.toThrow())
  })
})

// ─── FIFO ───────────────────────────────────────────────────────────────────

describe('allocateFifo', () => {
  function batch(over: Partial<FifoBatch> = {}): FifoBatch {
    return {
      batchId: 'b',
      receivedAt: '2026-01-01',
      availableQuantity: 10,
      unitCost: 100,
      currency: 'EUR',
      ...over,
    }
  }

  it('takes the oldest batches first and reports which ones', () => {
    const batches = [
      batch({ batchId: 'new', receivedAt: '2026-03-01', availableQuantity: 10, unitCost: 110 }),
      batch({ batchId: 'old', receivedAt: '2026-02-01', availableQuantity: 4, unitCost: 100 }),
    ]
    const result = allocateFifo(batches, 8)
    expect(result.allocations.map((a) => [a.batchId, a.quantity])).toEqual([
      ['old', 4],
      ['new', 4],
    ])
    expect(result.shortageQuantity).toBe(0)
    expect(result.weightedUnitCost).toBe(105)
    expect(allocationCost(result.allocations)).toBe(840)
  })

  it('skips what another order already reserved', () => {
    const batches = [
      batch({ batchId: 'reserved', receivedAt: '2026-01-01', availableQuantity: 0, unitCost: 50 }),
      batch({ batchId: 'free', receivedAt: '2026-02-01', availableQuantity: 10, unitCost: 100 }),
    ]
    const result = allocateFifo(batches, 5)
    expect(result.allocations.map((a) => a.batchId)).toEqual(['free'])
    expect(result.weightedUnitCost).toBe(100)
  })

  it('reports a shortage instead of quietly pricing it at an average', () => {
    const result = allocateFifo([batch({ availableQuantity: 4 })], 10)
    expect(result.allocations[0]!.quantity).toBe(4)
    expect(result.shortageQuantity).toBe(6)
    expect(result.weightedUnitCost).toBe(100)
  })

  it('carries the batch currency through without converting it', () => {
    // Currencies coexist and nothing multiplies between them (contract §7.1):
    // the currency says what the number is expressed in, and the number itself
    // travels untouched. This check used to assert the opposite — 100 USD
    // arriving as 92 — through a conversion that was never once reached with a
    // rate other than 1.
    const result = allocateFifo([batch({ unitCost: 100, currency: 'USD' })], 5)
    expect(result.allocations[0]!.unitCost).toBe(100)
    expect(result.allocations[0]!.currency).toBe('USD')
    expect(result.weightedUnitCost).toBe(100)
  })

  it('handles an empty warehouse and a zero request', () => {
    expect(allocateFifo([], 5).shortageQuantity).toBe(5)
    expect(allocateFifo([batch()], 0).allocations).toEqual([])
  })

  it('works in tonnes and metres, not only whole pieces', () => {
    const batches = [
      batch({ batchId: 'b1', receivedAt: '2026-01-01', availableQuantity: 3.75, unitCost: 812.4 }),
      batch({ batchId: 'b2', receivedAt: '2026-02-01', availableQuantity: 8.25, unitCost: 798.15 }),
    ]
    const result = allocateFifo(batches, 6.4)
    expect(result.allocations.map((a) => [a.batchId, a.quantity])).toEqual([
      ['b1', 3.75],
      ['b2', 2.65],
    ])
    expect(result.shortageQuantity).toBe(0)
    expect(allocationCost(result.allocations)).toBe(5161.6) // 3046.50 + 2115.0975
  })

  it('stops as soon as the quantity is covered, leaving later batches alone', () => {
    const batches = [
      batch({ batchId: 'b1', receivedAt: '2026-01-01', availableQuantity: 5 }),
      batch({ batchId: 'b2', receivedAt: '2026-02-01', availableQuantity: 5 }),
      batch({ batchId: 'b3', receivedAt: '2026-03-01', availableQuantity: 5 }),
    ]
    expect(allocateFifo(batches, 7).allocations.map((a) => a.batchId)).toEqual(['b1', 'b2'])
  })

  it('does not invent a shortage out of float dust when the batch fits exactly', () => {
    const result = allocateFifo([batch({ availableQuantity: 0.3 })], 0.1 + 0.2)
    expect(result.shortageQuantity).toBe(0)
  })

  it('available quantity nets out reservations', () => {
    expect(computeAvailable(10, 6)).toBe(4)
    expect(computeAvailable(10, 12)).toBe(0)
  })
})

// ─── Stored percentages must rebuild the money they came from ───────────────

describe('storage precision', () => {
  it('a price edit and a reset round-trip without moving the money', () => {
    // The margin derived from a price rise is stored and used again on reset, so
    // rounding it to two decimals would quietly change the line total.
    const raised = applyPriceEdit(line({ unitCost: 90, marginPercent: 0 }), 120)
    expect(calcLine(raised).lineNet).toBe(1200)

    const reset = resetLinePrice(raised)
    expect(calcLine(reset).unitPrice).toBe(120)
    expect(calcLine(reset).lineNet).toBe(1200)
  })

  it('holds on awkward costs, not just round ones', () => {
    for (const [cost, price] of [
      [0.85, 1.2],
      [812.4, 1000],
      [3, 7],
      [4500, 5200],
    ] as Array<[number, number]>) {
      const raised = applyPriceEdit(line({ quantity: 1, unitCost: cost, marginPercent: 0 }), price)
      expect(calcLine(resetLinePrice(raised)).lineNet).toBe(round2(price))
    }
  })

  it('keeps float dust out of the stored percentages', () => {
    expect(applyPriceEdit(line(), 150).marginPercent).toBe(50)
    expect(applyPriceEdit(line(), 108).discountPercent).toBe(10)
    expect(roundStored(19.999999999999996)).toBe(20)
  })
})

describe('splitLine — разрез, у которого нет остатка в деньгах', () => {
  /**
   * `cutIsReal` выключает вычисление цены остатка. Ветка «выключено» не
   * исполнялась ни разу, а достижима она законным заказом: строка, отданная со
   * 100 % скидкой (`discountPercent: 100` контроль пропускает — бросает он на
   * `> 100`), даёт делитель ноль. Без этой ветки в остаток попал бы Infinity
   * или NaN и уехал бы в хранилище как цена.
   */
  it('строка со скидкой 100 % делится, не порождая Infinity в цене остатка', () => {
    const free = line({ discountPercent: 100 })
    const { shipped, remainder } = splitLine(free, 6)

    expect(shipped.quantity).toBe(6)
    expect(remainder.quantity).toBe(4)
    // Цена остатка НАСЛЕДУЕТСЯ, а не вычисляется: вычисление здесь — деление на ноль.
    expect(remainder.manualUnitPrice).toBe(free.manualUnitPrice)
    expect(remainder.priceFollowsCost).toBe(free.priceFollowsCost)
    expect(Number.isFinite(remainder.manualUnitPrice ?? 0)).toBe(true)
    // И обе половины по-прежнему бесплатны — скидка не потерялась при разрезе.
    expect(calcLine(shipped).lineNet).toBe(0)
    expect(calcLine({ ...remainder, id: 'l2' }).lineNet).toBe(0)
  })

  it('остаток схлопнулся округлением — цена тоже наследуется, а не делится на ноль', () => {
    // Контроль пропускает `shippedQuantity < quantity`, но разница меньше
    // микроединицы после `roundTo(..., 6)` становится нулём. Делить на него нельзя.
    const { remainder } = splitLine(line({ quantity: 10 }), 10 - 1e-9)
    expect(remainder.quantity).toBe(0)
    expect(remainder.manualUnitPrice).toBe(null)
    expect(Number.isNaN(remainder.manualUnitPrice ?? 0)).toBe(false)
  })
})
