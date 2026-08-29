import { type Page } from '@playwright/test'
import { test, expect } from '../../fixtures'
import { navigateToAdmin } from '../../helpers/admin'
import { waitForDataReady } from '../../helpers/ready'

/**
 * Резка металла: операция, а не подпись.
 *
 * Проверяется арифметика на экране и её следствие в данных: сколько ушло с партии,
 * что появилось в обрезках, и где операция отказывает. Ни одного снимка — здесь нечего
 * смотреть глазами, здесь есть что посчитать.
 *
 * Партия INV-2025-078 (`whb-077`) меряется в МЕТРАХ — это и делает её пригодной для
 * примера из ТЗ: 2500 мм куска плюс 3 мм пропила дают 2.503 м.
 */

const METRE_BATCH = 'INV-2025-078'

/** Число из ячейки сводки — без единицы, которой подписан столбец. */
async function amount(page: Page, testId: string): Promise<number> {
  const text = (await page.getByTestId(testId).textContent())!.trim()
  return Number(text.split(' ')[0])
}

/** Открывает резку с уже выбранной партией — так на неё ведёт карточка партии. */
async function openCuttingFor(page: Page, batchNumber: string) {
  await navigateToAdmin(page, '/admin/warehouse/cutting')
  await page.getByTestId('warehouse-cutting-batch-search').locator('input').fill(batchNumber)
  const row = page.locator(`[data-test="warehouse-cutting-batch-row"]`, {
    hasText: batchNumber,
  })
  await expect(row).toHaveCount(1)
  await row.getByTestId('warehouse-cutting-batch-pick').click()
  await expect(page.getByTestId('warehouse-cutting-batch-number')).toHaveText(batchNumber)
}

async function fillRow(
  page: Page,
  index: number,
  values: { lengthMm?: number; widthMm?: number; weightKg?: number; pieces?: number },
) {
  const row = page.getByTestId('warehouse-cutting-row').nth(index)
  if (values.lengthMm !== undefined)
    await row.getByTestId('warehouse-cutting-row-length').fill(String(values.lengthMm))
  if (values.widthMm !== undefined)
    await row.getByTestId('warehouse-cutting-row-width').fill(String(values.widthMm))
  if (values.weightKg !== undefined)
    await row.getByTestId('warehouse-cutting-row-weight').fill(String(values.weightKg))
  if (values.pieces !== undefined)
    await row.getByTestId('warehouse-cutting-row-pieces').fill(String(values.pieces))
}

test.describe('Cutting operation', () => {
  /**
   * Пункт 7: поиск партии терял фокус на каждой букве.
   *
   * Механизм не в странице, а в панели: `.glass-panel.loading .panel-body`
   * скрыт через `display: none`, а тело — это и таблица, и само поле ввода.
   * Каждая буква перезапрашивала список, панель уходила в `loading`, поле
   * исчезало, и браузер снимал с него фокус.
   *
   * Два утверждения на два разных факта. Первое операционное: слово набирается
   * целиком, то есть буквы дошли до поля, а не в `document.body` после потери
   * фокуса. Второе механическое: панель ни разу не ушла в скелет, пока в ней
   * было живое содержимое. Порознь каждое слабее — первое прошло бы и при
   * другом способе удержать фокус, второе и при поле, вынесенном из панели.
   */
  test('поиск партии не теряет фокус на каждой букве', async ({ page }) => {
    await navigateToAdmin(page, '/admin/warehouse/cutting')
    // Признак ПРИШЕДШИХ данных, а не отрисованной панели: панель видна и со скелетом.
    await expect(page.getByTestId('warehouse-cutting-batch-row').first()).toBeVisible()

    // Считаем переходы панели в скелет НАЧИНАЯ ОТСЮДА: первая загрузка уже позади,
    // её скелет законен и к делу не относится.
    await page.evaluate(() => {
      const panel = document.querySelector('[data-test="warehouse-cutting-batch-panel"]')!
      const w = window as unknown as { __panelHidden: number }
      w.__panelHidden = 0
      new MutationObserver(() => {
        if (panel.classList.contains('loading')) w.__panelHidden++
      }).observe(panel, { attributes: true, attributeFilter: ['class'] })
    })

    const search = page.getByTestId('warehouse-cutting-batch-search').locator('input')
    await search.click()
    await expect(search).toBeFocused()

    // По букве, с паузой, которой хватает на перезапрос — как печатает человек.
    await page.keyboard.type('INV', { delay: 120 })

    // Слово набралось целиком: ни одна буква не ушла мимо поля.
    await expect(search).toHaveValue('INV')
    await expect(search).toBeFocused()

    // И тело панели не пряталось ни разу при живом содержимом.
    const hidden = await page.evaluate(
      () => (window as unknown as { __panelHidden: number }).__panelHidden,
    )
    expect(hidden).toBe(0)
  })

  test('the offcuts tab leads to cutting, not to the manual offcut form', async ({ page }) => {
    // Кнопка «Резка» вела на форму ручной записи обрезка, то есть мимо операции.
    await navigateToAdmin(page, '/admin/warehouse/offcuts')
    await page.getByTestId('warehouse-offcuts-cut-btn').click()
    await expect(page).toHaveURL(/\/admin\/warehouse\/cutting$/)
    await expect(page.getByTestId('warehouse-cutting-page')).toBeVisible()
  })

  test('the batch card carries its batch into the operation', async ({ page }) => {
    await navigateToAdmin(page, '/admin/warehouse/batches/whb-077')
    await page.getByTestId('batch-card-cutting-link').click()
    // Партия уже выбрана: таблицы выбора нет, номер стоит на месте.
    await expect(page.getByTestId('warehouse-cutting-batch-number')).toHaveText(METRE_BATCH)
    await expect(page.getByTestId('warehouse-cutting-batches-table')).toHaveCount(0)
  })

  test('a batch opened by its direct link still names the product', async ({ page }) => {
    // Имя товара берётся из справочника по `productId` в момент показа, а справочник
    // грузится вместе с данными страницы. У резки два входа: список партий и прямая
    // ссылка `?batchId=...`, которую строит карточка партии, — и по этой ссылке
    // попадает всякая перезагрузка страницы и всякое открытие из истории. Вход,
    // который справочник не принёс, показал бы прочерк, и дозагрузить его было бы
    // некому.
    await navigateToAdmin(page, '/admin/warehouse/batches/whb-077')
    const link = page.getByTestId('batch-card-cutting-link')
    const directUrl = (await link.getAttribute('href'))!
    await link.click()
    await expect(page.getByTestId('warehouse-cutting-batch-number')).toHaveText(METRE_BATCH)
    const insideSpa = (await page.getByTestId('warehouse-cutting-product').textContent())!.trim()
    // Непустота нужна отдельно: без неё равенство двух прочерков сошлось бы как успех.
    expect(insideSpa.length).toBeGreaterThan(1)

    // Тот же экран, открытый ссылкой напрямую, — это полная загрузка приложения, и
    // список партий на этом пути не запрашивается.
    await navigateToAdmin(page, directUrl)
    await expect(page.getByTestId('warehouse-cutting-batch-number')).toHaveText(METRE_BATCH)
    await expect(page.getByTestId('warehouse-cutting-product')).toHaveText(insideSpa)
  })

  test('the example from the spec: 2500 mm plus a 3 mm kerf is 2.503 m', async ({ page }) => {
    await openCuttingFor(page, METRE_BATCH)
    await fillRow(page, 0, { lengthMm: 2500, pieces: 1 })
    await page.getByTestId('warehouse-cutting-kerf').fill('3')

    expect(await amount(page, 'warehouse-cutting-total-pieces')).toBe(2.5)
    expect(await amount(page, 'warehouse-cutting-cuts')).toBe(1)
    expect(await amount(page, 'warehouse-cutting-total-kerf')).toBe(0.003)
    expect(await amount(page, 'warehouse-cutting-consumed')).toBe(2.503)
  })

  test('pieces are counted, material is measured', async ({ page }) => {
    // Два куска по 1250 мм — это два реза и 2.5 метра, а не два метра.
    await openCuttingFor(page, METRE_BATCH)
    await fillRow(page, 0, { lengthMm: 1250, pieces: 2 })
    await page.getByTestId('warehouse-cutting-kerf').fill('0')

    expect(await amount(page, 'warehouse-cutting-cuts')).toBe(2)
    expect(await amount(page, 'warehouse-cutting-total-pieces')).toBe(2.5)
    expect(await amount(page, 'warehouse-cutting-consumed')).toBe(2.5)
  })

  test('kerf and waste are added as separate amounts', async ({ page }) => {
    await openCuttingFor(page, METRE_BATCH)
    await fillRow(page, 0, { lengthMm: 1000, pieces: 3 })
    await page.getByTestId('warehouse-cutting-kerf').fill('4')
    await page.getByTestId('warehouse-cutting-waste').fill('0.5')

    expect(await amount(page, 'warehouse-cutting-total-kerf')).toBe(0.012)
    expect(await amount(page, 'warehouse-cutting-total-waste')).toBe(0.5)
    expect(await amount(page, 'warehouse-cutting-consumed')).toBe(3.512)
  })

  test('a second kind of piece adds its own cuts', async ({ page }) => {
    await openCuttingFor(page, METRE_BATCH)
    await fillRow(page, 0, { lengthMm: 1500, pieces: 2 })
    await page.getByTestId('warehouse-cutting-add-row').click()
    await fillRow(page, 1, { lengthMm: 750, pieces: 2 })
    await page.getByTestId('warehouse-cutting-kerf').fill('3')

    expect(await amount(page, 'warehouse-cutting-cuts')).toBe(4)
    expect(await amount(page, 'warehouse-cutting-total-pieces')).toBe(4.5)
    expect(await amount(page, 'warehouse-cutting-consumed')).toBe(4.512)
  })

  test('the kerf field is absent where a kerf cannot be expressed', async ({ page }) => {
    // Партия в килограммах: 3 мм в килограммы не переводятся без веса погонного
    // метра. Поля нет вовсе — видимое поле, которое молча ничего не делает, хуже
    // отсутствующего.
    await openCuttingFor(page, 'INV-2025-001')
    await expect(page.getByTestId('warehouse-cutting-kerf')).toHaveCount(0)
    await expect(page.getByTestId('warehouse-cutting-kerf-absent')).toBeVisible()
    await expect(page.getByTestId('warehouse-cutting-total-kerf')).toHaveCount(0)
  })

  test('a piece with no size refuses the operation and names the piece', async ({ page }) => {
    await openCuttingFor(page, METRE_BATCH)
    await fillRow(page, 0, { lengthMm: 1000, pieces: 1 })
    await page.getByTestId('warehouse-cutting-add-row').click()
    // Второй кусок без длины — на метровой партии его размер невыразим.
    await fillRow(page, 1, { pieces: 1 })

    await expect(page.getByTestId('warehouse-cutting-problem')).toContainText('2')
    await expect(page.getByTestId('warehouse-cutting-execute')).toBeDisabled()
    await expect(page.getByTestId('warehouse-cutting-row').nth(1)).toHaveClass(/row-invalid/)
  })

  test('cutting more than the batch holds is refused', async ({ page }) => {
    await openCuttingFor(page, METRE_BATCH)
    const remaining = await amount(page, 'warehouse-cutting-remaining')
    await fillRow(page, 0, { lengthMm: 1000, pieces: Math.ceil(remaining) + 1 })

    await expect(page.getByTestId('warehouse-cutting-problem')).toBeVisible()
    await expect(page.getByTestId('warehouse-cutting-execute')).toBeDisabled()
  })

  test('executing takes exactly the computed amount off the batch', async ({ page }) => {
    await openCuttingFor(page, METRE_BATCH)
    const before = await amount(page, 'warehouse-cutting-remaining')
    await fillRow(page, 0, { lengthMm: 2500, pieces: 1 })
    await page.getByTestId('warehouse-cutting-kerf').fill('3')
    const consumed = await amount(page, 'warehouse-cutting-consumed')
    const expected = await amount(page, 'warehouse-cutting-remaining-after')
    expect(consumed).toBe(2.503)

    await page.getByTestId('warehouse-cutting-execute').click()
    // Успех уводит на вкладку обрезков — операция проведена, а не отложена.
    await expect(page).toHaveURL(/\/admin\/warehouse\/offcuts$/)

    // Дальше — только внутри SPA: `page.goto` перезагрузил бы страницу, мок-хранилище
    // собралось бы из сидов заново, и партия «вернула» бы металл. Такая проверка
    // прошла бы, ничего не доказав.
    // Данные вкладки должны прийти ДО того, как в фильтр что-то вводится: сторож
    // `initialized` глотает изменение фильтра, случившееся раньше первой загрузки,
    // и проверка потом смотрит на нефильтрованный список (ловушка #20).
    await page.getByTestId('warehouse-tab-batches').first().click()
    await waitForDataReady(page)
    await page.getByTestId('warehouse-batches-search').locator('input').fill(METRE_BATCH)
    const row = page.locator('[data-test="warehouse-batch-row"]', { hasText: METRE_BATCH })
    await expect(row).toHaveCount(1)

    const after = Number(
      await row
        .getByTestId('warehouse-batch-remaining')
        .textContent()
        .then((v) => v!.trim()),
    )
    expect(after).toBe(expected)
    expect(Math.round((before - after) * 1000) / 1000).toBe(consumed)
  })

  test('the piece cut off shows up among the offcuts', async ({ page }) => {
    await openCuttingFor(page, METRE_BATCH)
    await fillRow(page, 0, { lengthMm: 1234, pieces: 1 })
    await page.getByTestId('warehouse-cutting-kerf').fill('3')
    await page.getByTestId('warehouse-cutting-execute').click()
    await expect(page).toHaveURL(/\/admin\/warehouse\/offcuts$/)

    // Фильтр по номеру партии: обрезок, вышедший из резки, лежит на ней. Поиск по
    // тексту здесь не годится — он смотрит только на название товара. И вводить его
    // можно лишь после того, как список загрузился первый раз (ловушка #20).
    await waitForDataReady(page)
    await page.getByTestId('warehouse-offcuts-batch-filter').locator('input').fill(METRE_BATCH)
    const rows = page.locator('[data-test="warehouse-offcut-row"]')
    // Обрезок из сидов на этой партии тоже есть (1500 мм) — значит новый именно
    // добавился, а не заменил собой список. Порядок здесь не утверждается: список
    // сортирует не эта страница.
    await expect(rows).toHaveCount(2)
    await expect(rows.filter({ hasText: '1234' })).toHaveCount(1)
    // Единица — партии, а не «шт»: кусок отрезан от метров, значит меряется в метрах.
    await expect(rows.filter({ hasText: '1234' })).toContainText('m')
  })
})
