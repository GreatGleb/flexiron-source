/**
 * Индекс и карта контракта: генератор плюс одна проверка, которой больше нигде нет.
 *
 * `roo_code/roo-context/api/README.md` отвечает на один вопрос — «в каком файле описан этот
 * эндпоинт». Ответ выводится из пути (домен = первый сегмент после `/api/`), поэтому карта
 * **считается**, а не пишется руками: рукописная разойдётся с кодом на первой же новой ручке, и
 * разойдётся молча.
 *
 *   CONTRACT_README_WRITE=1 npx vitest run src/services/contractReadme.spec.ts   — перегенерировать
 *   npx vitest run src/services/contractReadme.spec.ts                           — проверить
 *
 * **Сторожа карты здесь намеренно нет.** Расхождение карты с кодом ловить нечем новым:
 * `contract-conformance.spec.ts` уже утверждает те же три вещи по самому контракту — эндпоинт
 * кода без раздела, раздел без эндпоинта, раздел в чужом доменном файле. Второй счётчик того же
 * факта разошёлся бы с первым молча (Л5). Проверяется поэтому ровно то, чего conformance не
 * видит: ссылки внутри README ведут в существующие файлы, а сам README существует.
 *
 * Родом файл с ветки `contract-probe-2026-09-04` (задача 38 плана сверки), где карта покрывала
 * 11 эндпоинтов из 175 и смысла ещё не имела. Перенесён, когда контракт сведён целиком.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { contractDir, domainOf, scanCode, type EndpointKey } from './contractInventory'

const WRITE = process.env.CONTRACT_README_WRITE === '1'

const README = join(contractDir(), 'README.md')

const code = scanCode()

const byText = (a: string, b: string): number => a.localeCompare(b)

/** Домен → его эндпоинты, в том порядке, в каком их увидит читатель. */
function byDomain(): Map<string, EndpointKey[]> {
  const out = new Map<string, EndpointKey[]>()
  for (const key of [...code.endpoints.keys()].sort(byText)) {
    const domain = domainOf(key)
    const list = out.get(domain) ?? []
    list.push(key)
    out.set(domain, list)
  }
  return new Map([...out].sort((a, b) => byText(a[0], b[0])))
}

const plan = byDomain()

/** Строка карты: метод, путь, доменный файл. */
function mapRow(key: EndpointKey): string {
  const cut = key.indexOf(' ')
  return `| \`${key.slice(0, cut)}\` | \`${key.slice(cut + 1)}\` | \`${domainOf(key)}.md\` |`
}

function readme(): string {
  const dir = contractDir()
  const total = code.endpoints.size
  const files = [...plan].map(([domain, keys]) => {
    const file = `${domain}.md`
    const cell = existsSync(join(dir, file)) ? `[\`${file}\`](${file})` : `\`${file}\``
    return `| ${cell} | ${keys.length} |`
  })
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
    '## Файлы',
    '',
    '[`00-conventions.md`](00-conventions.md) — общее для всех доменов: envelope, PATCH против PUT,',
    '`TranslatedString`, пагинация, даты и деньги, коды ошибок, `Idempotency-Key`. Доменный файл на',
    'общее правило **ссылается**, а не повторяет его.',
    '',
    'У домена `orders` вторая половина контракта лежит отдельно —',
    '[`roo_code/plans/orders/orders-backend-contract.md`](../../plans/orders/orders-backend-contract.md):',
    'деньги, округление, валюта и каталог кодов ошибок §6, который читает спека.',
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
    ...[...plan].flatMap(([, keys]) => keys.map(mapRow)),
    '',
  ].join('\n')
}

describe('индекс и карта контракта', () => {
  it.runIf(WRITE)('перегенерирует README.md', () => {
    writeFileSync(README, readme(), 'utf8')
    process.stdout.write(
      `[карта] доменов: ${plan.size} · эндпоинтов в карте: ${code.endpoints.size}\n`,
    )
    expect(existsSync(README)).toBe(true)
  })

  it('README существует — иначе индекса у контракта нет', () => {
    expect(existsSync(README), `нет ${README}: запусти генератор с CONTRACT_README_WRITE=1`).toBe(
      true,
    )
  })

  it('каждая ссылка README ведёт в существующий файл', () => {
    const src = readFileSync(README, 'utf8')
    const dead = [...src.matchAll(/\]\(([^)#]+\.md)(?:#[^)]*)?\)/g)]
      .map((m) => m[1] ?? '')
      .filter((rel) => !existsSync(join(contractDir(), rel)))
      .sort(byText)
    expect(dead, 'ссылка README ведёт в никуда').toEqual([])
  })
})
