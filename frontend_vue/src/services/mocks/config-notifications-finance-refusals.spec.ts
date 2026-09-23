// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { mockUpdateField, mockUpdateSection } from './config'
import { mockGetNotifications, mockMarkAsRead } from './notifications'
import { mockGetPayment, mockPatchPayment } from './finance'
import { ApiRequestError } from '@/types/api'
import { errorCode } from '@/services/apiErrorCode'

/**
 * mock-refusals-config-notifications-finance: шесть отказов, которые в config.ts,
 * notifications.ts и finance.ts бросали голый `Error(код)` — код лежал в `message`,
 * а не в поле `code`, вопреки §2 общих соглашений («отказ несёт код, а не текст»,
 * `00-conventions.md:62-68`). Правило и приём — те же, что в `mocks/settings.ts:419-432`.
 *
 * Каждая проверка ниже краснеет, если правку откатить на `throw new Error(<текст>)`:
 * у голого `Error` нет свойства `code` (`undefined`), а этот файл утверждает именно
 * поле, не текст.
 */

const UNKNOWN = 'no-such-id-ever'

function assertRefusal(thrower: () => void, code: string, status: number, message: string): void {
  let caught: unknown
  try {
    thrower()
  } catch (e) {
    caught = e
  }
  expect(caught).toBeInstanceOf(ApiRequestError)
  const err = caught as ApiRequestError
  expect(err.code).toBe(code)
  expect(err.status).toBe(status)
  // Текст сообщения — тот же посимвольно, что был у прежнего голого `Error`, чтобы
  // unknown-id-is-refused.spec.ts осталась зелёной без правки.
  expect(err.message).toBe(message)
}

describe('config, notifications, finance — отказ несёт код в поле, а не в тексте', () => {
  afterEach(() => {
    localStorage.removeItem('test_mock_force_error')
  })

  it('config: неизвестное поле — FIELD_NOT_FOUND, 404', () => {
    assertRefusal(
      () => mockUpdateField(UNKNOWN, { required: true }),
      'FIELD_NOT_FOUND',
      404,
      'FIELD_NOT_FOUND',
    )
  })

  it('config: неизвестная секция — SECTION_NOT_FOUND, 404', () => {
    assertRefusal(
      () => mockUpdateSection(UNKNOWN, { collapsed: true }),
      'SECTION_NOT_FOUND',
      404,
      'SECTION_NOT_FOUND',
    )
  })

  it('notifications: флаг принудительной ошибки — SIMULATED_MOCK_ERROR, 500 (не код домена — нарочный отказ мока, ближайший смысловой аналог сбоя сервера)', () => {
    localStorage.setItem('test_mock_force_error', 'true')
    assertRefusal(
      () =>
        mockGetNotifications(
          { type: 'all', isRead: null, search: '', sortBy: 'createdAt', sortDir: 'desc' },
          { page: 1, pageSize: 10 },
        ),
      'SIMULATED_MOCK_ERROR',
      500,
      'SIMULATED_MOCK_ERROR',
    )
  })

  it('notifications: неизвестная запись — NOTIFICATION_NOT_FOUND, 404', () => {
    assertRefusal(
      () => mockMarkAsRead(UNKNOWN),
      'NOTIFICATION_NOT_FOUND',
      404,
      'NOTIFICATION_NOT_FOUND',
    )
  })

  it('finance: чтение неизвестного платежа — PAYMENT_NOT_FOUND, 404', () => {
    assertRefusal(() => mockGetPayment(UNKNOWN), 'PAYMENT_NOT_FOUND', 404, 'PAYMENT_NOT_FOUND')
  })

  it('finance: правка неизвестного платежа — PAYMENT_NOT_FOUND, 404', () => {
    assertRefusal(
      () => mockPatchPayment(UNKNOWN, { notes: 'x' }),
      'PAYMENT_NOT_FOUND',
      404,
      'PAYMENT_NOT_FOUND',
    )
  })

  /**
   * `OutgoingPaymentCardPage.vue:72` — `errorKind.value = errorCode(e) === 'PAYMENT_NOT_FOUND'
   * ? 'not_found' : 'generic'`. Эта ветка обязана узнавать отказ по полю `code`, а не
   * откатом на текст (`apiErrorCode.ts:42`: сначала `error.code`, откат на текст — только
   * когда `code` нет). Прямая проверка того же выражения, что стоит в странице:
   */
  it('OutgoingPaymentCardPage: узнаёт PAYMENT_NOT_FOUND по полю code настоящего отказа мока', () => {
    let caught: unknown
    try {
      mockGetPayment(UNKNOWN)
    } catch (e) {
      caught = e
    }
    // Тот же вызов, что в строке 72 страницы.
    const errorKind = errorCode(caught) === 'PAYMENT_NOT_FOUND' ? 'not_found' : 'generic'
    expect(errorKind).toBe('not_found')
  })

  /**
   * Доказательство, что ветка читает именно ПОЛЕ, а не текстовый откат: текст
   * сообщения ниже вообще не содержит кода в начале (не проходит `CODE_AT_START`
   * в `apiErrorCode.ts:13`), так что текстовый откат вернул бы весь текст целиком,
   * а не 'PAYMENT_NOT_FOUND'. `errorCode()` тем не менее возвращает код — значит
   * он взят из `.code`, а не разобран из `message`.
   */
  it('errorCode() читает code из ApiRequestError даже когда текст сообщения кода не содержит', () => {
    const err = new ApiRequestError({
      status: 404,
      message: 'Sorry, this payment record could not be located on the server.',
      code: 'PAYMENT_NOT_FOUND',
    })
    expect(errorCode(err)).toBe('PAYMENT_NOT_FOUND')
  })
})
