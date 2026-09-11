/**
 * Сторож правила §2 «отказ несёт код, а не текст» — разбор вынесен из спеки, чтобы его
 * можно было проверить на образцах, а не только на дереве проекта.
 *
 * **Проверяется операнд сравнения, а не тело обработчика.** Первые две версии сторожа
 * искали нарушение в теле `catch` — и скептик показал, что так он видит две формы
 * обработчика из девяти: мимо шли `.catch(async (e) => {`, `.catch(имя)`, стрелка без
 * тела, `catch` без привязки, `switch/case`. Хуже того, проверка «в теле есть
 * `errorCode(`» давала **иммунитет**: один любой вызов разрешал в том же теле любое
 * другое сравнение, то есть все девять охраняемых мест были открыты.
 *
 * Операнд формы обработчика не знает вовсе, поэтому дыра закрывается не заплаткой на
 * каждую форму, а сменой предмета проверки.
 */

/** Литерал кода отказа: `CONFLICT`, `ORDER_NOT_FOUND`. Подчёркивание не обязательно. */
const CODE = "'[A-Z][A-Z0-9_]{4,}'"

/** `<операнд> === 'CODE'` и `<операнд> !== 'CODE'`. */
const EQUALITY = new RegExp(`([\\w.$?![\\]()]+?)\\s*(?:===|!==)\\s*${CODE}`, 'g')

/** `<операнд>.includes('CODE')`. */
const INCLUDES = new RegExp(`([\\w.$?![\\]()]+?)\\.includes\\(\\s*${CODE}`, 'g')

/** `switch (<операнд>)` — нарушение засчитывается, только если внутри есть `case 'CODE'`. */
const SWITCH = /switch\s*\(([^)]+)\)\s*\{/g

/** Текст исключения: `e.message`, `err.message`, `String(e)`. */
const TEXT_OF_ERROR = /(\.message\s*$)|(^String\s*\()/

/** Объявление, забирающее текст исключения в переменную. */
const TEXT_BINDING = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^\n;]*)/g

export interface Offence {
  /** Операнд, который сравнили с кодом. */
  operand: string
  /** Литерал кода, с которым сравнивали. */
  code: string
}

/**
 * Имена переменных, в которые в этом исходнике положили текст исключения.
 * Двухшаговая форма — `const code = e.message` и следом `code === 'X'` — именно так
 * выглядели четыре из семи находок класса, и одношаговый греп её не видит.
 */
function textBoundNames(source: string): Set<string> {
  const names = new Set<string>()
  for (const decl of source.matchAll(TEXT_BINDING)) {
    const [, name, value] = decl
    if (!name || !value) continue
    if (/\.message\b/.test(value) || /\bString\s*\(\s*[A-Za-z_$][\w$]*\s*\)/.test(value)) {
      names.add(name)
    }
  }
  return names
}

/**
 * Операнд, отделённый от синтаксиса вокруг. Ведущая скобка от `if (` иначе прилипает к
 * нему, и `(String(e)` перестаёт быть `String(e)` — на этом сторож промахнулся мимо двух
 * собственных контролей, то есть контроли отработали ровно так, как задуманы.
 */
function normalise(operand: string): string {
  return operand.trim().replace(/^[\s(!]+/, '')
}

function isErrorText(operand: string, bound: Set<string>): boolean {
  const normalised = normalise(operand)
  if (TEXT_OF_ERROR.test(normalised)) return true
  return bound.has(normalised)
}

/** Сравнения кода отказа с текстом исключения — во всех трёх синтаксических формах. */
export function findOffences(source: string): Offence[] {
  const bound = textBoundNames(source)
  const found: Offence[] = []

  for (const re of [EQUALITY, INCLUDES]) {
    re.lastIndex = 0
    for (const m of source.matchAll(re)) {
      const operand = m[1] ?? ''
      if (isErrorText(operand, bound)) found.push({ operand: normalise(operand), code: m[0] })
    }
  }

  SWITCH.lastIndex = 0
  for (const m of source.matchAll(SWITCH)) {
    const operand = m[1] ?? ''
    if (!isErrorText(operand, bound)) continue
    // Тело `switch` от его `{` до парной `}`: `case 'CODE'` внутри — то же сравнение,
    // записанное другим оператором.
    const start = m.index + m[0].length - 1
    let depth = 0
    let end = start
    for (; end < source.length; end++) {
      if (source[end] === '{') depth++
      else if (source[end] === '}') {
        depth--
        if (depth === 0) break
      }
    }
    const body = source.slice(start, end + 1)
    const hit = new RegExp(`case\\s+${CODE}`).exec(body)
    if (hit) found.push({ operand: normalise(operand), code: hit[0] })
  }

  return found
}
