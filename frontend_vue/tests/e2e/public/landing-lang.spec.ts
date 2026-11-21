import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import { DATA_READY_TIMEOUT } from '../helpers/ready'

/**
 * Языки лендинга (этап 2, пункт 4 — roo_code/plans/landing/landing-stage-2-plan.md): у каждого
 * свой адрес — `/lt` (корень ведёт сюда), `/en`, `/ru`; в шапке переключатель только LT / EN.
 *
 * Уход в программу (демо, вход) — на языке той версии, с которой ушли, даже поверх выбора,
 * сделанного раньше в программе (решение владельца 2026-11-21).
 *
 * Язык виден в четырёх местах сразу — заголовок h1, `<html lang>`, `<title>` и папка скриншота;
 * проверяются все, иначе «переключилось» могло бы значить «поменялась одна подпись».
 */

const H1 = {
  lt: 'Metalo bazės sandėlis, pjaustymas, užsakymai ir pinigai — vienoje sistemoje',
  en: 'Stock, cutting, orders and money of a metal stockholder — in one system',
  ru: 'Склад, резка, заказы и деньги металлобазы — в одной системе',
} as const

const TITLE = {
  lt: 'Flexiron — ERP/CRM metalo bazėms ir metalo centrams',
  en: 'Flexiron — ERP/CRM for metal stockholders and service centres',
  ru: 'Flexiron — ERP/CRM для металлобаз и металлоцентров',
} as const

type Lang = keyof typeof H1

async function expectLanguage(page: Page, lang: Lang) {
  await expect(page).toHaveURL(`/${lang}`, { timeout: DATA_READY_TIMEOUT })
  await expect(page.locator('h1')).toHaveText(H1[lang])
  await expect(page.locator('html')).toHaveAttribute('lang', lang)
  await expect(page).toHaveTitle(TITLE[lang])
  await expect(page.getByTestId('landing-hero').locator('img').first()).toHaveAttribute(
    'src',
    new RegExp(`/landing/${lang}/dashboard`),
  )
}

test.describe('landing languages', () => {
  test('the root opens the Lithuanian landing', async ({ page }) => {
    await page.goto('/')
    await expectLanguage(page, 'lt')
    await expect(page.getByTestId('landing-lang-lt')).toHaveAttribute('aria-current', 'page')
    await expect(page.getByTestId('landing-lang-en')).not.toHaveAttribute('aria-current', 'page')
  })

  test('the switcher goes to English and back without reloading the page', async ({ page }) => {
    await page.goto('/lt')
    await expectLanguage(page, 'lt')
    // Метка на window пропадёт при перезагрузке: переход должен быть внутри SPA.
    await page.evaluate(() => ((window as unknown as { __same: boolean }).__same = true))

    await page.getByTestId('landing-lang-en').click()
    await expectLanguage(page, 'en')
    await expect(page.getByTestId('landing-lang-en')).toHaveAttribute('aria-current', 'page')
    await expect(page.getByTestId('landing-nav-link').first()).toHaveText('Features')
    await expect(page.getByTestId('landing-lead-submit')).toHaveText('Send request')

    await page.getByTestId('landing-lang-lt').click()
    await expectLanguage(page, 'lt')
    await expect(page.getByTestId('landing-lead-submit')).toHaveText('Siųsti užklausą')
    expect(await page.evaluate(() => (window as unknown as { __same?: boolean }).__same)).toBe(true)
  })

  test('/ru is Russian, and the switcher offers only LT and EN', async ({ page }) => {
    await page.goto('/ru')
    await expectLanguage(page, 'ru')
    const links = page.getByTestId('landing-lang').locator('a')
    await expect(links).toHaveText(['LT', 'EN'])
    await expect(page.getByTestId('landing-lang').locator('[aria-current="page"]')).toHaveCount(0)
  })

  test('opened directly, /en is English', async ({ page }) => {
    await page.goto('/en')
    await expectLanguage(page, 'en')
  })

  test('after switching to EN, the demo opens in English over an earlier choice', async ({
    page,
  }) => {
    await page.goto('/lt')
    await expectLanguage(page, 'lt')
    // Раньше человек выбрал в программе русский; лендинг этого не трогает, пока с него не ушли.
    await page.evaluate(() => localStorage.setItem('flexiron_lang', 'ru'))
    await page.getByTestId('landing-lang-en').click()
    await expectLanguage(page, 'en')
    expect(await page.evaluate(() => localStorage.getItem('flexiron_lang'))).toBe('ru')

    await page.getByTestId('landing-hero-demo').click()
    await expect(page).toHaveURL(/\/admin\//, { timeout: DATA_READY_TIMEOUT })
    expect(await page.evaluate(() => localStorage.getItem('flexiron_lang'))).toBe('en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })

  test('from /lt, log-in opens in Lithuanian', async ({ page }) => {
    await page.goto('/lt')
    await expectLanguage(page, 'lt')
    await page.getByTestId('landing-login').first().click()
    await expect(page).toHaveURL('/login', { timeout: DATA_READY_TIMEOUT })
    await expect(page.locator('html')).toHaveAttribute('lang', 'lt')
    expect(await page.evaluate(() => localStorage.getItem('flexiron_lang'))).toBe('lt')
  })

  test('from /ru, the demo opens in Russian', async ({ page }) => {
    await page.goto('/ru')
    await expectLanguage(page, 'ru')
    await page.getByTestId('landing-demo-open').scrollIntoViewIfNeeded()
    await page.getByTestId('landing-hero-demo').click()
    await expect(page).toHaveURL(/\/admin\//, { timeout: DATA_READY_TIMEOUT })
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  })
})
