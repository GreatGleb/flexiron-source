import { apiGet, apiPost, apiPatch, apiDelete } from './api'
import type { Product, ProductListItem, ProductFilters, PriceUnit } from '@/types/product'
import type { PaginatedResponse, PaginationParams } from '@/types/api'

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

export async function createProduct(data: {
  name: string
  categoryId?: string | null
  sku?: string | null
  description?: string | null
  price?: number | null
  minStock?: number | null
  priceUnit?: PriceUnit | null
}): Promise<Product> {
  return apiPost('/api/products', data)
}

export async function patchProduct(
  id: string,
  delta: Partial<Pick<Product, 'name' | 'sku' | 'description' | 'price' | 'minStock' | 'priceUnit' | 'fieldValues' | 'linkedSuppliers'>>,
): Promise<Product> {
  return apiPatch(`/api/products/${id}`, delta)
}

export async function deleteProduct(id: string): Promise<void> {
  return apiDelete(`/api/products/${id}`)
}
