# План: Устранение уязвимости сырых i18n-ключей

## Проблема

Текущий подход генерирует i18n-ключи из сырых данных через regex:

```typescript
function productNameLabel(name: string): string {
  const key = 'product_' + name.replace(/[^a-zA-Z0-9]/g, '_')...
  const translated = t(`products.${key}`)
  return translated !== key ? translated : name
}
```

**Фундаментальные недостатки:**
1. Любой не-ASCII символ (`×`, `°`, `²`, `³`, `µm`, `Ø`, `±`) ломает генерацию ключа
2. Нет явной связи между данными и ключом — контракт неявный
3. При ошибке показывается сырой key вместо данных (`products.product_Angle_S355_100_100_10`)
4. 4 дублирующиеся функции с одинаковым паттерном

## Решение: Единый lookup-словарь + универсальная функция

### Шаг 1: Создать файл `src/i18n/labelLookup.ts`

Файл содержит **явный маппинг**: сырое значение → i18n-ключ.

```typescript
// Явный маппинг сырых значений на i18n-ключи
// Это единственное место, где нужно поддерживать соответствие
export const labelLookup: Record<string, string> = {
  // ── Product names ──
  'Angle S355 100×100×10': 'products.product_Angle_S355_100x100x10',
  'Steel Sheet S355 5mm 1500×3000': 'products.product_Steel_Sheet_S355_5mm_1500_3000',
  'Steel Pipe S235 25×3': 'products.product_Steel_Pipe_S235_25x3',
  // ... все 100+ product names
  'Welding Table Siegmund 1200×800': 'products.product_Welding_Table_Siegmund_1200x800',

  // ── Field names ──
  'Density (kg/m³)': 'products.field_Density',
  'Thickness (mm)': 'products.field_Thickness',
  'Width (mm)': 'products.field_Width',
  'Length (mm)': 'products.field_Length',
  'Weight per m² (kg)': 'products.field_Weight_per_m2',
  // ... все field names

  // ── Enum values ──
  'Hot-rolled': 'products.enum_Hot_rolled',
  'Cold-rolled': 'products.enum_Cold_rolled',
  'Elbow 90°': 'products.enum_Elbow_90',
  // ... все enum values

  // ── Category names ──
  'Sheets': 'products.category_Sheets',
  'Pipes': 'products.category_Pipes',
  'Beams': 'products.category_Beams',
  // ... все category names
}
```

### Шаг 2: Создать единую функцию `resolveLabel`

```typescript
import { useI18n } from 'vue-i18n'
import { labelLookup } from '@/i18n/labelLookup'

export function useLabelResolver() {
  const { t } = useI18n()

  function resolveLabel(rawValue: string): string {
    const key = labelLookup[rawValue]
    if (!key) return rawValue // нет маппинга — возвращаем как есть
    const translated = t(key)
    // Если перевод совпадает с ключом — значит ключ не найден в i18n
    return translated !== key ? translated : rawValue
  }

  return { resolveLabel }
}
```

### Шаг 3: Заменить все 4 функции во всех компонентах

**ProductsPage.vue:**
- Удалить `productNameLabel()`, `categoryLabel()`, `getCategoryPath()`
- Использовать `resolveLabel()` из `useLabelResolver()`

**ProductCardPage.vue:**
- Удалить `fieldLabel()`, `enumLabel()`
- Использовать `resolveLabel()`

**CategoryCardPage.vue:**
- Удалить `fieldLabel()`, `categoryLabel()`
- Использовать `resolveLabel()`

**CategoriesPage.vue:**
- Удалить `categoryLabel()`
- Использовать `resolveLabel()`

**useProductCard.ts:**
- Удалить `categoryLabel()`, `getCategoryPath()`
- Импортировать `resolveLabel()` из утилиты

### Шаг 4: Автоматическая генерация labelLookup.ts

Создать скрипт `scripts/generate-label-lookup.mjs`, который:
1. Читает `src/i18n/admin.ts`
2. Находит все ключи с префиксами `product_`, `field_`, `enum_`, `category_`
3. Для каждого ключа берёт **английское значение** (en locale) как сырое значение
4. Генерирует `labelLookup.ts`

Это гарантирует, что маппинг всегда синхронизирован с i18n.

### Шаг 5: Проверка всех страниц

После замены — проверить визуально каждую страницу:
- ProductsPage — названия товаров, категорий
- ProductCardPage — dynamic fields, enum values, category path
- CategoryCardPage — inherited fields, own fields
- CategoriesPage — названия категорий
- SuppliersListPage, SupplierCardPage — не используют products.* ключи

## Преимущества

1. **Явный контракт**: маппинг виден и поддерживаем
2. **Нет хрупкого regex**: любые символы работают
3. **Единая точка изменений**: при добавлении новых данных — только labelLookup.ts
4. **Безопасный fallback**: при отсутствии ключа возвращается сырое значение, а не сырой ключ
5. **Генерация**: скрипт синхронизирует с i18n автоматически

## Todo List

- [ ] Создать `src/i18n/labelLookup.ts` с полным маппингом
- [ ] Создать `src/composables/useLabelResolver.ts` с единой функцией
- [ ] Заменить `productNameLabel` в ProductsPage.vue
- [ ] Заменить `categoryLabel` в ProductsPage.vue
- [ ] Заменить `getCategoryPath` в ProductsPage.vue
- [ ] Заменить `fieldLabel` в ProductCardPage.vue
- [ ] Заменить `enumLabel` в ProductCardPage.vue
- [ ] Заменить `fieldLabel` в CategoryCardPage.vue
- [ ] Заменить `categoryLabel` в CategoryCardPage.vue
- [ ] Заменить `categoryLabel` в CategoriesPage.vue
- [ ] Заменить `categoryLabel` и `getCategoryPath` в useProductCard.ts
- [ ] Создать скрипт генерации `scripts/generate-label-lookup.mjs`
- [ ] Проверить SuppliersListPage.vue — нет ли products.* ключей
- [ ] Проверить SupplierCardPage.vue — нет ли products.* ключей
- [ ] Визуально проверить все страницы после изменений
- [ ] Запустить `vue-tsc --noEmit` для проверки типов
