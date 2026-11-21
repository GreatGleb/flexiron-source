import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import { DATA_READY_TIMEOUT } from '../helpers/ready'

/**
 * Голова страницы лендинга для поисковиков и соцсетей (этап 2, SEO —
 * roo_code/plans/landing/landing-stage-2-plan.md, пункт 3; src/composables/useLandingSeo.ts).
 *
 * Что заранее отрисованные страницы сохраняют эти теги, проверяет сам пререндер
 * (scripts/prerender-landing.mjs) — здесь живое поведение: теги по языку, без дублей при
 * переключении, снимаются при уходе в программу.
 */

const SITE = 'https://greatgleb.github.io/Flexiron-Enterprise'

async function seo(page: Page) {
  return page.evaluate(() => {
    const attr = (sel: string, name: string) =>
      [...document.head.querySelectorAll(sel)].map((e) => e.getAttribute(name) ?? '')
    const ld = document.head.querySelector('script[type="application/ld+json"]')?.textContent
    return {
      canonical: attr('link[rel="canonical"]', 'href'),
      alternates: [...document.head.querySelectorAll('link[rel="alternate"]')].map(
        (e) => `${e.getAttribute('hreflang')} ${e.getAttribute('href')}`,
      ),
      robots: attr('meta[name="robots"]', 'content'),
      ogLocale: attr('meta[property="og:locale"]', 'content'),
      ogImage: attr('meta[property="og:image"]', 'content'),
      ogUrl: attr('meta[property="og:url"]', 'content'),
      ld: ld ? (JSON.parse(ld) as { '@graph': { '@type': string; inLanguage?: string }[] }) : null,
      marked: document.head.querySelectorAll('[data-landing-seo]').length,
    }
  })
}

const ALTERNATES = [`lt ${SITE}/lt/`, `en ${SITE}/en/`, `x-default ${SITE}/lt/`]

test.describe('landing SEO head', () => {
  test('/lt: canonical, hreflang without ru, Open Graph and JSON-LD in Lithuanian', async ({
    page,
  }) => {
    await page.goto('/lt')
    await expect(page.locator('html')).toHaveAttribute('lang', 'lt', {
      timeout: DATA_READY_TIMEOUT,
    })
    const head = await seo(page)
    expect(head.canonical).toEqual([`${SITE}/lt/`])
    expect(head.alternates).toEqual(ALTERNATES)
    expect(head.robots).toEqual([])
    expect(head.ogLocale).toEqual(['lt_LT'])
    expect(head.ogUrl).toEqual([`${SITE}/lt/`])
    expect(head.ogImage).toEqual([`${SITE}/og/lt.jpg`])
    const app = head.ld?.['@graph'].find((n) => n['@type'] === 'SoftwareApplication')
    expect(app?.inLanguage).toBe('lt')
  })

  test('switching to EN replaces the tags instead of adding a second set', async ({ page }) => {
    await page.goto('/lt')
    await expect(page.locator('html')).toHaveAttribute('lang', 'lt', {
      timeout: DATA_READY_TIMEOUT,
    })
    const before = (await seo(page)).marked
    await page.getByTestId('landing-lang-en').click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    const head = await seo(page)
    expect(head.canonical).toEqual([`${SITE}/en/`])
    expect(head.alternates).toEqual(ALTERNATES)
    expect(head.ogImage).toEqual([`${SITE}/og/en.jpg`])
    expect(head.marked).toBe(before)
  })

  test('/ru: noindex, its own canonical, and still no ru in hreflang', async ({ page }) => {
    await page.goto('/ru')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru', {
      timeout: DATA_READY_TIMEOUT,
    })
    const head = await seo(page)
    expect(head.robots).toEqual(['noindex, follow'])
    expect(head.canonical).toEqual([`${SITE}/ru/`])
    expect(head.alternates).toEqual(ALTERNATES)
  })

  test('leaving to the app removes every landing tag', async ({ page }) => {
    await page.goto('/lt')
    await expect(page.locator('html')).toHaveAttribute('lang', 'lt', {
      timeout: DATA_READY_TIMEOUT,
    })
    expect((await seo(page)).marked).toBeGreaterThan(10)
    await page.getByTestId('landing-login').first().click()
    await expect(page).toHaveURL('/login', { timeout: DATA_READY_TIMEOUT })
    const head = await seo(page)
    expect(head.marked).toBe(0)
    expect(head.canonical).toEqual([])
  })

  test('old /demo/… links land on the same app page', async ({ page }) => {
    await page.goto('/demo/admin/warehouse/batches')
    await expect(page).toHaveURL('/admin/warehouse/batches', { timeout: DATA_READY_TIMEOUT })
  })
})
