import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  maxFailures: 0,

  /*
   * Тридцати секунд по умолчанию не хватает под полным прогоном, и это измерено, а не
   * предположено. Время до готовности одной страницы (`waitForDataReady`, ветка
   * traffic-seen) под троттлингом CPU:
   *
   *   1x   /admin/products 1.3s   categories 0.8s   product-card 0.9s
   *   20x  /admin/products 7.9s   categories 4.6s   product-card 5.1s
   *   40x  /admin/products 17.3s  categories 9.2s   product-card 11.8s
   *
   * Хук `beforeEach` визуальных тестов делает навигацию, ожидание данных и ожидание
   * шрифтов — то есть худший случай складывается. Пока ожидание уходило по часам
   * (400 мс / 2000 мс), запаса хватало: тест продолжался до данных и падал позже или
   * не падал вовсе. Ожидание стало честным — и потолок теста стал связывающим
   * ограничением: 14 падений из 16 в прогоне были «test timeout ... exceeded» ВНУТРИ
   * ожидания, а не проверкой.
   *
   * 90 секунд — пятикратный запас над худшим измеренным (17.3s) и больше суммы двух
   * фаз ожидания (30 + 30). Ускорять надо страницы, а не потолок опускать.
   */
  timeout: 90_000,
  reporter: [['list'], ['html', { open: 'never' }]],

  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    },
  },

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    testIdAttribute: 'data-test',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
