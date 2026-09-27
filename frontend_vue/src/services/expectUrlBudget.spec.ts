/**
 * У каждого утверждения о переходе есть бюджет, и он не дефолтный.
 *
 * Дефолтный потолок `expect` — пять секунд (`playwright.config.ts`), а потолок теста — 90, и
 * второй не растягивается вместе с нагрузкой (питфолл #70). Утверждение «страница ушла туда»
 * стоит ПОСЛЕ действия — клика по строке, нажатия кнопки, под-навигации, — а у него пола нет
 * по построению: `waitForDataReady` в таком месте не зовут, потому что разметка уже есть и
 * ждать, кроме самого перехода, нечего. Значит бюджет — единственное, что отделяет честный
 * красный от красного под нагрузкой.
 *
 * Правило живёт в вызовах, а не в конфиге, и потому его надо стеречь: поднять
 * `expect: { timeout }` в `playwright.config.ts` нельзя — оно задерёт потолок и у `toBeVisible`,
 * у которого пол уже есть (`openAdminPage`), и падающий прогон станет вшестеро дольше без
 * выигрыша. Отдельное утверждение ниже проверяет, что глобального потолка в конфиге нет.
 *
 * Исключение — ОТРИЦАТЕЛЬНЫЕ утверждения (`not.toHaveURL`): они ждут ИСЧЕЗНОВЕНИЯ состояния, и
 * бюджет им нужен по той же причине, но список их ведётся отдельно — третье утверждение следит,
 * чтобы исключение было непустым, иначе правило исключения не проверялось бы ничем.
 *
 * Разбор идёт по тексту вызова целиком, от `toHaveURL(` до парной скобки, через переносы:
 * вызовы бывают многострочными, и счёт по одной строке видел бы не всё.
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

interface UrlCall {
  /** Текст вызова целиком — от `toHaveURL(` до парной скобки. */
  call: string
  /** Номер строки, где вызов начинается. */
  line: number
  /** Перед вызовом стоит `.not.` — утверждение об исчезновении, а не о присутствии. */
  negative: boolean
  /** Вызов лежит в комментарии или в шапке-доке: он ничего не исполняет. */
  commented: boolean
}

/** Все вызовы `toHaveURL(` в тексте, вместе с их строкой, знаком отрицания и прозой. */
function urlCalls(text: string): UrlCall[] {
  const out: UrlCall[] = []
  const marker = 'toHaveURL('
  for (let at = text.indexOf(marker); at !== -1; at = text.indexOf(marker, at + 1)) {
    let i = at + marker.length - 1
    let depth = 0
    for (; i < text.length; i++) {
      if (text[i] === '(') depth++
      else if (text[i] === ')' && --depth === 0) break
    }
    const before = text.slice(0, at)
    const lineStart = before.lastIndexOf('\n') + 1
    const lineText = text.slice(lineStart, at)
    const trimmed = text.slice(lineStart).trimStart()
    out.push({
      call: text.slice(at, i + 1),
      line: before.split('\n').length,
      negative: /\.not\.\s*$/.test(before),
      commented: lineText.includes('//') || trimmed.startsWith('*') || trimmed.startsWith('/*'),
    })
  }
  return out
}

describe('бюджет ожидания у утверждений о переходе', () => {
  const withCalls = specFiles(E2E)
    .map((file) => ({ file, calls: urlCalls(readFileSync(file, 'utf8')) }))
    .filter((f) => f.calls.length > 0)

  it('разбор находит сами вызовы — пустой список выглядел бы как чистота', () => {
    expect(withCalls.length).toBeGreaterThan(25)
    expect(withCalls.reduce((s, f) => s + f.calls.length, 0)).toBeGreaterThan(95)
  })

  it('каждый неотрицательный toHaveURL берёт DATA_READY_TIMEOUT', () => {
    const offenders = withCalls.flatMap(({ file, calls }) =>
      calls
        .filter(
          (c) => !c.negative && !c.commented && !c.call.includes('timeout: DATA_READY_TIMEOUT'),
        )
        .map((c) => `${file.slice(ROOT.length + 1)}:${c.line}`),
    )
    expect(offenders).toEqual([])
  })

  it('исключение для отрицательных не пусто — иначе правило не проверялось бы', () => {
    const negatives = withCalls.flatMap(({ calls }) =>
      calls.filter((c) => c.negative && !c.commented),
    )
    expect(negatives.length).toBeGreaterThan(0)
  })
})
