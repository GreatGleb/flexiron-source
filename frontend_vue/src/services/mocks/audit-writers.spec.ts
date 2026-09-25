/**
 * Каждая мутация домена оставляет след — §5.2 сквозного плана аудит-лога
 * (`roo_code/plans/general/сквозное-audit-log-план.md`).
 *
 * Храповик по образцу `contract-conformance.spec.ts`: пороги и исключения ниже сняты с
 * сегодняшнего кода, а не выдуманы. Общего списка изъятий без причины нет — исключение это
 * строка `{ domain, operation, reason }`, и пустой `reason` красит отдельный тест
 * («исключения несут причину»), а не проходит молча.
 *
 * Извлечение операций — грep-счёт, а не суждение (правило А плана): экспортируемая
 * `mock*`-функция домена, в теле которой есть присваивание в поле или элемент объекта
 * хранилища (`order.notes = …`, `STORE[idx] = …`). У этого счёта есть известная слепая зона —
 * мутация, сделанная целиком внутри вызываемого хелпера (`applyPricing(line, pricing)`), тут не
 * видна, — и известная ложная тревога — присваивание в локальный аккумулятор снаружи
 * хранилища. Обе стороны этой сделки видны в исключениях ниже по конкретной причине, а не
 * спрятаны.
 *
 * Моки этой задачей не правятся: ни один файл `src/services/mocks/` кроме этой спеки не
 * менялся, и в журнал ни одна запись не добавлена.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// ─── Извлечение: функции файла ──────────────────────────────────────────────

export interface FunctionInfo {
  name: string
  exported: boolean
  start: number
  end: number
  body: string
}

/** Балансирует скобки параметров, затем фигурные скобки тела, начиная с позиции имени функции. */
function captureFunctionBody(
  source: string,
  afterName: number,
): { start: number; end: number; body: string } | null {
  const parenStart = source.indexOf('(', afterName)
  if (parenStart === -1) return null
  let parenDepth = 0
  let i = parenStart
  for (; i < source.length; i++) {
    const ch = source[i]
    if (ch === '(') parenDepth++
    else if (ch === ')') {
      parenDepth--
      if (parenDepth === 0) {
        i++
        break
      }
    }
  }
  // Пропускаем аннотацию типа возврата до первой ФИГУРНОЙ скобки тела — она не первая
  // после параметров, если параметр или тип содержит объектный литерал типа.
  let braceStart = i
  while (braceStart < source.length && source[braceStart] !== '{') braceStart++
  if (source[braceStart] !== '{') return null
  let braceDepth = 0
  let k = braceStart
  for (; k < source.length; k++) {
    const ch = source[k]
    if (ch === '{') braceDepth++
    else if (ch === '}') {
      braceDepth--
      if (braceDepth === 0) {
        k++
        break
      }
    }
  }
  return { start: braceStart, end: k, body: source.slice(braceStart, k) }
}

/** Каждая именованная функция верхнего уровня файла — экспортируемая и приватная. */
export function extractFunctions(source: string): FunctionInfo[] {
  const results: FunctionInfo[] = []
  const re = /(export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) {
    const captured = captureFunctionBody(source, m.index)
    if (!captured) continue
    results.push({
      name: m[2]!,
      exported: Boolean(m[1]),
      start: captured.start,
      end: captured.end,
      body: captured.body,
    })
  }
  return results
}

/** Экспортируемые `mock*`-функции — операции, которые считает §5.2. */
export function extractMockFunctions(source: string): FunctionInfo[] {
  return extractFunctions(source).filter((fn) => fn.exported && fn.name.startsWith('mock'))
}

// ─── Проверка 1: мутирует ли операция объект хранилища ──────────────────────

/**
 * Присваивание в поле (`.prop =`) или элемент (`[idx] =`) объекта, включая составное
 * (`+=`, `-=`, …). Сравнения (`==`, `===`, `!==`, `<=`, `>=`) не совпадают: символ сравнения
 * перед `=` не входит в класс составных операторов, поэтому regex не находит там `=` вовсе —
 * кроме `==`/`===`, которые ловятся отдельной проверкой символа сразу после совпадения.
 * Аннотация типа массива (`Foo[] = …`) исключена требованием непустого содержимого скобок.
 */
const ASSIGNMENT_RE = /(\.[A-Za-z_$][\w$]*|\[[^\]\n]+\])\s*[-+*/%&|^]?=/g

export function isMutatingOperation(body: string): boolean {
  const re = new RegExp(ASSIGNMENT_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    const afterEquals = m.index + m[0].length
    if (body[afterEquals] === '=') continue // ==, ===
    return true
  }
  return false
}

// ─── Проверка 2: пишет ли операция в журнал ─────────────────────────────────

const AUDIT_LOG_PUSH_RE = /\bauditLog\.(?:push|unshift)\s*\(/

/** Пишет буквально (`auditLog.push(...)`) или зовёт общего писателя домена по имени. */
export function writesJournal(body: string, writerCalls: readonly string[] = []): boolean {
  if (AUDIT_LOG_PUSH_RE.test(body)) return true
  return writerCalls.some((name) => new RegExp(`\\b${name}\\s*\\(`).test(body))
}

// ─── Проверка 3: чья функция несёт каждый push в auditLog ───────────────────

export function auditLogPushIndices(source: string): number[] {
  const re = new RegExp(AUDIT_LOG_PUSH_RE.source, 'g')
  const indices: number[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) indices.push(m.index)
  return indices
}

/** Самая маленькая (самая внутренняя) из функций, содержащих индекс — или `null` на верхнем уровне. */
export function enclosingFunctionName(
  index: number,
  functions: readonly FunctionInfo[],
): string | null {
  const containing = functions.filter((fn) => index >= fn.start && index < fn.end)
  if (containing.length === 0) return null
  containing.sort((a, b) => a.end - a.start - (b.end - b.start))
  return containing[0]!.name
}

/** Имена всех функций файла, внутри которых лежит хотя бы один push в `auditLog`. */
export function pushEnclosures(source: string): string[] {
  const functions = extractFunctions(source)
  const names = auditLogPushIndices(source).map((idx) => enclosingFunctionName(idx, functions))
  return [...new Set(names.filter((n): n is string => n !== null))].sort()
}

// ─── Именованные исключения ──────────────────────────────────────────────────

export interface NamedException {
  domain: string
  operation: string
  reason: string
}

/** Исключения без причины — это находка теста, а не пропуск проверки. */
export function invalidExceptions(exceptions: readonly NamedException[]): NamedException[] {
  return exceptions.filter((e) => e.reason.trim().length === 0)
}

// ─── Утверждения §5.2 как чистые функции ────────────────────────────────────

export function inventoryShortfall(found: number, floor: number): string[] {
  return found < floor ? [`извлечено ${found} мутирующих операций, пол ${floor}`] : []
}

/** Нарушители утверждения 2: мутирует, не пишет, не исключена. */
export function classAViolations(
  domain: string,
  source: string,
  writerCalls: readonly string[],
  exceptions: readonly NamedException[],
): string[] {
  const excepted = new Set(exceptions.filter((e) => e.domain === domain).map((e) => e.operation))
  return extractMockFunctions(source)
    .filter((fn) => isMutatingOperation(fn.body))
    .filter((fn) => !writesJournal(fn.body, writerCalls))
    .filter((fn) => !excepted.has(fn.name))
    .map((fn) => `${domain}:${fn.name}`)
}

/** Нарушители утверждения 3: домен класса E, а мутация всё же пишет в журнал. */
export function classEViolations(domain: string, source: string): string[] {
  return extractMockFunctions(source)
    .filter((fn) => isMutatingOperation(fn.body))
    .filter((fn) => writesJournal(fn.body, []))
    .map((fn) => `${domain}:${fn.name}`)
}

/** Нарушители утверждения 4: у домена в файле больше одной не-исключённой функции-писателя. */
export function rogueWriters(
  domain: string,
  source: string,
  exceptions: readonly NamedException[],
): string[] {
  const excepted = new Set(exceptions.filter((e) => e.domain === domain).map((e) => e.operation))
  const remaining = pushEnclosures(source).filter((name) => !excepted.has(name))
  return remaining.length > 1 ? remaining : []
}

// ─── Домены и файлы ──────────────────────────────────────────────────────────

/** Класс A — домены, владеющие видом сущности (§4 плана): пишут в журнал каждую мутацию. */
const CLASS_A_FILES: Record<string, string> = {
  products: 'products.ts',
  orders: 'orders.ts',
  clients: 'clients.ts',
  suppliers: 'suppliers.ts',
  warehouse: 'warehouse.ts',
}

/**
 * Класс E — домены без вида сущности (§4 плана): в журнал не пишут ничего. `uploads` и
 * `sales-crm` своего файла мока не имеют — `uploads` не мутирует ничего своего (пишет в чужой
 * журнал), `sales-crm` делит мок и типы с `orders` (правило E3) — оба тривиально пусты для
 * этой проверки, добавлять для них нечего.
 */
const CLASS_E_FILES: Record<string, string> = {
  bcc: 'bcc.ts',
  categories: 'categories.ts',
  services: 'services.ts',
  finance: 'finance.ts',
  notifications: 'notifications.ts',
  analytics: 'analytics.ts',
}

/** Домен → имена функций, которые считаются общим писателем журнала. Пусто — писателя нет. */
const WRITER_CALLS: Record<string, readonly string[]> = {
  orders: ['appendHistory', 'recordInHistory'],
}

function readMock(file: string): string {
  return readFileSync(resolve(process.cwd(), 'src/services/mocks', file), 'utf8')
}

const sourcesA = Object.fromEntries(
  Object.entries(CLASS_A_FILES).map(([domain, file]) => [domain, readMock(file)]),
)
const sourcesE = Object.fromEntries(
  Object.entries(CLASS_E_FILES).map(([domain, file]) => [domain, readMock(file)]),
)
const allSources = { ...sourcesA, ...sourcesE }

/**
 * Пол инвентаря — замер 2026-09-25 по текущему коду `src/services/mocks/`: 23 мутирующие
 * операции суммарно по одиннадцати файлам (products 1, orders 8, clients 1, suppliers 4,
 * warehouse 3, bcc 1, categories 2, services 1, finance 1, notifications 1, analytics 0).
 * Ниже этого числа — сломанное извлечение, а не более чистый код.
 */
const INVENTORY_FLOOR = 23

const totalMutating = Object.values(allSources).reduce(
  (sum, source) =>
    sum + extractMockFunctions(source).filter((fn) => isMutatingOperation(fn.body)).length,
  0,
)

// ─── Исключения — сегодняшнее состояние, не желаемое ────────────────────────

/**
 * Класс A: мутирующие операции, которые сегодня не пишут в журнал. Пишет пока меньшинство
 * доменов — только `orders`, и не всеми своими операциями (план: 6 путей записи из 24 мутаций).
 * Остальные четыре домена класса A писателя журнала ещё не завели вовсе (план §8.1).
 */
const NOT_WRITING_EXCEPTIONS: NamedException[] = [
  {
    domain: 'products',
    operation: 'mockPatchProduct',
    reason:
      'products ещё не подключён к общему писателю — план `products-backend-plan.md` фиксирует замер «пишут сегодня» 0 из 4.',
  },
  {
    domain: 'orders',
    operation: 'mockPatchOrder',
    reason:
      'правка полей заказа (`notes`, `currency`, `vatPercent` и другие) не входит в шесть сегодняшних путей записи — план `orders-backend-plan.md` называет 6 пишущих из 24 мутирующих.',
  },
  {
    domain: 'orders',
    operation: 'mockCreateShipment',
    reason:
      'отгрузка меняет `item.shippedQuantity` и `shipLine.heldReleased` без вызова `appendHistory`/`recordInHistory` — не входит в шесть сегодняшних путей записи.',
  },
  {
    domain: 'orders',
    operation: 'mockCreateInvoice',
    reason:
      'выставление счёта меняет `item.documentIssued` без вызова общего писателя — не входит в шесть сегодняшних путей записи.',
  },
  {
    domain: 'clients',
    operation: 'mockAddClientInteraction',
    reason:
      'взаимодействие клиента — человеческая запись `InteractionHistoryEntry`, а не машинный след; правило Ж сквозного плана прямо выводит её из журнала.',
  },
  {
    domain: 'suppliers',
    operation: 'mockGetSupplier',
    reason:
      'пишет в кэш карточки `MOCK_CARD`, а не в состояние домена; писателя журнала у suppliers сегодня нет вовсе (план `suppliers-backend-plan.md`).',
  },
  {
    domain: 'suppliers',
    operation: 'mockPatchSupplier',
    reason:
      'suppliers ещё не подключён к общему писателю — план `suppliers-backend-plan.md` называет ноль пишущих операций сегодня.',
  },
  {
    domain: 'suppliers',
    operation: 'mockUpdateSupplierStatus',
    reason:
      'suppliers ещё не подключён к общему писателю — план `suppliers-backend-plan.md` называет ноль пишущих операций сегодня.',
  },
  {
    domain: 'suppliers',
    operation: 'mockCreateSupplier',
    reason:
      'создание поставщика пишет только в кэш карточки `MOCK_CARD`, не в аудит-журнал; писателя у домена нет (план `suppliers-backend-plan.md`).',
  },
  {
    domain: 'warehouse',
    operation: 'mockPatchBatch',
    reason:
      'warehouse ещё не завёл писателя журнала — план `warehouse-backend-plan.md` перечисляет операции прозой, без числа и без записи.',
  },
  {
    domain: 'warehouse',
    operation: 'mockGetBatchAggregates',
    reason:
      'присваивания идут в локальный аккумулятор `byType`, а не в поле сущности склада — совпадение эвристики на чтении, не мутация домена.',
  },
  {
    domain: 'warehouse',
    operation: 'mockGetBatchActiveSales',
    reason:
      'присваивание идёт в локальный аккумулятор `returnQtyByRef`, а не в хранимую сущность — совпадение эвристики на чтении, не мутация домена.',
  },
]

/**
 * Функции, внутри которых лежит push в `auditLog`, но которые не являются общим писателем
 * домена. Сегодня одна: `generateOrders` строит литерал истории демо-заказа до того, как заказ
 * попадает в `STORE`, — это заполнение сид-данных, а не runtime-путь записи.
 */
const PUSH_ENCLOSURE_EXCEPTIONS: NamedException[] = [
  {
    domain: 'orders',
    operation: 'generateOrders',
    reason:
      'строит литерал `auditLog` демо-заказа до его появления в `STORE` — заполнение сид-данных, не runtime-путь записи; для уже созданных заказов единственный писатель — `appendHistory`.',
  },
]

// ─── Утверждения раздела 5.2 ─────────────────────────────────────────────────

describe('§5.2 · пол инвентаря', () => {
  it('находит не меньше замеренного минимума мутирующих операций', () => {
    expect(inventoryShortfall(totalMutating, INVENTORY_FLOOR)).toEqual([])
  })

  it('инверсия: пустой синтетический файл даёт меньше пола', () => {
    const empty = 'export const nothing = 1\n'
    const found = extractMockFunctions(empty).filter((fn) => isMutatingOperation(fn.body)).length
    expect(inventoryShortfall(found, INVENTORY_FLOOR)).not.toEqual([])
  })
})

describe('§5.2 · каждая мутирующая операция класса A пишет в журнал', () => {
  it('пишет сама или отмечена исключением с причиной', () => {
    const violators = Object.entries(sourcesA).flatMap(([domain, source]) =>
      classAViolations(domain, source, WRITER_CALLS[domain] ?? [], NOT_WRITING_EXCEPTIONS),
    )
    expect(violators, 'мутирует и не пишет, и не исключена').toEqual([])
  })

  it('инверсия: синтетическая мутация без записи и без исключения нарушает', () => {
    const synthetic = `
      export function mockDoSomething(id: string): void {
        const thing = STORE.find((t) => t.id === id)
        thing.value = 42
      }
    `
    expect(classAViolations('synthetic', synthetic, [], [])).toEqual(['synthetic:mockDoSomething'])
  })
})

describe('§5.2 · ни одна операция класса E не пишет в журнал', () => {
  it('ни один мутирующий `mock*` класса E не зовёт писатель и не пушит буквально', () => {
    const violators = Object.entries(sourcesE).flatMap(([domain, source]) =>
      classEViolations(domain, source),
    )
    expect(violators, 'домен класса E не должен писать в журнал вовсе').toEqual([])
  })

  it('инверсия: синтетическая мутация класса E, пишущая буквально, нарушает', () => {
    const synthetic = `
      export function mockDoSomethingElse(id: string): void {
        const thing = STORE.find((t) => t.id === id)
        thing.value = 42
        auditLog.push({ id })
      }
    `
    expect(classEViolations('synthetic', synthetic)).toEqual(['synthetic:mockDoSomethingElse'])
  })
})

describe('§5.2 · ни один push в auditLog не идёт мимо общего писателя', () => {
  it('у каждого домена не больше одной не исключённой функции-писателя', () => {
    const violators = Object.entries(allSources).flatMap(([domain, source]) =>
      rogueWriters(domain, source, PUSH_ENCLOSURE_EXCEPTIONS),
    )
    expect(violators, 'у домена больше одной функции пишет в auditLog напрямую').toEqual([])
  })

  it('инверсия: два независимых push в синтетическом файле нарушают', () => {
    const synthetic = `
      function writerOne(order) {
        order.auditLog.push({ id: 1 })
      }
      function writerTwo(order) {
        order.auditLog.push({ id: 2 })
      }
    `
    expect(rogueWriters('synthetic', synthetic, [])).toEqual(['writerOne', 'writerTwo'])
  })
})

describe('храповик · исключения несут причину', () => {
  it('ни одно исключение не пустое', () => {
    expect(invalidExceptions([...NOT_WRITING_EXCEPTIONS, ...PUSH_ENCLOSURE_EXCEPTIONS])).toEqual([])
  })

  it('инверсия: пустая причина обязана попасть в список нарушителей', () => {
    const broken: NamedException[] = [{ domain: 'x', operation: 'y', reason: '   ' }]
    expect(invalidExceptions(broken)).toEqual(broken)
  })
})
