/**
 * У каждого утверждения, идущего ПОСЛЕ действия на странице, есть бюджет ожидания.
 *
 * Дефолтный потолок `expect` — пять секунд, и вместе с нагрузкой он не растягивается:
 * растягивается только потолок самого теста (90 с в `playwright.config.ts`). Утверждение,
 * стоящее сразу после клика, заполнения поля или возврата назад, сдаётся раньше, чем
 * страница успеет перерисоваться (питфолл #70).
 *
 * Класс здесь тот же, что у сторожей склада и поставщиков, но разбор шире и потому
 * честнее постановке: у поставщиков «после действия» определялось по ОДНОЙ строке выше
 * утверждения, и цепочка `from.fill(...) → expect(line) → expect(line).not.toContainText(...)`
 * из `followups-list1.spec.ts` через него не ловилась вовсе — второе утверждение стоит
 * за первым, а не за действием. Здесь состояние ведётся ПО ТЕСТУ: последнее действие
 * запоминается и переносится на все следующие утверждения, пока его не снимет открывалка
 * (`openAdminPage`, `openAdminCard`, `waitForDataReady`, `switchLanguage`) или начало
 * нового теста. Именно поэтому образец пришлось расширить, а не скопировать.
 *
 * `page.goto` действием НЕ считается — постановка перечисляет действия явно
 * (`click`, `fill`, `press`, `selectOption`, `check`, `goBack`, `reload`), а навигация
 * берётся полом уровнем ниже. `expect.poll` из разбора исключён: у него свой предмет
 * и свои опции, и приписать его сюда значило бы требовать второй бюджет поверх первого
 * (его стережёт `expectPollBudget.spec.ts`).
 *
 * Число живёт в `DATA_READY_TIMEOUT` (`tests/e2e/helpers/ready.ts`) и берётся импортом:
 * копия числа разошлась бы с оригиналом молча.
 */

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..', '..')

/** Ровно свои файлы: пять спеков, которых не покрывает ни один другой сторож. */
const SPECS = [
  'tests/e2e/admin/notifications/notifications.spec.ts',
  'tests/e2e/admin/sales-crm/sales-crm.spec.ts',
  'tests/e2e/admin/followups-list1.spec.ts',
  'tests/e2e/admin/orders/order-offcuts.spec.ts',
  'tests/e2e/admin/products/categories.spec.ts',
]

/** Действие по постановке задачи: после него состояние меняется, и утверждение ждёт перерисовки. */
const ACTION = /\.click\(|\.fill\(|\.press\(|\.selectOption\(|\.check\(|\.goBack\(|\.reload\(/

/**
 * Пол уже есть — открывалка ждёт данные сама, и второго бюджета поверх неё не надо.
 *
 * Две последние строки — локальные обёртки каталога категорий: они внутри зовут
 * `openAdminPage` / `openAdminCard`, но вызов `await openCategoriesList(page)`
 * по имени их не виден, и без этих двух строк состояние не сбрасывалось бы.
 */
const OPENER =
  /waitForDataReady\(|openAdminPage\(|openAdminCard\(|openCategoriesList\(|openCategoryCard\(|navigateToAdmin\(|switchLanguage\(|stabilizeForSnapshot\(/

const TEST_START = /^\s*(test|testWithFlags|baseTest|base|testBare)\s*(\.\w+)?\(/

const CALL = 'await expect'
const POLL = /^await expect[ \t\r\n]*\.poll\(/
/** `expect(` или `expect.soft(` — оба утверждения, обоим нужен один и тот же бюджет. */
const OPENS = /^[ \t\r\n]*\(|^[ \t\r\n]*\.soft[ \t\r\n]*\(/

/** Позиция закрывающей скобки для открывающей на позиции `at`. */
function closing(token: string, at: number): number {
  let depth = 0
  for (let i = at; i < token.length; i++) {
    if (token[i] === '(') depth += 1
    else if (token[i] === ')' && --depth === 0) return i
  }
  return token.length - 1
}

/** Вызов целиком: `await expect(...)` и вся цепочка дальше — `.not.`, `.toHaveText(...)`. */
function call(token: string, at: number): string {
  let end = closing(token, token.indexOf('(', at))
  for (;;) {
    const member = /^[ \t\r\n]*\.[ \t\r\n]*[$A-Za-z_][\w$]*/.exec(token.slice(end + 1))
    if (!member) return token.slice(at, end + 1)
    const after = end + 1 + member[0].length
    let next = after
    while (next < token.length && /\s/.test(token[next] ?? '')) next += 1
    end = token[next] === '(' ? closing(token, next) : after - 1
  }
}

interface Assertion {
  /** Номер строки, на которой стоит `await expect`. */
  line: number
  /** Вызов целиком, вместе с переносами: по нему видно, есть ли опция. */
  text: string
  /** Строка последнего ДЕЙСТВИЯ до этого утверждения; `null` — действия не было. */
  action: number | null
}

function assertions(rel: string): Assertion[] {
  const lines = readFileSync(join(ROOT, rel), 'utf8').split('\n')
  const token = lines.join('\n')

  // Состояние «тест уже что-то сделал» — по строкам. Начало теста и открывалка его снимают,
  // действие ставит. Снимок нужен до разбора утверждений: строка утверждения может стоять
  // далеко от действия, а правило говорит «в том же тесте», не «в двух строках выше».
  const state: (number | null)[] = []
  let current: number | null = null
  for (let i = 0; i < lines.length; i++) {
    if (TEST_START.test(lines[i]!)) current = null
    if (OPENER.test(lines[i]!)) current = null
    if (ACTION.test(lines[i]!)) current = i + 1
    state[i] = current
  }

  const found: Assertion[] = []
  for (let at = token.indexOf(CALL); at !== -1; at = token.indexOf(CALL, at + 1)) {
    if (!OPENS.test(token.slice(at + CALL.length))) continue
    const text = call(token, at)
    if (POLL.test(text)) continue
    const line = token.slice(0, at).split('\n').length
    found.push({ line, text, action: state[line - 2] ?? null })
  }
  return found
}

const each = SPECS.map((rel) => ({ rel, found: assertions(rel) }))

/** Утверждения, стоящие в тесте после действия на странице. */
const afterAction = each.flatMap(({ rel, found }) =>
  found.filter((a) => a.action !== null).map((a) => ({ rel, ...a })),
)

/**
 * Замеренный пол числа утверждений ПОСЛЕ действия в каждом файле — снят разбором
 * 2026-09-28, на момент сдачи задачи. Это храповик, а не цель: файл, в котором
 * утверждений после действия стало меньше замеренного, назван ниже.
 *
 * Числа не «на всякий случай ниже»: они равны факту, и падение ниже — находка.
 */
const FLOOR: Record<string, number> = {
  'tests/e2e/admin/notifications/notifications.spec.ts': 10,
  'tests/e2e/admin/sales-crm/sales-crm.spec.ts': 2,
  'tests/e2e/admin/followups-list1.spec.ts': 29,
  'tests/e2e/admin/orders/order-offcuts.spec.ts': 11,
  'tests/e2e/admin/products/categories.spec.ts': 34,
}

describe('бюджет ожидания у утверждений после действия', () => {
  it('разбор читает все пять спеков и находит в них утверждения', () => {
    expect(each).toHaveLength(5)
    const calls = each.reduce((total, { found }) => total + found.length, 0)
    // Пустой разбор выглядел бы как чистота: ноль утверждений — ноль нарушителей.
    expect(calls).toBeGreaterThan(120)
  })

  it('класс «после действия» не пуст — иначе правило не проверялось бы', () => {
    expect(afterAction.length).toBeGreaterThanOrEqual(80)
  })

  it('каждое утверждение после действия несёт опцию ожидания', () => {
    // Нарушители — файлом и номером строки, чтобы в отчёте было видно, кого чинить.
    const offenders = afterAction
      .filter((a) => !a.text.includes('timeout:'))
      .map((a) => `${a.rel}:${a.line}`)
    expect(offenders).toEqual([])
  })

  it('опция взята из DATA_READY_TIMEOUT, а не записана числом', () => {
    const offenders = afterAction
      .filter((a) => /timeout:\s*\d/.test(a.text))
      .map((a) => `${a.rel}:${a.line}`)
    expect(offenders).toEqual([])
  })

  it('пол числа утверждений после действия в каждом файле держится', () => {
    const offenders = each
      .filter(({ rel, found }) => found.filter((a) => a.action !== null).length < FLOOR[rel]!)
      .map(({ rel }) => rel)
    expect(offenders).toEqual([])
  })

  it('DATA_READY_TIMEOUT приходит импортом из помощника ready', () => {
    for (const { rel } of each) {
      const source = readFileSync(join(ROOT, rel), 'utf8')
      expect(source, `${rel}: нет импорта DATA_READY_TIMEOUT`).toMatch(
        /import[^\n]*\bDATA_READY_TIMEOUT\b[^\n]*from[^\n]*helpers\/ready/,
      )
    }
  })

  it('числового потолка в этих спеках не осталось', () => {
    // `timeout: 5000` и любое другое число — тот же бюджет, записанный копией: разошёлся бы
    // с `DATA_READY_TIMEOUT` молча. Опции `expect.poll` сюда не входят: он из разбора
    // исключён, и его отдельный предмет — `expectPollBudget.spec.ts`.
    const offenders = each.flatMap(({ rel, found }) =>
      found.filter((a) => /timeout:\s*\d/.test(a.text)).map((a) => `${rel}:${a.line}`),
    )
    expect(offenders).toEqual([])
  })
})
