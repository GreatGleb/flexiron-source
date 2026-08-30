import { describe, it, expect } from 'vitest'
import {
  invoiceBalances,
  nextUnsettledInvoice,
  receivableDueDate,
  receivableStatus,
} from './receivable'
import type { InvoiceRecord, PaymentRecord } from './receivable'

const DAY = 86_400_000

describe('receivableDueDate', () => {
  it('прибавляет отсрочку клиента к дате счёта', () => {
    const due = receivableDueDate('2026-03-01T10:00:00.000Z', 30)
    expect(due).toBe('2026-03-31T10:00:00.000Z')
  })

  it('нулевая отсрочка — срок наступает в день выдачи', () => {
    const issued = '2026-03-01T10:00:00.000Z'
    expect(receivableDueDate(issued, 0)).toBe(issued)
  })

  it('отрицательная отсрочка не датирует счёт задним числом', () => {
    const issued = '2026-03-01T10:00:00.000Z'
    expect(receivableDueDate(issued, -10)).toBe(issued)
  })

  it('нечитаемая дата возвращается как есть, а не превращается в Invalid Date', () => {
    expect(receivableDueDate('не дата', 30)).toBe('не дата')
  })
})

describe('receivableStatus', () => {
  const dueDate = '2026-03-31T10:00:00.000Z'
  const before = new Date(Date.parse(dueDate) - DAY)
  const after = new Date(Date.parse(dueDate) + DAY)

  it('оплат нет, срок не наступил — ожидается', () => {
    expect(receivableStatus({ amount: 1000, paidAmount: 0, dueDate, now: before })).toBe('pending')
  })

  it('оплат нет, срок прошёл — просрочен', () => {
    expect(receivableStatus({ amount: 1000, paidAmount: 0, dueDate, now: after })).toBe('overdue')
  })

  it('оплачено меньше суммы, срок прошёл — просрочен, а не «частично»', () => {
    expect(receivableStatus({ amount: 1000, paidAmount: 999.99, dueDate, now: after })).toBe(
      'overdue',
    )
  })

  it('оплачено меньше суммы, срок не наступил — всё ещё ожидается', () => {
    expect(receivableStatus({ amount: 1000, paidAmount: 400, dueDate, now: before })).toBe(
      'pending',
    )
  })

  it('сумма платежей покрыла счёт — оплачен, даже если срок давно прошёл', () => {
    expect(receivableStatus({ amount: 1000, paidAmount: 1000, dueDate, now: after })).toBe(
      'completed',
    )
  })

  it('переплата тоже закрывает счёт', () => {
    expect(receivableStatus({ amount: 1000, paidAmount: 1200, dueDate, now: after })).toBe(
      'completed',
    )
  })

  /*
   * Срок — это день, а не мгновение. Даты в реестре показываются
   * `toLocaleDateString()`, то есть по локальному календарю, — по нему же и
   * считается граница просрочки, иначе пилюля спорит с колонкой рядом.
   */
  it('счёт с нулевой отсрочкой не просрочен через миг после выдачи', () => {
    const issued = new Date()
    const dueDate = receivableDueDate(issued.toISOString(), 0)
    const now = new Date(issued.getTime() + 60_000)
    expect(receivableStatus({ amount: 1000, paidAmount: 0, dueDate, now })).toBe('pending')
  })

  it('день срока ещё не кончился — счёт ожидается, а не просрочен', () => {
    const dueMoment = new Date(2026, 2, 31, 10, 0, 0)
    const lateSameDay = new Date(2026, 2, 31, 23, 59, 59, 999)
    expect(
      receivableStatus({
        amount: 1000,
        paidAmount: 0,
        dueDate: dueMoment.toISOString(),
        now: lateSameDay,
      }),
    ).toBe('pending')
  })

  it('просрочка наступает со следующего дня', () => {
    const dueMoment = new Date(2026, 2, 31, 10, 0, 0)
    const nextDay = new Date(2026, 3, 1, 0, 0, 0, 1)
    expect(
      receivableStatus({
        amount: 1000,
        paidAmount: 0,
        dueDate: dueMoment.toISOString(),
        now: nextDay,
      }),
    ).toBe('overdue')
  })
})

describe('invoiceBalances — один расчёт на все три представления', () => {
  const invoice = (over: Partial<InvoiceRecord> & { id: string }): InvoiceRecord => ({
    issuedAt: '2026-03-01T10:00:00.000Z',
    kind: 'regular',
    correctsInvoiceId: null,
    withdrawsOriginal: false,
    amountGross: 1000,
    ...over,
  })
  const payment = (amount: number, invoiceId: string | null, paidAt = '2026-03-05T10:00:00.000Z') =>
    ({ amount, invoiceId, paidAt }) as PaymentRecord

  it('деньги, названные корректировкой, идут в строку исправленного документа', () => {
    // Копий этого расчёта было две, и расходились они именно здесь: сводка
    // клиента такие деньги засчитывала, реестр входящих — нет.
    const invoices = [
      invoice({ id: 'INV-1' }),
      invoice({ id: 'INV-2', kind: 'correction', correctsInvoiceId: 'INV-1', amountGross: -300 }),
    ]
    const [balance] = invoiceBalances(invoices, [payment(700, 'INV-2')])
    expect(balance!.id).toBe('INV-1')
    expect(balance!.amount).toBe(700)
    expect(balance!.paidAmount).toBe(700)
    expect(balance!.outstanding).toBe(0)
  })

  it('деньги, не названные ни на одном документе, не закрывают ничей долг', () => {
    const [balance] = invoiceBalances([invoice({ id: 'INV-1' })], [payment(1000, null)])
    expect(balance!.paidAmount).toBe(0)
    expect(balance!.outstanding).toBe(1000)
  })

  it('отозванный документ стоит ровно ноль и своей строки в реестре не получает', () => {
    const invoices = [
      invoice({ id: 'INV-1' }),
      invoice({
        id: 'INV-2',
        kind: 'correction',
        correctsInvoiceId: 'INV-1',
        withdrawsOriginal: true,
        amountGross: -1000,
      }),
    ]
    const [balance] = invoiceBalances(invoices, [])
    expect(balance!.withdrawn).toBe(true)
    expect(balance!.amount).toBe(0)
    expect(nextUnsettledInvoice(invoiceBalances(invoices, []))).toBeNull()
  })

  it('дата закрытия — платёж, которым счёт покрыт, а не последний по нему', () => {
    const balances = invoiceBalances(
      [invoice({ id: 'INV-1' })],
      [
        payment(400, 'INV-1', '2026-03-05T10:00:00.000Z'),
        payment(700, 'INV-1', '2026-03-07T10:00:00.000Z'),
        // Частичный возврат ПОСЛЕ закрытия: счёт остаётся покрытым, но датировать
        // «оплачен» днём, когда деньги ушли обратно, было бы неправдой.
        payment(-50, 'INV-1', '2026-03-09T10:00:00.000Z'),
      ],
    )
    expect(balances[0]!.paidAt).toBe('2026-03-07T10:00:00.000Z')
  })
})

describe('nextUnsettledInvoice — какой документ закрывают пришедшие деньги', () => {
  const balances = (...ids: Array<[string, string, number]>) =>
    ids.map(([id, issuedAt, outstanding]) => ({
      id,
      issuedAt,
      amount: outstanding,
      paidAmount: 0,
      outstanding,
      withdrawn: false,
      paidAt: null,
    }))

  it('старейший из непокрытых — долги гасятся в порядке возникновения', () => {
    const chosen = nextUnsettledInvoice(
      balances(
        ['INV-2', '2026-03-05T10:00:00.000Z', 500],
        ['INV-1', '2026-03-01T10:00:00.000Z', 300],
      ),
    )
    expect(chosen!.id).toBe('INV-1')
    expect(chosen!.outstanding).toBe(300)
  })

  it('покрытые документы не предлагаются — платить по ним нечего', () => {
    const list = balances(['INV-1', '2026-03-01T10:00:00.000Z', 0])
    expect(nextUnsettledInvoice(list)).toBeNull()
  })
})

/**
 * ЧТО ЗДЕСЬ ЗАКРЕПЛЕНО, А ЧТО НЕТ — проверено инверсией 2026-08-30.
 *
 * Тесты ниже закрепляют ПРАВИЛА, и вывернутое правило их краснит: «нечитаемая
 * дата → просрочен» валит четыре теста, «платёж-сироту приписать первому счёту»
 * — один.
 *
 * Но два сторожа в реализации к этим правилам ничего не добавляют, и удалить их
 * можно, не покраснев:
 *
 *   `if (Number.isNaN(due.getTime())) return 'pending'` — без него сравнение с
 *   Invalid Date ложно, и управление доходит до того же `return 'pending'` строкой
 *   ниже;
 *   `if (!named) return null` в `rowOf` — вернуть вместо null сам `invoiceId`
 *   значит вернуть id, которого нет среди счетов, и сравнение всё равно не
 *   совпадёт ни с одним.
 *
 * То есть это не «непроверенные ветки», а ВТОРАЯ ЗАПИСЬ того же правила. Тестом
 * такое не ловится по построению — только чтением. Сторожа оставлены: они
 * называют намерение явно, и цена у них нулевая. Но считать их покрытие
 * доказательством нельзя, и поэтому здесь об этом написано.
 */
describe('края, до которых расчёт баланса раньше не доходил', () => {
  const invoice = (id: string, issuedAt: string, amountGross: number): InvoiceRecord => ({
    id,
    issuedAt,
    kind: 'regular',
    correctsInvoiceId: null,
    withdrawsOriginal: false,
    amountGross,
  })

  it('срок нечитаем — счёт ожидает, а не числится просроченным', () => {
    // `new Date('не дата')` даёт Invalid Date, и любое сравнение с ним ложно.
    // Без явной ветки счёт провалился бы в `pending` молча — но по другой
    // причине, а не по решению. Здесь решение записано: сломанная дата не
    // делает клиента должником, потому что о сроке не известно ничего.
    expect(receivableStatus({ amount: 1000, paidAmount: 0, dueDate: 'не дата' })).toBe('pending')
    expect(receivableStatus({ amount: 1000, paidAmount: 0, dueDate: '' })).toBe('pending')
  })

  it('срок нечитаем, но счёт оплачен — всё равно закрыт', () => {
    // Оплата проверяется ДО разбора даты, и это правильный порядок:
    // закрытому счёту срок уже безразличен.
    expect(receivableStatus({ amount: 1000, paidAmount: 1000, dueDate: 'не дата' })).toBe(
      'completed',
    )
  })

  it('платёж назвал документ, которого нет, — деньги не приписываются никому', () => {
    // Так выглядит платёж по удалённому счёту. Приписать его первому попавшемуся
    // документу — значит показать чужой счёт закрытым.
    const invoices = [invoice('inv-1', '2026-03-01T00:00:00.000Z', 1000)]
    const payments: PaymentRecord[] = [
      { amount: 1000, paidAt: '2026-03-05T00:00:00.000Z', invoiceId: 'inv-СГИНУЛ' },
    ]
    const [row] = invoiceBalances(invoices, payments)
    expect(row!.paidAmount).toBe(0)
    expect(row!.outstanding).toBe(1000)
    expect(row!.paidAt).toBeNull()
  })

  it('два счёта одним днём — очередь решается номером, а не порядком в массиве', () => {
    // Сортировка по дате даёт ноль, и без второго ключа очередь зависела бы от
    // того, в каком порядке счета пришли из хранилища. Тот же день — обычное
    // дело: два отгрузочных документа выписывают подряд.
    const sameDay = '2026-03-01T00:00:00.000Z'
    const balances = invoiceBalances(
      [invoice('inv-B', sameDay, 500), invoice('inv-A', sameDay, 700)],
      [],
    )
    expect(nextUnsettledInvoice(balances)!.id).toBe('inv-A')

    // И обратный порядок в исходных данных даёт ТОТ ЖЕ ответ — иначе проверка
    // подтверждала бы порядок массива, а не правило.
    const reversed = invoiceBalances(
      [invoice('inv-A', sameDay, 700), invoice('inv-B', sameDay, 500)],
      [],
    )
    expect(nextUnsettledInvoice(reversed)!.id).toBe('inv-A')
  })
})
