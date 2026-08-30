# Журнал сверки планов вне архива — начат 2026-08-30

Цель — инвариант из [`ROO.md`](../../../ROO.md) «Archive rule»: вне архива только актуальные
планы. Вердикты в очереди унаследованы от инвентаризации 2026-08-26 и **не перепроверены**,
а она ошибалась в обе стороны. Здесь по каждому файлу — доказан ли он.


## Как заполнять


Один файл — одна строка. Колонка «Проверено» пуста, пока вердикт не доказан **грепом по коду**
по конкретному утверждению из «Унаследовано». Счёт чекбоксов вердиктом не является.


| Знак | Значение | Что делать |
|---|---|---|
| ⬜ | не проверен | взять в работу |
| ✅ | актуален — работа правда предстоит | остаётся вне архива |
| 📦 | неактуален — выполнен / сделано иначе / премисса исчезла | `git mv` в архив |
| 🗑 | предписанный подход заменён другим, файл вводит в заблуждение | удалить |


## Прогресс


**Проверено 6 из 89.** По доменам ниже.


### warehouse — 42


| ✓ | Файл | Унаследовано | Чем доказано |
|---|---|---|---|
| ✅ | `add-action-buttons-to-warehouse-tabs.md` | частично — тулбар и экспорт есть, часть кнопок плана — нет | есть Export, New Batch, New Offcut, Page Config; **нет** New Stock Item, New Movement, Add to Deficit — остаток реален |
| ⬜ | `add-batch-auditlog-mock-data.md` | частично (скептик) — 12 блоков `auditLog` есть, но с таблицей плана не сходятся — типы записей другие | |
| 📦 | `add-batch-card-currency-selector.md` | частично — тип, форма и композабл есть, часть плана не закрыта | `currency: string` в `types/warehouse.ts:103`, 7 вхождений в композабле, 26 в моке, селектор в `WarehouseBatchCard.vue:778–783` |
| ⬜ | `add-batch-mock-files.md` | частично (скептик) — количество файлов сходится, тип каждого документа — нет (расхождение в трёх местах) | |
| 📦 | `add-deficit-tab-sorting.md` | частично — сортировка и композабл есть, часть плана — нет | `deficitSort` в `useWarehouse.ts:166`, уходит в API (289–290), тоггл 552; индикаторы в UI `WarehousePage.vue:3402–3412`; мок сортирует `mocks/warehouse.ts:1636–1643` |
| 📦 | `add-movement-type-hints-in-dropdown.md` | частично (скептик) — правила `.option-hint { font-size: 11px }` в `_custom-select.css` нет | вердикт был ложным: `.option-hint` стилизован в `styles/admin/components/_custom-select.css:75` (инвентаризация искала в `styles/components/`), span в `CustomSelect.vue:85`, 45 ключей подсказок |
| ⬜ | `add-offcut-movements.md` | частично — есть всё, кроме переводов примечаний | |
| ⬜ | `auto-create-movement-on-location-change.md` | частично — шаги 1, 3, 5 сделаны, шаги 2 и 4 — нет | |
| ⬜ | `auto-create-movement-on-offcut-location-change.md` | частично — шаг 1 перевыполнен, остальные шаги не закрыты | |
| 📦 | `correction-behavior-refinement.md` | частично (скептик) — нет красной подсказки под полем при отрицательном значении (Problem #2) | отрицательное количество даёт ошибку под полем — `CreateMovementModal.vue:272` `e.quantity = t('validation.min')`, и форма блокируется (298) |
| ⬜ | `enhance-movement-modal-with-batch-summary.md` | частично — размер, пропсы и секция сводки есть, часть плана — нет | |
| ⬜ | `extract-batch-location-section.md` | частично (скептик) — секция и i18n на месте, но Edge Case плана не обработан | |
| ⬜ | `extract-offcut-location-section.md` | частично (скептик) — шаблон и форма есть, Edge Case 3 (пустые rack/row/cell) не обработан | |
| ⬜ | `fix-batch-count-inconsistency.md` | частично (скептик) — две записи существуют, но соответствие цифрам плана не доказано | |
| ⬜ | `fix-entity-card-links-plan.md` | частично (скептик) — файлы, роуты и ключи есть, содержание карточек не сверено | |
| 📦 | `fix-export-functionality.md` | частично — обвязка экспорта есть целиком, часть плана — нет | `exportWarehouseData()` — `warehouseService.ts:262`, эндпойнт `/api/warehouse/export/${tab}` с params; `WarehousePage.vue:326` передаёт фильтры. Все три требования плана закрыты |
| ⬜ | `fix-offcut-movement-deficit-not-found.md` | частично — шаг 2 сделан целиком, остальные шаги — нет | |
| ⬜ | `fix-offcuts-type-column.md` | частично — все шесть файловых правок есть; 10 чекбоксов открыты | |
| ⬜ | `fix-warehouse-phase2-bugs-remaining-tabs.md` | частично — шаги 1–4 сделаны, дальше — нет | |
| ⬜ | `fix-warehouse-stock-delete-mock.md` | не начато — ни одной из трёх правок нет; премисса плана под вопросом (см. `remove-stock-deletion`) | |
| ⬜ | `fix-warehouse-table-row-padding.md` | частично (скептик) — Change 3 (responsive adjustments) — мёртвый код, план не закрыт | |
| ⬜ | `generalize-offcuts-for-all-categories.md` | частично — шаги 1 и 3 есть, остальные — нет | |
| ⬜ | `implement-batch-card-write-off.md` | частично — ни одной из трёх правок плана нет — ключи `write_off_*` в коде отсутствуют | |
| ⬜ | `new-tasks-autotests-plan.md` | частично — все пять шагов заведены, часть тестов не дописана | |
| ⬜ | `offcut-create-page-plan.md` | частично (скептик) — доказательство содержало ложный факт про `CreateOffcutModal` — сверка нужна заново | |
| ⬜ | `offcut-movements-plan.md` | частично — цель достигнута шире плана, но ни одна правка не там, куда план её адресовал; 16 чекбоксов | |
| ⬜ | `phase3-subtask2-WarehouseBatchCard.md` | частично — 7 из 10 `data-test` есть; 12 чекбоксов открыты | |
| ⬜ | `phase4-subtask2-CreateMovementModal.md` | частично — модалка есть, но партия приходит пропом — селектора партий и `unitPrice` нет; 10 чекбоксов | |
| ⬜ | `phase5-subtask2-improve-tabs.md` | частично — бейджи, размеры и быстрые действия есть; 12 чекбоксов открыты | |
| ⬜ | `phase6-subtask1-e2e-mocks.md` | частично — все 10 хелперов плюс шесть сверх плана; 7 чекбоксов | |
| ⬜ | `phase6-subtask2-e2e-spec.md` | частично — спек на ~50 тестов есть; 8 чекбоксов открыты | |
| ⬜ | `refactor-warehouse-mock-data.md` | частично — разделение на пять файлов выполнено, часть плана — нет | |
| ⬜ | `remove-stock-deletion.md` | частично (скептик) — удаление вырезано, но нарушено ограничение области плана (лишний коммит) | |
| ⬜ | `safe-cascade-deletion.md` | частично — `orderId` и блокировки есть, часть плана не закрыта | |
| ⬜ | `stock-card-restructure-plan.md` | частично (скептик) — перестройка шаблона есть, остальные требования плана не доказаны | |
| ⬜ | `stock-remainder-card-fix-plan.md` | частично — `useHead`, `entity-not-found`, чистка CSS сделаны; часть пунктов — нет | |
| ⬜ | `stock-remainder-card-plan.md` | частично — нет кнопки retry в состоянии ошибки и отдельной кнопки; 9 чекбоксов | |
| ⬜ | `update-offcut-statuses-to-match-batches.md` | частично — тип и все ключи i18n есть; 10 чекбоксов открыты | |
| ⬜ | `verify-batch-card-api-readiness.md` | — — — | |
| ⬜ | `warehouse-expandable-rows-plan.md` | не начато — нет ничего: ни `ExpandableTable.vue`, ни состояния expand, ни типов, ни полей | |
| ⬜ | `warehouse-page-plan.md` | частично — нет модалки/печати QR, двух подвкладок дефицита, `GET /api/warehouse/locations`; два флага мертвы | |
| ⬜ | `warehouse-phase2-bugs.md` | частично (скептик) — отчёт из 40 пунктов прозой — проверен выборочно, нужна пунктная перепроверка | |

### bugs — 13


| ✓ | Файл | Унаследовано | Чем доказано |
|---|---|---|---|
| ⬜ | `3.1-orders-card-bugs.md` | частично (скептик) — 22 из 23 багов закрыты, один не подтверждён | |
| ⬜ | `coverage-gate-is-red-since-before.md` | — — — | |
| ⬜ | `fix-4-remaining-products-bugs.md` | частично — из четырёх багов закрыты не все — остаток в части | |
| ⬜ | `fix-clients-delete-modal-text.md` | частично (скептик) — буквальные правки на месте, но требование сверх них не подтверждено | |
| ⬜ | `fix-filter-transition-flicker.md` | частично (скептик) — шаги 1–3 сделаны, дальше плана — нет | |
| ⬜ | `fix-structuredClone-v2.md` | частично (скептик) — пункты 1–3 есть, остаток плана не выполнен | |
| ⬜ | `fix-toTranslatedString-merge-bug.md` | частично — слияние есть под другим именем (`mergeLocaleValue`), часть мест не переведена на него | |
| ⬜ | `orders-spec-waits-for-element-not-data.md` | — — — | |
| ⬜ | `pagination-counter-is-not-a-data-signal.md` | — — — | |
| ⬜ | `pill-escapes-parent-on-cards.md` | живая мета — свежий баг-файл | |
| ⬜ | `settings-notifications-bugs.md` | частично — три бага с разделом «Fix» закрыты, остальные записи без починки | |
| ⬜ | `snapshot-threshold-blind-to-colour.md` | — — — | |
| ⬜ | `static-analysis-debt-bugs.md` | частично — из девяти записей закрыта часть; статус несёт таблица в конце файла | |

### general — 9


| ✓ | Файл | Унаследовано | Чем доказано |
|---|---|---|---|
| ⬜ | `autonomous-run-policy-plan.md` | живая мета — политика прогонов, ROO.md ссылается | |
| ⬜ | `followups-open-2026-08-30.md` | — — — | |
| ⬜ | `found-not-fixed-2026-08-30.md` | — — — | |
| ⬜ | `implementation-queue.md` | живая мета — очередь работы | |
| ⬜ | `queue-retriage-2026-08-29.md` | живая мета — разбор очереди | |
| ⬜ | `review-followups.md` | живая мета — текущий список followups, в работе | |
| ⬜ | `settings-cache-data-staleness-plan.md` | частично (скептик) — чекбоксов в плане нет — «0 незакрытых» не вердикт; нужна сверка прозаических требований | |
| ⬜ | `settings-plan.md` | частично — нет `WarehouseSector`, часть поставки плана не закрыта | |
| ⬜ | `user-dropdown-menu-plan.md` | частично — всё есть, включая опциональный пункт 5; остаток — мелкие расхождения с буквой | |

### orders — 7


| ✓ | Файл | Унаследовано | Чем доказано |
|---|---|---|---|
| ⬜ | `3.1-orders-plan.md` | частично — план объявляет себя историческим и по существу выполнен; 33 чекбокса остались неотмеченными | |
| ⬜ | `3.2-order-page-shared-components.md` | частично (скептик) — чекбоксов в плане нет вовсе — вердикт «сделано» держался на пустом счёте | |
| ⬜ | `3.3-order-returns-plan.md` | частично — реализовано почти всё; остаток перечислен в части | |
| ⬜ | `currency-fix-and-fifo-plan.md` | частично — Phase A и B сделаны (кроме UI движения), Phase C не начата — 5 чекбоксов | |
| ⬜ | `order-pricing-model.md` | документ — действующая модель ценообразования | |
| ⬜ | `orders-backend-contract.md` | документ — действующий контракт домена | |
| ⬜ | `pricing-section-rework-plan.md` | частично — разделы 2–4 устарели по существу; раздел 1 (переименования) не выполнен | |

### refactor — 7


| ✓ | Файл | Унаследовано | Чем доказано |
|---|---|---|---|
| ⬜ | `single-locale-prompts/02-domain-categories.md` | частично (скептик) — вызовы `toTranslatedString` есть, но требования плана не выполнены — нужна проверка срабатывания | |
| ⬜ | `single-locale-prompts/03-domain-products.md` | частично — обёртки в сервисе есть, часть требований плана не закрыта | |
| ⬜ | `single-locale-prompts/04-domain-suppliers.md` | частично — три поля оборачиваются и сливаются, остальное по плану — нет | |
| ⬜ | `single-locale-prompts/06-domain-config.md` | частично — поля `name` оборачиваются и сливаются, часть требований не закрыта | |
| ⬜ | `single-locale-prompts/08-phase3-global-cleanup.md` | частично — пункты 1, 3, 4 сделаны; GET-роуты мока не соответствуют букве плана | |
| ⬜ | `single-locale-prompts/09-phase4-verification.md` | частично — тайпчек и билд чисты, e2e — выборкой; ручной чеклист (10 пунктов) не покрыт | |
| ⬜ | `single-locale-save-refactor.md` | частично — Фаза 1 и домены categories/products есть; часть доменов не переведена | |

### backend — 3


| ✓ | Файл | Унаследовано | Чем доказано |
|---|---|---|---|
| ⬜ | `backend-db-schema-alembic-plan.md` | — — — | |
| ⬜ | `backend-refactor-modular-monolith-plan.md` | — — — | |
| ⬜ | `i18n-db-refactoring-plan.md` | — — — | |

### products — 3


| ✓ | Файл | Унаследовано | Чем доказано |
|---|---|---|---|
| ⬜ | `01-products-plan.md` | частично — поставка реализована и переросла план; 32 чекбокса не отмечены, остаток — в части | |
| ⬜ | `product-uom-restructure-plan.md` | частично — шаги 1,2,5–9 есть; остальные шаги не выполнены | |
| ⬜ | `uom-restructure-completion-plan.md` | частично — шаги 1, 2 и почти весь 5 сделаны; 23 чекбокса открыты | |

### services — 2


| ✓ | Файл | Унаследовано | Чем доказано |
|---|---|---|---|
| ⬜ | `service-card-page-plan.md` | частично (скептик) — вердикт держался на счёте чекбоксов, которых нет; визуальных тестов в спеке нет | |
| ⬜ | `services-page-plan.md` | частично (скептик) — план из 10 промптов не сверён по пунктам — ни `- [ ]`, ни `- [x]` в файле | |

### auth — 1


| ✓ | Файл | Унаследовано | Чем доказано |
|---|---|---|---|
| ⬜ | `auth-secret-link-plan.md` | — — — | |

### plans-multi-role-migration-plan(корень) — 1


| ✓ | Файл | Унаследовано | Чем доказано |
|---|---|---|---|
| ⬜ | `plans-multi-role-migration-plan.md` | — — — | |

### sales-crm — 1


| ✓ | Файл | Унаследовано | Чем доказано |
|---|---|---|---|
| ⬜ | `01-sales-crm-initial-plan.md` | частично — инфраструктура (роут, флаг, типы) есть, сама страница — нет; 9 чекбоксов | |
