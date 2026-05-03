import { useI18n } from 'vue-i18n'
import { labelLookup } from '@/i18n/labelLookup'

/**
 * useLabelResolver
 *
 * Provides a single `resolveLabel()` function that replaces the 4 duplicated
 * functions (productNameLabel, categoryLabel, fieldLabel, enumLabel) that were
 * generating i18n keys from raw data via fragile regex patterns.
 *
 * The lookup is an explicit mapping of raw values → i18n keys, eliminating
 * the risk of mismatched keys when raw values contain special characters
 * like × (U+00D7), °, ², ³, etc.
 *
 * Usage:
 *   const { resolveLabel } = useLabelResolver()
 *   resolveLabel('Angle S355 100×100×10') → 'Уголок S355 100×100×10' (Russian locale)
 *   resolveLabel('Density (kg/m³)') → 'Плотность (кг/м³)'
 *   resolveLabel('Unknown value') → 'Unknown value' (fallback)
 */
export function useLabelResolver() {
  const { t } = useI18n()

  /**
   * Resolves a raw value to its translated label.
   *
   * 1. Looks up the raw value in labelLookup to get the i18n key (e.g. 'products.product_Angle_S355_100x100x10')
   * 2. Passes that key to t() to get the translated string
   * 3. Falls back to the raw value if no mapping exists
   */
  function resolveLabel(rawValue: string): string {
    const i18nKey = labelLookup[rawValue]
    if (!i18nKey) {
      return rawValue
    }
    return t(i18nKey)
  }

  return { resolveLabel }
}
