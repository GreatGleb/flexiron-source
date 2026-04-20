import type { Locator, Page } from '@playwright/test'

/**
 * Standard options for per-section visual snapshots. Disables animations and
 * hides caret to avoid pixel churn from blinking input cursor.
 */
export const SNAPSHOT_OPTIONS = {
  animations: 'disabled',
  caret: 'hide',
  maxDiffPixelRatio: 0.01,
} as const

/** Wait for fonts to be ready — prevents FOIT-induced pixel diffs. */
export async function waitForFontsReady(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
  })
}

/** Convenience: wait for an element + fonts before snapshot to reduce flakes. */
export async function stabilizeForSnapshot(page: Page, locator: Locator) {
  await locator.waitFor({ state: 'visible' })
  await waitForFontsReady(page)
  await page.waitForLoadState('networkidle')
}
