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
  mockOrderScenarios,
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

/**
 * Заказы, которых засев документов (пункт 6) КАСАЕТСЯ.
 *
 * Сценарные и показательный он не трогает: они демонстрируют точные состояния, и их
 * числа документов пиноют другие тесты. Считать по всему стору нельзя — сценарные сами
 * дают и «счёт закрыт», и «счёта нет», и утверждение выполнялось бы, даже если засев
 * выключить или, наоборот, выписать документы всем подряд. Проверено инверсией: на
 * полном сторе оба перекоса проходили молча.
 */
function seededOrders() {
  const reserved = new Set(mockOrderScenarios().map((sc) => sc.id))
  reserved.add('ORD-100')
  const out = []
  for (let i = 1; i <= 100; i++) {
    const id = `ORD-${String(i).padStart(3, '0')}`
    if (reserved.has(id)) continue
    const order = mockGetOrder(id)
    if (order) out.push(order)
  }
  return out
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

  /**
   * Пункт 11: реестр обязан называть ту же сумму, что и документ, — и ту, что набрал
   * человек.
   *
   * Соседний тест выше сверяет `row.amount` с `invoice.amountGross` — то есть что
   * реестр не завёл своей арифметики. Этого мало: если ошибётся сам документ, реестр
   * повторит ошибку, и оба будут «согласованы» на неверном числе. Здесь сверка с
   * НАБРАННЫМ значением.
   *
   * 15000 при 21 % — недостижимый брутто, на котором круговой пересчёт и терял копейку
   * (документ показывал 14999.99). У соседнего теста сумма 1210, то есть ровно
   * достижимая: на ней разницы не видно, и он оставался бы зелёным при сломанном коде.
   */
  it('счёт на недостижимую сумму попадает в реестр ровно той, что набрали', () => {
    const { order } = orderWithLine()
    const invoice = mockCreateInvoice(order.id, { kind: 'advance', amountGross: 15000 })

    expect(invoice.amountGross).toBe(15000)
    expect(rowFor(invoice.id)!.amount).toBe(15000)
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

  /**
   * Пункт 6: у доли отгруженных заказов есть документы, и все ТРИ состояния на месте.
   *
   * Было: секция «Выставленные счета» пуста у 43 клиентов из 55, настоящие счета — ровно
   * у одного. Решение владельца — выписывать документы ДОЛЕ отгруженных, а не всем:
   * «отгружено, а счёт ещё не выписан» — законное состояние, которое модуль умеет
   * показывать, и стереть его значило бы украсить демо-данные вместо того, чтобы их
   * наполнить.
   *
   * Утверждается не «стало больше», а наличие каждого состояния. «Больше» ловится
   * простым перекосом в любую сторону: выписать всем — тоже больше, и тоже неверно.
   */
  it('у отгруженных заказов есть все три состояния документа', () => {
    let сСчётомОплачен = 0
    let сСчётомДолг = 0
    let безСчёта = 0

    for (const order of seededOrders()) {
      if (!order.shipments.some((sh) => !sh.cancelled)) continue

      const live = order.invoices.filter((inv) => inv.kind !== 'correction')
      if (live.length === 0) {
        безСчёта++
        continue
      }
      const paid = order.payments
        .filter((pay) => pay.invoiceId !== null)
        .reduce((sum, pay) => sum + pay.amount, 0)
      if (paid > 0) сСчётомОплачен++
      else сСчётомДолг++
    }

    expect(сСчётомОплачен).toBeGreaterThan(0)
    expect(сСчётомДолг).toBeGreaterThan(0)
    expect(безСчёта).toBeGreaterThan(0)
  })

  /**
   * И деньги НАЗЫВАЮТ свой документ — проверяется по РЕЕСТРУ, а не по заказу.
   * Расхождение между ними и есть то, чего этот тест не должен пропустить: прошлый
   * список ловил ровно это — карточка показывала деньги полученными, а реестр рядом
   * рисовал по тому же счёту «Просрочен» и «оплачено 0.00».
   *
   * Утверждается наличие ОБОИХ исходов среди засеянных счетов: закрытого и открытого.
   * «Все закрыты» — это «выписать и оплатить всем», то есть тот же перекос, только с
   * другой стороны.
   *
   * Первая версия этого теста утверждала `row.paidAmount >= платёж` для каждого платежа
   * и упала на настоящем: 1880 против 2000. Причина не в засеве — по тому счёту есть
   * ВОЗВРАТ, и реестр показывает чистую сумму. Утверждение было неверным, а не данные.
   */
  it('засеянные счета видны реестру и закрытыми, и открытыми', () => {
    let закрытых = 0
    let открытых = 0

    for (const order of seededOrders()) {
      for (const invoice of order.invoices) {
        if (invoice.kind === 'correction') continue
        const row = rowFor(invoice.id)
        if (!row) continue
        // Реестр называет ту же сумму, что документ, — до копейки. Но только у
        // НЕскорректированных: у поправленного строка реестра показывает сумму вместе
        // с корректировкой, и это не расхождение, а правило (соседний тест
        // «корректировка поправляет сумму счёта, а своей строки не заводит»).
        // Первая версия этого утверждения об исключение и споткнулась: 21246.99
        // против 21262.12.
        const corrected = order.invoices.some(
          (other) => other.kind === 'correction' && other.correctsInvoiceId === invoice.id,
        )
        if (!corrected) expect(row.amount).toBe(invoice.amountGross)
        if (row.outstandingAmount === 0) закрытых++
        else открытых++
      }
    }

    expect(закрытых).toBeGreaterThan(0)
    expect(открытых).toBeGreaterThan(0)
  })

  /**
   * И засеянная оплата не ПЕРЕПЛАЧИВАЕТ.
   *
   * Правило записано в комментарии засева — «ровно сумма документа, до копейки,
   * иначе реестр покажет „переплачено“», — и до этого теста держалось только на
   * коде: приёмка заменила сумму платежа на `amountGross + 1` по всем засеянным
   * счетам, и весь юнит-набор остался зелёным. Правило, записанное словами и не
   * проверяемое, — это не правило, а пожелание.
   *
   * Расхождения между представлениями переплата не создаёт (обе стороны показывают
   * её согласованно), поэтому признак готовности она формально не нарушает. Но
   * демо-данные держатся тех же правил, что приложение: клиент, заплативший на рубль
   * больше выставленного, — это не «наполненная демка», а неверные данные.
   */
  it('засеянная оплата не переплачивает счёт', () => {
    let проверено = 0
    for (const order of seededOrders()) {
      for (const invoice of order.invoices) {
        if (invoice.kind === 'correction') continue
        const row = rowFor(invoice.id)
        if (!row) continue
        проверено++
        // Признак — `paidAmount` против `amount`, а НЕ `outstandingAmount`.
        // Первая версия смотрела на остаток и не краснела на переплате: реестр
        // зажимает его нулём (`orders.ts`: `Math.max(0, balance.outstanding)`),
        // хотя домен рядом пишет прямо противоположное — «переплату скрывать
        // нельзя, её видно как есть» (`receivable.ts:90`). Пока эти двое спорят,
        // остаток переплату не покажет, и утверждать по нему нечего.
        expect(row.paidAmount).toBeLessThanOrEqual(row.amount)
      }
    }
    // Иначе цикл мог не выполниться ни разу — и тест устраивало бы бездействие.
    expect(проверено).toBeGreaterThan(0)
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
