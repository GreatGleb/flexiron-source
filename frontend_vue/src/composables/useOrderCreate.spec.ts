/**
 * The create page's save path.
 *
 * The one thing this page must never do is create an order that differs from
 * the table the admin was looking at when they pressed Save. Everything else
 * here is a variation on that: two lines of the same product are two lines,
 * removing one removes one, and what goes out is what was on screen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}))

vi.mock('@/composables/useSettings', () => ({
  useSettings: () => ({
    settings: {
      constants: {
        vatRate: 21,
        defaultMargin: 15,
        defaultCurrency: 'EUR',
        defaultDiscountPercent: 0,
      },
    },
  }),
}))

const sentItems: Array<Record<string, unknown>> = []
const sentServices: Array<Record<string, unknown>> = []
/** Set by a test to make the next matching line fail once, as the server would. */
let failItemOnce: string | null = null
const createCalls = { n: 0 }

vi.mock('@/services/ordersService', () => ({
  createOrder: vi.fn(async () => {
    createCalls.n += 1
    return { id: 'ORD-TEST' }
  }),
  getOrder: vi.fn(async (id: string) => ({ id })),
  patchOrder: vi.fn(async () => ({})),
  addOrderItem: vi.fn(async (_orderId: string, data: Record<string, unknown>) => {
    if (failItemOnce !== null && data.productId === failItemOnce) {
      failItemOnce = null
      throw new Error('ZERO_QUANTITY')
    }
    sentItems.push(data)
    return {}
  }),
  addOrderService: vi.fn(async (_orderId: string, data: Record<string, unknown>) => {
    sentServices.push(data)
    return {}
  }),
  addOrderFile: vi.fn(async () => ({})),
}))

vi.mock('@/services/clientsService', () => ({
  getClients: vi.fn(async () => ({ items: [], total: 0 })),
}))

import { useOrderCreate } from './useOrderCreate'
import type { Client } from '@/types/client'

const PIPE = {
  productId: 'prod-alu',
  productName: 'Aluminium Pipe 25x2',
  quantity: 1,
  unit: 'm',
  unitPrice: 12,
  unitCost: 7.8,
}

const COPPER = {
  productId: 'prod-cu',
  productName: 'Copper Pipe 15x1',
  quantity: 1,
  unit: 'm',
  unitPrice: 18.5,
  unitCost: 6,
}

const WELDING = {
  serviceId: 'svc-weld',
  serviceName: 'Welding',
  quantity: 1,
  price: 40,
  cost: 25,
}

beforeEach(() => {
  sentItems.length = 0
  sentServices.length = 0
  failItemOnce = null
  createCalls.n = 0
})

describe('useOrderCreate — what is saved is what is on screen', () => {
  it('keeps the second line of a product when the first one is removed', async () => {
    const page = useOrderCreate()
    page.form.value.clientId = 'cli-1'

    page.addItem(PIPE)
    page.addItem(PIPE)
    page.addItem(COPPER)

    // The admin removes line 2 — the duplicate, not the product.
    page.removeItem(page.localOrder.value.items[1]!.id)
    expect(page.localOrder.value.items.map((i) => i.productName)).toEqual([
      'Aluminium Pipe 25x2',
      'Copper Pipe 15x1',
    ])

    await page.handleSave()

    expect(sentItems.map((i) => i.productId)).toEqual(['prod-alu', 'prod-cu'])
  })

  it('saves both lines of the same product when neither is removed', async () => {
    const page = useOrderCreate()
    page.form.value.clientId = 'cli-1'

    page.addItem(PIPE)
    page.addItem(PIPE)

    await page.handleSave()

    expect(sentItems).toHaveLength(2)
    expect(sentItems.every((i) => i.productId === 'prod-alu')).toBe(true)
  })

  it('sends the quantity and price the table showed, not the ones first asked for', async () => {
    const page = useOrderCreate()
    page.form.value.clientId = 'cli-1'

    page.addItem({ ...PIPE, quantity: 3 })
    await page.handleSave()

    const line = page.localOrder.value.items[0]!
    expect(sentItems[0]).toMatchObject({
      productId: 'prod-alu',
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: line.unitPrice,
    })
  })

  it('keeps the second line of a service when the first one is removed', async () => {
    const page = useOrderCreate()
    page.form.value.clientId = 'cli-1'

    page.addService(WELDING)
    page.addService(WELDING)

    page.removeService(page.localOrder.value.services[0]!.id)
    expect(page.localOrder.value.services).toHaveLength(1)

    await page.handleSave()

    expect(sentServices).toHaveLength(1)
    expect(sentServices[0]).toMatchObject({ serviceId: 'svc-weld', quantity: 1 })
  })

  it('sends nothing at all when every line has been removed again', async () => {
    const page = useOrderCreate()
    page.form.value.clientId = 'cli-1'

    page.addItem(PIPE)
    page.removeItem(page.localOrder.value.items[0]!.id)

    await page.handleSave()

    expect(sentItems).toHaveLength(0)
  })
})

/**
 * Creating an order is five kinds of request and the order exists after the
 * first one. A refusal in the middle used to leave a half-built order on the
 * server while the admin was told nothing had been created — and pressing the
 * button again made a second one.
 */
describe('useOrderCreate — a save that failed half-way is resumed, not restarted', () => {
  it('creates the order once and re-sends only the lines that did not land', async () => {
    const page = useOrderCreate()
    page.form.value.clientId = 'cli-1'

    page.addItem(PIPE)
    page.addItem(COPPER)

    // The server refuses the second line, exactly as it refuses a zero quantity
    // or a product that is not in the catalogue.
    failItemOnce = 'prod-cu'
    const failed = await page.handleSave()

    expect(failed).toBeNull()
    expect(createCalls.n).toBe(1)
    expect(sentItems.map((i) => i.productId)).toEqual(['prod-alu'])
    expect(page.isPartiallySaved.value).toBe(true)

    // The admin presses Create again.
    const order = await page.handleSave()

    expect(order).toMatchObject({ id: 'ORD-TEST' })
    // No second order...
    expect(createCalls.n).toBe(1)
    // ...and the first line is not duplicated by the retry.
    expect(sentItems.map((i) => i.productId)).toEqual(['prod-alu', 'prod-cu'])
  })

  it('returns the order that was actually created', async () => {
    const page = useOrderCreate()
    page.form.value.clientId = 'cli-1'
    page.addItem(PIPE)

    const order = await page.handleSave()

    expect(order).toMatchObject({ id: 'ORD-TEST' })
  })
})

/**
 * Тип комплекта документов система предлагает, а не назначает.
 *
 * ТЗ (Process 2.1 §2): «Система предлагает тип автоматически на основе страны
 * клиента, менеджер может изменить». Отсюда два разных утверждения — что
 * предложение приходит и что оно не возвращается поверх выбора менеджера.
 */
describe('useOrderCreate — тип документов предлагается по стране клиента', () => {
  function client(id: string, country: Client['country']): Client {
    return {
      id,
      name: id,
      companyCode: '000',
      vatCode: '',
      address: '',
      country,
      phone: '',
      email: `${id}@example.com`,
      status: 'active',
      notes: null,
      createdAt: '2026-01-01',
    }
  }

  it('литовскому клиенту — локальный комплект', () => {
    const page = useOrderCreate()
    page.form.value.documentType = 'export'

    page.selectClient(client('cli-lt', 'LT'))

    expect(page.form.value.documentType).toBe('local')
  })

  it('клиенту из другой страны — экспортный комплект', () => {
    const page = useOrderCreate()
    expect(page.form.value.documentType).toBe('local')

    page.selectClient(client('cli-lv', 'LV'))

    expect(page.form.value.documentType).toBe('export')
  })

  // Оба направления проверяются, потому что поодиночке каждое устраивает
  // бездействие не того рода (питфолл #68): «страна пуста → всегда локальный»
  // прошло бы мимо первого утверждения, «всегда экспорт» — мимо второго.
  it.each(['local', 'export'] as const)(
    'у клиента без страны предлагать нечего — выбранный «%s» остаётся',
    (chosen) => {
      const page = useOrderCreate()
      page.form.value.documentType = chosen

      page.selectClient(client('cli-none', null))

      expect(page.form.value.documentType).toBe(chosen)
    },
  )

  it('не перезаписывает выбор менеджера при последующих правках заказа', () => {
    const page = useOrderCreate()

    page.selectClient(client('cli-lv', 'LV'))
    expect(page.form.value.documentType).toBe('export')

    // Менеджер поправил тип вручную и продолжил собирать заказ.
    page.form.value.documentType = 'local'
    page.addItem(PIPE)
    page.form.value.notes = 'pickup on friday'

    expect(page.form.value.documentType).toBe('local')
  })
})
