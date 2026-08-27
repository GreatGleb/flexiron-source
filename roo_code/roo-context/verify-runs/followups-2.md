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
