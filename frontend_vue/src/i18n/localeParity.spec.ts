import { describe, it, expect } from 'vitest'
import { translations } from './translations'

/**
 * Три локали несут один и тот же набор ключей.
 *
 * Заведено 2026-09-11 по находке Н3 второго захода скептика. История короткая и
 * поучительная: класс 2 добавил два ключа в три локали, и спека про них утверждала
 * `toBe(t(key))`. Оказалось, что `t()` при отсутствии перевода возвращает **сам ключ**, а
 * компонент рисует его же, — то есть утверждение сравнивало ключ с ключом. Первую
 * починку сделали помощником, который краснеет на неразрешённом ключе; скептик показал,
 * что она закрывает **одну локаль из трёх** — спека живёт на `en`, и удаление того же
 * ключа из `lt` оставляло 888 тестов зелёными.
 *
 * Отсюда правило: паритет локалей проверяется не в спеке потребителя, а один раз здесь и
 * для всего дерева переводов. Спека потребителя не обязана знать про локали, которых она
 * не рендерит.
 *
 * Введено зелёным (`verify.md`): замер 2026-09-11 — по 2575 ключей в каждой из трёх
 * локалей, расхождений ноль.
 */

type Node = Record<string, unknown>

/** Полные пути листьев: `orders.toast_error_load`. Массивы — листья (`date.months`). */
function leafPaths(node: Node, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return value && typeof value === 'object' && !Array.isArray(value)
      ? leafPaths(value as Node, path)
      : [path]
  })
}

const tree = translations as unknown as Record<string, Node>
const locales = Object.keys(tree)
const keysOf = new Map(locales.map((locale) => [locale, new Set(leafPaths(tree[locale] as Node))]))

describe('локали несут один набор ключей', () => {
  it('локалей три, и дерево не пустое', () => {
    // Питфолл #66: без этого пустое дерево дало бы «расхождений нет» на пустом месте.
    const sorted = [...locales].sort((a: string, b: string) => a.localeCompare(b))
    expect(sorted).toEqual(['en', 'lt', 'ru'])
    for (const locale of locales) expect(keysOf.get(locale)!.size).toBeGreaterThan(2000)
  })

  it.each(locales.slice(1))('%s совпадает с ru по набору ключей', (locale) => {
    const base = keysOf.get('ru')!
    const other = keysOf.get(locale)!
    expect([...base].filter((key) => !other.has(key))).toEqual([])
    expect([...other].filter((key) => !base.has(key))).toEqual([])
  })
})
