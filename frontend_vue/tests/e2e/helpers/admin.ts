import { type Page } from '@playwright/test'
import { waitForDataReady } from './ready'

export async function navigateToAdmin(page: Page, path = '/admin/analytics/dashboard') {
  await page.goto(path)
  await waitForDataReady(page)
}

export async function switchLanguage(page: Page, lang: 'ru' | 'en' | 'lt') {
  await page.evaluate((l) => {
    localStorage.setItem('flexiron_lang', l)
  }, lang)
  await page.reload()
  await waitForDataReady(page)
}

export async function waitForPanelsLoaded(page: Page) {
  // A visible `.glass-panel` proves the panel exists, not that it holds anything —
  // a panel drawing a skeleton is visible too.
  await page.waitForSelector('.glass-panel', { state: 'visible' })
  await waitForDataReady(page)
}

export async function setFeatureFlag(page: Page, flag: string, value: boolean) {
  await page.evaluate(
    ({ f, v }) => {
      const existing = JSON.parse(localStorage.getItem('ff_overrides') || '{}')
      existing[f] = v
      localStorage.setItem('ff_overrides', JSON.stringify(existing))
    },
    { f: flag, v: value },
  )
  await page.reload()
  await waitForDataReady(page)
}
