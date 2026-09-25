/**
 * У каждого снимка есть бюджет, и он не дефолтный.
 *
 * Потолок теста — 90 секунд (`playwright.config.ts`), а дефолтный потолок `expect` — 5,
 * и второй не растягивается вместе с нагрузкой. В эти пять секунд `toHaveScreenshot`
 * обязан уложить всё: скролл элемента в вид, ожидание шрифтов, съёмку и сравнение, —
 * а если первый снимок разошёлся с эталоном, то ещё и повторные съёмки, пока две
 * подряд не совпадут. Замер 2026-09-25 на загруженной машине: ОДНА съёмка панели
 * клиентов стоит 2.0–3.3 с, под троттлингом — до 11.4 с. Пяти секунд не хватает, и
 * краснеет не тот снимок, с которым что-то не так, а тот, кому не повезло с моментом.
 * Наружу это выходило как «Failed to take two consecutive stable screenshots» и как
 * четыре снимка, для которых линии на Linux год не заводили вовсе.
 *
 * Бюджет живёт в `SNAPSHOT_OPTIONS` (`tests/e2e/helpers/visual.ts`) и ТОЛЬКО там:
 * в конфиге у блока `expect.toHaveScreenshot` ключа `timeout` нет, он есть лишь у
 * самого вызова. Значит правило «бюджет один на всех» держится не конфигом, а тем,
 * что каждый вызов берёт эти опции, — и вот это здесь и проверяется. Глазами такое
 * пропускали: шесть вызовов в `layout.spec.ts` жили без опций, и `threshold` их
 * доставал через конфиг, а `timeout` достать не мог.
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

/** Текст вызова целиком — от `toHaveScreenshot(` до парной скобки, через переносы. */
function screenshotCalls(text: string): { call: string; line: number }[] {
  const out: { call: string; line: number }[] = []
  const marker = 'toHaveScreenshot('
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

describe('бюджет ожидания у скриншот-эталонов', () => {
  const files = specFiles(E2E)
  const calls = files.flatMap((file) =>
    screenshotCalls(readFileSync(file, 'utf8')).map((c) => ({ ...c, file })),
  )

  it('разбор находит сами вызовы — пустой список выглядел бы как чистота', () => {
    expect(files.length).toBeGreaterThan(20)
    expect(calls.length).toBeGreaterThan(80)
  })

  it('каждый вызов toHaveScreenshot берёт SNAPSHOT_OPTIONS', () => {
    const offenders = calls
      .filter(({ call }) => !call.includes('SNAPSHOT_OPTIONS'))
      .map(({ file, line }) => `${file.slice(ROOT.length + 1)}:${line}`)
    expect(offenders).toEqual([])
  })

  it('SNAPSHOT_OPTIONS несёт бюджет, и он тот же, что у ожидания данных', () => {
    const visual = readFileSync(join(E2E, 'helpers', 'visual.ts'), 'utf8')
    expect(visual).toContain('timeout: DATA_READY_TIMEOUT')

    // Одно число на оба ожидания: 30 с на данные плюс 30 с на снимок — ровно тот
    // запас, под который в конфиге посчитан потолок теста в 90 секунд.
    const ready = readFileSync(join(E2E, 'helpers', 'ready.ts'), 'utf8')
    const declared = /export const DATA_READY_TIMEOUT = ([\d_]+)/.exec(ready)?.[1]
    expect(Number(declared?.replace(/_/g, ''))).toBe(30_000)
  })

  it('глобальный expect.timeout в конфиге не поднят — он задел бы и toBeVisible', () => {
    const config = readFileSync(join(ROOT, 'playwright.config.ts'), 'utf8')
    expect(/expect:\s*\{[^}]*\btimeout\s*:/s.test(config)).toBe(false)
  })
})
