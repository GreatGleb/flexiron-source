# Bugs — contract-sync / домен notifications

Источник: сверка контракта с кодом по плану
[`roo_code/plans/api/contract-sync-plan.md`](../api/contract-sync-plan.md), фаза аудита,
линзы К2–К4, К6. Аудит: [`roo_code/plans/api/audit/notifications.md`](../api/audit/notifications.md).
Область: `frontend_vue/src/services/notificationsService.ts`,
`frontend_vue/src/services/mocks/notifications.ts`, ветки notifications в
`frontend_vue/src/services/mocks/index.ts`, `frontend_vue/src/composables/useNotifications.ts`,
`frontend_vue/src/components/admin/NotificationDropdown.vue`,
`frontend_vue/src/views/admin/notifications/NotificationsPage.vue`,
`backend/app/modules/notifications/shared/models.py`.
Начато: 2026-09-04.

План сверки код не правит: расхождение решается в пользу кода, а место, где неверным выглядит
сам код, уходит сюда.

---

## БАГ-01 — клиент уведомлений не шлёт заголовков авторизации, а лента адресная

**File:** `frontend_vue/src/services/notificationsService.ts:9,21,25,29`
**Severity:** High — против настоящего бэкенда сервер не сможет узнать, чью ленту отдавать, и каждый из четырёх вызовов домена уйдёт неопознанным.
**Источник:** К6 (мультиарендность), К4 (формы запроса)

### Problem

Все четыре вызова домена сделаны без третьего аргумента `options`, то есть без заголовков:

```ts
apiGet<PaginatedResponse<Notification>>('/api/notifications', { … })   // :9
apiGet<number>('/api/notifications/unread-count')                       // :21
apiPatch<void>(`/api/notifications/${id}/read`, {})                     // :25
apiPatch<void>('/api/notifications/read-all', {})                       // :29
```

`options?.headers` — единственный источник заголовков у `apiGet`/`apiPatch`
(`frontend_vue/src/services/api.ts:157-159`, `:203-207`). Соседние домены, у которых бэкенд
уже написан, шлют их всегда: `settingsService.ts:18,27` и `auditFeedService.ts:20,41` берут
`Authorization: Bearer …` + `X-CSRF-Token` (заготовка —
`frontend_vue/src/composables/useAuth.ts:101-108`). Сервер именно из этого токена достаёт
`user_id` и по нему тенанта (`backend/app/modules/settings/features/crud/action.py:97-128`,
`:131-139`).

Уведомление при этом адресное: `notifications.user_id` и `notifications.tenant_id` объявлены
`nullable=False` с индексами (`backend/app/modules/notifications/shared/models.py:16-27`,
миграция `backend/alembic/versions/7bf1730620f0_phase_11_notifications.py:27-28`). То есть
запрос без заголовка не сможет ответить ни на «чья лента», ни на «чей счётчик», ни на «имеет ли
этот пользователь право отметить эту запись». Под моками дефект невидим: понятия пользователя у
мока нет вовсе (`grep -n -i "tenant\|userId\|user_id" frontend_vue/src/services/mocks/notifications.ts`
— пусто).

### Fix

Добавить `{ headers: authHeaders() }` во все четыре вызова — тем же способом, каким это уже
сделано в `settingsService.ts` и `auditFeedService.ts`. Заодно видно, что `authHeaders`
существует в трёх экземплярах (`useAuth.ts:101`, `settingsService.ts:18`,
`auditFeedService.ts:20`) — но это отдельная работа, не эта.

### Future rule

Клиентский модуль домена, у которого на схеме есть `tenant_id`/`user_id`, обязан слать
заголовок авторизации, даже пока бэкенда нет. Мок его не требует, поэтому пропуск живёт до
первого настоящего запроса — и обнаруживается как «сервер отдал чужие уведомления», а не как
ошибка компиляции.

---

## БАГ-02 — дропдаун обещает «пять свежих», а показывает пять из текущей отфильтрованной страницы

**File:** `frontend_vue/src/components/admin/NotificationDropdown.vue:19-24`
**Severity:** Medium — колокольчик показывает не то, что обещает; при активном фильтре «только прочитанные» он показывает прочитанные, а при переходе на вторую страницу списка — записи со второй страницы.
**Источник:** К2 (мок ↔ код ↔ контракт)

### Problem

```ts
async function loadDropdownItems() {
  const { load, items } = useNotifications()
  await load()
  dropdownItems.value = items.value.slice(0, 5)   // "Keep only top 5 for the dropdown"
}
```

`useNotifications` — **модульный синглтон** (`frontend_vue/src/composables/useNotifications.ts:6-20`,
комментарий «Shared across all consumers»), и его `load()` собирает запрос из общих `filters` и
общей `page` (`:29-32`). Эти значения принадлежат странице списка: она правит `filters.type`,
`filters.isRead`, `filters.search` и страницу
(`frontend_vue/src/views/admin/notifications/NotificationsPage.vue:50-61`, `:63-71`, `:156-160`).
Значит после того, как пользователь отфильтровал список, колокольчик отдаёт первые пять
**этой выдачи**, а не пять последних уведомлений. Комментарий в коде утверждает обратное
(«Load top 5 notifications for dropdown», `:18`).

Побочно: открытие дропдауна тянет полную страницу списка (`pageSize` до 100,
`NotificationsPage.vue:74-79`), чтобы показать пять строк.

### Fix

Просить у сервиса ровно то, что нужно колокольчику, минуя общее состояние:
`getNotifications({ type: 'all', isRead: null, search: '', sortBy: 'createdAt', sortDir: 'desc' }, { page: 1, pageSize: 5 })`
напрямую из `notificationsService`. Общий синглтон при этом остаётся страницей списка.

### Future rule

Модульный синглтон состояния — это одно окно на всех потребителей. Второй потребитель, которому
нужен другой срез, обязан ходить в сервис сам; `slice()` поверх чужого фильтра выглядит как
независимая выборка и ею не является.

---

## БАГ-03 — опрос счётчика запускается на уровне модуля и не останавливается никогда

**File:** `frontend_vue/src/composables/useNotifications.ts:95-106,108-112`
**Severity:** Medium — после выхода из админки и после логаута таймер продолжает раз в 30 секунд дёргать `/api/notifications/unread-count`; против настоящего сервера это бесконечная череда неавторизованных запросов, и ни одна ошибка при этом не видна (см. БАГ-05).
**Источник:** К6 (обязанности сервера — что и когда клиент спрашивает)

### Problem

```ts
loadUnreadCount()
pollTimer = setInterval(loadUnreadCount, 30_000)   // :111-112 — на уровне модуля
```

Комментарий рядом объясняет решение: «onMounted/onUnmounted skipped because singleton state
outlives any single component; polling runs as long as the module is loaded» (`:108-110`). Но
пара `startPolling`/`stopPolling` (`:95-106`) при этом **экспортирована** (`:129-130`) и не
вызывается ниоткуда: `grep -rn "startPolling\|stopPolling" frontend_vue/src` даёт только
объявление и экспорт. То есть механизм остановки написан, но не подключён, и модуль,
однажды загруженный переходом в админку, опрашивает сервер до перезагрузки вкладки — включая
время после `logout()` (`frontend_vue/src/composables/useAuth.ts:222-236`), который чистит
сессию, но про таймер не знает.

### Fix

TBD по способу: либо звать `stopPolling()` из `logout()` и из размонтирования админского
лейаута, либо привязать опрос к жизни колокольчика (`NotificationDropdown.vue:74-81` уже имеет
`onMounted`/`onUnmounted`). Выбор — за владельцем: у синглтона два потребителя, и «пока висит
колокольчик» и «пока пользователь в системе» — разные правила.

### Future rule

Таймер, заведённый на уровне модуля, не имеет владельца, который его снимет. Если у пары
start/stop нет ни одного вызывающего — это не «на будущее», а незакрытый ресурс.

---

## БАГ-04 — отметка о прочтении несуществующего уведомления молча успешна

**File:** `frontend_vue/src/services/mocks/notifications.ts:436-441`, `frontend_vue/src/composables/useNotifications.ts:51-62`
**Severity:** Medium — код `NOTIFICATION_NOT_FOUND`, который контракт обещает с самого начала, не существует в репозитории; путь ошибки этого эндпоинта не воспроизводится под моками вовсе.
**Источник:** К3 (коды ошибок)

### Problem

Мок отмечает запись, только если нашёл её, и ничего не делает, если нет:

```ts
export function mockMarkAsRead(id: string): void {
  const notification = notifications.find((n) => n.id === id)
  if (notification) { notification.isRead = true }
}
```

Ветки `else` нет, `throw` в функции нет ни одного. Старый контракт при этом объявляет для домена
ровно один код — `NOTIFICATION_NOT_FOUND`, 404 (`roo_code/roo-context/03-api-contract.md:2895`,
`:2977`), — и в коде его нет нигде: `grep -rn "NOTIFICATION_NOT_FOUND" frontend_vue/src backend`
пусто.

Вторая половина той же проблемы — на клиенте: `markAsRead` глотает любую ошибку
(`useNotifications.ts:59-61`), но **до** этого уже уменьшил счётчик непрочитанных
(`:58`, `Math.max(0, unreadCount.value - 1)`). То есть при отказе сервера бейдж всё равно
уменьшится, и разойдётся с сервером на 30 секунд — до следующего опроса.

### Fix

Мок обязан бросать код: `throw new Error('NOTIFICATION_NOT_FOUND')` при ненайденной записи (и,
шире, приводить своё исключение к `ApiRequestError`, как это уже нужно домену categories —
`contract-sync-categories-bugs.md`, БАГ-01). Клиенту — уменьшать счётчик после успеха, а не до,
и не гасить ошибку молча.

### Future rule

Путь ошибки, который под моками не воспроизводится, не проверен ничем: тест зелёный, потому что
ошибки не было. Ветка мока, у которой нет `throw`, обязана быть либо объяснена комментарием как
заведомо безошибочная, либо снабжена кодом из каталога домена.

---

## БАГ-05 — «прочитать всё» из дропдауна не перекрашивает его собственные строки

**File:** `frontend_vue/src/components/admin/NotificationDropdown.vue:16,23,52-54,106`, `frontend_vue/src/composables/useNotifications.ts:64-72`
**Severity:** Low — бейдж исчезает, а строки в открытом дропдауне остаются подсвеченными как непрочитанные до следующего открытия.
**Источник:** К2 (мок ↔ код)

### Problem

`markAllAsRead` **заменяет** массив новыми объектами:

```ts
items.value = items.value.map((n) => ({ ...n, isRead: true }))   // useNotifications.ts:67
unreadCount.value = 0                                            // :68
```

`dropdownItems` — локальная копия ссылок, снятая раньше (`NotificationDropdown.vue:23`,
`items.value.slice(0, 5)`), и после замены она продолжает держать **прежние** объекты, у
которых `isRead === false`. Класс строки завязан именно на это поле
(`:106`, `:class="{ 'notif-item--unread': !notification.isRead }"`), а `onMarkAllRead`
перезагрузки не делает (`:52-54`) — в отличие от страницы, где после отметки стоит `load()`
(`frontend_vue/src/views/admin/notifications/NotificationsPage.vue:100-103`).

E2E этого не ловит: тест «mark all read in dropdown updates badge count» проверяет только
исчезновение бейджа (`frontend_vue/tests/e2e/admin/notifications/notifications.spec.ts:166-178`).

### Fix

После `markAllAsRead()` в дропдауне перечитать свою выборку — тем же вызовом
`loadDropdownItems()`. Если БАГ-02 будет починен собственным запросом, это станет одной строкой.

### Future rule

Локальная копия, снятая из общего реактивного состояния через `slice()`, переживает замену
этого состояния и молча устаревает. Либо копия обновляется вместе с источником, либо её не
должно быть — есть `computed`.

---

## Сводка

| | Тип | Файл | Суть |
|---|---|---|---|
| | Contract | `notificationsService.ts` | БАГ-01: ни один из четырёх вызовов не шлёт заголовков авторизации |
| | Contract | `NotificationDropdown.vue` | БАГ-02: «топ-5» на деле — пять из текущей отфильтрованной страницы |
| | Runtime | `useNotifications.ts` | БАГ-03: опрос счётчика заведён на уровне модуля и не останавливается |
| | Contract | `mocks/notifications.ts` | БАГ-04: отметка несуществующего уведомления молча успешна, кода нет |
| | Reactivity | `NotificationDropdown.vue` | БАГ-05: после «прочитать всё» строки дропдауна остаются непрочитанными |
