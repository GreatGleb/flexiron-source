// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { translations } from '@/i18n/translations'
import { useToast } from '@/composables/useToast'

/**
 * §15 соглашений: «`catch { load() }` разрушает несохранённое» — этим поведением карточка
 * заказа уже была признана разрушительной, и то же правило распространяется на карточку
 * исходящего платежа (roo_code/roo-context/api/finance.md, правило домена 17, до этой правки).
 * Save — clean-slate, один запрос на нажатие: отказ PATCH не перечитывает запись, черновик
 * заметок остаётся набранным, а отказ доходит до человека тостом.
 */
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'pay-1' } }),
}))
vi.mock('@/services/financeService', () => ({
  getPayment: vi.fn(),
  patchPayment: vi.fn(),
}))

import { getPayment, patchPayment } from '@/services/financeService'
import OutgoingPaymentCardPage from './OutgoingPaymentCardPage.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: translations,
})

const toasts = useToast().toasts

function lastToastMessage(): string {
  return toasts[toasts.length - 1]?.message ?? '<тоста не было>'
}

function mountCard() {
  return mount(OutgoingPaymentCardPage, {
    global: {
      plugins: [i18n],
      // Чужая вёрстка не проверяется: SvgIcon/FinanceSubNav/FileItem/DropZone заглушены.
      // GlassPanel и AutoResizeTextarea остаются настоящими — заметки живут в их слоте.
      stubs: { SvgIcon: true, FinanceSubNav: true, FileItem: true, DropZone: true },
    },
  })
}

const PAYMENT = {
  id: 'pay-1',
  paymentNumber: 'PAY-1',
  direction: 'outgoing' as const,
  status: 'pending' as const,
  amount: 100,
  currency: 'EUR',
  counterpartyId: 'sup-1',
  counterpartyName: 'Supplier',
  counterpartyVatCode: 'VAT1',
  orderId: null,
  orderNumber: null,
  supplierInvoiceRef: null,
  description: null,
  dueDate: '2026-10-01',
  paidAt: null,
  documents: [],
  notes: 'original note',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  toasts.splice(0, toasts.length)
  vi.clearAllMocks()
  vi.mocked(getPayment).mockResolvedValue(structuredClone(PAYMENT) as never)
})

describe('OutgoingPaymentCardPage — отказ Save не стирает набранное', () => {
  it('черновик заметок остаётся, getPayment повторно не вызывается, отказ показан тостом', async () => {
    vi.mocked(patchPayment).mockRejectedValue(new Error('network down'))
    const wrapper = mountCard()
    await flushPromises()

    const textarea = wrapper.get('[data-test="payment-notes-input"]')
    await textarea.setValue('черновик человека')

    await wrapper.get('[data-test="payment-card-save-btn"]').trigger('click')
    await flushPromises()

    expect((textarea.element as HTMLTextAreaElement).value).toBe('черновик человека')
    expect(getPayment).toHaveBeenCalledTimes(1)
    expect(lastToastMessage()).toBe(i18n.global.t('financePayment.toast_error_save'))
  })

  it('повторное нажатие Save шлёт тот же PATCH с тем же черновиком', async () => {
    vi.mocked(patchPayment).mockRejectedValueOnce(new Error('network down'))
    vi.mocked(patchPayment).mockResolvedValueOnce({
      ...structuredClone(PAYMENT),
      notes: 'черновик человека',
    } as never)
    const wrapper = mountCard()
    await flushPromises()

    const textarea = wrapper.get('[data-test="payment-notes-input"]')
    await textarea.setValue('черновик человека')

    const saveBtn = wrapper.get('[data-test="payment-card-save-btn"]')
    expect(saveBtn.attributes('disabled')).toBeUndefined()
    await saveBtn.trigger('click')
    await flushPromises()

    expect(saveBtn.attributes('disabled')).toBeUndefined()
    await saveBtn.trigger('click')
    await flushPromises()

    expect(patchPayment).toHaveBeenCalledTimes(2)
    expect(vi.mocked(patchPayment).mock.calls[0]![1]).toMatchObject({ notes: 'черновик человека' })
    expect(vi.mocked(patchPayment).mock.calls[1]![1]).toMatchObject({ notes: 'черновик человека' })
    expect(getPayment).toHaveBeenCalledTimes(1)
  })
})
