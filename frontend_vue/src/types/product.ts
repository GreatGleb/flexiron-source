import type { CategoryFieldType } from './category'
import type { TranslatedString } from './i18n'
import type { SupplierAuditEntry } from './supplier'

// PriceUnit is now dynamic from settings; keep as string alias for backward compat
export type PriceUnit = string

export interface ProductFieldValue {
  fieldId: string
  fieldName: TranslatedString
  fieldType: CategoryFieldType
  value: string | number | boolean | string[] | null
  inherited: boolean
  options?: TranslatedString[]
}

export interface LinkedSupplier {
  id: string
  name: TranslatedString
  price: number | null
  priceUnit: string | null
  leadDays: number | null
  currency: string | null   // snapshot of supplier's currency at time of linking
}

export interface ProductListItem {
  id: string
  name: TranslatedString
  categoryId: string | null
  categoryName: TranslatedString | null
  sku: string | null
  price: number | null
  minStock: number | null
  priceUnit: string | null
  avgCostPrice: number | null
  createdAt: string

  // UoM references for unit display in order modals
  saleUomId: string | null
  warehouseUomId: string | null
  warehouseToSaleFactor: number | null
}

export interface Product {
  id: string
  name: TranslatedString
  categoryId: string | null
  categoryName: TranslatedString | null
  sku: string | null
  description: TranslatedString | null

  // === Pricing ===
  price: number | null
  priceQuantity: number // price per N sale units (default 1)
  currencyId: string | null
  minStock: number | null
  priceUnit: string | null // legacy: reconstructed from currency+saleUom
  avgCostPrice: number | null
  avgSalePrice: number | null

  // === UoM references (3 separate) ===
  purchaseUomId: string | null
  warehouseUomId: string | null
  saleUomId: string | null

  // === Conversion overrides (optional) ===
  purchaseToWarehouseFormulaType: string | null
  purchaseToWarehouseFactor: number | null
  warehouseToSaleFormulaType: string | null
  warehouseToSaleFactor: number | null

  createdAt: string
  fieldValues: ProductFieldValue[]
  linkedSuppliers: LinkedSupplier[]
  auditLog: SupplierAuditEntry[]
}

export interface ProductFilters {
  search: string
  categoryIds: string[]
  sortBy: 'name' | 'category' | 'price' | null
  sortDir: 'asc' | 'desc'
}
