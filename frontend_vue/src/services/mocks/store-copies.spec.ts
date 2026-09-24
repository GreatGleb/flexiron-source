import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { getProduct, patchProduct } from '@/services/productsService'
import {
  mockGetProduct,
  mockGetProducts,
  mockCreateProduct,
  mockPatchProduct,
} from '@/services/mocks/products'
import {
  serviceById,
  allServices,
  mockGetService,
  mockGetServices,
  mockCreateService,
  mockPatchService,
} from '@/services/mocks/services'
import type { Product } from '@/types/product'

/**
 * БАГ-05 домена товаров и БАГ-08 домена услуг: оба мока отдавали наружу тот же
 * объект (или объект с общим вложенным `TranslatedString`), что лежит в их
 * `STORE`. Вызывающий правил стор мимо всякого запроса — то, что против
 * настоящего REST-сервера невозможно в принципе.
 *
 * Образец — «лента отдаёт копию» в `bcc-history-rows.spec.ts`: получить запись,
 * испортить её, запросить заново, убедиться, что испорченное не долетело.
 */

describe('товары: мок отдаёт копию, а не ссылку в свой стор', () => {
  it('чтение — правка полученного товара не меняет запись на «сервере»', async () => {
    const first = await mockGetProduct('prod-001')
    const originalNameEn = first.name.en
    const originalPrice = first.price

    first.name.en = 'MUTATED'
    first.price = -1

    const second = await mockGetProduct('prod-001')
    expect(second.name.en).toBe(originalNameEn)
    expect(second.price).toBe(originalPrice)
  })

  it('создание — порча возвращённого товара не меняет содержимое хранилища', async () => {
    const created = await mockCreateProduct({
      name: 'Store copy check',
      categoryId: 'cat-2',
    })
    const originalNameEn = created.name.en

    created.name.en = 'MUTATED'
    created.price = -1

    const fetched = await mockGetProduct(created.id)
    expect(fetched.name.en).toBe(originalNameEn)
    expect(fetched.price).toBeNull()
  })

  it('патч — порча возвращённого товара не меняет запись на «сервере»', async () => {
    const patched = await mockPatchProduct('prod-002', { price: 77 })
    const originalNameEn = patched.name.en

    patched.name.en = 'MUTATED'
    patched.price = -1

    const fetched = await mockGetProduct('prod-002')
    expect(fetched.name.en).toBe(originalNameEn)
    expect(fetched.price).toBe(77)
  })

  it('списочная запись не делит TranslatedString имени со стором', async () => {
    const params = {
      page: 1,
      pageSize: 5,
      search: '',
      categoryIds: [] as string[],
      sortBy: null,
      sortDir: 'asc' as const,
    }
    const first = await mockGetProducts(params)
    const item = first.items[0]!
    const originalNameEn = item.name.en
    const originalCategoryNameEn = item.categoryName?.en

    item.name.en = 'MUTATED'
    if (item.categoryName) item.categoryName.en = 'MUTATED'

    const second = await mockGetProducts(params)
    expect(second.items[0]!.name.en).toBe(originalNameEn)
    expect(second.items[0]!.categoryName?.en).toBe(originalCategoryNameEn)
  })
})

describe('услуги: мок отдаёт копию, а не ссылку в свой стор', () => {
  it('serviceById отдаёт копию', () => {
    const first = serviceById('svc-001')!
    const originalNameEn = first.name.en

    first.name.en = 'MUTATED'

    const second = serviceById('svc-001')!
    expect(second.name.en).toBe(originalNameEn)
  })

  it('allServices отдаёт копии, а не общий массив стора', () => {
    const first = allServices()
    const originalNameEn = first[0]!.name.en

    first[0]!.name.en = 'MUTATED'

    const second = allServices()
    expect(second[0]!.name.en).toBe(originalNameEn)
  })

  it('чтение — правка полученной услуги не меняет запись на «сервере»', async () => {
    const first = await mockGetService('svc-001')
    const originalNameEn = first.name.en
    const originalCostPrice = first.costPrice

    first.name.en = 'MUTATED'
    first.costPrice = -1

    const second = await mockGetService('svc-001')
    expect(second.name.en).toBe(originalNameEn)
    expect(second.costPrice).toBe(originalCostPrice)
  })

  it('создание — порча возвращённой услуги не меняет содержимое хранилища', async () => {
    const created = await mockCreateService({
      name: 'Store copy check',
      costPrice: 1,
      sellingPrice: 2,
      currencyId: 'cur-eur',
      uomId: 'uom-pcs',
    })
    const originalNameEn = created.name.en

    created.name.en = 'MUTATED'
    created.costPrice = -1

    const fetched = await mockGetService(created.id)
    expect(fetched.name.en).toBe(originalNameEn)
    expect(fetched.costPrice).toBe(1)
  })

  it('патч — порча возвращённой услуги не меняет запись на «сервере»', async () => {
    const patched = await mockPatchService('svc-002', { costPrice: 55 })
    const originalNameEn = patched.name.en

    patched.name.en = 'MUTATED'
    patched.costPrice = -1

    const fetched = await mockGetService('svc-002')
    expect(fetched.name.en).toBe(originalNameEn)
    expect(fetched.costPrice).toBe(55)
  })

  it('списочная запись не делит TranslatedString имени со стором', async () => {
    const filters = { search: '', sortBy: '', sortDir: '' }
    const pagination = { page: 1, pageSize: 5 }
    const first = await mockGetServices(filters, pagination)
    const item = first.items[0]!
    const originalNameEn = item.name.en

    item.name.en = 'MUTATED'

    const second = await mockGetServices(filters, pagination)
    expect(second.items[0]!.name.en).toBe(originalNameEn)
  })
})

/**
 * Блокер, найденный приёмкой ночи 2026-09-23 и не пойманный ни юнит-, ни e2e-проверками:
 * копия в моке делается `structuredClone`, а карточка товара строит `delta.fieldValues`
 * прямо из `product.value` — глубоко реактивного `ref`, — так что в мок приезжают
 * Vue-прокси. `structuredClone` на прокси бросает `DataCloneError` (питфолл #36), и
 * сохранение кастомных полей товара под моками ломается целиком.
 *
 * Тест идёт настоящим путём карточки — `patchProduct` → `apiPatch` → мок, — а не зовёт
 * мок напрямую: чинит это транспорт (`overTheWire` в `api.ts`), и проверять надо его.
 * Единственный e2e про динамические поля правит поле и смотрит только, что кнопка Save
 * стала активной; Save он не нажимает, поэтому падения не видел никто.
 */
describe('мок переживает то, что присылает реактивная карточка', () => {
  it('патч с fieldValues из реактивного источника не роняет сохранение', async () => {
    const product = ref<Product>(await getProduct('prod-001'))
    // Как в useProductCard: свойства читаются сквозь прокси, вложенный
    // `fieldName` остаётся реактивным и доезжает до мока.
    const fieldValues = product.value.fieldValues.map((fv) => ({ ...fv, value: 4 }))

    const patched = await patchProduct('prod-001', { fieldValues }, 'en')

    // Без этой строки тест устраивает пустой набор полей: вызов не упал бы, потому
    // что клонировать было бы нечего, — питфолл #66.
    expect(fieldValues.length).toBeGreaterThan(0)
    expect(patched.fieldValues).toHaveLength(fieldValues.length)
    expect(patched.fieldValues[0]!.value).toBe(4)
    expect(patched.fieldValues[0]!.fieldName).toEqual(product.value.fieldValues[0]!.fieldName)
  })
})
