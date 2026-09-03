/**
 * Скелеты аудита контракта: генератор и сторож в одном файле.
 *
 * Перечень эндпоинтов домена руками не составляется — из тридцати семи забудут три, и не заметит
 * никто. Генератор раскладывает инвентарь `scanCode()` по файлам
 * `roo_code/plans/api/audit/<домен>.md` и заранее заполняет то, что машина знает лучше человека:
 * вызывающий файл со строкой, наличие роута на бэкенде, наличие ветки мока.
 *
 *   CONTRACT_AUDIT_WRITE=1 npx vitest run src/services/contractAudit.spec.ts   — создать скелеты
 *   npx vitest run src/services/contractAudit.spec.ts                          — проверить их
 *
 * Без переменной файлы не пишутся, а сверяются с инвентарём: раздел, случайно удалённый или
 * переименованный при заполнении, краснеет здесь. Это машинная приёмка фазы аудита — своему
 * счёту разделов агент верить не может, он его и потерял бы.
 *
 * Существующий файл **не перезаписывается никогда**: заполненный аудит — это часы работы, и
 * повторный запуск с CONTRACT_AUDIT_WRITE=1 не имеет права их стереть. Пересоздать скелет с нуля —
 * только удалив файл руками.
 *
 * План: roo_code/plans/api/contract-sync-plan.md, задача 1. Скил: roo_code/skills/api-contract.md.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { domainOf, scanBackend, scanCode, scanMockRoutes } from './contractInventory'

const WRITE = process.env.CONTRACT_AUDIT_WRITE === '1'

/** Девять обязанностей сервера — тот же список, что в скиле, шаг 4. */
const DUTIES = [
  'Значения по умолчанию и их владелец',
  'События и уведомления',
  'Запись в аудит-лог',
  'Кастомные поля',
  'Настройки, которых мок не отслеживает',
  'Мультиарендность',
  'Права — в какой функции проверяются',
  'Транзакционность и идемпотентность',
  'Производные значения (считать, не хранить)',
]

const AUDIT_DIR = resolve(process.cwd(), '../roo_code/plans/api/audit')

const code = scanCode()
const backend = scanBackend()
const mocks = scanMockRoutes()

/** Домен → его эндпоинты, отсортированные так же, как их увидит читатель. */
function byDomain(): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const key of [...code.endpoints.keys()].sort((a, b) => a.localeCompare(b))) {
    const domain = domainOf(key)
    const list = out.get(domain) ?? []
    list.push(key)
    out.set(domain, list)
  }
  return out
}

function skeleton(domain: string, keys: string[]): string {
  const backendKeys = keys.filter((k) => backend.has(k))
  const head = [
    `# Аудит контракта — ${domain}`,
    '',
    `Эндпоинтов в коде: **${keys.length}**. Реализовано бэкендом: **${backendKeys.length}**` +
      (backendKeys.length ? ` (${backendKeys.join(', ')})` : '') +
      '.',
    '',
    'Источник истины по эндпоинту: бэкенд → мок+клиент → замысел. Пустая графа = задача не закрыта.',
    'Утверждение без `файл:строка` не записывается. Код не правится: место, где он выглядит',
    `неверным, — находка в \`roo_code/plans/bugs/contract-sync-${domain}-bugs.md\`.`,
    '',
    '## Эндпоинты',
    '',
  ]
  const sections = keys.map((key) => {
    const caller = code.endpoints.get(key)?.source ?? '—'
    const be = backend.get(key)
    const mock = mocks.get(key)
    return [
      `### ${key}`,
      `- Вызывающий: \`${caller}\``,
      `- Бэкенд: ${be ? `\`${be}\`` : '**нет**'}`,
      `- Мок: ${mock ? `\`mocks/index.ts:${mock}\`` : '**НЕТ ВЕТКИ** — находка про код'}`,
      '- Форма запроса:',
      '- Форма ответа:',
      '- Коды ошибок:',
      '- Save-режим:',
      '- Пробел контракта:',
      '- Источник истины:',
      '',
    ].join('\n')
  })
  const tail = [
    '## Обязанности сервера',
    '',
    'Заполняется как НАБЛЮДЕНИЕ: что знает мок, что знает бэкенд, где во фронте стоит константа',
    'на месте серверного значения. Ответ «нигде» — это не решение, а строка в',
    '`00-решения-владельца.md` с указанием домена.',
    '',
    ...DUTIES.map((d) => `- ${d}:`),
    '',
    '## Правила домена, которых нет в контракте',
    '',
    'Самое ценное содержимое аудита: эндпоинты машина перечислит и без человека, а правило,',
    'живущее только в моке или доменном слое, — нет.',
    '',
    `## Находки про код → contract-sync-${domain}-bugs.md`,
    '',
  ]
  return [...head, ...sections, ...tail].join('\n')
}

const plan = byDomain()

describe('скелеты аудита', () => {
  it('инвентарь не пуст — иначе генератор разложил бы пустоту', () => {
    expect(plan.size).toBeGreaterThanOrEqual(17)
    expect(code.endpoints.size).toBeGreaterThanOrEqual(175)
  })

  it.runIf(WRITE)('создаёт отсутствующие скелеты и не трогает существующие', () => {
    mkdirSync(AUDIT_DIR, { recursive: true })
    const created: string[] = []
    const kept: string[] = []
    for (const [domain, keys] of plan) {
      const file = join(AUDIT_DIR, `${domain}.md`)
      if (existsSync(file)) {
        kept.push(domain)
        continue
      }
      writeFileSync(file, skeleton(domain, keys), 'utf8')
      created.push(domain)
    }
    const decisions = join(AUDIT_DIR, '00-решения-владельца.md')
    if (!existsSync(decisions)) {
      writeFileSync(
        decisions,
        [
          '# Решения владельца — сверка контракта',
          '',
          'Сюда фаза аудита сносит строки, у которых источник «нигде»: обязанность сервера, которой',
          'нет ни в моке, ни на бэкенде, ни константой во фронте. Прогон их **не решает** — решение',
          'принимает владелец, и до тех пор раздел контракта помечается `**Статус:** спроектировано`.',
          '',
          'Формат строки: `<домен> · <графа> · что именно неизвестно · где смотрел`.',
          '',
        ].join('\n'),
        'utf8',
      )
    }
    process.stdout.write(
      `[скелеты] создано: ${created.length} · сохранено как есть: ${kept.length}\n`,
    )
    expect(created.length + kept.length).toBe(plan.size)
  })

  it('каждый скелет содержит ровно эндпоинты своего домена', (ctx) => {
    if (!existsSync(AUDIT_DIR)) {
      // Каталога нет — задача 1 плана ещё не выполнена. Пропуск виден в прогоне; молчаливый
      // `return` выглядел бы как пройденная проверка, а проверено при этом ничего.
      process.stdout.write('[скелеты] каталога ещё нет — задача 1 плана не выполнена\n')
      ctx.skip()
    }
    const problems: string[] = []
    for (const [domain, keys] of plan) {
      const file = join(AUDIT_DIR, `${domain}.md`)
      if (!existsSync(file)) {
        problems.push(`${domain}: файла скелета нет`)
        continue
      }
      const src = readFileSync(file, 'utf8')
      const found = [...src.matchAll(/^### ((?:GET|POST|PUT|PATCH|DELETE) \/api\/\S*)\s*$/gm)].map(
        (m) => m[1] ?? '',
      )
      const missing = keys.filter((k) => !found.includes(k))
      const extra = found.filter((k) => !keys.includes(k))
      if (missing.length) problems.push(`${domain}: потеряны разделы — ${missing.join(', ')}`)
      if (extra.length) problems.push(`${domain}: лишние разделы — ${extra.join(', ')}`)
      const lostDuties = DUTIES.filter((d) => !src.includes(`- ${d}:`) && !src.includes(`- ${d}: `))
      if (lostDuties.length && !src.includes('## Обязанности сервера')) {
        problems.push(`${domain}: нет раздела «Обязанности сервера»`)
      }
    }
    expect(problems, 'скелет разошёлся с инвентарём').toEqual([])
  })

  it('в каталоге аудита нет файлов для домена, которого нет в коде', (ctx) => {
    if (!existsSync(AUDIT_DIR)) ctx.skip()
    const known = new Set([...plan.keys()].map((d) => `${d}.md`))
    const stray = readdirSync(AUDIT_DIR)
      .filter((f) => f.endsWith('.md') && !f.startsWith('00-'))
      .filter((f) => !known.has(f))
      .sort((a, b) => a.localeCompare(b))
    expect(stray, 'аудит домена, которого больше нет в коде').toEqual([])
  })
})
