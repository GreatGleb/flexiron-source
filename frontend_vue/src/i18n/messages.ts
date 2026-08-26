/**
 * Дерево переводов и его слияние — одно на весь i18n.
 *
 * До 2026-08-25 `deepMerge` жил в двух экземплярах: здесь (в `translations`) и в
 * `admin/index.ts`. Оба делали одно и то же и оба типизировали дерево как
 * `Record<string, unknown>`, из-за чего `createI18n` не принимал результат, а
 * расхождение между копиями никто бы не заметил. Это ровно линза Л5 — второй
 * экземпляр правила рядом с первым.
 */

/**
 * Узел дерева переводов: строка, массив строк или вложенный словарь.
 *
 * Массивы здесь не для красоты — `date.months` и `date.weekdays` именно массивы, и
 * при слиянии они ЗАМЕНЯЮТСЯ целиком, а не сливаются поэлементно. Уберёшь проверку
 * `Array.isArray` — двенадцать месяцев превратятся в объект с ключами «0».."11".
 */
export type MessageNode = string | MessageNode[] | { [key: string]: MessageNode }

/** Дерево переводов одной локали. */
export type MessageTree = { [key: string]: MessageNode }

/**
 * Deep merge two or more objects.
 * Nested objects are merged recursively (not replaced).
 * Primitives from later sources override earlier ones.
 */
export function deepMerge(...sources: MessageTree[]): MessageTree {
  const result: MessageTree = {}
  for (const source of sources) {
    for (const key of Object.keys(source)) {
      const value = source[key]
      if (value === undefined) continue
      if (typeof value === 'string' || Array.isArray(value)) {
        result[key] = value
        continue
      }
      const existing = result[key]
      result[key] = deepMerge(
        typeof existing === 'object' && !Array.isArray(existing) ? existing : {},
        value,
      )
    }
  }
  return result
}
