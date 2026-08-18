import { expect, type Page } from '@playwright/test'

/**
 * Waiting for the page to HAVE ITS DATA, rather than for the network to fall quiet.
 *
 * `waitForLoadState('networkidle')` lies in this app, and not by a little: under
 * mocks there is no request at all — `services/mocks/index.ts` answers from a
 * `setTimeout` — so "nothing left to load" becomes true long before anything is on
 * screen. Measured: at networkidle the dashboard's charts panel holds zero bars and
 * the supplier-card-config page holds nothing whatsoever.
 *
 * What makes it worse than a plain timing bug is how it fails. An empty panel is
 * exactly as tall as a full one, so a screenshot taken then is not an obvious blank
 * — it is a pixel diff that reads like a layout regression in code nobody touched.
 */

/** Anything the app draws while it is still waiting for its own data. */
const LOADING_MARKERS = [
  '.panel-skeleton',
  '.glass-panel.loading',
  '.skeleton',
  '.sales-crm-loading',
  '.settings-loading',
  '.stock-loading',
].join(', ')

/**
 * True once the mock layer has answered everything it was asked.
 *
 * Three states have to be told apart, which is why this is not a one-liner:
 * the module has not been imported yet (the first request does that), it is busy,
 * or it is idle. Idle before any request was issued is the trap — that is exactly
 * the moment `networkidle` fires — so idleness only counts once traffic has been
 * seen, or once a page has demonstrably asked for nothing.
 */
async function waitForMockServerIdle(page: Page, timeout: number) {
  await page
    .waitForFunction(
      () => {
        const w = window as unknown as {
          __mockPending?: number
          __readyBusySeen?: boolean
          __readyFirstCheck?: number
          __readyIdleSince?: number
        }
        w.__readyFirstCheck ??= performance.now()

        if (typeof w.__mockPending !== 'number') {
          // The mocks module is loaded by the first API call. A page that never
          // makes one (a public page, a 404) must not hang here.
          return performance.now() - w.__readyFirstCheck > 2000
        }
        if (w.__mockPending > 0) {
          w.__readyBusySeen = true
          return false
        }
        w.__readyIdleSince ??= performance.now()
        return w.__readyBusySeen === true || performance.now() - w.__readyIdleSince > 400
      },
      undefined,
      { timeout },
    )
    .catch(() => {
      // Real-API mode has no such hook; the marker check below still applies.
    })
}

/**
 * The page has rendered its route and holds its data.
 *
 * Waits for three things, in the order they become true: the route's own content
 * exists (its chunk mounted), the mock server is idle, and nothing is still drawing
 * a skeleton.
 *
 * It is a floor, not a ceiling. A test that asserts something specific should still
 * wait for the value it is about — a number, a row, a name — because only that
 * proves the data it needs, rather than data in general, has arrived.
 */
export async function waitForDataReady(page: Page, timeout = 30_000) {
  const main = page.locator('[data-test="admin-main"]')
  if (await main.count()) {
    await main
      .locator('> *')
      .first()
      .waitFor({ state: 'attached', timeout })
      .catch(() => {
        // A guarded route may render nothing at all (flag off → /404).
      })
  }

  await waitForMockServerIdle(page, timeout)

  await expect
    .poll(async () => page.locator(LOADING_MARKERS).filter({ visible: true }).count(), { timeout })
    .toBe(0)
}
