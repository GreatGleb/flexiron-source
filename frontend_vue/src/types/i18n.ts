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
