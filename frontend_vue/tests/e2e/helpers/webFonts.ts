import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BrowserContext } from '@playwright/test'

/**
 * Serves the Google Fonts the app asks for from a copy checked into this repo,
 * so no test ever reaches the public internet for them.
 *
 * index.html links Inter and JetBrains Mono from fonts.googleapis.com. In a
 * browser that link is answered once and cached; under Playwright every test
 * gets a fresh context with a cold cache, so each test re-fetches the whole
 * set. That turned the font CDN into a load-bearing part of the suite, and it
 * failed in both of the ways a network dependency fails:
 *
 *  1. It 404s. Under 3-4 workers fonts.gstatic.com started answering 404 for
 *     individual .woff2 subsets, which Chromium reports as "Failed to load
 *     resource: the server responded with a status of 404". smoke.spec.ts
 *     asserts there are no console errors, so a random page in the run failed
 *     — staff and logistics most often, but never the same set twice.
 *  2. It arrives late, or partly. Text laid out in the fallback font is not
 *     the width of the same text in Inter: the supplier card action bar is
 *     519px wide with Inter and 504px without, and a table with auto layout
 *     redistributes every column. Element screenshots are sized by their
 *     content, so a snapshot taken mid-swap does not even have the dimensions
 *     of its baseline and cannot be compared at all.
 *
 * Both go away when the font is local: it is always there, always the same,
 * and always the real Inter — so the baselines recorded against a warm CDN
 * stay valid.
 *
 * The files under fixtures/fonts are exactly what fonts.googleapis.com serves
 * to Chromium (Inter v20 and JetBrains Mono v24, variable, one .woff2 per
 * unicode subset), and the two .css files are its responses verbatim — their
 * src URLs still point at fonts.gstatic.com, which is why that host is routed
 * here as well. To refresh them, re-download the CSS with a Chrome user agent
 * and every .woff2 it names; anything else changes the metrics and invalidates
 * every visual baseline in the suite.
 */

const FONTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'fonts')

const STYLESHEETS: Array<{ family: string; file: string }> = [
  { family: 'Inter', file: 'inter.css' },
  { family: 'JetBrains+Mono', file: 'jetbrains-mono.css' },
]

/** Reads a fixture once and keeps it — every test in the worker serves the same bytes. */
const cache = new Map<string, Buffer>()
function fixture(name: string): Buffer {
  let bytes = cache.get(name)
  if (!bytes) {
    bytes = readFileSync(join(FONTS_DIR, name))
    cache.set(name, bytes)
  }
  return bytes
}

/**
 * Registers the routes on a context, so they apply to every page it opens.
 * Called from fixtures.ts for all three `test` variants — a spec never has to
 * remember to do it, which is how the visual suites came to be without it.
 */
export async function pinWebFonts(context: BrowserContext) {
  await context.route('**/fonts.googleapis.com/**', (route) => {
    const url = route.request().url()
    const sheet = STYLESHEETS.find((s) => url.includes(`family=${s.family}`))
    if (!sheet) return route.fulfill({ status: 404, body: '' })
    route.fulfill({ contentType: 'text/css; charset=utf-8', body: fixture(sheet.file) })
  })

  await context.route('**/fonts.gstatic.com/**', (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop() ?? ''
    try {
      route.fulfill({ contentType: 'font/woff2', body: fixture(name) })
    } catch {
      // A subset we do not carry: fail loudly rather than silently fall back to
      // a different font and leave a visual diff nobody can explain.
      route.fulfill({ status: 404, body: '' })
    }
  })
}
