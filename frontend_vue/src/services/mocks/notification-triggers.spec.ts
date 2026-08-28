import { describe, it, expect, vi } from 'vitest'
import { mockGetNotifications, mockGetUnreadCount } from './notifications'
import {
  mockAddOrderItem,
  mockAddOrderPayment,
  mockCreateInvoice,
  mockCreateOrder,
  mockGetOrder,
  mockPatchOrderStatus,
  mockReserveOrder,
} from './orders'
import { mockCreateBatch, recordShortage } from './warehouse'
import { mockAcceptResponse, mockGetBccHistory } from './bcc'
import { mockGetClients } from './clients'
import { mockGetPayment, mockGetReceivables, mockPatchPayment } from './finance'
import type { Notification, NotificationType } from '@/types/notifications'
import { invoiceBalances, nextUnsettledInvoice } from '@/domain/receivable'

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
  it('просроченный счёт заказа пишет уведомление со сроком и ссылкой на заказ', () => {
    // Реестр входящих своего хранилища не имеет: просрочку он ВЫЧИСЛЯЕТ по счетам
    // заказов. Уведомление пишется в момент, когда факт впервые посчитан.
    const before = feed('payment_overdue').length
    const overdue = mockGetReceivables({ search: '', status: 'overdue', pageSize: 100 }).items
    expect(overdue.length).toBeGreaterThan(0)

    const after = feed('payment_overdue')
    expect(after.length).toBe(before + overdue.length)

    const newest = after[0]!
    const row = overdue.find((r) => newest.entityId === r.orderId)!
    expect(row).toBeDefined()
    expect(newest.message.en).toContain(row.orderNumber)
    expect(newest.message.en).toContain(row.dueDate.slice(0, 10))
    expect(newest.entityRouteName).toBe('admin-order-card')
  })

  it('тот же счёт, прочитанный второй раз, ничего не пишет', () => {
    // Первое чтение уже состоялось выше — но проверка не должна зависеть от
    // порядка: читаем дважды здесь и сравниваем второе чтение с первым.
    mockGetReceivables({ search: '', status: 'all', pageSize: 100 })
    const after = feed('payment_overdue').length

    mockGetReceivables({ search: '', status: 'all', pageSize: 100 })

    expect(feed('payment_overdue').length).toBe(after)
  })

  it('счёт клиенту с предоплатой не звонит в колокольчик в день выдачи', () => {
    // Отсрочки нет — срок счёта наступает в день выдачи, и в этот день клиент
    // ещё не опоздал. Уведомление «оплата просрочена» по документу возрастом в
    // секунду — выдуманный сигнал под настоящим документом.
    //
    // Время задаётся, а не берётся настоящее: иначе между выдачей и чтением
    // реестра проходит доля миллисекунды, и молчание колокольчика ничего бы не
    // доказывало (питфолл #68).
    const client = mockGetClients().find((c) => c.paymentTermsDays === 0)!
    expect(client).toBeDefined()
    const order = mockCreateOrder({ clientId: client.id, documentType: 'local' })
    mockAddOrderItem(order.id, {
      productId: 'prod-001',
      quantity: 5,
      unit: 'pcs',
      unitPrice: 100,
    })
    const before = feed('payment_overdue').length

    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 4, 12, 9, 0, 0))
      const invoice = mockCreateInvoice(order.id, { kind: 'advance', amountGross: 500 })

      vi.setSystemTime(new Date(2026, 4, 12, 23, 30, 0))
      const rows = mockGetReceivables({ search: '', status: 'all', pageSize: 500 }).items

      // Строка в реестре есть — иначе проверку устроило бы бездействие: молчащий
      // колокольчик над несуществующим счётом не доказывает ничего.
      const row = rows.find((r) => r.id === invoice.id)!
      expect(row).toBeDefined()
      expect(row.status).toBe('pending')
      expect(feed('payment_overdue').length).toBe(before)
    } finally {
      vi.useRealTimers()
    }
  })

  it('по счёту, закрытому штатным путём, колокольчик молчит — просрочки нет', () => {
    // Зонд, на котором пункт 13 был отклонён: карточка заказа показывала деньги
    // полученными, «Входящие» рядом рисовали по тому же документу «Просрочен» и
    // «оплачено 0.00», а колокольчик звонил о просрочке счёта, оплаченного
    // полностью. Расходились не расчёты — расходилось то, что деньги не называли
    // документ. Здесь оплата регистрируется ровно тем решением, которое
    // подставляет модалка карточки заказа.
    const client = mockGetClients().find((c) => c.paymentTermsDays > 0)!
    expect(client).toBeDefined()
    const order = mockCreateOrder({ clientId: client.id, documentType: 'local' })
    mockAddOrderItem(order.id, {
      productId: 'prod-001',
      quantity: 5,
      unit: 'pcs',
      unitPrice: 100,
    })

    vi.useFakeTimers()
    let invoiceId: string
    try {
      // Документ выписан достаточно давно, чтобы срок его успел пройти: без
      // этого молчание колокольчика устраивало бы и ненаступивший срок.
      vi.setSystemTime(new Date(2026, 0, 10, 9, 0, 0))
      invoiceId = mockCreateInvoice(order.id, { kind: 'advance', amountGross: 500 }).id

      const live = mockGetOrder(order.id)!
      const target = nextUnsettledInvoice(invoiceBalances(live.invoices, live.payments))!
      expect(target.id).toBe(invoiceId)
      mockAddOrderPayment(order.id, { amount: target.outstanding, invoiceId: target.id })
    } finally {
      vi.useRealTimers()
    }

    const row = mockGetReceivables({ search: '', status: 'all', pageSize: 500 }).items.find(
      (r) => r.id === invoiceId,
    )!
    expect(row).toBeDefined()
    expect(row.paidAmount).toBe(mockGetOrder(order.id)!.paidAmount)
    expect(row.status).toBe('completed')
    expect(feed('payment_overdue').filter((n) => n.entityId === order.id)).toEqual([])
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
