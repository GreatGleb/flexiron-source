import type { Service, ServiceListItem } from '@/types/service'
import type { PaginatedResponse, PaginationParams } from '@/types/api'
import type { TranslatedString } from '@/types/i18n'
import { toTranslatedString } from '@/types/i18n'
import { mockServices as mockServicesData } from '@/mocks/services'
import { MOCK_SETTINGS } from './settings'

const STORE: Service[] = [...mockServicesData]

/**
 * The live catalogue, for the modules that price a service.
 *
 * Exported because there must be exactly one of these. The orders module used to
 * carry its own five-entry copy: a service created afterwards fell back to the
 * first entry of that list and was stored under the wrong NAME and the wrong
 * cost, and a cost corrected here never reached an order at all.
 */
export function serviceById(id: string): Service | undefined {
  return STORE.find((s) => s.id === id)
}

export function allServices(): Service[] {
  return [...STORE]
}

function toListItem(svc: Service): ServiceListItem {
  return {
    id: svc.id,
    name: svc.name,
    costPrice: svc.costPrice,
    sellingPrice: svc.sellingPrice,
    currencyId: svc.currencyId,
    uomId: svc.uomId,
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
  const page = pagination.page
  const pageSize = pagination.pageSize
  const start = (page - 1) * pageSize
  const items = filtered.slice(start, start + pageSize).map(toListItem)

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

/**
 * Валюта и единица проверяются по справочнику, а не приводятся типом.
 *
 * Раньше здесь стояло `data.priceUnit as Service['priceUnit']` — непроверенный каст,
 * через который проходила любая строка. После смены типа старое значение `'EUR/kg'`
 * пролезло бы молча, и тайпчек бы промолчал: «мигрировали» осталось бы утверждением
 * без доказательства. Неизвестный id — ошибка, а не запись в стор.
 */
function assertKnownPricing(currencyId: string, uomId: string): void {
  if (!MOCK_SETTINGS.currencies.some((c) => c.id === currencyId)) {
    throw new Error('SERVICE_CURRENCY_NOT_FOUND')
  }
  if (!MOCK_SETTINGS.uoms.some((u) => u.id === uomId)) {
    throw new Error('SERVICE_UOM_NOT_FOUND')
  }
}

export async function mockCreateService(
  data: {
    name: TranslatedString | string
    costPrice: number
    sellingPrice: number
    currencyId: string
    uomId: string
    description?: TranslatedString | string
  },
  locale: string = 'en',
): Promise<Service> {
  const name: TranslatedString =
    typeof data.name === 'string' ? toTranslatedString(data.name, locale) : data.name

  const description: TranslatedString | undefined = data.description
    ? typeof data.description === 'string'
      ? toTranslatedString(data.description, locale)
      : data.description
    : undefined

  assertKnownPricing(data.currencyId, data.uomId)

  const service: Service = {
    id: `svc-${String(STORE.length + 1).padStart(3, '0')}`,
    name,
    costPrice: data.costPrice,
    sellingPrice: data.sellingPrice,
    currencyId: data.currencyId,
    uomId: data.uomId,
    description,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  STORE.push(service)
  return service
}

export async function mockGetService(id: string): Promise<Service> {
  const svc = STORE.find((s) => s.id === id)
  if (!svc) throw new Error('CATALOG_SERVICE_NOT_FOUND')
  return { ...svc }
}

export async function mockPatchService(
  id: string,
  data: {
    name?: TranslatedString
    costPrice?: number
    sellingPrice?: number
    currencyId?: string
    uomId?: string
    description?: TranslatedString
  },
  _locale?: string,
): Promise<Service> {
  const idx = STORE.findIndex((s) => s.id === id)
  if (idx === -1) throw new Error('CATALOG_SERVICE_NOT_FOUND')
  const svc = STORE[idx]!
  if (data.name !== undefined) svc.name = data.name
  if (data.costPrice !== undefined) svc.costPrice = data.costPrice
  if (data.sellingPrice !== undefined) svc.sellingPrice = data.sellingPrice
  if (data.currencyId !== undefined || data.uomId !== undefined) {
    assertKnownPricing(data.currencyId ?? svc.currencyId, data.uomId ?? svc.uomId)
    if (data.currencyId !== undefined) svc.currencyId = data.currencyId
    if (data.uomId !== undefined) svc.uomId = data.uomId
  }
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
