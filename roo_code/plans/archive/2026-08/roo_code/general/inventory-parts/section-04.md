# Сводка инвентаризации: `roo_code/plans/warehouse` — раздел 4 (40 планов)

Планы от `fix-movement-modal-default-type-placeholder.md` до `warehouse-full-inventory.md`
(алфавитный хвост каталога). Подробные доказательства — в частях `part-047`…`part-056`,
здесь по одной строке на план и ничего больше.

Код не менялся ни по одному плану (`dirty = 0` у всех 40).
Колонка «Чек.» — незакрытые чекбоксы **в тексте плана**; это не мера долга: у
`fix-offcuts-action-buttons` и `phase3-subtask3-route` чекбоксы не отмечены, а работа сделана.

**Итог: сделано 9, частично 29, не начато 2.**

| # | План (`roo_code/plans/warehouse/…`) | Вердикт | Чек. | Что осталось | Часть |
|---|---|---|---|---|---|
| 1 | `fix-movement-modal-default-type-placeholder.md` | сделано | 0 | — | 047 |
| 2 | `fix-movement-modal-show-unit-in-selected-qty.md` | сделано | 0 | — | 048 |
| 3 | `fix-offcut-card-i18n-keys.md` | сделано | 0 | — | 048 |
| 4 | `fix-offcut-movement-deficit-not-found.md` | частично | 0 | Шаг 1 для обрезков и дефицита: хелперов `getOrCreateOffcutAudit`/`getOrCreateDeficitAudit` нет, аудит лежит в сидах — цель (уход NOT_FOUND) достигнута иначе, буква шага не выполнена | 048 |
| 5 | `fix-offcuts-action-buttons.md` | сделано | 11 | — все пять слоёв на месте, чекбоксы просто не отмечены | 048 |
| 6 | `fix-offcuts-type-column.md` | частично | 10 | Мок не сортирует по `offcutType` (кнопка и иконки работают, порядок строк нет) — тот же долг у `batchNumber`/`lengthMm`/`weightKg`/`unit`/`location`/`status`; адаптив колонок машинно не проверяется | 048 |
| 7 | `fix-stock-card-header-title.md` | сделано | 0 | — | 048 |
| 8 | `fix-warehouse-phase2-bugs-remaining-tabs.md` | частично | 0 | Косметика: `WarehouseBatchCard.vue` остался на старых префиксах ключей; флаг `suppressPageWatch` не убран (шаг 6); ручной прогон вкладок из кода не подтверждается | 049 |
| 9 | `fix-warehouse-stock-delete-mock.md` | не начато | 0 | Весь план — но премисса устарела: удаления остатка нет ни в UI, ни в сервисе, мок пришлось бы писать под несуществующий вызов. Нужно решение «нужна ли кнопка удаления остатка» | 049 |
| 10 | `fix-warehouse-table-row-padding.md` | частично | 0 | Скептик снял «сделано»: Change 1 и 2 реальны, Change 3 (адаптивные правки) — мёртвый код | 049 |
| 11 | `generalize-offcuts-for-all-categories.md` | частично | 0 | Шаг 2 целиком: линейных обрезков по `cat-7`…`cat-12` в моке нет (баланс 6/7 вместо ~20/20). Хвост шага 5: колонка «Длина, мм» печатает `Д×Ш` через `offcut_dimensions`, у перевода недоданный `{thickness}` | 049 |
| 12 | `implement-batch-card-write-off.md` | частично | 0 | Ни одной правки плана: нет кнопки «Списать» в шапке секции движений, отдельной модалки списания, `writeOff()`/`writeOffSaving`, девяти ключей `write_off_*`. Цель закрыта общей модалкой движения (тип `write-off`), модель статусов `partial/depleted` из плана вытеснена агрегатами | 050 |
| 13 | `movement-modal-form-fields-restructure.md` | сделано | 0 | — | 050 |
| 14 | `movements-default-sort-desc.md` | сделано | 0 | — | 050 |
| 15 | `movement-type-restrictions.md` | сделано | 0 | — | 050 |
| 16 | `new-tasks-autotests-plan.md` | частично | 0 | Тесты заведены, но формальны: шаг 2 п.2 (набор поиска товара, выбор категории, разблокировка селектора поставщика) не проверяется; п.3 «все поля формы» — только видимость панелей `batch-create-*`, ни одного поля по отдельности | 051 |
| 17 | `offcut-create-page-plan.md` | частично | 0 | Скептик снял «сделано»: в доказательстве ложный факт — grep по `CreateOffcutModal|showCreateOffcutModal` не пуст, `showCreateOffcutModal` висит мёртвым состоянием в `useWarehouse.ts`. Содержательных требований плана без реализации нет | 051 |
| 18 | `offcut-movements-plan.md` | частично | 16 | Цель (движение на каждую смену статуса обрезка) достигнута шире плана, но ни одна правка не лежит по адресам плана и модель статусов переписана — сверять план с кодом построчно бессмысленно, нужен пересмотр плана | 051 |
| 19 | `phase3-subtask1-useWarehouseBatch.md` | частично | 8 | Скептик снял «сделано»: план требует поле формы `location: string \| null`, «зеркалящее» бэкенд, а в композабле оно разобрано на `locationRack/locationRow/locationCell/locationNotes` — плюс второе непокрытое место, см. часть | 052 |
| 20 | `phase3-subtask2-WarehouseBatchCard.md` | частично | 12 | 3 из 10 `data-test` и пункты про CSS `batch-card-*` не выполнены; режима view/edit нет — поля правятся на месте. Приводить к букве плана значило бы откатывать более сильную реализацию | 052 |
| 21 | `phase3-subtask3-route.md` | сделано | 4 | — расходится только номер строки (план: 184-189, факт: 261-265) | 052 |
| 22 | `phase4-subtask1-CreateBatchModal.md` | частично | 8 | Модалки нет: приход партии — страница `WarehouseBatchCreatePage.vue` + `useWarehouseBatchCreate.ts`. Нет пропа `show`, эмитов `close`/`created`, сброса по открытию, всех `data-test` плана (вместо них `batch-create-*`/`field-*`) | 052 |
| 23 | `phase4-subtask2-CreateMovementModal.md` | частично | 10 | Модалка есть, но в другой роли: живёт на карточке партии и получает партию пропом, поэтому селектора партий (`getBatches`) и части полей плана в ней нет | 052 |
| 24 | `phase4-subtask3-CreateOffcutModal.md` | частично | 10 | Модалки нет и, судя по маршруту `warehouse/cutting`, не планируется — резка реализована страницей `WarehouseCuttingPage.vue`. Из содержательного не хватает условных полей по типу обрезка | 052 |
| 25 | `phase4-subtask4-useWarehouseMovement.md` | частично | 5 | Файла `useWarehouseMovement.ts` нет вовсе: создание движения с тостом разнесено по `CreateMovementModal.vue:525-526` и `useWarehouse.ts` | 053 |
| 26 | `phase5-subtask1-useWarehouseOffcutsAndDeficit.md` | частично | 5 | Ни `useWarehouseOffcuts.ts`, ни `useWarehouseDeficit.ts` не существует: логика разнесена по `useWarehouse.ts` и карточкам обрезка/дефицита | 053 |
| 27 | `phase5-subtask2-improve-tabs.md` | частично | 12 | Цветовое кодирование приоритета дефицита: классы навешаны, CSS-правил нет ни одного; inline-смены приоритета нет; отсутствуют ключи `offcut_type_sheet_badge`/`offcut_type_linear_badge` и три CSS-класса (`deficit-priority-badge`, `deficit-amount-critical`, `deficit-amount-high`); ни одно из 8 имён `data-test` плана не совпадает; `showCreateOffcutModal`/`onOffcutCreated` — мёртвый код | 053 |
| 28 | `phase6-subtask1-e2e-mocks.md` | частично | 7 | 16 из 17 эндпоинтов: нет `mockDeleteMovement` (`DELETE /api/warehouse/movements/:id`) — приложение его и не вызывает | 053 |
| 29 | `phase6-subtask2-e2e-spec.md` | частично | 8 | Нет тестов на гард фича-флага (`adminWarehouse`), на правку и удаление партии; создание движения покрыто только обратным тестом. Пункт «все тесты проходят» не проверен — прогон Playwright не запускался, инвентаризация не меняет дерево | 053 |
| 30 | `refactor-warehouse-mock-data.md` | частично | 0 | `mockBatches` — единственный из пяти массивов без аннотации типа `WarehouseBatch[]` (требование шага 1); `warehouse-movements.ts` экспортирует ещё два объекта, правило «один массив на файл» не соблюдено | 053 |
| 31 | `remove-stock-deletion.md` | частично | 0 | Скептик снял «сделано»: сама вырезка удаления остатка чиста во всех шести перечисленных файлах, но нарушено ограничение объёма плана — в коммите `3ef87b1` посторонние правки | 054 |
| 32 | `safe-cascade-deletion.md` | частично | 0 | Шаг 4: `mockDeleteBatch` не каскадит — ни фильтрации `offcutStore`/`movementStore` по `batchId`, ни проверки `OFFCUT_LINKED_TO_ORDER`; обрезки и движения остаются сиротами, а модалка обещает удалить N обрезков. Шаг 5: `mockDeleteOffcut` не возвращает материал партии | 054 |
| 33 | `stock-card-restructure-plan.md` | частично | 0 | Скептик снял «сделано»: доказана только перестройка шаблона (три GlassPanel по колонкам внутри `.main-card-content`), остальные пункты плана доказательством не покрыты — нужна перепроверка | 054 |
| 34 | `stock-remainder-card-fix-plan.md` | частично | 0 | Кнопки «Назад» в карточке нет вообще, поэтому пункты «class → `btn btn-secondary`» и «action → `$router.back()`» выполнить некуда: возврат идёт через Breadcrumb и `back_to_list` в not-found | 054 |
| 35 | `stock-remainder-card-plan.md` | частично | 9 | Нет кнопки retry в состоянии ошибки (там возврат к списку), нет отдельной кнопки «Назад», часть ключей i18n плана отсутствует | 054 |
| 36 | `update-offcut-statuses-to-match-batches.md` | частично | 10 | Легаси-коды `'used'` и `'scrap'` живы в массиве `status_` карты `AUDIT_ENUM_MAP` во всех пяти карточках | 055 |
| 37 | `verify-batch-card-api-readiness.md` | частично | 0 | Фронтенд-слой действительно готов, но бэкенда нет вовсе — `backend/app/modules/warehouse/features` пуст, шаги 2, 3 и 4 не начаты | 055 |
| 38 | `verify-warehouse-server-side-filtering.md` | частично | 0 | Скептик снял «сделано»: подтверждена одна половина — `sortBy` уходит из композабла в запрос; обрабатывает ли его мок, доказательство не показывает | 055 |
| 39 | `warehouse-expandable-rows-plan.md` | не начато | 0 | Всё: нет `ExpandableTable.vue`, состояния expand в `WarehousePage.vue`, типов `StockBatchItem`/`OffcutChildItem`, CSS-правил. Подтвердилось единственное утверждение плана — «`batchCount` уже есть» | 056 |
| 40 | `warehouse-full-inventory.md` | частично | 0 | Не план работ, а описание секции, устаревшее примерно на треть (ссылается на три модалки и композаблы `useWarehouseMovement`/`useWarehouseOffcuts`/`useWarehouseDeficit`, которых нет). Работы не требует — требует переписывания, если использовать как справочник | 056 |

## Шесть вердиктов, снятых скептиком

Автор инвентаризации ставил «сделано», проверяющий агент отклонял доказательство:
№ 10, 17, 19, 31, 33, 38. В соответствующих частях (`part-049`, `part-051`, `part-052`,
`part-054`, `part-055`) заголовок раздела ещё несёт старое «сделано» — верен вердикт
из этой таблицы.
