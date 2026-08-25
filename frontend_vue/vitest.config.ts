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

    /*
     * Покрытие меряется по домену и только по нему: это единственный слой, где
     * поведение выражено функциями без Vue вокруг, и где число значит ровно то,
     * что написано. Считать процент по всему `src/` — мерить, сколько кода задели
     * тесты композаблов, а не сколько правил проверено.
     *
     * Пороги стоят по факту замера, а не «на вырост»: их роль — храповик, не цель.
     * Провалился ниже — либо вернуть тест, либо осознанно опустить порог этой строкой.
     */
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts'],
      exclude: ['src/domain/**/*.spec.ts'],
      reporter: ['text', 'text-summary'],
      thresholds: {
        // Замер 2026-08-25: 99.7 / 96.81 / 100 / 99.63 — пороги чуть ниже, чтобы
        // ратчет не дёргался от одной строки, но проседание было видно сразу.
        statements: 99,
        branches: 96,
        functions: 100,
        lines: 99,
      },
    },
  },
})
