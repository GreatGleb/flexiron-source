import { describe, it, expect } from 'vitest'
import { serviceUnitLabel, uomKeySuffix } from './servicePricing'
import { MOCK_SETTINGS } from '@/services/mocks/settings'
import { mockServices } from '@/mocks/services'
import { mockCreateService, mockPatchService } from '@/services/mocks/services'

/**
 * Цена услуги: сумма, валюта, единица — тремя полями.
 *
 * До этого единица была строкой `'EUR/vnt' | 'EUR/kg' | 'EUR/m' | 'EUR/h'`, то есть
 * валюта была вварена в единицу измерения, и услуга в долларах была невыразима.
 */

const { currencies, uoms } = MOCK_SETTINGS

describe('подпись цены собирается, а не хранится', () => {
  it('берёт код единицы в текущем языке', () => {
    // Литовская подпись сегодня — EUR/vnt, и она обязана такой остаться: собирать
    // её из code.en (как делает карточка товара) значит показать литовцу EUR/pcs.
    expect(serviceUnitLabel('cur-eur', 'uom-pcs', currencies, uoms, 'lt')).toBe('EUR/vnt')
    expect(serviceUnitLabel('cur-eur', 'uom-pcs', currencies, uoms, 'en')).toBe('EUR/pcs')
    expect(serviceUnitLabel('cur-eur', 'uom-pcs', currencies, uoms, 'ru')).toBe('EUR/шт')
  })

  it('умеет любую валюту справочника — то, ради чего всё затевалось', () => {
    expect(serviceUnitLabel('cur-usd', 'uom-h', currencies, uoms, 'en')).toBe('USD/h')
  })

  it('на неизвестный id отвечает прочерком, а не выдуманной подписью', () => {
    expect(serviceUnitLabel('cur-eur', 'uom-nope', currencies, uoms, 'en')).toBe('—')
    expect(serviceUnitLabel('cur-nope', 'uom-pcs', currencies, uoms, 'en')).toBe('—')
  })

  it('ключ единицы для модуля заказов — суффикс id', () => {
    expect(uomKeySuffix('uom-pcs')).toBe('pcs')
    expect(uomKeySuffix('uom-h')).toBe('h')
  })
})

describe('час в справочнике', () => {
  const hour = uoms.find((u) => u.id === 'uom-h')

  it('заведён и переведён на три языка', () => {
    expect(hour).toBeDefined()
    expect(hour!.code).toEqual({ ru: 'ч', en: 'h', lt: 'val.' })
    expect(hour!.category).toBe('time')
  })

  it('не участвует НИ В ОДНОМ правиле пересчёта', () => {
    // Час не переводится ни в килограммы, ни в метры. Пустая строка в матрице честнее
    // выдуманного коэффициента — тот же класс, что чинили в себестоимости.
    const involved = MOCK_SETTINGS.conversions.filter(
      (c) => c.fromUomId === 'uom-h' || c.toUomId === 'uom-h',
    )
    expect(involved).toEqual([])
  })
})

describe('миграция и проверка значений', () => {
  it('ни у одной сеяной услуги не осталось сваренной строки', () => {
    for (const service of mockServices) {
      expect(service.currencyId).toMatch(/^cur-/)
      expect(service.uomId).toMatch(/^uom-/)
      expect(service).not.toHaveProperty('priceUnit')
    }
  })

  it('каждая сеяная услуга ссылается на существующие валюту и единицу', () => {
    for (const service of mockServices) {
      expect(currencies.some((c) => c.id === service.currencyId)).toBe(true)
      expect(uoms.some((u) => u.id === service.uomId)).toBe(true)
    }
  })

  it('старое значение больше не проходит молча — ни при создании', async () => {
    // Здесь стоял непроверенный каст `as Service['priceUnit']`, через который прошла бы
    // любая строка: после смены типа 'EUR/kg' пролезло бы, а тайпчек бы промолчал.
    await expect(
      mockCreateService({
        name: 'x',
        costPrice: 1,
        sellingPrice: 2,
        currencyId: 'cur-eur',
        uomId: 'EUR/kg',
      }),
    ).rejects.toThrow('SERVICE_UOM_NOT_FOUND')

    await expect(
      mockCreateService({
        name: 'x',
        costPrice: 1,
        sellingPrice: 2,
        currencyId: 'EUR',
        uomId: 'uom-kg',
      }),
    ).rejects.toThrow('SERVICE_CURRENCY_NOT_FOUND')
  })

  it('ни при правке', async () => {
    const created = await mockCreateService({
      name: 'y',
      costPrice: 1,
      sellingPrice: 2,
      currencyId: 'cur-eur',
      uomId: 'uom-h',
    })
    await expect(mockPatchService(created.id, { uomId: 'EUR/h' })).rejects.toThrow(
      'SERVICE_UOM_NOT_FOUND',
    )
    await expect(mockPatchService(created.id, { currencyId: 'EUR' })).rejects.toThrow(
      'SERVICE_CURRENCY_NOT_FOUND',
    )
  })

  it('услугу можно создать в валюте, отличной от евро', async () => {
    const created = await mockCreateService({
      name: 'z',
      costPrice: 1,
      sellingPrice: 2,
      currencyId: 'cur-usd',
      uomId: 'uom-h',
    })
    expect(created.currencyId).toBe('cur-usd')
    expect(serviceUnitLabel(created.currencyId, created.uomId, currencies, uoms, 'en')).toBe(
      'USD/h',
    )
  })
})
