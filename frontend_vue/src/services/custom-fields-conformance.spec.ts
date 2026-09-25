/**
 * Раздел 5.2 плана `сквозное-custom-fields-план.md` — семь проверок, доказывающих ПРИМЕНЕНИЕ
 * правила КП к семнадцати доменам, а не намерение его применить.
 *
 * Каталог контракта обходится только через `contractDir()` — второго обхода не заводится.
 *
 * Храповик: ни одна из двух дословных строк КП-10 (`Кастомных полей у домена нет.`,
 * `Кастомные поля: да.`) этой задачей в доменные файлы не дописывается. Проверки 1–3 читают
 * контракт по факту появления строки: домен без обеих строк сегодня не нарушитель, и гейт
 * вводится зелёным, а появившаяся позже строка назад не откатывается (тот же приём, что у
 * `EXPECT_ALL_DOMAINS` в `contract-conformance.spec.ts`).
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { contractDir } from './contractInventory'

const FRONTEND_SRC = resolve(process.cwd(), 'src')

/* ────────────────────────────── проверка 1 ────────────────────────────── */

const NO_FIELDS = 'Кастомных полей у домена нет.'
const YES_FIELDS = 'Кастомные поля: да.'

export interface DomainDoc {
  domain: string
  content: string
}

/**
 * Нарушитель — только домен, объявивший ОБЕ строки разом: он не определился. Домен без ни
 * одной из двух строк храповиком не проверяется — по построению фильтра, не отдельной веткой.
 */
export function findDeclarationConflicts(docs: DomainDoc[]): string[] {
  return docs
    .filter(({ content }) => content.includes(NO_FIELDS) && content.includes(YES_FIELDS))
    .map(({ domain }) => domain)
    .sort((a, b) => a.localeCompare(b))
}

/* ────────────────────────────── проверка 2 ────────────────────────────── */

const FIELD_VALUE_VOCAB = /fieldValues|CategoryField|FieldDefinition|ProductFieldValue/

export interface DomainCode {
  domain: string
  files: { path: string; content: string }[]
}

/**
 * Домен, объявивший «нет», не вправе упоминать словарь значений кастомного поля в своих
 * `types`/`mock`/`service`. Общий барьер `mocks/index.ts` в `files` не участвует — его исключает
 * сборка входа, а не эта функция (блок А, пункт 1 плана).
 */
export function findFalseNoClaims(declaredNo: readonly string[], code: DomainCode[]): string[] {
  const declared = new Set(declaredNo)
  return code
    .filter(({ domain }) => declared.has(domain))
    .filter(({ files }) => files.some((f) => FIELD_VALUE_VOCAB.test(f.content)))
    .map(({ domain }) => domain)
    .sort((a, b) => a.localeCompare(b))
}

/* ────────────────────────────── проверка 3 ────────────────────────────── */

const PLAN_REF = 'сквозное-custom-fields-план.md'

/** Домен, объявивший «да», обязан сослаться на правило, а не пересказать его своими словами. */
export function findUnreferencedYesDeclarations(docs: DomainDoc[]): string[] {
  return docs
    .filter(({ content }) => content.includes(YES_FIELDS) && !content.includes(PLAN_REF))
    .map(({ domain }) => domain)
    .sort((a, b) => a.localeCompare(b))
}

/* ────────────────────────────── проверка 4 ────────────────────────────── */

export const NEW_CODES = [
  'FIELD_VALUE_UNKNOWN_FIELD',
  'FIELD_VALUE_TYPE_MISMATCH',
  'FIELD_VALUE_REQUIRED',
  'FIELD_VALUE_OPTION_UNKNOWN',
  'FIELD_REMOVAL_CONFIRM_REQUIRED',
  'FIELD_REMOVAL_CONFIRM_INVALID',
] as const

export interface CatalogToken {
  token: string
  file: string
}

/** Токены-коды, уже занятые контрактом: `` `КОД` `` внутри файлов каталога. */
export function collectCatalogTokens(docs: { file: string; content: string }[]): CatalogToken[] {
  const out: CatalogToken[] = []
  const seen = new Set<string>()
  for (const { file, content } of docs) {
    for (const m of content.matchAll(/`([A-Z][A-Z0-9_]{2,})`/g)) {
      const token = m[1]
      if (!token) continue
      const key = `${token}\u0000${file}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ token, file })
    }
  }
  return out
}

/**
 * Ни один из шести новых кодов не является подстрокой другого нового кода и не является
 * подстрокой (или надстрокой) кода, уже назначенного контрактом (правило §2).
 */
export function findCodeCollisions(newCodes: readonly string[], catalog: CatalogToken[]): string[] {
  const problems: string[] = []
  for (const code of newCodes) {
    const clashInNew = newCodes.find((other) => other !== code && other.includes(code))
    if (clashInNew) {
      problems.push(`${code} ⊂ ${clashInNew} (столкновение внутри новых кодов)`)
      continue
    }
    const clash = catalog.find(
      (c) => c.token !== code && (c.token.includes(code) || code.includes(c.token)),
    )
    if (clash) problems.push(`${code} ⊂/⊃ ${clash.token} (${clash.file})`)
  }
  return problems.sort((a, b) => a.localeCompare(b))
}

/* ────────────────────────────── проверка 5 ────────────────────────────── */

/** Замер 2026-09-13: `grep -c "fieldId: 'f-"` по моку товаров сходится ровно на этом числе. */
const FIELD_ID_FLOOR = 761

export interface FixturePool {
  file: string
  count: number
}

/**
 * Пол значений — защита от пустой проверки (питфолл #68): сломанная выборка вернёт ноль (или
 * любое число ниже замеренного порога) и обязана покрасить проверку, а не сделать её зелёной
 * и бессмысленной.
 */
export function findWeakFixturePools(pools: FixturePool[]): string[] {
  return pools
    .filter((p) => p.count < FIELD_ID_FLOOR)
    .map((p) => `${p.file}: ${p.count} < ${FIELD_ID_FLOOR}`)
}

/* ────────────────────────────── проверка 6 ────────────────────────────── */

const FIELD_TYPE_VOCAB = new Set([
  'text',
  'number',
  'enum',
  'boolean',
  'date',
  'tags',
  'email',
  'file',
])
/** Union-тип строковых литералов: `type Имя = 'a' | 'b' | ...`. */
const UNION_TYPE_ALIAS = /\btype\s+(\w+)\s*=\s*((?:'[^']*'\s*\|?\s*)+)/g

export interface SourceFile {
  path: string
  content: string
}

/**
 * Третий перечень вокабуляра типа поля запрещён КП-1: каждое значение одно, у одного источника.
 * Два известных перечня (`FieldType`, `CategoryFieldType`) пересекаются пятью значениями —
 * порог «три совпадения» отличает пересказ вокабуляра от чужого union с одним случайным словом.
 */
export function findRogueFieldTypeVocabularies(
  files: SourceFile[],
  allowedPaths: readonly string[],
): string[] {
  const allowed = new Set(allowedPaths)
  const out: string[] = []
  for (const { path, content } of files) {
    if (allowed.has(path)) continue
    for (const m of content.matchAll(UNION_TYPE_ALIAS)) {
      const literals = [...(m[2] ?? '').matchAll(/'([^']*)'/g)].map((x) => x[1] ?? '')
      const hits = literals.filter((l) => FIELD_TYPE_VOCAB.has(l))
      if (hits.length >= 3) out.push(`${path}: ${m[1]}`)
    }
  }
  return out.sort((a, b) => a.localeCompare(b))
}

/* ────────────────────────────── проверка 7 ────────────────────────────── */

const FORBIDDEN_CONFIRMATION_SPELLINGS = [
  'confirmationCode',
  'X-Confirm-Code',
  'confirmation_code',
] as const

export interface NamedException {
  file: string
  token: string
  reason: string
}

/**
 * Единственное написание кода подтверждения снятия поля — заголовок `X-Confirmation-Code`
 * (КП-5). Исключение — поимённое, с причиной, не общий глушитель: `settings.md` несёт то же
 * слово про другую сущность.
 */
export function findConfirmationCodeMiswrites(
  docs: { file: string; content: string }[],
  exceptions: readonly NamedException[],
): string[] {
  const out: string[] = []
  for (const { file, content } of docs) {
    for (const spelling of FORBIDDEN_CONFIRMATION_SPELLINGS) {
      if (!content.includes(spelling)) continue
      if (exceptions.some((e) => e.file === file && e.token === spelling)) continue
      out.push(`${file}: \`${spelling}\``)
    }
  }
  return out.sort((a, b) => a.localeCompare(b))
}

/**
 * `settings.md` пишет `confirmationCode` о четырёхзначном коде подтверждения КОМПАНИИ —
 * поле `CompanyInfo`, генерируемое сервером и живущее в настройках арендатора (П73 в его
 * исходном, а не сквозном смысле). Это другая сущность, чем код подтверждения снятия
 * кастомного поля из КП-5: транспорт первого — колонка настроек, второго — заголовок запроса.
 * Общего глушителя на слово `confirmationCode` эта спека не заводит: исключение названо файлом
 * и написанием, и не покрывает никакой другой файл контракта.
 */
export const SETTINGS_CONFIRMATION_CODE_EXCEPTION: NamedException[] = [
  {
    file: 'settings.md',
    token: 'confirmationCode',
    reason: 'код подтверждения КОМПАНИИ в CompanyInfo — не код подтверждения снятия поля',
  },
]

/* ────────────────────────── сборка входа из репозитория ────────────────────────── */

/** Карта кода: домен → его собственные файлы (общий барьер `mocks/index.ts` не входит). */
const DOMAIN_CODE_FILES: Record<string, { types?: string; mock?: string; service?: string }> = {
  config: {
    types: 'types/config.ts',
    mock: 'services/mocks/config.ts',
    service: 'services/configService.ts',
  },
  categories: {
    types: 'types/category.ts',
    mock: 'services/mocks/categories.ts',
    service: 'services/categoriesService.ts',
  },
  products: {
    types: 'types/product.ts',
    mock: 'services/mocks/products.ts',
    service: 'services/productsService.ts',
  },
  warehouse: {
    types: 'types/warehouse.ts',
    mock: 'services/mocks/warehouse.ts',
    service: 'services/warehouseService.ts',
  },
  settings: {
    types: 'types/settings.ts',
    mock: 'services/mocks/settings.ts',
    service: 'services/settingsService.ts',
  },
  // Своего мока и своего сервиса нет; барьер `mocks/index.ts` исключён (блок А, пункт 1).
  auth: { types: 'types/auth.ts' },
  // Ни своего типа, ни своего мока; барьер `mocks/index.ts` исключён тем же пунктом.
  uploads: { service: 'services/uploadsService.ts' },
  'audit-feed': {
    types: 'types/audit.ts',
    mock: 'services/mocks/auditFeed.ts',
    service: 'services/auditFeedService.ts',
  },
  orders: {
    types: 'types/order.ts',
    mock: 'services/mocks/orders.ts',
    service: 'services/ordersService.ts',
  },
  clients: {
    types: 'types/client.ts',
    mock: 'services/mocks/clients.ts',
    service: 'services/clientsService.ts',
  },
  services: {
    types: 'types/service.ts',
    mock: 'services/mocks/services.ts',
    service: 'services/servicesService.ts',
  },
  finance: {
    types: 'types/finance.ts',
    mock: 'services/mocks/finance.ts',
    service: 'services/financeService.ts',
  },
  bcc: {
    types: 'types/bcc.ts',
    mock: 'services/mocks/bcc.ts',
    service: 'services/bccService.ts',
  },
  analytics: {
    types: 'types/analytics.ts',
    mock: 'services/mocks/analytics.ts',
    service: 'services/analyticsService.ts',
  },
  // Плана нет (раздел 6а плана), и своего кода нет тоже — карта пуста осознанно.
  'sales-crm': {},
  notifications: {
    types: 'types/notifications.ts',
    mock: 'services/mocks/notifications.ts',
    service: 'services/notificationsService.ts',
  },
  suppliers: {
    types: 'types/supplier.ts',
    mock: 'services/mocks/suppliers.ts',
    service: 'services/suppliersService.ts',
  },
}

const DOMAINS = Object.keys(DOMAIN_CODE_FILES)

function readIfExists(relToSrc: string): string | null {
  const full = join(FRONTEND_SRC, relToSrc)
  return existsSync(full) ? readFileSync(full, 'utf8') : null
}

function loadDomainDocs(): DomainDoc[] {
  const dir = contractDir()
  return DOMAINS.map((domain) => {
    const file = join(dir, `${domain}.md`)
    return { domain, content: existsSync(file) ? readFileSync(file, 'utf8') : '' }
  })
}

function loadDomainCode(): DomainCode[] {
  return DOMAINS.map((domain) => {
    const spec = DOMAIN_CODE_FILES[domain] ?? {}
    const files: { path: string; content: string }[] = []
    for (const rel of [spec.types, spec.mock, spec.service]) {
      if (!rel) continue
      const content = readIfExists(rel)
      if (content !== null) files.push({ path: rel, content })
    }
    return { domain, files }
  })
}

/** Все файлы каталога контракта — читает `contractDir()`, второй обход не заводится. */
function loadContractFiles(): { file: string; content: string }[] {
  const dir = contractDir()
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((file) => ({ file, content: readFileSync(join(dir, file), 'utf8') }))
}

/** `.ts`-файлы фронтенда, кроме спек — для поиска union-объявлений (проверка 6). */
function walkTsFiles(dir: string, root: string, out: SourceFile[] = []): SourceFile[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walkTsFiles(full, root, out)
    } else if (full.endsWith('.ts') && !full.endsWith('.spec.ts')) {
      out.push({ path: relative(root, full), content: readFileSync(full, 'utf8') })
    }
  }
  return out
}

/* ────────────────────────────────── тесты ────────────────────────────────── */

describe('5.2 — семь проверок сквозного правила кастомных полей', () => {
  it('1. ни один доменный файл не объявляет обе строки разом', () => {
    const conflicts = findDeclarationConflicts(loadDomainDocs())
    expect(conflicts, 'домен объявил обе дословные строки КП-10 разом — не определился').toEqual([])
  })

  it('инверсия 1: домен с обеими строками — нарушитель', () => {
    const synthetic: DomainDoc[] = [{ domain: 'synthetic', content: `${NO_FIELDS}\n${YES_FIELDS}` }]
    expect(findDeclarationConflicts(synthetic)).toEqual(['synthetic'])
  })

  it('2. объявление «нет» не врёт — код домена не упоминает словарь значений', () => {
    const docs = loadDomainDocs()
    const declaredNo = docs
      .filter((d) => d.content.includes(NO_FIELDS) && !d.content.includes(YES_FIELDS))
      .map((d) => d.domain)
    const violators = findFalseNoClaims(declaredNo, loadDomainCode())
    expect(violators, 'домен объявил «нет», а его код упоминает словарь значений').toEqual([])
  })

  it('инверсия 2: домен «нет», код которого упоминает словарь — нарушитель', () => {
    const violators = findFalseNoClaims(
      ['synthetic'],
      [
        {
          domain: 'synthetic',
          files: [
            { path: 'types/synthetic.ts', content: 'export interface X { v: FieldDefinition }' },
          ],
        },
      ],
    )
    expect(violators).toEqual(['synthetic'])
  })

  it('3. объявление «да» ссылается на правило, а не пересказывает его', () => {
    const violators = findUnreferencedYesDeclarations(loadDomainDocs())
    expect(violators, 'домен объявил «да» без ссылки на сквозной план').toEqual([])
  })

  it('инверсия 3: «да» без ссылки на план — нарушитель', () => {
    const synthetic: DomainDoc[] = [{ domain: 'synthetic', content: YES_FIELDS }]
    expect(findUnreferencedYesDeclarations(synthetic)).toEqual(['synthetic'])
  })

  it('4. шесть новых кодов не сталкиваются ни друг с другом, ни с каталогом', () => {
    const catalog = collectCatalogTokens(loadContractFiles())
    expect(catalog.length, 'экстрактор токенов каталога вернул пусто').toBeGreaterThan(20)
    const collisions = findCodeCollisions(NEW_CODES, catalog)
    expect(collisions, 'новый код сталкивается с уже занятым кодом контракта').toEqual([])
  })

  it('инверсия 4: код, совпадающий с чужим токеном каталога, — коллизия', () => {
    const collisions = findCodeCollisions(
      ['FIELD_VALUE_REQUIRED'],
      [{ token: 'FIELD_VALUE_REQUIRED_STRICT', file: 'synthetic.md' }],
    )
    expect(collisions).not.toEqual([])
  })

  it('5. пол значений — fieldId в моке товаров не ниже замеренного порога', () => {
    const content = readFileSync(join(FRONTEND_SRC, 'services/mocks/products.ts'), 'utf8')
    const count = (content.match(/fieldId: 'f-/g) ?? []).length
    const violators = findWeakFixturePools([{ file: 'services/mocks/products.ts', count }])
    expect(violators, 'выборка сломана — считает меньше замеренного порога').toEqual([])
  })

  it('инверсия 5: пул ниже порога — нарушитель', () => {
    expect(findWeakFixturePools([{ file: 'synthetic.ts', count: 5 }])).not.toEqual([])
  })

  it('6. ни один домен не завёл третьего вокабуляра типа поля', () => {
    const files = walkTsFiles(FRONTEND_SRC, FRONTEND_SRC)
    const violators = findRogueFieldTypeVocabularies(files, [
      'types/config.ts',
      'types/category.ts',
    ])
    expect(violators, 'третий перечень вокабуляра типа поля запрещён КП-1').toEqual([])
  })

  it('инверсия 6: третий вокабуляр union-типа — нарушитель', () => {
    const files: SourceFile[] = [
      {
        path: 'types/rogue.ts',
        content: "export type RogueFieldType = 'text' | 'number' | 'email'",
      },
    ]
    const violators = findRogueFieldTypeVocabularies(files, [
      'types/config.ts',
      'types/category.ts',
    ])
    expect(violators).toEqual(['types/rogue.ts: RogueFieldType'])
  })

  it('7. код подтверждения в файлах контракта — только заголовок X-Confirmation-Code', () => {
    const violators = findConfirmationCodeMiswrites(
      loadContractFiles(),
      SETTINGS_CONFIRMATION_CODE_EXCEPTION,
    )
    expect(violators, 'найдено другое написание кода подтверждения снятия поля').toEqual([])
  })

  it('инверсия 7: чужое написание без исключения — нарушитель по имени файла', () => {
    const violators = findConfirmationCodeMiswrites(
      [{ file: 'uploads.md', content: 'Заголовок `X-Confirm-Code` обязателен.' }],
      [],
    )
    expect(violators).toEqual(['uploads.md: `X-Confirm-Code`'])
  })
})
