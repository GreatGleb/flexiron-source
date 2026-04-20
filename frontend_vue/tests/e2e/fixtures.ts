import { test as base, expect } from '@playwright/test'
import { enableAllFlags } from './helpers/flags'

/**
 * Extended Playwright `test` that forces ALL feature flags ON before any page
 * in the test loads. Import from this file instead of '@playwright/test' in specs
 * unless the test specifically wants to control flags itself (feature-flags.spec.ts).
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    await enableAllFlags(context)
    await use(context)
  },
})

export { expect }
