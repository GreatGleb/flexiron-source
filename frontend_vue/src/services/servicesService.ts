import { apiGet, apiPost, apiPatch, apiDelete } from './api'
import type { PaginatedResponse, PaginationParams } from '@/types/api'
import type {
  Service,
  ServiceListItem,
  ServiceFilters,
  ServiceCreatePayload,
  ServicePatchPayload,
} from '@/types/service'
import type { TranslatedString } from '@/types/i18n'
import { toTranslatedString } from '@/types/i18n'

export async function getServices(
  filters: ServiceFilters,
  pagination: PaginationParams,
): Promise<PaginatedResponse<ServiceListItem>> {
  const params: Record<string, string> = {
    search: filters.search,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    page: String(pagination.page),
    pageSize: String(pagination.pageSize),
  }
  return apiGet<PaginatedResponse<ServiceListItem>>('/api/services', params)
}

export async function getService(id: string): Promise<Service> {
  return apiGet<Service>(`/api/services/${id}`)
}

export async function createService(data: ServiceCreatePayload, locale: string): Promise<Service> {
  const payload = {
    name: toTranslatedString(data.name, locale),
    costPrice: data.costPrice,
    sellingPrice: data.sellingPrice,
    priceUnit: data.priceUnit,
    description:
      data.description !== undefined ? toTranslatedString(data.description, locale) : undefined,
  }
  return apiPost<Service>('/api/services', payload)
}

function toPayloadValue(
  value: string | TranslatedString | null | undefined,
  locale: string,
): TranslatedString | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'string') return toTranslatedString(value, locale)
  return value
}

export async function patchService(
  id: string,
  delta: Omit<ServicePatchPayload, 'name' | 'description'> & {
    name?: string | TranslatedString | null
    description?: string | TranslatedString | null
  },
  locale: string,
): Promise<Service> {
  const payload: Record<string, unknown> = {}
  const name = toPayloadValue(delta.name as string | TranslatedString | null | undefined, locale)
  if (name !== undefined) payload.name = name
  if (delta.costPrice !== undefined) payload.costPrice = delta.costPrice
  if (delta.sellingPrice !== undefined) payload.sellingPrice = delta.sellingPrice
  if (delta.priceUnit) payload.priceUnit = delta.priceUnit
  const desc = toPayloadValue(
    delta.description as string | TranslatedString | null | undefined,
    locale,
  )
  if (desc !== undefined) payload.description = desc
  return apiPatch<Service>(`/api/services/${id}`, payload)
}

export async function deleteService(id: string): Promise<void> {
  return apiDelete(`/api/services/${id}`)
}
