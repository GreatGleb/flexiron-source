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
