/**
 * Order pricing — pure business logic, no Vue and no API.
 *
 * Model: roo_code/plans/orders/order-pricing-model.md
 *
 * Core rule: cost is a fact about the warehouse, price is a commitment to the
 * client, and margin is the shock absorber between them. Cost and price never
 * recalculate each other — any change is absorbed by margin.
 *
 * Chain inside a line:  cost → + planned margin → − discount → client price
 * VAT is always the last step and always on the net price.
 */

// ─── Enums ──────────────────────────────────────────────────────────────────

/** VAT treatment of the whole order. Zero rates need a legal basis on the invoice. */
export type VatMode =
  | 'standard' // 21% (or whatever settings say)
  | 'export_zero' // 0% — export outside the EU
  | 'reverse_charge' // 0% — EU client with a valid VAT code
  | 'exempt' // not taxable

/** Where the cost figure came from — visible in reports. */
export type CostSource = 'stock' | 'manual' | 'estimate'

/**
 * Line lifecycle — purely how far the goods have gone, derived from the
 * quantities. Editability is driven by this, NOT by the order status, and
 * payment never freezes anything (payments belong to the order, not to lines).
 *
 * Reservation is deliberately absent: it lives in its own records, because a
 * line can be partially shipped AND have its remainder reserved at the same
 * time. One enum cannot say both, and storing it twice guarantees a mismatch.
 */
export type LineState = 'draft' | 'partially_shipped' | 'shipped'

// ─── Line ───────────────────────────────────────────────────────────────────

/**
 * Pricing-relevant subset of an order line (goods or service).
 *
 * `manualUnitPrice` is the price the line STORES — the number somebody named,
 * kept as a number instead of as a percentage to rebuild it from. It is stored
 * at FULL precision on purpose — that is what makes `allocateTotal` cent-exact.
 *
 * "The price is stored" and "the price is locked" are different things, and the
 * flag below is what tells them apart (contract §7). A hand-typed price does
 * both: it is stored AND it stops following the cost. A catalogue price needs
 * only the first — it must show and invoice exactly the number that was quoted,
 * and still be repriced when the warehouse cost actually moves.
 */
export interface PricingLine {
  id: string
  quantity: number
  /** Cost per unit. */
  unitCost: number
  costSource: CostSource
  /** Planned margin — markup over cost, before discount. An input. */
  marginPercent: number
  discountPercent: number
  /** The stored price per unit, or null when the price is computed. */
  manualUnitPrice: number | null
  /**
   * The stored price is a price, not a lock: it is what the line shows and
   * invoices, but a real cost change reprices it through `marginPercent`.
   *
   * Absent means the old meaning — a stored price that also locks the line.
   * Only `pricingSeedFor` (a catalogue price) and the remainder of a split turn
   * it on; every hand edit turns it back off.
   */
  priceFollowsCost?: boolean
  state: LineState
  shippedQuantity: number
  /**
   * The line has been printed on a document the client already holds — an
   * invoice. Goods freeze when they ship; services never ship, so without this
   * a service on an issued invoice would stay editable forever while the goods
   * next to it are frozen.
   */
  documentIssued: boolean
}

export interface LineTotals {
  /** Computed price per unit before discount. */
  basePrice: number
  /** Computed price per unit after discount. */
  autoUnitPrice: number
  /** Effective price per unit — manual when set, computed otherwise. */
  unitPrice: number
  /** Line total excluding VAT, rounded to cents. */
  lineNet: number
  lineCost: number
  marginAmount: number
  /** Actual margin as a share of the price, after discount. A readout. */
  actualMarginPercent: number
  priceLocked: boolean
}

// ─── Rounding ───────────────────────────────────────────────────────────────

/**
 * Rounds half away from zero, working around binary representation surprises
 * (1.005 * 100 is 100.49999999999999 in IEEE-754, which would round down).
 */
export function roundTo(value: number, digits: number): number {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** digits
  const scaled = Number((value * factor).toPrecision(15))
  const rounded = Math.sign(scaled) * Math.round(Math.abs(scaled))
  return rounded === 0 ? 0 : rounded / factor
}

/** Money — cents. */
export function round2(value: number): number {
  return roundTo(value, 2)
}

/** Unit prices and percentages — 4 decimals is enough for display. */
export function round4(value: number): number {
  return roundTo(value, 4)
}

/**
 * The display form of `round2` — and the only way money should be formatted.
 *
 * `toFixed` on its own rounds by the binary value: 22.575 is 22.57499… in
 * IEEE-754, so `(22.575).toFixed(2)` is "22.57" while the money is 22.58. That
 * put a price of 22.57 next to a line total of 22.58 for a single unit, and made
 * an item picker promise a total the order then did not show.
 */
export function formatCents(value: number): string {
  return round2(value).toFixed(2)
}

/**
 * Stored values a price is rebuilt from — a margin, a discount. Enough
 * digits that the price comes back exactly, few enough to keep float dust out:
 * unrounded, (120 / 100 − 1) × 100 is 19.999999999999996.
 */
export function roundStored(value: number): number {
  return roundTo(value, 10)
}

// ─── Line calculation ───────────────────────────────────────────────────────

/**
 * Unrounded price per unit before discount.
 *
 * A line that was given a price keeps that price as its base. Rebuilding it from
 * `marginPercent` does not give it back: a margin is a ratio, and cost × (1 + m)
 * lands a hair below the price that produced it — which costs a whole cent every
 * time the honest total sits on a half-cent (contract §7, finding 16). More
 * stored digits do not help; the loss is the rebuild itself. The margin stays as
 * the rule for where the price goes when the COST moves — see `applyCostChange`.
 */
function rawBasePrice(line: PricingLine): number {
  if (line.priceFollowsCost && line.manualUnitPrice !== null) return line.manualUnitPrice
  return line.unitCost * (1 + line.marginPercent / 100)
}

/** Unrounded effective price per unit. */
function rawUnitPrice(line: PricingLine): number {
  // A locked price is the final price — the discount is already inside it, which
  // is what `applyPriceEdit` derived it from. A stored price that still follows
  // cost stands in for the computed base, so the discount still comes off it.
  if (line.manualUnitPrice !== null && !line.priceFollowsCost) return line.manualUnitPrice
  return rawBasePrice(line) * (1 - line.discountPercent / 100)
}

export function isPriceLocked(line: PricingLine): boolean {
  return line.manualUnitPrice !== null && !line.priceFollowsCost
}

/**
 * The price is locked once it has been handed to the client on paper — a waybill
 * for goods (from the first partial shipment on), an invoice for services. Split
 * the line to price the remainder differently, or use `applyCorrection`.
 */
export function canEditPrice(line: PricingLine): boolean {
  if (line.documentIssued) return false
  return line.state === 'draft'
}

/**
 * Quantity can still grow on a partially shipped line — the rest goes on the next
 * truck. What it cannot do is move once a document names it.
 *
 * `documentIssued` is asked here for the same reason its neighbours ask it — the
 * price, the cost and the deletion all do — and leaving it out was not a smaller
 * hole but a bigger one. On goods the shipped quantity happened to cover it; a
 * service never ships, so its state is `draft` for ever and nothing covered it at
 * all. An invoiced service sat with its trash can hidden, its DELETE refused and
 * its price closed, and a quantity cell wide open: set it to zero and 302,50 left
 * an order the client already holds a 502,50 invoice for.
 */
export function canEditQuantity(line: PricingLine): boolean {
  if (line.documentIssued) return false
  return line.state !== 'shipped'
}

/** Takes part in spreading a manual order total. */
export function isAllocatable(line: PricingLine): boolean {
  return canEditPrice(line) && line.quantity > 0
}

/**
 * Same rule as the price: frozen by shipment, or by an issued invoice for lines
 * that never ship. Not because the client would see it — they never do — but
 * because the profit on a closed order must not drift afterwards.
 */
export function isCostFrozen(line: PricingLine): boolean {
  return line.documentIssued || line.state === 'shipped' || line.state === 'partially_shipped'
}

function assertPriceEditable(line: PricingLine): void {
  if (!canEditPrice(line)) throw new Error('PRICE_FROZEN_BY_SHIPMENT')
}

/**
 * Rejects lines that cannot exist — shipped more than ordered, a "shipped" line
 * with nothing shipped, and so on. Not called from `calcLine`, which runs inside
 * render loops; use it where lines enter the system (API responses, mock
 * generators, imports), so bad data fails at the door instead of quietly
 * producing wrong money.
 */
export function validateLine(line: PricingLine): void {
  if (line.quantity < 0) throw new Error('INVALID_LINE: negative quantity')
  if (line.unitCost < 0) throw new Error('INVALID_LINE: negative cost')
  if (line.manualUnitPrice !== null && line.manualUnitPrice < 0) {
    throw new Error('INVALID_LINE: negative manual price')
  }
  if (line.discountPercent < 0 || line.discountPercent > 100) {
    throw new Error('INVALID_LINE: discount out of range')
  }
  if (line.marginPercent <= -100) throw new Error('INVALID_LINE: margin out of range')
  if (line.shippedQuantity < 0) throw new Error('INVALID_LINE: negative shipped quantity')
  if (line.shippedQuantity > line.quantity) throw new Error('INVALID_LINE: shipped exceeds ordered')

  const expected = syncLineState(line).state
  if (expected !== line.state) {
    throw new Error(
      `INVALID_LINE: state ${line.state} contradicts quantities (expected ${expected})`,
    )
  }
}

export function calcLine(line: PricingLine): LineTotals {
  const basePrice = rawBasePrice(line)
  const unitPrice = rawUnitPrice(line)
  const lineNet = round2(unitPrice * line.quantity)
  const lineCost = round2(line.unitCost * line.quantity)
  const marginAmount = round2(lineNet - lineCost)

  return {
    basePrice: round4(basePrice),
    autoUnitPrice: round4(basePrice * (1 - line.discountPercent / 100)),
    unitPrice: round4(unitPrice),
    lineNet,
    lineCost,
    marginAmount,
    actualMarginPercent: lineNet !== 0 ? round4((marginAmount / lineNet) * 100) : 0,
    priceLocked: isPriceLocked(line),
  }
}

// ─── Manual edits ───────────────────────────────────────────────────────────

/**
 * Price edit. Down → the difference becomes a discount (the client sees it in
 * the document). Up above the computed price → the discount is cleared first
 * and then the planned margin grows; a negative discount is nonsense on paper.
 *
 * Cost is never touched.
 */
export function applyPriceEdit(line: PricingLine, newUnitPrice: number): PricingLine {
  assertPriceEditable(line)
  return repriceUnchecked(line, newUnitPrice)
}

/**
 * Correction of an already shipped line — the only way past the freeze.
 * Requires a right and a reason, and produces a correcting document; both are
 * the caller's job. Kept separate so an ordinary edit can never do this by accident.
 */
export function applyCorrection(line: PricingLine, newUnitPrice: number): PricingLine {
  return repriceUnchecked(line, newUnitPrice)
}

function repriceUnchecked(line: PricingLine, newUnitPrice: number): PricingLine {
  if (newUnitPrice < 0) throw new Error('NEGATIVE_PRICE')
  const basePrice = rawBasePrice(line)

  // Storage precision, not display precision: these two are stored and a price
  // is rebuilt from them when the line is reset, so two decimals would shift the
  // money. They are rounded where they are shown, not here.
  // A price named by hand locks the line: it is stored AND it stops following
  // the cost, which is exactly the difference `priceFollowsCost` carries.
  if (basePrice > 0 && newUnitPrice < basePrice) {
    return {
      ...line,
      manualUnitPrice: newUnitPrice,
      priceFollowsCost: false,
      discountPercent: roundStored((1 - newUnitPrice / basePrice) * 100),
    }
  }

  if (line.unitCost > 0 && newUnitPrice > basePrice) {
    return {
      ...line,
      manualUnitPrice: newUnitPrice,
      priceFollowsCost: false,
      discountPercent: 0,
      marginPercent: roundStored((newUnitPrice / line.unitCost - 1) * 100),
    }
  }

  // Equal to the computed price, or cost is zero so no margin can be derived.
  return { ...line, manualUnitPrice: newUnitPrice, priceFollowsCost: false, discountPercent: 0 }
}

/** Editing the line total is the same edit seen from the other side. */
export function applyLineTotalEdit(line: PricingLine, newLineTotal: number): PricingLine {
  if (line.quantity <= 0) throw new Error('ZERO_QUANTITY')
  return applyPriceEdit(line, newLineTotal / line.quantity)
}

/**
 * Discount edit — materialises into a manual price, so a later cost change or
 * FIFO refresh will not move the price we already promised.
 */
export function applyDiscountEdit(line: PricingLine, discountPercent: number): PricingLine {
  assertPriceEditable(line)
  if (discountPercent < 0 || discountPercent > 100) throw new Error('DISCOUNT_OUT_OF_RANGE')
  // A discount is a share off the COMPUTED price — that is what makes it the
  // mirror image of a price edit. With no cost there is no computed price, and
  // taking a percentage off zero would wipe out a price that was stated outright.
  if (line.unitCost <= 0) throw new Error('NO_COST_TO_MARK_UP')
  return {
    ...line,
    discountPercent,
    manualUnitPrice: rawBasePrice(line) * (1 - discountPercent / 100),
    priceFollowsCost: false,
  }
}

/**
 * Margin edit — margin is a rule, not a price, so the price goes back to being
 * computed and the 🔒 lock is released.
 */
export function applyMarginEdit(line: PricingLine, marginPercent: number): PricingLine {
  assertPriceEditable(line)
  // A negative margin is a real thing — clearing out old stock below cost. But
  // at −100% and beyond the price would go to zero or negative, which is not.
  if (marginPercent <= -100) throw new Error('MARGIN_OUT_OF_RANGE')
  // Any percentage of nothing is nothing. Accepting this would release the lock
  // on a line whose price was stated outright — a service with no cost — and
  // quietly reprice it to zero. Such a line is priced, not marked up.
  if (line.unitCost <= 0) throw new Error('NO_COST_TO_MARK_UP')
  return { ...line, marginPercent, manualUnitPrice: null, priceFollowsCost: false }
}

/**
 * Derives the state from the quantities. Without this a line can end up
 * "partially shipped" with nothing left to ship, and stay editable forever.
 */
export function syncLineState(line: PricingLine): PricingLine {
  const shipped = line.shippedQuantity
  const state: LineState =
    shipped <= 0 ? 'draft' : shipped >= line.quantity ? 'shipped' : 'partially_shipped'

  return state === line.state ? line : { ...line, state }
}

/**
 * Quantity edit keeps the price per unit; the line total follows. A partially
 * shipped line can still grow, but never below what already left the warehouse.
 */
export function applyQuantityEdit(line: PricingLine, quantity: number): PricingLine {
  if (!canEditQuantity(line)) throw new Error('LINE_FULLY_SHIPPED')
  if (quantity < 0) throw new Error('NEGATIVE_QUANTITY')
  // A line for nothing is not a line — the same refusal the two creating
  // endpoints already make. It belongs HERE, in the one function through which a
  // quantity is ever assigned: written at the door where lines appear, it left
  // the door where they are edited wide open, and `quantity < 0` lets zero
  // through by one character. Set from the card's cell it stored a line of zero
  // units for zero money, which every report then counts as a line.
  if (quantity === 0) throw new Error('ZERO_QUANTITY')
  if (quantity < line.shippedQuantity) throw new Error('BELOW_SHIPPED_QUANTITY')
  return syncLineState({ ...line, quantity })
}

/**
 * Cost change. A locked price does not move — only the actual margin does.
 * An unlocked (draft) line is repriced, which is what a draft should do when
 * FIFO batches change.
 */
export function applyCostChange(
  line: PricingLine,
  newUnitCost: number,
  costSource: CostSource = 'stock',
): PricingLine {
  // Refuses rather than silently ignoring: a swallowed cost change is exactly
  // the kind of thing that hides a bug for months. Filter with isCostFrozen()
  // when refreshing costs across a whole order.
  if (isCostFrozen(line)) throw new Error('COST_FROZEN_BY_SHIPMENT')
  if (newUnitCost < 0) throw new Error('NEGATIVE_COST')
  const next = { ...line, unitCost: newUnitCost, costSource }

  // The line stores a price and follows its cost — the two halves of contract §7.
  // Between two cost changes the stored number IS the price; when the cost really
  // moves, the margin says where the price goes, and the new base is stored as a
  // price again. "Really moves" is the whole condition: a FIFO refresh that hands
  // back the same cost must not throw away the number that was quoted.
  if (next.priceFollowsCost && next.manualUnitPrice !== null && newUnitCost !== line.unitCost) {
    return { ...next, manualUnitPrice: newUnitCost * (1 + line.marginPercent / 100) }
  }
  return next
}

/**
 * Cost correction on a frozen line — the supplier price in the batch was wrong.
 * Same rules as `applyCorrection`: a right, a reason, and an entry in the order
 * history, all the caller's job. The client price does not move; the margin does.
 *
 * "Does not move" has to be made true, not merely intended. On a line whose price
 * is still computed, cost × margin IS the price — correcting a cost of 60 to 75
 * carried the price from 100 to 125 and quietly re-billed a client who had the
 * old figure on paper. So the price is pinned at what it already is, and the
 * margin becomes the number that absorbs the correction, which is the whole point
 * of model section 11.4.
 */
export function applyCostCorrection(
  line: PricingLine,
  newUnitCost: number,
  costSource: CostSource = 'manual',
): PricingLine {
  if (newUnitCost < 0) throw new Error('NEGATIVE_COST')
  return {
    ...line,
    unitCost: newUnitCost,
    costSource,
    // Pinned at the price it already has — and pinned means locked, not merely
    // stored: a line that still followed its cost would be repriced by the very
    // correction this is meant to absorb.
    manualUnitPrice: isPriceLocked(line) ? line.manualUnitPrice : rawUnitPrice(line),
    priceFollowsCost: false,
  }
}

/**
 * FIFO refresh across an order — reprices every draft line and leaves the
 * frozen ones exactly as they are.
 */
export function refreshCosts(
  lines: PricingLine[],
  costFor: (line: PricingLine) => number | null,
): PricingLine[] {
  return lines.map((line) => {
    if (isCostFrozen(line)) return line
    const cost = costFor(line)
    return cost === null ? line : applyCostChange(line, cost)
  })
}

/**
 * The "reset to calculated" button — back to cost + planned margin.
 *
 * Clears the discount as well, because a discount derived from a manual price
 * edit is part of that manual edit: keeping it would leave the price unchanged
 * and make the button look broken. Pass the order default to re-apply it.
 */
export function resetLinePrice(line: PricingLine, defaultDiscountPercent = 0): PricingLine {
  assertPriceEditable(line)
  // "Back to computed" needs something to compute from. Without a cost the
  // computed price is zero, and resetting would give the line away for free.
  if (line.unitCost <= 0) throw new Error('NO_COST_TO_MARK_UP')
  return {
    ...line,
    manualUnitPrice: null,
    priceFollowsCost: false,
    discountPercent: defaultDiscountPercent,
  }
}

// ─── Order rollup ───────────────────────────────────────────────────────────

export function vatRateFor(mode: VatMode, standardVatPercent: number): number {
  return mode === 'standard' ? standardVatPercent : 0
}

export interface OrderTotals {
  totalCost: number
  /** Sum of line totals, excluding VAT. */
  totalNet: number
  vatRate: number
  totalVat: number
  /** What the client pays. */
  totalGross: number
  marginAmount: number
  actualMarginPercent: number
  /** One number for "the discount actually given on this order". */
  effectiveDiscountPercent: number
}

export function rollupOrder(
  lines: PricingLine[],
  mode: VatMode,
  standardVatPercent: number,
): OrderTotals {
  let totalCost = 0
  let totalNet = 0

  for (const line of lines) {
    const totals = calcLine(line)
    totalCost = round2(totalCost + totals.lineCost)
    totalNet = round2(totalNet + totals.lineNet)
  }

  const vatRate = vatRateFor(mode, standardVatPercent)
  const totalVat = round2(totalNet * (vatRate / 100))
  const marginAmount = round2(totalNet - totalCost)

  return {
    totalCost,
    totalNet,
    vatRate,
    totalVat,
    totalGross: round2(totalNet + totalVat),
    marginAmount,
    actualMarginPercent: totalNet !== 0 ? round4((marginAmount / totalNet) * 100) : 0,
    effectiveDiscountPercent: effectiveDiscountPercent(lines),
  }
}

/**
 * The discount actually given, as a single percentage: how far the order landed
 * below the sum of its computed pre-discount prices. This is the number a new
 * line inherits when it is added "with the order's terms".
 *
 * A line with no cost takes no part in it, on either side of the ratio. It has
 * no computed price to have landed below — the price was named outright — so it
 * would add nothing to the base and its full price to the total, and one such
 * line would drag the discount of the whole order deep into the negative: 10%
 * given on the goods reads as −97% once a service priced outright sits beside
 * them. Same rule as everywhere else percentages meet a costless line — they
 * leave it alone.
 */
export function effectiveDiscountPercent(lines: PricingLine[]): number {
  let base = 0
  let actual = 0

  for (const line of lines) {
    if (line.unitCost <= 0) continue
    base += rawBasePrice(line) * line.quantity
    actual += calcLine(line).lineNet
  }

  return base > 0 ? round4((1 - actual / base) * 100) : 0
}

// ─── VAT conversions ────────────────────────────────────────────────────────

function vatMultiplier(mode: VatMode, standardVatPercent: number): number {
  const multiplier = 1 + vatRateFor(mode, standardVatPercent) / 100
  if (multiplier <= 0) throw new Error('INVALID_VAT_RATE')
  return multiplier
}

/** The admin edits the gross total; the allocation works on the net one. */
export function grossToNet(gross: number, mode: VatMode, standardVatPercent: number): number {
  return round2(gross / vatMultiplier(mode, standardVatPercent))
}

export function netToGross(net: number, mode: VatMode, standardVatPercent: number): number {
  return round2(net * vatMultiplier(mode, standardVatPercent))
}

/**
 * Not every gross amount is reachable once VAT is rounded to cents: with 21%
 * the nets 82.64 and 82.65 give 99.99 and 100.01, so a gross of 100.00 simply
 * does not exist. Nothing can fix that — but the admin must be told, not handed
 * a total one cent away from what they typed.
 */
export function achievableGross(
  targetGross: number,
  mode: VatMode,
  standardVatPercent: number,
): number {
  return netToGross(grossToNet(targetGross, mode, standardVatPercent), mode, standardVatPercent)
}

// ─── Total allocation ───────────────────────────────────────────────────────

export interface AllocationRow {
  lineId: string
  before: number
  after: number
}

export interface AllocationResult {
  lines: PricingLine[]
  /** Preview rows — show these before applying. */
  rows: AllocationRow[]
}

/**
 * Spreads a target net total across the editable lines, proportionally to
 * their current totals. The rounding residual lands on the largest line so the
 * sum of the lines matches the target EXACTLY — an invoice may not be a cent off.
 *
 * Frozen (shipped) lines are never touched, which is why a target below their
 * sum is rejected instead of producing negative prices.
 */
export function allocateTotal(lines: PricingLine[], targetNet: number): AllocationResult {
  if (targetNet < 0) throw new Error('NEGATIVE_TARGET')

  const totals = lines.map((line) => calcLine(line))
  const editableIdx: number[] = []
  let frozenTotal = 0
  let editableTotal = 0

  lines.forEach((line, i) => {
    const net = totals[i]!.lineNet
    if (isAllocatable(line)) {
      editableIdx.push(i)
      editableTotal = round2(editableTotal + net)
    } else {
      frozenTotal = round2(frozenTotal + net)
    }
  })

  const targetEditable = round2(targetNet - frozenTotal)
  if (targetEditable < 0) throw new Error('BELOW_FROZEN_MINIMUM')
  if (editableIdx.length === 0) {
    if (targetEditable === 0) return { lines: [...lines], rows: [] }
    throw new Error('NO_EDITABLE_LINES')
  }
  if (editableTotal === 0) throw new Error('ZERO_BASE_TOTAL')

  const factor = targetEditable / editableTotal

  // Provisional per-line totals, then push the residual onto the largest line.
  const allocated = editableIdx.map((i) => round2(totals[i]!.lineNet * factor))
  const residual = round2(targetEditable - allocated.reduce((sum, v) => sum + v, 0))

  if (residual !== 0) {
    let largest = 0
    for (let k = 1; k < allocated.length; k++) {
      if (allocated[k]! > allocated[largest]!) largest = k
    }
    allocated[largest] = round2(allocated[largest]! + residual)
  }

  const nextLines = [...lines]
  const rows: AllocationRow[] = []

  editableIdx.forEach((lineIdx, k) => {
    const line = lines[lineIdx]!
    const target = allocated[k]!
    // Full precision on purpose: round2(manualUnitPrice * quantity) === target.
    nextLines[lineIdx] = applyPriceEdit(line, target / line.quantity)
    rows.push({ lineId: line.id, before: totals[lineIdx]!.lineNet, after: target })
  })

  return { lines: nextLines, rows }
}

export interface GrossAllocationResult extends AllocationResult {
  requestedGross: number
  /** What the order will actually total. Differs when the request is unreachable. */
  achievedGross: number
}

/**
 * Same thing, but the admin typed a gross total. Reports back what the order
 * will really come to, so the preview can say "итог станет 99,99" instead of
 * quietly landing a cent away from what was asked.
 */
export function allocateGrossTotal(
  lines: PricingLine[],
  targetGross: number,
  mode: VatMode,
  standardVatPercent: number,
): GrossAllocationResult {
  const allocation = allocateTotal(lines, grossToNet(targetGross, mode, standardVatPercent))
  return {
    ...allocation,
    requestedGross: targetGross,
    achievedGross: achievableGross(targetGross, mode, standardVatPercent),
  }
}

// ─── Adding lines ───────────────────────────────────────────────────────────

export type AddLineMode = 'order_terms' | 'computed_price' | 'keep_total'

/**
 * Which choice the add-item dialog should offer, based on what is already in
 * the order. No manual edits at all → don't ask anything.
 */
export function addLineModes(lines: PricingLine[]): AddLineMode[] {
  const hasManualPrice = lines.some((line) => isPriceLocked(line))
  if (!hasManualPrice) return []

  const hasDiscount = effectiveDiscountPercent(lines) > 0
  const hasEditable = lines.some((line) => isAllocatable(line))

  if (hasDiscount) {
    return hasEditable
      ? ['order_terms', 'computed_price', 'keep_total']
      : ['order_terms', 'computed_price']
  }
  return hasEditable ? ['computed_price', 'keep_total'] : ['computed_price']
}

/**
 * A new line inheriting the order's effective discount.
 *
 * A line with no cost keeps its stated price: a discount is a share of the
 * computed price, and there is none to take a share of. Returning it untouched
 * rather than refusing lets one costless service sit in an order without
 * blocking the terms for every other line being added beside it.
 */
export function applyOrderTerms(line: PricingLine, existingLines: PricingLine[]): PricingLine {
  const discount = effectiveDiscountPercent(existingLines)
  if (discount <= 0 || line.unitCost <= 0) return line
  return applyDiscountEdit(line, discount)
}

// ─── Splitting a partially shipped line ─────────────────────────────────────

export interface LineSplit {
  /** Keeps the original id — this is the part that left with the waybill. */
  shipped: PricingLine
  /** Caller assigns an id. */
  remainder: Omit<PricingLine, 'id'>
}

export function splitLine(line: PricingLine, shippedQuantity: number): LineSplit {
  if (shippedQuantity <= 0 || shippedQuantity >= line.quantity) {
    throw new Error('INVALID_SPLIT_QUANTITY')
  }
  // The cut has to land exactly on what already shipped, otherwise goods either
  // vanish from the records or get counted as shipped twice.
  if (line.shippedQuantity > 0 && shippedQuantity !== line.shippedQuantity) {
    throw new Error('SPLIT_MUST_MATCH_SHIPPED')
  }

  const shipped: PricingLine = {
    ...line,
    quantity: shippedQuantity,
    shippedQuantity,
    state: 'shipped',
  }

  // Rounded because this is a stored quantity that gets written off the
  // warehouse and shown to the admin: 396.1 − 237.66 is 158.44000000000003
  // in IEEE-754, and that is not a quantity anybody ordered.
  const remainderQuantity = roundTo(line.quantity - shippedQuantity, 6)

  // Round where the sum is named, not on each piece. Rounding both halves of a
  // cent the same way moved money on one split in five; the same rule and the
  // same cure as `allocateTotal`, which puts its residual on one line and lands
  // on the target exactly.
  //
  // The residual goes to the REMAINDER, never to the shipped piece: the shipped
  // piece may already be printed on a waybill, and it is priced as a line of its
  // own quantity. The remainder has been on no document — that is what splitting
  // is for.
  const locked = isPriceLocked(line)
  // What the stored number has to mean on the remainder: the final price when the
  // line is locked, the pre-discount base when it still follows its cost — so the
  // discount is applied exactly once either way.
  const discountFactor = locked ? 1 : 1 - line.discountPercent / 100
  const residual = round2(calcLine(line).lineNet - calcLine(shipped).lineNet)
  const cutIsReal = remainderQuantity > 0 && discountFactor > 0

  return {
    shipped,
    remainder: {
      quantity: remainderQuantity,
      unitCost: line.unitCost,
      costSource: line.costSource,
      marginPercent: line.marginPercent,
      discountPercent: line.discountPercent,
      // Full precision on purpose: round2(price × quantity) === residual.
      manualUnitPrice: cutIsReal
        ? residual / remainderQuantity / discountFactor
        : line.manualUnitPrice,
      // Storing the residual must not put a 🔒 on a line that never had one: a
      // remainder that was following its cost goes on following it.
      priceFollowsCost: cutIsReal ? !locked : line.priceFollowsCost,
      state: 'draft',
      shippedQuantity: 0,
      // The remainder has not been on any document yet — that is the point of splitting.
      documentIssued: false,
    },
  }
}

// ─── Payments ───────────────────────────────────────────────────────────────

/**
 * Never store this — it lies the moment a line is added. Advance of 2500 on a
 * total of 10000 is 25%; add 2000 worth of goods and it becomes 20.83% by itself.
 */
export function paidPercent(totalGross: number, payments: number[]): number {
  if (totalGross <= 0) return 0
  const paid = payments.reduce((sum, p) => sum + p, 0)
  return round2((paid / totalGross) * 100)
}

export function outstandingAmount(totalGross: number, payments: number[]): number {
  const paid = payments.reduce((sum, p) => sum + p, 0)
  return round2(totalGross - paid)
}

/**
 * "Partially paid" is not a flag somebody sets — it is what the payments add up
 * to against the current total. Which is why it is computed here and nowhere
 * stored: the same records mean "paid" on a total of 2500 and "partially paid"
 * the moment a line is added.
 */
export type PaymentState = 'unpaid' | 'partial' | 'paid' | 'overpaid'

/** Money is compared at the precision it is paid in — anything under a cent is settled. */
const CENT = 0.01

export function paymentState(totalGross: number, payments: number[]): PaymentState {
  const paid = round2(payments.reduce((sum, p) => sum + p, 0))
  const outstanding = round2(totalGross - paid)
  // More money in than the order asks for — somebody has to give it back. Checked
  // first, because it is true whatever the total is, zero included.
  if (outstanding <= -CENT) return 'overpaid'
  // An order with nothing to pay for is not "paid": there is no total to cover.
  if (totalGross <= 0) return 'unpaid'
  if (outstanding < CENT) return 'paid'
  return paid >= CENT ? 'partial' : 'unpaid'
}

export interface PaymentSummary {
  paidAmount: number
  paidPercent: number
  /** Negative means overpaid — that much has to go back to the client. */
  outstanding: number
  state: PaymentState
}

export function paymentSummary(totalGross: number, payments: number[]): PaymentSummary {
  return {
    paidAmount: round2(payments.reduce((sum, p) => sum + p, 0)),
    paidPercent: paidPercent(totalGross, payments),
    outstanding: outstandingAmount(totalGross, payments),
    state: paymentState(totalGross, payments),
  }
}

// ─── FIFO allocation across batches ─────────────────────────────────────────

export interface FifoBatch {
  batchId: string
  offcutId?: string | null
  /** ISO date — FIFO order. */
  receivedAt: string
  /** Physical remainder minus reservations of OTHER orders. */
  availableQuantity: number
  /** Cost per unit. */
  unitCost: number
  /** What the cost is expressed in. A label, never a multiplier — see §7.1. */
  currency: string
}

export interface FifoAllocation {
  batchId: string
  offcutId: string | null
  quantity: number
  unitCost: number
  /** What the cost is expressed in. Nothing converts it. */
  currency: string
  source: CostSource
}

export interface FifoResult {
  allocations: FifoAllocation[]
  /** What the warehouse cannot cover — an estimate, and a deficit record. */
  shortageQuantity: number
  /** Weighted cost per unit over the covered quantity. */
  weightedUnitCost: number
}

/** Physical remainder minus what other orders already reserved. */
export function computeAvailable(quantityRemaining: number, reservedQuantity: number): number {
  return Math.max(0, quantityRemaining - reservedQuantity)
}

/**
 * Spreads a quantity across batches, oldest first. Returns WHICH batches were
 * taken — not just an average price. Without that breakdown the cost cannot be
 * reproduced, a partial shipment cannot write off the very batches it consumed,
 * and freezing the cost has nothing to stand on.
 *
 * Only available quantity is considered, so two orders cannot both claim the
 * same tonne. A shortage is reported, never silently priced at an average.
 */
export function allocateFifo(batches: FifoBatch[], quantity: number): FifoResult {
  if (quantity <= 0) return { allocations: [], shortageQuantity: 0, weightedUnitCost: 0 }

  const ordered = [...batches]
    .filter((b) => b.availableQuantity > 0)
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))

  const allocations: FifoAllocation[] = []
  let remaining = quantity
  let costSum = 0

  for (const batch of ordered) {
    if (remaining <= 0) break
    // Rounded before it is stored: this quantity gets written off the warehouse
    // and shown to the admin, and 2.6500000000000004 is not a quantity.
    const take = roundTo(Math.min(remaining, batch.availableQuantity), 6)

    allocations.push({
      batchId: batch.batchId,
      offcutId: batch.offcutId ?? null,
      quantity: take,
      unitCost: batch.unitCost,
      currency: batch.currency,
      source: 'stock',
    })

    costSum += take * batch.unitCost
    remaining = roundTo(remaining - take, 6)
  }

  const covered = roundTo(quantity - remaining, 6)

  return {
    allocations,
    shortageQuantity: remaining,
    weightedUnitCost: covered > 0 ? roundTo(costSum / covered, 6) : 0,
  }
}

/** Total cost of an allocation. */
export function allocationCost(allocations: FifoAllocation[]): number {
  return round2(allocations.reduce((sum, a) => sum + a.quantity * a.unitCost, 0))
}
