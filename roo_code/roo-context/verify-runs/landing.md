# Журнал цикла проверок: лендинг `/`

План — [landing-plan.md](../../plans/landing/landing-plan.md), ход задач — [progress.md](../../plans/landing/progress.md).

## L-01 — тексты, конфиг, картинки

**Итерация 1.** `npm run verify` → exit 0. Линзы по области задачи (данные, без компонентов):
- Л1 реактивность, Л3 контракт, Л4 мок, Л6 UI/CSS, Л7 роутинг, Л8 сохранение — не применимы: нет компонентов,
  вызовов API, моков и маршрутов.
- Л2 i18n — тексты вне vue-i18n по решению 1; `public.ts` не тронут.
- Л5 один источник — контакты только в `src/config/landing.ts` (греп + спека); тексты лендинга пока
  продублированы ключами `landing.*` в `public.ts` — их удаление в задаче L-03 (рассмотрено, не находка L-01).
- Л9 — 14 инверсий, все красные (таблица в progress.md).
- Л10 — роутер/i18n/флаги не тронуты.

До прогона спека один раз покраснела на своём же тексте: цитата ошибки формы в плане перенесена по строкам.
Починено нормализацией пробелов в спеке; `npm run verify` выше — уже на исправленном дереве, новых находок нет. Свип чистый.

Рассмотрено: `landing.ru.spec.ts:norm:перенос-строки-в-цитате-плана` — починено (схлопывание `\s+`).

## L-03 — каркас, шапка, подвал, язык

**Итерация 1.** `npm run verify` → exit 1: eslint `no-undef HTMLButtonElement` (LandingHeader.vue). Починено.
**Итерация 2.** `npm run verify` → exit 1: `expectUrlBudget.spec.ts` — `toHaveURL` без `DATA_READY_TIMEOUT`
в `landing-shell.spec.ts`. Починено.
**Итерация 3.** verify → exit 0. Узкий e2e (navigation, smoke, i18n, public) → 59 passed. Инверсии: 2 из 13
зелёные (фокус, вылезание) — тесты слепы, переписаны. Тест ширин 320–1440 нашёл вылезание шапки на 769–993 —
починено CSS (≤1200 плотнее, ≤992 навигация второй строкой). Меню на 375 просвечивало hero — фон 0.97.
**Итерация 4.** verify → exit 0 (1281 passed); `tests/e2e/public` → 17 passed; все 15 инверсий красные.
Линзы:
- Л1 — `grep -n "watch(\|useHead(\|structuredClone\|toRaw(" ` по новым файлам: один `useHead` со статическими
  строками (текст не зависит от локали — русский всегда), watch нет. Слушатели снимаются в `onUnmounted`.
- Л2 — `grep -rn "t('landing\." src` пусто; `localeParity.spec.ts` зелёный (внутри verify) после удаления блоков
  `landing` из трёх локалей; новых ключей i18n нет (решение 1).
- Л3/Л4/Л8 — нет вызовов API, моков, сохранения.
- Л5 — тексты только из `landing.ru.ts`, контакты только из `config/landing.ts` (греп адреса заглушки — один файл);
  второй реализации переключателя языка нет: `lang` на лендинге ставит только LandingPage.
- Л6 — все классы `landing-*` под `.page-landing` (греп `class=` новых файлов); каждый компонент импортирует
  `landing.css`; HTML-комментариев в `<template>` нет (`grep -n "<!--" src/components/landing src/views/public/LandingPage.vue` пусто);
  `z-index: 10` у корня над `.bg-overlay` (#5); вылезания нет на 9 ширинах (тест).
- Л7 — `router-link` на `{ name: 'landing' }`, `/login`, `/support`, `/about`, `/terms` — все маршруты есть в
  `router/index.ts`; флагов нет (лендинг публичен, план фаза 8).
- Л9 — 15 инверсий, таблица в progress.md; `grep -rn "await page.waitForLoadState" tests/` пуст.
- Л10 — роутер без новых имён, тронута только `meta` маршрута `/`; dev-сервер поднимается (e2e).
Новых находок в итерации 4 нет — свип чистый. Полный e2e уровня 2 — пара прогонов, результат в progress.md.

Рассмотрено: `LandingHeader.vue:HTMLButtonElement:no-undef` — починено; `landing-shell.spec.ts:toHaveURL:budget` —
починено; `landing-shell.spec.ts:focus:слепой` и `:overflow:слепой` — починено; `landing.css:header:overflow-769-993`
— починено; `landing.css:mobile-menu:просвечивает` — починено.

## L-04 — hero, боли, контур

**Итерация 1.** typecheck/eslint по новым файлам — чисто. e2e `tests/e2e/public` → 25 passed. Скриншоты 1440/900/375 —
замечаний нет.
**Итерация 2 (финальная).** `npm run verify` → exit 0 (1349 passed); e2e check.sh-набора → exit 0, 75 passed;
инверсии — 13, все красные (две переделаны после промаха #71, см. progress.md).
Линзы:
- Л1 — `grep -n "watch(\|useHead(\|structuredClone\|toRaw("` по новым файлам — пусто; слушателей нет.
- Л2 — текстов в шаблонах нет, только интерполяция `landingRu.*`; ключей i18n не добавлено.
- Л3/Л4/Л8 — API, моков и сохранения нет.
- Л5 — правило языка демо в одном месте (`useLandingDemoLang.ts`); `grep -rn "flexiron_lang" src --include=*.vue --include=*.ts`
  — прежние места (LangSwitcher, AdminTopbar, AdminSidebar — выбор человека) + композабл; иконки лендинга — один компонент.
- Л6 — классы `landing-*` под `.page-landing`; каждый компонент импортирует `landing.css`; `<!--` в шаблонах нет;
  вылезания нет на 9 ширинах (тест L-03).
- Л7 — `router-link` на `/admin` (маршрут есть, `router/index.ts:84`, редирект на дашборд); якорь `#lead` существует.
- Л9 — инверсии в progress.md; `grep -rn "await page.waitForLoadState" tests/` — 0.
- Л10 — роутер не тронут; dev-сервер поднимается (e2e).
Новых находок в итерации 2 нет — свип чистый.
Рассмотрено: `landing-hero-pains-flow.spec.ts:inversion-cdn:промах` и `:inversion-icon-img:промах` — инверсии переделаны.
