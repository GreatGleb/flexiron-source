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

import { deepMerge, type MessageTree } from '../messages'

/**
 * Домены складывают свои ключи в общее дерево локали. Раньше этот цикл был написан
 * трижды — по разу на `ru`, `en`, `lt`; один хелпер вместо трёх копий.
 */
function mergeInto(target: MessageTree, source: MessageTree): void {
  for (const key of Object.keys(source)) {
    const node = source[key]
    if (node === undefined) continue
    if (typeof node === 'string' || Array.isArray(node)) {
      target[key] = node
      continue
    }
    const existing = target[key]
    target[key] = deepMerge(
      typeof existing === 'object' && !Array.isArray(existing) ? existing : {},
      node,
    )
  }
}

// Merge all domain objects into per-locale aggregates
function mergeLocales(...modules: { ru: MessageTree; en: MessageTree; lt: MessageTree }[]) {
  const ru: MessageTree = {}
  const en: MessageTree = {}
  const lt: MessageTree = {}
  for (const mod of modules) {
    mergeInto(ru, mod.ru)
    mergeInto(en, mod.en)
    mergeInto(lt, mod.lt)
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
