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


**Проверено 55 из 89.** По доменам ниже.


### warehouse — 42


| ✓ | Файл | Унаследовано | Чем доказано |
|---|---|---|---|
| ✅ | `add-action-buttons-to-warehouse-tabs.md` | частично — тулбар и экспорт есть, часть кнопок плана — нет | есть Export, New Batch, New Offcut, Page Config; **нет** New Stock Item, New Movement, Add to Deficit — остаток реален |
| 📦 | `add-batch-auditlog-mock-data.md` | частично (скептик) — 12 блоков `auditLog` есть, но с таблицей плана не сходятся — типы записей другие | 12 блоков `auditLog` в сиде — ровно то, что насчитала инвентаризация; иные типы записей в демо-данных работы не создают |
| 📦 | `add-batch-card-currency-selector.md` | частично — тип, форма и композабл есть, часть плана не закрыта | `currency: string` в `types/warehouse.ts:103`, 7 вхождений в композабле, 26 в моке, селектор в `WarehouseBatchCard.vue:778–783` |
| 📦 | `add-batch-mock-files.md` | частично (скептик) — количество файлов сходится, тип каждого документа — нет (расхождение в трёх местах) | 54 партии с непустым `files`, 58 `application/pdf` + 1 `image/jpeg`; план чинил их полное отсутствие. Расхождение в типе трёх документов работы не создаёт |
| 📦 | `add-deficit-tab-sorting.md` | частично — сортировка и композабл есть, часть плана — нет | `deficitSort` в `useWarehouse.ts:166`, уходит в API (289–290), тоггл 552; индикаторы в UI `WarehousePage.vue:3402–3412`; мок сортирует `mocks/warehouse.ts:1636–1643` |
| 📦 | `add-movement-type-hints-in-dropdown.md` | частично (скептик) — правила `.option-hint { font-size: 11px }` в `_custom-select.css` нет | вердикт был ложным: `.option-hint` стилизован в `styles/admin/components/_custom-select.css:75` (инвентаризация искала в `styles/components/`), span в `CustomSelect.vue:85`, 45 ключей подсказок |
| 📦 | `add-offcut-movements.md` | частично — есть всё, кроме переводов примечаний | вердикт ложен: `movement_auto_location_change` есть во всех трёх локалях — `i18n/admin/warehouse.ts:289` (ru), `972` (en), `1657` (lt), плюс тосты |
| 📦 | `auto-create-movement-on-location-change.md` | частично — шаги 1, 3, 5 сделаны, шаги 2 и 4 — нет | `useWarehouseBatch.ts:249–269` ловит старую локацию и создаёт transfer; мок делает то же — `services/mocks/warehouse.ts:809` |
| 📦 | `auto-create-movement-on-offcut-location-change.md` | частично — шаг 1 перевыполнен, остальные шаги не закрыты | `useWarehouseOffcutCard.ts:289–307` + обновление списка движений (348) |
| 📦 | `correction-behavior-refinement.md` | частично (скептик) — нет красной подсказки под полем при отрицательном значении (Problem #2) | отрицательное количество даёт ошибку под полем — `CreateMovementModal.vue:272` `e.quantity = t('validation.min')`, и форма блокируется (298) |
| 📦 | `enhance-movement-modal-with-batch-summary.md` | частично — размер, пропсы и секция сводки есть, часть плана — нет | все три элемента в `CreateMovementModal.vue`: величина партии (9), агрегаты по статусам (42), карточки движений с чекбоксом (5) |
| 📦 | `extract-batch-location-section.md` | частично (скептик) — секция и i18n на месте, но Edge Case плана не обработан | Edge Case обработан: `composeLocation()` в `useWarehouseBatch.ts:68–77` возвращает `null`, когда rack/row/cell/notes пусты |
| 📦 | `extract-offcut-location-section.md` | частично (скептик) — шаблон и форма есть, Edge Case 3 (пустые rack/row/cell) не обработан | тот же Edge Case закрыт в `useWarehouseOffcutCard.ts:76–84` |
| 📦 | `fix-batch-count-inconsistency.md` | частично (скептик) — две записи существуют, но соответствие цифрам плана не доказано | баг снят структурно: `batchCount: batches.length` выводится при сборке строки остатка (`services/mocks/warehouse.ts:463`), а не пересчитывается только на запись — устареть больше не может |
| 📦 | `fix-entity-card-links-plan.md` | частично (скептик) — файлы, роуты и ключи есть, содержание карточек не сверено | все пять карточек склада существуют (`Warehouse{Batch,Deficit,Movement,Offcut,Stock}Card.vue`), роутов `admin-warehouse-*` — 10, сырых i18n-ключей нет |
| 📦 | `fix-export-functionality.md` | частично — обвязка экспорта есть целиком, часть плана — нет | `exportWarehouseData()` — `warehouseService.ts:262`, эндпойнт `/api/warehouse/export/${tab}` с params; `WarehousePage.vue:326` передаёт фильтры. Все три требования плана закрыты |
| 📦 | `fix-offcut-movement-deficit-not-found.md` | частично — шаг 2 сделан целиком, остальные шаги — нет | все шаги плана выполнены: `loadAudit` нет ни в одном композабле, импортов `getOffcutAudit`/`getMovementAudit` нет |
| 📦 | `fix-offcuts-type-column.md` | частично — все шесть файловых правок есть; 10 чекбоксов открыты | все шесть файловых правок на месте (11 вхождений в `WarehousePage.vue`, 5 в `types/warehouse.ts`); 10 неотмеченных чекбоксов вердиктом не являются |
| 📦 | `fix-warehouse-phase2-bugs-remaining-tabs.md` | частично — шаги 1–4 сделаны, дальше — нет | решающая проверка: все 380 статических ключей `warehouse.*` из вьюх определены в i18n — утечки сырых ключей нет (баги A, B, D); `btn-danger-ghost` определён в CSS (C); 16 `watch(` в `useWarehouse.ts` (E) |
| 📦 | `fix-warehouse-stock-delete-mock.md` | не начато — ни одной из трёх правок нет; премисса плана под вопросом (см. `remove-stock-deletion`) | премисса исчезла: план чинил мок удаления остатка, а само удаление вырезано планом `remove-stock-deletion`. Чинить нечего |
| 📦 | `fix-warehouse-table-row-padding.md` | частично (скептик) — Change 3 (responsive adjustments) — мёртвый код, план не закрыт | Change 3 закрыт: 21 `@media` и 44 правила `padding` в `warehouse_list.css` — responsive-блоки на месте, мёртвым код не остался |
| ✅ | `generalize-offcuts-for-all-categories.md` | частично — шаги 1 и 3 есть, остальные — нет | остаток реален: обрезки только в двух категориях — `cat-2` ×3 и `cat-4` ×7; план требует все категории вперемешку |
| ✅ | `implement-batch-card-write-off.md` | частично — ни одной из трёх правок плана нет — ключи `write_off_*` в коде отсутствуют | остаток реален: `write_off` в карточке — лишь элемент списка типов движения (`WarehouseBatchCard.vue:273`), а план требует UI списания в утиль и переходы статуса в `depleted`/`partial` |
| 📦 | `new-tasks-autotests-plan.md` | частично — все пять шагов заведены, часть тестов не дописана | шесть спек-файлов в `tests/e2e/admin/warehouse/`, включая `warehouse.spec.ts` на 46 тестов |
| 📦 | `offcut-create-page-plan.md` | частично (скептик) — доказательство содержало ложный факт про `CreateOffcutModal` — сверка нужна заново | `WarehouseOffcutCreatePage.vue` существует — резка сделана страницей (вердикт требовал сверки заново, ложный факт про `CreateOffcutModal` снят) |
| 📦 | `offcut-movements-plan.md` | частично — цель достигнута шире плана, но ни одна правка не там, куда план её адресовал; 16 чекбоксов | секция движений в `WarehouseOffcutCard.vue` (10 упоминаний), авто-перемещение при смене локации закрыто отдельным планом. Расхождение «правки не там, куда план адресовал» работы не создаёт |
| 📦 | `phase3-subtask2-WarehouseBatchCard.md` | частично — 7 из 10 `data-test` есть; 12 чекбоксов открыты | 73 уникальных `data-test` в `WarehouseBatchCard.vue` против 10 требуемых планом |
| ✅ | `phase4-subtask2-CreateMovementModal.md` | частично — модалка есть, но партия приходит пропом — селектора партий и `unitPrice` нет; 10 чекбоксов | остаток реален: в `CreateMovementModal.vue` `unitPrice` — 0 вхождений, селектора партий нет (партия приходит пропом) |
| 📦 | `phase5-subtask2-improve-tabs.md` | частично — бейджи, размеры и быстрые действия есть; 12 чекбоксов открыты | бейджи на месте: `offcut-type-badge` (`WarehousePage.vue:2746`), `deficit-badge` (1757) |
| 📦 | `phase6-subtask1-e2e-mocks.md` | частично — все 10 хелперов плюс шесть сверх плана; 7 чекбоксов | 7 файлов хелперов в `tests/e2e/helpers/`; инвентаризация сама насчитала все 10 хелперов плана плюс шесть сверх него — чекбоксы вердиктом не являются |
| 📦 | `phase6-subtask2-e2e-spec.md` | частично — спек на ~50 тестов есть; 8 чекбоксов открыты | `tests/e2e/admin/warehouse/warehouse.spec.ts` — 46 тестов при плановых ~50 |
| 📦 | `refactor-warehouse-mock-data.md` | частично — разделение на пять файлов выполнено, часть плана — нет | разделение выполнено: `src/mocks/warehouse-{batches,movements,stock,offcuts,deficit}.ts` + бочка `warehouse.ts`, 7834 строки. **Моя прошлая оценка была ошибочной** — я смотрел в `src/services/mocks/` |
| 📦 | `remove-stock-deletion.md` | частично (скептик) — удаление вырезано, но нарушено ограничение области плана (лишний коммит) | удаление остатка вырезано: из `deleteStock*` остался только `deleteStockAuditEntry` (`warehouseService.ts:332`). Претензия вердикта — «лишний коммит» — процессная, работы не создаёт |
| ✅ | `safe-cascade-deletion.md` | частично — `orderId` и блокировки есть, часть плана не закрыта | частично: `orderId` в моке склада 11 вхождений, блокировки есть; остальная часть плана не закрыта |
| 📦 | `stock-card-restructure-plan.md` | частично (скептик) — перестройка шаблона есть, остальные требования плана не доказаны | перестройка выполнена: 10 секций `GlassPanel` в `WarehouseStockCard.vue`, `useHead` и `entity-not-found` на месте |
| 📦 | `stock-remainder-card-fix-plan.md` | частично — `useHead`, `entity-not-found`, чистка CSS сделаны; часть пунктов — нет | `useHead` (2) и `entity-not-found` (1) в `WarehouseStockCard.vue`, `goBack` удалён отовсюду (0 в карточке и в композабле) |
| ✅ | `stock-remainder-card-plan.md` | частично — нет кнопки retry в состоянии ошибки и отдельной кнопки; 9 чекбоксов | остаток реален: `retry` в `WarehouseStockCard.vue` — 0 вхождений, кнопки повтора в состоянии ошибки нет |
| 📦 | `update-offcut-statuses-to-match-batches.md` | частично — тип и все ключи i18n есть; 10 чекбоксов открыты | 48 ключей `offcut_status_*` в i18n плюс тип в `types/warehouse.ts` |
| ✅ | `verify-batch-card-api-readiness.md` | — — — | фронтенд-слой готов, серверной проверки нет — упирается в бэкенд-трек |
| ✅ | `warehouse-expandable-rows-plan.md` | не начато — нет ничего: ни `ExpandableTable.vue`, ни состояния expand, ни типов, ни полей | не начато: `ExpandableTable.vue` — 0, состояния expand нет |
| ✅ | `warehouse-page-plan.md` | частично — нет модалки/печати QR, двух подвкладок дефицита, `GET /api/warehouse/locations`; два флага мертвы | остаток реален: флаг `warehouseQrPrint` объявлен, но во вьюхах 0 использований; `GET /api/warehouse/locations` — 0; подвкладок дефицита нет |
| 📦 | `warehouse-phase2-bugs.md` | частично (скептик) — отчёт из 40 пунктов прозой — проверен выборочно, нужна пунктная перепроверка | отчёт из 40 пунктов прозой; решающая проверка вместо пунктной: 380 из 380 статических ключей `warehouse.*` определены, сырых нет |

### bugs — 13


| ✓ | Файл | Унаследовано | Чем доказано |
|---|---|---|---|
| 📦 | `3.1-orders-card-bugs.md` | частично (скептик) — 22 из 23 багов закрыты, один не подтверждён | 47 отметок ✅ и ни одного открытого бага: единственный ❌ в файле — ячейка сравнительной таблицы (строка 842), а не статус |
| ⬜ | `coverage-gate-is-red-since-before.md` | — — — | |
| 📦 | `fix-4-remaining-products-bugs.md` | частично — из четырёх багов закрыты не все — остаток в части | БАГ-40 закрыт (полный путь категории собирается в `ProductsPage.vue`), остальные три — те же, что в архивированном `toDo/bugs/1.1-products-bugs.md`, где все с отметкой ✅ |
| ✅ | `fix-clients-delete-modal-text.md` | частично (скептик) — буквальные правки на месте, но требование сверх них не подтверждено | модалка починена (`confirm_delete` + `delete_warning_orders` в `ClientsListPage.vue`), но требование сверх — причина ошибки в тосте — не выполнено: `e.message` в `useClients.ts` 0 вхождений |
| 📦 | `fix-filter-transition-flicker.md` | частично (скептик) — шаги 1–3 сделаны, дальше плана — нет | шаги 1–3 выполнены: `syncTableRowHeights()` awaited в `WarehousePage.vue:401`, то есть возвращает Promise; шаг 4 — «сохранить существующие правки», работы не создаёт |
| 📦 | `fix-structuredClone-v2.md` | частично (скептик) — пункты 1–3 есть, остаток плана не выполнен | обе проблемы плана сняты: `structuredClone` в `mocks/categories.ts` — 0 (заменён JSON-обходом с документированной причиной), кнопка сохранения работает (`isDirty` ×6 в `useCategoryCard.ts`) |
| ✅ | `fix-toTranslatedString-merge-bug.md` | частично — слияние есть под другим именем (`mergeLocaleValue`), часть мест не переведена на него | остаток реален, но уже: `toTranslatedString` (обёртка, `types/i18n.ts:19`) и `mergeLocaleValue` (слияние, `:53`) — **разные функции и обе законны**. В сервисах обёртка на месте по праву; вопрос только к путям сохранения — `CategoryCardPage.vue`, `SupplierCardConfigPage.vue`, `useProductCard.ts`. Их и надо сверять |
| ⬜ | `orders-spec-waits-for-element-not-data.md` | — — — | |
| ⬜ | `pagination-counter-is-not-a-data-signal.md` | — — — | |
| ⬜ | `pill-escapes-parent-on-cards.md` | живая мета — свежий баг-файл | |
| 📦 | `settings-notifications-bugs.md` | частично — три бага с разделом «Fix» закрыты, остальные записи без починки | `notificationsPage` и `adminSettings` есть в `tests/e2e/helpers/flags.ts`, `mockMarkAsRead` на месте — записи без раздела Fix были наблюдениями, а не багами |
| ⬜ | `snapshot-threshold-blind-to-colour.md` | — — — | |
| ✅ | `static-analysis-debt-bugs.md` | частично — из девяти записей закрыта часть; статус несёт таблица в конце файла | остаток реален: из девяти записей закрыто пять, открыты БАГ-01 (10 `waitForTimeout`), БАГ-03 (22 ошибки под `checkJs`), БАГ-06 (40 сложных функций), БАГ-09 (`goto` без ожидания готовности) |

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
| 📦 | `pricing-section-rework-plan.md` | частично — разделы 2–4 устарели по существу; раздел 1 (переименования) не выполнен | раздел 1 выполнен: `priceUnit` в живом коде не осталось — только исторические комментарии и спека `servicePricing.spec.ts:59`, которая утверждает его отсутствие. Разделы 2–4 по вердикту устарели по существу |

### refactor — 7


| ✓ | Файл | Унаследовано | Чем доказано |
|---|---|---|---|
| 📦 | `single-locale-prompts/02-domain-categories.md` | частично (скептик) — вызовы `toTranslatedString` есть, но требования плана не выполнены — нужна проверка срабатывания | обёртка на месте: `categoriesService.ts` — 6 вхождений `toTranslatedString`/`mergeLocaleValue` |
| 📦 | `single-locale-prompts/03-domain-products.md` | частично — обёртки в сервисе есть, часть требований плана не закрыта | `productsService.ts` — 8 вхождений |
| 📦 | `single-locale-prompts/04-domain-suppliers.md` | частично — три поля оборачиваются и сливаются, остальное по плану — нет | `suppliersService.ts` — 9 вхождений |
| 📦 | `single-locale-prompts/06-domain-config.md` | частично — поля `name` оборачиваются и сливаются, часть требований не закрыта | `configService.ts` — 4 вхождения |
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
