# План проверки: серверная фильтрация/сортировка/пагинация в warehouse вкладках

## Цель
Проверить, что все 5 вкладок warehouse (Stock, Batches, Offcuts, Movements, Deficit) используют серверную фильтрацию, сортировку и пагинацию, а не делают это на клиенте.

## Текущее состояние (по анализу кода)

**Все 5 вкладок уже спроектированы для серверной обработки.** Сервисный слой (`warehouseService.ts`) отправляет соответствующие query-параметры на бэкенд. Моки (`mocks/warehouse.ts`) делают всё на клиенте, но это ожидаемо — они только имитируют сервер.

## Результаты проверки (12.05.2026)

### Stock tab — ✅ ПРОВЕРЕНО
| Действие | Параметры в запросе | Статус |
|---|---|---|
| Начальная загрузка | `search: ''`, `page: '1'`, `pageSize: '25'` | ✅ |
| Поиск "steel" | `search: 'steel'` | ✅ |
| Фильтр по категории | `categoryIds: 'cat-2'` | ✅ |
| Фильтр по единице | `unit: 'kg'` | ✅ |
| Show deficit only | `showDeficitOnly: 'true'` | ✅ |
| Show in stock only | `showInStockOnly: 'true'` | ✅ |
| Сортировка по name | `sortBy: 'name'`, `sortDir: 'asc'/'desc'` | ✅ |
| Сортировка по totalQuantity | `sortBy: 'totalQuantity'`, `sortDir: 'asc'/'desc'` | ✅ |
| Сортировка по unit | `sortBy: 'unit'`, `sortDir: 'asc'/'desc'` | ✅ |
| Сортировка по avgUnitPrice | `sortBy: 'avgUnitPrice'`, `sortDir: 'asc'/'desc'` | ✅ |
| Пагинация стр. 2 | `page: '2'` | ✅ |

### Batches tab — ✅ ПРОВЕРЕНО
| Действие | Параметры в запросе | Статус |
|---|---|---|
| Начальная загрузка | `search: ''`, `page: '1'`, `pageSize: '25'`, `sortDir: 'asc'` | ✅ |
| Поиск "steel" | `search: 'steel'` | ✅ |
| Фильтр по статусу | `status: 'available'` | ✅ |
| Фильтр по поставщику | `supplierId: 'sup-001'` | ✅ |
| Фильтр по единице | `unit: 'kg'` | ✅ |
| Фильтр по дате | `dateFrom: '2024-11-01'` | ✅ |
| Пагинация стр. 2 | `page: '2'` | ✅ |

### Offcuts tab — ✅ ПРОВЕРЕНО (с исправлением бага)
| Действие | Параметры в запросе | Статус |
|---|---|---|
| Начальная загрузка | `search: ''`, `page: '1'`, `pageSize: '25'`, `sortDir: 'asc'` | ✅ |
| Поиск "steel" | `search: 'steel'` | ✅ |
| Фильтр по статусу | `status: 'available'` | ✅ |
| Фильтр по единице | `unit: 'pcs'` | ✅ |
| Пагинация pageSize 10 | `pageSize: '10'` | ✅ |
| Пагинация стр. 2, 3 | `page: '2'`, `page: '3'` | ✅ |
| Сортировка по batchNumber | `sortBy: 'batchNumber'`, `sortDir: 'asc'/'desc'` | ✅ |
| Сортировка по lengthMm | `sortBy: 'lengthMm'`, `sortDir: 'asc'/'desc'` | ✅ |
| Сортировка по productName | `sortBy: 'productName'`, `sortDir: 'asc'/'desc'` | ✅ |
| Сортировка по quantity | `sortBy: 'quantity'`, `sortDir: 'asc'/'desc'` | ✅ |
| Сортировка по unit | `sortBy: 'unit'`, `sortDir: 'asc'/'desc'` | ✅ |
| Сортировка по location | `sortBy: 'location'`, `sortDir: 'asc'/'desc'` | ✅ |
| Сортировка по status | `sortBy: 'status'`, `sortDir: 'asc'/'desc'` | ✅ |
| Сортировка по weightKg | `sortBy: 'weightKg'`, `sortDir: 'asc'/'desc'` | ✅ |

### Movements tab — ✅ ПРОВЕРЕНО
| Действие | Параметры в запросе | Статус |
|---|---|---|
| Начальная загрузка | `search: ''`, `page: '1'`, `pageSize: '25'`, `sortDir: 'asc'` | ✅ |
| Поиск "steel" | `search: 'steel'` | ✅ |
| Фильтр по типу | `type: 'receipt'` | ✅ |
| Фильтр по дате | `dateFrom: '2025-01-14'` | ✅ |
| Фильтр по единице | `unit: 'pcs'` | ✅ |
| Фильтр по категории | `categoryIds: 'cat-2,cat-3'` → `'cat-3'` | ✅ |
| Фильтр по batchNumber | `batchNumber: '021'` | ✅ |
| Пагинация pageSize 10 | `pageSize: '10'` | ✅ |
| Пагинация стр. 4, 3 | `page: '4'`, `page: '3'` | ✅ |

### Deficit tab — ✅ ПРОВЕРЕНО
| Действие | Параметры в запросе | Статус |
|---|---|---|
| Начальная загрузка | `search: ''`, `page: '1'`, `pageSize: '25'`, `sortDir: 'asc'` | ✅ |
| Поиск "steel" | `search: 'steel'` | ✅ |
| Фильтр по статусу | `status: 'open'` | ✅ |
| Фильтр по приоритету | `priority: 'critical'` | ✅ |
| Фильтр по единице | `unit: 'pcs'` | ✅ |
| Пагинация pageSize 10 | `pageSize: '10'` | ✅ |
| Пагинация стр. 2 | `page: '2'` | ✅ |
| Сортировка по priority | `sortBy: 'priority'`, `sortDir: 'asc'/'desc'` | ✅ |
| Сортировка по status | `sortBy: 'status'`, `sortDir: 'asc'/'desc'` | ✅ |
| Сортировка по unit | `sortBy: 'unit'`, `sortDir: 'asc'/'desc'` | ✅ |
| Сортировка по deficitAmount | `sortBy: 'deficitAmount'`, `sortDir: 'asc'/'desc'` | ✅ |
| Сортировка по minRequired | `sortBy: 'minRequired'`, `sortDir: 'asc'/'desc'` | ✅ |
| Сортировка по currentStock | `sortBy: 'currentStock'`, `sortDir: 'asc'/'desc'` | ✅ |
| Сортировка по productName | `sortBy: 'productName'`, `sortDir: 'asc'/'desc'` | ✅ |

## Найденные и исправленные проблемы

### Баг: Offcuts сортировка не работала
- **Файл**: [`frontend_vue/src/composables/useWarehouse.ts`](../frontend_vue/src/composables/useWarehouse.ts:208)
- **Проблема**: В `loadOffcuts()` не встраивался `offcutsSort` в filters перед отправкой в API. Функция передавала `offcutFilters` напрямую без sort-параметров.
- **Исправление**: Добавлено создание `offcutFiltersForApi` с включением `sortBy` и `sortDir` из `offcutsSort`, по аналогии с `loadBatches()`, `loadMovements()` и `loadDeficit()`.
- **Статус**: Исправлено и подтверждено через DevTools.

## Проверка консистентности — ✅

| Аспект | Статус |
|---|---|
| Все табы используют паттерн: изменение фильтра → watch → reset pagination → вызов API | ✅ |
| `toggleStockSort` использует `stockFilters.sortBy` (встроено в фильтры) | ✅ |
| Остальные табы имеют отдельные sort-объекты (`batchesSort`, `offcutsSort`, `movementsSort`, `deficitSort`) | ✅ |
| Все `toggle*Sort` функции корректно вызываются из шаблона | ✅ |
| Все `*Filters`/`*Sort` объекты используются в соответствующих `load*` функциях | ✅ (был баг в `loadOffcuts` — исправлен) |
| Все watch на sort-объектах вызывают reset pagination + reload | ✅ |

## Как проверялось

1. В [`services/mocks/index.ts`](../frontend_vue/src/services/mocks/index.ts) были добавлены временные `console.log` для каждого warehouse endpoint
2. В [`services/mocks/warehouse.ts`](../frontend_vue/src/services/mocks/warehouse.ts) был добавлен `console.log` в `mockGetStockOverview`
3. DevTools Console использовался для наблюдения за параметрами запросов при каждом действии пользователя
4. После проверки все временные `console.log` удалены

## Вывод

**Все 5 вкладок корректно спроектированы для серверной обработки.** Фильтрация, сортировка и пагинация отправляются как query-параметры в HTTP-запросах. При переключении на реальный API нужно будет только заменить моки на реальные эндпоинты — сервисный слой и композабл уже полностью готовы.
