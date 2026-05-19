# Fix: Замена `toTranslatedString` на `mergeTranslatedString` в computed setters

## Проблема

После single-locale рефакторинга функция `toTranslatedString(value, locale)` создаёт объект `{ ru: '', en: 'Hello', lt: '' }` — заполнена только одна локаль. Это корректно для отправки на сервер (API), но **некорректно** для обновления существующих данных в UI.

**Пример бага:** Пользователь вводит название продукта на русском, переключает язык на английский — поле становится пустым, потому что `toTranslatedString` обнулила другие локали.

## Решение

Добавить функцию `mergeTranslatedString()` в `types/i18n.ts` и заменить ей `toTranslatedString` во всех computed setters и местах обновления существующих `TranslatedString` объектов.

## Полный аудит: все использования `toTranslatedString()`

### Функция (определение)

**Файл:** `frontend_vue/src/types/i18n.ts`

```ts
export function toTranslatedString(value: string, locale: string): TranslatedString {
  const result: TranslatedString = { ru: '', en: '', lt: '' }
  if (locale in result) {
    result[locale as keyof TranslatedString] = value
  }
  return result
}
```

### Всего найдено: 47 вызовов в 14 файлах

---

### ✅ OK — Сервисные файлы (отправка на сервер) — 32 вызова

Все вызовы в сервисах корректны, т.к. данные сразу уходят на API.

| Файл | Вызовы |
|------|--------|
| `frontend_vue/src/services/bccService.ts` | 3 — subject, body, source |
| `frontend_vue/src/services/categoriesService.ts` | 5 — name, description, field value, field name, options |
| `frontend_vue/src/services/productsService.ts` | 7 — name, description (create/patch), field name, options, subcategory |
| `frontend_vue/src/services/suppliersService.ts` | 8 — company, contactPerson, statusReason (create/patch) + empty fallbacks |
| `frontend_vue/src/services/configService.ts` | 3 — section name (create/patch), field name |
| `frontend_vue/src/services/mocks/products.ts` | 6 — mock data |

---

### ❌ ПРОБЛЕМА — Computed setters / обновление существующих данных — 9 вызовов

#### 1. `frontend_vue/src/views/admin/suppliers/BccRequestPage.vue` — 3 вызова (P0)

| Строка | Код | Исправление |
|--------|-----|-------------|
| 56 | `set(val) { templateSubject.value = toTranslatedString(val, locale.value) }` | `mergeTranslatedString(templateSubject.value, val, locale.value)` |
| 61 | `set(val) { templateBody.value = toTranslatedString(val, locale.value) }` | `mergeTranslatedString(templateBody.value, val, locale.value)` |
| 407 | `toTranslatedString(source, locale.value)` — source в event rows | `mergeTranslatedString(undefined, source, locale.value)` |

#### 2. `frontend_vue/src/components/admin/SupplierFormSections.vue` — 1 вызов (P0)

| Строка | Код | Исправление |
|--------|-----|-------------|
| 20 | `setTranslatedField(field, toTranslatedString(value, locale.value))` | `mergeTranslatedString(existingVal, value, locale.value)` |

#### 3. `frontend_vue/src/views/admin/products/CategoryCardPage.vue` — 2 вызова (P1)

| Строка | Код | Исправление |
|--------|-----|-------------|
| 69 | `localCategory.value.name = toTranslatedString(val, locale.value)` | `mergeTranslatedString(localCategory.value.name, val, locale.value)` |
| 83 | `localCategory.value.description = toTranslatedString(val, locale.value)` | `mergeTranslatedString(localCategory.value.description, val, locale.value)` |

#### 4. `frontend_vue/src/views/admin/products/ProductCardPage.vue` — 2 вызова (P1)

| Строка | Код | Исправление |
|--------|-----|-------------|
| 43 | `localProduct.value.name = toTranslatedString(val, locale.value)` | `mergeTranslatedString(localProduct.value.name, val, locale.value)` |
| 50 | `localProduct.value.description = toTranslatedString(val, locale.value)` | `mergeTranslatedString(localProduct.value.description, val, locale.value)` |

#### 5. `frontend_vue/src/composables/useCardConfig.ts` — 1 вызов (P1)

| Строка | Код | Исправление |
|--------|-----|-------------|
| 86 | `sec.name = toTranslatedString(name, locale.value)` | `mergeTranslatedString(sec.name, name, locale.value)` |

---

### ⚠️ ПОТЕНЦИАЛЬНО НОРМАЛЬНО — Создание новых объектов в UI — 5 вызовов

| Файл | Строки | Причина |
|------|--------|---------|
| `SupplierCardConfigPage.vue` | 316, 412, 458 | Создание новых полей/секций — ещё нет существующих переводов |
| `CategoryCardPage.vue` | 144, 147 | Создание новых custom fields — ещё нет существующих переводов |

**Рекомендация:** Оставить как есть. Если баг проявится при переключении языка до сохранения — заменить на `mergeTranslatedString(undefined, ...)`.

---

### ⚪ P3 — Некорректное использование типа — 1 вызов

| Файл | Строка | Проблема | Исправление |
|------|--------|----------|-------------|
| `SupplierCardPage.vue` | 45 | Имя файла не должно быть TranslatedString | Убрать `toTranslatedString`, хранить как string |

---

## План реализации

### Шаг 1: Добавить `mergeTranslatedString()` в `types/i18n.ts`

```ts
/**
 * Merges a single-locale value into an existing TranslatedString.
 * Preserves existing translations for other locales.
 * Use this instead of toTranslatedString() when updating existing data in UI.
 */
export function mergeTranslatedString(
  existing: TranslatedString | null | undefined,
  value: string,
  locale: string
): TranslatedString {
  const result: TranslatedString = existing
    ? { ...existing }
    : { ru: '', en: '', lt: '' }
  if (locale in result) {
    result[locale as keyof TranslatedString] = value
  }
  return result
}
```

### Шаг 2: Исправить 9 проблемных вызовов

По приоритету:
1. 🔴 `BccRequestPage.vue` (строки 56, 61, 407)
2. 🔴 `SupplierFormSections.vue` (строка 20)
3. 🟠 `CategoryCardPage.vue` (строки 69, 83)
4. 🟠 `ProductCardPage.vue` (строки 43, 50)
5. 🟠 `useCardConfig.ts` (строка 86)

### Шаг 3: Исправить P3 (опционально)

- `SupplierCardPage.vue` (строка 45) — убрать `toTranslatedString` для имени файла

---

## Ключевые принципы (DRY/SOLID)

1. **Единый источник истины:** `mergeTranslatedString()` — единственная функция для обновления существующих `TranslatedString` в UI.
2. **Разделение ответственности:** Сервисы → `toTranslatedString()` (single-locale для API). UI → `mergeTranslatedString()` (сохранение других локалей).
3. **Никаких словарей переводов:** Данные должны быть идентичны тому, что придёт с реального API.
4. **Устойчивость к null:** `mergeTranslatedString` принимает `null | undefined` как existing.
5. **Простота поддержки:** Один паттерн на все случаи обновления translated полей.
