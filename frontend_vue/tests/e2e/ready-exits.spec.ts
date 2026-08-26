import { testBare as test, expect } from './fixtures'
import { ALL_FLAGS_ENABLED } from './helpers/flags'
import {
  ROUTES_WITHOUT_DATA,
  ROUTES_WITHOUT_DATA_PATHS,
  readyExitOf,
  waitForDataReady,
  type ReadyExit,
} from './helpers/ready'

/**
 * Which branch each route leaves `waitForDataReady` by — and whether any of them is a
 * clock.
 *
 * There is no timed window on that path any more: a route is either declared in
 * `ROUTES_WITHOUT_DATA` (nothing to wait for) or waited for until its mock layer has
 * answered. This census is what keeps the declaration honest in both directions — a
 * route with data listed as data-free, or a data-free route left out of the list, is
 * named here by path.
 *
 * It is not a formality. The windows this replaced were 400ms and 2000ms, against
 * measured page loads of 1.6s idle and 19s under 40x CPU throttle; both fired in the
 * dangerous direction, waving a page through before it had asked for anything.
 */
/** Declared in the helper, asserted here: one list, not two. */
const DATA_FREE = [...ROUTES_WITHOUT_DATA_PATHS]

/** Every admin route: all of these load data and must exit by `traffic-seen`. */
const ADMIN = [
  '/admin/analytics/dashboard',
  '/admin/analytics/warehouse',
  '/admin/analytics/sales',
  '/admin/analytics/supply',
  '/admin/analytics/staff',
  '/admin/analytics/logistics',
  '/admin/analytics/pl-report',
  '/admin/analytics/deficit',
  '/admin/products',
  '/admin/products/prod-001',
  '/admin/products/categories',
  '/admin/products/categories/cat-1',
  '/admin/products/services',
  '/admin/clients',
  '/admin/clients/CL-001',
  '/admin/clients/new',
  '/admin/suppliers',
  '/admin/suppliers/1',
  '/admin/suppliers/new',
  '/admin/suppliers/config',
  '/admin/suppliers/bcc-request',
  '/admin/orders',
  '/admin/orders/ORD-001',
  '/admin/orders/new',
  '/admin/sales-crm',
  '/admin/warehouse',
  '/admin/warehouse/map',
  '/admin/warehouse/cutting',
  '/admin/warehouse/batches/whb-001',
  '/admin/warehouse/stock/prod-001',
  '/admin/warehouse/offcuts/who-001',
  '/admin/warehouse/movements/whm-001',
  '/admin/warehouse/deficit/whd-001',
  '/admin/finance/incoming',
  '/admin/finance/outgoing',
  '/admin/finance/archive',
  '/admin/notifications',
  '/admin/settings/profile',
  '/admin/settings/company',
  '/admin/settings/finance',
  '/admin/settings/units',
  '/admin/settings/order-statuses',
  '/admin/settings/logs',
]

async function exitFor(
  page: import('@playwright/test').Page,
  path: string,
): Promise<ReadyExit | string> {
  await page.goto(path)
  try {
    await waitForDataReady(page, 8000)
  } catch {
    // A page whose skeletons never clear is a finding of its own — report it by name
    // rather than letting the whole census die on it.
    const stuck = await page
      .locator(
        '.panel-skeleton, .glass-panel.loading, .skeleton, .sales-crm-loading, .settings-loading, .stock-loading',
      )
      .filter({ visible: true })
      .count()
    return `NEVER-READY (${stuck} loading markers still visible)`
  }
  return readyExitOf(page)
}

test.beforeEach(async ({ context }) => {
  await context.addInitScript(
    (flags) => localStorage.setItem('ff_overrides', JSON.stringify(flags)),
    ALL_FLAGS_ENABLED,
  )
})

test('every admin route is either traffic-seen or declared — never a silent third thing', async ({
  page,
}) => {
  test.setTimeout(300_000)

  // Утверждается ИМЕННО развилка, а не «все админские спрашивают данные». Статическая
  // админская страница когда-нибудь появится (справка, «о системе», заглушка раздела),
  // и правильным действием будет объявить её в списке — а не ослаблять этот тест под
  // новое поведение. Запрещено третье: выйти по `no-traffic`, то есть ничего не
  // спросить, не будучи объявленным.
  const wrong: string[] = []
  for (const path of ADMIN) {
    const exit = await exitFor(page, path)
    const declared = path in ROUTES_WITHOUT_DATA
    if (declared) {
      if (exit !== 'no-data-route') wrong.push(`${path} → declared but exited ${exit}`)
      // Объявление без причины — незакрытое объявление.
      if (!ROUTES_WITHOUT_DATA[path]?.trim()) wrong.push(`${path} → declared without a reason`)
      continue
    }
    if (exit !== 'traffic-seen') wrong.push(`${path} → ${exit}`)
  }
  console.log(
    wrong.length ? `неверная развилка:\n${wrong.join('\n')}` : 'all admin routes: traffic-seen',
  )
  expect(
    wrong,
    `admin routes that are neither traffic-seen nor declared:\n${wrong.join('\n')}`,
  ).toEqual([])
})

test('every declaration carries a reason', async () => {
  const unexplained = Object.entries(ROUTES_WITHOUT_DATA)
    .filter(([, reason]) => !reason?.trim())
    .map(([path]) => path)
  expect(unexplained, `declared without a reason: ${unexplained}`).toEqual([])
})

/** Маршрут, который точно спрашивает данные — положительный контроль для счётчика. */
const KNOWN_DATA_ROUTE = '/admin/notifications'

async function mockCalls(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __mockCalls?: number }).__mockCalls ?? -1)
}

test('the declared no-data routes ask for nothing, and are not waited for', async ({ page }) => {
  test.setTimeout(180_000)
  const exits = new Map<string, ReadyExit | string>()
  const asked = new Map<string, number>()

  for (const path of DATA_FREE) {
    exits.set(path, await exitFor(page, path))

    // Эти маршруты теперь НЕ ждут ничего, поэтому чтение счётчика обгоняет загрузку
    // мок-модуля: на странице его ещё нет. Ждём, пока число появится (в мок-режиме
    // `__mockMode` это обещает), иначе проверялось бы отсутствие значения вместо его
    // величины.
    await page.waitForFunction(
      () => typeof (window as unknown as { __mockCalls?: number }).__mockCalls === 'number',
      undefined,
      { timeout: 10_000 },
    )
    expect(await mockCalls(page), `${path} asked before the module even loaded`).toBe(0)

    // Утверждение об ОТСУТСТВИИ запросов требует окна, в котором запрос был бы виден
    // (#66). Счётчик растёт в момент вызова, но вызов идёт после `await import()` в
    // `apiGet`, то есть позже монтирования: прочитать сразу — значит прочитать до того,
    // как присутствие стало возможным.
    //
    // Окно взято от ИЗМЕРЕННОГО зазора «счётчик появился → первый запрос посчитан» на
    // маршруте с данными (`/admin/notifications`) под троттлингом CPU:
    //
    //   1x → 0 мс      20x → 72 мс      40x → 360 мс
    //
    // 700 мс — почти двойной запас над худшим измеренным. Проверено инверсией: объяви
    // здесь админский маршрут с данными (`/admin/notifications`) — тест краснеет и под
    // 20×, и под 40×. Под 40× он краснеет и одним этим окном, без проверки выше: за
    // 700 мс успевают быть посчитанными 11 запросов страницы.
    // Окно здесь и есть предмет проверки: доказывается, что за 700 мс НЕ случилось
    // ни одного запроса. Отсутствие события web-first утверждением не выражается —
    // ждать нечего, поэтому фиксированное ожидание тут законно.
    // eslint-disable-next-line sonarjs/no-fixed-wait-in-tests
    await page.waitForTimeout(700)
    asked.set(path, await mockCalls(page))
  }

  console.log('data-free exits:', JSON.stringify(Object.fromEntries(exits), null, 1))
  console.log('data-free mock calls:', JSON.stringify(Object.fromEntries(asked), null, 1))

  for (const [path, exit] of exits) {
    expect(exit, `${path} exited via ${exit}`).toBe('no-data-route')
    // И само основание объявления: они правда ничего не спросили. Маршрут, который
    // начнёт спрашивать, обязан выйти из списка, иначе его тесты молча перестанут ждать.
    expect(asked.get(path), `${path} made ${asked.get(path)} mock calls`).toBe(0)
  }

  // Положительный контроль: «ноль» выше стоит чего-то только если счётчик вообще
  // считает. На маршруте с данными, в том же браузере, он обязан вырасти.
  await page.goto(KNOWN_DATA_ROUTE)
  await waitForDataReady(page)
  expect(
    await mockCalls(page),
    `${KNOWN_DATA_ROUTE} counted nothing — the meter is dead`,
  ).toBeGreaterThan(0)
})
