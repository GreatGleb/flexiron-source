/**
 * Инвентарь HTTP-эндпоинтов — одна реализация на проект.
 *
 * Читают её двое: спека `contract-conformance.spec.ts` (сверяет код с контрактом) и
 * генератор карты в `roo_code/roo-context/api/README.md`. Второй экземпляр этого извлечения
 * означал бы, что «список эндпоинтов проекта» вычисляется двумя способами, и они разойдутся —
 * линза Л5 из `roo_code/skills/verify.md`.
 *
 * Работает с файлами на диске, поэтому годится только для окружения `node`
 * (`vitest.config.ts`: `environment: 'node'`).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

/** `МЕТОД /api/путь` — параметры пути нормализованы в `:id`. */
export type EndpointKey = string

interface CodeEndpoint {
  /** Файл относительно `frontend_vue/`, со строкой вызова. */
  source: string
}

interface DocEndpoint {
  /** Имя файла контракта, например `orders.md`. */
  file: string
  line: number
  /**
   * `Статус: спроектировано` — раздел написан ВПЕРЁД, как задание бэкенду, и клиента у него
   * ещё нет. Такой раздел не считается мёртвым; зато он обязан оставаться нереализованным:
   * появился вызов — метка устарела, и это находка, а не мелочь. Иначе «спроектировано»
   * становится местом, где описание тихо расходится с кодом.
   */
  planned: boolean
}

/** Корень фронтенда. Спека запускается из `frontend_vue/`, отсюда `process.cwd()`. */
function frontendRoot(): string {
  return process.cwd()
}

/** Каталог доменных файлов контракта. Экспортируется задачей 20 — генератору карты. */
function contractDir(): string {
  return resolve(frontendRoot(), '../roo_code/roo-context/api')
}

const HELPERS = 'Get|Post|Put|Patch|Delete|Upload'

/** Упоминание имени хелпера. Вызов это или проза — решает разбор ниже. */
const MENTION = new RegExp(`\\bapi(${HELPERS})\\b`, 'g')

/** Первый аргумент — строковый литерал пути. */
const FIRST_ARG = /^\s*(`[^`]*`|'[^']*')/

/**
 * Что стоит за именем хелпера: вызов, проза — или вызов, который не удалось разобрать.
 *
 * Разбор точный, а не «до ближайшей скобки»: имя хелпера встречается и в прозе комментариев,
 * и в строке импорта, и поиск ближайшей `(` в таком месте приписал бы файлу путь чужого
 * вызова. Дженерик пропускается со счётом угловых скобок — иначе не разобрать ни
 * `apiGet<Array<{ id: string }>>(`, ни `apiPost<{ requestId: string }>(`, а именно на них
 * сломалась первая версия: четыре эндпоинта из 175 не увидела.
 *
 * Третий исход — `unparsed` — существует потому, что молчаливый пропуск здесь опаснее ошибки:
 * дженерик, разнесённый по строкам, выглядел бы как проза, эндпоинт исчез бы из инвентаря, а
 * пол в 175 остался бы удовлетворён, если рядом добавили другой вызов.
 */
type CallStart = { kind: 'call'; start: number } | { kind: 'prose' } | { kind: 'unparsed' }

function callArgsStart(src: string, afterName: number): CallStart {
  let i = afterName
  while (src[i] === ' ') i += 1
  if (src[i] === '(') return { kind: 'call', start: i + 1 }
  if (src[i] !== '<') return { kind: 'prose' }

  let depth = 0
  while (i < src.length) {
    const c = src[i]
    if (c === '<') depth += 1
    else if (c === '>') {
      depth -= 1
      if (depth === 0) {
        i += 1
        break
      }
    } else if (c === '\n' || c === '(' || c === ')') {
      // Дженерик обязан быть в одну строку — иначе это вызов, которого разбор не видит.
      return { kind: 'unparsed' }
    }
    i += 1
  }
  while (src[i] === ' ') i += 1
  return src[i] === '(' ? { kind: 'call', start: i + 1 } : { kind: 'unparsed' }
}

function isSourceFile(path: string): boolean {
  if (!path.endsWith('.ts') && !path.endsWith('.vue')) return false
  if (path.endsWith('.spec.ts')) return false
  if (path.includes('/mocks/')) return false
  // Сам чекер и сами хелперы: их определения и примеры — не вызовы приложения.
  return !path.endsWith('/services/api.ts') && !path.endsWith('/services/contractInventory.ts')
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (isSourceFile(full)) out.push(full)
  }
  return out
}

/** Нормализация: `${orderId}` и `:orderId` — оба `:id`. Имя параметра свободно. */
function normalizePath(path: string): string {
  return path.replace(/\$\{[^}]*\}/g, ':id').replace(/:[A-Za-z]\w*/g, ':id')
}

function lineOf(src: string, index: number): number {
  let line = 1
  for (let i = 0; i < index; i += 1) if (src[i] === '\n') line += 1
  return line
}

/** Домен эндпоинта — первый сегмент после `/api/`. Он же имя файла контракта. */
export function domainOf(key: EndpointKey): string {
  const path = key.slice(key.indexOf(' ') + 1)
  return path.replace(/^\/api\//, '').split('/')[0] ?? ''
}

export interface CodeScan {
  /** Найденные эндпоинты. */
  endpoints: Map<EndpointKey, CodeEndpoint>
  /**
   * Вызовы хелпера, у которых первый аргумент не строковый литерал (`файл:строка`).
   *
   * Проверять это по файлам недостаточно, и это выяснила инверсия: `apiGet(mePath)` в файле,
   * где есть ещё три литеральных вызова, множество «файлы с вызовом» не меняет вовсе —
   * эндпоинт исчезает из инвентаря молча. Поэтому счёт идёт по вызову.
   */
  nonLiteralCalls: string[]
  /** Вызовы с литералом вне пространства `/api/` (`файл:строка → путь`). */
  outsideApiCalls: string[]
  /**
   * Вызовы, которые разбор опознал как вызов и не смог прочитать (`файл:строка`).
   *
   * Чаще всего — дженерик, разнесённый по строкам. Молча пропущенный такой вызов уменьшает
   * инвентарь, не роняя ни одной проверки.
   */
  unparsedCalls: string[]
  /** Файлы, из которых удалось извлечь хотя бы один путь-литерал. */
  filesWithEndpoint: Set<string>
  /** Файлы, где вообще встречается литерал вида `/api/...`. */
  filesWithApiLiteral: Set<string>
}

/**
 * Скан кода приложения. Моки и спеки исключены: контракт описывает то, что приложение
 * запрашивает, а не то, чем мок отвечает.
 */
export function scanCode(): CodeScan {
  const root = frontendRoot()
  const endpoints = new Map<EndpointKey, CodeEndpoint>()
  const nonLiteralCalls: string[] = []
  const outsideApiCalls: string[] = []
  const unparsedCalls: string[] = []
  const filesWithEndpoint = new Set<string>()
  const filesWithApiLiteral = new Set<string>()

  for (const file of walk(join(root, 'src'))) {
    const rel = relative(root, file)
    const src = readFileSync(file, 'utf8')
    // Кавычки все три: `"/api/…"` в шаблоне .vue — такой же литерал, как одинарный.
    if (/['"`]\/api\//.test(src)) filesWithApiLiteral.add(rel)

    for (const mention of src.matchAll(MENTION)) {
      const call = callArgsStart(src, mention.index + mention[0].length)
      const at = `${rel}:${lineOf(src, mention.index)}`
      if (call.kind === 'prose') continue
      if (call.kind === 'unparsed') {
        unparsedCalls.push(at)
        continue
      }
      const arg = FIRST_ARG.exec(src.slice(call.start))
      if (!arg?.[1]) {
        nonLiteralCalls.push(at)
        continue
      }
      const raw = arg[1].slice(1, -1)
      if (!raw.startsWith('/api/')) {
        outsideApiCalls.push(`${at} → ${raw}`)
        continue
      }
      const helper = mention[1] ?? ''
      const method = helper === 'Upload' ? 'POST' : helper.toUpperCase()
      const key = `${method} ${normalizePath(raw)}`
      filesWithEndpoint.add(rel)
      if (!endpoints.has(key)) endpoints.set(key, { source: at })
    }
  }
  return {
    endpoints,
    nonLiteralCalls,
    outsideApiCalls,
    unparsedCalls,
    filesWithEndpoint,
    filesWithApiLiteral,
  }
}

/** Эндпоинты, описанные в контракте. Читаются ТОЛЬКО заголовки `### МЕТОД /api/...`. */
export function scanContract(): Map<EndpointKey, DocEndpoint> {
  const out = new Map<EndpointKey, DocEndpoint>()
  const dir = contractDir()
  let files: string[]
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.md'))
  } catch {
    // Каталога ещё нет — ни один домен не сведён. Это состояние храповика, не ошибка.
    return out
  }
  for (const file of files) {
    const lines = readFileSync(join(dir, file), 'utf8').split('\n')
    lines.forEach((line, i) => {
      const m = /^### (GET|POST|PUT|PATCH|DELETE) (\/api\/\S*)\s*$/.exec(line)
      if (!m?.[1] || !m[2]) return
      const key = `${m[1]} ${normalizePath(m[2])}`
      if (out.has(key)) return
      out.set(key, { file, line: i + 1, planned: isPlanned(lines, i) })
    })
  }
  return out
}

/** Есть ли у раздела метка `Статус: спроектировано` — до следующего заголовка. */
function isPlanned(lines: string[], headingIndex: number): boolean {
  for (let i = headingIndex + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    if (line.startsWith('#')) return false
    if (/^\*{0,2}Статус:\*{0,2}\s*спроектировано/.test(line)) return true
  }
  return false
}

/** Роуты бэкенда: `МЕТОД /api/путь` → `файл:строка`. Пустая карта, если каталога нет. */
export function scanBackend(): Map<EndpointKey, string> {
  const out = new Map<EndpointKey, string>()
  const root = resolve(frontendRoot(), '../backend/app')
  let files: string[]
  try {
    files = walkPy(root)
  } catch {
    return out
  }
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    const prefix = /APIRouter\(prefix="([^"]*)"/.exec(src)?.[1] ?? ''
    for (const m of src.matchAll(/@router\.(get|post|put|patch|delete)\(\s*"([^"]*)"/g)) {
      const method = (m[1] ?? '').toUpperCase()
      const path = normalizePath(`${prefix}${m[2] ?? ''}`.replace(/\{[^}]*\}/g, ':id'))
      if (!path.startsWith('/api/')) continue
      const key = `${method} ${path}`
      if (!out.has(key)) {
        out.set(key, `${relative(resolve(frontendRoot(), '..'), file)}:${lineOf(src, m.index)}`)
      }
    }
  }
  return out
}

function walkPy(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === '__pycache__') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walkPy(full, out)
    else if (full.endsWith('.py')) out.push(full)
  }
  return out
}

/**
 * Ветки роутинга мока: `МЕТОД /api/путь` → строка в `mocks/index.ts`.
 *
 * Разбор идёт по всему тексту, а не построчно, и шаблон читается до закрывающего `$/`: вызов
 * `path.match(` бывает многострочным, а класс `[^/]` содержит слэш. На обоих спотыкались первые
 * версии этого извлечения — одна показала 96 «отсутствующих моков» вместо одного.
 */
export function scanMockRoutes(): Map<EndpointKey, number> {
  const out = new Map<EndpointKey, number>()
  const file = join(frontendRoot(), 'src/services/mocks/index.ts')
  let src: string
  try {
    src = readFileSync(file, 'utf8')
  } catch {
    return out
  }
  const routers = [...src.matchAll(/async function (get|post|put|patch|delete|upload)MockRoute/g)]
    .map((m) => ({ at: m.index, method: (m[1] ?? '').toUpperCase() }))
    .sort((a, b) => a.at - b.at)
  const methodAt = (pos: number): string | null => {
    let cur: string | null = null
    for (const r of routers) {
      if (r.at <= pos) cur = r.method === 'UPLOAD' ? 'POST' : r.method
      else break
    }
    return cur
  }
  const add = (pos: number, rawPath: string): void => {
    const method = methodAt(pos)
    if (!method) return
    const path = normalizePath(rawPath)
    if (!path.startsWith('/api/')) return
    const key = `${method} ${path}`
    if (!out.has(key)) out.set(key, lineOf(src, pos))
  }
  for (const m of src.matchAll(/path === '(\/api\/[^']*)'/g)) add(m.index, m[1] ?? '')
  for (const m of src.matchAll(/path\.match\(\s*\/\^([\s\S]*?)\$\//g)) {
    const raw = (m[1] ?? '')
      .replace(/\\\//g, '/')
      .replace(/\\\./g, '.')
      .replace(/\([^)]*\)/g, ':id')
    add(m.index, raw)
  }
  return out
}

/** Домены, у которых доменный файл уже существует, — то есть сведённые. */
export function syncedDomains(): Set<string> {
  try {
    return new Set(
      readdirSync(contractDir())
        .filter((f) => f.endsWith('.md') && f !== 'README.md' && !f.startsWith('00-'))
        .map((f) => f.replace(/\.md$/, '')),
    )
  } catch {
    return new Set()
  }
}
