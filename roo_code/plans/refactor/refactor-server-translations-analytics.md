# План: Рефакторинг переводов — уход от `resolveLabel()` к переводам с сервера

## Цель

Убрать клиентский механизм [`resolveLabel()`](frontend_vue/src/i18n/labelLookup.ts:236) для страниц аналитики. Сервер будет возвращать данные с переводами на всех языках, а фронтенд будет отображать нужный язык в зависимости от текущей локали — **мгновенно**, без повторных запросов.

## Ключевое требование: мгновенное переключение языка

Пользователь подчеркнул: *"при переключении мгновенно переводить язык — но с данных которые мы уже взяли с апи"*.

**Как это работает сейчас (хороший UX):**
1. Все переводы (ru/en/lt) загружаются при старте в [`admin.ts`](frontend_vue/src/i18n/admin.ts)
2. [`LangSwitcher.vue`](frontend_vue/src/components/LangSwitcher.vue) меняет `locale.value = code` — все `t()` мгновенно переключаются
3. Статические UI-надписи (`t('dashboard.header_title')`) переключаются мгновенно
4. Динамические данные (названия товаров, категорий) используют `resolveLabel()` → `t(i18nKey)` — тоже мгновенно, т.к. i18n-ключи есть во всех 3 языках

**Проблема старого плана:** Если сервер вернёт данные только на одном языке (например, русском), то при переключении на английский мы увидим русские названия. Пришлось бы делать новый запрос.

**Решение:** API возвращает данные со **всеми вариантами языков**. Фронтенд использует реактивный computed на основе текущего `locale`, чтобы выбрать нужный язык. Все переводы уже в памяти после первого запроса — переключение мгновенное.

## Текущая архитектура

```
API Response (сырые RU названия)
  → resolveLabel(сыроеЗначение) → labelLookup[сыроеЗначение] → i18n ключ → t(i18n ключ) → переведённая строка
```

**Проблемы:**
- [`labelLookup.ts`](frontend_vue/src/i18n/labelLookup.ts) — автогенерируемый файл на 230+ строк, требующий синхронизации с сервером
- [`useLabelResolver.ts`](frontend_vue/src/composables/useLabelResolver.ts) — лишний слой композабла
- Добавление новых товаров/категорий требует перегенерации lookup-файла

## Целевая архитектура

```
API Response (данные со всеми языками: { ru: 'Труба', en: 'Pipe', lt: 'Vamzdis' })
  → useTranslatedData(data, locale) → реактивно выбирает строку по текущему языку
  → отображаем в шаблоне
```

**Ключевые изменения:**
1. Новый тип `TranslatedString = { ru: string; en: string; lt: string }`
2. API возвращает поля с этим типом вместо `string`
3. Новый хелпер `useTranslatedData()` (или `translateField()`) реактивно выбирает нужный язык
4. Старый `resolveLabel()` и `labelLookup.ts` не трогаем — они остаются для других страниц

## Диаграмма потока данных

```mermaid
flowchart LR
    subgraph Current
        API1[API: сырые RU названия] --> resolve[resolveLabel]
        resolve --> lookup[labelLookup.ts]
        lookup --> i18n[vue-i18n t]
        i18n --> Display[Отображение]
        locale1[locale switch] --> i18n
    end

    subgraph New
        API2[API: {ru, en, lt}] --> fetch[Загрузка данных]
        fetch --> store[(Данные в памяти)]
        store --> helper[translateField field locale]
        locale2[locale switch] --> helper
        helper --> Display2[Отображение]
    end
```

## Объём этой сессии: только страницы аналитики

| Страница | Файл | Использует `resolveLabel()`? |
|----------|------|------------------------------|
| Dashboard | [`DashboardPage.vue`](frontend_vue/src/views/admin/analytics/DashboardPage.vue) | Нет (хардкодные мок-данные + `t()`) |
| Warehouse | [`WarehousePage.vue`](frontend_vue/src/views/admin/analytics/WarehousePage.vue) | Нет (хардкодные данные + `t()`) |
| Sales | [`SalesPage.vue`](frontend_vue/src/views/admin/analytics/SalesPage.vue) | Нет (хардкодные данные + `t()`) |
| Supply | [`SupplyPage.vue`](frontend_vue/src/views/admin/analytics/SupplyPage.vue) | Нет (хардкодные данные + `t()`) |
| Staff | [`StaffPage.vue`](frontend_vue/src/views/admin/analytics/StaffPage.vue) | Нет (хардкодные данные + `t()`) |
| Logistics | [`LogisticsPage.vue`](frontend_vue/src/views/admin/analytics/LogisticsPage.vue) | Нет (хардкодные данные + `t()`) |
| P&L Report | [`PlReportPage.vue`](frontend_vue/src/views/admin/analytics/PlReportPage.vue) | Нет (хардкодные данные + `t()`) |
| Deficit | [`DeficitPage.vue`](frontend_vue/src/views/admin/analytics/DeficitPage.vue) | Нет (хардкодные данные + `t()`) |

**Важное наблюдение:** Все страницы аналитики сейчас используют **хардкодные данные** прямо в шаблонах + `t()` для UI-надписей. Они вообще не вызывают `resolveLabel()`. Рефакторинг для аналитики заключается в:
1. Создании нового типа `TranslatedString` и хелпера для реактивного выбора языка
2. Обновлении типов аналитики — поля `label`, `title`, `description` становятся `TranslatedString`
3. Создании нового сервиса и композабла
4. Обновлении мок-данных — они возвращают `{ ru, en, lt }`
5. Обновлении страниц — используют новый композабл и хелпер

## Детальные шаги

### Шаг 1: Создать тип `TranslatedString` и хелпер

**Новый файл:** [`frontend_vue/src/types/i18n.ts`](frontend_vue/src/types/i18n.ts)

```typescript
export interface TranslatedString {
  ru: string
  en: string
  lt: string
}
```

**Новый файл:** [`frontend_vue/src/composables/useTranslatedData.ts`](frontend_vue/src/composables/useTranslatedData.ts)

Этот композабл принимает объект с полями `TranslatedString` и текущую локаль, возвращает реактивный объект с плоскими строками.

```typescript
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TranslatedString } from '@/types/i18n'

/**
 * Реактивно выбирает строку из TranslatedString по текущей локали.
 * При переключении языка — мгновенно обновляется (computed).
 */
export function useTranslatedField() {
  const { locale } = useI18n()

  function tf(field: TranslatedString): string {
    return field[locale.value as keyof TranslatedString] ?? field.ru
  }

  return { tf }
}
```

### Шаг 2: Обновить типы аналитики

**Файл:** [`frontend_vue/src/types/analytics.ts`](frontend_vue/src/types/analytics.ts)

Изменить поля, которые содержат переводимые строки, с `string` на `TranslatedString`:

| Интерфейс | Поля для изменения |
|-----------|-------------------|
| `KpiItem` | `key: string` (оставить — это идентификатор), `value: string` (оставить — это число/сумма), `delta: string` (оставить — это "+7%") |
| `AlertItem` | `type: string` → `TranslatedString`, `description: string` → `TranslatedString` |
| `ChartBarItem` | `label: string` → `TranslatedString` |
| `AnalyticsSectionPreview` | `title: string` → `TranslatedString` |
| `AnalyticsMetricItem` | `label: string` → `TranslatedString` |

**Важно:** Поля `value` в KPI, `value` в MetricItem, `delta`, `trend`, `icon`, `iconColor`, `status`, `percentage` — остаются `string`/`number`, так как они не переводимы (числа, иконки, статусы).

### Шаг 3: Добавить новый сервис

**Файл:** [`frontend_vue/src/services/analyticsService.ts`](frontend_vue/src/services/analyticsService.ts)

Добавить новую функцию `getAnalyticsPageTranslated()`. Старая функция остаётся для обратной совместимости.

```typescript
// Новая функция — сервер возвращает данные с TranslatedString
export async function getAnalyticsPageTranslated(page: AnalyticsPageKey): Promise<DashboardData> {
  return apiGet<DashboardData>(`/api/analytics/${page}`)
}
```

### Шаг 4: Добавить новый композабл

**Файл:** [`frontend_vue/src/composables/useAnalytics.ts`](frontend_vue/src/composables/useAnalytics.ts)

Добавить новый композабл `useAnalyticsTranslated()`. Старый `useAnalytics()` остаётся без изменений.

```typescript
import { useTranslatedField } from './useTranslatedData'

export function useAnalyticsTranslated(page: AnalyticsPageKey) {
  const data = ref<DashboardData | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const { tf } = useTranslatedField()

  async function load() {
    loading.value = true
    error.value = null
    try {
      data.value = await getAnalyticsPageTranslated(page)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load analytics'
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, load, tf }
}
```

### Шаг 5: Обновить мок-данные

**Файл:** [`frontend_vue/src/services/mocks/analytics.ts`](frontend_vue/src/services/mocks/analytics.ts)

Обновить мок-данные, чтобы они возвращали `TranslatedString` вместо простых строк. Это симулирует то, что будет делать реальный сервер.

**Пример изменений:**

```typescript
// Было:
const salesByCategory: ChartBarItem[] = [
  { label: 'Pipes', value: 32400, percentage: 78 },
  { label: 'Sheets', value: 22800, percentage: 55 },
]

// Стало:
const salesByCategory: ChartBarItem[] = [
  { label: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, value: 32400, percentage: 78 },
  { label: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, value: 22800, percentage: 55 },
]
```

Аналогично для всех полей `type`, `description`, `title`, `label`.

### Шаг 6: Обновить страницы аналитики

Для каждой страницы аналитики:

1. **DashboardPage.vue** — заменить `mockGetAnalyticsPage('dashboard')` на `useAnalyticsTranslated('dashboard')` и использовать `tf(item.label)` в шаблоне вместо `t('dashboard.cat_' + ...)`
2. **Остальные страницы** — сейчас у них нет интеграции с API, только статические данные в шаблоне. Подключить их к новому композаблу.

**Пример для DashboardPage.vue (секция chart):**

```vue
<script setup lang="ts">
// Было:
import { mockGetAnalyticsPage } from '@/services/mocks/analytics'
const data = mockGetAnalyticsPage('dashboard')

// Стало:
import { useAnalyticsTranslated } from '@/composables/useAnalytics'
const { data, loading, error, load, tf } = useAnalyticsTranslated('dashboard')
load()
</script>

<template>
  <!-- Было: -->
  <span class="bar-label">{{ t('dashboard.cat_' + item.label.toLowerCase()) }}</span>

  <!-- Стало: -->
  <span class="bar-label">{{ tf(item.label) }}</span>
</template>
```

**Важно:** Статические UI-надписи (`t('dashboard.header_title')`, `t('dashboard.kpi1_label')`) остаются через `t()` — они и так мгновенно переключаются через `vue-i18n`. Меняем только те места, где отображаются **динамические данные из API**.

### Шаг 7: Удалить неиспользуемые импорты

После рефакторинга убедиться, что ни одна страница аналитики не импортирует `resolveLabel` или `useLabelResolver`. Сейчас они и так не импортируют, так что это просто шаг верификации.

## Что мы НЕ делаем в этой сессии

- **Не** трогаем `resolveLabel()` — он остаётся для других страниц (товары, категории, поставщики, BCC, конфиг)
- **Не** трогаем [`labelLookup.ts`](frontend_vue/src/i18n/labelLookup.ts) — остаётся для других страниц
- **Не** трогаем [`useLabelResolver.ts`](frontend_vue/src/composables/useLabelResolver.ts) — остаётся для других страниц
- **Не** рефакторим страницы товаров, категорий, поставщиков, BCC и конфига
- **Не** модифицируем API клиент ([`api.ts`](frontend_vue/src/services/api.ts))
- **Не** удаляем старые функции — только добавляем новые рядом

## Путь миграции (будущие сессии)

После аналитики следующие сессии будут заниматься:

1. **Товары** — [`ProductsPage.vue`](frontend_vue/src/views/admin/products/ProductsPage.vue)
2. **Категории**
3. **Поставщики** — [`SupplierCardPage.vue`](frontend_vue/src/views/admin/suppliers/SupplierCardPage.vue)
4. **BCC** — [`BccRequestPage.vue`](frontend_vue/src/views/admin/suppliers/BccRequestPage.vue)
5. **Конфиг** — [`SupplierCardConfigPage.vue`](frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue)

Каждая сессия будет следовать тому же паттерну: новые типы, новые функции сервиса, новые композаблы, обновление моков, обновление страниц — без поломки старого кода.

## Оценка рисков

| Риск | Митигация |
|------|-----------|
| Сервер ещё не возвращает `TranslatedString` | Создаём новые функции рядом со старыми; страницы могут переключиться обратно, используя старый композабл |
| Поломка существующих страниц | Никогда не модифицируем существующие функции — только добавляем новые |
| Мок-данные рассинхронизируются с реальным API | Моки обновляются, чтобы отражать новый контракт с `TranslatedString` |
| Потеря мгновенного переключения языка | `useTranslatedField()` использует `computed` от `locale` — реактивно, мгновенно |
