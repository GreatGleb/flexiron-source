import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { findOffences, scriptOfVue } from './apiErrorCode.guard'

/**
 * Сторож правила §2 «отказ несёт код, а не текст»: **машинный код нельзя доставать из
 * текста исключения**.
 *
 * Поведенческие тесты рядом (`apiErrorCode.spec.ts`, `orderLineEdits.spec.ts`,
 * `composables/apiErrorCode.consumers.spec.ts`) доказывают, что правило работает. Этот
 * доказывает, что его никто не обошёл.
 *
 * **У сторожа есть свои контроли, и они появились не от аккуратности.** Две предыдущие
 * версии искали нарушение в теле обработчика; скептик показал на образцах, что так
 * видны две формы из девяти, а проверка «в теле есть `errorCode(`» вдобавок давала
 * иммунитет всему телу. Сторож без положительных контролей — это питфолл #66: пустой
 * список нарушителей одинаково означает и «чисто», и «не проверено».
 */

const SRC = join(process.cwd(), 'src')

/**
 * Девять форм, в которых нарушение может быть записано. Восемь обязаны ловиться, одна —
 * `errorCode` рядом с сравнением — обязана НЕ ловиться: это и есть разрешённая запись.
 */
const SAMPLES: Array<[string, string, boolean]> = [
  // Формы обработчика — их искала вторая версия сторожа и видела две из восьми.
  ['catch с привязкой', `try{f()}catch (e) { if (e.message === 'SOME_CODE') g() }`, true],
  ['промис, async', `p().catch(async (e) => { if (e.message === 'SOME_CODE') g() })`, true],
  ['именованный обработчик', `function onFail(e){ if (e.message === 'SOME_CODE') g() }`, true],
  ['стрелка без тела', `p().catch((e) => (e.message === 'SOME_CODE' ? a() : b()))`, true],
  ['стрелка без скобок', `p().catch(e => { if (e.message === 'SOME_CODE') g() })`, true],
  ['catch без привязки', `try{f()}catch { if (last.message === 'SOME_CODE') g() }`, true],
  ['switch по тексту', `try{f()}catch (e) { switch (e.message) { case 'SOME_CODE': g() } }`, true],
  [
    'вложенная функция',
    `try{f()}catch (e) { setTimeout(() => { if (e.message === 'SOME_CODE') g() }) }`,
    true,
  ],
  [
    'иммунитет соседним вызовом',
    `try{f()}catch (e) { log(errorCode(e)); if (e.message === 'SOME_CODE') g() }`,
    true,
  ],
  // Формы операнда — их пропускала третья версия.
  [
    'через переменную',
    `try{f()}catch (e) { const c = e.message; if (c === 'SOME_CODE') g() }`,
    true,
  ],
  [
    'многострочное объявление',
    `try{f()}catch (e) {\n const c =\n  e instanceof Error ? e.message : ''\n if (c === 'SOME_CODE') g() }`,
    true,
  ],
  [
    'деструктуризация',
    `try{f()}catch (e) { const { message } = e; if (message === 'SOME_CODE') g() }`,
    true,
  ],
  [
    'присваивание без объявления',
    `let c = ''\ntry{f()}catch (e) { c = e.message; if (c === 'SOME_CODE') g() }`,
    true,
  ],
  ['скобочный доступ', `try{f()}catch (e) { if (e['message'] === 'SOME_CODE') g() }`, true],
  ['опциональная цепочка', `try{f()}catch (e) { if (e?.message === 'SOME_CODE') g() }`, true],
  ['String(e) подстрокой', `try{f()}catch (e) { if (String(e).includes('SOME_CODE')) g() }`, true],
  [
    'includes по массиву',
    `try{f()}catch (e) { if (['SOME_CODE','X_Y_Z'].includes(e.message)) g() }`,
    true,
  ],
  ['startsWith', `try{f()}catch (e) { if (e.message.startsWith('SOME_CODE')) g() }`, true],
  ['регулярка', `try{f()}catch (e) { if (/SOME_CODE/.test(e.message)) g() }`, true],
  [
    'обёртка-функция',
    `const txt = (e) => e.message\ntry{f()}catch (e) { if (txt(e) === 'SOME_CODE') g() }`,
    true,
  ],
  ['литерал слева', `try{f()}catch (e) { if ('SOME_CODE' === e.message) g() }`, true],
  // Разрешённые записи — сторож обязан молчать.
  ['через errorCode', `try{f()}catch (e) { if (errorCode(e) === 'SOME_CODE') g() }`, false],
  [
    'errorCode через переменную',
    `try{f()}catch (e) { const c = errorCode(e); if (c === 'SOME_CODE') g() }`,
    false,
  ],
  ['чужой литерал', `if (r.method === 'UPLOAD') g()`, false],
  ['код у поля не-ошибки', `if (row.status === 'IN_PROGRESS') g()`, false],
]

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      // Моки — сторона сервера: они коды БРОСАЮТ. Их перевод на `ApiRequestError` —
      // отдельный класс находок, здесь ему не место.
      if (entry === 'mocks') continue
      out.push(...sourceFiles(full))
      continue
    }
    if (entry.endsWith('.spec.ts') || entry.endsWith('.guard.ts')) continue
    if (entry.endsWith('.ts') || entry.endsWith('.vue')) out.push(full)
  }
  return out
}

describe('сторож: контроли на образцах', () => {
  it.each(SAMPLES)('%s', (_name, sample, mustCatch) => {
    expect(findOffences(sample).length > 0).toBe(mustCatch)
  })
})

describe('код отказа читается из поля, а не из текста', () => {
  const offenders: string[] = []
  let scanned = 0

  for (const file of sourceFiles(SRC)) {
    scanned++
    const rel = relative(SRC, file).split('\\').join('/')
    const raw = readFileSync(file, 'utf8')
    const text = file.endsWith('.vue') ? scriptOfVue(raw) : raw
    for (const offence of findOffences(text, rel.endsWith('.vue') ? `${rel}.ts` : rel)) {
      offenders.push(`${rel}:${offence.line} :: ${offence.operand} → ${offence.code}`)
    }
  }

  it('ни одно сравнение с кодом не берёт операнд из текста исключения', () => {
    expect(offenders).toEqual([])
  })

  it('обход дерева жив — файлы прочитаны', () => {
    // Замер 2026-09-11: 341. Порог сильно ниже факта: это проверка «обход не сломался»,
    // а не храповик по числу файлов.
    expect(scanned).toBeGreaterThanOrEqual(150)
  })
})
