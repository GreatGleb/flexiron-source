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
const { patchClient, getClientInvoiceSummary } = vi.hoisted(() => ({
  patchClient: vi.fn(async (_id: string, _delta: Record<string, unknown>) => ({})),
  getClientInvoiceSummary: vi.fn(async (_id: string) => ({
    invoices: [] as unknown[],
    unassignedPayments: [] as unknown[],
  })),
}))

vi.mock('@/services/clientsService', () => ({
  getClient: vi.fn(async () => ({ id: 'cli-1', name: 'Client', paymentTermsDays: 30 })),
  patchClient,
  getClientAudit: vi.fn(async () => []),
  deleteClientAuditEntry: vi.fn(async () => ({})),
  addClientInteraction: vi.fn(async () => ({})),
  deleteClientInteraction: vi.fn(async () => ({})),
  getClientInvoiceSummary,
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
import type { ClientInvoice, ClientUnassignedPayment } from '@/types/client'

beforeEach(() => {
  requestedPages.length = 0
  patchClient.mockClear()
  getClientInvoiceSummary.mockClear()
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

/**
 * Итог по счетам клиента.
 *
 * Три вещи ломают простую сумму по колонке: отозванный документ, который клиент
 * не держит; вторая валюта, которую не во что пересчитать — курса в системе нет
 * нигде; и деньги, не названные ни одним счётом, которых в колонке «оплачено»
 * нет вовсе, а у клиента они есть.
 */
describe('useClientCard — сводка выставленных счетов', () => {
  function invoice(over: Partial<ClientInvoice>): ClientInvoice {
    return {
      id: 'inv',
      orderId: 'ORD-1',
      orderNumber: 'ORD-2026-001',
      number: 'ORD-2026-001/INV-1',
      issuedAt: '2026-08-01T10:00:00.000Z',
      kind: 'regular',
      currency: 'EUR',
      amountGross: 100,
      amountGrossCurrent: 100,
      withdrawn: false,
      paidAmount: 0,
      outstanding: 100,
      ...over,
    }
  }

  function loose(over: Partial<ClientUnassignedPayment>): ClientUnassignedPayment {
    return {
      orderId: 'ORD-9',
      orderNumber: 'ORD-2026-009',
      currency: 'EUR',
      paidAt: '2026-08-02T10:00:00.000Z',
      amount: 500,
      ...over,
    }
  }

  it('не считает выставленным документ, который клиент не держит', async () => {
    getClientInvoiceSummary.mockResolvedValueOnce({
      invoices: [
        invoice({ id: 'a', amountGross: 100, amountGrossCurrent: 100, outstanding: 100 }),
        invoice({
          id: 'b',
          amountGross: 250,
          amountGrossCurrent: 0,
          withdrawn: true,
          outstanding: 0,
        }),
      ],
      unassignedPayments: [],
    })

    const card = useClientCard('cli-1')
    await card.loadInvoices()

    expect(card.invoices.value).toHaveLength(2)
    expect(card.invoiceTotals.value).toHaveLength(1)
    // 100, а не 350: отозванные 250 в «выставлено» не входят.
    expect(card.invoiceTotals.value[0]).toEqual({
      currency: 'EUR',
      issued: 100,
      paid: 0,
      unassignedPaid: 0,
      outstanding: 100,
    })
  })

  it('складывает каждую валюту отдельно — пересчитывать их нечем', async () => {
    getClientInvoiceSummary.mockResolvedValueOnce({
      invoices: [
        invoice({
          id: 'a',
          currency: 'EUR',
          amountGrossCurrent: 100,
          paidAmount: 40,
          outstanding: 60,
        }),
        invoice({
          id: 'b',
          currency: 'USD',
          amountGrossCurrent: 200,
          paidAmount: 200,
          outstanding: 0,
        }),
        invoice({
          id: 'c',
          currency: 'EUR',
          amountGrossCurrent: 50,
          paidAmount: 0,
          outstanding: 50,
        }),
      ],
      unassignedPayments: [loose({ currency: 'USD', amount: 25 })],
    })

    const card = useClientCard('cli-1')
    await card.loadInvoices()

    expect(card.invoiceTotals.value).toEqual([
      { currency: 'EUR', issued: 150, paid: 40, unassignedPaid: 0, outstanding: 110 },
      { currency: 'USD', issued: 200, paid: 225, unassignedPaid: 25, outstanding: -25 },
    ])
  })

  it('деньги без ссылки на счёт входят в оплаченное и уменьшают остаток', async () => {
    // Ровно та потеря, за которую сводку завернули: платёж лежит в заказе клиента,
    // счёта не называет — и в колонку «оплачено» не попадал вовсе.
    getClientInvoiceSummary.mockResolvedValueOnce({
      invoices: [invoice({ id: 'a', amountGrossCurrent: 1000, paidAmount: 200, outstanding: 800 })],
      unassignedPayments: [loose({ amount: 500 }), loose({ orderId: 'ORD-10', amount: -120 })],
    })

    const card = useClientCard('cli-1')
    await card.loadInvoices()

    expect(card.unassignedPayments.value).toHaveLength(2)
    expect(card.invoiceTotals.value).toEqual([
      // 200 по документу плюс 380 без документа — и остаток на эти 380 меньше.
      { currency: 'EUR', issued: 1000, paid: 580, unassignedPaid: 380, outstanding: 420 },
    ])
  })

  it('деньги по заказу без единого счёта видны в итоге, а не пропадают', async () => {
    getClientInvoiceSummary.mockResolvedValueOnce({
      invoices: [],
      unassignedPayments: [loose({ amount: 3591.72 })],
    })

    const card = useClientCard('cli-1')
    await card.loadInvoices()

    expect(card.invoiceTotals.value).toEqual([
      { currency: 'EUR', issued: 0, paid: 3591.72, unassignedPaid: 3591.72, outstanding: -3591.72 },
    ])
  })

  it('сбой запроса оставляет пустой список, а не роняет карточку', async () => {
    getClientInvoiceSummary.mockRejectedValueOnce(new Error('boom'))

    const card = useClientCard('cli-1')
    await card.loadInvoices()

    expect(card.invoices.value).toEqual([])
    expect(card.unassignedPayments.value).toEqual([])
    expect(card.invoiceTotals.value).toEqual([])
    expect(card.invoicesLoading.value).toBe(false)
  })
})
