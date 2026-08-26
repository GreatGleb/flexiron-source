import type { Page, Route } from '@playwright/test'

/**
 * Режим реального API — то же приложение, но БЕЗ мок-слоя.
 *
 * Под моками `main.ts` ставит `window.__mockMode = true` синхронно на старте, поэтому
 * ветка `no-mock-module` в [`ready.ts`](./ready.ts) под ними недостижима в принципе: она
 * отвечает за режим, которого в основном прогоне нет. Проверить её можно только на
 * сборке с `VITE_USE_MOCKS=false` — отсюда второй dev-сервер в `playwright.config.ts`.
 *
 * Порт и команда живут здесь, а не в конфиге: одно место на оба употребления.
 */
export const REAL_API_PORT = 5174
export const REAL_API_BASE_URL = `http://localhost:${REAL_API_PORT}`

/**
 * Токен, из-за которого гвард роутера пускает в админку.
 *
 * В реальном режиме `router.beforeEach` проверяет `auth_token` и без него уводит на
 * `/login` — то есть на страницу из `ROUTES_WITHOUT_DATA`, которая выходит по другой
 * ветке. Без токена проверялось бы не то, что написано в имени теста.
 */
export const REAL_API_TOKEN = 'real-api-mode-probe-token'

/** Ответ-заглушка в конверте `ApiResponse` — пустая коллекция, без выдумывания данных. */
function emptyEnvelope(route: Route) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: [] }),
  })
}

/** Пауза внутри обработчика маршрута — задержка ответа, а не задержка теста. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Подменить весь `/api/**` и считать запросы.
 *
 * Здесь это возможно ровно потому, что режим реальный: `apiGet` идёт через `fetch`, а не
 * через динамический import мок-слоя, — под моками `page.route` не видит НИЧЕГО (см.
 * комментарии в `supplier-card.spec.ts`). Бэкенд для этого спека не нужен и не поднимается:
 * предмет проверки — ожидание в `ready.ts`, а не ответы сервера.
 *
 * `delayMs` задерживает КАЖДЫЙ ответ: так стойка скелетов становится управляемой величиной,
 * и «ожидание что-то ждало» превращается в измеримое утверждение, а не в надежду.
 *
 * Возвращает счётчик — свой, тестовый. Приложение в этом режиме не считает запросы ничем:
 * `__mockCalls` живёт в мок-диспетчере, которого здесь нет.
 */
export async function stubRealApi(page: Page, delayMs = 0): Promise<{ readonly count: number }> {
  const seen = { requests: 0 }
  await page.route('**/api/**', async (route) => {
    seen.requests += 1
    if (delayMs > 0) await sleep(delayMs)
    return emptyEnvelope(route)
  })
  return {
    get count() {
      return seen.requests
    },
  }
}
