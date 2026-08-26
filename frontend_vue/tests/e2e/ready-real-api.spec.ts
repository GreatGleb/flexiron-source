import { testBare as test, expect } from './fixtures'
import { ALL_FLAGS_ENABLED } from './helpers/flags'
import { readyExitOf, waitForDataReady } from './helpers/ready'
import { REAL_API_BASE_URL, REAL_API_TOKEN, stubRealApi } from './helpers/realApi'

/**
 * Ветка `no-mock-module` в `helpers/ready.ts` — единственная, которую весь остальной
 * набор не проходит НИ РАЗУ.
 *
 * Под моками `main.ts` ставит `window.__mockMode = true` синхронно на старте, поэтому
 * там ожидание всегда уходит в `traffic-seen` или `no-data-route`. Ветка про режим
 * реального API — а он в прогоне не поднимался вообще, и код, отвечающий за «выйти
 * сразу», был написан, но ни разу не исполнен.
 *
 * Здесь он исполняется: второй dev-сервер поднят с `VITE_USE_MOCKS=false`
 * (`playwright.config.ts`), то есть это то же приложение без мок-слоя. Бэкенда нет и не
 * нужно — `/api/**` подменяется через `page.route`, что в этом режиме вообще возможно
 * (под моками запрос не доходит до сети и перехватывать нечего).
 */
test.use({ baseURL: REAL_API_BASE_URL })

/**
 * Админский маршрут, которому пустых коллекций хватает, чтобы дорисоваться до конца.
 *
 * Маршрут обязан быть админским и с данными: страница из `ROUTES_WITHOUT_DATA` вышла бы
 * по ветке `no-data-route` и не доказала бы ничего про мок-слой.
 */
const ROUTE = '/admin/settings/units'

/**
 * Бюджет ожидания. Взят маленьким намеренно: ветка «дождались бюджета» (`no-hook`) и
 * ветка «решили сразу» (`no-mock-module`) исключают друг друга, поэтому имя ветки —
 * само по себе доказательство, что бюджет не выжидался, и часы для этого не нужны.
 */
const BUDGET = 8_000

test.beforeEach(async ({ context }) => {
  await context.addInitScript(
    ([flags, token]) => {
      localStorage.setItem('ff_overrides', JSON.stringify(flags))
      localStorage.setItem('auth_token', token)
      localStorage.setItem('flexiron_lang', 'en')
    },
    [ALL_FLAGS_ENABLED, REAL_API_TOKEN] as const,
  )
})

test('без мок-слоя ожидание выходит ветвью no-mock-module, а не по бюджету', async ({ page }) => {
  await stubRealApi(page)
  await page.goto(ROUTE)

  await waitForDataReady(page, BUDGET)

  // `no-hook` — это и есть «истёк бюджет, хука нет». Получить `no-mock-module` можно
  // только первым же опросом, до всякого ожидания.
  expect(await readyExitOf(page)).toBe('no-mock-module')
})

test('в реальном режиме счётчика запросов нет — приложение не считает их ничем', async ({
  page,
}) => {
  const api = await stubRealApi(page)
  await page.goto(ROUTE)
  await waitForDataReady(page, BUDGET)

  // Второе следствие пункта 2b: `__mockCalls` живёт в мок-диспетчере, а его здесь нет.
  // Значит признак «данные пришли» на счётчике в этом режиме не построить — и `null`
  // вместо числа это фиксирует, а не подразумевает.
  const hooks = await page.evaluate(() => {
    const w = window as unknown as {
      __mockMode?: boolean
      __mockPending?: number
      __mockCalls?: number
    }
    return {
      mockMode: w.__mockMode ?? null,
      mockPending: w.__mockPending ?? null,
      mockCalls: w.__mockCalls ?? null,
    }
  })
  expect(hooks).toEqual({ mockMode: null, mockPending: null, mockCalls: null })

  // При этом страница спрашивала — и не мало. Считал это ТЕСТ, приложение не считало
  // ничего: отсутствие счётчика выше не означает отсутствия трафика.
  expect(api.count, 'страница не сделала ни одного запроса — проверялось бы не то').toBeGreaterThan(
    0,
  )
})

test('оставшееся ожидание — исчезновение скелетов, и оно настоящее', async ({ page }) => {
  // Ответы задержаны на секунду с лишним, поэтому скелеты заведомо стоят в тот момент,
  // когда ветка `no-mock-module` уже приняла решение. Если бы ожидание держалось только
  // на ней, оно вернулось бы мгновенно и на пустой экран — как раз то, за чем этот
  // набор охотится (питфолл #64).
  const STALL = 1_500
  await stubRealApi(page, STALL)
  await page.goto(ROUTE)

  const startedAt = Date.now()
  await waitForDataReady(page, BUDGET)
  const waited = Date.now() - startedAt

  expect(await readyExitOf(page)).toBe('no-mock-module')
  // Задержку внёс сам тест, поэтому это не догадка о скорости машины, а нижняя граница,
  // которую ожидание не могло не переждать, если оно вообще чего-то ждёт.
  expect(waited, `ожидание вернулось через ${waited} мс при задержке ${STALL} мс`).toBeGreaterThan(
    STALL,
  )
})
