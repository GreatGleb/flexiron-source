/**
 * Признаки готовности списка №1 из `roo_code/plans/general/review-followups.md`
 * (пункты 1, 3, 5, 10) — закреплённые тестом, а не разовой проверкой.
 *
 * Заведён 2026-08-30: пункты были проверены временными спеками, которые автор за
 * собой удалил. То есть доказательство существовало один раз и никого больше не
 * защищало — любую из четырёх правок можно было снести, не покрасив набор.
 *
 * Каждое утверждение здесь проверено инверсией: правка ломалась в коде, и тест
 * обязан был покраснеть. Утверждение, которое переживает поломку, — не тест.
 */
import { testWithFlags as test, expect } from '../fixtures'
import type { Page } from '@playwright/test'

async function setLang(page: Page, lang: string) {
  await page.context().addInitScript((l) => {
    localStorage.setItem('flexiron_lang', l as string)
  }, lang)
}

/** Горизонтальный зазор между двумя соседними элементами. */
async function gapBetween(page: Page, left: string, right: string): Promise<number> {
  const a = (await page.locator(left).boundingBox())!
  const b = (await page.locator(right).boundingBox())!
  return Math.round(b.x - (a.x + a.width))
}

// ═══════════════════════════════════════════════════════════════════════════
// Пункт 1 — кнопки в шапке панели не слипаются
// ═══════════════════════════════════════════════════════════════════════════

test.describe('followups №1 · пункт 1 · зазор между кнопками в шапке панели', () => {
  test('карточка партии: между «Новым обрезком» и «Резкой» есть зазор', async ({ page }) => {
    await page.goto('/admin/warehouse/batches/whb-100')
    const a = '[data-test="batch-card-create-offcut-link"]'
    const b = '[data-test="batch-card-cutting-link"]'
    await expect(page.locator(a)).toBeVisible()
    await expect(page.locator(b)).toBeVisible()
    // 8px — значение общей обёртки `.panel-header-actions`. Ноль означал бы,
    // что кнопки снова держатся на `margin-left: auto` и слиплись.
    expect(await gapBetween(page, a, b)).toBe(8)
  })

  test('настройки карточки поставщика: тот же зазор, тот же класс', async ({ page }) => {
    // Кнопка-переключатель видна только на узком экране — там и проверяем пару.
    await page.setViewportSize({ width: 700, height: 900 })
    await page.goto('/admin/suppliers/config')
    const a = '[data-test="supplier-card-config-library-toggle"]'
    const b = '[data-test="supplier-card-config-library-new-btn"]'
    await expect(page.locator(a)).toBeVisible()
    await expect(page.locator(b)).toBeVisible()
    expect(await gapBetween(page, a, b)).toBe(8)
  })

  test('группа кнопок умеет переноситься — иначе на узком она вылезет', async ({ page }) => {
    await page.goto('/admin/warehouse/batches/whb-100')
    await expect(page.locator('[data-test="batch-card-cutting-link"]')).toBeVisible()
    // Проверяется правило, а не сегодняшняя раскладка: при нынешних подписях пара
    // влезает в строку на любой поддерживаемой ширине, и тест на переполнение
    // остаётся зелёным даже без переноса — проверено инверсией. Собранные в один
    // флекс-элемент кнопки лишились переноса, который у `.panel-header` есть
    // на ≤600px, и вернуть его — весь смысл правки.
    const wrap = await page
      .locator('[data-test="batch-card-offcuts-section"] .panel-header-actions')
      .evaluate((el) => getComputedStyle(el).flexWrap)
    expect(wrap).toBe('wrap')
  })

  /*
   * Сторож переполнения на будущее, а НЕ доказательство правки пункта 1: при
   * полном откате правки он остаётся зелёным — проверено и инверсией, и приёмкой,
   * которая откатила обе страницы целиком и получила его среди прошедших. При
   * нынешних подписях пара влезает в строку и без общей обёртки. Ценность у него
   * другая: третья кнопка или подпись подлиннее сделают его красным.
   */
  test('кнопки не вылезают за панель на 320px — сторож переполнения', async ({ page }) => {
    await setLang(page, 'ru')
    await page.setViewportSize({ width: 320, height: 900 })
    await page.goto('/admin/warehouse/batches/whb-100')
    const section = page.locator('[data-test="batch-card-offcuts-section"]')
    await expect(section.locator('[data-test="batch-card-cutting-link"]')).toBeVisible()
    const box = await section.evaluate((el) => {
      const r = (n: Element | null) => (n ? n.getBoundingClientRect().right : null)
      return {
        panel: r(el),
        a: r(el.querySelector('[data-test="batch-card-create-offcut-link"]')),
        b: r(el.querySelector('[data-test="batch-card-cutting-link"]')),
      }
    })
    expect(box.a!).toBeLessThanOrEqual(box.panel!)
    expect(box.b!).toBeLessThanOrEqual(box.panel!)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Пункт 3 — кнопка проверки почты называет адрес до нажатия
// ═══════════════════════════════════════════════════════════════════════════

test.describe('followups №1 · пункт 3 · куда уйдёт тестовое письмо', () => {
  test('адрес назван ДО нажатия, и это тот же адрес, что назовёт тост', async ({ page }) => {
    await setLang(page, 'en')
    await page.goto('/admin/settings/mail')
    const saved = await page.locator('[data-test="settings-mail-from-email"]').inputValue()
    expect(saved).not.toBe('')
    await expect(page.locator('[data-test="settings-mail-test-target"]')).toHaveText(
      `The email will be sent to ${saved}`,
    )

    await page.locator('[data-test="settings-mail-test-btn"]').click()
    const toast = page.locator('.toast-container .toast.show')
    await expect(toast).toBeVisible()
    // Обещание до нажатия и отчёт после обязаны сойтись — ради этого пункт и заведён.
    await expect(toast).toContainText(saved)
  })

  test('несохранённая правка отправителя: адрес не обещается', async ({ page }) => {
    await setLang(page, 'en')
    await page.goto('/admin/settings/mail')
    const from = page.locator('[data-test="settings-mail-from-email"]')
    const saved = await from.inputValue()
    await from.fill('changed@example.com')

    const line = page.locator('[data-test="settings-mail-test-target"]')
    await expect(line).toHaveText(
      'The email will go to the saved address — save the settings first',
    )
    // Главное утверждение: черновик не назван получателем. Именно этим строка врала.
    await expect(line).not.toContainText('changed@example.com')

    await page.locator('[data-test="settings-mail-test-btn"]').click()
    const toast = page.locator('.toast-container .toast.show')
    await expect(toast).toContainText(saved)
    await expect(toast).not.toContainText('changed@example.com')
  })

  test('после сохранения строка называет НОВЫЙ адрес, и письмо уходит туда', async ({ page }) => {
    await setLang(page, 'en')
    await page.goto('/admin/settings/mail')
    const line = page.locator('[data-test="settings-mail-test-target"]')
    await page.locator('[data-test="settings-mail-from-email"]').fill('brand-new@example.com')
    await expect(line).toHaveText(
      'The email will go to the saved address — save the settings first',
    )

    await page.locator('.btn-save').click()
    // Сохранение делает черновик серверным состоянием — адрес обязан вернуться,
    // и уже новый. Это и есть смысл всей конструкции с isDirty.
    await expect(line).toHaveText('The email will be sent to brand-new@example.com', {
      timeout: 15000,
    })

    await page.locator('[data-test="settings-mail-test-btn"]').click()
    // Тостов на экране два — «настройки сохранены» и ответ проверки; нужен последний.
    await expect(page.locator('.toast-container .toast.show').last()).toContainText(
      'brand-new@example.com',
    )
  })

  test('правка чужого раздела настроек не гасит адрес почты', async ({ page }) => {
    await setLang(page, 'en')
    const line = page.locator('[data-test="settings-mail-test-target"]')
    const tab = (name: string) =>
      page.locator(`[data-test="settings-tabs"] .warehouse-tab:has-text("${name}")`)

    await page.goto('/admin/settings/mail')
    const saved = await page.locator('[data-test="settings-mail-from-email"]').inputValue()
    await expect(line).toHaveText(`The email will be sent to ${saved}`)

    // Переходы кликом, а не page.goto: goto перезагружает страницу и стирает
    // несохранённое — с ним премисса теста не выполнялась вовсе, и он оставался
    // зелёным даже при возврате к общему признаку. Найдено инверсией.
    await tab('Company').click()
    const company = page.locator('[data-test="settings-company-name"]')
    await expect(company).toBeVisible()
    await company.fill('Flexiron UABX')
    await expect(page.locator('.btn-save')).toBeEnabled()

    await tab('Mail').click()
    await expect(page.locator('[data-test="settings-mail-from-email"]')).toBeVisible()
    // Премисса: правка «Компании» жива. Без неё утверждение ниже ничего не значит.
    await expect(page.locator('.btn-save')).toBeEnabled()
    // Почта с сервером не разошлась — адрес обязан остаться названным.
    await expect(line).toHaveText(`The email will be sent to ${saved}`)
  })

  test('пустой отправитель: письмо не уходит, кнопка объясняет почему', async ({ page }) => {
    await setLang(page, 'en')
    await page.goto('/admin/settings/mail')
    await page.locator('[data-test="settings-mail-from-email"]').fill('')
    await expect(page.locator('[data-test="settings-mail-test-target"]')).toHaveText(
      'The sender address is empty — there is nowhere to send the email',
    )
    await expect(page.locator('[data-test="settings-mail-test-btn"]')).toBeDisabled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Пункт 5 — одинаковые действия в шапке Sales CRM выглядят одинаково
// ═══════════════════════════════════════════════════════════════════════════

test.describe('followups №1 · пункт 5 · шапка Sales CRM', () => {
  test('обе «новые» кнопки одного цвета, обе «списочные» — с одной иконкой', async ({ page }) => {
    await page.goto('/admin/sales-crm')
    const newOrder = page.locator('[data-test="sales-crm-action-new-order"]')
    const newClient = page.locator('[data-test="sales-crm-action-new-client"]')
    await expect(newOrder).toBeVisible()
    await expect(newClient).toBeVisible()
    await expect(newOrder).toHaveClass(/btn-primary/)
    await expect(newClient).toHaveClass(/btn-primary/)

    // Иконка сравнивается по отрисованному содержимому: имя из `name=` в DOM не видно.
    const icon = (sel: string) => page.locator(`${sel} svg`).innerHTML()
    expect(await icon('[data-test="sales-crm-action-clients-list"]')).toBe(
      await icon('[data-test="sales-crm-action-orders-list"]'),
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Пункт 10 — модалка возврата называет, чего не хватает
// ═══════════════════════════════════════════════════════════════════════════

const RETURN_COPY: Record<string, { label: string; needQty: string; needReason: string }> = {
  ru: {
    label: 'Причина возврата',
    needQty: 'Укажите количество хотя бы по одной позиции',
    needReason: 'Заполните причину возврата',
  },
  en: {
    label: 'Reason for the return',
    needQty: 'Enter a quantity for at least one line',
    needReason: 'Fill in the reason for the return',
  },
  lt: {
    label: 'Grąžinimo priežastis',
    needQty: 'Nurodykite kiekį bent vienai eilutei',
    needReason: 'Užpildykite grąžinimo priežastį',
  },
}

test.describe('followups №1 · Л1 · смена языка на лету', () => {
  test('строка про почту переписывается без перезагрузки страницы', async ({ page }) => {
    await setLang(page, 'en')
    await page.goto('/admin/settings/mail')
    const line = page.locator('[data-test="settings-mail-test-target"]')
    await expect(line).toContainText('The email will be sent to')

    // Строка — вычислимое поверх `t()`. Снимись значение однажды, английский
    // текст остался бы на литовской странице.
    await page.locator('[data-test="topbar-lang-switcher"] .lang-btn:has-text("LT")').click()
    await expect(line).toContainText('Laiškas bus išsiųstas adresu')
    await page.locator('[data-test="topbar-lang-switcher"] .lang-btn:has-text("RU")').click()
    await expect(line).toContainText('Письмо уйдёт на')
  })

  /*
   * Подсказки возврата тут нет намеренно. Сменить язык при открытой модалке
   * нельзя: её оверлей перекрывает шапку с переключателем, и клик не доходит —
   * проверено, тест упирался в таймаут. Утверждение о поведении, которого
   * пользователь не может вызвать, — питфолл #66. Языки подсказки проверены
   * ниже по отдельности, каждый со своей загрузки.
   */
})

test.describe('followups №1 · пункт 10 · чего не хватает для возврата', () => {
  for (const [lang, copy] of Object.entries(RETURN_COPY)) {
    test(`подсказка ведёт от пустой формы к активной кнопке — ${lang}`, async ({ page }) => {
      await setLang(page, lang)
      await page.goto('/admin/orders/ORD-004')
      await page.waitForSelector('[data-test="order-shipment-row"]')
      await page.click('[data-test="order-return-btn"]')

      const modal = page.locator('[data-test="return-modal"]')
      const hint = modal.locator('[data-test="return-block-reason"]')
      const confirm = modal.locator('[data-test="return-confirm"]')

      // Звёздочка у метки «Причина возврата» — и ровно одна на модалку.
      await expect(modal.locator('.field-label', { hasText: copy.label })).toHaveCount(1)
      await expect(modal.locator('.required-star')).toHaveCount(1)
      await expect(modal.locator('.required-star')).toBeVisible()

      // Строка стоит НАД кнопками, иначе её не прочитают до нажатия.
      const hb = (await hint.boundingBox())!
      const cb = (await confirm.boundingBox())!
      expect(hb.y + hb.height).toBeLessThanOrEqual(cb.y + 1)

      // 1. ничего не заполнено
      await expect(hint).toHaveText(copy.needQty)
      await expect(confirm).toBeDisabled()

      // 2. количество есть, причины нет
      await modal
        .locator('[data-test="return-line-row"]')
        .first()
        .locator('[data-test="return-line-qty"]')
        .fill('1')
      await expect(hint).toHaveText(copy.needReason)
      await expect(confirm).toBeDisabled()

      // 3. всё готово — строка исчезает, кнопка оживает
      await modal.locator('[data-test="return-reason"]').fill('x')
      await expect(hint).toHaveCount(0)
      await expect(confirm).toBeEnabled()

      // 4. причина из одних пробелов не считается заполненной
      await modal.locator('[data-test="return-reason"]').fill('   ')
      await expect(hint).toHaveText(copy.needReason)
      await expect(confirm).toBeDisabled()
    })
  }
})
