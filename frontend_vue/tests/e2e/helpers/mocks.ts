import type { Page } from '@playwright/test'

/**
 * Freeze Date.now() and Math.random() to deterministic values so visual snapshots
 * and text assertions that depend on "now" or random data stay stable across runs.
 *
 * Call from `test.beforeEach` in a spec that depends on time/randomness.
 */
export async function freezeTime(page: Page, isoDate = '2026-04-18T12:00:00Z') {
  await page.addInitScript((iso) => {
    const fixed = new Date(iso).getTime()
    const OriginalDate = Date
    class FrozenDate extends OriginalDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) super(fixed)
        else super(...(args as ConstructorParameters<typeof Date>))
      }
      static now(): number {
        return fixed
      }
    }
    ;(globalThis as unknown as { Date: typeof Date }).Date = FrozenDate as unknown as typeof Date
    let seed = 42
    Math.random = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
  }, isoDate)
}
