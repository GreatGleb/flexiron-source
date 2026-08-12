/**
 * The client's order history.
 *
 * A client card that shows "the first fifty" is a card that lies about the
 * client: the list is the client's whole history, and everything read off it
 * — how much they bought, when they last ordered — is read off all of it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}))

vi.mock('@/composables/useTranslatedData', () => ({
  useTranslatedField: () => ({ tf: (v: unknown) => String(v) }),
}))

vi.mock('@/services/clientsService', () => ({
  getClient: vi.fn(async () => ({ id: 'cli-1', name: 'Client' })),
  patchClient: vi.fn(async () => ({})),
  getClientAudit: vi.fn(async () => []),
  deleteClientAuditEntry: vi.fn(async () => ({})),
  addClientInteraction: vi.fn(async () => ({})),
  deleteClientInteraction: vi.fn(async () => ({})),
}))

const TOTAL = 137
const requestedPages: number[] = []

vi.mock('@/services/ordersService', () => ({
  getOrders: vi.fn(async (_filters: unknown, pagination: { page: number; pageSize: number }) => {
    requestedPages.push(pagination.page)
    const start = (pagination.page - 1) * pagination.pageSize
    const items = Array.from(
      { length: Math.max(0, Math.min(pagination.pageSize, TOTAL - start)) },
      (_, i) => ({ id: `ORD-${start + i + 1}` }),
    )
    return {
      items,
      total: TOTAL,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(TOTAL / pagination.pageSize),
    }
  }),
}))

import { useClientCard } from './useClientCard'

beforeEach(() => {
  requestedPages.length = 0
})

describe('useClientCard — order history', () => {
  it('loads every order the client has, not the first page of them', async () => {
    const card = useClientCard('cli-1')

    await card.loadOrders()

    expect(card.orders.value).toHaveLength(TOTAL)
    expect(card.orders.value[0]!.id).toBe('ORD-1')
    expect(card.orders.value[TOTAL - 1]!.id).toBe(`ORD-${TOTAL}`)
    // Asked for page by page, and stopped once the client's orders ran out.
    expect(requestedPages.length).toBeGreaterThan(1)
  })
})
