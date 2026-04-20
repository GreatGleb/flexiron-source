export interface BccCategory {
  id: string
  name: string
  productCount: number
  children?: BccCategory[]
}

export interface BccRecipient {
  id: string
  company: string
  email: string
  contactPerson: string
  selected: boolean
}

export type BccEventStatus = 'sent' | 'responded' | 'no_response'

/** Event-sourcing row: one product × one supplier. Grouped by requestId. */
export interface BccRequest {
  id: string
  requestId: string
  date: string
  supplierId: string
  supplierName: string
  productId: string
  productName: string
  /** Where the request/response came from: 'BCC Tool', 'Email', 'Phone', 'Messenger', 'Other'. */
  source: string
  status: BccEventStatus
  price?: number
  unit?: string
}

export interface BccEmailTemplate {
  subject: string
  body: string
  attachments: BccAttachment[]
}

export interface BccAttachment {
  id: string
  name: string
  size: number
  type: string
}
