/**
 * Литовский и английский наборы лендинга (этап 2, пункт 4 — roo_code/plans/landing/landing-stage-2-plan.md).
 *
 * Русский набор сверяется с презентацией (landing.ru.spec.ts); переводы — с русским набором:
 * - та же форма: ключи, длины списков, и всё, что не текст (иконки, якоря, адреса, id, стороны
 *   скриншотов, флаги) — одинаково, иначе язык поменял бы вёрстку, а не слова;
 * - цифры в каждой строке — те же, что в русской строке на том же месте: перевод не добавляет фактов;
 * - кириллицы нет; в литовском есть литовские буквы — это перевод, а не копия английского;
 * - картинки — из папки своего языка, с теми же именами, файлы существуют, размеры — правда о файле.
 */
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { landingRu } from './landing.ru'
import { landingLt } from './landing.lt'
import { landingEn } from './landing.en'
import { jpegSize } from './jpegSize'
import type { LandingContent, LandingImage } from '@/types/landing'

const FRONTEND = resolve(__dirname, '..', '..')

/** Ключи, значения которых — не текст для человека. `src` сверяется отдельно: папка у языка своя. */
const NON_TEXT_KEYS = new Set(['id', 'anchor', 'to', 'icon', 'shotSide'])

type Leaf = { path: string; key: string; value: unknown }

function leaves(node: unknown, path = '', out: Leaf[] = []): Leaf[] {
  if (Array.isArray(node)) node.forEach((v, i) => leaves(v, `${path}[${i}]`, out))
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) leaves(v, path ? `${path}.${k}` : k, out)
  } else
    out.push({
      path,
      key:
        path
          .split('.')
          .pop()
          ?.replace(/\[\d+\]$/, '') ?? '',
      value: node,
    })
  return out
}

function images(content: LandingContent): [string, LandingImage][] {
  return [
    ['hero', content.hero.image],
    ...[...content.features, content.config].map((f) => [f.id, f.image] as [string, LandingImage]),
  ]
}

const RU = leaves(landingRu)
const RU_BY_PATH = new Map(RU.map((l) => [l.path, l]))

describe.each([
  ['lt', landingLt],
  ['en', landingEn],
] as const)('landing.%s', (lang, content) => {
  const own = leaves(content)

  it('та же форма, что у русского набора: те же пути до каждого значения', () => {
    expect(own.map((l) => l.path)).toEqual(RU.map((l) => l.path))
  })

  it('не-текст (иконки, якоря, адреса, id, стороны, флаги) — как в русском', () => {
    const differ = own
      .filter((l) => NON_TEXT_KEYS.has(l.key) || typeof l.value !== 'string')
      .filter((l) => l.key !== 'width' && l.key !== 'height')
      .filter((l) => RU_BY_PATH.get(l.path)?.value !== l.value)
      .map((l) => l.path)
    expect(differ).toEqual([])
  })

  it('цифры в каждой строке — те же, что в русской строке на том же месте', () => {
    const digits = (v: unknown) => (typeof v === 'string' ? (v.match(/\d+/g) ?? []) : [])
    const differ = own
      .filter((l) => l.key !== 'src')
      .filter((l) => digits(l.value).join(',') !== digits(RU_BY_PATH.get(l.path)?.value).join(','))
      .map((l) => `${l.path}: ${String(l.value)}`)
    expect(differ).toEqual([])
  })

  it('русский язык не упоминается: литовским и английским посетителям его не показывают', () => {
    // Решение владельца 2026-11-21 (src/i18n/ruVisibility.ts): в Литве русский многими воспринимается
    // болезненно — ни кнопки RU, ни слова о нём.
    const texts = own.filter((l) => typeof l.value === 'string' && l.key !== 'src')
    const mentions = texts.filter((l) => /russ|rusų|rusiš|\brus\b/i.test(String(l.value)))
    expect(mentions.map((l) => `${l.path}: ${String(l.value)}`)).toEqual([])
  })

  it('кириллицы нет, пустых строк нет', () => {
    const texts = own.filter((l) => typeof l.value === 'string' && l.key !== 'src')
    expect(texts.filter((l) => /[а-яё]/i.test(String(l.value))).map((l) => l.path)).toEqual([])
    expect(texts.filter((l) => String(l.value).trim() === '').map((l) => l.path)).toEqual([])
  })

  it('переведено: текстовые строки не совпадают с русскими (кроме имён собственных)', () => {
    const same = own
      .filter((l) => typeof l.value === 'string' && !NON_TEXT_KEYS.has(l.key) && l.key !== 'src')
      .filter((l) => l.value === RU_BY_PATH.get(l.path)?.value)
      .map((l) => String(l.value))
    expect(same).toEqual(['Flexiron', '© Flexiron'])
  })

  it.each(images(content))(
    '%s: картинка из папки языка, имя как у русской, файл есть, размеры — правда о файле',
    (id, image) => {
      const ru = images(landingRu).find(([rid]) => rid === id)?.[1]
      expect(image.src).toMatch(new RegExp(`^/src/assets/images/landing/${lang}/[\\w-]+\\.jpg$`))
      expect(basename(image.src)).toBe(basename(ru?.src ?? ''))
      const file = join(FRONTEND, image.src)
      expect(existsSync(file)).toBe(true)
      expect({ width: image.width, height: image.height }).toEqual(jpegSize(file))
      expect(image.alt.trim()).not.toBe('')
      expect(image.alt).not.toBe(ru?.alt)
    },
  )
})

describe('landing.lt — литовский, а не английский', () => {
  it('в заметной доле строк есть литовские буквы', () => {
    const texts = leaves(landingLt)
      .filter((l) => typeof l.value === 'string' && !NON_TEXT_KEYS.has(l.key) && l.key !== 'src')
      .map((l) => String(l.value))
    const lithuanian = texts.filter((s) => /[ąčęėįšųūž]/i.test(s))
    expect(lithuanian.length / texts.length).toBeGreaterThan(0.5)
  })
})

describe('превью для соцсетей (og:image)', () => {
  it.each(['lt', 'en', 'ru'])('public/og/%s.jpg есть и размером 1200×630', (lang) => {
    const file = join(FRONTEND, 'public', 'og', `${lang}.jpg`)
    expect(existsSync(file)).toBe(true)
    expect(jpegSize(file)).toEqual({ width: 1200, height: 630 })
  })
})
