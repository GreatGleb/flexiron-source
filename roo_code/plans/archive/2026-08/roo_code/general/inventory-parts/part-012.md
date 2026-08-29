# Инвентаризация планов — часть 012

## roo_code/plans/categories/02-categories-checkpoint0.md

**Вердикт: сделано** (с отклонениями в именах `data-test` и в месте фильтрации поиска — см. «Что осталось»)

Незакрытых чекбоксов: 0 (`grep -c "^[[:space:]]*- \[ \]"` → `0`).

Это checkpoint-0 (спека до реализации), а не чек-лист задач. Проверялось, существует ли
описанное в коде.

### Доказательство

```
$ find frontend_vue/src -iname "*categor*" | sort
frontend_vue/src/composables/useCategories.ts
frontend_vue/src/composables/useCategoryCard.ts
frontend_vue/src/i18n/admin/categories.ts
frontend_vue/src/services/categoriesService.ts
frontend_vue/src/services/mocks/categories.ts
frontend_vue/src/styles/admin/categories_card.css
frontend_vue/src/styles/admin/categories_list.css
frontend_vue/src/types/category.ts
frontend_vue/src/views/admin/products/CategoriesPage.vue
frontend_vue/src/views/admin/products/CategoryCardPage.vue
```

Роуты и фича-флаг — ровно как в плане:

```
$ sed -n '228,239p' frontend_vue/src/router/index.ts
      {
        path: 'products/categories',
        name: 'admin-categories',
        component: () => import('@/views/admin/products/CategoriesPage.vue'),
        meta: { layout: 'admin', featureFlag: 'adminCategories' as FeatureFlagKey },
      },
      {
        path: 'products/categories/:id',
        name: 'admin-category-card',
        component: () => import('@/views/admin/products/CategoryCardPage.vue'),
        meta: { layout: 'admin', featureFlag: 'adminCategories' as FeatureFlagKey },
      },
$ grep -n "adminCategories" frontend_vue/src/config/featureFlags.ts frontend_vue/src/types/features.ts
frontend_vue/src/config/featureFlags.ts:19:  adminCategories: true,
frontend_vue/src/types/features.ts:16:  adminCategories: boolean
```

Открытый вопрос плана («устраивает `/admin/products/categories`?») решён в пользу
`products/categories`.

Типы (`frontend_vue/src/types/category.ts`) — все четыре сущности плана есть:
`CategoryFieldType` со своим расширенным списком (`text | number | boolean | enum |
email | date | file`), `CategoryField`, `Category`, `CategoryListItem`, `CategoryFilters`.
Отличия от плана — надмножество: `name`/`description`/`options`/`parentName` типизированы
как `TranslatedString`, а не `string`; у `Category` добавлено `linkedSuppliers:
LinkedSupplier[]`; у `CategoryListItem` добавлен `level: number` (для отступа по уровню).

Все шесть эндпоинтов плана — в `frontend_vue/src/services/categoriesService.ts`:

```
GET    /api/categories                 getCategories(filters, page, pageSize)
GET    /api/categories/:id             getCategory
POST   /api/categories                 createCategory
PATCH  /api/categories/:id             patchCategory
DELETE /api/categories/:id             deleteCategory
PUT    /api/categories/:id/fields      putCategoryFields
```

Условие «409 если productCount > 0» реализовано в моке:

```
$ sed -n '1460,1465p' frontend_vue/src/services/mocks/index.ts
  const categoryDeleteMatch = path.match(/^\/api\/categories\/([^/]+)$/)
  if (categoryDeleteMatch) {
    const result = mockDeleteCategory(categoryDeleteMatch[1] as string)
    if (!result.ok) throw new Error(result.code)
    return delay(undefined as T)
  }
```

Save mode карточки (clean-slate) — ровно как описан:

```
$ grep -n "isDirty\|fieldsChanged\|useDirtyCheck\|Promise.all\|localFields" frontend_vue/src/composables/useCategoryCard.ts
5:import { useDirtyCheck } from './useDirtyCheck'
33:  const dirty = useDirtyCheck(form)
36:  const localFields = ref<CategoryField[]>([])
38:  const fieldsChanged = computed(() => {
40:    return JSON.stringify(localFields.value) !== JSON.stringify(category.value.fields)
52:    () => dirty.isDirty.value || fieldsChanged.value || linkedSuppliersChanged.value,
88:      localFields.value = JSON.parse(JSON.stringify(data.fields))
104:      if (dirty.isDirty.value) Object.assign(patchDelta, dirty.diff())
111:      if (fieldsChanged.value) calls.push(putCategoryFields(id, localFields.value, locale.value))
112:      await Promise.all(calls)
```

Drag-and-drop полей есть (`frontend_vue/src/views/admin/products/CategoryCardPage.vue:381-385`
— `:draggable`, `@dragstart`, `@drop` → `reorderFields`).

Секции из таблиц плана — по `data-test`:

| план | в коде |
|---|---|
| `categories-header` | `categories-header` (CategoriesPage.vue:101) |
| `categories-filters` | `categories-filters` (:123) |
| `categories-table` | `categories-table` (:122) |
| `categories-empty` | `categories-empty` (:131) |
| `category-create-modal` | **`modal-create-category`** (:217) |
| `category-delete-modal` | **`modal-delete-category`** (:256) |
| `category-header` | **`category-card-header`** (CategoryCardPage.vue:266) |
| `category-info` | **`category-card-info`** (:305) |
| `category-inherited-fields` | `category-inherited-fields` (:336) |
| `category-own-fields` | `category-own-fields` (:363) |
| `category-save-bar` | `category-save-bar` (:278) |
| `category-field-modal` | **`modal-field`** (:482) |

Сверх плана: секция `category-supplier-links` с модалами добавления/удаления поставщика,
поле description в модале создания, e2e-спека
`frontend_vue/tests/e2e/admin/products/categories.spec.ts` со снапшотами.

### Что осталось

Ничего содержательного. Два расхождения со буквой плана, оба сознательные и не мешают:

1. Пять `data-test` названы иначе, чем в таблицах плана (см. выделенные в таблице выше) —
   принята схема `modal-*` / `category-card-*`. Тесты используют фактические имена.
2. Плану «клиентская фильтрация» по поиску не соответствует: `useCategories.ts:26`
   передаёт `filters` в `getCategories`, то есть фильтрация серверная (в моке).
3. Секция «Наследованные поля» скрывается по `category?.inheritedFields?.length`,
   а не по `parentId = null`, как формулирует план (поведение эквивалентно для дерева
   без пустых родителей).

### Пункты

Незакрытых чекбоксов нет — список пунктов пуст.
