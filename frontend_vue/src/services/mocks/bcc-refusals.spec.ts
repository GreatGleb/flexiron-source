import { describe, it, expect, beforeEach } from 'vitest'
import { ApiRequestError } from '@/types/api'
import { mockSendBccRequest, mockAcceptResponse, mockMarkNoResponse } from './bcc'
import { mockGetMail, mockPatchMail } from './settings'

/**
 * §2 соглашений «отказ несёт код, а не текст»: против настоящего сервера код
 * лежит в `ApiRequestError.code`, а не в `message`. `unknown-id-is-refused.spec.ts`,
 * `bcc-envelope.spec.ts` и `bcc-history-rows.spec.ts` проверяют эти же три отказа
 * по тексту (`toThrow('...')`) — здесь та же тройка проверяется по полям
 * `code`/`status`, которые до этой правки у мока не заполнялись вовсе.
 */

const { passwordSet: _seedPasswordSet, ...SEED } = mockGetMail()

beforeEach(() => {
  mockPatchMail({ ...SEED, password: 'seed-smtp-token' })
})

describe('отказы bcc несут код и статус, а не только текст', () => {
  it('MAIL_NOT_CONFIGURED: ApiRequestError с кодом и статусом 422', () => {
    mockPatchMail({ host: '' })

    let caught: unknown
    try {
      mockSendBccRequest({
        productIds: ['sheet-2mm'],
        recipientIds: [],
        subject: 's',
        body: 'b',
      })
    } catch (e) {
      caught = e
    }

    expect(caught).toBeInstanceOf(ApiRequestError)
    const err = caught as ApiRequestError
    expect(err.code).toBe('MAIL_NOT_CONFIGURED')
    expect(err.status).toBe(422)
    expect(err.message).toBe('MAIL_NOT_CONFIGURED')
  })

  it('mockAcceptResponse на неизвестном eventId: ApiRequestError с кодом и статусом 404', () => {
    let caught: unknown
    try {
      mockAcceptResponse('no-such-id-ever', { price: 1, unit: 'kg' })
    } catch (e) {
      caught = e
    }

    expect(caught).toBeInstanceOf(ApiRequestError)
    const err = caught as ApiRequestError
    expect(err.code).toBe('BCC_EVENT_NOT_FOUND')
    expect(err.status).toBe(404)
    expect(err.message).toBe('BCC_EVENT_NOT_FOUND')
  })

  it('mockMarkNoResponse на неизвестном eventId: ApiRequestError с кодом и статусом 404', () => {
    let caught: unknown
    try {
      mockMarkNoResponse('no-such-id-ever')
    } catch (e) {
      caught = e
    }

    expect(caught).toBeInstanceOf(ApiRequestError)
    const err = caught as ApiRequestError
    expect(err.code).toBe('BCC_EVENT_NOT_FOUND')
    expect(err.status).toBe(404)
    expect(err.message).toBe('BCC_EVENT_NOT_FOUND')
  })
})
