import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Сторож правила §2 «отказ несёт код, а не текст».
 *
 * Поведенческие тесты рядом (`apiErrorCode.spec.ts`, `orderLineEdits.spec.ts`,
 * `composables/apiErrorCode.consumers.spec.ts`) доказывают, что правило РАБОТАЕТ. Этот
 * доказывает, что его никто не обошёл — а обойти его дёшево: ровно так и появились семь
 * мест класса, каждое написанное отдельно и каждое зелёное под моками.
 *
 * Правило в машинной форме: **внутри обработчика ошибки сравнение с кодом отказа
 * разрешено только над тем, что спросили у `errorCode()`.**
 *
 * Область — тело `catch`, а не файл целиком, и это не оптимизация. Первая версия сторожа
 * искала литерал-код по всему файлу, и чтобы не ловить `r.method === 'UPLOAD'`
 * (`services/contractInventory.ts`), требовала в литерале подчёркивания. Ценой были две
 * дыры: `CONFLICT` в `useClients` — код **без** подчёркивания, и сторож не видел его
 * вовсе; а `services/api.ts` пришлось заносить в изъятия, хотя он сравнивает коды не в
 * обработчике, а разбирая тело ответа. Сужение до `catch` закрывает обе разом:
 * подчёркивание больше не нужно, изъятий не осталось ни одного. Список изъятий у сторожа —
 * первый признак того, что он перестал быть сторожем.
 *
 * Введён зелёным (правило «шаг гейта вводится только зелёным», `verify.md`): замер
 * 2026-09-11 — 81 обработчик, девять сравнивают с кодами, все девять спрашивают код у
 * источника, нарушителей ноль.
 */

const SRC = join(process.cwd(), 'src')

/** Начало обработчика: `catch (e) {` и промисный `.catch((e) => {`. */
const HANDLER_OPENS = /(?:\bcatch\s*\([^)]*\)\s*\{)|(?:\.catch\(\s*\([^)]*\)\s*=>\s*\{)/g

/** Сравнение с кодом отказа: `=== 'CONFLICT'`, `.includes('LINE_ON_INVOICE')`. */
const CODE_COMPARISON = /(===|!==|\.includes\()\s*'[A-Z][A-Z0-9_]{4,}'/

/** Спрашивание кода у единственного источника — прямое или через таблицу домена. */
const ASKS_FOR_CODE = /\b(errorCode|errorMessageKey)\s*\(/

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      // Моки — сторона сервера, а не клиента: они коды БРОСАЮТ. Их перевод на
      // `ApiRequestError` — отдельный класс находок, здесь ему не место.
      if (entry === 'mocks') continue
      out.push(...sourceFiles(full))
      continue
    }
    if (entry.endsWith('.spec.ts')) continue
    if (entry.endsWith('.ts') || entry.endsWith('.vue')) out.push(full)
  }
  return out
}

/** Тело обработчика от его `{` до парной `}` — вложенные блоки считаются. */
function handlerBodies(source: string): string[] {
  const bodies: string[] = []
  for (const open of source.matchAll(HANDLER_OPENS)) {
    const start = open.index + open[0].length - 1
    let depth = 0
    let end = start
    for (; end < source.length; end++) {
      if (source[end] === '{') depth++
      else if (source[end] === '}') {
        depth--
        if (depth === 0) break
      }
    }
    bodies.push(source.slice(start, end + 1))
  }
  return bodies
}

describe('код отказа читается из поля, а не из текста', () => {
  const offenders: string[] = []
  const guarded: string[] = []
  let handlers = 0

  for (const file of sourceFiles(SRC)) {
    const rel = relative(SRC, file).split('\\').join('/')
    for (const body of handlerBodies(readFileSync(file, 'utf8'))) {
      handlers++
      if (!CODE_COMPARISON.test(body)) continue
      const where = `${rel} :: ${CODE_COMPARISON.exec(body)?.[0] ?? ''}`
      if (ASKS_FOR_CODE.test(body)) guarded.push(where)
      else offenders.push(where)
    }
  }

  it('ни один обработчик не сравнивает с кодом то, что не спросил у errorCode()', () => {
    expect(offenders).toEqual([])
  })

  /**
   * Без этой проверки сторож молча выродится: сломается разбор тел или регулярка — и
   * пустой список нарушителей будет означать «ничего не проверено», а не «всё чисто».
   * Питфолл #66: утверждение об отсутствии доказывает что-то только там, где присутствие
   * было возможно.
   *
   * Пороги ниже факта (81 обработчик, 9 сравнений) намеренно: это проверка «разбор жив»,
   * а не храповик — обработчик, законно переставший сравнивать коды, не должен красить
   * прогон.
   */
  it('сторожу есть что сторожить — обработчики найдены и сравнения в них тоже', () => {
    expect(handlers).toBeGreaterThanOrEqual(50)
    expect(guarded.length).toBeGreaterThanOrEqual(7)
  })
})
