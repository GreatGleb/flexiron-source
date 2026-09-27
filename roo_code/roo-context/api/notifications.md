# Notifications

Лента системных уведомлений: чтение с фильтрами и пагинацией, счётчик непрочитанных, отметка
одного и отметка всех. **Записей домен не создаёт** — их рождают события чужих доменов, и `POST`
здесь нет ни одного.

Общие правила — [`00-conventions.md`](00-conventions.md) в этом каталоге; ниже они не
повторяются, а называются номером раздела. Прямо относятся к домену: §1 конверт ответа,
§2 каталог кодов, §4 мультиарендность, §5 заголовки, §10 «событие — это переход», §12
`TranslatedString`, §13 пагинация, §17 производные значения, §19 форма идентификатора.

Аудит, из которого написан этот файл:
[`plans/api/audit/notifications.md`](../../plans/api/audit/notifications.md). Находки про код —
[`contract-sync-notifications-bugs.md`](../../plans/bugs/contract-sync-notifications-bugs.md)
(пять, БАГ-01…БАГ-05; код не тронут). Строки, которые контракт не назначает, —
[`00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md), раздел
`## notifications` (десять строк).

## Источник истины — мок и клиент, но схема хранения уже зафиксирована

**Модуль бэкенда есть, роутов у него ноль.** `backend/app/modules/notifications/` существует, но
`grep -rn "@router\." backend/app/modules/notifications --include=*.py` не даёт ни одного
попадания: каталог `features/` содержит только `__init__.py`, `internal_api/interface.py` и
`shared/dependencies.py` — по одной докстроке. Поэтому старшинство «бэкенд» (§ «Источник истины»
скила) **не наступило ни у одного из четырёх эндпоинтов**, и формы ниже сняты с клиента
[`services/notificationsService.ts`](../../../frontend_vue/src/services/notificationsService.ts),
мока [`services/mocks/notifications.ts`](../../../frontend_vue/src/services/mocks/notifications.ts)
и типов [`types/notifications.ts`](../../../frontend_vue/src/types/notifications.ts).

**Схема несёт форму хранения из П10, и это ограничение, а не форма ответа.**
Модели — `class Notification`, `class NotificationRead`, `class NotificationSubscription` в
`backend/app/modules/notifications/shared/models.py`; исходная миграция
`backend/alembic/versions/7bf1730620f0_phase_11_notifications.py:24-36` плюс ревизия слайса 1
`backend/alembic/versions/e7a2c5b41d09_notifications_slice1_addressing.py`.

**Строка ленты больше не адресат.** Ревизия слайса 1 сняла с `notifications` колонки `user_id` и
`is_read`: одна строка на СОБЫТИЕ арендатора, а не по копии снимка текста на каждого адресата.
Взамен заведены `event_key` (уникальный в паре с арендатором — механизм «уже уведомили», П56),
`requires_action` (П55) и `email_sent_at`, а личная половина переехала в `notification_reads`
(кто и когда прочитал, уникальность по тройке `tenant_id`/`notification_id`/`user_id`) и
`notification_subscriptions` (подписки П54).

Схема расходится с формой записи фронта по трём полям, и разрешать это расхождение по-прежнему
бэкенду:

| фронт | схема |
|---|---|
| `title` / `message` — `TranslatedString` `{ru,en,lt}` (`types/notifications.ts:21-22`) | `title_translations` / `message_translations` — `JSONB` без ключей, `server_default="{}"` |
| `entityRouteName: string`, обязателен (`types/notifications.ts:25`) | колонки **нет вовсе**: только `entity_type: String(50)` и `entity_id: String(100)` |
| `id: string` вида `notif-001` / `notif-ev-001` (`mocks/notifications.ts:21`, `:518`) | `id` — `UUID` из `UUIDMixin` |
| полей владельца нет ни в типе, ни в моке | `tenant_id` — FK на `tenants.id`, `ondelete="CASCADE"`, `nullable=False, index=True`; адресата у строки нет вовсе (П10) |

Расхождение `title`/`message` — часть общего перекоса схемы и типа (§12 «Схема расходится с типом
систематически»); `id` — часть §19. Оба здесь названы, потому что у этого домена они уже наступили,
а не потому, что домен вводит своё правило.

Потребители: страница
[`views/admin/notifications/NotificationsPage.vue`](../../../frontend_vue/src/views/admin/notifications/NotificationsPage.vue),
колокольчик в шапке
[`components/admin/NotificationDropdown.vue`](../../../frontend_vue/src/components/admin/NotificationDropdown.vue),
общее состояние — синглтон
[`composables/useNotifications.ts`](../../../frontend_vue/src/composables/useNotifications.ts).

## Каталог кодов ошибок домена — пуст, и это факт, а не пропуск

**Домен не бросает ни одного кода.** Единственное исключение в моке —
`new Error('SIMULATED_MOCK_ERROR')` под флагом `localStorage.test_mock_force_error`
(`mocks/notifications.ts:414-419`; флаг ставит и снимает e2e-тест
`frontend_vue/tests/e2e/admin/notifications/notifications.spec.ts:86,96`). Это тестовый рычаг, а не
код домена. Ни `mockGetUnreadCount` (`mocks/notifications.ts:432-434`), ни `mockMarkAsRead`
(`:436-441`), ни `mockMarkAllAsRead` (`:443-445`) не содержат ни одного `throw`.

Каталога бэкенда у домена тоже нет: своих `@router.` у модуля ноль, а общие исключения ядра
(§2 — `NOT_FOUND`, `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`,
`backend/app/core/exceptions.py:13-48`) на этих путях ещё никем не брошены. **Для сервера это
задание, а не описание:** ошибки домена обязаны приходить в общей форме §1 (`detail: { message,
code }`) с кодами ядра — 401 `UNAUTHORIZED` без токена, 404 `NOT_FOUND` на чужой или несуществующий
`id`, 403 `FORBIDDEN` на чужую ленту.

**Путь ошибки в интерфейсе есть у трёх эндпоинтов из четырёх.** Чтение ленты кладёт в
`error` **текст** исключения — `error.value = (e as Error).message`
(`composables/useNotifications.ts:37`), — и страница печатает его человеку как есть
(`NotificationsPage.vue:164`); `ApiRequestError.code` (`types/api.ts:28-31`) домен не читает нигде.
Тем же способом теперь отвечают и обе мутации: код `markAsRead` и код `markAllAsRead`
(`composables/useNotifications.ts`) кладут причину в `error` после `await`, а не глотают её.
Молчит только опрос счётчика — `catch { /* silently fail on count polling */ }`
(`useNotifications.ts:46-48`) — осознанное исключение (см. БАГ-03 про сам опрос), а не пропуск. То
есть код, который сервер пришлёт на этом одном пути, до человека не дойдёт вовсе — единственный
оставшийся случай класса §2 «Отказ несёт код, а не текст».

---

### GET /api/notifications

Страница ленты: список с серверной фильтрацией, поиском, сортировкой и пагинацией (§13).
Save-режим: **чтение**, формы нет.

Запрос — query из семи строк, и клиент шлёт **все семь всегда**, включая пустые
(`services/notificationsService.ts:9-17`):

```ts
{
  page: string        // String(page)      — `notificationsService.ts:10`
  pageSize: string    // String(pageSize)  — `:11`
  search: string      // '' = без фильтра
  type: string        // NotificationType | 'all'
  isRead: string      // '' | 'true' | 'false'  — `:14`
  sortBy: string      // 'createdAt' | 'type'
  sortDir: string     // 'asc' | 'desc'
}
```

Пустая строка доезжает до сервера буквально и означает «без фильтра» — общее правило §13.
Тройное состояние «прочитано» собирается на клиенте:
`filters.isRead === null ? '' : String(filters.isRead)` (`notificationsService.ts:14`), обратно
разбирается в моке: `params?.isRead ? params.isRead === 'true' : null` (`mocks/index.ts:368`).

Умолчания назначает **не клиент**, а состояние композабла —
`{ type: 'all', isRead: null, search: '', sortBy: 'createdAt', sortDir: 'desc' }`
(`useNotifications.ts:12-18`) плюс `usePagination(25)` (`:19`); мок держит **второй экземпляр** тех
же умолчаний на случай отсутствия ключа (`mocks/index.ts:366-370`, `:373-374`). Сервер обязан
держать те же: `search=''`, `type='all'`, `isRead` отсутствует → все, `sortBy='createdAt'`,
`sortDir='desc'`, `page=1`, `pageSize=25`.

`sortBy` принимает **два** значения — `createdAt` и `type` (`mocks/notifications.ts:387`, `:392`),
и второе из интерфейса недостижимо: единственная кнопка сортировки жёстко ставит
`sortBy = 'createdAt'` (`NotificationsPage.vue:105-112`). Значение `type` — часть контракта, а не
мёртвый код: сервер обязан его принимать.

`search` идёт по **шести** полям сразу — заголовок и текст на всех трёх языках,
регистронезависимо: регистр запроса нормализуется один раз (`mocks/notifications.ts:362`), дальше
шесть сравнений `toLowerCase().includes` (`:365-370`) внутри одного `filter` (`:363-371`); блок
целиком — `:360-372`. Для сервера это `ILIKE` по шести ключам `JSONB`, а не по одному.

Ответ: `PaginatedResponse<Notification>` (§13; подпись `notificationsService.ts:8`, сбор
`mocks/notifications.ts:423-429`). На проводе — `ApiResponse<PaginatedResponse<Notification>>`
(§1).

```ts
interface Notification {
  id: string
  type: NotificationType              // types/notifications.ts:3-11 — восемь значений
  title: TranslatedString             // §12
  message: TranslatedString
  entityType: NotificationEntityType  // :13 — 'order' | 'product' | 'batch' | 'client' | 'supplier'
  entityId: string
  entityRouteName: string             // обязателен; см. «Обязанности сервера», производные
  isRead: boolean
  createdAt: string                   // ISO 8601, §14
}
```

`NotificationType` — восемь значений: `order_status`, `stock_deficit`, `supplier_response`,
`batch_received`, `reserve_expiring`, `payment_overdue`, `payment_received`, `warehouse_ready`
(`types/notifications.ts:3-11`). Восьмой из них, `reserve_expiring`, триггера не имеет — см.
«Правила домена», пункт 2.

**Порядок при равном `createdAt` не определён ничем.** Сортировка по `createdAt` — строковое
`localeCompare` ISO-строк (`mocks/notifications.ts:389`), поэтому записи одной миллисекунды
упорядочены произвольно; сервер обязан добавить второй ключ сортировки (`id` или последовательность
события), иначе пагинация будет терять и дублировать строки на границе страниц. По той же причине
`unshift` новой записи в начало массива (`:516`) совпадает с сортировкой только пока время
монотонно.

Ответ отдаётся **копией**: `structuredClone(items)` (`mocks/notifications.ts:424`), то есть мутация
полученного объекта стор не трогает (§18).

Ошибки: **ни одной своей** (см. каталог выше). Единственный эндпоинт домена, у которого путь ошибки
в интерфейсе есть: текст исключения печатается человеку (`useNotifications.ts:37`,
`NotificationsPage.vue:164`).

Триггеры запроса — четыре: `onMounted(() => load())` страницы (`NotificationsPage.vue:114-116`);
`watch(filters, …, { deep: true })` со сбросом на первую страницу (`useNotifications.ts:83-91`);
`watch([page, pageSize])` (`:87-93`), причём флаг `skipNextPageWatch` (`:75`, `:80`, `:88-91`)
гасит второй запрос, когда смена фильтра одновременно сбрасывает страницу; и колокольчик —
`loadDropdownItems()` зовёт `notificationsService.getNotifications` напрямую, своим отдельным
запросом первой страницы из пяти без фильтров (`NotificationDropdown.vue`, функция
`loadDropdownItems`), независимо от `filters` и `page` синглтона, которыми живёт страница списка.
БАГ-02 («пять свежих» на деле были «пять из текущей отфильтрованной страницы») закрыт этим
отдельным запросом. Поиск дебаунсится 300 мс в компоненте, а не в композабле
(`NotificationsPage.vue:59-67`).

Бэкенд: `backend/app/modules/notifications/features/feed/action.py:24` (`list_notifications`) — постраничный список, сужен арендатором; личное в нём только прочитанность, и она считается по таблице отметок для того, кто спросил (П10)
(`grep -rn "@router\." backend/app/modules/notifications --include=*.py` пуст); таблица есть,
`backend/app/modules/notifications/shared/models.py:11-42`.
Реализация: `services/notificationsService.ts:5-18` (`getNotifications`) · потребитель
`composables/useNotifications.ts:29-32` · мок `mocks/index.ts:364` →
`mocks/notifications.ts:404-430` (`mockGetNotifications`). Второй вызывающий — дропдаун, функция
`loadDropdownItems` в `components/admin/NotificationDropdown.vue`, своим отдельным запросом.

---

### GET /api/notifications/unread-count

Счётчик непрочитанных для бейджа колокольчика. Save-режим: **чтение, опрос по таймеру**.

Запрос: пусто — ни query, ни тела, ни заголовков.
`apiGet<number>('/api/notifications/unread-count')` вызывается одним аргументом
(`services/notificationsService.ts:21`); мок разбирает ветку без параметров (`mocks/index.ts:378`).

Ответ: **голое число, не объект** — `Promise<number>` в подписи
(`services/notificationsService.ts:20`), `mockGetUnreadCount(): number`
(`mocks/notifications.ts:432`). С общим конвертом §1 на проводе это `ApiResponse<number>`, то есть
`{ "success": true, "data": 5 }`: `unwrap()` возвращает `json.data` для любого тела с ключом
`success`, особого случая для этого пути нет. Прежний контракт здесь сомневался
(«без `ApiResponse`-обёртки? Формат уточнить») — код отвечает однозначно.

Значение — число записей с `isRead === false` во **всём** сторе, без учёта фильтров списка
(`mocks/notifications.ts:433`). Это правило, а не дефект: бейдж обязан быть глобальным, а таблица
рядом фильтруется, поэтому счётчик и список показывают разные множества (см. «Правила домена»,
пункт 8).

**Между опросами клиент показывает своё число, а не серверное.** После отметки одного —
`unreadCount.value = Math.max(0, unreadCount.value - 1)` (`useNotifications.ts:58`), после «прочитать
всё» — `= 0` (`:68`). Расхождение с сервером живёт до следующего опроса. Отсюда требование к
серверу: счётчик обязан быть дешёвым — `COUNT` по индексу `ix_notifications_tenant_created_at_id`
с `LEFT JOIN notification_reads … WHERE read_at IS NULL` (форма из `NotificationRead`, слайс 1;
сам запрос — слайс 4), потому что его дёргают раз в 30 с у каждого открытого клиента.

Опрос: первый вызов на загрузке модуля (`useNotifications.ts:117`), дальше
`setInterval(loadUnreadCount, 30_000)` там же (`:112`). Второй раз тот же счётчик читается при
монтировании колокольчика (`NotificationDropdown.vue:96`). Экспортированные `startPolling` /
`stopPolling` (`useNotifications.ts:101-112`, экспорт `:129-130`) не вызываются ниоткуда — БАГ-03:
опрос стартует на уровне модуля и не останавливается никогда.

Ошибки: ни одной своей; клиент глотает любую молча
(`useNotifications.ts:46-48`), то есть сорванный опрос внешне неотличим от «новых уведомлений нет».

Бэкенд: `backend/app/modules/notifications/features/feed/action.py:51` (`unread_count`) — счётчик производный, отдельной колонки под него по-прежнему нет
(`backend/app/modules/notifications/shared/models.py:33-36` — только `is_read`).
Реализация: `services/notificationsService.ts:20-22` (`getUnreadCount`) · потребители
`composables/useNotifications.ts:42-49`, `components/admin/NotificationDropdown.vue:96` · мок
`mocks/index.ts:378` → `mocks/notifications.ts:432-434` (`mockGetUnreadCount`)

---

### PATCH /api/notifications/:id/read

Отметить одно уведомление прочитанным. Save-режим: **quick-action**, уходит сразу по клику, Save
bar не участвует.

Запрос: путь плюс **пустой объект телом** — ``apiPatch<void>(`/api/notifications/${id}/read`, {})``
(`services/notificationsService.ts:25`). Тело сериализуется всегда (`services/api.ts:206`), то есть
на провод уходит `{}` с `Content-Type: application/json` (`:205`). Мок ловит путь регуляркой
`/^\/api\/notifications\/([^/]+)\/read$/` (`mocks/index.ts:1394`) и тело не читает
вовсе (`:1394`).

`Idempotency-Key` не шлётся (§11: ключ шлют пять вызовов из 175, и это не они) —
`grep -rn "Idempotency" frontend_vue/src/services/notificationsService.ts frontend_vue/src/composables/useNotifications.ts`
пусто, при том что генератор в проекте есть (`services/api.ts:258-264`). Ключ здесь и не нужен:
операция идемпотентна **по построению**, `isRead = true` ставится без разбора прежнего значения
(`mocks/notifications.ts:436-441`).

Ответ: `Promise<void>` (`services/notificationsService.ts:24`); мок — `delay(undefined as T)`
(`mocks/index.ts:1397`). На проводе `ApiResponse<null>` (§1). Обновлённую запись сервер не отдаёт,
и клиент её не ждёт — он правит свою копию сам (`useNotifications.ts:54-58`).

**Ответа никто не дожидается.** Оба вызывающих сначала смотрят на локальный флаг и сразу уходят на
карточку сущности: строка таблицы — `if (!notification.isRead) markAsRead(notification.id)` и
следом `router.push` (`NotificationsPage.vue:89-94`); строка дропдауна — то же
(`NotificationDropdown.vue:56-66`). `markAsRead` не `await`-ится ни там, ни там.

Ошибки: **ни одной, и это расхождение с обещанным.** `mockMarkAsRead` для неизвестного `id`
не делает ничего и не бросает: `const notification = notifications.find(…); if (notification) { … }`
(`mocks/notifications.ts:436-441`) — ветки `else` нет. Кода `NOTIFICATION_NOT_FOUND`, который
объявлял прежний контракт, в репозитории нет нигде
(`grep -rn "NOTIFICATION_NOT_FOUND" frontend_vue/src backend` — пусто; см. «Чего в домене нет»).
Клиент любую ошибку глотает молча (`useNotifications.ts:59-61`) и **всё равно** уменьшает счётчик
(`:58`) — то есть отметка чужого или несуществующего уведомления выглядит успешной, а расхождение
чинится только следующим опросом через 30 с. Это БАГ-04.

**Для сервера это задание:** неизвестный или чужой `id` — отказ (404 `NOT_FOUND` / 403
`FORBIDDEN`), а не тихий no-op. Молчание неотличимо от успеха — тот же класс, что §9
«Неизвестный `entryId` — отказ, а не тихий no-op».

Бэкенд: `backend/app/modules/notifications/features/feed/action.py:71` (`mark_read`) — отметка вставляет строку в `notification_reads`, а не пишет флаг: флага на разделяемой строке не существует (П10). Повторная отметка не ошибка — `ON CONFLICT DO NOTHING` по тройке уникальности
(`backend/app/modules/notifications/shared/models.py:33-36`) и **нет** `read_at`, то есть «когда
прочитано» не хранится нигде.
Реализация: `services/notificationsService.ts:24-26` (`markAsRead`) · потребитель
`composables/useNotifications.ts:53-62` · мок `mocks/index.ts:1394-1398` →
`mocks/notifications.ts:436-441` (`mockMarkAsRead`)

---

### PATCH /api/notifications/read-all

Отметить прочитанными все уведомления. Save-режим: **quick-action**.

Запрос: путь плюс пустой объект телом — `apiPatch<void>('/api/notifications/read-all', {})`
(`services/notificationsService.ts:29`). **Ни фильтров, ни списка `id`:** операция всегда «все», и
это часть контракта — «прочитать всё» на отфильтрованной странице отметит и то, чего пользователь
не видел. Мок сравнивает путь строкой и ставит эту ветку до регулярки одиночной отметки
(`mocks/index.ts:1390` против `:1392`); порядок безопасен и без того — `read-all` под
`([^/]+)/read` не подходит, — но правило §18 «вложенный путь раньше голого `:id`» соблюдено.
Тело мок не читает (`:1389`).

`Idempotency-Key` не шлётся; операция идемпотентна по построению — `mockMarkAllAsRead` переписывает
весь массив одним выражением (`mocks/notifications.ts:443-445`).

Ответ: `Promise<void>` (`services/notificationsService.ts:28`), мок — `delay(undefined as T)`
(`mocks/index.ts:1392`). На проводе `ApiResponse<null>`. **Ни числа затронутых записей, ни нового
счётчика сервер не возвращает** — поэтому клиент обнуляет счётчик у себя
(`useNotifications.ts:68`). Если сервер начнёт отдавать `{ affected, unreadCount }`, клиенту
не придётся угадывать; сегодня контракт этого не требует, потому что код не читает.

Ошибки: ни одной своей. Отказ кладёт причину в `error` тем же способом, что и одиночная отметка —
`error.value = (e as Error).message` после `await` (`composables/useNotifications.ts`, функция
`markAllAsRead`); счётчик и записи правятся только **после** успешного ответа, а не до него.

Оба вызывающих ведут себя одинаково: ждут `markAllAsRead()`, затем перечитывают свою выборку.
Страница: `handleMarkAllRead` → `await markAllAsRead()` и затем `load()`
(`NotificationsPage.vue:96-99`), кнопка `:134-137`. Дропдаун: `onMarkAllRead` → `await
markAllAsRead()` и затем `await loadDropdownItems()` (`NotificationDropdown.vue`, функция
`onMarkAllRead`) — своим отдельным запросом, а не через общие `items`. БАГ-05 опирался на то, что
мок `mockMarkAllAsRead` заменяет весь массив целиком новыми объектами (раздел эндпоинта выше), а
`dropdownItems` дропдауна держал прежние ссылки, снятые раньше срезом общих `items`, и не
перекрашивался. Закрыт этим перечитыванием: дропдаун больше не хранит срез чужого состояния,
который мог устареть у него на руках.

Бэкенд: `backend/app/modules/notifications/features/feed/action.py:61` (`mark_all_read`) — один `INSERT ... SELECT`: по строке в `notification_reads` на каждое ещё не прочитанное уведомление арендатора. Отметка личная, соседа она не трогает
`is_read` (`backend/app/modules/notifications/shared/models.py:33-36`), следа массовой операции нет.
Реализация: `services/notificationsService.ts:28-30` (`markAllAsRead`) · потребители
`composables/useNotifications.ts:65-72`, `views/admin/notifications/NotificationsPage.vue:96-99`,
`components/admin/NotificationDropdown.vue:52-54` · мок `mocks/index.ts:1390-1393` →
`mocks/notifications.ts:443-445` (`mockMarkAllAsRead`)

---

## Правила домена

Только то, что живёт в одном домене. Правило «событие — это переход», список семи эмиттеров и их
вызывающих, «тексты — снимок», «сумма не конвертируется», «сборка сида событий не рождает» и
адресность записи — общие, они в §10 `00-conventions.md`; здесь не дублируются.

1. **Записи рождаются событиями чужих доменов, а не эндпоинтом уведомлений.** `POST` в домене нет —
   инвентарь даёт четыре пути, все читающие или отмечающие. Следствие для сервера записано прямо в
   коде: правило «что уведомление говорит» обязано жить в одном месте
   (`mocks/notifications.ts:465-468`), а `id`, `isRead: false` и `createdAt` присваивает один
   `emit` (`:514-522`).
2. **Восьмой тип, `reserve_expiring`, триггера не имеет — и это осознанный отказ, а не пропуск.**
   Причина и условие появления записаны в коде: у `StockReservation` нет ни срока, ни даты
   окончания, а `Batch.expiresAt` — годность металла, а не граница брони
   (`mocks/notifications.ts:739-748`). При этом две сид-записи такого типа в ленте лежат (`:226`,
   `:241`), тип виден пользователю и стоит в фильтре страницы (`NotificationsPage.vue:37`). Нужен
   ли броне срок — **решено 2026-09-09 (П52): нужен, три рабочих дня по умолчанию, значение в
   настройках.** Восьмой тип оживает, и тип перестаёт притворяться работающим. «Рабочий день» в
   проекте не определён нигде: умолчание контракта — суббота и воскресенье в срок не входят
   ([§10.3](00-conventions.md)).
3. **`id` события продолжает нумерацию сидов и сбрасывается вместе с ними.**
   `notif-ev-${eventSeq++}` (`mocks/notifications.ts:518`), сброс счётчика в `mockResetNotifications`
   (`:453-456`) с объяснением: счётчик, который продолжал бы расти, оставил бы дыры, читающиеся как
   потерянные события (`:449-451`). Для сервера это не форма `id` (§19 — `id` непрозрачен), а
   требование к демо-сбросу.
4. **Фильтр «прочитано» трёхзначен, и `null` — это «все».** `isRead === true` → только
   прочитанные, `false` → только непрочитанные, `null` → без фильтра
   (`mocks/notifications.ts:380-384`); на проводе `null` превращается в пустую строку
   (`services/notificationsService.ts:14`), обратно — в моке (`mocks/index.ts:368`).
5. **Срок в тексте называется датой, а не числом дней.** `payment.dueDate.slice(0, 10)`
   (`mocks/notifications.ts:696`); причина в коде: текст хранится таким, каким записан, и
   «просрочена на 1 день» через месяц станет неправдой (`:680-682`).
6. **Счёт поставщика без заказа ведёт к контрагенту, а не в пустую карточку заказа.** Развилка
   `entityType`/`entityRouteName` по наличию `orderId` и направлению платежа
   (`mocks/notifications.ts:699-726`), закреплено спекой
   (`mocks/notification-triggers.spec.ts:360-372`).
7. **`entityId` — идентификатор, а не номер документа, хотя у заказа они похожи** (§19). Эмиттер
   кладёт `order.id` (`mocks/notifications.ts:560`), а в текст пишет `order.orderNumber`
   (`:555-557`); сиды используют именно `id` (`:34` — `ORD-001`), поэтому переход по ним работает.
8. **Счётчик колокольчика и список на странице показывают разные множества — это правило, а не
   дефект.** Счётчик считается по всему стору (`mocks/notifications.ts:433`), список — по фильтрам
   (`:420`). Бейдж обязан быть глобальным.
9. **Путь ошибки есть у трёх эндпоинтов из четырёх — молчит только опрос счётчика.** Функции
   `load`, `markAsRead` и `markAllAsRead` печатают текст исключения человеку одним и тем же
   способом — лента показывает его на странице
   (`NotificationsPage.vue:164`). Опрос счётчика молчит по конструкции
   (`useNotifications.ts:46-48`). Сервер обязан отдавать
   коды по §1–§2, но сегодня один путь из четырёх их не покажет.

## Обязанности сервера

Девять граф аудита. Наблюдения, а не решения: строка с ответом «нигде» вынесена в
[`00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md).

**1. Значения по умолчанию и их владелец.** Ни одно значение домена не принадлежит настройкам
арендатора — все стоят константами во фронте, причём умолчания фильтров существуют **двумя
экземплярами**: `useNotifications.ts:12-18` и мок `mocks/index.ts:366-370`. Размер страницы `25` —
`usePagination(25)` (`useNotifications.ts:19`) и дефолт мока (`mocks/index.ts:374`); перечень
размеров `10/25/50/100` — константа `PAGE_SIZE_OPTIONS` в компоненте
(`NotificationsPage.vue:70-75`), справочника под неё нет ни в настройках, ни на схеме (§13).
Интервал опроса `30_000` записан дважды в одном файле (`useNotifications.ts:101` дефолтом параметра
`startPolling`, `:112` литералом модульного `setInterval`), дебаунс поиска `300` мс — в странице (`NotificationsPage.vue:66`), глубина
выдачи колокольчика `5` — константа `DROPDOWN_PAGE_SIZE` рядом с `loadDropdownItems`
(`NotificationDropdown.vue`). Иконка типа —
константа в типах `NOTIFICATION_TYPE_ICONS` (`types/notifications.ts:38-47`), а не поле записи:
сервер её не отдаёт и отдавать не должен. Новая запись рождается с `isRead: false` и
`createdAt: new Date().toISOString()` (`mocks/notifications.ts:519-520`) — на схеме те же умолчания
уже серверные: `is_read` — `server_default="false"` (`models.py:50-53`), `created_at` —
`server_default=func.now()` (`:37-42`), `title_translations`/`message_translations` —
`server_default="{}"` (`:29-30`). Кому принадлежат интервал опроса и глубина ленты — **решено 2026-09-07 (П20)**: коду. Сервер не
решает, сколько строк показывает интерфейс и как часто он спрашивает; ни интервал `30_000`
(`composables/useNotifications.ts:101`, `:112`), ни глубина `5` (`NotificationDropdown.vue`,
константа `DROPDOWN_PAGE_SIZE`), ни
дебаунс `300` мс (`NotificationsPage.vue:66`) настройкой арендатора не становятся. Приведение
дублей к одному источнику в коде — работа ([§13](00-conventions.md)).

**2. События и уведомления.** Это и есть предмет домена, и правило целиком живёт в моке: семь
эмиттеров, один `emit`, вызовы из `orders`, `warehouse`, `bcc`, `finance`, каждый под условием
перехода — §10. Доказано спекой
[`mocks/notification-triggers.spec.ts`](../../../frontend_vue/src/services/mocks/notification-triggers.spec.ts):
отдельные проверки «повтор не пишет ничего» у статуса (`:111-119`), дефицита (`:181-200`),
готовности склада (`:232-234`) и просрочки (`:257-266`). Домену принадлежат две вещи, которых в
§10 нет: восьмой тип без триггера (правило 2 выше) и тишина при сборке сида — `seedQuietly`
(`mocks/notifications.ts:504-512`) с флагом `seeding`, который `emit` проверяет первой строкой
(`:515`), причина записана рядом (`:478-492`), проверено
(`mocks/notification-triggers.spec.ts:71-88`). **Чем сервер отличит новое событие от повтора после
перезапуска** — сегодня в моке ничем, память просрочки живёт в процессе (`mocks/finance.ts:63`);
**решено 2026-09-09 (П56) и заведено на схеме 2026-09-24 (слайс 1):** колонка `event_key` плюс
уникальность `(tenant_id, event_key)` (`backend/app/modules/notifications/shared/models.py:35`,
`:47-48`) — вторая вставка того же события падает на ограничении, а не требует отдельной проверки.
Эмиттер и сам перенос правила из мока в код — по-прежнему работа слайса 2, роутов ещё нет.

**3. Запись в аудит-лог — нигде.** `grep -n "auditLog" frontend_vue/src/services/mocks/notifications.ts`
пусто: ни рождение уведомления, ни отметка о прочтении, ни «прочитать всё» следа не оставляют.
В домене `audit-feed` уведомлений тоже нет — девять логов лежат на сущностях (§9,
`mocks/index.ts:7`), и `notifications` среди них не значится. «Кто и когда прочитал» с 2026-09-24
(слайс 1) хранится — `read_at` на `NotificationRead`
(`backend/app/modules/notifications/shared/models.py:56-94`), это не аудит-лог, а состояние
читателя (§9 сводки: отметка о прочтении — не действие, которое логируется). Открытым остаётся
другое: у самого `notifications` по-прежнему нет ни `updated_at`, ни автора записи — уведомление
рождается системой, у события нет автора-человека. Становится ли `notification` одиннадцатым видом
`entity_type` в общем аудит-логе — строка владельцу.

**4. Кастомные поля — домен их не имеет ни в каком виде**, ни определений, ни значений:
`grep -rn "fieldValues\|FieldDefinition\|fieldId" frontend_vue/src/types/notifications.ts frontend_vue/src/services/mocks/notifications.ts frontend_vue/src/services/notificationsService.ts`
пусто; в схеме одиннадцать колонок на `notifications` и ни одной ссылки на определения полей
(`models.py:11-53`).
Ближайшее к «произвольным данным» — `title_translations`/`message_translations` типа `JSONB`
(`models.py:31-32`), но это переводы фиксированных текстов, а не пользовательские поля. Библиотека
`/api/config/fields` (§8) к уведомлениям не привязана ничем
(`grep -rn -i "notif" frontend_vue/src/services/mocks/config.ts frontend_vue/src/types/config.ts` —
пусто). **Графа закрыта отрицательно, и это ответ, а не пробел.**

**5. Настройки, которых мок не отслеживает — четыре.**
(1) **Локали.** `TranslatedString` жёстко трёхъязычна (§12, `types/i18n.ts:6-10`), тексты
собираются на всех трёх языках сразу в момент события (`mocks/notifications.ts:549-558`), список
языков арендатора на это не влияет; подпись статуса заказа берётся из **фронтового** словаря
`adminOrders` (`:532-538`), то есть у сервера обязан появиться свой экземпляр тех же переводов.
(2) **Почта.** Настройки SMTP есть (`/api/settings/mail`, признак готовности `isMailConfigured` —
`types/settings.ts:167-171`), но с уведомлениями во фронте по-прежнему не связаны ничем
(`grep -rn -i "notif" frontend_vue/src/types/settings.ts frontend_vue/src/services/mocks/settings.ts` —
пусто); канал доставки в интерфейсе один — лента. На схеме с 2026-09-24 (слайс 1) уже заведены обе
половины П54: поле «отправлено письмом» — `email_sent_at`
(`backend/app/modules/notifications/shared/models.py:42`) — и таблица подписок
`NotificationSubscription` (`:97-125`, «пользователь × тип × канал»). Второй канал остаётся
неподключённым до слайсов 0.1 и 9: хранилище есть, отправки и вкладки настроек — нет.
(3) **Срок жизни записи.** Ни удаления, ни архивации в домене нет: `DELETE` среди четырёх
эндпоинтов отсутствует, удаляющей функции в моке нет ни одной
(`mocks/notifications.ts:404-456` — чтение, две отметки и сброс демо); лента растёт неограниченно.
(4) **Срок резерва**, из-за отсутствия которого `reserve_expiring` остался без триггера
(`mocks/notifications.ts:739-748`).
Все четыре — строки владельцу.

**6. Мультиарендность — общее правило §4, и домен его сегодня нарушает.** Во фронте не выражена
никак: ни `tenantId`, ни `userId`, ни заголовка — `services/notificationsService.ts` это тридцать
строк с четырьмя вызовами без единого `options` (`:9`, `:21`, `:25`, `:29`); в моке понятия
пользователя нет вовсе
(`grep -n -i "tenant\|userId\|user_id" frontend_vue/src/services/mocks/notifications.ts` — пусто),
лента у него один общий массив на всех (`mocks/notifications.ts:353`). На схеме с 2026-09-24
(слайс 1) `notifications` больше не адресная строка — П10 снял с неё `user_id`: остался только
`tenant_id` (FK на `tenants.id`, `ondelete="CASCADE"`, `nullable=False, index=True`,
`backend/app/modules/notifications/shared/models.py:24-29`). Адресность выражена теперь **правами
на роли и пользователей**, а не колонкой на самой ленте (§10 плана домена): владелец и админ видят
всё, у кого нет права — тот не адресат такого типа; технически «кто получает и кто прочитал»
опирается на `NotificationRead.user_id` (`models.py:77-81`, FK на `users.id`, `ondelete="CASCADE"`)
и на `NotificationSubscription.user_id` (`:108-112`), а не на адресность самой строки события. Как
сервер узнаёт пользователя и арендатора — из токена и только из него (§4, §5), и сервер это уже
умеет: тенант достаётся по пользователю
(`backend/app/modules/settings/features/crud/action.py:97-128`, `:131-139`). Заголовки при этом шлёт
не всякий домен: канонический `useAuth.authHeaders()` отдаёт `Authorization: Bearer` и
`X-CSRF-Token` (`composables/useAuth.ts:101-108`), а копии в настройках и ленте аудита читают только
`localStorage` и шлют один `Authorization` (`services/settingsService.ts:17-22`, потребитель `:27`;
`services/auditFeedService.ts:20-24`, потребитель `:41`) — §5.
`notificationsService.ts` не шлёт **никаких** заголовков ни в одном из четырёх вызовов — **БАГ-01**.
Чем именно ограничивается выборка — строка владельцу.

**7. Права — ни одной функции, которая их проверяет.** Доступ гейтится только фича-флагом (§7):
роут `/admin/notifications` несёт `meta.featureFlag: 'notificationsPage'` (`router/index.ts:309-312`),
флаг объявлен `true` (`config/featureFlags.ts:75`) и типизирован (`types/features.ts:64`); на
бэкенде это запись каталога фич уровня `page`, а не право
(`backend/alembic/versions/8cf3bfa380dd_phase_12_plans_multi_role.py:160-162`). В матрице прав (§6)
уведомлений нет
(`grep -rn -i "notif" frontend_vue/src/services/mocks/config.ts frontend_vue/src/types/config.ts` —
пусто). Колокольчик не закрыт даже флагом — рисуется без проверки
(`NotificationDropdown.vue:104-109`). Функции, проверяющей право на чтение чужой ленты или на отметку
чужой записи, нет ни одной; мок ищет запись по `id` во всём сторе (`mocks/notifications.ts:437`).
Правило §6 «право проверяет та же функция, что пишет» здесь не выполнено ни в одном месте. Строка
владельцу.

**8. Транзакционность и идемпотентность.** `Idempotency-Key` в домене не используется (§11) —
`grep -rn "Idempotency" frontend_vue/src/services/notificationsService.ts frontend_vue/src/composables/useNotifications.ts`
пусто. Обе мутации идемпотентны **по построению, а не по проверке**: `mockMarkAsRead` ставит
`isRead = true` без разбора прежнего значения и молча уходит, если записи нет
(`mocks/notifications.ts:436-441`); `mockMarkAllAsRead` переписывает весь массив (`:443-445`).
Внутри мока обе операции синхронны и однооперационны, то есть атомарны. **Атомарность между
доменами не выражена нигде, и это главное наблюдение графы:** уведомление пишется в том же вызове,
что и породившее его изменение (`mocks/orders.ts:1840`, `services/mocks/warehouse.ts:789`,
`mocks/finance.ts:486`), но без транзакции — `emit` уже добавил запись в ленту
(`mocks/notifications.ts:516`) к моменту, когда вызывающий может ещё упасть. Дедупликация повторного
события держится на памяти процесса (`mocks/finance.ts:63`) и на сравнении «до/после» у
вызывающего; ни колонки, ни ключа под это на схеме нет (`models.py:11-42`). Строка владельцу.

**9. Производные значения (§17) — пять.**
(1) `unreadCount` — счёт по ленте (`mocks/notifications.ts:433`), не колонка; на схеме его нет
(`models.py:11-42`), но клиент между опросами правит его у себя (`useNotifications.ts:58`, `:68`).
(2) `totalPages` — `Math.ceil(total / pageSize)` при чтении (`mocks/notifications.ts:428`).
(3) `total` — длина **отфильтрованного**, а не всего (`:425`).
(4) `entityRouteName` — **производное, которое сервер сейчас обязан хранить**: поле обязательно в
типе (`types/notifications.ts:25`), клиент подставляет его в `router.push` без всякого маппинга
(`NotificationsPage.vue:93`, `NotificationDropdown.vue:65`), а колонки под него на схеме нет
(`models.py:31-32`). Значение выводимо из `entityType` однозначно — пять типов, пять имён роутов:
`admin-order-card` (`router/index.ts:160`), `admin-client-card` (`:180`), `admin-supplier-card`
(`:212`), `admin-product-card` (`:224`), `admin-warehouse-batch` (`:262`); мок именно так их и
расставляет. Хранит сервер или выводит при чтении — строка владельцу.
(5) Относительное время («2 часа назад») считается на клиенте из `createdAt`
(`NotificationDropdown.vue:76-88`) и сервером не отдаётся.

## Пробелы аудита — где закрыты

Каждый пробел из [аудита](../../plans/api/audit/notifications.md) — либо закрыт текстом выше, либо
помечен «осталось» с адресом решения. «Осталось» означает: ответа нет ни в коде фронта, ни на
сервере, и контракт его не назначает.

| пробел аудита | где |
|---|---|
| `GET /api/notifications` (а) чем ограничена выборка ленты | **снято 2026-09-10 (§4)** — арендатором из токена, как во всех доменах; адресность строки при этом задают П10 и подписки П54, а не выборка |
| (б) `sortBy` имеет два значения, `type` из UI недостижим | закрыт — раздел `GET /api/notifications`, абзац про `sortBy` |
| (в) `entityRouteName` приходит с сервера, старый текст себе противоречил | закрыт по факту (поле обязательно, сервер обязан присылать) — «Обязанности сервера», графа 9, пункт 4; **осталось** — хранит или выводит при чтении, решение владельца, строка «Производные значения» |
| (г) сортировка `createdAt` — строковое `localeCompare`, порядок одной миллисекунды не определён | закрыт — раздел `GET /api/notifications`, абзац «Порядок при равном `createdAt`»; сервер обязан добавить второй ключ |
| (д) пример прежнего контракта обещает `total: 18`, сидов двадцать | закрыт — «Чего в домене нет», строка про пример ответа |
| `GET /api/notifications/unread-count` (а) клиент правит счётчик локально | закрыт — раздел эндпоинта, абзац «Между опросами клиент показывает своё число» |
| (б) интервал 30 с записан дважды и настройкой не управляется | закрыт как наблюдение — «Обязанности сервера», графа 1; **осталось** — кому принадлежит интервал, решение владельца |
| (в) счётчик по всему стору против отфильтрованного списка | закрыт — «Правила домена», пункт 8; раздел эндпоинта |
| `PATCH /api/notifications/:id/read` (а) обещанный `NOTIFICATION_NOT_FOUND` не поддержан ничем | закрыт — «Каталог кодов», раздел эндпоинта, «Чего в домене нет»; БАГ-04 |
| (б) право отметить чужое уведомление нигде не проверяется | **решено 2026-09-07 (П10)** — вопрос снят формой хранения: прочитанность принадлежит человеку, а не уведомлению (одна строка на событие плюс `notification_reads`), общего флага не существует и отмечать чужое нечего. Кто какие уведомления получает — права на роли и пользователей; владелец и админ по умолчанию получают всё. См. [§10](00-conventions.md) |
| (в) декремент счётчика безусловен | закрыт — раздел эндпоинта; БАГ-04 |
| (г) отметка о прочтении не имеет времени: `read_at` на схеме нет | **закрыто 2026-09-24 (слайс 1, П10)** — `read_at` заведён на `NotificationRead`
(`backend/app/modules/notifications/shared/models.py:56-94`); маршрута, который бы им пользовался, всё ещё нет |
| `PATCH /api/notifications/read-all` (а) «все уведомления текущего пользователя» кодом не подтверждено | **решено (П10)**, схема заведена слайсом 1 — «Обязанности сервера», графа 6; кодом (маршрутом) по-прежнему не подтверждено, роутов у домена ноль |
| (б) операция не ограничена текущим фильтром | закрыт — раздел эндпоинта, первый абзац запроса |
| (в) ответ не несёт ни числа затронутых записей, ни нового счётчика | закрыт — раздел эндпоинта, абзац ответа |
| (г) мок заменяет массив целиком новыми объектами | закрыт — раздел эндпоинта, последний абзац; БАГ-05 |

Ещё три строки владельца из [файла решений](../../plans/api/audit/00-решения-владельца.md) аудит
поднял не как пробел раздела, а как графу «Обязанности сервера». Три из пяти закрыты 2026-09-09:
**чем сервер отличит событие от повтора после перезапуска** — отметкой «уже уведомили» в базе, а не
памятью процесса (П56); **нужен ли броне срок** — нужен, три рабочих дня в настройках (П52);
**доставляется ли уведомление вторым каналом и подписывается ли пользователь на типы** — да,
каналов два, и подписки живут таблицей «пользователь × тип × канал» на новой вкладке
`Настройки → Уведомления` (П54, [§10.2](00-conventions.md)). **Решено 2026-09-10 (П61):** срока жизни у записи **нет** — уведомления не удаляются, а хранение
позже станет предметом тарифа ([§25](00-conventions.md)). **Осталось** две: чем лента ограничена
сверху (графа 5) и кто владеет переводами текстов (графа 5, пункт 1). Итого десять строк — ровно те, что стоят в разделе `## notifications` файла
решений.

## Клиент написан, UI нет — реестр пуст

У всех четырёх эндпоинтов есть экран-потребитель: страница ленты
(`views/admin/notifications/NotificationsPage.vue:114-116`, `:93-98`, `:100-103`) и колокольчик
(`components/admin/NotificationDropdown.vue`, функции `loadDropdownItems`, `onNotificationClick`,
`onMarkAllRead`, `onMounted`). Ни одной функции `notificationsService.ts` без вызывающего нет: файл
экспортирует четыре функции (`:5`, `:20`, `:24`, `:28`); `getUnreadCount`, `markAsRead` и
`markAllAsRead` зовутся только из `composables/useNotifications.ts` (`:42-49`, `:53-62`,
`:65-72`), а у `getNotifications` (`:5`) два вызывающих — тот же композабл (`:29-32`) и
`NotificationDropdown.vue` напрямую, функция `loadDropdownItems`.

Обратной стороны — ветки мока без вызывающего — у домена тоже нет: четыре ветки
(`mocks/index.ts:364`, `:378`, `:1388`, `:1392`) против четырёх вызовов. Домен не участвует ни в
одной из пяти сирот и одной дыры, замеренных линзой К2 по проекту.

## Чего в домене нет

Ничего не вычеркнуто молча: каждое утверждение прежнего
[`03-api-contract.md`](../03-api-contract.md) — раздел `# Admin — Notifications`, от своего
заголовка до следующего `# ` (`# Клиент написан, UI нет`) — названо вместе с тем, чем оно
опровергнуто.

**Адрес утверждения прежнего текста — сама цитата, а не номер строки.** Монолит будет удалён,
как только сведение закончится, и любой номер в него протухнет вместе с ним; цитату же
проверяет `grep -F` по файлу и после любых правок. Каждая цитата ниже этим грепом найдена.

| было в прежнем тексте | чем опровергнуто |
|---|---|
| код `NOTIFICATION_NOT_FOUND` — «404, уведомление не найдено», и «404 если `id` не существует» у одиночной отметки | в репозитории такого кода нет нигде: `grep -rn "NOTIFICATION_NOT_FOUND" frontend_vue/src backend` — пусто. Мок для неизвестного `id` не бросает и не делает ничего (`mocks/notifications.ts:436-441`), клиент любую ошибку глотает (`useNotifications.ts:59-61`). Требование к серверу сохранено в разделе эндпоинта и в каталоге кодов, но **как задание с кодами ядра** (§2), а не как этот код: своего каталога у домена нет. БАГ-04 |
| «`entityRouteName` … генерируется фронтом» и «сервер его не хранит (или хранит как опциональное поле)» | прежний текст противоречит сам себе, и оба варианта неверны: поле **обязательно** в типе (`types/notifications.ts:25`), лежит в каждой сид-записи и проставляется каждым эмиттером (`mocks/notifications.ts:561`, `:581`, `:611`, `:632`, `:652`, `:669`, `:715`, `:720`, `:725`), а клиент подставляет его в `router.push` без маппинга (`NotificationsPage.vue:93`). Никакого «маппинга на клиенте» в коде нет. Хранить или выводить — решение владельца |
| «`NotificationDropdown.vue` — дропдаун в хедере — топ-5 уведомлений» | было опровергнуто на момент сведения: пять брались не из свежих, а из текущей отфильтрованной страницы синглтона — БАГ-02. **Закрыто:** `loadDropdownItems` запрашивает свою первую страницу из пяти без фильтров напрямую через `notificationsService.getNotifications`, независимо от `filters`/`page` страницы (`NotificationDropdown.vue`, функция `loadDropdownItems`) — прежний текст снова описывает код верно |
| пример ответа с `"total": 18` | сидов в моке двадцать: `grep -c "    id: 'notif-" frontend_vue/src/services/mocks/notifications.ts` → 20. Пример убран целиком: форма задаётся типом `PaginatedResponse<Notification>` (§13), а число сидов — свойство демо-данных, которому в контракте места нет |
| «Response 200: `number` (без `ApiResponse`-обёртки? Формат уточнить)» | вопрос снят кодом: `unwrap()` снимает конверт для любого тела с ключом `success`, особого случая для этого пути нет (§1, `services/api.ts:128-137`). На проводе `ApiResponse<number>` |
| «Возвращает количество непрочитанных уведомлений **для текущего пользователя**» и «Отмечает все уведомления **текущего пользователя**» | понятия пользователя в реализации мока нет: он считает по всему стору (`mocks/notifications.ts:433`) и переписывает весь массив (`:444`), клиент не шлёт ни идентификатора, ни заголовка (`services/notificationsService.ts:21`, `:29`) — БАГ-01. Требование остаётся верным, но по-другому, чем раньше: с 2026-09-24 (слайс 1) `notifications` вообще не несёт `user_id` (П10), «для текущего пользователя» выражается через `NotificationRead.user_id`/`NotificationSubscription.user_id` (`backend/app/modules/notifications/shared/models.py:77-81`, `:108-112`) и права, а не адресностью самой строки |
| «Клиент после успеха декрементирует локальный `unreadCount`» | делает это **безусловно**, а не после успеха: `Math.max(0, unreadCount.value - 1)` (`useNotifications.ts:58`) выполняется и когда сервер ничего не изменил, потому что ошибка проглочена (`:59-61`) |
| «Polling: `unreadCount` опрашивается каждые 30 секунд (module-level interval в `useNotifications`)» | верно и подтверждено (`useNotifications.ts:118`), но прежний текст умалчивал, что остановки нет: `startPolling`/`stopPolling` (`:95-106`) не вызываются ниоткуда — БАГ-03 |
| «Уведомления генерируются сервером при событиях (… истечение резерва …)» | семь событий из восьми верны и описаны в §10; **истечения резерва среди них нет** — у типа `reserve_expiring` триггера не существует, и причина записана в коде (`mocks/notifications.ts:739-748`). Тип сохранён, потому что он есть в фильтре и в сидах, — но как «Правила домена», пункт 2, а не как реализованное событие |
| «Никаких форм редактирования, clean-slate не применим» (раздел Save UX) | остаётся в силе и подтверждено: у всех четырёх эндпоинтов save-режим — чтение или quick-action (§15), Save bar в домене не участвует ни в одном месте |


---

## Согласованные правила после опросника 2026-09-17

**Статус:** спроектировано — перенос подтверждённых требований владельца, не отчёт о реализации.
Для будущей реализации правила ниже имеют приоритет над прежними вариантами «осталось» и
противоречащим демонстрационным поведением этого файла. Описания существующих запросов выше
остаются снимком реализации; изменение форм, миграций и клиентских действий выполняется отдельной
задачей по этим решениям. Новые маршруты в этом дополнении не выдумываются.

Источник: [заполненный опросник](../../plans/general/вопросы-владельцу-после-сверки-2026-09-17.md) и
[решения П76–П129](../../plans/api/audit/00-решения-владельца.md#p-76).

| Решение | Обязанность домена и зависимых операций |
|---|---|
| [П80](../../plans/api/audit/00-решения-владельца.md#p-80) | При единственном часовом поясе страны компании он выбирается автоматически; при нескольких пользователь уточняет пояс. Выбранный пояс всегда можно изменить в настройках компании. Интерфейс обязан объяснять его влияние на границы суток и месяцев, фильтры по датам, отчётные периоды и зависимые сроки. Пояс компании не следует за поездками сотрудника; сезонные переходы обрабатываются правилами выбранного пояса, а не фиксированным смещением. |
| [П107](../../plans/api/audit/00-решения-владельца.md#p-107) | Счёт можно сохранить без срока. Он заметно помечается «Срок не задан», такие счета можно найти отдельно. До назначения срока он не считается просроченным и не получает календарное напоминание, основанное на дате. |
| [П114](../../plans/api/audit/00-решения-владельца.md#p-114) | Когда снижение минимального запаса устраняет нехватку, автоматически закрывается только созданная порогом запись, ещё не взятая в закупку. Уже начатая закупочная работа и нехватка конкретного заказа автоматически этим действием не закрываются. Это подтверждённая граница обратного пересчёта П57. |
| [П115](../../plans/api/audit/00-решения-владельца.md#p-115) | После окончания срока бронь автоматически снимается, металл возвращается в доступный остаток. Факт освобождения отражается в истории, состояние обеспечения заказа пересчитывается. Сохранение просроченной блокирующей брони до ручного действия не выбрано. |
| [П116](../../plans/api/audit/00-решения-владельца.md#p-116) | По умолчанию предупреждать за один рабочий день до окончания брони; интервал предупреждения настраивается. При окончании в понедельник предупреждение приходится на пятницу. Длительность самой брони по П52 остаётся отдельной настройкой. |
| [П117](../../plans/api/audit/00-решения-владельца.md#p-117) | «Партии на исходе» в П55 означает, что заканчивается количество: условие определяется нехваткой относительно минимального запаса. Это не приближение срока годности и не истечение брони. Используется смысл уже существующего события нехватки; новый тип уведомления только ради этой формулировки не нужен. |
| [П118](../../plans/api/audit/00-решения-владельца.md#p-118) | Событие изменения цены услуги для незакрытых заказов возникает только при изменении цены продажи. Смена одной себестоимости это уведомление не порождает, но по П36 остаётся в истории с нужными ограничениями видимости. Исторические цены заказа автоматически не заменяются ценами каталога. |
| [П119](../../plans/api/audit/00-решения-владельца.md#p-119) | Уведомление о новой цене услуги направляется только по заказам до доставки. Доставленный, но финансово не закрытый заказ в этот отбор не входит. Финансовый статус и задолженность заказа этим правилом не меняются. |
| [П126](../../plans/api/audit/00-решения-владельца.md#p-126) | Тревога остаётся на главной, пока сохраняется её причина, независимо от даты появления. Полночь и начало нового месяца её не скрывают. Устранённая проблема исчезает из активных тревог, но история уведомлений сохраняется по П61. |
