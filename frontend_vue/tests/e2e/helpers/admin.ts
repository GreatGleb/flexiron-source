import { expect, type Page } from '@playwright/test'
import { waitForDataReady } from './ready'

export async function navigateToAdmin(page: Page, path = '/admin/analytics/dashboard') {
  await page.goto(path)
  await waitForDataReady(page)
}

/**
 * Открыть страницу админки и дождаться ПРИЗНАКА ПРИШЕДШИХ ДАННЫХ (питфолл #64).
 *
 * `waitForLoadState('networkidle')` в этом приложении врёт по построению: под моками
 * сетевого запроса нет вовсе — `services/mocks/index.ts` отвечает из `setTimeout`, —
 * поэтому «грузиться нечему» становится правдой РАНЬШЕ данных. Замерено: в этот
 * момент панель графиков дашборда держит ноль полос, а страница настройки карточки
 * поставщика — вообще ничего. Хуже всего то, как это падает: пустая панель ровно
 * той же высоты, что полная, и снимок с неё — не очевидно пустая картинка, а
 * пиксельный дифф, который читается как регресс вёрстки в нетронутом коде.
 *
 * `navigateToAdmin` — пол: он знает, что мок ответил вообще. `marker` — потолок:
 * элемент, которого без ЭТИХ данных не существует (первая строка таблицы, карточка
 * KPI, шапка сущности). Там, где ноль — законный ответ, маркером служит контейнер,
 * который рисуется и при нуле; первую строку в таком месте ждать нельзя, её не
 * будет никогда.
 */
export async function openAdminPage(page: Page, path: string, marker: string) {
  await navigateToAdmin(page, path)
  await expect(page.locator(marker).first()).toBeVisible()
}

/**
 * То же для карточки сущности, где признак — НЕПУСТОЕ ЗНАЧЕНИЕ поля.
 *
 * Нарисованная форма сама по себе не доказывает ничего: она существует и пустой,
 * пока сущность не пришла, — а тест, который правит это поле, до загрузки пишет в
 * него значение, которое `load()` тут же затрёт.
 */
export async function openAdminCard(page: Page, path: string, fieldSelector: string) {
  await navigateToAdmin(page, path)
  await expect(page.locator(fieldSelector)).not.toHaveValue('')
}

export async function switchLanguage(page: Page, lang: 'ru' | 'en' | 'lt') {
  await page.evaluate((l) => {
    localStorage.setItem('flexiron_lang', l)
  }, lang)
  await page.reload()
  await waitForDataReady(page)
}

export async function waitForPanelsLoaded(page: Page) {
  // A visible `.glass-panel` proves the panel exists, not that it holds anything —
  // a panel drawing a skeleton is visible too.
  await page.waitForSelector('.glass-panel', { state: 'visible' })
  await waitForDataReady(page)
}

export async function setFeatureFlag(page: Page, flag: string, value: boolean) {
  await page.evaluate(
    ({ f, v }) => {
      const existing = JSON.parse(localStorage.getItem('ff_overrides') || '{}')
      existing[f] = v
      localStorage.setItem('ff_overrides', JSON.stringify(existing))
    },
    { f: flag, v: value },
  )
  await page.reload()
  await waitForDataReady(page)
}
