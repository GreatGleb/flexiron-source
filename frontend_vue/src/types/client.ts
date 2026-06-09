import type { StockAuditEntry } from '@/types/warehouse'

export interface ClientOrderSummary {
  id: string
  date: string
  total: number
  currency: string
  status: string
}

/** A single entry in the client's interaction history (calls, emails, notes) */
export interface InteractionHistoryEntry {
  date: string
  type: 'call' | 'email' | 'note' | 'meeting'
  summary: string
  user: string
  /** Optional reason if this interaction relates to a rejection/issue */
  rejectionReason?: string | null
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
  /** Free-text reason when client is rejected or blocked */
  rejectionReason?: string | null
  createdAt: string
  /** Client change audit log */
  auditLog?: StockAuditEntry[]
  /** Client order history — orders associated with this client */
  orderHistory?: ClientOrderSummary[]
  /** Manager's interaction history (calls, emails, notes, meetings) */
  interactionHistory?: InteractionHistoryEntry[]
}

export interface ClientFilters {
  search: string
  status: 'active' | 'inactive' | null
  sortBy: 'name' | 'email' | 'status' | null
  sortDir: 'asc' | 'desc'
}

export type ClientFormData = Pick<Client, 'name' | 'companyCode' | 'vatCode' | 'address' | 'phone' | 'email' | 'status' | 'notes' | 'rejectionReason'>
