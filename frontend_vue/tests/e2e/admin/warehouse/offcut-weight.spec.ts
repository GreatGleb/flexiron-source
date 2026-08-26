import { test, expect } from '../../fixtures'
import { navigateToAdmin } from '../../helpers/admin'

/**
 * Вес обрезка: хранится только введённое руками, показывается ручное или выведенное.
 *
 * Источник не хранится — он вычисляется: есть значение, значит руками. Кнопка
 * «рассчитать из размеров» обнуляет ручное, и расчётное число стоит РЯДОМ с ней до
 * нажатия: у who-001 это 2.36 против 2.355, у who-006 — 9.24 против 17.565, то есть
 * разница бывает в разы, и видеть её надо до, а не после.
 *
 * Все тринадцать обрезков в сидах несут вес, поэтому в демо путь вывода достижим только
 * через эту кнопку — так и задумано: какая из двух правд верна, решает человек.
 */

test.describe('Offcut weight: manual vs derived', () => {
  test('a seeded offcut says its weight was entered by hand', async ({ page }) => {
    await navigateToAdmin(page, '/admin/warehouse/offcuts/who-001')
    await expect(page.getByTestId('field-weight')).toHaveValue('2.36')
    await expect(page.getByTestId('field-weight-source')).toHaveText(/hand|руками|ranka/i)
  })

  test('the computed number is shown BEFORE the button is pressed', async ({ page }) => {
    await navigateToAdmin(page, '/admin/warehouse/offcuts/who-001')
    // 500 × 300 × 2 мм × 7850 = 2.355 кг. Оператор видит, что получит взамен.
    await expect(page.getByTestId('field-weight-preview')).toContainText('2.355')
    await expect(page.getByTestId('field-weight-use-derived')).toBeVisible()
  })

  test('pressing it clears the manual value and the derived one answers', async ({ page }) => {
    await navigateToAdmin(page, '/admin/warehouse/offcuts/who-001')
    await page.getByTestId('field-weight-use-derived').click()

    // Ручное обнулено — поле пустое, а не «записали выведенное».
    await expect(page.getByTestId('field-weight')).toHaveValue('')
    await expect(page.getByTestId('field-weight-source')).toHaveText(/derived|Выведен|Išvesta/i)
    // Кнопки больше нет: сбрасывать нечего.
    await expect(page.getByTestId('field-weight-use-derived')).toHaveCount(0)
  })

  test('a difference of times over is visible before the choice', async ({ page }) => {
    // who-006: в сиде 9.24, расчёт по кг/м товара партии — 17.565. Почти вдвое.
    await navigateToAdmin(page, '/admin/warehouse/offcuts/who-006')
    await expect(page.getByTestId('field-weight')).toHaveValue('9.24')
    await expect(page.getByTestId('field-weight-preview')).toContainText('17.565')
  })

  test('where the weight cannot be derived, the reason is named and no button is offered', async ({
    page,
  }) => {
    // who-003 лежит на партии товара «Материал без категории»: плотности нет, вывести
    // вес нечем. Причина словами, а не молчаливый ноль.
    await navigateToAdmin(page, '/admin/warehouse/offcuts/who-003')
    await expect(page.getByTestId('field-weight-not-derivable')).toBeVisible()
    await expect(page.getByTestId('field-weight-use-derived')).toHaveCount(0)
  })

  test('the manual value survives a save and still reads as manual', async ({ page }) => {
    await navigateToAdmin(page, '/admin/warehouse/offcuts/who-001')
    await page.getByTestId('field-weight').fill('3.14')
    await page.getByTestId('offcut-card-save-btn').click()
    await expect(page.getByTestId('field-weight')).toHaveValue('3.14')
    await expect(page.getByTestId('field-weight-source')).toHaveText(/hand|руками|ranka/i)
  })
})

test.describe('Offcut weight on the create form', () => {
  /** Товар prod-004 «Стальная труба 100x5», партия INV-2025-078 в метрах, 11.71 кг/м. */
  async function pickPipeBatch(page: import('@playwright/test').Page) {
    await navigateToAdmin(page, '/admin/warehouse/offcuts/new')
    // Фикстура ставит английский, поэтому и название английское: «Steel Pipe 100x5».
    // «100x5» само по себе ловит ещё и «Profile Pipe 100x50x3», поэтому строка точная.
    await page.getByTestId('offcut-create-search-products').locator('input').fill('100x5')
    const productRow = page.locator('[data-test="offcut-create-product-row"]', {
      hasText: 'Steel Pipe 100x5',
    })
    await expect(productRow).toHaveCount(1)
    await productRow.click()
    const batchRow = page.locator('[data-test="offcut-create-batch-row"]', {
      hasText: 'INV-2025-078',
    })
    await expect(batchRow).toHaveCount(1)
    await batchRow.click()
  }

  test('the form proposes a weight before anything is saved', async ({ page }) => {
    await pickPipeBatch(page)
    // Линейный кусок 2500 мм: 2.5 м × 11.71 кг/м = 29.275. Вес ещё не сохранён, и
    // оператор видит предложение системы до того, как принять его или переписать.
    await page.getByTestId('field-length').fill('2500')
    await expect(page.getByTestId('field-weight-preview')).toContainText('29.275')
    await expect(page.getByTestId('field-weight-source')).toHaveText(/derived|Выведен|Išvesta/i)
  })

  test('typing a weight by hand switches the source and offers the way back', async ({ page }) => {
    await pickPipeBatch(page)
    await page.getByTestId('field-length').fill('2500')
    await page.getByTestId('field-weight').fill('40')

    await expect(page.getByTestId('field-weight-source')).toHaveText(/hand|руками|ranka/i)
    // Расчётное число по-прежнему на виду — рядом с кнопкой, до нажатия.
    await expect(page.getByTestId('field-weight-preview')).toContainText('29.275')
    await page.getByTestId('field-weight-use-derived').click()
    await expect(page.getByTestId('field-weight')).toHaveValue('')
    await expect(page.getByTestId('field-weight-source')).toHaveText(/derived|Выведен|Išvesta/i)
  })
})
