import { describe, it, expect } from 'vitest'
import {
  mockCreateBatch,
  mockCreateOffcut,
  mockExecuteCutting,
  mockGetBatch,
  mockGetMovements,
  mockGetOffcut,
  syncBatchQuantities,
} from './warehouse'

/**
 * Резка как операция, а не как подпись.
 *
 * `mockExecuteCutting` была заглушкой: списывала присланное `sourceQuantity`, не
 * смотрела ни на куски, ни на ширину реза, возвращала `{ offcuts: [], wasteQuantity:
 * 0 }` и не писала ни одного движения. Операция «проходила», обрезков не появлялось.
 */

let seq = 0

async function freshBatch(quantity: number, uomId: string) {
  seq += 1
  return mockCreateBatch({
    productId: 'prod-001',
    batchNumber: `CUT-${String(seq).padStart(3, '0')}`,
    lotCode: `LOT-CUT-${String(seq).padStart(3, '0')}`,
    quantity,
    uomId,
    unitPrice: 10,
    receivedAt: '2026-01-01T00:00:00Z',
    location: 'Rack: A | Row: 01 | Cell: 01',
  })
}

/** Движения этой партии — резка обязана оставлять след на каждый ушедший грамм. */
async function movementsOf(batchNumber: string) {
  const page = await mockGetMovements({ search: '', batchNumber }, { page: 1, pageSize: 100 })
  return page.items
}

describe('пример из ТЗ проходит через мок целиком', () => {
  it('купили 2500 мм — с партии в метрах ушло 2.503', async () => {
    const batch = await freshBatch(100, 'uom-m')

    const result = await mockExecuteCutting({
      sourceBatchId: batch.id,
      sourceQuantity: 2.503,
      kerfMm: 3,
      wasteQuantity: 0,
      offcuts: [
        {
          productId: 'prod-001',
          quantity: 1,
          lengthMm: 2500,
          uomId: 'uom-m',
          offcutType: 'linear',
        },
      ],
    })

    expect(result.offcuts).toHaveLength(1)
    const after = await mockGetBatch(batch.id)
    expect(after.quantityRemaining).toBe(97.497)
  })

  it('обрезок появляется в хранилище, а не только в ответе', async () => {
    // Заглушка возвращала пустой список: операция «проходила», а обрезка не было.
    const batch = await freshBatch(50, 'uom-m')
    const { offcuts } = await mockExecuteCutting({
      sourceBatchId: batch.id,
      sourceQuantity: 1.503,
      kerfMm: 3,
      wasteQuantity: 0,
      offcuts: [
        {
          productId: 'prod-001',
          quantity: 1,
          lengthMm: 1500,
          uomId: 'uom-m',
          offcutType: 'linear',
        },
      ],
    })

    const stored = await mockGetOffcut(offcuts[0]!.id)
    expect(stored.lengthMm).toBe(1500)
    expect(stored.batchId).toBe(batch.id)
  })
})

describe('след из движений: обрезки одним типом, пропил с отходом — другим', () => {
  it('на каждый кусок движение offcut на его материал', async () => {
    const batch = await freshBatch(100, 'uom-m')
    await mockExecuteCutting({
      sourceBatchId: batch.id,
      sourceQuantity: 4.512,
      kerfMm: 3,
      wasteQuantity: 0,
      offcuts: [
        {
          productId: 'prod-001',
          quantity: 2,
          lengthMm: 1500,
          uomId: 'uom-m',
          offcutType: 'linear',
        },
        { productId: 'prod-001', quantity: 2, lengthMm: 750, uomId: 'uom-m', offcutType: 'linear' },
      ],
    })

    const movements = await movementsOf(batch.batchNumber)
    const offcutMovements = movements.filter((m) => m.type === 'offcut')
    expect(offcutMovements.map((m) => m.quantity).sort((a, b) => a - b)).toEqual([1.5, 3])
    // Движение меряется в единице партии — метрах, а не в кусках.
    expect(new Set(offcutMovements.map((m) => m.uomId))).toEqual(new Set(['uom-m']))
  })

  it('пропил и отход уходят одним списанием, и в примечании видны оба', async () => {
    const batch = await freshBatch(100, 'uom-m')
    await mockExecuteCutting({
      sourceBatchId: batch.id,
      sourceQuantity: 3.512,
      kerfMm: 4,
      wasteQuantity: 0.5,
      offcuts: [
        {
          productId: 'prod-001',
          quantity: 3,
          lengthMm: 1000,
          uomId: 'uom-m',
          offcutType: 'linear',
        },
      ],
    })

    const writeOffs = (await movementsOf(batch.batchNumber)).filter((m) => m.type === 'write-off')
    expect(writeOffs).toHaveLength(1)
    // 3 реза × 4 мм = 0.012 м, плюс 0.5 отхода.
    expect(writeOffs[0]!.quantity).toBe(0.512)
    // Помечено резкой — иначе это списание не отличить от брака или потери.
    expect(writeOffs[0]!.referenceType).toBe('cutting')
    expect(writeOffs[0]!.notes).toContain('0.012')
    expect(writeOffs[0]!.notes).toContain('0.5')
  })

  it('нет пропила и нет отхода — нет и лишнего движения', async () => {
    const batch = await freshBatch(20, 'uom-pcs')
    await mockExecuteCutting({
      sourceBatchId: batch.id,
      sourceQuantity: 2,
      kerfMm: 0,
      wasteQuantity: 0,
      offcuts: [{ productId: 'prod-001', quantity: 2, uomId: 'uom-pcs', offcutType: 'linear' }],
    })

    const movements = await movementsOf(batch.batchNumber)
    expect(movements.filter((m) => m.type === 'write-off')).toHaveLength(0)
    expect((await mockGetBatch(batch.id)).quantityRemaining).toBe(18)
  })
})

describe('оба пути списывают одинаково', () => {
  it('обрезок вручную и тот же обрезок резкой забирают с партии одно и то же', async () => {
    // Резолвер размера один; если появится второй, эти два числа разъедутся.
    const manual = await freshBatch(100, 'uom-m')
    await mockCreateOffcut({
      batchId: manual.id,
      productId: 'prod-001',
      quantity: 2,
      lengthMm: 1250,
      uomId: 'uom-m',
      offcutType: 'linear',
    })

    const cut = await freshBatch(100, 'uom-m')
    await mockExecuteCutting({
      sourceBatchId: cut.id,
      sourceQuantity: 2.5,
      kerfMm: 0,
      wasteQuantity: 0,
      offcuts: [
        {
          productId: 'prod-001',
          quantity: 2,
          lengthMm: 1250,
          uomId: 'uom-m',
          offcutType: 'linear',
        },
      ],
    })

    expect((await mockGetBatch(manual.id)).quantityRemaining).toBe(97.5)
    expect((await mockGetBatch(cut.id)).quantityRemaining).toBe(97.5)
  })

  it('обрезок в 3 кг забирает с партии 3, а не 6', async () => {
    // Регресс: количество партии уменьшали и `mockCreateOffcut`, и `writeMovement`.
    const batch = await freshBatch(100, 'uom-kg')
    await mockCreateOffcut({
      batchId: batch.id,
      productId: 'prod-001',
      quantity: 1,
      weightKg: 3,
      uomId: 'uom-kg',
      offcutType: 'linear',
    })
    expect((await mockGetBatch(batch.id)).quantityRemaining).toBe(97)
  })

  it('«1 шт» из партии в метрах больше не списывает один метр', async () => {
    const batch = await freshBatch(100, 'uom-m')
    await mockCreateOffcut({
      batchId: batch.id,
      productId: 'prod-001',
      quantity: 1,
      lengthMm: 300,
      uomId: 'uom-m',
      offcutType: 'linear',
    })
    expect((await mockGetBatch(batch.id)).quantityRemaining).toBe(99.7)
  })
})

describe('отказы: ни одной записи после первого «нет»', () => {
  it('неизвестная партия', async () => {
    await expect(
      mockExecuteCutting({
        sourceBatchId: 'whb-does-not-exist',
        sourceQuantity: 1,
        kerfMm: 0,
        wasteQuantity: 0,
        offcuts: [
          {
            productId: 'prod-001',
            quantity: 1,
            lengthMm: 1000,
            uomId: 'uom-m',
            offcutType: 'linear',
          },
        ],
      }),
    ).rejects.toThrow('BATCH_NOT_FOUND')
  })

  it('резка без кусков — это не резка', async () => {
    const batch = await freshBatch(10, 'uom-m')
    await expect(
      mockExecuteCutting({
        sourceBatchId: batch.id,
        sourceQuantity: 0,
        kerfMm: 0,
        wasteQuantity: 0,
        offcuts: [],
      }),
    ).rejects.toThrow('CUTTING_NO_OFFCUTS')
    expect((await mockGetBatch(batch.id)).quantityRemaining).toBe(10)
  })

  it('ширина реза на партии в килограммах', async () => {
    // Не ноль молча: присланный пропил значит, что клиент считает его значащим.
    const batch = await freshBatch(100, 'uom-kg')
    await expect(
      mockExecuteCutting({
        sourceBatchId: batch.id,
        sourceQuantity: 5,
        kerfMm: 3,
        wasteQuantity: 0,
        offcuts: [
          {
            productId: 'prod-001',
            quantity: 1,
            weightKg: 5,
            uomId: 'uom-kg',
            offcutType: 'linear',
          },
        ],
      }),
    ).rejects.toThrow('CUTTING_KERF_NOT_APPLICABLE')
    expect((await mockGetBatch(batch.id)).quantityRemaining).toBe(100)
  })

  it('нет размера под единицу партии', async () => {
    const batch = await freshBatch(100, 'uom-m')
    await expect(
      mockExecuteCutting({
        sourceBatchId: batch.id,
        sourceQuantity: 1,
        kerfMm: 0,
        wasteQuantity: 0,
        offcuts: [{ productId: 'prod-001', quantity: 1, uomId: 'uom-m', offcutType: 'linear' }],
      }),
    ).rejects.toThrow('OFFCUT_DIMENSION_MISSING')
    expect((await mockGetBatch(batch.id)).quantityRemaining).toBe(100)
  })

  it('дробное число кусков', async () => {
    const batch = await freshBatch(100, 'uom-m')
    await expect(
      mockExecuteCutting({
        sourceBatchId: batch.id,
        sourceQuantity: 1.25,
        kerfMm: 0,
        wasteQuantity: 0,
        offcuts: [
          {
            productId: 'prod-001',
            quantity: 2.5,
            lengthMm: 500,
            uomId: 'uom-m',
            offcutType: 'linear',
          },
        ],
      }),
    ).rejects.toThrow('OFFCUT_PIECES_NOT_INTEGER')
  })

  it('в партии меньше, чем заявлено к резке', async () => {
    const batch = await freshBatch(2, 'uom-m')
    await expect(
      mockExecuteCutting({
        sourceBatchId: batch.id,
        sourceQuantity: 3.003,
        kerfMm: 3,
        wasteQuantity: 0,
        offcuts: [
          {
            productId: 'prod-001',
            quantity: 1,
            lengthMm: 3000,
            uomId: 'uom-m',
            offcutType: 'linear',
          },
        ],
      }),
    ).rejects.toThrow('INSUFFICIENT_QUANTITY')
    expect((await mockGetBatch(batch.id)).quantityRemaining).toBe(2)
  })

  it('клиент посчитал расход иначе — отказ, а не доверие клиенту', async () => {
    const batch = await freshBatch(100, 'uom-m')
    await expect(
      mockExecuteCutting({
        sourceBatchId: batch.id,
        // Правильное число — 2.503; здесь пропил «забыт».
        sourceQuantity: 2.5,
        kerfMm: 3,
        wasteQuantity: 0,
        offcuts: [
          {
            productId: 'prod-001',
            quantity: 1,
            lengthMm: 2500,
            uomId: 'uom-m',
            offcutType: 'linear',
          },
        ],
      }),
    ).rejects.toThrow('CUTTING_QUANTITY_MISMATCH')
    expect((await mockGetBatch(batch.id)).quantityRemaining).toBe(100)
  })

  it('отказ на втором куске не оставляет первый', async () => {
    // Резка — одна проводка. Списать половину заявленного хуже, чем не списать.
    const batch = await freshBatch(100, 'uom-m')
    const before = (await movementsOf(batch.batchNumber)).length
    await expect(
      mockExecuteCutting({
        sourceBatchId: batch.id,
        sourceQuantity: 2,
        kerfMm: 0,
        wasteQuantity: 0,
        offcuts: [
          {
            productId: 'prod-001',
            quantity: 1,
            lengthMm: 1000,
            uomId: 'uom-m',
            offcutType: 'linear',
          },
          { productId: 'prod-001', quantity: 1, uomId: 'uom-m', offcutType: 'linear' },
        ],
      }),
    ).rejects.toThrow('OFFCUT_DIMENSION_MISSING')

    expect((await mockGetBatch(batch.id)).quantityRemaining).toBe(100)
    expect((await movementsOf(batch.batchNumber)).length).toBe(before)
  })

  it('обрезок больше остатка партии не создаётся и вручную', async () => {
    const batch = await freshBatch(1, 'uom-m')
    await expect(
      mockCreateOffcut({
        batchId: batch.id,
        productId: 'prod-001',
        quantity: 1,
        lengthMm: 2000,
        uomId: 'uom-m',
        offcutType: 'linear',
      }),
    ).rejects.toThrow('INSUFFICIENT_QUANTITY')
    expect((await mockGetBatch(batch.id)).quantityRemaining).toBe(1)
  })

  it('обрезок без партии — не запись, а ошибка', async () => {
    // Раньше такой вызов создавал обрезок с пустым номером партии и без движения:
    // кусок металла, которого нет ни в одной партии.
    await expect(
      mockCreateOffcut({
        batchId: 'whb-does-not-exist',
        productId: 'prod-001',
        quantity: 1,
        weightKg: 1,
        uomId: 'uom-kg',
        offcutType: 'linear',
      }),
    ).rejects.toThrow('BATCH_NOT_FOUND')
  })
})

describe('пересчёт из журнала даёт тот же остаток', () => {
  it('после резки пересборка хранилища не возвращает партии ни куски, ни пропил', async () => {
    // Остаток выводится из движений дважды: вычитаниями при записи и суммой журнала
    // при загрузке модуля (так же сделает бэкенд, поднявшись с сохранённого журнала).
    // Тип, которого нет в списке исходящих, пересчёт «вернул» бы партии — молча и
    // только после перезагрузки. Резка пишет `offcut` на куски и `write-off` на
    // пропил с отходом; оба обязаны быть в одном и том же списке.
    const batch = await freshBatch(100, 'uom-m')
    await mockExecuteCutting({
      sourceBatchId: batch.id,
      sourceQuantity: 5.512,
      kerfMm: 4,
      wasteQuantity: 0.5,
      offcuts: [
        {
          productId: 'prod-001',
          quantity: 2,
          lengthMm: 1500,
          uomId: 'uom-m',
          offcutType: 'linear',
        },
        {
          productId: 'prod-001',
          quantity: 1,
          lengthMm: 2000,
          uomId: 'uom-m',
          offcutType: 'linear',
        },
      ],
    })

    const afterWrite = (await mockGetBatch(batch.id)).quantityRemaining
    expect(afterWrite).toBe(94.488)

    syncBatchQuantities()

    const afterRebuild = (await mockGetBatch(batch.id)).quantityRemaining
    expect(afterRebuild).toBe(afterWrite)
  })

  it('пересборка не возвращает и материал обрезка, созданного вручную', async () => {
    const batch = await freshBatch(60, 'uom-kg')
    await mockCreateOffcut({
      batchId: batch.id,
      productId: 'prod-001',
      quantity: 2,
      weightKg: 4.5,
      uomId: 'uom-kg',
      offcutType: 'linear',
    })

    const afterWrite = (await mockGetBatch(batch.id)).quantityRemaining
    expect(afterWrite).toBe(51)

    syncBatchQuantities()
    expect((await mockGetBatch(batch.id)).quantityRemaining).toBe(51)
  })

  it('дробный остаток переживает пересборку без мусора в последних битах', async () => {
    // Партия 40.01 м, три куска по 700 мм, пропил 3 мм. Цепочка вычитаний даёт 37.901,
    // а сумма журнала в плавающей точке — 37.900999999999996. Без одного правила
    // округления на оба пути «тот же остаток» перестаёт быть тем же, и партия после
    // перезагрузки отличается от той, что была секунду назад.
    const batch = await freshBatch(40.01, 'uom-m')
    await mockExecuteCutting({
      sourceBatchId: batch.id,
      sourceQuantity: 2.109,
      kerfMm: 3,
      wasteQuantity: 0,
      offcuts: [
        { productId: 'prod-001', quantity: 3, lengthMm: 700, uomId: 'uom-m', offcutType: 'linear' },
      ],
    })

    expect((await mockGetBatch(batch.id)).quantityRemaining).toBe(37.901)
    syncBatchQuantities()
    expect((await mockGetBatch(batch.id)).quantityRemaining).toBe(37.901)
  })
})
