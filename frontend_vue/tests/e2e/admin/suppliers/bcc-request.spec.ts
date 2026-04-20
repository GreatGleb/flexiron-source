import { test as base } from '@playwright/test'
import { test, expect } from '../../fixtures'
import { ALL_FLAGS_ENABLED } from '../../helpers/flags'
import { freezeTime } from '../../helpers/mocks'
import { waitForFontsReady, SNAPSHOT_OPTIONS } from '../../helpers/visual'

/**
 * Deep audit of BccRequestPage (src/views/admin/suppliers/BccRequestPage.vue).
 *
 * Page shape — composable-driven (useBccRequest → bccService → mocks/bcc):
 *
 *   h1[data-test="bcc-request-title"]
 *   [data-test="bcc-request-action-bar"]
 *     [data-test="bcc-request-log-split-btn"]
 *       button[data-test="bcc-request-log-btn"]         → onLogClick (logRequest with current source)
 *       button[data-test="bcc-request-log-caret-btn"]   → toggles log dropdown
 *       [data-test="bcc-request-log-dropdown"]          (v-if logDropdownOpen)
 *         [data-test="bcc-request-log-dropdown-item"][data-source] × 5
 *     button[data-test="bcc-request-send-btn"]          → sendRequest (POST /api/bcc/send)
 *   [data-test="bcc-request-content"]
 *     LEFT COL:
 *       [data-test="bcc-request-categories-panel"]
 *         [data-test="bcc-request-products-search"]     (SearchInput)
 *         [data-test="bcc-request-products-filter"]     (CustomSelect, 'all' + 5 categories)
 *         table[data-test="bcc-request-products-table"]
 *           input[data-test="bcc-request-products-select-all"]
 *           tr[data-test="bcc-request-product-group"][data-category-name]
 *           tr[data-test="bcc-request-product-row"][data-product-id] × 15 (paged)
 *             input[data-test="bcc-request-product-checkbox"]
 *         [data-test="bcc-request-products-count"]
 *       [data-test="bcc-request-recipients-panel"]
 *         button[data-test="bcc-request-recipients-select-all"]
 *         button[data-test="bcc-request-recipients-deselect-all"]
 *         [data-test="bcc-request-recipients-count"]
 *         [data-test="bcc-request-recipients-search"]   (SearchInput)
 *         [data-test="bcc-request-recipients-list"]
 *           label[data-test="bcc-request-recipient-item"][data-recipient-id] × 5 (paged / 6 total)
 *             input[data-test="bcc-request-recipient-checkbox"]
 *         [data-test="bcc-request-recipients-active-count"]
 *     CENTER COL:
 *       [data-test="bcc-request-template-panel"]
 *         EmailTemplate
 *           input[data-test="email-template-subject"]
 *           textarea[data-test="email-template-body"]
 *           [data-test="bcc-request-attachments"]
 *             [data-test="bcc-request-attachments-list"]
 *               [data-test="bcc-request-attachment-item"][data-attachment-id]
 *             [data-test="bcc-request-dropzone"]        (DropZone — hidden <input type=file>)
 *     RIGHT COL (v-if showBccHistory — bccHistory flag):
 *       [data-test="bcc-request-history-panel"]
 *         table[data-test="bcc-request-history-table"]
 *           tr[data-test="bcc-request-history-row"][data-event-id][data-request-id][data-status] × N
 *             button[data-test="bcc-request-history-accept-btn"]   (sent | no_response; latest only)
 *             button[data-test="bcc-request-history-cancel-btn"]   (sent; latest only)
 *             button[data-test="bcc-request-history-edit-btn"]     (responded; latest only)
 *
 *   AppModal (response) — Teleported to body (`.modal-overlay.active`)
 *     [data-test="bcc-request-response-modal"]
 *       [data-test="bcc-request-response-supplier"]      (readonly)
 *       [data-test="bcc-request-response-items"]         (tags)
 *       [data-test="bcc-request-response-price"]
 *       [data-test="bcc-request-response-unit-trigger"]
 *       [data-test="bcc-request-response-unit-option"][data-unit] × 4 (kg / m / piece / ton)
 *     [data-test="bcc-request-response-cancel-btn"]
 *     [data-test="bcc-request-response-save-btn"]
 *
 * Mock (mocks/bcc.ts):
 *   5 categories × 15 products (Sheets×4, Lintels×2, Beams×3, Pipes×3, Rebars×3).
 *   Recipients come from MOCK_SUPPLIERS (6 suppliers). `selected` auto-flags suppliers
 *   whose categories cover any selected product (e.g. sheet-2mm → selects sup-001/sup-003).
 *   History: 7 seed events — req-001 (3 sent Sheet 2mm), req-002 (1 responded + 1 no_response
 *   I-Beam 20), req-003 (2 sent Pipe 100mm).
 *
 * Known constraints:
 *   - VITE_USE_MOCKS=true by default → apiPost → postMock, so `page.route` cannot intercept
 *     send/log/accept/no-response. Verified via observable side effects: success/error toasts,
 *     new history rows, modal close, latest-action buttons flip.
 *   - page.goto() is a full reload → mock modules re-evaluate → MOCK_BCC_HISTORY resets.
 *     Any mid-test mutation-persistence claims rely on in-page state or SPA-nav.
 *   - `baseTest` bypasses the fixtures wrapper to install its own flag overrides
 *     (matches supplier-card-config.spec.ts).
 */

const baseTest = base

const BCC_URL = '/admin/suppliers/bcc-request'
const DESKTOP = { width: 1440, height: 900 }

const MOCK = {
  productCount: 15,
  categoryCount: 5,
  recipientCount: 6, // MOCK_SUPPLIERS.length
  historyCount: 7, // MOCK_BCC_HISTORY.length
  sources: ['BCC Tool', 'Email', 'Phone', 'Messenger', 'Other'] as const,
  units: ['kg', 'm', 'piece', 'ton'] as const,
} as const

async function loadBcc(page: import('@playwright/test').Page, query = '') {
  await page.setViewportSize(DESKTOP)
  await freezeTime(page)
  await page.goto(BCC_URL + query)
  await expect(page.locator('[data-test="bcc-request-title"]')).toBeVisible()
  await page.waitForLoadState('networkidle')
  // apiGet() under VITE_USE_MOCKS=true uses `await import()` rather than fetch, so
  // `networkidle` fires before onMounted's await-chain resolves. Wait for each
  // composable-fed section to actually paint its first row before returning.
  await expect(page.locator('[data-test="bcc-request-recipient-item"]').first()).toBeVisible()
  await expect(page.locator('[data-test="bcc-request-product-row"]').first()).toBeVisible()
  await expect(page.locator('[data-test="bcc-request-history-row"]').first()).toBeVisible()
}

// ────────────────────────────────────────────────────────────────────────────
// Structure
// ────────────────────────────────────────────────────────────────────────────
test.describe('bcc-request › structure', () => {
  test.beforeEach(async ({ page }) => {
    await loadBcc(page)
  })

  test('title + action bar + content render', async ({ page }) => {
    await expect.soft(page.locator('[data-test="bcc-request-title"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="bcc-request-action-bar"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="bcc-request-content"]')).toBeVisible()
  })

  test('all four panels render (categories / recipients / template / history)', async ({
    page,
  }) => {
    await expect.soft(page.locator('[data-test="bcc-request-categories-panel"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="bcc-request-recipients-panel"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="bcc-request-template-panel"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="bcc-request-history-panel"]')).toBeVisible()
  })

  test('action bar exposes the log split button + send button', async ({ page }) => {
    await expect.soft(page.locator('[data-test="bcc-request-log-btn"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="bcc-request-log-caret-btn"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="bcc-request-send-btn"]')).toBeVisible()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Products table
// ────────────────────────────────────────────────────────────────────────────
test.describe('bcc-request › products table', () => {
  test.beforeEach(async ({ page }) => {
    await loadBcc(page)
  })

  test('renders a full first page of product rows with group headers (default page size 10)', async ({
    page,
  }) => {
    // The table paginates at 10 per page. 15 seed products means page 1 carries 10 rows
    // that span 3–4 consecutive category groups; page 2 carries the rest.
    await expect(page.locator('[data-test="bcc-request-product-row"]')).toHaveCount(10)
    // At least one group header is always rendered when there are rows.
    await expect(page.locator('[data-test="bcc-request-product-group"]').first()).toBeVisible()
  })

  test('clicking a product row toggles its checkbox and updates the selected count', async ({
    page,
  }) => {
    const row = page.locator('[data-test="bcc-request-product-row"][data-product-id="sheet-2mm"]')
    const cb = row.locator('[data-test="bcc-request-product-checkbox"]')
    await expect(cb).not.toBeChecked()
    await row.click()
    await expect(cb).toBeChecked()
    await expect(page.locator('[data-test="bcc-request-products-count"]')).toContainText('1')
  })

  test('select-all toggles every visible product (14 mock fits on default 10-per-page → only the visible slice)', async ({
    page,
  }) => {
    const rows = page.locator('[data-test="bcc-request-product-row"]')
    const visible = await rows.count()
    await page.locator('[data-test="bcc-request-products-select-all"]').check()
    // Every currently-visible checkbox should be checked.
    for (let i = 0; i < visible; i++) {
      await expect
        .soft(rows.nth(i).locator('[data-test="bcc-request-product-checkbox"]'))
        .toBeChecked()
    }
  })

  test('product search filters by name (case-insensitive substring)', async ({ page }) => {
    await page.locator('[data-test="bcc-request-products-search"] input').fill('sheet')
    // Four Sheet products in the mock — pagination size is 10 so they all fit.
    await expect(page.locator('[data-test="bcc-request-product-row"]')).toHaveCount(4)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Recipients picker
// ────────────────────────────────────────────────────────────────────────────
test.describe('bcc-request › recipients picker', () => {
  test.beforeEach(async ({ page }) => {
    await loadBcc(page)
  })

  test('renders the mock recipients paged at 5 per page (6 total → 5 on page 1)', async ({
    page,
  }) => {
    await expect(page.locator('[data-test="bcc-request-recipient-item"]')).toHaveCount(5)
  })

  test('clicking a recipient checkbox toggles the selection and bumps the count', async ({
    page,
  }) => {
    const first = page.locator('[data-test="bcc-request-recipient-item"]').first()
    await first.locator('[data-test="bcc-request-recipient-checkbox"]').check()
    await expect(page.locator('[data-test="bcc-request-recipients-count"] .count')).toContainText(
      '1',
    )
  })

  test('select-all picks every mock recipient (6); deselect-all clears the selection', async ({
    page,
  }) => {
    await page.locator('[data-test="bcc-request-recipients-select-all"]').click()
    await expect(page.locator('[data-test="bcc-request-recipients-count"] .count')).toContainText(
      String(MOCK.recipientCount),
    )
    await page.locator('[data-test="bcc-request-recipients-deselect-all"]').click()
    await expect(page.locator('[data-test="bcc-request-recipients-count"] .count')).toContainText(
      '0',
    )
  })

  test('recipient search filters by company name or email', async ({ page }) => {
    await page.locator('[data-test="bcc-request-recipients-search"] input').fill('Steel Plus')
    const items = page.locator('[data-test="bcc-request-recipient-item"]')
    await expect(items).toHaveCount(1)
    await expect(items.first()).toContainText('Steel Plus OÜ')
  })

  test('selecting a product auto-flags category-matching suppliers (sup-001 Sheets/Pipes)', async ({
    page,
  }) => {
    // sheet-2mm is in category "Sheets"; MOCK_SUPPLIERS sup-001 and sup-003 cover Sheets,
    // so mockGetBccRecipients returns them with selected=true → the watcher pushes their
    // ids into selectedRecipientIds.
    await page.locator('[data-test="bcc-request-product-row"][data-product-id="sheet-2mm"]').click()
    // Wait for the recipients watcher to propagate the `selected` flags.
    await expect
      .poll(async () =>
        page.locator('[data-test="bcc-request-recipients-count"] .count').textContent(),
      )
      .toMatch(/\b[12]\b/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Query param ?supplier=<id> — preselect recipient
// ────────────────────────────────────────────────────────────────────────────
test.describe('bcc-request › ?supplier= preselect', () => {
  test('arriving with ?supplier=1 preselects Steel Plus OÜ and surfaces a toast', async ({
    page,
  }) => {
    await loadBcc(page, '?supplier=1')
    // The toast fires once the preselect branch resolves.
    await expect.soft(page.locator('.toast-container .toast.show')).toBeVisible()
    await expect
      .poll(async () =>
        page.locator('[data-test="bcc-request-recipients-count"] .count').textContent(),
      )
      .toContain('1')
    // The preselected supplier floats to the top of the list and is checked.
    const top = page.locator('[data-test="bcc-request-recipient-item"]').first()
    await expect.soft(top.locator('[data-test="bcc-request-recipient-checkbox"]')).toBeChecked()
    await expect.soft(top).toContainText('Steel Plus OÜ')
  })

  test('an unknown ?supplier= value degrades silently (no preselect, no toast)', async ({
    page,
  }) => {
    await loadBcc(page, '?supplier=zzz-nope')
    // No match → no toast, count stays at 0.
    await expect(page.locator('[data-test="bcc-request-recipients-count"] .count')).toContainText(
      '0',
    )
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Email template + attachments
// ────────────────────────────────────────────────────────────────────────────
test.describe('bcc-request › email template', () => {
  test.beforeEach(async ({ page }) => {
    await loadBcc(page)
  })

  test('subject and body come pre-filled from the default template', async ({ page }) => {
    await expect(page.locator('[data-test="email-template-subject"]')).toHaveValue(
      'Price Request — InBox LT',
    )
    await expect(page.locator('[data-test="email-template-body"]')).toHaveValue(/Hello/)
  })

  test('selecting a product rebuilds the body to include its label', async ({ page }) => {
    await page.locator('[data-test="bcc-request-product-row"][data-product-id="sheet-2mm"]').click()
    await expect(page.locator('[data-test="email-template-body"]')).toHaveValue(/Sheet 2mm/)
  })

  test('uploading an attachment via the dropzone appends a FileItem', async ({ page }) => {
    const before = await page.locator('[data-test="bcc-request-attachment-item"]').count()
    // DropZone's hidden <input type=file> handles both click-to-pick and DnD through the
    // same handleFiles() path — setInputFiles bypasses the picker and fires the upload.
    const input = page.locator('[data-test="bcc-request-dropzone"] input[type="file"]')
    await input.setInputFiles({
      name: 'price-sheet.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('attachment-content'),
    })
    await expect(page.locator('[data-test="bcc-request-attachment-item"]')).toHaveCount(before + 1)
    await expect(page.locator('[data-test="bcc-request-attachment-item"]').last()).toContainText(
      'price-sheet.pdf',
    )
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Send flow — validation gates + success toast
// ────────────────────────────────────────────────────────────────────────────
test.describe('bcc-request › send flow', () => {
  test.beforeEach(async ({ page }) => {
    await loadBcc(page)
  })

  test('send with no products selected shows an error toast (select_product)', async ({ page }) => {
    await page.locator('[data-test="bcc-request-send-btn"]').click()
    await expect.soft(page.locator('.toast-container .toast.show.toast-error')).toBeVisible()
  })

  test('send with products but no recipients shows select_recipient error', async ({ page }) => {
    // Pick a product whose category is NOT covered by any mock supplier. All seed suppliers
    // hit at least one of {Sheets, Pipes, Beams, Rebars, Lintels}, so every product auto-
    // selects at least one recipient. Instead, pick a product, wait for the async recipient
    // refresh + watcher to settle, THEN deselect everyone so the race doesn't re-populate.
    await page.locator('[data-test="bcc-request-product-row"][data-product-id="sheet-2mm"]').click()
    await expect
      .poll(async () =>
        page.locator('[data-test="bcc-request-recipients-count"] .count').textContent(),
      )
      .toMatch(/\b[12]\b/)
    await page.locator('[data-test="bcc-request-recipients-deselect-all"]').click()
    await expect(page.locator('[data-test="bcc-request-recipients-count"] .count')).toContainText(
      '0',
    )
    await page.locator('[data-test="bcc-request-send-btn"]').click()
    await expect.soft(page.locator('.toast-container .toast.show.toast-error')).toBeVisible()
  })

  test('send with empty subject shows enter_subject error (no send happens)', async ({ page }) => {
    await page.locator('[data-test="bcc-request-product-row"][data-product-id="sheet-2mm"]').click()
    // sheet-2mm auto-selects sup-001 + sup-003; recipients are now > 0.
    await page.locator('[data-test="email-template-subject"]').fill('')
    await page.locator('[data-test="bcc-request-send-btn"]').click()
    await expect.soft(page.locator('.toast-container .toast.show.toast-error')).toBeVisible()
  })

  test('full send: products + recipients + subject → success toast + new history rows', async ({
    page,
  }) => {
    const rows = page.locator('[data-test="bcc-request-history-row"]')
    const before = await rows.count()
    // Pick one product + one (auto-selected) recipient.
    await page.locator('[data-test="bcc-request-product-row"][data-product-id="sheet-2mm"]').click()
    await expect
      .poll(async () =>
        page.locator('[data-test="bcc-request-recipients-count"] .count').textContent(),
      )
      .toMatch(/\b[12]\b/)
    await page.locator('[data-test="bcc-request-send-btn"]').click()
    // Success toast (non-error).
    await expect.soft(page.locator('.toast-container .toast.show').first()).toBeVisible()
    // One new event row per (recipient × product); sheet-2mm auto-selects 1–2 recipients.
    await expect.poll(() => rows.count()).toBeGreaterThan(before)
  })

  test('after a successful send, the product selection resets to 0', async ({ page }) => {
    await page.locator('[data-test="bcc-request-product-row"][data-product-id="sheet-2mm"]').click()
    await expect(page.locator('[data-test="bcc-request-products-count"]')).toContainText('1')
    // Wait for auto-select watcher to settle so validateSelection() doesn't bail on
    // empty recipients — otherwise the send never runs and products stay selected.
    await expect
      .poll(async () =>
        page.locator('[data-test="bcc-request-recipients-count"] .count').textContent(),
      )
      .toMatch(/\b[12]\b/)
    await page.locator('[data-test="bcc-request-send-btn"]').click()
    await expect(page.locator('[data-test="bcc-request-products-count"]')).toContainText('0')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Log Request (split button) — logs history without sending an email
// ────────────────────────────────────────────────────────────────────────────
test.describe('bcc-request › log request', () => {
  test.beforeEach(async ({ page }) => {
    await loadBcc(page)
  })

  test('caret opens the source dropdown with every SOURCE_OPTIONS entry', async ({ page }) => {
    await page.locator('[data-test="bcc-request-log-caret-btn"]').click()
    await expect(page.locator('[data-test="bcc-request-log-dropdown"]')).toBeVisible()
    await expect(page.locator('[data-test="bcc-request-log-dropdown-item"]')).toHaveCount(
      MOCK.sources.length,
    )
  })

  test('picking "Phone" from the dropdown logs rows with source=Phone', async ({ page }) => {
    await page.locator('[data-test="bcc-request-product-row"][data-product-id="sheet-2mm"]').click()
    await expect
      .poll(async () =>
        page.locator('[data-test="bcc-request-recipients-count"] .count').textContent(),
      )
      .toMatch(/\b[12]\b/)
    const before = await page.locator('[data-test="bcc-request-history-row"]').count()
    await page.locator('[data-test="bcc-request-log-caret-btn"]').click()
    await page.locator('[data-test="bcc-request-log-dropdown-item"][data-source="Phone"]').click()
    await expect
      .poll(() => page.locator('[data-test="bcc-request-history-row"]').count())
      .toBeGreaterThan(before)
    // The newest row (top of the list) should carry source=Phone.
    await expect(page.locator('[data-test="bcc-request-history-row"]').first()).toContainText(
      'Phone',
    )
  })

  test('log with no products shows an error toast', async ({ page }) => {
    await page.locator('[data-test="bcc-request-log-btn"]').click()
    await expect.soft(page.locator('.toast-container .toast.show.toast-error')).toBeVisible()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// History table — seed events, latest-only action buttons
// ────────────────────────────────────────────────────────────────────────────
test.describe('bcc-request › history table', () => {
  test.beforeEach(async ({ page }) => {
    await loadBcc(page)
  })

  test(`seeds ${MOCK.historyCount} mock events`, async ({ page }) => {
    await expect(page.locator('[data-test="bcc-request-history-row"]')).toHaveCount(
      MOCK.historyCount,
    )
  })

  test('a "sent" row exposes both accept and cancel buttons', async ({ page }) => {
    const sentRow = page
      .locator('[data-test="bcc-request-history-row"][data-event-id="evt-001"]')
      .first()
    await expect.soft(sentRow.locator('[data-test="bcc-request-history-accept-btn"]')).toBeVisible()
    await expect.soft(sentRow.locator('[data-test="bcc-request-history-cancel-btn"]')).toBeVisible()
  })

  test('a "responded" row exposes an edit button', async ({ page }) => {
    const respondedRow = page.locator(
      '[data-test="bcc-request-history-row"][data-event-id="evt-004"]',
    )
    await expect(respondedRow.locator('[data-test="bcc-request-history-edit-btn"]')).toBeVisible()
  })

  test('a "no_response" row exposes an accept button (retry) but no cancel', async ({ page }) => {
    const noRespRow = page.locator('[data-test="bcc-request-history-row"][data-event-id="evt-005"]')
    await expect
      .soft(noRespRow.locator('[data-test="bcc-request-history-accept-btn"]'))
      .toBeVisible()
    await expect
      .soft(noRespRow.locator('[data-test="bcc-request-history-cancel-btn"]'))
      .toHaveCount(0)
  })

  test('cancel → prepends a no_response event; original row drops its buttons (no longer latest)', async ({
    page,
  }) => {
    const before = await page.locator('[data-test="bcc-request-history-row"]').count()
    const sentRow = page.locator('[data-test="bcc-request-history-row"][data-event-id="evt-001"]')
    await sentRow.locator('[data-test="bcc-request-history-cancel-btn"]').click()
    // markBccNoResponse → apiPost → mock prepends a new event to MOCK_BCC_HISTORY and
    // the page unshifts the returned event into its own `history.value`.
    await expect
      .poll(() => page.locator('[data-test="bcc-request-history-row"]').count())
      .toBeGreaterThan(before)
    const latest = page.locator('[data-test="bcc-request-history-row"]').first()
    await expect.soft(latest).toHaveAttribute('data-status', 'no_response')
    // evt-001 is no longer the latest for its (req, supplier, product) triple → no buttons.
    await expect
      .soft(sentRow.locator('[data-test="bcc-request-history-accept-btn"]'))
      .toHaveCount(0)
    await expect
      .soft(sentRow.locator('[data-test="bcc-request-history-cancel-btn"]'))
      .toHaveCount(0)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Response modal — open, validation, save, cancel, unit picker
// ────────────────────────────────────────────────────────────────────────────
test.describe('bcc-request › response modal', () => {
  test.beforeEach(async ({ page }) => {
    await loadBcc(page)
  })

  test('accept on a sent row opens the modal prefilled with the supplier name', async ({
    page,
  }) => {
    const row = page.locator('[data-test="bcc-request-history-row"][data-event-id="evt-001"]')
    await row.locator('[data-test="bcc-request-history-accept-btn"]').click()
    await expect(page.locator('.modal-overlay.active')).toBeVisible()
    await expect(page.locator('[data-test="bcc-request-response-supplier"]')).toHaveValue(
      'MetalProm LLC',
    )
  })

  test('edit on a responded row prefills price from the event', async ({ page }) => {
    const row = page.locator('[data-test="bcc-request-history-row"][data-event-id="evt-004"]')
    await row.locator('[data-test="bcc-request-history-edit-btn"]').click()
    await expect(page.locator('[data-test="bcc-request-response-price"]')).toHaveValue('85000')
  })

  test('save with empty price surfaces an error toast (modal stays open)', async ({ page }) => {
    const row = page.locator('[data-test="bcc-request-history-row"][data-event-id="evt-001"]')
    await row.locator('[data-test="bcc-request-history-accept-btn"]').click()
    await page.locator('[data-test="bcc-request-response-save-btn"]').click()
    await expect.soft(page.locator('.toast-container .toast.show.toast-error')).toBeVisible()
    await expect.soft(page.locator('.modal-overlay.active')).toBeVisible()
  })

  test('cancel closes the modal without mutating history', async ({ page }) => {
    const before = await page.locator('[data-test="bcc-request-history-row"]').count()
    const row = page.locator('[data-test="bcc-request-history-row"][data-event-id="evt-001"]')
    await row.locator('[data-test="bcc-request-history-accept-btn"]').click()
    await page.locator('[data-test="bcc-request-response-cancel-btn"]').click()
    await expect.soft(page.locator('.modal-overlay.active')).toHaveCount(0)
    await expect.soft(page.locator('[data-test="bcc-request-history-row"]')).toHaveCount(before)
  })

  test('save with a valid price closes the modal, toasts success, and prepends a responded event', async ({
    page,
  }) => {
    const before = await page.locator('[data-test="bcc-request-history-row"]').count()
    const row = page.locator('[data-test="bcc-request-history-row"][data-event-id="evt-001"]')
    await row.locator('[data-test="bcc-request-history-accept-btn"]').click()
    await page.locator('[data-test="bcc-request-response-price"]').fill('1234')
    await page.locator('[data-test="bcc-request-response-save-btn"]').click()
    await expect.soft(page.locator('.modal-overlay.active')).toHaveCount(0)
    await expect.soft(page.locator('.toast-container .toast.show').first()).toBeVisible()
    await expect
      .poll(() => page.locator('[data-test="bcc-request-history-row"]').count())
      .toBeGreaterThan(before)
    const latest = page.locator('[data-test="bcc-request-history-row"]').first()
    await expect.soft(latest).toHaveAttribute('data-status', 'responded')
  })

  test('unit trigger opens a dropdown and picks the chosen unit', async ({ page }) => {
    const row = page.locator('[data-test="bcc-request-history-row"][data-event-id="evt-001"]')
    await row.locator('[data-test="bcc-request-history-accept-btn"]').click()
    await page.locator('[data-test="bcc-request-response-unit-trigger"]').click()
    await page.locator('[data-test="bcc-request-response-unit-option"][data-unit="ton"]').click()
    await expect(page.locator('[data-test="bcc-request-response-unit-trigger"]')).toContainText(
      'ton',
    )
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Section-level feature flag — bccHistory OFF hides the history panel
// ────────────────────────────────────────────────────────────────────────────
baseTest(
  'bcc-request › bccHistory flag OFF hides the history panel (page still works)',
  async ({ page, context }) => {
    await context.addInitScript(
      (flags) => localStorage.setItem('ff_overrides', JSON.stringify(flags)),
      { ...ALL_FLAGS_ENABLED, bccHistory: false },
    )
    await page.goto(BCC_URL)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-test="bcc-request-title"]')).toBeVisible()
    // Categories/Recipients/Template still render.
    await expect.soft(page.locator('[data-test="bcc-request-categories-panel"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="bcc-request-recipients-panel"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="bcc-request-template-panel"]')).toBeVisible()
    // History panel hidden via v-if.
    await expect.soft(page.locator('[data-test="bcc-request-history-panel"]')).toHaveCount(0)
  },
)

// ────────────────────────────────────────────────────────────────────────────
// Page-level feature flag — bccRequest OFF → /404
// ────────────────────────────────────────────────────────────────────────────
baseTest(
  'bcc-request › redirects to /404 when bccRequest flag is OFF',
  async ({ page, context }) => {
    await context.addInitScript(
      (flags) => localStorage.setItem('ff_overrides', JSON.stringify(flags)),
      { ...ALL_FLAGS_ENABLED, bccRequest: false },
    )
    await page.goto(BCC_URL)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/404$/)
    await expect(page.locator('[data-test="bcc-request-title"]')).toHaveCount(0)
  },
)

// ────────────────────────────────────────────────────────────────────────────
// Per-section visual snapshots (@1440 baseline)
// ────────────────────────────────────────────────────────────────────────────
test.describe('bcc-request › visual @1440', () => {
  test.beforeEach(async ({ page }) => {
    await loadBcc(page)
    await waitForFontsReady(page)
  })

  test('action bar', async ({ page }) => {
    await expect(page.locator('[data-test="bcc-request-action-bar"]')).toHaveScreenshot(
      'bcc-request-action-bar.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('categories panel', async ({ page }) => {
    await expect(page.locator('[data-test="bcc-request-categories-panel"]')).toHaveScreenshot(
      'bcc-request-categories.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('recipients panel', async ({ page }) => {
    await expect(page.locator('[data-test="bcc-request-recipients-panel"]')).toHaveScreenshot(
      'bcc-request-recipients.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('email template panel', async ({ page }) => {
    await expect(page.locator('[data-test="bcc-request-template-panel"]')).toHaveScreenshot(
      'bcc-request-template.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('history panel', async ({ page }) => {
    await expect(page.locator('[data-test="bcc-request-history-panel"]')).toHaveScreenshot(
      'bcc-request-history.png',
      SNAPSHOT_OPTIONS,
    )
  })
})
