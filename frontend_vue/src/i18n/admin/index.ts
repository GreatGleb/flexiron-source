// Admin translations — aggregated from domain files
import { adminLayout } from './layout'
import { adminDashboard } from './dashboard'
import { adminAnalytics } from './analytics'
import { adminSuppliers } from './suppliers'
import { adminBcc } from './bcc'
import { adminCardConfig } from './cardConfig'
import { adminCategories } from './categories'
import { adminProducts } from './products'
import { adminCommon } from './common'

// Merge all domain objects into per-locale aggregates
function mergeLocales(...modules: { ru: Record<string, any>; en: Record<string, any>; lt: Record<string, any> }[]) {
  const ru: Record<string, any> = {}
  const en: Record<string, any> = {}
  const lt: Record<string, any> = {}
  for (const mod of modules) {
    for (const key of Object.keys(mod.ru)) {
      ru[key] = { ...(ru[key] || {}), ...mod.ru[key] }
    }
    for (const key of Object.keys(mod.en)) {
      en[key] = { ...(en[key] || {}), ...mod.en[key] }
    }
    for (const key of Object.keys(mod.lt)) {
      lt[key] = { ...(lt[key] || {}), ...mod.lt[key] }
    }
  }
  return { ru, en, lt }
}

const merged = mergeLocales(
  adminLayout,
  adminDashboard,
  adminAnalytics,
  adminSuppliers,
  adminBcc,
  adminCardConfig,
  adminCategories,
  adminProducts,
  adminCommon,
)

export const adminRu = merged.ru
export const adminEn = merged.en
export const adminLt = merged.lt
