import { testBare as test, expect } from './fixtures'
import { ALL_FLAGS_ENABLED } from './helpers/flags'
import { readyExitOf, waitForDataReady } from './helpers/ready'
import { holdAppBoot, REAL_API_BASE_URL, REAL_API_TOKEN, stubRealApi } from './helpers/realApi'

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

/**
 * Маркер загрузки, который рисует `SettingsLayout.vue`, пока настройки не пришли.
 *
 * Класс взят не с потолка: ровно он перечислен в `LOADING_MARKERS` (`helpers/ready.ts`) —
 * то есть это тот самый элемент, по которому ожидание принимает решение. Уберут его
 * оттуда — тест ниже покраснеет, а не станет тихо проверять чужой div.
 */
const LOADING_MARKER = '.settings-loading'

/**
 * Окно пробы: столько тест смотрит, не вернулось ли ожидание раньше времени.
 *
 * Ложно ЗЕЛЁНЫМ это окно сделать нельзя — ответы удержаны, и ожидание, которое правда
 * ждёт, не вернётся ни через две секунды, ни через час. Ложно КРАСНЫМ тоже: сломанное
 * ожидание возвращается за десятки миллисекунд (замерено: 112 мс на свободной машине,
 * 243 мс под двенадцатью busy-loop на восьми ядрах), и до двух секунд ему далеко.
 */
const PROBE = 2_000

test('пока маркер загрузки на экране, ожидание не возвращается', async ({ page }) => {
  const api = await stubRealApi(page, { held: true })
  await page.goto(ROUTE)

  // Ожидание начинается заведомо ПОСЛЕ того, как ему есть чего ждать. Прежняя редакция
  // этого порядка не задавала и мерила гонку: кто раньше — первый опрос ожидания или
  // первая отрисовка страницы.
  await expect(page.locator(LOADING_MARKER)).toBeVisible()

  const wait = waitForDataReady(page, BUDGET)
  const outcome = await Promise.race([
    wait.then(() => 'вернулось' as const),
    // Отсутствие события web-first утверждением не выражается: доказывается, что за
    // окно НЕ случилось возврата (питфолл #66, тот же приём, что в `ready-exits.spec.ts`).
    // eslint-disable-next-line sonarjs/no-fixed-wait-in-tests
    page.waitForTimeout(PROBE).then(() => 'ещё ждёт' as const),
  ])
  expect(outcome, `ожидание вернулось при стоящем маркере загрузки`).toBe('ещё ждёт')

  // Ответы отпущены — маркер уходит, и только теперь ожидание вправе вернуться.
  api.release()
  await wait

  expect(await readyExitOf(page)).toBe('no-mock-module')
  await expect(page.locator(LOADING_MARKER)).toHaveCount(0)
})

test('страница ещё не нарисована — ожидание выходит сразу и на пустой экран', async ({ page }) => {
  const api = await stubRealApi(page)
  const boot = await holdAppBoot(page)
  // `commit` — документ пришёл, скрипты ещё нет. Точка входа удержана, поэтому Vue не
  // смонтируется, пока тест не отпустит: это построенное состояние, а не пойманное.
  await page.goto(ROUTE, { waitUntil: 'commit' })

  await waitForDataReady(page, BUDGET)

  // Вот честный ответ на второе следствие пункта 2b, и он неприятный: признак «данные
  // пришли» в реальном режиме не держится НИ НА ЧЁМ. Счётчика запросов нет (тест выше),
  // а единственная оставшаяся опора — маркер загрузки, которого на неотрисованной
  // странице ещё не существует. Ожидание выходит на пустой экран — питфолл #64, ровно
  // тот, за которым охотится весь этот набор.
  //
  // Тест закрепляет ограничение, а не одобряет его: появится в `ready.ts` настоящий
  // признак для реального режима (ответы `fetch`) — он покраснеет и потребует переписать
  // себя. До тех пор проверка против реального API обязана ждать своё значение сама.
  expect(await readyExitOf(page)).toBe('no-mock-module')
  await expect(page.locator('#app')).toBeEmpty()
  expect(api.count, 'страница успела что-то спросить — проверялось бы не то').toBe(0)

  boot.release()
})
