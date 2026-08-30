import { describe, it, expect } from 'vitest'
import { uomCode, unitLabel, orderLineUnit } from './uom'
import { MOCK_SETTINGS } from '@/services/mocks/settings'
import type { Uom } from '@/types/settings'

const { uoms } = MOCK_SETTINGS

describe('подпись единицы берётся из справочника', () => {
  it('в текущем языке, а не в английском', () => {
    expect(uomCode('uom-pcs', uoms, 'ru')).toBe('шт')
    expect(uomCode('uom-pcs', uoms, 'en')).toBe('pcs')
    expect(uomCode('uom-pcs', uoms, 'lt')).toBe('vnt')
  })

  it('код строки заказа и полный id — одна и та же единица', () => {
    // Строка заказа хранит `saleUomId.replace(/^uom-/, '')`, то есть огрызок id.
    for (const locale of ['ru', 'en', 'lt']) {
      expect(uomCode('pcs', uoms, locale)).toBe(uomCode('uom-pcs', uoms, locale))
      expect(uomCode('m2', uoms, locale)).toBe(uomCode('uom-m2', uoms, locale))
    }
  })

  it('КАЖДАЯ единица справочника получает подпись на всех трёх языках', () => {
    // Это и есть пункт 4c: система ключей `orders.unit_*` знала пять единиц из
    // девяти, а дефолт `t()` молча рисовал остальные их id-кодом. Утверждение
    // держит новую систему полной по построению: единица, заведённая в
    // справочнике, подписана, и добавление десятой ничего не ломает.
    expect(uoms.length).toBeGreaterThan(0)
    for (const uom of uoms) {
      const orderLineCode = uom.id.replace(/^uom-/, '')
      for (const locale of ['ru', 'en', 'lt'] as const) {
        expect(uomCode(orderLineCode, uoms, locale)).toBe(uom.code[locale])
      }
    }
  })

  it('локали расходятся хотя бы у одной единицы — иначе проверка языка пустая', () => {
    // Без этого предыдущее утверждение прошло бы и на подписи, не зависящей от
    // языка вовсе: у шести единиц из девяти коды по языкам совпадают.
    const differing = uoms.filter((u: Uom) => new Set([u.code.ru, u.code.en, u.code.lt]).size > 1)
    expect(differing.map((u: Uom) => u.id)).toContain('uom-pcs')
  })

  it('неизвестная единица — null, а не выдуманный код', () => {
    expect(uomCode('uom-parsec', uoms, 'en')).toBeNull()
    expect(uomCode('parsec', uoms, 'en')).toBeNull()
  })
})

describe('подпись для показа', () => {
  it('справочник не загружен — показывает сам код, а не прочерк', () => {
    // Прочерк на месте килограммов читается как «единицы нет», что неправда:
    // справочник тянет сайдбар, и до его ответа есть окно в несколько тиков.
    expect(unitLabel('kg', [], 'ru')).toBe('kg')
    expect(unitLabel('kg', uoms, 'ru')).toBe('кг')
  })

  it('склад присылает ССЫЛКУ — до ответа справочника видно `kg`, а не `uom-kg`', () => {
    // С п. 4d партия, движение, обрезок, дефицит и остаток держат `uom-kg`.
    // Сырой id в таблице читается как мусор, а не как единица.
    expect(unitLabel('uom-kg', [], 'ru')).toBe('kg')
    expect(unitLabel('uom-kg', uoms, 'ru')).toBe('кг')
    expect(unitLabel('uom-m2', [], 'en')).toBe('m2')
  })

  it('единицы нет вовсе — прочерк', () => {
    expect(unitLabel(null, uoms, 'ru')).toBe('—')
    expect(unitLabel('', uoms, 'ru')).toBe('—')
  })
})

describe('код единицы, который строка заказа хранит', () => {
  it('это id справочника без префикса — и он читается обратно на всех языках', () => {
    // Утверждение держит замкнутость круга: что записали при добавлении позиции,
    // то и подписывается при показе. Модалка добавления до 2026-08-27 клала сюда
    // ПЕРЕВЕДЁННЫЙ код, и русский сеанс сохранял `unit: 'шт'` — в английском
    // заказе оно так и осталось бы «шт».
    for (const uom of uoms) {
      const stored = orderLineUnit(uom.id)
      expect(stored).not.toContain('uom-')
      for (const locale of ['ru', 'en', 'lt'] as const) {
        expect(unitLabel(stored, uoms, locale)).toBe(uom.code[locale])
      }
    }
  })

  it('никогда не хранит подпись: переведённый код обратно не читается', () => {
    // 'шт' — русская подпись `uom-pcs`. Если она попадёт в данные, справочник её
    // не узнает, и англичанин увидит её как есть. Это и есть цена путаницы
    // подписи с данными.
    expect(uomCode('шт', uoms, 'en')).toBeNull()
    expect(orderLineUnit('uom-pcs')).not.toBe('шт')
  })

  it('единицы у товара нет — штука, а не пустая строка', () => {
    expect(orderLineUnit(null)).toBe('pcs')
    expect(unitLabel(orderLineUnit(null), uoms, 'lt')).toBe('vnt')
  })
})

describe('запасные языки кода единицы', () => {
  /**
   * `uomCode` повторяет цепочку `productLabel`: свой язык → английский →
   * русский → null. Две последние ступени не исполнялись ни одним тестом.
   */
  const PARTIAL: Uom[] = [
    {
      id: 'uom-ru',
      code: { ru: 'шт', en: '', lt: '' },
      name: { ru: 'штука', en: '', lt: '' },
      category: 'quantity',
    },
    {
      id: 'uom-none',
      code: { ru: '', en: '', lt: '' },
      name: { ru: '', en: '', lt: '' },
      category: 'quantity',
    },
  ]

  it('нет ни своего языка, ни английского — берётся русский', () => {
    expect(uomCode('uom-ru', PARTIAL, 'lt')).toBe('шт')
    expect(uomCode('ru', PARTIAL, 'en')).toBe('шт')
  })

  it('кода нет ни на одном языке — null, а не пустая строка', () => {
    // Пустая строка встала бы после числа как «12 », и это читалось бы как
    // потерянная единица. null отличается тем, что вызывающий обязан решить.
    expect(uomCode('uom-none', PARTIAL, 'en')).toBeNull()
    expect(uomCode('uom-none', PARTIAL, 'ru')).toBeNull()
  })
})
