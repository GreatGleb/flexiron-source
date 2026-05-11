import type { Service, ServiceListItem } from '@/types/service'
import type { PaginatedResponse, PaginationParams } from '@/types/api'
import type { TranslatedString } from '@/types/i18n'
import { toTranslatedString } from '@/types/i18n'
import { mockServices as mockServicesData } from '@/mocks/services'

const STORE: Service[] = [...mockServicesData]

function toListItem(svc: Service): ServiceListItem {
  return {
    id: svc.id,
    name: svc.name,
    costPrice: svc.costPrice,
    sellingPrice: svc.sellingPrice,
    priceUnit: svc.priceUnit,
    description: svc.description,
    createdAt: svc.createdAt,
    updatedAt: svc.updatedAt,
  }
}

export async function mockGetServices(
  filters: { search: string; sortBy: string; sortDir: string },
  pagination: PaginationParams,
): Promise<PaginatedResponse<ServiceListItem>> {
  let filtered = [...STORE]

  // search
  if (filters.search) {
    const q = filters.search.toLowerCase()
    filtered = filtered.filter(
      (s) =>
        s.name.ru.toLowerCase().includes(q) ||
        s.name.en.toLowerCase().includes(q) ||
        s.name.lt.toLowerCase().includes(q),
    )
  }

  // sort
  if (filters.sortBy) {
    filtered.sort((a, b) => {
      let cmp = 0
      if (filters.sortBy === 'name') cmp = a.name.en.localeCompare(b.name.en)
      else if (filters.sortBy === 'costPrice') cmp = a.costPrice - b.costPrice
      else if (filters.sortBy === 'sellingPrice') cmp = a.sellingPrice - b.sellingPrice
      else if (filters.sortBy === 'createdAt') cmp = a.createdAt.localeCompare(b.createdAt)
      return filters.sortDir === 'desc' ? -cmp : cmp
    })
  }

  const total = filtered.length
  const page = pagination.page ?? 1
  const pageSize = pagination.pageSize ?? 25
  const start = (page - 1) * pageSize
  const items = filtered.slice(start, start + pageSize).map(toListItem)

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export async function mockCreateService(
  data: {
    name: TranslatedString | string
    costPrice: number
    sellingPrice: number
    priceUnit: string
    description?: TranslatedString | string
  },
  locale: string = 'en',
): Promise<Service> {
  const name: TranslatedString =
    typeof data.name === 'string' ? toTranslatedString(data.name, locale) : data.name

  const description: TranslatedString | undefined =
    data.description
      ? typeof data.description === 'string'
        ? toTranslatedString(data.description, locale)
        : data.description
      : undefined

  const service: Service = {
    id: `svc-${String(STORE.length + 1).padStart(3, '0')}`,
    name,
    costPrice: data.costPrice,
    sellingPrice: data.sellingPrice,
    priceUnit: data.priceUnit as Service['priceUnit'],
    description,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  STORE.push(service)
  return service
}

export async function mockGetService(id: string): Promise<Service> {
  const svc = STORE.find((s) => s.id === id)
  if (!svc) throw new Error('SERVICE_NOT_FOUND')
  return { ...svc }
}

export async function mockPatchService(
  id: string,
  data: {
    name?: TranslatedString
    costPrice?: number
    sellingPrice?: number
    priceUnit?: string
    description?: TranslatedString
  },
  _locale?: string,
): Promise<Service> {
  const idx = STORE.findIndex((s) => s.id === id)
  if (idx === -1) throw new Error('SERVICE_NOT_FOUND')
  const svc = STORE[idx]!
  if (data.name !== undefined) svc.name = data.name
  if (data.costPrice !== undefined) svc.costPrice = data.costPrice
  if (data.sellingPrice !== undefined) svc.sellingPrice = data.sellingPrice
  if (data.priceUnit !== undefined) svc.priceUnit = data.priceUnit as Service['priceUnit']
  if (data.description !== undefined) svc.description = data.description
  svc.updatedAt = new Date().toISOString()
  return { ...svc } as Service
}

export async function mockDeleteService(id: string): Promise<boolean> {
  const idx = STORE.findIndex((s) => s.id === id)
  if (idx === -1) return false
  STORE.splice(idx, 1)
  return true
}
