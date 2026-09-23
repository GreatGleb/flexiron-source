import { describe, it, expect } from 'vitest'
import {
  mockCreateClient,
  mockPatchClient,
  mockDeleteClient,
  mockDeleteClientAuditEntry,
  mockAddClientInteraction,
  mockDeleteClientInteraction,
  registerClientOrderLookup,
} from './clients'
import { ApiRequestError } from '@/types/api'
import type { ClientFormData } from '@/types/client'

/**
 * Отказ мока клиентов — `ApiRequestError` с кодом в ПОЛЕ `code`, как у настоящего
 * сервера, а не строкой внутри `message` (соглашения §2).
 *
 * Проба поведенческая: она ВЫЗЫВАЕТ мок и утверждает `e.code`/`e.status`, а не ищет
 * подстроку в тексте. Откати любой из четырнадцати отказов обратно на голый
 * `throw new Error(<тот же текст>)` — `e.code` станет `undefined`, и проба покраснеет,
 * хотя текст сообщения при этом не изменится ни на символ.
 */

const VALID_CLIENT: ClientFormData = {
  name: 'Test Client',
  companyCode: '999888777',
  vatCode: 'LT999888777',
  address: 'Test g. 1, Vilnius',
  country: 'LT',
  phone: '+37060000000',
  email: 'test@example.com',
  status: 'active',
  paymentTermsDays: 30,
  notes: null,
  rejectionReason: null,
}

const MISSING_CLIENT_ID = 'CL-missing'

/** Отказ обязан быть `ApiRequestError` с полем `code`; успех — провал пробы. */
function refusalOf(run: () => unknown): ApiRequestError {
  try {
    run()
  } catch (e) {
    expect(e).toBeInstanceOf(ApiRequestError)
    return e as ApiRequestError
  }
  throw new Error('мок ответил успехом там, где обязан был отказать')
}

describe('POST /api/clients — отказы', () => {
  it('пустое имя: VALIDATION_ERROR, 422', () => {
    const e = refusalOf(() => mockCreateClient({ ...VALID_CLIENT, name: '  ' }))
    expect(e.code).toBe('VALIDATION_ERROR')
    expect(e.status).toBe(422)
    expect(e.message).toBe('VALIDATION_ERROR: name is required')
  })

  it('пустой companyCode: VALIDATION_ERROR, 422', () => {
    const e = refusalOf(() => mockCreateClient({ ...VALID_CLIENT, companyCode: '' }))
    expect(e.code).toBe('VALIDATION_ERROR')
    expect(e.status).toBe(422)
    expect(e.message).toBe('VALIDATION_ERROR: companyCode is required')
  })

  it('пустой email: VALIDATION_ERROR, 422', () => {
    const e = refusalOf(() => mockCreateClient({ ...VALID_CLIENT, email: '' }))
    expect(e.code).toBe('VALIDATION_ERROR')
    expect(e.status).toBe(422)
    expect(e.message).toBe('VALIDATION_ERROR: email is required')
  })

  it('отрицательный paymentTermsDays: VALIDATION_ERROR, 422', () => {
    const e = refusalOf(() => mockCreateClient({ ...VALID_CLIENT, paymentTermsDays: -1 }))
    expect(e.code).toBe('VALIDATION_ERROR')
    expect(e.status).toBe(422)
    expect(e.message).toBe(
      'VALIDATION_ERROR: paymentTermsDays must be a non-negative whole number of days',
    )
  })

  it('повтор companyCode: CONFLICT, 409', () => {
    // CL-001 уже сидит в посеве с этим companyCode.
    const e = refusalOf(() => mockCreateClient({ ...VALID_CLIENT, companyCode: '304567890' }))
    expect(e.code).toBe('CONFLICT')
    expect(e.status).toBe(409)
    expect(e.message).toBe('CONFLICT: companyCode already exists')
  })
})

describe('PATCH /api/clients/:id — отказы', () => {
  it('несуществующий клиент: CLIENT_NOT_FOUND, 404', () => {
    const e = refusalOf(() => mockPatchClient(MISSING_CLIENT_ID, {}))
    expect(e.code).toBe('CLIENT_NOT_FOUND')
    expect(e.status).toBe(404)
    expect(e.message).toBe('CLIENT_NOT_FOUND')
  })

  it('некорректный paymentTermsDays: VALIDATION_ERROR, 422', () => {
    const e = refusalOf(() => mockPatchClient('CL-003', { paymentTermsDays: -5 }))
    expect(e.code).toBe('VALIDATION_ERROR')
    expect(e.status).toBe(422)
    expect(e.message).toBe(
      'VALIDATION_ERROR: paymentTermsDays must be a non-negative whole number of days',
    )
  })
})

describe('DELETE /api/clients/:id — отказы', () => {
  it('несуществующий клиент: CLIENT_NOT_FOUND, 404', () => {
    const e = refusalOf(() => mockDeleteClient(MISSING_CLIENT_ID))
    expect(e.code).toBe('CLIENT_NOT_FOUND')
    expect(e.status).toBe(404)
    expect(e.message).toBe('CLIENT_NOT_FOUND')
  })

  it('у клиента есть заказы: CONFLICT, 409', () => {
    registerClientOrderLookup((clientId) => (clientId === 'CL-002' ? [{ id: 'ord-1' }] : []))
    try {
      const e = refusalOf(() => mockDeleteClient('CL-002'))
      expect(e.code).toBe('CONFLICT')
      expect(e.status).toBe(409)
      expect(e.message).toBe('CONFLICT: client has orders')
    } finally {
      registerClientOrderLookup(() => [])
    }
  })
})

describe('DELETE /api/clients/:id/audit/:entryId — отказы', () => {
  it('несуществующий клиент: CLIENT_NOT_FOUND, 404', () => {
    const e = refusalOf(() => mockDeleteClientAuditEntry(MISSING_CLIENT_ID, 'cl-au-1'))
    expect(e.code).toBe('CLIENT_NOT_FOUND')
    expect(e.status).toBe(404)
    expect(e.message).toBe('CLIENT_NOT_FOUND')
  })

  it('несуществующая запись журнала: AUDIT_ENTRY_NOT_FOUND, 404', () => {
    const e = refusalOf(() => mockDeleteClientAuditEntry('CL-001', 'cl-au-missing'))
    expect(e.code).toBe('AUDIT_ENTRY_NOT_FOUND')
    expect(e.status).toBe(404)
    expect(e.message).toBe('AUDIT_ENTRY_NOT_FOUND')
  })
})

describe('POST /api/clients/:id/interactions — отказы', () => {
  it('несуществующий клиент: CLIENT_NOT_FOUND, 404', () => {
    const e = refusalOf(() =>
      mockAddClientInteraction(MISSING_CLIENT_ID, {
        date: '2026-09-23',
        type: 'call',
        summary: 'test',
        user: 'Test User',
        rejectionReason: null,
      }),
    )
    expect(e.code).toBe('CLIENT_NOT_FOUND')
    expect(e.status).toBe(404)
    expect(e.message).toBe('CLIENT_NOT_FOUND')
  })
})

describe('DELETE /api/clients/:id/interactions/:entryIndex — отказы', () => {
  it('несуществующий клиент: CLIENT_NOT_FOUND, 404', () => {
    const e = refusalOf(() => mockDeleteClientInteraction(MISSING_CLIENT_ID, 0))
    expect(e.code).toBe('CLIENT_NOT_FOUND')
    expect(e.status).toBe(404)
    expect(e.message).toBe('CLIENT_NOT_FOUND')
  })

  it('индекс вне границ истории: INTERACTION_ENTRY_NOT_FOUND, 404', () => {
    const e = refusalOf(() => mockDeleteClientInteraction('CL-001', 999))
    expect(e.code).toBe('INTERACTION_ENTRY_NOT_FOUND')
    expect(e.status).toBe(404)
    expect(e.message).toBe('INTERACTION_ENTRY_NOT_FOUND')
  })
})
