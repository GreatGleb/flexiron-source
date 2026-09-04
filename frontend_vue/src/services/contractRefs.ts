/**
 * Резолвер ссылок `путь:строка` в документах контракта — одна реализация на проект.
 *
 * Читают её трое, и это причина, по которой она здесь, а не в промпте: автор раздела
 * (перед тем как заявить К7), приёмщик (когда проверяет заявленное) и линза К7 из
 * `roo_code/skills/api-contract.md`. Пока проверка жила в промпте, каждый считал её сам:
 * автор рапортовал «475, провалов 0» по своей таблице, а приёмщик брал файл целиком и
 * находил остаток. Второй экземпляр правила расходится с первым молча — линза Л5.
 *
 * Прогон 2026-09-04: из четырнадцати отклонённых доменов ссылки убили не меньше пяти,
 * и ни одного из них не поймала таблица автора.
 *
 * Проверяется ТРИ вещи, и третья — главная:
 *   1. файл существует;
 *   2. строка (или диапазон) в границах файла;
 *   3. утверждаемый токен ЛЕЖИТ ВНУТРИ диапазона.
 * Без третьей проверка бесполезна: файл существует всегда, а сдвиг на строку — ровно тот
 * дефект, который прогон производил чаще всего (`:1021` вместо `:1023`, `:1038` вместо
 * `:1039`, `573-574` вместо `575-576`).
 *
 * Работает с файлами на диске — только окружение `node` (`vitest.config.ts`).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

/** Корень репозитория. Спеки запускаются из `frontend_vue/`. */
function repoRoot(): string {
  return resolve(process.cwd(), '..')
}

export interface Ref {
  /** Как записано в документе, вместе с путём: `mocks/categories.ts:1329-1335`. */
  raw: string
  /** Путь как записан. У голого продолжения (`:147`) — унаследованный. */
  path: string
  /** Унаследован ли путь от предыдущей ссылки абзаца. */
  carried: boolean
  from: number
  to: number
  /** Строка САМОГО ДОКУМЕНТА, где стоит ссылка — чтобы автор нашёл, что править. */
  docLine: number
  /** Утверждаемые токены: код в бэктиках на той же строке документа. */
  tokens: string[]
  /**
   * Ссылка на строке одна — значит токен рядом относится к ней, а не к соседке. Только у
   * таких проверка содержимого доказательна; у остальных привязка догадка, и промах токена
   * означает «посмотри глазами», а не «битая ссылка».
   */
  sole: boolean
}

export type Problem = 'нет файла' | 'вне границ' | 'нет токена в диапазоне'

export interface Verdict {
  ref: Ref
  ok: boolean
  /** Заполнено только у `ok: false`. */
  problem?: Problem
  detail?: string
  /** Токенов рядом не нашлось — проверить содержимое нечем, границы проверены. */
  unchecked?: boolean
  /** Токен не сошёлся, но привязка неоднозначна: смотреть глазами, а не считать битой. */
  needsEye?: boolean
}

/**
 * Ссылка: путь с расширением плюс `:N` или `:N-M`. Путь может быть неполным
 * (`mocks/categories.ts`) или одним именем файла (`CategoryCardPage.vue`) — так пишут
 * в документах, и запрещать это значило бы переписать все написанные разделы.
 */
const REF = /([A-Za-z0-9_./-]*[A-Za-z0-9_-]\.(?:ts|tsx|vue|py|md|json|mjs))?:(\d+)(?:-(\d+))?/g

/** Код в бэктиках. Из него берутся утверждаемые токены. */
const BACKTICKED = /`([^`]+)`/g

/**
 * Токен годится в доказательство только если его можно грепнуть ДОСЛОВНО. Отсюда четыре
 * запрета, и каждый снят с ложных срабатываний первой версии (3096 «битых» на 11381 ссылке,
 * почти все — свои же):
 *
 *   1. пробел внутри — почти всегда пересказ, а не код. `payment_terms String(100)` в файле
 *      не лежит ни одной строкой: в схеме это `mapped_column(String(100))`. Требовать
 *      пересказ дословно значит красить верные ссылки;
 *   2. похоже на ссылку (`:` и цифра) — это соседняя ссылка той же строки, а не утверждение
 *      об этой. На строке-перечислении каждая ссылка требовала бы найти внутри себя все
 *      остальные;
 *   3. просто имя файла или путь — «должно лежать в `orderPricing.ts`» говорит, ГДЕ надо, а
 *      не что внутри диапазона;
 *   4. русская проза — в коде её нет.
 *
 * Что осталось после запретов и есть настоящее доказательство: идентификатор, вызов,
 * присваивание, литерал — `ondelete="RESTRICT"`, `notifySupplierResponse`, `tenant_id`.
 */
function isGreppable(span: string): boolean {
  const s = span.trim()
  if (s.length < 3 || s.length > 120) return false
  if (/\s/.test(s)) return false
  if (/:\d/.test(s)) return false
  if (/^[\w./@-]+\.(?:ts|tsx|vue|py|md|json|mjs|js|css)$/.test(s)) return false
  if (/^[\w.-]*\/[\w./-]*$/.test(s)) return false
  if (/[а-яА-ЯёЁ]/.test(s)) return false
  return true
}

let indexCache: Map<string, string[]> | null = null

/** Индекс по имени файла — чтобы разрешать ссылки вида `CategoryCardPage.vue:91`. */
function fileIndex(): Map<string, string[]> {
  if (indexCache) return indexCache
  const out = new Map<string, string[]>()
  const skip = new Set(['node_modules', '.git', 'dist', 'coverage', '.venv', '__pycache__'])
  const walk = (dir: string): void => {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const e of entries) {
      if (skip.has(e)) continue
      const p = join(dir, e)
      let st
      try {
        st = statSync(p)
      } catch {
        continue
      }
      if (st.isDirectory()) walk(p)
      else {
        const list = out.get(e)
        if (list) list.push(p)
        else out.set(e, [p])
      }
    }
  }
  walk(repoRoot())
  indexCache = out
  return out
}

/**
 * Путь документа → ВСЕ файлы на диске, которым он подходит.
 *
 * Не один файл, и это не перестраховка: `mocks/warehouse.ts` подходит и шестистрочному
 * реэкспорту `src/mocks/warehouse.ts`, и настоящему `src/services/mocks/warehouse.ts`.
 * Первая версия резолвера брала первое совпадение, ловила стаб и объявляла «вне границ:
 * в файле 6 строк» — 193 таких «дефекта» на одном orders.md. Утверждение доказано, если его
 * подтверждает ХОТЬ ОДИН файл, которому написанный путь подходит.
 */
export function resolveCandidates(path: string): string[] {
  const root = repoRoot()
  const out: string[] = []
  const add = (p: string): void => {
    if (existsSync(p) && statSync(p).isFile() && !out.includes(p)) out.push(p)
  }
  for (const base of ['', 'frontend_vue', 'frontend_vue/src', 'backend']) {
    add(base ? resolve(root, base, path) : resolve(root, path))
  }
  const tail = path.replace(/^\.\//, '')
  for (const hit of fileIndex().get(basename(path)) || []) {
    if (hit.endsWith(tail) || !tail.includes('/')) add(hit)
  }
  return out
}

/** Первый подходящий файл — для сообщений и для спеки резолвера. */
export function resolvePath(path: string): string | null {
  return resolveCandidates(path)[0] || null
}

/**
 * Все ссылки документа. Голое продолжение (`:147`) наследует путь предыдущей ссылки того же
 * абзаца — так пишут в аудитах («`openEditField` берёт `tf()` (:135, :147)»), и потерять их
 * значило бы не проверить как раз то место, где ссылок больше всего.
 */
/** Ссылка плюс позиция в строке документа — нужна только для привязки токенов. */
interface RefAt extends Ref {
  at: number
}

export function extractRefs(markdown: string): Ref[] {
  const lines = markdown.split('\n')
  const out: Ref[] = []
  let inFence = false
  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      return
    }
    if (inFence || line.trim() === '') return

    // Токены строки со своими позициями — привязка к ссылке по близости, см. ниже.
    const spans: { text: string; at: number }[] = []
    for (const m of line.matchAll(BACKTICKED)) {
      if (m[1] && isGreppable(m[1])) spans.push({ text: m[1], at: m.index + 1 })
    }

    // Путь наследуется ТОЛЬКО от ссылки левее на этой же строке. Наследование через строки
    // выглядело безопаснее, а давало ложные срабатывания пачками: в аудите analytics `:700`
    // — это строка старого монолита, обсуждаемого в том же разделе, а следом на строке стоит
    // `src/types/analytics.ts`, и межстрочный перенос приписывал `:700` ему.
    let lastPath: string | null = null
    const onLine: RefAt[] = []
    for (const m of line.matchAll(REF)) {
      const raw = m[0]
      const path = m[1]
      const effective = path ?? lastPath
      if (!effective) continue
      if (path) lastPath = path
      const from = Number(m[2])
      const to = m[3] ? Number(m[3]) : from
      if (!Number.isFinite(from) || to < from) continue
      onLine.push({
        raw,
        path: effective,
        carried: path === undefined,
        from,
        to,
        docLine: i + 1,
        tokens: [],
        // Пересчитывается ниже, когда известно, сколько ссылок на строке.
        sole: false,
        at: m.index,
      })
    }

    /**
     * Токен принадлежит БЛИЖАЙШЕЙ ссылке строки, а не всем сразу.
     *
     * Без этого правила строка «`foo` (`a.ts:1`) и `bar` (`b.ts:2`)» требовала от каждой
     * ссылки найти внутри своего диапазона любой из обоих токенов — и краснела всегда, когда
     * автор написал две разные мысли в одной строке. Это давало 2944 «битых» ссылки из 3008,
     * то есть 98% находок первой версии были её собственным дефектом, а не дефектом
     * документов. Ровно тот случай, про который скил говорит: проверка, чей экстрактор
     * считает не то, хуже отсутствующей.
     */
    for (const sp of spans) {
      let best: RefAt | null = null
      let bestDist = Infinity
      for (const r of onLine) {
        const d = Math.abs(r.at - sp.at)
        if (d < bestDist) {
          bestDist = d
          best = r
        }
      }
      if (best && !best.raw.includes(sp.text)) best.tokens.push(sp.text)
    }

    for (const r of onLine) {
      const { at: _at, ...rest } = r
      // Ссылка одна на строке и путь написан явно — привязка токена однозначна.
      rest.sole = onLine.length === 1 && !rest.carried
      out.push(rest)
    }
  })
  return out
}

/**
 * Из чего искать токен в диапазоне.
 *
 * Дословно токен лежит в файле далеко не всегда, и это не вина автора: `ApiRequestError.code`
 * — путь к полю, в коде оно объявлено на своей строке; `unwrap()` — вызов, а в файле
 * объявление `function unwrap(`. Требовать дословности от таких форм означало красить верные
 * ссылки: на них пришлась вся вторая волна ложных срабатываний (1702 из 11381).
 *
 * Задача проверки — поймать СДВИГ диапазона, а не сверить синтаксис. Для этого хватает
 * опознать в диапазоне ядро токена: сам токен, он же без вызова, и его идентификаторы.
 */
function needlesOf(token: string): string[] {
  const t = token.trim()
  const out = new Set<string>([t])
  out.add(t.replace(/\([^)]*\)\s*$/, ''))
  for (const part of t.split('.')) if (part.length >= 3) out.add(part.replace(/\([^)]*\)\s*$/, ''))
  for (const m of t.matchAll(/[A-Za-z_]\w{2,}/g)) out.add(m[0])
  return [...out].filter((x) => x.length >= 3)
}

/** Проверка одной ссылки: файл, границы, утверждаемый токен внутри диапазона. */
export function resolveRef(ref: Ref): Verdict {
  const candidates = resolveCandidates(ref.path)
  if (candidates.length === 0) {
    return { ref, ok: false, problem: 'нет файла', detail: `не нашёл ${ref.path}` }
  }

  let inBounds = 0
  let bestBounds = ''
  for (const disk of candidates) {
    const lines = readFileSync(disk, 'utf8').split('\n')
    if (ref.from < 1 || ref.to > lines.length) {
      if (!bestBounds) bestBounds = `в ${disk.slice(repoRoot().length + 1)} ${lines.length} строк`
      continue
    }
    inBounds += 1
    if (ref.tokens.length === 0) continue
    const range = lines.slice(ref.from - 1, ref.to).join('\n')
    if (ref.tokens.some((t) => needlesOf(t).some((n) => range.includes(n))))
      return { ref, ok: true }
  }

  if (inBounds === 0) {
    return {
      ref,
      ok: false,
      problem: 'вне границ',
      detail: `${bestBounds}, ссылка на ${ref.from}-${ref.to}`,
    }
  }
  // В границах, но токена не нашлось ни в одном подходящем файле. Токенов нет вовсе —
  // проверить содержимое нечем: границы сошлись, и это всё, что доказано.
  if (ref.tokens.length === 0) return { ref, ok: true, unchecked: true }
  const detail = `в ${ref.from}-${ref.to} нет ни одного из: ${ref.tokens.map((t) => `«${t}»`).join(', ')}`
  // Ссылок на строке несколько или путь унаследован — какой токен относится к какой ссылке,
  // машина не знает. Промах здесь означает «проверь глазами», и выдавать его за битую ссылку
  // значит утопить настоящие находки в шуме: их было бы 1320 вместо 64.
  if (!ref.sole) return { ref, ok: true, needsEye: true, detail }
  return { ref, ok: false, problem: 'нет токена в диапазоне', detail }
}

export interface Report {
  file: string
  total: number
  broken: Verdict[]
  unchecked: number
  needsEye: Verdict[]
}

/** Отчёт по документу. Им отчитываются автор и приёмщик — вывод целиком, а не число. */
export function checkDoc(docPath: string): Report {
  const disk = resolve(repoRoot(), docPath)
  const refs = extractRefs(readFileSync(disk, 'utf8'))
  const verdicts = refs.map(resolveRef)
  return {
    file: docPath,
    total: refs.length,
    broken: verdicts.filter((v) => !v.ok),
    unchecked: verdicts.filter((v) => v.ok && v.unchecked).length,
    needsEye: verdicts.filter((v) => v.ok && v.needsEye),
  }
}

/** Строки отчёта для вставки в ответ агента. */
export function formatReport(r: Report): string[] {
  const head =
    `${r.file}: ссылок ${r.total}, битых ${r.broken.length}, ` +
    `глазами ${r.needsEye.length}, без токена ${r.unchecked}`
  return [
    head,
    ...r.broken.map(
      (v) =>
        `  ${r.file}:${v.ref.docLine} → ${v.ref.path}:${v.ref.from}-${v.ref.to} — ${v.problem}: ${v.detail}`,
    ),
  ]
}
