import type { StockAuditEntry } from '@/types/warehouse'

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
  /** Manager's interaction history (calls, emails, notes, meetings) */
  interactionHistory?: InteractionHistoryEntry[]
}

export interface ClientFilters {
  search: string
  status: 'active' | 'inactive' | null
  // `createdAt` is what "the newest clients" is sorted by, and that sort belongs
  // to the server: picking the newest out of one page picks them out of a page.
  sortBy: 'name' | 'email' | 'status' | 'createdAt' | null
  sortDir: 'asc' | 'desc'
}

export type ClientFormData = Pick<
  Client,
  | 'name'
  | 'companyCode'
  | 'vatCode'
  | 'address'
  | 'phone'
  | 'email'
  | 'status'
  | 'notes'
  | 'rejectionReason'
>
