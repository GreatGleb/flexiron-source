import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Общий сторож по всему каталогу `services/mocks`: ни один модуль (кроме `*.spec.ts`)
 * не бросает голый `throw new Error(` — отказ обязан быть `ApiRequestError` с кодом в
 * поле `code`, а не строкой внутри `message` (§2 соглашений `00-conventions.md`,
 * правило живёт в `apiErrorCode.ts`).
 *
 * Список файлов не зашит: каталог читается на каждом прогоне через `readdirSync`,
 * поэтому новый модуль попадает под правило сам, без правки этого файла.
 *
 * От `orders-refusals.spec.ts:62-66` (проба по одному файлу — `orders.ts`) этот сторож
 * отличается охватом: он ловит нарушение в ЛЮБОМ модуле каталога, не только в заказах.
 * Дублирование безвредно — обе пробы читают исходник и не пересекаются побочными эффектами.
 */
const MOCKS_DIR = resolve(process.cwd(), 'src/services/mocks')

const modules = readdirSync(MOCKS_DIR).filter(
  (name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'),
)

describe('каталог моков не бросает голый Error', () => {
  it('обходит каталог сам, а не по зашитому списку', () => {
    // Если readdirSync когда-нибудь вернёт пусто (не тот cwd, каталог переехал),
    // it.each ниже пройдёт по нулю файлов и молча зазеленеет — ничего не проверив.
    expect(modules.length).toBeGreaterThan(10)
  })

  it.each(modules)('%s не бросает голый throw new Error(', (fileName) => {
    const path = resolve(MOCKS_DIR, fileName)
    const source = readFileSync(path, 'utf8')
    const offenders = source
      .split('\n')
      .map((line, idx) => ({ line, number: idx + 1 }))
      .filter(({ line }) => line.includes('throw new Error('))
      .map(({ number }) => `${fileName}:${number}`)

    expect(
      offenders,
      offenders.length > 0
        ? `голый throw new Error( найден: ${offenders.join(', ')} — код обязан лежать в ApiRequestError.code`
        : undefined,
    ).toEqual([])
  })
})
