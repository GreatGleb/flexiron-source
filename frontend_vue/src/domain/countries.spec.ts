/**
 * Справочник стран и правило «страна → комплект документов».
 *
 * Проверяется не то, что модуль импортируется, а три утверждения, каждое из
 * которых ломается своей правкой: список действительно закрытый и без дублей,
 * подпись приходит на языке пользователя, и предложение по стране отличает
 * «Литва» от «не Литва» и оба — от «страны нет».
 */
import { describe, it, expect } from 'vitest'
import {
  COUNTRY_CODES,
  LOCAL_DOCUMENT_COUNTRY,
  countryLabel,
  countryOptions,
  isCountryCode,
  suggestedDocumentType,
} from './countries'

describe('справочник стран', () => {
  it('содержит 249 кодов ISO 3166-1 alpha-2 без дублей', () => {
    expect(COUNTRY_CODES).toHaveLength(249)
    expect(new Set(COUNTRY_CODES).size).toBe(249)
    expect(COUNTRY_CODES.every((code) => /^[A-Z]{2}$/.test(code))).toBe(true)
  })

  it('у каждого кода есть название, а не сам код вместо названия', () => {
    // Подпись, равная коду, — это признак того, что названия для кода нет:
    // именно так `countryLabel` сообщает о промахе. Ни один код справочника
    // промахиваться не должен, иначе в выпадающем списке окажется «XK».
    const unnamed = COUNTRY_CODES.filter((code) => countryLabel(code, 'en') === code)
    expect(unnamed).toEqual([])
  })

  it('подписывает страну на языке пользователя', () => {
    expect(countryLabel('LT', 'en')).toBe('Lithuania')
    expect(countryLabel('LT', 'ru')).toBe('Литва')
    expect(countryLabel('LT', 'lt')).toBe('Lietuva')
  })

  it('на код вне справочника отвечает самим кодом, а не пустотой', () => {
    // `QQ` платформе неизвестен — она возвращает вход как есть, и подпись обязана
    // сделать то же самое: прочерк на месте страны читался бы как «страны нет».
    expect(countryLabel('QQ', 'en')).toBe('QQ')
  })

  it('отличает код справочника от строки, которая просто похожа на код', () => {
    expect(isCountryCode('LT')).toBe(true)
    expect(isCountryCode('lt')).toBe(false)
    expect(isCountryCode('Lithuania')).toBe(false)
    expect(isCountryCode('QQ')).toBe(false)
  })
})

describe('справочник как список для выбора', () => {
  it('отдаёт весь справочник и ничего сверх него', () => {
    const values = countryOptions('en').map((o) => o.value)
    expect(values).toHaveLength(COUNTRY_CODES.length)
    expect(new Set(values)).toEqual(new Set(COUNTRY_CODES))
  })

  it('упорядочен по названию на языке пользователя, а не по коду', () => {
    const labels = countryOptions('ru').map((o) => o.label)
    const byName = [...labels].sort((a, b) => a.localeCompare(b, 'ru'))
    expect(labels).toEqual(byName)
    // И этот порядок ДРУГОЙ, чем порядок кодов: иначе утверждение выше
    // выполнялось бы и при сортировке по коду.
    const byCode = COUNTRY_CODES.map((code) => countryLabel(code, 'ru'))
    expect(labels).not.toEqual(byCode)
  })
})

describe('страна → предлагаемый комплект документов', () => {
  it('Литва — локальный комплект', () => {
    expect(suggestedDocumentType(LOCAL_DOCUMENT_COUNTRY)).toBe('local')
    expect(LOCAL_DOCUMENT_COUNTRY).toBe('LT')
  })

  it('любая другая страна — экспорт', () => {
    const others = COUNTRY_CODES.filter((code) => code !== LOCAL_DOCUMENT_COUNTRY)
    expect(others.map(suggestedDocumentType).filter((type) => type !== 'export')).toEqual([])
  })

  it('страна не заполнена — предлагать нечего, а не «локальный по умолчанию»', () => {
    expect(suggestedDocumentType(null)).toBeNull()
    expect(suggestedDocumentType(undefined)).toBeNull()
    expect(suggestedDocumentType('')).toBeNull()
  })
})
