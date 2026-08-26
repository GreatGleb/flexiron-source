import { test, expect } from '../../fixtures'
import { navigateToAdmin } from '../../helpers/admin'

/**
 * Площадь обрезка — выведенная величина, а не поле.
 *
 * Поэтому проверяется не «поле показано», а само число и то, что прочерк стоит там, где
 * площадь НЕВЫРАЗИМА: у линейного куска ширины нет по природе, и ноль здесь соврал бы,
 * будто площадь есть и она нулевая.
 *
 * `who-001` — лист 500×300 (0.15 м²), `who-006` — отрезок трубы, ширина null.
 */

test.describe('Offcut area', () => {
  test('a sheet offcut shows the area computed from its dimensions', async ({ page }) => {
    await navigateToAdmin(page, '/admin/warehouse/offcuts/who-001')
    await expect(page.getByTestId('field-length')).toHaveValue('500 mm')
    await expect(page.getByTestId('field-width')).toHaveValue('300 mm')
    // 500 × 300 мм = 0.15 м². Число, а не факт наличия поля.
    await expect(page.getByTestId('field-area')).toHaveValue('0.15 m²')
  })

  test('a linear offcut has no area, and says so with a dash', async ({ page }) => {
    await navigateToAdmin(page, '/admin/warehouse/offcuts/who-006')
    await expect(page.getByTestId('field-width')).toHaveValue('—')
    await expect(page.getByTestId('field-area')).toHaveValue('—')
    // Не ноль: ноль означал бы «площадь есть и она нулевая».
    await expect(page.getByTestId('field-area')).not.toHaveValue('0 m²')
  })

  test('the create form recomputes the area as the dimensions are typed', async ({ page }) => {
    await navigateToAdmin(page, '/admin/warehouse/offcuts/new')
    const area = page.getByTestId('field-area')
    // Пока размеров нет — площадь невыразима.
    await expect(area).toHaveText('—')

    await page.getByTestId('field-length').fill('2000')
    // Одной длины недостаточно: требование знает домен, а не шаблон.
    await expect(area).toHaveText('—')

    await page.getByTestId('field-width').fill('1000')
    await expect(area).toHaveText('2 m²')

    // Пересчёт, а не однократный расчёт при вводе.
    await page.getByTestId('field-width').fill('500')
    await expect(area).toHaveText('1 m²')

    // Стёрли ширину — снова невыразима, а не «осталось прошлое число».
    await page.getByTestId('field-width').fill('')
    await expect(area).toHaveText('—')
  })
})
