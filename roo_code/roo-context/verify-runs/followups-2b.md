# Цикл проверок: пункт 2b — ветка `no-mock-module` в `helpers/ready.ts`

Цель: [`review-followups.md` §2b](../../plans/general/review-followups.md) — ветка
`no-mock-module` в [`tests/e2e/helpers/ready.ts`](../../../frontend_vue/tests/e2e/helpers/ready.ts)
не проверена ничем. Область — только `frontend_vue/tests/` и `playwright.config.ts`;
приложение (`src/`) не менялось ни строкой.

## 1. Воспроизведение

Пункт описывает не дефект поведения, а **дыру в покрытии**: ветка есть, теста на неё нет.
Доказывается тем, что имя ветки не встречается нигде, кроме самого хелпера.

```
$ grep -rn "no-mock-module\|no-hook" frontend_vue/src frontend_vue/tests
frontend_vue/tests/e2e/helpers/ready.ts:42:  | 'no-mock-module'
frontend_vue/tests/e2e/helpers/ready.ts:44:  | 'no-hook'
frontend_vue/tests/e2e/helpers/ready.ts:134:          w.__readyExit = 'no-mock-module'
frontend_vue/tests/e2e/helpers/ready.ts:159:          w.__readyExit = w.__mockMode === true ? 'no-traffic' : 'no-hook'
frontend_vue/tests/e2e/helpers/ready.ts:170:    () => ((window as unknown as { __readyExit?: string }).__readyExit ?? 'no-hook') as never,
```

Ни `ready-exits.spec.ts`, ни любой другой спек её не упоминают. Причина, по которой она
недостижима под обычным прогоном, — в [`src/main.ts`](../../../frontend_vue/src/main.ts):

```ts
if (import.meta.env.VITE_USE_MOCKS !== 'false') {
  window.__mockMode = true
  void import('./services/mocks/index')
}
```

Флаг стоит ВСЕГДА, пока сервер поднят с моками, а весь набор ходит на единственный
`npm run dev` (`playwright.config.ts`, один `webServer`). Значит `no-mock-module` за прогон
не исполнялась ни разу. Воспроизведено — пункт актуален.

Замер, подтверждающий, что режим вообще достижим (ручной прогон, до правок):

```
$ VITE_USE_MOCKS=false npx vite --port 5174 --strictPort
  VITE v6.4.3  ready in 195 ms
$ curl -s http://localhost:5174/src/main.ts | head -1
import.meta.env = {… "VITE_USE_MOCKS": "false"}; …
```

То есть переменная окружения доходит до `import.meta.env` в dev-режиме (Vite подмешивает
`process.env`-переменные с префиксом `VITE_` поверх `.env`, где стоит `true`) — проверено,
а не предположено.

Проба браузером в этом режиме (`/admin/settings/units`, `/api/**` подменён через
`page.route`): `__mockMode`, `__mockPending`, `__mockCalls` — все три `undefined`,
запросов 19, видимых скелетов 0. То есть ветка достижима, и страница дорисовывается.

## 2. Что сделано

| Файл | Что |
|---|---|
| `frontend_vue/tests/e2e/helpers/realApi.ts` | новый: порт/URL режима без моков, токен для гварда, подмена `/api/**` с опциональной задержкой ответа |
| `frontend_vue/tests/e2e/ready-real-api.spec.ts` | новый: три теста на ветку и на её следствия |
| `frontend_vue/playwright.config.ts` | `webServer` стал массивом — добавлен второй dev-сервер с `VITE_USE_MOCKS=false` |

Порт и базовый URL объявлены **один раз** в `helpers/realApi.ts` и импортируются конфигом
(Л5): второй копии строки `http://localhost:5174` в дереве нет.

Бэкенд не поднимается. Пункт говорит «бэкенд уже есть, но эндпоинтов 31», и это правда —
только предмет проверки здесь не ответы сервера, а развилка в ожидании. `/api/**`
подменяется через `page.route`, что в реальном режиме возможно ровно потому, что запрос
идёт через `fetch`, а не через динамический import мок-слоя. Заодно это и есть
доказательство второго свойства режима.

### Три утверждения спека

1. **`no-mock-module`, а не бюджет.** Ветка «истёк бюджет» называется `no-hook` и
   исключает `no-mock-module`, поэтому имя ветки само доказывает мгновенный выход —
   часов в утверждении нет.
2. **Счётчика запросов в реальном режиме нет вовсе.** `__mockMode`/`__mockPending`/
   `__mockCalls` равны `null`, при этом запросы БЫЛИ (их посчитал тест, а не приложение).
   Это и есть ответ на второе следствие из пункта: признак «данные пришли» на счётчике
   там не построить.
3. **Оставшееся ожидание — исчезновение скелетов, и оно настоящее.** Ответы задержаны
   на 1500 мс самим тестом, и ожидание обязано вернуться позже этой границы.

## 3. Приёмка

```
$ cd frontend_vue && npm run verify      # typecheck · lint · dupes · format:check · test:unit
exit=0
  typecheck    — чисто
  lint         — чисто (--max-warnings=0)
  dupes        — Total 9.75 % при пороге 10 %
  format:check — All matched files use Prettier code style!
  test:unit    — Test Files 21 passed (21), Tests 553 passed (553)
```

```
$ npx playwright test ready-real-api --reporter=line
exit=0
  3 passed (6.7s)
```

## 4. Л9 — инверсия на каждое утверждение

Тесты трогались, поэтому инверсия обязательна. Каждая правка откатывалась обратным
текстовым замещением (`git restore` запрещён), после чего `git diff --stat` по файлу пуст.

| # | Что ломалось | Ожидание | Факт |
|---|---|---|---|
| A | `src/main.ts`: `window.__mockMode = true` безусловно | ветка не берётся | **3 failed** — `Expected "no-mock-module" / Received "no-traffic"` ×2, плюс `hooks` не равны `null` |
| B | `helpers/ready.ts`: убран опрос скелетов в `waitForDataReady` | ждать перестанет | **1 failed** — `ожидание вернулось через 331 мс при задержке 1500 мс`; два других теста зелёные |
| C | спек: `ROUTE = '/login'` вместо админского | маршрут уходит в другую ветку | **2 failed** — `Received "no-data-route"` |
| D | `helpers/realApi.ts`: подмена вешается на `**/api-INVERSION-D/**` | трафика тест не видит | **2 failed** — `страница не сделала ни одного запроса`, и ожидание вернулось через 417 мс |

Отдельно стоит отметить, что́ инверсия C **не** покрасила: тест про счётчик остался
зелёным на `/login`, потому что приложение и там дёргает настройки на старте. То есть
утверждение `api.count > 0` — положительный контроль, и красит его именно D.

## 5. Линзы

| Линза | Чем проверял | Итог |
|---|---|---|
| Л9 | инверсии A–D выше; `grep -rn "await page.waitForLoadState" frontend_vue/tests/` → пусто | подтверждена |
| Л5 | `grep -rn "5174\|REAL_API" frontend_vue/{tests,src,*.ts}` → порт объявлен один раз в `helpers/realApi.ts`, конфиг его импортирует; `grep -rn webServer` → один файл | подтверждена |
| Л3 | заглушка отдаёт `{ success: true, data: [] }` — конверт `ApiResponse`, который разбирает `unwrap()` в `src/services/api.ts:128-140` | подтверждена |
| Л7 | спек ставит `ALL_FLAGS_ENABLED` (типизирован `FeatureFlags`, забытый флаг ронял бы typecheck) и `auth_token` — иначе гвард реального режима (`src/router/index.ts:422-440`) увёл бы на `/login` | подтверждена |
| Л10 | конфиг разбирается — Playwright поднимает оба сервера и прогоняет набор; полный прогон ниже | подтверждена |
| Л1, Л2, Л4, Л6, Л8 | неприменимы: `src/` не менялся — ни реактивности, ни переводов, ни моков приложения, ни CSS, ни логики сохранения в правке нет | вне области |

## 6. Полный прогон e2e

`playwright.config.ts` — общий пол: он на пути каждого теста. Поэтому уровень 2,
полный набор.

```
$ cd frontend_vue && npx playwright test --reporter=line   # прогон 1
  1011 passed (16.3m)          exit=0
$ cd frontend_vue && npx playwright test --reporter=line   # прогон 2, то же дерево
  1011 passed (16.4m)          exit=0
```

Вердикт снят по коду возврата и по строкам `failed`/`flaky` (их нет), а не по последней
строке — правило из `verify.md`. Три из 1011 — новый спек.

**Чем этот прогон загрязнён, и об этом надо сказать вслух.** В момент прогона в дереве
лежала НЕЗАКОММИЧЕННАЯ работа другого агента ночного прогона: изменены
`src/services/mocks/{bcc,notifications,orders,warehouse}.ts`, добавлен
`src/services/mocks/notification-triggers.spec.ts`. Дерево на старте этой задачи было
чистым, значит правки появились параллельно. Зелёный прогон, таким образом, доказывает
«мой мок-режим никому не помешал» на дереве, где есть и чужое; чужое при этом тоже
зелёное. В коммит ниже чужие файлы не попадают.

## Итог

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Цикл проверок: пункт 2b — ветка no-mock-module
Итераций: 1 из 30        Вердикт: чистый свип
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Машинная приёмка:  typecheck OK · lint OK · dupes OK · format OK · unit OK · e2e ур. 2
Линзы:             Л3, Л5, Л7, Л9, Л10 подтверждены; Л1, Л2, Л4, Л6, Л8 вне области
Найдено за прогон: 0       Починено: 0      Отклонено: 0
В bugs-file ушло:  0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
