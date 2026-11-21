// Заранее отрисованные страницы лендинга для поисковиков (этап 2 лендинга, SEO —
// roo_code/plans/landing/landing-stage-2-plan.md, пункт 3, шаг 4).
//
//   npm run build:site    # = vite build → ../site, затем этот скрипт
//
// Сайт — одностраничное приложение: без этого шага по адресу /lt/ на GitHub Pages нет файла, сервер
// отвечает 404 и уводит на корень, а текст появляется только после JavaScript. Скрипт открывает
// собранный сайт в браузере, сохраняет готовую разметку /lt/, /en/, /ru/ и корня в
// ../site/<язык>/index.html и пишет sitemap.xml. Приложение потом стартует поверх этой разметки как
// обычно. Сам себя проверяет; не сошлось — код возврата 1, публиковать нельзя.
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FRONTEND = join(dirname(fileURLToPath(import.meta.url)), '..')
const SITE = join(FRONTEND, '..', 'site')
const BASE_PATH = '/Flexiron-Enterprise'
const PORT = Number(process.env.PRERENDER_PORT ?? 5480)
const ORIGIN = `http://localhost:${PORT}`
/** Адрес опубликованного сайта — тот же, что VITE_SITE_URL по умолчанию (src/config/landing.ts). */
const SITE_URL = (process.env.VITE_SITE_URL ?? `https://greatgleb.github.io${BASE_PATH}`).replace(
  /\/+$/,
  '',
)
/** Языки в поиске; ru собирается, но в sitemap не попадает и несёт noindex. */
const INDEXED = ['lt', 'en']
const PAGES = [
  { path: '/lt', out: 'lt/index.html', lang: 'lt' },
  { path: '/en', out: 'en/index.html', lang: 'en' },
  { path: '/ru', out: 'ru/index.html', lang: 'ru' },
  // Корень приложение переводит на /lt; в файле — литовская страница с canonical на /lt/.
  { path: '/', out: 'index.html', lang: 'lt' },
]

const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: FRONTEND,
  stdio: ['ignore', 'pipe', 'pipe'],
  // Своя группа процессов: npx запускает vite дочерним, и kill одного npx оставлял сервер висеть.
  detached: true,
})
const stopPreview = () => {
  try {
    process.kill(-preview.pid, 'SIGTERM')
  } catch {
    // уже остановлен
  }
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${ORIGIN}${BASE_PATH}/`)
      if (r.ok) return
    } catch {
      // ещё не поднялся
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`vite preview не ответил на ${ORIGIN}${BASE_PATH}/`)
}

const failures = []
const check = (ok, message) => {
  if (!ok) failures.push(message)
}

try {
  await waitForServer()
  const browser = await chromium.launch()
  const rendered = []
  for (const page of PAGES) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const p = await context.newPage()
    await p.goto(`${ORIGIN}${BASE_PATH}${page.path}`, { waitUntil: 'networkidle' })
    await p.locator('h1').first().waitFor()
    await p.waitForFunction((lang) => document.documentElement.lang === lang, page.lang)
    const html = await p.evaluate(() => {
      // Без JavaScript скрытое состояние появления оставило бы текст невидимым.
      document
        .querySelectorAll('.reveal-pending')
        .forEach((el) => el.classList.remove('reveal-pending'))
      return '<!doctype html>\n' + document.documentElement.outerHTML
    })
    rendered.push({ ...page, html })
    await context.close()
  }
  await browser.close()

  for (const page of rendered) {
    const file = join(SITE, page.out)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, page.html)
  }

  const today = new Date().toISOString().slice(0, 10)
  const alternates = INDEXED.map(
    (alt) => `    <xhtml:link rel="alternate" hreflang="${alt}" href="${SITE_URL}/${alt}/"/>`,
  )
    .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}/lt/"/>`)
    .join('\n')
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...INDEXED.map((lang) =>
      [
        '  <url>',
        `    <loc>${SITE_URL}/${lang}/</loc>`,
        `    <lastmod>${today}</lastmod>`,
        alternates,
        '  </url>',
      ].join('\n'),
    ),
    '</urlset>',
    '',
  ].join('\n')
  writeFileSync(join(SITE, 'sitemap.xml'), sitemap)

  // Самопроверка — по записанным файлам, а не по памяти скрипта.
  const h1s = new Map()
  for (const page of PAGES) {
    const html = readFileSync(join(SITE, page.out), 'utf8')
    const at = page.out
    const canonicalLang = page.path === '/' ? 'lt' : page.lang
    check(html.includes(`<html lang="${page.lang}"`), `${at}: нет <html lang="${page.lang}">`)
    check(
      html.includes(`rel="canonical" href="${SITE_URL}/${canonicalLang}/"`),
      `${at}: canonical не ${SITE_URL}/${canonicalLang}/`,
    )
    check(!html.includes('reveal-pending'), `${at}: остался reveal-pending`)
    check(html.includes('application/ld+json'), `${at}: нет JSON-LD`)
    check(html.includes(`og/${page.lang}.jpg`), `${at}: нет og:image своего языка`)
    const robots = html.includes('name="robots" content="noindex')
    check(
      robots === (page.lang === 'ru'),
      `${at}: noindex ${robots ? 'есть' : 'нет'}, ожидалось наоборот`,
    )
    const h1 =
      /<h1[^>]*>([\s\S]*?)<\/h1>/
        .exec(html)?.[1]
        ?.replace(/<[^>]+>/g, '')
        .trim() ?? ''
    check(h1 !== '', `${at}: пустой h1`)
    h1s.set(page.out, h1)
  }
  check(
    new Set([...h1s.values()]).size === 3,
    `h1 трёх языков не различаются: ${[...h1s.values()]}`,
  )
  check(h1s.get('index.html') === h1s.get('lt/index.html'), 'корень — не литовская страница')
  for (const lang of INDEXED)
    check(sitemap.includes(`<loc>${SITE_URL}/${lang}/</loc>`), `sitemap: нет ${lang}`)
  check(!sitemap.includes('/ru/'), 'sitemap: ru попал в поиск')
} catch (err) {
  failures.push(String(err))
} finally {
  stopPreview()
}

if (failures.length) {
  console.error('пререндер не сошёлся:\n  ' + failures.join('\n  '))
  process.exit(1)
}
console.log(`пререндер: ${PAGES.map((p) => p.out).join(', ')}, sitemap.xml → ${SITE}`)
