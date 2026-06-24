import { publicRu, publicEn, publicLt } from './public.js'
import { adminRu, adminEn, adminLt } from './admin/index.ts'

/**
 * Deep merge two or more objects.
 * Nested objects are merged recursively (not replaced).
 * Arrays and primitives from later sources override earlier ones.
 */
function deepMerge(...sources) {
  const result = {}
  for (const source of sources) {
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(result[key] || {}, source[key])
      } else {
        result[key] = source[key]
      }
    }
  }
  return result
}

export const translations = {
  ru: deepMerge(publicRu, adminRu),
  en: deepMerge(publicEn, adminEn),
  lt: deepMerge(publicLt, adminLt),
}
