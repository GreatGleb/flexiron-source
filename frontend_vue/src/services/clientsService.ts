import { apiGet, apiPost, apiPatch, apiDelete } from './api'
import type { Client, ClientFilters, ClientFormData } from '@/types/client'
import type { PaginatedResponse } from '@/types/api'
import type { StockAuditEntry } from '@/types/warehouse'

export async function getClients(filters?: ClientFilters): Promise<PaginatedResponse<Client>> {
  return apiGet('/api/clients', (filters ?? {}) as unknown as Record<string, string>)
}

export async function getClient(id: string): Promise<Client> {
  return apiGet(`/api/clients/${id}`)
}

export async function createClient(data: ClientFormData): Promise<Client> {
  return apiPost('/api/clients', data)
}

export async function patchClient(id: string, delta: Partial<Client>): Promise<Client> {
  return apiPatch(`/api/clients/${id}`, delta)
}

export async function deleteClient(id: string): Promise<void> {
  return apiDelete(`/api/clients/${id}`)
}

export async function getClientAudit(clientId: string): Promise<StockAuditEntry[]> {
  return apiGet<StockAuditEntry[]>(`/api/clients/${clientId}/audit`)
}

export async function deleteClientAuditEntry(clientId: string, entryIndex: number): Promise<void> {
  return apiDelete<void>(`/api/clients/${clientId}/audit/${entryIndex}`)
}

export async function addClientInteraction(clientId: string, entry: import('@/types/client').InteractionHistoryEntry): Promise<import('@/types/client').InteractionHistoryEntry> {
  return apiPost(`/api/clients/${clientId}/interactions`, entry)
}

export async function deleteClientInteraction(clientId: string, entryIndex: number): Promise<void> {
  return apiDelete<void>(`/api/clients/${clientId}/interactions/${entryIndex}`)
}
