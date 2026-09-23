import { describe, it, expect } from 'vitest'
import { mockGetCategory, mockPatchCategory, mockPutCategoryFields } from './categories'
import { ApiRequestError } from '@/types/api'

/**
 * Отказ на неизвестный id категории — `ApiRequestError` с кодом в ПОЛЕ `code` и
 * статусом 404 (`roo_code/roo-context/api/categories.md:71`), как у настоящего
 * сервера. До этой правки `mockGetCategory` бросал голый `Error` без кода вовсе
 * (БАГ-04, `categories.md:534`), а `mockPatchCategory`/`mockPutCategoryFields`
 * бросали `Error('CATEGORY_NOT_FOUND')` — код лежал в `message`, а не в `code`,
 * и ветка отказа, проверяющая `err.code`, до него бы не дотянулась.
 *
 * Проба судит по ПОЛЯМ, а не по подстроке в тексте: `throw new
 * Error('CATEGORY_NOT_FOUND')` проходит `unknown-id-is-refused.spec.ts` (тот
 * матчит по `message`), но здесь `instanceof ApiRequestError` падает — красная
 * проба и есть доказательство, что поле, а не текст, теперь несёт код.
 */

const UNKNOWN = 'no-such-category-ever'

/** Отказ обязан быть `ApiRequestError` с полем `code`; успех — провал пробы. */
function refusalOf(run: () => unknown): ApiRequestError {
  try {
    run()
  } catch (e) {
    expect(e).toBeInstanceOf(ApiRequestError)
    return e as ApiRequestError
  }
  throw new Error('мок ответил успехом там, где обязан был отказать')
}

describe('категория: отказ на неизвестный id несёт код и статус полями', () => {
  it('GET — mockGetCategory отказывает CATEGORY_NOT_FOUND/404', () => {
    const e = refusalOf(() => mockGetCategory(UNKNOWN))

    expect(e.code).toBe('CATEGORY_NOT_FOUND')
    expect(e.status).toBe(404)
    // Текст сообщения — прежний, дословно (unknown-id-is-refused.spec.ts его не проверяет,
    // но БАГ-04 был именно про то, что кода не было НИГДЕ, включая текст).
    expect(e.message).toBe(`Category ${UNKNOWN} not found`)
  })

  it('PATCH — mockPatchCategory отказывает CATEGORY_NOT_FOUND/404', () => {
    const e = refusalOf(() => mockPatchCategory(UNKNOWN, { description: null }))

    expect(e.code).toBe('CATEGORY_NOT_FOUND')
    expect(e.status).toBe(404)
    expect(e.message).toBe('CATEGORY_NOT_FOUND')
  })

  it('PUT fields — mockPutCategoryFields отказывает CATEGORY_NOT_FOUND/404', () => {
    const e = refusalOf(() => mockPutCategoryFields(UNKNOWN, []))

    expect(e.code).toBe('CATEGORY_NOT_FOUND')
    expect(e.status).toBe(404)
    expect(e.message).toBe('CATEGORY_NOT_FOUND')
  })
})
