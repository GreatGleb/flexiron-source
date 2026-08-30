# Очередь реализации — из инвентаризации 2026-08-26

Источник: [inventory-2026-08-26.md](../archive/2026-08/roo_code/general/inventory-2026-08-26.md), пересортировано [queue-retriage-2026-08-29.md](queue-retriage-2026-08-29.md) — 30 строк вынуто из счёта. Задач **16** («частично» и «не начато»); 48 планов закрыты вердиктом «сделано» и сюда не входят.

**Как читать.** «Частично» не значит «сделать план целиком» — остаток перечислен в столбце «Что осталось» и подробно в части прогона. Задача начинается с воспроизведения: остаток проверяется в коде, не воспроизвёлся — задача закрывается как устаревшая (см. [autonomous-run-policy-plan.md](autonomous-run-policy-plan.md), раздел 2).

**Волны.** Внутри волны задачи не делят ни одного файла — их можно гнать параллельно (одновременно работают 6 агентов). Волн 12. Файлы извлечены из текстов планов грепом по путям `src/`, `tests/`, `backend/app/` — это оценка владения, а не доказательство: план может тронуть файл, который в нём не назван.

## Волна 1 — 1 задача

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/refactor/single-locale-save-refactor.md` | частично | Фаза 1 и домены categories/products есть; часть доменов не переведена | 33 | [`part-030.md`](../archive/2026-08/roo_code/general/inventory-parts/part-030.md) |

## Волна 2 — 3 задачи

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/bugs/fix-toTranslatedString-merge-bug.md` | частично | слияние есть под другим именем (`mergeLocaleValue`), часть мест не переведена на него | 12 | [`part-009.md`](../archive/2026-08/roo_code/general/inventory-parts/part-009.md) |
| `roo_code/plans/warehouse/safe-cascade-deletion.md` | частично | `orderId` и блокировки есть, часть плана не закрыта | 12 | [`part-054.md`](../archive/2026-08/roo_code/general/inventory-parts/part-054.md) |
| `roo_code/plans/general/settings-cache-data-staleness-plan.md` | частично (скептик) | чекбоксов в плане нет — «0 незакрытых» не вердикт; нужна сверка прозаических требований | 4 | [`part-016.md`](../archive/2026-08/roo_code/general/inventory-parts/part-016.md) |

## Волна 3 — 1 задача

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/warehouse-page-plan.md` | частично | нет модалки/печати QR, двух подвкладок дефицита, `GET /api/warehouse/locations`; два флага мертвы | 28 | [`part-057.md`](../archive/2026-08/roo_code/general/inventory-parts/part-057.md) |

## Волна 4 — 2 задачи

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/bugs/static-analysis-debt-bugs.md` | частично | из девяти записей закрыта часть; статус несёт таблица в конце файла | 17 | [`part-011.md`](../archive/2026-08/roo_code/general/inventory-parts/part-011.md) |
| `roo_code/plans/warehouse/add-action-buttons-to-warehouse-tabs.md` | частично | тулбар и экспорт есть, часть кнопок плана — нет | 3 | [`part-040.md`](../archive/2026-08/roo_code/general/inventory-parts/part-040.md) |

## Волна 5 — 1 задача

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/orders/currency-fix-and-fifo-plan.md` | частично | Phase A и B сделаны (кроме UI движения), Phase C не начата — 5 чекбоксов | 16 | [`part-020.md`](../archive/2026-08/roo_code/general/inventory-parts/part-020.md) |

## Волна 6 — 1 задача

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/bugs/fix-clients-delete-modal-text.md` | частично (скептик) | буквальные правки на месте, но требование сверх них не подтверждено | 0 | [`part-007.md`](../archive/2026-08/roo_code/general/inventory-parts/part-007.md) |

## Волна 7 — 2 задачи

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/general/settings-plan.md` | частично | нет `WarehouseSector`, часть поставки плана не закрыта | 0 | [`part-016.md`](../archive/2026-08/roo_code/general/inventory-parts/part-016.md) |
| `roo_code/plans/refactor/single-locale-prompts/09-phase4-verification.md` | частично | тайпчек и билд чисты, e2e — выборкой; ручной чеклист (10 пунктов) не покрыт | 0 | [`part-035.md`](../archive/2026-08/roo_code/general/inventory-parts/part-035.md) |

## Волна 8 — 1 задача

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/phase4-subtask2-CreateMovementModal.md` | частично | модалка есть, но партия приходит пропом — селектора партий и `unitPrice` нет; 10 чекбоксов | 9 | [`part-052.md`](../archive/2026-08/roo_code/general/inventory-parts/part-052.md) |

## Волна 9 — 1 задача

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/stock-remainder-card-plan.md` | частично | нет кнопки retry в состоянии ошибки и отдельной кнопки; 9 чекбоксов | 8 | [`part-054.md`](../archive/2026-08/roo_code/general/inventory-parts/part-054.md) |

## Волна 10 — 1 задача

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/warehouse-expandable-rows-plan.md` | не начато | нет ничего: ни `ExpandableTable.vue`, ни состояния expand, ни типов, ни полей | 7 | [`part-056.md`](../archive/2026-08/roo_code/general/inventory-parts/part-056.md) |

## Волна 11 — 1 задача

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/generalize-offcuts-for-all-categories.md` | частично | шаги 1 и 3 есть, остальные — нет | 6 | [`part-049.md`](../archive/2026-08/roo_code/general/inventory-parts/part-049.md) |

## Волна 12 — 1 задача

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/implement-batch-card-write-off.md` | частично | ни одной из трёх правок плана нет — ключи `write_off_*` в коде отсутствуют | 3 | [`part-050.md`](../archive/2026-08/roo_code/general/inventory-parts/part-050.md) |
