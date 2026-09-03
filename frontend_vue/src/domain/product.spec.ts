import { describe, it, expect } from 'vitest'
import { productLabel, type ProductRef } from './product'

const CATALOG: ProductRef[] = [
  {
    id: 'prod-001',
    name: { ru: 'Стальной лист 3мм', en: 'Steel Sheet 3mm', lt: 'Plieno lakštas 3mm' },
  },
  { id: 'prod-002', name: { ru: '', en: 'Steel Pipe 100x5', lt: '' } },
]

describe('productLabel', () => {
  it('берёт имя из каталога в текущем языке', () => {
    expect(productLabel('prod-001', CATALOG, 'ru')).toBe('Стальной лист 3мм')
    expect(productLabel('prod-001', CATALOG, 'en')).toBe('Steel Sheet 3mm')
    expect(productLabel('prod-001', CATALOG, 'lt')).toBe('Plieno lakštas 3mm')
  })

  it('локали нет — английский, а не пустая ячейка', () => {
    expect(productLabel('prod-002', CATALOG, 'lt')).toBe('Steel Pipe 100x5')
  })

  it('товара в справочнике нет — прочерк, а не сам id', () => {
    // `prod-999` в колонке «Товар» читался бы как название.
    expect(productLabel('prod-999', CATALOG, 'en')).toBe('—')
  })

  it('справочник ещё не ответил — прочерк', () => {
    expect(productLabel('prod-001', [], 'en')).toBe('—')
  })

  it('ссылки нет — прочерк', () => {
    expect(productLabel(null, CATALOG, 'en')).toBe('—')
    expect(productLabel(undefined, CATALOG, 'en')).toBe('—')
  })
})

describe('запасные языки подписи товара', () => {
  /**
   * Цепочка запасных вариантов у `productLabel` трёхступенчатая:
   * язык пользователя → английский → русский → прочерк. Две последние ступени
   * до сих пор не исполнялись ни одним тестом, то есть их можно было удалить,
   * не покраснев. Ниже по одному случаю на каждую.
   */
  const PARTIAL: ProductRef[] = [
    // Заведён только по-русски: так выглядит товар, добавленный до перевода.
    { id: 'prod-ru', name: { ru: 'Уголок 50x50', en: '', lt: '' } },
    // Не заведён вовсе ни на одном языке.
    { id: 'prod-none', name: { ru: '', en: '', lt: '' } },
  ]

  it('нет ни своего языка, ни английского — берётся русский', () => {
    expect(productLabel('prod-ru', PARTIAL, 'lt')).toBe('Уголок 50x50')
    expect(productLabel('prod-ru', PARTIAL, 'en')).toBe('Уголок 50x50')
  })

  it('имени нет ни на одном языке — прочерк, а не пустая ячейка', () => {
    // Пустая строка в колонке «Товар» неотличима от нехватки места; прочерк
    // читается как «названия нет» и этим отличается от «товара нет».
    expect(productLabel('prod-none', PARTIAL, 'en')).toBe('—')
    expect(productLabel('prod-none', PARTIAL, 'ru')).toBe('—')
    expect(productLabel('prod-none', PARTIAL, 'lt')).toBe('—')
  })
})
