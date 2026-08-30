import { expect, type Page } from '@playwright/test'

/**
 * Waiting for the page to HAVE ITS DATA, rather than for the network to fall quiet.
 *
 * `waitForLoadState('networkidle')` lies in this app, and not by a little: under
 * mocks there is no request at all — `services/mocks/index.ts` answers from a
 * `setTimeout` — so "nothing left to load" becomes true long before anything is on
 * screen. Measured: at networkidle the dashboard's charts panel holds zero bars and
 * the supplier-card-config page holds nothing whatsoever.
 *
 * What makes it worse than a plain timing bug is how it fails. An empty panel is
 * exactly as tall as a full one, so a screenshot taken then is not an obvious blank
 * — it is a pixel diff that reads like a layout regression in code nobody touched.
 */

/**
 * Бюджет ожидания ПРИШЕДШИХ ДАННЫХ — один на весь набор.
 *
 * Дефолтный потолок `expect` — 5 секунд, и он не растягивается вместе с загрузкой машины,
 * в отличие от потолка самого теста (90 с). Замер 2026-08-30 на смене страницы движений
 * склада под `Emulation.setCPUThrottlingRate` — время от клика до новых строк, и отдельно
 * то, что успевает съесть сам клик:
 *
 *   rate   1    клик   96 мс   строки на   592 мс   (ожиданию досталось ~0.5 с)
 *   rate  20    клик 1373 мс   строки на  3363 мс   (~2.0 с)
 *   rate  40    клик 2849 мс   строки на  5319 мс   (~2.5 с)
 *   rate 100    клик 12.4 с    строки на  23.3 с    (~10.9 с — пять секунд кончились)
 *
 * **Запас честнее назвать тонким, чем пробитым.** На rate 40 — той нагрузке, которой
 * `playwright.config.ts` меряет свой потолок теста, — пятисекундного бюджета ещё хватает
 * с двукратным запасом. Ломается он между 40 и 100. Инверсия проведена на rate 100:
 * ожидание без бюджета падает с «Timeout 5000ms exceeded while waiting on the predicate»,
 * с бюджетом проходит.
 *
 * Отсюда: всякий `expect.poll`, который ждёт состояние ПОСЛЕ действия на странице
 * (пагинация, фильтр, отправка формы), берёт этот бюджет, а не дефолт. Значение то же, что
 * у `waitForDataReady`, и живёт оно здесь в одном экземпляре — двадцать две копии числа
 * разошлись бы молча.
 *
 * На успехе это не стоит ничего: `expect.poll` возвращается, как только условие выполнено.
 * Платит только падающий тест — он падает через 30 секунд вместо пяти.
 */
export const DATA_READY_TIMEOUT = 30_000

/** Anything the app draws while it is still waiting for its own data. */
const LOADING_MARKERS = [
  '.panel-skeleton',
  '.glass-panel.loading',
  '.skeleton',
  '.sales-crm-loading',
  '.settings-loading',
  '.stock-loading',
].join(', ')

/**
 * True once the mock layer has answered everything it was asked.
 *
 * Three states have to be told apart, which is why this is not a one-liner:
 * the module has not been imported yet (the first request does that), it is busy,
 * or it is idle. Idle before any request was issued is the trap — that is exactly
 * the moment `networkidle` fires — so idleness only counts once traffic has been
 * seen, or once a page has demonstrably asked for nothing.
 */
export type ReadyExit =
  /** The mock server answered at least once since this wait began — the signal. */
  | 'traffic-seen'
  /** A declared no-data route: nothing to wait for, so nothing was waited for. */
  | 'no-data-route'
  /** No mock layer at all — real-API mode, decided at once. */
  | 'no-mock-module'
  /** No hook at all — real-API mode. */
  | 'no-hook'
  /** The budget ran out with no traffic: a route that asks nothing and is not declared. */
  | 'no-traffic'

/**
 * Маршруты, которые ЗАКОННО не спрашивают у API ничего.
 *
 * Объявленный список вместо окна по времени. Раньше «страница ничего не спрашивает»
 * решалось часами: подождали 400 мс (а до этого — 2000 мс на загрузку мок-чанка) и,
 * если тихо, пошли дальше. Под нагрузкой это ложь ровно в опасную сторону: страница,
 * которая ЕЩЁ не спросила, объявлялась спросившей ничего, и проверка гонялась с
 * пустым экраном. Замерено на 40× троттлинге — первая строка приходила на 19-й
 * секунде.
 *
 * Значение — ПРИЧИНА, а не украшение: объявляя маршрут, объясняешь, почему он ничего не
 * спрашивает. Пустая причина — незакрытое объявление, и перепись её не пропустит; так
 * список остаётся объяснённым, а не превращается в свалку исключений.
 *
 * Список стережёт `ready-exits.spec.ts`: маршрут отсюда обязан выходить по ветке
 * `no-data-route` и не сделать ни одного запроса, а всякий прочий маршрут — по
 * `traffic-seen`. Единственное оставшееся время — общий бюджет ожидания, и он может
 * истечь только у маршрута, который данных не запрашивает и в списке не объявлен: это
 * `no-traffic`, громко и по имени.
 */
export const ROUTES_WITHOUT_DATA: Readonly<Record<string, string>> = {
  '/': 'landing page: static marketing copy',
  '/login': 'auth form: nothing is fetched until submit',
  '/register': 'auth form: nothing is fetched until submit',
  '/about': 'static text page',
  '/support': 'static text page',
  '/terms': 'static text page',
  '/screens': 'meta page: a hand-written list of routes',
  '/404': 'not-found page: nothing to fetch',
}

/** The declared paths alone. */
export const ROUTES_WITHOUT_DATA_PATHS = Object.keys(ROUTES_WITHOUT_DATA)

function asksForNothing(url: string): boolean {
  let path: string
  try {
    path = new URL(url).pathname
  } catch {
    return false
  }
  const normalized = path.replace(/\/+$/, '') || '/'
  return normalized in ROUTES_WITHOUT_DATA
}

/**
 * Which branch let the wait finish, recorded on the page.
 *
 * `traffic-seen` rests on `__mockCalls`, a counter that never decreases and is bumped
 * at the dispatcher, so a request that started and finished between two polls still
 * counts — and so does one that ended in an error, which the old bookkeeping (kept
 * inside `delay()`) never saw at all.
 *
 * No branch on this path believes a clock any more. A route either is declared as
 * asking for nothing, or is waited for until its mock layer has answered. `readyExitOf`
 * reads the branch back and `ready-exits.spec.ts` records it for every route.
 */
async function waitForMockServerIdle(page: Page, timeout: number) {
  if (asksForNothing(page.url())) {
    await page
      .evaluate(() => {
        ;(window as unknown as { __readyExit?: string }).__readyExit = 'no-data-route'
      })
      .catch(() => {
        // Nothing to record on a page that will not run scripts.
      })
    return
  }

  await page
    .waitForFunction(
      () => {
        const w = window as unknown as {
          __mockMode?: boolean
          __mockPending?: number
          __mockCalls?: number
          __readyCallsAtStart?: number
          __readyExit?: string
        }

        if (typeof w.__mockPending !== 'number') {
          // `__mockMode` is set synchronously at boot, before anything can be waited
          // on, and promises that the counter is on its way — so waiting for it needs
          // no clock. Without the flag there is no mock layer: real-API mode, decided
          // at once rather than guessed at after two seconds.
          if (w.__mockMode === true) return false
          w.__readyExit = 'no-mock-module'
          return true
        }
        if (w.__mockPending > 0) return false

        // Nothing in flight. Did anything fly SINCE THIS WAIT BEGAN? Only growth over
        // the baseline counts, or every wait after the first would return at once on
        // the strength of some earlier page's traffic — and inside an SPA every wait
        // but the first is a later one.
        if ((w.__mockCalls ?? 0) > (w.__readyCallsAtStart ?? 0)) {
          w.__readyExit = 'traffic-seen'
          return true
        }
        return false
      },
      undefined,
      { timeout },
    )
    .catch(async () => {
      // The budget ran out with no traffic at all. Either real-API mode with no hook,
      // or a route that asks for nothing and is missing from ROUTES_WITHOUT_DATA —
      // and the census names it rather than this returning quietly.
      await page
        .evaluate(() => {
          const w = window as unknown as { __mockMode?: boolean; __readyExit?: string }
          w.__readyExit = w.__mockMode === true ? 'no-traffic' : 'no-hook'
        })
        .catch(() => {
          // Real-API mode has no such hook; the marker check below still applies.
        })
    })
}

/** How the last `waitForDataReady` on this page finished. */
export async function readyExitOf(page: Page): Promise<ReadyExit> {
  return page.evaluate(
    () => ((window as unknown as { __readyExit?: string }).__readyExit ?? 'no-hook') as never,
  )
}

/**
 * The page has rendered its route and holds its data.
 *
 * Waits for three things, in the order they become true: the route's own content
 * exists (its chunk mounted), the mock server is idle, and nothing is still drawing
 * a skeleton.
 *
 * It is a floor, not a ceiling. A test that asserts something specific should still
 * wait for the value it is about — a number, a row, a name — because only that
 * proves the data it needs, rather than data in general, has arrived.
 */
export async function waitForDataReady(page: Page, timeout = DATA_READY_TIMEOUT) {
  // Every wait starts from scratch. Without this reset the SECOND wait on a page
  // returns instantly on the first one's bookkeeping — and inside an SPA (a tab
  // switch, a filter, a pagination click) every wait but the first is a second one.
  // That is not a theory: a test that snapshots rows right after such a wait was
  // reading the page before it redrew, and silently skipped three movement types.
  await page
    .evaluate(() => {
      const w = window as unknown as {
        __mockCalls?: number
        __readyCallsAtStart?: number
        __readyIdleSince?: number
        __readyExit?: string
      }
      w.__readyCallsAtStart = w.__mockCalls ?? 0
      w.__readyIdleSince = undefined
      w.__readyExit = undefined
    })
    .catch(() => {
      // Nothing to reset before the first navigation of a context.
    })

  const main = page.locator('[data-test="admin-main"]')
  if (await main.count()) {
    await main
      .locator('> *')
      .first()
      .waitFor({ state: 'attached', timeout })
      .catch(() => {
        // A guarded route may render nothing at all (flag off → /404).
      })
  }

  await waitForMockServerIdle(page, timeout)

  await expect
    .poll(async () => page.locator(LOADING_MARKERS).filter({ visible: true }).count(), { timeout })
    .toBe(0)
}
