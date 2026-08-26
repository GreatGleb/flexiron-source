# Инвентаризация планов — часть 029

Каталог: `roo_code/plans/refactor` (3 плана, чекбоксов ни в одном нет)

---

## 1. `roo_code/plans/refactor/refactor-client-card-page.md`

**Вердикт: сделано**

`grep -c "^[[:space:]]*- \[ \]"` → 0

### Доказательства

```
$ grep -n "section_contact" frontend_vue/src/i18n/admin/clients.ts
54:      section_contact: 'Контактные данные',
157:      section_contact: 'Contact Information',
260:      section_contact: 'Kontaktinė informacija',
```
Все три локали на месте (пункт 1 таблицы «Files to modify»).

```
$ grep -n "entity-card-grid|InputGroup|entity-not-found|btn-save|CustomSelect" \
    frontend_vue/src/views/admin/clients/ClientCardPage.vue
11:import InputGroup from '@/components/admin/ui/InputGroup.vue'
12:import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
146:        <div class="entity-card-grid">      <- скелетон загрузки
170:    <div class="entity-not-found" data-test="client-card-error">
239:              class="btn btn-save"
251:        <div class="entity-card-grid">      <- загруженное состояние
261..457: 12 обёрток <InputGroup>
```

Хлебные крошки (Key change 1) — три уровня, ровно как в плане:
```
{ label: t('side.sales'), to: { name: 'admin-sales-crm' } },
{ label: t('clients.title'), to: { name: 'admin-clients' } },
{ label: `${t('clients.card_title')} ${client.id} - ${client.name}` }
```

Header (Key change 2) — обёртка + h1 + кнопки, `btn-save` с `.dirty`/`.loading`:
```
<div class="client-card-header-row">
  ...<h1 class="page-title">...
  <button class="btn btn-secondary" @click="discard">{{ t('clients.btn_discard_changes') }}</button>
  <button class="btn btn-save" :class="{ dirty: isDirty, loading: saving }" ...>
```

Grid (Key change 3) — три колонки, `entity-card-grid` из
`src/styles/admin/components/_entity-card-layout.css:5` = `grid-template-columns: 1fr 2fr 1fr`;
LEFT `clients.section_general` (name / company_code / vat / notes),
CENTER `clients.section_contact` (address / phone / email),
RIGHT `clients.col_status` c `<CustomSelect>`.

Loading/error (Key change 5) — отдельный шаблон `v-if="loading"` c `GlassPanel :loading="true"`
и `v-else-if="error && !client"` c `entity-not-found` + `router-link` «назад к списку».

CSS переписан под flex:
```
$ grep -n "flex" frontend_vue/src/styles/admin/client_card.css | head
3:  display: flex;  4:  flex-direction: column;  10..40, 155..190 (медиа-запросы)
$ grep -rn "client-card-header-row" frontend_vue/src/styles/
client_card.css:16, :178, :184
```

### Что осталось
Ничего. Единственное расхождение с буквой плана — обёртка названа
`client-card-header-row`, а план писал `product-card-header-row`; правила под этот класс
в CSS есть (client_card.css:16), паттерн тот же.

---

## 2. `roo_code/plans/refactor/refactor-server-side-filtering-pagination.md`

**Вердикт: сделано**

`grep -c "^[[:space:]]*- \[ \]"` → 0. План описывает 6 шагов по вкладке Stock на складе.

### Доказательства по шагам

Шаг 1 — тип:
```
$ grep -n "StockOverviewResponse|interface StockFilters" frontend_vue/src/types/warehouse.ts
601:export interface StockFilters {
625:export type StockOverviewResponse = PaginatedResponse<StockOverviewItem>
```

Шаг 2 — сервис (`frontend_vue/src/services/warehouseService.ts:32-50`) принимает
`(filters: StockFilters, pagination: PaginationParams)` и шлёт `search`, `page`, `pageSize`,
`categoryIds`, `unit`, `showDeficitOnly`, `showInStockOnly` — и вдобавок `sortBy`/`sortDir`
(сверх плана).

Шаг 3 — мок `mockGetStockOverview` (`src/services/mocks/warehouse.ts:404-455`) фильтрует
на «сервере»: поиск по productName ru/en/lt + productId, categoryIds, unit, showDeficitOnly,
showInStockOnly, затем сортировка и `paginate`.

Шаг 4 — `src/services/mocks/index.ts:606-621`: обработчик `/api/warehouse/stock` разбирает
page/pageSize и передаёт все фильтры.

Шаг 5 — `src/composables/useWarehouse.ts:136` `const stockFilters = reactive<StockFilters>({...})`,
`:184 loadStock()` вызывает `getStockOverview(stockFilters, { page: stockPagination.page.value,
pageSize: stockPagination.pageSize.value })`, `:417` watch по `stockFilters` c `stockPagination.reset()`,
`:633` возвращает `stockFilters`.

Шаг 6 — `src/views/admin/warehouse/WarehousePage.vue`: локальных клиентских рефов нет,
```
$ grep -n "filteredStockItems|paginatedStockItems|const stockPage " WarehousePage.vue
(пусто)
```
вместо них `:84-85` деструктуризация `stockFilters, stockPagination`, шаблон на
`v-model="stockFilters.*"` (910, 918, 927, 935, 947) и `v-for="item in stockItems"` (1374).
Строки 229-233 и 340-352 — сохранение/восстановление пользовательских префов, они читают и
пишут `stockFilters`, а не свои рефы.

«What NOT to change»: `filteringStock`/`startFilterTransition` сохранены и привязаны к
загрузке композабла (`:366`, `:395`, `:1303-1304`).

### Что осталось
Ничего.

---

## 3. `roo_code/plans/refactor/refactor-server-translations-analytics.md`

**Вердикт: сделано**

`grep -c "^[[:space:]]*- \[ \]"` → 0. План: 7 шагов, увести аналитику с `resolveLabel()`
на данные с сервера типа `TranslatedString`.

### Доказательства по шагам

Шаг 1 — `frontend_vue/src/types/i18n.ts` существует, `export interface TranslatedString
{ ru; en; lt }` (+ хелпер `toTranslatedString`); `frontend_vue/src/composables/useTranslatedData.ts`
существует, `export function useTranslatedField()` возвращает `tf(field)` через `locale.value`
из `useI18n()` — переключение мгновенное, без запроса.

Шаг 2 — `src/types/analytics.ts:1` импортирует `TranslatedString`; поля переведены:
`:15 label`, `:33 type`, `:35 description`, `:41 label`, `:49 title`, `:55 label`, `:63 name`,
`:67 age`, `:74 label` — то есть больше, чем перечисляла таблица плана.

Шаг 5 — `src/services/mocks/analytics.ts`: 164 вхождения `ru:`, например
`:30 label: { ru: 'Стоимость склада', en: 'Warehouse Value', lt: 'Sandėlio vertė' }`.

Шаг 6 — все восемь страниц аналитики подключены к композаблу и используют `tf()`:
```
DashboardPage 2/6, DeficitPage 2/4, LogisticsPage 2/4, PlReportPage 2/3,
SalesPage 2/3, StaffPage 2/6, SupplyPage 2/4, WarehousePage 2/5
(useAnalytics-упоминаний / вызовов tf(); resolveLabel — 0 везде)
```

Шаг 7 — верификация: `grep -rn "resolveLabel" frontend_vue/src/` не даёт ни одного вхождения.

### Расхождения с буквой плана (не остаток работы)

- Шаги 3 и 4 требовали «добавить рядом» `getAnalyticsPageTranslated()` и
  `useAnalyticsTranslated()`, старые оставить. В коде параллельных функций нет: изменены
  существующие — `src/services/analyticsService.ts` держит один `getAnalyticsPage()`, а
  `src/composables/useAnalytics.ts` сам импортирует `useTranslatedField` и возвращает
  `{ data, loading, error, load, tf }`. Целевая архитектура достигнута, дубли не нужны.
- Раздел «Что мы НЕ делаем» обещал сохранить `resolveLabel()`, `src/i18n/labelLookup.ts` и
  `src/composables/useLabelResolver.ts` для остальных страниц. Обоих файлов в репозитории
  больше нет, `resolveLabel` не встречается нигде — механизм снят целиком более поздней
  работой (миграция остальных разделов на `tf`). Для этого плана это перевыполнение,
  а не недоделка.

### Что осталось
Ничего по объёму плана («только страницы аналитики»).
