import { describe, it, expect } from 'vitest'
import {
  mockCreateBatch,
  mockCreateMovement,
  mockGetBatch,
  mockCreateOffcut,
  mockGetOffcut,
  mockPatchOffcut,
  mockGetMovements,
  mockGetMovement,
} from './warehouse'

/**
 * Where a batch is, after it has been moved.
 *
 * A `transfer` used to record `fromLocation` / `toLocation` on the movement and
 * stop there: the batch kept the shelf it had been on before, and the truth was
 * visible only to whoever opened the movement history. A location is free text
 * (there is no sector reference — see the sitemap review, item 3), so that stale
 * string is the whole guarantee that the metal gets found again.
 *
 * The rule has one border: the field follows the metal only when ALL of the
 * remainder goes. A partial transfer leaves the batch in two places, and writing
 * the destination over the origin would claim the whole batch had left.
 */

/** The shape a location is stored in — `mockCreateBatch` recomposes it either way. */
const SHELF_B = 'Rack: B-05 | Row: 01 | Cell: 01'
const SHELF_A = 'Rack: A-01 | Row: 02 | Cell: 03'
const SHELF_C = 'Rack: C-09 | Row: 01 | Cell: 02'
const SHELF_D = 'Rack: D-02 | Row: 01 | Cell: 01'

let seq = 0
function freshBatch(quantity: number, location: string) {
  seq += 1
  return mockCreateBatch({
    productId: 'prod-001',
    batchNumber: `TRF-${String(seq).padStart(3, '0')}`,
    lotCode: `LOT-TRF-${String(seq).padStart(3, '0')}`,
    quantity,
    uomId: 'uom-kg',
    unitPrice: 10,
    receivedAt: '2026-01-01T00:00:00Z',
    location,
  })
}

/**
 * A batch and one offcut cut out of it, both on the same shelf.
 *
 * `quantity` on an offcut counts PIECES; how much material a piece is comes from its
 * size, and for a batch measured in kilograms that size is `weightKg`. This helper
 * used to pass the batch's whole quantity as the piece count and no weight at all —
 * now refused outright, and previously taken off the batch twice over.
 */
async function freshOffcut(quantity: number, location: string) {
  const batch = await freshBatch(quantity, location)
  const offcut = await mockCreateOffcut({
    batchId: batch.id,
    quantity: 1,
    weightKg: quantity,
    uomId: 'uom-kg',
    offcutType: 'linear',
    location,
  })
  return { batch, offcut }
}

describe('transfer movement and batch.location', () => {
  it('moves the batch when the whole remainder is transferred', async () => {
    const batch = await freshBatch(100, SHELF_B)
    expect(batch.location).toBe(SHELF_B)

    await mockCreateMovement({
      type: 'transfer',
      batchId: batch.id,
      quantity: batch.quantityRemaining,
      fromLocation: SHELF_B,
      toLocation: SHELF_A,
    })

    const after = await mockGetBatch(batch.id)
    expect(after.location).toBe(SHELF_A)
    // A transfer moves metal between shelves, not in or out of stock.
    expect(after.quantityRemaining).toBe(100)
    expect(after.quantity).toBe(100)
  })

  it('leaves the batch where it was when only part of the remainder is transferred', async () => {
    const batch = await freshBatch(100, SHELF_B)

    await mockCreateMovement({
      type: 'transfer',
      batchId: batch.id,
      quantity: 40,
      fromLocation: SHELF_B,
      toLocation: SHELF_A,
    })

    const after = await mockGetBatch(batch.id)
    // Not SHELF_A: 60 kg are still on B-05, and the second place is written by hand.
    expect(after.location).toBe(SHELF_B)
    expect(after.quantityRemaining).toBe(100)
  })

  it('follows the remainder, not the quantity that once arrived', async () => {
    // 100 arrived, 70 were sold: what is left is 30, and moving 30 moves the batch.
    const batch = await freshBatch(100, SHELF_B)
    await mockCreateMovement({ type: 'sale', batchId: batch.id, quantity: 70 })

    await mockCreateMovement({
      type: 'transfer',
      batchId: batch.id,
      quantity: 30,
      fromLocation: SHELF_B,
      toLocation: SHELF_C,
    })

    const after = await mockGetBatch(batch.id)
    expect(after.location).toBe(SHELF_C)
  })

  it('does not move the parent batch when an offcut is transferred', async () => {
    // An offcut transfer carries its parent's batchId for provenance, and cutting
    // the offcut takes the quantity off the batch — so what is left of the batch is
    // covered by the offcut's own quantity, and the batch would move if the offcut
    // branch did not claim this transfer for itself.
    const { batch, offcut } = await freshOffcut(2, SHELF_B)
    expect((await mockGetBatch(batch.id)).quantityRemaining).toBe(0)

    await mockCreateMovement({
      type: 'transfer',
      batchId: batch.id,
      offcutId: offcut.id,
      quantity: offcut.quantity,
      fromLocation: SHELF_B,
      toLocation: SHELF_D,
    })

    expect((await mockGetBatch(batch.id)).location).toBe(SHELF_B)
    expect((await mockGetOffcut(offcut.id)).location).toBe(SHELF_D)
  })

  it('does not blank the location when a transfer names no destination', async () => {
    const batch = await freshBatch(100, SHELF_B)

    await mockCreateMovement({
      type: 'transfer',
      batchId: batch.id,
      quantity: batch.quantityRemaining,
      fromLocation: SHELF_B,
      toLocation: null,
    })

    const after = await mockGetBatch(batch.id)
    expect(after.location).toBe(SHELF_B)
  })

  it('does not move the offcuts of a batch that is transferred', async () => {
    // The batch leaves the shelf; the piece already cut off it does not.
    const { batch, offcut } = await freshOffcut(2, SHELF_B)
    // Put something back on the batch so the whole remainder can move.
    await mockCreateMovement({ type: 'receipt', batchId: batch.id, quantity: 5 })

    await mockCreateMovement({
      type: 'transfer',
      batchId: batch.id,
      quantity: 5,
      fromLocation: SHELF_B,
      toLocation: SHELF_A,
    })

    expect((await mockGetBatch(batch.id)).location).toBe(SHELF_A)
    expect((await mockGetOffcut(offcut.id)).location).toBe(SHELF_B)
  })
})

/**
 * An offcut is ONE physical piece. It cannot lie in two places, so the "whole
 * remainder or part of it" question the batch has to answer does not exist here:
 * any transfer takes all of it.
 */
describe('transfer movement and offcut.location', () => {
  it('moves the offcut whenever a destination is named', async () => {
    const { batch, offcut } = await freshOffcut(2, SHELF_B)
    expect(offcut.location).toBe(SHELF_B)

    await mockCreateMovement({
      type: 'transfer',
      batchId: batch.id,
      offcutId: offcut.id,
      quantity: offcut.quantity,
      fromLocation: SHELF_B,
      toLocation: SHELF_C,
    })

    const after = await mockGetOffcut(offcut.id)
    expect(after.location).toBe(SHELF_C)
    // The piece was carried, not consumed: the count and the size it was created
    // with are both still there. Read again after the movement, so this compares
    // two moments rather than a value with itself.
    expect(after.quantity).toBe(offcut.quantity)
    expect(after.weightKg).toBe(2)
    expect(after.status).toBe('available')
  })

  it('moves the offcut even when the transfer names less than the piece', async () => {
    // There is nothing to weigh: a quantity below the piece cannot mean half of it
    // stayed behind. Whatever the number says, the piece is somewhere else now.
    const { batch, offcut } = await freshOffcut(4, SHELF_B)

    await mockCreateMovement({
      type: 'transfer',
      batchId: batch.id,
      offcutId: offcut.id,
      quantity: 1,
      fromLocation: SHELF_B,
      toLocation: SHELF_C,
    })

    expect((await mockGetOffcut(offcut.id)).location).toBe(SHELF_C)
  })

  it.each([
    ['null', null],
    ['an empty string', ''],
  ])('does not blank the offcut location when the destination is %s', async (_label, dest) => {
    const { batch, offcut } = await freshOffcut(2, SHELF_B)

    await mockCreateMovement({
      type: 'transfer',
      batchId: batch.id,
      offcutId: offcut.id,
      quantity: offcut.quantity,
      fromLocation: SHELF_B,
      toLocation: dest,
    })

    expect((await mockGetOffcut(offcut.id)).location).toBe(SHELF_B)
  })

  it('does not blank the offcut location when a status change writes a transfer', async () => {
    // Not a hypothetical payload: OFFCUT_STATUS_TO_MOVEMENT_TYPE maps the `reserved`
    // status to movement type `transfer` (useWarehouse.ts, useWarehouseOffcutCard.ts),
    // and those callers pass no locations at all — the field is absent, not null.
    // Reserving a piece must not cost it its shelf.
    const { batch, offcut } = await freshOffcut(2, SHELF_B)

    await mockCreateMovement({
      type: 'transfer',
      batchId: batch.id,
      offcutId: offcut.id,
      quantity: offcut.quantity,
      notes: 'offcut reserved',
    })

    expect((await mockGetOffcut(offcut.id)).location).toBe(SHELF_B)
  })

  it('keeps the card and the movement agreeing when the location is edited', async () => {
    // The reverse path, as the offcut card walks it: PATCH the location, then record
    // the transfer. The two must not disagree, and the transfer must be recorded once.
    const { batch, offcut } = await freshOffcut(2, SHELF_B)

    const patched = await mockPatchOffcut(offcut.id, { location: SHELF_A })
    await mockCreateMovement({
      type: 'transfer',
      batchId: batch.id,
      offcutId: offcut.id,
      quantity: offcut.quantity,
      fromLocation: SHELF_B,
      toLocation: SHELF_A,
    })

    expect(patched.location).toBe(SHELF_A)
    expect((await mockGetOffcut(offcut.id)).location).toBe(SHELF_A)

    const movements = await mockGetMovements(
      { search: '', offcutId: offcut.id },
      { page: 1, pageSize: 100 },
    )
    const transfers = movements.items.filter((m) => m.type === 'transfer')
    expect(transfers).toHaveLength(1)
    // The list projection carries no locations — the record itself does.
    const recorded = await mockGetMovement(transfers[0]!.id)
    expect(recorded.fromLocation).toBe(SHELF_B)
    expect(recorded.toLocation).toBe(SHELF_A)
  })

  it('writes nothing at all when the parent batch is unknown', async () => {
    // A movement is recorded against a batch — it copies its number, product, unit
    // and price from there. An unknown batch fails before any location is touched,
    // so no piece is quietly relocated by a movement that was never recorded.
    const { offcut } = await freshOffcut(2, SHELF_B)

    await expect(
      mockCreateMovement({
        type: 'transfer',
        batchId: 'whb-does-not-exist',
        offcutId: offcut.id,
        quantity: offcut.quantity,
        toLocation: SHELF_C,
      }),
    ).rejects.toThrow('BATCH_NOT_FOUND')

    expect((await mockGetOffcut(offcut.id)).location).toBe(SHELF_B)
  })

  it('records the movement but relocates nothing when the offcut is unknown', async () => {
    const batch = await freshBatch(100, SHELF_B)

    const movement = await mockCreateMovement({
      type: 'transfer',
      batchId: batch.id,
      offcutId: 'offcut-does-not-exist',
      quantity: batch.quantityRemaining,
      toLocation: SHELF_C,
    })

    expect(movement.toLocation).toBe(SHELF_C)
    // The batch keeps its shelf too: the transfer was claimed by the offcut branch,
    // and a piece the warehouse never heard of gets no shelf.
    expect((await mockGetBatch(batch.id)).location).toBe(SHELF_B)
  })
})
