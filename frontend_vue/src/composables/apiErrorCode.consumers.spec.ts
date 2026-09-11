// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { translations } from '@/i18n/translations'
import { ApiRequestError } from '@/types/api'
import { useToast } from './useToast'

/**
 * Потребители правила §2 — проверяются на форме ошибки, которую присылает НАСТОЯЩИЙ сервер:
 * машинный код в поле `code`, человеческая фраза в `message`. Именно на ней все эти ветки
 * до 2026-09-11 не срабатывали, оставляя человеку общее «не удалось».
 *
 * Почему не через мок: в мок-режиме `unwrap()` не вызывается вовсе (`api.ts:179-182`), мок
 * бросает голый `Error`, и серверной формы под ним не существует. Тест, берущий ошибку у
 * мока, проверял бы мок, а не то, ради чего заведён класс.
 *
 * `message` у каждой ошибки здесь — намеренно ЧУЖАЯ фраза, не содержащая кода: чтение
 * текста на ней обязано промахнуться. Совпадающий текст сделал бы тест зелёным и до
 * правки — питфолл #68.
 */

vi.mock('@/services/ordersService', () => ({ getOrders: vi.fn(), deleteOrder: vi.fn() }))
vi.mock('@/services/categoriesService', () => ({ getCategories: vi.fn(), deleteCategory: vi.fn() }))
// `getProduct` здесь не ради теста: его зовёт `useWarehouseOffcutCard.loadBatchProduct`.
// Без него заглушка молча отдаёт `undefined`, вызов падает TypeError'ом внутри чужого
// `catch`, и тест остаётся зелёным по неверной причине.
vi.mock('@/services/productsService', () => ({
  getProducts: vi.fn(),
  getProduct: vi.fn(),
  deleteProduct: vi.fn(),
}))
vi.mock('@/services/clientsService', () => ({ getClients: vi.fn(), deleteClient: vi.fn() }))
vi.mock('@/services/warehouseService', () => ({
  getOffcut: vi.fn(),
  patchOffcut: vi.fn(),
  deleteOffcut: vi.fn(),
  deleteOffcutAuditEntry: vi.fn(),
  createMovement: vi.fn(),
  getMovements: vi.fn(),
  getOffcuts: vi.fn(),
  getBatch: vi.fn(),
  patchBatch: vi.fn(),
  deleteBatch: vi.fn(),
  getBatchAudit: vi.fn(),
  deleteBatchAuditEntry: vi.fn(),
  getBatchAggregates: vi.fn(),
  getBatchActiveSales: vi.fn(),
}))
vi.mock('./useProductNames', () => ({ ensureProductNames: vi.fn(), useProductNames: () => ({}) }))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: { id: 'pay-1' } }),
}))
vi.mock('@/services/settingsService', () => ({ sendMailServerTest: vi.fn() }))
vi.mock('@/services/financeService', () => ({ getPayment: vi.fn(), patchPayment: vi.fn() }))

import { getOrders } from '@/services/ordersService'
import { deleteCategory } from '@/services/categoriesService'
import { deleteProduct } from '@/services/productsService'
import { deleteClient } from '@/services/clientsService'
import { getOffcut, deleteOffcut, getBatch, deleteBatch } from '@/services/warehouseService'
import { useOrders } from './useOrders'
import { useCategories } from './useCategories'
import { useProducts } from './useProducts'
import { useClients } from './useClients'
import { useWarehouseOffcutCard } from './useWarehouseOffcutCard'
import { useWarehouseBatch } from './useWarehouseBatch'
import { sendMailServerTest } from '@/services/settingsService'
import { getPayment } from '@/services/financeService'
import MailSettings from '@/views/admin/settings/MailSettings.vue'
import OutgoingPaymentCardPage from '@/views/admin/finance/OutgoingPaymentCardPage.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: translations,
})

/** Композабл зовёт `useI18n()`, а тот требует setup — отсюда обёртка, а не прямой вызов. */
function inSetup<T>(factory: () => T): T {
  let result!: T
  mount(
    {
      setup() {
        result = factory()
        return () => null
      },
    },
    { global: { plugins: [i18n] } },
  )
  return result
}

const t = (key: string) => i18n.global.t(key)

/** Заглушка-обёртка: чужая вёрстка не проверяется, но слот должен доехать до DOM. */
const PASSTHROUGH = { template: '<div><slot /></div>' }

/** Тосты — синглтон уровня модуля; между случаями список надо чистить руками. */
const toasts = useToast().toasts

function lastToast(): string {
  return toasts[toasts.length - 1]?.message ?? '<тоста не было>'
}

function serverRefusal(code: string, sentence: string): ApiRequestError {
  return new ApiRequestError({ status: 409, message: sentence, code })
}

beforeEach(() => {
  toasts.splice(0, toasts.length)
  vi.clearAllMocks()
})

describe('orders — список объясняет отказ фразой, а не текстом исключения', () => {
  it('отказ разбора параметров становится переводом', async () => {
    vi.mocked(getOrders).mockRejectedValue(
      serverRefusal('UNKNOWN_SORT_KEY', 'The server cannot sort by that column'),
    )
    const orders = inSetup(() => useOrders())
    await orders.load()
    expect(orders.error.value).toBe(t('orders.error_unknown_sort_key'))
  })

  it('незнакомый отказ становится общей фразой загрузки, а не строкой Error', async () => {
    vi.mocked(getOrders).mockRejectedValue(
      serverRefusal('SOMETHING_NOBODY_MAPPED', 'Internal failure'),
    )
    const orders = inSetup(() => useOrders())
    await orders.load()
    expect(orders.error.value).toBe(t('orders.toast_error_load'))
    expect(orders.error.value).not.toContain('Error')
  })
})

describe('categories — отказ удаления называет причину', () => {
  it('в категории есть товары', async () => {
    vi.mocked(deleteCategory).mockRejectedValue(
      serverRefusal('CATEGORY_HAS_PRODUCTS', 'The category is not empty'),
    )
    const categories = inSetup(() => useCategories())
    await categories.deleteCategory('cat-1')
    expect(lastToast()).toBe(t('categories.toast_error_delete_has_products'))
  })

  it('у категории есть подкатегории', async () => {
    vi.mocked(deleteCategory).mockRejectedValue(
      serverRefusal('CATEGORY_HAS_CHILDREN', 'The category is not empty'),
    )
    const categories = inSetup(() => useCategories())
    await categories.deleteCategory('cat-1')
    expect(lastToast()).toBe(t('categories.toast_error_delete_has_children'))
  })

  it('незнакомый код остаётся общим тостом', async () => {
    vi.mocked(deleteCategory).mockRejectedValue(serverRefusal('WHATEVER_ELSE', 'Nope'))
    const categories = inSetup(() => useCategories())
    await categories.deleteCategory('cat-1')
    expect(lastToast()).toBe(t('categories.toast_error'))
  })
})

describe('products — товар в активных заказах', () => {
  it('код из поля доводит до своего сообщения', async () => {
    vi.mocked(deleteProduct).mockRejectedValue(
      serverRefusal('PRODUCT_IN_USE', 'The product cannot be removed'),
    )
    const products = inSetup(() => useProducts())
    await products.deleteProduct('prod-1')
    expect(lastToast()).toBe(t('products.toast_error_delete_in_use'))
  })
})

describe('clients — у клиента есть заказы', () => {
  it('код из поля доводит до своего сообщения', async () => {
    vi.mocked(deleteClient).mockRejectedValue(
      serverRefusal('CONFLICT', 'The client cannot be removed'),
    )
    const clients = inSetup(() => useClients())
    await clients.handleDelete('cli-1')
    expect(lastToast()).toBe(t('clients.toast_error_delete_conflict'))
  })
})

/**
 * Склад отказывает не тостом, а состоянием: карточка объясняет, что кусок стоит в заказе.
 * Отсюда и проверка — по флагу, а не по тексту.
 *
 * `load()` здесь заведомо доедет только до присваивания записи и дальше сорвётся на
 * незаполненных моках — этого достаточно: `remove()` требует ровно её. Ошибка загрузки
 * гасится собственным `catch` композабла.
 */
describe('warehouse — отказ удаления называет причину состоянием, а не общим тостом', () => {
  it('обрезок стоит в заказе', async () => {
    vi.mocked(getOffcut).mockResolvedValue({ id: 'off-1', batchId: 'bat-1' } as never)
    vi.mocked(deleteOffcut).mockRejectedValue(
      serverRefusal('OFFCUT_LINKED_TO_ORDER', 'The offcut is reserved and cannot be removed'),
    )
    const card = inSetup(() => useWarehouseOffcutCard('off-1'))
    await card.load()
    await card.remove()
    expect(card.deleteBlockedByOrder.value).toBe(true)
    expect(lastToast()).toBe('<тоста не было>')
  })

  it('партия стоит в заказе', async () => {
    vi.mocked(getBatch).mockResolvedValue({ id: 'bat-1', productId: 'prod-1' } as never)
    vi.mocked(deleteBatch).mockRejectedValue(
      serverRefusal('BATCH_LINKED_TO_ORDER', 'The batch is reserved and cannot be removed'),
    )
    const card = inSetup(() => useWarehouseBatch('bat-1'))
    await card.load()
    await card.remove()
    expect(card.deleteBlockedByOrder.value).toBe(true)
    expect(lastToast()).toBe('<тоста не было>')
  })
})

/**
 * Два последних потребителя — компоненты, и монтируются они целиком: ветка отказа живёт
 * в обработчике кнопки и в состоянии экрана, а не в возвращённой функции. Чужие
 * компоненты заглушены — проверяется разбор ошибки, а не чужая вёрстка.
 */
describe('settings — «сервер почты не настроен» отличается от «не удалось»', () => {
  it('код из поля доводит до своего сообщения', async () => {
    vi.mocked(sendMailServerTest).mockRejectedValue(
      serverRefusal('MAIL_NOT_CONFIGURED', 'The mail server is not ready'),
    )
    const wrapper = mount(MailSettings, {
      global: {
        plugins: [i18n],
        // GlassPanel заглушается с отрисовкой слота: заглушка по умолчанию съедает
        // содержимое вместе с проверяемой кнопкой.
        stubs: { GlassPanel: PASSTHROUGH, InputGroup: PASSTHROUGH, CustomSelect: true },
        provide: {
          settings: {
            mail: {
              host: 'smtp.example.com',
              port: 587,
              encryption: 'tls',
              username: 'u',
              passwordSet: true,
              fromEmail: 'from@example.com',
              fromName: 'Flexiron',
            },
          },
          updateMail: () => {},
          mailPassword: ref(''),
          isSectionDirty: () => false,
          setMailPassword: () => {},
        },
      },
    })
    await wrapper.get('[data-test="settings-mail-test-btn"]').trigger('click')
    await flushPromises()
    expect(lastToast()).toBe(t('settingsMail.test_not_configured'))
  })
})

describe('finance — «нет такого платежа» отличается от «сеть упала»', () => {
  function mountCard() {
    return mount(OutgoingPaymentCardPage, {
      global: {
        plugins: [i18n],
        stubs: {
          GlassPanel: true,
          SvgIcon: true,
          FinanceSubNav: true,
          FileItem: true,
          DropZone: true,
          AutoResizeTextarea: true,
        },
      },
    })
  }

  it('код из поля даёт свой экран, без кнопки «повторить»', async () => {
    vi.mocked(getPayment).mockRejectedValue(serverRefusal('PAYMENT_NOT_FOUND', 'No such payment'))
    const wrapper = mountCard()
    await flushPromises()
    const state = wrapper.get('[data-test="payment-card-error"]')
    expect(state.text()).toContain(t('financePayment.not_found_title'))
    expect(state.text()).not.toContain(t('common.error_btn'))
  })

  it('любой другой отказ оставляет общий экран с кнопкой', async () => {
    vi.mocked(getPayment).mockRejectedValue(serverRefusal('WHATEVER_ELSE', 'No such payment'))
    const wrapper = mountCard()
    await flushPromises()
    const state = wrapper.get('[data-test="payment-card-error"]')
    expect(state.text()).toContain(t('common.error_title'))
    expect(state.text()).toContain(t('common.error_btn'))
  })
})
