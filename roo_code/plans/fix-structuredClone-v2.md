# Исправление `structuredClone` ошибки — Версия 2

## Текущее состояние

После первой версии исправлений:
1. `structuredClone` ошибка **всё ещё появляется** в категориях
2. При изменении названия категории **кнопка сохранения не загорается** (новая проблема, созданная моими изменениями)

## Корневая причина

### Проблема 1: `structuredClone` ошибка

Vue 3's `watch` с `{ deep: true }` **внутренне вызывает `structuredClone`** на reactive proxy для создания глубокой копии старого значения. Это происходит **до** того, как вызывается callback watch-а.

`structuredClone` падает на reactive proxy, когда:
- Свойство proxy меняет тип (например, `null` → `{ ru, en, lt }`)
- Proxy содержит специальные внутренние структуры Vue, которые не клонируются

### Проблема 2: Кнопка сохранения не загорается

Моё изменение в `useDirtyCheck.ts`:
```typescript
watch(
  () => JSON.parse(JSON.stringify(toRaw(source.value))) as T,
  (val) => { isDirty.value = JSON.stringify(val) !== snapshot },
  { deep: true },
)
```

Getter `() => JSON.parse(JSON.stringify(toRaw(source.value)))` обращается к `source.value` (reactive ref), но затем `toRaw()` извлекает сырой объект, и Vue **теряет глубокие зависимости**. Когда меняется `form.value.name` (глубокое свойство), Vue не знает об этом, и watch не срабатывает.

## Решение

### Стратегия: Использовать `watchEffect` вместо `watch` с `deep: true`

`watchEffect` не создаёт глубокую копию reactive proxy — он просто запускает эффект при изменении любых отслеживаемых зависимостей. Внутри `watchEffect` мы можем безопасно сравнить текущее значение со снепшотом.

```typescript
import { ref, watchEffect, toRaw, type Ref } from 'vue'

export function useDirtyCheck<T>(source: Ref<T>) {
  const isDirty = ref(false)
  let snapshot = JSON.stringify(toRaw(source.value))
  let snapshotObj: unknown = safeParse(snapshot)

  function capture() {
    snapshot = JSON.stringify(toRaw(source.value))
    snapshotObj = safeParse(snapshot)
    isDirty.value = false
  }

  // watchEffect НЕ использует structuredClone — он просто запускает эффект
  // при изменении любых reactive зависимостей, к которым обратились внутри.
  // toRaw(source.value) обращается к source.value (отслеживается Vue),
  // а JSON.stringify обходит все глубокие свойства (тоже отслеживаются,
  // потому что мы обращаемся к ним через reactive proxy ДО toRaw).
  watchEffect(() => {
    // Сначала обращаемся к глубоким свойствам reactive proxy (для отслеживания),
    // затем извлекаем сырой объект через toRaw для сериализации.
    const raw = toRaw(source.value)
    // Вызываем JSON.stringify на сыром объекте — это не reactive,
    // но все зависимости уже отслежены на шаге source.value.
    isDirty.value = JSON.stringify(raw) !== snapshot
  })

  // ... остальной код без изменений
}
```

**Важно:** `watchEffect` НЕ вызывает `structuredClone` на reactive proxy. Он просто запускает функцию-эффект при изменении зависимостей. Внутри эффекта мы используем `toRaw(source.value)` — `source.value` обращается к reactive ref (отслеживается Vue), а `toRaw` извлекает сырой объект.

### Почему это работает

1. `watchEffect` не клонирует reactive proxy — он просто запускает эффект
2. `source.value` внутри эффекта обращается к reactive ref — Vue отслеживает эту зависимость
3. Когда любое глубокое свойство `source.value` меняется, `watchEffect` перезапускается
4. Внутри эффекта мы сравниваем `JSON.stringify(toRaw(source.value))` со снепшотом
5. `structuredClone` **никогда не вызывается** на reactive proxy

### Дополнительно: `watch(localFields, ...)` в CategoryCardPage.vue

Аналогичная проблема с `watch(localFields, ..., { deep: true })` на строке 165. Нужно заменить на `watchEffect`:

```typescript
watchEffect(() => {
  dd.setItems(toRaw(localFields.value))
})
```

## План действий

1. **Исправить [`useDirtyCheck.ts`](frontend_vue/src/composables/useDirtyCheck.ts)**: заменить `watch(getter, ..., { deep: true })` на `watchEffect`
2. **Исправить [`CategoryCardPage.vue`](frontend_vue/src/views/admin/products/CategoryCardPage.vue:163)**: заменить `watch(getter, ..., { deep: true })` на `watchEffect`
3. **Проверить типы**: `npx vue-tsc --noEmit`
4. **Проверить** что `structuredClone` ошибка исчезла и кнопка сохранения работает
