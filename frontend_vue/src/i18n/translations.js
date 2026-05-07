import { publicRu, publicEn, publicLt } from './public.js'
import { adminRu, adminEn, adminLt } from './admin/index.ts'

export const translations = {
  ru: { ...publicRu, ...adminRu },
  en: { ...publicEn, ...adminEn },
  lt: { ...publicLt, ...adminLt },
}
