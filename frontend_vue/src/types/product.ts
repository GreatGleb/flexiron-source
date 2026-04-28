import type { CategoryFieldType } from './category'

export type PriceUnit = 'EUR/vnt' | 'EUR/kg' | 'EUR/m'

export interface ProductFieldValue {
  fieldId: string
  fieldName: string
  fieldType: CategoryFieldType
  value: string | number | boolean | string[] | null
  inherited: boolean
  options?: string[]
}

export interface LinkedSupplier {
  id: string
  name: string
  price: number | null
  priceUnit: string | null
  leadDays: number | null
}

export interface ProductListItem {
  id: string
  name: string
  categoryId: string | null
  categoryName: string | null
  sku: string | null
  price: number | null
  minStock: number | null
  priceUnit: PriceUnit | null
  createdAt: string
}

export interface Product {
  id: string
  name: string
  categoryId: string | null
  categoryName: string | null
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
  categoryId: string | null
}
