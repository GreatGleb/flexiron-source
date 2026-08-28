import { describe, it, expect, beforeEach } from 'vitest'
import {
  mockSendBccRequest,
  mockGetBccRecipients,
  MOCK_SENT_EMAILS,
  mockClearSentEmails,
} from './bcc'
import { mockGetMail, mockPatchMail } from './settings'

/**
 * Спека 04.2 §4: письмо уходит ОДНОЙ транзакцией, все адреса в BCC — поставщики
 * не должны видеть друг друга.
 *
 * Снаружи рассылка циклом по одному письму выглядит точно так же, поэтому
 * проверять это можно только по тому, что осталось на «сервере»: сколько
 * конвертов ушло и что в каких полях. До этих тестов отправка не оставляла
 * следа вовсе — проверять было нечего.
 */

const { passwordSet: _seedPasswordSet, ...SEED } = mockGetMail()
const RECIPIENTS = mockGetBccRecipients([])
const IDS = RECIPIENTS.map((r) => r.id)
const EMAILS = RECIPIENTS.map((r) => r.email)

beforeEach(() => {
  mockClearSentEmails()
  mockPatchMail({ ...SEED, password: 'seed-smtp-token' })
})

function send() {
  return mockSendBccRequest({
    productIds: ['sheet-2mm'],
    recipientIds: IDS,
    subject: 'Metal price request',
    body: 'Please provide current prices.',
  })
}

describe('BCC send is one transaction', () => {
  it('leaves exactly one envelope for many recipients', () => {
    expect(IDS.length).toBeGreaterThan(1)

    send()

    expect(MOCK_SENT_EMAILS).toHaveLength(1)
  })

  it('puts every recipient in BCC and none of them anywhere else', () => {
    send()

    const envelope = MOCK_SENT_EMAILS[0]!
    expect(envelope.bcc).toEqual(EMAILS)
    // Ни один адрес поставщика не виден другому: в To и Cc их нет.
    expect(envelope.to.filter((a) => EMAILS.includes(a))).toEqual([])
    expect(envelope.cc).toEqual([])
  })

  it('addresses the envelope from the mail server settings, not from a constant', () => {
    mockPatchMail({ fromEmail: 'bids@flexiron.lt', fromName: 'Flexiron Purchasing' })

    send()

    const envelope = MOCK_SENT_EMAILS[0]!
    expect(envelope.from).toBe('Flexiron Purchasing <bids@flexiron.lt>')
    expect(envelope.to).toEqual(['bids@flexiron.lt'])
  })

  it('refuses to send while the mail server is not configured', () => {
    mockPatchMail({ host: '' })

    expect(() => send()).toThrow('MAIL_NOT_CONFIGURED')
    expect(MOCK_SENT_EMAILS).toHaveLength(0)
  })

  it('carries the subject, body and attachments of the request', () => {
    mockSendBccRequest({
      productIds: ['sheet-2mm'],
      recipientIds: IDS,
      subject: 'Metal price request 28.08.2026',
      body: 'Hello!',
      fileIds: ['file-1', 'file-2'],
    })

    const envelope = MOCK_SENT_EMAILS[0]!
    expect(envelope.subject).toBe('Metal price request 28.08.2026')
    expect(envelope.body).toBe('Hello!')
    expect(envelope.fileIds).toEqual(['file-1', 'file-2'])
  })
})
