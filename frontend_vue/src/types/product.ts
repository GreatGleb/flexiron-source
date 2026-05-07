import type { CategoryFieldType } from './category'
import type { TranslatedString } from './i18n'

export type PriceUnit = 'EUR/vnt' | 'EUR/kg' | 'EUR/m'

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
}

export interface ProductListItem {
  id: string
  name: TranslatedString
  categoryId: string | null
  categoryName: TranslatedString | null
  sku: string | null
  price: number | null
  minStock: number | null
  priceUnit: PriceUnit | null
  createdAt: string
}

export interface Product {
  id: string
  name: TranslatedString
  categoryId: string | null
  categoryName: TranslatedString | null
  sku: string | null
  description: string | null
  price: number | null
  minStock: number | null
  priceUnit: PriceUnit | null
  createdAt: string
  fieldValues: ProductFieldValue[]
  linkedSuppliers: LinkedSupplier[]
}

export interface ProductFilters {
  search: string
  categoryIds: string[]
  sortBy: 'name' | 'category' | 'price' | null
  sortDir: 'asc' | 'desc'
}
