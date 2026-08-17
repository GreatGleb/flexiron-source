/**
 * Reservations — one store, reachable from both sides.
 *
 * A reservation is three things it must not be confused with:
 *  - **not a movement** — it does not change how much is on the shelf, only how
 *    much of it is still up for grabs;
 *  - **not a field on the batch** — one batch serves many orders at once, and a
 *    single `orderId` cannot say that;
 *  - **not an orders-module detail** — the warehouse has to subtract reservations
 *    to answer "what is available", so the store lives here, where orders and
 *    warehouse can both reach it without importing each other.
 *
 * Model: roo_code/plans/orders/order-pricing-model.md, section 7.
 */
import type { StockReservation } from '@/types/warehouse'
import { round2 } from '@/domain/orderPricing'

const RESERVATIONS: StockReservation[] = []

export function allReservations(): StockReservation[] {
  return RESERVATIONS
}

export function findReservations(filter?: {
  orderId?: string
  batchId?: string
  lineId?: string
}): StockReservation[] {
  return RESERVATIONS.filter(
    (r) =>
      (!filter?.orderId || r.orderId === filter.orderId) &&
      (!filter?.batchId || r.batchId === filter.batchId) &&
      (!filter?.lineId || r.lineId === filter.lineId),
  )
}

/**
 * How much of a batch is promised to orders.
 *
 * `exceptLine` answers the question one line asks about itself: "how much more
 * can I take" must not count what this very line already holds, or reserving
 * twice would shrink its own supply.
 *
 * The exception is per LINE, not per order. Two lines of the same order asking
 * for the same product are two separate claims on the same shelf, and treating
 * them as one is how sixteen units get promised out of a batch of ten.
 */
export function reservedOn(
  batchId: string,
  options?: { exceptLine?: { orderId: string; lineId: string } },
): number {
  const except = options?.exceptLine
  return round2(
    RESERVATIONS.filter(
      (r) =>
        r.batchId === batchId &&
        !(except && r.orderId === except.orderId && r.lineId === except.lineId),
    ).reduce((sum, r) => sum + r.quantity, 0),
  )
}

/** Total held by one line, across every batch it draws from. */
export function reservedForLine(orderId: string, lineId: string): number {
  return round2(findReservations({ orderId, lineId }).reduce((sum, r) => sum + r.quantity, 0))
}

export function addReservation(reservation: StockReservation): void {
  RESERVATIONS.push(reservation)
}

/** How much of one batch a single line already holds. */
export function reservedForLineOnBatch(
  orderId: string,
  lineId: string,
  batchId: string | null,
): number {
  return round2(
    RESERVATIONS.filter(
      (r) => r.orderId === orderId && r.lineId === lineId && r.batchId === batchId,
    ).reduce((sum, r) => sum + r.quantity, 0),
  )
}

/**
 * Holds more of a batch for a line, topping up the hold it already has.
 *
 * One record per line and batch, extended rather than duplicated: reserving twice
 * in a row must not hold the goods twice, and a partial hold has to be completable
 * later when the shelf is restocked.
 */
export function holdOnBatch(hold: {
  orderId: string
  lineId: string
  batchId: string | null
  offcutId: string | null
  quantity: number
}): StockReservation {
  const existing = RESERVATIONS.find(
    (r) => r.orderId === hold.orderId && r.lineId === hold.lineId && r.batchId === hold.batchId,
  )
  if (existing) {
    existing.quantity = round2(existing.quantity + hold.quantity)
    return existing
  }
  const reservation: StockReservation = {
    id: `RSV-${hold.orderId}-${hold.lineId}-${hold.batchId ?? 'none'}`,
    batchId: hold.batchId,
    offcutId: hold.offcutId,
    orderId: hold.orderId,
    lineId: hold.lineId,
    quantity: round2(hold.quantity),
    createdAt: new Date().toISOString(),
  }
  RESERVATIONS.push(reservation)
  return reservation
}

/**
 * Gives back part of what a line holds, newest reservation first.
 *
 * Called when goods actually ship — the hold is replaced by a real write-off —
 * and when a line shrinks or an order is cancelled.
 *
 * RETURNS what was actually released, per batch. A line may hold less than it is
 * asked to give back, or nothing at all, and the caller cannot tell from the
 * outside: a cancelled shipment has to put back the hold it took, and "how much,
 * off which batch" is only knowable here.
 */
export function releaseFromLine(
  orderId: string,
  lineId: string,
  quantity: number,
): Array<{ batchId: string | null; offcutId: string | null; quantity: number }> {
  const released: Array<{ batchId: string | null; offcutId: string | null; quantity: number }> = []
  let left = quantity
  for (let i = RESERVATIONS.length - 1; i >= 0 && left > 0; i--) {
    const reservation = RESERVATIONS[i]!
    if (reservation.orderId !== orderId || reservation.lineId !== lineId) continue
    const take = round2(Math.min(reservation.quantity, left))
    if (take <= 0) continue
    released.push({
      batchId: reservation.batchId,
      offcutId: reservation.offcutId,
      quantity: take,
    })
    reservation.quantity = round2(reservation.quantity - take)
    left = round2(left - take)
    if (reservation.quantity <= 0) RESERVATIONS.splice(i, 1)
  }
  return released
}

/**
 * Gives back a hold off the very batches the goods left from.
 *
 * The write-off already decided which batches a shipment consumes — FIFO, oldest
 * first — and the hold has to follow that one decision instead of making a second
 * one of its own. Released newest-first, the two answers came apart on the first
 * line that spanned two batches: 305 units of the old batch plus 2 of the new,
 * ship 2, and the goods left the old batch while the hold came off the new one.
 * The old batch was then promising 305 units off a shelf of 303, read as fully
 * taken, while the new batch read as free and the order had lost its place in the
 * queue for it. And `heldReleased` remembered the wrong batch, so cancelling the
 * shipment put the hold back where it had never been taken from.
 *
 * Anything the named batches cannot cover falls back to the general release: what
 * shipped stops being held, whichever batch the hold happened to sit on.
 */
export function releaseFromLineOnBatches(
  orderId: string,
  lineId: string,
  consumed: ReadonlyArray<{ batchId: string | null; quantity: number }>,
  quantity: number,
): Array<{ batchId: string | null; offcutId: string | null; quantity: number }> {
  const released: Array<{ batchId: string | null; offcutId: string | null; quantity: number }> = []
  let left = round2(quantity)

  for (const consumption of consumed) {
    if (left <= 0) break
    const index = RESERVATIONS.findIndex(
      (r) => r.orderId === orderId && r.lineId === lineId && r.batchId === consumption.batchId,
    )
    if (index === -1) continue
    const reservation = RESERVATIONS[index]!
    const take = round2(Math.min(reservation.quantity, consumption.quantity, left))
    if (take <= 0) continue
    released.push({
      batchId: reservation.batchId,
      offcutId: reservation.offcutId,
      quantity: take,
    })
    reservation.quantity = round2(reservation.quantity - take)
    left = round2(left - take)
    if (reservation.quantity <= 0) RESERVATIONS.splice(index, 1)
  }

  if (left > 0) released.push(...releaseFromLine(orderId, lineId, left))
  return released
}

/** Gives back everything one line holds — it is going away. */
export function releaseLine(orderId: string, lineId: string): void {
  for (let i = RESERVATIONS.length - 1; i >= 0; i--) {
    const r = RESERVATIONS[i]!
    if (r.orderId === orderId && r.lineId === lineId) RESERVATIONS.splice(i, 1)
  }
}

export function releaseOrder(orderId: string): void {
  for (let i = RESERVATIONS.length - 1; i >= 0; i--) {
    if (RESERVATIONS[i]!.orderId === orderId) RESERVATIONS.splice(i, 1)
  }
}
