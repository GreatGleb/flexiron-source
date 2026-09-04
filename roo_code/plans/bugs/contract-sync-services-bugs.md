# Bugs — contract-sync / домен services

Источник: сверка контракта с кодом по плану
[`roo_code/plans/api/contract-sync-plan.md`](../api/contract-sync-plan.md), фаза аудита,
линзы К2–К5. Аудит: [`roo_code/plans/api/audit/services.md`](../api/audit/services.md).
Область: `backend/app/modules/services/**`, `backend/alembic/versions/d730d0aa32ef_phase_4_services.py`,
`frontend_vue/src/services/servicesService.ts`, `frontend_vue/src/services/mocks/services.ts`,
ветки services в `frontend_vue/src/services/mocks/index.ts`,
`frontend_vue/src/composables/useServices.ts`, `frontend_vue/src/composables/useServiceCard.ts`,
`frontend_vue/src/views/admin/products/ServicesPage.vue`,
`frontend_vue/src/views/admin/products/ServiceCardPage.vue`,
`frontend_vue/src/views/admin/orders/AddOrderServicesModal.vue`.
Начато: 2026-09-04.

План сверки код не правит: расхождение решается в пользу кода, а место, где неверным выглядит
сам код, уходит сюда. Восемь находок; порядок — по убыванию тяжести последствий, а не по
порядку чтения файлов.

---

## БАГ-01 — модель услуг на бэкенде осталась в мире сваренной строки `EUR/vnt`

**File:** `backend/app/modules/services/shared/models.py:28-30`
**Severity:** Critical — первый же слайс бэкенда для услуг либо не сможет отдать то, что просит фронт, либо отдаст сваренную строку и вернёт домен на год назад.
**Источник:** К4 (формы), К5 (источник истины)

### Problem

Фронт снял союз `'EUR/vnt' | 'EUR/kg' | 'EUR/m' | 'EUR/h'` и заменил его тремя полями —
`costPrice`/`sellingPrice`, `currencyId` из справочника валют, `uomId` из справочника единиц
(`frontend_vue/src/types/service.ts:19-31`, причина записана в самом типе, `:3-18`). Модель
бэкенда этого не знает:

```python
price_unit: Mapped[str] = mapped_column(
    String(20), nullable=False, default="EUR/vnt", server_default="EUR/vnt"
)
```

Колонок `currency_id`/`uom_id` в модели нет вовсе:
`grep -c "currency_id\|uom_id" backend/app/modules/services/shared/models.py` → 0.

Это не «бэкенд просто отстал» — соседний домен ту же миграцию уже прошёл, причём дважды:
`backend/alembic/versions/bbd27a3881a5_phase_14_add_currency_uom_fk_to_products.py:4` добавила
товарам FK на валюту и единицу, а
`backend/alembic/versions/a1b2c3d4e5f6_phase_15_product_uom_restructure.py:98-99` удалила у них
`price_unit` явной строкой `op.drop_column("products", "price_unit")`. Услуги остались в том
виде, в каком их создали:
`backend/alembic/versions/d730d0aa32ef_phase_4_services.py:26-36` — единственная миграция домена,
и `price_unit` там в строке `:32`.

Следствие не только в форме ответа. Мок сегодня **строже** будущего сервера: он отвергает
неизвестные `currencyId`/`uomId` по справочнику настроек
(`frontend_vue/src/services/mocks/services.ts:86-93`), а в схеме бэкенда внешнего ключа,
который держал бы то же правило, попросту нет.

### Fix

Миграция по образцу `bbd27a3881a5` + `a1b2c3d4e5f6`: добавить `currency_id` и `uom_id` c FK на
`currencies`/`uoms`, перенести значения из `price_unit` (разбором `"<код валюты>/<код единицы>"`
по справочникам арендатора), удалить `price_unit`. До миграции слайсов по услугам не писать —
иначе они закрепят старую форму в API.

### Future rule

Расхождение «поле снято во фронте, но живо в модели бэкенда» машина видеть умеет: у домена без
роутов сравнивать нечего по вызовам, но имена колонок модели и имена полей типа фронта
сопоставимы. Проверка «в модели нет колонки, которой нет в типе домена, и наоборот» поймала бы
это в день, когда `price_unit` исчез из `types/service.ts`.

---

## БАГ-02 — мок выдаёт id по длине списка, поэтому после удаления рождаются дубли

**File:** `frontend_vue/src/services/mocks/services.ts:118`
**Severity:** High — две записи с одним id: правка и удаление попадают не в ту услугу, и заказ ссылается на неоднозначный id.
**Источник:** К2 (мок ↔ код)

### Problem

```ts
id: `svc-${String(STORE.length + 1).padStart(3, '0')}`,
```

`STORE` сеется пятью услугами — `svc-001`…`svc-005`
(`frontend_vue/src/mocks/services.ts:5,20,35,50,65`, загрузка `mocks/services.ts:8`).
Воспроизведение в три шага:

1. удалить `svc-002` — `STORE.splice` (`mocks/services.ts:169`), длина 4;
2. создать любую услугу — id считается как `4 + 1` → `svc-005`;
3. в сторе теперь **две** записи `svc-005`.

Дальше всё адресование домена ломается тихо: `mockGetService` берёт `STORE.find`
(`mocks/services.ts:133`) и всегда возвращает первую, `mockPatchService` — `findIndex`
(`:150`) и правит первую, `mockDeleteService` — тоже первую (`:167`). Заказ, добавивший вторую,
читает через `serviceById` (`:19`) чужую цену и чужое имя.

Рядом, в моке заказов, та же задача решена правильно — монотонным счётчиком, который не
уменьшается при удалении: `frontend_vue/src/services/mocks/orders.ts:1353-1357`
(`let nextSeq = TOTAL_ORDERS + 1` и `nextId()`).

### Fix

Завести в `mocks/services.ts` такой же счётчик: `let nextSeq = STORE.length + 1` на уровне
модуля и `svc-${String(nextSeq++)...}` в `mockCreateService`. Длина массива источником id быть
не может в принципе.

### Future rule

Проверка на моке: создать → удалить → создать → убедиться, что `new Set(STORE.map(s => s.id)).size
=== STORE.length`. Инвариант «id уникальны» проверяется одной строкой и ловит весь класс
«счётчик выведен из длины».

---

## БАГ-03 — список услуг печатает `€` при любой валюте услуги

**File:** `frontend_vue/src/views/admin/products/ServicesPage.vue:274-275`
**Severity:** High — цена в долларах показана как евро; это ровно та невыразимость, ради снятия которой домен переводили на `currencyId`.
**Источник:** К4 (формы), графа «Значения по умолчанию»

### Problem

```html
<td>{{ item.costPrice != null ? `${item.costPrice.toFixed(2)} €` : '—' }}</td>
<td>{{ item.sellingPrice != null ? `${item.sellingPrice.toFixed(2)} €` : '—' }}</td>
```

`item.currencyId` в этих двух ячейках не участвует, хотя он есть у каждой услуги
(`frontend_vue/src/types/service.ts:25`) и хотя услуга в другой валюте создаётся штатно —
это подтверждено спекой (`frontend_vue/src/domain/servicePricing.spec.ts:110-122`, «услугу
можно создать в валюте, отличной от евро»).

Отдельная неприятность в том, что правильный ответ уже стоит в соседней ячейке той же строки:
`<td>{{ unitLabel(item) }}</td>` (`ServicesPage.vue:276`) собирает подпись через
`serviceUnitLabel` (`:72-80`) и берёт код валюты из справочника
(`frontend_vue/src/domain/servicePricing.ts:23,26`). Услуга в долларах покажет в одной строке
`12.00 €` и `USD/h` одновременно.

### Fix

Собирать код валюты из справочника — `settings.currencies.find(c => c.id === item.currencyId)?.code` —
и подставлять его вместо литерала. Отдельной новой функции не нужно: правило «код валюты из
справочника» уже живёт в `serviceUnitLabel`.

### Future rule

Литерал валюты в шаблоне — то же, что литерал единицы: `grep -rn "€\|'EUR'" frontend_vue/src/views`
по страницам сущностей с `currencyId` обязан давать пусто. Один символ в шаблоне отменяет
целую миграцию типа.

---

## БАГ-04 — модалка добавления услуг в заказ подписывает цену валютой по умолчанию

**File:** `frontend_vue/src/views/admin/orders/AddOrderServicesModal.vue:322`
**Severity:** High — тот же дефект, что БАГ-03, но на пути в документ: пользователь выбирает услугу, глядя на неверную валюту.
**Источник:** К4 (формы)

### Problem

```html
? s.sellingPrice.toFixed(2) + ' ' + settings.constants.defaultCurrency
```

`s` — это `ServiceListItem`, у которого `currencyId` есть (`frontend_vue/src/types/service.ts:25`),
а подписывается цена валютой арендатора по умолчанию
(`frontend_vue/src/composables/useSettings.ts:27`). Для услуги в долларах подпись врёт.

Соседняя ячейка той же таблицы при этом сделана правильно: единица берётся из справочника —
`unitLabel(s.uomId)` (`AddOrderServicesModal.vue:318`), и в файле прямо записано, что двух
систем подписи больше нет (`:28-30`). Валюта из этого правила выпала.

### Fix

Подписывать код валюты услуги, а не арендатора — из того же справочника, что и единицу.

### Future rule

См. БАГ-03: у величины с `currencyId` подпись обязана строиться из её собственной валюты.
Проверять надо не только страницу сущности, но и все места выбора этой сущности — модалки
добавления в документ читают тот же тип и ошибаются тем же способом.

---

## БАГ-05 — ни один из пяти вызовов домена не шлёт `Authorization`

**File:** `frontend_vue/src/services/servicesService.ts:23,27,40,72,76`
**Severity:** High — как только у услуг появится роут с проверкой токена, весь домен ответит 401; сегодня же прайс-лист читается и правится без предъявления кто.
**Источник:** К5 (источник истины), расхождение с аудитом соседа

### Problem

Все пять вызовов уходят без третьего (для GET) и без второго (для остальных) аргумента:

```ts
return apiGet<PaginatedResponse<Service>>('/api/services', params)      // :23
return apiGet<Service>(`/api/services/${id}`)                            // :27
return apiPost<Service>('/api/services', payload)                        // :40
return apiPatch<Service>(`/api/services/${id}`, payload)                 // :72
return apiDelete(`/api/services/${id}`)                                  // :76
```

`grep -c "Idempotency\|Authorization\|authHeaders" frontend_vue/src/services/servicesService.ts` → 0.

Хелперы заголовков не добавляют от себя: `apiGet` кладёт в `fetch` ровно `options?.headers`
(`frontend_vue/src/services/api.ts:157-159`), `apiDelete` — `options?.headers ?? {}` (`:216-219`).
Под моками это не проявляется никак — `USE_MOCKS` уводит вызов в `getMock`/`postMock` до
`fetch` (`api.ts:149-151`).

Расхождение с соседним доменом прямое: у `settings` `authHeaders()` стоит у всех 31 вызова
(см. аудит settings, врезка «Заголовки», `roo_code/plans/api/audit/settings.md:17-23`, реализация
`frontend_vue/src/services/settingsService.ts:18-22`).

### Fix

Не копировать `authHeaders()` в шестой файл: он уже продублирован по сервисам, и это отдельная
проблема. Токен обязан подставляться в одном месте — в `api.ts`, для всех вызовов сразу; тогда
и `services`, и все прочие домены получают его без правки каждого файла.

### Future rule

Машинная проверка на инвентаре: у каждого домена, чьи эндпоинты требуют аутентификации, доля
вызовов с заголовком должна быть 100 %, а не «у settings есть, у services нет». Инвентарь
`contractInventory.ts` уже знает файл и строку каждого вызова — этого достаточно, чтобы
сравнить наличие заголовка.

---

## БАГ-06 — имя и описание услуги нельзя стереть, а тост при этом говорит «сохранено»

**File:** `frontend_vue/src/services/servicesService.ts:47`
**Severity:** Medium — пользователь удаляет описание, видит «сохранено», перезагружает карточку и находит старый текст.
**Источник:** К4 (формы), К2 (мок ↔ код)

### Problem

Карточка умеет обнулять оба поля: пустой ввод кладёт в форму `null`
(`frontend_vue/src/views/admin/products/ServiceCardPage.vue:30`, `:37`). `useDirtyCheck.diff()`
честно отдаёт `{ description: null }`, и `save()` за пустую дельту не прячется — там проверка
`Object.keys(delta).length === 0` (`frontend_vue/src/composables/useServiceCard.ts:69`), а ключ
есть. А дальше `null` теряется:

```ts
function toPayloadValue(value, locale) {
  if (value === null || value === undefined) return undefined   // :47
  ...
}
...
if (desc !== undefined) payload.description = desc              // :71
```

То есть на провод уходит `PATCH /api/services/:id` с телом `{}`. Мок ничего не меняет
(`frontend_vue/src/services/mocks/services.ts:153-161` — все присваивания под
`!== undefined`), возвращает запись как была, а карточка на успешный ответ показывает
`services.toast_saved` (`useServiceCard.ts:85`). То же самое с именем.

Старый контракт при этом обещает `description?: TranslatedString | null`
(`roo_code/roo-context/03-api-contract.md:1239`) — то есть обнуление задумано и не работает.

### Fix

Развести «не менять» и «стереть»: `undefined` не отправлять, `null` отправлять. В
`toPayloadValue` возвращать `null` как `null`, а условия `if (… !== undefined)` оставить как
есть — они уже пропускают `null`. Мок обязан на `null` очистить поле, а не проигнорировать.

### Future rule

Всякий раз, когда клиент нормализует значение перед отправкой, проверять три случая, а не два:
поле не трогали, поле изменили, поле стёрли. Третий случай в merge-patch выражается `null` и
теряется первым.

---

## БАГ-07 — удаление услуги не смотрит, стоит ли она в заказах

**File:** `frontend_vue/src/services/mocks/services.ts:166-171`
**Severity:** Medium — каталог и документы расходятся молча; старый контракт обещает 409, которого нет.
**Источник:** К3 (коды ошибок), графа «Транзакционность»

### Problem

```ts
export async function mockDeleteService(id: string): Promise<boolean> {
  const idx = STORE.findIndex((s) => s.id === id)
  if (idx === -1) return false
  STORE.splice(idx, 1)
  return true
}
```

Проверки использования нет. Заказы читают каталог живым — `serviceById`
(`frontend_vue/src/services/mocks/orders.ts:372`), — и после удаления добавить эту услугу в
заказ уже нельзя: `serviceEntry` бросает `CATALOG_SERVICE_NOT_FOUND`
(`mocks/orders.ts:373-376`). Уже проданное не рушится, потому что строка заказа держит снимок
имени и себестоимости (`mocks/orders.ts:2415-2422`), — но `serviceId` в ней остаётся ссылкой в
никуда.

Старый контракт обещает обратное: «сервер отклоняет удаление если услуга используется в
активных заказах (409 `SERVICE_IN_USE`)» (`roo_code/roo-context/03-api-contract.md:1199`).
Кода `SERVICE_IN_USE` нет нигде: `grep -rn "SERVICE_IN_USE" backend/app frontend_vue/src` →
пусто.

### Fix

Решение о поведении принимает владелец — строка вынесена в
`roo_code/plans/api/audit/00-решения-владельца.md`. Что бы ни выбрали (409 при использовании,
мягкое скрытие из каталога или разрешённое удаление со снимком в заказе), сегодняшнее
состояние — «контракт обещает одно, код делает другое» — неверно в любом варианте.

### Future rule

Обещанный контрактом код ошибки, которого нет ни в одном `throw`, — машинно ловимый класс: К3
сверяет каталог кодов раздела с кодами, которые домен действительно бросает. Спека К3 ещё не
написана, и `SERVICE_IN_USE` — второй по счёту пример того, что она нужна.

---

## БАГ-08 — мок отдаёт наружу ссылки в собственный стор

**File:** `frontend_vue/src/services/mocks/services.ts:26-38`
**Severity:** Low — сегодня никто не мутирует полученное, но правка любого потребителя на месте молча изменит «серверные» данные.
**Источник:** К2 (мок ↔ код)

### Problem

`toListItem` копирует девять полей поверхностно (`:27-37`), поэтому `name` и `description`
уходят наружу тем же объектом, что лежит в `STORE`. То же у `mockGetService` — `{ ...svc }`
(`:135`) — и у `mockPatchService` — `{ ...svc }` (`:163`).

Настоящий сервер отдаёт копию всегда: между ним и клиентом стоит сериализация. Мок, отдающий
ссылку, разрешает то, чего сервер разрешить не может. Соседний мок это уже учитывает — в
`frontend_vue/src/services/mocks/orders.ts:1359-1361` заведён `clone()` через
`JSON.parse(JSON.stringify(...))`, и наружу уходит он.

### Fix

Отдавать копию: тот же `clone()` (или `structuredClone`) на выходе `mockGetServices`,
`mockGetService`, `mockPatchService`, `mockCreateService`.

### Future rule

Мок обязан быть не слабее сериализации: всё, что уходит наружу, проходит через копирование.
Проверяется одной спекой — получить объект, изменить у него вложенное поле, перечитать через
мок и убедиться, что изменения нет.
