// Скриншоты программы для лендинга — по одному набору на язык (этап 2 лендинга, пункт 4).
//
//   npm run dev -- --port 5199 --strictPort      # демо на моках, в другом терминале
//   node scripts/landing-shots.mjs lt en         # → src/assets/images/landing/<язык>/*.jpg
//
// Тот же сценарий, что снимал картинки презентации (сессия 2026-11-17): те же страницы, те же
// кадры, тот же масштаб — меняется только язык интерфейса (`flexiron_lang`). Размер файла задаёт
// масштаб устройства: кадр снимается сразу в итоговой ширине, без пересжатия.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = process.env.SHOTS_BASE ?? 'http://localhost:5199'
const OUT_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'assets',
  'images',
  'landing',
)
const LANGS = process.argv.slice(2)
if (LANGS.length === 0) throw new Error('укажите языки: node scripts/landing-shots.mjs lt en')

/** Кнопка «добавить обрезок» на экране резки — на всех языках интерфейса. */
const ADD_OFFCUT = /Add offcut|Pridėti atraižą|Добавить обрезок/

const browser = await chromium.launch()

async function page(lang, width, height, scale) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
  })
  await context.addInitScript((code) => localStorage.setItem('flexiron_lang', code), lang)
  return context.newPage()
}

async function go(p, path) {
  await p.goto(BASE + path, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1200)
}

async function box(p, selector) {
  const found = await p.locator(selector).first().boundingBox()
  if (!found) throw new Error(`нет элемента ${selector} на ${p.url()}`)
  return found
}

/** Кадр по элементу: ширина файла ≤ maxWidth, масштаб ≤ 2.5 — как у картинок презентации. */
async function elementShot(lang, out, path, selector, height, maxWidth = 2600) {
  const probe = await page(lang, 1600, 1300, 1)
  await go(probe, path)
  const b = await box(probe, selector)
  await probe.context().close()
  const scale = Math.min(2.5, maxWidth / b.width)
  const p = await page(lang, 1600, 1300, scale)
  await go(p, path)
  const bb = await box(p, selector)
  const clip = { x: bb.x, y: bb.y, width: bb.width, height: height ?? bb.height }
  await p.screenshot({ path: out, clip, type: 'jpeg', quality: 90 })
  await p.context().close()
}

/** Кадр по координатам окна 1600×900 (как обрезка полноэкранного снимка в презентации). */
async function windowShot(lang, out, prepare, clip, fileWidth) {
  const p = await page(lang, 1600, 900, fileWidth / clip.width)
  await prepare(p)
  await p.screenshot({ path: out, clip, type: 'jpeg', quality: 90 })
  await p.context().close()
}

for (const lang of LANGS) {
  const dir = join(OUT_ROOT, lang)
  mkdirSync(dir, { recursive: true })
  const file = (name) => join(dir, name)

  // Панель руководителя — фиксированный кадр, как в презентации.
  {
    const p = await page(lang, 1600, 1300, 2600 / 1264)
    await go(p, '/admin/analytics/dashboard')
    await p.screenshot({
      path: file('dashboard.jpg'),
      clip: { x: 308, y: 190, width: 1264, height: 692 },
      type: 'jpeg',
      quality: 90,
    })
    await p.context().close()
  }

  await elementShot(
    lang,
    file('batches.jpg'),
    '/admin/warehouse/batches',
    '.glass-panel:has(table)',
    350,
  )
  await elementShot(lang, file('bcc.jpg'), '/admin/suppliers/bcc-request', '.bcc-grid', 490)
  await elementShot(lang, file('pl.jpg'), '/admin/analytics/pl-report', '.glass-panel')
  await elementShot(
    lang,
    file('statuses.jpg'),
    '/admin/settings/order-statuses',
    '.settings-panel',
    620,
  )

  // Резка: партия выбрана, два куска введены, страница чуть прокручена.
  await windowShot(
    lang,
    file('cutting.jpg'),
    async (p) => {
      await go(p, '/admin/warehouse/cutting')
      await p.locator('tbody tr').nth(1).locator('button').first().click()
      await p.waitForTimeout(1000)
      await p.locator('tbody tr').first().locator('input').nth(0).fill('2400')
      await p.getByRole('button', { name: ADD_OFFCUT }).click()
      const second = p.locator('tbody tr').nth(1).locator('input')
      await second.nth(0).fill('1200')
      await second.nth((await second.count()) - 1).fill('3')
      await p.waitForTimeout(800)
      await p.mouse.wheel(0, 200)
      await p.waitForTimeout(600)
    },
    { x: 300, y: 110, width: 1280, height: 770 },
    2000,
  )

  // Строки заказа: первый заказ списка, панель товаров — у верха кадра (над ней — услуги ниже).
  // Прокрутка к панели, а не на число пикселей: карточка заказа растёт, и фиксированный сдвиг
  // уезжал на отгрузки и оплаты (замер 2026-11-21).
  await windowShot(
    lang,
    file('order-lines.jpg'),
    async (p) => {
      await go(p, '/admin/orders')
      await p.locator('tbody tr').nth(0).locator('button, a').first().click()
      await p.waitForLoadState('networkidle')
      await p.waitForTimeout(1500)
      await p.evaluate(() => {
        const goods = [...document.querySelectorAll('.glass-panel')].find((el) =>
          el.querySelector('table'),
        )
        if (!goods) throw new Error('на карточке заказа нет панели с таблицей')
        // Прокручивается не окно, а контейнер страницы — ближайший предок с прокруткой.
        let box = goods.parentElement
        while (box && box.scrollHeight <= box.clientHeight) box = box.parentElement
        ;(box ?? document.scrollingElement).scrollBy(0, goods.getBoundingClientRect().top - 165)
      })
      await p.waitForTimeout(800)
    },
    { x: 300, y: 160, width: 1280, height: 640 },
    2000,
  )

  // Финансовый блок карточки: второй заказ списка.
  await windowShot(
    lang,
    file('order-fin.jpg'),
    async (p) => {
      await go(p, '/admin/orders')
      await p.locator('tbody tr').nth(1).locator('button, a').first().click()
      await p.waitForLoadState('networkidle')
      await p.waitForTimeout(1500)
    },
    { x: 630, y: 240, width: 620, height: 660 },
    1200,
  )
  console.log(`${lang}: готово → ${dir}`)
}

await browser.close()
