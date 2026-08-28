import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { mockGetBatches, mockGetOffcuts, mockGetMovements } from './warehouse'
import { STORE as PRODUCTS } from './products'
import { mockBatches as BATCH_SEED } from '../../mocks/warehouse-batches'

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

/**
 * Второй слой того же пункта: поле `productName` со склада убрано, но имя товара
 * копировалось в сид ещё дважды — в свободный текст `notes` партии и в заголовок секции
 * над её записями. Копия в `notes` видна пользователю (`WarehouseBatchCard`,
 * `data-test="field-notes"`), и она разошлась с каталогом ровно так же, как разошлось
 * снятое поле: партия стального листа S355 6мм подписана «Oxygen cylinder 40L».
 *
 * Лечится тем же, чем поле: имя не выравнивается, а перестаёт храниться. `notes`
 * описывает ПАРТИЮ (сколько израсходовано, какой сертификат, где лежит), товар в ней не
 * называется вовсе — его имя приходит из каталога по `productId`.
 *
 * Заголовок секции — комментарий, пользователю он не виден, поэтому имя в нём остаётся:
 * без него в файле на три тысячи строк не найти нужную запись. Но он приколочен к
 * каталогу проверкой ниже, то есть разойтись молча больше не может.
 */
function nameWords(text: string): string[] {
  return (text.toLowerCase().match(/\p{L}{4,}/gu) ?? []).map((word) => word.toLowerCase())
}

/**
 * Слово заметки против словаря каталога — с английским множественным числом: «Cut-off
 * wheels» в заметке партии оцинкованного листа обязано ловиться, а `wheels` ≠ `wheel`.
 *
 * Порог в четыре буквы, а не в три, — намеренно. Трёхбуквенные обрывки каталожных имён
 * («Cut-off Wheel» даёт `cut` и `off`) совпадают с обычным английским: заметка «500 kg
 * written off» покраснела бы ни за что. Цена порога названа: коды профилей IPE, UPN, HEA
 * и слово MIG сквозь него проходят — они называют стандарт профиля и способ сварки, а не
 * товар из каталога.
 */
function namesCatalogWord(word: string, vocabulary: Set<string>): boolean {
  if (vocabulary.has(word)) return true
  return word.endsWith('s') && word.length > 4 && vocabulary.has(word.slice(0, -1))
}

function catalogVocabulary(): Set<string> {
  const vocabulary = new Set<string>()
  for (const product of PRODUCTS) {
    for (const locale of ['ru', 'en', 'lt'] as const) {
      for (const word of nameWords(product.name[locale] ?? '')) vocabulary.add(word)
    }
  }
  return vocabulary
}

describe('сид партий не называет товар второй раз', () => {
  it('заметка партии описывает партию, а не товар', () => {
    const vocabulary = catalogVocabulary()
    expect(vocabulary.size).toBeGreaterThan(0)
    expect(BATCH_SEED.length).toBeGreaterThan(0)

    const naming = BATCH_SEED.filter((batch) => batch.notes)
      .map((batch) => ({
        id: batch.id,
        words: [
          ...new Set(nameWords(batch.notes).filter((word) => namesCatalogWord(word, vocabulary))),
        ],
      }))
      .filter((row) => row.words.length > 0)

    expect(naming.map((row) => `${row.id}: ${row.words.join(', ')}`)).toEqual([])
  })

  it('заголовок секции называет товар так же, как каталог', () => {
    const source = readFileSync(
      new URL('../../mocks/warehouse-batches.ts', import.meta.url),
      'utf8',
    )
    const headers = [...source.matchAll(/\/\/ ── (prod-\d+)[^:\n]*: (.+?) ──/g)]
    expect(headers.length).toBeGreaterThan(0)

    const wrong = headers
      .map(([, id, title]) => ({
        id: id!,
        title: title!.trim(),
        catalog: PRODUCTS.find((p) => p.id === id)?.name.en ?? '(нет в каталоге)',
      }))
      .filter((row) => row.title !== row.catalog)
      .map((row) => `${row.id}: «${row.title}» ≠ «${row.catalog}»`)

    expect(wrong).toEqual([])
  })
})
