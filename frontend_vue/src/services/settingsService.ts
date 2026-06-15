import { apiGet, apiPut, apiPost, apiPatch, apiDelete, type RequestOptions } from './api'
import type {
  AppSettings,
  CompanyInfo,
  GlobalConstants,
  Currency,
  Uom,
  UomConversion,
  OrderStatusSetting,
  UserProfile,
} from '@/types/settings'

// ─── Company ─────────────────────────────────────────────────────────────

export async function getCompany(): Promise<CompanyInfo> {
  return apiGet<CompanyInfo>('/api/settings/company')
}

export async function saveCompany(data: Partial<CompanyInfo>): Promise<CompanyInfo> {
  return apiPatch<CompanyInfo>('/api/settings/company', data)
}

// ─── Constants ───────────────────────────────────────────────────────────

export async function getConstants(): Promise<GlobalConstants> {
  return apiGet<GlobalConstants>('/api/settings/constants')
}

export async function saveConstants(data: Partial<GlobalConstants>): Promise<GlobalConstants> {
  return apiPatch<GlobalConstants>('/api/settings/constants', data)
}

// ─── Currencies ──────────────────────────────────────────────────────────

export async function getCurrencies(): Promise<Currency[]> {
  return apiGet<Currency[]>('/api/settings/currencies')
}

export async function createCurrency(data: Omit<Currency, 'id'>): Promise<Currency> {
  return apiPost<Currency>('/api/settings/currencies', data)
}

export async function updateCurrency(id: string, data: Partial<Currency>): Promise<void> {
  await apiPatch<void>(`/api/settings/currencies/${id}`, data)
}

export async function deleteCurrency(id: string): Promise<void> {
  await apiDelete<void>(`/api/settings/currencies/${id}`)
}

// ─── Units of Measure ────────────────────────────────────────────────────

export async function getUoms(): Promise<Uom[]> {
  return apiGet<Uom[]>('/api/settings/uoms')
}

export async function createUom(data: Omit<Uom, 'id'>): Promise<Uom> {
  return apiPost<Uom>('/api/settings/uoms', data)
}

export async function updateUom(id: string, data: Partial<Uom>): Promise<void> {
  await apiPatch<void>(`/api/settings/uoms/${id}`, data)
}

export async function deleteUom(id: string): Promise<void> {
  await apiDelete<void>(`/api/settings/uoms/${id}`)
}

// ─── Conversion Rules ────────────────────────────────────────────────────

export async function getConversions(): Promise<UomConversion[]> {
  return apiGet<UomConversion[]>('/api/settings/conversions')
}

export async function createConversion(data: Omit<UomConversion, 'id'>): Promise<UomConversion> {
  return apiPost<UomConversion>('/api/settings/conversions', data)
}

export async function updateConversion(id: string, data: Partial<UomConversion>): Promise<void> {
  await apiPatch<void>(`/api/settings/conversions/${id}`, data)
}

export async function deleteConversion(id: string): Promise<void> {
  await apiDelete<void>(`/api/settings/conversions/${id}`)
}

// ─── Order Statuses ──────────────────────────────────────────────────────

export async function getOrderStatuses(): Promise<OrderStatusSetting[]> {
  return apiGet<OrderStatusSetting[]>('/api/settings/order-statuses')
}

export async function createOrderStatus(data: Omit<OrderStatusSetting, 'id'>): Promise<OrderStatusSetting> {
  return apiPost<OrderStatusSetting>('/api/settings/order-statuses', data)
}

export async function updateOrderStatus(id: string, data: Partial<OrderStatusSetting>): Promise<void> {
  await apiPatch<void>(`/api/settings/order-statuses/${id}`, data)
}

export async function moveOrderStatus(orderedIds: string[]): Promise<void> {
  await apiPut<void>('/api/settings/order-statuses/reorder', { orderedIds })
}

export async function deleteOrderStatus(id: string): Promise<void> {
  await apiDelete<void>(`/api/settings/order-statuses/${id}`)
}

// ─── Profile ─────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> | undefined {
  const token = localStorage.getItem('auth_token')
  if (!token) return undefined
  return { Authorization: `Bearer ${token}` }
}

export async function getProfile(): Promise<UserProfile> {
  return apiGet<UserProfile>('/api/settings/profile', undefined, { headers: authHeaders() })
}

export async function saveProfile(data: Partial<UserProfile>): Promise<UserProfile> {
  return apiPatch<UserProfile>('/api/settings/profile', data, { headers: authHeaders() })
}

export async function changePassword(data: {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}): Promise<void> {
  await apiPost<void>('/api/settings/change-password', data, { headers: authHeaders() })
}
