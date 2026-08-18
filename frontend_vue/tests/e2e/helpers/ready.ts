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
export type ReadyExit =
  /** The mock server was seen working and then went idle — the honest signal. */
  | 'traffic-seen'
  /** It stayed idle: taken to mean the page asked for nothing. A time-based guess. */
  | 'idle-timeout'
  /** The mocks module never loaded: the page made no API call at all. Also a guess. */
  | 'no-mock-module'
  /** No hook at all — real-API mode. */
  | 'no-hook'

/**
 * Which branch let the wait finish, recorded on the page.
 *
 * Two of the four branches believe a clock rather than a signal, which is the very
 * thing pitfall #64 forbids — and the windows they trust (400ms, 2000ms) are smaller
 * than measured data delays under load (1.7–2.2s). The hole is narrow but real: a
 * page whose first request starts late would be waved through as "asked for nothing".
 *
 * So the assumption is made checkable instead of being argued about. `readyExitOf`
 * reads it back, and `ready-exits.spec.ts` walks every route to record which pages
 * leave by a timed branch. Anyone tempted to shorten these windows can see first
 * exactly whose correctness rests on them.
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
          __readyExit?: string
        }
        w.__readyFirstCheck ??= performance.now()

        if (typeof w.__mockPending !== 'number') {
          // The mocks module is loaded by the first API call. A page that never
          // makes one (a public page, a 404) must not hang here.
          if (performance.now() - w.__readyFirstCheck > 2000) {
            w.__readyExit = 'no-mock-module'
            return true
          }
          return false
        }
        if (w.__mockPending > 0) {
          w.__readyBusySeen = true
          return false
        }
        w.__readyIdleSince ??= performance.now()
        if (w.__readyBusySeen === true) {
          w.__readyExit = 'traffic-seen'
          return true
        }
        if (performance.now() - w.__readyIdleSince > 400) {
          w.__readyExit = 'idle-timeout'
          return true
        }
        return false
      },
      undefined,
      { timeout },
    )
    .catch(() => {
      // Real-API mode has no such hook; the marker check below still applies.
    })
}

/** How the last `waitForDataReady` on this page finished. */
export async function readyExitOf(page: Page): Promise<ReadyExit> {
  return page.evaluate(
    () => ((window as unknown as { __readyExit?: string }).__readyExit ?? 'no-hook') as never,
  )
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
