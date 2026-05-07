import type { TranslatedString } from '@/types/i18n'

export type SupplierStatus =
  | 'active'
  | 'preferred'
  | 'new'
  | 'under_review'
  | 'suspended'
  | 'blocked'

export interface Supplier {
  id: string
  company: TranslatedString
  contactPerson: TranslatedString
  email: string
  phone: string
  status: SupplierStatus
  categories: string[]
  rating: number
  country: string
  city: string
  tags: string[]
  notes: string
  leadTime: number
  lastBccDate: string | null
  hasDeficit: boolean
  createdAt: string
  updatedAt: string
}

export interface SupplierFilters {
  search: string
  status: SupplierStatus | 'all'
  categories: string[]
  rating: number
}

export interface SupplierCardData extends Supplier {
  statusReason: TranslatedString
  contractDate: string
  vatCode: string
  currency: string
  paymentTerms: string
  minOrder: number | null
  bccEmails: string[]
  addresses: SupplierAddress[]
  contacts: SupplierContact[]
  files: SupplierFile[]
  history: SupplierHistoryItem[]
  priceHistory: SupplierPriceEntry[]
  auditLog: SupplierAuditEntry[]
}

/**
 * Combined Pricing & Order History row — merges the old price ledger and BCC request log.
 * A 'pending'/'sent' row represents an outstanding request (no price yet); 'replied' means
 * the supplier responded and price/stock are filled in.
 */
export interface SupplierPriceEntry {
  date: string
  product: TranslatedString
  stock: string
  price: number | null
  /** Unit of the price — e.g. 'kg', 'ton', 'piece', 'm'. Null when price is not set yet. */
  unit: TranslatedString | null
  source: TranslatedString
  status: 'replied' | 'pending' | 'sent'
}

export interface SupplierAuditEntry {
  timestamp: string
  user: TranslatedString
  userInitials: string
  property: TranslatedString
  oldValue: string
  newValue: string
}

export interface SupplierAddress {
  type: string
  line1: string
  line2?: string
  city: string
  country: string
  zip: string
}

export interface SupplierContact {
  name: TranslatedString
  role: TranslatedString
  email: string
  phone: string
}

export interface SupplierFile {
  id: string
  name: TranslatedString
  size: number
  type: string
  uploadedAt: string
}

export interface SupplierHistoryItem {
  date: string
  action: TranslatedString
  user: TranslatedString
  details: TranslatedString
}
