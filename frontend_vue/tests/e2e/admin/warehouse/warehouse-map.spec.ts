import { test, expect } from '../../fixtures'
import { navigateToAdmin } from '../../helpers/admin'

/**
 * Карта склада — картинка, которую открывают штатным просмотрщиком браузера.
 *
 * Поэтому проверяется поведение, а не вид: куда ведёт ссылка после загрузки, куда
 * она ведёт после замены, и что остаётся после удаления. Снимков самой картинки
 * здесь нет — она загружается тестом и её вид ничего не доказывает.
 */

/** Два разных однопиксельных PNG — по ним видно, что ссылка сменилась. */
const RED_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const BLUE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
const NOT_AN_IMAGE = Buffer.from('%PDF-1.4 this is not a map', 'utf8')

async function uploadMap(page: import('@playwright/test').Page, body: Buffer, name: string) {
  await page
    .getByTestId('warehouse-map-upload')
    .locator('input[type="file"]')
    .setInputFiles({
      name,
      mimeType: name.endsWith('.pdf') ? 'application/pdf' : 'image/png',
      buffer: body,
    })
}

/** The href the "open" link points at, once one exists. */
async function currentHref(page: import('@playwright/test').Page): Promise<string> {
  const link = page.getByTestId('warehouse-map-open-link')
  await expect(link).toBeVisible()
  return (await link.getAttribute('href'))!
}

/**
 * Away and back through the app's own links.
 *
 * Not `page.reload()`: the mock layer keeps its store in module state, so a reload
 * wipes every entity in the system, not just this one. Re-entering the page proves
 * what is actually in question — that the map is read from storage on each visit
 * and not held in the component that uploaded it.
 */
async function leaveAndReturn(page: import('@playwright/test').Page) {
  await page.getByTestId('warehouse-map-back-btn').click()
  await expect(page.getByTestId('page-warehouse')).toBeVisible()
  await page.getByTestId('warehouse-map-btn').click()
  await expect(page.getByTestId('page-warehouse-map')).toBeVisible()
}

test.describe('Warehouse map', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToAdmin(page, '/admin/warehouse/map')
  })

  test('loads without console errors', async ({ page }) => {
    // The warehouse module has no entry in smoke.spec.ts (only analytics/warehouse
    // does), so the page carries its own no-crash check instead of being the one
    // warehouse route registered in a shared list.
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    page.on('pageerror', (err) => errors.push(err.message))

    await navigateToAdmin(page, '/admin/warehouse/map')

    await expect(page.getByTestId('page-warehouse-map')).toBeVisible()
    expect(errors).toHaveLength(0)
  })

  test('starts empty — no map, no broken image', async ({ page }) => {
    await expect(page.getByTestId('page-warehouse-map')).toBeVisible()
    await expect(page.getByTestId('warehouse-map-empty')).toBeVisible()
    await expect(page.getByTestId('warehouse-map-current')).toHaveCount(0)
    await expect(page.getByTestId('warehouse-map-open-link')).toHaveCount(0)
  })

  test('the warehouse page links here', async ({ page }) => {
    await navigateToAdmin(page, '/admin/warehouse')
    await page.getByTestId('warehouse-map-btn').click()
    await expect(page).toHaveURL(/\/admin\/warehouse\/map$/)
    await expect(page.getByTestId('page-warehouse-map')).toBeVisible()
  })

  test('uploading a map makes the link point at the uploaded file', async ({ page }) => {
    await uploadMap(page, RED_PNG, 'plan.png')

    const href = await currentHref(page)
    expect(href).toContain('data:image/png')
    // The link opens the file itself, in a new tab, with no opener back-reference.
    const link = page.getByTestId('warehouse-map-open-link')
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', /noopener/)
    await expect(page.getByTestId('warehouse-map-empty')).toHaveCount(0)
    await expect(page.getByTestId('warehouse-map-name')).toHaveText('plan.png')
  })

  test('the map is read back on the next visit, not held in the page', async ({ page }) => {
    await uploadMap(page, RED_PNG, 'plan.png')
    const before = await currentHref(page)

    await leaveAndReturn(page)

    expect(await currentHref(page)).toBe(before)
    await expect(page.getByTestId('warehouse-map-name')).toHaveText('plan.png')
  })

  test('replacing asks first, then the link points at the new file', async ({ page }) => {
    await uploadMap(page, RED_PNG, 'plan.png')
    const first = await currentHref(page)

    await uploadMap(page, BLUE_PNG, 'plan-v2.png')
    await expect(page.getByTestId('warehouse-map-replace-modal')).toBeVisible()
    // Until it is confirmed, the old map is still the current one.
    expect(await currentHref(page)).toBe(first)

    await page.getByTestId('warehouse-map-replace-confirm').click()
    // AppModal stays mounted and toggles `.active`, so it is hidden — never absent.
    await expect(page.getByTestId('warehouse-map-replace-modal')).not.toBeVisible()

    const second = await currentHref(page)
    expect(second).not.toBe(first)
    await expect(page.getByTestId('warehouse-map-name')).toHaveText('plan-v2.png')
  })

  test('cancelling the replacement keeps the old map', async ({ page }) => {
    await uploadMap(page, RED_PNG, 'plan.png')
    const first = await currentHref(page)

    await uploadMap(page, BLUE_PNG, 'plan-v2.png')
    await page.getByTestId('warehouse-map-replace-cancel').click()

    await expect(page.getByTestId('warehouse-map-replace-modal')).not.toBeVisible()
    expect(await currentHref(page)).toBe(first)
    await expect(page.getByTestId('warehouse-map-name')).toHaveText('plan.png')
  })

  test('deleting asks first, then leaves the empty state', async ({ page }) => {
    await uploadMap(page, RED_PNG, 'plan.png')

    await page.getByTestId('warehouse-map-delete-btn').click()
    await expect(page.getByTestId('warehouse-map-delete-modal')).toBeVisible()
    await page.getByTestId('warehouse-map-delete-cancel').click()
    await expect(page.getByTestId('warehouse-map-open-link')).toBeVisible()

    await page.getByTestId('warehouse-map-delete-btn').click()
    await page.getByTestId('warehouse-map-delete-confirm').click()

    await expect(page.getByTestId('warehouse-map-empty')).toBeVisible()
    await expect(page.getByTestId('warehouse-map-open-link')).toHaveCount(0)

    // Gone from storage, not just from this screen.
    await leaveAndReturn(page)
    await expect(page.getByTestId('warehouse-map-empty')).toBeVisible()
  })

  test('a file that is not an image never becomes the map', async ({ page }) => {
    await uploadMap(page, NOT_AN_IMAGE, 'invoice.pdf')

    await expect(page.getByTestId('warehouse-map-empty')).toBeVisible()
    await expect(page.getByTestId('warehouse-map-open-link')).toHaveCount(0)
  })
})
