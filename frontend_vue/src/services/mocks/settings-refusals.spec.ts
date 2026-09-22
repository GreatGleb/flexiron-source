import { describe, it, expect } from 'vitest'
import {
  mockCreateConversion,
  mockDeleteConversion,
  mockDeleteCurrency,
  mockDeleteOrderStatus,
  mockDeleteUom,
  mockGetOrderStatuses,
  mockPatchMail,
  mockSaveWarehouseMap,
  mockSendMailTest,
  mockUpdateConversion,
  mockUpdateCurrency,
  mockUpdateOrderStatus,
  mockUpdateUom,
} from './settings'
import { getMock, postMock, putMock } from './index'
import { errorCode } from '@/services/apiErrorCode'
import { ApiRequestError } from '@/types/api'
import type { UomConversion } from '@/types/settings'

/**
 * Отказ мока — `ApiRequestError` с кодом в ПОЛЕ `code`, как у настоящего сервера.
 *
 * Проба поведенческая: она ВЫЗЫВАЕТ моки и утверждает поле, а не ищет подстроку в
 * их тексте. Поэтому мутация `throw new Error('CONVERSION_PAIR_TAKEN')` — код
 * внутри `message`, а не в `code` — краснит её: `instanceof ApiRequestError`
 * падает, хотя `errorCode()` вернул бы тот же текст откатом. Именно на этом
 * откате держался старый мок (`throw new Error(КОД)`), и именно поэтому слайсы
 * C3–C7 нельзя было проверить в мок-режиме: их ветки отказа смотрят на ПОЛЕ.
 */

const CHANGE_PASSWORD = '/api/settings/change-password'
const SETTINGS_PATH = '/api/settings'
const CURRENT_PASSWORD = 'demo-password'
const MISSING = 'missing'
const NEW_PASSWORD = 'brand-new-secret'
const SWITCHED_PASSWORD = 'switched-secret'
const ALT_PASSWORD = 'another-secret'
const SMTP_HOST = 'smtp.flexiron.lt'

/** Отказ обязан быть `ApiRequestError` с полем `code`; успех — провал пробы. */
async function refusalOf(run: () => unknown): Promise<ApiRequestError> {
  try {
    await run()
  } catch (e) {
    expect(e).toBeInstanceOf(ApiRequestError)
    return e as ApiRequestError
  }
  throw new Error('мок ответил успехом там, где обязан был отказать')
}

describe('дубль пары единиц', () => {
  it('второй раз ту же пару мок отвергает кодом CONVERSION_PAIR_TAKEN', async () => {
    const pair: Omit<UomConversion, 'id'> = {
      fromUomId: 'uom-kg',
      toUomId: 'uom-t',
      type: 'static',
      factor: 0.001,
    }
    mockCreateConversion(pair) // первая пара — законна

    const e = await refusalOf(() => mockCreateConversion(pair))

    expect(e.code).toBe('CONVERSION_PAIR_TAKEN')
    expect(errorCode(e)).toBe('CONVERSION_PAIR_TAKEN')
    expect(e.status).toBe(409)
  })
})

describe('смена пароля', () => {
  it('читает тело: смена меняет принимаемый текущий пароль', async () => {
    try {
      await postMock(CHANGE_PASSWORD, {
        currentPassword: CURRENT_PASSWORD,
        newPassword: SWITCHED_PASSWORD,
        confirmPassword: SWITCHED_PASSWORD,
      })

      // Старый текущий перестал приниматься — а это и есть «не no-op»:
      // не читай мок тела, оба вызова прошли бы одинаково.
      const stale = await refusalOf(() =>
        postMock(CHANGE_PASSWORD, {
          currentPassword: CURRENT_PASSWORD,
          newPassword: ALT_PASSWORD,
          confirmPassword: ALT_PASSWORD,
        }),
      )
      expect(errorCode(stale)).toBe('PASSWORD_WRONG_CURRENT')
    } finally {
      // Состояние мока — на весь файл: вернуть демо-пароль на место.
      await postMock(CHANGE_PASSWORD, {
        currentPassword: SWITCHED_PASSWORD,
        newPassword: CURRENT_PASSWORD,
        confirmPassword: CURRENT_PASSWORD,
      })
    }
  })

  it('неверный текущий пароль отвергается кодом PASSWORD_WRONG_CURRENT', async () => {
    const e = await refusalOf(() =>
      postMock(CHANGE_PASSWORD, {
        currentPassword: 'not-the-password',
        newPassword: NEW_PASSWORD,
        confirmPassword: NEW_PASSWORD,
      }),
    )

    expect(e.code).toBe('PASSWORD_WRONG_CURRENT')
    expect(errorCode(e)).toBe('PASSWORD_WRONG_CURRENT')
  })

  it('короткий новый пароль отвергается кодом PASSWORD_TOO_SHORT', async () => {
    const e = await refusalOf(() =>
      postMock(CHANGE_PASSWORD, {
        currentPassword: CURRENT_PASSWORD,
        newPassword: 'short',
        confirmPassword: 'short',
      }),
    )

    expect(e.code).toBe('PASSWORD_TOO_SHORT')
    expect(errorCode(e)).toBe('PASSWORD_TOO_SHORT')
  })

  it('несовпадающее подтверждение отвергается кодом PASSWORD_CONFIRM_MISMATCH', async () => {
    const e = await refusalOf(() =>
      postMock(CHANGE_PASSWORD, {
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
        confirmPassword: 'other-secret',
      }),
    )

    expect(e.code).toBe('PASSWORD_CONFIRM_MISMATCH')
    expect(errorCode(e)).toBe('PASSWORD_CONFIRM_MISMATCH')
  })
})

describe('мёртвые ветки /api/settings', () => {
  it('GET /api/settings снят: маршрут промахивается и отказывает 404', async () => {
    const e = await refusalOf(() => getMock(SETTINGS_PATH))

    expect(e.status).toBe(404)
    expect(errorCode(e)).toBe('NOT_FOUND')
  })

  it('PUT /api/settings снят: маршрут промахивается и отказывает 404', async () => {
    const e = await refusalOf(() => putMock(SETTINGS_PATH, {}))

    expect(e.status).toBe(404)
    expect(errorCode(e)).toBe('NOT_FOUND')
  })
})

describe('каждый достижимый отказ несёт код в поле', () => {
  it('обход перечня отказов домена: непустой `code` у каждого', async () => {
    const systemStatus = mockGetOrderStatuses().find((s) => s.system)
    expect(systemStatus).toBeDefined()

    // Почта доводится до недонастроенной: иначе MAIL_NOT_CONFIGURED недостижим.
    mockPatchMail({ host: '' })
    try {
      const refusals: ReadonlyArray<readonly [string, () => unknown]> = [
        ['CURRENCY_NOT_FOUND', () => mockUpdateCurrency(MISSING, {})],
        ['CURRENCY_NOT_FOUND', () => mockDeleteCurrency(MISSING)],
        ['UOM_NOT_FOUND', () => mockUpdateUom(MISSING, {})],
        ['UOM_NOT_FOUND', () => mockDeleteUom(MISSING)],
        [
          'CONVERSION_PAIR_TAKEN',
          () =>
            mockCreateConversion({
              fromUomId: 'uom-t',
              toUomId: 'uom-kg',
              type: 'static',
              factor: 1000,
            }),
        ],
        ['CONVERSION_NOT_FOUND', () => mockUpdateConversion(MISSING, {})],
        ['CONVERSION_NOT_FOUND', () => mockDeleteConversion(MISSING)],
        ['ORDER_STATUS_NOT_FOUND', () => mockUpdateOrderStatus(MISSING, {})],
        ['ORDER_STATUS_NOT_FOUND', () => mockDeleteOrderStatus(MISSING)],
        ['FORBIDDEN', () => mockDeleteOrderStatus(systemStatus!.id)],
        ['MAIL_NOT_CONFIGURED', () => mockSendMailTest()],
        [
          'MAP_NOT_AN_IMAGE',
          () =>
            mockSaveWarehouseMap({
              fileId: 'file-x',
              name: 'plan.pdf',
              mime: 'application/pdf',
              size: 1024,
              url: 'data:application/pdf;base64,AAAA',
              uploadedAt: '2026-09-22T00:00:00Z',
            }),
        ],
      ]

      for (const [code, run] of refusals) {
        const e = await refusalOf(run)
        expect(e.code).toBeTruthy() // код лежит В ПОЛЕ, а не откатом из текста
        expect(errorCode(e)).toBe(code)
      }
    } finally {
      mockPatchMail({ host: SMTP_HOST })
    }
  })
})
