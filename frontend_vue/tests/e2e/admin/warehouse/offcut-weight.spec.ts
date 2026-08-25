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
