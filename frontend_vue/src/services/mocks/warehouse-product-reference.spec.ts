import { describe, it, expect } from 'vitest'
import { mockGetBatches, mockGetOffcuts, mockGetMovements } from './warehouse'
import { STORE as PRODUCTS } from './products'

/**
 * Пункт 4e: имя товара нигде на складе не хранится, значит единственное, что связывает
 * партию, обрезок и движение с товаром, — это `productId`. Пока имя лежало копией, кривая
 * ссылка была не видна: строка показывала имя из копии и выглядела правдоподобно. Теперь
 * ссылка — всё, что есть, и её кривизна становится видимой сразу — эти проверки за этим
 * и стоят.
 */
const ALL = { page: 1, pageSize: 1000 }

describe('склад ссылается на товар, а не хранит его имя', () => {
  it('у каждого обрезка товар тот же, что у его партии', async () => {
    const batches = (await mockGetBatches({ search: '' }, ALL)).items
    const productOfBatch = new Map(batches.map((b) => [b.id, b.productId]))
    const offcuts = (await mockGetOffcuts({ search: '' }, ALL)).items

    expect(offcuts.length).toBeGreaterThan(0)
    const wrong = offcuts
      .filter((o) => productOfBatch.get(o.batchId) !== o.productId)
      .map((o) => `${o.id}: ${o.productId} ≠ ${productOfBatch.get(o.batchId)}`)
    expect(wrong).toEqual([])
  })

  it('у каждого движения товар тот же, что у его партии', async () => {
    const batches = (await mockGetBatches({ search: '' }, ALL)).items
    const productOfBatch = new Map(batches.map((b) => [b.id, b.productId]))
    const movements = (await mockGetMovements({ search: '' }, ALL)).items

    expect(movements.length).toBeGreaterThan(0)
    const wrong = movements
      .filter((m) => productOfBatch.get(m.batchId) !== m.productId)
      .map((m) => `${m.id}: ${m.productId} ≠ ${productOfBatch.get(m.batchId)}`)
    expect(wrong).toEqual([])
  })

  it('каждая складская ссылка на товар есть в каталоге', async () => {
    const known = new Set(PRODUCTS.map((p) => p.id))
    const batches = (await mockGetBatches({ search: '' }, ALL)).items
    const offcuts = (await mockGetOffcuts({ search: '' }, ALL)).items
    const movements = (await mockGetMovements({ search: '' }, ALL)).items

    expect(batches.length + offcuts.length + movements.length).toBeGreaterThan(0)
    const dangling = [...batches, ...offcuts, ...movements]
      .filter((row) => !known.has(row.productId))
      .map((row) => `${row.id} → ${row.productId}`)
    expect(dangling).toEqual([])
  })

  it('поиск по имени товара находит партию, которая имени не хранит', async () => {
    const batches = (await mockGetBatches({ search: '' }, ALL)).items
    const first = batches[0]!
    const name = PRODUCTS.find((p) => p.id === first.productId)!.name.en
    expect(name).not.toBe('')

    const found = (await mockGetBatches({ search: name }, ALL)).items
    expect(found.length).toBeGreaterThan(0)
    expect(found.every((b) => PRODUCTS.find((p) => p.id === b.productId)!.name.en === name)).toBe(
      true,
    )
  })
})
