/**
 * Индекс и карта контракта: генератор и сторож в одном файле.
 *
 * `roo_code/roo-context/api/README.md` отвечает на один вопрос — «в каком файле описан этот
 * эндпоинт». Ответ выводится из пути (домен = первый сегмент после `/api/`), поэтому карта
 * **считается**, а не пишется руками: рукописная разойдётся с кодом первой же новой ручкой, и
 * разойдётся молча.
 *
 *   CONTRACT_README_WRITE=1 npx vitest run src/services/contractReadme.spec.ts   — перегенерировать
 *   npx vitest run src/services/contractReadme.spec.ts                           — проверить
 *
 * Без переменной файл не пишется, а сверяется с инвентарём `scanCode()`. Сверка **смысловая**, а
 * не побайтовая, и это осознанно: побайтовая покраснела бы у автора следующего домена, который
 * всего лишь создал свой `<домен>.md`, — то есть штрафовала бы за работу по плану. Красным должно
 * становиться другое: появившийся в коде эндпоинт, которого в карте нет, и ссылка, ведущая в
 * никуда.
 *
 * План: roo_code/plans/api/contract-sync-plan.md, задача 38.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { contractDir, domainOf, scanCode } from './contractInventory'

const WRITE = process.env.CONTRACT_README_WRITE === '1'

const README = join(contractDir(), 'README.md')

const code = scanCode()

/** Домен → его эндпоинты, в том порядке, в каком их увидит читатель. */
function byDomain(): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const key of [...code.endpoints.keys()].sort((a, b) => a.localeCompare(b))) {
    const domain = domainOf(key)
    const list = out.get(domain) ?? []
    list.push(key)
    out.set(domain, list)
  }
  return new Map([...out].sort((a, b) => a[0].localeCompare(b[0])))
}

const plan = byDomain()

/** Строка карты. Тот же формат читает сторож ниже — второго описания формата нет. */
function mapRow(key: EndpointKeyLike): string {
  const method = key.slice(0, key.indexOf(' '))
  const path = key.slice(key.indexOf(' ') + 1)
  return `| \`${method}\` | \`${path}\` | \`${domainOf(key)}.md\` |`
}

type EndpointKeyLike = string

const MAP_ROW = /^\| `(GET|POST|PUT|PATCH|DELETE)` \| `(\/api\/\S*)` \| `([a-z-]+\.md)` \|$/

function readme(): string {
  const dir = contractDir()
  const total = code.endpoints.size
  const files = [...plan].map(([domain, keys]) => {
    const file = `${domain}.md`
    const cell = existsSync(join(dir, file)) ? `[\`${file}\`](${file})` : `\`${file}\``
    return `| ${cell} | ${keys.length} |`
  })
  const rows = [...plan].flatMap(([, keys]) => keys.map(mapRow))
  return [
    '# Контракт API — индекс и карта',
    '',
    'Контракт разложен по доменам: **один домен — один файл**. Имя файла — первый сегмент пути',
    'после `/api/`, без исключений, поэтому «где описан эндпоинт» считается машиной, а не',
    'помнится человеком: `/api/warehouse/stock/:id` → `warehouse.md`.',
    '',
    '> **Этот файл генерируется.** Правка руками теряется при следующем запуске — менять надо',
    '> генератор `frontend_vue/src/services/contractReadme.spec.ts`.',
    '>',
    '> ```bash',
    '> cd frontend_vue && CONTRACT_README_WRITE=1 npx vitest run src/services/contractReadme.spec.ts',
    '> ```',
    '',
    'Он же и сторож: без переменной та же спека сверяет карту с инвентарём кода и краснеет на',
    'эндпоинте, которого в карте нет, и на ссылке, которая никуда не ведёт.',
    '',
    '## Файлы',
    '',
    '[`00-conventions.md`](00-conventions.md) — общее для всех доменов: envelope, PATCH против PUT,',
    '`TranslatedString`, пагинация, даты и деньги, коды ошибок, `Idempotency-Key`. Доменный файл на',
    'общее правило **ссылается**, а не повторяет его.',
    '',
    'Строка без ссылки — доменного файла на момент генерации ещё нет: домен в коде есть, сверка до',
    'него не дошла. Живое состояние печатает `contract-conformance.spec.ts` строкой',
    '`[контракт] сведено доменов: …` на каждом `npm run test:unit`.',
    '',
    '| файл | эндпоинтов в коде |',
    '|---|---|',
    ...files,
    `| **итого** | **${total}** |`,
    '',
    '## Карта: метод и путь → файл',
    '',
    `Все ${total} эндпоинтов, которые фронтенд действительно зовёт (инвентарь \`scanCode()\`:`,
    'вызовы `apiGet`/`apiPost`/`apiPut`/`apiPatch`/`apiDelete`/`apiUpload` вне моков и спек).',
    'Параметр пути нормализован в `:id` — в доменном файле он назван осмысленно (`:orderId`).',
    '',
    'Наличие строки здесь **не** значит, что эндпоинт описан: это карта адресов, а не состояние',
    'работы. Что описано, а что нет — та же строка прогона спеки.',
    '',
    '| метод | путь | файл |',
    '|---|---|---|',
    ...rows,
    '',
  ].join('\n')
}

/** Карта, прочитанная обратно из файла: `МЕТОД путь` → имя файла. */
function parseMap(src: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const line of src.split('\n')) {
    const m = MAP_ROW.exec(line)
    if (m) out.set(`${m[1]} ${m[2]}`, m[3] ?? '')
  }
  return out
}

describe('индекс и карта контракта', () => {
  it('инвентарь не пуст — иначе сторож охранял бы пустоту', () => {
    expect(code.endpoints.size).toBeGreaterThanOrEqual(175)
    expect(plan.size).toBeGreaterThanOrEqual(17)
  })

  it.runIf(WRITE)('перегенерирует README.md', () => {
    writeFileSync(README, readme(), 'utf8')
    const written = parseMap(readFileSync(README, 'utf8'))
    process.stdout.write(`[карта] доменов: ${plan.size} · эндпоинтов в карте: ${written.size}\n`)
    expect(written.size).toBe(code.endpoints.size)
  })

  it('карта покрывает ровно эндпоинты кода, и каждый указывает на файл своего домена', () => {
    expect(existsSync(README), `нет ${README} — задача 38 плана не выполнена`).toBe(true)
    const map = parseMap(readFileSync(README, 'utf8'))
    const missing = [...code.endpoints.keys()]
      .filter((k) => !map.has(k))
      .sort((a, b) => a.localeCompare(b))
    const extra = [...map.keys()]
      .filter((k) => !code.endpoints.has(k))
      .sort((a, b) => a.localeCompare(b))
    const wrong = [...map]
      .filter(([key, file]) => code.endpoints.has(key) && file !== `${domainOf(key)}.md`)
      .map(([key, file]) => `${key} → ${file}`)
      .sort((a, b) => a.localeCompare(b))
    expect({ missing, extra, wrong }, 'карта разошлась с инвентарём кода').toEqual({
      missing: [],
      extra: [],
      wrong: [],
    })
  })

  it('каждая ссылка README ведёт в существующий файл', () => {
    const src = readFileSync(README, 'utf8')
    const dead = [...src.matchAll(/\]\(([^)#]+\.md)(?:#[^)]*)?\)/g)]
      .map((m) => m[1] ?? '')
      .filter((rel) => !existsSync(join(contractDir(), rel)))
      .sort((a, b) => a.localeCompare(b))
    expect(dead, 'ссылка README ведёт в никуда').toEqual([])
  })
})
