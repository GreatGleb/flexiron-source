import { test, expect } from '../../fixtures'
import { enableAllFlags } from '../../helpers/flags'
import { openAdminPage } from '../../helpers/admin'

/**
 * Пункт 7 плана `review-followups.md`: обрезок стало возможно выбрать в строке заказа.
 *
 * Данные не зашиты (питфолл #15): и товар, и номер партии читаются с самой складской
 * вкладки. Свободный обрезок узнаётся по кнопке «отметить использованным», которая
 * рисуется только при статусе `available`, — то есть по признаку самого приложения, а не
 * по строке из сида.
 */

test.beforeEach(async ({ context }) => {
  await enableAllFlags(context)
})

/** Товар и номер партии первого СВОБОДНОГО обрезка — по данным приложения. */
async function firstAvailableOffcut(page: import('@playwright/test').Page) {
  await openAdminPage(page, '/admin/warehouse/offcuts', '[data-test="warehouse-offcut-row"]')
  const row = page
    .getByTestId('warehouse-offcut-row')
    .filter({ has: page.getByTestId('offcut-mark-used-btn') })
    .first()
  await expect(row).toBeVisible()
  const productName = ((await row.locator('td').first().textContent()) ?? '').trim()
  const batchNumber = ((await row.locator('code.lot-code').textContent()) ?? '').trim()
  expect(productName).not.toBe('')
  expect(batchNumber).not.toBe('')
  return { productName, batchNumber }
}

test.describe('Обрезки в добавлении позиции заказа', () => {
  test('под выбранным товаром показываются его свободные куски', async ({ page }) => {
    const { productName, batchNumber } = await firstAvailableOffcut(page)

    await openAdminPage(page, '/admin/orders/new', '[data-test="order-create-add-item-btn"]')
    await page.locator('[data-test="order-create-add-item-btn"]').click()
    const modal = page.locator('[data-test="add-order-items-modal"]')
    await expect(modal).toBeVisible()

    await modal.locator('[data-test="add-items-filters"] input').fill(productName)
    const productRow = modal.locator('[data-test="add-items-product-row"]').first()
    await expect(productRow).toContainText(productName)
    await productRow.click()

    // Признак — не «панель появилась», а строка про ИМЕННО ЭТОТ кусок: панель
    // существует и пустой, пока список кусков не пришёл.
    const offcutRow = modal
      .locator('[data-test="add-items-offcut-row"]')
      .filter({ hasText: batchNumber })
      .first()
    await expect(offcutRow).toBeVisible()
    // Размер и место — то, по чему кусок и выбирают; прочерк здесь означал бы, что
    // строка нарисована, а данных в ней нет.
    await expect(offcutRow.getByTestId('add-items-offcut-size')).not.toHaveText('—')
    await expect(offcutRow.getByTestId('add-items-offcut-material')).not.toHaveText('—')
  })

  test('выбор куска поднимает количество строки до его материала', async ({ page }) => {
    const { productName, batchNumber } = await firstAvailableOffcut(page)

    await openAdminPage(page, '/admin/orders/new', '[data-test="order-create-add-item-btn"]')
    await page.locator('[data-test="order-create-add-item-btn"]').click()
    const modal = page.locator('[data-test="add-order-items-modal"]')
    await modal.locator('[data-test="add-items-filters"] input').fill(productName)
    await modal.locator('[data-test="add-items-product-row"]').first().click()

    const offcutRow = modal
      .locator('[data-test="add-items-offcut-row"]')
      .filter({ hasText: batchNumber })
      .first()
    await expect(offcutRow).toBeVisible()

    // Материал куска — то число, до которого количество обязано подтянуться.
    const materialText = ((await offcutRow
      .getByTestId('add-items-offcut-material')
      .textContent()) ?? '') as string
    const material = Number(materialText.trim().split(' ')[0])
    expect(Number.isFinite(material)).toBe(true)
    expect(material).toBeGreaterThan(0)

    // Заведомо меньше куска, чтобы подтягивание было ВИДНО, каким бы кусок ни был:
    // утверждение «стало не меньше материала» устроило бы и бездействие (питфолл #68).
    const qty = modal.locator('[data-test="add-items-selected-qty"]').first()
    await qty.fill('0.01')
    await expect(qty).toHaveValue('0.01')

    await offcutRow.click()

    await expect(offcutRow.getByTestId('add-items-offcut-checkbox')).toBeChecked()
    await expect(qty).toHaveValue(String(material))
  })

  test('рядом стоит ссылка на экран резки', async ({ page }) => {
    const { productName } = await firstAvailableOffcut(page)

    await openAdminPage(page, '/admin/orders/new', '[data-test="order-create-add-item-btn"]')
    await page.locator('[data-test="order-create-add-item-btn"]').click()
    const modal = page.locator('[data-test="add-order-items-modal"]')
    await modal.locator('[data-test="add-items-filters"] input').fill(productName)
    await modal.locator('[data-test="add-items-product-row"]').first().click()

    const link = modal.getByTestId('add-items-create-offcut-link').first()
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/admin/warehouse/cutting')
  })
})
