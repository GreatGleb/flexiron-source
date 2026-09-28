/**
 * У каждого утверждения, идущего ПОСЛЕ действия на странице, есть бюджет ожидания.
 *
 * Дефолтный потолок `expect` — пять секунд, и вместе с нагрузкой он не растягивается:
 * растягивается только потолок самого теста (90 с в `playwright.config.ts`). Пока ожидание
 * уходило по часам, разницы не было видно; стало честным — и утверждение, стоящее сразу
 * после клика, заполнения поля или перехода, сдаётся раньше, чем страница успеет
 * перерисоваться (питфолл #70).
 *
 * Класс здесь узкий и назван точно: утверждение, стоящее НЕПОСРЕДСТВЕННО после действия и не
 * отделённое от него открывалкой (`openAdminPage`, `openAdminCard`, `waitForDataReady`,
 * `navigateToAdmin`) — у тех пол уже есть, и бюджета они не требуют. Поэтому разбор идёт по
 * двум строкам сразу: сначала собирается вызов целиком (переносы строк и цепочка `.not.` в этом
 * каталоге — обычное дело), затем ищется ближайшая строка выше, которая не пуста и не
 * комментарий.
 *
 * `expect.poll(...)` из разбора исключён: у него свой предмет и свои опции, и приписать его
 * сюда значило бы потребовать второй бюджет поверх первого.
 *
 * Класс `toHaveURL` в этих файлах уже закрыт отдельными задачами — 103 из 103 вызовов в наборе
 * берут бюджет, и стережёт их `expectUrlBudget.spec.ts`. Здесь — прочие утверждения: те, что
 * несут `toBeVisible`, `toHaveCount`, `toHaveClass`, `toBeEnabled` и прочее.
 *
 * Число живёт в `DATA_READY_TIMEOUT` (`tests/e2e/helpers/ready.ts`) и берётся импортом: копия
 * числа разошлась бы с оригиналом молча.
 */

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..', '..')

/** Ровно свои файлы: два спека этой задачи. */
const SPECS = ['tests/e2e/admin/clients/clients.spec.ts', 'tests/e2e/admin/layout.spec.ts']

/**
 * Сколько бюджетов несёт каждый файл. Числа — факт замера 2026-09-28, сразу после правки:
 * 50 в `clients.spec.ts` и 44 в `layout.spec.ts`. Живут здесь затем, чтобы снятие хотя бы
 * одного `{ timeout: DATA_READY_TIMEOUT }` было видно счётом, а не только глазами: потеря
 * одного бюджета возвращает утверждение к дефолтным пяти секундам (питфолл #70).
 */
const BUDGETS_FLOOR: Record<string, number> = {
  'tests/e2e/admin/clients/clients.spec.ts': 50,
  'tests/e2e/admin/layout.spec.ts': 44,
}

/** Действие на странице: после него состояние меняется, и утверждение ждёт перерисовки. */
const ACTION = /\.click\(|\.fill\(|\.press\(|\.selectOption\(|\.check\(|\.goBack\(|\.reload\(/

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
  /** Ближайшая строка выше — не пустая и не комментарий. */
  before: string
}

function assertions(rel: string): Assertion[] {
  const lines = readFileSync(join(ROOT, rel), 'utf8').split('\n')
  const token = lines.join('\n')
  const found: Assertion[] = []
  for (let at = token.indexOf(CALL); at !== -1; at = token.indexOf(CALL, at + 1)) {
    if (!OPENS.test(token.slice(at + CALL.length))) continue
    const text = call(token, at)
    if (POLL.test(text)) continue
    const line = token.slice(0, at).split('\n').length
    let up = line - 2
    while (up >= 0) {
      const raw = (lines[up] ?? '').trim()
      if (raw !== '' && !raw.startsWith('//') && !raw.startsWith('*') && !raw.startsWith('/*'))
        break
      up -= 1
    }
    found.push({ line, text, before: lines[up] ?? '' })
  }
  return found
}

const each = SPECS.map((rel) => ({ rel, found: assertions(rel) }))

/** Утверждения, стоящие непосредственно после действия на странице. */
const afterAction = each.flatMap(({ rel, found }) =>
  found.filter((a) => ACTION.test(a.before)).map((a) => ({ rel, ...a })),
)

/** Сколько раз в файле стоит бюджет `timeout: DATA_READY_TIMEOUT`. */
function budgetCount(rel: string): number {
  return (readFileSync(join(ROOT, rel), 'utf8').match(/timeout:\s*DATA_READY_TIMEOUT/g) ?? [])
    .length
}

describe('бюджет ожидания у утверждений клиентов и оболочки', () => {
  it('разбор читает оба спека и находит в них утверждения', () => {
    expect(each).toHaveLength(2)
    // Пустой разбор выглядел бы как чистота: ноль утверждений — ноль нарушителей.
    for (const { rel, found } of each) {
      expect(found.length, `${rel}: разбор пуст`).toBeGreaterThan(20)
    }
  })

  it('класс «сразу после действия» не пуст — иначе правило не проверялось бы', () => {
    expect(afterAction.length).toBeGreaterThanOrEqual(15)
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

  it('числового потолка в этих спеках не осталось', () => {
    // `timeout: 5000` и любое другое число — тот же бюджет, записанный копией: разошёлся бы
    // с `DATA_READY_TIMEOUT` молча. Опции `expect.poll` сюда не входят: он из разбора
    // исключён, и его отдельный предмет — отдельная задача.
    const offenders = each.flatMap(({ rel, found }) =>
      found.filter((a) => /timeout:\s*\d/.test(a.text)).map((a) => `${rel}:${a.line}`),
    )
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

  it('бюджеты не сняты — в каждом файле их не меньше замеренного числа', () => {
    for (const [rel, floor] of Object.entries(BUDGETS_FLOOR)) {
      expect(budgetCount(rel), `${rel}: бюджетов стало меньше замеренного`).toBeGreaterThanOrEqual(
        floor,
      )
    }
  })
})
