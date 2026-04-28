import { apiGet, apiPost, apiPatch, apiDelete } from './api'
import type { Product, ProductListItem, ProductFilters, PriceUnit } from '@/types/product'
import type { PaginatedResponse } from '@/types/api'

export async function getProducts(filters: ProductFilters): Promise<PaginatedResponse<ProductListItem>> {
  const params: Record<string, string> = { search: filters.search }
  if (filters.categoryId !== null) params.categoryId = filters.categoryId
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
  delta: Partial<Pick<Product, 'name' | 'sku' | 'description' | 'price' | 'minStock' | 'priceUnit' | 'fieldValues'>>,
): Promise<Product> {
  return apiPatch(`/api/products/${id}`, delta)
}

export async function deleteProduct(id: string): Promise<void> {
  return apiDelete(`/api/products/${id}`)
}
