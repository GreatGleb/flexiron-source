# Инвентаризация планов — часть 008

Пачка: `roo_code/plans/bugs` (UI-баги: клиенты, CustomSelect, DatePicker, фликер фильтров, отступы формы, скелетоны)
Проверено: 2026-08-26. Код не менялся.

Итог пачки: все шесть планов реализованы. Ни одного «не начато».

---

## 1. roo_code/plans/bugs/fix-clients-list-ui-bugs.md — **сделано**

Незакрытых чекбоксов: 0 (`grep -c "^[[:space:]]*- \[ \]"` → 0).

Файлы плана: `frontend_vue/src/views/admin/products/ProductsPage.vue`,
`frontend_vue/src/styles/admin/products_list.css`,
`frontend_vue/src/views/admin/clients/ClientsListPage.vue`,
`frontend_vue/src/styles/admin/clients_list.css`,
`frontend_vue/src/i18n/admin/clients.ts`,
`frontend_vue/src/composables/useClients.ts`

### Доказательство

`grep -n "page-clients\|table-layout\|colgroup\|th-sort-btn\|pagination-bar" src/styles/admin/clients_list.css`:
```
2:.page-clients {          (display:flex; flex-direction:column; gap:24px)
9:.page-clients .page-header {   (flex, space-between, wrap, gap:16px)
17:.page-clients .page-header .page-title { margin: 0 }
22:.page-clients .filters-bar {   (position:relative; z-index:10)
31:.page-clients .filters-bar:has(.custom-select-list.open) { z-index: 200 !important }
68:.page-clients .filters-bar .filter-group:first-child { flex: 1 1 320px; max-width: 420px }
160:.page-clients .data-table { table-layout: fixed }
166-190: .col-name/.col-code/.col-vat/.col-addr/.col-phone/.col-email/.col-status/.col-actions
200:.page-clients .data-table th:last-child, td:last-child
230:.th-sort-btn   250:.sort-icon-group   259:.sort-icon   265:.sort-icon.active
320:.page-clients .pagination-bar  336:.pagination-nav  342:.pagination-pages
348:.page-btn  366:.page-btn.active  372:.pagination-info  377:.pagination-ellipsis
```

`grep -n "..." src/views/admin/clients/ClientsListPage.vue`:
```
13:import Pagination from '@/components/admin/ui/Pagination.vue'
67:const showingFrom = computed(...)
70:const pageNumbers = computed(...)
210:  <div class="page-clients" data-test="page-clients">
217:    <div class="page-header" data-test="clients-header">
234:        <span>{{ t('clients.filters') }}</span>
291-300: <colgroup> с восемью <col class="col-*">
304/329/350: <button class="th-sort-btn" @click="toggleSort('name'|'email'|'status')">
428: <Pagination v-model:page ... :pages="pageNumbers" :showing-from ... />
```

`grep -n "filters:" src/i18n/admin/clients.ts` → `7: filters: 'Фильтры'`, `110: filters: 'Filters'`, `213: filters: 'Filtrai'` — все три локали.

`cat src/composables/useClients.ts` → `const { page, pageSize, total, totalPages } = pagination`,
в return отдаются `page, pageSize, total, totalPages, pagination, toggleSort` — старые поля сохранены (требование Merge-note выполнено).

Иконки в колонке действий (строки 402-420) — `<SvgIcon name="external-link">` и `<SvgIcon name="trash">`;
`grep -n "eye"` по файлу пуст, инлайновых SVG в ячейке действий нет.

### Отклонения (не задачи)
- Сортируемые колонки — Name / Email / Status, а не Name / Company Code / Status. План сам оговаривал «Check if backend supports sorting»; тип `ClientFilters.sortBy` допускает ровно `name|email|status`. Решение осознанное.
- Обёртка осталась `.page-clients` / `.page-header` (переименования в `clients-page`/`clients-header` не было) — CSS-блок плана написан под те же имена, что в коде.
- Пагинация вынесена в общий компонент `Pagination.vue`, а не скопирована разметкой из ProductsPage — то же поведение, меньше дублирования.
- `.page-clients .glass-panel { padding-bottom: 0 }` из плана в CSS нет; отбивка сделана правилом `.stock-table-area + .pagination-bar, .data-table-wrapper + .pagination-bar` в warehouse_list.css и `.page-clients .pagination-bar` (320) с padding 12px 16px.

---

## 2. roo_code/plans/bugs/fix-customselect-placeholder-bug.md — **сделано**

Незакрытых чекбоксов: 0.

Файлы плана: `frontend_vue/src/components/admin/ui/CustomSelect.vue`,
`frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue`,
`frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue`

### Доказательство

`sed -n 1,60p src/components/admin/ui/CustomSelect.vue`:
```
12  const props = defineProps<{
13    modelValue: string | null
14    options: SelectOption[]
15    openUp?: boolean
16    placeholder?: string
17    disabled?: boolean
18  }>()
27  const selectedLabel = computed(() => {
28    if (!props.modelValue && props.placeholder) return props.placeholder
29    const opt = props.options.find((o) => o.value === props.modelValue)
30    return opt?.label ?? opt?.value ?? ''
31  })
58    <span :class="{ placeholder: !modelValue && placeholder }">{{ selectedLabel }}</span>
```
Шаг 1 выполнен буквально, плюс отдельный класс `.placeholder` (есть правило:
`src/styles/admin/components/_custom-select.css:16 .custom-select-trigger .curr-val .placeholder`).

`grep -n "placeholder\|const type" src/views/admin/warehouse/CreateMovementModal.vue`:
```
54:const type = ref<MovementType | ''>('')
672:            :placeholder="t('warehouse.movement_modal_type_placeholder')"
```
Шаг 2 выполнен, и дефолт действительно сменён с `'expense'` на `''`, так что плейсхолдер виден при открытии.

Ключ существует во всех трёх локалях: `grep -rn "movement_modal_type_placeholder" src/i18n/` →
`warehouse.ts:304` (ru), `:983` (en), `:1664` (lt).

### Отклонение
`WarehouseBatchCard.vue` больше не рисует селект типа операции сам: `grep -n "CreateMovementModal\|CustomSelect"`
даёт `18:import CreateMovementModal from './CreateMovementModal.vue'` и `1532: <CreateMovementModal`.
То есть строка 940 из плана уже не существует, а плейсхолдер приходит из модалки — пункт «изменений не нужно» выполнен сильнее, чем задумывалось.

---

## 3. roo_code/plans/bugs/fix-datepicker-styling.md — **сделано**

Незакрытых чекбоксов: 0.

Файлы плана: `frontend_vue/src/components/admin/ui/DatePicker.vue`,
`frontend_vue/src/views/admin/products/ProductCardPage.vue`,
`frontend_vue/src/components/admin/SupplierFormSections.vue`,
`frontend_vue/src/views/admin/warehouse/WarehousePage.vue`

### Доказательство

`grep -rn 'type="date"' src/` → пусто (ни одного нативного date-инпута во всём фронтенде).

`grep -n "DatePicker" src/views/admin/warehouse/WarehousePage.vue` → `27:import DatePicker from '@/components/admin/ui/DatePicker.vue'`,
использования на 1009, 1018 (batches) и 1156, 1165 (movements).

`sed -n 1007,1024p src/views/admin/warehouse/WarehousePage.vue`:
```
<DatePicker
  :model-value="batchesFilters.dateFrom ?? ''"
  :placeholder="t('warehouse.filter_date_from')"
  data-test="warehouse-batches-date-from"
  @update:model-value="(v: string) => (batchesFilters.dateFrom = v || undefined)"
/>
```
Шаблон замены совпадает с планом дословно (плюс `:placeholder`), включая `?? ''` и `v || undefined`.

Сверх плана: та же замена сделана и на вкладке движений (dateFrom/dateTo, строки 1156-1169).

---

## 4. roo_code/plans/bugs/fix-filter-transition-flicker.md — **сделано**

Незакрытых чекбоксов: 0.

Файлы плана: `frontend_vue/src/views/admin/warehouse/WarehousePage.vue`

### Доказательство

Шаг 1 — `sed -n 638,690p src/views/admin/warehouse/WarehousePage.vue`:
```
function syncTableRowHeights(): Promise<void> {
  ...
  if (!fixedTbody || !scrollTbody) return Promise.resolve()
  // Pass 1: Reset all heights ...
  // Pass 2: Double requestAnimationFrame guarantees browser reflow is complete.
  return new Promise((resolve) => {
    requestAnimationFrame(() => { requestAnimationFrame(() => { ...; resolve() }) })
  })
}
```
Тело совпадает с планом построчно, включая синхронизацию thead.

Шаг 2 — `sed -n 386,411p`:
```
async function startFilterTransition() {
  if (skipStockTransition.value) { ...; await nextTick(); await syncTableRowHeights(); return }
  if (filterTimer) clearTimeout(filterTimer)
  filteringStock.value = true
  await nextTick()
  await Promise.all([ syncTableRowHeights(), new Promise((resolve) => { setTimeout(resolve, 500) }) ])
  filteringStock.value = false
}
```

Шаг 3 — остальные вызовы без await: строки 634, 712 (onMounted, двойной nextTick), 724 (ResizeObserver), 751 (watch stockItems).

Шаг 4 — шаблон: `1332: <div ... class="stock-table-area">`,
`1337: <div :class="['stock-table-split', { 'stock-table-hidden': filteringStock }]">`,
`1303: :loading="stockLoading || filteringStock"`, `1304: :class="{ 'filtering-stock': filteringStock }"`.
CSS: `src/styles/admin/warehouse_list.css:75 .stock-table-hidden { opacity: 0 }` и
`:81 .stock-table-split { transition: opacity 0.5s ease }`.

### Отклонения (не задачи)
- Скелетон теперь не отдельный `v-show`-оверлей внутри `.stock-table-area`, а скелетон самого `GlassPanel`
  (`:loading="stockLoading || filteringStock"`), поэтому `.stock-table-area { position: relative }` в CSS не понадобилось —
  `grep -n "stock-table-area" src/styles/admin/warehouse_list.css` даёт только правило-соседа на 962.
- `.stock-table-hidden` реализован через `opacity: 0` с переходом 0.5s, а не `visibility: hidden`; из-за этого в
  `Promise.all` добавлен минимальный показ скелетона 500 мс. Цель плана (таблица не видна пока идут два прохода) достигнута.
- Добавлена ветка `skipStockTransition` для смены страницы пагинации — этого в плане не было.

---

## 5. roo_code/plans/bugs/fix-form-field-spacing.md — **сделано**

Незакрытых чекбоксов: 0.

Файлы плана: `frontend_vue/src/styles/admin/components/_forms.css`,
`frontend_vue/src/styles/admin/main.css`,
`frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue`,
`frontend_vue/src/views/admin/warehouse/CreateBatchModal.vue`,
`frontend_vue/src/views/public/LoginPage.vue`,
`frontend_vue/src/views/public/RegisterPage.vue`,
`frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue`,
`frontend_vue/src/views/admin/warehouse/WarehouseStockCard.vue`,
`frontend_vue/src/views/admin/warehouse/WarehouseOffcutCard.vue`,
`frontend_vue/src/views/admin/products/ProductCardPage.vue`,
`frontend_vue/src/views/admin/products/CategoryCardPage.vue`,
`frontend_vue/src/views/admin/suppliers/SupplierCardPage.vue`

### Доказательство

Утверждение плана «No CSS definition exists for .form-group in any stylesheet» устарело —
`grep -rn "^\.form-group\|^\.form-row\|form-group-flex\|form-group-shrink" src/styles/`:
```
src/styles/admin/components/_forms.css:46 .form-group   :51 .form-row   :55 .form-row .form-group
                                      :58 .form-group-flex   :61 .form-group-shrink
src/styles/admin/main.css:414 .form-group  :417 .form-row  :421 .form-row .form-group
                          :424 .form-group-flex  :427 .form-group-shrink
src/styles/public/public.css:219 .form-group
```

Шаг 1, `sed -n 44,63p src/styles/admin/components/_forms.css`:
```
/* Form group (used in CreateMovementModal, ClientCardPage, LoginPage, RegisterPage) */
.form-group { margin-bottom: 20px; }
.form-row { display: flex; gap: 16px; }
.form-row .form-group { margin-bottom: 0; }
.form-group-flex { flex: 1; }
.form-group-shrink { flex: 0 0 auto; }
```
Шаг 2 — те же правила в `main.css:414-428` рядом с `.input-group` (411).

Шаг 3 — брейкпоинты, `_forms.css` 109-160 и `main.css` 455-505: 992px → form-group 16px, form-row gap 12px;
600px → form-group 14px, form-row column/gap 0, `.form-row .form-group` 14px; 400px → form-group 12px.
Совпадает с планом до значений. `.input-group` не тронут (20/16/14/12 на месте) — требование «entity card pages unaffected» выполнено.

### Отклонение
В `.form-row .form-group` нет `flex: 1` из сниппета плана — вместо него отдельный класс `.form-group-flex { flex: 1 }`,
который в плане тоже есть. Растяжение выбирается точечно, а не навязывается всем.

---

## 6. roo_code/plans/bugs/fix-loading-skeleton-prompts.md — **сделано**

Незакрытых чекбоксов: 0.

Файлы плана: `frontend_vue/src/views/admin/analytics/DeficitPage.vue`
(упомянуты также `main.css` — как источник класса `.skeleton` — и `GlassPanel`).

Важно: файл — обрывок большого набора промптов, в нём осталась только секция «## 7. DeficitPage.vue».
Требований к остальным страницам аналитики в этом файле нет, поэтому проверялась одна страница.

### Доказательство

`grep -n "loading\|skeleton\|GlassPanel" src/views/admin/analytics/DeficitPage.vue`:
```
4:import GlassPanel from '@/components/admin/GlassPanel.vue'
16:  <!-- Loading skeleton -->
17:  <template v-if="loading">
21:    <div class="skeleton" style="width: 24px; height: 24px; border-radius: 50%; margin: 0" />
23:  <div class="kpi-label"><div class="skeleton" style="width: 70%; height: 14px" /></div>
24:  <div class="kpi-value"><div class="skeleton" style="width: 60%; height: 22px" /></div>
25:  <div class="kpi-delta"><div class="skeleton" style="width: 40%; height: 12px" /></div>
29:  <GlassPanel :loading="true" :skeleton-rows="5" />
30:  <GlassPanel :loading="true" :skeleton-rows="5" />
```
Разметка совпадает с планом дословно (различия только в форматировании prettier).
Строки `<div v-if="loading" class="loading-state">` в файле нет.
