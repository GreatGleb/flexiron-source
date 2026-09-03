# Categories

Дерево категорий номенклатуры и определения кастомных полей, которые категория раздаёт своим
товарам. Шесть эндпоинтов: список, карточка, создание, правка, замена набора полей, удаление.

Общие соглашения — [`00-conventions.md`](00-conventions.md): конверт ответа и `unwrap()` (§1),
где лежит код ошибки (§2), PATCH против PUT (§4), `TranslatedString` (§5), пагинация (§6),
Save UX (§10), мультиарендность (§12), права и фичи (§13). Здесь они **не повторяются**: второй
экземпляр правила расходится с первым в тот же день, когда появляется.

Аудит по коду, с `файл:строка` на каждое утверждение —
[`plans/api/audit/categories.md`](../../plans/api/audit/categories.md). Находки про код (девять,
код не тронут) — [`contract-sync-categories-bugs.md`](../../plans/bugs/contract-sync-categories-bugs.md);
аудит вывел восемь, девятая — противоречие ORM-каскада и `RESTRICT` (правило §12) — наблюдалась
аудитом в правиле 13, но в баг-файл не попала и заведена при написании контракта.

**Источник истины домена — мок и клиент, потому что серверной реализации нет ни у одного из
шести эндпоинтов.** Модуля `categories` в `backend/app/modules/` нет вовсе, а два роута модуля
`products`, где живут таблицы категорий, объявлены с префиксом `/api/products`
(`products/features/create_product/action.py:20,23`,
`products/features/get_product_detail/action.py:25,28`) — про категории нет ни одного.
Поэтому у каждого раздела ниже строка `Бэкенд: не реализован` — это не метка
`Статус: спроектировано`: клиент эти эндпоинты уже зовёт, кода нет **только серверного**.

**Схема хранения при этом уже зафиксирована, и она расходится с формами фронта.** Таблицы
`categories` и `category_fields` объявлены в
[`backend/app/modules/products/shared/models.py:14`](../../../backend/app/modules/products/shared/models.py)
(`Category`) и `:59` (`CategoryField`), миграция —
`backend/alembic/versions/25245d4bf874_phase_3_categories_products.py:27-53`. Расхождения
описаны ниже в «Правилах домена» (§1 — многоязычные имена в `String(255)`, §5 — производные
значения колонками, §12 — ORM-каскад против `RESTRICT` на том же внешнем ключе) и обязательны к
решению до первого слайса.

Потребители: [`composables/useCategories.ts`](../../../frontend_vue/src/composables/useCategories.ts)
(список, удаление), [`composables/useCategoryCard.ts`](../../../frontend_vue/src/composables/useCategoryCard.ts)
(карточка, Save), [`views/admin/products/CategoriesPage.vue`](../../../frontend_vue/src/views/admin/products/CategoriesPage.vue)
(создание), [`composables/useProductCard.ts`](../../../frontend_vue/src/composables/useProductCard.ts)
(справочник категорий для карточки товара).

**Имена и опции многоязычны.** `Category.name`, `Category.description`, `CategoryField.name` — это
`TranslatedString`, `CategoryField.options` — `TranslatedString[]`
(`types/category.ts:6-25`). Прежний контракт описывал их строками, и это было неверно во всех
пяти разделах — см. «Чего в домене нет».

---

### GET /api/categories

Список категорий деревом, с поиском и пагинацией. Чтение: `onMounted` → `load()`
(`CategoriesPage.vue:57`), плюс `watch` по фильтру со сбросом на первую страницу
(`useCategories.ts:57-65`) и `watch` по пагинации (`:67-73`).

Запрос — query из трёх строк:

```ts
{ search: string; page: string; pageSize: string }   // '' в search = без фильтра
```

Ответ: `ApiResponse<PaginatedResponse<CategoryListItem>>`

```ts
// frontend_vue/src/types/category.ts:27-35
interface CategoryListItem {
  id: string
  name: TranslatedString
  parentId: string | null
  parentName: TranslatedString | null   // имя родителя целиком, не только текущая локаль
  fieldCount: number                    // только собственные поля, унаследованные не входят
  productCount: number
  level: number                         // глубина, 0 у корня
}
```

**Порядок выдачи зависит от поиска, и это правило для сервера, а не деталь мока.**

- `search` пуст — depth-first: корни по `name.en`, каждый потомок сразу за своим родителем
  (`mocks/categories.ts:1359-1372`);
- `search` непуст — плоская сортировка по `name.en` (`:1402-1404`). Дерево при этом **не
  строится**, а `parentName` и `level` продолжают ссылаться на предков, которых в выдаче может не
  быть. Сервер обязан вести себя так же: иначе результат поиска и результат обзора — два разных
  порядка на одном экране.

**Пагинация режет уже отсортированное дерево** (`:1407`): страница 2 начинается с середины ветки.
Ограничивать выборку по уровню сервер не должен — иначе потомок пропадёт вместе со страницей
родителя.

**Поиск идёт по имени и сразу по всем трём языкам**, регистронезависимо: `c.name.ru || c.name.en
|| c.name.lt`, `toLowerCase().includes` (`mocks/categories.ts:1396-1400`). Описание в поиск не
входит.

Ошибки: ни одной — `mockGetCategories` не бросает (`mocks/categories.ts:1388-1415`); клиент
показывает `e.message` как текст (`useCategories.ts:31`).

Тот же эндпоинт используется как **справочник** двумя местами, и по-разному: карточка категории
зовёт `getCategories({ search: '' })` без пагинации, то есть получает первые 25 записей
(`CategoryCardPage.vue:63`, находка 3), а карточка товара — `getCategories({ search: '' }, 1, 999)`
(`useProductCard.ts:132`). Отдельного лёгкого эндпоинта у домена нет, в отличие от
`/api/products/list` и `/api/suppliers/list` ([`00-conventions.md` §6](00-conventions.md)) —
**осталось**: чем сервер отдаёт полный справочник категорий, решает владелец
([`00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md), строка
«categories · Форма ответа для справочников»).

Бэкенд: **не реализован** — роута под категории нет ни одного; таблица есть
(`backend/app/modules/products/shared/models.py:14`)
Реализация: `services/categoriesService.ts:getCategories` · мок `mocks/index.ts:415` →
`mocks/categories.ts:mockGetCategories`

---

### POST /api/categories

Создание категории из модала списка. Save-режим: quick-action — запрос уходит по submit, затем
`load()` списка (`CategoriesPage.vue:71-90`).

Запрос:

```ts
{
  name: TranslatedString
  parentId?: string | null
  description?: TranslatedString | null   // пустое описание уходит как null
}
```

Клиент принимает от UI строки и заворачивает их в `TranslatedString` **текущей локали**
(`categoriesService.ts:23-35`): две другие локали при создании — пустые строки
(`types/i18n.ts:19-24`). Следствие, которое сервер обязан пережить, а не «починить»: категория,
созданная в `ru`, имеет пустое `name.en`, а список сортируется именно по `name.en`
(`mocks/categories.ts:1364`) — такие категории всплывают в начало. Заполнять пустые локали сервер
не имеет права ([`00-conventions.md` §5](00-conventions.md)).

Ответ: `ApiResponse<Category>` — созданная категория целиком, с `fieldCount: 0`,
`productCount: 0`, `fields: []`, `linkedSuppliers: []` и `inheritedFields`, взятыми у родителя
(`mocks/categories.ts:1436-1448`).

Ошибки: ни одной — `mockCreateCategory` не бросает (`mocks/categories.ts:1423-1449`). Пустое имя
отсекается **на клиенте**: `if (!newCatName.value.trim()) return` (`CategoriesPage.vue:72`), и это
закреплено e2e (`tests/e2e/admin/products/categories.spec.ts:183-186`). Серверная проверка обязана
быть тоже — клиентская защищает от опечатки, а не от второго вызывающего; форма отказа — общая
(`detail` с `loc`, [`00-conventions.md` §2](00-conventions.md)).

Два ограничения, которых нет ни в моке, ни в схеме, и сервер обязан их ввести сам:

- **существование `parentId` не проверяется**: мок принимает неизвестного родителя
  (`mocks/categories.ts:1431`) — категория молча становится плоской по `inheritedFields`, сохранив
  несуществующий `parentId`. На схеме FK есть (`parent_id` → `categories.id`, миграция `:32`), то
  есть на сервере это отказ, а не молчание;
- **уникальности имени нет нигде**: в `models.py:14-56` единственный `UniqueConstraint` —
  `uq_product_field_value` (`:210-214`). Требовать её — решение, а не наблюдение; сейчас повторный
  POST с тем же телом создаёт вторую категорию.

Бэкенд: **не реализован**
Реализация: `services/categoriesService.ts:createCategory` · мок `mocks/index.ts:949` →
`mocks/categories.ts:mockCreateCategory`

---

### GET /api/categories/:id

Карточка категории целиком. Чтение: `onMounted` → `load()` (`CategoryCardPage.vue:237-240`,
`useCategoryCard.ts:76-96`); тот же `load()` работает кнопкой Discard (`:122-124`) и вызывается
после успешного Save (`:113`).

Ответ: `ApiResponse<Category>`

```ts
// frontend_vue/src/types/category.ts:15-25
interface Category {
  id: string
  name: TranslatedString
  parentId: string | null
  description: TranslatedString | null
  fieldCount: number
  productCount: number
  inheritedFields: CategoryField[]   // read-only, собирается сервером по цепочке предков
  fields: CategoryField[]            // собственные
  linkedSuppliers: LinkedSupplier[]
}

// frontend_vue/src/types/category.ts:4-13
type CategoryFieldType = 'text' | 'number' | 'boolean' | 'enum' | 'email' | 'date' | 'file'
interface CategoryField {
  id: string
  name: TranslatedString
  type: CategoryFieldType
  required: boolean
  order: number
  options: TranslatedString[]        // непусто только у type: 'enum'
}

// frontend_vue/src/types/product.ts:18-35
interface LinkedSupplier {
  id: string
  name: TranslatedString
  price: number | null               // на уровне категории всегда null
  priceUomId: string | null          // на уровне категории всегда null
  leadDays: number | null
  currency: string | null            // снимок валюты поставщика на момент привязки
}
```

`inheritedFields` — **плоское объединение всей цепочки предков**, порядок от дальнего предка к
ближнему, дубликаты по имени **не схлопываются** (правило §2 ниже).

Ошибки: **кода нет ни одного**. Мок бросает текст `Category ${id} not found`
(`mocks/categories.ts:1419`), и этот текст показывается пользователю как есть
(`useCategoryCard.ts:92`) — находка 4. Сервер обязан отдавать `CATEGORY_NOT_FOUND` (код домена
существует, `mocks/categories.ts:1479`) в поле `code`, а не текст в `message`, со статусом
**404** — статус унаследован от прежнего контракта (`03-api-contract.md:926`, `:836`) и в коде не
выражен ничем (см. таблицу кодов в `DELETE /api/categories/:id`).

Бэкенд: **не реализован**
Реализация: `services/categoriesService.ts:getCategory` · мок `mocks/index.ts:421` →
`mocks/categories.ts:mockGetCategory`

---

### PATCH /api/categories/:id

Правка карточки дельтой. Save-режим: clean-slate — правки живут в локальном состоянии
(`useCategoryCard.ts:24-32,44`) и уходят по кнопке Save при `isAnythingDirty` (`:98-120`, `:51-53`).
**Половина Save**: параллельно уходит `PUT /api/categories/:id/fields` (`:112`), см. §7 правил.

Запрос — только изменённые ключи верхнего уровня, `useDirtyCheck().diff()`
(`useDirtyCheck.ts:62-78`: сравнение `JSON.stringify` по каждому ключу первого уровня):

```ts
{
  name?: TranslatedString
  parentId?: string | null
  description?: TranslatedString | null
  linkedSuppliers?: LinkedSupplier[]   // полный массив, replace-семантика
}
```

`linkedSuppliers` приходит целиком или не приходит вовсе (`useCategoryCard.ts:105-108`) — это общее
правило PATCH для массивов ([`00-conventions.md` §4](00-conventions.md)).

Ответ: `ApiResponse<Category>` — категория целиком, с **пересчитанными** `inheritedFields`, если
изменился `parentId`.

Две обязанности сервера, которых мок не исполняет:

- **смена родителя перестраивает `inheritedFields` у всего поддерева**, а не только у самой
  категории (правило §3 ниже);
- **новый `parentId` обязан существовать**: мок этого не проверяет, и при неизвестном родителе
  `inheritedFields` молча становятся пустыми (`mocks/categories.ts:1470-1471`).

**Цикл (родитель — собственный потомок) не запрещён ничем.** Селект исключает только саму
категорию (`CategoryCardPage.vue:91`), `mockPatchCategory` принимает любой `parentId`
(`mocks/categories.ts:1468-1473`); на цикле `getLevel` зацикливается (`:1331-1334`), а
`cascadeInheritedFields` уходит в бесконечную рекурсию (`:1374-1381`) — находка 6. Проверка
обязана быть серверной. **Осталось**: каким кодом сервер отвергает цикл — решение владельца
([`00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md), строка
«categories · Коды ошибок»); подходящего кода в домене нет.

Ошибки: ни одной — `mockPatchCategory` не бросает (`mocks/categories.ts:1451-1475`), а для
несуществующей категории возвращает `undefined`, что доходит до клиента как успешный ответ без
данных (находка 5). Сервер обязан отвечать `CATEGORY_NOT_FOUND`.

Оптимистической блокировки у домена нет: ни `If-Match`, ни поля `version`/`updatedAt` в `Category`
(`types/category.ts:15-25`). `If-Match` есть только у заказов
([`00-conventions.md` §8](00-conventions.md)). Прежний контракт объявлял «last-write-wins» — это
решение, а не наблюдение, см. «Чего в домене нет».

Бэкенд: **не реализован**
Реализация: `services/categoriesService.ts:patchCategory` · мок `mocks/index.ts:1200` →
`mocks/categories.ts:mockPatchCategory`

---

### PUT /api/categories/:id/fields

Замена **всего** набора собственных полей категории. Save-режим: clean-slate, вторая половина того
же Save — уходит только при `fieldsChanged` (`useCategoryCard.ts:111`, признак — сравнение JSON
локальной копии с загруженной, `:38-41`), параллельно с PATCH (`:112`). Редактирование поля до
Save целиком локальное: `addField`/`updateField`/`deleteField`/`reorderFields` (`:126-150`).

Запрос — **объект-обёртка, а не массив** (`categoriesService.ts:65-71`):

```ts
{ fields: Array<CategoryField & { fieldName: TranslatedString }> }
```

Клиент шлёт каждый элемент целиком (`...f`) и добавляет **лишний ключ `fieldName`** — дубль
`name`, которого нет ни в типе `CategoryField`, ни в разборе мока
(`mocks/categories.ts:1495-1509`); находка 7. Сервер обязан читать `name` и игнорировать
`fieldName`, а не наоборот.

Массив полный: чего в нём нет — то удалено. Новые поля приходят с `id` вида `tmp-<Date.now()>`
(`useCategoryCard.ts:129`), и постоянный `id` выдаёт сервер: мок делает
`f.id.startsWith('tmp-') ? \`f-perm-${++fieldSeq}\` : f.id` (`mocks/categories.ts:1507`). Два поля,
добавленных в одну миллисекунду, получат **одинаковый** `tmp-` id — сервер обязан это пережить и
выдать им разные постоянные id.

`order` определяется **позицией в массиве**, а не присланным значением: мок перезаписывает
`order: i` (`mocks/categories.ts:1508`); клиент перенумеровывает при удалении и drag-and-drop
(`useCategoryCard.ts:145`, `:149`).

Ответ: `ApiResponse<CategoryField[]>` — финальный набор собственных полей с серверными `id`
(`mocks/categories.ts:1513`). Для несуществующей категории мок возвращает `undefined` (`:1492`) —
та же находка 5; сервер обязан отвечать `CATEGORY_NOT_FOUND`.

Три обязанности сервера в одной операции:

1. **пересчитать `fieldCount`** — только собственные поля (`mocks/categories.ts:1510`);
2. **перестроить `inheritedFields` у всего поддерева** (`:1512`, каскад `:1374-1381`). То есть
   правка набора полей одной категории меняет данные всех её потомков и карточку каждого их
   товара;
3. **разобраться со значениями удалённых полей у товаров.** Мок не делает ничего (в
   `mocks/categories.ts` нет ни одного обращения к товарам), а схема удаление запрещает:
   `product_field_values.field_id` объявлен `ondelete="RESTRICT"` (миграция
   `25245d4bf874_phase_3_categories_products.py:78`) — то есть на настоящей схеме удаление поля с
   заполненными значениями просто упадёт. **Осталось**: что делать со значениями удалённого
   определения и со значениями унаследованных полей при смене родителя — решение владельца
   ([`00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md), строка
   «categories · Кастомные поля»; сквозной пункт 2 там же).

Ошибки: ни одной — `mockPutCategoryFields` не бросает (`mocks/categories.ts:1487-1514`).
Уникальности имени поля не требует ни мок, ни схема (`models.py:59-90` — без `UniqueConstraint`).

Флаг `categoryFieldReorder` прячет drag-and-drop (`CategoryCardPage.vue:165`), но эндпоинт не
закрывает: PUT уходит при любом изменении полей, включая добавление и удаление
(`useCategoryCard.ts:111`). Флаг — не защита доступа
([`00-conventions.md` §13](00-conventions.md)).

Бэкенд: **не реализован**
Реализация: `services/categoriesService.ts:putCategoryFields` · мок `mocks/index.ts:1171` →
`mocks/categories.ts:mockPutCategoryFields`

---

### DELETE /api/categories/:id

Удаление категории. Save-режим: quick-action — уходит сразу после подтверждения модала
(`CategoriesPage.vue:64-69`, `useCategories.ts:39`), затем `load()` списка (`:41`).

Запрос: ни тела, ни query, ни заголовков (`apiDelete`, `services/api.ts:211`).

Ответ: `ApiResponse<null>` — подпись клиента `Promise<void>`
(`categoriesService.ts:56`), мок отдаёт `undefined` (`mocks/index.ts:1492`).

Ошибки — три кода, все из мока (`mocks/categories.ts:1477-1485`):

| статус | код | когда | доходит до человека |
|---|---|---|---|
| 409 | `CATEGORY_HAS_PRODUCTS` | у категории есть товары (`:1480`) | `categories.toast_error_delete_has_products` (`i18n/admin/categories.ts:61`, en `:125`, lt `:189`) |
| 409 | `CATEGORY_HAS_CHILDREN` | у категории есть потомки (`:1481`) | `..._has_children` (`:62`, `:126`, `:190`) |
| 404 | `CATEGORY_NOT_FOUND` | категории нет (`:1479`) | общий `categories.toast_error` (`useCategories.ts:49`) |

**Откуда взяты статусы.** Из прежнего контракта (`03-api-contract.md:834-836`) — и только оттуда:
в коде HTTP-статуса у этих кодов нет нигде. Мок бросает `throw new Error(result.code)` без
статуса (`mocks/index.ts:1491`), серверной реализации домена нет ни одной, а
[`00-conventions.md` §2](00-conventions.md) описывает, **где** лежит код ошибки, но не какой
статус ему соответствует. То есть у трёх кодов источник статуса — замысел, третья ступень
старшинства; проверить его по коду нечем, и переназначать их контракт не вправе. Форма ответа —
общая: `detail: { message, code }` ([`00-conventions.md` §2](00-conventions.md)), как у
[`auth.md`](auth.md), где статусы приходят с кода бэкенда.

Ни один из трёх кодов не является подстрокой другого
([`00-conventions.md` §2](00-conventions.md)). Оба запрета уже выражены схемой:
`products.category_id` и `categories.parent_id` — `ondelete="RESTRICT"` (миграция `:62`, `:32`).

**Код обязан прийти в поле `code`.** Мок кладёт его в `message` (`throw new Error(result.code)`,
`mocks/index.ts:1491`), и клиент читает `e.message` (`useCategories.ts:43-47`) — против настоящего
API обе ветки сравнения не сработают (находка 1). Это находка про фронт, а не послабление
контракту.

Третий запрет, кода для которого нет: собственные поля категории удаляются каскадом
(`category_fields.category_id` — `CASCADE`, миграция `:46`), а значения этих полей у товаров —
`RESTRICT` (`:78`). Значит удаление категории, чьи поля заполнены у товаров, упирается в отказ, для
которого код в домене отсутствует. **Осталось** — та же строка «categories · Коды ошибок» в
[`00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md).

**Каскад потомков: два бэкенд-артефакта домена противоречат друг другу, и контракт этого
противоречия не снимает.** Схема требует отказать — `categories.parent_id` объявлен
`ondelete="RESTRICT"` (миграция `:32`, `models.py:29-33`), и мок ведёт себя так же
(`CATEGORY_HAS_CHILDREN`, `mocks/categories.ts:1481`). А ORM-отношение того же внешнего ключа
объявлено с каскадом:

```py
# backend/app/modules/products/shared/models.py:44-47
children: Mapped[list["Category"]] = relationship(
    "Category", back_populates="parent",
    cascade="all, delete-orphan",
)
```

`delete-orphan` велит удалить потомков при удалении родителя через сессию SQLAlchemy — то есть
ORM попытается сделать ровно то, что `RESTRICT` того же FK запретит. Это не то же самое, что
`fields` (`models.py:53-56`): там каскад ORM совпадает с `ondelete="CASCADE"` на
`category_fields.category_id` (миграция `:46`), и противоречия нет.

Какое из двух объявлений выражает замысел, из кода не следует: оба свидетельства бэкендовские и
равносильные, реализации эндпоинта нет, а порядок старшинства «бэкенд → мок+клиент → замысел»
конфликт **внутри** бэкенда не разрешает. Догадаться здесь означает решить за владельца на самом
консеквентном пути домена. **Осталось** — правило §12 ниже; строки в
[`00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md) для неё пока нет,
наблюдение заведено находкой 9 в
[`contract-sync-categories-bugs.md`](../../plans/bugs/contract-sync-categories-bugs.md).

Бэкенд: **не реализован**
Реализация: `services/categoriesService.ts:deleteCategory` · мок `mocks/index.ts:1488` →
`mocks/categories.ts:mockDeleteCategory`

---

## Правила домена

Правила, живущие ровно здесь; каждое доказано кодом и ни одно не выводится из форм запросов.

1. **Имена трёхъязычны во фронте и однострочны в схеме — это расхождение, а не деталь.**
   `Category.name`, `CategoryField.name` — `TranslatedString`, `options` —
   `TranslatedString[]` (`types/category.ts:8,12,17`); на сервере
   `name: Mapped[str] = mapped_column(String(255))` (`models.py:25`, `:76`), `description: Text`
   (`:32`), `options: JSON` (`:86`). Хранить `{ru,en,lt}` в `String(255)` нечем. Самое крупное
   расхождение домена; прежний контракт его не видел, потому что описывал имена строками.
2. **`inheritedFields` — плоское объединение всей цепочки предков.** Собирается как
   `[...parent.inheritedFields, ...parent.fields]` (`mocks/categories.ts:1432-1434` при создании,
   `:1471` при смене родителя, `:1378` при каскаде): прямой родитель уже хранит накопленную
   цепочку. Порядок — от дальнего предка к ближнему, дубликаты по имени **не схлопываются**.
3. **Смена родителя перестраивает `inheritedFields` у всего поддерева.**
   `cascadeInheritedFields` рекурсивно обходит потомков (`mocks/categories.ts:1374-1381`) и
   вызывается из обеих операций Save — `PATCH` (`:1472`) и `PUT /fields` (`:1512`).
4. **`fieldCount` — только собственные поля.** `cat.fieldCount = cat.fields.length`
   (`mocks/categories.ts:1510`); унаследованные в счёт не идут (например `cat-3`: `fieldCount=1`
   при семи унаследованных).
5. **`level`, `parentName` и `inheritedFields` — производные, `productCount` — тоже.** Мок считает
   `level` (`mocks/categories.ts:1328-1336`) и `parentName` (`:1338-1341`) при чтении, а схема
   хранит `level`, `field_count` и `product_count` **колонками** (`models.py:33-41`) и `parentName`
   не имеет вовсе; `inheritedFields` на схеме нет ни колонкой, ни таблицей. Правило для сервера:
   собирать по цепочке `parent_id` при чтении, а не доверять колонке, которую некому обновлять.
   Насколько это расходится с реальностью, видно по моку: `productCount` там статическое число
   стора и при создании товара не растёт (находка 2).
6. **Категория товара необязательна.** `products.category_id` — `nullable=True` (миграция `:62`),
   в моке есть товар с `categoryId: null` (`mocks/products.ts:996`). Значит `productCount`
   считается по товарам с проставленной категорией, а товар без категории удалению не мешает.
7. **Одна кнопка Save — два независимых запроса, транзакции между ними нет.**
   `Promise.all([patchCategory, putCategoryFields])` (`useCategoryCard.ts:102-112`). При падении
   одного второй остаётся применённым, и `load()` после ошибки **не вызывается** (`:113` стоит до
   `catch`) — экран остаётся с несохранённым поверх частично сохранённого. **Осталось**: обязан ли
   сервер дать один транзакционный эндпоинт под эту кнопку — решение владельца
   ([`00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md), строка
   «categories · Транзакционность и идемпотентность» и сквозная строка о Save).
8. **Привязка поставщика к категории — это дефолт-список для товаров, а не цена.** `price` и
   `priceUomId` всегда `null`: форма привязки их не собирает (`CategoryCardPage.vue:225-231`),
   таблица не показывает (`:439-457`). `currency` — снимок валюты поставщика на момент привязки
   (`:231`), после смены валюты у поставщика не обновляется ничем.
9. **Один поставщик привязывается к категории не более одного раза.** Дедупликация сейчас только
   клиентская: `addLinkedSupplier` выходит, если id уже в списке (`useCategoryCard.ts:56`), селект
   прячет уже привязанных (`CategoryCardPage.vue:215-218`). На проводе уходит полный массив —
   проверка обязана быть серверной.
10. **Уникальности нет нигде: ни у имени категории, ни у имени поля.** Единственный
    `UniqueConstraint` модуля — `uq_product_field_value` на `(product_id, field_id)`
    (`models.py:210-214`).
11. **Idempotency-Key в домене не используется** (`grep -rn "Idempotency"
    frontend_vue/src/services/categoriesService.ts` — пусто), и по правилу
    [`00-conventions.md` §8](00-conventions.md) не требуется: повтор создания категории виден
    пользователю сразу и последствий вне системы не имеет.
12. **ORM-каскад `children` противоречит `RESTRICT` того же внешнего ключа — это пробел, а не
    деталь реализации.** `categories.parent_id` — `ondelete="RESTRICT"` (`models.py:29-33`,
    миграция `:32`), то есть удаление категории с потомками обязано быть отвергнуто; отношение
    `children` того же FK — `cascade="all, delete-orphan"` (`models.py:44-47`), то есть потомков
    полагается удалить. Одновременно верны они быть не могут: каскад ORM упрётся в `RESTRICT`
    базы. У `fields` такого противоречия нет — там ORM-каскад (`models.py:53-56`) совпадает с
    `ondelete="CASCADE"` схемы (миграция `:46`). Мок реализует версию `RESTRICT`
    (`CATEGORY_HAS_CHILDREN`, `mocks/categories.ts:1481`), но мок — вторая ступень старшинства и
    спор внутри бэкенда не решает. **Осталось**: какое из двух объявлений верно и, если верна
    схема, обязан ли `models.py` быть исправлен до первого слайса. Строки в
    [`00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md) на это пока нет:
    аудит вывел наблюдение (`plans/api/audit/categories.md:116`) со ссылкой «см. находку 8», но
    находка 8 баг-файла — про стирание переводов, а не про каскад. Заведено находкой 9 в
    [`contract-sync-categories-bugs.md`](../../plans/bugs/contract-sync-categories-bugs.md).

---

## Обязанности сервера

То, чего во фронтенде не видно и что в мок-режиме не проявляется никак. Ответ «нигде» — это не
пустая графа, а строка владельцу.

**Значения по умолчанию и их владелец.** Настройками арендатора в домене не владеет ничто. Во
фронте константами стоят: размер страницы `25` — дважды, в подписи клиента
(`categoriesService.ts:10`) и в `usePagination(25)` (`useCategories.ts:18`); перечень типов поля —
дважды, типом `CategoryFieldType` (`types/category.ts:4`) и массивом `FIELD_TYPES`
(`CategoryCardPage.vue:97-105`); тип нового поля `'text'` (`:119`, `:128`) и `required: false`
(`:116`). Новая категория рождается с нулями и пустыми массивами
(`mocks/categories.ts:1441-1445`); те же нули стоят `server_default="0"` в схеме
(`models.py:33-41`). **Осталось**: кто владеет перечнем типов поля — код или настройки арендатора
(справочника типов в `types/settings.ts` нет); строка «categories · Значения по умолчанию» в
[`00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md).

**События и уведомления — нигде.** `grep -n "notify" frontend_vue/src/services/mocks/categories.ts`
— пусто; ни один из семи триггеров `mocks/notifications.ts` категорий не касается
(`grep -rn "categor"` там — пусто). Ни создание, ни удаление, ни замена набора полей — операция,
меняющая карточку каждого товара категории и всего поддерева, — уведомления не рождают.
**Осталось** — строка «categories · События и уведомления» в
[`00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md).

**Запись в аудит-лог — нигде для самой категории.** `grep -n "auditLog"
frontend_vue/src/services/mocks/categories.ts` — пусто. Аудит в проекте есть и лежит на товаре
(`types/product.ts:108`) плюс отдельным доменом `audit-feed`. Изменение полей категории меняет
данные всех её товаров, но следа не оставляет ни в одном логе. **Осталось** — строка
«categories · Запись в аудит-лог» там же.

**Кастомные поля — это и есть предмет домена.** Определения живут в самой категории, а не в
библиотеке полей: собственные — `Category.fields`, унаследованные — `Category.inheritedFields`
(`types/category.ts:22-23`), запись — `PUT /api/categories/:id/fields`. Библиотека
`/api/config/fields` (`mocks/config.ts:11`) к категориям отношения не имеет: её `f-categories`
(`:42`) — поле карточки поставщика. Значения по определениям хранит товар: `ProductFieldValue` с
`fieldId`, `fieldName`, `fieldType`, `inherited` (`mocks/products.ts:14046-14060`; в моке 761
привязка `fieldId: 'f-*'`). Валидирует значения по определению — **никто**: ни `required`, ни
`type` при записи товара не проверяются. **Осталось** — строка «categories · Кастомные поля» и
сквозная строка о валидации значений в
[`00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md).

**Настройки, которых мок не отслеживает** — три, каждая прямым наблюдением:

1. **локали**: `TranslatedString` жёстко трёхъязычна (`types/i18n.ts:6-10`), список языков
   арендатора на неё не влияет; сортировка списка всегда по `name.en`
   (`mocks/categories.ts:1364`, `:1403`) независимо от локали пользователя. Серверная модель шире
   и разрешает произвольные локали ([`00-conventions.md` §5](00-conventions.md)) — лишние ключи
   фронт молча отбросит;
2. **валюта связанного поставщика** хранится снимком на момент привязки
   (`types/product.ts:34`, `CategoryCardPage.vue:231`) и у настроек не переспрашивается; курса
   конвертации в проекте нет вовсе;
3. **справочник единиц** на экране категории не участвует: `priceUomId` и `price` у
   `LinkedSupplier` в карточке категории не заполняются и не показываются
   (`CategoryCardPage.vue:210-231`, `:439-457`).

**Мультиарендность.** Во фронте не выражена нигде — ни `tenantId`, ни заголовка арендатора в
`categoriesService.ts` (файл целиком, 72 строки). На сервере выражена схемой:
`Category.tenant_id` и `CategoryField.tenant_id` — `nullable=False, index=True`, FK на `tenants.id`
с `ondelete="CASCADE"` (`models.py:19-24`, `:64-69`; миграция `:30` для `categories` и **`:45`**
для `category_fields`). Вторая ссылка — поправка к аудиту домена: там в этой графе стоит `:44`,
а `25245d4bf874_phase_3_categories_products.py:44` — это колонка `id` таблицы `category_fields`,
`tenant_id` объявлен строкой ниже. Выборка обязана
ограничиваться арендатором сессии ([`00-conventions.md` §12](00-conventions.md)) — единственная
обязанность домена, у которой источник бэкенд.

**Права — нигде на уровне действия.** Доступ гейтится только фича-флагами: роуты
`products/categories` и `products/categories/:id` несут `meta.featureFlag: 'adminCategories'`
(`router/index.ts:232`, `:238`), страница дублирует его `v-if="showCategories"`
(`CategoriesPage.vue:26`, `:94`), секции карточки — `categoryFieldReorder`
(`CategoryCardPage.vue:165`) и `categorySupplierLinks` (`:29`). Все три объявлены `true`
(`config/featureFlags.ts:19,36,37`) и заведены на бэкенде как записи каталога фич, а не как права
(`8cf3bfa380dd_phase_12_plans_multi_role.py:66,107,110`). Матрица прав категорий не упоминает.
Флаг прячет UI, но эндпоинт не закрывает ([`00-conventions.md` §13](00-conventions.md)) — значит
права обязан проверять сервер, в той же функции, которая пишет. **Осталось**: какое право
требуется на создание, правку и удаление категории и одно ли оно с правом на товары — строка
«categories · Права» в [`00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md).

**Транзакционность и идемпотентность.** `Idempotency-Key` не используется (правило §11 выше).
Атомарности между двумя запросами одной кнопки Save нет (правило §7). Внутри `PUT /:id/fields` мок
атомарен — массив перезаписывается одной операцией (`mocks/categories.ts:1495-1509`), — но каскад
по потомкам идёт **после** записи (`:1512`) и не откатывается; на сервере обе части обязаны быть
одной транзакцией, иначе поддерево останется с полями предыдущей версии.

**Производные значения** — правило §5 выше: `level`, `parentName`, `fieldCount`, `productCount` и
`inheritedFields` сервер считает при чтении (или пересчитывает при записи), а не отдаёт из
колонки, которую некому обновлять.

---

## Чего в домене нет

Всё перечисленное описывалось в `roo_code/roo-context/03-api-contract.md` (раздел
«Admin — Categories (1.2)», строки 825–960) и **удалено при сверке** — с доказательством
отсутствия, а не молча.

| что описывал старый контракт | чем доказано, что этого нет |
|---|---|
| `DUPLICATE_FIELD_NAME` — 409, поле с таким именем уже есть в категории (`:837`) | `grep -rn "DUPLICATE_FIELD_NAME" frontend_vue/src backend` — пусто; уникальности имени поля не требует ни мок, ни схема (`models.py:59-90`) |
| `VALIDATION_ERROR` — 422 за отсутствующее `name` при создании (`:838`, `:885`) | `mockCreateCategory` не бросает вовсе (`mocks/categories.ts:1423-1449`); пустое имя отсекает клиент (`CategoriesPage.vue:72`), это закреплено e2e (`categories.spec.ts:183-186`) |
| `404 CATEGORY_NOT_FOUND` у `GET /api/categories/:id` (`:926`) — как описание работающего поведения | мок бросает **текст** `Category ${id} not found` (`mocks/categories.ts:1419`), и он же показывается пользователю (`useCategoryCard.ts:92`) — кода на этом пути нет ни одного (находка 4). Удалено утверждение, что так уже работает; само требование `404 CATEGORY_NOT_FOUND` сохранено в разделе `GET /api/categories/:id` как замысел прежнего контракта |
| `name`, `description`, `options` — строки (`:863`, `:879`, `:908-917`, `:934`) | `TranslatedString` и `TranslatedString[]` (`types/category.ts:8,12,17,19`), мок отдаёт объекты (`mocks/categories.ts:12`) |
| тело `PUT /:id/fields` — массив `CategoryField[]` (`:951`) | на проводе объект-обёртка `{ fields: [...] }` (`categoriesService.ts:65-71`), мок разбирает `const { fields } = body` (`mocks/index.ts:1173`) |
| «Last-write-wins» у `PATCH` (`:946`) | в коде не выражено ничем: ни `If-Match`, ни `version`, ни `updatedAt` в `Category` (`types/category.ts:15-25`). Это решение, а не наблюдение — принимать его контракт не вправе |
| `linkedSuppliers` без поля `currency` (`:921`) | поле есть в типе (`types/product.ts:34`) и заполняется снимком валюты поставщика (`CategoryCardPage.vue:231`) |
| «Удалённые поля сервер удаляет каскадом» (`:960`) | каскад невозможен без решения о значениях: `product_field_values.field_id` — `ondelete="RESTRICT"` (миграция `:78`); мок товаров вообще не трогает |
| `level` «вычисляется сервером» как единственная правда (`:871`) | схема хранит `level`, `field_count`, `product_count` колонками (`models.py:33-41`) — где считать, не решено; см. правило §5 |

Дополнительно: **отдельного справочного эндпоинта у домена нет** — ни `/api/categories/list`, ни
аналога `/api/products/list`. Прежний контракт его и не обещал; строка стоит здесь потому, что два
места фронта уже берут справочник страницей списка разными способами (см. `GET /api/categories`).

---

## Что осталось нерешённым

Девять мест, каждое отмечено в тексте выше словом **осталось**. Первые восемь стоят строками в
[`00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md) (раздел
«categories — аудит 2026-09-04», строки 50–57); девятое строки там пока не имеет — это сказано
прямо, чтобы пробел не выглядел вынесенным:

1. уведомления при создании, удалении и замене набора полей — `GET`/`PUT`, графа «События»;
2. след в аудит-логе у операций категории — графа «Запись в аудит-лог»;
3. какое право требуется на запись и одно ли оно с правом на товары — графа «Права»;
4. кто владеет перечнем типов поля — графа «Значения по умолчанию»;
5. что делать со значениями удалённых определений и унаследованных полей при смене родителя —
   `PUT /api/categories/:id/fields`;
6. одна ли транзакция у `PATCH` и `PUT /fields` под общей кнопкой Save — правило §7;
7. каким кодом отвергать цикл в дереве и удаление категории с заполненными полями —
   `PATCH /api/categories/:id`, `DELETE /api/categories/:id`;
8. чем отдавать полный справочник категорий — `GET /api/categories`.
9. **строки в `00-решения-владельца.md` пока нет:** какое из двух объявлений удаления потомков
   верно — `ondelete="RESTRICT"` на `categories.parent_id` (`models.py:29-33`, миграция `:32`)
   или `cascade="all, delete-orphan"` на отношении `children` (`models.py:44-47`) — и обязан ли
   `models.py` быть исправлен до первого слайса. Правило §12 и раздел
   `DELETE /api/categories/:id`; наблюдение — находка 9 в
   [`contract-sync-categories-bugs.md`](../../plans/bugs/contract-sync-categories-bugs.md).

До решения владельца сервер не обязан ничем из перечисленного: догадка здесь опаснее пробела.
Пункт 9 — единственный, где противоречат друг другу два **бэкендовских** артефакта; порядок
старшинства такой спор не разрешает, поэтому он и остаётся пробелом, а не снимается в пользу
одной из сторон.
