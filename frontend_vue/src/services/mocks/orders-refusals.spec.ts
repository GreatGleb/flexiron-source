import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * `mockFifoAllocation` подменяется один раз на файл, реализация по умолчанию —
 * настоящая (`actual`). Класс 500 ниже включает поломку точечно, через
 * `mockImplementationOnce`, для одного конкретного вызова внутри своего теста.
 */
vi.mock('./warehouse', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./warehouse')>()
  return { ...actual, mockFifoAllocation: vi.fn(actual.mockFifoAllocation) }
})

import {
  mockGetOrder,
  mockCreateOrder,
  mockAddOrderItem,
  mockAddOrderPayment,
  mockDeleteOrder,
  mockCorrectOrderLine,
  mockGetOrders,
} from './orders'
import { mockFifoAllocation } from './warehouse'
import { mockPatchProfile } from './settings'
import { mockGetClients } from './clients'
import { STORE as PRODUCTS_STORE } from './products'
import { ApiRequestError } from '@/types/api'

/**
 * Отказ мока заказов — `ApiRequestError` с кодом в ПОЛЕ `code` и статусом по
 * классу из §3.2 `orders-backend-plan.md`, а не строкой внутри `message`
 * (соглашения §2). Проба поведенческая: она ВЫЗЫВАЕТ мок и утверждает
 * `e.code`/`e.status`, а не ищет подстроку в тексте.
 *
 * Откати любую из 105 строк `orders.ts` назад на голый
 * `throw new Error(<тот же текст>)` — источниковая проба ниже покраснеет всегда
 * (она читает файл), а если строка вошла в один из вызовов ниже — покраснеет и
 * поведенческая: `e.code` станет `undefined`, `e.status` — `NaN`/`undefined`,
 * хотя текст сообщения при этом не изменится ни на символ.
 */

const CLIENT_ID = mockGetClients()[0]!.id
const PRODUCT_ID = PRODUCTS_STORE[0]!.id

/** Отказ обязан быть `ApiRequestError` с полем `code`; успех — провал пробы. */
function refusalOf(run: () => unknown): ApiRequestError {
  try {
    run()
  } catch (e) {
    expect(e).toBeInstanceOf(ApiRequestError)
    return e as ApiRequestError
  }
  throw new Error('мок ответил успехом там, где обязан был отказать')
}

function freshOrder() {
  return mockCreateOrder({ clientId: CLIENT_ID, documentType: 'local' })
}

describe('исходник мока', () => {
  it('orders.ts не бросает голый Error — код обязан лежать в ApiRequestError.code', () => {
    const path = resolve(process.cwd(), 'src/services/mocks/orders.ts')
    const source = readFileSync(path, 'utf8')
    expect(source.includes('throw new Error(')).toBe(false)
  })
})

describe('404 — не найдено', () => {
  it('GET несуществующего заказа: ORDER_NOT_FOUND, 404', () => {
    const e = refusalOf(() => mockGetOrder('ord-missing'))
    expect(e.code).toBe('ORDER_NOT_FOUND')
    expect(e.status).toBe(404)
    expect(e.message).toBe('ORDER_NOT_FOUND')
  })

  it('создание заказа на несуществующего клиента: CLIENT_NOT_FOUND, 404', () => {
    const e = refusalOf(() => mockCreateOrder({ clientId: 'cl-missing', documentType: 'local' }))
    expect(e.code).toBe('CLIENT_NOT_FOUND')
    expect(e.status).toBe(404)
    expect(e.message).toBe('CLIENT_NOT_FOUND')
  })
})

describe('403 — право', () => {
  it('себестоимость руками без права: FORBIDDEN_MANUALCOST, 403', () => {
    mockPatchProfile({ role: 'owner' })
    const order = freshOrder()
    mockPatchProfile({ role: 'manager' })
    try {
      const e = refusalOf(() =>
        mockAddOrderItem(order.id, {
          productId: PRODUCT_ID,
          quantity: 5,
          unit: 'pcs',
          unitPrice: 10,
          unitCost: 7,
        }),
      )
      expect(e.code).toBe('FORBIDDEN_MANUALCOST')
      expect(e.status).toBe(403)
      expect(e.message).toBe('FORBIDDEN_MANUALCOST')
    } finally {
      mockPatchProfile({ role: 'owner' })
    }
  })

  it('корректировка строки без права: FORBIDDEN_CORRECTION, 403', () => {
    mockPatchProfile({ role: 'owner' })
    const order = freshOrder()
    const item = mockAddOrderItem(order.id, {
      productId: PRODUCT_ID,
      quantity: 5,
      unit: 'pcs',
      unitPrice: 10,
    })
    mockPatchProfile({ role: 'manager' })
    try {
      const e = refusalOf(() =>
        mockCorrectOrderLine(order.id, item.id, { unitPrice: 12, reason: 'test' }),
      )
      expect(e.code).toBe('FORBIDDEN_CORRECTION')
      expect(e.status).toBe(403)
      expect(e.message).toBe('FORBIDDEN_CORRECTION')
    } finally {
      mockPatchProfile({ role: 'owner' })
    }
  })
})

describe('409 — состояние заказа мешает операции', () => {
  it('версия из другого чтения: ORDER_VERSION_CONFLICT, 409', () => {
    const order = freshOrder()
    const e = refusalOf(() =>
      mockAddOrderItem(order.id, {
        productId: PRODUCT_ID,
        quantity: 1,
        unit: 'pcs',
        unitPrice: 1,
        version: (order.version ?? 1) + 1,
      }),
    )
    expect(e.code).toBe('ORDER_VERSION_CONFLICT')
    expect(e.status).toBe(409)
    expect(e.message).toBe('ORDER_VERSION_CONFLICT')
  })

  it('у заказа уже есть платёж — не удалить: ORDER_HAS_PAYMENT, 409', () => {
    const order = freshOrder()
    mockAddOrderPayment(order.id, { amount: 100 })
    const e = refusalOf(() => mockDeleteOrder(order.id))
    expect(e.code).toBe('ORDER_HAS_PAYMENT')
    expect(e.status).toBe(409)
    expect(e.message).toBe('ORDER_HAS_PAYMENT')
  })
})

describe('422 — негодный вход', () => {
  it('неизвестный ключ сортировки: UNKNOWN_SORT_KEY, 422', () => {
    const e = refusalOf(() =>
      mockGetOrders(
        {
          search: '',
          status: 'all',
          clientId: null,
          dateFrom: '',
          dateTo: '',
          sortBy: 'notAColumn',
          sortDir: 'asc',
        },
        { page: 1, pageSize: 10 },
      ),
    )
    expect(e.code).toBe('UNKNOWN_SORT_KEY')
    expect(e.status).toBe(422)
    expect(e.message).toBe('UNKNOWN_SORT_KEY: notAColumn')
  })

  it('нулевое количество строки: ZERO_QUANTITY, 422', () => {
    const order = freshOrder()
    const e = refusalOf(() =>
      mockAddOrderItem(order.id, { productId: PRODUCT_ID, quantity: 0, unit: 'pcs', unitPrice: 1 }),
    )
    expect(e.code).toBe('ZERO_QUANTITY')
    expect(e.status).toBe(422)
    expect(e.message).toBe('ZERO_QUANTITY')
  })
})

describe('500 — внутренний инвариант, наружу не выставляется', () => {
  /** Склад отдал больше, чем попросили — сумма аллокаций строки превышает её количество. */
  function inflateNextFifoCall(): void {
    vi.mocked(mockFifoAllocation).mockImplementationOnce(() => ({
      allocations: [
        {
          batchId: 'fake-batch',
          offcutId: null,
          quantity: 999,
          unitCost: 1,
          currency: 'EUR',
          source: 'stock',
        },
      ],
      shortageQuantity: 0,
      weightedUnitCost: 1,
    }))
  }

  it('создание строки: ALLOCATION_EXCEEDS_QUANTITY, 500 (первый заказ)', () => {
    inflateNextFifoCall()
    const order = freshOrder()
    const e = refusalOf(() =>
      mockAddOrderItem(order.id, {
        productId: PRODUCT_ID,
        quantity: 5,
        unit: 'pcs',
        unitPrice: 10,
      }),
    )
    expect(e.code).toBe('ALLOCATION_EXCEEDS_QUANTITY')
    expect(e.status).toBe(500)
    expect(e.message.startsWith('ALLOCATION_EXCEEDS_QUANTITY: ')).toBe(true)
  })

  it('создание строки: ALLOCATION_EXCEEDS_QUANTITY, 500 (второй заказ)', () => {
    inflateNextFifoCall()
    const order = freshOrder()
    const e = refusalOf(() =>
      mockAddOrderItem(order.id, {
        productId: PRODUCT_ID,
        quantity: 3,
        unit: 'pcs',
        unitPrice: 10,
      }),
    )
    expect(e.code).toBe('ALLOCATION_EXCEEDS_QUANTITY')
    expect(e.status).toBe(500)
    expect(e.message.startsWith('ALLOCATION_EXCEEDS_QUANTITY: ')).toBe(true)
  })
})
