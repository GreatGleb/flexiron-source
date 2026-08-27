/**
 * The client's order history.
 *
 * A client card that shows "the first fifty" is a card that lies about the
 * client: the list is the client's whole history, and everything read off it
 * — how much they bought, when they last ordered — is read off all of it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}))

vi.mock('@/composables/useTranslatedData', () => ({
  useTranslatedField: () => ({ tf: (v: unknown) => String(v) }),
}))

// `vi.mock` поднимается наверх файла, поэтому шпион объявляется через `vi.hoisted`:
// обычная константа к моменту подстановки ещё не инициализирована.
const { patchClient } = vi.hoisted(() => ({
  patchClient: vi.fn(async (_id: string, _delta: Record<string, unknown>) => ({})),
}))

vi.mock('@/services/clientsService', () => ({
  getClient: vi.fn(async () => ({ id: 'cli-1', name: 'Client', paymentTermsDays: 30 })),
  patchClient,
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
  patchClient.mockClear()
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

describe('useClientCard — payment terms', () => {
  it('keeps whole non-negative days, whatever the number field hands over', async () => {
    const card = useClientCard('cli-1')
    await card.load()

    // Очищенное поле: `v-model.number` кладёт NaN, и без нормализации он уехал бы
    // в PATCH — питфолл #25.
    card.paymentTermsDays.value = NaN as unknown as number
    expect(card.client.value!.paymentTermsDays).toBe(0)

    // Минус — это срок оплаты раньше даты счёта, дробь — срок в середине дня.
    card.paymentTermsDays.value = -5
    expect(card.client.value!.paymentTermsDays).toBe(0)
    card.paymentTermsDays.value = 14.9
    expect(card.client.value!.paymentTermsDays).toBe(14)

    // Обычное значение проходит как есть, иначе поле было бы просто заглушкой.
    card.paymentTermsDays.value = 45
    expect(card.client.value!.paymentTermsDays).toBe(45)
  })

  it('sends the changed terms — and a number, not NaN', async () => {
    const card = useClientCard('cli-1')
    await card.load()

    card.paymentTermsDays.value = NaN as unknown as number
    // `useDirtyCheck` держится на `watchEffect`, а тот срабатывает на следующем
    // тике: без него `save()` увидит незапачканную форму и не отправит ничего.
    await nextTick()
    await card.save()

    expect(patchClient).toHaveBeenCalledTimes(1)
    expect(patchClient.mock.calls[0]![1]).toEqual({ paymentTermsDays: 0 })
  })
})
