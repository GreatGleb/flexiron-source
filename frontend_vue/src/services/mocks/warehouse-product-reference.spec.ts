import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { mockGetBatches, mockGetOffcuts, mockGetMovements } from './warehouse'
import { STORE as PRODUCTS } from './products'
import { mockBatches as BATCH_SEED } from '../../mocks/warehouse-batches'
import { mockOffcuts as OFFCUT_SEED } from '../../mocks/warehouse-offcuts'
import { mockMovements as MOVEMENT_SEED } from '../../mocks/warehouse-movements'

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
 * копировалось в сиды ещё и свободным текстом — в `notes` записи и в заголовок секции
 * над ней. Копию в `notes` видит пользователь: её рисуют все три карточки склада
 * (`WarehouseBatchCard`, `WarehouseOffcutCard`, `WarehouseMovementCard`), и каждая —
 * полем `data-test="field-notes"`. Разошлась она ровно так же, как разошлось снятое
 * поле: обрезок титанового листа был подписан «Остаток алюминиевого листа после
 * раскроя», движение по партии лазерного станка — «Резка трубы на опорные стойки».
 *
 * Лечится тем же, чем поле: имя не выравнивается, а перестаёт храниться. `notes`
 * описывает событие или остаток (сколько израсходовано, куда положено, по какому
 * заказу), товар в ней не называется вовсе — его имя приходит из каталога по
 * `productId`.
 *
 * Заголовок секции — комментарий, пользователю он не виден, но устаревает так же
 * молча. Правило для него одно на три сида, только повёрнуто разными сторонами: в сиде
 * партий записи сгруппированы ПО ТОВАРУ, поэтому заголовок имя товара называет и
 * приколочен к каталогу проверкой ниже; в сидах обрезков и движений записи
 * сгруппированы по `who-`/`whb-`, поэтому имени товара в их комментариях быть не
 * должно вовсе — и это тоже проверяется, а не подразумевается.
 */

/**
 * Русская морфология. Словарь строится из каталога, а заметки склада написаны
 * по-русски, где «листа» ≠ «лист» и точное сравнение словоформ пропускает всё. Поэтому
 * обе стороны приводятся к основе: отсекается самое длинное окончание из списка, если
 * после него остаётся не меньше четырёх букв. Латиница через отсечение не проходит —
 * окончания кириллические, так что английские заметки партий работают как работали.
 */
const RU_ENDINGS = [
  'ами',
  'ями',
  'ого',
  'его',
  'ому',
  'ему',
  'ыми',
  'ими',
  'ах',
  'ях',
  'ов',
  'ев',
  'ей',
  'ий',
  'ый',
  'ая',
  'яя',
  'ое',
  'ее',
  'ые',
  'ие',
  'ых',
  'их',
  'ым',
  'им',
  'ом',
  'ем',
  'ой',
  'ую',
  'юю',
  'а',
  'я',
  'ы',
  'и',
  'у',
  'ю',
  'е',
  'о',
  'ь',
]

function stem(word: string): string {
  if (!/^[а-яё]+$/.test(word)) return word
  for (const ending of RU_ENDINGS) {
    if (word.length - ending.length >= 4 && word.endsWith(ending)) {
      return word.slice(0, -ending.length)
    }
  }
  return word
}

function nameWords(text: string): string[] {
  return (text.toLowerCase().match(/\p{L}{4,}/gu) ?? []).map((word) => stem(word))
}

/**
 * Слово текста против словаря каталога — с английским множественным числом: «Cut-off
 * wheels» в заметке партии оцинкованного листа обязано ловиться, а `wheels` ≠ `wheel`.
 *
 * Порог в четыре буквы, а не в три, — намеренно. Трёхбуквенные обрывки каталожных имён
 * («Cut-off Wheel» даёт `cut` и `off`) совпадают с обычным английским: заметка «500 kg
 * written off» покраснела бы ни за что. Цена порога названа: коды профилей IPE, UPN,
 * HEA, слово MIG и русское «газ» сквозь него проходят — их приходится ловить чтением,
 * как «фанеру», «профнастил» и «двутавр», которых в каталоге нет вовсе, а в заметках
 * они были.
 *
 * Цена с другой стороны — ложные срабатывания, и они тоже приняты сознательно: `cutting`
 * из «Cutting Oil», `equal` из «Equal Angle», «материал» из «Материал без категории»
 * краснеют в тексте, который называет операцию, а не товар. Разбирать их
 * исключениями значило бы завести список, который устаревает молча; дешевле написать
 * заметку словами, которых в каталоге нет.
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

function catalogWordsIn(text: string, vocabulary: Set<string>): string[] {
  return [...new Set(nameWords(text).filter((word) => namesCatalogWord(word, vocabulary)))]
}

function commentLines(file: string): { line: number; text: string }[] {
  const source = readFileSync(new URL(`../../mocks/${file}`, import.meta.url), 'utf8')
  return source
    .split('\n')
    .map((text, index) => ({ line: index + 1, text: /^\s*\/\/(.*)$/.exec(text)?.[1] ?? '' }))
    .filter((row) => row.text !== '')
}

const SEEDS: { label: string; rows: { id: string; notes?: string | null }[] }[] = [
  { label: 'партия', rows: BATCH_SEED },
  { label: 'обрезок', rows: OFFCUT_SEED },
  { label: 'движение', rows: MOVEMENT_SEED },
]

describe('сиды склада не называют товар второй раз', () => {
  it('заметка складской записи описывает запись, а не товар', () => {
    const vocabulary = catalogVocabulary()
    expect(vocabulary.size).toBeGreaterThan(0)

    const naming: string[] = []
    for (const { label, rows } of SEEDS) {
      expect(rows.length).toBeGreaterThan(0)
      const written = rows.filter((row) => row.notes)
      expect(written.length).toBeGreaterThan(0)

      for (const row of written) {
        const words = catalogWordsIn(row.notes!, vocabulary)
        if (words.length > 0) naming.push(`${label} ${row.id}: [${words.join(', ')}] ${row.notes}`)
      }
    }

    expect(naming).toEqual([])
  })

  it('заголовок секции в сиде партий называет товар так же, как каталог', () => {
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

  it('комментарии в сидах обрезков и движений товар не называют', () => {
    const vocabulary = catalogVocabulary()
    expect(vocabulary.size).toBeGreaterThan(0)

    const naming: string[] = []
    for (const file of ['warehouse-offcuts.ts', 'warehouse-movements.ts']) {
      const comments = commentLines(file)
      expect(comments.length).toBeGreaterThan(0)

      for (const comment of comments) {
        const words = catalogWordsIn(comment.text, vocabulary)
        if (words.length > 0) {
          naming.push(`${file}:${comment.line}: [${words.join(', ')}]${comment.text}`)
        }
      }
    }

    expect(naming).toEqual([])
  })
})
