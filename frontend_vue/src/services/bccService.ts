import { apiGet, apiPost, newIdempotencyKey } from './api'
import { toTranslatedString } from '@/types/i18n'
import type { BccCategory, BccRecipient, BccRequest } from '@/types/bcc'
import type { PaginatedResponse, PaginationParams } from '@/types/api'

export async function getBccCategories(): Promise<BccCategory[]> {
  return apiGet<BccCategory[]>('/api/bcc/categories')
}

export async function getBccRecipients(productIds: string[]): Promise<BccRecipient[]> {
  return apiGet<BccRecipient[]>('/api/bcc/recipients', { products: productIds.join(',') })
}

export async function getBccHistory(
  pagination?: PaginationParams,
): Promise<PaginatedResponse<BccRequest>> {
  const params: Record<string, string> = {
    page: String(pagination?.page ?? 1),
    pageSize: String(pagination?.pageSize ?? 25),
  }
  return apiGet<PaginatedResponse<BccRequest>>('/api/bcc/history', params)
}

/** Send BCC email. Idempotency-Key guards against double-send on retry. */
export async function sendBccRequest(payload: {
  productIds: string[]
  recipientIds: string[]
  subject: string
  body: string
  fileIds?: string[]
}, locale: string): Promise<{ requestId: string }> {
  return apiPost<{ requestId: string }>('/api/bcc/send', {
    ...payload,
    subject: toTranslatedString(payload.subject, locale),
    body: toTranslatedString(payload.body, locale),
  }, {
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  })
}

/** Log a request without sending an email (came via phone/email/messenger/etc.). */
export async function logBccRequest(payload: {
  productIds: string[]
  recipientIds: string[]
  source: string
}, locale: string): Promise<{ requestId: string }> {
  return apiPost<{ requestId: string }>('/api/bcc/log', {
    ...payload,
    source: toTranslatedString(payload.source, locale),
  }, {
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  })
}

export async function acceptBccResponse(
  eventId: string,
  payload: { price: number; unit: string },
): Promise<BccRequest> {
  return apiPost<BccRequest>(`/api/bcc/events/${eventId}/response`, payload)
}

export async function markBccNoResponse(eventId: string): Promise<BccRequest> {
  return apiPost<BccRequest>(`/api/bcc/events/${eventId}/no-response`, {})
}

