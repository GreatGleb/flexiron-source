import { useI18n } from 'vue-i18n'
import type { TranslatedString } from '@/types/i18n'

/**
 * Reactive helper that picks the right language variant from a TranslatedString
 * based on the current vue-i18n locale.
 *
 * When the user switches language via LangSwitcher.vue (which sets locale.value),
 * all computed fields using `tf()` update instantly — no API re-fetch needed.
 *
 * @example
 * ```ts
 * const { tf } = useTranslatedField()
 * // In template: {{ tf(item.label) }}
 * // If locale is 'en' and item.label = { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }
 * // → renders 'Pipes'
 * ```
 */
export function useTranslatedField() {
  const { locale } = useI18n()

  /**
   * Returns the translated string for the current locale.
   * Falls back to Russian if the current locale is not found.
   */
  function tf(field: TranslatedString): string {
    return field[locale.value as keyof TranslatedString] ?? field.ru
  }

  return { tf }
}
