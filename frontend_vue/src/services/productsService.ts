import { apiGet, apiPost, apiPatch, apiDelete } from './api'
import type { Product, ProductListItem, ProductFilters, PriceUnit } from '@/types/product'
import type { PaginatedResponse, PaginationParams } from '@/types/api'
import { toTranslatedString } from '@/types/i18n'

export async function getProducts(
  filters: ProductFilters,
  pagination: PaginationParams,
): Promise<PaginatedResponse<ProductListItem>> {
  const params: Record<string, string> = {
    search: filters.search,
    page: String(pagination.page),
    pageSize: String(pagination.pageSize),
  }
  if (filters.categoryIds.length > 0) params.categoryIds = filters.categoryIds.join(',')
  if (filters.sortBy) { params.sortBy = filters.sortBy; params.sortDir = filters.sortDir }
  return apiGet('/api/products', params)
}

export async function getProduct(id: string): Promise<Product> {
  return apiGet(`/api/products/${id}`)
}

export async function createProduct(
  data: {
    name: string
    categoryId?: string | null
    sku?: string | null
    description?: string | null
    price?: number | null
    minStock?: number | null
    priceUnit?: PriceUnit | null
  },
  locale: string,
): Promise<Product> {
  const payload = {
    ...data,
    name: typeof data.name === 'string' ? toTranslatedString(data.name, locale) : data.name,
    description: data.description
      ? typeof data.description === 'string'
        ? toTranslatedString(data.description, locale)
        : data.description
      : null,
  }
  return apiPost('/api/products', payload)
}

export async function patchProduct(
  id: string,
  delta: Partial<Pick<Product, 'name' | 'sku' | 'description' | 'price' | 'minStock' | 'priceUnit' | 'fieldValues' | 'linkedSuppliers'>>,
  locale: string,
): Promise<Product> {
  const payload: Record<string, unknown> = { ...delta }
  if (delta.name) {
    payload.name = typeof delta.name === 'string' ? toTranslatedString(delta.name, locale) : delta.name
  }
  if (delta.description) {
    payload.description = typeof delta.description === 'string' ? toTranslatedString(delta.description, locale) : delta.description
  }
  if (delta.fieldValues) {
    payload.fieldValues = delta.fieldValues.map((fv) => ({
      ...fv,
      fieldName: typeof fv.fieldName === 'string'
        ? toTranslatedString(fv.fieldName, locale)
        : fv.fieldName,
      options: fv.options?.map((o) =>
        typeof o === 'string' ? toTranslatedString(o, locale) : o,
      ),
    }))
  }
  if (delta.linkedSuppliers) {
    payload.linkedSuppliers = delta.linkedSuppliers.map((s) => ({
      ...s,
      name: typeof s.name === 'string'
        ? toTranslatedString(s.name, locale)
        : s.name,
    }))
  }
  return apiPatch(`/api/products/${id}`, payload)
}

export async function deleteProduct(id: string): Promise<void> {
  return apiDelete(`/api/products/${id}`)
}
