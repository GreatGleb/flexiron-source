import { test, expect } from './fixtures'
import { navigateToAdmin } from './helpers/admin'

/**
 * Полосы прокрутки: правка для Firefox не должна ничего менять в Chrome.
 *
 * Набор гоняется в одном движке — Chromium (`playwright.config.ts`, projects). Значит
 * САМ вид полосы в Firefox отсюда не проверить, и делать вид, что проверяем, нельзя.
 * Firefox проверен вручную в headed-режиме и записан замером в журнале пункта 12:
 * `:root` получает `thin` и синий, `.nav` — `none`, `.terms-content` — `thin`.
 *
 * Здесь сторожатся ровно две вещи, которые Chromium проверить МОЖЕТ:
 *
 * 1. решение владельца «Chrome не трогаем» — вычисленные свойства остаются `auto`.
 *    Держится это построением: внутрь `@supports not selector(::-webkit-scrollbar)`
 *    webkit-движки не заходят. Тест краснеет, если кто-то решит «унифицировать»;
 * 2. что файл вообще подключён. Стиль, который перестали импортировать, не роняет
 *    ни сборку, ни typecheck, ни один прочий тест — он просто молча перестаёт
 *    действовать, и в Firefox полосы тихо возвращаются к системным.
 *
 * ВАЖНО про headless: у Firefox headless принудительно ставит `scrollbar-width: none`
 * ВСЕМУ подряд — проверено на пустой странице без нашего CSS. То есть замер полос в
 * headless подтвердил бы «полоса спрятана» и до всякой правки. Если этот тест когда-то
 * решат гонять в Firefox, замерять надо headed.
 */
test.describe('scrollbars', () => {
  test('Chrome остаётся нетронутым — блок за @supports ему не достаётся', async ({ page }) => {
    await navigateToAdmin(page, '/admin/analytics/dashboard')

    const m = await page.evaluate(() => {
      const cs = (el: Element | null) =>
        el
          ? {
              width: getComputedStyle(el).scrollbarWidth,
              color: getComputedStyle(el).scrollbarColor,
            }
          : null
      return {
        knowsWebkit: CSS.supports('selector(::-webkit-scrollbar)'),
        root: cs(document.documentElement),
        nav: cs(document.querySelector('.nav')),
      }
    })

    // Условие, на котором держится вся развилка: Chromium селектор знает, значит
    // внутрь `not selector(...)` не заходит.
    expect(m.knowsWebkit).toBe(true)
    expect(m.root).toEqual({ width: 'auto', color: 'auto' })
    // Боковое меню тоже: прячет полосу webkit-правилом, а не стандартным свойством.
    expect(m.nav).toEqual({ width: 'auto', color: 'auto' })
  })

  test('файл для Firefox подключён и содержит то, ради чего написан', async ({ page }) => {
    await navigateToAdmin(page, '/admin/analytics/dashboard')

    const rule = await page.evaluate(() => {
      for (const sheet of [...document.styleSheets]) {
        let rules: CSSRuleList
        try {
          rules = sheet.cssRules
        } catch {
          continue // чужой origin — не наш файл
        }
        for (const r of [...rules]) {
          if (r.constructor.name !== 'CSSSupportsRule') continue
          const s = r as CSSSupportsRule
          if (!s.conditionText.includes('webkit-scrollbar')) continue
          return { condition: s.conditionText, body: [...s.cssRules].map((x) => x.cssText) }
        }
      }
      return null
    })

    // Блок существует…
    expect(rule).not.toBeNull()
    // …и это именно проверка ВОЗМОЖНОСТИ, а не определение браузера по имени.
    expect(rule!.condition.replace(/\s+/g, '')).toBe('notselector(::-webkit-scrollbar)')
    // …и внутри действительно то, чего Firefox не хватало.
    const body = rule!.body.join(' ')
    expect(body).toContain('scrollbar-color')
    expect(body).toContain('scrollbar-width')
    // Боковое меню прячет полосу — это и было хуже цвета.
    expect(body).toMatch(/\.nav[^}]*scrollbar-width:\s*none/)
  })
})
