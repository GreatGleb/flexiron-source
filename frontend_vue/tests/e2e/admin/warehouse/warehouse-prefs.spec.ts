import { type Page } from '@playwright/test'
import { test, expect } from '../../fixtures'
import { mockWarehouseEndpoints } from '../../mocks/warehouse'
import { navigateToAdmin } from '../../helpers/admin'
import { DATA_READY_TIMEOUT, waitForDataReady } from '../../helpers/ready'

/**
 * Сохранение и восстановление вида склада — то, чего не проверял никто.
 *
 * Коммит `df229a6` завёл сортировку остатков в сохраняемый вид и четыре загрузчика
 * (`loadBatchesView`, `loadOffcutsView`, `loadMovementsView`, `loadDeficitView`),
 * то есть двести строк кода, который работает ровно один раз — на `onMounted`. Ни
 * одна спека склада его не касалась: `grep -rn PREFS_KEY tests/` давал ноль. А это
 * как раз тот сорт кода, который отказывает молча: загрузчик, забытый в `onMounted`,
 * выглядит на странице ровно как загрузчик, который отработал и ничего не нашёл.
 *
 * Поэтому проверяется НЕ состояние виджета, а его последствие: восстановленный
 * поиск обязан сузить таблицу, восстановленная сортировка — переставить строки.
 * Виджет можно перерисовать другим компонентом, и спека переживёт это; последствие —
 * то самое, ради чего вид и сохраняют.
 */

const PREFS_KEY = {
  stock: 'warehouse_stock_prefs',
  batches: 'warehouse_batches_prefs',
  offcuts: 'warehouse_offcuts_prefs',
  movements: 'warehouse_movements_prefs',
  deficit: 'warehouse_deficit_prefs',
} as const

/** Имена товаров левой (фиксированной) таблицы остатков — правая держит те же строки. */
const stockNames = (page: Page) =>
  page.locator('.stock-table-fixed [data-test="warehouse-stock-row"] .name-link').allTextContents()

/**
 * Положить настройки и перезагрузить страницу.
 *
 * Именно перезагрузка, а не переход по вкладке: загрузчики висят на `onMounted`,
 * и без нового монтирования проверялось бы не то.
 */
async function seedPrefs(page: Page, key: string, prefs: unknown) {
  await page.evaluate(({ k, v }) => localStorage.setItem(k, v), {
    k: key,
    v: JSON.stringify(prefs),
  })
  await page.reload()
  await waitForDataReady(page)
}

const clickTab = (page: Page, tab: string) =>
  page.getByTestId(`warehouse-tab-${tab}`).first().click()

const searchValue = (page: Page, tab: string) =>
  page.getByTestId(`warehouse-${tab}-search`).locator('input').first()

test.describe('Warehouse view preferences', () => {
  test.beforeEach(async ({ page }) => {
    await mockWarehouseEndpoints(page)
    await navigateToAdmin(page, '/admin/warehouse')
  })

  test.describe('Stock tab', () => {
    test('save view writes the current sort, not only the filters', async ({ page }) => {
      // Первый клик по колонке — сортировка по ней по возрастанию, второй разворачивает.
      const byName = page.locator('.stock-table-fixed .th-sort-btn').first()
      await byName.click()
      await byName.click()

      await page.getByTestId('warehouse-stock-save-view-btn').click()

      const saved = await page.evaluate(
        (k) => JSON.parse(localStorage.getItem(k) ?? '{}'),
        PREFS_KEY.stock,
      )
      expect(saved.stockSortBy).toBe('name')
      expect(saved.stockSortDir).toBe('desc')
    })

    /**
     * Колонка взята `totalQuantity`, а не «Товар», и это не произвол.
     *
     * Страница шлёт по «Товару» `sortBy='name'`, которого не знает ни одна ветка
     * сортировки источника, — колонка выглядит сортируемой и не сортирует. Дефект
     * записан контрактом (`roo_code/roo-context/api/warehouse.md`, GET
     * /api/warehouse/stock, БАГ-03) вместе с `uomId`; проверять восстановление вида
     * на сломанной колонке значило бы получить зелёное на двух одинаковых порядках.
     *
     * Сравнение — с результатом клика, а не с отсортированным массивом: правила
     * сортировки принадлежат источнику, и повторять их в спеке значит проверять
     * спеку. Восстановление обязано давать ровно то же, что даёт рука.
     */
    test('saved sort survives a reload and gives the same order as clicking the column', async ({
      page,
    }) => {
      const natural = await stockNames(page)
      expect(natural.length).toBeGreaterThan(1)

      // Первая сортируемая колонка прокручиваемой части — «Количество».
      await page.locator('.stock-table-scroll .th-sort-btn').first().click()

      // Ждать смену порядка, а не снимать имена сразу: сортировка едет запросом,
      // источник отвечает из `setTimeout`, и один синхронный снимок застаёт
      // прежние строки. Так спека уже соврала один раз — «до» и «после» совпали,
      // и это выглядело как неработающая сортировка.
      // Пол проверки заодно: не сдвинувшийся порядок уронит ожидание здесь,
      // а не позже, где сравнение сошлось бы само с собой.
      await expect
        .poll(() => stockNames(page), { timeout: DATA_READY_TIMEOUT })
        .not.toEqual(natural)
      const clicked = await stockNames(page)

      await page.getByTestId('warehouse-stock-save-view-btn').click()
      await page.reload()
      await waitForDataReady(page)

      await expect.poll(() => stockNames(page), { timeout: DATA_READY_TIMEOUT }).toEqual(clicked)
    })

    test('saved search survives a reload and narrows the table', async ({ page }) => {
      const all = await stockNames(page)
      expect(all.length).toBeGreaterThan(1)

      // Слово из первой строки — искомое подмножество заведомо непусто и заведомо не всё.
      const needle = (all[0] ?? '').trim().split(/\s+/)[0] ?? ''
      expect(needle.length).toBeGreaterThan(0)
      await seedPrefs(page, PREFS_KEY.stock, { stockSearch: needle })

      const shown = await stockNames(page)
      expect(shown.length).toBeGreaterThan(0)
      for (const name of shown) {
        expect(name.toLowerCase()).toContain(needle.toLowerCase())
      }
      await expect(searchValue(page, 'stock')).toHaveValue(needle)
    })
  })

  /**
   * Четыре загрузчика, заведённые тем же коммитом. Каждый читает свой ключ, и
   * перепутанный ключ — самая дешёвая из возможных здесь ошибок: страница при ней
   * выглядит исправной, просто вид не возвращается.
   */
  test.describe('Remaining tabs restore their own filters', () => {
    for (const tab of ['batches', 'offcuts', 'movements', 'deficit'] as const) {
      test(`${tab} tab restores the saved search`, async ({ page }) => {
        const needle = `saved-${tab}`
        await seedPrefs(page, PREFS_KEY[tab], { search: needle })

        await clickTab(page, tab)
        await expect(page.getByTestId(`warehouse-${tab}-panel`)).toBeVisible({
          timeout: DATA_READY_TIMEOUT,
        })
        await expect(searchValue(page, tab)).toHaveValue(needle, { timeout: DATA_READY_TIMEOUT })
      })
    }
  })

  test('malformed preferences do not break the page', async ({ page }) => {
    // У каждого загрузчика есть `catch`, и до сих пор в него не заходил ни один тест.
    // Ветка без прогона — не обработка ошибки, а заявление о ней.
    await page.evaluate((keys) => {
      for (const key of Object.values(keys)) localStorage.setItem(key, '{не json')
    }, PREFS_KEY)
    await page.reload()
    await waitForDataReady(page)

    await expect(page.getByTestId('page-warehouse')).toBeVisible()
    expect((await stockNames(page)).length).toBeGreaterThan(0)

    for (const tab of ['batches', 'offcuts', 'movements', 'deficit'] as const) {
      await clickTab(page, tab)
      await expect(page.getByTestId(`warehouse-${tab}-panel`)).toBeVisible({
        timeout: DATA_READY_TIMEOUT,
      })
    }
  })
})
