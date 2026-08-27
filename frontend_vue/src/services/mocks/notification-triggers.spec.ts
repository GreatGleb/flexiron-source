import { describe, it, expect } from 'vitest'
import { mockGetNotifications, mockGetUnreadCount, mockResetNotifications } from './notifications'
import {
  mockAddOrderItem,
  mockAddOrderPayment,
  mockCreateOrder,
  mockGetOrder,
  mockPatchOrderStatus,
  mockReserveOrder,
} from './orders'
import { mockCreateBatch, recordShortage } from './warehouse'
import { mockAcceptResponse, mockGetBccHistory } from './bcc'
import { mockGetClients } from './clients'
import { mockGetPayment, mockPatchPayment } from './finance'
import type { Notification, NotificationType } from '@/types/notifications'

/**
 * Уведомления рождаются из событий, а не лежат сидом.
 *
 * До этого пункта в ленте было 21 записанное вручную уведомление, и ни один мок
 * не звал модуль уведомлений: восемь типов событий существовали на фронте, а
 * лента не пополнялась ни разу. Здесь проверяется, что событие пишет ровно одну
 * запись — и что повтор того же события не пишет ничего.
 *
 * Счёт всегда относительный (до/после): моки — это модульные синглтоны, и
 * абсолютное число зависит от того, что успели сделать соседние проверки.
 */
function feed(type: NotificationType | 'all'): Notification[] {
  return mockGetNotifications(
    { type, isRead: null, search: '', sortBy: 'createdAt', sortDir: 'desc' },
    { page: 1, pageSize: 1000 },
  ).items
}

function newestOf(type: NotificationType): Notification {
  const items = feed(type)
  return items[0]!
}

/** Заказ, которого не касалась ни одна другая проверка. */
function freshOrder() {
  const client = mockGetClients()[0]!
  return mockCreateOrder({ clientId: client.id, documentType: 'local' })
}

let batchSeq = 0

async function freshBatch(productId: string, quantity: number) {
  batchSeq += 1
  return mockCreateBatch({
    productId,
    batchNumber: `NOTIF-${String(batchSeq).padStart(3, '0')}`,
    lotCode: `LOT-NOTIF-${String(batchSeq).padStart(3, '0')}`,
    quantity,
    uomId: 'uom-pcs',
    unitPrice: 10,
    receivedAt: '2026-01-01T00:00:00Z',
    location: 'Rack: A | Row: 01 | Cell: 01',
  })
}

/**
 * Лента в тот момент, когда моки только что загрузились и не произошло ещё
 * ничего. Снимок берётся на уровне модуля намеренно: `it` выполняется позже, и
 * внутри проверки было бы видно уже не загрузку, а работу соседних проверок.
 */
const feedAtLoad = feed('all')

describe('загрузка мок-слоя', () => {
  it('не рождает ни одного уведомления: сид — это история, а не сегодняшние события', () => {
    // Сид собирается вызовами настоящих эндпоинтов (`buildShowcaseOrder` и
    // соседи), а те зовут эмиттеры. Пока сборка не глушила ленту, КАЖДАЯ загрузка
    // страницы добавляла записи с меткой «только что» о платежах и дефиците,
    // которых в этот момент не было, — и они вставали первыми, потому что лента
    // сортируется по createdAt убыв. Дельтам «до/после» в остальных проверках
    // этот мусор не виден: он лежит в ленте ещё до того, как они начинают счёт.
    expect(feedAtLoad.length).toBeGreaterThan(0)

    // Что считать сидом, спрашиваем у самого модуля, а не угадываем по форме id:
    // mockResetNotifications возвращает ленту ровно к заведённым руками записям.
    mockResetNotifications()
    const seedIds = new Set(feed('all').map((n) => n.id))
    const born = feedAtLoad.filter((n) => !seedIds.has(n.id))
    expect(born.map((n) => `${n.type}: ${n.message.en}`)).toEqual([])
  })
})

describe('смена статуса заказа', () => {
  it('пишет одно уведомление с номером заказа и подписью нового статуса', () => {
    const order = freshOrder()
    const before = feed('order_status').length

    mockPatchOrderStatus(order.id, 'confirmed')

    const after = feed('order_status')
    expect(after.length).toBe(before + 1)
    const entry = after[0]!
    // Номер — тот, что видит человек; ссылка — на id, по которому открывается карточка.
    expect(entry.message.en).toContain(order.orderNumber)
    expect(entry.entityId).toBe(order.id)
    expect(entry.entityRouteName).toBe('admin-order-card')
    expect(entry.isRead).toBe(false)
    // Подпись статуса взята из словаря, а не написана здесь во второй раз.
    expect(entry.message.en).toContain('Confirmed')
    expect(entry.message.ru).toContain('Подтверждён')
    expect(entry.message.lt).toContain('Patvirtintas')
  })

  it('повтор того же статуса не пишет ничего — записи достойна перемена, а не запрос', () => {
    const order = freshOrder()
    mockPatchOrderStatus(order.id, 'confirmed')
    const after = feed('order_status').length

    mockPatchOrderStatus(order.id, 'confirmed')

    expect(feed('order_status').length).toBe(after)
  })
})

describe('оплата заказа', () => {
  it('поступление пишет уведомление с суммой и валютой заказа', () => {
    const order = freshOrder()
    const before = feed('payment_received').length

    mockAddOrderPayment(order.id, { amount: 1250 })

    const after = feed('payment_received')
    expect(after.length).toBe(before + 1)
    expect(after[0]!.message.en).toContain('1250.00 ' + mockGetOrder(order.id)!.currency)
    expect(after[0]!.entityId).toBe(order.id)
  })

  it('возврат денег клиенту уведомлением о поступлении не является', () => {
    const order = freshOrder()
    mockAddOrderPayment(order.id, { amount: 1250 })
    const after = feed('payment_received').length

    mockAddOrderPayment(order.id, { amount: -100, purpose: 'refund' })

    expect(feed('payment_received').length).toBe(after)
  })
})

describe('приёмка партии', () => {
  it('созданная партия пишет уведомление с её номером и местом', async () => {
    const before = feed('batch_received').length

    const batch = await freshBatch('prod-001', 25)

    const after = feed('batch_received')
    expect(after.length).toBe(before + 1)
    expect(after[0]!.message.en).toContain(batch.batchNumber)
    expect(after[0]!.message.en).toContain('Rack: A')
    expect(after[0]!.entityId).toBe(batch.id)
    expect(after[0]!.entityRouteName).toBe('admin-warehouse-batch')
  })
})

describe('дефицит', () => {
  it('первая нехватка по заказу пишет уведомление с названием товара', () => {
    const before = feed('stock_deficit').length

    recordShortage({
      productId: 'prod-001',
      productName: 'Steel Sheet 3mm',
      quantity: 5,
      uomId: 'uom-pcs',
      orderId: 'ORD-NOTIF-DEFICIT',
    })

    const after = feed('stock_deficit')
    expect(after.length).toBe(before + 1)
    expect(after[0]!.message.en).toContain('Steel Sheet 3mm')
    expect(after[0]!.entityId).toBe('prod-001')
  })

  it('тот же заказ, просящий снова — та же нехватка, второго уведомления нет', () => {
    recordShortage({
      productId: 'prod-002',
      productName: 'Steel Sheet 4mm',
      quantity: 5,
      uomId: 'uom-pcs',
      orderId: 'ORD-NOTIF-DEFICIT-2',
    })
    const after = feed('stock_deficit').length

    recordShortage({
      productId: 'prod-002',
      productName: 'Steel Sheet 4mm',
      quantity: 9,
      uomId: 'uom-pcs',
      orderId: 'ORD-NOTIF-DEFICIT-2',
    })

    expect(feed('stock_deficit').length).toBe(after)
  })
})

describe('ответ поставщика', () => {
  it('принятый ответ пишет уведомление с именем поставщика', () => {
    const event = mockGetBccHistory(1, 1).items[0]!
    const before = feed('supplier_response').length

    const accepted = mockAcceptResponse(event.id, { price: 12.5, unit: 'kg' })!

    const after = feed('supplier_response')
    expect(after.length).toBe(before + 1)
    expect(after[0]!.message.en).toContain(accepted.supplierName.en)
    expect(after[0]!.entityId).toBe(accepted.supplierId)
    expect(after[0]!.entityRouteName).toBe('admin-supplier-card')
  })
})

describe('готовность склада', () => {
  it('заказ, целиком ставший под резерв, объявляется готовым один раз', async () => {
    const batch = await freshBatch('prod-043', 40)
    const order = freshOrder()
    mockAddOrderItem(order.id, { productId: 'prod-043', quantity: 10, unit: 'pcs', unitPrice: 30 })
    const before = feed('warehouse_ready').length

    const held = mockReserveOrder(order.id)
    expect(held.some((r) => r.batchId === batch.id)).toBe(true)

    const after = feed('warehouse_ready')
    expect(after.length).toBe(before + 1)
    expect(after[0]!.message.en).toContain(mockGetOrder(order.id)!.orderNumber)

    // Второй резерв держать больше нечего: состояние не менялось, значит события нет.
    mockReserveOrder(order.id)
    expect(feed('warehouse_ready').length).toBe(after.length)
  })
})

describe('просрочка оплаты', () => {
  it('переход в «просрочен» пишет уведомление со сроком и ссылкой на заказ', () => {
    // Сид раздаёт статус случайно, поэтому исходное состояние задаётся явно:
    // проверяется ПЕРЕХОД, а не то, каким платёж родился.
    mockPatchPayment('pay-in-1', { status: 'pending' })
    const payment = mockGetPayment('pay-in-1')
    const before = feed('payment_overdue').length

    mockPatchPayment('pay-in-1', { status: 'overdue' })

    const after = feed('payment_overdue')
    expect(after.length).toBe(before + 1)
    expect(after[0]!.message.en).toContain(payment.orderNumber!)
    expect(after[0]!.message.en).toContain(payment.dueDate.slice(0, 10))
    expect(after[0]!.entityId).toBe(payment.orderId)
    expect(after[0]!.entityRouteName).toBe('admin-order-card')
  })

  it('платёж, уже бывший просроченным, при правке заметки ничего не пишет', () => {
    mockPatchPayment('pay-in-2', { status: 'overdue' })
    const after = feed('payment_overdue').length

    mockPatchPayment('pay-in-2', { notes: 'звонили клиенту' })
    mockPatchPayment('pay-in-2', { status: 'overdue' })

    expect(feed('payment_overdue').length).toBe(after)
  })

  it('счёт поставщика без заказа ведёт к поставщику, а не в пустую карточку', () => {
    mockPatchPayment('pay-out-1', { status: 'pending' })
    const payment = mockGetPayment('pay-out-1')
    expect(payment.orderId).toBeNull()

    mockPatchPayment('pay-out-1', { status: 'overdue' })

    const entry = feed('payment_overdue')[0]!
    expect(entry.entityType).toBe('supplier')
    expect(entry.entityId).toBe(payment.counterpartyId)
    expect(entry.entityRouteName).toBe('admin-supplier-card')
    expect(entry.message.en).toContain(payment.paymentNumber)
  })
})

describe('лента и колокольчик', () => {
  it('созданное событием уведомление приходит непрочитанным и попадает в счётчик', () => {
    const unreadBefore = mockGetUnreadCount()
    const order = freshOrder()

    mockPatchOrderStatus(order.id, 'confirmed')

    expect(mockGetUnreadCount()).toBe(unreadBefore + 1)
    expect(newestOf('order_status').isRead).toBe(false)
  })
})
