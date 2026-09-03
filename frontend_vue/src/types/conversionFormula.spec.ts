import { describe, it, expect } from 'vitest'
import { CONVERSION_FORMULA_TYPES, isConversionFormulaType } from './settings'
import { adminSettings } from '@/i18n/admin/settings'

/**
 * Имя формулы пересчёта — одно на весь проект (`CONVERSION_FORMULA_TYPES`).
 * Типы держат ссылку на союз, а вот подпись к имени живёт в переводах, и эту
 * связь компилятор не видит: ключ собирается строкой `settingsUom.formula_<имя>`
 * в `UnitsSettings.vue` и `SettingsLayout.vue`. Забытый перевод молча выводит
 * на экран сырой ключ — здесь он роняет прогон.
 */
describe('справочник формул пересчёта', () => {
  const locales = ['ru', 'en', 'lt'] as const

  for (const locale of locales) {
    it(`каждое имя формулы подписано в локали ${locale}`, () => {
      const uom = adminSettings[locale].settingsUom as Record<string, string>
      const missing = CONVERSION_FORMULA_TYPES.filter((name) => !uom[`formula_${name}`])
      expect(missing).toEqual([])
    })
  }

  it('свободная строка не проходит за имя формулы', () => {
    // Оба значения лежали в сидах товаров, когда поля были `string | null`:
    // 'weight_per_unit' — имя, которого нет ни в одном справочнике,
    // 'static' — имя из ConversionType, то есть из другого союза.
    expect(isConversionFormulaType('weight_per_unit')).toBe(false)
    expect(isConversionFormulaType('static')).toBe(false)
    expect(isConversionFormulaType('')).toBe(false)
  })

  it('имена из справочника проходят', () => {
    for (const name of CONVERSION_FORMULA_TYPES) {
      expect(isConversionFormulaType(name)).toBe(true)
    }
  })
})
