import type { Page } from '@playwright/test'

/**
 * Intercepts Google Fonts CDN requests and returns empty 200 responses.
 *
 * Call from `test.beforeEach` in any spec whose page loads Google Fonts via
 * <link> tags in index.html.  This prevents:
 *
 * 1. `ERR_INTERNET_DISCONNECTED` console errors (→ tests that assert
 *    `expect(errors).toHaveLength(0)` no longer break).
 * 2. Navigation timeouts caused by font CDN requests hanging while the
 *    browser waits for the `load` event.
 * 3. Visual snapshot pixel diffs caused by fallback fonts rendering with
 *    different metrics than the expected "Inter" / "JetBrains Mono" fonts.
 */
export async function mockExternalRequests(page: Page) {
  await page.route('**/*.googleapis.com/**', (route) => {
    route.fulfill({ status: 200, body: '' })
  })
  await page.route('**/*.gstatic.com/**', (route) => {
    route.fulfill({ status: 200, body: '' })
  })
}
