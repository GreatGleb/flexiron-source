import { describe, it, expect } from 'vitest'
import {
  LINEAR_BATCH_UNITS,
  offcutAreaM2,
  MATERIAL_ERROR_CODE,
  SUPPORTED_BATCH_UNITS,
  computeCuttingConsumption,
  cutCount,
  isLinearBatchUnit,
  kerfInBatchUnit,
  resolveOffcutMaterial,
  resolvePieceSize,
  type ConsumptionResult,
  type CuttingConsumption,
} from './cutting'
import { mockBatches } from '@/mocks/warehouse-batches'
import { mockOffcuts } from '@/mocks/warehouse-offcuts'

/**
 * Резка: списание = материал кусков + пропилы + отходы.
 *
 * До этого списывался `quantity` обрезка — СЧЁТЧИК КУСКОВ, — и пропил не списывался
 * вовсе. Единственная находка склада, которая портит данные молча.
 */

/** Разворачивает успешный результат, падая с внятным текстом на отказе. */
function ok(result: ConsumptionResult): CuttingConsumption {
  if (!result.ok) throw new Error(`expected success, got ${result.reason} (${result.detail})`)
  return result
}

describe('пример из ТЗ', () => {
  it('купили 2500 мм — с партии ушло 2503 мм', () => {
    // Process 2.2 §2. Партия в метрах, кусок один, его длина 2500 мм.
    const result = ok(
      computeCuttingConsumption({
        offcuts: [{ quantity: 1, lengthMm: 2500 }],
        kerfMm: 3,
        wasteQuantity: 0,
        unit: 'm',
      }),
    )
    expect(result.cuts).toBe(1)
    expect(result.offcutTotal).toBe(2.5)
    expect(result.kerfTotal).toBe(0.003)
    expect(result.consumed).toBe(2.503)
  })
})

describe('размер куска: счётчик кусков и материал — разные величины', () => {
  it('метровая партия берёт длину, а не счётчик', () => {
    // Это и есть пойманный баг: «1 шт» из партии в метрах — не один метр.
    const resolved = resolveOffcutMaterial({ quantity: 1, lengthMm: 500 }, 'm')
    expect(resolved).toMatchObject({ ok: true, pieces: 1, pieceSize: 0.5, material: 0.5 })
  })

  it('три куска по 500 мм — это три реза и полтора метра', () => {
    const resolved = resolveOffcutMaterial({ quantity: 3, lengthMm: 500 }, 'm')
    expect(resolved).toMatchObject({ ok: true, pieces: 3, material: 1.5 })
    expect(cutCount([{ quantity: 3 }])).toBe(3)
  })

  it('пять строк геометрии считают из размеров', () => {
    expect(resolvePieceSize({ quantity: 1, lengthMm: 2500 }, 'm')).toMatchObject({ pieceSize: 2.5 })
    expect(resolvePieceSize({ quantity: 1, lengthMm: 2500 }, 'mm')).toMatchObject({
      pieceSize: 2500,
    })
    expect(resolvePieceSize({ quantity: 1, lengthMm: 2000, widthMm: 1000 }, 'm2')).toMatchObject({
      pieceSize: 2,
    })
    expect(resolvePieceSize({ quantity: 1 }, 'pcs')).toMatchObject({ pieceSize: 1 })
  })

  it('kg и t стоят на весе — единственные две строки, где размер не геометрия', () => {
    expect(resolvePieceSize({ quantity: 1, weightKg: 12.5 }, 'kg')).toMatchObject({
      pieceSize: 12.5,
    })
    expect(resolvePieceSize({ quantity: 1, weightKg: 1200 }, 't')).toMatchObject({ pieceSize: 1.2 })
  })

  it('штучная партия сворачивает формулу в ту, что была: материал = счётчик', () => {
    const resolved = resolveOffcutMaterial({ quantity: 4 }, 'pcs')
    expect(resolved).toMatchObject({ ok: true, material: 4 })
  })
})

describe('три отказа вместо значений по умолчанию', () => {
  it('единица партии не из таблицы — отказ, а не «как штуки»', () => {
    // m3 в справочнике есть, среди партий его нет, формулы для него у нас нет.
    const resolved = resolvePieceSize({ quantity: 1, lengthMm: 500 }, 'm3')
    expect(resolved).toEqual({ ok: false, reason: 'unit_not_supported', detail: 'm3' })
    expect(resolvePieceSize({ quantity: 1 }, 'парсеки')).toMatchObject({
      reason: 'unit_not_supported',
    })
  })

  it('отказ по единице переживает пустой список кусков', () => {
    // «Нечего резать» — не повод согласиться с партией, которую мы не умеем считать.
    const result = computeCuttingConsumption({
      offcuts: [],
      kerfMm: 0,
      wasteQuantity: 0,
      unit: 'm3',
    })
    expect(result).toMatchObject({ ok: false, reason: 'unit_not_supported', offcutIndex: -1 })
  })

  it('нет нужного размера — отказ; молчаливый ноль оставил бы металл в системе навсегда', () => {
    expect(resolvePieceSize({ quantity: 1, lengthMm: null }, 'm')).toEqual({
      ok: false,
      reason: 'dimension_missing',
      detail: 'lengthMm',
    })
    expect(resolvePieceSize({ quantity: 1, weightKg: null }, 'kg')).toMatchObject({
      detail: 'weightKg',
    })
    expect(resolvePieceSize({ quantity: 1, lengthMm: 2000, widthMm: null }, 'm2')).toMatchObject({
      detail: 'widthMm',
    })
    // Отсутствующее поле и ноль непригодны одинаково: кусок нулевой длины не
    // забирает с партии ничего.
    expect(resolvePieceSize({ quantity: 1 }, 'm')).toMatchObject({ reason: 'dimension_missing' })
    expect(resolvePieceSize({ quantity: 1, lengthMm: 0 }, 'm')).toMatchObject({
      reason: 'dimension_missing',
    })
    expect(resolvePieceSize({ quantity: 1, lengthMm: Number.NaN }, 'm')).toMatchObject({
      reason: 'dimension_missing',
    })
  })

  it('размер, ненужный для этой единицы, не требуется', () => {
    // Вес не нужен метровой партии, длина — килограммовой.
    expect(resolvePieceSize({ quantity: 1, lengthMm: 500 }, 'm').ok).toBe(true)
    expect(resolvePieceSize({ quantity: 1, weightKg: 3 }, 'kg').ok).toBe(true)
  })

  it('дробный или нулевой счётчик кусков — отказ', () => {
    // Тот же провал, что с длиной, только с другой стороны: 2.5 куска не бывает.
    expect(resolvePieceSize({ quantity: 2.5, lengthMm: 500 }, 'm')).toEqual({
      ok: false,
      reason: 'pieces_not_integer',
      detail: '2.5',
    })
    expect(resolvePieceSize({ quantity: 0, lengthMm: 500 }, 'm')).toMatchObject({
      reason: 'pieces_not_integer',
    })
    expect(resolvePieceSize({ quantity: -1, lengthMm: 500 }, 'm')).toMatchObject({
      reason: 'pieces_not_integer',
    })
    expect(resolvePieceSize({ quantity: Number.NaN, lengthMm: 500 }, 'm')).toMatchObject({
      reason: 'pieces_not_integer',
    })
  })

  it('отказ называет номер куска — резка проводка одна, половины не будет', () => {
    const result = computeCuttingConsumption({
      offcuts: [{ quantity: 1, lengthMm: 500 }, { quantity: 1 }],
      kerfMm: 3,
      wasteQuantity: 0,
      unit: 'm',
    })
    expect(result).toMatchObject({ ok: false, reason: 'dimension_missing', offcutIndex: 1 })
  })

  it('у каждой причины отказа есть код ошибки для мока', () => {
    expect(MATERIAL_ERROR_CODE).toEqual({
      unit_not_supported: 'BATCH_UNIT_NOT_SUPPORTED',
      dimension_missing: 'OFFCUT_DIMENSION_MISSING',
      pieces_not_integer: 'OFFCUT_PIECES_NOT_INTEGER',
    })
  })
})

describe('число резов', () => {
  it('по одному на каждый кусок, а не на строку и не на метр', () => {
    expect(cutCount([{ quantity: 3 }])).toBe(3)
    expect(cutCount([{ quantity: 1 }, { quantity: 2 }])).toBe(3)
  })

  it('переоценивает на один рез при ровном расходе — так и задумано', () => {
    // Пруток 6000 распустили на два по 3000: физически рез один, здесь их два.
    // Направление ошибки выбрано: переоценка прячет металл, который найдётся,
    // недооценка обещает металл, которого нет. Если этот тест позеленел на 1 —
    // кто-то «починил» формулу на N−1, чего делать нельзя.
    const result = ok(
      computeCuttingConsumption({
        offcuts: [{ quantity: 2, lengthMm: 3000 }],
        kerfMm: 3,
        wasteQuantity: 0,
        unit: 'm',
      }),
    )
    expect(result.cuts).toBe(2)
    expect(result.offcutTotal).toBe(6)
    expect(result.kerfTotal).toBe(0.006)
  })
})

describe('пропил считается только там, где единица меряет длину', () => {
  it('метр и миллиметр — да, вес, штуки и площадь — нет', () => {
    expect(isLinearBatchUnit('m')).toBe(true)
    expect(isLinearBatchUnit('mm')).toBe(true)
    expect(isLinearBatchUnit('kg')).toBe(false)
    expect(isLinearBatchUnit('pcs')).toBe(false)
    expect(isLinearBatchUnit('m2')).toBe(false)
    expect(isLinearBatchUnit('t')).toBe(false)
  })

  it('3 мм — это 0.003 метра и 3 миллиметра', () => {
    expect(kerfInBatchUnit(3, 'm')).toBe(0.003)
    expect(kerfInBatchUnit(3, 'mm')).toBe(3)
  })

  it('для нелинейной партии пропил ноль, каким бы его ни прислали', () => {
    // Ноль здесь — не «мы забыли», а «в килограммах ширина реза не выражается без
    // веса погонного метра». Выдуманного коэффициента не будет.
    expect(kerfInBatchUnit(3, 'kg')).toBe(0)
    const result = ok(
      computeCuttingConsumption({
        offcuts: [{ quantity: 2, weightKg: 50 }],
        kerfMm: 3,
        wasteQuantity: 0,
        unit: 'kg',
      }),
    )
    expect(result.kerfTotal).toBe(0)
    expect(result.consumed).toBe(100)
  })

  it('список линейных единиц — именно тот, что описан', () => {
    expect([...LINEAR_BATCH_UNITS]).toEqual(['m', 'mm'])
  })
})

describe('таблица покрывает то, что реально лежит в данных', () => {
  it('каждая единица партии из сидов умеет считать размер куска', () => {
    // Список маленький и захардкоженный — значит обязан покрывать все партии,
    // иначе резка отказывает на существующих данных.
    const units = [...new Set(mockBatches.map((b) => b.unit))]
    expect(units.length).toBeGreaterThan(1)
    for (const unit of units) expect(SUPPORTED_BATCH_UNITS).toContain(unit)
    expect(units.filter(isLinearBatchUnit)).toEqual(['m'])
  })

  it('у каждого обрезка из сидов есть размер под единицу его партии', () => {
    // Сиды говорят, что нули реальны: у одного обрезка lengthMm и widthMm — null,
    // и живёт он только весом. Значит резолвер обязан пройти по ним по-настоящему.
    const byId = new Map(mockBatches.map((b) => [b.id, b]))
    const checked = mockOffcuts.filter((o) => byId.has(o.batchId))
    expect(checked.length).toBeGreaterThan(5)
    for (const offcut of checked) {
      const batch = byId.get(offcut.batchId)!
      const resolved = resolveOffcutMaterial(offcut, batch.unit)
      expect(resolved.ok, `${offcut.id} (партия ${batch.unit})`).toBe(true)
    }
  })
})

describe('пропил и отход — разные слагаемые', () => {
  it('видны по отдельности и складываются в списание', () => {
    const result = ok(
      computeCuttingConsumption({
        offcuts: [
          { quantity: 1, lengthMm: 1200 },
          { quantity: 1, lengthMm: 800 },
        ],
        kerfMm: 5,
        wasteQuantity: 0.35,
        unit: 'm',
      }),
    )
    expect(result.offcutTotal).toBe(2)
    expect(result.cuts).toBe(2)
    expect(result.kerfTotal).toBe(0.01)
    expect(result.waste).toBe(0.35)
    expect(result.consumed).toBe(2.36)
  })

  it('отход списывается и там, где пропила не бывает', () => {
    const result = ok(
      computeCuttingConsumption({
        offcuts: [{ quantity: 1, weightKg: 40 }],
        kerfMm: 0,
        wasteQuantity: 2.5,
        unit: 'kg',
      }),
    )
    expect(result.consumed).toBe(42.5)
  })
})

describe('сложение не показывает 2.5030000000000001', () => {
  it('дробные размеры округляются до вменяемого числа', () => {
    // 0.1 + 0.2 в плавающей точке — 0.30000000000000004; это число уехало бы в поле
    // «расход материала» и в списание партии.
    const result = ok(
      computeCuttingConsumption({
        offcuts: [
          { quantity: 1, lengthMm: 100 },
          { quantity: 1, lengthMm: 200 },
        ],
        kerfMm: 0,
        wasteQuantity: 0,
        unit: 'm',
      }),
    )
    expect(result.offcutTotal).toBe(0.3)
    expect(result.consumed).toBe(0.3)
  })

  it('три куска по 700 мм с пропилом 3 мм', () => {
    const result = ok(
      computeCuttingConsumption({
        offcuts: [{ quantity: 3, lengthMm: 700 }],
        kerfMm: 3,
        wasteQuantity: 0,
        unit: 'm',
      }),
    )
    // 2.1 + 3 × 0.003 = 2.109, а не 2.1089999999999995
    expect(result.consumed).toBe(2.109)
  })
})

describe('площадь обрезка выводится, а не хранится', () => {
  it('лист 500×300 — это 0.15 м²', () => {
    expect(offcutAreaM2({ lengthMm: 500, widthMm: 300 })).toBe(0.15)
    expect(offcutAreaM2({ lengthMm: 900, widthMm: 450 })).toBe(0.405)
    expect(offcutAreaM2({ lengthMm: 2000, widthMm: 1000 })).toBe(2)
  })

  it('без ширины площадь НЕВЫРАЗИМА, а не равна нулю', () => {
    // Труба: ширины нет по природе куска. Ноль означал бы «площадь есть и она нулевая».
    expect(offcutAreaM2({ lengthMm: 1500, widthMm: null })).toBeNull()
    expect(offcutAreaM2({ lengthMm: null, widthMm: 300 })).toBeNull()
    expect(offcutAreaM2({})).toBeNull()
  })

  it('нулевой и отрицательный размер — тоже невыразима', () => {
    expect(offcutAreaM2({ lengthMm: 0, widthMm: 300 })).toBeNull()
    expect(offcutAreaM2({ lengthMm: 500, widthMm: -1 })).toBeNull()
    expect(offcutAreaM2({ lengthMm: 500, widthMm: Number.NaN })).toBeNull()
  })

  it('спрашивает требования резолвера, а не свои: тот же ответ, что у m²-партии', () => {
    // Если требования разойдутся — например, у m2 в таблице останется только длина —
    // этот тест покажет расхождение раньше, чем экран покажет неверную площадь.
    const piece = { quantity: 1, lengthMm: 1800, widthMm: 200 }
    const viaResolver = resolvePieceSize(piece, 'm2')
    expect(viaResolver.ok && viaResolver.pieceSize).toBe(offcutAreaM2(piece))
  })

  it('счётчик кусков к площади одного куска не относится', () => {
    // Дробное количество отказало бы в ответе на вопрос, к которому не относится.
    expect(offcutAreaM2({ lengthMm: 500, widthMm: 300, ...{ quantity: 2.5 } } as never)).toBe(0.15)
  })

  it('у обрезков из сидов площадь либо число, либо null — и известно, у кого что', () => {
    const withArea = mockOffcuts.filter((o) => offcutAreaM2(o) !== null)
    const without = mockOffcuts.filter((o) => offcutAreaM2(o) === null)
    expect(withArea.length).toBeGreaterThan(0)
    // who-006 и who-012 — линейные куски трубы без ширины: площади у них нет.
    expect(without.map((o) => o.id)).toContain('who-006')
    expect(without.map((o) => o.id)).toContain('who-012')
    expect(withArea.map((o) => o.id)).toContain('who-001')
  })
})

describe('размер куска округляется тем же правилом, что и всё остальное', () => {
  it('дробные миллиметры не дают хвоста в площади', () => {
    // Форма ставит step="1", но браузер не запрещает ввести дробь: поле лишь
    // помечается невалидным, а v-model.number связывает значение.
    // (100.1 * 100.1) / 1e6 в двоичной дроби = 0.010020009999999998.
    expect(offcutAreaM2({ lengthMm: 100.1, widthMm: 100.1 })).toBe(0.01002)
  })

  it('целые миллиметры не меняются — округление не портит точное', () => {
    expect(offcutAreaM2({ lengthMm: 500, widthMm: 300 })).toBe(0.15)
    expect(offcutAreaM2({ lengthMm: 900, widthMm: 450 })).toBe(0.405)
    expect(resolvePieceSize({ quantity: 1, lengthMm: 2500 }, 'm')).toMatchObject({ pieceSize: 2.5 })
  })
})
