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

## L-09 — сквозная спека, сборка демо, финальный свип

Область — весь лендинг, Л1–Л10. Вход каждой итерации — `npm run verify`.

**Итерация 1.** Новая `tests/e2e/public/landing.spec.ts`. Находки:
- `landing.spec.ts:visual:style-option-ignored` — у `toHaveScreenshot` нет опции `style` (только `stylePath`,
  `node_modules/playwright/types/test.d.ts`), шапка легла в снимки чужих секций. Починено: стиль на страницу
  (`addStyleTag`), окно 1280×1100 выше самой высокой секции (971 px). Эталоны переснят.
- `landing.spec.ts:visual:scroll-dependent-backdrop` — инверсия «сдвиг padding hero/pains/flow» покрасила снимки
  шести НЕтронутых секций: фон `.bg-image` фиксирован, сквозь стекло видно то, что под секцией в окне, а
  `scrollIntoViewIfNeeded` ставил секцию куда выходило. Починено: верх секции — к верху окна перед съёмкой.
  Повторная инверсия с ЦЕЛЫМ сдвигом (`margin-top: 10px`) — красный только hero, 14 зелёных. С дробным сдвигом
  (8vw = 102.4 px → 96) нижние секции краснеют и после правки: субпиксельное положение меняет растр — это
  свойство страницы, а не теста; записано в «Не проверено» progress.md.
- `landing.spec.ts:anchors:poll-satisfied-by-inaction` — первый вариант ждал «верх секции ≥ низа шапки», что
  истинно и до клика (секция ниже окна) — #68, найдено чтением до прогона. Условие сведено в одно с двумя краями.
- `expectUrlBudget.spec.ts` (в `npm run verify`) — `toHaveURL` якорей без `DATA_READY_TIMEOUT`. Починено.
`npm run verify` после правок → exit 0 (92 файла, 1364 passed, 3 skipped).

**Итерация 2 (финальный свип).** `npm run deadcode` (вне гейта): у лендинга 1 экспорт + 7 типов без внешнего
импорта (`useLandingLead.ts:LEAD_FIELDS`, `types/landing.ts:LandingAnchor…LandingFormField`) — каждый используется
только внутри своего файла (`grep -rlw` по src и tests). `export` снят: `deadcode` → по лендингу 0 (всего 56
экспортов / 27 типов — чужие, гейт и до правки красный). `npm run verify` → exit 0 (92 / 1364 / 3 skipped).
Линзы на этом дереве:
- Л1 — `grep -rn "structuredClone\|toRaw(\|useHead(\|watch("` по LandingPage, components/landing, useReveal,
  content, config, domain → одно вхождение: `useHead` со статическим заголовком из модуля текстов (данных нет, #54
  не применим).
- Л2 — `grep -n "landing\." src/i18n/public.*` → пусто (тексты в `content/landing.ru.ts`, решение 1);
  localeParity внутри verify зелёный.
- Л3 — эндпоинтов нет; `landingLeadService.ts:25` — POST `text/plain`, его держит `landingLeadService.spec.ts`.
- Л4 — `grep -rln landing src/services/mocks/` → два посторонних слова («landing day», «landing in the feed»).
- Л5 — порядок секций и якоря шапки ПЕРЕНЕСЕНЫ из `landing-shell.spec.ts`, не скопированы:
  `grep -rln "SECTION_ORDER\|landing-footer-link\|'#features'" tests/` → только `landing.spec.ts`.
- Л6 — `grep -rn "<!--"` по компонентам и странице → 0; `grep -L landing.css src/components/landing/*.vue` → 0;
  классы в шаблонах — только `landing-*` (остальное в выводе — выражения `:class`).
- Л7 — `name: 'landing'` в роутере есть; повторы имён в `grep -o "name: '…'" | uniq -d` — ссылки
  (`redirect`, `return { name }`), не определения; `<a>` без `#`-якоря — только `tel:` в LandingContacts.
- Л8 — форма не менялась.
- Л9 — 20 инверсий (progress.md, L-09); `grep -rn "await page.waitForLoadState" tests/` → 0.
- Л10 — роутер не тронут; dev-сервер поднимается (e2e); `npm run build` exit 0.
Новых находок нет — свип чистый.

---

# Этап 2, пункт 1: капча Turnstile + Telegram + таблица (2026-11-21, интерактивно)

Область: `apps-script/landing-leads/` (Code.gs, README), форма заявки — `useLandingLead`, новые
`useTurnstile` и `services/turnstile.ts`, тексты и типы, `landing.css`; e2e `landing-lead`,
`landing-layout` и подставной Turnstile `tests/e2e/public/turnstileStub.ts`. План —
`roo_code/plans/landing/landing-stage-2-plan.md`, пункт 1.

## Итерация 1

Машинная приёмка: `npm run verify` — красный: TS6133 (строковый `ref="captchaBox"` vue-tsc не видит →
функциональный `:ref`), TS7053 в спеке; затем prettier на 2 файла; затем `landing.ru.spec` —
новые тексты капчи не из источника. Починено: тексты записаны в план этапа 2, план добавлен в SOURCES
спеки. Находка спеки домена: обрезка до 4096 в `telegramText` недостижима (поля ограничены, страница —
META_MAX) — обрезка убрана, вместо неё тест «самая длинная допустимая заявка влезает в 4096».

## Итерация 2

- `npm run verify` exit 0: 93 файла, 1395 passed / 3 skipped.
- e2e `tests/e2e/public` на PW_PORT=5373: 99 passed, exit 0 (ур. 1 — правка в одной области; общий пол
  не тронут: helpers/, fixtures, playwright.config без изменений, подмена Turnstile — файл рядом со спеками).
- Л1 — `watch(captcha.token)` на ref, без getter/toRaw; `onBeforeUnmount` снимает виджет.
- Л2 — тексты в `landing.ru.ts`, источник — план; i18n не тронут.
- Л3 — Code.gs: siteverify `post` + `muteHttpExceptions`; Telegram `post` JSON; фронт — тот же `text/plain`.
- Л5 — «нужен ли токен» решает одна функция `required` (форма → composable); правило полей не дублировано.
- Л6 — новые классы `landing-lead-captcha`; комментариев в шаблоне нет.
- Л8 — неверная форма о капче молчит (сначала поля); после отказа сервера введённое остаётся, токен новый.
- Л9 — инверсии, все красные: Code.gs без проверки капчи (6 failed), токен бота в журнале (1), без
  столбца Telegram (5), форма шлёт без токена (1), без сброса после отказа (1), без автоотправки (1),
  загрузчик без повтора (3); e2e — капча грузится со страницей → «first touch» failed.
- Л10 — настоящий виджет на временном dev-сервере (5390, подставной адрес заявок): статус `ready`,
  русский, тёмная тема, ошибок страницы нет. Headless-браузеру Cloudflare показал галочку — Managed.

Не проверено: Code.gs в настоящем Apps Script (ставит владелец по README), настоящий siteverify и
настоящий Telegram — первая живая заявка после установки.

Новых находок нет — свип чистый.

---

# Этап 2, пункт 2: почта → Telegram (2026-11-21, интерактивно)

Область: `apps-script/mail-to-telegram/` (Code.gs, README), спека
`frontend_vue/src/services/appsScriptMailToTelegram.spec.ts` (исполнение Code.gs в `node:vm`).
Фронтенд не тронут — линзы Л1, Л2, Л4, Л6–Л8 неприменимы.

## Итерация 1

- Спека 19/19; `npm run verify` exit 0: 94 файла, 1414 passed / 3 skipped.
- Л3 — Telegram: `post`, `muteHttpExceptions`; текст JSON, файл multipart (без contentType — его ставит
  UrlFetchApp для Blob). Опции собираются без ключа `contentType: undefined` — его поведение в
  UrlFetchApp не задокументировано.
- Л5 — `setup` и `stop` снимают триггер одним и тем же условием по имени обработчика; второго места
  правила «какие письма новые» нет.
- Л9 — инверсии, все красные: сбой Telegram двигает границу (3 failed), нет учёта той же секунды (3),
  пересылка не из «Входящих» (1), токен в журнале (1), без предела 20 за запуск (1), работа без setup (1),
  без сортировки по времени (1), setup не снимает старый триггер (1).
- Л10 — `new Function(Code.gs)` разбирается (через vm в спеке).

Не проверено: поиск Gmail `after:<секунды>` и `getAttachments({includeInlineImages:false})` в настоящем
Apps Script — заглушка повторяет документированное поведение; первая живая пересылка после установки.

Новых находок нет — свип чистый.

---

# Этап 2, пункт 4: языки лендинга, язык программы по лендингу, скрытый русский (2026-11-21, интерактивно)

Область: маршруты `/lt` `/en` `/ru` (корень → `/lt`), `useLandingContent`, тексты `landing.{lt,en}.ts`, скриншоты
`assets/images/landing/{lt,en,ru}/` + `scripts/landing-shots.mjs`, переключатель LT/EN в шапке, `useLandingAppLang`
(язык программы — по версии лендинга, поверх прежнего выбора), `i18n/ruVisibility.ts` + `useVisibleLocales` (RU в трёх
переключателях только пришедшим с `/ru`), `tf()` без русского запасным, 314 русских строк демо-данных → английский.
Общий пол задет (`tests/e2e/helpers/ready.ts`, `helpers/adminRoutes.ts`, i18n, роутер) — уровень 2.

## Находки по ходу (все починены)

- Шапка с переключателем на 993px (ru) шире окна на 2px — `landing-layout`; промежуток меню ≤1200 18 → 14.
- `order-lines.jpg`: фиксированная прокрутка уезжала на отгрузки (карточка заказа выросла) и `window.scrollBy` не
  крутил внутренний контейнер — прокрутка к панели товаров через прокручиваемого предка. Рецепт сверен с оригиналами
  презентации на ru: 8/8 кадров совпали составом и размером; ru оставлены оригинальные.
- `onBeforeRouteLeave` остался бы привязан к первому языку (`/lt` и `/en` — одна страница) — общий `router.beforeEach`.
- Сторож `ru-hidden.spec.ts` сразу нашёл русскую заглушку реквизитов в подвале LT/EN (`config/landing.ts`).
- Инверсия «русская заметка в поле» прошла зелёной — перепись не смотрела значения полей; добавлены `input/textarea/select`.
- `warehouse-product-reference.spec`: 35 английских заметок называли товар каталожными словами (cutting, welding,
  steel, plates) — перефразированы.
- Устаревшие тесты прежнего правила: `landing-shell` (lang после ухода), `landing-hero` (выбор не трогать), три теста,
  жмущие RU (`i18n`, `layout`, `followups-list1`) — им видимость RU включается явно, как уходом с `/ru`.

## Машинная приёмка

- `npm run verify` exit 0: 96 файлов, 1449 passed / 3 skipped.
- Полный e2e дважды на одном дереве: 1199 passed / 1199 passed, `tree same`.
- После пары перефразированы 36 заметок демо-данных склада (только тексты) → `npm run verify` 1449 passed и e2e
  затронутой области (`admin/warehouse`, `admin/settings`, `ru-hidden`) 146 passed. Полная пара на этом дереве не
  перезапускалась.
- Снимки обновлены осознанно и просмотрены: шапка лендинга (переключатель), подвал (английская заглушка), верхняя
  панель админки (EN/LT без RU), секция формы — визуальных отличий не видно, причина диффа не установлена.

## Инверсии (все красные, кроме разобранной выше)

Язык не по адресу; корень на `/en`; RU в переключателе лендинга; `html lang` не сразу; демо всегда ru; кириллица в LT;
иконка EN другая; лишняя цифра в EN; LT-картинка из ru/; прежнее правило «выбор не трогать» (4 failed); язык первой
версии вместо текущей (ровно `after switching to EN` failed); RU всегда в переключателях (4 failed); уход не трогает
флаг (2 failed); `tf` снова русский запасным (2 failed); русский текст в истории демо-данных (2 failed, обе страницы).

Не проверено: окна, вкладки и выпадающие списки программы — перепись видит только первый экран.
