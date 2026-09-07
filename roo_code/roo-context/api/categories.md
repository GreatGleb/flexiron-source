# Categories

Дерево категорий номенклатуры и набор кастомных полей, которые категория задаёт своим товарам.
Шесть эндпоинтов, два экрана-потребителя — список
[`views/admin/products/CategoriesPage.vue`](../../../frontend_vue/src/views/admin/products/CategoriesPage.vue)
через [`composables/useCategories.ts`](../../../frontend_vue/src/composables/useCategories.ts) и
карточка
[`views/admin/products/CategoryCardPage.vue`](../../../frontend_vue/src/views/admin/products/CategoryCardPage.vue)
через [`composables/useCategoryCard.ts`](../../../frontend_vue/src/composables/useCategoryCard.ts);
клиентский слой целиком —
[`services/categoriesService.ts`](../../../frontend_vue/src/services/categoriesService.ts) (72
строки). Список категорий читает ещё и карточка товара
(`composables/useProductCard.ts:132`) — своего эндпоинта у справочника нет.

**Общие правила здесь не повторяются, а берутся из [`00-conventions.md`](00-conventions.md):**
конверт ответа и форма ошибки (§1), коды ядра и два правила доменных кодов (§2), `PATCH` против
`PUT` (§3), мультиарендность (§4), заголовки и токен (§5), кастомные поля поперёк доменов (§8),
`TranslatedString` и три помощника слияния (§12), пагинация и списки (§13), Save UX (§15),
производные значения (§17), чем мок отличается от сервера (§18), форма `id` (§19).

Аудит по коду, из которого собран этот файл:
[`plans/api/audit/categories.md`](../../plans/api/audit/categories.md). Места, где код выглядит
неверным, — девять находок в
[`contract-sync-categories-bugs.md`](../../plans/bugs/contract-sync-categories-bugs.md) (БАГ-01 …
БАГ-09); код по ним не тронут. Вопросы, которых контракт не решает, — в
[`audit/00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md), раздел
`## categories` и доборка того же дня.

## Источник истины — мок и клиент, но схема уже зафиксирована

Реализованных эндпоинтов у домена **ноль**, поэтому формы ниже сняты с клиента и мока
(`mocks/categories.ts`, 1514 строк). Модуля `categories` в `backend/app/modules/` нет вовсе —
модулей там десять (`auth`, `bcc`, `billing`, `finance`, `notifications`, `products`, `services`,
`settings`, `suppliers`, `warehouse`), и у `products` роутов два, оба про товар
(`backend/app/modules/products/features/get_product_detail/action.py:28`,
`backend/app/modules/products/features/create_product/action.py:23`). А модели категории живут
как раз в модуле `products`:

| таблица | модель | миграция |
|---|---|---|
| `categories` | `Category` — `backend/app/modules/products/shared/models.py:14-17` | `backend/alembic/versions/25245d4bf874_phase_3_categories_products.py:27-41` |
| `category_fields` | `CategoryField` — `models.py:59-62` | миграция `:42-56` |

Отсюда два следствия для каждого раздела ниже. Первое: строка `Бэкенд:` у всех шести —
«не реализован», и метка `Статус: спроектировано` здесь была бы **неверна** (она про отсутствие
кода вообще, а эндпоинты клиент уже зовёт). Второе: схема хранения расходится с формами фронта, и
расхождения перечислены в «Правилах домена» — их разрешает бэкенд, а не фронт.

## Каталог кодов ошибок домена

Три кода, все из мока удаления (`mocks/categories.ts:1477-1485`), ни один не является подстрокой
другого (правило §2 соглашений):

| код | когда | доходит до человека |
|---|---|---|
| `CATEGORY_NOT_FOUND` | категории с таким `id` нет (`mocks/categories.ts:1479`) | нет — общий тост `categories.toast_error` (`useCategories.ts:49`) |
| `CATEGORY_HAS_PRODUCTS` | `productCount > 0` (`:1480`) | `categories.toast_error_delete_has_products` (`i18n/admin/categories.ts:61`, en `:125`, lt `:189`) |
| `CATEGORY_HAS_CHILDREN` | у категории есть потомки (`:1481`) | `categories.toast_error_delete_has_children` (`i18n/admin/categories.ts:62`, en `:126`, lt `:190`) |

**Код обязан приходить в `code`, а не в тексте.** Мок бросает `throw new Error(result.code)`
(`mocks/index.ts:1491`), то есть кладёт код в `message`, и клиент сравнивает именно `e.message`
(`useCategories.ts:43-47`) — против настоящего API, где код лежит в `ApiRequestError.code`
(`types/api.ts:29`), обе ветки не сработают (БАГ-01, класс описан в §2 соглашений). Форма ошибки
на проводе — `detail: { message, code }` (§1 соглашений).

**HTTP-статусы этих кодов кодом не подтверждены ничем** — мок бросает голый `Error` без статуса,
а `ApiRequestError.status` заполняется только из настоящего ответа (`services/api.ts:117-124`).
Единственный экземпляр статусов — прежний контракт (`03-api-contract.md:834-838`): 409 у
`CATEGORY_HAS_PRODUCTS` и `CATEGORY_HAS_CHILDREN`, 404 у `CATEGORY_NOT_FOUND`. Мапирование
совпадает с классами ядра (`ConflictError` → 409, `NotFoundError` → 404, §2 соглашений), поэтому
оно сохранено как унаследованный замысел, а не как наблюдение по коду.

Ещё два кода прежний контракт обещал, и это два разных случая, а не один:

- **`DUPLICATE_FIELD_NAME`** (`03-api-contract.md:837`) — в репозитории отсутствует: единственное
  вхождение во всём дереве — сама эта строка прежнего контракта. Кода нет, и обещание снято —
  см. «Чего в домене нет»;
- **`VALIDATION_ERROR`** (`03-api-contract.md:838`) — код **существует** и не является кодом
  домена: это код ядра со статусом 422 (`backend/app/core/exceptions.py:23-27`, перечень — §2
  соглашений). Нет не кода, а серверной проверки, которая его бросила бы: пустое `name` отсекает
  только форма. Это записано отдельной строкой в разделе «Унаследовано из прежнего контракта»,
  а не здесь.

---

### GET /api/categories

Плоский срез дерева со страницей: строка несёт не только саму категорию, но и её место в дереве
(`parentName`, `level`). Save-режим: чтение.

Запрос — query из трёх строк, все три уходят всегда (`services/categoriesService.ts:12-16`):

```ts
{ search: string; page: string; pageSize: string }   // дефолты подписи: page = 1, pageSize = 25
```

Пустой `search` — это «без фильтра», а не отсутствие параметра (`mocks/categories.ts:1394`;
общее правило — §13 соглашений). Поиск идёт по имени и **по всем трём языкам сразу**
(`mocks/categories.ts:1396-1400`), описание в поиск не входит.

Ответ: `PaginatedResponse<CategoryListItem>` (`types/api.ts:8-19`), сбор —
`mocks/categories.ts:1408-1414`.

```ts
interface CategoryListItem {
  id: string
  name: TranslatedString
  parentId: string | null
  parentName: TranslatedString | null   // производное, на схеме такой колонки нет
  fieldCount: number                    // только собственные поля
  productCount: number
  level: number                         // 0 = корень
}
```

**Порядок выдачи зависит от `search`, и это часть контракта.** Пустой `search` — depth-first:
корни по `name.en`, каждый потомок сразу за своим родителем (`mocks/categories.ts:1359-1372`).
Непустой `search` — плоская сортировка по `name.en` (`:1402-1404`), и в такой выдаче `parentName`
и `level` ссылаются на предков, которых в результате может не быть. Пагинация режет **уже
отсортированное** дерево (`:1407`), то есть вторая страница начинается с середины ветки.

Ошибки: доменных нет — `mockGetCategories` не бросает ни одного `throw`
(`mocks/categories.ts:1388-1415`); клиент показывает `e.message` (`useCategories.ts:31`).

Триггеры: `onMounted → load()` (`CategoriesPage.vue:57`), `watch(filters, …, { deep: true })` со
сбросом на первую страницу (`useCategories.ts:57-65`) и `watch([page, pageSize])`
(`useCategories.ts:67-73`).

**Этот же эндпоинт работает справочником, и трое зовут его по-разному:** список — со страницей 25
(`useCategories.ts:18`), карточка категории — `getCategories({ search: '' })` без пагинации, то
есть первые 25 (`CategoryCardPage.vue:63`, БАГ-03), карточка товара — с явным `1, 999`
(`useProductCard.ts:132`). Чем сервер обязан отдавать полный справочник — не решено (осталось,
см. «Оставлено владельцу», строка 8).

Бэкенд: **не реализован** — роутов у домена ноль. Схема при этом хранит колонками ровно то, что
мок считает при чтении: `field_count`, `product_count`, `level`
(`backend/app/modules/products/shared/models.py:33-41`; миграция
`25245d4bf874_phase_3_categories_products.py:34-36`), а `parent_name` не имеет вовсе.
Реализация: `services/categoriesService.ts:getCategories` · мок `mocks/index.ts:415` →
`mocks/categories.ts:mockGetCategories`

---

### GET /api/categories/:id

Категория целиком для карточки: свои поля, унаследованные поля и привязанные поставщики.
`:id` — непрозрачная строка (§19 соглашений), в моке `cat-<n>` (`mocks/categories.ts:11`), на
схеме UUID. Save-режим: чтение.

Запрос: только путь, ни query, ни тела (`services/categoriesService.ts:20`).

Ответ — `Category` целиком (`types/category.ts:15-25`); мок отдаёт глубокую копию записи
(`mocks/categories.ts:1417-1421`):

```ts
interface Category {
  id: string
  name: TranslatedString
  parentId: string | null
  description: TranslatedString | null
  fieldCount: number
  productCount: number
  inheritedFields: CategoryField[]   // read-only для клиента
  fields: CategoryField[]
  linkedSuppliers: LinkedSupplier[]
}

interface CategoryField {
  id: string
  name: TranslatedString
  type: 'text' | 'number' | 'boolean' | 'enum' | 'email' | 'date' | 'file'
  required: boolean
  order: number
  options: TranslatedString[]
}

// types/product.ts:18-35 — общий тип с товаром
interface LinkedSupplier {
  id: string
  name: TranslatedString
  price: number | null        // на уровне категории всегда null
  priceUomId: string | null   // на уровне категории всегда null
  leadDays: number | null
  currency: string | null     // снимок валюты поставщика на момент привязки
}
```

`inheritedFields` — **плоское объединение всей цепочки предков**, а не поля прямого родителя:
`[...parent.inheritedFields, ...parent.fields]` (`mocks/categories.ts:1432-1434`), порядок от
дальнего предка к ближнему. **Дубликаты по имени между предком и потомком не схлопываются** — ни
мок, ни клиент не проверяют пересечения; сервер обязан вести себя так же, иначе набор полей
товара изменится молча.

Ошибки: доменного кода на этом пути нет ни одного. Мок бросает текст
`` `Category ${id} not found` `` (`mocks/categories.ts:1419`), и этот текст показывается человеку
как есть (`useCategoryCard.ts:92`) — БАГ-04. Сервер обязан отвечать `CATEGORY_NOT_FOUND` из
каталога выше; прежний контракт обещал именно его (`03-api-contract.md:926`), но в коде такого
кода на этом пути нет, поэтому здесь это унаследованный замысел, а не наблюдение.

Триггеры: `onMounted → load()` (`CategoryCardPage.vue:237-240`, реализация
`useCategoryCard.ts:76-96`); тот же `load()` — это кнопка Discard (`useCategoryCard.ts:122-124`) и
перезагрузка после успешного Save (`:113`).

Бэкенд: **не реализован**. Ни `inheritedFields`, ни `linkedSuppliers` на схеме хранить негде:
первое сервер обязан собирать по цепочке `parent_id` при чтении, а таблицы связи «категория ↔
поставщик» в модуле `products` нет ни одной (`grep -rln "category_suppliers\|supplier_categories\|linked_supplier" backend/`
— пусто; осталось, строка 9).
Реализация: `services/categoriesService.ts:getCategory` · мок `mocks/index.ts:421` →
`mocks/categories.ts:mockGetCategory`

---

### POST /api/categories

Создание категории. Save-режим: quick-action — уходит по submit модала списка, затем `load()`
(`CategoriesPage.vue:71-90`).

Запрос (`services/categoriesService.ts:23-35`):

```ts
{ name: TranslatedString; parentId?: string | null; description?: TranslatedString | null }
```

Клиент принимает от UI строки и заворачивает их в `TranslatedString` **текущей локали**
(`toTranslatedString`, §12 соглашений), пустое описание превращает в `null`
(`services/categoriesService.ts:34`). Следствие, которое сервер обязан пережить: категория,
созданная в локали `ru`, имеет `name.en === ''` (`types/i18n.ts:19-25`), а список сортируется по
`name.en` (`mocks/categories.ts:1364`) — такие записи всплывают в начало.

Ответ — `Category` целиком. Новая запись рождается с `fieldCount: 0`, `productCount: 0`,
`fields: []`, `linkedSuppliers: []` и `inheritedFields`, взятыми у родителя
(`mocks/categories.ts:1436-1448`); на схеме те же нули стоят `server_default`
(`backend/app/modules/products/shared/models.py:33-41`).

Ошибки: ни одной — `mockCreateCategory` не бросает (`mocks/categories.ts:1423-1449`). Пустое имя
отсекает клиент (`CategoriesPage.vue:72`), и это поведение закреплено e2e
(`tests/e2e/admin/products/categories.spec.ts:183-186`). **Существование `parentId` не проверяет
никто:** при неизвестном родителе мок молча оставляет `inheritedFields` пустыми и сохраняет
несуществующий `parentId` (`mocks/categories.ts:1431`) — на схеме то же тело упрётся в FK
`categories.parent_id` (миграция `25245d4bf874_phase_3_categories_products.py:32`), и код отказа
для этого случая в домене отсутствует.

**Уникальности имени не требует ни мок, ни схема** — в `models.py` единственный
`UniqueConstraint` относится к значению поля товара
(`backend/app/modules/products/shared/models.py:210-214`). Повторный POST с тем же телом создаёт
вторую категорию: `Idempotency-Key` домен не шлёт (§11 соглашений), `id` выдаётся счётчиком
(`mocks/categories.ts:1437`).

Бэкенд: **не реализован**. Писать пришлось бы в `categories`
(`backend/app/modules/products/shared/models.py:14-17`), где `name` — `String(255)`
(`models.py:25`), то есть трёхъязычное имя хранить нечем (§12 соглашений).
Реализация: `services/categoriesService.ts:createCategory` · мок `mocks/index.ts:949` →
`mocks/categories.ts:mockCreateCategory`

---

### PATCH /api/categories/:id

Правка шапки категории и списка привязанных поставщиков. Тело — дельта, ответ — категория
целиком (§3 соглашений). Save-режим: clean-slate — половина одной кнопки Save карточки, уходит
только при `isAnythingDirty` (`useCategoryCard.ts:99`).

Запрос (`services/categoriesService.ts:38-54`):

```ts
Partial<{ name: TranslatedString; parentId: string | null; description: TranslatedString | null }>
  & { linkedSuppliers?: LinkedSupplier[] }
```

Дельта собирается `useDirtyCheck.diff()` — только изменённые ключи верхнего уровня
(`composables/useDirtyCheck.ts:62-77`); `linkedSuppliers` уходит **целым массивом**
(replace-семантика, `useCategoryCard.ts:105-108`), удаление привязки выражается её отсутствием в
массиве (§15 соглашений). `name` и `description` из карточки приходят уже собранными
`TranslatedString`, и сервер обязан слить их по правилу `mergeTranslatedString` — перезаписать
только присланные ключи (§12 соглашений; мок так и делает —
`mocks/categories.ts:1459-1465`).

Ответ: `Category` целиком, с **пересчитанными** `inheritedFields`, если сменился `parentId`
(`mocks/categories.ts:1468-1473`). Мок при этом возвращает `undefined` вместо ошибки для
несуществующей категории (`:1458`), и клиент видит успешный ответ без данных — БАГ-05; сервер
обязан отвечать `CATEGORY_NOT_FOUND`.

Смена `parentId` — не правка одного поля, а **перестройка поддерева**: `cascadeInheritedFields`
рекурсивно обходит всех потомков (`mocks/categories.ts:1374-1381`, вызов `:1472`). Сервер обязан
сделать то же, иначе набор полей у потомков останется от прежнего предка.

Ошибки: ни одной — в `mockPatchCategory` нет ни одного `throw`
(`mocks/categories.ts:1451-1475`). **Проверки цикла нет нигде:** селект родителя исключает только
саму категорию (`CategoryCardPage.vue:91`), мок принимает любой `parentId`, и на цикле `getLevel`
зацикливается, а каскад уходит в бесконечную рекурсию (БАГ-06). Каким кодом сервер отвергает
смену родителя на собственного потомка — не решено (осталось, строка 7). Версии у категории нет
ни во фронте, ни на схеме, значит поведение — last-write-wins (§11 соглашений).

Бэкенд: **не реализован**. `linkedSuppliers` этот запрос принимает, а таблицы под связь на схеме
нет (осталось, строка 9).
Реализация: `services/categoriesService.ts:patchCategory` · мок `mocks/index.ts:1200` →
`mocks/categories.ts:mockPatchCategory`

---

### DELETE /api/categories/:id

Удаление категории. Save-режим: quick-action — уходит сразу после подтверждения модала
(`CategoriesPage.vue:64-69`), затем тост `categories.toast_deleted` и `load()`
(`useCategories.ts:39-41`). Save bar не участвует.

Запрос: тела нет (`services/categoriesService.ts:57`), заголовков клиент не ставит
(`services/api.ts:211`; общий класс — §5 соглашений). Ответ: на проводе `ApiResponse<null>` —
подпись клиента `Promise<void>` (`services/categoriesService.ts:56`), мок отдаёт `undefined`
(`mocks/index.ts:1492`), конверт снимает `unwrap` (`services/api.ts:128-139`).

Ошибки — три кода каталога выше. Оба запрета уже выражены схемой: `categories.parent_id`
(`backend/alembic/versions/25245d4bf874_phase_3_categories_products.py:32`) и
`products.category_id` (`:62`) объявлены `ondelete="RESTRICT"`, то есть у
сервера они получатся сами — вопрос лишь в том, чтобы превратить отказ БД в код домена, а не в
500.

Под моками проверка `CATEGORY_HAS_PRODUCTS` **врёт**: `productCount` — статическое число в сторе,
разошедшееся с товарами (БАГ-02), и удаление категории с товарами проходит. Для сервера это
значит, что проверять надо счётом по товарам, а не хранимым числом (см. «Обязанности сервера»,
производные значения).

**Порядок каскада сервер обязан выдержать сам, и третьего кода для него в домене нет.**
Собственные поля категории удаляются вместе с ней — `category_fields.category_id` объявлен
`ondelete="CASCADE"` (миграция `:46`), — а значения этих полей у товаров удалить нельзя:
`product_field_values.field_id` — `ondelete="RESTRICT"` (миграция `:78`). Значит удаление
категории, чьи поля заполнены у товаров, упрётся в отказ, которого каталог кодов не описывает
(осталось, строка 7).

Бэкенд: **не реализован**.
Реализация: `services/categoriesService.ts:deleteCategory` · мок `mocks/index.ts:1488` →
`mocks/categories.ts:mockDeleteCategory`

---

### PUT /api/categories/:id/fields

Полная замена набора **собственных** полей категории. `PUT`, а не `PATCH`, потому что тело — вся
коллекция целиком (§3 соглашений). Save-режим: clean-slate, вторая половина того же Save; уходит
только при `fieldsChanged` (`useCategoryCard.ts:111`, признак — сравнение JSON локальной копии с
загруженной, `:38-41`). Правка полей до Save целиком локальная — `addField`, `updateField`,
`deleteField`, `reorderFields` (`useCategoryCard.ts:126-150`).

Запрос — **объект-обёртка, а не массив** (`services/categoriesService.ts:65-71`):

```ts
{ fields: CategoryField[] }   // полный актуальный массив собственных полей
```

Три свойства тела, каждое — правило для сервера:

- **новое поле приходит с `id` вида `tmp-<Date.now()>`** (`useCategoryCard.ts:129`), и постоянный
  `id` выдаёт сервер (мок имитирует: `mocks/categories.ts:1507`). Из `Date.now()` следует, что два
  поля, добавленных в одну миллисекунду, придут с одинаковым `tmp-`-идентификатором — сервер
  обязан это пережить, потому что клиент ищет поле по `id` (`useCategoryCard.ts:135`);
- **`order` определяется позицией в массиве, а не присланным значением** — мок перезаписывает
  `order: i` (`mocks/categories.ts:1508`), клиент перенумеровывает при удалении и перетаскивании
  (`useCategoryCard.ts:145`, `:149`);
- **лишний ключ `fieldName`** едет рядом с `name` (`services/categoriesService.ts:68`) — его нет
  ни в типе (`types/category.ts:6-13`), ни в разборе мока (БАГ-07). Сервер обязан его
  игнорировать; общее правило — «значение везёт с собой копию определения» (§8 соглашений).

Ответ: `CategoryField[]` — финальный массив с постоянными `id` и пересчитанными `order`
(`mocks/categories.ts:1513`). Для несуществующей категории мок возвращает `undefined` вместо
ошибки (`:1492`) — та же БАГ-05; сервер обязан отвечать `CATEGORY_NOT_FOUND`.

Три обязанности сервера, которых во фронте не видно:

1. **перестроить `inheritedFields` у всего поддерева** — набор полей категории входит в данные
   каждого её потомка, и мок каскадирует (`mocks/categories.ts:1512`, `:1374-1381`);
2. **пересчитать `fieldCount`** — только по собственным полям (`mocks/categories.ts:1510`);
3. **разобраться со значениями удалённого поля у товаров.** Мок не трогает товары вовсе, а схема
   удаление запрещает: `product_field_values.field_id` — `RESTRICT` (миграция
   `25245d4bf874_phase_3_categories_products.py:78`). Что делать со значениями — не решено
   (осталось, строка 5).

Ключ слияния переводов сервер обязан выбрать сам: мок сливает имя поля и варианты enum **по
позиции** в массиве (`mocks/categories.ts:1495-1509`), что после перестановки полей взяло бы
базой соседа. Сегодня это не проявляется, потому что клиент всегда шлёт все три локали (§12
соглашений), но правило «по позиции» для сервера было бы неверным (осталось, строка 11).

Ошибки: ни одной — в `mockPutCategoryFields` нет `throw` (`mocks/categories.ts:1487-1514`).
Уникальности имени поля не требует ни мок, ни схема (`models.py:59-90` — без `UniqueConstraint`).

Флаг `categoryFieldReorder` прячет перетаскивание (`CategoryCardPage.vue:165`), но не эндпоинт:
запрос уходит при любом изменении полей, включая добавление и удаление.

Бэкенд: **не реализован**. Целевая таблица — `category_fields`
(`backend/app/modules/products/shared/models.py:59-62`), и её колонки расходятся с типом фронта:
`field_type` против `type`, `sort_order` против `order` (`models.py:77-85`), `name` —
`String(255)` (`:76`).
Реализация: `services/categoriesService.ts:putCategoryFields` · мок `mocks/index.ts:1171` →
`mocks/categories.ts:mockPutCategoryFields`

---

## Обязанности сервера

То, чего во фронтенде не видно и что в мок-режиме не проявляется никак. Девять граф аудита; где
ответа нет ни в моке, ни на схеме, ни константой во фронте, стоит ссылка на строку владельца.

**Значения по умолчанию и их владелец.** Ни одного значения домена настройки арендатора не
держат. Константами во фронте стоят: размер страницы `25` — дважды
(`services/categoriesService.ts:10`, `useCategories.ts:18`); перечень размеров `10/25/50/100` —
`PAGE_SIZE_OPTIONS` в компоненте списка (`CategoriesPage.vue:28-33`); перечень типов поля —
дважды, типом (`types/category.ts:4`) и массивом `FIELD_TYPES` (`CategoryCardPage.vue:97-105`);
тип нового поля `'text'` и `required: false` (`CategoryCardPage.vue:116-128`). Кто владеет
перечнем типов поля на сервере — не решено (осталось, строки 4 и 10).

**События и уведомления: нигде.** `grep -n "notify" frontend_vue/src/services/mocks/categories.ts`
— пусто; ни один из семи эмиттеров (§10 соглашений) категорий не касается
(`grep -rn "categor" frontend_vue/src/services/mocks/notifications.ts` — пусто). Ни создание, ни
удаление, ни замена набора полей — операция, меняющая карточку каждого товара категории и всего
поддерева, — уведомления не рождают (осталось, строка 1).

**Запись в аудит-лог: нигде для самой категории.**
`grep -n "auditLog" frontend_vue/src/services/mocks/categories.ts` — пусто. Аудит в проекте
существует и лежит на товаре (`types/product.ts:108`) плюс отдельным доменом `audit-feed` (§9
соглашений). Изменение полей категории меняет данные всех её товаров и не оставляет следа ни в
одном журнале (осталось, строка 2).

**Кастомные поля — это и есть предмет домена.** Определения живут в самой категории, а не в
библиотеке: собственные — `Category.fields`, унаследованные — `Category.inheritedFields`
(`types/category.ts:22-23`), запись — `PUT /api/categories/:id/fields`. Библиотека
`/api/config/fields` к категориям отношения не имеет: её `f-categories` (`mocks/config.ts:42`) —
поле карточки поставщика (§8 соглашений). Значения по этим определениям хранит товар:
`ProductFieldValue` с `fieldId`, `fieldName`, `fieldType`, `inherited` (сборка —
`mocks/products.ts:14046-14060`), в моке 761 привязка `fieldId: 'f-*'`. **Валидирует значения
никто** — ни `required`, ни `type` при записи товара не проверяются (§8 соглашений), и что делать
со значением поля, определение которого удалили или которое перестало наследоваться после смены
родителя, не знает ни мок, ни схема (осталось, строка 5).

**Настройки, которых мок не отслеживает** — три, каждая наблюдением: (1) локали жёстко три
(`types/i18n.ts:6-10`), список языков арендатора на выдачу не влияет, а сортировка всегда по
`name.en` (`mocks/categories.ts:1364`, `:1403`) независимо от локали читателя; (2) валюта
связанного поставщика — снимок на момент привязки (`CategoryCardPage.vue:231`), у настроек не
переспрашивается, курса в проекте нет (§14 соглашений); (3) `price` и `priceUomId` у
`LinkedSupplier` в этой карточке не заполняются и не показываются (`CategoryCardPage.vue:225-231`,
таблица `:439-457`), то есть справочник единиц на экране не участвует.

**Мультиарендность.** Во фронте не выражена нигде — ни `tenantId`, ни заголовка арендатора в
`categoriesService.ts` нет (файл целиком, 72 строки). На схеме выражена: `Category.tenant_id` и
`CategoryField.tenant_id` — `nullable=False`, `index=True`, FK на `tenants.id` с
`ondelete="CASCADE"` (`backend/app/modules/products/shared/models.py:19-24` и `:64-69`). Значит
**выборка каждого из шести эндпоинтов обязана быть ограничена арендатором**, а сам он берётся из
токена (§4 соглашений). Это единственная обязанность домена, у которой источник — бэкенд.

**Права: нигде на уровне действия.** Доступ гейтится только фича-флагами — роуты несут
`meta.featureFlag: 'adminCategories'` (`router/index.ts:232`, `:238`), страница дублирует его
`v-if` (`CategoriesPage.vue:26`), секции карточки закрыты `categoryFieldReorder` и
`categorySupplierLinks` (`CategoryCardPage.vue:165`, `:29`); все три объявлены `true`
(`config/featureFlags.ts:19`, `:36`, `:37`). Флаг — это тариф, а не право (§7 соглашений).
Категорий нет в матрице прав (`grep -rn "categor" frontend_vue/src/services/mocks/config.ts` даёт
только `f-categories`, `:42`, `:126`), и функции, проверяющей право на запись, в домене нет ни
одной (осталось, строка 3).

**Транзакционность и идемпотентность.** `Idempotency-Key` домен не шлёт ни на одном пути (§11
соглашений). Save карточки — **два независимых параллельных запроса**:
`Promise.all([patchCategory, putCategoryFields])` (`useCategoryCard.ts:98-112`); общей транзакции
у них нет, при падении одного второй остаётся применённым, а `load()` после ошибки не
вызывается — экран остаётся с несохранёнными данными поверх частично сохранённых
(`useCategoryCard.ts:113-118`; класс — §15 соглашений). Внутри `PUT /fields` мок атомарен: массив
перезаписывается целиком (`mocks/categories.ts:1495-1509`), но каскад по потомкам идёт **после**
записи и не откатывается (`:1512`). Обязаны ли PATCH и PUT применяться одной транзакцией — не
решено (осталось, строка 6).

**Производные значения — здесь главное расхождение мока со схемой.** `level` и `parentName` мок
считает при чтении, поднимаясь по `parentId` (`mocks/categories.ts:1328-1341`), а схема хранит
`level` колонкой и `parent_name` не имеет вовсе
(`backend/app/modules/products/shared/models.py:39-41`). `fieldCount` мок пересчитывает при записи
полей (`mocks/categories.ts:1510`), схема хранит колонкой (`models.py:33-35`). `productCount` не
считается **нигде**: это статическое число в сторе и колонка в схеме (`models.py:36-38`), при
создании товара оно не растёт (БАГ-02). `inheritedFields` мок держит материализованными и
обновляет каскадом (`mocks/categories.ts:1374-1381`), а на схеме их нет ни колонкой, ни таблицей.
Общее правило — §17 соглашений: величина, выводимая из других данных, считается при чтении;
сервер обязан считать `level`, `parentName`, `fieldCount`, `productCount` и `inheritedFields`, а
хранимые колонки под них — материал для решения бэкенда, а не источник истины.

## Правила домена

Живут только здесь; сквозные правила — в соглашениях.

1. **Имя категории и имя поля трёхъязычны, а схема хранит одну строку.** `name` — `String(255)`
   (`backend/app/modules/products/shared/models.py:25` и `:76`), `description` — `Text` (`:32`),
   `options` — `JSON` (`:86-88`). Самое крупное расхождение домена (§12 соглашений).
2. **`inheritedFields` — вся цепочка предков, плоско, от дальнего к ближнему**, дубликаты по имени
   не схлопываются (`mocks/categories.ts:1432-1434`, `:1471`, `:1378`).
3. **Смена родителя и замена набора полей перестраивают поддерево целиком**, а не одну запись
   (`mocks/categories.ts:1374-1381`, вызовы `:1472` и `:1512`).
4. **`fieldCount` — только собственные поля**, унаследованные в него не входят
   (`mocks/categories.ts:1510`).
5. **Сортировка списка зависит от поиска** — depth-first при пустом `search`, плоская по `name.en`
   при непустом (`mocks/categories.ts:1359-1372`, `:1402-1404`).
6. **Поиск — только по имени и сразу по трём языкам** (`mocks/categories.ts:1396-1400`); описание в
   поиск не входит.
7. **`tmp-*` id новых полей заменяет сервер**, `order` он же назначает по позиции
   (`mocks/categories.ts:1507-1508`).
8. **Привязка поставщика к категории — дефолт-список для товаров, а не цена**: `price` и
   `priceUomId` всегда `null` (`CategoryCardPage.vue:225-231`), `currency` — снимок валюты
   поставщика (`:231`), который после её смены у поставщика не обновляется ничем.
9. **Один поставщик привязывается не более одного раза**, и дедупликация только клиентская
   (`useCategoryCard.ts:56`, селект прячет привязанных — `CategoryCardPage.vue:215-218`); на
   проводе уходит полный массив.
10. **Категория товара необязательна** — `products.category_id` объявлен `nullable=True`
    (`backend/alembic/versions/25245d4bf874_phase_3_categories_products.py:62`), в моке есть товар
    с `categoryId: null` (`mocks/products.ts:996`). Значит `productCount` считается по товарам с
    проставленной категорией, а товар без категории не мешает удалению ни одной.
11. **Три каскада на схеме выражены тремя разными политиками**: `categories.parent_id` —
    `RESTRICT`, `category_fields.category_id` — `CASCADE`, `product_field_values.field_id` —
    `RESTRICT` (миграция `:32`, `:46`, `:78`). При этом ORM-отношение `children` объявлено
    `cascade="all, delete-orphan"` (`backend/app/modules/products/shared/models.py:44-47`), что
    противоречит `RESTRICT` на том же ключе. Находки про код это не касается: правится не
    фронтенд, а модель, — поэтому противоречие записано здесь, задачей бэкенда.
12. **Уникальности нет нигде** — ни у имени категории, ни у имени поля
    (`backend/app/modules/products/shared/models.py:210-214` — единственный `UniqueConstraint`
    домена относится к значению поля товара).
13. **Перечень типов поля на схеме шире, чем во фронте, и не закрыт ничем**: колонка `field_type`
    — свободная `String(50)` без `CHECK`, допустимые значения живут комментарием рядом и их пять
    (`backend/app/modules/products/shared/models.py:77-79`), а во фронте семь — добавлены `email`
    и `file` (`types/category.ts:4`), и оба доходят до селекта (`CategoryCardPage.vue:97-105`).

## Унаследовано из прежнего контракта, кодом не подтверждено

Ничего не вычеркнуто молча. Эти утверждения прежнего
[`03-api-contract.md`](../03-api-contract.md) сохранены как замысел — в коде их нет ни в
подтверждённом, ни в опровергнутом виде:

| утверждение | где было | состояние |
|---|---|---|
| статусы доменных кодов: 409/409/404 | `03-api-contract.md:834-838` | мок статуса не несёт, `ApiRequestError.status` берётся из настоящего ответа (`services/api.ts:117-124`); мапирование совпадает с классами ядра (§2 соглашений) |
| `404 CATEGORY_NOT_FOUND` у `GET /api/categories/:id` | `03-api-contract.md:926` | мок бросает текст (`mocks/categories.ts:1419`, БАГ-04); сам код в домене есть, но только на `DELETE` |
| `422 VALIDATION_ERROR` за отсутствующее `name` у `POST /api/categories` | `03-api-contract.md:885` | серверной проверки нет, отсекает клиент (`CategoriesPage.vue:72`), поведение закреплено e2e (`tests/e2e/admin/products/categories.spec.ts:183-186`) |
| «last-write-wins» у `PATCH /api/categories/:id` | `03-api-contract.md:946` | ни `If-Match`, ни `updatedAt` у категории нет (`types/category.ts:15-25`) — то же, что у пятнадцати других доменов (§11 соглашений) |

## Чего в домене нет

| было описано | чем доказано отсутствие |
|---|---|
| код `DUPLICATE_FIELD_NAME` (409, «поле с таким именем уже есть в категории») — `03-api-contract.md:837` | `grep -rn "DUPLICATE_FIELD_NAME" frontend_vue/src backend` — пусто; уникальности имени поля не требует ни мок (`mocks/categories.ts:1487-1514` — ни одного `throw`), ни схема (`backend/app/modules/products/shared/models.py:59-90` — без `UniqueConstraint`) |
| тело `PUT /api/categories/:id/fields` — массив `CategoryField[]` — `03-api-contract.md:951` | на проводе объект-обёртка `{ fields: [...] }` (`services/categoriesService.ts:65-71`), мок разбирает `const { fields } = body` (`mocks/index.ts:1173`) |
| `name`, `description` и `options` как `string` во всех четырёх примерах — `03-api-contract.md:863-865`, `:917-918`, `:955-956` | и тип, и мок дают `TranslatedString` (`types/category.ts:17`, `:19`, `:12`; посев `mocks/categories.ts:12`) |
| `linkedSuppliers` без поля `currency` — `03-api-contract.md:920-921` | поле есть в типе (`types/product.ts:34`) и заполняется снимком валюты поставщика (`CategoryCardPage.vue:231`) |
| «Удалённые поля сервер удаляет каскадом» — `03-api-contract.md:960` | каскада нет: мок товары не трогает вовсе, а схема удаление значения запрещает — `product_field_values.field_id` объявлен `ondelete="RESTRICT"` (миграция `25245d4bf874_phase_3_categories_products.py:78`) |
| «`level` вычисляется сервером» как единственная политика — `03-api-contract.md:871` | схема хранит `level`, `field_count` и `product_count` колонками (`backend/app/modules/products/shared/models.py:33-41`), то есть у величины два владельца; разрешение — за бэкендом (§17 соглашений) |

## Оставлено владельцу

Одиннадцать строк, все в
[`audit/00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md) (раздел
`## categories — аудит 2026-09-04`, строки 1–8, и `## categories — доборка проверочного прохода
2026-09-04`, строки 1–3). Контракт их не назначает.

Нумерация ниже — порядок строк в том файле; ссылки «осталось, строка N» по всему контракту ведут
сюда.

1. **События и уведомления** — рождает ли уведомление создание, удаление и, главное, замена набора
   полей категории: операция меняет карточку каждого товара категории и всего поддерева —
   **осталось**.
2. **Запись в аудит-лог** — остаётся ли след у создания, удаления, смены родителя и замены набора
   полей, и кто его автор — **осталось**.
3. **Права** — **решено 2026-09-07:** обычные элементы CRUD-матрицы, назначаемые по надобности
   роли; общее ли право с товарами, решает домен, а не наследование от соседа (П2, П7,
   [§6.6](00-conventions.md)). Отказ — `403` (П4).
4. **Значения по умолчанию** — кто владеет перечнем типов поля категории: код или настройки
   арендатора — **осталось**.
5. **Кастомные поля** — что делать со значениями у товаров, когда `PUT /api/categories/:id/fields`
   удалил определение, и со значениями унаследованных полей, когда сменился родитель —
   **осталось**.
6. **Транзакционность** — обязаны ли `PATCH /api/categories/:id` и
   `PUT /api/categories/:id/fields` применяться одной транзакцией — **осталось**.
7. **Коды ошибок** — каким кодом сервер отвергает смену родителя на собственного потомка и
   удаление категории, чьи поля заполнены у товаров — **осталось**.
8. **Форма ответа для справочников** — чем отдавать полный список категорий выбору родителя и
   выбору категории товара: отдельным лёгким эндпоинтом или явным большим `pageSize` —
   **осталось**.
9. **Форма запроса** — чем сервер хранит `linkedSuppliers` категории: таблицы связи «категория ↔
   поставщик» на бэкенде нет ни одной — **осталось**.
10. **Значения по умолчанию** — закрыт ли перечень типов поля и каким механизмом: семь значений во
    фронте против свободной `String(50)` с комментарием на пять — **осталось**.
11. **Форма запроса** — по какому ключу сервер сливает переводы имени поля при
    `PUT /api/categories/:id/fields`: по `id` поля или по позиции в массиве — **осталось**.

## Пробелы аудита — где закрыт каждый

| пробел аудита | где |
|---|---|
| `DELETE`: каскад собственных полей и код для «поля заполнены у товаров» | раздел `DELETE`, третий абзац; код — строка 7 владельцу |
| `DELETE`: `productCount` в моке статичен, проверка врёт | раздел `DELETE`, второй абзац; «Обязанности сервера», производные значения |
| `DELETE`: статусы кодов домена существуют только в старом тексте | «Каталог кодов ошибок домена» и «Унаследовано из прежнего контракта» |
| `GET /api/categories`: `name` строкой в примере | «Чего в домене нет», третья строка |
| `GET /api/categories`: при поиске дерево не строится, пагинация режет дерево | раздел `GET /api/categories`, абзац «Порядок выдачи» |
| `GET /api/categories`: справочник берётся тремя способами | раздел `GET /api/categories`, последний абзац; строка 8 владельцу |
| `GET /api/categories/:id`: `name`/`options` строками, нет `currency`, порядок и дубликаты `inheritedFields` | «Чего в домене нет» (строки 3–4) и раздел `GET /api/categories/:id` |
| `GET /api/categories/:id`: кода ошибки нет, мок бросает текст | раздел `GET /api/categories/:id`, «Ошибки»; БАГ-04 |
| `PATCH`: `name`/`description` строками; last-write-wins | «Чего в домене нет» и «Унаследовано из прежнего контракта» |
| `PATCH`: проверки цикла нет, существование родителя не проверяется | раздел `PATCH`, «Ошибки»; раздел `POST`, «Ошибки»; строка 7 владельцу |
| `POST`: пустые локали и сортировка по `name.en`; уникальности нет; родитель не проверяется | раздел `POST`, все три абзаца |
| `PUT /fields`: тело описано массивом | «Чего в домене нет», вторая строка |
| `PUT /fields`: каскад значений у товаров, перестройка `inheritedFields` у потомков, пересчёт `fieldCount` | раздел `PUT /fields`, «Три обязанности сервера» |
| «Обязанности сервера»: шесть граф с ответом «нигде» (события, аудит-лог, права, владелец перечня типов, кастомные поля, транзакционность) | одноимённый раздел; каждая помечена строкой владельцу |
