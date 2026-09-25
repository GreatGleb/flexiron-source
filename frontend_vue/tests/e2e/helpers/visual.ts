import type { Locator, Page } from '@playwright/test'
import { DATA_READY_TIMEOUT, waitForDataReady } from './ready'

/**
 * Standard options for per-section visual snapshots. Disables animations and
 * hides caret to avoid pixel churn from blinking input cursor.
 *
 * `threshold` сюда НЕ добавлять: он живёт в `playwright.config.ts`, потому что часть
 * эталонов (`layout.spec.ts`) снимается вообще без опций и правка здесь их не достала
 * бы. Второй экземпляр того же правила разошёлся бы с первым молча.
 *
 * `timeout`, наоборот, живёт ТОЛЬКО здесь, и не по выбору: в конфиге у блока
 * `expect.toHaveScreenshot` такого ключа нет вовсе — он есть лишь у самого вызова
 * (замер: `node_modules/playwright/types/test.d.ts`, блок конфига на 1129 знает
 * `animations · caret · maxDiffPixels · maxDiffPixelRatio · scale · stylePath ·
 * threshold · pathTemplate`, а опции вызова на 9291 — ещё и `timeout`). Поэтому
 * условие такое: каждый вызов обязан взять эти опции, и сторожит это
 * `src/services/snapshotBudget.spec.ts`, а не память.
 *
 * ПОЧЕМУ бюджет вообще нужен — питфолл #70 в чистом виде, только не у ожидания
 * данных, а у снимка. Потолок теста — 90 секунд, а дефолтный потолок `expect` — 5,
 * и он не растягивается вместе с нагрузкой. В эти 5 секунд укладывается ВСЁ:
 * скролл элемента в вид, ожидание шрифтов, съёмка и сравнение — а Playwright, если
 * первый снимок разошёлся с эталоном, снимает ещё раз и ещё, пока два подряд не
 * совпадут (`page.js:542`, цикл `pollIntervals = [0, 100, 250, 500]`).
 *
 * Замер 2026-09-25 на загруженной машине (load ~28), время ОДНОЙ съёмки:
 *
 *   элемент                      rate 1        rate 20        rate 40
 *   clients-table-panel  1104x1141   2.0–3.3 с   5.0–7.6 с    8.8–11.4 с
 *   suppliers-table-panel 1104x467   1.3–2.2 с   3.8–5.8 с    4.5–5.9 с
 *   layout-shell-375      375x2888   1.0–1.5 с   2.9–4.5 с    4.9–7.2 с
 *   clients-header         1104x58   1.1–2.1 с   3.0–3.6 с    4.6–6.1 с
 *
 * То есть под нагрузкой пяти секунд не хватает даже на ОДНУ съёмку — и падает не
 * тот снимок, у которого что-то не так, а тот, кому не повезло с моментом. Так
 * это и выглядело: «каждый прогон краснеет своё», «Failed to take two consecutive
 * stable screenshots». Проверено инверсией: при испорченном на 3 % эталоне под
 * нагрузкой вместо честного диффа приходит `Timeout 5000ms exceeded`, и вместе с
 * ним краснеет `clients-header`, у которого эталон в порядке.
 *
 * Число берётся из `ready.ts` и живёт в одном экземпляре: 30 с на данные плюс 30 с
 * на снимок — это ровно тот запас, под который в `playwright.config.ts` посчитан
 * потолок теста в 90 секунд. На успехе бюджет не стоит ничего: цикл возвращается,
 * как только снимок совпал. Платит только падающий тест.
 */
export const SNAPSHOT_OPTIONS = {
  animations: 'disabled',
  caret: 'hide',
  maxDiffPixelRatio: 0.01,
  timeout: DATA_READY_TIMEOUT,
} as const

/** Wait for fonts to be ready — prevents FOIT-induced pixel diffs. */
export async function waitForFontsReady(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
  })
}

/**
 * Wait for an element, its data and its fonts before a snapshot.
 *
 * The data wait is the one that matters: an element can be visible and empty, and
 * an empty panel is the same size as a full one, so the diff looks like a layout
 * change rather than a missing answer.
 */
export async function stabilizeForSnapshot(page: Page, locator: Locator) {
  await locator.waitFor({ state: 'visible' })
  await waitForDataReady(page)
  await waitForFontsReady(page)
}
