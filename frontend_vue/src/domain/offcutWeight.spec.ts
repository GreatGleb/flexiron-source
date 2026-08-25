import { describe, it, expect } from 'vitest'
import { DENSITY_FIELD_ID, productDensityKgM3, resolveOffcutWeight } from './cutting'
import { mockGetProduct, mockGetProducts } from '@/services/mocks/products'

/**
 * Вес обрезка выводится, а не хранится — и двумя путями, по природе куска.
 *
 * Отдельный файл, потому что здесь читается каталог: vitest изолирует модули по файлам,
 * и сторонний тест, подрезавший товары, не должен менять эти числа.
 */

const ALL = {
  search: '',
  categoryIds: [] as string[],
  sortBy: null,
  sortDir: 'asc' as const,
  page: 1,
  pageSize: 500,
}

describe('страховка: id поля плотности', () => {
  it('f-1-3 по-прежнему указывает на плотность, и только на неё', async () => {
    // Магическая строка в коде держится этим тестом. Уведут id — вывод веса сломается
    // ТИХО: «поля нет» превратится в «веса нет», а не в ошибку.
    const list = await mockGetProducts(ALL)
    const namesUnderId = new Set<string>()
    const idsUnderName = new Set<string>()
    for (const item of list.items) {
      const p = await mockGetProduct(item.id)
      for (const f of p.fieldValues) {
        if (f.fieldId === DENSITY_FIELD_ID) namesUnderId.add(f.fieldName.ru)
        if (f.fieldName.ru === 'Плотность (кг/м³)') idsUnderName.add(f.fieldId)
      }
    }
    expect([...namesUnderId]).toEqual(['Плотность (кг/м³)'])
    expect([...idsUnderName]).toEqual([DENSITY_FIELD_ID])
    // И плотность действительно читается — иначе тест выше проверял бы пустое множество.
    const steel = await mockGetProduct('prod-001')
    expect(productDensityKgM3(steel)).toBe(7850)
  })
})

describe('лист: размеры куска × плотность', () => {
  it('500×300×2 из стали — 2.355 кг', async () => {
    const product = await mockGetProduct('prod-001')
    const result = resolveOffcutWeight({
      offcut: { quantity: 1, offcutType: 'sheet', lengthMm: 500, widthMm: 300, thicknessMm: 2 },
      product,
    })
    expect(result).toMatchObject({ ok: true, weightKg: 2.355, source: 'geometry' })
  })

  it('материал берётся у товара ПАРТИИ: титан весит меньше стали при тех же размерах', async () => {
    // prod-020 «Титановый лист 2мм Grade 5» — плотность 4430 против 7850 у стали.
    const titanium = await mockGetProduct('prod-020')
    const steel = await mockGetProduct('prod-001')
    const dims = {
      quantity: 1,
      offcutType: 'sheet' as const,
      lengthMm: 900,
      widthMm: 450,
      thicknessMm: 2,
    }
    const ti = resolveOffcutWeight({ offcut: dims, product: titanium })
    const st = resolveOffcutWeight({ offcut: dims, product: steel })
    expect(ti).toMatchObject({ ok: true, weightKg: 3.5883 })
    expect(st).toMatchObject({ ok: true, weightKg: 6.3585 })
    // Подмена материала — это не округление, а разница в 1.8 раза.
    expect(st.ok && ti.ok && st.weightKg / ti.weightKg).toBeGreaterThan(1.7)
  })

  it('нет плотности — отказ, а не ноль', async () => {
    const result = resolveOffcutWeight({
      offcut: { quantity: 1, offcutType: 'sheet', lengthMm: 500, widthMm: 300, thicknessMm: 2 },
      product: { fieldValues: [] },
    })
    expect(result).toEqual({ ok: false, reason: 'no_density' })
  })
})

describe('линейный кусок: размер в единице партии × кг на единицу', () => {
  it('труба 2500 мм с партии в метрах — 2.5 м × 11.71 кг/м', async () => {
    const product = await mockGetProduct('prod-004')
    expect(product.weightPerWarehouseUnitKg).toBe(11.71)
    const result = resolveOffcutWeight({
      offcut: { quantity: 1, offcutType: 'linear', lengthMm: 2500 },
      product,
    })
    expect(result).toMatchObject({ ok: true, weightKg: 29.275, source: 'per-unit-weight' })
  })

  it('нет кг на единицу — отказ; молчаливый ноль соврал бы, что кусок ничего не весит', async () => {
    const product = await mockGetProduct('prod-001')
    expect(product.weightPerWarehouseUnitKg).toBeNull()
    const result = resolveOffcutWeight({
      offcut: { quantity: 1, offcutType: 'linear', lengthMm: 2500 },
      product,
    })
    expect(result).toEqual({ ok: false, reason: 'no_per_unit_weight' })
  })

  it('складская единица товара вне таблицы размеров — свой отказ', async () => {
    // Знаменатель коэффициента задан складской единицей ТОВАРА. Если она не из таблицы
    // (или её нет), размер куска в этой единице не выражается — и это отказ, а не
    // подстановка единицы партии: на такой подстановке расчёт однажды замкнулся сам
    // на себя (кусок 0.5 кг «весил» 0.54).
    const product = await mockGetProduct('prod-004')
    const result = resolveOffcutWeight({
      offcut: { quantity: 1, offcutType: 'linear', lengthMm: 2500 },
      product: { ...product, warehouseUomId: 'uom-m3' },
    })
    expect(result).toEqual({ ok: false, reason: 'unit_not_supported' })
  })

  it('у товара нет складской единицы — тот же отказ, а не догадка', async () => {
    const product = await mockGetProduct('prod-004')
    const result = resolveOffcutWeight({
      offcut: { quantity: 1, offcutType: 'linear', lengthMm: 2500 },
      product: { ...product, warehouseUomId: null },
    })
    expect(result).toEqual({ ok: false, reason: 'unit_not_supported' })
  })
})

describe('путь выбирается по ЗАЯВЛЕННОМУ типу, а не по заполненным полям', () => {
  it('линейный кусок с заполненными шириной и толщиной весит по кг/м, а не по геометрии', async () => {
    // Форма создания даёт оператору все три поля независимо от типа. Заполнил ширину
    // 100 и стенку 5 у отрезка ТРУБЫ — геометрия посчитала бы сплошную плиту:
    // 2.5 м × 100 мм × 5 мм × 7850 = 9.8125 кг. Правильный ответ — кольцо, то есть
    // заявленные 11.71 кг/м × 2.5 м = 29.275. Разница втрое, и она видна сразу.
    const product = await mockGetProduct('prod-004')
    const result = resolveOffcutWeight({
      offcut: {
        quantity: 1,
        offcutType: 'linear',
        lengthMm: 2500,
        widthMm: 100,
        thicknessMm: 5,
      },
      product,
    })
    expect(result).toMatchObject({ ok: true, source: 'per-unit-weight', weightKg: 29.275 })
    // И это не «примерно то же»: геометрия дала бы 9.8125.
    expect(result.ok && result.weightKg).not.toBeCloseTo(9.8125, 2)
  })

  it('тип не объявлен — отказ, а не «попробуем геометрию»', async () => {
    const product = await mockGetProduct('prod-001')
    const result = resolveOffcutWeight({
      offcut: { quantity: 1, lengthMm: 500, widthMm: 300, thicknessMm: 2 },
      product,
    })
    expect(result).toEqual({ ok: false, reason: 'no_offcut_type' })
  })

  it('лист без толщины — отказ по размерам, а не подстановка кг/м', async () => {
    const product = await mockGetProduct('prod-004')
    const result = resolveOffcutWeight({
      offcut: { quantity: 1, offcutType: 'sheet', lengthMm: 2500, widthMm: 100 },
      product,
    })
    expect(result).toEqual({ ok: false, reason: 'no_dimensions' })
  })

  it('в сидах тип и наличие размеров сегодня совпадают — правка меняет основание, не числа', async () => {
    const { mockOffcuts } = await import('@/mocks/warehouse-offcuts')
    const sheets = mockOffcuts.filter((o) => o.offcutType === 'sheet')
    const linear = mockOffcuts.filter((o) => o.offcutType === 'linear')
    expect(sheets.length).toBe(6)
    expect(linear.length).toBe(7)
    // Все листы несут все три размера, все линейные — без ширины и толщины.
    expect(sheets.every((o) => o.lengthMm && o.widthMm && o.thicknessMm)).toBe(true)
    expect(linear.every((o) => o.widthMm === null && o.thicknessMm === null)).toBe(true)
  })
})
