/**
 * §5.4 сквозного плана мультиарендности
 * (`roo_code/plans/general/сквозное-tenancy-план.md`, Т7): фронт не знает арендатора и не
 * начинает знать. Сервис не шлёт ни заголовок `X-Tenant*`, ни поле `tenant_id`/`tenantId` в
 * теле запроса. Поле `tenant_id` в ответе `/api/auth/me` (и в ответе логина/регистрации) —
 * эхо сервера, и оно остаётся: правило запрещает отправку, а не наличие поля в ответе.
 *
 * Обходит `src/services/**\/*.ts` и `src/composables/**\/*.ts` (кроме `*.spec.ts` — иначе
 * сторож нашёл бы собственные строки) построчно, без TS-компилятора: ищет `X-Tenant` в любом
 * регистре и токены `tenant_id` / `tenantId`. Каждое найденное вхождение обязано быть либо
 * заголовком `X-Tenant` (запрещён без исключений — сегодня их 0), либо стоять в ALLOWLIST
 * ниже с причиной и с предметным регэкспом на саму строку: не «файл разрешён целиком», а
 * «эта конкретная форма строки — чтение ответа». Новая строка с тем же словом, но другой
 * формой (например, присваивание тела запроса), под тот же regexp не попадёт и покрасит тест.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const SRC = resolve(process.cwd(), 'src')
const SCAN_ROOTS = ['services', 'composables']

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const info = statSync(full)
    if (info.isDirectory()) {
      out.push(...walk(full))
      continue
    }
    if (name.endsWith('.ts') && !name.endsWith('.spec.ts')) {
      out.push(full)
    }
  }
  return out
}

function relToSrc(full: string): string {
  return full
    .slice(SRC.length + 1)
    .split('\\')
    .join('/')
}

interface Hit {
  file: string
  lineNumber: number
  line: string
}

const TENANT_FIELD = /tenant_id|tenantId/
const TENANT_HEADER = /x-tenant/i

function collectHits(files: string[]): Hit[] {
  const hits: Hit[] = []
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    source.split('\n').forEach((line, idx) => {
      if (TENANT_FIELD.test(line) || TENANT_HEADER.test(line)) {
        hits.push({ file: relToSrc(file), lineNumber: idx + 1, line })
      }
    })
  }
  return hits
}

/**
 * Разрешённые формы — все «чтение ответа», ни одна не отправка. `pattern` матчится на саму
 * строку находки, а не на номер: перенос строки внутри файла не ломает проверку, подмена
 * формы (та же строка стала присваивать значение в исходящее тело) — ломает.
 */
const ALLOWLIST: Array<{ file: string; pattern: RegExp; reason: string }> = [
  {
    file: 'services/api.ts',
    pattern: /^\s*\*.*tenant_id/,
    reason:
      'чтение ответа — упоминание внутри JSDoc-комментария (история подписи заголовков), не код',
  },
  {
    file: 'services/contractRefs.ts',
    pattern: /^\s*\*.*tenant_id/,
    reason:
      'чтение ответа — пример утверждаемого токена в JSDoc-комментарии экстрактора ссылок, не код',
  },
  {
    file: 'composables/useAuth.ts',
    pattern: /tenant_id:\s*result\.tenant_id/,
    reason:
      'чтение ответа — копирует result.tenant_id из ответа /api/auth/register в локальный кэш пользователя (regUser), не отправляет',
  },
  {
    file: 'services/mocks/index.ts',
    pattern: /tenant_id:\s*'tenant-mock-\d+'/,
    reason:
      'чтение ответа — литерал внутри фикстуры мок-ответа (эмулирует то, что вернул бы сервер), не тело исходящего запроса',
  },
]

function isAllowed(hit: Hit): boolean {
  return ALLOWLIST.some((rule) => rule.file === hit.file && rule.pattern.test(hit.line))
}

describe('фронт не шлёт арендатора (§5.4 сквозного tenancy-плана)', () => {
  const files = SCAN_ROOTS.flatMap((root) => walk(join(SRC, root)))

  it('обходит каталоги сам, а не по зашитому списку', () => {
    // Пол проверки. Обход, переставший находить файлы (не тот cwd, каталог переехал),
    // выдал бы зелёный отчёт из нуля файлов — ничего не проверив.
    expect(files.length).toBeGreaterThan(20)
  })

  it('нет ни одного вхождения X-Tenant ни в каком регистре', () => {
    const headerHits = collectHits(files).filter((h) => TENANT_HEADER.test(h.line))
    expect(
      headerHits.map((h) => `${h.file}:${h.lineNumber}`),
      'заголовок X-Tenant запрещён без исключений',
    ).toEqual([])
  })

  it('каждое вхождение tenant_id/tenantId — чтение ответа из ALLOWLIST, а не отправка', () => {
    const hits = collectHits(files).filter((h) => TENANT_FIELD.test(h.line))
    const violations = hits.filter((h) => !isAllowed(h))
    expect(
      violations.map((h) => `${h.file}:${h.lineNumber} ${h.line.trim()}`),
      'найдено вхождение tenant_id/tenantId вне ALLOWLIST — похоже на отправку арендатора',
    ).toEqual([])
  })

  it('ALLOWLIST не устарел — каждое его правило реально сработало на сегодняшнем коде', () => {
    // Правило, которое ни разу не совпало, значит либо строка исчезла (запись — мусор),
    // либо разошлась по форме и настоящее новое вхождение тихо проходит мимо матча выше.
    const hits = collectHits(files).filter((h) => TENANT_FIELD.test(h.line))
    for (const rule of ALLOWLIST) {
      const matched = hits.some((h) => h.file === rule.file && rule.pattern.test(h.line))
      expect(
        matched,
        `правило для ${rule.file} (${rule.reason}) не совпало ни с одной строкой`,
      ).toBe(true)
    }
  })

  it('пять сегодняшних файлов учтены целиком: четыре под обходом плюс types/auth.ts вне его', () => {
    // §2.7 плана и постановка задачи называют пять файлов с упоминанием арендатора. Четыре
    // лежат под services/**|composables/** и разобраны выше построчно. Пятый —
    // `types/auth.ts` — вне этих двух каталогов по построению (это типы, не сервис и не
    // composable), поэтому основной обход его не видит; проверяем его здесь отдельно и
    // напрямую, чтобы задача не осталась «разобрана на четыре из пяти».
    const typesAuthPath = join(SRC, 'types', 'auth.ts')
    const source = readFileSync(typesAuthPath, 'utf8')
    const fieldLines = source
      .split('\n')
      .map((line, idx) => ({ line, number: idx + 1 }))
      .filter(({ line }) => TENANT_FIELD.test(line))

    expect(fieldLines.length).toBeGreaterThan(0)
    for (const { line, number } of fieldLines) {
      // Разрешённая форма — объявление поля интерфейса ответа: `tenant_id: string | null`
      // внутри `UserInfo`/`RegisterResponse`. Это описание того, что ПРИШЛО от сервера,
      // а не что-либо, что фронт формирует и шлёт: у интерфейса нет тела запроса вовсе.
      expect(
        /^\s*tenant_id:\s*string\s*\|\s*null\s*$/.test(line),
        `types/auth.ts:${number} — форма поля не совпала с ожидаемым объявлением интерфейса ответа: ${line.trim()}`,
      ).toBe(true)
    }
  })
})
