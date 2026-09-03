/**
 * Контракт ↔ код, проверяется машиной.
 *
 * Линза Л3 в `roo_code/skills/verify.md` предписывала сверять вызовы страницы с контрактом
 * «глазами, поштучно» — то есть не проверяла ничего, что можно было бы пропустить. За 40 дней
 * и 243 коммита в контракте не оказалось 40 путей, включая весь домен заказов и весь домен
 * клиентов. Это машинная часть той линзы.
 *
 * Храповик: домен проверяется, только если у него уже есть файл
 * `roo_code/roo-context/api/<домен>.md`. Так гейт остаётся зелёным с рождения (правило
 * «шаг гейта вводится только зелёным»), а появившийся файл назад не откатывается. Общего
 * списка исключений нет намеренно: его пришлось бы править каждой доменной задачей, а они
 * идут параллельно и затирали бы друг друга.
 *
 * План: `roo_code/plans/api/contract-sync-plan.md`.
 */
import { describe, expect, it } from 'vitest'
import { domainOf, scanCode, scanContract, syncedDomains } from './contractInventory'

/**
 * Пол инвентаря — замер 2026-09-03: 175 эндпоинтов в 17 доменах.
 *
 * Это защита от пустой проверки, а не счётчик прогресса: сломанная регулярка вернёт ноль
 * эндпоинтов, и все утверждения ниже станут зелёными и бессмысленными (питфолл #68).
 */
const ENDPOINT_FLOOR = 175

/**
 * Пока false, домен без доменного файла пропускается. Ставится в true задачей 20 плана —
 * когда сведены все домены; с этого момента новый домен без файла краснеет сразу.
 */
const EXPECT_ALL_DOMAINS: boolean = false

/** Сортировка списков находок: сравнение по локали, а не побайтовое. */
const byText = (a: string, b: string): number => a.localeCompare(b)

const code = scanCode()
const documented = scanContract()
const synced = syncedDomains()

describe('инвентарь эндпоинтов извлекается, а не выглядит извлечённым', () => {
  it('находит не меньше замеренного минимума', () => {
    expect(code.endpoints.size).toBeGreaterThanOrEqual(ENDPOINT_FLOOR)
  })

  it('видит каждый файл, где путь `/api/...` вообще упомянут', () => {
    /*
     * Пол в 175 ловит сломанное извлечение, но не ловит НОВЫЙ способ звать сервер: обёртка
     * поверх хелперов в новом файле оставит инвентарь прежним, и эндпоинт станет невидимым
     * при зелёном прогоне. Признак сильнее: файл, в котором есть литерал `/api/...`, обязан
     * дать хотя бы один эндпоинт — либо стоять в списке ниже с причиной.
     */
    const COMMENT_ONLY = [
      // Путь назван в доке компонента, зовёт его `settingsService.testMailSettings`.
      'src/views/admin/settings/MailSettings.vue',
    ]
    const invisible = [...code.filesWithApiLiteral]
      .filter((f) => !code.filesWithEndpoint.has(f))
      .filter((f) => !COMMENT_ONLY.includes(f))
      .sort(byText)
    expect(invisible, 'путь упомянут, вызова инвентарь не видит').toEqual([])

    const stale = COMMENT_ONLY.filter((f) => code.filesWithEndpoint.has(f))
    expect(stale, 'файл уже даёт эндпоинт — убрать из списка упоминаний').toEqual([])
  })

  it('у каждого вызова хелпера путь записан литералом', () => {
    /*
     * Путь в переменной (`apiGet(mePath)`) инвентарь не видит, и молчит об этом: файл
     * остаётся в наборе из-за соседних литеральных вызовов. Проверено инверсией — счёт по
     * файлам такой вызов пропускал. Отсюда счёт по вызову.
     */
    expect(code.nonLiteralCalls, 'путь не литерал — инвентарь этот вызов не видит').toEqual([])
  })

  it('каждый вызов хелпера разобран', () => {
    /*
     * Вызов, который разбор опознал и не прочитал (дженерик в две строки), молча уменьшает
     * инвентарь: пол в 175 останется удовлетворён, если рядом добавили другой вызов.
     */
    expect(code.unparsedCalls, 'вызов не разобран — почини экстрактор, а не пропусти').toEqual([])
  })

  it('все пути лежат в пространстве /api', () => {
    expect(code.outsideApiCalls, 'путь вне /api — решение о новом пространстве осознанное').toEqual(
      [],
    )
  })
})

describe('контракт описывает то, что код зовёт', () => {
  it('у каждого эндпоинта сведённого домена есть раздел в контракте', () => {
    const missing = [...code.endpoints]
      .filter(([key]) => synced.has(domainOf(key)))
      .filter(([key]) => !documented.has(key) || documented.get(key)?.planned === true)
      .map(([key, ref]) => `${key}  (${ref.source})`)
      .sort(byText)
    expect(missing, 'вызывается кодом, не описано в контракте').toEqual([])
  })

  it('метка «спроектировано» снимается, когда эндпоинт появился в коде', () => {
    /*
     * Раздел, написанный вперёд как задание бэкенду, — законная часть контракта: сверка с
     * кодом не должна его выбрасывать. Но метка обязана истечь: пока она стоит, никто не
     * проверяет описанную форму против реализованной, и расхождение живёт незамеченным.
     */
    const stale = [...documented]
      .filter(([key, ref]) => ref.planned && code.endpoints.has(key))
      .map(([key, ref]) => `${key}  (api/${ref.file}:${ref.line})`)
      .sort(byText)
    expect(stale, 'эндпоинт уже в коде — снять `Статус: спроектировано` и сверить форму').toEqual(
      [],
    )
  })

  it('каждый описанный эндпоинт существует в коде — кроме помеченных «спроектировано»', () => {
    const dead = [...documented]
      .filter(([key, ref]) => !ref.planned && !code.endpoints.has(key))
      .map(([key, ref]) => `${key}  (api/${ref.file}:${ref.line})`)
      .sort(byText)
    expect(dead, 'описано в контракте, в коде нет — контракт не roadmap').toEqual([])
  })

  it('эндпоинт описан в файле своего домена и только там', () => {
    const misplaced = [...documented]
      .filter(([key, ref]) => ref.file !== `${domainOf(key)}.md`)
      .map(([key, ref]) => `${key}  → api/${ref.file}, ожидался api/${domainOf(key)}.md`)
      .sort(byText)
    expect(misplaced, 'раздел лежит не в файле своего домена').toEqual([])
  })
})

/** Сколько эндпоинтов осталось у каждого несведённого домена. */
const pending = new Map<string, number>()
for (const key of code.endpoints.keys()) {
  const domain = domainOf(key)
  if (synced.has(domain)) continue
  pending.set(domain, (pending.get(domain) ?? 0) + 1)
}

/*
 * Отчёт о прогрессе — не тест: утверждать в нём нечего, а тест без утверждения (или с
 * утверждением, которое устраивает любое состояние, — питфолл #68) хуже, чем его отсутствие.
 * Поэтому это side effect модуля.
 *
 * Пишем в stdout напрямую: vitest 4 гасит `console.*` у пройденных тестов. Проверено: из
 * четырёх каналов (`info`, `warn`, `error`, `process.stdout`) виден только последний.
 */
const report = [...pending]
  .sort((a, b) => b[1] - a[1])
  .map(([domain, n]) => `${domain}=${n}`)
  .join(' · ')
const planned = [...documented.values()].filter((ref) => ref.planned).length
process.stdout.write(
  `[контракт] сведено доменов: ${synced.size} · описано эндпоинтов: ${documented.size - planned} из ${code.endpoints.size} · спроектировано впрок: ${planned}\n`,
)
if (report) process.stdout.write(`[контракт] не сведено: ${report}\n`)

describe('храповик сведения', () => {
  /*
   * Включается задачей 20 плана, когда сведены все домены. До того домен без файла
   * пропускается — иначе гейт красный с рождения, а такой гейт никем не разбирается.
   */
  it.runIf(EXPECT_ALL_DOMAINS)('у каждого домена кода есть файл контракта', () => {
    expect([...pending.keys()].sort(byText), 'домен без файла контракта').toEqual([])
  })
})
