// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { ref } from 'vue'
import type { CategoryField } from '@/types/category'
import type { TranslatedString } from '@/types/i18n'

/**
 * БАГ-07 + БАГ-08 (`roo_code/plans/bugs/contract-sync-categories-bugs.md`) — одна и та же
 * дорожка «карточка → провод → мок» правки поля категории, три звена:
 *
 * 1. `CategoryCardPage.vue` (`openEditField`/`submitFieldModal`) — правка одной локали не
 *    обязана заворачивать имя/варианты поля через `toTranslatedString`, теряя две другие.
 * 2. `mockPutCategoryFields` (`./categories.ts`) — слияние ищет прежнее поле по `id`, а не по
 *    позиции в массиве.
 * 3. `putCategoryFields` (`../categoriesService.ts`) — тело запроса не несёт лишний `fieldName`.
 */

// ─── (2) mockPutCategoryFields: слияние по id, не по позиции ────────────────────

import { mockGetCategory, mockPutCategoryFields } from './categories'

describe('mockPutCategoryFields — слияние по id поля', () => {
  it('поле, переставленное в конец, сливается со своим прежним состоянием, а не с соседом', () => {
    const before = mockGetCategory('cat-2')
    const [f1, f2, f3, f4, f5] = before.fields
    if (!f1 || !f2 || !f3 || !f4 || !f5)
      throw new Error('фикстура cat-2 изменилась — обновить тест')

    // f1 переезжает на последнюю позицию (реверс порядка) и несёт ЧАСТИЧНОЕ имя —
    // только английская локаль, как если бы сервер получил делту. Слияние по позиции
    // взяло бы базой то, что раньше стояло на месте f1 в НОВОМ массиве — то есть f5.
    const partialName = { en: `${f1.name.en} (edited)` } as unknown as TranslatedString
    const incoming: CategoryField[] = [f5, f4, f3, f2, { ...f1, name: partialName }].map(
      (f, i) => ({
        ...f,
        order: i,
      }),
    )

    const after = mockPutCategoryFields('cat-2', incoming)
    const updatedF1 = after.find((f) => f.id === 'f-2-1')
    if (!updatedF1) throw new Error('f-2-1 пропало после PUT')

    expect(updatedF1.name.en).toBe(partialName.en)
    // По позиции (старый баг) сюда попали бы ru/lt поля f5 ("Вес на м² …").
    expect(updatedF1.name.ru).toBe(f1.name.ru)
    expect(updatedF1.name.lt).toBe(f1.name.lt)
  })

  it('вариант перечисления сливается со своим прежним состоянием даже когда само поле переставлено', () => {
    const before = mockGetCategory('cat-2')
    const f2 = before.fields.find((f) => f.id === 'f-2-2')
    if (!f2) throw new Error('фикстура cat-2 изменилась — обновить тест')
    const opt0 = f2.options[0]
    const opt1 = f2.options[1]
    const opt2 = f2.options[2]
    if (!opt0 || !opt1 || !opt2) throw new Error('у f-2-2 меньше трёх вариантов — обновить тест')
    const others = before.fields.filter((f) => f.id !== 'f-2-2')

    const partialOption1 = { en: `${opt1.en} (edited)` } as unknown as TranslatedString
    const editedF2: CategoryField = { ...f2, options: [opt0, partialOption1, opt2] }
    // f2 тоже уходит в конец массива — та же переcтановка, что и в предыдущем тесте.
    const incoming = [...others, editedF2].map((f, i) => ({ ...f, order: i }))

    const after = mockPutCategoryFields('cat-2', incoming)
    const updatedF2 = after.find((f) => f.id === 'f-2-2')
    if (!updatedF2) throw new Error('f-2-2 пропало после PUT')

    expect(updatedF2.options[1]?.en).toBe(partialOption1.en)
    expect(updatedF2.options[1]?.ru).toBe(opt1.ru)
    expect(updatedF2.options[1]?.lt).toBe(opt1.lt)
    expect(updatedF2.options[0]).toEqual(opt0)
    expect(updatedF2.options[2]).toEqual(opt2)
  })
})

// ─── (3) putCategoryFields: тело без fieldName ───────────────────────────────────

const H = vi.hoisted(() => ({
  apiPut: vi.fn(async (_path: string, body: unknown) => body),
}))

vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>()
  return { ...actual, apiPut: H.apiPut }
})

describe('putCategoryFields — тело запроса', () => {
  beforeEach(() => {
    H.apiPut.mockClear()
  })

  it('не несёт fieldName и несёт name', async () => {
    const { putCategoryFields } = await import('../categoriesService')
    const fields: CategoryField[] = [
      {
        id: 'f-x',
        name: { ru: 'Имя', en: 'Name', lt: 'Pavadinimas' },
        type: 'text',
        required: false,
        order: 0,
        options: [],
      },
    ]

    await putCategoryFields('cat-1', fields, 'en')

    expect(H.apiPut).toHaveBeenCalledTimes(1)
    const body = H.apiPut.mock.calls[0]?.[1] as { fields: Array<Record<string, unknown>> }
    expect(body.fields[0]).not.toHaveProperty('fieldName')
    expect(body.fields[0]?.name).toEqual({ ru: 'Имя', en: 'Name', lt: 'Pavadinimas' })
  })
})

// ─── (1) CategoryCardPage.vue: правка поля не стирает другие локали ──────────────

const F = vi.hoisted(() => ({
  locale: { value: 'en' as string },
  updateField: vi.fn(),
  addField: vi.fn(),
  localFields: [] as CategoryField[],
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'cat-1' } }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: F.locale }),
}))

vi.mock('@/services/categoriesService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../categoriesService')>()
  return {
    ...actual,
    getCategories: vi.fn(async () => ({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
      totalPages: 0,
    })),
  }
})

vi.mock('@/composables/useCategoryCard', () => ({
  useCategoryCard: () => ({
    category: ref(null),
    loading: ref(false),
    saving: ref(false),
    error: ref(null),
    form: ref({ name: null, parentId: null, description: null }),
    localFields: ref(F.localFields),
    linkedSuppliers: ref([]),
    suppliersList: ref([]),
    isAnythingDirty: ref(false),
    load: vi.fn(),
    save: vi.fn(),
    discard: vi.fn(),
    addField: F.addField,
    updateField: F.updateField,
    deleteField: vi.fn(),
    reorderFields: vi.fn(),
    addLinkedSupplier: vi.fn(),
    removeLinkedSupplier: vi.fn(),
    tf: (value: TranslatedString | null | undefined) =>
      value ? value[F.locale.value as keyof TranslatedString] || value.en || '' : '',
  }),
}))

function click(el: Element | null) {
  if (!el) {
    throw new Error('элемент не найден')
  }
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

function setInputValue(el: Element | null, value: string) {
  if (!el) {
    throw new Error('элемент не найден')
  }
  const input = el as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('CategoryCardPage — правка поля категории сохраняет остальные локали', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    F.locale.value = 'en'
    F.updateField.mockClear()
    F.addField.mockClear()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  async function mountPage() {
    const { default: CategoryCardPage } =
      await import('../../views/admin/products/CategoryCardPage.vue')
    wrapper = mount(CategoryCardPage, {
      attachTo: document.body,
      global: {
        stubs: { 'router-link': { template: '<a><slot /></a>' } },
        directives: { tooltip: {} },
      },
    })
    return wrapper
  }

  it('правка имени поля в одной локали оставляет две другие прежними', async () => {
    const original: CategoryField = {
      id: 'f-1-1',
      name: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' },
      type: 'text',
      required: true,
      order: 0,
      options: [],
    }
    F.localFields = [original]

    await mountPage()

    click(document.body.querySelector('[data-test="category-field-row"] button.action-edit'))
    setInputValue(
      document.body.querySelector('[data-test="field-name-input"]'),
      'Steel grade EN edited',
    )
    click(document.body.querySelector('[data-test="field-modal-submit"]'))

    expect(F.updateField).toHaveBeenCalledTimes(1)
    const call = F.updateField.mock.calls[0] as [string, { name: TranslatedString }]
    expect(call[0]).toBe('f-1-1')
    expect(call[1].name.en).toBe('Steel grade EN edited')
    expect(call[1].name.ru).toBe('Марка стали')
    expect(call[1].name.lt).toBe('Plieno markė')
  })

  it('сохранение поля с вариантами перечисления не стирает переводы нетронутых вариантов', async () => {
    const original: CategoryField = {
      id: 'f-2-2',
      name: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' },
      type: 'enum',
      required: false,
      order: 0,
      options: [
        { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' },
        { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' },
      ],
    }
    F.localFields = [original]

    await mountPage()

    // Открыть и сохранить, не трогая варианты вовсе — именно так БАГ-08 стирал
    // переводы: заворачивал ВСЕ варианты через toTranslatedString при любом сохранении.
    click(document.body.querySelector('[data-test="category-field-row"] button.action-edit'))
    click(document.body.querySelector('[data-test="field-modal-submit"]'))

    expect(F.updateField).toHaveBeenCalledTimes(1)
    const call = F.updateField.mock.calls[0] as [string, { options: TranslatedString[] }]
    expect(call[1].options[0]).toEqual(original.options[0])
    expect(call[1].options[1]).toEqual(original.options[1])
  })
})
