/**
 * authToken — единственный источник правила «где лежит токен и как он едет на сервер».
 *
 * Модуль отдельный, а не часть `useAuth.ts`, по одной причине: `useAuth.ts` импортирует
 * `apiPost` из `services/api.ts`, и если `api.ts` начнёт импортировать `useAuth.ts` —
 * получится циклический импорт. Здесь нет ни реактивности, ни vue: чистые функции над
 * хранилищем, пригодные и для композабла, и для сборки запроса.
 *
 * Токен лежит в `localStorage` при «запомнить меня» и в `sessionStorage`, когда галочки не
 * было. Читать надо **оба**: копии, читавшие только `localStorage`, давали 401 всем, кто
 * вошёл без галочки.
 */

export const TOKEN_KEY = 'auth_token'
export const CSRF_KEY = 'csrf_token'

/** Токен сессии из любого из двух хранилищ. */
export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY) ?? null
}

/** CSRF-токен из любого из двух хранилищ. */
export function getStoredCsrf(): string | null {
  return localStorage.getItem(CSRF_KEY) ?? sessionStorage.getItem(CSRF_KEY) ?? null
}

/**
 * Заголовки авторизации для запроса. `undefined`, когда токена нет вовсе — тогда запрос
 * уходит без заголовков, как это и должно быть у публичных роутов (вход, регистрация).
 */
export function authHeaders(): Record<string, string> | undefined {
  const token = getStoredToken()
  if (!token) return undefined
  return {
    Authorization: `Bearer ${token}`,
    'X-CSRF-Token': getStoredCsrf() ?? '',
  }
}
