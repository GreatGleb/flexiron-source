import type { Locator, Page } from '@playwright/test'
import { waitForDataReady } from './ready'

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

/**
 * Wait for an element, its data and its fonts before a snapshot.
 *
 * The data wait is the one that matters: an element can be visible and empty, and
 * an empty panel is the same size as a full one, so the diff looks like a layout
 * change rather than a missing answer.
 */
export async function stabilizeForSnapshot(page: Page, locator: Locator) {
  await locator.waitFor({ state: 'visible' })
  await waitForDataReady(page)
  await waitForFontsReady(page)
}
