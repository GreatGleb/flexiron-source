import type { Locator, Page } from '@playwright/test'
import { test, expect } from '../../fixtures'
import { enableAllFlags, setFlag } from '../../helpers/flags'
import { waitForDataReady } from '../../helpers/ready'

/**
 * Reads a line cell whether it is editable (an input) or frozen (plain text).
 * Frozen cells carry their suffix in the text; an input does not.
 */
async function lineCell(row: Locator, field: string): Promise<string> {
  const cell = row.locator(`[data-test="cell-${field}"]`)
  // Ноль здесь законен: у замороженной строки ячейка рисует текст, а не input. Поэтому
  // ждём КОНТЕЙНЕР — саму ячейку, которая есть в обоих случаях, — иначе чтение
  // обгоняет отрисовку строки и «input не найден» читается как «строка заморожена».
  await expect(cell).toBeVisible()
  const input = cell.locator('input')
  if ((await input.count()) > 0) return input.inputValue()
  return ((await cell.textContent()) ?? '').replace('%', '').trim()
}

/** Adds one product to the order being created, through the picker modal. */
async function addProductOnCreatePage(page: Page, productName: string) {
  await page.locator('[data-test="order-create-add-item-btn"]').click()
  const modal = page.locator('[data-test="add-order-items-modal"]')
  await expect(modal).toBeVisible()
  await modal.locator('[data-test="add-items-filters"] input').fill(productName)
  const row = modal.locator('[data-test="add-items-product-row"]').first()
  await expect(row).toContainText(productName)
  await row.click()
  await expect(modal.locator('[data-test="add-items-selected-row"]')).toHaveCount(1)
  await modal.locator('[data-test="add-items-save-btn"]').click()
  await expect(modal).toBeHidden()
}

test.beforeEach(async ({ context }) => {
  await enableAllFlags(context)
})

// ═══════════════════════════════════════════════════════════════════════════
// Orders List Page
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Orders List', () => {
  test('loads without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/admin/orders')
    await expect(page.locator('[data-test="page-orders"]')).toBeVisible()
    expect(errors).toHaveLength(0)
  })

  test('header is visible', async ({ page }) => {
    await page.goto('/admin/orders')
    await expect(page.locator('[data-test="orders-header"]')).toBeVisible()
    await expect(page.locator('h1')).toBeVisible()
  })

  test('filters section is visible', async ({ page }) => {
    await page.goto('/admin/orders')
    await expect(page.locator('[data-test="orders-filters"]')).toBeVisible()
    await expect(page.locator('[data-test="orders-filter-search"]')).toBeVisible()
    await expect(page.locator('[data-test="orders-filter-status"]')).toBeVisible()
  })

  test('table panel renders with rows', async ({ page }) => {
    await page.goto('/admin/orders')
    await expect(page.locator('[data-test="orders-table"]')).toBeVisible()
    await expect(page.locator('[data-test="orders-row"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('pagination is visible when orders exist', async ({ page }) => {
    await page.goto('/admin/orders')
    await expect(page.locator('[data-test="orders-pagination"]')).toBeVisible()
  })

  test('create button navigates to create page', async ({ page }) => {
    await page.goto('/admin/orders')
    await page.locator('[data-test="orders-header"] a.btn-primary').click()
    await expect(page).toHaveURL('/admin/orders/new')
  })

  test('order row links to card page', async ({ page }) => {
    await page.goto('/admin/orders')
    const firstRow = page.locator('[data-test="orders-row"]').first()
    await expect(firstRow).toBeVisible()

    const orderLink = firstRow.locator('a.name-link')
    await orderLink.click()
    await expect(page).toHaveURL(/\/admin\/orders\/(.+)/)
  })

  test('view button navigates to card page', async ({ page }) => {
    await page.goto('/admin/orders')
    const viewBtn = page.locator('[data-test="orders-view-btn"]').first()
    await expect(viewBtn).toBeVisible()
    await viewBtn.click()
    await expect(page).toHaveURL(/\/admin\/orders\/(.+)/)
  })

  test('the row says what the client pays, and how much of it arrived', async ({ page }) => {
    // ORD-005 carries a 25% advance. The list must agree with the card on both
    // numbers — the same order named two different totals is how nobody trusts
    // either screen.
    await page.goto('/admin/orders')
    // Фильтр, введённый раньше первой загрузки, глотает сторож `initialized` (#20), и
    // проверка потом смотрит на нефильтрованный список.
    await waitForDataReady(page)
    await page.fill('[data-test="orders-filter-search"] input', 'ORD-2026-005')
    const row = page.locator('[data-test="orders-row"]').first()
    await expect(row).toBeVisible()
    // The filter is applied by a request, and the old table is still on screen
    // until it answers. Read the number before the money, or the sums compared
    // below belong to two different orders.
    await expect(row).toContainText('ORD-2026-005')
    const listTotal = (await row.locator('[data-test="orders-row-total"]').textContent())!
    await expect(row.locator('[data-test="orders-row-paid"]')).toHaveText('25.00%')
    await expect(row.locator('[data-test="orders-row-shipped"]')).toHaveText('0.00%')

    await page.goto('/admin/orders/ORD-005')
    await page.waitForSelector('[data-test="order-item-row"]')
    const cardGross = await page.locator('[data-test="field-gross-total"]').inputValue()
    expect(listTotal.replace(/[^\d.]/g, '')).toBe(cardGross)
    await expect(page.locator('[data-test="field-paid-percent"]')).toHaveText('25.00%')
  })

  test('an order that left something behind refuses to be deleted, and says why', async ({
    page,
  }) => {
    // ORD-005 has a payment on it. Money received is a fact outside this system,
    // so the order does not simply vanish — and the message names the blocker
    // instead of a generic failure.
    await page.goto('/admin/orders')
    // Фильтр, введённый раньше первой загрузки, глотает сторож `initialized` (#20), и
    // проверка потом смотрит на нефильтрованный список.
    await waitForDataReady(page)
    await page.fill('[data-test="orders-filter-search"] input', 'ORD-2026-005')
    // Признак применённого фильтра — сама отфильтрованная строка, а не «список виден»:
    // нефильтрованный список виден тоже, и первой в нём стоит другой заказ. Тест
    // удалял ORD-2026-100 и ждал сообщение про оплаты, которого у того заказа нет
    // («Cannot delete: the order has an invoice»).
    const row = page.locator('[data-test="orders-row"]').filter({ hasText: 'ORD-2026-005' })
    await expect(row).toHaveCount(1)
    await row.locator('[data-test="orders-delete-btn"]').click()
    await page.locator('[data-test="orders-delete-confirm"]').click()

    // Тост приходит после ответа мока, а под полным прогоном ответ идёт дольше пяти
    // секунд, которые даёт expect по умолчанию.
    await expect(page.locator('.toast').first()).toContainText(/payment/i, { timeout: 20_000 })
    // Still there.
    await expect(page.locator('[data-test="orders-row"]').first()).toBeVisible()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Order Create Page
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Order Create', () => {
  test('loads without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/admin/orders/new')
    await expect(page.locator('[data-test="page-order-create"]')).toBeVisible()
    expect(errors).toHaveLength(0)
  })

  test('header with breadcrumbs and action bar is visible', async ({ page }) => {
    await page.goto('/admin/orders/new')
    // Breadcrumb
    await expect(page.locator('nav.breadcrumb, .breadcrumb').first()).toBeVisible()
    // Header
    await expect(page.locator('[data-test="order-create-header"]')).toBeVisible()
    await expect(page.locator('h1.page-title')).toContainText(/Create|Создание|Sukurti/)
    // Action bar with cancel + save buttons
    await expect(page.locator('[data-test="order-create-action-bar"]')).toBeVisible()
    await expect(page.locator('[data-test="order-create-cancel-btn"]')).toBeVisible()
    await expect(page.locator('[data-test="order-create-save-btn"]')).toBeVisible()
  })

  test('client selection panel renders with search, list and pagination', async ({ page }) => {
    await page.goto('/admin/orders/new')
    await expect(page.locator('[data-test="order-create-client-panel"]')).toBeVisible()
    await expect(page.locator('[data-test="order-create-client-search"]')).toBeVisible()
    await expect(page.locator('[data-test="order-create-client-list"]')).toBeVisible()
    // Client radio items should be visible
    await expect(page.locator('[data-test="order-create-client-item"]').first()).toBeVisible({
      timeout: 5000,
    })
    // Pagination should be visible for multiple clients
    await expect(page.locator('[data-test="order-create-client-pagination"]')).toBeVisible()
  })

  test('client selection highlights selected client', async ({ page }) => {
    await page.goto('/admin/orders/new')
    // Wait for clients to load
    await expect(page.locator('[data-test="order-create-client-item"]').first()).toBeVisible({
      timeout: 5000,
    })
    // Click the client label (native radio is hidden via display:none for custom radio styling)
    await page.locator('[data-test="order-create-client-item"]').first().click()
    // Selected count indicator should appear
    await expect(page.locator('[data-test="order-create-client-selected"]')).toBeVisible()
  })

  test('notes panel is visible', async ({ page }) => {
    await page.goto('/admin/orders/new')
    await expect(page.locator('[data-test="order-create-notes-panel"]')).toBeVisible()
    await expect(page.locator('[data-test="order-create-notes"]')).toBeVisible()
  })

  test('leaving a started order asks in our own dialog, once, and can be refused', async ({
    page,
  }) => {
    // Never a `window.confirm`: a dialog handler would fire if one appeared, and
    // the assertions below would then be looking at a page that already left.
    let systemDialogs = 0
    page.on('dialog', (d) => {
      systemDialogs++
      void d.dismiss()
    })

    await page.goto('/admin/orders/new')
    await page.locator('[data-test="order-create-notes"]').fill('half an order')

    await page.click('[data-test="order-create-cancel-btn"]')
    const modal = page.locator('[data-test="order-create-leave-modal"]')
    await expect(modal).toBeVisible()

    // Refusing keeps the page and everything typed into it.
    await page.click('[data-test="order-create-leave-stay"]')
    await expect(modal).toBeHidden()
    await expect(page).toHaveURL(/\/admin\/orders\/new/)
    await expect(page.locator('[data-test="order-create-notes"]')).toHaveValue('half an order')

    // Asked once per attempt — the old code asked, navigated, and asked again.
    await page.click('[data-test="order-create-cancel-btn"]')
    await expect(modal).toBeVisible()
    await page.click('[data-test="order-create-leave-discard"]')
    await expect(page).toHaveURL(/\/admin\/orders$/)
    await expect(modal).toBeHidden()

    expect(systemDialogs).toBe(0)
  })

  test('leaving an untouched order asks nothing', async ({ page }) => {
    await page.goto('/admin/orders/new')
    await page.click('[data-test="order-create-cancel-btn"]')
    await expect(page).toHaveURL(/\/admin\/orders$/)
    await expect(page.locator('[data-test="order-create-leave-modal"]')).toHaveCount(0)
  })

  test('document type panel renders with dropdown', async ({ page }) => {
    await page.goto('/admin/orders/new')
    await expect(page.locator('[data-test="order-create-doctype-panel"]')).toBeVisible()
    await expect(page.locator('[data-test="order-create-doctype"]')).toBeVisible()
  })

  test('items section is visible with add button', async ({ page }) => {
    await page.goto('/admin/orders/new')
    await expect(page.locator('[data-test="order-create-items"]')).toBeVisible()
    await expect(page.locator('[data-test="order-create-add-item-btn"]')).toBeVisible()
  })

  test('services section is visible with add button', async ({ page }) => {
    await page.goto('/admin/orders/new')
    await expect(page.locator('[data-test="order-create-services"]')).toBeVisible()
    await expect(page.locator('[data-test="order-create-add-service-btn"]')).toBeVisible()
  })

  test('files section with dropzone is visible', async ({ page }) => {
    await page.goto('/admin/orders/new')
    await expect(page.locator('[data-test="order-create-files"]')).toBeVisible()
    await expect(page.locator('[data-test="order-create-file-dropzone"]')).toBeVisible()
  })

  test('saves the lines that are on screen, duplicates and removals included', async ({ page }) => {
    await page.goto('/admin/orders/new')
    await page.locator('[data-test="order-create-client-item"]').first().click()

    // Twice the same product, then a different one: the duplicate is the case
    // that used to disappear, because the queue was keyed by product.
    await addProductOnCreatePage(page, 'Aluminium Pipe 25x2')
    await addProductOnCreatePage(page, 'Aluminium Pipe 25x2')
    await addProductOnCreatePage(page, 'Copper Pipe 15x1')

    const rows = page.locator('[data-test="order-create-item-row"]')
    await expect(rows).toHaveCount(3)

    await rows.nth(1).locator('button').click()
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText('Aluminium Pipe 25x2')
    await expect(rows.nth(1)).toContainText('Copper Pipe 15x1')

    await page.locator('[data-test="order-create-save-btn"]').click()
    await page.waitForURL(/\/admin\/orders\/ORD-/)

    // The created order is the table that was on screen — no line left behind.
    const savedRows = page.locator('[data-test="order-item-row"]')
    await expect(savedRows).toHaveCount(2)
    await expect(savedRows.nth(0)).toContainText('Aluminium Pipe 25x2')
    await expect(savedRows.nth(1)).toContainText('Copper Pipe 15x1')
  })

  /**
   * One product, one price, whichever screen it was added from.
   *
   * What this does NOT cover, and it is the half that mattered: a product with no
   * catalogue price is quoted as cost plus the order's markup, and the markup
   * arrives as a prop the create page used not to pass — so the same product was
   * quoted at cost here and at cost + markup on the card. That branch cannot be
   * reached from a test today: the only seeded product without a catalogue price
   * is Cutting Oil (`prod-006`) and the warehouse has no batch for it, so it has
   * no cost either and both screens answer zero. `page.route()` is no help — with
   * `VITE_USE_MOCKS` the app issues no HTTP at all.
   *
   * Reaching it needs a seeded product that has stock and no catalogue price.
   * Until then this guards the weaker half: that the two screens agree at all.
   */
  test('the picker quotes the same price here as it does on a card', async ({ page }) => {
    const product = 'Aluminium Pipe 25x2'

    async function quotedPriceIn(modal: ReturnType<Page['locator']>): Promise<string> {
      await modal.locator('[data-test="add-items-filters"] input').fill(product)
      const row = modal.locator('[data-test="add-items-product-row"]').first()
      await expect(row).toContainText(product)
      await row.click()
      const selected = modal.locator('[data-test="add-items-selected-row"]').first()
      await expect(selected).toBeVisible()
      return (await selected.locator('[data-test="add-items-price"]').innerText()).trim()
    }

    await page.goto('/admin/orders/new')
    await page.locator('[data-test="order-create-add-item-btn"]').click()
    const createModal = page.locator('[data-test="add-order-items-modal"]')
    await expect(createModal).toBeVisible()
    const onCreate = await quotedPriceIn(createModal)

    await page.goto('/admin/orders/ORD-001')
    await page.locator('[data-test="order-add-item-btn"]').click()
    const cardModal = page.locator('[data-test="add-order-items-modal"]')
    await expect(cardModal).toBeVisible()
    const onCard = await quotedPriceIn(cardModal)

    expect(onCreate).toBe(onCard)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Order Card Page
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Order Card', () => {
  test('loads without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="page-order-card"]')).toBeVisible()
    expect(errors).toHaveLength(0)
  })

  test('header with breadcrumbs, title and status pill is visible', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-card-header"]')).toBeVisible()
    await expect(page.locator('h1.page-title')).toBeVisible()
    await expect(page.locator('[data-test="order-card-status-pill"]')).toBeVisible()
  })

  test('save bar with action buttons is visible', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-card-save-bar"]')).toBeVisible()
  })

  test('entity card grid with 3 columns is visible', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-info-left"]')).toBeVisible()
    // The centre column IS the financial panel — there is no separate wrapper.
    await expect(page.locator('[data-test="order-financial"]')).toBeVisible()
    await expect(page.locator('[data-test="order-info-right"]')).toBeVisible()
  })

  test('items section renders with table', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-items"]')).toBeVisible()
  })

  test('services section is visible', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-services"]')).toBeVisible()
  })

  test('files section with dropzone is visible', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-files"]')).toBeVisible()
  })

  test('audit log section is visible', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-audit"]')).toBeVisible()
  })

  test('error state for non-existent order', async ({ page }) => {
    await page.goto('/admin/orders/DOES-NOT-EXIST')
    await expect(page.locator('[data-test="order-card-error"]')).toBeVisible({ timeout: 5000 })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Order Card — Field values & structure
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Order Card › fields & structure', () => {
  test('status pill and hint are visible', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-card-status-pill"]')).toBeVisible()
    await expect(page.locator('[data-test="order-card-status-hint"]')).toBeVisible()
  })

  test('save bar is present', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-card-save-bar"]')).toBeVisible()
  })

  test('left column fields render', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-info-left"]')).toBeVisible()
    // Order number and client name are readonly static fields
    await expect(
      page.locator('[data-test="order-info-left"] .glass-input-static').first(),
    ).toBeVisible()
  })

  test('center column financial fields render', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    for (const field of [
      'field-total-cost',
      'field-default-margin',
      'field-default-discount',
      'field-vat-percent',
      'field-net-total',
      'field-vat-amount',
      'field-gross-total',
      'field-total-margin',
      'field-effective-discount',
      'field-total-weight',
      'field-notes',
    ]) {
      await expect(page.locator(`[data-test="${field}"]`)).toBeVisible()
    }
  })

  test('the panel shows the money the order actually comes to', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    // VAT on the net total, and the gross is the two added up. The old panel
    // charged the tax on the cost and stacked margin on top of it, coming to 15%
    // over on every order it touched. Asserted as the relationship rather than as
    // three fixed figures: the demo's prices are seeded data and they have moved
    // once already, but this arithmetic may not.
    const net = Number(await page.locator('[data-test="field-net-total"]').inputValue())
    const vat = Number(await page.locator('[data-test="field-vat-amount"]').inputValue())
    const gross = Number(await page.locator('[data-test="field-gross-total"]').inputValue())
    expect(net).toBeGreaterThan(0)
    expect(vat).toBeCloseTo(net * 0.21, 2)
    expect(gross).toBeCloseTo(net + vat, 2)

    // Cost is the cost of the GOODS — read off the warehouse batches the lines
    // consume, not "the selling price times a ratio". The absolute figure belongs
    // to the batches, so what is asserted here is the relationship that must hold
    // whatever they cost: margin is what is left of the net after the cost.
    const cost = Number(await page.locator('[data-test="field-total-cost"]').inputValue())
    const margin = Number(await page.locator('[data-test="field-total-margin"]').inputValue())
    expect(cost).toBeGreaterThan(0)
    expect(cost).toBeLessThan(net)
    expect(margin).toBeCloseTo(net - cost, 2)

    // And it agrees with the lines it is the sum of.
    const rows = page.locator('[data-test="order-item-row"]')
    // `count()` в условии цикла читается на каждой итерации и до отрисовки даёт ноль:
    // сумма по нулю строк равна нулю, и `toBeCloseTo` сравнил бы её с нулём же.
    await expect(rows.first()).toBeVisible()
    let lineCosts = 0
    const rowCount = await rows.count()
    expect(rowCount).toBeGreaterThan(0)
    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i)
      lineCosts += Number(await lineCell(row, 'unitCost')) * Number(await lineCell(row, 'quantity'))
    }
    expect(cost).toBeCloseTo(lineCosts, 1)
  })

  test('a zero-rated order charges no VAT', async ({ page }) => {
    await page.goto('/admin/orders/ORD-008')
    const net = await page.locator('[data-test="field-net-total"]').inputValue()
    await expect(page.locator('[data-test="field-vat-amount"]')).toHaveValue('0.00')
    await expect(page.locator('[data-test="field-gross-total"]')).toHaveValue(net)
  })

  test('an order-wide discount is visible, not hidden at zero', async ({ page }) => {
    await page.goto('/admin/orders/ORD-002')
    await expect(page.locator('[data-test="field-effective-discount"]')).toHaveValue('5.00')
    await expect(page.locator('[data-test="field-default-discount"]')).toHaveValue('5')
  })

  test('editing the total spreads it across the lines', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="field-gross-total"]')

    await page.fill('[data-test="field-gross-total"]', '20328.99')
    await page.locator('[data-test="field-gross-total"]').press('Enter')
    await expect(page.locator('[data-test="allocate-modal"]')).toBeVisible()
    // Reachable amount — no "this total does not exist" warning.
    await expect(page.locator('[data-test="allocate-unreachable"]')).toHaveCount(0)

    await page.click('[data-test="allocate-confirm"]')
    await expect(page.locator('[data-test="allocate-modal"]')).toBeHidden()
    await expect(page.locator('[data-test="field-gross-total"]')).toHaveValue('20328.99')
    await expect(page.locator('[data-test="field-net-total"]')).toHaveValue('16800.82')
  })

  test('a total that cannot exist is announced, never quietly substituted', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="field-gross-total"]')
    // With 21% VAT rounded to cents there is no net that grosses up to 20000.00.
    await page.fill('[data-test="field-gross-total"]', '20000')
    await page.locator('[data-test="field-gross-total"]').press('Enter')
    await expect(page.locator('[data-test="allocate-unreachable"]')).toContainText('20000.01')
  })

  test('unsaved lines block the total edit rather than failing on the server', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.click('[data-test="order-add-item-btn"]')
    await page.waitForSelector('[data-test="add-order-items-modal"]')
    await page.locator('[data-test="add-items-product-checkbox"]').first().click()
    await page.click('[data-test="add-items-save-btn"]')
    await expect(page.locator('[data-test="add-order-items-modal"]')).toBeHidden()

    await page.fill('[data-test="field-gross-total"]', '21000')
    await page.locator('[data-test="field-gross-total"]').press('Enter')
    await expect(page.locator('[data-test="gross-total-error"]')).toBeVisible()
    await expect(page.locator('[data-test="allocate-modal"]')).toBeHidden()
  })

  test('changing the VAT mode asks what to keep, and keeps the net by default', async ({
    page,
  }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="field-vat-mode"]')
    const netBefore = await page.locator('[data-test="field-net-total"]').inputValue()

    await page.locator('[data-test="field-vat-mode"]').click()
    await page.locator('.custom-select-option', { hasText: '0% — export' }).first().click()
    await expect(page.locator('[data-test="vat-mode-modal"]')).toBeVisible()
    await page.click('[data-test="vat-mode-keep-net"]')

    // Keeping the net means the line prices do not move; the tax comes off the top.
    await expect(page.locator('[data-test="field-net-total"]')).toHaveValue(netBefore)
    await expect(page.locator('[data-test="field-vat-amount"]')).toHaveValue('0.00')
    await expect(page.locator('[data-test="field-gross-total"]')).toHaveValue(netBefore)
    // The rate has nothing to act on at a zero rate.
    await expect(page.locator('[data-test="field-vat-percent"]')).toBeDisabled()
  })

  test('keeping the total across a VAT mode change re-targets the net', async ({ page }) => {
    await page.goto('/admin/orders/ORD-003')
    await page.waitForSelector('[data-test="field-vat-mode"]')
    const grossBefore = await page.locator('[data-test="field-gross-total"]').inputValue()

    await page.locator('[data-test="field-vat-mode"]').click()
    await page.locator('.custom-select-option', { hasText: '0% — export' }).first().click()
    await expect(page.locator('[data-test="vat-mode-modal"]')).toBeVisible()
    await page.click('[data-test="vat-mode-keep-gross"]')

    // The spreading runs server-side, so the new mode has to be saved before it —
    // otherwise the amount would be split at the old rate.
    await expect(page.locator('[data-test="allocate-modal"]')).toBeVisible()
    await page.click('[data-test="allocate-confirm"]')
    await expect(page.locator('[data-test="allocate-modal"]')).toBeHidden()

    await expect(page.locator('[data-test="field-gross-total"]')).toHaveValue(grossBefore)
    await expect(page.locator('[data-test="field-net-total"]')).toHaveValue(grossBefore)
    await expect(page.locator('[data-test="field-vat-amount"]')).toHaveValue('0.00')
  })

  test('the services table shows per-line money, not per-unit times quantity', async ({ page }) => {
    let checked = 0
    for (const id of ['ORD-001', 'ORD-002', 'ORD-003', 'ORD-005', 'ORD-006', 'ORD-009']) {
      await page.goto(`/admin/orders/${id}`)
      await page.waitForSelector('[data-test="order-services"]')
      const rows = page.locator('[data-test="order-service-row"]')
      const count = await rows.count()
      for (let i = 0; i < count; i++) {
        const row = rows.nth(i)
        const qty = Number(await lineCell(row, 'quantity'))
        const unitCost = Number(await lineCell(row, 'unitCost'))
        const lineTotal = Number(await lineCell(row, 'lineTotal'))
        const margin = Number(await row.locator('[data-test="line-margin"]').textContent())
        expect(qty).toBeGreaterThan(0)
        expect(unitCost * qty + margin).toBeCloseTo(lineTotal, 1)
        checked++
      }
    }
    // A loop over orders that happen to carry no services proves nothing — this
    // test exists to catch a margin counted per unit and shown per line.
    expect(checked).toBeGreaterThan(0)
  })

  test('an unsaved note survives an allocation', async ({ page }) => {
    // Applying an allocation reloads the card, and the reload replaces the whole
    // form — anything still unsaved has to be flushed first, not dropped.
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="field-gross-total"]')

    await page.fill('[data-test="field-notes"]', 'typed but not saved')
    await page.fill('[data-test="field-gross-total"]', '20328.99')
    await page.locator('[data-test="field-gross-total"]').press('Enter')
    await page.click('[data-test="allocate-confirm"]')
    await expect(page.locator('[data-test="allocate-modal"]')).toBeHidden()

    await expect(page.locator('[data-test="field-notes"]')).toHaveValue('typed but not saved')
  })

  test('applying the percentages to every line says what it will do first', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="apply-defaults-btn"]')
    const grossBefore = await page.locator('[data-test="field-gross-total"]').inputValue()

    await page.fill('[data-test="field-default-discount"]', '10')
    await page.click('[data-test="apply-defaults-btn"]')
    await expect(page.locator('[data-test="apply-defaults-modal"]')).toBeVisible()
    // This rewrites hand-agreed prices, so the resulting total is shown up front.
    const promised = (
      (await page.locator('[data-test="apply-defaults-totals"]').textContent()) ?? ''
    )
      .split('→')[1]!
      .trim()

    await page.click('[data-test="apply-defaults-cancel"]')
    await expect(page.locator('[data-test="field-gross-total"]')).toHaveValue(grossBefore)

    await page.click('[data-test="apply-defaults-btn"]')
    await page.click('[data-test="apply-defaults-confirm"]')
    await expect(page.locator('[data-test="apply-defaults-modal"]')).toBeHidden()
    await expect(page.locator('[data-test="field-gross-total"]')).toHaveValue(promised)
  })

  test('the percentages reach a line that has not been saved yet', async ({ page }) => {
    // Reported from the card: add a product, apply the percentages, and the
    // answer was "save the lines first" — from a place with no Save in sight.
    // Applying them is a line edit like any other, so it reaches the new line
    // too, writes nothing on its own, and goes out with the same Save.
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="order-item-row"]')
    const rows = page.locator('[data-test="order-item-row"]')
    // Считать до отрисовки — получить ноль и утверждать его производное:
    // `toHaveCount(before - 1)` превращается в `toHaveCount(-1)`.
    await expect(rows.first()).toBeVisible()
    const before = await rows.count()

    await page.click('[data-test="order-add-item-btn"]')
    await page.locator('[data-test="add-items-product-checkbox"]').first().click()
    await page.click('[data-test="add-items-save-btn"]')
    await expect(rows).toHaveCount(before + 1)

    await page.fill('[data-test="field-default-margin"]', '20')
    await page.fill('[data-test="field-default-discount"]', '5')
    await page.click('[data-test="apply-defaults-btn"]')
    await expect(page.locator('[data-test="apply-defaults-modal"]')).toBeVisible()
    await page.click('[data-test="apply-defaults-confirm"]')
    await expect(page.locator('[data-test="apply-defaults-modal"]')).toBeHidden()

    // The line only exists on screen, and it took the percentages all the same.
    const added = rows.last()
    expect(Number(await lineCell(added, 'marginPercent'))).toBeCloseTo(20, 2)
    expect(Number(await lineCell(added, 'discountPercent'))).toBeCloseTo(5, 2)

    await page.click('[data-test="order-card-save-btn"]')
    await expect(page.locator('[data-test="order-card-save-btn"]')).toBeDisabled()

    // One new line, not two, and both percentages came back off the server.
    await expect(rows).toHaveCount(before + 1)
    expect(Number(await lineCell(rows.last(), 'marginPercent'))).toBeCloseTo(20, 2)
    expect(Number(await lineCell(rows.last(), 'discountPercent'))).toBeCloseTo(5, 2)
  })

  test('saving stores the fields the admin owns', async ({ page }) => {
    await page.goto('/admin/orders/ORD-005')
    await page.waitForSelector('[data-test="field-default-margin"]')

    await page.fill('[data-test="field-default-margin"]', '33')
    await page.fill('[data-test="field-total-weight"]', '1250')
    await page.fill('[data-test="field-notes"]', 'saved fields check')
    await expect(page.locator('[data-test="order-card-save-btn"]')).toBeEnabled()
    await page.click('[data-test="order-card-save-btn"]')

    // save() finishes by re-reading the order, so these values come from the
    // server. Note: a page reload would prove nothing — the mock store lives in
    // module memory and a reload regenerates it.
    await expect(page.locator('[data-test="field-default-margin"]')).toHaveValue('33')
    await expect(page.locator('[data-test="field-total-weight"]')).toHaveValue('1250')
    await expect(page.locator('[data-test="field-notes"]')).toHaveValue('saved fields check')
    // Nothing left to save means the form matches what came back.
    await expect(page.locator('[data-test="order-card-save-btn"]')).toBeDisabled()
  })

  test('cancelling the VAT dialog leaves the order untouched', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="field-vat-mode"]')

    await page.locator('[data-test="field-vat-mode"]').click()
    await page.locator('.custom-select-option', { hasText: '0% — export' }).first().click()
    await expect(page.locator('[data-test="vat-mode-modal"]')).toBeVisible()
    const vatBefore = await page.locator('[data-test="field-vat-amount"]').inputValue()
    await page.click('[data-test="vat-mode-cancel"]')

    expect(Number(vatBefore)).toBeGreaterThan(0)
    await expect(page.locator('[data-test="field-vat-amount"]')).toHaveValue(vatBefore)
    await expect(page.locator('[data-test="order-card-save-btn"]')).toBeDisabled()
  })

  test('status dropdown renders', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-card-status"]')).toBeVisible()
  })

  test('items and services sections render', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-items"]')).toBeVisible()
    await expect(page.locator('[data-test="order-services"]')).toBeVisible()
  })

  test('files section with dropzone is visible', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-files"]')).toBeVisible()
    await expect(page.locator('[data-test="order-file-dropzone"]')).toBeVisible()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Order Card — the editable line table
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Order Card › line table', () => {
  /**
   * ORD-009 holds one line of each state. WHICH row is which depends on what the
   * warehouse could back when the demo was seeded, so they are found by the state
   * they report rather than by position — the rule under test is that a state
   * opens exactly its own cells, not that it sits in a particular row.
   */
  async function rowsByState(page: Page) {
    const states = await page
      .locator('[data-test="order-item-row"] [data-test="line-state"]')
      .allTextContents()
    const rows = page.locator('[data-test="order-item-row"]')
    const find = (test: (state: string) => boolean) => {
      const index = states.findIndex(test)
      expect(index, `no line in states ${JSON.stringify(states)}`).toBeGreaterThanOrEqual(0)
      return rows.nth(index)
    }
    return {
      states,
      shipped: find((s) => s === 'Shipped'),
      partial: find((s) => /^Shipped [\d.]+ of [\d.]+$/.test(s)),
      draft: find((s) => s === 'Draft'),
    }
  }

  test('opens exactly the cells the line state allows', async ({ page }) => {
    await page.goto('/admin/orders/ORD-009')
    await page.waitForSelector('[data-test="order-item-row"]')
    const { shipped, partial, draft } = await rowsByState(page)

    // Fully shipped — nothing to edit, and nothing to split either.
    await expect(shipped.locator('[data-test="cell-input"]')).toHaveCount(0)
    await expect(shipped.locator('[data-test="line-split-btn"]')).toHaveCount(0)
    // Nor to delete: the waybill and the stock movements still name it.
    await expect(shipped.locator('[data-test="line-remove-btn"]')).toHaveCount(0)
    // The one door through the freeze.
    await expect(shipped.locator('[data-test="line-correct-btn"]')).toBeVisible()

    // Partially shipped — the quantity can still grow for the next truck, but the
    // money is frozen by the waybill the client already holds.
    await expect(partial.locator('[data-test="cell-input"]')).toHaveCount(1)
    await expect(partial.locator('[data-test="cell-quantity"] input')).toBeVisible()
    await expect(partial.locator('[data-test="line-split-btn"]')).toBeVisible()

    // Draft — all six, removable, and nothing to correct.
    await expect(draft.locator('[data-test="cell-input"]')).toHaveCount(6)
    await expect(draft.locator('[data-test="line-remove-btn"]')).toBeVisible()
    await expect(draft.locator('[data-test="line-correct-btn"]')).toHaveCount(0)
  })

  test('the state of every line is spelled out, shipped quantity and all', async ({ page }) => {
    await page.goto('/admin/orders/ORD-009')
    await page.waitForSelector('[data-test="line-state"]')
    const { states } = await rowsByState(page)
    expect(states).toContain('Shipped')
    expect(states).toContain('Draft')
    expect(states.some((s) => /^Shipped [\d.]+ of [\d.]+$/.test(s))).toBe(true)
  })

  test('a margin edit reprices the line and the order, and Save keeps it', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="order-item-row"]')
    const row = page.locator('[data-test="order-item-row"]').first()
    const grossBefore = Number(await page.locator('[data-test="field-gross-total"]').inputValue())

    const margin = row.locator('[data-test="cell-marginPercent"] input')
    await margin.fill('50')
    await margin.press('Enter')

    // Cost is a warehouse fact and does not move; the price does.
    const cost = Number(await lineCell(row, 'unitCost'))
    await expect
      .poll(async () => Number(await lineCell(row, 'unitPrice')))
      .toBeCloseTo(cost * 1.5, 1)
    const grossEdited = Number(await page.locator('[data-test="field-gross-total"]').inputValue())
    expect(grossEdited).not.toBeCloseTo(grossBefore, 2)

    await page.click('[data-test="order-card-save-btn"]')
    await expect(page.locator('[data-test="order-card-save-btn"]')).toBeDisabled()
    // These numbers now come back from the server, not from the local copy.
    expect(Number(await page.locator('[data-test="field-gross-total"]').inputValue())).toBeCloseTo(
      grossEdited,
      2,
    )
    expect(Number(await lineCell(row, 'marginPercent'))).toBeCloseTo(50, 2)
  })

  test('a price cut becomes a discount and locks the line; reset undoes both', async ({ page }) => {
    await page.goto('/admin/orders/ORD-002')
    await page.waitForSelector('[data-test="order-item-row"]')
    const row = page.locator('[data-test="order-item-row"]').first()
    const priceBefore = Number(await lineCell(row, 'unitPrice'))
    const discountBefore = Number(await lineCell(row, 'discountPercent'))

    const price = row.locator('[data-test="cell-unitPrice"] input')
    await price.fill((priceBefore * 0.9).toFixed(2))
    await price.press('Enter')

    // The client sees a discount in the document, never a negative markup.
    await expect(row.locator('[data-test="line-lock"]')).toBeVisible()
    await expect
      .poll(async () => Number(await lineCell(row, 'discountPercent')))
      .toBeGreaterThan(discountBefore)

    await row.locator('[data-test="line-reset-price"]').click()
    await expect(row.locator('[data-test="line-lock"]')).toHaveCount(0)
    await expect
      .poll(async () => Number(await lineCell(row, 'unitPrice')))
      .toBeCloseTo(priceBefore, 1)
  })

  test('a refused edit puts the cell back and says why', async ({ page }) => {
    // ORD-004 has a partially shipped first line.
    await page.goto('/admin/orders/ORD-004')
    await page.waitForSelector('[data-test="order-item-row"]')
    const row = page.locator('[data-test="order-item-row"]').first()
    const quantity = row.locator('[data-test="cell-quantity"] input')
    const before = await quantity.inputValue()

    await quantity.fill('1')
    await quantity.press('Enter')

    await expect(quantity).toHaveValue(before)
    await expect(page.locator('.toast, [data-test="toast"]').first()).toContainText(
      /below what has shipped/i,
    )
    // Nothing was recorded, so there is nothing to save.
    await expect(page.locator('[data-test="order-card-save-btn"]')).toBeDisabled()
  })

  test('a cost typed by hand demands a reason before it lands', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="order-item-row"]')
    const row = page.locator('[data-test="order-item-row"]').first()
    const cost = row.locator('[data-test="cell-unitCost"] input')
    const before = await cost.inputValue()

    await cost.fill((Number(before) + 20).toFixed(2))
    await cost.press('Enter')

    // Until the reason is there the cell still shows the old cost — the edit has
    // not happened yet.
    await expect(page.locator('[data-test="cost-reason-modal"]')).toBeVisible()
    await expect(page.locator('[data-test="cost-reason-confirm"]')).toBeDisabled()
    await expect(cost).toHaveValue(before)

    await page.fill('[data-test="cost-reason-input"]', 'Supplier invoice, batch not booked in')
    await page.click('[data-test="cost-reason-confirm"]')

    await expect(cost).toHaveValue((Number(before) + 20).toFixed(2))
    await expect(row.locator('[data-test="line-manual-cost"]')).toBeVisible()

    await page.click('[data-test="order-card-save-btn"]')
    await expect(page.locator('[data-test="order-card-save-btn"]')).toBeDisabled()
    // Straight from the server, marker and all.
    await expect(row.locator('[data-test="line-manual-cost"]')).toBeVisible()
  })

  test('cancelling the reason dialog leaves the cost alone', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="order-item-row"]')
    const row = page.locator('[data-test="order-item-row"]').first()
    const cost = row.locator('[data-test="cell-unitCost"] input')
    const before = await cost.inputValue()

    await cost.fill('999')
    await cost.press('Enter')
    await page.click('[data-test="cost-reason-cancel"]')

    await expect(cost).toHaveValue(before)
    await expect(page.locator('[data-test="order-card-save-btn"]')).toBeDisabled()
  })

  test('splitting a partially shipped line keeps every euro', async ({ page }) => {
    await page.goto('/admin/orders/ORD-004')
    await page.waitForSelector('[data-test="order-item-row"]')
    const grossBefore = await page.locator('[data-test="field-gross-total"]').inputValue()
    const rowsBefore = await page.locator('[data-test="order-item-row"]').count()

    await page.locator('[data-test="line-split-btn"]').first().click()
    await expect(page.locator('[data-test="split-modal"]')).toBeVisible()
    await page.click('[data-test="split-confirm"]')
    await expect(page.locator('[data-test="split-modal"]')).toBeHidden()

    await expect(page.locator('[data-test="order-item-row"]')).toHaveCount(rowsBefore + 1)
    // Same goods, same money — only the line boundary moved.
    await expect(page.locator('[data-test="field-gross-total"]')).toHaveValue(grossBefore)

    const states = await page
      .locator('[data-test="order-item-row"] [data-test="line-state"]')
      .allTextContents()
    expect(states[0]).toBe('Shipped')
    expect(states[1]).toBe('Draft')
    // The freed remainder can be repriced — that is the point of splitting.
    await expect(
      page.locator('[data-test="order-item-row"]').nth(1).locator('[data-test="cell-input"]'),
    ).toHaveCount(6)
  })

  test('edits to several lines go out with one Save', async ({ page }) => {
    await page.goto('/admin/orders/ORD-007')
    await page.waitForSelector('[data-test="order-item-row"]')
    const rows = page.locator('[data-test="order-item-row"]')

    const discount = rows.nth(1).locator('[data-test="cell-discountPercent"] input')
    await discount.fill('12')
    await discount.press('Enter')
    const quantity = rows.nth(2).locator('[data-test="cell-quantity"] input')
    await quantity.fill('7')
    await quantity.press('Enter')

    await page.click('[data-test="order-card-save-btn"]')
    await expect(page.locator('[data-test="order-card-save-btn"]')).toBeDisabled()

    expect(Number(await lineCell(rows.nth(1), 'discountPercent'))).toBeCloseTo(12, 2)
    expect(Number(await lineCell(rows.nth(2), 'quantity'))).toBe(7)
  })

  test('a line added and edited before Save arrives with the edit on it', async ({ page }) => {
    // The row carries a temporary id until it exists on the server, so the edit
    // has to be re-pointed at the id the server hands back — otherwise it lands
    // on nothing and the admin loses it without being told.
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="order-item-row"]')
    const rows = page.locator('[data-test="order-item-row"]')
    // Считать до отрисовки — получить ноль и утверждать его производное:
    // `toHaveCount(before - 1)` превращается в `toHaveCount(-1)`.
    await expect(rows.first()).toBeVisible()
    const before = await rows.count()

    await page.click('[data-test="order-add-item-btn"]')
    await page.locator('[data-test="add-items-product-checkbox"]').first().click()
    await page.click('[data-test="add-items-save-btn"]')
    await expect(rows).toHaveCount(before + 1)

    const added = rows.last()
    const quantity = added.locator('[data-test="cell-quantity"] input')
    await quantity.fill('9')
    await quantity.press('Enter')
    const discount = added.locator('[data-test="cell-discountPercent"] input')
    await discount.fill('4')
    await discount.press('Enter')

    await page.click('[data-test="order-card-save-btn"]')
    await expect(page.locator('[data-test="order-card-save-btn"]')).toBeDisabled()

    // One new line, not two, and it carries both edits — straight from the server.
    await expect(rows).toHaveCount(before + 1)
    expect(Number(await lineCell(rows.last(), 'quantity'))).toBe(9)
    expect(Number(await lineCell(rows.last(), 'discountPercent'))).toBeCloseTo(4, 2)
  })

  test('a line added and then removed before Save never reaches the server', async ({ page }) => {
    // It was never created, so there is nothing to delete: recording a deletion
    // instead would create it on Save and then delete an id nobody issued,
    // leaving the line behind.
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="order-item-row"]')
    const rows = page.locator('[data-test="order-item-row"]')
    // Считать до отрисовки — получить ноль и утверждать его производное:
    // `toHaveCount(before - 1)` превращается в `toHaveCount(-1)`.
    await expect(rows.first()).toBeVisible()
    const before = await rows.count()

    await page.click('[data-test="order-add-item-btn"]')
    await page.locator('[data-test="add-items-product-checkbox"]').first().click()
    await page.click('[data-test="add-items-save-btn"]')
    await expect(rows).toHaveCount(before + 1)

    await rows.last().locator('.action-danger').click()
    await expect(rows).toHaveCount(before)
    // Nothing pending and nothing dirty — the two cancel out exactly.
    await expect(page.locator('[data-test="order-card-save-btn"]')).toBeDisabled()
    await expect(rows).toHaveCount(before)
  })

  test('editing the line total is the same edit seen from the other side', async ({ page }) => {
    await page.goto('/admin/orders/ORD-002')
    await page.waitForSelector('[data-test="order-item-row"]')
    const row = page.locator('[data-test="order-item-row"]').first()
    const quantity = Number(await lineCell(row, 'quantity'))

    const total = row.locator('[data-test="cell-lineTotal"] input')
    await total.fill('1000')
    await total.press('Enter')

    // The price per unit follows, and the line total is cent-exact — a total the
    // admin typed may not come back a cent short.
    await expect
      .poll(async () => Number(await lineCell(row, 'unitPrice')))
      .toBeCloseTo(1000 / quantity, 2)
    expect(Number(await lineCell(row, 'lineTotal'))).toBeCloseTo(1000, 2)

    await page.click('[data-test="order-card-save-btn"]')
    await expect(page.locator('[data-test="order-card-save-btn"]')).toBeDisabled()
    expect(Number(await lineCell(row, 'lineTotal'))).toBeCloseTo(1000, 2)
  })

  test('the owner sees cost and margin, and may type a cost by hand', async ({ page }) => {
    // The demo user is the owner, who has all three rights of model section 12.
    // What this guards is the opposite mistake: gating the columns behind a right
    // and then hiding them from the people who have it. The refusals themselves
    // are unit-tested — the app has no way to sign in as another role.
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="order-item-row"]')
    await expect(page.locator('[data-test="cell-unitCost"]').first()).toBeVisible()
    await expect(page.locator('[data-test="cell-marginPercent"]').first()).toBeVisible()
    await expect(page.locator('[data-test="line-margin"]').first()).toBeVisible()
    await expect(page.locator('[data-test="field-total-cost"]')).toBeVisible()
    await expect(page.locator('[data-test="field-total-margin"]')).toBeVisible()
    await expect(
      page
        .locator('[data-test="order-item-row"]')
        .first()
        .locator('[data-test="cell-unitCost"] input'),
    ).toHaveCount(1)
  })

  test('cost, margin and the line state are there for everyone, unflagged', async ({ page }) => {
    // These used to sit behind `orderPricingV2` together with the editing. The
    // corrected calculation is not a feature anybody opts into, so the flag is
    // gone — what is left to assert is that the columns are simply present.
    await page.goto('/admin/orders/ORD-009')
    await page.waitForSelector('[data-test="order-item-row"]')
    await expect(page.locator('[data-test="cell-unitCost"]').first()).toBeVisible()
    await expect(page.locator('[data-test="line-margin"]').first()).toBeVisible()
    await expect(page.locator('[data-test="line-state"]').first()).toBeVisible()
    await expect(page.locator('[data-test="field-vat-mode"]')).toBeVisible()
    await expect(page.locator('[data-test="apply-defaults-btn"]')).toBeVisible()
    // The gross total is the one editable money field on the card.
    await expect(page.locator('[data-test="field-gross-total"]')).toBeEditable()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Order Card — how a new line gets priced
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Order Card › adding lines', () => {
  /** Opens the picker and selects the first product. */
  async function pickFirstProduct(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
    await page.click('[data-test="order-add-item-btn"]')
    await page.waitForSelector('[data-test="add-items-product-checkbox"]')
    await page.locator('[data-test="add-items-product-checkbox"]').first().click()
    // The FIFO cost arrives asynchronously and the price waits for it.
    await expect(page.locator('[data-test="add-items-price"]').first()).toBeVisible()
  }

  test('asks nothing when nobody has repriced the order by hand', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="order-item-row"]')
    await pickFirstProduct(page)
    await expect(page.locator('[data-test="add-mode-chooser"]')).toHaveCount(0)
  })

  test('sells at the catalogue price, never at cost', async ({ page }) => {
    // The picker used to overwrite the price with the FIFO cost, so every line
    // added to an order was sold at cost with no margin at all.
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="order-item-row"]')
    const rows = page.locator('[data-test="order-item-row"]')
    // Считать до отрисовки — получить ноль и утверждать его производное:
    // `toHaveCount(before - 1)` превращается в `toHaveCount(-1)`.
    await expect(rows.first()).toBeVisible()
    const before = await rows.count()

    await pickFirstProduct(page)
    await page.click('[data-test="add-items-save-btn"]')
    await expect(rows).toHaveCount(before + 1)

    const added = rows.last()
    expect(Number(await lineCell(added, 'marginPercent'))).toBeGreaterThan(0)
    expect(Number(await lineCell(added, 'unitPrice'))).toBeGreaterThan(
      Number(await lineCell(added, 'unitCost')),
    )
  })

  test('a line added to a discounted order gets that discount', async ({ page }) => {
    // ORD-003 carries a hand-cut price, so the order gives a real discount that
    // its default percentage says nothing about.
    await page.goto('/admin/orders/ORD-003')
    await page.waitForSelector('[data-test="order-item-row"]')
    const effective = await page.locator('[data-test="field-effective-discount"]').inputValue()
    expect(Number(effective)).toBeGreaterThan(0)
    expect(await page.locator('[data-test="field-default-discount"]').inputValue()).toBe('0')

    const rows = page.locator('[data-test="order-item-row"]')
    const before = await rows.count()
    await pickFirstProduct(page)

    // Three options, and the order's own terms are the one offered first.
    await expect(page.locator('[data-test="add-mode-chooser"]')).toBeVisible()
    await expect(page.locator('[data-test="add-mode-order_terms"]')).toHaveClass(/active/)
    const withTerms = await page.locator('[data-test="add-items-price"]').first().textContent()
    await page.locator('[data-test="add-mode-computed_price"]').click()
    const plain = await page.locator('[data-test="add-items-price"]').first().textContent()
    expect(parseFloat(withTerms!)).toBeLessThan(parseFloat(plain!))

    await page.locator('[data-test="add-mode-order_terms"]').click()
    await page.click('[data-test="add-items-save-btn"]')
    await expect(rows).toHaveCount(before + 1)
    expect(Number(await lineCell(rows.last(), 'discountPercent'))).toBeCloseTo(Number(effective), 2)

    // And it survives the round trip — the server must not fall back to the
    // order default, which is zero here.
    await page.click('[data-test="order-card-save-btn"]')
    await expect(page.locator('[data-test="order-card-save-btn"]')).toBeDisabled()
    expect(Number(await lineCell(rows.last(), 'discountPercent'))).toBeCloseTo(Number(effective), 2)
  })

  test('"keep the total" shows what it will do, and can be called off', async ({ page }) => {
    await page.goto('/admin/orders/ORD-003')
    await page.waitForSelector('[data-test="order-item-row"]')
    const rows = page.locator('[data-test="order-item-row"]')
    const before = await rows.count()
    // Services are lines too, and "keep the total" spreads across every line that
    // can still be repriced — so the preview lists them as well.
    const repriceable = before + (await page.locator('[data-test="order-service-row"]').count())
    const total = await page.locator('[data-test="field-gross-total"]').inputValue()

    await pickFirstProduct(page)
    await page.locator('[data-test="add-mode-keep_total"]').click()
    await page.click('[data-test="add-items-save-btn"]')

    // Nothing has happened yet — this reprices lines that were agreed one by one.
    await expect(page.locator('[data-test="keep-total-modal"]')).toBeVisible()
    await expect(page.locator('[data-test="keep-total-row"]')).toHaveCount(repriceable + 1)
    await page.click('[data-test="keep-total-cancel"]')
    await expect(rows).toHaveCount(before)
    await expect(page.locator('[data-test="field-gross-total"]')).toHaveValue(total)
    await expect(page.locator('[data-test="order-card-save-btn"]')).toBeDisabled()

    await pickFirstProduct(page)
    await page.locator('[data-test="add-mode-keep_total"]').click()
    await page.click('[data-test="add-items-save-btn"]')
    await page.click('[data-test="keep-total-confirm"]')

    // A line more, and the client still pays exactly what they did before.
    await expect(rows).toHaveCount(before + 1)
    await expect(page.locator('[data-test="field-gross-total"]')).toHaveValue(total)

    await page.click('[data-test="order-card-save-btn"]')
    await expect(page.locator('[data-test="order-card-save-btn"]')).toBeDisabled()
    await expect(page.locator('[data-test="field-gross-total"]')).toHaveValue(total)
  })

  test('the price and the sum in a row agree to the cent', async ({ page }) => {
    // 25.00 less a 9.70% discount is 22.575 — and 22.575 is 22.57499… in binary,
    // so `toFixed` alone put 22.57 in the price cell next to a total of 22.58
    // for a single unit. Two cells of the same row disagreeing about the money.
    await page.goto('/admin/orders/ORD-003')
    await page.waitForSelector('[data-test="order-item-row"]')
    await page.click('[data-test="order-add-service-btn"]')
    await page.waitForSelector('[data-test="add-services-checkbox"]')
    await page.locator('[data-test="add-services-checkbox"]').first().click()
    await page.click('[data-test="add-services-save-btn"]')

    const rows = page.locator('[data-test="order-service-row"]')
    await expect(rows.last()).toBeVisible()
    for (const row of [rows.last(), page.locator('[data-test="order-item-row"]').first()]) {
      const quantity = Number(await lineCell(row, 'quantity'))
      const price = Number(await lineCell(row, 'unitPrice'))
      const total = Number(await lineCell(row, 'lineTotal'))
      expect(Math.abs(price * quantity - total)).toBeLessThan(0.005 * quantity + 0.005)
    }
  })

  test('the picker promises the number the row then shows', async ({ page }) => {
    // Rounding the unit price and multiplying by the quantity is not the same as
    // rounding once: at 22.575 × 2 the dialog said 45.16 and the row said 45.15.
    // A picker that promises a different total is worse than one showing nothing.
    await page.goto('/admin/orders/ORD-003')
    await page.waitForSelector('[data-test="order-item-row"]')
    await page.click('[data-test="order-add-service-btn"]')
    await page.waitForSelector('[data-test="add-services-checkbox"]')
    await page.locator('[data-test="add-services-checkbox"]').first().click()
    await page.fill('[data-test="add-services-selected-qty"]', '2')

    const promisedPrice = (await page.locator('[data-test="add-services-price"]').textContent())!
    const promisedTotal = (await page.locator('[data-test="add-services-total"]').textContent())!
    await page.click('[data-test="add-services-save-btn"]')

    const row = page.locator('[data-test="order-service-row"]').last()
    await expect(row).toBeVisible()
    expect(await lineCell(row, 'unitPrice')).toBe(parseFloat(promisedPrice).toFixed(2))
    expect(await lineCell(row, 'lineTotal')).toBe(parseFloat(promisedTotal).toFixed(2))
  })

  test('a shipped order takes new lines without moving the old ones', async ({ page }) => {
    // "The truck has left and the client wants two more things" — one deal, one
    // order. The shipped line is frozen; the new one is a plain draft.
    await page.goto('/admin/orders/ORD-004')
    await page.waitForSelector('[data-test="order-item-row"]')
    const rows = page.locator('[data-test="order-item-row"]')
    // Считать до отрисовки — получить ноль и утверждать его производное:
    // `toHaveCount(before - 1)` превращается в `toHaveCount(-1)`.
    await expect(rows.first()).toBeVisible()
    const before = await rows.count()
    const frozenRow = rows.first()
    const frozenBefore = [
      await lineCell(frozenRow, 'unitPrice'),
      await lineCell(frozenRow, 'lineTotal'),
      await lineCell(frozenRow, 'discountPercent'),
    ]

    await pickFirstProduct(page)
    await page.click('[data-test="add-items-save-btn"]')
    await expect(rows).toHaveCount(before + 1)
    await page.click('[data-test="order-card-save-btn"]')
    await expect(page.locator('[data-test="order-card-save-btn"]')).toBeDisabled()

    expect([
      await lineCell(frozenRow, 'unitPrice'),
      await lineCell(frozenRow, 'lineTotal'),
      await lineCell(frozenRow, 'discountPercent'),
    ]).toEqual(frozenBefore)
    await expect(rows.first().locator('[data-test="line-state"]')).toContainText(/Shipped/)
    // The new line is free to be priced — that is the point of not touching it.
    await expect(rows.last().locator('[data-test="cell-input"]')).toHaveCount(6)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Order Card — shipments: the only thing that moves the warehouse
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Order Card › shipments', () => {
  /**
   * Puts a line on the order that the warehouse can actually back.
   *
   * Deliberately not relying on a seeded order having stock: the demo warehouse
   * holds small quantities, and the seeded shipments consume them at start-up —
   * a test that assumed a particular shelf was full would pass or fail on who
   * else took the goods first.
   */
  async function addShippableLine(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
    await page.click('[data-test="order-add-item-btn"]')
    await page.waitForSelector('[data-test="add-items-product-row"]')
    // The picker shows what is on the shelf, so the product is chosen by that
    // rather than by position: which products still have stock depends on what
    // the seeded shipments took at start-up.
    // Searched for by name rather than taken by position: which products have
    // batches behind them is a fact about the warehouse, and the "available"
    // figure in the picker comes from a separately seeded stock row that can show
    // stock for a product with no batches at all.
    await page.fill('[data-test="add-items-filters"] input', 'Steel Sheet 3mm')
    const rows = page.locator('[data-test="add-items-product-row"]')
    await expect(rows.first()).toBeVisible()
    await rows.first().locator('[data-test="add-items-product-checkbox"]').click()
    await expect(page.locator('[data-test="add-items-price"]').first()).toBeVisible()
    await page.click('[data-test="add-items-save-btn"]')
    await page.click('[data-test="order-card-save-btn"]')
    await expect(page.locator('[data-test="order-card-save-btn"]')).toBeDisabled()
  }

  test('the panel is there, with nothing in it until something ships', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-shipments"]')).toBeVisible()
    await expect(page.locator('[data-test="order-shipment-row"]')).toHaveCount(0)
  })

  test('offers what the shelf can back, not what the client is owed', async ({ page }) => {
    // ORD-001 asks for far more of its product than the warehouse holds, so the
    // two numbers differ — and the dialog must offer the honest one.
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="order-item-row"]')
    await page.click('[data-test="order-ship-btn"]')
    await expect(page.locator('[data-test="ship-modal"]')).toBeVisible()

    const row = page.locator('[data-test="ship-line-row"]').first()
    const remaining = Number((await row.locator('td').nth(1).textContent())!.split(' ')[0])
    const available = Number(
      (await row.locator('[data-test="ship-line-available"]').textContent())!.split(' ')[0],
    )
    const prefilled = Number(await row.locator('[data-test="ship-line-qty"]').inputValue())
    expect(available).toBeLessThanOrEqual(remaining)
    expect(prefilled).toBe(available)
  })

  test('a shipment freezes the line, carries a waybill, and can be undone', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="order-item-row"]')
    await addShippableLine(page)

    const rows = page.locator('[data-test="order-item-row"]')
    const added = rows.last()
    await expect(added.locator('[data-test="line-state"]')).toHaveText('Draft')

    await page.click('[data-test="order-ship-btn"]')
    await expect(page.locator('[data-test="ship-modal"]')).toBeVisible()
    // The dialog offers every line that still owes goods; only the one just added
    // has any on the shelf, and it is pre-filled with exactly that.
    const shipRows = page.locator('[data-test="ship-line-row"]')
    await expect(shipRows.last().locator('[data-test="ship-line-qty"]')).not.toHaveValue('0')
    await page.fill('[data-test="ship-vehicle"]', 'ABC-123')
    await page.click('[data-test="ship-confirm"]')
    await expect(page.locator('[data-test="ship-modal"]')).toBeHidden()

    // Part of the order has left with a document, so the line says so — and its
    // money is frozen from here on.
    await expect(added.locator('[data-test="line-state"]')).toContainText(/Shipped/)
    const shipment = page.locator('[data-test="order-shipment-row"]').first()
    await expect(shipment).toContainText('ABC-123')
    await expect(shipment).toContainText(/WB-/)
    await expect(added.locator('[data-test="cell-unitPrice"] input')).toHaveCount(0)

    // Cancelling gives the goods back and keeps the shipment on record: the
    // warehouse ledger is only ever added to.
    await page.click('[data-test="shipment-cancel-btn"]')
    await expect(page.locator('[data-test="cancel-shipment-modal"]')).toBeVisible()
    await page.click('[data-test="cancel-shipment-yes"]')
    await expect(page.locator('[data-test="cancel-shipment-modal"]')).toBeHidden()

    await expect(page.locator('[data-test="order-shipment-row"]')).toHaveCount(1)
    await expect(page.locator('[data-test="order-shipment-row"]').first()).toContainText(
      /Cancelled/,
    )
    await expect(added.locator('[data-test="line-state"]')).toHaveText('Draft')
  })

  test('a partially shipped order still takes new lines', async ({ page }) => {
    // "The truck has left and the client wants two more things" — with the goods
    // actually written off the shelf this time.
    await page.goto('/admin/orders/ORD-004')
    await page.waitForSelector('[data-test="order-item-row"]')
    const rows = page.locator('[data-test="order-item-row"]')
    await expect(rows.first().locator('[data-test="line-state"]')).toContainText(/Shipped/)
    // Считать до отрисовки — получить ноль и утверждать его производное:
    // `toHaveCount(before - 1)` превращается в `toHaveCount(-1)`.
    await expect(rows.first()).toBeVisible()
    const before = await rows.count()

    await addShippableLine(page)
    await expect(rows).toHaveCount(before + 1)

    // The frozen line is untouched; the new one is a plain draft.
    await expect(rows.first().locator('[data-test="line-state"]')).toContainText(/Shipped/)
    await expect(rows.last().locator('[data-test="line-state"]')).toHaveText('Draft')
    await expect(rows.last().locator('[data-test="cell-input"]')).toHaveCount(6)
  })

  test('a seeded shipment really moved goods, and says which document', async ({ page }) => {
    // ORD-004 ships part of its first line at start-up. That shipment goes
    // through the same code an admin's does, so it carries a waybill and the
    // line is frozen by it.
    await page.goto('/admin/orders/ORD-004')
    await page.waitForSelector('[data-test="order-shipment-row"]')
    await expect(page.locator('[data-test="order-shipment-row"]')).toHaveCount(1)
    await expect(page.locator('[data-test="order-shipment-row"]').first()).toContainText(/WB-/)
    await expect(
      page
        .locator('[data-test="order-item-row"]')
        .first()
        .locator('[data-test="cell-unitPrice"] input'),
    ).toHaveCount(0)
  })

  test('with the flag off the panel is gone and nothing can ship', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="order-shipments"]')
    await setFlag(page, 'orderShipments', false)
    await page.waitForSelector('[data-test="order-items"]')
    await expect(page.locator('[data-test="order-shipments"]')).toHaveCount(0)
    await expect(page.locator('[data-test="order-ship-btn"]')).toHaveCount(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Order Card — returns
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Order Card › returns', () => {
  /**
   * Fills the return dialog for the first line it offers and confirms it.
   *
   * The quantity is read from the row rather than written into the test: how
   * much ORD-004's seeded shipment moved depends on what the demo warehouse
   * could back at start-up.
   */
  async function returnFirstLine(page: Page, reason: string): Promise<number> {
    await page.click('[data-test="order-return-btn"]')
    const modal = page.locator('[data-test="return-modal"]')
    await expect(modal).toBeVisible()

    const row = modal.locator('[data-test="return-line-row"]').first()
    const available = Number(
      (await row.locator('[data-test="return-line-available"]').textContent())!.split(' ')[0],
    )
    // Part of it, not all: the point of the feature is the partial case.
    const returning = Math.round((available / 2) * 100) / 100
    await row.locator('[data-test="return-line-qty"]').fill(String(returning))
    await modal.locator('[data-test="return-reason"]').fill(reason)
    await modal.locator('[data-test="return-confirm"]').click()
    await expect(modal).toBeHidden()
    return returning
  }

  test('the panel is there, and empty until something comes back', async ({ page }) => {
    await page.goto('/admin/orders/ORD-004')
    await expect(page.locator('[data-test="order-returns"]')).toBeVisible()
    await expect(page.locator('[data-test="order-return-row"]')).toHaveCount(0)
  })

  test('nothing shipped means nothing to return', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="order-item-row"]')
    await expect(page.locator('[data-test="order-return-btn"]')).toBeDisabled()
  })

  test('the dialog offers only what shipped, and closes on Escape', async ({ page }) => {
    await page.goto('/admin/orders/ORD-004')
    await page.waitForSelector('[data-test="order-shipment-row"]')
    await page.click('[data-test="order-return-btn"]')

    const modal = page.locator('[data-test="return-modal"]')
    await expect(modal).toBeVisible()
    const rows = modal.locator('[data-test="return-line-row"]')
    await expect(rows.first()).toBeVisible()

    // Nothing is pre-filled: what came back is a fact somebody has in front of
    // them, and a dialog that guesses "all of it" invites a phantom return.
    await expect(rows.first().locator('[data-test="return-line-qty"]')).toHaveValue('0')

    await page.keyboard.press('Escape')
    await expect(modal).toBeHidden()
  })

  test('a return needs a reason before it can be confirmed', async ({ page }) => {
    await page.goto('/admin/orders/ORD-004')
    await page.waitForSelector('[data-test="order-shipment-row"]')
    await page.click('[data-test="order-return-btn"]')

    const modal = page.locator('[data-test="return-modal"]')
    const row = modal.locator('[data-test="return-line-row"]').first()
    await row.locator('[data-test="return-line-qty"]').fill('1')
    // A quantity alone is not enough — the client validation is no weaker than
    // the server's, which refuses with RETURN_REASON_REQUIRED.
    await expect(modal.locator('[data-test="return-confirm"]')).toBeDisabled()

    await modal.locator('[data-test="return-reason"]').fill('Wrong profile delivered')
    await expect(modal.locator('[data-test="return-confirm"]')).toBeEnabled()
  })

  test('a partial return is recorded, badged, marked on the line and taken off the total', async ({
    page,
  }) => {
    await page.goto('/admin/orders/ORD-004')
    await page.waitForSelector('[data-test="order-shipment-row"]')

    const gross = Number(await page.locator('[data-test="field-gross-total"]').inputValue())
    const before = await page.locator('[data-test="order-return-row"]').count()

    const returned = await returnFirstLine(page, 'Wrong profile delivered')
    expect(returned).toBeGreaterThan(0)

    // The document exists…
    await expect(page.locator('[data-test="order-return-row"]')).toHaveCount(before + 1)
    await expect(page.locator('[data-test="order-return-row"]').first()).toContainText(
      'Wrong profile delivered',
    )

    // …the header says so beside the status, without replacing it…
    await expect(page.locator('[data-test="order-card-return-badge"]')).toBeVisible()
    await expect(page.locator('[data-test="order-card-status-pill"]')).toBeVisible()

    // …the line carries the quantity that came back…
    await expect(page.locator('[data-test="line-returned"]').first()).toBeVisible()

    // …and the money splits into what was ordered and what is still expected.
    const net = Number(
      (await page.locator('[data-test="field-net-amount"]').inputValue()).replace(/\s/g, ''),
    )
    expect(net).toBeLessThan(gross)
    // The order total itself does not move: the order WAS for that much.
    expect(Number(await page.locator('[data-test="field-gross-total"]').inputValue())).toBe(gross)
  })

  test('a second partial return of the same line still goes through', async ({ page }) => {
    await page.goto('/admin/orders/ORD-004')
    await page.waitForSelector('[data-test="order-shipment-row"]')

    await returnFirstLine(page, 'First piece back')
    await expect(page.locator('[data-test="order-return-row"]')).toHaveCount(1)

    // The old invoice rule — one document corrected once — refused here, so a
    // delivery could be returned in pieces exactly once.
    await returnFirstLine(page, 'Second piece back')
    await expect(page.locator('[data-test="order-return-row"]')).toHaveCount(2)
  })

  test('with the flag off the panel is gone and nothing can be returned', async ({ page }) => {
    await page.goto('/admin/orders/ORD-004')
    await page.waitForSelector('[data-test="order-returns"]')
    await setFlag(page, 'orderReturns', false)
    await page.waitForSelector('[data-test="order-items"]')
    await expect(page.locator('[data-test="order-returns"]')).toHaveCount(0)
    await expect(page.locator('[data-test="order-return-btn"]')).toHaveCount(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Order Card — payments and invoices
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Order Card › payments and invoices', () => {
  type Page = Parameters<Parameters<typeof test>[1]>[0]['page']

  /** The paid share as the card shows it. */
  async function paidPercent(page: Page): Promise<number> {
    return parseFloat((await page.locator('[data-test="field-paid-percent"]').textContent())!)
  }

  async function outstanding(page: Page): Promise<number> {
    return Number(await page.locator('[data-test="field-outstanding"]').inputValue())
  }

  /**
   * Adds a line WITHOUT saving. The point of most of these tests is that the paid
   * share follows the total on its own, and an unsaved line is the sharpest way to
   * show it: nothing has been near the server.
   */
  /**
   * `quantity` matters when the assertion is about a SHARE moving: the demo's
   * orders run to five and six figures, and one unit of the first product in the
   * list moves the paid percentage by less than the two decimals it is shown to.
   */
  async function addAnyLine(page: Page, quantity = 1) {
    await page.click('[data-test="order-add-item-btn"]')
    await page.waitForSelector('[data-test="add-items-product-row"]')
    const rows = page.locator('[data-test="add-items-product-row"]')
    await rows.first().locator('[data-test="add-items-product-checkbox"]').click()
    await expect(page.locator('[data-test="add-items-price"]').first()).toBeVisible()
    if (quantity !== 1) {
      await page.locator('[data-test="add-items-selected-qty"]').first().fill(String(quantity))
    }
    await page.click('[data-test="add-items-save-btn"]')
  }

  /** A line with stock behind it, shipped — the only way to get an invoice. */
  async function shipSomething(page: Page) {
    await page.click('[data-test="order-add-item-btn"]')
    await page.waitForSelector('[data-test="add-items-product-row"]')
    await page.fill('[data-test="add-items-filters"] input', 'Steel Sheet 3mm')
    const rows = page.locator('[data-test="add-items-product-row"]')
    await expect(rows.first()).toBeVisible()
    await rows.first().locator('[data-test="add-items-product-checkbox"]').click()
    await expect(page.locator('[data-test="add-items-price"]').first()).toBeVisible()
    await page.click('[data-test="add-items-save-btn"]')
    await page.click('[data-test="order-card-save-btn"]')
    await expect(page.locator('[data-test="order-card-save-btn"]')).toBeDisabled()

    await page.click('[data-test="order-ship-btn"]')
    await expect(page.locator('[data-test="ship-modal"]')).toBeVisible()
    await page.click('[data-test="ship-confirm"]')
    await expect(page.locator('[data-test="ship-modal"]')).toBeHidden()
    await expect(page.locator('[data-test="order-shipment-row"]').first()).toBeVisible()
  }

  test('an order nobody has paid says so, and holds no records', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-payments"]')).toBeVisible()
    await expect(page.locator('[data-test="order-invoices"]')).toBeVisible()
    await expect(page.locator('[data-test="order-payment-state"]')).toHaveText('Unpaid')
    await expect(page.locator('[data-test="order-payment-row"]')).toHaveCount(0)
    await expect(page.locator('[data-test="order-invoice-row"]')).toHaveCount(0)
    // Nothing paid, so the whole total is outstanding.
    expect(await outstanding(page)).toBeGreaterThan(0)
    expect(await paidPercent(page)).toBe(0)
  })

  test('the advance is a record, and the percentage is worked out from it', async ({ page }) => {
    // ORD-005 has a 25% advance seeded against its total.
    await page.goto('/admin/orders/ORD-005')
    await page.waitForSelector('[data-test="order-payment-row"]')
    await expect(page.locator('[data-test="order-payment-row"]')).toHaveCount(1)
    await expect(page.locator('[data-test="order-payment-state"]')).toContainText('Partially paid')
    expect(await paidPercent(page)).toBeCloseTo(25, 1)
  })

  test('the paid share falls by itself when the order grows', async ({ page }) => {
    // The whole reason the percentage is never stored. Nothing is saved here —
    // the figure follows the line table, not the server.
    await page.goto('/admin/orders/ORD-005')
    await page.waitForSelector('[data-test="order-item-row"]')
    const before = await paidPercent(page)
    const owedBefore = await outstanding(page)

    await addAnyLine(page, 500)
    await expect(page.locator('[data-test="order-card-save-btn"]')).toBeEnabled()

    const after = await paidPercent(page)
    expect(after).toBeLessThan(before)
    expect(await outstanding(page)).toBeGreaterThan(owedBefore)
  })

  test('a settled order that is changed warns, and still lets it happen', async ({ page }) => {
    // ORD-006 is paid in full. Adding a line makes it underpaid — which is a
    // warning, never a block (model section 6).
    await page.goto('/admin/orders/ORD-006')
    await page.waitForSelector('[data-test="order-item-row"]')
    await expect(page.locator('[data-test="order-payment-state"]')).toHaveText('Paid')
    await expect(page.locator('[data-test="payment-drift-warning"]')).toHaveCount(0)

    await addAnyLine(page)
    await expect(page.locator('[data-test="payment-drift-warning"]')).toBeVisible()
    await expect(page.locator('[data-test="payment-drift-warning"]')).toContainText('short')
    // Nothing is forbidden: the change can be saved.
    await expect(page.locator('[data-test="order-card-save-btn"]')).toBeEnabled()
  })

  test('paying what is left settles the order, and deleting it undoes that', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="order-item-row"]')
    const owed = await outstanding(page)

    await page.click('[data-test="order-add-payment-btn"]')
    await expect(page.locator('[data-test="payment-modal"]')).toBeVisible()
    // The dialog offers what is left to pay — the amount asked for nine times in ten.
    expect(Number(await page.locator('[data-test="payment-amount-input"]').inputValue())).toBe(owed)
    await page.click('[data-test="payment-confirm"]')
    await expect(page.locator('[data-test="payment-modal"]')).toBeHidden()

    await expect(page.locator('[data-test="order-payment-row"]')).toHaveCount(1)
    await expect(page.locator('[data-test="order-payment-state"]')).toHaveText('Paid')
    expect(await paidPercent(page)).toBe(100)

    await page.click('[data-test="payment-delete-btn"]')
    await expect(page.locator('[data-test="order-payment-row"]')).toHaveCount(0)
    await expect(page.locator('[data-test="order-payment-state"]')).toHaveText('Unpaid')
    expect(await paidPercent(page)).toBe(0)
  })

  test('the payment date is our own calendar, and the day picked is the day recorded', async ({
    page,
  }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="order-item-row"]')

    await page.click('[data-test="order-add-payment-btn"]')
    await expect(page.locator('[data-test="payment-modal"]')).toBeVisible()

    // The browser's own date widget is gone: it drew a black glyph on a dark
    // panel and ignored the theme entirely.
    await expect(page.locator('[data-test="payment-date"] input[type="date"]')).toHaveCount(0)
    const trigger = page.locator('[data-test="payment-date"] .datepicker-trigger')
    await expect(trigger).toBeVisible()

    await trigger.click()
    const popup = page.locator('[data-test="payment-date"] .datepicker-popup.open')
    await expect(popup).toBeVisible()
    // The first of whatever month the calendar opened on — read off the page,
    // never a date written into the test.
    await popup.locator('.calendar-day:not(.other-month)', { hasText: /^1$/ }).first().click()
    await expect(popup).toBeHidden()

    const shown = (await trigger.locator('.date-val').textContent())!.trim()
    const [dd, mm, yyyy] = shown.split('.')
    const picked = `${yyyy}-${mm}-${dd}`

    await page.click('[data-test="payment-confirm"]')
    await expect(page.locator('[data-test="payment-modal"]')).toBeHidden()
    await expect(page.locator('[data-test="order-payment-row"] td').first()).toHaveText(picked)
  })

  test('a refund is entered as a positive number and stored as a negative one', async ({
    page,
  }) => {
    await page.goto('/admin/orders/ORD-005')
    await page.waitForSelector('[data-test="order-payment-row"]')
    const owedBefore = await outstanding(page)

    await page.click('[data-test="order-add-payment-btn"]')
    await page.fill('[data-test="payment-amount-input"]', '100')
    await page.click('[data-test="payment-purpose"]')
    await page.click('[data-test="payment-purpose"] >> text=Refund')
    await page.click('[data-test="payment-confirm"]')
    await expect(page.locator('[data-test="payment-modal"]')).toBeHidden()

    // Money going the other way: the outstanding balance grows by exactly that.
    const rows = page.locator('[data-test="order-payment-row"]')
    await expect(rows).toHaveCount(2)
    await expect(rows.last().locator('[data-test="payment-amount"]')).toHaveText('-100.00')
    expect(await outstanding(page)).toBeCloseTo(owedBefore + 100, 1)
  })

  test('one payment stays one payment however hard the key is pressed', async ({ page }) => {
    // Enter twice is what people do, and a `disabled` attribute lands a tick too
    // late to stop the second one. Two records for the same money read as an order
    // paid twice over.
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="order-item-row"]')
    await page.click('[data-test="order-add-payment-btn"]')
    const amount = page.locator('[data-test="payment-amount-input"]')
    await amount.fill('100')
    await amount.press('Enter')
    await amount.press('Enter')
    await expect(page.locator('[data-test="order-payment-row"]')).toHaveCount(1)
    await expect(page.locator('[data-test="field-paid-amount"]')).toHaveValue('100.00')

    // Same for a document: two clicks in one tick must not issue two invoices.
    await page.click('[data-test="order-advance-invoice-btn"]')
    await page.fill('[data-test="advance-amount-input"]', '500')
    await page.evaluate(() => {
      const btn = document.querySelector('[data-test="advance-confirm"]') as HTMLButtonElement
      btn.click()
      btn.click()
    })
    await expect(page.locator('[data-test="order-invoice-row"]')).toHaveCount(1)
  })

  test('an advance invoice covers no delivery and states its own amount', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="order-invoices"]')
    await page.click('[data-test="order-advance-invoice-btn"]')
    await expect(page.locator('[data-test="advance-invoice-modal"]')).toBeVisible()
    await page.fill('[data-test="advance-amount-input"]', '1210')
    await page.click('[data-test="advance-confirm"]')
    await expect(page.locator('[data-test="advance-invoice-modal"]')).toBeHidden()

    const row = page.locator('[data-test="order-invoice-row"]').first()
    await expect(row).toContainText('Advance')
    await expect(row.locator('[data-test="invoice-amount"]')).toHaveText('1210.00')
  })

  test('a payment can name the invoice it settles', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="order-invoices"]')
    await page.click('[data-test="order-advance-invoice-btn"]')
    await page.fill('[data-test="advance-amount-input"]', '500')
    await page.click('[data-test="advance-confirm"]')
    const invoiceNumber = (await page
      .locator('[data-test="order-invoice-row"]')
      .first()
      .locator('td')
      .first()
      .textContent())!.trim()

    await page.click('[data-test="order-add-payment-btn"]')
    await page.fill('[data-test="payment-amount-input"]', '500')
    // The invoice picker only exists once there is an invoice to point at.
    await page.click('[data-test="payment-invoice"]')
    await page.click(`[data-test="payment-invoice"] >> text=${invoiceNumber}`)
    await page.click('[data-test="payment-confirm"]')
    await expect(page.locator('[data-test="payment-modal"]')).toBeHidden()

    // The link survived the round trip — the row names the document, not a dash.
    await expect(page.locator('[data-test="order-payment-row"]').first()).toContainText(
      invoiceNumber,
    )
  })

  test('a delivery is invoiced once, and the document freezes what it covers', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="order-item-row"]')
    await shipSomething(page)

    const shipment = page.locator('[data-test="order-shipment-row"]').first()
    await shipment.locator('[data-test="shipment-invoice-btn"]').click()
    await expect(page.locator('[data-test="order-invoice-row"]')).toHaveCount(1)
    const invoice = page.locator('[data-test="order-invoice-row"]').first()
    await expect(invoice).toContainText('Shipment')
    // One delivery, one invoice: a second would bill the client twice.
    await expect(shipment.locator('[data-test="shipment-invoice-btn"]')).toHaveCount(0)
  })

  test('a price printed wrong is corrected in the open, not rewritten', async ({ page }) => {
    // The one door through the freeze — model, sections 6 and 12. Before it there
    // was no way at all: the cells are shut, and the alternatives were to split
    // the line (which only reaches what has not gone) or cancel the whole
    // delivery (which returns goods that never came back).
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="order-item-row"]')
    await shipSomething(page)
    await page
      .locator('[data-test="order-shipment-row"]')
      .first()
      .locator('[data-test="shipment-invoice-btn"]')
      .click()
    await expect(page.locator('[data-test="order-invoice-row"]')).toHaveCount(1)

    const row = page
      .locator('[data-test="order-item-row"]')
      .filter({ has: page.locator('[data-test="line-correct-btn"]') })
      .first()
    // Shut to an ordinary edit, and the bin is gone: the client holds a document.
    await expect(row.locator('[data-test="cell-input"]')).toHaveCount(0)
    await expect(row.locator('[data-test="line-remove-btn"]')).toHaveCount(0)

    const totalBefore = Number(await page.locator('[data-test="field-gross-total"]').inputValue())
    const priced = Number(await lineCell(row, 'unitPrice'))
    await row.locator('[data-test="line-correct-btn"]').click()
    await expect(page.locator('[data-test="correct-modal"]')).toBeVisible()

    // Nothing happens without a reason: it goes to the client's accountant.
    await expect(page.locator('[data-test="correct-confirm"]')).toBeDisabled()
    await page.fill('[data-test="correct-price-input"]', String(priced - 5))
    await expect(page.locator('[data-test="correct-confirm"]')).toBeDisabled()
    await page.fill('[data-test="correct-reason-input"]', 'Agreed 5,00 lower before the truck left')
    await expect(page.locator('[data-test="correct-effect"]')).toBeVisible()
    await page.click('[data-test="correct-confirm"]')

    // The line moved, and it is still frozen — the goods are still gone.
    //
    // Hidden, not absent: `AppModal` always renders its overlay and only toggles
    // `.active` on it, so the count is 1 for as long as the card is mounted —
    // which is what the other nineteen modal assertions in this file say. This
    // one asked for a count of zero and passed only because the card used to
    // blank itself to a skeleton on every reload, unmounting the modals with it.
    // It was asserting the flash, not the closing.
    await expect(page.locator('[data-test="correct-modal"]')).toBeHidden()
    const corrected = page
      .locator('[data-test="order-item-row"]')
      .filter({ has: page.locator('[data-test="line-correct-btn"]') })
      .first()
    expect(Number(await lineCell(corrected, 'unitPrice'))).toBeCloseTo(priced - 5, 2)
    await expect(corrected.locator('[data-test="cell-input"]')).toHaveCount(0)
    expect(Number(await page.locator('[data-test="field-gross-total"]').inputValue())).toBeLessThan(
      totalBefore,
    )

    // The issued document was not rewritten — a second one adjusts it.
    await expect(page.locator('[data-test="order-invoice-row"]')).toHaveCount(2)
    await expect(page.locator('[data-test="order-invoice-row"]').last()).toContainText('Correction')
    // And it is in the order's history, with the reason attached.
    await expect(page.locator('[data-test="order-audit-table"]')).toContainText(
      'Agreed 5,00 lower before the truck left',
    )
  })

  test('cancelling an invoiced delivery asks for a reason and corrects it', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.waitForSelector('[data-test="order-item-row"]')
    await shipSomething(page)

    const shipment = page.locator('[data-test="order-shipment-row"]').first()
    await shipment.locator('[data-test="shipment-invoice-btn"]').click()
    await expect(page.locator('[data-test="order-invoice-row"]')).toHaveCount(1)

    // The plain cancellation dialog would be the wrong offer here — the client is
    // holding a document, and a document is withdrawn, not deleted.
    await shipment.locator('[data-test="shipment-cancel-btn"]').click()
    await expect(page.locator('[data-test="correction-modal"]')).toBeVisible()
    await expect(page.locator('[data-test="cancel-shipment-modal"]')).toBeHidden()
    await expect(page.locator('[data-test="correction-confirm"]')).toBeDisabled()

    await page.fill('[data-test="correction-reason-input"]', 'Client refused the load')
    await expect(page.locator('[data-test="correction-confirm"]')).toBeEnabled()
    await page.click('[data-test="correction-confirm"]')
    await expect(page.locator('[data-test="correction-modal"]')).toBeHidden()

    // The correcting invoice is on record, the original is marked as withdrawn,
    // and the goods have come back.
    const invoices = page.locator('[data-test="order-invoice-row"]')
    await expect(invoices).toHaveCount(2)
    await expect(invoices.first().locator('[data-test="invoice-corrected"]')).toBeVisible()
    await expect(invoices.last()).toContainText('Corrects')
    await expect(page.locator('[data-test="order-shipment-row"]').first()).toContainText(
      /Cancelled/,
    )
    // The line the document froze is a draft again — that is what correcting is for.
    await expect(page.locator('[data-test="order-item-row"]').last()).toContainText('Draft')
  })

  test('with the flag off both panels are gone', async ({ page }) => {
    await page.goto('/admin/orders/ORD-005')
    await page.waitForSelector('[data-test="order-payments"]')
    await setFlag(page, 'orderInvoicesPayments', false)
    await page.waitForSelector('[data-test="order-items"]')
    await expect(page.locator('[data-test="order-payments"]')).toHaveCount(0)
    await expect(page.locator('[data-test="order-invoices"]')).toHaveCount(0)
    await expect(page.locator('[data-test="field-paid-amount"]')).toHaveCount(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Order Card — Save flow
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Order Card › save flow', () => {
  test('edit notes enables save button', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    const saveBtn = page.locator('[data-test="order-card-save-btn"]')
    // Initially save should be disabled (no changes)
    await expect(saveBtn).toBeDisabled()
    // Edit notes
    await page.locator('[data-test="field-notes"]').fill('Test note edit')
    await expect(saveBtn).toBeEnabled()
  })

  test('discard resets notes field', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.locator('[data-test="field-notes"]').fill('Modified notes')
    await page.locator('[data-test="order-card-discard-btn"]').click()
    await page.waitForTimeout(500)
    // Value should be restored to original (null/empty)
    await expect(page.locator('[data-test="field-notes"]')).toHaveValue('')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Order Card — Delete order
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Order Card › delete', () => {
  test('delete button opens confirmation modal', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.locator('[data-test="order-card-delete-btn"]').click()
    await expect(page.locator('[data-test="order-card-delete-modal"]')).toBeVisible()
  })

  test('cancel closes deletion modal', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.locator('[data-test="order-card-delete-btn"]').click()
    await expect(page.locator('[data-test="order-card-delete-modal"]')).toBeVisible()
    await page.locator('[data-test="order-card-delete-modal-cancel"]').click()
    await expect(page.locator('[data-test="order-card-delete-modal"]')).toBeHidden()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Order Card — Audit log
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Order Card › audit log', () => {
  test('audit section is visible', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-audit"]')).toBeVisible()
  })

  test('audit delete button opens confirmation modal', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    // `if (count > 0)` здесь пропускал ВСЁ тело, когда кнопка ещё не отрисовалась, и
    // тест проходил, ничего не проверив (#68). У ORD-001 журнал непустой, значит кнопка
    // обязана быть — это утверждение, а не условие.
    await expect(page.locator('[data-test="order-audit"]')).toBeVisible()
    const deleteBtn = page.locator('[data-test="order-audit-delete-btn"]')
    await expect(deleteBtn.first()).toBeVisible()
    await deleteBtn.first().click()
    await expect(page.locator('[data-test="order-audit-modal"]')).toBeVisible()
  })

  test('cancel closes audit delete modal', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('[data-test="order-audit"]')).toBeVisible()
    const deleteBtn = page.locator('[data-test="order-audit-delete-btn"]')
    await expect(deleteBtn.first()).toBeVisible()
    await deleteBtn.first().click()
    await expect(page.locator('[data-test="order-audit-modal"]')).toBeVisible()
    await page.locator('[data-test="order-audit-modal-cancel"]').click()
    await expect(page.locator('[data-test="order-audit-modal"]')).toBeHidden()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Order Create — Client selector & validation
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Order Create › client selector', () => {
  test('client panel renders with search, list and pagination', async ({ page }) => {
    await page.goto('/admin/orders/new')
    await expect(page.locator('[data-test="order-create-client-panel"]')).toBeVisible()
    await expect(page.locator('[data-test="order-create-client-search"]')).toBeVisible()
    await expect(page.locator('[data-test="order-create-client-list"]')).toBeVisible()
    await expect(page.locator('[data-test="order-create-client-item"]').first()).toBeVisible({
      timeout: 5000,
    })
    await expect(page.locator('[data-test="order-create-client-pagination"]')).toBeVisible()
  })

  test('client search filters the list', async ({ page }) => {
    await page.goto('/admin/orders/new')
    await expect(page.locator('[data-test="order-create-client-item"]').first()).toBeVisible({
      timeout: 5000,
    })
    const itemsBefore = await page.locator('[data-test="order-create-client-item"]').count()
    // Search for a specific client
    await page.locator('[data-test="order-create-client-search"] input').fill('Metalica')
    await page.waitForTimeout(300)
    // Count should be less than or equal to before
    const itemsAfter = await page.locator('[data-test="order-create-client-item"]').count()
    expect(itemsAfter).toBeLessThanOrEqual(itemsBefore)
  })

  test('selecting a client shows selected indicator', async ({ page }) => {
    await page.goto('/admin/orders/new')
    await expect(page.locator('[data-test="order-create-client-item"]').first()).toBeVisible({
      timeout: 5000,
    })
    await page.locator('[data-test="order-create-client-item"]').first().click()
    await expect(page.locator('[data-test="order-create-client-selected"]')).toBeVisible()
  })

  test('new client search shows empty state for no results', async ({ page }) => {
    await page.goto('/admin/orders/new')
    await page.locator('[data-test="order-create-client-search"] input').fill('zzz-no-match')
    await page.waitForTimeout(300)
    await expect(page.locator('[data-test="order-create-client-empty"]')).toBeVisible()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Translation sanity
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Orders i18n', () => {
  test('orders list page renders with title', async ({ page }) => {
    await page.goto('/admin/orders')
    await expect(page.locator('h1')).toBeVisible()
  })

  test('order card page renders', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await expect(page.locator('h1.page-title')).toBeVisible()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Add Item Modal
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Add item modal', () => {
  /** The number in a cell, whatever currency suffix it carries. */
  function amount(text: string): number {
    return Number(text.replace(/[^\d.,-]/g, '').replace(',', '.'))
  }

  test('the price column quotes the price the line will be sold at', async ({ page }) => {
    await page.goto('/admin/orders/ORD-001')
    await page.locator('[data-test="order-add-item-btn"]').click()
    const modal = page.locator('[data-test="add-order-items-modal"]')
    await expect(modal).toBeVisible()

    // A product that is in stock: the one whose price used to be replaced by the
    // warehouse's cost per unit.
    await modal.locator('[data-test="add-items-filters"] input').fill('Aluminium Pipe 25x2')
    const row = modal.locator('[data-test="add-items-product-row"]').first()
    await expect(row).toContainText('Aluminium Pipe 25x2')
    const catalogue = amount(await row.locator('[data-test="add-items-product-price"]').innerText())

    await row.click()
    const selected = modal.locator('[data-test="add-items-selected-row"]').first()
    await expect(selected).toBeVisible()
    const quoted = amount(await selected.locator('[data-test="add-items-price"]').innerText())

    // One product, one modal, one heading — one number.
    expect(catalogue).toBe(quoted)

    // And cost is not under a heading that says price: it is not in this modal.
    const headers = await modal
      .locator('[data-test="add-items-selected-table"] thead th')
      .allInnerTexts()
    expect(headers.join(' | ')).not.toMatch(/cost|себест|savikain/i)
  })
})
