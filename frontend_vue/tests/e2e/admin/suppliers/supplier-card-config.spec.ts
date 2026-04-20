import { test as base } from '@playwright/test'
import { test, expect } from '../../fixtures'
import { ALL_FLAGS_ENABLED } from '../../helpers/flags'
import { freezeTime } from '../../helpers/mocks'
import { waitForFontsReady, SNAPSHOT_OPTIONS } from '../../helpers/visual'

/**
 * Deep audit of SupplierCardConfigPage (src/views/admin/suppliers/SupplierCardConfigPage.vue).
 *
 * Page shape — composable-driven (useCardConfig → configService → mocks/config):
 *
 *   h1[data-test="supplier-card-config-title"]
 *   [data-test="supplier-card-config-action-bar"]
 *     button[data-test="supplier-card-config-save-btn"]            → saveConfig() (3× parallel PUT)
 *   [data-test="supplier-card-config-grid"]
 *     [data-test="supplier-card-config-library"] (LEFT COL)
 *       button[data-test="supplier-card-config-library-new-btn"]   → newFieldOpen modal
 *       input[data-test="supplier-card-config-library-search"]     (v-model fieldSearch)
 *       [data-test="supplier-card-config-library-list"]
 *         [data-test="field-library-item"] × 12 (mock)
 *           [data-test="field-library-item-delete-btn"]            (only when isCustomField)
 *     [data-test="supplier-card-config-builder"] (RIGHT COL)
 *       button[data-test="supplier-card-config-builder-add-btn"]   → addSectionOpen modal
 *       [data-test="supplier-card-config-builder-list"]
 *         [data-test="supplier-card-config-section-wrapper"] × N (drop-target for onSectionDrop)
 *           [data-test="config-section-card"][data-section-id]
 *             [data-test="config-section-card-name"]
 *             [data-test="config-section-card-collapse-btn"]
 *             [data-test="config-section-card-field-count"]
 *             [data-test="config-section-card-add-field-btn"]      → addFieldOpen modal
 *             [data-test="config-section-card-edit-btn"]           → editSectionOpen modal
 *             [data-test="config-section-card-hide-btn"]           → toggleSectionVisibility
 *             [data-test="config-section-card-delete-btn"]         (disabled on system sections)
 *             slot-fields → [data-test="field-library-item"] × section.fields.length
 *   [data-test="supplier-card-config-permissions"] (permissionsEditor flag gated)
 *     table[data-test="supplier-card-config-permissions-table"]
 *       tr[data-test="supplier-card-config-permissions-row"] × 17 (5 sections + 12 fields)
 *         [data-item-id], [data-item-type], [data-parent-id]
 *         td[data-test="supplier-card-config-permissions-cell"][data-role] × 4 (4 roles)
 *           label[data-test="supplier-card-config-perm-role-checkbox"][data-action] × 4 (r/e/c/d)
 *           button[data-test="supplier-card-config-perm-expand-btn"]
 *           [data-test="supplier-card-config-perm-users-list"] (v-if isExpanded)
 *             [data-test="supplier-card-config-perm-user-row"][data-user]
 *               label[data-test="supplier-card-config-perm-user-checkbox"][data-action]
 *   AppModal (Teleported to body, found via `.modal-overlay.active`)
 *     [data-test="supplier-card-config-modal-new-field"]
 *     [data-test="supplier-card-config-modal-add-section"]
 *     [data-test="supplier-card-config-modal-edit-section"]
 *     [data-test="supplier-card-config-modal-add-field"]
 *     [data-test="supplier-card-config-modal-delete-section"]
 *     [data-test="supplier-card-config-modal-delete-field"]
 *     [data-test="supplier-card-config-modal-remove-field"]
 *
 * Mock (mocks/config.ts):
 *   12 field library items (system — no delete). 5 system sections:
 *     General Info (4 fields), Contacts (2), Location (2), Logistics (2), Notes & Docs (2)
 *   4 roles (Admin/Sales/Warehouse/Accounting). Admin defaults to all-checked, the rest
 *   default to all-unchecked. Permission matrix: 5 section rows + 12 field rows = 17 rows.
 *
 * Save flow — the composable triggers 3 parallel PUTs:
 *   PUT /api/config/fields       (saveFieldLibrary)
 *   PUT /api/config/sections     (saveSections)
 *   PUT /api/config/permissions  (savePermissions)
 *   When VITE_USE_MOCKS=true (default), apiPut → putMock → mockSaveX; `page.route` will
 *   NOT intercept. Save is verified through observable side effects: success toast shows,
 *   and edits survive an in-SPA navigation (sidebar router-link, not page.goto — goto
 *   forces a full reload which re-evaluates the mock modules and resets state).
 *
 * `baseTest` bypasses the fixtures wrapper (which forces ALL_FLAGS_ENABLED) so the
 * flag-OFF checks can install their own overrides. Pattern matches supplier-card.spec.ts.
 *
 * NOTE ON DRAG-DROP: the page implements drag-reorder for sections only (native HTML5
 * drag events on the builder wrappers — onSectionDragStart/onSectionDrop/moveSection).
 * Dropping library fields onto sections is NOT implemented; "Add field to section" goes
 * through the + button → modal → confirmAddField path. Tests cover the section-reorder
 * drag and the button-based add-field flow.
 */

const baseTest = base

const CONFIG_URL = '/admin/suppliers/config'
const DESKTOP = { width: 1440, height: 900 }

const MOCK = {
  fieldCount: 12,
  sectionCount: 5,
  permissionRows: 5 + 12, // 5 section rows + 12 field rows
  roles: ['Admin', 'Sales', 'Warehouse', 'Accounting'] as const,
  sectionIds: [
    'sec-general',
    'sec-contacts',
    'sec-location',
    'sec-logistics',
    'sec-notes',
  ] as const,
  generalFieldCount: 4,
}

async function loadConfig(page: import('@playwright/test').Page) {
  await page.setViewportSize(DESKTOP)
  await freezeTime(page)
  await page.goto(CONFIG_URL)
  await expect(page.locator('[data-test="supplier-card-config-title"]')).toBeVisible()
  await page.waitForLoadState('networkidle')
}

// ────────────────────────────────────────────────────────────────────────────
// Structure — all three panels + action bar render once load() completes
// ────────────────────────────────────────────────────────────────────────────
test.describe('supplier-card-config › structure', () => {
  test.beforeEach(async ({ page }) => {
    await loadConfig(page)
  })

  test('title + action bar + grid + permissions panel render', async ({ page }) => {
    await expect.soft(page.locator('[data-test="supplier-card-config-title"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-card-config-action-bar"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-card-config-grid"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-card-config-library"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-card-config-builder"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-card-config-permissions"]')).toBeVisible()
  })

  test('save button is enabled by default (config page has no dirty-check gating)', async ({
    page,
  }) => {
    await expect(page.locator('[data-test="supplier-card-config-save-btn"]')).toBeEnabled()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Global Field Library
// ────────────────────────────────────────────────────────────────────────────
test.describe('supplier-card-config › field library', () => {
  test.beforeEach(async ({ page }) => {
    await loadConfig(page)
  })

  test(`renders ${MOCK.fieldCount} mock field-library items`, async ({ page }) => {
    await expect(
      page.locator(
        '[data-test="supplier-card-config-library-list"] [data-test="field-library-item"]',
      ),
    ).toHaveCount(MOCK.fieldCount)
  })

  test('search filters the list by name (case-insensitive substring)', async ({ page }) => {
    const list = page.locator(
      '[data-test="supplier-card-config-library-list"] [data-test="field-library-item"]',
    )
    await page.locator('[data-test="supplier-card-config-library-search"]').fill('email')
    await expect(list).toHaveCount(1)
    await expect(list.first()).toContainText('Email')
  })

  test('clearing the search restores the full list', async ({ page }) => {
    const search = page.locator('[data-test="supplier-card-config-library-search"]')
    const list = page.locator(
      '[data-test="supplier-card-config-library-list"] [data-test="field-library-item"]',
    )
    await search.fill('zzzz-no-match')
    await expect(list).toHaveCount(0)
    await search.fill('')
    await expect(list).toHaveCount(MOCK.fieldCount)
  })

  test('system fields in the library expose NO delete button (only custom fields are deletable)', async ({
    page,
  }) => {
    // All 12 seed fields have ids like f-company, f-email etc. — none match /^f-custom-/.
    await expect(
      page.locator(
        '[data-test="supplier-card-config-library-list"] [data-test="field-library-item-delete-btn"]',
      ),
    ).toHaveCount(0)
  })

  test('creating a new library field via the modal appends a custom item with a delete button', async ({
    page,
  }) => {
    const libItems = page.locator(
      '[data-test="supplier-card-config-library-list"] [data-test="field-library-item"]',
    )
    await expect(libItems).toHaveCount(MOCK.fieldCount)
    await page.locator('[data-test="supplier-card-config-library-new-btn"]').click()
    await expect(page.locator('.modal-overlay.active')).toBeVisible()
    await page
      .locator('[data-test="supplier-card-config-modal-new-field-name"]')
      .fill('Playwright Field')
    await page.locator('[data-test="supplier-card-config-modal-new-field-confirm"]').click()
    await expect(libItems).toHaveCount(MOCK.fieldCount + 1)
    // The new (custom) item must expose the delete button — createField() uses the
    // `f-custom-${Date.now()}` id prefix which isCustomField() detects.
    await expect(
      page.locator(
        '[data-test="supplier-card-config-library-list"] [data-test="field-library-item-delete-btn"]',
      ),
    ).toHaveCount(1)
  })

  test('creating with a blank name surfaces an error toast and does NOT append', async ({
    page,
  }) => {
    const libItems = page.locator(
      '[data-test="supplier-card-config-library-list"] [data-test="field-library-item"]',
    )
    await page.locator('[data-test="supplier-card-config-library-new-btn"]').click()
    await page.locator('[data-test="supplier-card-config-modal-new-field-confirm"]').click()
    await expect.soft(page.locator('.toast-container .toast.show.toast-error')).toBeVisible()
    await expect.soft(libItems).toHaveCount(MOCK.fieldCount)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Sections editor — render, collapse, hide, system-not-deletable, CRUD via modals
// ────────────────────────────────────────────────────────────────────────────
test.describe('supplier-card-config › sections editor', () => {
  test.beforeEach(async ({ page }) => {
    await loadConfig(page)
  })

  test(`renders ${MOCK.sectionCount} mock sections in the builder`, async ({ page }) => {
    await expect(
      page.locator(
        '[data-test="supplier-card-config-builder-list"] [data-test="config-section-card"]',
      ),
    ).toHaveCount(MOCK.sectionCount)
  })

  test('General Info section renders its name + 4-field count from the mock', async ({ page }) => {
    const general = page.locator('[data-test="config-section-card"][data-section-id="sec-general"]')
    await expect
      .soft(general.locator('[data-test="config-section-card-name"]'))
      .toHaveText('General Info')
    await expect
      .soft(general.locator('[data-test="config-section-card-field-count"]'))
      .toContainText(String(MOCK.generalFieldCount))
  })

  test('collapse button toggles .collapsed on the section card', async ({ page }) => {
    const general = page.locator('[data-test="config-section-card"][data-section-id="sec-general"]')
    // MOCK_SECTIONS.sec-general has collapsed=false.
    await expect(general).not.toHaveClass(/\bcollapsed\b/)
    await general.locator('[data-test="config-section-card-collapse-btn"]').click()
    await expect(general).toHaveClass(/\bcollapsed\b/)
    await general.locator('[data-test="config-section-card-collapse-btn"]').click()
    await expect(general).not.toHaveClass(/\bcollapsed\b/)
  })

  test('hide button toggles .is-hidden on the section card', async ({ page }) => {
    const general = page.locator('[data-test="config-section-card"][data-section-id="sec-general"]')
    await expect(general).not.toHaveClass(/\bis-hidden\b/)
    await general.locator('[data-test="config-section-card-hide-btn"]').click()
    await expect(general).toHaveClass(/\bis-hidden\b/)
  })

  test('system section delete button is disabled (all 5 mock sections are system=true)', async ({
    page,
  }) => {
    const deleteBtns = page.locator(
      '[data-test="supplier-card-config-builder-list"] [data-test="config-section-card-delete-btn"]',
    )
    await expect(deleteBtns).toHaveCount(MOCK.sectionCount)
    for (let i = 0; i < MOCK.sectionCount; i++) {
      await expect.soft(deleteBtns.nth(i)).toBeDisabled()
    }
  })

  test('section field slot renders the section fields as field-library-items', async ({ page }) => {
    const generalFields = page
      .locator('[data-test="config-section-card"][data-section-id="sec-general"]')
      .locator('[data-test="field-library-item"]')
    await expect(generalFields).toHaveCount(MOCK.generalFieldCount)
    // Order: f-company, f-status, f-rating, f-categories per MOCK_SECTIONS[0].fields.
    await expect.soft(generalFields.nth(0)).toHaveAttribute('data-field-id', 'f-company')
    await expect.soft(generalFields.nth(3)).toHaveAttribute('data-field-id', 'f-categories')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Add / rename / delete section via modals
// ────────────────────────────────────────────────────────────────────────────
test.describe('supplier-card-config › section CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loadConfig(page)
  })

  test('add section → modal → fill name → create → new section appears', async ({ page }) => {
    const sections = page.locator(
      '[data-test="supplier-card-config-builder-list"] [data-test="config-section-card"]',
    )
    await expect(sections).toHaveCount(MOCK.sectionCount)
    await page.locator('[data-test="supplier-card-config-builder-add-btn"]').click()
    await expect(page.locator('.modal-overlay.active')).toBeVisible()
    await page
      .locator('[data-test="supplier-card-config-modal-add-section-name"]')
      .fill('Playwright Section')
    await page.locator('[data-test="supplier-card-config-modal-add-section-confirm"]').click()
    await expect(sections).toHaveCount(MOCK.sectionCount + 1)
    await expect(sections.last().locator('[data-test="config-section-card-name"]')).toHaveText(
      'Playwright Section',
    )
  })

  test('add section with blank name surfaces error toast and does NOT append', async ({ page }) => {
    const sections = page.locator(
      '[data-test="supplier-card-config-builder-list"] [data-test="config-section-card"]',
    )
    await page.locator('[data-test="supplier-card-config-builder-add-btn"]').click()
    await page.locator('[data-test="supplier-card-config-modal-add-section-confirm"]').click()
    await expect.soft(page.locator('.toast-container .toast.show.toast-error')).toBeVisible()
    await expect.soft(sections).toHaveCount(MOCK.sectionCount)
  })

  test('rename section → modal opens prefilled → save → name updates', async ({ page }) => {
    const general = page.locator('[data-test="config-section-card"][data-section-id="sec-general"]')
    await general.locator('[data-test="config-section-card-edit-btn"]').click()
    const nameInput = page.locator('[data-test="supplier-card-config-modal-edit-section-name"]')
    await expect(nameInput).toHaveValue('General Info')
    await nameInput.fill('General Renamed')
    await page.locator('[data-test="supplier-card-config-modal-edit-section-confirm"]').click()
    await expect(general.locator('[data-test="config-section-card-name"]')).toHaveText(
      'General Renamed',
    )
    await expect.soft(page.locator('.toast-container .toast.show')).toBeVisible()
  })

  test('user-added sections are deletable → confirm modal removes the section', async ({
    page,
  }) => {
    // Seed a deletable (non-system) section because all 5 mock sections are system=true.
    await page.locator('[data-test="supplier-card-config-builder-add-btn"]').click()
    await page.locator('[data-test="supplier-card-config-modal-add-section-name"]').fill('ToDelete')
    await page.locator('[data-test="supplier-card-config-modal-add-section-confirm"]').click()
    const sections = page.locator(
      '[data-test="supplier-card-config-builder-list"] [data-test="config-section-card"]',
    )
    await expect(sections).toHaveCount(MOCK.sectionCount + 1)
    // Target the last card (newly created) and click its delete button.
    const created = sections.last()
    await created.locator('[data-test="config-section-card-delete-btn"]').click()
    // Confirm modal opens — section still present at this point.
    await expect.soft(page.locator('.modal-overlay.active')).toBeVisible()
    await expect.soft(sections).toHaveCount(MOCK.sectionCount + 1)
    await page.locator('[data-test="supplier-card-config-modal-delete-section-confirm"]').click()
    await expect(sections).toHaveCount(MOCK.sectionCount)
    await expect.soft(page.locator('.modal-overlay.active')).toHaveCount(0)
  })

  test('cancelling the delete-section modal leaves the section intact', async ({ page }) => {
    await page.locator('[data-test="supplier-card-config-builder-add-btn"]').click()
    await page.locator('[data-test="supplier-card-config-modal-add-section-name"]').fill('KeepMe')
    await page.locator('[data-test="supplier-card-config-modal-add-section-confirm"]').click()
    const sections = page.locator(
      '[data-test="supplier-card-config-builder-list"] [data-test="config-section-card"]',
    )
    await expect(sections).toHaveCount(MOCK.sectionCount + 1)
    await sections.last().locator('[data-test="config-section-card-delete-btn"]').click()
    await page.locator('[data-test="supplier-card-config-modal-delete-section-cancel"]').click()
    await expect.soft(page.locator('.modal-overlay.active')).toHaveCount(0)
    await expect(sections).toHaveCount(MOCK.sectionCount + 1)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Add / remove field in a section
// ────────────────────────────────────────────────────────────────────────────
test.describe('supplier-card-config › section fields CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loadConfig(page)
  })

  test('add field to section → modal → fill name → add → field appears in section AND library', async ({
    page,
  }) => {
    const general = page.locator('[data-test="config-section-card"][data-section-id="sec-general"]')
    const generalFields = general.locator('[data-test="field-library-item"]')
    await expect(generalFields).toHaveCount(MOCK.generalFieldCount)
    const libItems = page.locator(
      '[data-test="supplier-card-config-library-list"] [data-test="field-library-item"]',
    )
    await expect(libItems).toHaveCount(MOCK.fieldCount)

    await general.locator('[data-test="config-section-card-add-field-btn"]').click()
    await page
      .locator('[data-test="supplier-card-config-modal-add-field-name"]')
      .fill('Custom Attribute')
    await page.locator('[data-test="supplier-card-config-modal-add-field-confirm"]').click()

    await expect(generalFields).toHaveCount(MOCK.generalFieldCount + 1)
    await expect(libItems).toHaveCount(MOCK.fieldCount + 1)
    // The new chip lands at the end of the section.
    await expect(generalFields.last().locator('[data-test="field-library-item-name"]')).toHaveText(
      'Custom Attribute',
    )
  })

  test('removing a custom field from a section asks for confirm → only section reference goes', async ({
    page,
  }) => {
    const general = page.locator('[data-test="config-section-card"][data-section-id="sec-general"]')
    // Seed a custom field via the add-field-to-section flow — system library fields
    // have showDelete=false, so only user-added fields expose a delete button here.
    await general.locator('[data-test="config-section-card-add-field-btn"]').click()
    await page.locator('[data-test="supplier-card-config-modal-add-field-name"]').fill('Ephemeral')
    await page.locator('[data-test="supplier-card-config-modal-add-field-confirm"]').click()
    const generalFields = general.locator('[data-test="field-library-item"]')
    await expect(generalFields).toHaveCount(MOCK.generalFieldCount + 1)

    // The custom field is the ONLY one with a delete button inside this section.
    const deleteBtn = general.locator('[data-test="field-library-item-delete-btn"]')
    await expect(deleteBtn).toHaveCount(1)
    await deleteBtn.click()
    await expect.soft(page.locator('.modal-overlay.active')).toBeVisible()
    await page.locator('[data-test="supplier-card-config-modal-remove-field-confirm"]').click()
    // Field gone from section, but library entry stays (only section link removed).
    await expect(generalFields).toHaveCount(MOCK.generalFieldCount)
    await expect(
      page.locator(
        '[data-test="supplier-card-config-library-list"] [data-test="field-library-item"]',
      ),
    ).toHaveCount(MOCK.fieldCount + 1)
  })

  test('delete custom field from the library removes it from every section', async ({ page }) => {
    const general = page.locator('[data-test="config-section-card"][data-section-id="sec-general"]')
    // Seed a custom field in General so we can observe it disappear from both places.
    await general.locator('[data-test="config-section-card-add-field-btn"]').click()
    await page
      .locator('[data-test="supplier-card-config-modal-add-field-name"]')
      .fill('Library Kill')
    await page.locator('[data-test="supplier-card-config-modal-add-field-confirm"]').click()

    const libItems = page.locator(
      '[data-test="supplier-card-config-library-list"] [data-test="field-library-item"]',
    )
    await expect(libItems).toHaveCount(MOCK.fieldCount + 1)
    const generalFields = general.locator('[data-test="field-library-item"]')
    await expect(generalFields).toHaveCount(MOCK.generalFieldCount + 1)

    // The library exposes a delete btn only on custom fields (isCustomField(f.id)).
    const libraryDeleteBtn = page
      .locator('[data-test="supplier-card-config-library-list"]')
      .locator('[data-test="field-library-item-delete-btn"]')
    await expect(libraryDeleteBtn).toHaveCount(1)
    await libraryDeleteBtn.click()
    await page.locator('[data-test="supplier-card-config-modal-delete-field-confirm"]').click()
    await expect(libItems).toHaveCount(MOCK.fieldCount)
    await expect(generalFields).toHaveCount(MOCK.generalFieldCount)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Drag-reorder sections — native HTML5 drag events via Playwright dragTo
// ────────────────────────────────────────────────────────────────────────────
test.describe('supplier-card-config › drag-reorder sections', () => {
  test.beforeEach(async ({ page }) => {
    await loadConfig(page)
  })

  test('dragging sec-general onto sec-location reorders the list (moveSection)', async ({
    page,
  }) => {
    const wrappers = page.locator('[data-test="supplier-card-config-section-wrapper"]')
    await expect(wrappers).toHaveCount(MOCK.sectionCount)
    const before = await wrappers.evaluateAll((els) =>
      els.map((el) => (el as HTMLElement).dataset.sectionId ?? ''),
    )
    expect(before).toEqual(Array.from(MOCK.sectionIds))

    // Playwright's locator.dragTo() simulates pointer-level drag which Chromium doesn't
    // always promote to an HTML5 dragstart/drop pair. The page uses native drag events
    // (@dragstart/@dragover/@drop) with a closure-scoped `draggingSectionId`, so the
    // most reliable path is to dispatch the DragEvents directly on the wrappers. A
    // single shared DataTransfer keeps the closure's setData call non-throwing.
    await page.evaluate(
      ({ srcId, dstId }) => {
        const sel = (id: string) =>
          document.querySelector<HTMLElement>(
            `[data-test="supplier-card-config-section-wrapper"][data-section-id="${id}"]`,
          )
        const src = sel(srcId)
        const dst = sel(dstId)
        if (!src || !dst) throw new Error(`wrapper not found: ${srcId} → ${dstId}`)
        const dt = new DataTransfer()
        src.dispatchEvent(
          new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }),
        )
        dst.dispatchEvent(
          new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }),
        )
        dst.dispatchEvent(
          new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }),
        )
        src.dispatchEvent(
          new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }),
        )
      },
      { srcId: 'sec-general', dstId: 'sec-location' },
    )

    // moveSection(fromId=sec-general, toId=sec-location): splice-remove source, then
    // splice-insert at the recomputed target index. Pre-move: toIdx=2. Post-removal the
    // array is [contacts, location, logistics, notes], so sec-location is now at idx 1 —
    // moveSection re-reads the indices and inserts at 2, landing sec-general AFTER
    // sec-location. Expected order: contacts, location, general, logistics, notes.
    await expect
      .poll(() =>
        wrappers.evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.sectionId ?? '')),
      )
      .toEqual(['sec-contacts', 'sec-location', 'sec-general', 'sec-logistics', 'sec-notes'])
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Permissions matrix — rows, cascade rules, expand/user overrides
// ────────────────────────────────────────────────────────────────────────────
test.describe('supplier-card-config › permissions matrix', () => {
  test.beforeEach(async ({ page }) => {
    await loadConfig(page)
  })

  test(`renders ${MOCK.permissionRows} rows (5 section rows + 12 field rows)`, async ({ page }) => {
    await expect(page.locator('[data-test="supplier-card-config-permissions-row"]')).toHaveCount(
      MOCK.permissionRows,
    )
  })

  test(`renders a role cell per role on every row (${MOCK.roles.length} cells × ${MOCK.permissionRows} rows)`, async ({
    page,
  }) => {
    await expect(page.locator('[data-test="supplier-card-config-permissions-cell"]')).toHaveCount(
      MOCK.permissionRows * MOCK.roles.length,
    )
  })

  test('Admin row defaults to all-checked; Sales row defaults to all-unchecked (per mock)', async ({
    page,
  }) => {
    const general = page.locator(
      '[data-test="supplier-card-config-permissions-row"][data-item-id="sec-general"]',
    )
    const adminCell = general.locator(
      '[data-test="supplier-card-config-permissions-cell"][data-role="Admin"]',
    )
    const salesCell = general.locator(
      '[data-test="supplier-card-config-permissions-cell"][data-role="Sales"]',
    )
    const adminReadInput = adminCell.locator(
      '[data-test="supplier-card-config-perm-role-checkbox"][data-action="read"] input',
    )
    const salesReadInput = salesCell.locator(
      '[data-test="supplier-card-config-perm-role-checkbox"][data-action="read"] input',
    )
    await expect.soft(adminReadInput).toBeChecked()
    await expect.soft(salesReadInput).not.toBeChecked()
  })

  test('Rule 1 cascade: toggling Sales.read on sec-general propagates to ALL its field rows', async ({
    page,
  }) => {
    const generalRow = page.locator(
      '[data-test="supplier-card-config-permissions-row"][data-item-id="sec-general"]',
    )
    const salesReadLabel = generalRow
      .locator('[data-test="supplier-card-config-permissions-cell"][data-role="Sales"]')
      .locator('[data-test="supplier-card-config-perm-role-checkbox"][data-action="read"]')
    // label.click() fires the change on the underlying <input> (custom styling hides
    // the input visually but the label is pointer-active).
    await salesReadLabel.click()

    // All 4 child fields of sec-general should now be Sales.read=true.
    const fieldRows = page.locator(
      '[data-test="supplier-card-config-permissions-row"][data-parent-id="sec-general"]',
    )
    await expect(fieldRows).toHaveCount(MOCK.generalFieldCount)
    for (let i = 0; i < MOCK.generalFieldCount; i++) {
      const input = fieldRows
        .nth(i)
        .locator('[data-test="supplier-card-config-permissions-cell"][data-role="Sales"]')
        .locator('[data-test="supplier-card-config-perm-role-checkbox"][data-action="read"] input')
      await expect.soft(input).toBeChecked()
    }
  })

  test('expand button reveals a user sub-row per role user', async ({ page }) => {
    const general = page.locator(
      '[data-test="supplier-card-config-permissions-row"][data-item-id="sec-general"]',
    )
    const adminCell = general.locator(
      '[data-test="supplier-card-config-permissions-cell"][data-role="Admin"]',
    )
    await expect(
      adminCell.locator('[data-test="supplier-card-config-perm-users-list"]'),
    ).toHaveCount(0)
    await adminCell.locator('[data-test="supplier-card-config-perm-expand-btn"]').click()
    // MOCK_ROLE_USERS.Admin has 2 entries.
    await expect(adminCell.locator('[data-test="supplier-card-config-perm-user-row"]')).toHaveCount(
      2,
    )
  })

  test('toggling a user checkbox creates a per-user override (Rule 5)', async ({ page }) => {
    const general = page.locator(
      '[data-test="supplier-card-config-permissions-row"][data-item-id="sec-general"]',
    )
    const adminCell = general.locator(
      '[data-test="supplier-card-config-permissions-cell"][data-role="Admin"]',
    )
    await adminCell.locator('[data-test="supplier-card-config-perm-expand-btn"]').click()
    // Admin defaults to all-checked — flip one user's read off.
    const firstUserRead = adminCell
      .locator('[data-test="supplier-card-config-perm-user-row"]')
      .first()
      .locator('[data-test="supplier-card-config-perm-user-checkbox"][data-action="read"] input')
    await expect(firstUserRead).toBeChecked()
    await adminCell
      .locator('[data-test="supplier-card-config-perm-user-row"]')
      .first()
      .locator('[data-test="supplier-card-config-perm-user-checkbox"][data-action="read"]')
      .click()
    await expect(firstUserRead).not.toBeChecked()
    // The role-level checkbox flips to indeterminate (one user on, one user off).
    const roleReadInput = adminCell.locator(
      '[data-test="supplier-card-config-perm-role-checkbox"][data-action="read"] input',
    )
    // `indeterminate` is a JS property on the input element, not an attribute.
    await expect
      .poll(() => roleReadInput.evaluate((el: HTMLInputElement) => el.indeterminate))
      .toBe(true)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Save — 3 parallel PUTs via apiPut → mock; observable effects only
// ────────────────────────────────────────────────────────────────────────────
test.describe('supplier-card-config › save', () => {
  test.beforeEach(async ({ page }) => {
    await loadConfig(page)
  })

  test('clicking Save triggers saveConfig() and shows a success toast', async ({ page }) => {
    await page.locator('[data-test="supplier-card-config-save-btn"]').click()
    await expect(page.locator('.toast-container .toast.show')).toBeVisible()
  })

  test('edits survive an in-SPA navigation away and back (module state persists)', async ({
    page,
  }) => {
    // MOCK_SECTIONS is module-level state — survives SPA route changes but NOT a full
    // reload (page.goto re-evaluates modules). Rename + Save + SPA roundtrip out and back.
    const general = page.locator('[data-test="config-section-card"][data-section-id="sec-general"]')
    await general.locator('[data-test="config-section-card-edit-btn"]').click()
    await page
      .locator('[data-test="supplier-card-config-modal-edit-section-name"]')
      .fill('Survives Nav')
    await page.locator('[data-test="supplier-card-config-modal-edit-section-confirm"]').click()
    await page.locator('[data-test="supplier-card-config-save-btn"]').click()
    await expect(page.locator('.toast-container .toast.show')).toBeVisible()

    // SPA roundtrip: config → sidebar /admin/suppliers → row router-link /admin/suppliers/1
    // → supplier-card-config-link /admin/suppliers/config. Every hop is a router-link push
    // (no full reload), so the mock modules stay warm and the rename sticks.
    await page.locator('[data-test="sidebar-nav-suppliers"]').click()
    await expect(page).toHaveURL(/\/admin\/suppliers$/)
    await page.locator('[data-test="suppliers-row"]').first().locator('a.link').first().click()
    await expect(page).toHaveURL(/\/admin\/suppliers\/\d+$/)
    await page.locator('[data-test="supplier-card-config-link"]').click()
    await expect(page).toHaveURL(/\/admin\/suppliers\/config$/)
    await expect(
      page
        .locator('[data-test="config-section-card"][data-section-id="sec-general"]')
        .locator('[data-test="config-section-card-name"]'),
    ).toHaveText('Survives Nav')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Page-level feature flag (supplierCardConfig) — OFF → /404
// ────────────────────────────────────────────────────────────────────────────
baseTest(
  'supplier-card-config › redirects to /404 when supplierCardConfig flag is OFF',
  async ({ page, context }) => {
    await context.addInitScript(
      (flags) => localStorage.setItem('ff_overrides', JSON.stringify(flags)),
      { ...ALL_FLAGS_ENABLED, supplierCardConfig: false },
    )
    await page.goto(CONFIG_URL)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/404$/)
    await expect(page.locator('[data-test="supplier-card-config-title"]')).toHaveCount(0)
  },
)

// ────────────────────────────────────────────────────────────────────────────
// Section-level flag (permissionsEditor) — OFF hides the matrix; builder stays
// ────────────────────────────────────────────────────────────────────────────
baseTest(
  'supplier-card-config › permissionsEditor flag OFF hides the matrix (library/builder still render)',
  async ({ page, context }) => {
    await context.addInitScript(
      (flags) => localStorage.setItem('ff_overrides', JSON.stringify(flags)),
      { ...ALL_FLAGS_ENABLED, permissionsEditor: false },
    )
    await page.goto(CONFIG_URL)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-test="supplier-card-config-title"]')).toBeVisible()
    // Library + builder unaffected.
    await expect.soft(page.locator('[data-test="supplier-card-config-library"]')).toBeVisible()
    await expect.soft(page.locator('[data-test="supplier-card-config-builder"]')).toBeVisible()
    // Matrix hidden via v-if="showPermissionsEditor".
    await expect.soft(page.locator('[data-test="supplier-card-config-permissions"]')).toHaveCount(0)
  },
)

// ────────────────────────────────────────────────────────────────────────────
// Per-section visual snapshots (@1440 baseline)
// ────────────────────────────────────────────────────────────────────────────
test.describe('supplier-card-config › visual @1440', () => {
  test.beforeEach(async ({ page }) => {
    await loadConfig(page)
    await waitForFontsReady(page)
  })

  test('action bar', async ({ page }) => {
    await expect(page.locator('[data-test="supplier-card-config-action-bar"]')).toHaveScreenshot(
      'supplier-card-config-action-bar.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('global field library', async ({ page }) => {
    await expect(page.locator('[data-test="supplier-card-config-library"]')).toHaveScreenshot(
      'supplier-card-config-library.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('section builder', async ({ page }) => {
    await expect(page.locator('[data-test="supplier-card-config-builder"]')).toHaveScreenshot(
      'supplier-card-config-builder.png',
      SNAPSHOT_OPTIONS,
    )
  })

  test('permissions matrix', async ({ page }) => {
    await expect(page.locator('[data-test="supplier-card-config-permissions"]')).toHaveScreenshot(
      'supplier-card-config-permissions.png',
      SNAPSHOT_OPTIONS,
    )
  })
})
