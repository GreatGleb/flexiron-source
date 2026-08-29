# Инвентаризация планов — часть 010

Каталог: `roo_code/plans/bugs` (2 плана). Код не менялся; `git status` после проверки
чист (кроме этого каталога `inventory-parts/`).

---

## 1. `roo_code/plans/bugs/fix-translatedString-display-bugs.md`

**Вердикт: сделано**

**Незакрытых чекбоксов:** 0 (`grep -c "^[[:space:]]*- \[ \]" …` → `0`)

### Что требует план
Семь мест, где `TranslatedString` попадал в шаблон/модель без `tf()`, плюс подзадача 7 —
чистые `vue-tsc --noEmit` и `vite build` и поиск остаточных интерполяций.

### Доказательство целиком

Подзадача 1 — BccRequestPage. Строки 680/702 (`{{ group.categoryName }}`, `{{ p.name }}`)
на месте, но это уже **строки**, а не `TranslatedString`: computed `filteredProducts`
разворачивает объекты через `tf()` до попадания в шаблон.

```
$ grep -n "categoryName\|p\.name" src/views/admin/suppliers/BccRequestPage.vue
103:  const out: { id: string; name: string; categoryId: string; categoryName: string }[] = []
106:    const catName = tf(c.name)
108:      const prodName = tf(p.name)
110:      out.push({ id: p.id, name: prodName, categoryId: c.id, categoryName: catName })
128:  const groups: { categoryName: string; products: typeof slice }[] = []
680:                          {{ group.categoryName }}
702:                        <td>{{ p.name }}</td>
```

Подзадача 2 — аналитика:

```
$ grep -n "supplier\.name\|tf(" src/views/admin/analytics/SupplyPage.vue
53:        <div class="kpi-label">{{ tf(kpi.label) }}</div>
82:              <td>{{ tf(supplier.name) }}</td>
$ grep -n "client\.name" src/views/admin/analytics/SalesPage.vue
71:          <span class="bar-label">{{ tf(client.name) }}</span>
```

Подзадача 3 — оба файла в проекте отсутствуют; их удалили как мёртвые:

```
$ find src -iname "*AnalyticsCard*" -o -iname "*AlertsTable*"        → пусто
$ grep -rn "{{ *m\.label *}}\|{{ *row\.description *}}" src/         → none
$ git log --oneline --diff-filter=D --name-only -- \
    frontend_vue/src/components/admin/AnalyticsCard.vue \
    frontend_vue/src/components/admin/tables/AlertsTable.vue
4de625d refactor(warehouse): удалены пятнадцать мёртвых файлов и ссылки на них
frontend_vue/src/components/admin/AnalyticsCard.vue
frontend_vue/src/components/admin/tables/AlertsTable.vue
$ git ls-files | grep -i "analyticscard\|alertstable"                → not tracked
```

Подзадача 4 — ProductCardPage: computed-обёртка есть, `v-model="formDescription"`:

```
$ grep -n "formDescription\|form\.description" src/views/admin/products/ProductCardPage.vue
87:const formDescription = computed({
90:    form.value.description = v ? mergeLocaleValue(form.value.description, v, locale.value) : null
329:                  v-model="formDescription"
```

Подзадача 5 — CategoryCardPage: хардкод `{ ru: v, en: '', lt: '' }` убран:

```
$ grep -n "toTranslatedString\|mergeLocaleValue" src/views/admin/products/CategoryCardPage.vue
5:import { toTranslatedString, mergeLocaleValue } from '@/types/i18n'
70:    form.value.name = v ? mergeLocaleValue(form.value.name, v, locale.value) : null
84:    form.value.description = v ? mergeLocaleValue(form.value.description, v, locale.value) : null
147:    name: toTranslatedString(name, locale.value),
152:        ? fieldDraft.value.options.map((o) => toTranslatedString(o, locale.value))
```

Подзадача 6 — SupplierCardPage `onFilesUploaded`:

```
$ sed -n 41,52p src/views/admin/suppliers/SupplierCardPage.vue
41:function onFilesUploaded(uploaded: UploadedFile[]) {
46:      name: mergeLocaleValue(undefined, u.name, locale.value),
```

Подзадача 7 — приёмка:

```
$ npx vue-tsc --noEmit        → нулевой вывод, exit 0
$ npx vite build              → ✓ built in 8.38s (только warning про размер чанков)
```

Остаточный поиск `{{ x.(name|title|label|description|categoryName) }}` даёт 15 попаданий;
каждое проверено и типизировано как `string`:
`Breadcrumb.vue` (`items: { label: string }[]`), `TagInput.vue` (`{ value: string; label: string }`),
`FinanceSubNav.vue` (`tab.label`), `DocumentArchivePage.vue` (`finance.ts:65 name: string`),
`ClientsListPage.vue` / `SalesCrmPage.vue` / `OrderCreatePage.vue` (`client.ts:15 name: string`),
`WarehouseMapPage.vue` (`settings.ts:92 WarehouseMapFile.name: string`),
`WarehouseBatchCreatePage.vue:279`, `AddOrderItemsModal.vue:574`,
`WarehouseOffcutCreatePage.vue:309` — во всех трёх `group.categoryName: string`,
собирается через `tf(p.categoryName)` в computed.

### Что осталось
Ничего. Единственное расхождение с буквой плана — подзадача 3: файлов
`AnalyticsCard.vue` и `AlertsTable.vue` больше нет (удалены в `4de625d`), так что
описанный в них баг физически не может проявиться.

### Наблюдение вне плана (не требование)
Хардкод `{ ru: X, en: X, lt: X }` остался в местах, которые план не перечислял:
`BccRequestPage.vue:308,401`, `SettingsLayout.vue:329,340,341,386`,
`SupplierCardConfigPage.vue:671`. Отдельная задача, если это вообще дефект.

---

## 2. `roo_code/plans/bugs/settings-notifications-bugs.md`

**Вердикт: частично**

**Незакрытых чекбоксов:** 0 (`grep -c "^[[:space:]]*- \[ \]" …` → `0`)

### Что требует план
Три бага с разделом «Fix»: БАГ-7 (`notificationsPage` в `ALL_FLAGS_ENABLED`),
БАГ-8 (`adminSettings` там же), БАГ-6 (`inject<any>('settings')` → `inject<AppSettings>`).
Плюс сводная таблица, где БАГ-1…5, 9, 11 помечены ✅ FIXED, а БАГ-10 оставлен открытым.

### Доказательство целиком

БАГ-7 и БАГ-8 — оба флага в списке:

```
$ grep -n "notificationsPage\|adminSettings" frontend_vue/tests/e2e/helpers/flags.ts
32:  adminSettings: true,
53:  notificationsPage: true,
```

БАГ-6 — ни одного `inject<any>` в настройках, все пять views типизированы:

```
$ grep -rn "inject" src/views/admin/settings/ | grep "'settings'"
src/views/admin/settings/FinanceSettings.vue:15:const settings = inject<AppSettings>('settings')!
src/views/admin/settings/OrderStatusesSettings.vue:12:const settings = inject<AppSettings>('settings')!
src/views/admin/settings/ProfileSettings.vue:13:const settings = inject<AppSettings>('settings')!
src/views/admin/settings/UnitsSettings.vue:12:const settings = inject<AppSettings>('settings')!
src/views/admin/settings/CompanySettings.vue:11:const settings = inject<AppSettings>('settings')!
$ grep -rn "inject<any>" src/views/admin/settings/        → пусто
```

БАГ-9 (structuredClone) и БАГ-11 (initialized) действительно на месте:

```
$ grep -n "structuredClone" src/services/mocks/notifications.ts
420:    items: structuredClone(items),
$ grep -n "initialized" src/composables/useNotifications.ts
23:let initialized = false
26:  if (!initialized) loading.value = true
35:    initialized = true
```

БАГ-1…5 (HTML-комментарии в `<template>`, питфол #9) — заявлено «FIXED», в двух файлах
комментарии остались:

```
$ for f in FinanceSettings OrderStatusesSettings ProfileSettings UnitsSettings SettingsLayout;
    do echo "$f: $(grep -c '<!--' src/views/admin/settings/$f.vue)"; done
FinanceSettings: 0
OrderStatusesSettings: 0
ProfileSettings: 1
UnitsSettings: 0
SettingsLayout: 3
$ grep -n "<!--" src/views/admin/settings/ProfileSettings.vue
128:    <!-- Secret Link Section -->        (шаблон начинается на 73)
$ grep -n "<!--" src/views/admin/settings/SettingsLayout.vue
487:    <!-- Loading skeleton -->
492:    <!-- Error state -->
740:    <!-- ─── Confirm default currency change ─── -->   (шаблон начинается на 467)
```

БАГ-10 (питфол #19: фильтры вне `GlassPanel`) — открыт, как план и говорит:

```
$ grep -n "filters-bar\|GlassPanel" src/views/admin/notifications/NotificationsPage.vue
141:    <div class="filters-bar" data-test="notifications-filters">
165:    <GlassPanel :loading="loading" :skeleton-rows="8" data-test="notifications-table">
```

`filters-bar` (141) стоит перед `GlassPanel` (165), то есть вне панели.
Заодно: файл лежит в `src/views/admin/notifications/NotificationsPage.vue`, а не по пути
из таблицы плана.

### Что осталось
- БАГ-10: перенести `filters-bar` внутрь `GlassPanel` таблицы (план сам помечает это
  «visual preference, low priority» — возможно, сознательно отклонено).
- Остаточные HTML-комментарии в шаблонах `ProfileSettings.vue` (1) и `SettingsLayout.vue` (3),
  хотя БАГ-3 и БАГ-5 в таблице отмечены ✅ FIXED. Из 11 в SettingsLayout осталось 3 —
  починка была неполной.
