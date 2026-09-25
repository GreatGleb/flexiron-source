import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  SETTINGS_REFUSAL_CODES,
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
import { MOCK_PASSWORD_CODES, getMock, postMock, putMock } from './index'
import { mockGetProduct, mockPatchProduct } from './products'
import { STORE as PRODUCTS_STORE } from './products'
import { errorCode } from '@/services/apiErrorCode'
import { contractDir } from '@/services/contractInventory'
import { ApiRequestError } from '@/types/api'
import type { UomConversion } from '@/types/settings'
import type { Product } from '@/types/product'

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

/**
 * Имена кодов, санкционированные КОНТРАКТОМ (`roo_code/roo-context/api/*.md`).
 *
 * Контракт — продукт: он и есть источник имён на проводе. Мок обязан бросать только
 * те коды, что в нём названы, иначе клиент и сервер разговаривают разными словами.
 * Именно этим ловится ПЕРЕИМЕНОВАНИЕ кода в моке: ожидание и бросок берутся из одной
 * таблицы, поэтому дрейфа «копия против копии» больше нет — но дрейф с контрактом
 * остался бы, и он здесь проверяется.
 *
 * Граница честно названа: сверяется ПРИНАДЛЕЖНОСТЬ множеству имён контракта, а не
 * «сценарий → код». Переименование в ДРУГОЕ имя из того же контракта эта проба не
 * различит — там нужна сверка по строкам таблиц контракта, отдельная работа.
 */
function sanctionedCodes(): Set<string> {
  const dir = contractDir()
  const names = new Set<string>()
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md')) continue
    const text = readFileSync(join(dir, file), 'utf8')
    for (const token of text.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) ?? []) names.add(token)
  }
  return names
}

// ── Перечень отказов домена выведен из ПРОДУКТА, а не переписан здесь (F-1) ──
//
// Источник — сам мок: `SETTINGS_REFUSAL_CODES` (`mocks/settings.ts`) и
// `MOCK_PASSWORD_CODES` (`mocks/index.ts`). Ни один код ниже не написан рукой. Здесь
// лежат только ДРАЙВЕРЫ — как каждый отказ достичь; сверка множества в последнем
// `describe` обязывает: каждому ключу таблицы отвечает драйвер, лишних нет. Поэтому
// новый отказ в моке достаточно завести в таблице (и бросить его маршрутом) — проба
// краснеет САМА, без единой правки спека. Это доказывает мутация M34.
//
// Имена же кодов (F-3) сверены с КОНТРАКТОМ: `MOCK_PASSWORD_CODES` и
// `SETTINGS_REFUSAL_CODES` импортируются из мока, а не переписаны здесь, но каждое
// значение обязано быть названо доменным контрактом — иначе переименование в моке
// разошлось бы с сервером молча. Это доказывает мутация M35.

/** Ключ перечня: имя сценария в таблицах кодов мока (не сам код). */
type RefusalKey = keyof typeof SETTINGS_REFUSAL_CODES | keyof typeof MOCK_PASSWORD_CODES

/** «Сценарий → код» целиком, как его объявил продукт. */
const DECLARED_CODES: Readonly<Record<string, string>> = {
  ...SETTINGS_REFUSAL_CODES,
  ...MOCK_PASSWORD_CODES,
}

const systemStatus = mockGetOrderStatuses().find((s) => s.system)

/** Карта — это картинка; этот «файл» ею не является, и мок обязан отвергнуть. */
const NOT_AN_IMAGE = {
  fileId: 'file-x',
  name: 'plan.pdf',
  mime: 'application/pdf',
  size: 1024,
  url: 'data:application/pdf;base64,AAAA',
  uploadedAt: '2026-09-22T00:00:00Z',
}

/**
 * Товар-однодневка для проб «используется»/«не используется».
 *
 * Хранилище товаров (`STORE` из `./products`) — тот же источник, из которого мок настроек
 * читает использование справочников (F-2 плана задачи): вторая копия сидов здесь не
 * заводится. Поля, которых проба не касается, — минимальный валидный `Product`.
 */
function makeTempProduct(patch: Partial<Product>): Product {
  return {
    id: 'prod-temp-refusal-probe',
    name: { ru: 'Тест', en: 'Refusal probe product', lt: 'Test' },
    categoryId: null,
    categoryName: null,
    sku: null,
    description: null,
    price: null,
    priceQuantity: 1,
    currencyId: null,
    minStock: null,
    avgCostPrice: null,
    avgSalePrice: null,
    purchaseUomId: null,
    warehouseUomId: null,
    saleUomId: null,
    purchaseToWarehouseFormulaType: null,
    purchaseToWarehouseFactor: null,
    warehouseToSaleFormulaType: null,
    warehouseToSaleFactor: null,
    weightPerWarehouseUnitKg: null,
    createdAt: '2026-01-01',
    fieldValues: [],
    linkedSuppliers: [],
    auditLog: [],
    ...patch,
  }
}

/** Сидовая валюта, не используемая ни одним товаром — только для позитивного пути. */
const UNUSED_CURRENCY_ID = 'cur-gbp'
/** Сидовая единица, не используемая ни одним товаром — только для позитивного пути. */
const UNUSED_UOM_ID = 'uom-h'
/** Сидовая единица, стоящая ТОЛЬКО в правиле пересчёта `conv-m-mm` — товары её не знают. */
const CONVERSION_ONLY_UOM_ID = 'uom-mm'

const changePasswordWrongCurrent = () =>
  postMock(CHANGE_PASSWORD, {
    currentPassword: 'not-the-password',
    newPassword: NEW_PASSWORD,
    confirmPassword: NEW_PASSWORD,
  })

const changePasswordTooShort = () =>
  postMock(CHANGE_PASSWORD, {
    currentPassword: CURRENT_PASSWORD,
    newPassword: 'short',
    confirmPassword: 'short',
  })

const changePasswordConfirmMismatch = () =>
  postMock(CHANGE_PASSWORD, {
    currentPassword: CURRENT_PASSWORD,
    newPassword: NEW_PASSWORD,
    confirmPassword: 'other-secret',
  })

const DRIVERS: ReadonlyArray<readonly [RefusalKey, () => unknown]> = [
  ['currencyNotFound', () => mockUpdateCurrency(MISSING, {})],
  ['currencyNotFound', () => mockDeleteCurrency(MISSING)],
  // cur-eur сида — валюта по умолчанию, и её же currencyId несёт каждый сидовый товар:
  // отказ обязан назвать умолчание, а не использование (проверено отдельно, ниже).
  ['currencyIsDefault', () => mockDeleteCurrency('cur-eur')],
  [
    'currencyInUse',
    () => {
      const product = makeTempProduct({ id: 'prod-temp-currency-in-use', currencyId: 'cur-usd' })
      PRODUCTS_STORE.push(product)
      try {
        return mockDeleteCurrency('cur-usd')
      } finally {
        const idx = PRODUCTS_STORE.indexOf(product)
        if (idx !== -1) PRODUCTS_STORE.splice(idx, 1)
      }
    },
  ],
  ['uomNotFound', () => mockUpdateUom(MISSING, {})],
  ['uomNotFound', () => mockDeleteUom(MISSING)],
  // uom-t сида: warehouseUomId как минимум одного товара — использование настоящими данными,
  // без временных сидов.
  ['uomInUse', () => mockDeleteUom('uom-t')],
  [
    'conversionPairTaken',
    () =>
      mockCreateConversion({ fromUomId: 'uom-t', toUomId: 'uom-kg', type: 'static', factor: 1000 }),
  ],
  ['conversionNotFound', () => mockUpdateConversion(MISSING, {})],
  ['conversionNotFound', () => mockDeleteConversion(MISSING)],
  ['orderStatusNotFound', () => mockUpdateOrderStatus(MISSING, {})],
  ['orderStatusNotFound', () => mockDeleteOrderStatus(MISSING)],
  ['orderStatusSystemForbidden', () => mockDeleteOrderStatus(systemStatus!.id)],
  ['mailNotConfigured', () => mockSendMailTest()],
  ['warehouseMapNotAnImage', () => mockSaveWarehouseMap(NOT_AN_IMAGE)],
  ['wrongCurrent', changePasswordWrongCurrent],
  ['tooShort', changePasswordTooShort],
  ['confirmMismatch', changePasswordConfirmMismatch],
]

describe('дубль пары единиц', () => {
  it('второй раз ту же пару мок отвергает кодом из мока', async () => {
    const pair: Omit<UomConversion, 'id'> = {
      fromUomId: 'uom-kg',
      toUomId: 'uom-t',
      type: 'static',
      factor: 0.001,
    }
    mockCreateConversion(pair) // первая пара — законна

    const e = await refusalOf(() => mockCreateConversion(pair))

    const code = SETTINGS_REFUSAL_CODES.conversionPairTaken
    expect(e.code).toBe(code)
    expect(errorCode(e)).toBe(code)
    expect(e.status).toBe(409)
  })
})

describe('валюта по умолчанию, используемая товаром — порядок проверок', () => {
  it('отказывает кодом про умолчание, а не про использование', async () => {
    // cur-eur сида — валюта по умолчанию, и currencyId каждого сидового товара указывает
    // на неё же: обе причины отказа верны одновременно, а порядок мока обязан совпадать с
    // сервером (§2, П44) — сначала умолчание. Если бы мок считал использование раньше,
    // код здесь оказался бы CURRENCY_IN_USE.
    const e = await refusalOf(() => mockDeleteCurrency('cur-eur'))
    expect(e.code).toBe(SETTINGS_REFUSAL_CODES.currencyIsDefault)
    expect(e.code).not.toBe(SETTINGS_REFUSAL_CODES.currencyInUse)
    expect(e.status).toBe(409)
  })
})

describe('справочники без ссылок товаров — удаление проходит', () => {
  it('валюта, на которую не ссылается ни один товар, удаляется без отказа', () => {
    expect(() => mockDeleteCurrency(UNUSED_CURRENCY_ID)).not.toThrow()
  })

  it('единица, на которую не ссылается ни один товар, удаляется без отказа', () => {
    expect(() => mockDeleteUom(UNUSED_UOM_ID)).not.toThrow()
  })

  it('единица, стоящая только в правиле пересчёта, использованием товаром не считается', () => {
    // conv-m-mm держит uom-mm как toUomId, а ни один товар на неё не ссылается ни одним из
    // трёх полей единиц. Определение «используется» ограничено товарами (задача) —
    // правило пересчёта отказом не становится.
    expect(() => mockDeleteUom(CONVERSION_ONLY_UOM_ID)).not.toThrow()
  })
})

describe('справочник, на который ссылается товар — удаление отказывает', () => {
  // Без этих двух проверок второй критерий задачи держался на одном мета-тесте о
  // достижимости кодов, а он краснеет и от недостижимого кода, и от сломанного
  // поведения одинаково — то есть не отличает их (питфолл #68). Замер: со снятым
  // перебором товаров в mockDeleteUom краснел только мета-тест.
  it('единица, стоящая у товара складской, не удаляется — UOM_IN_USE', async () => {
    // uom-kg стоит warehouseUomId у тринадцати сидовых товаров.
    const e = await refusalOf(() => mockDeleteUom('uom-kg'))
    expect(e.code).toBe(SETTINGS_REFUSAL_CODES.uomInUse)
    expect(e.status).toBe(409)
  })

  it('валюта, не являющаяся умолчанием, но стоящая у товара, не удаляется — CURRENCY_IN_USE', async () => {
    // Сидом все товары стоят на валюте по умолчанию, поэтому отказ про использование
    // в чистом виде недостижим: переключаем один товар публичным вызовом мока.
    const before = (await mockGetProduct('prod-001')).currencyId
    await mockPatchProduct('prod-001', { currencyId: 'cur-usd' })
    try {
      const e = await refusalOf(() => mockDeleteCurrency('cur-usd'))
      expect(e.code).toBe(SETTINGS_REFUSAL_CODES.currencyInUse)
      expect(e.status).toBe(409)
    } finally {
      await mockPatchProduct('prod-001', { currencyId: before })
    }
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
      expect(errorCode(stale)).toBe(MOCK_PASSWORD_CODES.wrongCurrent)
    } finally {
      // Состояние мока — на весь файл: вернуть демо-пароль на место.
      await postMock(CHANGE_PASSWORD, {
        currentPassword: SWITCHED_PASSWORD,
        newPassword: CURRENT_PASSWORD,
        confirmPassword: CURRENT_PASSWORD,
      })
    }
  })

  it('неверный текущий пароль отвергается кодом из мока', async () => {
    const e = await refusalOf(changePasswordWrongCurrent)

    expect(e.code).toBe(MOCK_PASSWORD_CODES.wrongCurrent)
    expect(errorCode(e)).toBe(MOCK_PASSWORD_CODES.wrongCurrent)
  })

  it('короткий новый пароль отвергается кодом из мока', async () => {
    const e = await refusalOf(changePasswordTooShort)

    expect(e.code).toBe(MOCK_PASSWORD_CODES.tooShort)
    expect(errorCode(e)).toBe(MOCK_PASSWORD_CODES.tooShort)
  })

  it('несовпадающее подтверждение отвергается кодом из мока', async () => {
    const e = await refusalOf(changePasswordConfirmMismatch)

    expect(e.code).toBe(MOCK_PASSWORD_CODES.confirmMismatch)
    expect(errorCode(e)).toBe(MOCK_PASSWORD_CODES.confirmMismatch)
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
  it('перечень отказов выведен из мока: каждый код достижим, лишних драйверов нет', async () => {
    expect(systemStatus).toBeDefined()

    // F-1: множество ключей СВЕРЯЕТСЯ с таблицей мока, а не переписывается здесь.
    // Новый отказ в таблице (без драйвера) делает это утверждение ложным — и проба
    // краснеет САМА, без правки спека. Это доказывает мутация M34.
    const covered = [...new Set(DRIVERS.map(([key]) => key))].sort()
    expect(covered).toEqual(Object.keys(DECLARED_CODES).sort())

    // F-3: имя на проводе санкционировано контрактом, а не выведено из самого мока.
    // Без этой сверки переименование кода в моке прошло бы незамеченным: ожидание и
    // бросок берутся из одной таблицы, и дрейфа между копиями больше нет — но дрейф
    // с контрактом был бы. Сообщение несёт сам код: мутация M35 опознаётся по нему.
    const sanctioned = sanctionedCodes()
    for (const code of Object.values(DECLARED_CODES)) {
      expect(sanctioned.has(code), `код ${code} не санкционирован контрактом`).toBe(true)
    }

    // Почта доводится до недонастроенной: иначе MAIL_NOT_CONFIGURED недостижим.
    mockPatchMail({ host: '' })
    try {
      for (const [key, run] of DRIVERS) {
        const e = await refusalOf(run)
        expect(e.code).toBeTruthy() // код лежит В ПОЛЕ, а не откатом из текста
        expect(errorCode(e)).toBe(DECLARED_CODES[key])
      }
    } finally {
      mockPatchMail({ host: SMTP_HOST })
    }
  })
})
