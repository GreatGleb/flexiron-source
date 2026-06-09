// Admin translations — aggregated from domain files
import { adminLayout } from './layout'
import { adminDashboard } from './dashboard'
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
import { adminCommon } from './common'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LocaleModule = Record<string, any>

// Merge all domain objects into per-locale aggregates
function mergeLocales(...modules: { ru: LocaleModule; en: LocaleModule; lt: LocaleModule }[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ru: Record<string, any> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const en: Record<string, any> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  adminServices,
  adminWarehouse,
  adminClients,
  adminOrders,
  adminSalesCrm,
  adminCommon,
)

export const adminRu = merged.ru
export const adminEn = merged.en
export const adminLt = merged.lt
