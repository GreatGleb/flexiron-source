import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

/**
 * The order-pricing audit specs (seven passes, findings 1-28).
 *
 * They live apart from `vitest.config.ts` for two reasons: while a finding is
 * open its spec is red on purpose, so mixing them in would drown the regression
 * signal, and the fuzzers run tens of thousands of cases, which is too slow for
 * the everyday run. When the last finding is fixed, every one of these is green
 * and the two configs can be merged back into one.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/order-audit-*.spec.ts'],
    testTimeout: 120000,
    hookTimeout: 120000,
  },
})
