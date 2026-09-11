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
