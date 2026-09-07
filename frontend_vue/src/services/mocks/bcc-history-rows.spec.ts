import { describe, it, expect, beforeEach } from 'vitest'
import {
  MOCK_BCC_HISTORY,
  mockGetBccHistory,
  mockGetBccRecipients,
  mockLogBccRequest,
  mockSendBccRequest,
  mockClearSentEmails,
} from './bcc'
import { mockGetMail, mockPatchMail } from './settings'

/**
 * БАГ-01 домена bcc: строки истории создавала СТРАНИЦА — она импортировала
 * `MOCK_BCC_HISTORY` в `src/views` и дописывала в него результат своих действий.
 * Против настоящего сервера письмо ушло бы, а истории не осталось ни у кого.
 *
 * Здесь проверяется обратное утверждение: строки завёл сервер, и завёл их в той
 * же транзакции, что и отправку. Каждый тест сформулирован так, чтобы
 * БЕЗДЕЙСТВИЕ его не устраивало (питфолл #68): считаются точные дельты и
 * читается содержимое строк, а не «стало не меньше».
 */

const { passwordSet: _seedPasswordSet, ...SEED } = mockGetMail()
const IDS = mockGetBccRecipients([]).map((r) => r.id)

beforeEach(() => {
  mockClearSentEmails()
  mockPatchMail({ ...SEED, password: 'seed-smtp-token' })
})

describe('строки события BCC создаёт сервер', () => {
  it('отправка кладёт по строке на каждую пару «получатель × позиция»', () => {
    const before = MOCK_BCC_HISTORY.length
    const recipients = IDS.slice(0, 2)
    const products = ['sheet-2mm', 'beam-i20']

    const { requestId } = mockSendBccRequest({
      productIds: products,
      recipientIds: recipients,
      subject: 'Metal price request',
      body: 'Please provide current prices.',
    })

    expect(MOCK_BCC_HISTORY.length).toBe(before + recipients.length * products.length)

    const created = MOCK_BCC_HISTORY.filter((e) => e.requestId === requestId)
    expect(created).toHaveLength(recipients.length * products.length)
    // Каждая пара представлена ровно один раз.
    const pairs = created.map((e) => `${e.supplierId}::${e.productId}`)
    expect(new Set(pairs).size).toBe(pairs.length)
    // Все строки — свежие, со статусом «отправлено».
    expect(created.every((e) => e.status === 'sent')).toBe(true)
    // Идентификаторы строк уникальны в пределах всей ленты.
    expect(new Set(MOCK_BCC_HISTORY.map((e) => e.id)).size).toBe(MOCK_BCC_HISTORY.length)
  })

  it('`requestId` присваивает сервер, и у двух отправок он разный', () => {
    const first = mockSendBccRequest({
      productIds: ['sheet-2mm'],
      recipientIds: [IDS[0]!],
      subject: 's',
      body: 'b',
    }).requestId
    const second = mockSendBccRequest({
      productIds: ['sheet-2mm'],
      recipientIds: [IDS[0]!],
      subject: 's',
      body: 'b',
    }).requestId

    expect(first).toMatch(/^req-\d{3,}$/)
    expect(second).toMatch(/^req-\d{3,}$/)
    expect(second).not.toBe(first)
    // Счётчик монотонный — второй номер строго больше первого, а не «не меньше».
    expect(Number(second.slice(4))).toBeGreaterThan(Number(first.slice(4)))
  })

  it('подпись источника берётся из каталога сервера и заполнена во всех трёх локалях', () => {
    const { requestId } = mockSendBccRequest({
      productIds: ['sheet-2mm'],
      recipientIds: [IDS[0]!],
      subject: 's',
      body: 'b',
    })

    const row = MOCK_BCC_HISTORY.find((e) => e.requestId === requestId)!
    expect(row.source).toEqual({ ru: 'BCC Инструмент', en: 'BCC Tool', lt: 'BCC įrankis' })
  })

  it('название позиции берётся из каталога сервера, а не подставляется её id', () => {
    const { requestId } = mockSendBccRequest({
      productIds: ['sheet-2mm'],
      recipientIds: [IDS[0]!],
      subject: 's',
      body: 'b',
    })

    const row = MOCK_BCC_HISTORY.find((e) => e.requestId === requestId)!
    expect(row.productName).toEqual({ ru: 'Лист 2мм', en: 'Sheet 2mm', lt: 'Lakštas 2mm' })
    expect(row.productName.en).not.toBe(row.productId)
  })

  it('отказ по ненастроенной почте не оставляет ни письма, ни строк', () => {
    const before = MOCK_BCC_HISTORY.length
    mockPatchMail({ host: '' })

    expect(() =>
      mockSendBccRequest({
        productIds: ['sheet-2mm'],
        recipientIds: [IDS[0]!],
        subject: 's',
        body: 'b',
      }),
    ).toThrow('MAIL_NOT_CONFIGURED')

    expect(MOCK_BCC_HISTORY.length).toBe(before)
  })
})

describe('логирование запроса, пришедшего не через инструмент', () => {
  it('кладёт те же N × M строк и переводит `source` целиком', () => {
    const before = MOCK_BCC_HISTORY.length
    const recipients = IDS.slice(0, 3)

    // На проводе `source` приходит заполненным в одной локали — так его
    // нормализует `bccService.logBccRequest` через `toTranslatedString`.
    const { requestId } = mockLogBccRequest({
      productIds: ['pipe-100'],
      recipientIds: recipients,
      source: { ru: '', en: 'Phone', lt: '' },
    })

    expect(MOCK_BCC_HISTORY.length).toBe(before + recipients.length)
    const created = MOCK_BCC_HISTORY.filter((e) => e.requestId === requestId)
    expect(created).toHaveLength(recipients.length)
    // Две пустые локали — это питфолл #38; сервер обязан отдать все три.
    expect(created[0]!.source).toEqual({ ru: 'Телефон', en: 'Phone', lt: 'Telefonas' })
  })

  it('источник вне каталога сохраняется, но не пустыми локалями', () => {
    const { requestId } = mockLogBccRequest({
      productIds: ['pipe-100'],
      recipientIds: [IDS[0]!],
      source: { ru: '', en: 'Carrier pigeon', lt: '' },
    })

    const row = MOCK_BCC_HISTORY.find((e) => e.requestId === requestId)!
    expect(row.source).toEqual({
      ru: 'Carrier pigeon',
      en: 'Carrier pigeon',
      lt: 'Carrier pigeon',
    })
  })
})

describe('лента отдаёт копию, а не ссылки в свой стор', () => {
  it('правка полученной строки не меняет запись на «сервере»', () => {
    const page = mockGetBccHistory(1, 1)
    const received = page.items[0]!
    const stored = MOCK_BCC_HISTORY.find((e) => e.id === received.id)!
    const originalStatus = stored.status

    received.status = received.status === 'sent' ? 'no_response' : 'sent'
    received.supplierName.en = 'MUTATED'

    expect(stored.status).toBe(originalStatus)
    expect(stored.supplierName.en).not.toBe('MUTATED')
  })
})
