import { apiGet, apiPost, apiPatch, apiDelete, apiPut } from './api'
import type { Category, CategoryField, CategoryFilters, CategoryListItem } from '@/types/category'
import type { LinkedSupplier } from '@/types/product'
import type { PaginatedResponse } from '@/types/api'

export async function getCategories(
  filters: CategoryFilters,
  page = 1,
  pageSize = 25,
): Promise<PaginatedResponse<CategoryListItem>> {
  return apiGet('/api/categories', {
    search: filters.search,
    page: String(page),
    pageSize: String(pageSize),
  })
}

export async function getCategory(id: string): Promise<Category> {
  return apiGet(`/api/categories/${id}`)
}

export async function createCategory(data: {
  name: string
  parentId?: string | null
  description?: string | null
}): Promise<Category> {
  return apiPost('/api/categories', data)
}

export async function patchCategory(
  id: string,
  delta: Partial<Pick<Category, 'name' | 'parentId' | 'description'>> & { linkedSuppliers?: LinkedSupplier[] },
): Promise<Category> {
  return apiPatch(`/api/categories/${id}`, delta)
}

export async function deleteCategory(id: string): Promise<void> {
  return apiDelete(`/api/categories/${id}`)
}

export async function putCategoryFields(
  id: string,
  fields: CategoryField[],
): Promise<CategoryField[]> {
  return apiPut(`/api/categories/${id}/fields`, fields)
}
