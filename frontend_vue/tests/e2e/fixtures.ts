import { test as base, expect } from '@playwright/test'
import { enableAllFlags } from './helpers/flags'

/**
 * Extended Playwright `test` that forces ALL feature flags ON and sets locale to
 * English before any page in the test loads.
 *
 * Import from this file instead of '@playwright/test' in ALL specs, except:
 *  - feature-flags.spec.ts (controls flags manually)
 *  - i18n.spec.ts (switches language as part of the test)
 *
 * MAINTENANCE: when you add/rename a flag in featureFlags.ts, update ALL_FLAGS_ENABLED in flags.ts.
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    await enableAllFlags(context)
    await context.addInitScript(() => {
      localStorage.setItem('flexiron_lang', 'en')
    })
    await use(context)
  },
})

/**
 * Variant without language lock — use for i18n.spec.ts and per-page i18n tests
 * that switch language as part of the test scenario.
 */
export const testWithFlags = base.extend({
  context: async ({ context }, use) => {
    await enableAllFlags(context)
    await use(context)
  },
})

export { expect }
