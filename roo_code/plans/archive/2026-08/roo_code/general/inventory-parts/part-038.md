# Инвентаризация: roo_code/plans/services (part-038)

## roo_code/plans/services/services-page-plan.md — **сделано**

Незакрытых чекбоксов: 0 (`grep -c "^[[:space:]]*- \[ \]"` → `0`, exit 1).
План написан как 10 промптов (Промпт 0–9), а не как чек-лист.

### Доказательство

```
$ grep -c "^[[:space:]]*- \[ \]" roo_code/plans/services/services-page-plan.md
0

$ cd frontend_vue && ls -la src/types/service.ts src/services/mocks/services.ts \
    src/services/servicesService.ts src/composables/useServices.ts \
    src/i18n/admin/services.ts src/views/admin/products/ServicesPage.vue \
    src/styles/admin/services_list.css
-rw-rw-r-- 1 greatgleb greatgleb  2295 Jun 30 15:28 src/composables/useServices.ts
-rw-rw-r-- 1 greatgleb greatgleb  4465 Aug 26 15:30 src/i18n/admin/services.ts
-rw-rw-r-- 1 greatgleb greatgleb  5954 Aug 26 15:30 src/services/mocks/services.ts
-rw-rw-r-- 1 greatgleb greatgleb  2686 Aug 26 15:30 src/services/servicesService.ts
-rw-rw-r-- 1 greatgleb greatgleb  4149 Jun 30 15:28 src/styles/admin/services_list.css
-rw-rw-r-- 1 greatgleb greatgleb  2491 Aug 26 15:30 src/types/service.ts
-rw-rw-r-- 1 greatgleb greatgleb 14907 Aug 26 15:30 src/views/admin/products/ServicesPage.vue

$ grep -n "admin-services\|products/services" src/router/index.ts
241:        path: 'products/services',
242:        name: 'admin-services',
247:        path: 'products/services/:id',

$ grep -n "adminServices" src/config/featureFlags.ts src/types/features.ts tests/e2e/helpers/flags.ts
src/config/featureFlags.ts:21:  adminServices: true,
src/types/features.ts:18:  adminServices: boolean
tests/e2e/helpers/flags.ts:29:  adminServices: true,

$ grep -n "products-link-services\|admin-services" src/views/admin/products/ProductsPage.vue
241:          :to="{ name: 'admin-services' }"
243:          data-test="products-link-services"

$ grep -n "admin-services\|1.3" src/views/public/ScreensPage.vue
148:  { id: '1.3', to: { name: 'admin-services' }, titleKey: 'services.header_title' },

$ grep -n "services" src/i18n/admin/index.ts
9:import { adminServices } from './services'
62:  adminServices,

$ grep -n "services" src/i18n/admin/layout.ts
55:      services: 'Услуги',
113:      services: 'Services',
171:      services: 'Paslaugos',

$ grep -n "services" src/services/mocks/index.ts   # регистрация 5 маршрутов
451:  if (path === '/api/services') {                       # GET список
464:  const serviceCardMatch = path.match(/^\/api\/services\/([^/]+)$/)   # GET карточка
935:  if (path === '/api/services') {                       # POST
1215:  const servicePatchMatch = path.match(/^\/api\/services\/([^/]+)$/) # PATCH
1483:  const serviceDeleteMatch = path.match(/^\/api\/services\/([^/]+)$/) # DELETE

$ ls tests/e2e/admin/products/ | grep -i serv
service-card.spec.ts
services.spec.ts
```

Наборы ключей `services.*` в `src/i18n/admin/services.ts` совпадают по ru/en/lt
(проверено чтением файла целиком — 33 ключа в каждой локали).

### Что сделано сверх плана и где код разошёлся с буквой плана

Расхождения — осознанная эволюция модели, а не недоделка; в коде они задокументированы.

- **Типы (Промпт 1).** Союза `ServicePriceUnit = 'EUR/vnt' | ...` в коде нет. Вместо него
  `Service.currencyId` + `Service.uomId` (id из справочника валют и единиц),
  `costPrice`/`sellingPrice` — не nullable, `ServiceListItem` = alias на `Service`
  (помечен `@deprecated`), добавлены `ServiceCreatePayload`/`ServicePatchPayload`.
  Причина зафиксирована докблоком в `src/types/service.ts`: валюта была вварена в
  единицу, услуга в не-евро была невыразима. `ServiceFilters.sortBy` теперь
  non-nullable и включает `'createdAt'`.
- **Мок (Промпт 2).** Стор берётся из общего `@/mocks/services`, экспортируются
  `serviceById`/`allServices` (единственный источник каталога для модуля заказов),
  валюта и единица проверяются по `MOCK_SETTINGS` вместо непроверенного каста,
  функции асинхронные, id вида `svc-001`.
- **i18n (Промпт 6).** Ключей `price_unit_vnt/kg/m/h` нет — единица собирается из
  справочника (`serviceUnitLabel`, `src/domain/servicePricing.ts`). Ключа `btn_back`
  нет; вместо кнопки «Назад к товарам» стоит `Breadcrumb` (Товары → Услуги).
  Добавлены ключи под карточку услуги: `btn_open`, `btn_save`, `toast_saved`,
  `section_info`, `modal_delete_text` c `{name}` и др.
- **Страница (Промпт 7).** Есть всё из плана (хедер, кнопка создания, фильтр поиска,
  сортируемые колонки, строки, модалы создания и удаления, пагинация) плюс: общий
  компонент `Pagination`, `AutoResizeTextarea` для описания, поля «Валюта» и
  «Единица» из справочника, кнопка перехода в карточку (`services-btn-open`).
  Инлайновых `<style>`-хаков из плана в файле нет — правила лежат в
  `services_list.css` (`.data-table-wrapper`, `.data-table tfoot td`).
- **Сверх плана целиком.** Карточка услуги: маршрут `products/services/:id` →
  `ServiceCardPage.vue` (у неё свой план `service-card-page-plan.md`), e2e-спеки
  `services.spec.ts` и `service-card.spec.ts`.

### Что осталось

Ничего. Все 10 промптов плана реализованы; расхождения — более поздние
осознанные замены, а не пропуски.

### Пункты

Чекбоксов в плане нет (itemsTotal = 0) — пунктовый разбор не применим,
разбор идёт по промптам выше.
