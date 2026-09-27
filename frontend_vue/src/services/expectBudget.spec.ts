/**
 * У каждого утверждения, идущего ПОСЛЕ действия на странице, есть бюджет ожидания.
 *
 * Дефолтный потолок `expect` — пять секунд, и вместе с нагрузкой он не растягивается:
 * растягивается только потолок самого теста (90 с в `playwright.config.ts`). Пока
 * ожидание уходило по часам, разницы не было видно; стало честным — и утверждение,
 * стоящее сразу после клика или заполнения поля, сдаётся раньше, чем страница успеет
 * перерисоваться (питфолл #70).
 *
 * Бюджет берут утверждения ПОСЛЕ действия. У тех, что стоят сразу за `openAdminPage`,
 * `openAdminCard` или `waitForDataReady`, пол уже есть — им бюджет не нужен, и это не
 * забывчивость: поднимать потолок там, где пол есть, цикл проверок прямо запрещает,
 * а глобальный `expect.timeout` в конфиге задел бы ещё и `toBeVisible`.
 *
 * Число живёт в `DATA_READY_TIMEOUT` (`tests/e2e/helpers/ready.ts`) и берётся импортом:
 * копия числа разошлась бы с оригиналом молча. Это и сторожится — на трёх спеках
 * каталога товаров, потому что сторож зовут по каталогу: общий на весь `tests/e2e`
 * краснел бы на файлах чужих задач, а имена файлов задач этой порции не пересекаются.
 */

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..', '..')

/** Ровно свои файлы. */
const SPECS = [
  'tests/e2e/admin/products/products.spec.ts',
  'tests/e2e/admin/products/services.spec.ts',
  'tests/e2e/admin/products/service-card.spec.ts',
]

/** Нарушители — файлом и номером строки, чтобы в отчёте было видно, кого чинить. */
function offences(pattern: RegExp): string[] {
  const found: string[] = []
  for (const rel of SPECS) {
    readFileSync(join(ROOT, rel), 'utf8')
      .split('\n')
      .forEach((line, index) => {
        if (pattern.test(line)) found.push(`${rel}:${index + 1}`)
      })
  }
  return found
}

describe('бюджет ожидания у утверждений каталога товаров', () => {
  const files = SPECS.map((rel) => ({ rel, text: readFileSync(join(ROOT, rel), 'utf8') }))

  it('разбор читает все три спека и находит в них сами утверждения', () => {
    expect(files).toHaveLength(3)
    const calls = files.reduce(
      (total, { text }) => total + (text.match(/await expect\(/g) ?? []).length,
      0,
    )
    // Пустой разбор выглядел бы как чистота: ноль утверждений — ноль нарушителей.
    expect(calls).toBeGreaterThan(50)
  })

  it('числового потолка в этих спеках не осталось', () => {
    // `timeout: 5000` и любое другое число — тот же бюджет, записанный копией:
    // разошёлся бы с `DATA_READY_TIMEOUT` молча.
    expect(offences(/timeout:\s*\d/)).toEqual([])
  })

  it('бюджет взят импортом из помощника ready, а не вторым экземпляром числа', () => {
    for (const { rel, text } of files) {
      expect(text, `${rel}: нет импорта DATA_READY_TIMEOUT`).toMatch(
        /import\s*\{[^}]*DATA_READY_TIMEOUT[^}]*\}\s*from\s*'[^']*helpers\/ready'/,
      )
    }
  })
})
