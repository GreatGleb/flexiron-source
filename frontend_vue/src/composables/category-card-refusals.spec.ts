// @vitest-environment happy-dom
/**
 * Два долга карточки категории, у обоих один и тот же корень — значение с двумя
 * владельцами.
 *
 * (1) Отказ сервиса. Мок домена бросает `ApiRequestError` с кодом `CATEGORY_NOT_FOUND`
 * (`services/mocks/categories.ts:1421`, `:1469`, `:1507`), а карточка раньше читала
 * `e.message` — чужую фразу сервера — вместо кода. Фраза здесь намеренно не содержит
 * кода: чтение текста на ней обязано промахнуться, иначе тест был бы зелёным и до
 * правки (питфолл #68, verify.md Л9).
 *
 * (2) Перечень типов поля. Раньше он был объявлен дважды: типом `CategoryFieldType` в
 * `types/category.ts` и массивом `FIELD_TYPES` в `CategoryCardPage.vue`. Источник
 * теперь один — `CATEGORY_FIELD_TYPES`, кортеж `as const`, из которого выводится сам
 * тип; `CategoryCardPage.vue` строит опции селектора из этого же массива (см. импорт
 * там), так что проверка константы здесь — проверка того, что видит карточка.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'
import { translations } from '@/i18n/translations'
import { ApiRequestError } from '@/types/api'
import { mergeLocaleValue } from '@/types/i18n'
import { CATEGORY_FIELD_TYPES } from '@/types/category'
import type { Category } from '@/types/category'
import * as categoriesService from '@/services/categoriesService'
import * as suppliersService from '@/services/suppliersService'

vi.mock('@/services/categoriesService', () => ({
  getCategory: vi.fn(),
  patchCategory: vi.fn(),
  putCategoryFields: vi.fn(),
}))

vi.mock('@/services/suppliersService', () => ({
  getSuppliers: vi.fn(),
}))

import { useCategoryCard } from './useCategoryCard'
import { useToast } from './useToast'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: translations,
})

/** Композабл зовёт `useI18n()`, а тот требует setup — отсюда обёртка, а не прямой вызов. */
function inSetup<T>(factory: () => T): T {
  let result!: T
  mount(
    {
      setup() {
        result = factory()
        return () => null
      },
    },
    { global: { plugins: [i18n] } },
  )
  return result
}

/**
 * Перевод, а не ключ. `i18n.global.t('нет.такого.ключа')` возвращает САМ КЛЮЧ, и
 * сравнение с ключом осталось бы зелёным даже без перевода. Бросок на `value === key`
 * заодно доказывает, что ключ перевода существует.
 */
function t(key: string): string {
  const value = i18n.global.t(key)
  if (value === key) throw new Error(`перевода нет: ${key}`)
  return value
}

/** Отказ в той форме, что присылает настоящий сервер: код в поле, фраза — чужая. */
function отказ(code: string, фраза: string): ApiRequestError {
  return new ApiRequestError({ status: 404, message: фраза, code })
}

const CATEGORY: Category = {
  id: 'cat-1',
  name: { ru: 'Категория', en: 'Category', lt: 'Kategorija' },
  parentId: null,
  description: null,
  fieldCount: 0,
  productCount: 0,
  inheritedFields: [],
  fields: [],
  linkedSuppliers: [],
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(suppliersService.getSuppliers).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 999,
    totalPages: 0,
  } as never)
})

describe('useCategoryCard · отказ сервиса читается кодом, не текстом исключения', () => {
  it('load() — CATEGORY_NOT_FOUND становится переводом, фраза сервера в error не попадает', async () => {
    const фраза = 'a sentence the mock threw that names no key at all'
    vi.mocked(categoriesService.getCategory).mockRejectedValue(отказ('CATEGORY_NOT_FOUND', фраза))

    const c = inSetup(() => useCategoryCard('cat-1'))
    await c.load()

    expect(c.error.value).not.toBe(фраза)
    expect(c.error.value).toBe(t('categories.toast_error_not_found'))
  })

  it('save() — CATEGORY_NOT_FOUND показывается тостом как перевод, а не текст исключения', async () => {
    const фраза = 'another sentence that never reaches the user verbatim'
    vi.mocked(categoriesService.getCategory).mockResolvedValue(structuredClone(CATEGORY))

    const c = inSetup(() => useCategoryCard('cat-1'))
    await c.load()

    c.form.value.name = mergeLocaleValue(c.form.value.name, 'Renamed', 'en')
    await nextTick()

    vi.mocked(categoriesService.patchCategory).mockRejectedValue(отказ('CATEGORY_NOT_FOUND', фраза))

    const toast = useToast()
    const before = toast.toasts.length
    await c.save()
    const last = toast.toasts[toast.toasts.length - 1]

    expect(toast.toasts.length).toBe(before + 1)
    expect(last?.message).not.toBe(фраза)
    expect(last?.message).toBe(t('categories.toast_error_not_found'))
  })
})

describe('types/category · перечень типов поля — один источник', () => {
  it('CATEGORY_FIELD_TYPES — ровно семь значений, в том же порядке, в каком их строит карточка', () => {
    expect(CATEGORY_FIELD_TYPES).toEqual([
      'text',
      'number',
      'boolean',
      'enum',
      'email',
      'date',
      'file',
    ])
  })
})
