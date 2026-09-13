import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { findOffences, moduleFacts, scriptOfVue, type ModuleFacts } from './apiErrorCode.guard'

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
 *
 * **Каждый образец ниже появился после того, как его пропустила очередная версия.**
 * Последняя порция — формы ХРАНЕНИЯ (поле объекта, `.value` рефа, параметр функции,
 * помощник в другом файле): скептик скомпилировал сторож v5 и показал, что все они
 * проходят насквозь. На v5 эти образцы красные, на v6 зелёные — это и есть
 * доказательство правки, а не то, что общий свип по `src` остался пустым.
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
  // Формы ЛИТЕРАЛА и ОПЕРАЦИИ — их пропускала четвёртая версия: разбор по смыслу был
  // применён к одной стороне сравнения из трёх.
  ['равенство ==', `try{f()}catch(e){ if (e.message == 'SOME_CODE') g() }`, true],
  ['код в константе', `const C = 'SOME_CODE'\ntry{f()}catch(e){ if (e.message === C) g() }`, true],
  ['шаблонная строка', 'try{f()}catch(e){ if (e.message === `SOME_CODE`) g() }', true],
  [
    'именованный массив кодов',
    `const CODES = ['SOME_CODE']\ntry{f()}catch(e){ if (CODES.includes(e.message)) g() }`,
    true,
  ],
  ['indexOf', `try{f()}catch(e){ if (e.message.indexOf('SOME_CODE') > -1) g() }`, true],
  [
    'регулярка в константе',
    `const R = /SOME_CODE/\ntry{f()}catch(e){ if (R.test(e.message)) g() }`,
    true,
  ],
  ['trim перед сравнением', `try{f()}catch(e){ if (e.message.trim() === 'SOME_CODE') g() }`, true],
  [
    'словарь по тексту',
    `const MAP: Record<string,string> = { SOME_CODE: 'k' }\ntry{f()}catch(e){ use(MAP[e.message]) }`,
    true,
  ],
  [
    'перебор набора кодов',
    `try{f()}catch(e){ if (['SOME_CODE'].some(c => e.message === c)) g() }`,
    true,
  ],
  // Формы ХРАНЕНИЯ — их пропускала пятая версия: выражение она разбирала по смыслу, а
  // место, где значение полежало, — нет. Скептик показал каждую из них живой пробой:
  // на сторже v5 все пять красные, на v6 зелёные.
  [
    'через поле объекта-посредника',
    `try{f()}catch(e){ const box = { text: e.message }; if (box.text === 'SOME_CODE') g() }`,
    true,
  ],
  [
    'через поле присваиванием',
    `const st: Record<string,string> = {}\ntry{f()}catch(e){ st.text = e.message }\nif (st.text === 'SOME_CODE') g()`,
    true,
  ],
  [
    'через параметр функции',
    `function h(m: string){ if (m === 'SOME_CODE') g() }\ntry{f()}catch(e){ h(e.message) }`,
    true,
  ],
  [
    'через параметр стрелки',
    `const h = (m: string) => m === 'SOME_CODE'\ntry{f()}catch(e){ if (h(e.message)) g() }`,
    true,
  ],
  // `error.value = e.message` — **36** таких мест во фронте на 2026-09-12 (замер:
  // `grep -rnE "\.value\s*=[^=].*\.message" src` без спек и моков; в прошлой редакции
  // этого комментария стояло «35» — число было взято на глаз и оказалось неверным).
  // Сравнений с кодом поверх них — ноль (`grep -rnE "\.value(\.(includes|startsWith|
  // indexOf|match))?\s*(===|==|\()\s*'[A-Z][A-Z0-9_]{3,}'"`). То есть это была
  // ЛОВУШКА, а не живой отказ: сырьё лежало, сторож бы промолчал. Проба стоит здесь,
  // чтобы ловушка не сработала позже.
  [
    'через .value рефа',
    `const error = ref<string|null>(null)\nfunction fail(e: Error){ error.value = e.message }\nfunction show(){ if (error.value === 'SOME_CODE') g() }`,
    true,
  ],
  [
    'через .value рефа, подстрокой',
    `const error = ref('')\nfunction fail(e: Error){ error.value = e.message }\nfunction show(){ if (error.value.includes('SOME_CODE')) g() }`,
    true,
  ],
  [
    'текст в конструкторе рефа',
    `try{f()}catch(e){ const r = ref(e.message); if (r.value === 'SOME_CODE') g() }`,
    true,
  ],
  // Пятая форма хранения — ВОЗВРАТ ОБЪЯВЛЕННОЙ ФУНКЦИИ. Её не было в списке скептика:
  // она нашлась пробой соседних форм уже после того, как четыре названные закрылись.
  // Стыд именно в том, что межфайловый двойник (`returnsErrorText` ниже) ловился, а
  // тот же помощник В СВОЁМ файле — нет: `const txt = (e) => e.message` числился
  // происхождением имени, а `function txt(e){ return e.message }` — нет.
  [
    'через возврат объявленной функции',
    `function textOf(e: Error){ return e.message }\ntry{f()}catch(e){ if (textOf(e) === 'SOME_CODE') g() }`,
    true,
  ],
  [
    'возврат объявленной функции, подстрокой',
    `function textOf(e: Error){ return e.message }\ntry{f()}catch(e){ if (textOf(e).includes('SOME_CODE')) g() }`,
    true,
  ],
  [
    'контроль: объявленная функция возвращает код',
    `function codeOf(e: unknown){ return errorCode(e) }\ntry{f()}catch(e){ if (codeOf(e) === 'SOME_CODE') g() }`,
    false,
  ],
  [
    'контроль: объявленная функция возвращает не-текст',
    `function statusOf(r: Row){ return r.status }\nif (statusOf(row) === 'IN_PROGRESS') g()`,
    false,
  ],
  // ФОРМЫ ОБЁРТКИ — v7. Версия 6 разбирала МЕСТО, где значение полежало, но не ОПЕРАЦИЮ,
  // через которую оно прошло: `e.message ?? ''` для неё было не текстом исключения, и
  // каждая из записей ниже проходила насквозь. Как это перепроверить руками: выложить
  // прежний сторож рядом (`git show <коммит>:…/apiErrorCode.guard.ts > …/__guardold.ts`),
  // подменить в копии этой спеки импорт на него и прогнать. Замер 2026-09-13: на прежнем
  // стороже 17 проб ниже красные, все четыре контроля зелёные; на нынешнем зелено всё.
  //
  // Живых мест ни одной из этих форм во фронте нет — свип по дереву ниже зелёный. Сырьё
  // есть: `grep -rnE "\.message\s*(\?\?|\|\|)" src` без моков, спек и комментариев самого
  // сторожа — 3 места (`services/api.ts` 85, 105, 163), сравнений с кодом поверх них —
  // ноль. То есть это, как и `.value` у шестой версии, ЛОВУШКА: сырьё лежит, а сторож
  // молчал бы.
  [
    'запасная строка через ??',
    `try{f()}catch(e){ const m = e.message ?? ''; if (m === 'SOME_CODE') g() }`,
    true,
  ],
  [
    'запасная строка через ||',
    `try{f()}catch(e){ const m = e.message || ''; if (m === 'SOME_CODE') g() }`,
    true,
  ],
  [
    'шаблонная подстановка',
    "try{f()}catch(e){ const m = `${e.message}`; if (m === 'SOME_CODE') g() }",
    true,
  ],
  [
    'склейка строк',
    `try{f()}catch(e){ const m = '' + e.message; if (m === 'SOME_CODE') g() }`,
    true,
  ],
  // `String(e)` ловился и раньше, `String(e.message)` — нет: правило знало ОДНУ запись
  // стрингификации. Теперь их три, и все три — одна мысль «значение стало строкой».
  ['String поверх текста', `try{f()}catch(e){ if (String(e.message) === 'SOME_CODE') g() }`, true],
  ['toString значения', `try{f()}catch(e){ if (e.toString() === 'SOME_CODE') g() }`, true],
  [
    'JSON.stringify значения',
    `try{f()}catch(e){ if (JSON.stringify(e).includes('SOME_CODE')) g() }`,
    true,
  ],
  ['concat к тексту', `try{f()}catch(e){ if (e.message.concat('x') === 'SOME_CODE') g() }`, true],
  ['padEnd к тексту', `try{f()}catch(e){ if (e.message.padEnd(3) === 'SOME_CODE') g() }`, true],
  // ТАРА — второй предел v6, названный в её же комментарии как «сегодня не встречается».
  // Закрыт вместе с обёртками: тара хранит происхождения под своим путём, чтение элемента
  // читает их все. Элементы между собой не различаются — это названная огрублённость.
  [
    'элемент массива',
    `const box: string[] = []\ntry{f()}catch(e){ box.push(e.message) }\nif (box[0] === 'SOME_CODE') g()`,
    true,
  ],
  [
    'литерал массива',
    `try{f()}catch(e){ const box = [e.message]; if (box[0] === 'SOME_CODE') g() }`,
    true,
  ],
  ['includes по массиву', `try{f()}catch(e){ if ([e.message].includes('SOME_CODE')) g() }`, true],
  ['кусок split', `try{f()}catch(e){ if (e.message.split(':')[0] === 'SOME_CODE') g() }`, true],
  [
    'join тары',
    `const box: string[] = []\ntry{f()}catch(e){ box.push(e.message) }\nif (box.join(' ').includes('SOME_CODE')) g()`,
    true,
  ],
  [
    'через Map',
    `const m = new Map<string,string>()\ntry{f()}catch(e){ m.set('k', e.message) }\nif (m.get('k') === 'SOME_CODE') g()`,
    true,
  ],
  [
    'через Set',
    `const s = new Set<string>()\ntry{f()}catch(e){ s.add(e.message) }\nif (s.has('SOME_CODE')) g()`,
    true,
  ],
  // Rest-параметр — вторая половина того же предела v6: связка аргумент→параметр шла по
  // индексу и `...a` не раскрывала.
  [
    'через rest-параметр',
    `function h(...a: string[]){ if (a[0] === 'SOME_CODE') g() }\ntry{f()}catch(e){ h(e.message) }`,
    true,
  ],
  // Контроли к формам обёртки и тары. Ложное обвинение хуже пропуска: оно заставляет
  // следующего автора отключить сторож. Поэтому у каждой связки — парная проба с законным
  // источником. Все четыре молчат и на старом стороже, и на новом.
  ['контроль: статус через ??', `const m = row.status ?? ''\nif (m === 'IN_PROGRESS') g()`, false],
  [
    'контроль: код через ??',
    `try{f()}catch(e){ const c = errorCode(e) ?? ''; if (c === 'SOME_CODE') g() }`,
    false,
  ],
  [
    'контроль: массив статусов',
    `const box = [row.status]\nif (box[0] === 'IN_PROGRESS') g()`,
    false,
  ],
  [
    'контроль: Map статусов',
    `const m = new Map<string,string>()\nm.set('k', row.status)\nif (m.get('k') === 'IN_PROGRESS') g()`,
    false,
  ],
  // ИЗВЕСТНЫЕ ПРЕДЕЛЫ v7 — записаны как есть, потому что молчание сторожа на них означает
  // «не проверено», а не «чисто». Каждая промерена пробой 2026-09-13 и молчит:
  //   1) тара, наполненная в конструкторе: `new Map([['k', e.message]])`, затем `get('k')`;
  //   2) обход тары чужой функцией: `Object.values(box).includes('КОД')`, `box.map(x => x)[0]`;
  //   3) межфайловый поток без фактов — вызывающий не подал `FactsLookup`.
  // Появится живое место такой формы — это находка, а не «сторож зелёный».
  // Разрешённые записи — сторож обязан молчать.
  ['через errorCode', `try{f()}catch (e) { if (errorCode(e) === 'SOME_CODE') g() }`, false],
  [
    'errorCode через переменную',
    `try{f()}catch (e) { const c = errorCode(e); if (c === 'SOME_CODE') g() }`,
    false,
  ],
  ['чужой литерал', `if (r.method === 'UPLOAD') g()`, false],
  ['код у поля не-ошибки', `if (row.status === 'IN_PROGRESS') g()`, false],
  // Область видимости: параметр `code` разбора тела ответа — НЕ чей-то `const code =
  // e.message` из соседней функции. Версия 4 их сливала и обвиняла `services/api.ts`.
  [
    'одноимённый параметр в другой функции',
    `function helper(e: Error) { const code = e.message; return code }\nfunction infer(code: string | null) { if (code === 'VALIDATION_ERROR') return 'email'\n return null }`,
    false,
  ],
  // Контроли к формам хранения. Ложное обвинение на правильном коде хуже пропуска: оно
  // заставляет следующего автора отключить сторож. Поэтому у каждой новой связки —
  // «полю», «рефу», «параметру» — есть парная проба, где источник законный.
  [
    'параметр получает код, а не текст',
    `function h(m: string){ if (m === 'SOME_CODE') g() }\ntry{f()}catch(e){ h(errorCode(e)) }`,
    false,
  ],
  [
    'поле объекта не из текста',
    `const box = { text: row.status }\nif (box.text === 'IN_PROGRESS') g()`,
    false,
  ],
  ['реф не из текста', `const s = ref(row.status)\nif (s.value === 'IN_PROGRESS') g()`, false],
  [
    'одноимённое поле в другой функции',
    `function a(){ const box = { text: 'x' }; return box.text }\nfunction b(e: Error){ const box = { text: e.message }; return box.text }`,
    false,
  ],
]

/**
 * Межфайловый поток: сравнение и добыча текста живут в РАЗНЫХ файлах. Сторож файлов не
 * читает — он спрашивает факты о соседе (`FactsLookup`), а резолвит пути спека. Без этой
 * связки обе формы ниже проходили мимо v5 насквозь.
 */
const CROSS_FILE: Array<[string, string, string, boolean]> = [
  [
    'помощник в другом файле достаёт текст',
    `export function textOf(e: unknown){ return e instanceof Error ? e.message : '' }`,
    `import { textOf } from './helper'\ntry{f()}catch(e){ if (textOf(e) === 'SOME_CODE') g() }`,
    true,
  ],
  [
    'помощник в другом файле сравнивает свой параметр',
    `export function isGone(m: string){ return m === 'SOME_CODE' }`,
    `import { isGone } from './helper'\ntry{f()}catch(e){ if (isGone(e.message)) g() }`,
    true,
  ],
  [
    'контроль: помощнику отдали код, а не текст',
    `export function isGone(m: string){ return m === 'SOME_CODE' }`,
    `import { isGone } from './helper'\ntry{f()}catch(e){ if (isGone(errorCode(e))) g() }`,
    false,
  ],
  [
    'контроль: помощник возвращает код, а не текст',
    `export function codeOf(e: unknown){ return errorCode(e) }`,
    `import { codeOf } from './helper'\ntry{f()}catch(e){ if (codeOf(e) === 'SOME_CODE') g() }`,
    false,
  ],
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

/**
 * Резолвер импортов. Живёт в спеке, а не в стороже: сторож разбирает текст и не должен
 * знать ни про диск, ни про алиасы Vite.
 */
function resolveSpecifier(specifier: string, fromFile: string): string | null {
  let base: string
  if (specifier.startsWith('@/')) base = join(SRC, specifier.slice(2))
  else if (specifier.startsWith('./') || specifier.startsWith('../'))
    base = join(dirname(fromFile), specifier)
  else return null
  for (const candidate of [base, `${base}.ts`, `${base}.vue`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

const factsCache = new Map<string, ModuleFacts>()

function factsFor(specifier: string, fromFile: string): ModuleFacts | undefined {
  const file = resolveSpecifier(specifier, fromFile)
  // Моки исключены и здесь, той же причиной: они коды БРОСАЮТ, и их внутренние сравнения
  // с кодом — работа сервера, а не чтение текста исключения приложением.
  if (!file || file.split('\\').join('/').includes('/mocks/')) return undefined
  let facts = factsCache.get(file)
  if (!facts) {
    const raw = readFileSync(file, 'utf8')
    facts = moduleFacts(file.endsWith('.vue') ? scriptOfVue(raw) : raw, file)
    factsCache.set(file, facts)
  }
  return facts
}

describe('сторож: контроли на образцах', () => {
  it.each(SAMPLES)('%s', (_name, sample, mustCatch) => {
    expect(findOffences(sample).length > 0).toBe(mustCatch)
  })
})

describe('сторож: поток через границу файла', () => {
  it.each(CROSS_FILE)('%s', (_name, helper, user, mustCatch) => {
    const facts = moduleFacts(helper, 'helper.ts')
    const lookup = (specifier: string) => (specifier === './helper' ? facts : undefined)
    expect(findOffences(user, 'user.ts', lookup).length > 0).toBe(mustCatch)
  })

  it('без фактов межфайловый поток невиден — это «не проверено», а не «чисто»', () => {
    const user = `import { textOf } from './helper'\ntry{f()}catch(e){ if (textOf(e) === 'SOME_CODE') g() }`
    expect(findOffences(user, 'user.ts')).toEqual([])
  })

  /**
   * Резолвер — единственная часть межфайловой связки, которая работает на настоящем
   * дереве, и её надо проверять отдельно.
   *
   * **Замер 2026-09-12 по всем 216 файлам: `returnsErrorText` — 0, `comparesParamToCode`
   * — 0.** То есть сегодня во фронте нет ни одного экспорта, который достаёт текст
   * исключения или сравнивает свой параметр с кодом (`inferFieldFromMessage` в
   * `api.ts:116` сравнивает, но не экспортируется). Значит, чистота общего свипа НЕ
   * доказывает, что межфайловая связка работает, — её доказывают образцы выше и этот
   * тест. Молчащий резолвер дал бы ровно тот же зелёный.
   */
  it('резолвер находит настоящие модули — иначе связка молчала бы вхолостую', () => {
    const from = join(SRC, 'composables', 'useClients.ts')
    expect(resolveSpecifier('@/services/apiErrorCode', from)).toBe(
      join(SRC, 'services', 'apiErrorCode.ts'),
    )
    expect(resolveSpecifier('./useToast', from)).toBe(join(SRC, 'composables', 'useToast.ts'))
    expect(resolveSpecifier('vue', from)).toBeNull()
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
    const name = rel.endsWith('.vue') ? `${rel}.ts` : rel
    for (const offence of findOffences(text, name, (spec) => factsFor(spec, file))) {
      offenders.push(`${rel}:${offence.line} :: ${offence.operand} → ${offence.code}`)
    }
  }

  it('ни одно сравнение с кодом не берёт операнд из текста исключения', () => {
    expect(offenders).toEqual([])
  })

  it('обход дерева жив — файлы прочитаны', () => {
    // Замер 2026-09-11: 216 (счёт тем же обходом, а не на глаз — прежние «341» я
    // выдумал, и заход 2 это поймал). Порог ниже факта: это проверка «обход не сломался»,
    // а не храповик по числу файлов.
    expect(scanned).toBeGreaterThanOrEqual(150)
  })
})
