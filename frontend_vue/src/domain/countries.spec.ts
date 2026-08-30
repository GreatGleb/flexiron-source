/**
 * Справочник стран и правило «страна → комплект документов».
 *
 * Проверяется не то, что модуль импортируется, а три утверждения, каждое из
 * которых ломается своей правкой: список действительно закрытый и без дублей,
 * подпись приходит на языке пользователя, и предложение по стране отличает
 * «Литва» от всего остального, к которому относится и незаполненная страна.
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

  it('страна не заполнена — экспорт, а не молчаливый «локальный по умолчанию»', () => {
    // Правило полное: третьей ветки «предлагать нечего» нет. Она выглядела бы
    // осторожной, но в форме заказа `documentType` уже стоит `'local'` — то есть
    // молчание означает локальный комплект и 21 % НДС, а не воздержание.
    expect(suggestedDocumentType(null)).toBe('export')
    expect(suggestedDocumentType(undefined)).toBe('export')
    expect(suggestedDocumentType('')).toBe('export')
  })
})

describe('справочник Intl недоступен — подпись всё равно читаема', () => {
  /**
   * `Intl` бросает RangeError на структурно неверном аргументе — и на локали, и
   * на коде. Проверено замером: `new Intl.DisplayNames(['!!'])` и `.of('!!')`
   * бросают оба. Правило модуля одно на оба случая: не сумели назвать страну —
   * подписываем кодом. Прочерк читался бы как «страны нет», а страна есть.
   *
   * ЧТО ЭТИ ТЕСТЫ ДОКАЗЫВАЮТ, А ЧТО НЕТ. Доказан `catch` в `countryLabel`:
   * инверсией (он отдаёт прочерк) первый тест краснеет. Внутренний `catch` в
   * `displayNamesFor` — НЕ доказан, и доказать его снаружи нельзя: функция
   * приватная, вызывающий у неё ровно один, и он сам обёрнут в `try/catch` с
   * тем же исходом. Инверсия внутреннего `catch` (пусть бросает) оставляет все
   * тесты зелёными — проверено 2026-08-30. Строка исполняется, то есть покрытие
   * её засчитывает, но охраняет её внешний `catch`, а не тест. Убирать её
   * поэтому нельзя «раз тесты не заметят»: заметит стоимость — промах перестанет
   * кэшироваться и будет бросать на каждый вызов.
   */
  it('локаль, которую Intl не разбирает, — подпись кодом, а не пустота', () => {
    expect(countryLabel('LT', '!!')).toBe('LT')
    expect(countryLabel('DE', '!!')).toBe('DE')
  })

  it('код, который Intl не разбирает, — подпись тем же кодом', () => {
    expect(countryLabel('!!', 'en')).toBe('!!')
  })

  it('сломанная локаль не отравляет исправную: кэш их не путает', () => {
    // Кэш `displayNamesFor` держит и промахи (null), и попадания. Один ключ на
    // локаль — значит неудача с `'!!'` не должна сделать `'en'` бесполезным.
    expect(countryLabel('LT', '!!')).toBe('LT')
    expect(countryLabel('LT', 'en')).toBe('Lithuania')
    expect(countryLabel('LT', '!!')).toBe('LT')
  })
})
