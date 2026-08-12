import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    // The audit specs have their own run — see vitest.audit.config.ts.
    exclude: ['**/node_modules/**', '**/dist/**', 'src/**/order-audit-*.spec.ts'],
  },
})
