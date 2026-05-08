import type { TranslatedString } from './i18n'
export type ServicePriceUnit = 'EUR/vnt' | 'EUR/kg' | 'EUR/m' | 'EUR/h'

export interface Service {
  id: string
  name: TranslatedString
  costPrice: number
  sellingPrice: number
  priceUnit: ServicePriceUnit
  description?: TranslatedString
  createdAt: string
  updatedAt: string
}

/** @deprecated Use Service instead — both types are identical */
export type ServiceListItem = Service

export interface ServiceFilters {
  search: string
  sortBy: 'name' | 'costPrice' | 'sellingPrice' | 'createdAt'
  sortDir: 'asc' | 'desc'
}

export type ServiceCreatePayload = {
  name: string
  costPrice: number
  sellingPrice: number
  priceUnit: ServicePriceUnit
  description?: string
}

export type ServicePatchPayload = Partial<ServiceCreatePayload>
