import { test, expect } from '../../fixtures'
import { navigateToAdmin } from '../../helpers/admin'

/**
 * Настройки → Логи: a view over the nine logs, not a tenth store.
 *
 * The tests that matter here are the ones about identity and about there being
 * one source: a row is named by entity type + entity id + entry id, and a record
 * deleted in either place is gone from both.
 */

const rows = (page: import('@playwright/test').Page) => page.getByTestId('audit-log-row')

/** The composite key of a row — what the page keys, selects and deletes by. */
async function keyOf(row: import('@playwright/test').Locator): Promise<string> {
  return (await row.getAttribute('data-row-key'))!
}

/**
 * Pick a value in the entity CustomSelect — it renders its own option elements,
 * and the list can open upward, so the selection is verified rather than assumed:
 * a click that lands on the neighbouring option would otherwise leave the test
 * quietly checking a different filter than the one it names.
 */
async function selectEntity(page: import('@playwright/test').Page, label: string) {
  const select = page.getByTestId('audit-log-entity-filter')
  await select.click()
  const list = select.locator('.custom-select-list.open')
  await expect(list).toBeVisible()
  await list
    .locator('.custom-select-option')
    .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
    .click()
  await expect(select.locator('.curr-val')).toHaveText(label)
  await expect(page.getByTestId('audit-log-reset-filters')).toBeVisible()
  // The reset button appears the moment the filter changes — the rows arrive one
  // request later. Wait for the feed itself, or the next read snapshots the old
  // table (whose first page is all Order rows, since an order stamps its creation
  // entry with the current time).
  await expect(rows(page).first().locator('.audit-log-kind')).toHaveText(label)
}

test.describe('Audit log page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToAdmin(page, '/admin/settings/logs')
  })

  test('loads without console errors and shows records', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    page.on('pageerror', (err) => errors.push(err.message))

    await navigateToAdmin(page, '/admin/settings/logs')

    await expect(page.getByTestId('settings-logs')).toBeVisible()
    await expect(rows(page).first()).toBeVisible()
    expect(errors).toHaveLength(0)
  })

  test('is reachable as a settings tab', async ({ page }) => {
    await navigateToAdmin(page, '/admin/settings/profile')
    await page.getByTestId('settings-tabs').getByText('Logs', { exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/settings\/logs$/)
    await expect(page.getByTestId('settings-logs')).toBeVisible()
  })

  test('every row is keyed by entity type, entity id and entry id together', async ({ page }) => {
    await expect(rows(page).first()).toBeVisible()
    const keys = await rows(page).evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-row-key')!),
    )
    expect(keys.length).toBeGreaterThan(1)
    // Three parts, and unique on the page.
    for (const key of keys) expect(key.split(':')).toHaveLength(3)
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('rows carry newest first', async ({ page }) => {
    await expect(rows(page).first()).toBeVisible()
    const times = await rows(page).evaluateAll((els) =>
      els.map((el) => el.querySelector('td')!.textContent!.trim()),
    )
    expect(times.length).toBeGreaterThan(1)
    // Rendered as dd.mm.yyyy hh:mm — compare as instants, not as text.
    const asDate = (s: string) => {
      const [d, t] = s.split(', ')
      const [day, month, year] = d!.split(/[./]/)
      return new Date(`${year}-${month}-${day}T${(t ?? '00:00').trim()}`).getTime()
    }
    const values = times.map(asDate).filter((n) => !Number.isNaN(n))
    for (let i = 1; i < values.length; i++)
      expect(values[i - 1]!).toBeGreaterThanOrEqual(values[i]!)
  })

  test('a row leads to the object it belongs to', async ({ page }) => {
    const link = rows(page).first().getByTestId('audit-log-entity-link')
    await expect(link).toBeVisible()
    const href = await link.getAttribute('href')
    expect(href).toBeTruthy()

    await link.click()
    await expect(page).not.toHaveURL(/\/admin\/settings\/logs$/)
    await expect(page).toHaveURL(new RegExp(href!.replace(/[/-]/g, '\\$&') + '$'))
  })

  test('entity filter narrows the feed', async ({ page }) => {
    await expect(rows(page).first()).toBeVisible()
    const before = await rows(page).count()

    await selectEntity(page, 'Batch')

    await expect(page.getByTestId('audit-log-reset-filters')).toBeVisible()
    const kinds = await rows(page).evaluateAll((els) =>
      els.map((el) => el.querySelector('.audit-log-kind')!.textContent!.trim()),
    )
    expect(kinds.length).toBeGreaterThan(0)
    expect(new Set(kinds)).toEqual(new Set(['Batch']))
    expect(await rows(page).count()).toBeLessThanOrEqual(before)
  })

  test('search narrows the feed and reset brings it back', async ({ page }) => {
    await expect(rows(page).first()).toBeVisible()
    const totalBefore = (await page.getByTestId('audit-log-total').textContent())!

    const term = (await rows(page).first().locator('.audit-diff-new').textContent())!
      .trim()
      .slice(0, 4)
    test.skip(term.length < 3, 'no usable search term in the first row')
    await page.getByTestId('audit-log-search').locator('input').fill(term)

    await expect(page.getByTestId('audit-log-reset-filters')).toBeVisible()
    await expect(page.getByTestId('audit-log-total')).not.toHaveText(totalBefore)

    await page.getByTestId('audit-log-reset-filters').click()
    await expect(page.getByTestId('audit-log-total')).toHaveText(totalBefore)
  })

  test('deleting removes exactly the row asked for', async ({ page }) => {
    await expect(rows(page).first()).toBeVisible()
    const target = rows(page).first()
    const targetKey = await keyOf(target)
    const neighbourKey = await keyOf(rows(page).nth(1))

    await target.getByTestId('audit-log-delete-btn').click()
    await expect(page.getByTestId('audit-log-delete-modal')).toBeVisible()
    await page.getByTestId('audit-log-delete-confirm').click()

    await expect(page.locator(`[data-row-key="${targetKey}"]`)).toHaveCount(0)
    await expect(page.locator(`[data-row-key="${neighbourKey}"]`)).toHaveCount(1)
  })

  test('two rows sharing an entry id: deleting one leaves the other', async ({ page }) => {
    // An entry id is unique inside ONE log — `bch-au-1` exists on every batch.
    // Keyed by the entry id alone, this deletion would take the wrong row with it.
    await expect(rows(page).first()).toBeVisible()
    const keys = await rows(page).evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-row-key')!),
    )
    const byEntryId = new Map<string, string[]>()
    for (const key of keys) {
      const entryId = key.split(':')[2]!
      byEntryId.set(entryId, [...(byEntryId.get(entryId) ?? []), key])
    }
    const twins = [...byEntryId.values()].find((group) => group.length > 1)
    test.skip(!twins, 'no two rows on this page share an entry id')

    const [first, second] = twins!
    await page.locator(`[data-row-key="${first}"]`).getByTestId('audit-log-delete-btn').click()
    await page.getByTestId('audit-log-delete-confirm').click()

    await expect(page.locator(`[data-row-key="${first}"]`)).toHaveCount(0)
    await expect(page.locator(`[data-row-key="${second}"]`)).toHaveCount(1)
  })

  /**
   * Both directions of "one source of data" are walked INSIDE the SPA — link clicks
   * and history moves, never `goto`.
   *
   * A full page load rebuilds the mock stores from their seeds, so a deletion made
   * before it simply comes back, and the assertion that follows proves nothing. These
   * two tests did exactly that and passed anyway, because `toHaveCount(0)` is equally
   * true when the row exists but sits on page three: the batch entries they used were
   * old enough to be far down the feed. Once those logs moved onto the demo clock the
   * rows landed on page one and the emptiness showed.
   */
  test('deleted in the feed, gone from the object card', async ({ page }) => {
    await selectEntity(page, 'Batch')
    const feedRow = rows(page).first()
    await expect(feedRow).toBeVisible()
    const key = await keyOf(feedRow)
    const [, , entryId] = key.split(':')

    // Visit the card first, so the way back to it is a history move rather than a load.
    await feedRow.getByTestId('audit-log-entity-link').click()
    const cardRow = page.locator(`[data-entry-id="${entryId}"]`)
    await expect(cardRow).toBeVisible()

    await page.goBack()
    await expect(page.locator(`[data-row-key="${key}"]`)).toBeVisible()
    await page.locator(`[data-row-key="${key}"]`).getByTestId('audit-log-delete-btn').click()
    await page.getByTestId('audit-log-delete-confirm').click()
    await expect(page.locator(`[data-row-key="${key}"]`)).toHaveCount(0)

    await page.goForward()
    await expect(page.getByTestId('batch-card-audit-row').first()).toBeVisible()
    // The card reads the same log: the record deleted in the feed is not on it.
    await expect(page.locator(`[data-entry-id="${entryId}"]`)).toHaveCount(0)
  })

  test('deleted on the object card, gone from the feed', async ({ page }) => {
    await selectEntity(page, 'Batch')
    const feedRow = rows(page).first()
    await expect(feedRow).toBeVisible()
    const key = await keyOf(feedRow)
    const [, , entryId] = key.split(':')

    await feedRow.getByTestId('audit-log-entity-link').click()
    const cardRows = page.getByTestId('batch-card-audit-row')
    await expect(cardRows.first()).toBeVisible()
    const before = await cardRows.count()

    // The row for THIS entry, not the first one on screen: the card lists the log in
    // store order while the feed sorts it newest-first, so "first" names two different
    // records.
    const cardRow = page.locator(`[data-entry-id="${entryId}"]`)
    await expect(cardRow).toBeVisible()
    await cardRow.getByTestId('batch-card-audit-delete-btn').click()
    await expect(page.getByTestId('batch-card-audit-modal')).toBeVisible()
    await page.getByTestId('batch-card-audit-modal-confirm').click()
    await expect(cardRows).toHaveCount(before - 1)

    await page.goBack()
    await expect(rows(page).first()).toBeVisible()
    await expect(page.locator(`[data-row-key="${key}"]`)).toHaveCount(0)
  })
})
