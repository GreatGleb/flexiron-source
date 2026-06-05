import type { StockAuditEntry } from '@/types/warehouse'

export interface ClientOrderSummary {
  id: string
  date: string
  total: number
  currency: string
  status: string
}

export interface Client {
  id: string
  name: string
  companyCode: string
  vatCode: string
  address: string
  phone: string
  email: string
  status: 'active' | 'inactive'
  notes: string | null
  createdAt: string
  /** Client change audit log */
  auditLog?: StockAuditEntry[]
  /** Client order history — orders associated with this client */
  orderHistory?: ClientOrderSummary[]
}

export interface ClientFilters {
  search: string
  status: 'active' | 'inactive' | null
}

export type ClientFormData = Pick<Client, 'name' | 'companyCode' | 'vatCode' | 'address' | 'phone' | 'email' | 'status' | 'notes'>
