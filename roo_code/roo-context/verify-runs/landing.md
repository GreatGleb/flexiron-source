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

## L-05 — фичи и настройка

**Итерация 1 (финальная).** `npm run verify` → exit 0 (1349 passed); e2e check.sh-набора → exit 0, 83 passed;
инверсии — 14, все красные (progress.md, раздел L-05).
Линзы:
- Л1 — `grep -n "watch(\|useHead(\|structuredClone\|toRaw("` по LandingFeature/LandingConfig — пусто; состояния нет.
- Л2 — текстов в шаблонах нет, только интерполяция полей `landingRu`; ключей i18n не добавлено.
- Л3/Л4/Л8 — API, моков и сохранения нет.
- Л5 — секции 4–10 рисует один компонент; `ls src/components/landing | grep -iE "warehouse|cutting|order|money|supplier|analytic"`
  — пусто; data-test секций порождается только `LandingFeature.vue` (греп по `src/`); рамка скриншота — `LandingShot` из L-04,
  иконки — `LandingIcon`; jscpd клонов в файлах лендинга не нашёл.
- Л6 — классы `landing-*` под `.page-landing`; `grep -L "landing.css" src/components/landing/*.vue` — пусто; `<!--` в шаблонах нет;
  `scrollWidth` = ширине окна на 375/900/1440, тест L-03 на 320…1440 зелёный.
- Л7 — ссылок и маршрутов задача не добавляет.
- Л9 — 14 инверсий, по одной на утверждение; `grep -rn "await page.waitForLoadState" tests/` — 0.
- Л10 — роутер не тронут; dev-сервер поднимается (e2e).
Новых находок нет — свип чистый. Открытый вопрос владельцу (не находка): надзаголовки фич.

## L-08 — адаптив и доступность

**Итерация 1.** Новая спека `landing-layout.spec.ts` на текущем коде: 1 failed — фокус полей формы невидим
(`landing-lead-input:focus { outline: none }`, только смена цвета рамки). Починено общим правилом фокуса.
Отдельный замер контраста (скрипт `/tmp/l08/contrast2.mjs` + `.py`, весь текст спрятан, фон снят целиком,
121 элемент на 1440 / 115 на 375): белый текст основных кнопок на градиенте — 3.59 при норме 4.5. Починено
сдвигом светлого края градиента (смесь токенов). Находки: `landing.css:landing-lead-input:focus:focus-invisible`,
`landing.css:landing-btn--primary:contrast` — обе починены.
Инверсия 0 нашла слепоту теста: `documentElement.scrollWidth` равен окну при любом содержимом (прокручиваемая
коробка — body). Тест дополнен `body.scrollWidth` — `landing-layout.spec.ts:no-horizontal-scroll:blind` починено.

**Итерация 2 (финальная, после последней правки).** `npm run verify` → exit 0 (92 файла, 1364 passed, 3 skipped);
e2e check.sh-набора → exit 0, 119 passed, failed/flaky нет; повторный замер контраста — ниже AA ничего, кроме
артефакта замера у h1 (текст не спрятался; по фону без текста — ~10:1).
Линзы:
- Л1 — `grep -n "watch(\|useHead(\|structuredClone\|toRaw("` по изменённому — изменены только CSS и спеки; пусто.
- Л2 — текстов не добавлено.
- Л3/Л4/Л8 — API, моков и сохранения задача не касается.
- Л5 — правило фокуса одно (`.page-landing :is(a, button, input, textarea):focus-visible`), прежнее
  `.landing-btn:focus-visible` удалено; тесты меню и ширин перенесены из `landing-shell.spec.ts`, а не скопированы
  (`grep -rn "landing-menu-toggle\|nothing sticks out" tests/e2e | grep -v landing-layout` — пусто).
- Л6 — селекторы под `.page-landing`; синий — только из `--primary`/`--primary-dark` (`color-mix` двух токенов);
  `grep -rn "<!--" src/components/landing/` — 0.
- Л7 — маршрутов не добавлено.
- Л9 — 13 инверсий + ручная (progress.md, L-08); `grep -rn "await page.waitForLoadState" tests/` — 0.
- Л10 — роутер не тронут; dev-сервер поднимается (e2e).
Новых находок нет — свип чистый.
