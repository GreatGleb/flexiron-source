/**
 * У каждого утверждения после голого `page.goto(...)` есть бюджет ожидания.
 *
 * Дефолтный потолок `expect` — пять секунд, и вместе с нагрузкой он не растягивается:
 * растягивается только потолок самого теста (90 с в `playwright.config.ts`). Между
 * `page.goto(...)` и утверждением о странице нет ни ожидалки готовности
 * (`waitForDataReady`, `openAdminPage`, `openAdminCard`, `navigateToAdmin`), ни пола
 * вообще: данные приходят ПОСЛЕ перехода, и утверждение, стоящее сразу за ним, сдаётся
 * раньше, чем страница успела отрисоваться (питфолл #70).
 *
 * Класс узкий и назван точно: бюджет `{ timeout: DATA_READY_TIMEOUT }` берёт ПЕРВОЕ
 * утверждение о странице или локаторе после КАЖДОГО `page.goto(...)` — если между ними
 * нет ожидалки готовности. Второе и последующие утверждения того же теста бюджета не
 * получают: первое уже сработало полом. Поэтому разбор идёт от позиции `page.goto(` к
 * ближайшему `await expect` после неё. `expect.poll(...)` из разбора исключён: у него
 * свой предмет и свои опции, и приписать его сюда значило бы потребовать второй бюджет
 * поверх первого.
 *
 * `toHaveURL` в этих файлах уже закрыт отдельными задачами; здесь — прочие утверждения:
 * `toBeVisible`, `toHaveText`, `toHaveCount`, `not.toHaveValue` и подобные.
 *
 * Число живёт в `DATA_READY_TIMEOUT` (`tests/e2e/helpers/ready.ts`) и берётся импортом:
 * копия числа разошлась бы с оригиналом молча.
 */

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..', '..')

/** Ровно свои файлы: три спека этой задачи. */
const SPECS = [
  'tests/e2e/navigation.spec.ts',
  'tests/e2e/feature-flags-matrix.spec.ts',
  'tests/e2e/admin/settings/settings.spec.ts',
]

/**
 * Сколько бюджетов несёт каждый файл. Числа — факт замера 2026-09-28, сразу после
 * правки. Живут здесь затем, чтобы снятие хотя бы одного `{ timeout: DATA_READY_TIMEOUT }`
 * было видно счётом, а не только глазами: потеря одного бюджета возвращает утверждение
 * к дефолтным пяти секундам (питфолл #70).
 */
const BUDGETS_FLOOR: Record<string, number> = {
  'tests/e2e/navigation.spec.ts': 14,
  'tests/e2e/feature-flags-matrix.spec.ts': 19,
  'tests/e2e/admin/settings/settings.spec.ts': 34,
}

/** Голый переход — без ожидалки готовности он сам полом не является. */
const GOTO = 'await page.goto('

/** Ожидалки готовности: у них пол уже есть, и бюджета они не требуют. */
const READY = /waitForDataReady|openAdminPage|openAdminCard|navigateToAdmin/

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

/** Вызов целиком: `await expect(...)` и вся цепочка дальше — `.not.`, `.toBeVisible(...)`. */
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

interface Mapped {
  /** Номер строки, на которой стоит утверждение. */
  line: number
  /** Вызов целиком, вместе с переносами: по нему видно, есть ли опция. */
  text: string
  /** Есть ли между переходом и утверждением ожидалка готовности. */
  ready: boolean
}

function afterGoto(rel: string): Mapped[] {
  const token = readFileSync(join(ROOT, rel), 'utf8')
  const assertions: { at: number; line: number; text: string }[] = []
  for (let at = token.indexOf(CALL); at !== -1; at = token.indexOf(CALL, at + 1)) {
    if (!OPENS.test(token.slice(at + CALL.length))) continue
    const text = call(token, at)
    if (POLL.test(text)) continue
    assertions.push({ at, line: token.slice(0, at).split('\n').length, text })
  }

  const found: Mapped[] = []
  for (let g = token.indexOf(GOTO); g !== -1; g = token.indexOf(GOTO, g + 1)) {
    const next = assertions.find((a) => a.at > g)
    if (!next) continue
    found.push({
      line: next.line,
      text: next.text,
      ready: READY.test(token.slice(g, next.at)),
    })
  }
  return found
}

const each = SPECS.map((rel) => ({ rel, found: afterGoto(rel) }))

/** Утверждения после перехода, которым бюджет положен: ожидалки между ними нет. */
const needBudget = each.flatMap(({ rel, found }) =>
  found.filter((a) => !a.ready).map((a) => ({ rel, ...a })),
)

/** Сколько раз в файле стоит бюджет `timeout: DATA_READY_TIMEOUT`. */
function budgetCount(rel: string): number {
  return (readFileSync(join(ROOT, rel), 'utf8').match(/timeout:\s*DATA_READY_TIMEOUT/g) ?? [])
    .length
}

describe('бюджет ожидания у утверждений после голого page.goto', () => {
  it('разбор читает все три спека и находит утверждения после перехода', () => {
    expect(each).toHaveLength(3)
    // Пустой разбор выглядел бы как чистота: ноль утверждений — ноль нарушителей.
    for (const { rel, found } of each) {
      expect(found.length, `${rel}: разбор пуст`).toBeGreaterThanOrEqual(10)
    }
  })

  it('класс «сразу после перехода» не пуст — иначе правило не проверялось бы', () => {
    expect(needBudget.length).toBeGreaterThanOrEqual(30)
  })

  it('каждое утверждение после перехода без ожидалки несёт опцию ожидания', () => {
    // Нарушители — файлом и номером строки, чтобы в отчёте было видно, кого чинить.
    const offenders = needBudget
      .filter((a) => !a.text.includes('timeout:'))
      .map((a) => `${a.rel}:${a.line}`)
    expect(offenders).toEqual([])
  })

  it('опция взята из DATA_READY_TIMEOUT, а не записана числом', () => {
    const offenders = needBudget
      .filter((a) => /timeout:\s*\d/.test(a.text))
      .map((a) => `${a.rel}:${a.line}`)
    expect(offenders).toEqual([])
  })

  it('числового потолка в этих спеках не осталось', () => {
    const offenders = each.flatMap(({ rel, found }) =>
      found.filter((a) => /timeout:\s*\d/.test(a.text)).map((a) => `${rel}:${a.line}`),
    )
    expect(offenders).toEqual([])
  })

  it('DATA_READY_TIMEOUT приходит импортом из помощника ready', () => {
    for (const rel of SPECS) {
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
