import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Сторож правила §2 «отказ несёт код, а не текст».
 *
 * Поведенческие тесты рядом (`apiErrorCode.spec.ts`, `orderLineEdits.spec.ts`) доказывают,
 * что правило РАБОТАЕТ. Этот доказывает, что его никто не обошёл — а обойти его дёшево:
 * ровно так и появились семь мест класса, каждое написанное отдельно и каждое зелёное под
 * моками. Линза Л5 называет вторую запись правила корнем трёх аудитов подряд; здесь она
 * становится машинной.
 *
 * Правило в машинной форме: **файл, сравнивающий что-либо с литералом-кодом отказа,
 * обязан спрашивать этот код у `errorCode()`.** Сравнение — `===`, `!==` или `.includes(`;
 * литерал-код — заглавные с подчёркиванием (`ORDER_NOT_FOUND`), потому что именно так
 * выглядят все коды каталога §2 и доменных каталогов.
 *
 * Сторож введён зелёным (правило «шаг гейта вводится только зелёным», `verify.md`): на
 * 2026-09-11 подходящих файлов семь, и все семь импорт имеют.
 */

const SRC = join(process.cwd(), 'src')

/** Сравнение с кодом отказа: `=== 'ORDER_NOT_FOUND'`, `.includes('LINE_ON_INVOICE')`. */
const CODE_COMPARISON = /(===|!==|\.includes\()\s*'[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+'/

/** Спрашивание кода у единственного источника — прямое или через таблицу домена. */
const ASKS_FOR_CODE = /\b(errorCode|errorMessageKey)\s*\(/

/**
 * Изъятия — по одному, с причиной. Списка «пока не дошли руки» здесь нет: сторож, у
 * которого такой список есть, перестаёт быть сторожем.
 */
const EXEMPT = new Map<string, string>([
  [
    'services/api.ts',
    'производитель кода: `parseErrorBody` разбирает тело ответа и сам решает, какой код ' +
      'положить в `ApiRequestError`. Спрашивать код у себя ему негде.',
  ],
  ['services/apiErrorCode.ts', 'сам источник правила.'],
])

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

describe('код отказа читается из поля, а не из текста', () => {
  const offenders: string[] = []
  const guarded: string[] = []

  for (const file of sourceFiles(SRC)) {
    const rel = relative(SRC, file).split('\\').join('/')
    const text = readFileSync(file, 'utf8')
    if (!CODE_COMPARISON.test(text)) continue
    if (EXEMPT.has(rel)) continue
    if (ASKS_FOR_CODE.test(text)) guarded.push(rel)
    else offenders.push(rel)
  }

  it('ни один файл не сравнивает с кодом то, что не спросил у errorCode()', () => {
    expect(offenders).toEqual([])
  })

  /**
   * Без этой проверки сторож молча выродится: сломается обход каталога или регулярка —
   * и пустой список нарушителей будет означать «ничего не проверено», а не «всё чисто».
   * Это питфолл #66 в чистом виде: утверждение об отсутствии доказывает что-то только
   * там, где присутствие было возможно.
   */
  it('сторожу есть что сторожить — файлы с кодами найдены', () => {
    // Замер 2026-09-11: семь. Порог ниже факта намеренно — это проверка «обход жив», а
    // не храповик: файл, законно переставший сравнивать коды, не должен красить прогон.
    expect(guarded.length).toBeGreaterThanOrEqual(5)
  })
})
