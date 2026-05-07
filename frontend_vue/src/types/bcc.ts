import type { TranslatedString } from '@/types/i18n'

export interface BccCategory {
  id: string
  name: TranslatedString
  productCount: number
  children?: BccCategory[]
}

export interface BccRecipient {
  id: string
  company: TranslatedString
  email: string
  contactPerson: TranslatedString
  selected: boolean
}

export type BccEventStatus = 'sent' | 'responded' | 'no_response'

/** Event-sourcing row: one product × one supplier. Grouped by requestId. */
export interface BccRequest {
  id: string
  requestId: string
  date: string
  supplierId: string
  supplierName: TranslatedString
  productId: string
  productName: TranslatedString
  /** Where the request/response came from: 'BCC Tool', 'Email', 'Phone', 'Messenger', 'Other'. */
  source: TranslatedString
  status: BccEventStatus
  price?: number
  unit?: string
}

export interface BccEmailTemplate {
  subject: TranslatedString
  body: TranslatedString
  attachments: BccAttachment[]
}

export interface BccAttachment {
  id: string
  name: TranslatedString
  size: number
  type: string
}
