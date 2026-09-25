/**
 * Шрифты берутся из сборки, а не с чужого хоста.
 *
 * Раньше это сторожил перехватчик `tests/e2e/helpers/webFonts.ts`: он отвечал на
 * `fonts.googleapis.com` четырнадцатью файлами из `tests/e2e/fixtures/fonts/`. После
 * перехода на `@fontsource` запросов туда не стало вовсе, и перехватчик не срабатывал
 * НИ РАЗУ — 328 КБ и сто строк, которые нельзя было ни сломать, ни заметить сломанными.
 * Хуже: приложение и тесты жили на разных сборках Inter (фикстуры — байт в байт то, что
 * раздаёт Google; `@fontsource` — другая сборка), и эталоны пересняты под вторую.
 *
 * Перехватчик удалён, а его смысл остался здесь. Проверка дешевле и, в отличие от него,
 * МОЖЕТ покраснеть: вернувшийся `<link>` на CDN она видит сразу, а не через пиксельный
 * дифф, который прочитают как «флейк шрифта».
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..', '..')

/** Хосты, раздающие шрифты по сети. Любое упоминание — возврат зависимости. */
const FONT_CDN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']

/** Каталоги, которые попадают в сборку приложения. */
const SHIPPED = ['src', 'index.html']

function filesUnder(entry: string): string[] {
  const absolute = join(ROOT, entry)
  if (statSync(absolute).isFile()) return [absolute]
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.(ts|js|mjs|vue|css|scss|html)$/.test(name)) out.push(full)
    }
  }
  walk(absolute)
  return out
}

describe('источник веб-шрифтов', () => {
  const shipped = SHIPPED.flatMap(filesUnder)

  it('разбор находит файлы сборки — иначе пустой список выглядел бы как чистота', () => {
    expect(shipped.length).toBeGreaterThan(100)
    expect(shipped.some((f) => f.endsWith('index.html'))).toBe(true)
    expect(shipped.some((f) => f.endsWith('main.ts'))).toBe(true)
  })

  it('ни один файл сборки не ссылается на шрифтовой CDN', () => {
    const offenders: string[] = []
    for (const file of shipped) {
      const text = readFileSync(file, 'utf8')
      for (const host of FONT_CDN_HOSTS) {
        // Упоминание в комментарии — не запрос. Ищем его как часть URL.
        if (text.includes(`//${host}`) || text.includes(`https://${host}`)) {
          offenders.push(`${file.slice(ROOT.length + 1)} → ${host}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('шрифты подключены из пакетов, а не «подключены никак»', () => {
    const main = readFileSync(join(ROOT, 'src/main.ts'), 'utf8')
    expect(main).toContain('@fontsource/inter/400.css')
    expect(main).toContain('@fontsource/jetbrains-mono/400.css')

    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    expect(pkg.dependencies).toHaveProperty('@fontsource/inter')
    expect(pkg.dependencies).toHaveProperty('@fontsource/jetbrains-mono')
  })
})
