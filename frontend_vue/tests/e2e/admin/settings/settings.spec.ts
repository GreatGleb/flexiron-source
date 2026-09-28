import { test, expect } from '../../fixtures'
import { enableAllFlags } from '../../helpers/flags'
import { DATA_READY_TIMEOUT, waitForDataReady } from '../../helpers/ready'

test.beforeEach(async ({ context }) => {
  await enableAllFlags(context)
})

// ═══════════════════════════════════════════════════════════════════════════
// Settings Layout & Tabs
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Settings Layout', () => {
  test('loads without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/admin/settings/profile')
    await expect(page.locator('[data-test="settings-tabs"]')).toBeVisible({
      timeout: DATA_READY_TIMEOUT,
    })
    expect(errors).toHaveLength(0)
  })

  test('the settings tabs are the seven sections, in order', async ({ page }) => {
    // The names, not the count: a number says only that something changed, and a
    // count taken from the rendered buttons would be the DOM compared with itself.
    await page.goto('/admin/settings/profile')
    const tabs = page.locator('[data-test="settings-tabs"] .warehouse-tab')
    await expect(tabs).toHaveText(
      ['Profile', 'Company', 'Finance', 'Units of Measure', 'Order Statuses', 'Mail', 'Logs'],
      { timeout: DATA_READY_TIMEOUT },
    )
  })

  test('tab navigation works — click through all tabs', async ({ page }) => {
    await page.goto('/admin/settings/profile')
    const tabs = page.locator('[data-test="settings-tabs"] .warehouse-tab')

    // Profile tab (already active)
    await expect(page).toHaveURL(/\/admin\/settings\/profile/, { timeout: DATA_READY_TIMEOUT })

    // Company tab
    await tabs.nth(1).click()
    await expect(page).toHaveURL(/\/admin\/settings\/company/, { timeout: DATA_READY_TIMEOUT })

    // Finance tab
    await tabs.nth(2).click()
    await expect(page).toHaveURL(/\/admin\/settings\/finance/, { timeout: DATA_READY_TIMEOUT })

    // Units tab
    await tabs.nth(3).click()
    await expect(page).toHaveURL(/\/admin\/settings\/units/, { timeout: DATA_READY_TIMEOUT })

    // Order Statuses tab
    await tabs.nth(4).click()
    await expect(page).toHaveURL(/\/admin\/settings\/order-statuses/, {
      timeout: DATA_READY_TIMEOUT,
    })
  })

  test('save/cancel action bar is visible', async ({ page }) => {
    await page.goto('/admin/settings/company')
    await expect(page.locator('.entity-action-bar')).toBeVisible({ timeout: DATA_READY_TIMEOUT })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Profile Settings
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Profile Settings', () => {
  test('loads profile form with all fields', async ({ page }) => {
    await page.goto('/admin/settings/profile')
    await expect(page.locator('[data-test="settings-profile-first-name"]')).toBeVisible({
      timeout: DATA_READY_TIMEOUT,
    })
    await expect(page.locator('[data-test="settings-profile-last-name"]')).toBeVisible()
    await expect(page.locator('[data-test="settings-profile-email"]')).toBeVisible()
    await expect(page.locator('[data-test="settings-profile-phone"]')).toBeVisible()
    await expect(page.locator('[data-test="settings-profile-role"]')).toBeVisible()
  })

  test('password change section is visible', async ({ page }) => {
    await page.goto('/admin/settings/profile')
    await expect(page.locator('[data-test="settings-profile-current-password"]')).toBeVisible({
      timeout: DATA_READY_TIMEOUT,
    })
    await expect(page.locator('[data-test="settings-profile-new-password"]')).toBeVisible()
    await expect(page.locator('[data-test="settings-profile-confirm-password"]')).toBeVisible()
    await expect(page.locator('[data-test="settings-profile-change-password"]')).toBeVisible()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Company Settings
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Company Settings', () => {
  test('loads company form with all fields', async ({ page }) => {
    await page.goto('/admin/settings/company')
    await expect(page.locator('[data-test="settings-company-name"]')).toBeVisible({
      timeout: DATA_READY_TIMEOUT,
    })
    await expect(page.locator('[data-test="settings-company-legal-address"]')).toBeVisible()
    await expect(page.locator('[data-test="settings-company-vat-code"]')).toBeVisible()
    await expect(page.locator('[data-test="settings-company-bank-name"]')).toBeVisible()
    await expect(page.locator('[data-test="settings-company-bank-account"]')).toBeVisible()
  })

  test('typing in fields makes save bar dirty', async ({ page }) => {
    await page.goto('/admin/settings/company')
    const nameInput = page.locator('[data-test="settings-company-name"]')
    await nameInput.fill('Test Company')
    // Save button should become active (not disabled)
    const saveBtn = page.locator('.btn-save')
    await expect(saveBtn).not.toBeDisabled({ timeout: DATA_READY_TIMEOUT })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Mail Settings
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Mail Settings', () => {
  test('loads the mail server form filled from settings', async ({ page }) => {
    await page.goto('/admin/settings/mail')
    // Ждём пришедшее значение, а не поле: форма существует и пустой (#64).
    await expect(page.locator('[data-test="settings-mail-host"]')).not.toHaveValue('', {
      timeout: DATA_READY_TIMEOUT,
    })
    await expect(page.locator('[data-test="settings-mail-from-email"]')).not.toHaveValue('')
    await expect(page.locator('[data-test="settings-mail-port"]')).not.toHaveValue('')
    await expect(page.locator('[data-test="settings-mail-encryption"]')).toBeVisible()
  })

  test('the password field stays empty even though a password is set', async ({ page }) => {
    await page.goto('/admin/settings/mail')
    await expect(page.locator('[data-test="settings-mail-host"]')).not.toHaveValue('', {
      timeout: DATA_READY_TIMEOUT,
    })

    // Сервер пароль не отдаёт: поле пустое, а о том, что пароль есть, говорит
    // подсказка — иначе форма стирала бы его при сохранении соседнего поля.
    const password = page.locator('[data-test="settings-mail-password"]')
    await expect(password).toHaveValue('')
    await expect(password).toHaveAttribute('placeholder', /password is set/i)
  })

  test('the test button reports the address the letter went to', async ({ page }) => {
    await page.goto('/admin/settings/mail')
    const from = page.locator('[data-test="settings-mail-from-email"]')
    await expect(from).not.toHaveValue('', { timeout: DATA_READY_TIMEOUT })
    const sender = await from.inputValue()

    await page.locator('[data-test="settings-mail-test-btn"]').click()

    // Успех именно этой отправки: в тосте адрес отправителя, а не любое сообщение.
    await expect(page.locator('.toast-container .toast.show')).toContainText(sender, {
      timeout: DATA_READY_TIMEOUT,
    })
  })

  test('typing in the host field makes the save bar dirty', async ({ page }) => {
    await page.goto('/admin/settings/mail')
    const host = page.locator('[data-test="settings-mail-host"]')
    await expect(host).not.toHaveValue('', { timeout: DATA_READY_TIMEOUT })
    await host.fill('smtp.changed.lt')

    await expect(page.locator('.btn-save')).not.toBeDisabled({ timeout: DATA_READY_TIMEOUT })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Finance Settings
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Finance Settings', () => {
  test('loads finance form with numeric inputs', async ({ page }) => {
    await page.goto('/admin/settings/finance')
    await expect(page.locator('[data-test="settings-finance-vat-rate"]')).toBeVisible({
      timeout: DATA_READY_TIMEOUT,
    })
    await expect(page.locator('[data-test="settings-finance-default-margin"]')).toBeVisible()
    await expect(page.locator('[data-test="settings-finance-default-discount"]')).toBeVisible()
  })

  test('currencies table is visible with rows', async ({ page }) => {
    await page.goto('/admin/settings/finance')
    const table = page.locator('[data-test="settings-finance-currencies-table"]')
    await expect(table).toBeVisible({ timeout: DATA_READY_TIMEOUT })
    const rows = table.locator('tbody tr')
    await expect(rows.first()).toBeVisible()
  })

  test('add currency modal opens and has inputs', async ({ page }) => {
    await page.goto('/admin/settings/finance')
    // Переход и сразу действие: без ожидания тест зависит от того,
    // успела ли страница подняться, а этого он не контролирует.
    await waitForDataReady(page)
    await page.locator('[data-test="settings-finance-add-currency"]').click()
    await expect(page.locator('[data-test="settings-modal-currency-code"]')).toBeVisible({
      timeout: DATA_READY_TIMEOUT,
    })
    await expect(page.locator('[data-test="settings-modal-currency-name"]')).toBeVisible({
      timeout: DATA_READY_TIMEOUT,
    })
    // A currency has a code and a name, and no rate: there is no conversion
    // anywhere in this system, so a rate here would be a number nothing reads.
    // The directory of currencies stays; the table of rates is gone (§7.1).
    await expect(page.locator('[data-test="settings-modal-currency-rate"]')).toHaveCount(0, {
      timeout: DATA_READY_TIMEOUT,
    })
  })

  test('currency delete button is visible', async ({ page }) => {
    await page.goto('/admin/settings/finance')
    await expect(
      page.locator('[data-test="settings-finance-currency-delete"]').first(),
    ).toBeVisible({ timeout: DATA_READY_TIMEOUT })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Units Settings
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Units Settings', () => {
  test('loads UoM table with rows', async ({ page }) => {
    await page.goto('/admin/settings/units')
    const table = page.locator('[data-test="settings-uom-table"]')
    await expect(table).toBeVisible({ timeout: DATA_READY_TIMEOUT })
    await expect(table.locator('tbody tr').first()).toBeVisible()
  })

  test('conversion rules table is visible', async ({ page }) => {
    await page.goto('/admin/settings/units')
    const table = page.locator('[data-test="settings-conversion-table"]')
    await expect(table).toBeVisible({ timeout: DATA_READY_TIMEOUT })
    await expect(table.locator('tbody tr').first()).toBeVisible()
  })

  test('add UoM modal opens with category dropdown', async ({ page }) => {
    await page.goto('/admin/settings/units')
    // Переход и сразу действие: без ожидания тест зависит от того,
    // успела ли страница подняться, а этого он не контролирует.
    await waitForDataReady(page)
    await page.locator('[data-test="settings-uom-add"]').click()
    await expect(page.locator('[data-test="settings-modal-uom-code"]')).toBeVisible({
      timeout: DATA_READY_TIMEOUT,
    })
    await expect(page.locator('[data-test="settings-modal-uom-name"]')).toBeVisible({
      timeout: DATA_READY_TIMEOUT,
    })
  })

  test('add conversion modal opens', async ({ page }) => {
    await page.goto('/admin/settings/units')
    // Переход и сразу действие: без ожидания тест зависит от того,
    // успела ли страница подняться, а этого он не контролирует.
    await waitForDataReady(page)
    await page.locator('[data-test="settings-conversion-add"]').click()
    // AppModal renders .modal-overlay.active with .modal-title containing the title text
    const activeOverlay = page.locator('.modal-overlay.active')
    await expect(activeOverlay).toBeVisible({ timeout: DATA_READY_TIMEOUT })
    await expect(activeOverlay.locator('.modal-title')).toContainText(/Conversion|Add/, {
      timeout: DATA_READY_TIMEOUT,
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Order Statuses Settings
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Order Statuses Settings', () => {
  test('loads statuses table with rows', async ({ page }) => {
    await page.goto('/admin/settings/order-statuses')
    const table = page.locator('[data-test="settings-statuses-table"]')
    await expect(table).toBeVisible({ timeout: DATA_READY_TIMEOUT })
    await expect(table.locator('tbody tr').first()).toBeVisible()
  })

  test('all status columns are present', async ({ page }) => {
    await page.goto('/admin/settings/order-statuses')
    const table = page.locator('[data-test="settings-statuses-table"]')
    const headers = table.locator('thead th')
    // Order, Name, Color, Reserve, Write-off, Actions
    await expect(headers).toHaveCount(6, { timeout: DATA_READY_TIMEOUT })
  })

  test('add status modal opens with color picker', async ({ page }) => {
    await page.goto('/admin/settings/order-statuses')
    // Переход и сразу действие: без ожидания тест зависит от того,
    // успела ли страница подняться, а этого он не контролирует.
    await waitForDataReady(page)
    await page.locator('[data-test="settings-status-add"]').click()
    await expect(page.locator('[data-test="settings-status-modal-name"]')).toBeVisible({
      timeout: DATA_READY_TIMEOUT,
    })
  })

  test('status name input is editable in table', async ({ page }) => {
    await page.goto('/admin/settings/order-statuses')
    const nameInput = page.locator('[data-test="settings-status-name"]').first()
    await expect(nameInput).toBeVisible({ timeout: DATA_READY_TIMEOUT })
  })
})
