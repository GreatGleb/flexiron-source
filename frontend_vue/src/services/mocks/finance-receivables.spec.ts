/**
 * Реестр входящих — представление над счетами заказов (пункт 13 плана
 * `review-followups.md`).
 *
 * До этого пункта финансовые платежи бросались `Math.random()`, но подписывались
 * номером настоящего заказа: страница показывала случайную сумму со случайным
 * статусом под реальным документом, и она не сходилась с самим заказом. Здесь
 * проверяется, что своих чисел у реестра больше нет ни одного.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  mockAddOrderItem,
  mockAddOrderPayment,
  mockCreateInvoice,
  mockCreateOrder,
  mockGetOrder,
  orderReceivables,
} from './orders'
import { mockGetPayments, mockGetReceivables } from './finance'
import { mockGetClients } from './clients'
import { invoiceBalances, nextUnsettledInvoice } from '@/domain/receivable'

/**
 * Заказы демо-стора, у которых есть документы, — снято при загрузке модуля.
 * Считать это внутри теста нельзя: другие проверки этого же файла заводят свои
 * заказы, и в их числе есть заказ с деньгами без ссылки на документ — он там
 * ровно и проверяется как законный случай.
 */
const SEEDED_ORDERS_WITH_DOCUMENTS = [...new Set(orderReceivables().map((r) => r.orderId))]

/** Клиент с ненулевой отсрочкой: у нулевой срок наступает в день выдачи. */
function clientWithTerms() {
  const client = mockGetClients().find((c) => c.paymentTermsDays > 0)!
  expect(client).toBeDefined()
  return client
}

/** Клиент-предоплатник: отсрочки нет, срок счёта — день его выдачи. */
function clientWithoutTerms() {
  const client = mockGetClients().find((c) => c.paymentTermsDays === 0)!
  expect(client).toBeDefined()
  return client
}

function orderWithLine(client = clientWithTerms()) {
  const order = mockCreateOrder({ clientId: client.id, documentType: 'local' })
  mockAddOrderItem(order.id, {
    productId: 'prod-001',
    quantity: 10,
    unit: 'pcs',
    unitPrice: 100,
  })
  return { order: mockGetOrder(order.id)!, client }
}

function rowFor(invoiceId: string) {
  return orderReceivables().find((r) => r.id === invoiceId)
}

describe('строка реестра — это счёт заказа', () => {
  it('счёт попадает в реестр с суммой, номером и клиентом самого счёта', () => {
    const { order, client } = orderWithLine()
    const invoice = mockCreateInvoice(order.id, { kind: 'advance', amountGross: 1210 })

    const row = rowFor(invoice.id)!
    expect(row).toBeDefined()
    expect(row.invoiceNumber).toBe(invoice.number)
    expect(row.amount).toBe(invoice.amountGross)
    expect(row.orderNumber).toBe(order.orderNumber)
    expect(row.clientName).toBe(client.name)
    expect(row.currency).toBe(order.currency)
  })

  it('срок оплаты — дата счёта плюс отсрочка клиента, а не введённое руками число', () => {
    const { order, client } = orderWithLine()
    const invoice = mockCreateInvoice(order.id, { kind: 'advance', amountGross: 500 })

    const row = rowFor(invoice.id)!
    const days = (Date.parse(row.dueDate) - Date.parse(invoice.issuedAt)) / 86_400_000
    expect(days).toBe(client.paymentTermsDays)
  })

  it('оплачено — только деньги, привязанные к ЭТОМУ счёту', () => {
    const { order } = orderWithLine()
    const invoice = mockCreateInvoice(order.id, { kind: 'advance', amountGross: 1000 })

    mockAddOrderPayment(order.id, { amount: 400, invoiceId: invoice.id })
    // Аванс без ссылки на документ ничей долг не закрывает.
    mockAddOrderPayment(order.id, { amount: 250, invoiceId: null })

    const row = rowFor(invoice.id)!
    expect(row.paidAmount).toBe(400)
    expect(row.outstandingAmount).toBe(600)
    expect(row.status).toBe('pending')
    expect(row.paidAt).toBeNull()
  })

  it('когда платежи покрыли счёт, он оплачен и знает, каким платежом закрыт', () => {
    const { order } = orderWithLine()
    const invoice = mockCreateInvoice(order.id, { kind: 'advance', amountGross: 1000 })

    mockAddOrderPayment(order.id, { amount: 400, invoiceId: invoice.id })
    const closing = mockAddOrderPayment(order.id, { amount: 600, invoiceId: invoice.id })

    const row = rowFor(invoice.id)!
    expect(row.status).toBe('completed')
    expect(row.outstandingAmount).toBe(0)
    expect(row.paidAt).toBe(closing.paidAt)
  })

  it('корректировка поправляет сумму счёта, а своей строки не заводит', () => {
    const { order } = orderWithLine()
    const invoice = mockCreateInvoice(order.id, { kind: 'advance', amountGross: 1000 })
    const correction = mockCreateInvoice(order.id, {
      kind: 'correction',
      correctsInvoiceId: invoice.id,
      amountGross: -300,
      reason: 'Цену согласовали ниже',
    })

    const rows = orderReceivables()
    expect(rows.find((r) => r.id === correction.id)).toBeUndefined()
    expect(rows.find((r) => r.id === invoice.id)!.amount).toBe(700)
  })

  it('счёт клиенту с предоплатой не просрочен, пока идёт день выдачи', () => {
    // Отсрочки нет, значит срок счёта — день его выдачи. Пока этот день идёт,
    // клиент не опоздал: «просрочен» через миллисекунды после выдачи — это
    // выдуманный сигнал под настоящим документом, и в колонке «Срок» рядом с ним
    // стоит сегодняшнее число.
    //
    // Время здесь задаётся, а не берётся настоящее: между выдачей счёта и
    // чтением реестра проходит доля миллисекунды, и на такой дистанции проверка
    // прошла бы и на сломанном сравнении по мгновению — то есть не проверяла бы
    // ничего (питфолл #68).
    const { order } = orderWithLine(clientWithoutTerms())
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 4, 12, 9, 0, 0))
      const invoice = mockCreateInvoice(order.id, { kind: 'advance', amountGross: 1000 })

      vi.setSystemTime(new Date(2026, 4, 12, 23, 30, 0))
      const row = rowFor(invoice.id)!
      expect(row.dueDate).toBe(invoice.issuedAt)
      expect(row.status).toBe('pending')

      // А со следующего дня — просрочен: срок кончился вместе с днём.
      vi.setSystemTime(new Date(2026, 4, 13, 0, 30, 0))
      expect(rowFor(invoice.id)!.status).toBe('overdue')
    } finally {
      vi.useRealTimers()
    }
  })

  it('счёт, отозванный корректировкой, из реестра исчезает вовсе', () => {
    const { order } = orderWithLine()
    const invoice = mockCreateInvoice(order.id, { kind: 'advance', amountGross: 1000 })
    expect(rowFor(invoice.id)).toBeDefined()

    mockCreateInvoice(order.id, {
      kind: 'correction',
      correctsInvoiceId: invoice.id,
      reason: 'Документ отозван',
    })

    expect(rowFor(invoice.id)).toBeUndefined()
  })
})

describe('карточка заказа и реестр показывают одни и те же деньги', () => {
  /**
   * Решение модалки регистрации оплаты — ровно то, что делает
   * `openPaymentModal` в `OrderCardPage.vue`: какой документ подставить в поле и
   * какую сумму предложить. Здесь оно вызывается тем же способом, потому что
   * расхождение двух представлений начиналось не в расчёте, а в том, что штатное
   * нажатие «Сохранить» отправляло `invoiceId: null`.
   */
  function whatTheDialogOffers(orderId: string) {
    const order = mockGetOrder(orderId)!
    const target = nextUnsettledInvoice(invoiceBalances(order.invoices, order.payments))
    return { invoiceId: target?.id ?? null, amount: target ? target.outstanding : 0 }
  }

  it('оплата, зарегистрированная штатным путём, видна реестру тем же числом', () => {
    const { order } = orderWithLine()
    const invoice = mockCreateInvoice(order.id, { kind: 'advance', amountGross: 500 })
    expect(rowFor(invoice.id)!.paidAmount).toBe(0)

    // Модалка открыта, ничего не тронуто, нажато «Сохранить».
    const offered = whatTheDialogOffers(order.id)
    mockAddOrderPayment(order.id, { amount: offered.amount, invoiceId: offered.invoiceId })

    const after = mockGetOrder(order.id)!
    const row = rowFor(invoice.id)!
    // Карточка заказа говорит «получено 500» — и реестр по тому же документу
    // говорит то же самое, а не «просрочен, оплачено 0.00».
    expect(after.paidAmount).toBe(500)
    expect(row.paidAmount).toBe(after.paidAmount)
    expect(row.outstandingAmount).toBe(0)
    expect(row.status).toBe('completed')
  })

  it('частичная оплата — оплачено X из Y, тем же расчётом, что в карточке', () => {
    const { order } = orderWithLine()
    const invoice = mockCreateInvoice(order.id, { kind: 'advance', amountGross: 1000 })

    const offered = whatTheDialogOffers(order.id)
    expect(offered.amount).toBe(1000)
    // Клиент заплатил меньше предложенного — документ остаётся открытым.
    mockAddOrderPayment(order.id, { amount: 400, invoiceId: offered.invoiceId })

    const row = rowFor(invoice.id)!
    expect(row.paidAmount).toBe(400)
    expect(row.outstandingAmount).toBe(600)
    // И следующая оплата предлагается по тому же документу на остаток.
    expect(whatTheDialogOffers(order.id)).toEqual({ invoiceId: invoice.id, amount: 600 })
  })

  it('в демо-сторе нет заказа, чьи деньги реестр не видит, пока его счёт не закрыт', () => {
    // Тот же дефект, но в сидах: ORD-2026-009 получил 22 256,26 без ссылки на
    // документ, и «Входящие» рисовали по его счёту «Просрочен» и «оплачено 0.00»
    // рядом с карточкой, где деньги получены.
    const offenders: string[] = []
    for (const orderId of SEEDED_ORDERS_WITH_DOCUMENTS) {
      const order = mockGetOrder(orderId)!
      const unnamedIn = order.payments
        .filter((p) => p.invoiceId === null && p.amount > 0)
        .reduce((sum, p) => sum + p.amount, 0)
      const stillOwed = orderReceivables().some(
        (r) => r.orderId === orderId && r.outstandingAmount > 0,
      )
      if (unnamedIn > 0 && stillOwed) offenders.push(`${order.orderNumber} (+${unnamedIn})`)
    }
    expect(offenders).toEqual([])
  })
})

describe('своих чисел у финансового мока не осталось', () => {
  it('два подряд построения реестра дают то же самое', () => {
    const first = orderReceivables()
    const second = orderReceivables()
    expect(second).toEqual(first)
  })

  it('каждая строка ссылается на существующий заказ и на его же счёт', () => {
    for (const row of orderReceivables()) {
      const order = mockGetOrder(row.orderId)
      expect(order).toBeDefined()
      const invoice = order!.invoices.find((i) => i.id === row.id)
      expect(invoice).toBeDefined()
      expect(row.invoiceNumber).toBe(invoice!.number)
      expect(row.orderNumber).toBe(order!.orderNumber)
      expect(row.clientName).toBe(order!.clientName)
    }
  })

  it('исходящие — счета поставщиков, и ни один не подписан номером заказа', () => {
    const items = mockGetPayments({ pageSize: 100 }).items
    expect(items.length).toBeGreaterThan(0)
    for (const payment of items) {
      expect(payment.direction).toBe('outgoing')
      expect(payment.orderNumber).toBeNull()
      expect(payment.supplierInvoiceRef).not.toBeNull()
      // Статус здесь хранится, поэтому seed обязан быть самосогласован:
      // оплаченный знает дату оплаты, неоплаченный её не выдумывает.
      expect(payment.paidAt !== null).toBe(payment.status === 'completed')
    }
  })

  it('в исходном коде финансового мока не осталось ни одного броска монеты', () => {
    // Прогоном это не ловится, и в этом весь смысл проверки: seed собирается один
    // раз при загрузке модуля, поэтому два подряд чтения совпадут и со случайными
    // числами тоже — утверждение «дважды подряд одно и то же» устраивает
    // бездействие (питфолл #68). Здесь читается сам файл.
    const src = readFileSync(resolve(process.cwd(), 'src/services/mocks/finance.ts'), 'utf8')
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    expect(code).not.toContain('Math.random')
  })
})

describe('фильтры реестра', () => {
  it('фильтр по статусу оставляет только строки этого статуса и не оставляет пусто', () => {
    const all = mockGetReceivables({ search: '', status: 'all', pageSize: 500 })
    expect(all.items.length).toBeGreaterThan(0)

    const pending = mockGetReceivables({ search: '', status: 'pending', pageSize: 500 })
    expect(pending.items.length).toBeGreaterThan(0)
    expect(pending.items.length).toBeLessThan(all.total)
    expect(pending.items.filter((r) => r.status !== 'pending')).toEqual([])
  })

  it('поиск по номеру заказа отсекает всё остальное', () => {
    const { order } = orderWithLine()
    mockCreateInvoice(order.id, { kind: 'advance', amountGross: 999 })

    const found = mockGetReceivables({ search: order.orderNumber, status: 'all', pageSize: 500 })
    expect(found.items.length).toBeGreaterThan(0)
    expect(found.items.filter((r) => r.orderNumber !== order.orderNumber)).toEqual([])
  })
})
