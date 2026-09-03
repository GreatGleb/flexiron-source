# Анализ: Резка партий на обрезки — ТЗ vs Реализация

## Вопросы и ответы по коду

### 1. Уменьшается ли количество в партии при создании обрезка?

**Нет.** [`mockCreateOffcut`](frontend_vue/src/services/mocks/warehouse.ts:433) просто создаёт offcut и пушит в `offcutStore`. Код **не трогает `batch.quantityRemaining`**. Это баг — остаток партии не синхронизируется.

При этом [`mockCreateMovement`](frontend_vue/src/services/mocks/warehouse.ts:623) при типе `'offcut'` **уменьшает** `batch.quantityRemaining`. То есть если бы создавалось движение — остаток бы уменьшался.

### 2. Нужен ли kerf (ширина реза)?

**Нет, при текущей модели учёта — не нужен.** У нас всё считается в **общем количестве** (кг, м, шт, м²). Kerf имеет смысл только для точного линейного раскроя (труба 6м — отрезали 2500мм + 3мм пропил = 2503мм списано). Но если мы списываем **2500мм** (значение из формы), то остаток уменьшается на 2500, и kerf не влияет.

Kerf понадобится, когда появится функциональность «Отрезать от партии» с автоматическим расчётом длины реза. Пока — не актуально.

### 3. Что такое mockExecuteCutting и зачем он нужен?

Это мок для отдельного эндпоинта [`POST /api/warehouse/cutting`](frontend_vue/src/services/mocks/index.ts:488). В ТЗ описана операция «Резка» как отдельный бизнес-процесс:

```
Выбрать партию → указать длину → kerf → создание обрезка + списание
```

Но UI для него **нет** — нет модалки или страницы, которая вызывала бы этот эндпоинт. Сейчас создание обрезка идёт через прямой `POST /api/warehouse/offcuts`, который не уменьшает партию.

**Mock работает неправильно** — возвращает `{ offcuts: [], wasteQuantity: 0 }`, не создавая offcuts в хранилище.

### 4. Автоматический пересчёт веса/цены — как?

По габаритам × плотность материала. Например:
- Лист 2×1м, толщина 2мм, сталь (плотность ~7900 кг/м³)
- Вес = 2 × 1 × 0.002 × 7900 = 31.6 кг

Но это требует данных о плотности в карточке товара/категории. Сейчас не реализовано, пользователь вводит вес вручную.

### 5. Фото/чертежи для обрезка

**У партии** — `WarehouseBatch.files: WarehouseBatchFile[]` ✅ — есть DropZone в [`WarehouseBatchCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue:935).

**У обрезка** — в типе [`WarehouseOffcut`](frontend_vue/src/types/warehouse.ts:145) **нет поля `files`** ❌. Нельзя прикрепить фото к обрезку. В карточке обрезка тоже нет DropZone.

### 6. Авто-создание движения при создании обрезка?

**Нет.** [`mockCreateOffcut`](frontend_vue/src/services/mocks/warehouse.ts:433) не вызывает `mockCreateMovement`. Движение не создаётся, и остаток партии не уменьшается.

Если бы движение создавалось с типом `'offcut'`, то [`mockCreateMovement`](frontend_vue/src/services/mocks/warehouse.ts:623) автоматически уменьшил бы `batch.quantityRemaining`.

### 7. Умный подбор обрезков при раскрое — как?

При создании заказа система анализирует существующие обрезки и подбирает оптимальный по размеру. Это сложный алгоритм оптимизации раскроя. **Не реализовано** и не запланировано.

---

## Что нужно исправить (вывод)

| Что | Где | Приоритет |
|-----|-----|-----------|
| При создании обрезка уменьшать `batch.quantityRemaining` | [`mockCreateOffcut`](frontend_vue/src/services/mocks/warehouse.ts:433) | 🔴 Высокий |
| При создании обрезка создавать движение с типом `offcut` | [`mockCreateOffcut`](frontend_vue/src/services/mocks/warehouse.ts:433) | 🔴 Высокий |
| Добавить поле `files` в `WarehouseOffcut` и DropZone в карточку обрезка | [`types/warehouse.ts`](frontend_vue/src/types/warehouse.ts:145), `WarehouseOffcutCard.vue` | 🟡 Средний |
| UI для операции резки (cutting modal/page) | Новый компонент | 🟡 Средний |
| Исправить `mockExecuteCutting` | [`services/mocks/warehouse.ts:740`](frontend_vue/src/services/mocks/warehouse.ts:740) | 🟡 Средний |
