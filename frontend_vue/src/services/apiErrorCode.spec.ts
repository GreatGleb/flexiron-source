import { describe, it, expect } from 'vitest'
import { ApiRequestError } from '@/types/api'
import { errorCode, errorMessageKey } from './apiErrorCode'

/**
 * Проверяется ровно то, из-за чего заведён класс: настоящий сервер кладёт машинный код в
 * поле, а человеческую фразу — в текст, и до 2026-09-11 весь фронт читал текст.
 *
 * Форма «как у сервера» здесь строится руками, а не берётся из мока, — и это не обход:
 * мок бросает голый `Error` во всех 210 местах, то есть серверной формы в мок-режиме
 * не существует вовсе (`api.ts:179-182` — `unwrap()` до `fetch` не доходит). Тест,
 * который берёт форму из мока, проверял бы только мок.
 */
describe('errorCode', () => {
  it('берёт код из поля, а человеческий текст сервера игнорирует', () => {
    const fromServer = new ApiRequestError({
      status: 409,
      message: 'Нельзя удалить: в категории есть товары',
      code: 'CATEGORY_HAS_PRODUCTS',
    })
    expect(errorCode(fromServer)).toBe('CATEGORY_HAS_PRODUCTS')
  })

  it('откатывается на текст, пока мок бросает голый Error', () => {
    expect(errorCode(new Error('CATEGORY_HAS_PRODUCTS'))).toBe('CATEGORY_HAS_PRODUCTS')
  })

  it('откатывается на текст и у ApiRequestError без кода — сервер вправе его не прислать', () => {
    const noCode = new ApiRequestError({ status: 500, message: 'Request failed (500)' })
    expect(noCode.code).toBeNull()
    expect(errorCode(noCode)).toBe('Request failed (500)')
  })

  it('не падает на том, что вообще не Error', () => {
    expect(errorCode('CONFLICT')).toBe('CONFLICT')
    expect(errorCode(null)).toBe('null')
  })

  it('отрезает подробность от кода, когда мок кладёт код внутрь текста', () => {
    // Ровно та форма, из-за которой три места сравнивали подстрокой: `mocks/clients.ts:1133`
    // и одиннадцать похожих на 113 форм мока.
    expect(errorCode(new Error('CONFLICT: client has orders'))).toBe('CONFLICT')
    expect(errorCode(new Error('UNKNOWN_SORT_KEY: createdAt'))).toBe('UNKNOWN_SORT_KEY')
    expect(errorCode(new Error('INVALID_PAGE: page=0'))).toBe('INVALID_PAGE')
  })

  it('человеческую фразу не режет — резать в ней нечего', () => {
    // Отрезание срабатывает только на коде в НАЧАЛЕ и только через двоеточие. Фраза,
    // начинающаяся заглавным словом, кодом не становится: иначе `VALIDATION failed here`
    // превратилось бы в код `VALIDATION`, которого никто не бросал.
    expect(errorCode(new Error('Request failed (500)'))).toBe('Request failed (500)')
    expect(errorCode(new Error('Not authenticated'))).toBe('Not authenticated')
    expect(errorCode(new Error('VALIDATION failed here'))).toBe('VALIDATION failed here')
    expect(errorCode(new Error('[mock] GET /clients not found'))).toBe(
      '[mock] GET /clients not found',
    )
  })
})

describe('errorMessageKey', () => {
  const KEYS = [
    ['CATEGORY_HAS_PRODUCTS', 'categories.toast_error_delete_has_products'],
    ['CATEGORY_HAS_CHILDREN', 'categories.toast_error_delete_has_children'],
  ] as const

  it('находит ключ по коду из поля — то есть против настоящего сервера', () => {
    const fromServer = new ApiRequestError({
      status: 409,
      message: 'Категория не пуста',
      code: 'CATEGORY_HAS_CHILDREN',
    })
    expect(errorMessageKey(fromServer, KEYS, 'categories.toast_error')).toBe(
      'categories.toast_error_delete_has_children',
    )
  })

  it('находит ключ по коду внутри текста — то есть под моком', () => {
    expect(
      errorMessageKey(new Error('CONFLICT: client has orders'), [['CONFLICT', 'x']], 'fb'),
    ).toBe('x')
  })

  it('вложенный код не перехватывает длинный, в каком бы порядке ни стояла таблица', () => {
    // До 2026-09-12 сопоставление шло подстрокой, и этот порядок строк давал 'short':
    // правильность держалась ручной дисциплиной «код, содержащийся в другом, идёт вторым».
    // Вложенность среди настоящих кодов не гипотетическая — 51 пара, находка заведена
    // в баг-файл соглашений; `BATCH_NOT_FOUND` ⊂ `RETURN_BATCH_NOT_FOUND` — одна из них.
    const NESTED = [
      ['BATCH_NOT_FOUND', 'short'],
      ['RETURN_BATCH_NOT_FOUND', 'long'],
    ] as const
    expect(errorMessageKey(new Error('RETURN_BATCH_NOT_FOUND'), NESTED, 'fb')).toBe('long')
    expect(errorMessageKey(new Error('BATCH_NOT_FOUND'), NESTED, 'fb')).toBe('short')
    const fromServer = new ApiRequestError({
      status: 404,
      message: 'Партия возврата не найдена',
      code: 'RETURN_BATCH_NOT_FOUND',
    })
    expect(errorMessageKey(fromServer, NESTED, 'fb')).toBe('long')
  })

  it('возвращает запасной ключ, когда код не из таблицы', () => {
    const unmapped = new ApiRequestError({
      status: 500,
      message: 'Внутренняя ошибка',
      code: 'SOMETHING_NOBODY_MAPPED',
    })
    expect(errorMessageKey(unmapped, KEYS, 'categories.toast_error')).toBe('categories.toast_error')
  })

  it('человеческий текст сервера не подменяет собой код', () => {
    // Фраза содержит слово из таблицы, а код у отказа другой. Читать текст — значит
    // показать чужое сообщение; читать поле — показать своё.
    const misleading = new ApiRequestError({
      status: 409,
      message: 'CATEGORY_HAS_PRODUCTS упоминается в тексте сервера',
      code: 'CATEGORY_HAS_CHILDREN',
    })
    expect(errorMessageKey(misleading, KEYS, 'categories.toast_error')).toBe(
      'categories.toast_error_delete_has_children',
    )
  })
})
