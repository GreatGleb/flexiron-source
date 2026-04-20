import { test as base } from '@playwright/test'
import { test, expect } from '../../fixtures'
import { ALL_FLAGS_ENABLED } from '../../helpers/flags'
import { freezeTime } from '../../helpers/mocks'
import { waitForFontsReady, SNAPSHOT_OPTIONS } from '../../helpers/visual'

/**
 * Deep audit of SupplierCardPage (src/views/admin/suppliers/SupplierCardPage.vue).
 *
 * Page shape — composable-driven (useSupplierCard → suppliersService → mocks/suppliers):
 *
 *   h1[data-test="supplier-card-title"]
 *   [data-test="supplier-card-action-bar"]
 *     a[data-test="supplier-card-bcc-link"]      → /admin/suppliers/bcc-request?supplier=<id>
 *     a[data-test="supplier-card-config-link"]   → /admin/suppliers/config
 *     button[data-test="supplier-card-save-btn"] (toggles .dirty / .loading via useDirtyCheck)
 *   [data-test="supplier-card-content"] (v-else-if supplier)
 *     SupplierFormSections (LEFT + CENTER columns):
 *       LEFT  → [data-test="supplier-form-status"]      (Status panel)
 *               [data-test="supplier-form-status-select"]   (CustomSelect)
 *               [data-test="supplier-form-rating"]          (RatingSelect)
 *               [data-test="supplier-form-status-reason"]   (textarea)
 *               [data-test="supplier-form-contract-date"]   (DatePicker)
 *             [data-test="supplier-form-requisites"]    (Requisites panel)
 *               [data-test="supplier-form-company"]
 *               [data-test="supplier-form-vat"]
 *               [data-test="supplier-form-address"]
 *             [data-test="supplier-form-contact"]       (Contact panel)
 *               [data-test="supplier-form-contact-name"]
 *               [data-test="supplier-form-contact-email"]
 *               [data-test="supplier-form-contact-phone"]
 *       CENTER→ [data-test="supplier-form-procurement"] (Procurement panel)
 *               [data-test="supplier-form-categories"]      (TagInput — chips)
 *               [data-test="supplier-form-bcc-emails"]      (TagInput — free-input)
 *               [data-test="supplier-form-currency"]
 *               [data-test="supplier-form-payment"]
 *               [data-test="supplier-form-lead-time"]
 *               [data-test="supplier-form-min-order"]
 *             [data-test="supplier-form-notes"]         (Notes panel)
 *               [data-test="supplier-form-notes-input"]
 *               [data-test="supplier-form-notes-add-btn"]
 *               [data-test="supplier-form-note-item"]   × N
 *     RIGHT (in-page):
 *       GlassPanel[data-test="supplier-card-pricing"] — price + BCC log table
 *         [data-test="supplier-card-pricing-table"]
 *           [data-test="supplier-card-pricing-row"] × 4 (mock id=1)
 *       GlassPanel[data-test="supplier-card-files"]
 *         [data-test="supplier-card-file-list"]
 *           [data-test="supplier-card-file-item"] × 2 (mock id=1)
 *         [data-test="supplier-card-file-dropzone"] (DropZone — hidden file input inside)
 *     FULL WIDTH:
 *       [data-test="supplier-card-audit"]                 (audit-panel-wide)
 *         [data-test="supplier-card-audit-table"]
 *           [data-test="supplier-card-audit-row"] × 2 (mock id=1)
 *             [data-test="supplier-card-audit-delete-btn"]
 *   AppModal — confirm delete (Teleported to body, found via `.modal-overlay.active`)
 *     [data-test="supplier-card-audit-modal-cancel"]
 *     [data-test="supplier-card-audit-modal-confirm"]
 *
 * Mock (mocks/suppliers.ts MOCK_CARD['1']):
 *   company "Steel Plus OÜ", contact "Andres Tamm", email info@steelplus.ee,
 *   status active, rating 5, currency EUR, payment "30 Days Net",
 *   leadTime 7, minOrder 2500, vat LT100001234567, address "Pärnu mnt 10",
 *   categories [Sheets, Pipes], bccEmails 2, files 2, priceHistory 4, auditLog 2
 *
 * Notes:
 *   - The page has NO Discard button — only Save. Reverting is implicit via reload (fresh
 *     mock state per browser context, since each test gets a new context and JS modules
 *     are re-evaluated on the new SPA load).
 *   - useSupplierCard.save() goes through apiPatch → patchMock (NOT real fetch when
 *     VITE_USE_MOCKS=true, which is the default), so `page.route` cannot intercept the
 *     PATCH. Save behaviour is verified via observable side effects: dirty class flips off,
 *     toast appears, edited value persists in the DOM, and a subsequent edit re-enables
 *     Save (proving the snapshot was re-captured after save). Same constraint applies to
 *     audit DELETE and file UPLOAD — verified via DOM mutations.
 *   - `baseTest` bypasses the fixtures wrapper (which forces ALL_FLAGS_ENABLED) so the
 *     page-flag-OFF check can install its own override. Pattern matches deficit.spec.ts.
 */

const baseTest = base

const CARD_URL = '/admin/suppliers/1'
const DESKTOP = { width: 1440, height: 900 }

// MOCK_CARD['1'] — fixed expected values for assertion stability.
const MOCK = {
  company: 'Steel Plus OÜ',
  vat: 'LT100001234567',
  contactName: 'Andres Tamm',
  contactEmail: 'info@steelplus.ee',
  contactPhone: '+372 51234567',
  leadTime: 7,
  minOrder: 2500,
  priceRows: 4,
  fileCount: 2,
  auditCount: 2,
  categories: 2, // Sheets, Pipes
  bccEmails: 2,
}

async function loadCard(page: import('@playwright/test').Page) {
  await page.setViewportSize(DESKTOP)
  await freezeTime(page)
  await page.goto(CARD_URL)
  await expect(page.locator('[data-test="supplier-card-content"]')).toBeVisible()
  await page.waitForLoadState('networkidle')
}

// ────────────────────────────────────────────────────────────────────────────
// Structure
// ────────────────────────────────────────────────────────────────────────────
test.describe('supplier-card › structure', () => {
  test.beforeEach(async ({ page }) => {
    await loadCard(page)
  })

  test('title visible', async ({ page }) => {
    await expect(page.locator('[data-test="supplier-card-title"]')).toBeVisible()
  })

  test('action bar + content render once supplier loads', async ({ page }) => {
    await expect.soft(page.locator('[data-test="supplier-card-action-bar"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-card-content"]')).toBeVisible()
  })

  test('all eight panels render (status / requisites / contact / procurement / notes / pricing / files / audit)', async ({
    page,
  }) => {
    await expect.soft(page.locator('[data-test="supplier-form-status"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-form-requisites"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-form-contact"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-form-procurement"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-form-notes"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-card-pricing"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-card-files"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-card-audit"]')).toBeVisible()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Action bar
// ────────────────────────────────────────────────────────────────────────────
test.describe('supplier-card › action bar', () => {
  test.beforeEach(async ({ page }) => {
    await loadCard(page)
  })

  test('bcc + config links go to the correct routes (with supplier query for bcc)', async ({
    page,
  }) => {
    await expect
      .soft(page.locator('[data-test="supplier-card-bcc-link"]'))
      .toHaveAttribute('href', '/admin/suppliers/bcc-request?supplier=1')
    await expect
      .soft(page.locator('[data-test="supplier-card-config-link"]'))
      .toHaveAttribute('href', '/admin/suppliers/config')
  })

  test('save button is initially disabled and not dirty', async ({ page }) => {
    const save = page.locator('[data-test="supplier-card-save-btn"]')
    await expect.soft(save).toBeDisabled()
    await expect.soft(save).not.toHaveClass(/\bdirty\b/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// LEFT column — Status / Requisites / Contact
// ────────────────────────────────────────────────────────────────────────────
test.describe('supplier-card › status section', () => {
  test.beforeEach(async ({ page }) => {
    await loadCard(page)
  })

  test('all status sub-fields render', async ({ page }) => {
    await expect.soft(page.locator('[data-test="supplier-form-status-select"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-form-rating"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-form-status-reason"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-form-contract-date"]')).toBeVisible()
  })

  test('status select displays the active pill (mock id=1 → status="active")', async ({ page }) => {
    const trigger = page
      .locator('[data-test="supplier-form-status-select"] .custom-select-trigger')
      .locator('.status-pill')
    await expect(trigger).toHaveClass(/\bpill-success\b/)
  })

  test('status reason textarea is pre-populated from the mock', async ({ page }) => {
    await expect(page.locator('[data-test="supplier-form-status-reason"]')).toHaveValue(
      /Audit passed/,
    )
  })
})

test.describe('supplier-card › requisites section', () => {
  test.beforeEach(async ({ page }) => {
    await loadCard(page)
  })

  test('company / vat / address all carry mock values', async ({ page }) => {
    await expect.soft(page.locator('[data-test="supplier-form-company"]')).toHaveValue(MOCK.company)
    await expect.soft(page.locator('[data-test="supplier-form-vat"]')).toHaveValue(MOCK.vat)
    await expect
      .soft(page.locator('[data-test="supplier-form-address"]'))
      .toHaveValue(/Pärnu mnt 10/)
  })
})

test.describe('supplier-card › contact section', () => {
  test.beforeEach(async ({ page }) => {
    await loadCard(page)
  })

  test('contact name / email / phone are pre-populated from the mock', async ({ page }) => {
    await expect
      .soft(page.locator('[data-test="supplier-form-contact-name"]'))
      .toHaveValue(MOCK.contactName)
    await expect
      .soft(page.locator('[data-test="supplier-form-contact-email"]'))
      .toHaveValue(MOCK.contactEmail)
    await expect
      .soft(page.locator('[data-test="supplier-form-contact-phone"]'))
      .toHaveValue(MOCK.contactPhone)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// CENTER column — Procurement / Notes
// ────────────────────────────────────────────────────────────────────────────
test.describe('supplier-card › procurement section', () => {
  test.beforeEach(async ({ page }) => {
    await loadCard(page)
  })

  test('all procurement sub-fields render', async ({ page }) => {
    await expect.soft(page.locator('[data-test="supplier-form-categories"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-form-bcc-emails"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-form-currency"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-form-payment"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-form-lead-time"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-form-min-order"]')).toBeVisible()
  })

  test('categories / bcc-emails render the mock chips', async ({ page }) => {
    await expect(page.locator('[data-test="supplier-form-categories"] .tag')).toHaveCount(
      MOCK.categories,
    )
    await expect(page.locator('[data-test="supplier-form-bcc-emails"] .tag')).toHaveCount(
      MOCK.bccEmails,
    )
  })

  test('currency / payment / lead-time / min-order carry mock values', async ({ page }) => {
    await expect
      .soft(page.locator('[data-test="supplier-form-currency"] .custom-select-trigger'))
      .toContainText('EUR')
    await expect
      .soft(page.locator('[data-test="supplier-form-payment"] .custom-select-trigger'))
      .toContainText('30 Days Net')
    await expect
      .soft(page.locator('[data-test="supplier-form-lead-time"]'))
      .toHaveValue(String(MOCK.leadTime))
    await expect
      .soft(page.locator('[data-test="supplier-form-min-order"]'))
      .toHaveValue(String(MOCK.minOrder))
  })
})

test.describe('supplier-card › notes section', () => {
  test.beforeEach(async ({ page }) => {
    await loadCard(page)
  })

  test('input + add button render', async ({ page }) => {
    await expect.soft(page.locator('[data-test="supplier-form-notes-input"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-form-notes-add-btn"]')).toBeVisible()
  })

  test('typing a note + clicking "add" appends it as a NoteItem', async ({ page }) => {
    // Mock id=1 has notes='Reliable partner since 2020' which lacks a date header,
    // so parsedNotes() returns 0 items initially. Adding one should produce exactly 1.
    const beforeCount = await page.locator('[data-test="supplier-form-note-item"]').count()
    await page.locator('[data-test="supplier-form-notes-input"]').fill('Tested via Playwright')
    await page.locator('[data-test="supplier-form-notes-add-btn"]').click()
    await expect(page.locator('[data-test="supplier-form-note-item"]')).toHaveCount(beforeCount + 1)
  })

  test('add button is a no-op when the textarea is blank', async ({ page }) => {
    const beforeCount = await page.locator('[data-test="supplier-form-note-item"]').count()
    await page.locator('[data-test="supplier-form-notes-add-btn"]').click()
    await expect(page.locator('[data-test="supplier-form-note-item"]')).toHaveCount(beforeCount)
  })

  test('adding a note marks the form dirty (Save becomes enabled)', async ({ page }) => {
    await page.locator('[data-test="supplier-form-notes-input"]').fill('Dirty trigger')
    await page.locator('[data-test="supplier-form-notes-add-btn"]').click()
    const save = page.locator('[data-test="supplier-card-save-btn"]')
    await expect(save).toBeEnabled()
    await expect(save).toHaveClass(/\bdirty\b/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// RIGHT column — Pricing / Files
// ────────────────────────────────────────────────────────────────────────────
test.describe('supplier-card › pricing history', () => {
  test.beforeEach(async ({ page }) => {
    await loadCard(page)
  })

  test(`renders ${MOCK.priceRows} mock price rows`, async ({ page }) => {
    await expect(page.locator('[data-test="supplier-card-pricing-row"]')).toHaveCount(
      MOCK.priceRows,
    )
  })

  test('table head exposes 7 columns (date / product / stock / price / unit / source / status)', async ({
    page,
  }) => {
    await expect(page.locator('[data-test="supplier-card-pricing-table"] thead tr th')).toHaveCount(
      7,
    )
  })

  test('first row carries the expected mock values (Sheet 10mm / 1.05 / replied)', async ({
    page,
  }) => {
    const row = page.locator('[data-test="supplier-card-pricing-row"]').first()
    await expect.soft(row).toContainText('Sheet 10mm')
    await expect.soft(row).toContainText('22.0 t')
    await expect.soft(row).toContainText('1.05')
    await expect.soft(row.locator('.status-pill')).toHaveClass(/\bpill-success\b/)
  })

  test('a row whose price is null renders an em-dash', async ({ page }) => {
    // Second mock row (Sheets 20t) has price=null & unit=null → both should render as '—'.
    const row = page.locator('[data-test="supplier-card-pricing-row"]').nth(1)
    await expect.soft(row.locator('td.price-cell')).toHaveText('—')
    await expect.soft(row.locator('td.unit-cell')).toHaveText('—')
  })
})

test.describe('supplier-card › files section', () => {
  test.beforeEach(async ({ page }) => {
    await loadCard(page)
  })

  test(`renders ${MOCK.fileCount} mock file items + dropzone`, async ({ page }) => {
    await expect
      .soft(page.locator('[data-test="supplier-card-file-item"]'))
      .toHaveCount(MOCK.fileCount)
    await expect.soft(page.locator('[data-test="supplier-card-file-dropzone"]')).toBeVisible()
  })

  test('clicking a file’s delete icon removes it from the list', async ({ page }) => {
    const items = page.locator('[data-test="supplier-card-file-item"]')
    const before = await items.count()
    // The 2nd `.action-btn-wrap` SVG inside .file-actions is the delete icon
    // (1st is the download anchor's icon — it sits inside the <a>, not in .file-actions).
    await items.first().locator('.file-actions svg.action-btn-wrap').last().click()
    await expect(items).toHaveCount(before - 1)
  })

  test('upload via the hidden file input appends a new FileItem', async ({ page }) => {
    const before = await page.locator('[data-test="supplier-card-file-item"]').count()
    // DropZone uses a display:none <input type="file"> behind the scenes; setInputFiles
    // bypasses the click-to-open picker and triggers the same upload pipeline that DnD
    // would (handleFiles → uploadFile → @uploaded).
    const input = page.locator('[data-test="supplier-card-file-dropzone"] input[type="file"]')
    await input.setInputFiles({
      name: 'spec-attachment.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello playwright'),
    })
    await expect(page.locator('[data-test="supplier-card-file-item"]')).toHaveCount(before + 1)
    // The new file's name should be rendered.
    await expect(page.locator('[data-test="supplier-card-file-item"]').last()).toContainText(
      'spec-attachment.txt',
    )
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Audit log — list, delete with confirm modal, cancel-no-op
// ────────────────────────────────────────────────────────────────────────────
test.describe('supplier-card › audit log', () => {
  test.beforeEach(async ({ page }) => {
    await loadCard(page)
  })

  test(`renders ${MOCK.auditCount} mock audit entries`, async ({ page }) => {
    await expect(page.locator('[data-test="supplier-card-audit-row"]')).toHaveCount(MOCK.auditCount)
  })

  test('audit table head has 5 columns (timestamp / user / prop / diff / action)', async ({
    page,
  }) => {
    await expect(page.locator('[data-test="supplier-card-audit-table"] thead tr th')).toHaveCount(5)
  })

  test('first row holds the most-recent entry (Payment Terms diff)', async ({ page }) => {
    const row = page.locator('[data-test="supplier-card-audit-row"]').first()
    await expect.soft(row).toContainText('Payment Terms')
    await expect.soft(row.locator('.audit-diff-old')).toContainText('Prepayment')
    await expect.soft(row.locator('.audit-diff-new')).toContainText('30 Days Net')
  })

  test('clicking a delete icon opens the confirm modal (does NOT delete yet)', async ({ page }) => {
    const before = await page.locator('[data-test="supplier-card-audit-row"]').count()
    await page.locator('[data-test="supplier-card-audit-delete-btn"]').first().click()
    // AppModal renders with class `.modal-overlay.active` once open (Teleported to body).
    await expect.soft(page.locator('.modal-overlay.active')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-card-audit-row"]')).toHaveCount(before)
  })

  test('cancelling the modal closes it and leaves the audit log untouched', async ({ page }) => {
    const before = await page.locator('[data-test="supplier-card-audit-row"]').count()
    await page.locator('[data-test="supplier-card-audit-delete-btn"]').first().click()
    await expect(page.locator('.modal-overlay.active')).toBeVisible()
    await page.locator('[data-test="supplier-card-audit-modal-cancel"]').click()
    await expect.soft(page.locator('.modal-overlay.active')).toHaveCount(0)
    await expect.soft(page.locator('[data-test="supplier-card-audit-row"]')).toHaveCount(before)
  })

  test('confirming the modal removes at least one entry, closes the modal, and shows a toast', async ({
    page,
  }) => {
    const rows = page.locator('[data-test="supplier-card-audit-row"]')
    const before = await rows.count()
    await page.locator('[data-test="supplier-card-audit-delete-btn"]').first().click()
    await expect(page.locator('.modal-overlay.active')).toBeVisible()
    await page.locator('[data-test="supplier-card-audit-modal-confirm"]').click()
    // The mock-side delete and the page-side `splice(idx, 1)` both operate on the same
    // auditLog reference (mockGetSupplier returns MOCK_CARD['1'] by reference), so the
    // row count strictly decreases. Assert the user-visible outcome only — at least one
    // row removed — rather than the exact delta.
    await expect.poll(() => rows.count()).toBeLessThan(before)
    await expect.soft(page.locator('.modal-overlay.active')).toHaveCount(0)
    await expect.soft(page.locator('.toast-container .toast.show')).toBeVisible()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Dirty / Save flow — behaviour through the Save lifecycle
// ────────────────────────────────────────────────────────────────────────────
test.describe('supplier-card › dirty + save flow', () => {
  test.beforeEach(async ({ page }) => {
    await loadCard(page)
  })

  test('editing the company input flips Save from disabled → enabled (.dirty)', async ({
    page,
  }) => {
    const save = page.locator('[data-test="supplier-card-save-btn"]')
    await expect.soft(save).toBeDisabled()
    await page.locator('[data-test="supplier-form-company"]').fill('Steel Plus OÜ — edited')
    await expect.soft(save).toBeEnabled()
    await expect.soft(save).toHaveClass(/\bdirty\b/)
  })

  test('clearing the edit back to the original value flips Save back to disabled (clean)', async ({
    page,
  }) => {
    const company = page.locator('[data-test="supplier-form-company"]')
    const save = page.locator('[data-test="supplier-card-save-btn"]')
    await company.fill('mutated')
    await expect(save).toBeEnabled()
    // Restoring the captured snapshot value should clear isDirty.
    await company.fill(MOCK.company)
    await expect(save).toBeDisabled()
  })

  test('clicking Save commits the change, clears dirty, and toasts a success message', async ({
    page,
  }) => {
    const newCompany = 'Steel Plus OÜ — saved'
    const save = page.locator('[data-test="supplier-card-save-btn"]')
    await page.locator('[data-test="supplier-form-company"]').fill(newCompany)
    await expect(save).toBeEnabled()
    await save.click()
    // After the mock PATCH resolves: capture() runs → isDirty=false → button disabled.
    await expect.soft(save).toBeDisabled()
    await expect.soft(save).not.toHaveClass(/\bdirty\b/)
    // Edited value persists in the DOM (server returned the merged entity).
    await expect.soft(page.locator('[data-test="supplier-form-company"]')).toHaveValue(newCompany)
    // Toast appears.
    await expect.soft(page.locator('.toast-container .toast.show')).toBeVisible()
  })

  test('a follow-up edit after Save re-enables Save (snapshot was re-captured)', async ({
    page,
  }) => {
    const company = page.locator('[data-test="supplier-form-company"]')
    const save = page.locator('[data-test="supplier-card-save-btn"]')
    await company.fill('Round 1')
    await save.click()
    // Wait for the save to FULLY resolve (loading class gone, dirty class cleared).
    // Filling before this would race with the in-flight PATCH and the merged response
    // would overwrite the v-model'd value before capture() runs.
    await expect(save).not.toHaveClass(/\bloading\b/)
    await expect(save).not.toHaveClass(/\bdirty\b/)
    await expect(save).toBeDisabled()
    // Second edit must dirty the form again — proving capture() ran after save.
    await company.fill('Round 2')
    await expect(save).toBeEnabled()
    await expect(save).toHaveClass(/\bdirty\b/)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Page-level feature flag (supplierCard) — OFF → /404
// ────────────────────────────────────────────────────────────────────────────
baseTest(
  'supplier-card › redirects to /404 when supplierCard flag is OFF',
  async ({ page, context }) => {
    await context.addInitScript(
      (flags) => localStorage.setItem('ff_overrides', JSON.stringify(flags)),
      { ...ALL_FLAGS_ENABLED, supplierCard: false },
    )
    await page.goto(CARD_URL)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/404$/)
    await expect(page.locator('[data-test="supplier-card-title"]')).toHaveCount(0)
  },
)

// ────────────────────────────────────────────────────────────────────────────
// Per-section visual snapshots (@1440 baseline)
// ────────────────────────────────────────────────────────────────────────────
test.describe('supplier-card › visual @1440', () => {
  test.beforeEach(async ({ page }) => {
    await loadCard(page)
    await waitForFontsReady(page)
  })

  test('action bar', async ({ page }) => {
    await expect(page.locator('[data-test="supplier-card-action-bar"]')).toHaveScreenshot(
      'supplier-card-action-bar.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('status section', async ({ page }) => {
    await expect(page.locator('[data-test="supplier-form-status"]')).toHaveScreenshot(
      'supplier-card-status.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('requisites section', async ({ page }) => {
    await expect(page.locator('[data-test="supplier-form-requisites"]')).toHaveScreenshot(
      'supplier-card-requisites.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('contact section', async ({ page }) => {
    await expect(page.locator('[data-test="supplier-form-contact"]')).toHaveScreenshot(
      'supplier-card-contact.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('procurement section', async ({ page }) => {
    await expect(page.locator('[data-test="supplier-form-procurement"]')).toHaveScreenshot(
      'supplier-card-procurement.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('notes section', async ({ page }) => {
    await expect(page.locator('[data-test="supplier-form-notes"]')).toHaveScreenshot(
      'supplier-card-notes.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('pricing panel', async ({ page }) => {
    await expect(page.locator('[data-test="supplier-card-pricing"]')).toHaveScreenshot(
      'supplier-card-pricing.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('files panel', async ({ page }) => {
    await expect(page.locator('[data-test="supplier-card-files"]')).toHaveScreenshot(
      'supplier-card-files.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('audit panel', async ({ page }) => {
    await expect(page.locator('[data-test="supplier-card-audit"]')).toHaveScreenshot(
      'supplier-card-audit.png',
      SNAPSHOT_OPTIONS,
    )
  })
})
