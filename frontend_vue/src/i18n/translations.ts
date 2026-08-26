import { publicRu, publicEn, publicLt } from './public'
import { adminRu, adminEn, adminLt } from './admin/index'
import { deepMerge } from './messages'

export const translations = {
  ru: deepMerge(publicRu, adminRu),
  en: deepMerge(publicEn, adminEn),
  lt: deepMerge(publicLt, adminLt),
}
