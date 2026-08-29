# Сводный отчёт — раздел 03: services, suppliers (аналитика контракта), warehouse (A–F)

40 планов. Сделано — 17, частично — 23. Незакрытых чекбоксов ни у одного: почти все
эти планы написаны как промпты или описания, а не как чек-листы, поэтому вердикт
берётся сверкой с кодом, а не счётом `- [ ]`.

Подробности — в частях `part-037` … `part-047`, они не дублируются здесь.

| План | Вердикт | Что осталось | Часть |
|---|---|---|---|
| `roo_code/plans/services/service-card-page-plan.md` | частично | вердикт «сделано» опирался на счёт чекбоксов, которых в плане нет; нужна пофайловая сверка 7 пунктов, из известного — визуальных тестов в спеке нет | 037 |
| `roo_code/plans/services/services-page-plan.md` | частично | то же вакуумное доказательство: план из 10 промптов не сверён по пунктам (в плане ни `- [ ]`, ни `- [x]`) | 038 |
| `roo_code/plans/suppliers/suppliers-api-contract-analysis.md` | частично | записка, не план работ: пять «критических уточнений» в контракте закрыты, но её карта бэкенда устарела — suppliers 0/7, bcc 0/7, config 0/9, analytics 0/8, роутеры не подключены, auth 3 эндпоинта вместо 5 | 039 |
| `roo_code/plans/warehouse/add-action-buttons-to-warehouse-tabs.md` | частично | нет кнопок «New Stock Item» и «Add to Deficit» (ни UI, ни ключей); «New Movement» снят с UI осознанно; класс `.warehouse-toolbar` заменён на `suppliers-header` | 040 |
| `roo_code/plans/warehouse/add-batch-auditlog-mock-data.md` | частично | 12 блоков `auditLog` есть, но с таблицей плана не сверены; поле объявлено как `auditLog?:` вместо обязательного, набор ID партий другой | 040 |
| `roo_code/plans/warehouse/add-batch-card-currency-selector.md` | частично | список валют не многовариантный: `CURRENCY_OPTIONS` отдаёт одну базовую валюту из настроек — выбирать нечего | 040 |
| `roo_code/plans/warehouse/add-batch-card-field-hints.md` | сделано | — | 040 |
| `roo_code/plans/warehouse/add-batch-card-offcut-link.md` | сделано | — | 040 |
| `roo_code/plans/warehouse/add-batch-card-unit-field.md` | сделано | — | 041 |
| `roo_code/plans/warehouse/add-batches-filters.md` | сделано | — | 041 |
| `roo_code/plans/warehouse/add-batches-tab-tooltips.md` | частично | подсказки нет у колонки `col_product` — одна из девяти (обернуть в `div.th-content` + `span.info-hint`) | 041 |
| `roo_code/plans/warehouse/add-batch-mock-files.md` | частично | количество файлов на партию совпадает с планом до единицы, а тип каждого документа из таблицы плана не сверялся | 041 |
| `roo_code/plans/warehouse/add-batch-status-tooltip.md` | частично | у обёртки нет `data-test="batch-card-status-wrapper"` из плана; второе требование плана тоже не выполнено | 041 |
| `roo_code/plans/warehouse/add-deficit-tab-sorting.md` | частично | мок не умеет две сортировки из семи: в `mockGetDeficitList` нет сравнения по `unit` и по `status` | 042 |
| `roo_code/plans/warehouse/add-movements-filters.md` | частично | фильтр по категории мёртв: `mockGetMovements` объявляет `categoryIds`, но не фильтрует по нему | 042 |
| `roo_code/plans/warehouse/add-movement-type-hints-in-dropdown.md` | частично | в `_custom-select.css` нет правила `.option-hint { font-size: 11px }`, которое требует план | 042 |
| `roo_code/plans/warehouse/add-offcut-batch-status.md` | сделано | — | 042 |
| `roo_code/plans/warehouse/add-offcut-card-movements-section.md` | сделано | — | 042 |
| `roo_code/plans/warehouse/add-offcut-movements.md` | частично | переводов примечаний хватает на половину статусов: `in_production`, `expensed`, `returned_to_supplier`, `in_storage` отдают сырой ключ; `offcutNumber` и `unit` не переданы | 043 |
| `roo_code/plans/warehouse/add-offcuts-remaining-filters.md` | частично | фильтра по товару в UI обрезков нет (`offcutFilters.productId` ни к чему не привязан и не попадает в сохранённое представление); категория сделана множественной вместо одиночной | 043 |
| `roo_code/plans/warehouse/analysis-cutting-vs-spec.md` | сделано | — | 043 |
| `roo_code/plans/warehouse/auto-create-movement-on-location-change.md` | частично | `mockPatchBatch` движение не создаёт — на месте шага заглушка с комментарием «handled by composable» | 043 |
| `roo_code/plans/warehouse/auto-create-movement-on-offcut-location-change.md` | частично | `mockPatchOffcut` движение не создаёт — только `Object.assign` | 043 |
| `roo_code/plans/warehouse/correction-behavior-refinement.md` | частично | нет красной подсказки под полем (Problem #2) при отрицательном значении и при значении вне допустимого | 044 |
| `roo_code/plans/warehouse/enhance-movement-modal-with-batch-summary.md` | частично | список отдельных движений (пункт 3) не реализован — его i18n и CSS остались мёртвым следом; агрегаты приходят пропсом, а не вычисляются из `movements`; мультивыбор заменён одиночным | 044 |
| `roo_code/plans/warehouse/enrich-batch-mock-locations.md` | сделано | — | 044 |
| `roo_code/plans/warehouse/enrich-batch-mock-notes.md` | сделано | — | 044 |
| `roo_code/plans/warehouse/extract-batch-location-section.md` | частично | секция, форма, 9 ключей × 3 локали, `.location-grid` и снос старого поля есть; скептик нашёл невыполненное требование плана сверх этого — объём остатка не уточнён | 045 |
| `roo_code/plans/warehouse/extract-offcut-location-section.md` | частично | не покрыт Edge Case 3 плана: поведение при незаполненных rack/row/cell (когда есть только notes) | 045 |
| `roo_code/plans/warehouse/fix-batch-card-custom-select-overlap.md` | сделано | — | 045 |
| `roo_code/plans/warehouse/fix-batch-card-i18n-keys.md` | сделано | — | 045 |
| `roo_code/plans/warehouse/fix-batch-card-movements-table-styling.md` | сделано | — | 046 |
| `roo_code/plans/warehouse/fix-batch-card-notes-textarea.md` | сделано | — | 046 |
| `roo_code/plans/warehouse/fix-batch-count-inconsistency.md` | частично | партии `whb-075`/`whb-076` существуют, но согласованность цифр не доказана: в `warehouse-stock.ts` у `prod-003` всё ещё «Лист алюминиевый», `pcs`, 80/70, тогда как партии дают 16 т | 046 |
| `roo_code/plans/warehouse/fix-entity-card-links-plan.md` | частично | доказано только существование файлов, маршрутов, ссылок и трёх ключей `*_card_title`; содержание карточек и композаблов по шести фазам плана не сверено | 046 |
| `roo_code/plans/warehouse/fix-export-functionality.md` | частично | главного нет — генерации CSV: `mockExportWarehouseCsv` заглушка, вся обвязка (сервис, роут, параметры по табам) готова | 047 |
| `roo_code/plans/warehouse/fix-inline-action-button-styles.md` | сделано | — (два пункта чек-листа из восьми визуальные, машинно не проверяются) | 047 |
| `roo_code/plans/warehouse/fix-mockCreateOffcut-batch-qty-and-movement.md` | сделано | — | 047 |
| `roo_code/plans/warehouse/fix-movement-card-mock.md` | сделано | — | 047 |
| `roo_code/plans/warehouse/fix-movement-modal-correction-behavior.md` | сделано | — (реализовано на выросшей форме, не на той, что описана в плане) | 047 |
