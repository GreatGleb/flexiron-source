import type { StockAuditEntry } from '@/types/warehouse'
import type { CountryCode } from '@/domain/countries'

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
  /**
   * Страна клиента кодом справочника ISO 3166-1 alpha-2 (`src/domain/countries.ts`),
   * или `null` у клиента, заведённого до появления поля.
   *
   * Отдельно от `address` потому, что по ней система предлагает тип комплекта
   * документов: вытащить страну из строки «Vytauto g. 15, Kaunas» нечем.
   */
  country: CountryCode | null
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
  | 'country'
  | 'phone'
  | 'email'
  | 'status'
  | 'notes'
  | 'rejectionReason'
>
