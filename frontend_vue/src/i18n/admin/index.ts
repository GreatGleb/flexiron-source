// Admin translations — aggregated from domain files
import { adminLayout } from './layout'
import { adminAnalytics } from './analytics'
import { adminSuppliers } from './suppliers'
import { adminBcc } from './bcc'
import { adminCardConfig } from './cardConfig'
import { adminCategories } from './categories'
import { adminProducts } from './products'
import { adminServices } from './services'
import { adminWarehouse } from './warehouse'
import { adminClients } from './clients'
import { adminOrders } from './orders'
import { adminSalesCrm } from './salesCrm'
import { adminSettings } from './settings'
import { adminCommon } from './common'
import { adminNotifications } from './notifications'
import { adminFinance } from './finance'

type LocaleModule = Record<string, unknown>

/**
 * Deep merge two or more objects.
 * Nested objects are merged recursively (not replaced).
 * Arrays and primitives from later sources override earlier ones.
 */
function deepMerge(...sources: Record<string, unknown>[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const source of sources) {
    for (const key of Object.keys(source)) {
      const val = source[key]
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        result[key] = deepMerge(
          (result[key] as Record<string, unknown>) || {},
          val as Record<string, unknown>,
        )
      } else {
        result[key] = val
      }
    }
  }
  return result
}

// Merge all domain objects into per-locale aggregates
function mergeLocales(...modules: { ru: LocaleModule; en: LocaleModule; lt: LocaleModule }[]) {
  const ru: Record<string, unknown> = {}
  const en: Record<string, unknown> = {}
  const lt: Record<string, unknown> = {}
  for (const mod of modules) {
    for (const key of Object.keys(mod.ru)) {
      ru[key] = deepMerge(
        (ru[key] as Record<string, unknown>) || {},
        mod.ru[key] as Record<string, unknown>,
      )
    }
    for (const key of Object.keys(mod.en)) {
      en[key] = deepMerge(
        (en[key] as Record<string, unknown>) || {},
        mod.en[key] as Record<string, unknown>,
      )
    }
    for (const key of Object.keys(mod.lt)) {
      lt[key] = deepMerge(
        (lt[key] as Record<string, unknown>) || {},
        mod.lt[key] as Record<string, unknown>,
      )
    }
  }
  return { ru, en, lt }
}

const merged = mergeLocales(
  adminLayout,
  adminAnalytics,
  adminSuppliers,
  adminBcc,
  adminCardConfig,
  adminCategories,
  adminProducts,
  adminServices,
  adminWarehouse,
  adminClients,
  adminOrders,
  adminSalesCrm,
  adminSettings,
  adminCommon,
  adminNotifications,
  adminFinance,
)

export const adminRu = merged.ru
export const adminEn = merged.en
export const adminLt = merged.lt
