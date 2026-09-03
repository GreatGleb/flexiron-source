# Пункт 4f — `REFERENCE_REQUIRED_TYPES` вместо четырёх копий условия

Файл: `frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue`
Дата: 2026-08-27. Режим: автономный.

## 1. Воспроизведение

Пункт требовал свести четыре копии `type === 'expense' || type === 'write-off'`.
Сначала пришлось поправить путь: в пункте файл назван `CreateMovementModal.vue` без
каталога, лежит он не в `src/components/admin/`.

```
$ find . -name "CreateMovementModal.vue" -not -path "*/node_modules/*"
./frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue
```

```
$ grep -n "expense\|write-off" src/views/admin/warehouse/CreateMovementModal.vue
...
270:      (type.value === 'expense' || type.value === 'write-off') &&
295:      (type.value === 'expense' || type.value === 'write-off') &&
330:    (type.value === 'expense' || type.value === 'write-off') &&
343:const showReference = computed(() => type.value === 'expense' || type.value === 'write-off')
```

Четыре копии на месте (номера строк съехали относительно пункта на +14: 256/281/316/329 →
270/295/330/343 — файл правился пунктом про шапку). Воспроизведено.

## 2. Что сделано

Один типизированный список на всё правило, рядом с прочими модульными словарями файла:

```ts
const REFERENCE_REQUIRED_TYPES: ReadonlySet<MovementType> = new Set<MovementType>([
  'expense',
  'write-off',
])
```

и один потребитель-computed перед секцией валидации:

```ts
const requiresReference = computed(
  () => type.value !== '' && REFERENCE_REQUIRED_TYPES.has(type.value),
)
```

Четыре копии заменены на `requiresReference`:

| было (строка) | стало |
|---|---|
| 270 — `validate()`, потолок по `quantityRemaining` | `if (requiresReference.value && props.batch && …)` |
| 295 — `isFormValid` | то же |
| 330 — `quantityError` | то же |
| 343 — `showReference` computed | удалён; шаблон (761) читает `requiresReference` |

Поведение эквивалентно: `type.value !== '' && has(type.value)` истинно ровно на тех же
двух типах. `type: Ref<MovementType | ''>`, `''` не входит в `MovementType`, поэтому
проверка на `''` сужает тип и `has()` типизируется.

Из шапки файла убран абзац «условие … отдельный пункт 4f плана, оно терпит» — он перестал
быть правдой в тот момент, когда условие свели. Врущая шапка — ровно то, за что этот файл
уже правили один раз.

Почему список лежит в компоненте, а не в `services/mocks/warehouse.ts` рядом с
`OUTGOING_MOVEMENT_TYPES`: правило другое (не «уносит металл», а «нужна ссылка на
основание») и других носителей у него нет — греп ниже.

## 3. Приёмка

```
$ cd frontend_vue && npm run typecheck        exit=0
$ npm run lint                                exit=0   (eslint --max-warnings=0)
$ npm run format:check                        exit=0   All matched files use Prettier code style!
$ npm run test:unit                           exit=0   Test Files 24 passed (24) · Tests 575 passed (575)
$ npm run dupes                               exit=0   681 clones, 9.39 % при пороге 10 %
```

Все прогнаны повторно после отката инверсии — дерево в момент коммита то же, что прогонялось.

## 4. Линзы

**Л5 (один источник правила) — подтверждена.** Второй экземпляр правила по всему дереву:

```
$ grep -rn "'expense' || .*'write-off'\|'write-off' || .*'expense'" src/ tests/
(пусто)
$ grep -rn "REFERENCE_REQUIRED_TYPES\|requiresReference" src/ tests/
CreateMovementModal.vue:121,259,260,287,308,339,760,761   — один список, один computed
```

Шире, по `write-off` во всём `src/` и `tests/` (69 вхождений): это словари иконок/меток
(`MOVEMENT_TYPE_ICONS`, `WarehouseStockCard`, `WarehouseBatchCard`), сиды
`src/mocks/warehouse-movements.ts`, `OUTGOING_MOVEMENT_TYPES` и спеки заказов. Правила «нужна
ссылка на основание» среди них нет — второй реализации не существует.

Машинная часть линзы: `npm run dupes` 9.39 % (ниже порога), `npm run lint` с sonarjs — оба
зелёные, то есть ни одинакового текста, ни одинаковой структуры правка не оставила.

**Л1 (реактивность) — подтверждена.** Новый `requiresReference` — `computed` над `ref` `type`,
то есть пересчитывается при смене типа; никакого кэша в обычной переменной. Реактивные
примитивы файла не трогались:

```
$ grep -n "structuredClone\|toRaw(\|useHead(\|watch(" src/views/admin/warehouse/CreateMovementModal.vue
461: watch(   472: watch([selectedAggregateType, selectedSaleId], …)   493: watch(type, …)
```

Все три `watch` прочитаны, ни один не читает удалённый `showReference`.

**Л6 (UI и CSS) — подтверждена.** Единственная правка шаблона — имя в `v-if`. Мёртвых ссылок
не осталось:

```
$ grep -rn "showReference" src/ tests/
(пусто)
```

Классы, `data-test`-атрибуты и разметка блока ссылки не тронуты, значит ни один селектор
не поехал.

**Л10 (целостность) — подтверждена машинной приёмкой:** `vue-tsc --noEmit` зелёный по всему
`src/` и `tests/`; роутер, i18n и флаги не трогались (диф — один файл, см. `git status`).

**Инверсия типизации** (доказательство, что новый список — гейт, а не украшение):
`'write-off'` заменён на `'write-offf'` → typecheck падает

```
Type '"write-offf"' is not assignable to type 'MovementType'. Did you mean '"write-off"'?
```

Файл восстановлен из копии (`grep -c "write-offf"` → 0), приёмка прогнана заново — см. выше.

**Л2, Л3, Л4, Л7, Л8 — вне области:** переводы, HTTP-вызовы, мок, флаги/роуты и логика
сохранения этой правкой не тронуты (диф — один `.vue`, изменены только имена в условиях).

**Л9 — тесты не трогались, инверсия по тестам не требуется.** Отдельно проверено, что
подгонять было бы нечего:

```
$ grep -rln "create-movement-\|batch-card-add-movement-btn" tests/
(пусто)
```

То есть модалку создания движения не открывает ни один e2e-тест. Это не следствие правки, а
состояние, которое было до неё; в объём пункта 4f оно не входит и здесь только зафиксировано.
По той же причине прогон e2e не нужен даже по уровню 1: затронутых спеков ноль.

## 5. Итог

Приёмка зелёная по всем четырём командам плюс `dupes`. Линзы Л1, Л5, Л6, Л10 подтверждены
командами выше; Л2–Л4, Л7–Л9 вне области с указанием причины. Новых находок нет, в bugs-file
ничего не уходило.
