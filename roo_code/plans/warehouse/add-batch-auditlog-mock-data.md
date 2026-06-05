# План: добавить auditLog данным для партий склада

## Контекст

В мок-данных склада у **партий (batches)** полностью отсутствует `auditLog` — как в типе `WarehouseBatch`, так и в данных. API-функция `mockGetBatchAudit` возвращает пустой массив. Пользователь хочет, чтобы хотя бы у 10 партий была реалистичная история изменений.

## Требуемые изменения

### 1. Тип `WarehouseBatch` — добавить поле `auditLog`

**Файл:** [`frontend_vue/src/types/warehouse.ts`](frontend_vue/src/types/warehouse.ts), интерфейс `WarehouseBatch` (строка 55)

Добавить поле:
```ts
/** Batch change audit log */
auditLog: StockAuditEntry[]
```

### 2. Мок-данные партий — добавить `auditLog` для 10+ партий

**Файл:** [`frontend_vue/src/mocks/warehouse-batches.ts`](frontend_vue/src/mocks/warehouse-batches.ts)

Выбрать 12 партий с разными статусами и добавить для каждой от 1 до 3 записей `auditLog`:

| Batch ID | Продукт | Статус | Записей auditLog | Смысл |
|---|---|---|---|---|
| `whb-001` | prod-001 (Лист 3мм) | available | 3 | Создание, перемещение, расход |
| `whb-003` | prod-009 (Труба 60x4) | partial | 2 | Создание, частичный расход |
| `whb-006` | prod-020 (Пруток 20мм) | partial | 2 | Создание, перемещение на склад |
| `whb-011` | prod-023 (Катанка 8мм) | available | 1 | Только создание |
| `whb-015` | prod-026 (Проволока 2мм) | partial | 2 | Создание, расход |
| `whb-019` | prod-002 (Лист ал. 2мм) | in_storage | 2 | Создание, перемещение в storage |
| `whb-025` | prod-031 (Электрод 3мм) | partial | 3 | Создание, частичный расход, корректировка |
| `whb-032` | prod-005 (Лист оцинк. 1мм) | in_production | 2 | Создание, передача в производство |
| `whb-044` | prod-035 (Круг 30мм) | partial | 2 | Создание, списание |
| `whb-058` | prod-041 (Балка 20Б1) | partial | 2 | Создание, отгрузка |
| `whb-077` | prod-004 (Труба проф. 40x40) | partial | 3 | Создание, частичный расход, изменение статуса |
| `whb-091` | prod-013 (Швеллер 14П) | sold | 2 | Создание, полная продажа |

Каждая запись auditLog имеет структуру:
```ts
{
  timestamp: string       // ISO дата
  user: TranslatedString  // { ru, en, lt }
  userInitials: string    // 2 буквы
  property: TranslatedString // что изменилось
  oldValue: string        // старое значение
  newValue: string        // новое значение
}
```

Пользователи (как в products.ts):
- `{ ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' }` / `'IN'`
- `{ ru: 'Елена К.', en: 'Elena K.', lt: 'Elena K.' }` / `'EK'`
- `{ ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' }` / `'MV'`
- `{ ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' }` / `'AZ'`
- `{ ru: 'Ольга П.', en: 'Olga P.', lt: 'Olga P.' }` / `'OP'`
- `{ ru: 'Система', en: 'System', lt: 'Sistema' }` / `'SY'`

Типовые свойства:
- `{ ru: 'Статус', en: 'Status', lt: 'Būsena' }` — при смене статуса
- `{ ru: 'Количество', en: 'Quantity', lt: 'Kiekis' }` — при расходе/корректировке
- `{ ru: 'Расположение', en: 'Location', lt: 'Vieta' }` — при перемещении
- `{ ru: 'Цена', en: 'Price', lt: 'Kaina' }` — при изменении цены
- `{ ru: 'Примечания', en: 'Notes', lt: 'Pastabos' }` — при изменении заметок
- `{ ru: 'Партия создана', en: 'Batch created', lt: 'Partija sukurta' }` — при создании

### 3. Сервис `warehouse.ts` — обновить `mockGetBatchAudit`

**Файл:** [`frontend_vue/src/services/mocks/warehouse.ts`](frontend_vue/src/services/mocks/warehouse.ts)

Функция `mockGetBatchAudit` (строка 883): изменить с `return []` на чтение `auditLog` из `batchStore`:
```ts
export async function mockGetBatchAudit(batchId: string): Promise<StockAuditEntry[]> {
  const batch = batchStore.find((b) => b.id === batchId)
  return batch?.auditLog ?? []
}
```

### 4. `mockCreateBatch` — добавить пустой `auditLog`

**Файл:** [`frontend_vue/src/services/mocks/warehouse.ts`](frontend_vue/src/services/mocks/warehouse.ts)

В объекте `batch` (строка 328) добавить поле:
```ts
auditLog: [],
```

### 5. `mockGetBatch` — НЕ нужно менять

Функция уже возвращает `{ ...batch }` (строка 308), что включает все поля, включая `auditLog` после добавления.

## Проверка

После изменений проверить, что:
1. BatchCardPage.vue загружает и отображает auditLog для партии
2. Компонент секции истории изменений корректно рендерится
