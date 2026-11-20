/**
 * Тексты лендинга (L-01, roo_code/plans/landing/tasks.json).
 *
 * Что держит спека: в дереве текстов нет пустых строк; каждая строка взята из
 * презентации или плана, а не придумана; цифр сверх презентации нет; у каждой
 * фичи есть настоящий файл картинки с верными размерами и alt; стороны скриншота
 * у соседних секций чередуются; заглушки контактов живут только в конфиге.
 * Инверсия каждого утверждения — в roo_code/plans/landing/progress.md, раздел L-01.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { landingRu } from './landing.ru'
import { CONTACTS } from '@/config/landing'

const FRONTEND = resolve(__dirname, '..', '..')
const PLAN_DIR = resolve(FRONTEND, '..', 'roo_code', 'plans', 'landing')

/** Ключи, значения которых — не текст для человека, а адреса и идентификаторы. */
const NON_TEXT_KEYS = new Set(['src', 'id', 'anchor', 'to', 'icon', 'shotSide'])

function collectStrings(node: unknown, path = 'landingRu', out: [string, string][] = []) {
  if (typeof node === 'string') out.push([path, node])
  else if (Array.isArray(node)) node.forEach((v, i) => collectStrings(v, `${path}[${i}]`, out))
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) collectStrings(v, `${path}.${k}`, out)
  }
  return out
}

const allStrings = collectStrings(landingRu)
const textStrings = allStrings.filter(([path]) => !NON_TEXT_KEYS.has(path.split('.').pop() ?? ''))

// Цитаты в плане переносятся по строкам, а \s в JS ловит и неразрывный пробел —
// все пробельные символы схлопываются в один обычный.
const norm = (s: string) => s.replace(/\s+/g, ' ').toLowerCase()
// В build.js неразрывный пробел записан escape-последовательностью — приводим к пробелу.
const SOURCES = norm(
  readFileSync(join(PLAN_DIR, 'presentation', 'build.js'), 'utf8').replace(/\\u00A0/g, ' ') +
    '\n' +
    readFileSync(join(PLAN_DIR, 'landing-plan.md'), 'utf8'),
)

/**
 * Строки, которых нет ни в презентации, ни в плане дословно. Каждая — с причиной;
 * неиспользованное исключение роняет тест, чтобы список не обрастал мёртвыми строками.
 */
const NOT_VERBATIM: Record<string, string> = {
  'Flexiron — ERP/CRM для металлобаз и металлоцентров':
    'seo.title: имя продукта (сл. 1) + надзаголовок сл. 1',
  'Оставьте заявку — покажу Flexiron за 30\u00A0минут.':
    'призыв сл. 11, «ответьте на это письмо» заменено формой — отличие, названное в tasks.json L-01',
  'Заполните это поле': 'текст ошибки поля: план требует ошибки у поля, но слов не задаёт',
  'Проверьте телефон или e-mail': 'текст ошибки поля, см. выше',
  'Слишком длинный текст': 'текст ошибки поля, см. выше',
}

describe('landing.ru — тексты лендинга', () => {
  it('в дереве текстов нет пустых строк и пустых списков', () => {
    const empty = allStrings.filter(([, s]) => s.trim() === '').map(([p]) => p)
    expect(empty).toEqual([])
    const emptyLists: string[] = []
    const walk = (node: unknown, path: string) => {
      if (Array.isArray(node)) {
        if (node.length === 0) emptyLists.push(path)
        node.forEach((v, i) => walk(v, `${path}[${i}]`))
      } else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`)
      }
    }
    walk(landingRu, 'landingRu')
    expect(emptyLists).toEqual([])
  })

  it('каждая строка взята из презентации или плана дословно, кроме названных исключений', () => {
    const invented = textStrings
      .filter(([, s]) => !(s in NOT_VERBATIM) && !SOURCES.includes(norm(s)))
      .map(([p, s]) => `${p}: ${s}`)
    expect(invented).toEqual([])
    const used = new Set(textStrings.map(([, s]) => s))
    const stale = Object.keys(NOT_VERBATIM).filter((s) => !used.has(s))
    expect(stale).toEqual([])
  })

  it('цифры в текстах — только из презентации: 30 минут, «16 из 40»', () => {
    const numbers = [...new Set(textStrings.flatMap(([, s]) => s.match(/\d+/g) ?? []))].sort()
    expect(numbers).toEqual(['16', '30', '40'])
  })

  it('порядок секций фич — как в таблице плана (4–10)', () => {
    expect([...landingRu.features, landingRu.config].map((f) => f.id)).toEqual([
      'warehouse',
      'cutting',
      'order',
      'money',
      'suppliers',
      'analytics',
      'config',
    ])
  })

  it('стороны скриншота у соседних секций 4–10 чередуются', () => {
    const sides = [...landingRu.features, landingRu.config].map((f) => f.shotSide)
    const repeats = sides.flatMap((s, i) => (i > 0 && s === sides[i - 1] ? [i] : []))
    expect(repeats).toEqual([])
  })

  it('в контуре шесть шагов и акцентом выделена только «Резка»', () => {
    expect(landingRu.flow.steps).toHaveLength(6)
    expect(landingRu.flow.steps.filter((s) => s.accent).map((s) => s.title)).toEqual(['Резка'])
  })

  it('дорожная карта перенесена со слайда 11 целиком: пять пунктов «уже» и три «в разработке»', () => {
    expect(landingRu.roadmap.done.items).toHaveLength(5)
    expect(landingRu.roadmap.next.items).toHaveLength(3)
  })
})

/** Ширина и высота из маркера SOF — чтобы width/height у <img> были правдой о файле. */
function jpegSize(file: string): { width: number; height: number } {
  const d = readFileSync(file)
  let i = 2
  while (i < d.length) {
    const marker = d[i + 1] ?? 0
    if (marker >= 0xc0 && marker <= 0xc2) {
      return { height: d.readUInt16BE(i + 5), width: d.readUInt16BE(i + 7) }
    }
    i += 2 + d.readUInt16BE(i + 2)
  }
  throw new Error(`нет SOF в ${file}`)
}

describe('landing.ru — картинки', () => {
  const shots = [
    ['hero', landingRu.hero.image] as const,
    ...[...landingRu.features, landingRu.config].map((f) => [f.id, f.image] as const),
  ]

  it.each(shots)('%s: файл существует, alt не пустой, размеры совпадают с файлом', (_, image) => {
    // Vitest отдаёт импорт ассета путём от корня проекта: /src/assets/images/landing/<файл>.
    const file = join(FRONTEND, image.src)
    expect(image.src).toMatch(/^\/src\/assets\/images\/landing\/[\w-]+\.jpg$/)
    expect(existsSync(file)).toBe(true)
    expect(image.alt.trim()).not.toBe('')
    expect({ width: image.width, height: image.height }).toEqual(jpegSize(file))
  })

  it('dashboard.jpg стоит один раз — в hero (план, секция 9)', () => {
    const srcs = shots.map(([, image]) => image.src)
    expect(srcs.filter((s) => s.endsWith('/dashboard.jpg'))).toHaveLength(1)
    expect(landingRu.hero.image.src).toMatch(/\/dashboard\.jpg$/)
  })
})

describe('config/landing — заглушки контактов', () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) return sourceFiles(p)
      return /\.(ts|vue|js|css|html)$/.test(name) ? [p] : []
    })
  }

  it('помечены как заглушки', () => {
    expect(CONTACTS.isPlaceholder).toBe(true)
  })

  it('адрес и телеграм заглушки записаны только в src/config/landing.ts', () => {
    const files = [...sourceFiles(join(FRONTEND, 'src')), ...sourceFiles(join(FRONTEND, 'tests'))]
    const holders = files
      .filter((f) => {
        const text = readFileSync(f, 'utf8')
        return text.includes(CONTACTS.email) || text.includes(CONTACTS.telegram)
      })
      .map((f) => relative(FRONTEND, f))
    expect(holders).toEqual(['src/config/landing.ts'])
  })
})
