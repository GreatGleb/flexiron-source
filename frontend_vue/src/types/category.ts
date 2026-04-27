export type CategoryFieldType = 'text' | 'number' | 'boolean' | 'enum' | 'email' | 'date' | 'file'

export interface CategoryField {
  id: string
  name: string
  type: CategoryFieldType
  required: boolean
  order: number
  options: string[]
}

export interface Category {
  id: string
  name: string
  parentId: string | null
  description: string | null
  fieldCount: number
  productCount: number
  inheritedFields: CategoryField[]
  fields: CategoryField[]
}

export interface CategoryListItem {
  id: string
  name: string
  parentId: string | null
  parentName: string | null
  fieldCount: number
  productCount: number
  level: number
}

export interface CategoryFilters {
  search: string
}
