/**
 * Сторож раздела `## Права домена` в контракте — §6/П-1…П-12 из
 * `roo_code/plans/general/сквозное-rights-план.md`, раздел 5.1.
 *
 * Обход доменных файлов — тем же инвентарём, что и `contract-conformance.spec.ts`:
 * `syncedDomains()`, `scanContract()`, `domainOf()`. Второго обхода каталога здесь нет.
 *
 * Храповик — форма как у `ENDPOINT_FLOOR`/`EXPECT_ALL_DOMAINS` в `contract-conformance.spec.ts`:
 * ни один доменный файл сегодня не завёл `## Права домена`, поэтому `RIGHTS_DONE` начинается
 * пустым и требующие утверждения (П-1…П-7, П-10…П-12) не применяются ни к одному домену.
 * Запрещающие (П-8, П-9) применяются ко всем файлам сразу и красным с рождения не бывают.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { contractDir, domainOf, scanContract, syncedDomains } from './contractInventory'

/** Домены, у которых раздел `## Права домена` уже написан. Пуст, пока доменная фаза не началась. */
export const RIGHTS_DONE: string[] = []

/** Пол — длина `RIGHTS_DONE` не должна уменьшаться. */
export const RIGHTS_FLOOR = 0

/** Включается, когда `RIGHTS_DONE` содержит все 17 доменов (задача Р-3 плана). */
export const EXPECT_ALL_RIGHTS: boolean = false

const byText = (a: string, b: string): number => a.localeCompare(b)

// ─────────────────────────────────────────────────────────────────────────
// Роли — читаются из объявления `UserRole`, а не переписаны списком здесь.
// ─────────────────────────────────────────────────────────────────────────

/** Извлекает строчные значения union-типа `UserRole` из его исходника. */
export function extractUserRoles(source: string): string[] {
  const start = source.indexOf('export type UserRole =')
  if (start === -1) return []
  const rest = source.slice(start)
  const blockEnd = rest.indexOf('\n\n')
  const block = blockEnd === -1 ? rest : rest.slice(0, blockEnd)
  return [...block.matchAll(/'([a-z]+)'/g)].map((m) => m[1] ?? '')
}

function readUserRoles(): string[] {
  const path = join(process.cwd(), 'src/types/settings.ts')
  return extractUserRoles(readFileSync(path, 'utf8'))
}

const USER_ROLES = readUserRoles()

// ─────────────────────────────────────────────────────────────────────────
// Разбор раздела «## Права домена» и его трёх таблиц.
// ─────────────────────────────────────────────────────────────────────────

const RIGHTS_HEADING = '## Права домена'

export const TABLE_HEADERS = {
  elements: '| Элемент | Тип | Родитель | Что закрывает |',
  endpoints: '| Эндпоинт | Элемент | Действие | Почему не умолчание |',
  roles: (roles: string[]): string => `| Элемент | ${roles.join(' | ')} |`,
}

/** Тело первого раздела `## Права домена` документа — до следующего `## ` или конца файла. */
export function rightsSectionBody(text: string): string | null {
  const lines = text.split('\n')
  const idx = lines.findIndex((l) => l.trim() === RIGHTS_HEADING)
  if (idx === -1) return null
  let end = idx + 1
  while (end < lines.length && !(lines[end] ?? '').startsWith('## ')) end += 1
  return lines.slice(idx + 1, end).join('\n')
}

/** Строки markdown-таблицы под заданной шапкой (шапка + строка-разделитель пропускаются). */
export function tableRows(body: string, headerLine: string): string[][] {
  const lines = body.split('\n')
  const idx = lines.findIndex((l) => l.trim() === headerLine)
  if (idx === -1) return []
  const rows: string[][] = []
  for (let i = idx + 2; i < lines.length; i += 1) {
    const line = (lines[i] ?? '').trim()
    if (!line.startsWith('|')) break
    rows.push(
      line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim()),
    )
  }
  return rows
}

// ─────────────────────────────────────────────────────────────────────────
// П-1…П-12 — по одной чистой функции на утверждение.
// ─────────────────────────────────────────────────────────────────────────

/** П-1: ровно один заголовок `## Права домена`. */
export function checkSingleHeading(text: string): string[] {
  const n = (text.match(/^## Права домена\s*$/gm) ?? []).length
  return n === 1 ? [] : [`заголовков «${RIGHTS_HEADING}»: ${n}`]
}

/** П-2: под заголовком есть все три таблицы с шапками Д2, Д3, Д4. */
export function checkThreeTables(text: string): string[] {
  const body = rightsSectionBody(text) ?? ''
  const violators: string[] = []
  if (!body.includes(TABLE_HEADERS.elements)) violators.push('нет таблицы 1 (элементы, Д2)')
  if (!body.includes(TABLE_HEADERS.endpoints)) violators.push('нет таблицы 2 (эндпоинты, Д3)')
  if (!body.includes(TABLE_HEADERS.roles(USER_ROLES))) violators.push('нет таблицы 3 (роли, Д4)')
  return violators
}

/** П-3: каждый элемент таблицы 1 — вида `домен.идентификатор`, и `домен` равен имени файла. */
export function checkElementForm(domain: string, text: string): string[] {
  const body = rightsSectionBody(text) ?? ''
  const violators: string[] = []
  for (const row of tableRows(body, TABLE_HEADERS.elements)) {
    const el = row[0] ?? ''
    const m = /^([a-z][a-z0-9-]*)\.([a-z][a-z0-9-]*)$/.exec(el)
    if (!m) {
      violators.push(`элемент «${el}» не в форме домен.идентификатор`)
      continue
    }
    if (m[1] !== domain) violators.push(`элемент «${el}» назвал чужой домен, ожидался «${domain}»`)
  }
  return violators
}

/** П-4: элементы уникальны по всем документам, переданным вместе. */
export function checkElementUniqueness(docs: Array<{ domain: string; text: string }>): string[] {
  const owner = new Map<string, string>()
  const violators: string[] = []
  for (const { domain, text } of docs) {
    const body = rightsSectionBody(text) ?? ''
    for (const row of tableRows(body, TABLE_HEADERS.elements)) {
      const el = row[0] ?? ''
      if (!el) continue
      const prior = owner.get(el)
      if (prior && prior !== domain) {
        violators.push(`элемент «${el}» объявлен и в «${prior}», и в «${domain}»`)
      } else {
        owner.set(el, domain)
      }
    }
  }
  return violators
}

const VALID_ACTIONS = new Set(['read', 'edit', 'create', 'delete'])

/** П-5: каждый известный эндпоинт домена встречается в таблице 2 ровно один раз с валидным действием. */
export function checkEndpointCoverage(text: string, domainEndpoints: string[]): string[] {
  const body = rightsSectionBody(text) ?? ''
  const rows = tableRows(body, TABLE_HEADERS.endpoints)
  const counts = new Map<string, number>()
  for (const row of rows) {
    const ep = row[0] ?? ''
    counts.set(ep, (counts.get(ep) ?? 0) + 1)
  }
  const violators: string[] = []
  for (const ep of domainEndpoints) {
    const n = counts.get(ep) ?? 0
    if (n === 0) violators.push(`эндпоинт «${ep}» не встречается в таблице 2`)
    else if (n > 1) violators.push(`эндпоинт «${ep}» встречается в таблице 2 ${n} раз(а)`)
  }
  for (const row of rows) {
    const [ep, , action] = row
    if (action !== undefined && action !== 'не требуется' && !VALID_ACTIONS.has(action)) {
      violators.push(`эндпоинт «${ep}» — недопустимое действие «${action}»`)
    }
  }
  return violators
}

/** П-6: каждый элемент таблиц 2 и 3 объявлен в таблице 1; прочерк в таблице 2 — только у «не требуется». */
export function checkElementReferencesExist(text: string): string[] {
  const body = rightsSectionBody(text) ?? ''
  const known = new Set(tableRows(body, TABLE_HEADERS.elements).map((r) => r[0] ?? ''))
  const violators: string[] = []
  for (const row of tableRows(body, TABLE_HEADERS.endpoints)) {
    const [ep, element, action] = row
    if (element === '—') {
      if (action !== 'не требуется') {
        violators.push(`«${ep}» — прочерк элемента при действии «${action}», не «не требуется»`)
      }
      continue
    }
    if (element && !known.has(element)) {
      violators.push(`«${ep}» ссылается на неизвестный элемент «${element}»`)
    }
  }
  for (const row of tableRows(body, TABLE_HEADERS.roles(USER_ROLES))) {
    const element = row[0] ?? ''
    if (element && !known.has(element)) {
      violators.push(`таблица 3 ссылается на неизвестный элемент «${element}»`)
    }
  }
  return violators
}

/** П-7: шапка таблицы 3 — ровно роли `UserRole` по порядку; в клетках — только действия и «—». */
export function checkRoleTable(text: string, roles: string[]): string[] {
  const body = rightsSectionBody(text) ?? ''
  const headerLine = TABLE_HEADERS.roles(roles)
  const lines = body.split('\n')
  if (!lines.some((l) => l.trim() === headerLine)) {
    return [`шапка таблицы 3 не совпадает с ролями [${roles.join(', ')}]`]
  }
  const violators: string[] = []
  for (const row of tableRows(body, headerLine)) {
    const element = row[0] ?? ''
    roles.forEach((role, i) => {
      const cell = (row[i + 1] ?? '').trim()
      if (cell === '—' || cell === '') return
      for (const action of cell.split(',').map((s) => s.trim())) {
        if (!VALID_ACTIONS.has(action)) {
          violators.push(`«${element}» — роль «${role}»: недопустимое значение «${action}»`)
        }
      }
    })
  }
  return violators
}

/** Переходные коды П15, названы владельцем к удалению вместе с формой (Р6); других исключений нет. */
export const FORBIDDEN_CODE_EXCEPTIONS: Record<string, string[]> = {
  'orders.md': ['FORBIDDEN_MANUALCOST', 'FORBIDDEN_CORRECTION'],
}

/** П-8: ни один доменный файл не заводит кода `FORBIDDEN_*`, кроме поимённо исключённых. */
export function checkNoForbiddenCodes(file: string, text: string): string[] {
  const found = new Set([...text.matchAll(/\bFORBIDDEN_[A-Z0-9_]+\b/g)].map((m) => m[0]))
  const allowed = new Set(FORBIDDEN_CODE_EXCEPTIONS[file] ?? [])
  return [...found].filter((c) => !allowed.has(c)).sort(byText)
}

const RIGHTS_DELIVERY_ENDPOINT = 'GET /api/auth/me/permissions'

/** П-9: только `auth.md` вправе описывать эндпоинт доставки прав. */
export function checkRightsDeliveryOwnership(file: string, text: string): string[] {
  if (file === 'auth.md') return []
  const violators: string[] = []
  for (const m of text.matchAll(/^### (GET|POST|PUT|PATCH|DELETE) (\/api\/\S*)\s*$/gm)) {
    const key = `${m[1]} ${(m[2] ?? '').replace(/:[A-Za-z]\w*/g, ':id')}`
    if (key === RIGHTS_DELIVERY_ENDPOINT)
      violators.push(`${file} описывает ${RIGHTS_DELIVERY_ENDPOINT}`)
  }
  return violators
}

const METHOD_DEFAULT: Record<string, string> = {
  GET: 'read',
  POST: 'create',
  PATCH: 'edit',
  PUT: 'edit',
  DELETE: 'delete',
}

/** П-10: действие совпадает с умолчанием по методу ⇔ столбец «Почему не умолчание» пуст. */
export function checkActionDefaults(text: string): string[] {
  const body = rightsSectionBody(text) ?? ''
  const violators: string[] = []
  for (const row of tableRows(body, TABLE_HEADERS.endpoints)) {
    const [ep, , action, why] = row
    if (!ep || action === 'не требуется') continue
    const method = ep.split(' ')[0] ?? ''
    const expected = METHOD_DEFAULT[method]
    if (!expected) continue
    const reasonFilled = Boolean(why && why.trim() !== '' && why.trim() !== '—')
    if (action === expected && reasonFilled) {
      violators.push(`«${ep}» — действие совпало с умолчанием, но столбец заполнен`)
    }
    if (action !== expected && !reasonFilled) {
      violators.push(
        `«${ep}» — действие «${action}» разошлось с умолчанием «${expected}», столбец пуст`,
      )
    }
  }
  return violators
}

const NO_RIGHT_REASONS = new Set(['публичный', 'служебный', 'собственные данные'])

/** П-11: строка «не требуется» — элемент «—» и причина из закрытого списка трёх. */
export function checkNoRightRows(text: string): string[] {
  const body = rightsSectionBody(text) ?? ''
  const violators: string[] = []
  for (const row of tableRows(body, TABLE_HEADERS.endpoints)) {
    const [ep, element, action, why] = row
    if (action !== 'не требуется') continue
    if (element !== '—')
      violators.push(`«${ep}» — действие «не требуется», элемент «${element}» не прочерк`)
    if (!why || !NO_RIGHT_REASONS.has(why.trim())) {
      violators.push(`«${ep}» — причина «${why}» не из закрытого списка трёх`)
    }
  }
  return violators
}

const REVENUE_ROLE_DEFAULT: Record<string, string> = {
  owner: 'read',
  admin: 'read',
  accounting: 'read',
}

/** П-12: у элемента выручки (таблица 1, «Что закрывает» упоминает выручку) — `read` ровно у owner/admin/accounting. */
export function checkRevenueDefaults(text: string, roles: string[]): string[] {
  const body = rightsSectionBody(text) ?? ''
  const revenueElements = tableRows(body, TABLE_HEADERS.elements)
    .filter((r) => /выручк/i.test(r[3] ?? ''))
    .map((r) => r[0] ?? '')
  if (revenueElements.length === 0) return []
  const roleRows = new Map(tableRows(body, TABLE_HEADERS.roles(roles)).map((r) => [r[0] ?? '', r]))
  const violators: string[] = []
  for (const el of revenueElements) {
    const row = roleRows.get(el)
    if (!row) {
      violators.push(`элемент выручки «${el}» отсутствует в таблице 3`)
      continue
    }
    roles.forEach((role, i) => {
      const cell = (row[i + 1] ?? '').trim()
      const expected = REVENUE_ROLE_DEFAULT[role] ?? '—'
      if (cell !== expected) {
        violators.push(
          `элемент выручки «${el}» — роль «${role}»: «${cell}», ожидалось «${expected}»`,
        )
      }
    })
  }
  return violators
}

// ─────────────────────────────────────────────────────────────────────────
// Данные прогона
// ─────────────────────────────────────────────────────────────────────────

const documented = scanContract()
const synced = syncedDomains()

function domainText(domain: string): string {
  return readFileSync(join(contractDir(), `${domain}.md`), 'utf8')
}

function domainEndpointsOf(domain: string): string[] {
  return [...documented.entries()].filter(([key]) => domainOf(key) === domain).map(([key]) => key)
}

// ─────────────────────────────────────────────────────────────────────────
// Утверждения
// ─────────────────────────────────────────────────────────────────────────

describe('храповик разделов прав', () => {
  it('RIGHTS_DONE не короче RIGHTS_FLOOR', () => {
    expect(RIGHTS_DONE.length).toBeGreaterThanOrEqual(RIGHTS_FLOOR)
  })
})

describe('П-1: ровно один заголовок «## Права домена»', () => {
  it('у каждого домена из RIGHTS_DONE', () => {
    const violators = RIGHTS_DONE.flatMap((d) =>
      checkSingleHeading(domainText(d)).map((v) => `${d}: ${v}`),
    )
    expect(violators).toEqual([])
  })

  it('инверсия: ноль и два заголовка красят', () => {
    expect(checkSingleHeading('# файл без раздела прав\n')).not.toEqual([])
    expect(checkSingleHeading('## Права домена\nx\n## Права домена\ny\n')).not.toEqual([])
  })
})

describe('П-2: три таблицы с шапками Д2, Д3, Д4', () => {
  it('у каждого домена из RIGHTS_DONE', () => {
    const violators = RIGHTS_DONE.flatMap((d) =>
      checkThreeTables(domainText(d)).map((v) => `${d}: ${v}`),
    )
    expect(violators).toEqual([])
  })

  it('инверсия: раздел без таблиц красит все три', () => {
    const fake = '## Права домена\nничего нет\n\n## Следующий раздел\n'
    expect(checkThreeTables(fake)).toHaveLength(3)
  })
})

describe('П-3: элемент — домен.идентификатор, домен совпадает с именем файла', () => {
  it('у каждого домена из RIGHTS_DONE', () => {
    const violators = RIGHTS_DONE.flatMap((d) =>
      checkElementForm(d, domainText(d)).map((v) => `${d}: ${v}`),
    )
    expect(violators).toEqual([])
  })

  it('инверсия: чужой домен и заглавные буквы красят', () => {
    const fake = [
      '## Права домена',
      TABLE_HEADERS.elements,
      '|---|---|---|---|',
      '| products.entity | entity | — | карточка |',
      '| Orders.Entity | entity | — | заказ |',
    ].join('\n')
    const violators = checkElementForm('orders', fake)
    expect(violators.some((v) => v.includes('products.entity'))).toBe(true)
    expect(violators.some((v) => v.includes('Orders.Entity'))).toBe(true)
  })
})

describe('П-4: элементы уникальны по документам RIGHTS_DONE', () => {
  it('во всех доменах сразу', () => {
    const docs = RIGHTS_DONE.map((d) => ({ domain: d, text: domainText(d) }))
    expect(checkElementUniqueness(docs)).toEqual([])
  })

  it('инверсия: один и тот же элемент в двух доменах красит', () => {
    const row = [
      TABLE_HEADERS.elements,
      '|---|---|---|---|',
      '| shared.thing | entity | — | x |',
    ].join('\n')
    const docs = [
      { domain: 'orders', text: `## Права домена\n${row}` },
      { domain: 'products', text: `## Права домена\n${row}` },
    ]
    expect(checkElementUniqueness(docs)).not.toEqual([])
  })
})

describe('П-5: каждый известный эндпоинт домена — в таблице 2 ровно один раз, действие валидно', () => {
  it('у каждого домена из RIGHTS_DONE', () => {
    const violators = RIGHTS_DONE.flatMap((d) =>
      checkEndpointCoverage(domainText(d), domainEndpointsOf(d)).map((v) => `${d}: ${v}`),
    )
    expect(violators).toEqual([])
  })

  it('инверсия: забытый эндпоинт и пятое действие красят', () => {
    const fake = [
      '## Права домена',
      TABLE_HEADERS.endpoints,
      '|---|---|---|---|',
      '| GET /api/orders/:id | orders.entity | list | — |',
    ].join('\n')
    const violators = checkEndpointCoverage(fake, ['GET /api/orders/:id', 'POST /api/orders'])
    expect(violators.some((v) => v.includes('POST /api/orders'))).toBe(true)
    expect(violators.some((v) => v.includes('list'))).toBe(true)
  })
})

describe('П-6: элементы таблиц 2 и 3 объявлены в таблице 1', () => {
  it('у каждого домена из RIGHTS_DONE', () => {
    const violators = RIGHTS_DONE.flatMap((d) =>
      checkElementReferencesExist(domainText(d)).map((v) => `${d}: ${v}`),
    )
    expect(violators).toEqual([])
  })

  it('инверсия: право на несуществующий элемент и прочерк без «не требуется» красят', () => {
    const fake = [
      '## Права домена',
      TABLE_HEADERS.endpoints,
      '|---|---|---|---|',
      '| GET /api/orders/:id | orders.ghost | read | — |',
      '| GET /api/orders/login | — | read | публичный |',
    ].join('\n')
    const violators = checkElementReferencesExist(fake)
    expect(violators.some((v) => v.includes('orders.ghost'))).toBe(true)
    expect(violators.some((v) => v.includes('не «не требуется»'))).toBe(true)
  })
})

describe('П-7: шапка таблицы 3 — ровно роли UserRole по порядку', () => {
  it('у каждого домена из RIGHTS_DONE', () => {
    const violators = RIGHTS_DONE.flatMap((d) =>
      checkRoleTable(domainText(d), USER_ROLES).map((v) => `${d}: ${v}`),
    )
    expect(violators).toEqual([])
  })

  it('инверсия: заглавная роль в шапке и придуманное действие в клетке красят', () => {
    const badHeader = `## Права домена\n| Элемент | Owner | admin | manager | warehouse | accounting | viewer | user |\n`
    expect(checkRoleTable(badHeader, USER_ROLES)).not.toEqual([])

    const fake = [
      '## Права домена',
      TABLE_HEADERS.roles(USER_ROLES),
      '|---|---|---|---|---|---|---|---|',
      '| orders.entity | approve | read | — | — | — | — | — |',
    ].join('\n')
    expect(checkRoleTable(fake, USER_ROLES).some((v) => v.includes('approve'))).toBe(true)
  })
})

describe('П-8: ни один доменный файл не заводит FORBIDDEN_*, кроме поимённо исключённых', () => {
  it('во всех доменных файлах контракта', () => {
    const violators = [...synced]
      .sort(byText)
      .flatMap((d) => checkNoForbiddenCodes(`${d}.md`, domainText(d)).map((v) => `${d}: ${v}`))
    expect(violators).toEqual([])
  })

  it('инверсия: новый код FORBIDDEN_ в чужом файле красит', () => {
    const violators = checkNoForbiddenCodes('products.md', 'Отказ: `FORBIDDEN_PRODUCT_COST`.')
    expect(violators).toEqual(['FORBIDDEN_PRODUCT_COST'])
  })

  it('исключённые коды orders.md не красят', () => {
    expect(
      checkNoForbiddenCodes('orders.md', 'коды `FORBIDDEN_MANUALCOST` и `FORBIDDEN_CORRECTION`'),
    ).toEqual([])
  })
})

describe('П-9: только auth.md описывает эндпоинт доставки прав', () => {
  it('во всех доменных файлах контракта', () => {
    const violators = [...synced]
      .sort(byText)
      .flatMap((d) => checkRightsDeliveryOwnership(`${d}.md`, domainText(d)))
    expect(violators).toEqual([])
  })

  it('инверсия: тот же заголовок в чужом файле красит', () => {
    const fake = '### GET /api/auth/me/permissions\nТело.\n'
    expect(checkRightsDeliveryOwnership('settings.md', fake)).not.toEqual([])
    expect(checkRightsDeliveryOwnership('auth.md', fake)).toEqual([])
  })
})

describe('П-10: действие совпадает с умолчанием по методу ⇔ столбец «Почему не умолчание» пуст', () => {
  it('у каждого домена из RIGHTS_DONE', () => {
    const violators = RIGHTS_DONE.flatMap((d) =>
      checkActionDefaults(domainText(d)).map((v) => `${d}: ${v}`),
    )
    expect(violators).toEqual([])
  })

  it('инверсия: молчаливое расхождение и лишнее заполнение красят', () => {
    const fake = [
      '## Права домена',
      TABLE_HEADERS.endpoints,
      '|---|---|---|---|',
      '| POST /api/orders/:id/cut | orders.entity | edit | — |',
      '| GET /api/orders/:id | orders.entity | read | обновляет сущность (П15) |',
    ].join('\n')
    const violators = checkActionDefaults(fake)
    expect(violators.some((v) => v.includes('POST /api/orders/:id/cut'))).toBe(true)
    expect(violators.some((v) => v.includes('GET /api/orders/:id'))).toBe(true)
  })
})

describe('П-11: строка «не требуется» — элемент «—», причина из закрытого списка трёх', () => {
  it('у каждого домена из RIGHTS_DONE', () => {
    const violators = RIGHTS_DONE.flatMap((d) =>
      checkNoRightRows(domainText(d)).map((v) => `${d}: ${v}`),
    )
    expect(violators).toEqual([])
  })

  it('инверсия: элемент не прочерк и придуманная причина красят', () => {
    const fake = [
      '## Права домена',
      TABLE_HEADERS.endpoints,
      '|---|---|---|---|',
      '| POST /api/auth/login | auth.entity | не требуется | публичный |',
      '| POST /api/auth/register | — | не требуется | пока непонятно |',
    ].join('\n')
    const violators = checkNoRightRows(fake)
    expect(violators.some((v) => v.includes('auth.entity'))).toBe(true)
    expect(violators.some((v) => v.includes('пока непонятно'))).toBe(true)
  })
})

describe('П-12: элемент выручки — read ровно у owner/admin/accounting', () => {
  it('у каждого домена из RIGHTS_DONE', () => {
    const violators = RIGHTS_DONE.flatMap((d) =>
      checkRevenueDefaults(domainText(d), USER_ROLES).map((v) => `${d}: ${v}`),
    )
    expect(violators).toEqual([])
  })

  it('инверсия: выручку выдали складу — красит', () => {
    const fake = [
      '## Права домена',
      TABLE_HEADERS.elements,
      '|---|---|---|---|',
      '| finance.receivable | entity | — | реестр дебиторки — элемент выручки |',
      '',
      TABLE_HEADERS.roles(USER_ROLES),
      '|---|---|---|---|---|---|---|---|',
      '| finance.receivable | read | read | — | read | read | — | — |',
    ].join('\n')
    const violators = checkRevenueDefaults(fake, USER_ROLES)
    expect(violators.some((v) => v.includes('warehouse'))).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Отчёт и храповик полноты
// ─────────────────────────────────────────────────────────────────────────

let totalElements = 0
let coveredEndpoints = 0
for (const domain of RIGHTS_DONE) {
  const body = rightsSectionBody(domainText(domain)) ?? ''
  totalElements += tableRows(body, TABLE_HEADERS.elements).length
  const described = new Set(tableRows(body, TABLE_HEADERS.endpoints).map((r) => r[0] ?? ''))
  coveredEndpoints += domainEndpointsOf(domain).filter((ep) => described.has(ep)).length
}

process.stdout.write(
  `[права] разделов ${RIGHTS_DONE.length} из 17 · элементов ${totalElements} · эндпоинтов покрыто ${coveredEndpoints} из ${documented.size}\n`,
)

describe('храповик полноты', () => {
  it.runIf(EXPECT_ALL_RIGHTS)('у каждого домена из RIGHTS_DONE входит все 17', () => {
    expect([...synced].sort(byText)).toEqual([...RIGHTS_DONE].sort(byText))
  })
})
