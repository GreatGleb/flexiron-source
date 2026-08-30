import { type Page } from '@playwright/test'
import { test, expect } from '../../fixtures'
import { mockWarehouseEndpoints } from '../../mocks/warehouse'
import { openAdminPage } from '../../helpers/admin'
import { freezeTime } from '../../helpers/mocks'
import { waitForFontsReady, SNAPSHOT_OPTIONS } from '../../helpers/visual'

/**
 * Допуск для эталонов ПИЛЮЛИ.
 *
 * Общий `SNAPSHOT_OPTIONS` разрешает 1 % разошедшихся пикселей, и на строке
 * 1130×60 это 678 пикселей — больше, чем занимает сама пилюля. Замерено
 * 2026-08-30: оживление складского градиента (фон, рамка и свечение сменились у
 * всех 24 пилюль страницы) НЕ покрасило ни один эталон строки. То есть эталон
 * существовал и ничего не охранял — ровно та болезнь, ради которой пункт 5 и
 * заводился, только этажом ниже.
 *
 * У пилюли кадр целиком и есть предмет проверки, поэтому допуск нулевой.
 */
const PILL_SNAPSHOT_OPTIONS = { ...SNAPSHOT_OPTIONS, maxDiffPixelRatio: 0, threshold: 0 } as const

/**
 * Скриншот-эталоны складского модуля.
 *
 * Заведены 2026-08-30, пункт 5 открытых находок. До них у `tests/e2e/admin/warehouse/`
 * не было ни одного каталога `-snapshots` при пяти спеках и 84 тестах, и цена этого
 * измерена: первая версия правки пункта 13 меняла вид складских страниц, а все 1044
 * теста прошли молча.
 *
 * СНИМАЕТСЯ ПЕРВАЯ СТРОКА ТАБЛИЦЫ, А НЕ ВКЛАДКА ЦЕЛИКОМ. Первая версия этих эталонов
 * брала панель: выходило 970–1750 px и по полмегабайта на файл, против 112–290 px у
 * соседей (`clients.spec.ts-snapshots`). Такой снимок краснеет от любой строки данных
 * и на причину не указывает — а строка содержит ровно то, ради чего эталоны заводились:
 * статусную пилюлю, шрифт ячейки, высоту ряда, цвет разделителя.
 *
 * Данные детерминированы: маршруты перехвачены `mockWarehouseEndpoints`, часы
 * заморожены `freezeTime`.
 */

const DESKTOP = { width: 1440, height: 900 }

/**
 * Вкладка → строка таблицы, у которой снимается эталон.
 *
 * `pick` есть только у склада, и вот почему: его таблица разрезана на две
 * (`stock-table-split`) — слева закреплённое название, справа прокручиваемые данные, —
 * а `data-test` у их строк ОДИН. `.first()` берёт закреплённую половину, то есть кадр
 * 280×41 с одним названием и без единой цифры. Данные и статус лежат в правой.
 */
const TABS = [
  { tab: 'stock', row: 'warehouse-stock-row', pick: 'last' },
  { tab: 'batches', row: 'warehouse-batch-row', pick: 'first' },
  { tab: 'offcuts', row: 'warehouse-offcut-row', pick: 'first' },
  { tab: 'movements', row: 'warehouse-movement-row', pick: 'first' },
  { tab: 'deficit', row: 'warehouse-deficit-row', pick: 'first' },
] as const

async function openTab(page: Page, tab: string, rowTestId: string) {
  await mockWarehouseEndpoints(page)
  await page.setViewportSize(DESKTOP)
  await freezeTime(page)
  // Признак — СТРОКА, а не панель: панель существует и пустой, и снимок пустой
  // панели той же высоты читался бы как поехавшая вёрстка (питфолл #64).
  await openAdminPage(page, `/admin/warehouse/${tab}`, `[data-test="${rowTestId}"]`)
  await waitForFontsReady(page)
}

test.describe('Warehouse · visual', () => {
  for (const { tab, row, pick } of TABS) {
    test(`вкладка ${tab} — эталон строки`, async ({ page }) => {
      await openTab(page, tab, row)
      const target = pick === 'last' ? page.getByTestId(row).last() : page.getByTestId(row).first()
      await expect(target).toHaveScreenshot(`warehouse-row-${tab}.png`, SNAPSHOT_OPTIONS)
    })
  }

  /**
   * Пилюли снимаются отдельно от строк — см. `PILL_SNAPSHOT_OPTIONS`. Две вкладки,
   * потому что у них разные семейства цветов: у движений мятная (`pill-mint`),
   * у партий — успех/предупреждение.
   */
  for (const { tab, row } of [
    { tab: 'movements', row: 'warehouse-movement-row' },
    { tab: 'batches', row: 'warehouse-batch-row' },
  ] as const) {
    test(`вкладка ${tab} — эталон статусной пилюли`, async ({ page }) => {
      await openTab(page, tab, row)
      await expect(page.getByTestId(row).first().locator('.status-pill').first()).toHaveScreenshot(
        `warehouse-pill-${tab}.png`,
        PILL_SNAPSHOT_OPTIONS,
      )
    })
  }

  test('панель фильтров склада', async ({ page }) => {
    await openTab(page, 'movements', 'warehouse-movement-row')
    await expect(page.getByTestId('warehouse-filters')).toHaveScreenshot(
      'warehouse-filters.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('карточка партии — шапка со статусной пилюлей', async ({ page }) => {
    await mockWarehouseEndpoints(page)
    await page.setViewportSize(DESKTOP)
    await freezeTime(page)
    await openAdminPage(page, '/admin/warehouse/batches/whb-100', '[data-test="batch-card-header"]')
    await waitForFontsReady(page)
    await expect(page.getByTestId('batch-card-header')).toHaveScreenshot(
      'warehouse-batch-card-header.png',
      SNAPSHOT_OPTIONS,
    )
    await expect(page.getByTestId('batch-card-status-pill')).toHaveScreenshot(
      'warehouse-batch-card-pill.png',
      PILL_SNAPSHOT_OPTIONS,
    )
  })
})
