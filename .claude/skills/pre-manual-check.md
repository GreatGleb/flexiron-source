---
name: pre-manual-check
description: Deep verification of a newly implemented page before user manual testing. Runs 20 targeted checks one by one — each with a single narrow focus. Findings are added to the bugs file.
user_invocable: true
arguments:
  - name: plan
    description: "Plan file identifier, e.g. '1.1' → reads toDo/plans/1.1-products-plan.md"
    required: true
---

# Pre-Manual Check — Глубокая проверка перед ручным тестированием

Запускается ПОСЛЕ реализации страницы, ДО ручного тестирования. Цель — найти максимум багов до того, как пользователь откроет браузер.

**Принцип: один промпт = один узкий фокус.** Проверка "всего сразу" скользит по поверхности — узкий фокус даёт глубину.

---

## CRITICAL RULES

1. **ONE CHECK PER STOP** — выполнять строго один промпт, затем жёсткий СТОП и ждать подтверждения
2. **Claim → Verify → Conclude** — каждое утверждение о коде = Grep или Read ПЕРЕД выводом, никогда по памяти
3. **No skipping "obvious" checks** — каждый промпт независим, проверять заново даже если "очевидно чисто"
4. **Add bugs immediately** — при обнаружении добавить в bugs-файл В ХОД ТОГО ЖЕ промпта, до СТОП
5. **✅ или ❌, никогда "вероятно ок"** — каждый пункт должен быть проверен инструментом

---

## Шаг 0: Инициализация (выполнить один раз перед Промптом 1)

```
Прочитать следующие файлы:

1. toDo/plans/{plan}-plan.md — извлечь:
   - Полный список созданных/изменённых файлов (views, composables, services, types, CSS, i18n, router)
   - ТЗ раздел плана (секция "ТЗ" или "Что такое X")
   - Список feature flags
   - API endpoints
   - Итоговый чеклист

2. TZ-источники (упомянутые в плане или create-page.md):
   - toDo/InBox LT CRM ToDo.md — раздел этой страницы
   - toDo/Flexiron_ERP_Process_Algorithm.md — если упоминается в плане
   - toDo/design/screen_specs/[XX.X_Page].md — если файл существует для этой страницы
   - toDo/admin-api-contract.md — секция этого домена

3. Определить путь к bugs-файлу:
   - Имя плана: toDo/plans/{plan}-[domain]-plan.md (например 1.1-products-plan.md)
   - Bugs-файл: toDo/plans/bugs/{plan}-[domain]-bugs.md (заменить "-plan.md" на "-bugs.md", каталог: bugs/)
   - Пример: план = "1.1" → файл плана = "1.1-products-plan.md" → bugs-файл = "toDo/plans/bugs/1.1-products-bugs.md"
   - Если bugs-файл ещё не существует — создать с заголовком и пустой итоговой таблицей
   - Прочитать итоговую таблицу → определить NEXT_BUG_ID

Сохранить в памяти:
- PLAN_FILES: список всех файлов реализации
- TZ_REQUIREMENTS: список требований из ТЗ (все пункты)
- BUGS_FILE: полный путь к bugs-файлу (toDo/plans/bugs/{plan}-[domain]-bugs.md)
- NEXT_BUG_ID: следующий порядковый номер бага
```

После инициализации — сразу выполнить Промпт 1 без ожидания.

---

## ФАЗА 1 — Специфические проверки

---

### Промпт 1 — CSS: доступность классов

**Фокус:** каждый CSS-класс из шаблонов определён в файле, реально доступном компоненту.

**Алгоритм:**
1. Для каждого view-файла из PLAN_FILES — прочитать файл
2. Извлечь все CSS-классы из `class="..."` и `:class="{...}"` в шаблоне
3. Прочитать CSS-импорты компонента (`import '@styles/...'`)
4. Прочитать `src/styles/admin/admin-core.scss` — список его `@import` (глобальные классы)
5. Для каждого класса — Grep в доступных файлах (импорты компонента + admin-core.scss imports)
6. Класс не найден нигде → БАГ

**Особо проверить:**
- `.empty-state` — НЕ в admin-core.scss, должен быть в page CSS данного компонента
- Классы из `_entity-card-layout.css` — НЕ в admin-core.scss, нужен явный `import` в компоненте
- Любой кастомный класс из плана который мог не попасть в CSS-файл

**После завершения:** добавить найденные баги в BUGS_FILE → **СТОП**

---

### Промпт 2 — CSS: дизайн-консистентность

**Фокус:** UI-элементы используют те же классы что и аналогичные существующие страницы.

**Алгоритм:**
1. Прочитать reference-страницу:
   - Для card page → `src/views/admin/suppliers/SupplierCardPage.vue`
   - Для list page → `src/views/admin/suppliers/SuppliersListPage.vue`
2. Для каждого UI-элемента в новых шаблонах — сравнить класс с reference:

| Элемент | Ожидаемый паттерн |
|---|---|
| Кнопка «Назад» | `<router-link class="btn btn-secondary">` — не button, не router.back() |
| Кнопки в хедере | `entity-action-bar no-margin pos-static` контейнер |
| Delete/action кнопка | `action-icon-btn action-danger` из `_action-icons.css` |
| Заголовок секции | `:title` prop на GlassPanel — не `<h2>` внутри panel body |
| Таблица | `data-table` + `data-table-wrapper` |
| Кликабельная строка | CSS cursor:pointer в page CSS, `@click` на `<tr>` |
| Save bar | `entity-action-bar no-margin pos-static` с `v-if="isAnythingDirty"` |
| Page title | `<h1 class="page-title">` |
| Пустое состояние | `class="empty-state"` (display:flex, flex-direction:column, align-items:center) |
| Read-only поле | `<input readonly class="glass-input">` — не `<span class="glass-input">` |

**После завершения:** добавить найденные баги в BUGS_FILE → **СТОП**

---

### Промпт 3 — Vue: гигиена шаблонов

**Фокус:** запрещённые паттерны в `<template>`.

**Алгоритм — для каждого view-файла:**

1. **Комментарии** — Grep `<!--` внутри `<template>` → pitfall #9, ЗАПРЕЩЕНЫ
2. **`<a href>`** — Grep `<a ` в template → должно быть `<router-link>`
3. **`router.back()`** → должно быть именованным маршрутом `{ name: 'X' }`
4. **`v-for` без `:key`** — Grep `v-for` → каждый должен иметь `:key`
5. **Хардкоженные строки** — виден ли текст не через `t('...')` (кроме `—` и чисел)
6. **`v-html`** — Grep `v-html` → нужна явная причина
7. **Неиспользуемые импорты** — каждый импорт в `<script setup>` используется в template или script

**После завершения:** добавить найденные баги в BUGS_FILE → **СТОП**

---

### Промпт 4 — v-model контракты

**Фокус:** каждый v-model передаёт тип, совместимый с prop компонента.

**Алгоритм:**

1. **CustomSelect** — принимает только `string`, не `string | null` и не `number`
   - Grep `v-model` на `<CustomSelect` в новых файлах
   - Для каждого binding — проверить тип источника (ref, reactive, computed)
   - `string | null` → нужен computed-адаптер `null ↔ ''`
   - Опция "пусто/все" → `{ value: '', label: '...' }`, не `{ value: null }`

2. **DropZone** — НЕ v-model компонент
   - Grep `v-model` на `<DropZone` → должно быть `hint` prop + `@uploaded` event

3. **`v-model.number` на nullable number** → watcher `NaN → null` должен быть в composable
   - Grep `v-model.number` → для каждого nullable поля — проверить watcher в composable

4. **Прочие компоненты** — для каждого `v-model` → прочитать `defineProps` компонента → тип `modelValue`

**После завершения:** добавить найденные баги в BUGS_FILE → **СТОП**

---

### Промпт 5 — TypeScript: null safety и нормализация данных

**Фокус:** nullable поля корректно обрабатываются от API до save.

**Алгоритм:**

1. **Nullable string полей перед save** — в `save()` composable:
   - `form.field === ''` нормализуется к `null` после `dirty.diff()`
   - Grep `delta.` в save() → проверить нормализацию для каждого nullable string

2. **Nullable number полей** — `v-model.number` дает NaN при очистке:
   - Grep NaN в composable → watcher присутствует для всех полей

3. **Обращения к nullable в шаблоне**:
   - `item.price != null ? item.price : '—'` — для числел (не `item.price ?? '—'` — 0 тоже falsy у `||`)
   - `item.field ?? '—'` — для строк
   - `product?.name` — optional chaining где product может быть null

4. **Нет `any`** — Grep `: any` в новых файлах → каждый случай обоснован

5. **Нет `undefined` как nullable** — `T | null`, не `T | undefined`

**После завершения:** добавить найденные баги в BUGS_FILE → **СТОП**

---

### Промпт 6 — i18n: полнота переводов

**Фокус:** все переводы есть, все три языка совпадают по ключам.

**Алгоритм:**

1. Прочитать секцию домена в `src/i18n/admin.ts`
2. Подсчитать ключи в `adminRu.[domain]` → N
3. Подсчитать ключи в `adminEn.[domain]` → должно быть N
4. Подсчитать ключи в `adminLt.[domain]` → должно быть N
5. Расхождение → список отсутствующих ключей

6. Для каждого `t('domain.key')` в новых файлах — ключ существует в adminRu?
7. Grep `@` в строковых значениях переводов → неэкранированный `@` (должно быть `{'@'}`)
8. Grep хардкоженного текста в шаблонах (не через `t()`) — проверить на видимые строки

**После завершения:** добавить найденные баги в BUGS_FILE → **СТОП**

---

### Промпт 7 — Mock data: целостность и полнота

**Фокус:** mock STORE корректен, самодостаточен, покрывает все ветви рендеринга.

**Алгоритм:**

1. **Кросс-ID проверка** — для каждой ссылки на другой STORE (linkedSuppliers.id, categoryId и т.п.):
   - Grep ID в целевом mock файле → ID существует

2. **Покрытие типов полей** — если есть динамические поля (text/number/boolean/enum/email/date/file):
   - Grep каждого fieldType в STORE → хотя бы один продукт содержит поле каждого типа
   - Иначе ветви `v-if="fv.fieldType === 'boolean'"` нельзя протестировать в браузере

3. **Унаследованные поля** — для каждой категории с `inheritedFields` в categories STORE:
   - Продукты этой категории имеют соответствующие fieldValues с `inherited: true`

4. **structuredClone** — Grep каждой mock-функции читающей из STORE → возвращает `structuredClone(...)`

5. **Английский язык** — все строки STORE на английском (не русские)

6. **Edge cases** — есть хотя бы один продукт с `price: null`, один с `categoryId: null`

**После завершения:** добавить найденные баги в BUGS_FILE → **СТОП**

---

### Промпт 8 — Feature flags: тройная регистрация

**Фокус:** каждый флаг зарегистрирован в трёх местах.

**Алгоритм:**

1. Grep `useFeatureFlag(` в новых файлах → список всех используемых флагов
2. Grep `featureFlag:` в новых route definitions → список флагов в route meta
3. Для каждого флага X:
   - Grep X в `src/types/features.ts` → присутствует в интерфейсе FeatureFlags
   - Grep X в `src/config/featureFlags.ts` → присутствует со значением по умолчанию
   - Grep X в `tests/e2e/helpers/flags.ts` → присутствует в ALL_FLAGS_ENABLED

**После завершения:** добавить найденные баги в BUGS_FILE → **СТОП**

---

### Промпт 9 — Pitfalls #1–#23

**Фокус:** прогон каждого питфолла из vue-rules.md по новым файлам.

**Алгоритм:**
1. Прочитать `frontend_vue/.claude/skills/vue-rules.md` (полный список pitfalls #1–#23)
2. Для каждого питфолла — определить: применим ли к данной странице?
3. Если применим → Grep или Read → ✅ или ❌

**Обязательно проверить (независимо от остального):**

| # | Что проверить | Инструмент |
|---|---|---|
| #9 | Нет `<!--` в `<template>` | Grep `<!--` в view файлах |
| #10 | Все route names в router.push/router-link существуют | Grep name в router/index.ts |
| #13 | Mock reads возвращают structuredClone | Read mock файл |
| #16 | Каждый компонент импортирует свой CSS явно | Read импорты view файлов |
| #17 | Все `<SvgIcon name="X">` — X существует в SvgIcon.vue | Grep X в SvgIcon.vue |
| #18 | Save bar = `btn_discard_changes`; модалы = `btn_discard` | Grep в view файлах |
| #19 | Фильтры/поиск внутри того же GlassPanel что таблица | Read template |
| #20 | `initialized` flag в list composable | Read composable |

**После завершения:** добавить найденные баги в BUGS_FILE → **СТОП**

---

### Промпт 10 — Router и навигация

**Фокус:** все маршруты корректны, порядок правильный.

**Алгоритм:**

1. Grep `{ name:` в новых view/composable файлах → список всех используемых route names
2. Для каждого name → Grep в `src/router/index.ts` → name существует
3. Прочитать блок новых маршрутов в router/index.ts:
   - Статические пути (`products/categories`) идут РАНЬШЕ динамических (`:id`)
   - Vue Router 4: статический сегмент = 40pts, динамический = 20pts
4. Для каждого `meta: { featureFlag: 'X' }` → X зарегистрирован (см. Промпт 8)
5. `ScreensPage.vue` обновлён если это требование плана — Grep в плане → Grep в ScreensPage

**После завершения:** добавить найденные баги в BUGS_FILE → **СТОП**

---

## ФАЗА 2 — Детальная проверка файл за файлом

---

### Промпт 11 — ТЗ compliance

**Фокус:** КАЖДОЕ требование из ТЗ реализовано в коде.

**Алгоритм:**
1. Взять TZ_REQUIREMENTS из инициализации (план + все TZ-источники)
2. Для каждого требования — найти его реализацию:
   - Секция в шаблоне → Grep `data-test` / Read template
   - Поле в форме → Read view InputGroup
   - Кнопка / действие → Read view + handler в composable
   - API endpoint → Read service + mock/index.ts
   - Feature flag → Read featureFlags.ts
3. Требование без реализации → БАГ
4. Реализация не соответствует требованию → БАГ

**Проверить явно:**
- Save mode правильный (clean-slate vs quick-action)
- Все секции из ТЗ присутствуют
- Все пользовательские действия реализованы
- API endpoints совпадают с контрактом (HTTP method, path, request shape)

**После завершения:** добавить найденные баги в BUGS_FILE → **СТОП**

---

### Промпт 12 — Файл: types/[domain].ts

**Фокус:** типы полны, корректны, без дублирования.

**Алгоритм:**
1. Прочитать файл целиком
2. Все поля из API контракта (`toDo/admin-api-contract.md` секция домена) отражены в типах
3. Nullable поля → `T | null` (не `T | undefined`, не `T?`)
4. Нет `any` — Grep `: any`
5. Shared типы (CategoryFieldType и т.п.) импортируются из source-файла, не дублируются
6. `PaginatedResponse<T>` используется для списков (из `src/types/api.ts`)
7. Form-тип (если отличается от API-типа) — отдельный `Pick<Entity, ...>` или interface

**После завершения:** добавить найденные баги в BUGS_FILE → **СТОП**

---

### Промпт 13 — Файл: mocks/[domain].ts

**Фокус:** mock полный, логика корректна.

**Алгоритм — прочитать файл целиком, затем:**
1. STORE содержит 8+ записей с разнообразными данными
2. `mockCreate` — генерирует уникальный ID, устанавливает `createdAt`, резолвит ссылочные имена (categoryName из categoryId)
3. `mockPatch` — применяет delta через `Object.assign` или поле за полем; возвращает `structuredClone`
4. `mockDelete` — удаляет через `splice`, возвращает правильный статус
5. Фильтрация в `mockGetList` — search по name (case-insensitive), categoryId фильтр проверяет на `!== null` перед добавлением в условие
6. Все read-функции возвращают `structuredClone(...)`; mutations работают напрямую на STORE
7. `structuredClone` НЕ используется на Vue reactive proxy → `JSON.parse(JSON.stringify(...))` если нужно

**После завершения:** добавить найденные баги в BUGS_FILE → **СТОП**

---

### Промпт 14 — Файл: mocks/index.ts + [domain]Service.ts

**Фокус:** маршруты зарегистрированы, service функции корректны.

**mocks/index.ts:**
1. Прочитать файл — найти блок маршрутов домена
2. Все 5 маршрутов зарегистрированы: GET list, GET `:id`, POST, PATCH `:id`, DELETE `:id`
3. Path matching и method checking — по тому же паттерну что существующие маршруты
4. Нет дублированных путей (GET list vs GET :id различаются проверкой на наличие ID сегмента)

**[domain]Service.ts:**
1. Прочитать файл целиком
2. Каждая функция использует правильный метод (`apiGet`/`apiPost`/`apiPatch`/`apiDelete`)
3. Фильтры в GET → null-проверка перед добавлением в params (не `params.categoryId = null` → в URL: `?categoryId=null`)
4. Функции возвращают правильные типы (из `src/types/api.ts` envelope)

**После завершения:** добавить найденные баги в BUGS_FILE → **СТОП**

---

### Промпт 15 — Файл: use[Domain].ts (list composable)

**Фокус:** list composable корректен — loading, initialized, watch, delete.

**Алгоритм — прочитать файл целиком:**
1. `initialized` flag (не ref, обычный boolean) — `loading.value = true` только если `!initialized`
2. `watch(filters, load, { deep: true })` — НЕ `{ immediate: true }` (иначе дублирует onMounted load)
3. `deleteProduct`:
   - `await deleteProductApi(id)` из service
   - `toast.success(t('...'))`
   - `await load()` после успешного удаления
   - `catch` → `toast.error(t('...'))`
4. `load()` устанавливает `initialized = true` в блоке `try` (после успешного fetch)
5. Возвращает только то, что используется в view (нет лишнего в return)
6. `error` ref присутствует и устанавливается в catch если view его показывает

**После завершения:** добавить найденные баги в BUGS_FILE → **СТОП**

---

### Промпт 16 — Файл: use[Domain]Card.ts (card composable)

**Фокус:** dirty check, save delta, fieldValues — каждый механизм корректен.

**Алгоритм — прочитать файл целиком:**

1. **form** — `ref<Pick<Entity, 'field1'|'field2'|...>>({...})` — только редактируемые поля, не весь Entity
2. **useDirtyCheck(form)** — передаётся `form` как Ref (не `form.value`)
3. **NaN watcher** — `watch(form, (val) => { if (NaN) form.value.field = null }, { deep: true })` — для каждого `v-model.number` поля
4. **load()**:
   - `form.value = { поля из data }` — полная перезапись
   - `dirty.capture()` — вызывается ПОСЛЕ заполнения form
   - `fieldValues.value = Object.fromEntries(...)` — плоский map
   - `originalFieldValues.value = JSON.stringify(map)`
5. **save()**:
   - Ранний выход `if (!isAnythingDirty.value) return`
   - `Object.assign(delta, dirty.diff())` — только изменения
   - Нормализация: `if (delta.sku === '') delta.sku = null` для каждого nullable string
   - fieldValues delta — собирается из `product.value.fieldValues.map(...)` с подстановкой значений из `fieldValues.value`
   - `toast.success` + `await load()` после успешного save
   - `catch` → `toast.error`
6. **discard()** = `return load()` (не ручной reset)

**После завершения:** добавить найденные баги в BUGS_FILE → **СТОП**

---

### Промпт 17 — Файл: [Domain]Page.vue — script setup

**Фокус:** script block list-страницы.

**Алгоритм — прочитать файл целиком:**

1. Все `import` используются в template или script — Grep каждого импортируемого в файле
2. Computed-адаптеры для CustomSelect с nullable источниками:
   - `get: () => field ?? ''`
   - `set: (v: string) => { field = v || null }`
3. `onMounted(() => { load(); loadCats() })` — оба load вызываются если нужны
4. `handleCreate`:
   - Навигация на карточку нового товара (или reload list) — явная логика
   - `newProduct.value` сбрасывается после создания
   - `showCreateModal.value = false` закрывается
5. `confirmDelete` — проверяет `deletingId.value` перед вызовом
6. Кнопки submit: `:disabled="!name.trim() || creating"` — правильные условия
7. Feature flags используются только там где надо (v-if в template)

**После завершения:** добавить найденные баги в BUGS_FILE → **СТОП**

---

### Промпт 18 — Файл: [Domain]Page.vue — template

**Фокус:** template list-страницы — биндинги, data-test, структура.

**Алгоритм — прочитать файл целиком:**

1. **data-test** на каждом: page root, header, table/panel, search, row, empty, модалы
2. **`@click.stop`** на delete-кнопке внутри кликабельной строки — иначе row click тоже срабатывает
3. **Пустое состояние**: `v-if="!loading && items.length === 0"` — не просто `v-if="items.length === 0"` (иначе мигает во время загрузки)
4. **Таблица**: `v-else` (не `v-if="items.length > 0"`) — иначе оба рендерятся при items=[] + loading=false
5. **Delete modal**: кнопка удаления `btn-danger`, кнопка отмены `btn-secondary`
6. **Create modal footer**: кнопка submit `:disabled="!newProduct.name.trim() || creating"`
7. **Модалы**: `v-model="showModal"` / `:title="t('...')"` / `size="small"` на AppModal
8. **Фильтры внутри GlassPanel** (pitfall #19) — не снаружи панели
9. Все `t('products.X')` — ключи существуют (из Промпта 6)
10. Все `{ name: 'X' }` — routes существуют (из Промпта 10)

**После завершения:** добавить найденные баги в BUGS_FILE → **СТОП**

---

### Промпт 19 — Файл: [Domain]CardPage.vue — script setup

**Фокус:** script block card-страницы.

**Алгоритм — прочитать файл целиком:**

1. `id = route.params.id as string` — ID получается из route params
2. Все поля из composable деструктурируются: `{ product, loading, saving, form, fieldValues, isAnythingDirty, load, save, discard }`
3. `useHead` с computed: `computed(() => product.value?.name ?? t('...'))`
4. Computed-адаптер для priceUnit (или другого nullable enum): `null ↔ ''`
5. `priceUnitOptions` содержит пустую опцию `{ value: '', label: '—' }` первой — для сброса
6. `onMounted(load)` присутствует
7. Нет лишних `ref` или `reactive` которые дублируют логику composable
8. Все импорты используются (SvgIcon если нет `<SvgIcon>` в template → лишний)
9. `showSupplierLinks` = `useFeatureFlag('productSupplierLinks')` или аналог

**После завершения:** добавить найденные баги в BUGS_FILE → **СТОП**

---

### Промпт 20 — Файл: [Domain]CardPage.vue — template

**Фокус:** template card-страницы — полнота секций, биндинги, dynamic fields.

**Алгоритм — прочитать файл целиком:**

1. **Секции** — все секции из ТЗ присутствуют: основное, цена, динамические поля, доп. секции
2. **`:title` prop** на каждом GlassPanel — не `<h2>` внутри panel body
3. **Save bar**: `v-if="isAnythingDirty"` — только при наличии изменений
4. **Save bar кнопки**: обе имеют `:disabled="saving"`; первая `btn-secondary` (discard), вторая `btn-primary` (save)
5. **Read-only поля** (категория, дата создания): `<input :value="..." readonly class="glass-input">` — не `<span>`
6. **Динамические поля** — все типы в v-else-if: text / number / email / date / boolean / enum / file
   - `file` → `<DropZone hint="..." @uploaded="...">` с отдельным `<span>` для fileId preview
7. **Inherited badge** на `v-if="fv.inherited"` полях
8. **Suppliers empty state** — условие покрывает `!product || product.linkedSuppliers.length === 0`
9. **Suppliers table row** — `@click` ведёт на правильный route с `{ id: s.id }`
10. **data-test** на каждой секции: info, price, fields, suppliers (если есть)
11. Все `t('...')` ключи существуют

**После завершения:** добавить найденные баги в BUGS_FILE → **СТОП**

---

## Формат добавления бага в BUGS_FILE

При обнаружении бага — добавить В ХОД ТЕКУЩЕГО промпта:

```markdown
## БАГ-[N] — [Краткое название]

**Файл:** `[путь]`  
**Серьёзность:** Высокая / Средняя / Низкая — [причина]

### Проблема

[Что именно не так. Что происходит в runtime / что видит пользователь]

### Исправление

[Что нужно сделать — конкретно]

### Правило на будущее

[Как избежать повторения]
```

И добавить строку в итоговую таблицу в конце BUGS_FILE:
```
| БАГ-[N] | [Тип] | `[файл]` | [Суть в одной строке] |
```

---

## СТОП — формат после каждого промпта

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏸ СТОП — Промпт [N]/20: [Название проверки]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Результат: ✅ Чисто  /  ❌ Найдено [N] проблем

[Список: БАГ-X — краткое название (файл:строка)]

Добавлено в bugs-файл: да / нет (чисто)

Следующий — Промпт [N+1]/20: [Название следующего]
Запустить?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## После Промпта 20

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Pre-manual-check завершён — все 20 промптов
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Итого найдено новых багов: [N]
Bugs-файл: {BUGS_FILE}

Следующий шаг:
1. Исправить все новые баги (каждый с typecheck + lint)
2. Передать на ручное тестирование
3. После ручного теста → Playwright E2E (последний Промпт плана)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
