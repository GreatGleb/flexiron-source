# Config

Конфигуратор карточки поставщика: библиотека полей, секции карточки и матрица прав на секции и
поля. Двенадцать эндпоинтов, все двенадцать зовёт фронтенд, ни одного не реализует бэкенд.

Потребитель ровно один — страница
[`views/admin/suppliers/SupplierCardConfigPage.vue`](../../../frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue)
через композабл
[`composables/useCardConfig.ts`](../../../frontend_vue/src/composables/useCardConfig.ts); клиентский
слой — [`services/configService.ts`](../../../frontend_vue/src/services/configService.ts), типы —
[`types/config.ts`](../../../frontend_vue/src/types/config.ts), мок —
[`services/mocks/config.ts`](../../../frontend_vue/src/services/mocks/config.ts).

Общие правила — конверт ответа, `PATCH` против `PUT`, мультиарендность, `TranslatedString`,
clean-slate Save, форма идентификатора, права как сквозная обязанность — живут в
[`00-conventions.md`](00-conventions.md) (§1, §3, §4, §6, §8, §12, §15, §19) и здесь **не
повторяются**: второй экземпляр правила расходится с первым.

Аудит по коду, из которого собран этот файл: [`plans/api/audit/config.md`](../../plans/api/audit/config.md).
Находки про код — четырнадцать, код не тронут:
[`contract-sync-config-bugs.md`](../../plans/bugs/contract-sync-config-bugs.md).
Строки, оставленные владельцу — четырнадцать: раздел `config` в
[`00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md).

---

## Источник истины: мок и клиент — но схема хранения уже зафиксирована

**Модуля `config` в бэкенде нет.** `ls backend/app/modules/` даёт десять модулей — `auth`, `bcc`,
`billing`, `finance`, `notifications`, `products`, `services`, `settings`, `suppliers`,
`warehouse`, — и `config` среди них не значится; в
[`backend/app/main.py:66-74`](../../../backend/app/main.py) зарегистрированы девять роутеров, ни
одного config-овского. Поэтому по §5 старшинства (скил [`api-contract.md`](../../skills/api-contract.md))
источник истины у всех двенадцати разделов — **мок и клиент**, и у каждого раздела ниже стоит
строка `Бэкенд: **не реализован**`.

**Но таблицы и модели домена существуют, и лежат они в двух чужих модулях.**
`field_definitions`, `section_configs`, `section_fields` — в `suppliers`
([`suppliers/shared/models.py:240`](../../../backend/app/modules/suppliers/shared/models.py), `:269`,
`:294`); `permission_items`, `role_permissions`, `user_permissions` — в `auth`
([`auth/shared/models.py:145`](../../../backend/app/modules/auth/shared/models.py), `:169`, `:202`).
Все шесть заведены одной миграцией
[`e24a3922ed01_phase_7_config.py:27-109`](../../../backend/alembic/versions/e24a3922ed01_phase_7_config.py).

Схема — не источник истины (реализации эндпоинта нет ни одной), но и не пустое место: форма
ответа обязана считаться с ней, а расхождения перечислены разделом «Правила домена» ниже. Их шесть,
и четыре из шести — вопросы владельцу, а не решения контракта.

**Домен сегодня пишет в пустоту, и это часть контракта, а не оговорка.** Конфигурацию не читает
никто, кроме самого конфигуратора: `grep -rn "useCardConfig" frontend_vue/src` даёт объявление
(`composables/useCardConfig.ts:15`) и два импорта на странице-редакторе
(`SupplierCardConfigPage.vue:10`, `:43`) — и всё. Настоящая карточка поставщика рисует пять жёстко
зашитых панелей с заголовками `sp.status_title`, `sp.requisites`, `sp.contact`, `sp.procurement`,
`sp.notes_title`
([`components/admin/SupplierFormSections.vue:127`](../../../frontend_vue/src/components/admin/SupplierFormSections.vue),
`:169`, `:201`, `:238`, `:315`), которые по составу не совпадают с пятью секциями конфигуратора
(`General Info`, `Contacts`, `Location`, `Logistics`, `Notes & Docs` — `mocks/config.ts:117`,
`:131`, `:143`, `:155`, `:167`). Флаги `visible` секции и поля (`types/config.ts:22-23`, `:32`) не
влияют ни на что. Сервер обязан хранить и отдавать конфигурацию правильно **до** того, как
появится её читатель: иначе к моменту появления читателя окажется, что хранили не то.

### Двенадцать эндпоинтов одним взглядом

| метод и путь | что делает | режим |
|---|---|---|
| `GET /api/config/fields` | библиотека определений полей целиком | чтение при монтировании |
| `PUT /api/config/fields` | полная замена библиотеки | clean-slate, Save |
| `POST /api/config/fields` | создать определение | вызывающего нет |
| `PATCH /api/config/fields/:id` | правка одного определения | вызывающего нет |
| `DELETE /api/config/fields/:id` | удалить определение | вызывающего нет |
| `GET /api/config/sections` | секции карточки целиком | чтение при монтировании |
| `PUT /api/config/sections` | полная замена секций | clean-slate, Save |
| `POST /api/config/sections` | создать секцию | вызывающего нет |
| `PATCH /api/config/sections/:id` | правка одной секции | вызывающего нет |
| `DELETE /api/config/sections/:id` | удалить секцию | вызывающего нет |
| `GET /api/config/permissions` | матрица прав целиком | чтение при монтировании |
| `PUT /api/config/permissions` | полная замена матрицы | clean-slate, Save |

Шесть из двенадцати вызывающего не имеют — реестр «Клиент написан, UI нет» в конце файла. Работает
домен тремя `PUT`-ами по одной кнопке Save (`useCardConfig.ts:51-55`), и это ядро контракта:
единичные `POST`/`PATCH`/`DELETE` — задел, а не рабочий путь.

**`:id` в двух путях — непрозрачный идентификатор сущности, а не перечислимое значение**
(§19 соглашений). В моке это `f-company`/`f-custom-<Date.now()>` (`mocks/config.ts:13`, `:274`) и
`sec-general`/`sec-new-<Date.now()>` (`:116`, `:312`), на схеме — `gen_random_uuid()`
(`e24a3922ed01_phase_7_config.py:29`, `:45`). Раздел на путь один, значения в заголовки не
разворачиваются.

---

## Библиотека определений полей

### GET /api/config/fields

Библиотека определений полей — глобальная на арендатора, без пагинации, фильтра и поиска: поиск по
библиотеке идёт целиком на клиенте (`SupplierCardConfigPage.vue:48-52`). Читается один раз при
монтировании, первым в `Promise.all` вместе с `/sections` и `/permissions`
(`useCardConfig.ts:30-34`, `SupplierCardConfigPage.vue:497`). Повторного чтения после Save **нет**:
`saveConfig` не зовёт `load()` (`useCardConfig.ts:45-61`), клиент верит своему локальному состоянию.

Запрос: параметров нет — `apiGet<FieldDefinition[]>('/api/config/fields')` без второго аргумента
(`configService.ts:7`).

Ответ: `FieldDefinition[]` (`types/config.ts:5-14`).

```ts
interface FieldDefinition {
  id: string
  name: TranslatedString           // types/config.ts:7 — три обязательных ключа ru/en/lt
  type: FieldType                  // 'enum' | 'number' | 'text' | 'date' | 'boolean' | 'tags'
  required: boolean
  usageCount: number
  hidden?: boolean                 // types/config.ts:11-12 — скрыть поле на уровне библиотеки
  options?: TranslatedString[]     // types/config.ts:13 — варианты переводимы, не строки
}
```

Три поля, которых прежний контракт не описывал и которые сервер обязан отдавать: `hidden`,
трёхъязычные `options` и трёхъязычное `name`. Мок отдаёт клон стора из **двенадцати** записей
(`mocks/config.ts:234-238`, стор `:11-112`); `options` заполнены у двух — `f-status`
(`mocks/config.ts:25-32`, шесть вариантов) и `f-country` (`:68-75`, шесть вариантов);
`hidden` не выставлен ни у одной.

Ошибки: **ни одной** — см. «Каталог кодов ошибок» ниже.

Бэкенд: **не реализован** — модуля нет; таблица под ответ есть, `field_definitions`
(`backend/app/modules/suppliers/shared/models.py:240-266`), и расходится с этой формой по четырём
пунктам (правила 1 и 2 ниже).
Реализация: `services/configService.ts:7` (`getFieldLibrary`) · мок `mocks/index.ts:411` →
`mocks/config.ts:234`

### PUT /api/config/fields

**Полная замена библиотеки целиком** — ядро домена и первый из трёх запросов кнопки Save. Тело —
плоский массив, не объект-обёртка; сервер перезаписывает набор без слияния (§3 соглашений).
Save-режим: clean-slate. Именно этот эндпоинт несёт **все** локальные правки библиотеки: создание
поля (`SupplierCardConfigPage.vue:309-325`, `:403-424`), удаление (`:350-361`), скрытие
(`useCardConfig.ts:95-98`).

Запрос: `FieldDefinition[]` — ровно `fieldLibrary.value` (`configService.ts:11-13`,
`useCardConfig.ts:52`). Ключей вне типа клиент не добавляет: массив наполняется либо ответом
`GET` (`useCardConfig.ts:35`), либо объектами, собранными страницей по тому же типу
(`SupplierCardConfigPage.vue:315-321`, `:411-417`).

Ответ: пустой — `Promise<void>` (`configService.ts:11`), на проводе `ApiResponse<null>`. Клиент
ответ не читает и `load()` после Save не делает (`useCardConfig.ts:45-61`), поэтому **любое
значение, которое сервер выставил сам** (настоящий `id` вместо `f-custom-<ts>`, пересчитанный
`usageCount`), до экрана не доедет до следующей перезагрузки страницы.

Ошибки: **ни одной**.

Бэкенд: **не реализован**.
Реализация: `services/configService.ts:12` (`saveFieldLibrary`) · мок `mocks/index.ts:1162` →
`mocks/config.ts:240-248`

### POST /api/config/fields

Создать одно определение поля. **Вызывающего нет** — `grep -rn "\bcreateField\b" frontend_vue/src`
находит объявление (`configService.ts:15`) и одноимённую **локальную** функцию страницы
(`SupplierCardConfigPage.vue:309`), которая на сервер не ходит: она пушит объект в
`fieldLibrary.value` (`:315-321`) и полагается на батч. Режим объявлен комментарием там же:
«Clean-slate: создание/удаление НЕ уходит на сервер… применяются батчем при клике Save»
(`:307-308`). Реестр «Клиент написан, UI нет» ниже.

Запрос: `{ name: TranslatedString; type: FieldType }`. Клиент принимает имя строкой и заворачивает
его в переводы **текущей локали** перед отправкой — `toTranslatedString(payload.name, locale)`
(`configService.ts:16-25`, помощник `types/i18n.ts:19-25`): две другие локали получают пустую
строку. `required` и `options` клиент **не шлёт вовсе** (`configService.ts:16-19`), хотя оба
объявлены в типе (`types/config.ts:9`, `:13`).

`Idempotency-Key` не шлётся: `grep -c "Idempotency" frontend_vue/src/services/configService.ts` → `0`,
и ветка мока идёт мимо `withIdempotency` (`mocks/index.ts:943-945`, в отличие от `:912`, `:919`,
`:1036`). По §11 соглашений это законно — `POST` необратимым не является, повтор даёт лишнюю
строку библиотеки, а не лишнюю отгрузку.

Ответ: `FieldDefinition` целиком (`configService.ts:21`). Мок собирает его сам
(`mocks/config.ts:269-282`): `id: f-custom-${Date.now()}` (`:274`), `required: false` (`:277`),
`usageCount: 0` (`:278`), `hidden` и `options` не выставляются, — то есть присланные клиентом
`required`/`options` были бы проигнорированы. **`id` выдаёт сервер**, клиент его не шлёт
(`configService.ts:22-25`).

Ошибки: **ни одной** в коде. Уникальность имени внутри арендатора — единственное правило раздела,
подтверждённое схемой: `UniqueConstraint("tenant_id", "name", name="uq_field_definitions_tenant_name")`
(`backend/app/modules/suppliers/shared/models.py:264-266`, миграция
`e24a3922ed01_phase_7_config.py:40`). Кода под этот отказ в проекте нет — строка владельцу.

Бэкенд: **не реализован**.
Реализация: `services/configService.ts:22` (`createField`) · мок `mocks/index.ts:943` →
`mocks/config.ts:269`

### PATCH /api/config/fields/:id

Правка одного определения: тело — дельта, ответ — определение целиком после слияния (§3
соглашений). **Вызывающего нет** — `grep -rn "\bpatchField\b" frontend_vue/src` даёт только
объявление (`configService.ts:28`).

Запрос: `Partial<FieldDefinition>` merge-patch (`configService.ts:30`, `:37`). Клиент перед
отправкой пытается завернуть имя — `if (patch.name && typeof patch.name === 'string')`
(`configService.ts:34-36`), — но **ветка мертва**: `FieldDefinition['name']` объявлен как
`TranslatedString` (`types/config.ts:7`), строкой он не бывает. Третий аргумент `locale`
(`configService.ts:31`) поэтому не используется никогда (БАГ-03).

Ответ: `FieldDefinition` целиком после merge (`configService.ts:32`). Мок сливает переводы имени
через `mergeTranslatedString` (`mocks/config.ts:291-293`, помощник `types/i18n.ts:36-46`), а затем
`Object.assign` (`:294`) — то есть **`type` меняется наравне с остальным**, вопреки обещанию
прежнего контракта.

**Сервер обязан сливать имя, а не заменять его.** `mergeTranslatedString` перезаписывает только
определённые ключи (§12 соглашений); замена целиком стёрла бы переводы двух других локалей.

Ошибки: **ни одной**. Несуществующий `id` мок возвращает как `null` (`mocks/config.ts:289`) при
подписи `Promise<FieldDefinition>` — БАГ-08. Каким кодом сервер обязан отвечать на неизвестный
`id`, на дубль имени и на правку встроенного поля — строка владельцу.

Бэкенд: **не реализован**.
Реализация: `services/configService.ts:37` (`patchField`) · мок `mocks/index.ts:1229` →
`mocks/config.ts:284`

### DELETE /api/config/fields/:id

Удалить определение из библиотеки. **Вызывающего нет** — `grep -rn "\bdeleteField\b" frontend_vue/src`
даёт объявление (`configService.ts:40`) и одноимённые **локальные** функции чужого домена
(`composables/useCategoryCard.ts:142`). UI удаляет поле локально: `confirmDeleteField` правит
`fieldLibrary` и `sections` в памяти (`SupplierCardConfigPage.vue:350-361`), а на сервер уходит
`PUT /api/config/fields` из батча (`useCardConfig.ts:52`).

Запрос: тела нет, ни query, ни заголовков (`configService.ts:41`, `services/api.ts:211-221`).

Ответ: пустой — `Promise<void>` (`configService.ts:40`), на проводе `ApiResponse<null>`.

**Удаление определения каскадом снимает его со всех секций — и мок, и схема согласны.** Мок
фильтрует `sec.fields` во всех секциях (`mocks/config.ts:301-303`), схема даёт то же через
`section_fields.field_id` с `ondelete="CASCADE"`
(`backend/app/modules/suppliers/shared/models.py:311-315`, миграция
`e24a3922ed01_phase_7_config.py:61`). Это единственное место домена, где две стороны совпали, — и
контракт его закрепляет.

**А строку в `permission_items` не снимает никто.** Связи с `field_definitions` у неё нет:
`item_id` — просто `String(100)` (`backend/app/modules/auth/shared/models.py:156`, миграция `:72`),
и `role_permissions.item_id` / `user_permissions.item_id` ссылаются на ту же строку
(`auth/shared/models.py:180`, `:213`). Осиротевшие права — состояние, которое схема допускает;
что с ними делать, не сказано нигде (строка владельцу).

Ошибки: **ни одной**. Мок удаляет любое поле, включая встроенное (`mocks/config.ts:298-304`) —
БАГ-10; признак встроенности на схеме есть и он **другой**, чем во фронте (правило 2 ниже).

Бэкенд: **не реализован**.
Реализация: `services/configService.ts:41` (`deleteField`) · мок `mocks/index.ts:1476` →
`mocks/config.ts:298`

---

## Секции карточки

### GET /api/config/sections

Секции карточки поставщика с составом полей. Без параметров, без пагинации. Читается вторым в
`Promise.all` при монтировании (`useCardConfig.ts:32`).

Запрос: параметров нет — `apiGet<SectionConfig[]>('/api/config/sections')` (`configService.ts:46`).

Ответ: `SectionConfig[]` (`types/config.ts:16-27`).

```ts
interface SectionConfig {
  id: string
  name: TranslatedString
  order: number
  collapsed: boolean               // types/config.ts:20-21 — «UI-only» значит «не влияет
                                   //   на карточку», но хранится и уезжает на сервер
  visible: boolean
  system?: boolean                 // types/config.ts:24-25 — системную секцию нельзя удалить
  fields: SectionField[]
}

interface SectionField { fieldId: string; order: number; visible: boolean }   // types/config.ts:29-33
```

**Порядок массива и поле `order` — две разные вещи, и сортировки нет ни в одной.** `mockGetSections`
возвращает массив как лежит (`mocks/config.ts:250-252`), `mockSaveSections` кладёт присланный как
есть (`:254-259`); совпадение держится только тем, что клиент перенумеровывает `order` по индексу
при перетаскивании (`useCardConfig.ts:71`). **Сервер обязан отдавать секции упорядоченными по
`sort_order`** — колонка под это на схеме есть
(`backend/app/modules/suppliers/shared/models.py:281`), и клиент, читающий массив по порядку
(`SupplierCardConfigPage.vue:48-52` и вёрстка списка), другого способа получить порядок не имеет.

Мок отдаёт клон пяти секций (`mocks/config.ts:250-252`, стор `:114-177`); у всех пяти
`system: true` (`:121`, `:135`, `:147`, `:159`, `:171`), одно поле скрыто — `f-certified` с
`visible: false` (`:174`).

Ошибки: **ни одной**.

Бэкенд: **не реализован** — таблица `section_configs`
(`backend/app/modules/suppliers/shared/models.py:269-291`) здесь **ближе** к фронту, чем у полей:
имя переводимо (`name_translations` JSONB, `:280`), есть `collapsed` и `visible` (`:282-287`).
Расходятся имя порядка (`sort_order` против `order`, `:281`) и отсутствует `system` — колонки под
него нет (`grep -c '"system"' backend/alembic/versions/e24a3922ed01_phase_7_config.py` → `0`).
Реализация: `services/configService.ts:46` (`getSections`) · мок `mocks/index.ts:412` →
`mocks/config.ts:250`

### PUT /api/config/sections

**Полная замена массива секций целиком.** `PUT`, а не `PATCH`, выбран по причине, которую код
подтверждает: drag-drop переставляет `order` у всех секций одновременно (`useCardConfig.ts:63-72`,
`SupplierCardConfigPage.vue:481-495`), и десятки параллельных `PATCH`-ей дали бы partial-write.
Save-режим: clean-slate, первый из трёх `PUT`-ов батча (`useCardConfig.ts:53`).

Несёт **все** локальные правки секций: перетаскивание с перенумерацией `order`
(`useCardConfig.ts:63-72`), сворачивание (`:74-77`), скрытие секции (`:79-82`) и поля (`:89-93`),
переименование (`:84-87`), создание (`SupplierCardConfigPage.vue:451-472`), удаление (`:334-341`),
добавление и снятие поля с секции (`:403-424`, `:433-440`).

Запрос: `SectionConfig[]` — весь массив (`configService.ts:50-51`). Внутрь входят два поля, о
которых прежний контракт молчал: `collapsed`, помеченный в типе как UI-only флаг билдера
(`types/config.ts:20-21`), и `system` — то есть **клиент присылает признак «эту секцию удалять
нельзя» вместе с данными, и сервер обязан его игнорировать в пользу собственного значения**;
иначе запрет снимается тем самым запросом, который он должен ограничивать.

Ответ: пустой — `Promise<void>` (`configService.ts:50`). Клиент верит локальному состоянию.

Ошибки: **ни одной**.

Бэкенд: **не реализован**.
Реализация: `services/configService.ts:51` (`saveSections`) · мок `mocks/index.ts:1158` →
`mocks/config.ts:254`

### POST /api/config/sections

Создать секцию. **Вызывающего нет** — `grep -rn "\bcreateSection\b" frontend_vue/src` даёт только
объявление (`configService.ts:54`). UI создаёт секцию локально
(`SupplierCardConfigPage.vue:451-472`), сам придумывая `id: sec-new-${Date.now()}` (`:458`) и явный
`system: false` (`:463`), и уносит её батчем `PUT /api/config/sections` (`useCardConfig.ts:53`).
Комментарий над функцией страницы обещает `POST` — «open modal → POST → scroll to it» (`:442`), —
которого в теле нет (БАГ-14).

Запрос: `{ name: string }` — **строкой, без перевода** (`configService.ts:54-55`), в отличие от
парного `createField`, который заворачивает имя в `TranslatedString` (`:22-25`). Мок компенсирует
это, размножая строку на все три локали (`mocks/config.ts:307-310`), то есть новая секция получает
один и тот же текст в `ru`, `en` и `lt` — БАГ-04.

**Для сервера форма запроса — расхождение, а не выбор.** Три пути «назвать сущность» дают три
разных результата: `createSection` — одна строка на три локали; `createField` —
`toTranslatedString`, две локали пустые; локальный путь страницы — `toTranslatedString` для обоих
(`SupplierCardConfigPage.vue:317`, `:413`, `:459`). Какая из трёх верна, контракт не назначает
(строка владельцу); что обязан сделать сервер при **любой** из них — сохранить присланное как
`name_translations` и не додумывать переводы.

`Idempotency-Key` не шлётся; ветка мока идёт мимо `withIdempotency` (`mocks/index.ts:946-948`).

Ответ: `SectionConfig` целиком (`configService.ts:54`). Мок собирает:
`id: sec-new-${Date.now()}` (`mocks/config.ts:312`), `order: MOCK_SECTIONS.length` (`:314`),
`collapsed: false` (`:315`), `visible: true` (`:316`), `fields: []` (`:317`). Поле `system` **не
выставляется вовсе** — приходит `undefined`, и UI трактует это как «удалять можно»
(`SupplierCardConfigPage.vue:334-341`; e2e проверяет ровно это —
`tests/e2e/admin/suppliers/supplier-card-config.spec.ts:331-349`). Сервер обязан отдавать
`system: false` явно: `undefined` и `false` здесь означают одно и то же только по случайности.

**Кто выдаёт `order` новой секции — сервер.** Мок ставит `MOCK_SECTIONS.length` (`:314`), схема
объявляет `sort_order` как `nullable=False` без дефолта
(`backend/app/modules/suppliers/shared/models.py:281`), то есть значение обязано родиться на
сервере, а не приехать пустым.

Ошибки: **ни одной**. Уникальности имени секции нет ни в моке, ни на схеме — в отличие от полей
(миграция `e24a3922ed01_phase_7_config.py:43-53` — ни одного `UniqueConstraint`).

Бэкенд: **не реализован**.
Реализация: `services/configService.ts:55` (`createSection`) · мок `mocks/index.ts:946` →
`mocks/config.ts:306`

### PATCH /api/config/sections/:id

Правка одной секции: тело — дельта, ответ — секция целиком после слияния. **Вызывающего нет** —
`grep -rn "\bpatchSection\b" frontend_vue/src` даёт только объявление (`configService.ts:58`).
Переименование секции в UI идёт локально: `confirmEditSection` → `renameSection` правит
`sections.value` через `mergeLocaleValue` (`SupplierCardConfigPage.vue:380-389`,
`useCardConfig.ts:84-87`), а на сервер уходит батчем `PUT /api/config/sections`
(`useCardConfig.ts:53`).

Запрос: `Partial<SectionConfig>` merge-patch (`configService.ts:60`, `:67`). Та же мёртвая ветка
перевода имени, что у полей: `typeof patch.name === 'string'` при типе `TranslatedString`
(`configService.ts:64-66` против `types/config.ts:18`) — БАГ-03.

Ответ: `SectionConfig` целиком после merge (`configService.ts:62`). Мок сливает имя через
`mergeTranslatedString` (`mocks/config.ts:327-329`) и делает `Object.assign` (`:330`) — то есть
**принимает и `fields`**, вопреки обещанию прежнего контракта их не принимать.

Ошибки: **ни одной**. Несуществующий `id` мок возвращает как `null` (`mocks/config.ts:325`) при
подписи `Promise<SectionConfig>` — БАГ-08.

Бэкенд: **не реализован**.
Реализация: `services/configService.ts:67` (`patchSection`) · мок `mocks/index.ts:1220` →
`mocks/config.ts:323`

### DELETE /api/config/sections/:id

Удалить секцию. **Вызывающего нет** — `grep -rn "\bdeleteSection\b" frontend_vue/src` даёт только
объявление (`configService.ts:70`). UI удаляет секцию из массива в памяти
(`SupplierCardConfigPage.vue:334-341`), результат уходит батчем `PUT /api/config/sections`
(`useCardConfig.ts:53`).

Запрос: тела нет, ни query, ни заголовков (`configService.ts:71`, `services/api.ts:211-221`).

Ответ: пустой — `Promise<void>` (`configService.ts:70`).

**Судьба полей внутри удаляемой секции: снимаются ссылки, определения остаются.** Схема отвечает на
это однозначно — `section_fields.section_id` с `ondelete="CASCADE"`
(`backend/app/modules/suppliers/shared/models.py:305-310`, миграция
`e24a3922ed01_phase_7_config.py:60`) плюс ORM-каскад `cascade="all, delete-orphan"` (`:289-291`);
`field_definitions` при этом не трогаются, потому что каскад идёт от секции к связке, а не к
определению. Мок этого не делает вовсе: `mockDeleteSection` вынимает секцию из массива и всё
(`mocks/config.ts:334-337`) — связка у него живёт внутри самой секции, поэтому расхождения нет.

**Судьба строк матрицы прав: не удаляются ничем** — та же причина, что у поля
(`auth/shared/models.py:156`, миграция `:72`).

Ошибки: **ни одной**. Системную секцию мок удаляет так же охотно, как любую: поля `system` он не
смотрит вовсе (`mocks/config.ts:334-337`), запрет живёт только в вёрстке — кнопка удаления
системной секции задизейблена (e2e
`tests/e2e/admin/suppliers/supplier-card-config.spec.ts:260-266`). БАГ-10; каким кодом сервер
обязан отвергнуть удаление системной секции — строка владельцу.

Бэкенд: **не реализован**.
Реализация: `services/configService.ts:71` (`deleteSection`) · мок `mocks/index.ts:1482` →
`mocks/config.ts:334`

---

## Матрица прав

### GET /api/config/permissions

Матрица прав на секции и поля карточки поставщика — один объект, без параметров. Читается третьим в
`Promise.all` при монтировании (`useCardConfig.ts:33`).

Запрос: параметров нет — `apiGet<PermissionMatrix>('/api/config/permissions')`
(`configService.ts:76`).

Ответ: `PermissionMatrix` (`types/config.ts:37-57`).

```ts
type PermissionAction = 'read' | 'edit' | 'create' | 'delete'          // types/config.ts:35

interface PermissionMatrix {
  roles: string[]                                                       // types/config.ts:38
  users: Record<string, string[]>                                       // роль → список EMAIL, :39-40
  rolePermissions: Record<itemId, Record<role, Record<PermissionAction, boolean>>>   // :45
  userPermissions: Record<itemId, Record<role, Record<userEmail, Partial<Record<PermissionAction, boolean>>>>>
                                                                        // :46-54 — ЧАСТИЧНЫЙ
  items: PermissionItem[]                                               // :55-56, «в порядке рендера»
}

interface PermissionItem {                                              // types/config.ts:59-65
  itemId: string
  name: TranslatedString
  type: 'section' | 'field'
  parentId?: string                                                     // у поля — id его секции
}
```

Четыре вещи, которые сервер обязан знать про эту форму:

- **`users` — это email, а не идентификаторы** (`types/config.ts:39-40`, сид
  `mocks/config.ts:179-184`), и `userPermissions` ключуется тем же email
  (`types/config.ts:51-54`, чтение `SupplierCardConfigPage.vue:166`, запись `:233-237`). На схеме
  адресация другая — UUID-FK (правило 3 ниже).
- **`userPermissions` частичен намеренно.** Отсутствующее действие означает «наследуй у роли»:
  `getUserPerm` возвращает роль, когда сохранённого значения нет
  (`SupplierCardConfigPage.vue:160-169`), а сброс переопределения — это **удаление ключа**
  (`:190-192`). Прислать `false` вместо отсутствия — не то же самое.
- **`items` — секции и их поля в порядке рендера** (`types/config.ts:55-56`). Мок собирает список
  обходом секций с подстановкой имени из библиотеки (`mocks/config.ts:191-203`): пять секций плюс
  двенадцать их полей = **семнадцать** элементов. Замер:
  `awk 'NR>=114 && NR<=177' src/services/mocks/config.ts | grep -cP "^    id: 'sec-"` → `5`, и
  `... | grep -oP "fieldId: '\K[^']+" | wc -l` → `12`. (Аудит в этом месте называет 11 полей и 16
  элементов — цифра поправлена по коду.)
- **Роли — четыре, и они константа мока**: `PERMISSION_ROLES` (`mocks/config.ts:186`), он же
  уезжает клиенту полем `roles` (`:224`). На сервере роли живут строками в `user_roles.role_name`
  (`backend/app/modules/auth/shared/models.py:98`) плюс устаревшее `users.role` с пометкой
  «DEPRECATED — kept as fallback until frontend migrates to multi-role» (`:60-61`). Какой источник
  главный — строка владельцу.

Дефолт прав нового элемента у мока — Admin всё `true`, остальные роли всё `false`
(`mocks/config.ts:210-218`). **На схеме дефолт другой**: `can_read` объявлен `server_default="true"`
для всех (`backend/app/modules/auth/shared/models.py:182-184`, миграция
`e24a3922ed01_phase_7_config.py:86`). Контракт этого не решает — строка владельцу.

Ошибки: **ни одной**.

Бэкенд: **не реализован** — таблицы `permission_items`, `role_permissions`, `user_permissions`
существуют (`backend/app/modules/auth/shared/models.py:145-236`) и не читаются ни одним `select()`;
функция, которая должна применять матрицу, — заглушка `return True`
(`backend/app/modules/auth/internal_api/interface.py:27-38`).
Реализация: `services/configService.ts:76` (`getPermissions`) · мок `mocks/index.ts:413` →
`mocks/config.ts:261`

### PUT /api/config/permissions

**Полная замена матрицы целиком.** `PUT`, а не `PATCH`, — потому что каскад правил меняет десятки
ячеек одновременно (пять правил ниже), и атомарная замена безопаснее параллельных `PATCH`-ей. Это
единственное утверждение прежнего контракта об этом эндпоинте, которое код подтверждает.
Save-режим: clean-slate, третий запрос того же `Promise.all` (`useCardConfig.ts:54`).

Запрос: `PermissionMatrix` целиком (`configService.ts:80-81`) — все пять полей, включая `items` и
`roles`, которые пользователь на странице не правит.

**`items`, `roles` и `users` сервер обязан считать производными и игнорировать в теле.** На сервере
`roles` выводятся из `user_roles.role_name` (`backend/app/modules/auth/shared/models.py:98`),
`users` — из таблицы `users` (`:42`), а порядок `items` — из `section_configs.sort_order` и
`section_fields.sort_order` (`backend/app/modules/suppliers/shared/models.py:281`, `:316`). Принять
их как данные значит позволить клиенту переписать состав ролей арендатора запросом о правах.
Оговорка: `permission_items` — таблица **хранимая**, со своим `name_translations`
(`auth/shared/models.py:157-159`), поэтому имя элемента у сервера дублирует
`section_configs.name_translations` (`suppliers/shared/models.py:280`) и может с ним разойтись;
какой из двух источник истины — строка владельцу.

**Сервер не проверяет согласованность матрицы.** Все правила каскада живут на клиенте
(`SupplierCardConfigPage.vue:196-299`), и это подтверждается кодом: `mockSavePermissions` не
валидирует ничего (`mocks/config.ts:265-267`). Но правило «сервер принимает что пришло» относится к
**каскаду**, а не к правам вызывающего: принять матрицу от того, кому не позволено её править, —
это не отсутствие валидации, а отсутствие авторизации, и её на сервере нет вовсе (см. «Обязанности
сервера», графа «Права»).

Ответ: пустой — `Promise<void>` (`configService.ts:80`).

Ошибки: **ни одной**.

Два наблюдения, без которых раздел неверно поймут:

- **Под моками этот запрос не сохраняет ничего.** `mockSavePermissions` — пустая функция с
  комментарием `// no-op in mock` (`mocks/config.ts:265-267`), тогда как парные
  `mockSaveFieldLibrary` (`:240-248`) и `mockSaveSections` (`:254-259`) пишут в стор. Перезагрузка
  страницы возвращает исходную матрицу (БАГ-06) — то есть демо **не доказывает**, что запись прав
  работает.
- **Save не шлёт ни одного из трёх запросов, если матрица не загрузилась.** `saveConfig` выходит на
  `if (!permissions.value) return` (`useCardConfig.ts:46`) — упавший `load()` тихо отключает всю
  кнопку Save, включая секции и библиотеку (БАГ-02).

Бэкенд: **не реализован**.
Реализация: `services/configService.ts:81` (`savePermissions`) · мок `mocks/index.ts:1166` →
`mocks/config.ts:265`

---

## Каталог кодов ошибок

**В домене нет ни одного кода ошибки, и это замер, а не пропуск:**
`grep -c "throw" frontend_vue/src/services/mocks/config.ts` → `0`. Ни одна из двенадцати ветвей
мока не отказывает: несуществующий `id` возвращается как `null` (`mocks/config.ts:289`, `:325`),
удаление отсутствующего — молчаливый no-op (`:299-300`, `:335-336`). Непойманный путь даёт общий
текст `[mock] DELETE ${path} not found` (`mocks/index.ts:1657`) — не код домена.

Отсюда следствие для бэкенда: **путей ошибки этого домена под моками не существует, и демо их
существования не доказывает** (§18 соглашений). Кодов, которые обещал прежний контракт, в проекте
нет ни одного — `grep -rn "IMMUTABLE" frontend_vue/src backend/app` пусто, `DUPLICATE` в домене
тоже нет. Четыре отказа, которых код не умеет, а схема или вёрстка требуют:

| отказ | чем требование доказано | код |
|---|---|---|
| дубль имени поля внутри арендатора | `uq_field_definitions_tenant_name` (`backend/app/modules/suppliers/shared/models.py:264-266`) | **нет** |
| удаление или правка встроенного поля | `is_builtin` (`:256-258`), кнопка задизейблена в вёрстке | **нет** |
| удаление системной секции | `SectionConfig.system` (`types/config.ts:24-25`), e2e `supplier-card-config.spec.ts:260-266` | **нет** |
| неизвестный `id` в `PATCH`/`DELETE` | подписи `Promise<FieldDefinition>` / `Promise<SectionConfig>` (`configService.ts:32`, `:62`) | **нет** |

Какими кодами сервер обязан отвечать — строка владельцу («Коды ошибок» в разделе `config`
[файла решений](../../plans/api/audit/00-решения-владельца.md)). Общие коды ядра
(`NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `FORBIDDEN`) перечислены в §2 соглашений; какой из них
подходит каждому из четырёх — решение, а не наблюдение, и контракт его не назначает.

---

## Обязанности сервера

Девять граф аудита. «Нигде» — не решение, а строка в
[`00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md).

**Значения по умолчанию и их владелец.** Настройками арендатора у домена не владеет **ничто**:
`grep -rn "settings\." frontend_vue/src/services/configService.ts frontend_vue/src/composables/useCardConfig.ts frontend_vue/src/services/mocks/config.ts`
пусто. Константами во фронте лежат: перечень типов поля — **дважды**, типом `FieldType`
(`types/config.ts:3`) и массивом `FIELD_TYPE_OPTIONS` (`SupplierCardConfigPage.vue:64-71`);
перечень действий — **трижды**, типом `PermissionAction` (`types/config.ts:35`), массивом
`PERMISSION_ACTIONS` (`SupplierCardConfigPage.vue:76`) и его копией в моке (`mocks/config.ts:187`);
подписи `R/E/C/D` (`SupplierCardConfigPage.vue:77-82`); тип нового поля по умолчанию `'text'`
(`:61`, `:396`, `:400`). Справочника типов поля в настройках нет, а на схеме это свободная строка
`field_type: String(50)` без `CHECK` (`backend/app/modules/suppliers/shared/models.py:252`) — то
есть перечень закрыт во фронте и открыт на сервере (§8 соглашений, тот же класс). Кто владеет
перечнем типов поля, перечнем ролей и дефолтом прав нового элемента — **нигде**, две строки
владельцу.

**События и уведомления: нигде.**
`grep -rn "notify" frontend_vue/src/services/mocks/config.ts frontend_vue/src/composables/useCardConfig.ts frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue`
пусто; ни один из семи эмиттеров (`mocks/notifications.ts:542`, `:566`, `:592`, `:616`, `:637`,
`:657`, `:684`) домена не касается —
`grep -cin "config\|section\|fieldDefinition" frontend_vue/src/services/mocks/notifications.ts` → `0`.
При этом `PUT /api/config/permissions` меняет права **всех** пользователей арендатора
(`configService.ts:81`), и не узнаёт об этом никто. Строка владельцу.

**Запись в аудит-лог: нигде.**
`grep -rn "auditLog" frontend_vue/src/services/mocks/config.ts frontend_vue/src/composables/useCardConfig.ts frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue`
пусто. Перечень сущностей ленты аудита замкнут девятью значениями, и `config` среди них нет:
`product|order|client|supplier|batch|stock|offcut|movement|deficit`
(`frontend_vue/src/types/audit.ts:5-14`, тот же список константой `:16-26`; §9 соглашений). То есть
смена матрицы прав — единственная операция проекта, меняющая доступ, — следа не оставляет нигде. Ни
одна из шести таблиц домена не имеет колонки автора: `created_at`/`updated_at` есть
(`backend/app/core/base.py:25-37`), `created_by` нет —
`grep -c "created_by" backend/alembic/versions/e24a3922ed01_phase_7_config.py` → `0`. Строка
владельцу.

**Кастомные поля: это и есть предмет домена — определения; хранилища значений не существует
нигде.** Определения: `FieldDefinition` (`types/config.ts:5-14`), CRUD `/api/config/fields`
(`configService.ts:6-42`), на схеме `field_definitions`
(`backend/app/modules/suppliers/shared/models.py:240-266`). У поставщика фиксированный набор колонок
без `fieldValues` (`frontend_vue/src/types/supplier.ts:12-31`), таблица `suppliers` — тоже
(`backend/app/modules/suppliers/shared/models.py:17-62`), и таблицы `supplier_field_values` не
существует. Пересечения с кастомными полями товара нет: `product_field_values.field_id` ссылается
на `category_fields`, а не на `field_definitions`
(`backend/app/modules/products/shared/models.py:203-207`). Отсюда `f-certified`
(`mocks/config.ts:105-111`) — определение поля, которому негде хранить значение
(`grep -c "certified" frontend_vue/src/types/supplier.ts backend/app/modules/suppliers/shared/models.py`
→ `0` и `0`). Где сервер хранит значения и что делать со значением при удалении определения —
**нигде**; строка владельцу расширяет засеянный пункт 2 файла решений случаем поставщика.

**Настройки, которых мок не отслеживает — четыре.** (1) Матрица прав не сохраняется вовсе:
`mockSavePermissions` — пустое тело, `// no-op in mock` (`mocks/config.ts:265-267`). (2) Состав
матрицы не пересобирается: `MOCK_PERMISSIONS` вычислен один раз при загрузке модуля (`:232`;
`grep -n "buildMockPermissions" frontend_vue/src/services/mocks/config.ts` → только `:189` и
`:232`), поэтому созданное поле или секция в `items` не появляются, а удалённые не исчезают
(БАГ-07). (3) Локали жёстко трёхъязычны: `TranslatedString` — ровно `{ ru, en, lt }`
(`frontend_vue/src/types/i18n.ts:6-10`), список языков арендатора на это не влияет. (4) `usageCount`
не пересчитывается ничем: в сторе статические числа (`mocks/config.ts:17`, `:24`, `:60`, `:67`,
`:103`, `:110`), новое поле получает `0` (`SupplierCardConfigPage.vue:320`) или `1` (`:416`)
вручную, а снятие поля с секции счётчик не трогает (`:433-440`) — БАГ-12.

**Мультиарендность — единственная обязанность домена, источник которой бэкенд.** Во фронте не
выражена нигде: `grep -c "tenant" frontend_vue/src/services/configService.ts` → `0`, ни поля, ни
заголовка. На схеме выражена у всех шести таблиц: `tenant_id` как `ForeignKey("tenants.id",
ondelete="CASCADE")`, `nullable=False`, `index=True` — `field_definitions`
(`backend/app/modules/suppliers/shared/models.py:245-250`), `section_configs` (`:274-279`),
`section_fields` (`:299-304`), `permission_items`
(`backend/app/modules/auth/shared/models.py:150-155`), `role_permissions` (`:174-179`),
`user_permissions` (`:207-212`); в миграции те же шесть
(`e24a3922ed01_phase_7_config.py:30`, `:46`, `:59`, `:71`, `:83`, `:99`). Все три уникальных индекса
домена начинаются с арендатора: `uq_field_definitions_tenant_name` (`:40`), `uq_role_permission` на
`(tenant_id, item_id, role)` (`:93`), `uq_user_permission` на `(tenant_id, item_id, user_id)`
(`:109`). **Выборка обязана ограничиваться `tenant_id` в каждом из двенадцати запросов**, и
арендатор берётся из токена (§4 соглашений).

**Права — ни в какой функции, и это домен, который правами и занимается.** На сервере
`check_permission` возвращает `True` безусловно, с комментарием «Placeholder — implement actual RBAC
logic here. Returns True for now (permissive default)»
(`backend/app/modules/auth/internal_api/interface.py:27-38`); модуль, который должен её применять, —
четыре строки докстринга без единой функции
(`backend/app/modules/auth/shared/dependencies.py`). Во фронте доступ гейтится **только
фича-флагами**: роут `suppliers/config` несёт `meta.featureFlag: 'supplierCardConfig'`
(`frontend_vue/src/router/index.ts:192-197`), редактор прав прячется флагом `permissionsEditor`
(`SupplierCardConfigPage.vue:21`); оба объявлены `true`
(`frontend_vue/src/config/featureFlags.ts:17`, `:35`). Флаг — это тариф, а не право (§6 и §7
соглашений), то есть авторизации у домена нет вообще. Сама матрица не применяется ни одним
потребителем вне редактора (правило 5 ниже). Строка владельцу.

**Транзакционность и идемпотентность.** `Idempotency-Key` домен не шлёт —
`grep -c "Idempotency" frontend_vue/src/services/configService.ts` → `0`, и обе `POST`-ветки мока
идут мимо `withIdempotency` (`mocks/index.ts:943`, `:946` против `:912`, `:919`, `:1036`), при том
что механизм в проекте есть (`frontend_vue/src/services/api.ts:239-245`). По §11 соглашений это
законно: необратимых операций у домена нет. По атомарности наблюдение прямое: Save шлёт **три
независимых запроса параллельно** одним `Promise.all([saveFieldLibrary, saveSections,
savePermissions])` (`useCardConfig.ts:51-55`) — общей транзакции нет, порядок не задан, и при
падении любого остальные остаются применёнными; `load()` после ошибки не вызывается (`:56-58`), а
тост «сохранено» показывается всё равно (`SupplierCardConfigPage.vue:474-477`, БАГ-01). Внутри
каждого `PUT` мок атомарен: массив перезаписывается целиком (`mocks/config.ts:246-247`, `:257-258`).
Повторное создание того же поля или секции даёт дубликат: `id` выдаётся `Date.now()`
(`mocks/config.ts:274`, `:312`; на странице `SupplierCardConfigPage.vue:316`, `:410`, `:458`) —
БАГ-14, — а проверки уникальности имени нет ни в моке, ни на странице, только на схеме и только у
полей (`backend/app/modules/suppliers/shared/models.py:264-266`). Обязаны ли три `PUT`-а применяться
одной транзакцией и в каком порядке — строка владельцу.

**Производные значения (считать, не хранить) — три, и все три схема хранит колонкой.**
(1) `PermissionMatrix.items` производна от секций и их полей: мок собирает список обходом
`MOCK_SECTIONS` (`mocks/config.ts:191-203`), а на схеме `permission_items` — хранимая таблица со
своим `name_translations` (`backend/app/modules/auth/shared/models.py:157-159`), которое может
разойтись с `section_configs.name_translations`
(`backend/app/modules/suppliers/shared/models.py:280`). (2) `usageCount` по замыслу производна
(«сколько поставщиков заполнили это поле»), на схеме — колонка `usage_count` с `server_default="0"`
(`backend/app/modules/suppliers/shared/models.py:259-261`), а считать её **не из чего**: хранилища
значений нет (графа «Кастомные поля»). (3) `order` секции клиент считает позицией в массиве и
перенумеровывает при перетаскивании (`useCardConfig.ts:71`), мок при чтении не сортирует
(`mocks/config.ts:250-252`), схема хранит `sort_order`
(`backend/app/modules/suppliers/shared/models.py:281`). Плюс `roles` и `users` матрицы — производные
от `user_roles.role_name` (`backend/app/modules/auth/shared/models.py:98`) и таблицы `users`
(`:42`), которые клиент присылает обратно телом `PUT` как данные (`configService.ts:80-81`). Что из
этого сервер считает при чтении, а что хранит — строка владельцу.

---

## Правила домена

Правила, живущие только в этом домене. Шесть первых — расхождения формы фронта со схемой хранения;
они не решения контракта, а предмет строк владельцу.

1. **Имя поля во фронте трёхъязычно, а на схеме — одна строка; у секции и элемента матрицы
   наоборот, совпадает.** `FieldDefinition.name: TranslatedString` и `options?: TranslatedString[]`
   (`types/config.ts:7`, `:13`) против `name: String(255)` и `options: JSON`
   (`backend/app/modules/suppliers/shared/models.py:251`, `:262`; миграция
   `e24a3922ed01_phase_7_config.py:31`, `:36`). При этом `section_configs.name_translations` и
   `permission_items.name_translations` — JSONB (`suppliers/shared/models.py:280`;
   `backend/app/modules/auth/shared/models.py:157-159`). Асимметрия внутри одной миграции: два имени
   из трёх переводимы, третье нет, а хранить `{ru,en,lt}` в `String(255)` нечем (§12 соглашений —
   тот же класс, самое крупное расхождение проекта).
2. **Встроенность поля на схеме — колонка, во фронте — префикс строки id.** `is_builtin`
   (`backend/app/modules/suppliers/shared/models.py:256-258`, миграция
   `e24a3922ed01_phase_7_config.py:34`) против `fieldId.startsWith('f-custom-')`
   (`SupplierCardConfigPage.vue:303-305`, комментарий `:301-302`). Следствие жёсткое: пока
   встроенность определяется префиксом, серверные `id` **обязаны** нести `f-custom-`, иначе UI
   перестанет отличать встроенные поля от пользовательских, — а на схеме `id` это
   `gen_random_uuid()` (миграция `:29`). Зеркальный случай у секций: во фронте есть
   `system?: boolean` (`types/config.ts:24-25`), на схеме колонки нет
   (`grep -c '"system"' backend/alembic/versions/e24a3922ed01_phase_7_config.py` → `0`).
3. **Пользователь в матрице адресуется email-ом, а на схеме — UUID.** `users: Record<string,
   string[]>` со значениями вида `admin@flexiron.com` (`types/config.ts:39-40`,
   `mocks/config.ts:179-184`) и `userPermissions[itemId][role][userEmail]` (`types/config.ts:51-54`,
   чтение `SupplierCardConfigPage.vue:166`, запись `:233-237`). На схеме — `user_permissions.user_id`,
   UUID-FK на `users.id` с `ondelete="CASCADE"`
   (`backend/app/modules/auth/shared/models.py:214-218`, миграция
   `e24a3922ed01_phase_7_config.py:101`), и ключ уникальности другой: `(tenant_id, item_id, user_id)`
   (`auth/shared/models.py:232-236`). Кто переводит одно в другое — строка владельцу.
4. **«Действие не задано — наследуй у роли» выразимо во фронте и невыразимо на схеме.** Тип хранит
   переопределения как `Partial<Record<PermissionAction, boolean>>` (`types/config.ts:51-54`), и вся
   семантика построена на `undefined`: `getUserPerm` откатывается на роль
   (`SupplierCardConfigPage.vue:160-169`), `clearUserOverrides` именно **удаляет** ключ (`:190-192`),
   `collapseIfAligned` схлопывает переопределения, когда все пользователи роли сошлись (`:241-259`).
   На схеме `can_read/can_edit/can_create/can_delete` — четыре `nullable=False` булевых колонки с
   дефолтами (`backend/app/modules/auth/shared/models.py:219-230`, миграция `:102-105`): «не задано»
   на уровне действия хранить негде, различима только строка целиком.
5. **Матрица прав никем не применяется — она только редактируется.**
   `grep -rn "PermissionMatrix\|rolePermissions\|userPermissions" frontend_vue/src --include=*.ts --include=*.vue | grep -v '\.spec\.'`
   даёт `types/config.ts`, `services/configService.ts`, `services/mocks/config.ts`,
   `composables/useCardConfig.ts` и саму страницу-редактор — и всё. На сервере заглушка
   (`backend/app/modules/auth/internal_api/interface.py:27-38`). Права заказов живут **другим**
   механизмом в другом домене (`GET /api/settings/order-permissions`, потребитель
   `frontend_vue/src/composables/useOrderPermissions.ts`) и с этой матрицей не связаны ничем
   (§6 соглашений — два независимых механизма прав).
6. **Порядок элементов матрицы — «секции и их поля в порядке рендера» — на схеме не хранится.**
   Требование объявлено в типе (`types/config.ts:55-56`) и исполняется моком обходом секций
   (`mocks/config.ts:191-203`); в `permission_items` колонки порядка нет вовсе (миграция
   `e24a3922ed01_phase_7_config.py:68-77`). Значит сервер обязан выводить порядок из
   `section_configs.sort_order` и `section_fields.sort_order`
   (`backend/app/modules/suppliers/shared/models.py:281`, `:316`) при каждом чтении.
7. **Пять правил каскада матрицы живут только на клиенте и пронумерованы прямо в коде.** Правило 1 —
   секция каскадит на свои поля (`SupplierCardConfigPage.vue:196-207`, вызов `:215`); правило 2 —
   чекбокс пользователя в строке секции каскадит на пользовательские чекбоксы всех её полей
   (`:273-280`); правило 4 — смена роли стирает пользовательские переопределения по этому действию
   (`:186-194`, вызовы `:205`, `:222`); правило 5 — сошлись все пользователи роли, переопределения
   схлопываются и значение поднимается на роль (`:241-259`, вызовы `:278`, `:283`); правило 6 —
   бейдж «отличается от секции» (`:287-299`). Состояние чекбокса секции — производное от полей,
   считается рекурсивно (`:133-158`). Прежний контракт называл их числом и не описывал ни одного.
   Сервер эти правила **не исполняет и не проверяет**; он обязан сохранить присланный результат.
8. **Секция без полей ведёт себя как лист, а не как контейнер.** `rolePermState` для секции с пустым
   `fields` уходит в `leafRoleState` (`SupplierCardConfigPage.vue:141-143`), то есть её собственное
   значение перестаёт быть производным. Именно так выглядит только что созданная секция
   (`fields: []` — `mocks/config.ts:317`, `SupplierCardConfigPage.vue:464`).
9. **Собственное значение секции пишется, хотя читается как производное.** `onRoleToggle` для секции
   сначала каскадит на поля, а потом всё равно ставит значение самой секции — «for consistency»
   (`SupplierCardConfigPage.vue:213-217`), тогда как читается оно пересчётом по полям (`:141-154`).
   На схеме `role_permissions` хранит строку для любого `item_id` без различения секции и поля
   (`backend/app/modules/auth/shared/models.py:180-181`), так что **сервер обязан хранить обе** — и
   производную секции, и значения полей.
10. **`collapsed` объявлен UI-only, но уезжает на сервер и хранится колонкой.** Комментарий в типе —
    «UI-only: collapsed inside the config builder (not persisted to the rendered supplier card)»
    (`types/config.ts:20-21`), при этом флаг входит в тело `PUT /api/config/sections`
    (`configService.ts:51`), мок его сохраняет (`mocks/config.ts:254-259`), и на схеме под него есть
    колонка (`backend/app/modules/suppliers/shared/models.py:282-284`, миграция
    `e24a3922ed01_phase_7_config.py:49`). «UI-only» здесь значит «не влияет на карточку», а не «не
    хранится», — и сервер обязан его хранить.
11. **Имя новой секции размножается на три языка, имя нового поля — нет, а страница делает третье.**
    `createSection` шлёт `{ name: string }` (`configService.ts:54-55`), мок ставит одну строку в
    `ru`, `en`, `lt` (`mocks/config.ts:307-310`); `createField` шлёт
    `toTranslatedString(name, locale)` (`configService.ts:22-25`), где две другие локали пустые
    (`frontend_vue/src/types/i18n.ts:19-25`); локальный путь страницы использует второй вариант для
    обоих (`SupplierCardConfigPage.vue:317`, `:413`, `:459`). Три поведения на одну операцию
    «назвать сущность» — БАГ-04.
12. **Правки имён сделаны двумя разными помощниками, и один из них теряет переводы.** Переименование
    секции идёт через `mergeLocaleValue`, сохраняющий остальные локали (`useCardConfig.ts:86`,
    помощник `frontend_vue/src/types/i18n.ts:53-63`); создание — через `toTranslatedString`,
    обнуляющий их (`SupplierCardConfigPage.vue:317`, `:413`, `:459`). Для создания это верно, для
    правки было бы нет; правило держится на том, что путь правки в домене ровно один (§12
    соглашений — тот же класс, отдельный баг-файл на два других домена).

---

## Клиент написан, UI нет

Шесть клиентских функций из двенадцати не вызываются ниоткуда: домен целиком работает
clean-slate-батчем из трёх `PUT`-ов. Проверено по каждой — попадания вне `configService.ts` только
одноимённые локальные функции чужих экранов (`SupplierCardConfigPage.vue:309`,
`composables/useCategoryCard.ts:142`).

| эндпоинт | функция клиента | объявление |
|---|---|---|
| `POST /api/config/fields` | `createField` | `services/configService.ts:15` |
| `PATCH /api/config/fields/:id` | `patchField` | `services/configService.ts:28` |
| `DELETE /api/config/fields/:id` | `deleteField` | `services/configService.ts:40` |
| `POST /api/config/sections` | `createSection` | `services/configService.ts:54` |
| `PATCH /api/config/sections/:id` | `patchSection` | `services/configService.ts:58` |
| `DELETE /api/config/sections/:id` | `deleteSection` | `services/configService.ts:70` |

Плюс одна функция композабла без вызывающего: `toggleFieldLibraryHidden`
(`useCardConfig.ts:95-98`) — поэтому `FieldDefinition.hidden` (`types/config.ts:11-12`) не
выставляется никогда (БАГ-11). Поле в контракте описано: его отдаёт `GET`, и сервер обязан его
хранить.

Это реестр, а не находка о лишнем: шесть эндпоинтов описаны формой запроса и ответа выше, потому
что клиент их уже определил. Что здесь дефект — то, что их шесть (БАГ-05).

---

## Чего в домене нет

Ничего не вычеркнуто молча. Все девять разделов прежнего
[`03-api-contract.md`](../03-api-contract.md) (строки 618-693) относятся к живым эндпоинтам и
переписаны выше; ниже — утверждения, **снятые** вместе с доказательством, и три эндпоинта, у
которых раздела не было вовсе.

| было в прежнем тексте | чем опровергнуто |
|---|---|
| `403 IMMUTABLE` на встроенное поле — в `PATCH` и в `DELETE` (`03-api-contract.md:644`, `:650`) | кода `IMMUTABLE` нет нигде: `grep -rn "IMMUTABLE" frontend_vue/src backend/app` пусто; мок удаляет и правит любое поле (`mocks/config.ts:294`, `:298-304`); серверный признак другой — `is_builtin` (`backend/app/modules/suppliers/shared/models.py:256-258`) |
| `409 DUPLICATE` по имени поля per-tenant (`:636`, `:644`) | кода `DUPLICATE` в домене нет; правило при этом **есть на схеме** — `uq_field_definitions_tenant_name` (`suppliers/shared/models.py:264-266`), поэтому снят код, а не требование |
| «`type` менять нельзя — `422 VALIDATION_ERROR`» (`:641`) | мок меняет любое поле через `Object.assign` (`mocks/config.ts:294`); проверки нет ни в клиенте, ни на схеме |
| «`404 NOT_FOUND`, если section не существует» (`:674`) | мок возвращает `null` и не бросает (`mocks/config.ts:325`), тот же случай у поля (`:289`) — БАГ-08 |
| «поле `fields` в `PATCH` не принимаем» (`:671`) | мок принимает через `Object.assign` (`mocks/config.ts:330`) |
| «каскадное удаление данных у поставщиков» при `DELETE` поля (`:650`) | каскадить нечего: у `Supplier` нет `fieldValues` (`frontend_vue/src/types/supplier.ts:12-31`), таблицы `supplier_field_values` не существует, а `product_field_values.field_id` ведёт на `category_fields` (`backend/app/modules/products/shared/models.py:203-207`) |
| «`usageCount` — сколько поставщиков реально заполнили это поле» (`:629`) | считать не из чего (та же причина); в моке это статические числа (`mocks/config.ts:17`, `:24`, `:60`, `:67`), во фронте новое поле получает `0` или `1` вручную (`SupplierCardConfigPage.vue:320`, `:416`) |
| «Только Admin» у `GET /api/config/fields` (`:629`) | проверки прав нет ни в одной функции домена; на сервере `check_permission` — заглушка `return True` (`backend/app/modules/auth/internal_api/interface.py:27-38`) |
| «`SectionConfig[]`, отсортированный по `order`» (`:655`) | сортировки нет нигде: `mockGetSections` отдаёт массив как лежит (`mocks/config.ts:250-252`), `mockSaveSections` кладёт присланный как есть (`:254-259`); требование к серверу сохранено в разделе `GET /api/config/sections`, снято утверждение, что так уже делается |
| «`confirmDeleteField` зовёт `DELETE /api/config/fields/:id`» (`:648`) | не зовёт: правит `fieldLibrary` и `sections` в памяти (`SupplierCardConfigPage.vue:350-361`) |
| «`PATCH /api/config/fields/:id` — quick action» (`:640`) | quick-action-пути в коде нет ни одного; домен целиком clean-slate (`SupplierCardConfigPage.vue:307-308`) |
| «сервер переопределяет клиентский `id`» при `POST` (`:633`) | по смыслу верно, повод другой: клиент `id` не шлёт вовсе (`configService.ts:22-25`), а `f-custom-<ts>` рождается в моке (`mocks/config.ts:274`) или локально на странице (`SupplierCardConfigPage.vue:316`) |
| «`type: 'enum'` требует `options`» (`:636`) | не проверяет ни мок, ни клиент, ни схема (`options` nullable — `suppliers/shared/models.py:262`) |
| примеры с `"name": "Company"` / `"Status"` строкой (`:627`, `:643`, `:657`, `:673`, `:681`) | во фронте это `TranslatedString` во всех четырёх типах (`types/config.ts:7`, `:18`, `:61`) |
| «Сервер обязан добавлять item, когда создаётся section / field» (`:683`) | требование к серверу оставлено (правило 6 выше), снято как **описание существующего**: мок его не исполняет — `MOCK_PERMISSIONS` строится один раз при загрузке модуля (`mocks/config.ts:232`) и не пересобирается (БАГ-07) |
| «`PUT` оставлен только на `/api/config/sections` и `/api/config/permissions`» (`:32`, повтор в чейнджлоге `:813-815`), и по кнопке Save уходит два запроса (`:267`) | `PUT`-ов три: библиотека полей тоже уходит целиком (`configService.ts:12`, `useCardConfig.ts:51-55`) — прежний текст не молчал, а утверждал обратное |

Три эндпоинта жили в прежнем контракте одной строкой реестра и без раздела: `POST /api/config/sections`
(`03-api-contract.md:3032`), `DELETE /api/config/sections/:id` (`:3034`) и
`PUT /api/config/fields` — последний не упомянут даже строкой. Описаны выше впервые.

**Эндпоинтов, описанных прежним контрактом и отсутствующих в коде, у домена нет ни одного:**
`grep -n "^### .*api/config" roo_code/roo-context/03-api-contract.md` даёт ровно девять заголовков —
строки 622, 631, 638, 646, 652, 661, 668, 676, 685, — и все девять путей живы в коде; остальные
попадания того же пути (`:32`, `:267`, `:671`, `:673`, `:811-815`, `:3029-3034`) — проза, реестр и
чейнджлог, они разобраны таблицей выше. Раздела,
написанного вперёд, в домене тоже нет: метка «спроектировано» не стоит ни у одного из двенадцати,
потому что кода нет только у серверной части, а её отсутствие выражено строкой `Бэкенд:` — это
разные состояния.

---

## Пробелы аудита: закрыто и осталось

Аудит оставил четырнадцать вопросов без ответа в коде. Все четырнадцать — строки владельцу в
[`00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md), раздел `config`; ни один
контракт не назначает. Ниже — где каждый виден в тексте выше и что по нему **осталось**.

| пробел аудита | где в этом файле | состояние |
|---|---|---|
| кто владеет перечнем типов поля и перечнем действий | «Обязанности сервера», графа значений по умолчанию | **осталось** — решение владельца |
| откуда сервер берёт роли матрицы и каков дефолт прав нового элемента | `GET /api/config/permissions`; та же графа | **осталось** — решение владельца |
| рождает ли уведомление изменение матрицы прав | графа «События и уведомления» | **осталось** — решение владельца |
| остаётся ли след у смены матрицы и конфигурации, и кто автор | графа «Запись в аудит-лог» | **осталось** — решение владельца |
| где сервер хранит **значения** полей поставщика | графа «Кастомные поля»; «Чего в домене нет» | **осталось** — решение владельца |
| где сервер применяет матрицу и что отвечает при отказе | графа «Права»; правило 5 | **осталось** — решение владельца |
| какой признак «этого удалять нельзя» настоящий — колонка или префикс id | правило 2; каталог кодов | **осталось** — решение владельца |
| как пользователь адресуется в матрице — email или UUID | правило 3 | **осталось** — решение владельца |
| как выразить «действие не задано» при четырёх `NOT NULL` колонках | правило 4 | **осталось** — решение владельца |
| переводимо ли имя поля библиотеки | правило 1 | **осталось** — решение владельца |
| обязаны ли три `PUT`-а одной транзакцией и в каком порядке | графа «Транзакционность» | **осталось** — решение владельца |
| читает ли карточка поставщика эту конфигурацию вообще | «Источник истины», абзац «домен пишет в пустоту» | **осталось** — решение владельца |
| каким кодом отвергать системную секцию, встроенное поле и дубль имени | «Каталог кодов ошибок», таблица четырёх отказов | **осталось** — решение владельца |
| производны ли `items`, `roles`, `users` и что делать с присланными обратно | `PUT /api/config/permissions`; графа «Производные значения» | **закрыто по старшинству**: производны, сервер их игнорирует в теле — выведено из схемы (`auth/shared/models.py:98`, `:42`) и подтверждено моком (`mocks/config.ts:191-203`). Осталось одно: какое `name_translations` элемента матрицы главнее — **решение владельца** |

Одна поправка к самому аудиту, найденная при написании: элементов матрицы **семнадцать**, а не
шестнадцать — пять секций и двенадцать полей, а не одиннадцать. Замер приведён в разделе
`GET /api/config/permissions`. Это ошибка счёта в аудите, не дефект кода, поэтому в баг-файл она не
идёт.
