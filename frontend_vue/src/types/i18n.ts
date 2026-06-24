/**
 * Represents a string that has translations for all supported languages.
 * The server returns data with all language variants embedded,
 * and the frontend picks the right one based on the current locale.
 */
export interface TranslatedString {
  ru: string
  en: string
  lt: string
}

/**
 * Wraps a plain string value into a TranslatedString for a specific locale.
 * All other locales are set to empty string.
 *
 * @example
 * toTranslatedString('Hello', 'en') // => { ru: '', en: 'Hello', lt: '' }
 */
export function toTranslatedString(value: string, locale: string): TranslatedString {
  const result: TranslatedString = { ru: '', en: '', lt: '' }
  if (locale in result) {
    result[locale as keyof TranslatedString] = value
  }
  return result
}

/**
 * Merges an incoming partial TranslatedString into an existing one.
 * Only defined (non-null, non-undefined) values from `incoming` overwrite `existing`.
 * Useful for PATCH operations where only changed fields are sent.
 *
 * @example
 * mergeTranslatedString({ ru: 'Привет', en: '', lt: '' }, { en: 'Hello' })
 * // => { ru: 'Привет', en: 'Hello', lt: '' }
 */
export function mergeTranslatedString(
  existing: TranslatedString | null | undefined,
  incoming: Partial<TranslatedString>,
): TranslatedString {
  return {
    ru: existing?.ru || '',
    en: existing?.en || '',
    lt: existing?.lt || '',
    ...Object.fromEntries(
      Object.entries(incoming).filter(([, v]) => v !== undefined && v !== null),
    ),
  }
}

/**
 * Merges a single-locale value into an existing TranslatedString.
 * Preserves existing translations for other locales.
 * Use this instead of toTranslatedString() when updating existing data in UI.
 */
export function mergeLocaleValue(
  existing: TranslatedString | null | undefined,
  value: string,
  locale: string,
): TranslatedString {
  const result: TranslatedString = existing ? { ...existing } : { ru: '', en: '', lt: '' }
  if (locale in result) {
    result[locale as keyof TranslatedString] = value
  }
  return result
}
