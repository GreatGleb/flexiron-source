import { apiGet, apiPost, apiPatch, apiDelete, apiPut } from './api'
import { toTranslatedString } from '@/types/i18n'
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

export async function createCategory(
  data: {
    name: string
    parentId?: string | null
    description?: string | null
  },
  locale: string,
): Promise<Category> {
  return apiPost('/api/categories', {
    name: toTranslatedString(data.name, locale),
    parentId: data.parentId,
    description: data.description ? toTranslatedString(data.description, locale) : null,
  })
}

export async function patchCategory(
  id: string,
  delta: Partial<Pick<Category, 'name' | 'parentId' | 'description'>> & { linkedSuppliers?: LinkedSupplier[] },
  locale: string,
): Promise<Category> {
  const payload: Record<string, any> = {}
  for (const [key, value] of Object.entries(delta)) {
    if (key === 'name' || key === 'description') {
      payload[key] = typeof value === 'string'
        ? toTranslatedString(value, locale)
        : value
    } else {
      payload[key] = value
    }
  }
  return apiPatch(`/api/categories/${id}`, payload)
}

export async function deleteCategory(id: string): Promise<void> {
  return apiDelete(`/api/categories/${id}`)
}

export async function putCategoryFields(
  id: string,
  fields: CategoryField[],
  locale: string,
): Promise<CategoryField[]> {
  return apiPut(`/api/categories/${id}/fields`, {
    fields: fields.map((f) => ({
      ...f,
      fieldName: typeof f.name === 'string'
        ? toTranslatedString(f.name, locale)
        : f.name,
      options: f.options?.map((o) =>
        typeof o === 'string'
          ? toTranslatedString(o, locale)
          : o,
      ),
    })),
  })
}
