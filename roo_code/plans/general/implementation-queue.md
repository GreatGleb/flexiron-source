# Очередь реализации — из инвентаризации 2026-08-26

Источник: [inventory-2026-08-26.md](../archive/2026-08/roo_code/general/inventory-2026-08-26.md), пересортировано [queue-retriage-2026-08-29.md](queue-retriage-2026-08-29.md) — 30 строк вынуто из счёта. Задач **51** («частично» и «не начато»); 48 планов закрыты вердиктом «сделано» и сюда не входят.

**Как читать.** «Частично» не значит «сделать план целиком» — остаток перечислен в столбце «Что осталось» и подробно в части прогона. Задача начинается с воспроизведения: остаток проверяется в коде, не воспроизвёлся — задача закрывается как устаревшая (см. [autonomous-run-policy-plan.md](autonomous-run-policy-plan.md), раздел 2).

**Волны.** Внутри волны задачи не делят ни одного файла — их можно гнать параллельно (одновременно работают 6 агентов). Волн 23. Файлы извлечены из текстов планов грепом по путям `src/`, `tests/`, `backend/app/` — это оценка владения, а не доказательство: план может тронуть файл, который в нём не назван.

## Волна 1 — 3 задачи

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/refactor/single-locale-save-refactor.md` | частично | Фаза 1 и домены categories/products есть; часть доменов не переведена | 33 | [`part-030.md`](../archive/2026-08/roo_code/general/inventory-parts/part-030.md) |
| `roo_code/plans/warehouse/fix-entity-card-links-plan.md` | частично (скептик) | файлы, роуты и ключи есть, содержание карточек не сверено | 16 | [`part-046.md`](../archive/2026-08/roo_code/general/inventory-parts/part-046.md) |
| `roo_code/plans/warehouse/phase6-subtask1-e2e-mocks.md` | частично | все 10 хелперов плюс шесть сверх плана; 7 чекбоксов | 12 | [`part-053.md`](../archive/2026-08/roo_code/general/inventory-parts/part-053.md) |

## Волна 2 — 4 задачи

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/orders/3.1-orders-plan.md` | частично | план объявляет себя историческим и по существу выполнен; 33 чекбокса остались неотмеченными | 30 | [`part-017.md`](../archive/2026-08/roo_code/general/inventory-parts/part-017.md) |
| `roo_code/plans/bugs/fix-toTranslatedString-merge-bug.md` | частично | слияние есть под другим именем (`mergeLocaleValue`), часть мест не переведена на него | 12 | [`part-009.md`](../archive/2026-08/roo_code/general/inventory-parts/part-009.md) |
| `roo_code/plans/warehouse/safe-cascade-deletion.md` | частично | `orderId` и блокировки есть, часть плана не закрыта | 12 | [`part-054.md`](../archive/2026-08/roo_code/general/inventory-parts/part-054.md) |
| `roo_code/plans/general/settings-cache-data-staleness-plan.md` | частично (скептик) | чекбоксов в плане нет — «0 незакрытых» не вердикт; нужна сверка прозаических требований | 4 | [`part-016.md`](../archive/2026-08/roo_code/general/inventory-parts/part-016.md) |

## Волна 3 — 4 задачи

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/products/01-products-plan.md` | частично | поставка реализована и переросла план; 32 чекбокса не отмечены, остаток — в части | 30 | [`part-026.md`](../archive/2026-08/roo_code/general/inventory-parts/part-026.md) |
| `roo_code/plans/warehouse/update-offcut-statuses-to-match-batches.md` | частично | тип и все ключи i18n есть; 10 чекбоксов открыты | 12 | [`part-055.md`](../archive/2026-08/roo_code/general/inventory-parts/part-055.md) |
| `roo_code/plans/refactor/single-locale-prompts/04-domain-suppliers.md` | частично | три поля оборачиваются и сливаются, остальное по плану — нет | 6 | [`part-034.md`](../archive/2026-08/roo_code/general/inventory-parts/part-034.md) |
| `roo_code/plans/orders/3.2-order-page-shared-components.md` | частично (скептик) | чекбоксов в плане нет вовсе — вердикт «сделано» держался на пустом счёте | 4 | [`part-018.md`](../archive/2026-08/roo_code/general/inventory-parts/part-018.md) |

## Волна 4 — 3 задачи

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/sales-crm/01-sales-crm-initial-plan.md` | частично | инфраструктура (роут, флаг, типы) есть, сама страница — нет; 9 чекбоксов | 18 | [`part-036.md`](../archive/2026-08/roo_code/general/inventory-parts/part-036.md) |
| `roo_code/plans/warehouse/new-tasks-autotests-plan.md` | частично | все пять шагов заведены, часть тестов не дописана | 11 | [`part-051.md`](../archive/2026-08/roo_code/general/inventory-parts/part-051.md) |
| `roo_code/plans/warehouse/phase3-subtask2-WarehouseBatchCard.md` | частично | 7 из 10 `data-test` есть; 12 чекбоксов открыты | 8 | [`part-052.md`](../archive/2026-08/roo_code/general/inventory-parts/part-052.md) |

## Волна 5 — 2 задачи

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/warehouse-page-plan.md` | частично | нет модалки/печати QR, двух подвкладок дефицита, `GET /api/warehouse/locations`; два флага мертвы | 28 | [`part-057.md`](../archive/2026-08/roo_code/general/inventory-parts/part-057.md) |
| `roo_code/plans/refactor/single-locale-prompts/03-domain-products.md` | частично | обёртки в сервисе есть, часть требований плана не закрыта | 5 | [`part-034.md`](../archive/2026-08/roo_code/general/inventory-parts/part-034.md) |

## Волна 6 — 3 задачи

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/orders/3.3-order-returns-plan.md` | частично | реализовано почти всё; остаток перечислен в части | 24 | [`part-019.md`](../archive/2026-08/roo_code/general/inventory-parts/part-019.md) |
| `roo_code/plans/warehouse/phase5-subtask2-improve-tabs.md` | частично | бейджи, размеры и быстрые действия есть; 12 чекбоксов открыты | 9 | [`part-053.md`](../archive/2026-08/roo_code/general/inventory-parts/part-053.md) |
| `roo_code/plans/refactor/single-locale-prompts/06-domain-config.md` | частично | поля `name` оборачиваются и сливаются, часть требований не закрыта | 4 | [`part-034.md`](../archive/2026-08/roo_code/general/inventory-parts/part-034.md) |

## Волна 7 — 3 задачи

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/services/services-page-plan.md` | частично (скептик) | план из 10 промптов не сверён по пунктам — ни `- [ ]`, ни `- [x]` в файле | 22 | [`part-038.md`](../archive/2026-08/roo_code/general/inventory-parts/part-038.md) |
| `roo_code/plans/refactor/single-locale-prompts/02-domain-categories.md` | частично (скептик) | вызовы `toTranslatedString` есть, но требования плана не выполнены — нужна проверка срабатывания | 5 | [`part-034.md`](../archive/2026-08/roo_code/general/inventory-parts/part-034.md) |
| `roo_code/plans/bugs/fix-structuredClone-v2.md` | частично (скептик) | пункты 1–3 есть, остаток плана не выполнен | 2 | [`part-009.md`](../archive/2026-08/roo_code/general/inventory-parts/part-009.md) |

## Волна 8 — 6 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/bugs/static-analysis-debt-bugs.md` | частично | из девяти записей закрыта часть; статус несёт таблица в конце файла | 17 | [`part-011.md`](../archive/2026-08/roo_code/general/inventory-parts/part-011.md) |
| `roo_code/plans/services/service-card-page-plan.md` | частично (скептик) | вердикт держался на счёте чекбоксов, которых нет; визуальных тестов в спеке нет | 14 | [`part-037.md`](../archive/2026-08/roo_code/general/inventory-parts/part-037.md) |
| `roo_code/plans/products/uom-restructure-completion-plan.md` | частично | шаги 1, 2 и почти весь 5 сделаны; 23 чекбокса открыты | 11 | [`part-028.md`](../archive/2026-08/roo_code/general/inventory-parts/part-028.md) |
| `roo_code/plans/bugs/settings-notifications-bugs.md` | частично | три бага с разделом «Fix» закрыты, остальные записи без починки | 6 | [`part-010.md`](../archive/2026-08/roo_code/general/inventory-parts/part-010.md) |
| `roo_code/plans/warehouse/stock-card-restructure-plan.md` | частично (скептик) | перестройка шаблона есть, остальные требования плана не доказаны | 4 | [`part-054.md`](../archive/2026-08/roo_code/general/inventory-parts/part-054.md) |
| `roo_code/plans/warehouse/add-action-buttons-to-warehouse-tabs.md` | частично | тулбар и экспорт есть, часть кнопок плана — нет | 3 | [`part-040.md`](../archive/2026-08/roo_code/general/inventory-parts/part-040.md) |

## Волна 9 — 3 задачи

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/refactor/single-locale-prompts/08-phase3-global-cleanup.md` | частично | пункты 1, 3, 4 сделаны; GET-роуты мока не соответствуют букве плана | 17 | [`part-035.md`](../archive/2026-08/roo_code/general/inventory-parts/part-035.md) |
| `roo_code/plans/warehouse/phase6-subtask2-e2e-spec.md` | частично | спек на ~50 тестов есть; 8 чекбоксов открыты | 10 | [`part-053.md`](../archive/2026-08/roo_code/general/inventory-parts/part-053.md) |
| `roo_code/plans/orders/pricing-section-rework-plan.md` | частично | разделы 2–4 устарели по существу; раздел 1 (переименования) не выполнен | 7 | [`part-024.md`](../archive/2026-08/roo_code/general/inventory-parts/part-024.md) |

## Волна 10 — 3 задачи

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/orders/currency-fix-and-fifo-plan.md` | частично | Phase A и B сделаны (кроме UI движения), Phase C не начата — 5 чекбоксов | 16 | [`part-020.md`](../archive/2026-08/roo_code/general/inventory-parts/part-020.md) |
| `roo_code/plans/warehouse/offcut-create-page-plan.md` | частично (скептик) | доказательство содержало ложный факт про `CreateOffcutModal` — сверка нужна заново | 8 | [`part-051.md`](../archive/2026-08/roo_code/general/inventory-parts/part-051.md) |
| `roo_code/plans/warehouse/fix-warehouse-table-row-padding.md` | частично (скептик) | Change 3 (responsive adjustments) — мёртвый код, план не закрыт | 2 | [`part-049.md`](../archive/2026-08/roo_code/general/inventory-parts/part-049.md) |

## Волна 11 — 3 задачи

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/bugs/3.1-orders-card-bugs.md` | частично (скептик) | 22 из 23 багов закрыты, один не подтверждён | 12 | [`part-006.md`](../archive/2026-08/roo_code/general/inventory-parts/part-006.md) |
| `roo_code/plans/bugs/fix-4-remaining-products-bugs.md` | частично | из четырёх багов закрыты не все — остаток в части | 6 | [`part-007.md`](../archive/2026-08/roo_code/general/inventory-parts/part-007.md) |
| `roo_code/plans/bugs/fix-clients-delete-modal-text.md` | частично (скептик) | буквальные правки на месте, но требование сверх них не подтверждено | 0 | [`part-007.md`](../archive/2026-08/roo_code/general/inventory-parts/part-007.md) |

## Волна 12 — 3 задачи

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/warehouse-phase2-bugs.md` | частично (скептик) | отчёт из 40 пунктов прозой — проверен выборочно, нужна пунктная перепроверка | 11 | [`part-058.md`](../archive/2026-08/roo_code/general/inventory-parts/part-058.md) |
| `roo_code/plans/general/settings-plan.md` | частично | нет `WarehouseSector`, часть поставки плана не закрыта | 0 | [`part-016.md`](../archive/2026-08/roo_code/general/inventory-parts/part-016.md) |
| `roo_code/plans/refactor/single-locale-prompts/09-phase4-verification.md` | частично | тайпчек и билд чисты, e2e — выборкой; ручной чеклист (10 пунктов) не покрыт | 0 | [`part-035.md`](../archive/2026-08/roo_code/general/inventory-parts/part-035.md) |

## Волна 13 — 1 задача

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/bugs/fix-filter-transition-flicker.md` | частично (скептик) | шаги 1–3 сделаны, дальше плана — нет | 1 | [`part-008.md`](../archive/2026-08/roo_code/general/inventory-parts/part-008.md) |

## Волна 14 — 1 задача

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/phase4-subtask2-CreateMovementModal.md` | частично | модалка есть, но партия приходит пропом — селектора партий и `unitPrice` нет; 10 чекбоксов | 9 | [`part-052.md`](../archive/2026-08/roo_code/general/inventory-parts/part-052.md) |

## Волна 15 — 1 задача

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/products/product-uom-restructure-plan.md` | частично | шаги 1,2,5–9 есть; остальные шаги не выполнены | 6 | [`part-027.md`](../archive/2026-08/roo_code/general/inventory-parts/part-027.md) |

## Волна 16 — 1 задача

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/general/user-dropdown-menu-plan.md` | частично | всё есть, включая опциональный пункт 5; остаток — мелкие расхождения с буквой | 5 | [`part-016.md`](../archive/2026-08/roo_code/general/inventory-parts/part-016.md) |

## Волна 17 — 1 задача

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/stock-remainder-card-plan.md` | частично | нет кнопки retry в состоянии ошибки и отдельной кнопки; 9 чекбоксов | 8 | [`part-054.md`](../archive/2026-08/roo_code/general/inventory-parts/part-054.md) |

## Волна 18 — 1 задача

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/offcut-movements-plan.md` | частично | цель достигнута шире плана, но ни одна правка не там, куда план её адресовал; 16 чекбоксов | 7 | [`part-051.md`](../archive/2026-08/roo_code/general/inventory-parts/part-051.md) |

## Волна 19 — 1 задача

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/warehouse-expandable-rows-plan.md` | не начато | нет ничего: ни `ExpandableTable.vue`, ни состояния expand, ни типов, ни полей | 7 | [`part-056.md`](../archive/2026-08/roo_code/general/inventory-parts/part-056.md) |

## Волна 20 — 1 задача

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/fix-warehouse-stock-delete-mock.md` | не начато | ни одной из трёх правок нет; премисса плана под вопросом (см. `remove-stock-deletion`) | 6 | [`part-049.md`](../archive/2026-08/roo_code/general/inventory-parts/part-049.md) |

## Волна 21 — 1 задача

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/generalize-offcuts-for-all-categories.md` | частично | шаги 1 и 3 есть, остальные — нет | 6 | [`part-049.md`](../archive/2026-08/roo_code/general/inventory-parts/part-049.md) |

## Волна 22 — 1 задача

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/remove-stock-deletion.md` | частично (скептик) | удаление вырезано, но нарушено ограничение области плана (лишний коммит) | 6 | [`part-054.md`](../archive/2026-08/roo_code/general/inventory-parts/part-054.md) |

## Волна 23 — 1 задача

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/implement-batch-card-write-off.md` | частично | ни одной из трёх правок плана нет — ключи `write_off_*` в коде отсутствуют | 3 | [`part-050.md`](../archive/2026-08/roo_code/general/inventory-parts/part-050.md) |
