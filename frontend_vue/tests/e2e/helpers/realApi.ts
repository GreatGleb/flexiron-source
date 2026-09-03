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

/**
 * Ворота: обработчик маршрута стоит в них, пока тест их не откроет.
 *
 * Это замена задержке по часам, и замена вынужденная. Задержка отвечает на вопрос
 * «сколько ждать», а тесту нужно ответить на вопрос «дождались ли ЧЕГО-ТО», то есть
 * удержать состояние ровно до момента проверки. Пока ответы задерживались на 1500 мс,
 * тест мерил гонку между собственным первым опросом и первой отрисовкой страницы: на
 * незанятой машине выигрывала страница и тест был зелёным, под нагрузкой выигрывал
 * опрос — «ожидание вернулось через 112 мс при задержке 1500 мс». Открытые вручную
 * ворота гонки не оставляют: удержанное состояние не истекает само.
 */
function gate(): { readonly opened: Promise<void>; open: () => void } {
  let release!: () => void
  const opened = new Promise<void>((resolve) => {
    release = resolve
  })
  return { opened, open: () => release() }
}

/** Подмена `/api/**`: счётчик запросов и, при `held`, управляемая задержка ответов. */
export interface RealApiStub {
  /** Сколько запросов увидел ТЕСТ. Приложение в этом режиме не считает их ничем. */
  readonly count: number
  /** Отпустить удержанные и все последующие ответы. */
  release: () => void
}

/**
 * Подменить весь `/api/**` и считать запросы.
 *
 * Здесь это возможно ровно потому, что режим реальный: `apiGet` идёт через `fetch`, а не
 * через динамический import мок-слоя, — под моками `page.route` не видит НИЧЕГО (см.
 * комментарии в `supplier-card.spec.ts`). Бэкенд для этого спека не нужен и не поднимается:
 * предмет проверки — ожидание в `ready.ts`, а не ответы сервера.
 *
 * `held: true` держит КАЖДЫЙ ответ до `release()`: так «страница ещё грузится» становится
 * состоянием, которым распоряжается тест, а не мгновением, которое надо успеть застать.
 *
 * Возвращает счётчик — свой, тестовый. Приложение в этом режиме не считает запросы ничем:
 * `__mockCalls` живёт в мок-диспетчере, которого здесь нет.
 */
export async function stubRealApi(page: Page, { held = false } = {}): Promise<RealApiStub> {
  const seen = { requests: 0 }
  const responses = gate()
  if (!held) responses.open()

  await page.route('**/api/**', async (route) => {
    seen.requests += 1
    await responses.opened
    return emptyEnvelope(route)
  })

  return {
    get count() {
      return seen.requests
    },
    release: responses.open,
  }
}

/**
 * Задержать модуль-точку входа: страница закоммичена, приложение не запускалось.
 *
 * Нужно ровно для одного утверждения — что `waitForDataReady` в реальном режиме выходит
 * и на НЕОТРИСОВАННОЙ странице. Поймать этот момент гонкой нельзя (он и есть гонка),
 * поэтому он строится: `/src/main.ts` не отдаётся, пока тест не отпустит, и до тех пор
 * `#app` заведомо пуст, а запросов заведомо ноль.
 */
export async function holdAppBoot(page: Page): Promise<{ release: () => void }> {
  const entry = gate()
  // С запросом в конце (`?t=...` от Vite) glob-шаблон уже не совпал бы — поэтому regexp.
  await page.route(/\/src\/main\.ts(\?|$)/, async (route) => {
    await entry.opened
    return route.continue()
  })
  return { release: entry.open }
}
