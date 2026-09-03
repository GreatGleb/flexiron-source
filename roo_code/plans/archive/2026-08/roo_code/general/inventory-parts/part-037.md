# Инвентаризация планов — часть 037

Каталог: `roo_code/plans/services` (два плана из трёх; `services-page-plan.md` — не в этой пачке).

---

## 1. `roo_code/plans/services/fix-service-card-translations.md`

**Вердикт: сделано**

Незакрытых чекбоксов: 0 (`grep -c "^[[:space:]]*- \[ \]"` → 0).

### Чего требовал план

1. `useServiceCard.form` — `name`/`description` как `TranslatedString | null`, а не строки;
   `load()`/`save()`/`discard()` присваивают структуру целиком, без вытаскивания одной локали.
2. `ServiceCardPage.vue` — computed с getter/setter (`formName`, `formDescription`) через
   `mergeLocaleValue`, `v-model` на них, а не на `form.name`/`form.description`.
3. `mockPatchService` — принимает `TranslatedString` напрямую (план сам говорит «уже сделано»).

### Доказательство

`cat -n frontend_vue/src/composables/useServiceCard.ts`:

```
     8	import type { TranslatedString } from '@/types/i18n'
    20	  const form = ref<{
    21	    name: TranslatedString | null
    22	    costPrice: number
    23	    sellingPrice: number
    24	    currencyId: string
    25	    uomId: string
    26	    description: TranslatedString | null
    27	  }>({
    28	    name: null,
...
    48	      form.value = {
    49	        name: data.name,
    ...
    54	        description: data.description ?? null,
    76	      form.value = {
    77	        name: updated.name,
    ...
    82	        description: updated.description ?? null,
    95	    form.value = {
    96	      name: service.value.name,
   101	      description: service.value.description ?? null,
```

`cat -n frontend_vue/src/views/admin/products/ServiceCardPage.vue`:

```
     5	import { mergeLocaleValue } from '@/types/i18n'
    27	const formName = computed({
    28	  get: () => (form.value.name ? tf(form.value.name) : ''),
    29	  set: (v: string) => {
    30	    form.value.name = v ? mergeLocaleValue(form.value.name, v, locale.value) : null
    31	  },
    32	})
    34	const formDescription = computed({
    35	  get: () => (form.value.description ? tf(form.value.description) : ''),
    37	    form.value.description = v ? mergeLocaleValue(form.value.description, v, locale.value) : null
   123	                v-model="formName"
   163	                v-model="formDescription"
```

`grep -rn "toTranslatedString" src/composables/useServiceCard.ts src/views/admin/products/ServiceCardPage.vue` → пусто (одиночная локаль нигде не сворачивается).

`sed -n '138,164p' frontend_vue/src/services/mocks/services.ts`:

```
export async function mockPatchService(
  id: string,
  data: {
    name?: TranslatedString
    ...
    description?: TranslatedString
  },
  _locale?: string,
): Promise<Service> {
  ...
  if (data.name !== undefined) svc.name = data.name
  ...
  if (data.description !== undefined) svc.description = data.description
```

`grep -n "export function mergeLocaleValue" frontend_vue/src/types/i18n.ts` → `53:export function mergeLocaleValue(`.

### Что осталось

Ничего. Все три правки на месте. Переключение локали работает через `tf()` внутри
computed-getter — значение пересчитывается при смене `locale`, потому что структура
хранится целиком.

### Файлы кода, упомянутые в плане

- `frontend_vue/src/composables/useServiceCard.ts`
- `frontend_vue/src/composables/useCategoryCard.ts`
- `frontend_vue/src/views/admin/products/ServiceCardPage.vue`
- `frontend_vue/src/services/mocks/services.ts`
- `@/types/i18n`

---

## 2. `roo_code/plans/services/service-card-page-plan.md`

**Вердикт: сделано** (с осознанными отклонениями — см. ниже)

Незакрытых чекбоксов: 0 (`grep -c "^[[:space:]]*- \[ \]"` → 0).

### Доказательство по каждому из 7 пунктов плана

**1. Роут `products/services/:id`** — `grep -n "admin-service-card" -A4 -B4 frontend_vue/src/router/index.ts`:

```
   246-      {
   247-        path: 'products/services/:id',
   248:        name: 'admin-service-card',
   249-        component: () => import('@/views/admin/products/ServiceCardPage.vue'),
   250-        meta: { layout: 'admin', featureFlag: 'adminServices' as FeatureFlagKey },
   251-      },
```

**2. Композабл `useServiceCard`** — файл существует (`ls -la` → 3220 байт, 26 Aug 15:30).
Экспортирует `service`, `loading`, `saving`, `error`, `form`, `isAnythingDirty`,
`load`, `save`, `discard`, `tf` (строки 106–117) — ровно перечень плана.
Использует `getService`/`patchService` (строка 3), `useDirtyCheck` (4), `useToast` (5),
`useTranslatedField` (6).

**3. `ServiceCardPage.vue`** — файл существует (6631 байт). Структура совпадает с планом:
`v-if="loading"` → `GlassPanel :loading`, `v-else-if="error"` → `Breadcrumb` +
`.entity-not-found`, `v-else` → `[data-test="page-service-card"]`,
`[data-test="service-card-header"]`, три крошки, `.page-title`,
`entity-action-bar no-margin pos-static` с `[data-test="service-save-bar"]`,
`entity-card-grid`/`entity-col-left`, `[data-test="service-card-info"]` и поля
`service-name-input`, `service-cost-input`, `service-selling-input`,
`service-unit-select`, `service-description-input`.

**4. i18n-ключи** — `grep -n "btn_save\|btn_discard_changes\|section_info\|btn_open" frontend_vue/src/i18n/admin/services.ts`:

```
16:      btn_save: 'Сохранить'          54:      btn_save: 'Save'            92:      btn_save: 'Išsaugoti'
17:      btn_discard_changes: ...       55:      btn_discard_changes: ...    93:      btn_discard_changes: ...
18:      btn_open: 'Открыть карточку'   56:      btn_open: 'Open card'       94:      btn_open: 'Atidaryti kortelę'
36:      section_info: ...              74:      section_info: ...          112:      section_info: ...
```

Все четыре ключа в трёх локалях. Плюс `grep -c` по field-ключам
(`field_name|field_cost_price|field_selling_price|field_currency|field_price_unit|field_description`)
→ 18 = 6 ключей × 3 локали.

**5. Кнопка «открыть» в списке** — `grep -n "services-btn-open" -B3 -A6 frontend_vue/src/views/admin/products/ServicesPage.vue`:

```
   279-                  <router-link
   280-                    v-tooltip="t('services.btn_open')"
   281:                    :to="{ name: 'admin-service-card', params: { id: item.id } }"
   282-                    class="action-icon-btn"
   283:                    data-test="services-btn-open"
   285-                    <SvgIcon name="external-link" :width="16" :height="16" />
```

Сверх плана: имя услуги в колонке тоже стало ссылкой на карточку (строка 267).

**6. Моки GET/PATCH** — `mockGetService` (services.ts:132), `mockPatchService` (services.ts:138);
роутинг в `frontend_vue/src/services/mocks/index.ts`: импорты 69/71, GET-матч на
строке 466 (`serviceCardMatch[1]`), PATCH-вызов на 1218–1220.

**7. E2E** — `frontend_vue/tests/e2e/admin/products/service-card.spec.ts` существует
(2777 байт), 6 тестов: header+breadcrumbs, info-панель, save disabled изначально,
правка имени включает save, discard возвращает disabled, крошка ведёт в список.
В `services.spec.ts` есть навигационный тест:

```
27:  test('should navigate to service card on open button click', async ({ page }) => {
28:    await page.click('[data-test="services-btn-open"]:first-child')
29:    await expect(page).toHaveURL(/\/admin\/products\/services\/svc-/)
```

### Отклонения от буквы плана (реализовано иначе, не «не сделано»)

- План описывал в форме одно поле `priceUnit` и `formPriceUnit`. В коде вместо него
  два поля из справочника — `currencyId` и `uomId`, с опциями из `useSettings()`
  (`currencyOptions`, `uomOptions`). Селектор `service-unit-select` из плана сохранён,
  добавлен `service-currency-select` и ключ `field_currency`.
- Вместо сырого `<textarea>` из плана — общий `AutoResizeTextarea`.
- Визуальных тестов (последний пункт «Visual tests» в описании нового спека) в
  `service-card.spec.ts` нет — есть только структурные и dirty/discard.

### Файлы кода, упомянутые в плане

- `frontend_vue/src/router/index.ts`
- `frontend_vue/src/composables/useServiceCard.ts`
- `frontend_vue/src/composables/useCategoryCard.ts`
- `frontend_vue/src/composables/useDirtyCheck.ts`
- `frontend_vue/src/composables/useToast.ts`
- `frontend_vue/src/services/servicesService.ts`
- `frontend_vue/src/views/admin/products/ServiceCardPage.vue`
- `frontend_vue/src/views/admin/products/CategoryCardPage.vue`
- `frontend_vue/src/views/admin/products/ServicesPage.vue`
- `frontend_vue/src/i18n/admin/services.ts`
- `frontend_vue/src/services/mocks/services.ts`
- `frontend_vue/src/services/mocks/index.ts`
- `frontend_vue/tests/e2e/admin/products/services.spec.ts`
- `frontend_vue/tests/e2e/admin/products/service-card.spec.ts`
