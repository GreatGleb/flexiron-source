/**
 * У каждого `expect.poll` есть бюджет, и он не дефолтный.
 *
 * Дефолтный потолок `expect` — 5 секунд, и он не растягивается вместе с загрузкой
 * машины, в отличие от потолка самого теста (90 с). У снимков это уже вылечено
 * (`snapshotBudget.spec.ts`), а у прочих утверждений потолок стоял числом: число,
 * записанное в четырёх местах, расходится с оригиналом молча, а `5000` — это ровно
 * тот дефолт, который с нагрузкой не растёт.
 *
 * `expect.poll` — тот случай, где бюджет нужен по построению: он ждёт состояние
 * ПОСЛЕ действия на странице (пагинация, фильтр, отправка формы), и ждёт ровно
 * то же, что и `waitForDataReady`. Поэтому правило проверяется машинно: каждый
 * вызов `.poll(` в дереве `tests/e2e` обязан нести `timeout: DATA_READY_TIMEOUT`
 * внутри своих опций.
 *
 * Текст вызова целиком, через переносы, разбирается тем же приёмом, что и в
 * `snapshotBudget.spec.ts`: от маркера до парной скобки. Иначе опции, записанные
 * на отдельной строке, выглядели бы отсутствующими, и проверка пропускала бы
 * именно те вызовы, ради которых написана.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..', '..')
const E2E = join(ROOT, 'tests', 'e2e')

function specFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...specFiles(full))
    else if (name.endsWith('.spec.ts')) out.push(full)
  }
  return out
}

/** Текст вызова целиком — от `.poll(` до парной скобки, через переносы. */
function pollCalls(text: string): { call: string; line: number }[] {
  const out: { call: string; line: number }[] = []
  const marker = '.poll('
  for (let at = text.indexOf(marker); at !== -1; at = text.indexOf(marker, at + 1)) {
    let i = at + marker.length - 1
    let depth = 0
    for (; i < text.length; i++) {
      if (text[i] === '(') depth++
      else if (text[i] === ')' && --depth === 0) break
    }
    out.push({ call: text.slice(at, i + 1), line: text.slice(0, at).split('\n').length })
  }
  return out
}

describe('бюджет ожидания у expect.poll', () => {
  const files = specFiles(E2E)
  const calls = files.flatMap((file) =>
    pollCalls(readFileSync(file, 'utf8')).map((c) => ({ ...c, file })),
  )

  it('разбор находит сами вызовы — пустой список выглядел бы как чистота', () => {
    expect(files.length).toBeGreaterThan(20)
    expect(calls.length).toBeGreaterThanOrEqual(20)
  })

  it('каждый вызов expect.poll берёт DATA_READY_TIMEOUT', () => {
    const offenders = calls
      .filter(({ call }) => !call.includes('timeout: DATA_READY_TIMEOUT'))
      .map(({ file, line }) => `${file.slice(ROOT.length + 1)}:${line}`)
    expect(offenders).toEqual([])
  })
})
