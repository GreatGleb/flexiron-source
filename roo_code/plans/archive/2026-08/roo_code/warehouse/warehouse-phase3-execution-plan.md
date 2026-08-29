# Инструкция для нового чата — Warehouse Phase 3–6

## Текущее состояние

### Что уже сделано (Фазы 1–2 + доработки)
- ✅ **Фаза 1** — Инфраструктура: типы (`types/warehouse.ts`), сервис (`services/warehouseService.ts`), моки (`services/mocks/warehouse.ts`), i18n (`i18n/admin/warehouse.ts`), feature flags
- ✅ **Фаза 2** — Главная страница склада: `useWarehouse.ts`, `WarehousePage.vue` (5 вкладок: Stock, Batches, Offcuts, Movements, Deficit), CSS, роуты
- ✅ **Доработки Phase 2** (сабтаски 1–9): баг-фиксы i18n/CSS/watcher, рефактор mock-данных (5 файлов), серверная фильтрация Stock, фильтры для Batches/Offcuts/Movements, тултипы Batches, сортировка Deficit, фикс flicker

### Что НЕ сделано (нужно реализовать)

| Фаза | Пункты плана | Описание |
|------|-------------|----------|
| **Фаза 3** | 12–14 | Карточка партии (`WarehouseBatchCard.vue`) |
| **Фаза 4** | 15–18 | Модалки: CreateBatchModal, CreateMovementModal, CreateOffcutModal |
| **Фаза 5** | 19–21 | Composables для Offcuts/Deficit, доработка вкладок |
| **Фаза 6** | 22–23 | E2E тесты |

### Важные замечания
- **Expandable rows (сабтаск 10) отменён** — будет реализован позже, не в этом чате
- Все файлы откачены до коммита `6c57141`

---

## Инструкция для нового чата

### 1. Формат промптов

Каждый промпт должен быть максимально подробным и содержать:

```
## Задача: [название]

### Что нужно сделать
[описание задачи]

### Файлы для изменения
- `path/to/file.ts` — что менять
- `path/to/file.vue` — что менять

### Контекст
[ссылки на существующие файлы, типы, сервисы]

### Критерии готовности
- [ ] пункт 1
- [ ] пункт 2
```

### 2. Использование сабтасков

Каждую фазу разбивать на сабтаски. Каждый сабтаск — отдельный промпт в новом чате.

**Фаза 3 — Карточка партии (3 сабтаска):**
1. Создать `useWarehouseBatch.ts` composable
2. Создать `WarehouseBatchCard.vue` (форма, файлы, обрезки, движения, аудит)
3. Добавить роут `/admin/warehouse/batches/:id`

**Фаза 4 — Модалки (4 сабтаска):**
1. CreateBatchModal.vue — модалка прихода товара
2. CreateMovementModal.vue — модалка расхода/списания
3. CreateOffcutModal.vue — модалка "Отрезать"
4. `useWarehouseMovement.ts` composable

**Фаза 5 — Обрезки и дефицит (2 сабтаска):**
1. `useWarehouseOffcuts.ts` + `useWarehouseDeficit.ts` composables
2. Доработка вкладок Offcuts и Deficit на WarehousePage

**Фаза 6 — E2E тесты (2 сабтаска):**
1. API моки через Playwright route interception
2. `warehouse.spec.ts` — тест-кейсы

### 3. Правила для каждого промпта

1. **Указывать точные пути** к файлам, которые нужно создать/изменить
2. **Давать ссылки на существующие типы** из `types/warehouse.ts`
3. **Давать ссылки на существующие сервисы** из `services/warehouseService.ts`
4. **Указывать какие компоненты UI использовать** (CustomSelect, DatePicker, AppModal и т.д.)
5. **Указывать какие composables использовать** (usePagination, useDirtyCheck, useToast)
6. **Указывать i18n ключи** которые нужно добавить в `i18n/admin/warehouse.ts`
7. **Указывать стили** которые нужно добавить в `styles/admin/warehouse_list.css`
8. **Указывать test-id атрибуты** для будущих E2E тестов

### 4. Структура файлов проекта

```
frontend_vue/src/
  types/warehouse.ts           — все типы (BatchStatus, OffcutStatus, и т.д.)
  services/warehouseService.ts — API сервис
  services/mocks/warehouse.ts  — мок-данные и мок-функции
  composables/useWarehouse.ts  — основной composable для WarehousePage
  composables/usePagination.ts — пагинация
  composables/useDirtyCheck.ts — dirty check для форм
  composables/useToast.ts      — уведомления
  views/admin/warehouse/
    WarehousePage.vue          — главная страница (5 вкладок)
    WarehouseBatchCard.vue     — карточка партии (нужно создать)
  components/admin/
    ui/CustomSelect.vue        — выпадающий список
    ui/DatePicker.vue          — выбор даты
    ui/SearchInput.vue         — поиск
    ui/MultiSelect.vue         — мультивыбор
    ui/AppModal.vue            — модальное окно
    GlassPanel.vue             — панель с загрузкой
    SvgIcon.vue                — иконки
  i18n/admin/warehouse.ts      — переводы (ru/en/lt)
  styles/admin/warehouse_list.css — стили
  router/index.ts              — роуты
```

### 5. План на новый чат (порядок выполнения)

```
Фаза 3 (сабтаск 1) → Фаза 3 (сабтаск 2) → Фаза 3 (сабтаск 3) →
Фаза 4 (сабтаск 1) → Фаза 4 (сабтаск 2) → Фаза 4 (сабтаск 3) → Фаза 4 (сабтаск 4) →
Фаза 5 (сабтаск 1) → Фаза 5 (сабтаск 2) →
Фаза 6 (сабтаск 1) → Фаза 6 (сабтаск 2)
```

Каждый сабтаск выполнять в отдельном чате, начиная с подробного промпта.
