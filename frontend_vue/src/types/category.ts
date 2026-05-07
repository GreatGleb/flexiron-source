import type { TranslatedString } from './i18n'
import type { LinkedSupplier } from './product'

export type CategoryFieldType = 'text' | 'number' | 'boolean' | 'enum' | 'email' | 'date' | 'file'

export interface CategoryField {
  id: string
  name: TranslatedString
  type: CategoryFieldType
  required: boolean
  order: number
  options: TranslatedString[]
}

export interface Category {
  id: string
  name: TranslatedString
  parentId: string | null
  description: TranslatedString | null
  fieldCount: number
  productCount: number
  inheritedFields: CategoryField[]
  fields: CategoryField[]
  linkedSuppliers: LinkedSupplier[]
}

export interface CategoryListItem {
  id: string
  name: TranslatedString
  parentId: string | null
  parentName: TranslatedString | null
  fieldCount: number
  productCount: number
  level: number
}

export interface CategoryFilters {
  search: string
}
