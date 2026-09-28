# Перепись коротких ссылок `roo_code/roo-context/api/notifications.md` и `roo_code/roo-context/api/audit-feed.md` — 2026-09-28

Короткая ссылка — это `:NNN`, `:N-M` или хвост перечисления через запятую, у которых файл рядом
не назван, а подразумевается последним путём ЛЕВЕЕ на ТОЙ ЖЕ строке. `refs_shift.py` такие не чинит
по построению: файл у них назван прозой, а не ссылкой. Полные ссылки вида `путь:строка` этой
задачей не трогались вовсе.

## Что искал

```bash
grep -oP '(?<![\w:.,/-]):\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*(?![\w:])' roo_code/roo-context/api/notifications.md | wc -l   # 90
grep -nP '(?<![\w:.,/-]):\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*(?![\w:])' roo_code/roo-context/api/notifications.md | wc -l   # 58
grep -oP '(?<![\w:.,/-]):\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*(?![\w:])' roo_code/roo-context/api/audit-feed.md | wc -l      # 52
grep -nP '(?<![\w:.,/-]):\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*(?![\w:])' roo_code/roo-context/api/audit-feed.md | wc -l      # 37
wc -l roo_code/roo-context/api/notifications.md roo_code/roo-context/api/audit-feed.md                                 # 626 / 433
```

**Коротких ссылок: 90 в документе уведомлений в 58 строках и 52 в audit-feed в 37 строках — 142
всего.** Столько же строк в таблицах ниже — 90 и 52. Число строк документов правка не меняет:
правились только цифры внутри ссылок. Замер:

```bash
wc -l < roo_code/roo-context/api/notifications.md                 # 626
git show HEAD:roo_code/roo-context/api/notifications.md | wc -l   # 626
wc -l < roo_code/roo-context/api/audit-feed.md                    # 433
git show HEAD:roo_code/roo-context/api/audit-feed.md | wc -l      # 433
```

## Ограничители — каждый снят со случившегося провала

1. **Строка с двумя и более РАЗНЫМИ путями не трогается вовсе** — контекст на ней определяется
   неверно. Такие ссылки в таблицах помечены причиной «два пути на строке»: 13 в уведомлениях,
   4 в audit-feed.
2. **Диапазон `:N-M` двигается обоими концами или не двигается ни одним.** Перевёрнутых
   диапазонов нет ни одного — ни до, ни после правки. Один диапазон правился — `:443-445` →
   `:476-478`: оба конца сдвинуты на +33, длина та же (три строки), токен `mockMarkAllAsRead`
   стоит на новой первой строке.
3. **Правка доказывается содержимым, а не арифметикой.** Из предложения берётся код в бэктиках
   (сам путь и токены-пути отброшены) и грепается по подразумеваемому файлу. Нашёлся ровно один
   раз — номер известен; не нашёлся, нашёлся многократно или токена рядом нет — ссылка не
   правится и идёт в «отдано глазам».
4. **Строка-цель в старой и новой версии файла совпадает дословно.** Ни один из трёх
   исправленных номеров не двигал строку-цель: правились только числа в документе, файлы кода не
   трогались — `git status --short` показывает изменённым лишь документ уведомлений и новый файл
   этого журнала.

```bash
git diff --stat -- frontend_vue/src/router/index.ts frontend_vue/src/composables/useNotifications.ts frontend_vue/src/services/mocks/notifications.ts
# (пусто — файлы кода не менялись)
git diff --stat
#  roo_code/roo-context/api/notifications.md | 6 +++---
#  1 file changed, 3 insertions(+), 3 deletions(-)
```

Шесть изменённых строк — это три строки с одним подставленным числом каждая: три удаления и три
вставки. Документ `audit-feed.md` в `git diff --stat` не появляется вовсе: он не менялся.

## Что поправлено — 3 короткие ссылки

| строка документа | файл | было | стало | токен | его строка |
|---|---|---|---|---|---|
| 120 | frontend_vue/src/composables/useNotifications.ts | 19 | 21 | `usePagination(25)` | 21 |
| 502 | frontend_vue/src/services/mocks/notifications.ts | 443-445 | 476-478 | `mockMarkAllAsRead` | 476 |
| 520 | frontend_vue/src/router/index.ts | 180 | 181 | `admin-client-card` | 181 |

Почему третья — именно имя роута, а не строка `path:` того же объявления. Предложение говорит
«пять имён роутов», и токен рядом — имя `admin-client-card`, которого на прежней строке нет:
строка 180 — это `path: 'clients/:id'`, имя лежит строкой ниже, ровно один раз. Критерий
«рядом с номером в том же предложении стоит токен с целевой строки» на 180 не выполняется, на
181 — выполняется. Остальные три ссылки того же перечня — `:212`, `:224`, `:262` — на строке,
где путь не назван (перечисление продолжается со строки выше), и по определению короткой ссылки
подразумеваемый файл у них не определён: они отданы глазам (см. таблицу, строки 61–63).

### Почему соседние ссылки на те же цели не тронуты

Три исправленные цели называет в документе не одна ссылка, и остальные ссылки на них остались
нетронутыми намеренно. Проверено, что они были неверны **до** правки, а не стали ею:

- **Строка 386** несёт полную ссылку на файл `useNotifications.ts` с номером строки 19 у того же
  токена `usePagination(25)`. Она устарела не моей правкой: токен `usePagination(25)` лежит на
  строке 21 независимо от того, правил ли я короткую ссылку с номером 19 на строке 120. Полная
  ссылка вне области задачи — её чинит `refs_shift.py`.
- **Строка 325** несёт полную ссылку на файл `mocks/notifications.ts` с диапазоном 443-445 у того
  же токена `mockMarkAllAsRead`; по той же причине она остаётся как была.
- **Строка 71** несёт короткие `:436-441` и `:443-445` на той же цели, но на этой строке не
  назван ни один путь: файл подразумевается прозой строк выше, а правило задачи берёт файл только
  с ТОЙ ЖЕ строки. Отдано глазам (строки 2–3 переписи), а не тронуто.

Ни одна из этих ссылок не стала ложной **из-за** моей правки: их строка-цель не двигалась (файлы
кода не менялись вовсе), а номера в них были устаревшими уже на момент сдачи. Новых противоречий
дифф не вносит — он заменяет один неверный номер на верный, не трогая соседние.

## Доказательство поимённо — грепом по целевому файлу

```bash
cd frontend_vue
grep -nF 'usePagination(25)' src/composables/useNotifications.ts
# 21:const pagination = usePagination(25)
grep -cF 'usePagination(25)' src/composables/useNotifications.ts                       # 1 — вхождение единственное
sed -n '21p' src/composables/useNotifications.ts | grep -cF 'usePagination(25)'        # 1 — токен на новой строке
sed -n '19p' src/composables/useNotifications.ts | grep -cF 'usePagination(25)'        # 0 — на прежней его нет

grep -nF 'mockMarkAllAsRead' src/services/mocks/notifications.ts
# 476:export function mockMarkAllAsRead(): void {
grep -cF 'mockMarkAllAsRead' src/services/mocks/notifications.ts                      # 1 — единственное
sed -n '476p' src/services/mocks/notifications.ts | grep -cF 'mockMarkAllAsRead'       # 1 — токен на новой первой строке
sed -n '443p' src/services/mocks/notifications.ts | grep -cF 'mockMarkAllAsRead'       # 0
sed -n '445p' src/services/mocks/notifications.ts | grep -cF 'mockMarkAllAsRead'       # 0
sed -n '476,478p' src/services/mocks/notifications.ts
# export function mockMarkAllAsRead(): void {
#   notifications = notifications.map((n) => ({ ...n, isRead: true }))
# }
sed -n '443,445p' src/services/mocks/notifications.ts
#     throw mockRefusal(500, NOTIFICATIONS_REFUSAL_CODES.simulatedMockError, 'SIMULATED_MOCK_ERROR')
#   }
#   const filtered = applyFilters(notifications, filters)

grep -nF 'admin-client-card' src/router/index.ts
# 181:        name: 'admin-client-card',
grep -cF 'admin-client-card' src/router/index.ts                                      # 1 — единственное
sed -n '181p' src/router/index.ts | grep -cF 'admin-client-card'                       # 1 — токен на новой строке
sed -n '180p' src/router/index.ts | grep -cF 'admin-client-card'                       # 0 — на прежней его нет
sed -n '180p;181p' src/router/index.ts
#         path: 'clients/:id',
#         name: 'admin-client-card',
```

Строка-цель не двигалась: закоммиченное и рабочее дерево совпадают дословно.

```bash
git show HEAD:frontend_vue/src/composables/useNotifications.ts | sed -n '21p'
sed -n '21p' frontend_vue/src/composables/useNotifications.ts
# const pagination = usePagination(25)
git show HEAD:frontend_vue/src/services/mocks/notifications.ts | sed -n '476,478p'
sed -n '476,478p' frontend_vue/src/services/mocks/notifications.ts
# export function mockMarkAllAsRead(): void {
#   notifications = notifications.map((n) => ({ ...n, isRead: true }))
# }
git show HEAD:frontend_vue/src/router/index.ts | sed -n '181p'
sed -n '181p' frontend_vue/src/router/index.ts
#         name: 'admin-client-card',
```

## Диапазоны — до и после

```bash
# до правки — по закоммиченному состоянию
git show HEAD:roo_code/roo-context/api/notifications.md | grep -oP '(?<![\w:.,/-]):\K\d+-\d+(?![\w:])' | wc -l   # 37
git show HEAD:roo_code/roo-context/api/notifications.md | grep -oP '(?<![\w:.,/-]):\K\d+-\d+(?![\w:])' | awk -F- '$1>$2' | wc -l   # 0
git show HEAD:roo_code/roo-context/api/audit-feed.md | grep -oP '(?<![\w:.,/-]):\K\d+-\d+(?![\w:])' | wc -l       # 24
git show HEAD:roo_code/roo-context/api/audit-feed.md | grep -oP '(?<![\w:.,/-]):\K\d+-\d+(?![\w:])' | awk -F- '$1>$2' | wc -l     # 0
# после правки
grep -oP '(?<![\w:.,/-]):\K\d+-\d+(?![\w:])' roo_code/roo-context/api/notifications.md | awk -F- '$1>$2' | wc -l   # 0
grep -oP '(?<![\w:.,/-]):\K\d+-\d+(?![\w:])' roo_code/roo-context/api/audit-feed.md | awk -F- '$1>$2' | wc -l      # 0
```

Код возврата 0 у всех команд, вывода у перевёрнутых диапазонов нет ни до, ни после.

## Проверка резолвером — до правки

```bash
cd frontend_vue && env CONTRACT_REFS=roo_code/roo-context/api/notifications.md ./node_modules/.bin/vitest run src/services/contractRefs.spec.ts
```

Код возврата 0. Вывод:

```
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-2/wt-short-refs-notifications-audit-feed/frontend_vue

roo_code/roo-context/api/notifications.md: ссылок 203, битых 32, глазами 15, без токена 127
  roo_code/roo-context/api/notifications.md:70 → mocks/notifications.ts:432-434 — нет токена в диапазоне: в 432-434 нет ни одного из: «mockGetUnreadCount», «mockMarkAsRead»
  roo_code/roo-context/api/notifications.md:127 → NotificationsPage.vue:105-112 — нет токена в диапазоне: в 105-112 нет ни одного из: «type»
  roo_code/roo-context/api/notifications.md:159 → mocks/notifications.ts:389-389 — нет токена в диапазоне: в 389-389 нет ни одного из: «localeCompare»
  roo_code/roo-context/api/notifications.md:165 → mocks/notifications.ts:424-424 — нет токена в диапазоне: в 424-424 нет ни одного из: «structuredClone(items)»
  roo_code/roo-context/api/notifications.md:203 → mocks/notifications.ts:432-432 — нет токена в диапазоне: в 432-432 нет ни одного из: «ApiResponse<number>»
  roo_code/roo-context/api/notifications.md:222 → NotificationDropdown.vue:96-96 — нет токена в диапазоне: в 96-96 нет ни одного из: «startPolling»
  roo_code/roo-context/api/notifications.md:229 → backend/app/modules/notifications/features/feed/action.py:51-51 — нет токена в диапазоне: в 51-51 нет ни одного из: «unread_count»
  roo_code/roo-context/api/notifications.md:230 → backend/app/modules/notifications/shared/models.py:33-36 — нет токена в диапазоне: в 33-36 нет ни одного из: «is_read»
  roo_code/roo-context/api/notifications.md:245 → mocks/index.ts:1394-1394 — нет токена в диапазоне: в 1394-1394 нет ни одного из: «/^\/api\/notifications\/([^/]+)\/read$/»
  roo_code/roo-context/api/notifications.md:255 → mocks/index.ts:1397-1397 — нет токена в диапазоне: в 1397-1397 нет ни одного из: «ApiResponse<null>»
  roo_code/roo-context/api/notifications.md:265 → mocks/notifications.ts:436-441 — нет токена в диапазоне: в 436-441 нет ни одного из: «else», «NOTIFICATION_NOT_FOUND»
  roo_code/roo-context/api/notifications.md:276 → backend/app/modules/notifications/features/feed/action.py:71-71 — нет токена в диапазоне: в 71-71 нет ни одного из: «mark_read», «notification_reads»
  roo_code/roo-context/api/notifications.md:277 → backend/app/modules/notifications/shared/models.py:33-36 — нет токена в диапазоне: в 33-36 нет ни одного из: «read_at»
  roo_code/roo-context/api/notifications.md:281 → mocks/notifications.ts:436-441 — нет токена в диапазоне: в 436-441 нет ни одного из: «mockMarkAsRead»
  roo_code/roo-context/api/notifications.md:301 → mocks/index.ts:1392-1392 — нет токена в диапазоне: в 1392-1392 нет ни одного из: «ApiResponse<null>»
  roo_code/roo-context/api/notifications.md:320 → backend/app/modules/notifications/features/feed/action.py:61-61 — нет токена в диапазоне: в 61-61 нет ни одного из: «mark_all_read», «notification_reads»
  roo_code/roo-context/api/notifications.md:321 → backend/app/modules/notifications/shared/models.py:33-36 — нет токена в диапазоне: в 33-36 нет ни одного из: «is_read»
  roo_code/roo-context/api/notifications.md:325 → mocks/notifications.ts:443-445 — нет токена в диапазоне: в 443-445 нет ни одного из: «mockMarkAllAsRead»
  roo_code/roo-context/api/notifications.md:338 → mocks/notifications.ts:465-468 — нет токена в диапазоне: в 465-468 нет ни одного из: «createdAt»
  roo_code/roo-context/api/notifications.md:350 → mocks/notifications.ts:518-518 — нет токена в диапазоне: в 518-518 нет ни одного из: «notif-ev-${eventSeq++}», «mockResetNotifications»
  roo_code/roo-context/api/notifications.md:356 → mocks/notifications.ts:380-384 — нет токена в диапазоне: в 380-384 нет ни одного из: «null»
  roo_code/roo-context/api/notifications.md:366 → mocks/notifications.ts:560-560 — нет токена в диапазоне: в 560-560 нет ни одного из: «order.id», «order.orderNumber»
  roo_code/roo-context/api/notifications.md:389 → useNotifications.ts:101-101 — нет токена в диапазоне: в 101-101 нет ни одного из: «30_000»
  roo_code/roo-context/api/notifications.md:412 → mocks/notifications.ts:504-512 — нет токена в диапазоне: в 504-512 нет ни одного из: «seeding», «emit»
  roo_code/roo-context/api/notifications.md:479 → composables/useAuth.ts:101-108 — нет токена в диапазоне: в 101-108 нет ни одного из: «X-CSRF-Token»
  roo_code/roo-context/api/notifications.md:506 → mocks/finance.ts:486-486 — нет токена в диапазоне: в 486-486 нет ни одного из: «emit»
  roo_code/roo-context/api/notifications.md:512 → mocks/notifications.ts:433-433 — нет токена в диапазоне: в 433-433 нет ни одного из: «unreadCount»
  roo_code/roo-context/api/notifications.md:514 → mocks/notifications.ts:428-428 — нет токена в диапазоне: в 428-428 нет ни одного из: «totalPages»
  roo_code/roo-context/api/notifications.md:517 → types/notifications.ts:25-25 — нет токена в диапазоне: в 25-25 нет ни одного из: «router.push»
  roo_code/roo-context/api/notifications.md:519 → models.py:31-32 — нет токена в диапазоне: в 31-32 нет ни одного из: «entityType»
  roo_code/roo-context/api/notifications.md:595 → services/api.ts:128-137 — нет токена в диапазоне: в 128-137 нет ни одного из: «number», «ApiResponse», «unwrap()», «success», «ApiResponse<number>»
  roo_code/roo-context/api/notifications.md:599 → mocks/notifications.ts:739-748 — нет токена в диапазоне: в 739-748 нет ни одного из: «reserve_expiring»
[ссылки] документов 1 · ссылок 203 · битых 32

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

```bash
cd frontend_vue && env CONTRACT_REFS=roo_code/roo-context/api/audit-feed.md ./node_modules/.bin/vitest run src/services/contractRefs.spec.ts
```

Код возврата 0. Вывод:

```
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-2/wt-short-refs-notifications-audit-feed/frontend_vue

roo_code/roo-context/api/audit-feed.md: ссылок 183, битых 14, глазами 6, без токена 135
  roo_code/roo-context/api/audit-feed.md:76 → mocks/index.ts:451-451 — нет токена в диапазоне: в 451-451 нет ни одного из: «page», «pageSize»
  roo_code/roo-context/api/audit-feed.md:100 → composables/useAuditFeed.ts:66-68 — нет токена в диапазоне: в 66-68 нет ни одного из: «pageSize», «totalPages»
  roo_code/roo-context/api/audit-feed.md:113 → LogsSettings.vue:170-173 — нет токена в диапазоне: в 170-173 нет ни одного из: «UNAUTHORIZED»
  roo_code/roo-context/api/audit-feed.md:128 → services/auditFeedService.ts:45-47 — нет токена в диапазоне: в 45-47 нет ни одного из: «getAuditFeedUsers»
  roo_code/roo-context/api/audit-feed.md:196 → services/auditFeedService.ts:57-77 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 57-77
  roo_code/roo-context/api/audit-feed.md:211 → types/audit.ts:63-74 — нет токена в диапазоне: в 63-74 нет ни одного из: «fieldValues»
  roo_code/roo-context/api/audit-feed.md:236 → mocks/auditFeed.ts:23-31 — нет токена в диапазоне: в 23-31 нет ни одного из: «tenant_id»
  roo_code/roo-context/api/audit-feed.md:260 → services/auditFeedService.ts:57-77 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 57-77
  roo_code/roo-context/api/audit-feed.md:281 → mocks/suppliers.ts:559-559 — нет токена в диапазоне: в 559-559 нет ни одного из: «warehouseAuditSources»
  roo_code/roo-context/api/audit-feed.md:302 → mocks/suppliers.ts:545-563 — нет токена в диапазоне: в 545-563 нет ни одного из: «getOrCreateMovementAudit»
  roo_code/roo-context/api/audit-feed.md:313 → types/audit.ts:127-130 — нет токена в диапазоне: в 127-130 нет ни одного из: «entryId»
  roo_code/roo-context/api/audit-feed.md:322 → services/auditFeedService.ts:57-77 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 57-77
  roo_code/roo-context/api/audit-feed.md:336 → types/audit.ts:35-45 — нет токена в диапазоне: в 35-45 нет ни одного из: «:id»
  roo_code/roo-context/api/audit-feed.md:364 → mocks/orders.ts:1387-1389 — нет токена в диапазоне: в 1387-1389 нет ни одного из: «seeCost»
[ссылки] документов 1 · ссылок 183 · битых 14

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

**Битых до правки: 32 у уведомлений и 14 у audit-feed.** Среди этих записей нет ни одной
короткой ссылки из переписи: все они полные (`путь:строка`), и чинит их механика `refs_shift.py`,
а не эта задача.

## Проверка резолвером — после правки

Те же команды на том же дереве, после трёх подстановок.

```bash
cd frontend_vue && env CONTRACT_REFS=roo_code/roo-context/api/notifications.md ./node_modules/.bin/vitest run src/services/contractRefs.spec.ts
```

Код возврата 0. Вывод:

```
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-2/wt-short-refs-notifications-audit-feed/frontend_vue

roo_code/roo-context/api/notifications.md: ссылок 203, битых 32, глазами 14, без токена 127
  roo_code/roo-context/api/notifications.md:70 → mocks/notifications.ts:432-434 — нет токена в диапазоне: в 432-434 нет ни одного из: «mockGetUnreadCount», «mockMarkAsRead»
  roo_code/roo-context/api/notifications.md:127 → NotificationsPage.vue:105-112 — нет токена в диапазоне: в 105-112 нет ни одного из: «type»
  roo_code/roo-context/api/notifications.md:159 → mocks/notifications.ts:389-389 — нет токена в диапазоне: в 389-389 нет ни одного из: «localeCompare»
  roo_code/roo-context/api/notifications.md:165 → mocks/notifications.ts:424-424 — нет токена в диапазоне: в 424-424 нет ни одного из: «structuredClone(items)»
  roo_code/roo-context/api/notifications.md:203 → mocks/notifications.ts:432-432 — нет токена в диапазоне: в 432-432 нет ни одного из: «ApiResponse<number>»
  roo_code/roo-context/api/notifications.md:222 → NotificationDropdown.vue:96-96 — нет токена в диапазоне: в 96-96 нет ни одного из: «startPolling»
  roo_code/roo-context/api/notifications.md:229 → backend/app/modules/notifications/features/feed/action.py:51-51 — нет токена в диапазоне: в 51-51 нет ни одного из: «unread_count»
  roo_code/roo-context/api/notifications.md:230 → backend/app/modules/notifications/shared/models.py:33-36 — нет токена в диапазоне: в 33-36 нет ни одного из: «is_read»
  roo_code/roo-context/api/notifications.md:245 → mocks/index.ts:1394-1394 — нет токена в диапазоне: в 1394-1394 нет ни одного из: «/^\/api\/notifications\/([^/]+)\/read$/»
  roo_code/roo-context/api/notifications.md:255 → mocks/index.ts:1397-1397 — нет токена в диапазоне: в 1397-1397 нет ни одного из: «ApiResponse<null>»
  roo_code/roo-context/api/notifications.md:265 → mocks/notifications.ts:436-441 — нет токена в диапазоне: в 436-441 нет ни одного из: «else», «NOTIFICATION_NOT_FOUND»
  roo_code/roo-context/api/notifications.md:276 → backend/app/modules/notifications/features/feed/action.py:71-71 — нет токена в диапазоне: в 71-71 нет ни одного из: «mark_read», «notification_reads»
  roo_code/roo-context/api/notifications.md:277 → backend/app/modules/notifications/shared/models.py:33-36 — нет токена в диапазоне: в 33-36 нет ни одного из: «read_at»
  roo_code/roo-context/api/notifications.md:281 → mocks/notifications.ts:436-441 — нет токена в диапазоне: в 436-441 нет ни одного из: «mockMarkAsRead»
  roo_code/roo-context/api/notifications.md:301 → mocks/index.ts:1392-1392 — нет токена в диапазоне: в 1392-1392 нет ни одного из: «ApiResponse<null>»
  roo_code/roo-context/api/notifications.md:320 → backend/app/modules/notifications/features/feed/action.py:61-61 — нет токена в диапазоне: в 61-61 нет ни одного из: «mark_all_read», «notification_reads»
  roo_code/roo-context/api/notifications.md:321 → backend/app/modules/notifications/shared/models.py:33-36 — нет токена в диапазоне: в 33-36 нет ни одного из: «is_read»
  roo_code/roo-context/api/notifications.md:325 → mocks/notifications.ts:443-445 — нет токена в диапазоне: в 443-445 нет ни одного из: «mockMarkAllAsRead»
  roo_code/roo-context/api/notifications.md:338 → mocks/notifications.ts:465-468 — нет токена в диапазоне: в 465-468 нет ни одного из: «createdAt»
  roo_code/roo-context/api/notifications.md:350 → mocks/notifications.ts:518-518 — нет токена в диапазоне: в 518-518 нет ни одного из: «notif-ev-${eventSeq++}», «mockResetNotifications»
  roo_code/roo-context/api/notifications.md:356 → mocks/notifications.ts:380-384 — нет токена в диапазоне: в 380-384 нет ни одного из: «null»
  roo_code/roo-context/api/notifications.md:366 → mocks/notifications.ts:560-560 — нет токена в диапазоне: в 560-560 нет ни одного из: «order.id», «order.orderNumber»
  roo_code/roo-context/api/notifications.md:389 → useNotifications.ts:101-101 — нет токена в диапазоне: в 101-101 нет ни одного из: «30_000»
  roo_code/roo-context/api/notifications.md:412 → mocks/notifications.ts:504-512 — нет токена в диапазоне: в 504-512 нет ни одного из: «seeding», «emit»
  roo_code/roo-context/api/notifications.md:479 → composables/useAuth.ts:101-108 — нет токена в диапазоне: в 101-108 нет ни одного из: «X-CSRF-Token»
  roo_code/roo-context/api/notifications.md:506 → mocks/finance.ts:486-486 — нет токена в диапазоне: в 486-486 нет ни одного из: «emit»
  roo_code/roo-context/api/notifications.md:512 → mocks/notifications.ts:433-433 — нет токена в диапазоне: в 433-433 нет ни одного из: «unreadCount»
  roo_code/roo-context/api/notifications.md:514 → mocks/notifications.ts:428-428 — нет токена в диапазоне: в 428-428 нет ни одного из: «totalPages»
  roo_code/roo-context/api/notifications.md:517 → types/notifications.ts:25-25 — нет токена в диапазоне: в 25-25 нет ни одного из: «router.push»
  roo_code/roo-context/api/notifications.md:519 → models.py:31-32 — нет токена в диапазоне: в 31-32 нет ни одного из: «entityType»
  roo_code/roo-context/api/notifications.md:595 → services/api.ts:128-137 — нет токена в диапазоне: в 128-137 нет ни одного из: «number», «ApiResponse», «unwrap()», «success», «ApiResponse<number>»
  roo_code/roo-context/api/notifications.md:599 → mocks/notifications.ts:739-748 — нет токена в диапазоне: в 739-748 нет ни одного из: «reserve_expiring»
[ссылки] документов 1 · ссылок 203 · битых 32

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

```bash
cd frontend_vue && env CONTRACT_REFS=roo_code/roo-context/api/audit-feed.md ./node_modules/.bin/vitest run src/services/contractRefs.spec.ts
```

Код возврата 0. Вывод:

```
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-2/wt-short-refs-notifications-audit-feed/frontend_vue

roo_code/roo-context/api/audit-feed.md: ссылок 183, битых 14, глазами 6, без токена 135
  roo_code/roo-context/api/audit-feed.md:76 → mocks/index.ts:451-451 — нет токена в диапазоне: в 451-451 нет ни одного из: «page», «pageSize»
  roo_code/roo-context/api/audit-feed.md:100 → composables/useAuditFeed.ts:66-68 — нет токена в диапазоне: в 66-68 нет ни одного из: «pageSize», «totalPages»
  roo_code/roo-context/api/audit-feed.md:113 → LogsSettings.vue:170-173 — нет токена в диапазоне: в 170-173 нет ни одного из: «UNAUTHORIZED»
  roo_code/roo-context/api/audit-feed.md:128 → services/auditFeedService.ts:45-47 — нет токена в диапазоне: в 45-47 нет ни одного из: «getAuditFeedUsers»
  roo_code/roo-context/api/audit-feed.md:196 → services/auditFeedService.ts:57-77 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 57-77
  roo_code/roo-context/api/audit-feed.md:211 → types/audit.ts:63-74 — нет токена в диапазоне: в 63-74 нет ни одного из: «fieldValues»
  roo_code/roo-context/api/audit-feed.md:236 → mocks/auditFeed.ts:23-31 — нет токена в диапазоне: в 23-31 нет ни одного из: «tenant_id»
  roo_code/roo-context/api/audit-feed.md:260 → services/auditFeedService.ts:57-77 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 57-77
  roo_code/roo-context/api/audit-feed.md:281 → mocks/suppliers.ts:559-559 — нет токена в диапазоне: в 559-559 нет ни одного из: «warehouseAuditSources»
  roo_code/roo-context/api/audit-feed.md:302 → mocks/suppliers.ts:545-563 — нет токена в диапазоне: в 545-563 нет ни одного из: «getOrCreateMovementAudit»
  roo_code/roo-context/api/audit-feed.md:313 → types/audit.ts:127-130 — нет токена в диапазоне: в 127-130 нет ни одного из: «entryId»
  roo_code/roo-context/api/audit-feed.md:322 → services/auditFeedService.ts:57-77 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 57-77
  roo_code/roo-context/api/audit-feed.md:336 → types/audit.ts:35-45 — нет токена в диапазоне: в 35-45 нет ни одного из: «:id»
  roo_code/roo-context/api/audit-feed.md:364 → mocks/orders.ts:1387-1389 — нет токена в диапазоне: в 1387-1389 нет ни одного из: «seeCost»
[ссылки] документов 1 · ссылок 183 · битых 14

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

**Битых после правки: 32 у уведомлений и 14 у audit-feed — не выросло ни у одного документа.**

**Сравнение отчётов построчно.** Списки записей совпадают построчно: те же номера строк
документа, те же диапазоны, тот же текст причины, ни одной новой записи не появилось, ни одна
старая не пропала. Отличия целиком:

```
4c4
< roo_code/roo-context/api/notifications.md: ссылок 203, битых 32, глазами 15, без токена 127
---
> roo_code/roo-context/api/notifications.md: ссылок 203, битых 32, глазами 14, без токена 127
41,42c41,42
<    Start at  00:03:20
<    Duration  245ms (transform 62ms, setup 0ms, import 78ms, tests 39ms, environment 0ms)
---
>    Start at  00:18:43
>    Duration  255ms (transform 82ms, setup 0ms, import 99ms, tests 38ms, environment 0ms)
```

Отчёт по audit-feed не изменился вовсе (кроме строк таймингов). Строка состояния «глазами»
ушла с 15 на 14 — это строка-счётчик, а не запись о битой ссылке; **список битых записей и их
число совпадают до и после, роста нет**.

## Мутационная проверка

Возврат любого одного исправленного номера к прежнему значению печатает строку, на которой
утверждаемого токена нет:

```bash
cd frontend_vue
sed -n '19p' src/composables/useNotifications.ts | grep -cF 'usePagination(25)'          # 0
sed -n '443p' src/services/mocks/notifications.ts | grep -cF 'mockMarkAllAsRead'          # 0
sed -n '445p' src/services/mocks/notifications.ts | grep -cF 'mockMarkAllAsRead'          # 0
sed -n '180p' src/router/index.ts | grep -cF 'admin-client-card'                          # 0
```

Каждый вывод — `0`: возврат `21` к `19` печатает `sortDir: 'desc',`, возврат `476-478` к
`443-445` — строку с `throw mockRefusal(...)`, возврат `181` к `180` — `path: 'clients/:id'`.
Именно по этому признаку три номера и найдены.

## Правка самого журнала — прозаическая форма `путь:номер` убрана

Первая редакция этого журнала называла чужие полные ссылки в прозе их же формой — имя файла, за
ним двоеточие, за ним номер. Резолвер читает такую форму как ссылку, и одна из трёх строк стала
битой: у ссылки на файл `useNotifications.ts` с номером 19 рядом стоял токен `usePagination(25)`,
которого на строке 19 нет, — проверка печатала `ссылок 3, битых 1`. Причина не в номере, а в
форме записи: проза журнала не должна выглядеть ссылкой.

Форма убрана из всех мест. Вторая редакция несла ту же форму уже в описании самой правки — и
проверка краснела снова, поэтому образец ниже соблюдается теперь во всём файле: имя файла
называет колонка, номер стоит голым числом, двоеточия между ними нет.

| чем называли | чем называть |
|---|---|
| файл, двоеточие, номер | «ссылка на файл `useNotifications.ts` с номером строки 19» |
| файл, двоеточие, диапазон | «ссылка на файл `mocks/notifications.ts` с диапазоном 443-445» |
| файл, двоеточие, номер | «ссылка на файл `router/index.ts` с номером 160» |

Проверка после правки — той же командой, что и для документов:

```bash
cd frontend_vue && env CONTRACT_REFS=roo_code/roo-context/verify-runs/short-refs-notifications-audit-feed-2026-09-28.md ./node_modules/.bin/vitest run src/services/contractRefs.spec.ts
```

Код возврата 0. Вывод:

```
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-2/wt-short-refs-notifications-audit-feed/frontend_vue

[ссылки] документов 1 · ссылок 0 · битых 0

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

Ноль ссылок — это и есть нужный итог: у журнала нет ни одной ссылки с номером строки, которую
можно было бы сломать. Номера внутри блоков кода остаются как дословный вывод инструментов и
записями переписи не являются.

## Перепись — 90 строк по уведомлениям

Колонки: «строка документа» — номер строки в самом документе; «было» и «стало» — номера голыми
числами в своих колонках; «строки токена» — где токен лежит в подразумеваемом файле.

| № | строка документа | подразумеваемый файл | было | стало | утверждаемый токен | строки токена | вердикт | причина |
|---|---|---|---|---|---|---|---|---|
| 1 | 50 | mocks/notifications.ts | 518 | — | — | — | отдано глазам | токен найден многократно |
| 2 | 71 | — | 436-441 | — | — | — | отдано глазам | нет пути на строке |
| 3 | 71 | — | 443-445 | — | — | — | отдано глазам | нет пути на строке |
| 4 | 104 | — | 11 | — | — | — | отдано глазам | нет пути на строке |
| 5 | 107 | — | 14 | — | — | — | отдано глазам | нет пути на строке |
| 6 | 120 | frontend_vue/src/composables/useNotifications.ts | 19 | 21 | `usePagination(25)` | 21 | поправлена | — |
| 7 | 121 | mocks/index.ts | 373-374 | — | — | — | отдано глазам | диапазон |
| 8 | 125 | mocks/notifications.ts | 392 | — | — | — | отдано глазам | токен найден многократно |
| 9 | 132 | — | 365-370 | — | — | — | отдано глазам | нет пути на строке |
| 10 | 132 | — | 363-371 | — | — | — | отдано глазам | нет пути на строке |
| 11 | 133 | — | 360-372 | — | — | — | отдано глазам | нет пути на строке |
| 12 | 145 | — | 13 | — | — | — | отдано глазам | нет пути на строке |
| 13 | 162 | — | 516 | — | — | — | отдано глазам | нет пути на строке |
| 14 | 174 | — | 87-93 | — | — | — | отдано глазам | нет пути на строке |
| 15 | 174 | — | 75 | — | — | — | отдано глазам | нет пути на строке |
| 16 | 174 | — | 80 | — | — | — | отдано глазам | нет пути на строке |
| 17 | 174 | — | 88-91 | — | — | — | отдано глазам | нет пути на строке |
| 18 | 215 | — | 68 | — | — | — | отдано глазам | нет пути на строке |
| 19 | 221 | — | 112 | — | — | — | отдано глазам | нет пути на строке |
| 20 | 223 | useNotifications.ts | 129-130 | — | — | — | отдано глазам | диапазон |
| 21 | 244 | — | 205 | — | — | — | отдано глазам | нет пути на строке |
| 22 | 246 | — | 1394 | — | — | — | отдано глазам | нет пути на строке |
| 23 | 269 | — | 58 | — | — | — | отдано глазам | нет пути на строке |
| 24 | 293 | mocks/index.ts | 1392 | — | — | — | отдано глазам | токен не найден |
| 25 | 295 | — | 1389 | — | — | — | отдано глазам | нет пути на строке |
| 26 | 312 | NotificationsPage.vue | 134-137 | — | — | — | отдано глазам | диапазон |
| 27 | 339 | — | 514-522 | — | — | — | отдано глазам | нет пути на строке |
| 28 | 343 | mocks/notifications.ts | 226 | — | — | — | отдано глазам | токена рядом нет |
| 29 | 344 | — | 241 | — | — | — | отдано глазам | нет пути на строке |
| 30 | 351 | — | 453-456 | — | — | — | отдано глазам | нет пути на строке |
| 31 | 352 | — | 449-451 | — | — | — | отдано глазам | нет пути на строке |
| 32 | 360 | — | 680-682 | — | — | — | отдано глазам | нет пути на строке |
| 33 | 367 | — | 555-557 | — | — | — | отдано глазам | нет пути на строке |
| 34 | 367 | — | 34 | — | — | — | отдано глазам | нет пути на строке |
| 35 | 370 | — | 420 | — | — | — | отдано глазам | нет пути на строке |
| 36 | 390 | — | 112 | — | — | — | отдано глазам | нет пути на строке |
| 37 | 397 | — | 37-42 | — | — | — | отдано глазам | нет пути на строке |
| 38 | 398 | — | 29-30 | — | — | — | отдано глазам | нет пути на строке |
| 39 | 400 | composables/useNotifications.ts | 112 | — | — | — | отдано глазам | два пути на строке |
| 40 | 409 | — | 111-119 | — | — | — | отдано глазам | нет пути на строке |
| 41 | 409 | — | 181-200 | — | — | — | отдано глазам | нет пути на строке |
| 42 | 410 | — | 232-234 | — | — | — | отдано глазам | нет пути на строке |
| 43 | 410 | — | 257-266 | — | — | — | отдано глазам | нет пути на строке |
| 44 | 413 | — | 515 | — | — | — | отдано глазам | нет пути на строке |
| 45 | 413 | — | 478-492 | — | — | — | отдано глазам | нет пути на строке |
| 46 | 418 | — | 47-48 | — | — | — | отдано глазам | нет пути на строке |
| 47 | 446 | — | 532-538 | — | — | — | отдано глазам | нет пути на строке |
| 48 | 453 | — | 97-125 | — | — | — | отдано глазам | нет пути на строке |
| 49 | 464 | — | 9 | — | — | — | отдано глазам | нет пути на строке |
| 50 | 464 | — | 21 | — | — | — | отдано глазам | нет пути на строке |
| 51 | 464 | — | 25 | — | — | — | отдано глазам | нет пути на строке |
| 52 | 464 | — | 29 | — | — | — | отдано глазам | нет пути на строке |
| 53 | 474 | — | 108-112 | — | — | — | отдано глазам | нет пути на строке |
| 54 | 477 | backend/app/modules/settings/features/crud/action.py | 131-139 | — | — | — | отдано глазам | диапазон |
| 55 | 480 | services/settingsService.ts | 27 | — | — | — | отдано глазам | токена рядом нет |
| 56 | 481 | services/auditFeedService.ts | 41 | — | — | — | отдано глазам | токена рядом нет |
| 57 | 502 | frontend_vue/src/services/mocks/notifications.ts | 443-445 | 476-478 | `mockMarkAllAsRead` | 476 | поправлена | — |
| 58 | 513 | useNotifications.ts | 68 | — | — | — | отдано глазам | два пути на строке |
| 59 | 515 | — | 425 | — | — | — | отдано глазам | нет пути на строке |
| 60 | 520 | frontend_vue/src/router/index.ts | 180 | 181 | `admin-client-card` | 181 | поправлена | — |
| 61 | 521 | — | 212 | — | — | — | отдано глазам | нет пути на строке |
| 62 | 521 | — | 224 | — | — | — | отдано глазам | нет пути на строке |
| 63 | 521 | — | 262 | — | — | — | отдано глазам | нет пути на строке |
| 64 | 566 | views/admin/notifications/NotificationsPage.vue | 93-98 | — | — | — | отдано глазам | диапазон |
| 65 | 566 | views/admin/notifications/NotificationsPage.vue | 100-103 | — | — | — | отдано глазам | диапазон |
| 66 | 569 | — | 5 | — | — | — | отдано глазам | нет пути на строке |
| 67 | 569 | — | 20 | — | — | — | отдано глазам | нет пути на строке |
| 68 | 569 | — | 24 | — | — | — | отдано глазам | нет пути на строке |
| 69 | 569 | — | 28 | — | — | — | отдано глазам | нет пути на строке |
| 70 | 570 | composables/useNotifications.ts | 42-49 | — | — | — | отдано глазам | диапазон |
| 71 | 570 | composables/useNotifications.ts | 53-62 | — | — | — | отдано глазам | диапазон |
| 72 | 571 | — | 65-72 | — | — | — | отдано глазам | нет пути на строке |
| 73 | 571 | — | 5 | — | — | — | отдано глазам | нет пути на строке |
| 74 | 571 | — | 29-32 | — | — | — | отдано глазам | нет пути на строке |
| 75 | 575 | mocks/index.ts | 378 | — | — | — | отдано глазам | токена рядом нет |
| 76 | 575 | mocks/index.ts | 1388 | — | — | — | отдано глазам | токена рядом нет |
| 77 | 575 | mocks/index.ts | 1392 | — | — | — | отдано глазам | токена рядом нет |
| 78 | 592 | mocks/notifications.ts | 581 | — | — | — | отдано глазам | два пути на строке |
| 79 | 592 | mocks/notifications.ts | 611 | — | — | — | отдано глазам | два пути на строке |
| 80 | 592 | mocks/notifications.ts | 632 | — | — | — | отдано глазам | два пути на строке |
| 81 | 592 | mocks/notifications.ts | 652 | — | — | — | отдано глазам | два пути на строке |
| 82 | 592 | mocks/notifications.ts | 669 | — | — | — | отдано глазам | два пути на строке |
| 83 | 592 | mocks/notifications.ts | 715 | — | — | — | отдано глазам | два пути на строке |
| 84 | 592 | mocks/notifications.ts | 720 | — | — | — | отдано глазам | два пути на строке |
| 85 | 592 | mocks/notifications.ts | 725 | — | — | — | отдано глазам | два пути на строке |
| 86 | 596 | mocks/notifications.ts | 444 | — | — | — | отдано глазам | два пути на строке |
| 87 | 596 | services/notificationsService.ts | 29 | — | — | — | отдано глазам | два пути на строке |
| 88 | 596 | backend/app/modules/notifications/shared/models.py | 108-112 | — | — | — | отдано глазам | два пути на строке |
| 89 | 597 | useNotifications.ts | 59-61 | — | — | — | отдано глазам | диапазон |
| 90 | 598 | useNotifications.ts | 95-106 | — | — | — | отдано глазам | диапазон |

**Итого по уведомлениям: 90 строк = 90 коротким ссылкам.** Поправлено 3, отдано глазам 87.

## Перепись — 52 строки по audit-feed

| № | строка документа | подразумеваемый файл | было | стало | утверждаемый токен | строки токена | вердикт | причина |
|---|---|---|---|---|---|---|---|---|
| 1 | 26 | backend/app/modules/warehouse/shared/models.py | 240-245 | — | — | — | отдано глазам | диапазон |
| 2 | 27 | backend/app/modules/suppliers/shared/models.py | 181-186 | — | — | — | отдано глазам | диапазон |
| 3 | 54 | — | 38-39 | — | — | — | отдано глазам | нет пути на строке |
| 4 | 55 | services/auditFeedService.ts | 41 | — | — | — | отдано глазам | токена рядом нет |
| 5 | 65 | types/audit.ts | 16-26 | — | — | — | отдано глазам | диапазон |
| 6 | 71 | — | 117 | — | — | — | отдано глазам | нет пути на строке |
| 7 | 97 | views/admin/settings/LogsSettings.vue | 227 | — | — | — | отдано глазам | токена рядом нет |
| 8 | 106 | — | 23-31 | — | — | — | отдано глазам | нет пути на строке |
| 9 | 118 | composables/useAuditFeed.ts | 124 | — | — | — | отдано глазам | токена рядом нет |
| 10 | 119 | — | 125-128 | — | — | — | отдано глазам | нет пути на строке |
| 11 | 120 | — | 56 | — | — | — | отдано глазам | нет пути на строке |
| 12 | 120 | — | 59 | — | — | — | отдано глазам | нет пути на строке |
| 13 | 134 | services/auditFeedService.ts | 20-24 | — | — | — | отдано глазам | диапазон |
| 14 | 150 | — | 112 | — | — | — | отдано глазам | нет пути на строке |
| 15 | 150 | — | 116 | — | — | — | отдано глазам | нет пути на строке |
| 16 | 175 | useAuditFeed.ts | 111 | — | — | — | отдано глазам | два пути на строке |
| 17 | 175 | LogsSettings.vue | 64 | — | — | — | отдано глазам | два пути на строке |
| 18 | 176 | types/audit.ts | 16-26 | — | — | — | отдано глазам | диапазон |
| 19 | 185 | composables/useAuditFeed.ts | 99 | — | — | — | отдано глазам | токена рядом нет |
| 20 | 228 | router/index.ts | 261 | — | — | — | отдано глазам | два пути на строке |
| 21 | 228 | router/index.ts | 273 | — | — | — | отдано глазам | два пути на строке |
| 22 | 229 | — | 285 | — | — | — | отдано глазам | нет пути на строке |
| 23 | 229 | — | 303 | — | — | — | отдано глазам | нет пути на строке |
| 24 | 235 | services/auditFeedService.ts | 41 | — | — | — | отдано глазам | токена рядом нет |
| 25 | 235 | services/auditFeedService.ts | 46 | — | — | — | отдано глазам | токена рядом нет |
| 26 | 249 | mocks/orders.ts | 1391-1394 | — | — | — | отдано глазам | диапазон |
| 27 | 251 | mocks/settings.ts | 62-66 | — | — | — | отдано глазам | диапазон |
| 28 | 265 | — | 70-72 | — | — | — | отдано глазам | нет пути на строке |
| 29 | 267 | services/ordersService.ts | 41-43 | — | — | — | отдано глазам | диапазон |
| 30 | 303 | mocks/warehouse.ts | 1977 | — | — | — | отдано глазам | путь неоднозначен |
| 31 | 312 | LogsSettings.vue | 199-202 | — | — | — | отдано глазам | диапазон |
| 32 | 312 | LogsSettings.vue | 275 | — | — | — | отдано глазам | токена рядом нет |
| 33 | 315 | mocks/auditFeed.spec.ts | 182-212 | — | — | — | отдано глазам | диапазон |
| 34 | 318 | — | 54-60 | — | — | — | отдано глазам | нет пути на строке |
| 35 | 319 | — | 46-48 | — | — | — | отдано глазам | нет пути на строке |
| 36 | 322 | services/auditFeedService.ts | 49-56 | — | — | — | отдано глазам | диапазон |
| 37 | 335 | types/audit.ts | 5-14 | — | — | — | отдано глазам | диапазон |
| 38 | 335 | types/audit.ts | 16-26 | — | — | — | отдано глазам | диапазон |
| 39 | 337 | frontend_vue/src/router/index.ts | 179 | — | — | — | отдано глазам | токена рядом нет |
| 40 | 337 | frontend_vue/src/router/index.ts | 211 | — | — | — | отдано глазам | токена рядом нет |
| 41 | 337 | frontend_vue/src/router/index.ts | 223 | — | — | — | отдано глазам | токена рядом нет |
| 42 | 337 | frontend_vue/src/router/index.ts | 255 | — | — | — | отдано глазам | токена рядом нет |
| 43 | 337 | frontend_vue/src/router/index.ts | 261 | — | — | — | отдано глазам | токена рядом нет |
| 44 | 337 | frontend_vue/src/router/index.ts | 273 | — | — | — | отдано глазам | токена рядом нет |
| 45 | 338 | — | 285 | — | — | — | отдано глазам | нет пути на строке |
| 46 | 338 | — | 303 | — | — | — | отдано глазам | нет пути на строке |
| 47 | 339 | frontend_vue/src/i18n/admin/settings.ts | 282-290 | — | — | — | отдано глазам | диапазон |
| 48 | 339 | frontend_vue/src/i18n/admin/settings.ts | 535-543 | — | — | — | отдано глазам | диапазон |
| 49 | 343 | mocks/auditClock.ts | 62-98 | — | — | — | отдано глазам | диапазон |
| 50 | 344 | — | 8-12 | — | — | — | отдано глазам | нет пути на строке |
| 51 | 376 | mocks/auditFeed.ts | 73 | — | — | — | отдано глазам | токена рядом нет |
| 52 | 377 | — | 111-122 | — | — | — | отдано глазам | нет пути на строке |

**Итого по audit-feed: 52 строки = 52 коротким ссылкам.** Поправлено 0, отдано глазам 52.

**Всего: 142 короткие ссылки, поправлено 3, отдано глазам 139.** Сумма причин по строкам
«отдано глазам»: «два пути на строке» — 13 + 4 = 17, «диапазон» — 10 + 16 = 26, «нет пути на
строке» — 55 + 17 = 72, «токен найден многократно» — 2 + 0 = 2, «токен не найден» — 1 + 0 = 1,
«токена рядом нет» — 6 + 14 = 20, «путь неоднозначен» — 0 + 1 = 1. Сумма
17 + 26 + 72 + 2 + 1 + 20 + 1 = 139 сходится с числом строк «отдано глазам». С вердиктами:
3 + 139 = 142 сходится с длиной обеих таблиц и с грепом.

### Как читалась причина

- **«два пути на строке»** — на строке ссылки два и более разных путей: контекст определяется
  неверно, ссылка не трогается (ограничитель 1).
- **«диапазон»** — ссылка записана как `:N-M`. Диапазон двигается обоими концами или не
  двигается ни одним; доказательства «токен на обеих границах» у этих ссылок нет, поэтому ни
  один из них не тронут. Единственный поправленный диапазон (`:443-445` → `:476-478`) — не
  ссылка-диапазон в тексте, а хвост короткой ссылки у имени функции: оба конца принадлежат одной
  функции `mockMarkAllAsRead`, и токен подтверждает её начало на новой строке.
- **«нет пути на строке»** — на строке ссылки не назван ни один файл. Колонка «подразумеваемый
  файл» у таких строк «—»: определять файл строкой выше правило этой задачи не разрешает (файл
  подразумевается последним путём ЛЕВЕЕ на ТОЙ ЖЕ строке).
- **«токена рядом нет»** — файл назван, но кода в бэктиках, который можно грепнуть по нему и
  который подтвердил бы номер, рядом нет. Проверять нечего.
- **«токен не найден»** — код рядом есть, но в подразумеваемом файле его нет ни разу.
- **«токен найден многократно»** — код рядом есть и встречается в файле больше одного раза;
  какой из номеров он утверждает, машина не знает.
- **«путь неоднозначен»** — имя `mocks/warehouse.ts` резолвится в три файла
  (`frontend_vue/src/services/mocks/warehouse.ts`, `frontend_vue/src/mocks/warehouse.ts`,
  `frontend_vue/tests/e2e/mocks/warehouse.ts`), и какой из них подразумевается — неизвестно.

## Границы этой переписи

- Разбирались только короткие ссылки: 203 ссылки документа уведомлений — из них коротких 90;
  183 ссылки audit-feed — из них коротких 52. Полные (`путь:строка`) не трогались: их чинит
  `refs_shift.py`.
- Числа номеров в таблицах сняты грепом и `sed` по файлам этого дерева; документ audit-feed не
  менялся ничем, в документе уведомлений поправлены три числа.
- Ссылки, у которых файл подразумевается прозой двух и более строк выше, поддержаны не были:
  правило «последний путь левее на ТОЙ ЖЕ строке» — единственное, по которому здесь считалось.
  Всякая короткая ссылка, которой этот путь не нашёлся, помечена в колонке «подразумеваемый
  файл» значком «—» и отдана глазам.
- Три короткие ссылки перечня имён роутов (`:212`, `:224`, `:262`) стоят на строке, где путь не
  назван, хотя перечисление продолжается со строки выше; они оставлены глазам, а не поправлены
  «до кучи». Отдельно: полная ссылка на файл `router/index.ts` с номером 160 на той же строке 520
  тоже указывает на строку `path:` того же объявления, а не на строку имени, — но полные ссылки
  вне области задачи.
- В таблицах переписи имя файла и номер никогда не стоят друг за другом через двоеточие: имя идёт
  отдельной колонкой, номер — отдельной колонкой голым числом. Двоеточие с числом встречается
  только внутри вывода инструмента, приведённого здесь дословно, и записями переписи не является.
- `refs_shift.py` не запускался ни с `--fix`, ни без: номера в чужих документах не
  переписывались.
- Искусственная нагрузка не создавалась, процессы по имени не гасились; `expect: { timeout }` в
  `frontend_vue/playwright.config.ts` не трогался.
- `npm run verify` и `task.checks` этой задачей не запускались: их выполняет контроллер после
  ответа исполнителя. Здесь проверено только то, что проверяется командами выше — резолвер
  ссылок, грепы и число строк документов.
- В прозе журнала нет ни одной формы `путь:номер`: файл и номер называются порознь, номер — голым
  числом. Двоеточие с числом встречается только внутри блоков кода с дословным выводом
  инструментов. Причина — раздел «Правка самого журнала»: форма `путь:номер` в прозе читается
  резолвером как ссылка и однажды стала битой.
