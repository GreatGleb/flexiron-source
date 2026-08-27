# Пункт 2 — «Бэкенд: каждое событие триггерит уведомление»

План: [`review-followups.md`](../../plans/general/review-followups.md), раздел `## 2`.
Ветка: `auto/followups-2026-08-27`. Дата: 2026-08-27. Режим автономный.

---

## 1. Воспроизведение

Пункт утверждает: уведомления никто не создаёт, в моке лежит статичный сид, и ни один
другой мок модуль уведомлений не импортирует.

```
$ grep -o "id: 'notif-[0-9]*'" frontend_vue/src/services/mocks/notifications.ts | wc -l
20

$ grep -rn "from './notifications'\|mocks/notifications" frontend_vue/src/ --include=*.ts --include=*.vue
frontend_vue/src/i18n/admin/index.ts:16:import { adminNotifications } from './notifications'   ← это i18n, не мок
frontend_vue/src/services/mocks/index.ts:7:} from './notifications'                            ← диспетчер, только чтение

$ grep -rn "notificationsStore\|pushNotification\|addNotification\|createNotification" frontend_vue/src/
(пусто)
```

Воспроизводится. Записей 20, а не 21 — пункт ошибся на единицу, суть та же: сид, который
никогда не пополняется. Ни одной точки записи в ленту во всём `src/`.

## 2. Где «бэкенд» этого пункта

Пункт озаглавлен «Бэкенд», и это надо было решить до правки, а не после.

Каталог `backend/` (FastAPI) для этого пункта пуст по существу:

```
$ find backend/app/modules/*/features -mindepth 1 -maxdepth 1 -type d | grep -v __pycache__
auth/features/{login,magic_link,me,register}
products/features/{create_product,get_product_detail}
settings/features/{crud,profile}

$ grep -n "include_router" backend/app/main.py | wc -l
9
```

Модуль `notifications` там — одна модель и два пустых `__init__`: ни репозитория, ни
`internal_api`, ни единого слайса. И, что важнее, **ни одного из восьми событий пункта в
`backend/` не существует**: модуля заказов нет вовсе, у `warehouse`, `finance`, `bcc`,
`suppliers` нет ни одного слайса, то есть состояние там не меняется ничем. Планировщика в
`requirements.txt` тоже нет.

Триггеры в `backend/` означали бы сначала построить заказы, склад, финансы и BCC целиком —
это не «минимальные изменения по существу пункта», а другой проект.

Читаю пункт по его же разделу «Почему»: он целиком про `src/services/mocks/notifications.ts`,
про число записей в нём и про то, что его никто не импортирует. Сегодняшний бэкенд для
приложения — слой моков; правка сделана там. Это записано здесь явно, чтобы приёмщик судил
решение, а не догадывался о нём.

## 3. Что сделано

Правило «что говорит уведомление» живёт в одном месте — `mocks/notifications.ts`. Модуль,
которому принадлежит событие, передаёт факты и не строит текст сам: иначе лента разъехалась
бы по типам событий (Л5).

Каждый эмиттер зовётся на **переходе состояния**, а не на каждом вызове — иначе колокольчик
считал бы вызовы API, а не события (питфолл #65).

| Тип | Точка вызова | Условие |
|---|---|---|
| `order_status` | `orders.ts` `mockPatchOrderStatus` | `oldStatus !== status`, после всех бросков |
| `warehouse_ready` | `orders.ts` `mockReserveOrder` | не был покрыт целиком → стал |
| `payment_received` | `orders.ts` `mockAddOrderPayment` | `amount > 0` (возврат — не поступление) |
| `batch_received` | `warehouse.ts` `mockCreateBatch` | партия создана |
| `stock_deficit` | `warehouse.ts` `recordShortage` | только вновь открытая нехватка |
| `supplier_response` | `bcc.ts` `mockAcceptResponse` | ответ принят («не ответил» — не новость) |
| `payment_overdue` | `finance.ts` `mockPatchPayment` | статус перешёл в `overdue` |

Восьмой тип, **`reserve_expiring`, оставлен без триггера сознательно**, и это не забывчивость:

```
$ grep -n -A10 "interface StockReservation" frontend_vue/src/types/warehouse.ts
570: id, batchId, offcutId, orderId, lineId, quantity, createdAt      ← срока нет

$ grep -rn -i "reserv" frontend_vue/src/types/settings.ts
74:  reserveOnTransition?: boolean                                     ← флаг, не срок
```

У брони нет ни даты окончания, ни срока в настройках; `Batch.expiresAt` — годность металла,
а не граница резерва, и во всех сидах он `null`. Написать эмиттер можно только выдумав срок
резерва, то есть положив в мок данные, которых нет в приложении — прямой запрет Л4 («мок =
правда») и правила автономного режима «догадка запрещена». Причина записана комментарием в
`notifications.ts` рядом с остальными эмиттерами, вместе с тем, куда встанет вызов, когда у
брони появится срок.

Формулировки взяты **дословно из сида** того же типа, чтобы лента не расслаивалась на
«старые» и «новые» записи (сверено с `[Название] достиг нижнего лимита остатка` и др.).
Исключение одно — `payment_overdue`: сид пишет «просрочена на 5 дней», а число дней,
записанное в момент события, через месяц становится враньём. Пишем дату срока, она не стареет.
Отступление названо здесь, а не спрятано.

Подпись статуса заказа берётся из `i18n/admin/orders` — пятой копии списка статусов не
заводим (`domain/orderStatus.ts` уже стоил проекту четырёх).

### Файлы

- `frontend_vue/src/services/mocks/notifications.ts` — семь эмиттеров, `emit`, `statusLabel`, комментарий о `reserve_expiring`
- `frontend_vue/src/services/mocks/orders.ts` — три вызова + `fullyReserved`
- `frontend_vue/src/services/mocks/warehouse.ts` — два вызова
- `frontend_vue/src/services/mocks/bcc.ts` — один вызов
- `frontend_vue/src/services/mocks/finance.ts` — один вызов + `commit` (оба выхода `mockPatchPayment` через одну точку)
- `frontend_vue/src/services/mocks/notification-triggers.spec.ts` — новый, 13 проверок
- `roo_code/plans/bugs/settings-notifications-bugs.md` — БАГ-12, находка Л4 вне области

Первые пять файлов и часть спека — работа упавшего агента прогона 2026-08-27, снятая из
`git stash@{0}` (`git diff stash@{0}^ stash@{0}`, база стеша совпадает с HEAD `b937429`).
Она была ничем не проверена; проверена здесь. `payment_overdue`, три его проверки и разбор
`reserve_expiring` — добавлены в этой задаче.

## 4. Приёмка

```
$ cd frontend_vue && npm run verify
exit=0
  typecheck   — чисто
  lint        — чисто (--max-warnings=0)
  dupes       — 9.36 % при пороге 10
  format:check— All matched files use Prettier code style!
  test:unit   — Test Files 21 passed (21) · Tests 556 passed (556)
```

Было 20 файлов / 543 теста (отчёт прогона 2026-08-27) → стало 21 / 556: +1 файл, +13 проверок.

```
$ npm run build
exit=0 · ✓ built in 8.25s · ни одного предупреждения о циклическом импорте
```

Цикла и не могло быть: `notifications.ts` тянет только `@/types/*`, `@/domain/orderStatus`
и `@/i18n/admin/orders`; обратных импортов из моков в него нет.

### E2E — уровень 1

Тронуты пять мок-модулей, диспетчер `mocks/index.ts` не тронут (`git diff --name-only`
показывает только пять файлов моков), то есть общий пол не задет и уровень 2 не нужен.
Прогнаны области всех тронутых моков и все, кто их читает:

```
$ npx playwright test tests/e2e/admin/{orders,warehouse,notifications,suppliers,analytics,settings} \
    tests/e2e/admin/layout.spec.ts --reporter=line > e2e-l1.txt 2>&1; echo "exit=$?"
exit=0
718 passed (9.7m)
```

Ни строки `failed`, `flaky` или `skipped`. Вердикт снят по коду возврата, а не по последней
строке.

## 5. Линзы

**Л9 — инверсия. 14 из 14 краснеют.** Каждый эмиттер и каждая защита от повтора ломались по
одному, спек запускался, дерево восстанавливалось из копии
(скрипт `scratchpad/invert.py`, полный список ниже):

```
И1  order_status: убрать эмиттер                → КРАСНЕЕТ exit=1 (2 failed | 11 passed)
И2  order_status: снять защиту от повтора       → КРАСНЕЕТ exit=1 (1 failed | 12 passed)
И3  payment_received: убрать эмиттер            → КРАСНЕЕТ exit=1
И4  payment_received: писать и на возврат       → КРАСНЕЕТ exit=1
И5  warehouse_ready: убрать эмиттер             → КРАСНЕЕТ exit=1
И6  warehouse_ready: снять защиту от повтора    → КРАСНЕЕТ exit=1
И7  batch_received: убрать эмиттер              → КРАСНЕЕТ exit=1
И8  stock_deficit: убрать эмиттер               → КРАСНЕЕТ exit=1
И9  supplier_response: убрать эмиттер           → КРАСНЕЕТ exit=1
И10 payment_overdue: убрать эмиттер             → КРАСНЕЕТ exit=1 (2 failed | 11 passed)
И11 payment_overdue: снять защиту от повтора    → КРАСНЕЕТ exit=1
И12 уведомление приходит прочитанным            → КРАСНЕЕТ exit=1
И13 подпись статуса написана мимо словаря       → КРАСНЕЕТ exit=1
И14 ссылка ведёт на список, а не в карточку     → КРАСНЕЕТ exit=1
```

Ни одной зелёной инверсии — то есть в спеке нет утверждения, которое устраивает бездействие.
Счёт в проверках всегда относительный (до/после): моки — модульные синглтоны, абсолютное
число зависит от соседей по файлу.

**Л2 — i18n. Подтверждена машиной, а не глазами.** Тексты уведомлений — это ДАННЫЕ
(`TranslatedString` в записи, как `title_translations` JSONB в модели бэкенда), поэтому три
языка лежат в моке, а не в словаре; сырых точечных ключей нет:

```
$ grep -nE "'(orders|notifications)\.[a-z]" src/services/mocks/notifications.ts
(пусто)

$ python3 … подсчёт ключей status_* по локалям в src/i18n/admin/orders.ts
ru 35 · en 35 · lt 35
```

Проверено инверсией, что счётчик — не декорация: переименовал `status_refused` в `lt` →

```
src/services/mocks/notifications.ts(500,31): error TS2551: Property 'status_refused' does not
exist … Did you mean 'status_returned'?   exit=2
```

то есть отсутствие подписи статуса в любой из трёх локалей теперь роняет typecheck.
Восстановлено, `npm run typecheck` exit=0.

**Л3 — контракт.** Новых роутов нет, диспетчер не тронут:
`git diff --name-only -- src/services/` → только пять файлов моков, `mocks/index.ts` среди
них нет. `GET /api/notifications`, `unread-count`, `PATCH :id/read`, `read-all` работают как
работали — эмиттеры пишут в тот же список, который они читают.

**Л4 — мок = правда.** `emit` пишет в `notifications` (строка 353,
`let notifications = [...MOCK_NOTIFICATIONS]`), то есть в копию массива, а не в сид —
`unshift` сид не задевает; записи создаются на месте и ссылок ни с кем не делят.
Ни один сид не зовёт эмиттеры: `mockCreateBatch`, `recordShortage`, `mockAcceptResponse`
вызываются только из диспетчера моков и из спеков (проверено грепом по `src/`), так что
уведомления не рождаются при загрузке.

Находка **вне области** — БАГ-12 в
[`settings-notifications-bugs.md`](../../plans/bugs/settings-notifications-bugs.md):
`mockMarkAsRead` правит запись сида на месте, и `mockResetNotifications` после этого не
сбрасывает `isRead`. Не чинил: не моя область и спящее (вызывающих у reset нет — грепнуто).
Свип это не пачкает, решает человек.

**Л5 — один источник правила.**

```
$ grep -rln "type: 'order_status'\|type: 'payment_overdue'\|entityRouteName:" src/ --include=*.ts --include=*.vue
src/services/mocks/notifications.ts
src/types/notifications.ts
```

Текст уведомления собирается ровно в одном файле; вызывающие передают факты. Подпись статуса
не переписана — берётся из словаря (доказано инверсией И13). В `mockPatchPayment` правило
«просрочка — это переход» записано один раз в `commit`, а не в каждом из двух выходов
функции. `npm run dupes` — 9.36 % при пороге 10, sonarjs внутри `lint` — чисто.

**Л7 — роутинг.** Все пять имён роутов из эмиттеров существуют ровно по одному разу:

```
$ for R in admin-order-card admin-warehouse-batch admin-product-card admin-supplier-card admin-client-card; do
    printf "%s -> " $R; grep -c "name: '$R'" src/router/index.ts; done
admin-order-card -> 1 · admin-warehouse-batch -> 1 · admin-product-card -> 1
admin-supplier-card -> 1 · admin-client-card -> 1
```

Инверсия И14 (подменить `admin-order-card` на список) краснеет — ссылка проверяется, а не
подразумевается. Флагов и прав правка не касается.

**Л10 — целостность.** `npm run build` exit=0, циклических импортов нет; роутер и
`i18n/admin/index.ts` не тронуты.

**Л1, Л6, Л8 — не применимы, и вот почему.** Правка целиком в слое моков: ни одного `.vue`,
ни строки CSS, ни одного `watch`/`computed`, ни одной формы с сохранением
(`git diff --name-only` — пять `.ts` в `src/services/mocks/` плюс новый спек). Реактивности,
вёрстки и потери несохранённого здесь нет предмета.

## 6. Итог

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Цикл проверок: пункт 2 — триггеры уведомлений
Итераций: 1 из 30        Вердикт: чистый свип
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Машинная приёмка:  npm run verify exit=0 · build exit=0 · e2e ур.1 718 passed exit=0
Линзы:             Л2 Л3 Л4 Л5 Л7 Л9 Л10 подтверждены; Л1 Л6 Л8 вне предмета
Инверсия:          14 из 14 краснеют
Найдено за прогон: 1        Починено: 0      Отклонено: 0
В bugs-file ушло:  1 — БАГ-12 (свип это не пачкает, решает человек)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Чего эта правка НЕ делает, и это надо знать до приёмки:**

1. `reserve_expiring` — без триггера: у брони нет срока в модели (разобрано выше). Семь типов
   из восьми, и восьмой не забыт, а обоснован.
2. Каталог `backend/` не тронут ни строкой. Настоящих триггеров на FastAPI не появилось —
   там нет ни одного из восьми событий, и появиться им пока неоткуда.
3. Подписок (кто на что подписан) нет — пункт сам выносит их за скобки (6.5 карты сайта).

---

# Заход 2 — правка по отклонению скептика (2026-08-27)

Скептик отклонил заход 1 по трём основаниям. Первое — настоящий дефект в самой правке, он
починен здесь. Второе и третье — не дефекты кода, а вопросы к объёму пункта; они разобраны
в конце и оставлены человеку, как и было велено («почини именно это, не переделывая остальное»).

## 1. Дефект: сид звал эмиттеры, и лента врала при каждой загрузке

Заявление захода 1 по Л4 («ни один сид не зовёт эмиттеры») было ложным: грепнуты три функции
из семи. `buildShowcaseOrder` в `mocks/orders.ts` строит показушный заказ **вызовами настоящих
эндпоинтов** — а те зовут эмиттеры.

### Воспроизведение

Временный спек `src/services/mocks/repro-seed-leak.spec.ts`: импортировать моки и посмотреть
ленту до того, как что-нибудь произошло.

```
$ npx vitest run src/services/mocks/repro-seed-leak.spec.ts     # import './orders'
exit=1
total 23 generated 3 unread 16
notif-ev-003 payment_received Payment received for order ORD-2026-100 in the amount of 2000.00 EUR 2026-08-27T08:04:02.555Z
notif-ev-002 payment_received Payment received for order ORD-2026-100 in the amount of 1500.00 EUR 2026-08-27T08:04:02.554Z
notif-ev-001 stock_deficit [Steel Pipe 60x4] has reached minimum stock level 2026-08-27T08:04:02.547Z
first three in feed: notif-ev-003, notif-ev-002, notif-ev-001
AssertionError: expected 3 to be +0
```

Воспроизводится ровно как описано. `emit` ставит `createdAt: new Date().toISOString()`, лента
сортируется по `createdAt` убыв. — значит при КАЖДОЙ загрузке страницы три выдуманных события с
меткой «только что» вставали первыми и давали +3 колокольчику.

Хуже, чем «лишние записи»: `stock_deficit` рассказывал о нехватке, которую **сам же сид потом
и закрыл**. Дефицитов по `ORD-100` после загрузки ноль (замер ниже) — то есть лента сообщала о
том, чего нет ни в каком виде.

Ни один из 13 тестов спека этого не ловил: все считают дельту «до/после», а стартовый мусор
лежит в ленте до того, как счёт начался.

### Правка

Три файла, `git diff --name-only`:

```
frontend_vue/src/services/mocks/notifications.ts
frontend_vue/src/services/mocks/orders.ts
frontend_vue/src/services/mocks/notification-triggers.spec.ts
```

**`notifications.ts`** — флаг `seeding` и `seedQuietly(build)`; `emit` при поднятом флаге не
пишет ничего. Правило одно и живёт в одном месте (Л5): загрузка модуля — не событие.
Флаг восстанавливается прежним значением в `finally`, а не сбрасывается: сидовые сборщики
кидают намеренно (`try/catch` внутри них), и брошенный сид не должен оставить ленту немой до
конца сессии.

**`orders.ts`** — `seedQuietly(buildShowcaseOrder)`. Только он: это единственный сид, который
сегодня доходит до эмиттера (доказано инверсией И16 против И17/И18 ниже). `createScenarioShipments`
и `buildShowcaseReturn` оставлены как были — обёртка, которую нельзя покраснить, это код без
доказательства. Страховка от следующего такого сида — не обёртка вперёд, а проверка загрузки
(И20 показывает, что она ловит эмиттер из любого места сида, не только из обёрнутого).

**`notification-triggers.spec.ts`** — снимок ленты берётся на уровне модуля (`feedAtLoad`), до
первого `it`: внутри проверки было бы видно уже работу соседей. «Что такое сид» спрашивается у
самого модуля — `mockResetNotifications()` возвращает ленту ровно к заведённым руками записям,
и лишним считается всё, чего в ней нет. По форме `id` не гадаем.

### Чем доказано, что правка не тронула сам сид

`emit` заглушается ПОСЛЕ `deficitStore.push` (warehouse.ts:1448 → 1452) и после записи платежа,
то есть состояние склада и заказов не меняется. Замер обеими сторонами — дерево с глушением и то
же дерево с выломанным `if (seeding) return`:

```
с глушением:   {"deficits":21,"forShowcase":0,"payments":3,"status":"shipped","items":7,"total":4901.4}
без глушения:  {"deficits":21,"forShowcase":0,"payments":3,"status":"shipped","items":7,"total":4901.4}
```

Идентично. Меняется только лента: было `total 23 / generated 3 / unread 16`, стало
`total 20 / generated 0 / unread 13` — чистый сид (замер на полном мок-слое,
`import '@/services/mocks/index'`, exit=0).

## 2. Приёмка

```
$ cd frontend_vue && npm run verify
exit=0
  typecheck    — чисто
  lint         — чисто (--max-warnings=0)
  dupes        — 18845 (9.35 %) при пороге 10
  format:check — All matched files use Prettier code style!
  test:unit    — Test Files 21 passed (21) · Tests 557 passed (557)

$ npm run build
build exit=0 · ✓ built in 16.60s · ни одного предупреждения о циклическом импорте
```

Было 556 тестов → стало 557: ровно одна новая проверка.

### E2E — уровень 1

Тронуты два мок-модуля (`notifications`, `orders`), диспетчер `mocks/index.ts` не тронут —
общий пол не задет, уровень 2 не нужен. Прогнаны области тронутых моков и те, кто их читает
(колокольчик в шапке — `layout.spec.ts`):

```
$ npx playwright test tests/e2e/admin/orders tests/e2e/admin/notifications \
    tests/e2e/admin/analytics tests/e2e/admin/clients tests/e2e/admin/layout.spec.ts \
    --reporter=line > e2e-l1.txt 2>&1; echo "exit=$?"
exit=0
475 passed (6.2m)
```

Ни строки `failed`, `flaky` или `skipped` (`grep -oE "[0-9]+ (passed|failed|flaky|skipped)"` дал
единственную строку `475 passed`). Вердикт снят по коду возврата, взятому сразу после команды, а
не по последней строке вывода.

## 3. Линзы

**Л9 — инверсия. 4 из 4 краснеют** (скрипт `scratchpad/invert2.py`, дерево восстанавливается
копией после каждой):

```
И15 emit без глушения (`if (seeding) return` выломан)   → КРАСНЕЕТ exit=1  Tests 1 failed | 13 passed
И16 buildShowcaseOrder без обёртки                      → КРАСНЕЕТ exit=1  Tests 1 failed | 13 passed
И19 seedQuietly не восстанавливает флаг (немая навсегда)→ КРАСНЕЕТ exit=1  Tests 9 failed | 5 passed
И20 новый сид на уровне модуля зовёт эмиттер мимо обёртки → КРАСНЕЕТ exit=1  Tests 1 failed | 13 passed
```

И19 краснеет девятью проверками — то есть «глушить навсегда» ловится, а не проходит молча.
И20 — главное: в конец сидового блока `orders.ts` дописан
`notifyWarehouseReady({ id: 'ORD-100', orderNumber: 'ORD-2026-100' })` **без** обёртки, и
проверка краснеет. Значит она сторожит не одну обёрнутую функцию, а сам факт «после загрузки в
ленте появилось то, чего нет в сиде», откуда бы оно ни пришло.

Зелёные инверсии тоже были, и они изменили правку: на первой редакции обёрнуты были все три
сидовых вызова, но

```
И17 createScenarioShipments без обёртки → ЗЕЛЁНАЯ exit=0  Tests 14 passed
И18 buildShowcaseReturn без обёртки     → ЗЕЛЁНАЯ exit=0  Tests 14 passed
```

то есть две обёртки из трёх не доказывались ничем. Убраны, вместо них — комментарий у
единственной оставшейся о том, где настоящая страховка. Держать в коде то, что нельзя
покраснить, — ровно то, за что этот проект ругает тесты.

**Л4 — мок = правда. Это предмет правки, и он теперь машинный.**

```
$ npx vitest run <временный спек с import '@/services/mocks/index'>
exit=0 · total 20 · generated 0 · unread 13 · первые в ленте: notif-010, notif-009, notif-003
```

После загрузки лента — ровно двадцать заведённых руками записей, ни одной сочинённой. То самое
правило, которым заход 1 обосновывал отказ от восьмого типа, теперь выполняется и самой правкой.

**Л5 — один источник правила.** Правило глушения записано один раз:

```
$ grep -rn "seedQuietly\|seeding" src/ --include=*.ts --include=*.vue
notifications.ts:493  let seeding = false
notifications.ts:504  export function seedQuietly<T>(build: () => T): T
notifications.ts:505-510  const outer / seeding = true / finally seeding = outer
notifications.ts:515  if (seeding) return
orders.ts:111 импорт · orders.ts:4171 комментарий · orders.ts:4176 единственный вызов
```

Второй копии нет. Эмиттеры по-прежнему зовутся только из модуля-владельца события:

```
$ grep -rn "notify(OrderStatusChanged|PaymentReceived|WarehouseReady|BatchReceived|StockDeficit|SupplierResponse|PaymentOverdue)" src/ --include=*.ts
finance.ts:294 · bcc.ts:309 · warehouse.ts:725,1452 · orders.ts:1748,3655,3715
```

`npm run dupes` 9.35 % при пороге 10, sonarjs внутри `lint` — чисто.

**Л3 — контракт.** Роутов не добавлено, диспетчер не тронут: `git diff --name-only` — два мок-модуля
и спек, `mocks/index.ts` среди них нет.

**Л10 — целостность.** `npm run build` exit=0, циклических импортов нет; роутер, i18n и флаги не
тронуты (тех же трёх файлов достаточно, чтобы это утверждать).

**Л1, Л2, Л6, Л7, Л8 — вне предмета.** Ни одного `.vue`, ни строки CSS, ни одного `watch`, ни
одной формы, ни строки переводов, ни одного роута: правка целиком в двух `.ts` слоя моков и
в спеке.

## 4. Что осталось человеку, а не коду

Второе и третье основания скептика — не дефекты правки, и молча их закрывать нельзя.

1. **Семь типов из восьми.** `reserve_expiring` без триггера: у `StockReservation`
   (`types/warehouse.ts:562-579`) нет ни срока, ни даты окончания, в `types/settings.ts` по
   резервам только `reserveOnTransition`. Скептик обоснование перепроверил и признал фактически
   верным — но пункт требует триггеры под все восемь. Написать восьмой можно только выдумав
   срок резерва, то есть нарушив Л4 и запрет догадки. Решение — человеку: либо завести срок
   резерва отдельным пунктом, либо признать семь из восьми закрытием.
2. **Пункт назван «Бэкенд», `backend/` не тронут ни строкой.** Скептик состояние `backend/`
   перепроверил и подтвердил (восемь слайсов, ни одного из восьми событий там не существует), и
   перенос в слой моков «защитим по существу» — но заголовку правка не удовлетворяет. Тоже
   человеку.

Отметку ✅ в плане не ставлю: её ставит не автор правки.
