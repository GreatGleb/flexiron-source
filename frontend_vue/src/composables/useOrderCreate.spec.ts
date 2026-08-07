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

vi.mock('@/services/ordersService', () => ({
  createOrder: vi.fn(async () => ({ id: 'ORD-TEST' })),
  patchOrder: vi.fn(async () => ({})),
  addOrderItem: vi.fn(async (_orderId: string, data: Record<string, unknown>) => {
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
