# Checkpoint 0 — Страница 1.2 Категории

> Подтверди этот файл, прежде чем я перейду к Промпт 1 (API-контракт).

---

## Page goal

Управление иерархическим деревом категорий номенклатуры — создание, редактирование и удаление категорий, каждая из которых задаёт набор кастомных полей (dynamic properties), которые автоматически наследуются всеми товарами в ней.

---

## Sections — CategoriesPage (список)

| data-test | Содержимое |
|---|---|
| `categories-header` | `<h1 class="page-title">Категории</h1>` + кнопка «Создать категорию» |
| `categories-filters` | SearchInput по названию |
| `categories-table` | Таблица: Название (с отступом по уровню), Родитель, Полей, Товаров, Actions (перейти / удалить) |
| `categories-empty` | Пустое состояние (нет категорий) |
| `category-create-modal` | Модал «Создать категорию»: name (required), parentId (CustomSelect, optional) |
| `category-delete-modal` | Модал подтверждения удаления |

## Sections — CategoryCardPage (карточка)

| data-test | Содержимое |
|---|---|
| `category-header` | `<h1 class="page-title">{category.name}</h1>` + BackButton → `/admin/products/categories` |
| `category-info` | Секция «Основное»: name (input), parentId (CustomSelect, optional), description (textarea, optional) |
| `category-inherited-fields` | Секция «Наследованные поля» — read-only список полей родителей; скрыта если parentId = null |
| `category-own-fields` | Секция «Собственные поля» — drag-and-drop список + кнопка «Добавить поле» |
| `category-save-bar` | Save bar — **всегда видна** на карточке; кнопка «Сохранить» `disabled` по умолчанию, активна при `isDirty \|\| fieldsChanged` |
| `category-field-modal` | Модал поля: name, type (CustomSelect), required (чекбокс), options[] (TagInput, только для enum) |

---

## Key entities

```ts
interface Category {
  id: string
  name: string
  parentId: string | null
  description: string | null
  fieldCount: number
  productCount: number
  inheritedFields: CategoryField[]   // поля всех родителей, read-only
  fields: CategoryField[]            // собственные поля
}

interface CategoryListItem {
  id: string
  name: string
  parentId: string | null
  parentName: string | null
  fieldCount: number
  productCount: number
}

interface CategoryField {
  id: string
  name: string
  type: 'text' | 'number' | 'boolean' | 'enum' | 'email' | 'date' | 'file'
  required: boolean
  order: number
  options: string[]   // [] если type !== 'enum'
}

interface CategoryFilters {
  search: string
}
```

---

## User actions

**CategoriesPage:**
- Ввод в SearchInput — фильтр по name (клиентская фильтрация)
- Клик «Создать категорию» → открыть `category-create-modal`
- Submit модала создания → POST /api/categories (quick-action)
- Клик по строке → переход в CategoryCardPage
- Клик «Удалить» → открыть `category-delete-modal`
- Confirm удаления → DELETE /api/categories/:id (quick-action)
- Escape / клик на overlay → закрыть любой модал

**CategoryCardPage:**
- Изменить name / description / parentId → sets `isDirty`
- Drag-and-drop поля → reorder → sets `fieldsChanged`
- Клик «Добавить поле» → открыть `category-field-modal` (режим add)
- Клик «Edit» на поле → открыть `category-field-modal` (режим edit)
- Submit модала поля → add/edit в `localFields` → sets `fieldsChanged`
- Клик «Delete» на поле → убрать из `localFields` → sets `fieldsChanged`
- Escape / клик на overlay → закрыть модал поля
- Клик «Сохранить» → `Promise.all([PATCH если isDirty, PUT если fieldsChanged])`
- Клик «Отмена» → discard локальный state, reload с сервера

---

## Related pages

- **1.1 Товары** — товар выбирает категорию и отображает унаследованные поля из неё
- **AdminSidebar** — nav-link в секции «Товары»

---

## API endpoints

| Method | Path | Response | Примечание |
|---|---|---|---|
| GET | `/api/categories` | `PaginatedResponse<CategoryListItem>` | фильтры: search, page, pageSize |
| GET | `/api/categories/:id` | `ApiResponse<Category>` | с inheritedFields + fields |
| POST | `/api/categories` | `ApiResponse<CategoryListItem>` | body: name, parentId?, description? |
| PATCH | `/api/categories/:id` | `ApiResponse<Category>` | delta: name?, parentId?, description? |
| DELETE | `/api/categories/:id` | `ApiResponse<void>` | 409 если productCount > 0 |
| PUT | `/api/categories/:id/fields` | `ApiResponse<CategoryField[]>` | bulk replace всего массива полей |

---

## Save mode

| Страница | Режим | Детали |
|---|---|---|
| CategoriesPage | **quick-action** | POST и DELETE применяются мгновенно, нет Save bar |
| CategoryCardPage | **clean-slate** | `useDirtyCheck` для основных полей; `localFields` ref для полей; `fieldsChanged` computed (JSON сравнение); Save bar **всегда видна**, кнопка `disabled` пока нет изменений; Save = `Promise.all([PATCH если isDirty, PUT если fieldsChanged])`; discard = reload с сервера |

---

## Existing components to reuse

| Компонент | Где используется |
|---|---|
| `GlassPanel` | Обёртка каждой секции |
| `AppModal` | Все модалы (create, delete, field) |
| `CustomSelect` | Выбор родительской категории, выбор типа поля |
| `SearchInput` | Поиск в списке |
| `TagInput` | options[] для enum-поля |
| `SvgIcon` | Иконки кнопок |
| `InputGroup` | label + input в формах модалов |

---

## Existing types to reuse

| Тип | Файл |
|---|---|
| `ApiResponse<T>` | `src/types/api.ts` |
| `PaginatedResponse<T>` | `src/types/api.ts` |

> `FieldType` из `src/types/config.ts` **не подходит** — CategoryField имеет расширенный список: добавлены `email`, `date`, `file`. Определяем свой `CategoryFieldType`.

---

## Route paths

| Путь | Route name |
|---|---|
| `/admin/products/categories` | `admin-categories` |
| `/admin/products/categories/:id` | `admin-category-card` |

> Вопрос: устраивает `/admin/products/categories` (подраздел «Товары»)? Или предпочитаешь `/admin/categories`? Скажи до перехода к Промпт 1.

---

## Feature flag

`adminCategories`
