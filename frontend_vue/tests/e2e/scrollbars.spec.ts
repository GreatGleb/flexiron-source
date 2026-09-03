import { test, expect } from './fixtures'
import { navigateToAdmin } from './helpers/admin'

/**
 * Полосы прокрутки: правка для Firefox не должна ничего менять в Chrome.
 *
 * Набор гоняется в одном движке — Chromium (`playwright.config.ts`, projects). Значит
 * САМ вид полосы в Firefox отсюда не проверить, и делать вид, что проверяем, нельзя.
 *
 * И одного «проверено в Firefox» тоже мало — на этом пункт уже обжёгся. Первая версия
 * правки стояла за `@supports not selector(::-webkit-scrollbar)`, была принята замером в
 * плейрайтовском Firefox 148 и НЕ РАБОТАЛА у владельца на стоковом 154: 154-й селектор
 * разбирает (webkit-совместимость), поэтому условие у него ложно, а красить им он
 * по-прежнему не умеет — блок отключался целиком. Вывод для будущих проверок: «Firefox»
 * в Playwright и «Firefox» у человека — разные сборки, и утверждения о поддержке
 * проверяются стоковым бинарником, а не тем, что привёз Playwright.
 *
 * Поэтому сторож теперь не про слова движка, а про отрисовку: спросить нельзя вовсе —
 * `CSS.supports('selector(::-webkit-scrollbar)')` и вычисленная ширина псевдоэлемента в
 * Firefox 154 отвечают ровно то же, что в Chrome. Проба в `main.ts` даёт пробнику
 * webkit-полосу в 24px и смотрит на занятое место: 24 — правило красит (Chrome);
 * 0 — полосы накладные и места не занимают, красить нечего; иное (у Firefox 12px) —
 * движок рисует свою поверх нашего правила, ему и нужны стандартные свойства.
 *
 * Замер на стоковом Firefox 154 (geckodriver, настоящий курсор): признак встаёт, `:root`
 * получает синий, `.nav` — `none` с жёлобом 0.
 *
 * Толщину файл НЕ задаёт — решение владельца 2026-08-30. `scrollbar-width` знает только
 * `thin`, `auto` и `none`: `thin` давало жёлоб 6px как в Chrome, но ползунок 4px против
 * хромовских 5px; `auto` (значение по умолчанию, потому и не объявляется) даёт ползунок
 * 6px ценой жёлоба в 12px. Владелец выбрал ползунок.
 *
 * Цвет в Firefox светлее webkit-овского намеренно — 0.7 против 0.5, тоже решение
 * владельца. Firefox сам ЗАТЕМНЯЕТ ползунок под курсором, Chrome наоборот светлит, и
 * отменить затемнение нечем: состояния у полосы в CSS нет, а `:hover` на контейнере
 * уводит цвет покоя. 0.7 — наименьшая база, при которой Firefox под курсором
 * (`rgb(2,79,147)`) уже не темнее, чем Chrome в покое (`rgb(17,81,144)`). Причина и все
 * замеры — во врезке `scrollbars-firefox.css`; здесь это не проверить, движок не тот.
 *
 * Здесь сторожатся три вещи, которые Chromium проверить МОЖЕТ:
 *
 * 1. решение владельца «Chrome не трогаем» — вычисленные свойства остаются `auto`;
 * 2. что проба работает и убирает за собой;
 * 3. что файл вообще подключён. Стиль, который перестали импортировать, не роняет
 *    ни сборку, ни typecheck, ни один прочий тест — он просто молча перестаёт
 *    действовать, и в Firefox полосы тихо возвращаются к системным.
 *
 * ВАЖНО про headless, иначе замеры отсюда прочтут неверно. Полосы там накладные и места
 * не занимают ВОВСЕ: в headless Chromium жёлоб 0 при любом нашем `width` (headed — 24),
 * а плейрайтовский Firefox и headed даёт 0, тогда как стоковый — 12. То есть первый тест
 * ниже подтверждает «Chrome не тронут» по ветке «накладные полосы», а не по ветке
 * «webkit красит»; вторая проверена руками на headed Chromium и записана здесь.
 */
test.describe('scrollbars', () => {
  test('Chrome остаётся нетронутым — признак ему не ставится', async ({ page }) => {
    await navigateToAdmin(page, '/admin/analytics/dashboard')

    const m = await page.evaluate(() => {
      const cs = (el: Element | null) =>
        el
          ? {
              width: getComputedStyle(el).scrollbarWidth,
              color: getComputedStyle(el).scrollbarColor,
            }
          : null

      // Занимает ли место наша webkit-полоса — та самая проба, на которой держится
      // развилка. Правило то же, что в `main.ts`.
      const style = document.createElement('style')
      style.textContent = '.probe-in-test::-webkit-scrollbar{width:24px}'
      const probe = document.createElement('div')
      probe.className = 'probe-in-test'
      probe.style.cssText =
        'position:absolute;top:-9999px;width:100px;height:100px;overflow-y:scroll'
      document.head.append(style)
      document.body.append(probe)
      const gutter = probe.offsetWidth - probe.clientWidth
      probe.remove()
      style.remove()

      return {
        attr: document.documentElement.dataset.scrollbars,
        root: cs(document.documentElement),
        nav: cs(document.querySelector('.nav')),
        gutter,
      }
    })

    expect(m.attr).toBeUndefined()
    expect(m.root).toEqual({ width: 'auto', color: 'auto' })
    // Боковое меню тоже: прячет полосу webkit-правилом, а не стандартным свойством.
    expect(m.nav).toEqual({ width: 'auto', color: 'auto' })
    // 24 — наше правило красит, 0 — полосы накладные. Chromium даёт одно из двух в
    // зависимости от headless; чего быть не должно — это третьего значения, потому что
    // оно означало бы «движок рисует свою полосу поверх нашей», то есть Chrome нас
    // больше не слушает.
    expect([0, 24]).toContain(m.gutter)
  })

  test('проба не оставляет за собой мусора в DOM', async ({ page }) => {
    await navigateToAdmin(page, '/admin/analytics/dashboard')

    // Пробник живёт доли миллисекунды до монтирования; к моменту готовой страницы от
    // него не должно остаться ни элемента, ни временного стиля.
    await expect(page.locator('.scrollbar-probe')).toHaveCount(0)
    const leftoverStyle = await page.evaluate(() =>
      [...document.querySelectorAll('style')].some((s) =>
        (s.textContent ?? '').includes('scrollbar-probe'),
      ),
    )
    expect(leftoverStyle).toBe(false)
  })

  test('файл для Firefox подключён и содержит то, ради чего написан', async ({ page }) => {
    await navigateToAdmin(page, '/admin/analytics/dashboard')

    const rules = await page.evaluate(() => {
      const found: string[] = []
      for (const sheet of [...document.styleSheets]) {
        let list: CSSRuleList
        try {
          list = sheet.cssRules
        } catch {
          continue // чужой origin — не наш файл
        }
        for (const r of [...list]) {
          if (!(r instanceof CSSStyleRule)) continue
          if (r.selectorText.includes('data-scrollbars')) found.push(r.cssText)
        }
      }
      return found
    })

    // Правила существуют…
    expect(rules.length).toBeGreaterThan(0)
    const body = rules.join(' ')
    // …и внутри действительно то, чего Firefox не хватало.
    expect(body).toContain('scrollbar-color')
    expect(body).toContain('scrollbar-width')
    // Боковое меню прячет полосу — это и было хуже цвета.
    expect(body).toMatch(/\.nav[^}]*scrollbar-width:\s*none/)
    // Сторож — атрибут, а не разбор селектора: `@supports not selector(::-webkit-scrollbar)`
    // Firefox 154 проходит, и правка становится мёртвой.
    expect(body).not.toContain('webkit-scrollbar')
  })
})
