# Инвентаризация планов — 2026-08-26

Сплошной проход по всем планам репозитория: что из каждого плана уже есть в коде,
а что нет. Код не менялся ни по одному плану.

## Сводка

- **Планов проверено: 163** — все планы каталога `roo_code/plans/`.
- **Не начато — 2**, **частично — 111**, **сделано — 48**, **непонятно — 2**.
- **Вердикт «сделано» опроверг скептик у 34 планов** — они попали в «Работу» как «частично (скептик)».
- **Планов с незавершённым вердиктом (`dirty = 1`) — 0:** ни один файл не был занят
  чужой незакоммиченной правкой, все 163 вердикта окончательны.
- Незакрытых чекбоксов в текстах планов — 276, и они разбросаны по 25 планам.
  Это **не мера долга**: у `fix-offcuts-action-buttons.md` и `phase3-subtask3-route.md`
  чекбоксы не отмечены, а работа сделана; у большинства планов чекбоксов нет вовсе.

## Что означают вердикты

- **сделано** — все требования плана найдены в коде; остаток либо пуст, либо это
  расхождение с буквой плана, которое работы не создаёт (иное имя функции, страница
  вместо модалки, значение 420px вместо 400px).
- **частично** — часть требований в коде есть, часть отсутствует. Сюда же попадают планы,
  цель которых достигнута иначе, чем предписано: выполнять букву значило бы плодить дубли.
- **не начато** — в коде нет ни одного элемента плана.
- **непонятно** — план описывает код, которого в репозитории нет ни в проблемном, ни в
  решённом виде: требование потеряло адресата, и «сделать» его нельзя без переписывания плана.
- **(скептик)** — заявку части «сделано» опроверг отдельный агент-скептик. Типовая причина
  одна: доказательством служил счёт `grep -c "- [ ]"` = 0, а в плане нет ни одного
  чекбокса — ноль получается у любого файла без них. Такой вердикт означает не «работа есть»,
  а «сверка не проведена».

Пути в колонке «План» — от корня репозитория. Подробности и доказательства целиком —
в частях `roo_code/plans/general/inventory-parts/part-NNN.md`; здесь они не повторяются.

---

## 1. Работа (не начато и частично) — 113 планов

### 1.1. Не начато — 2

| План | Вердикт | Что осталось | Подробности |
|---|---|---|---|
| `roo_code/plans/warehouse/fix-warehouse-stock-delete-mock.md` | не начато | ни одной из трёх правок нет; премисса плана под вопросом (см. `remove-stock-deletion`) | [`part-049.md`](inventory-parts/part-049.md) |
| `roo_code/plans/warehouse/warehouse-expandable-rows-plan.md` | не начато | нет ничего: ни `ExpandableTable.vue`, ни состояния expand, ни типов, ни полей | [`part-056.md`](inventory-parts/part-056.md) |

### 1.2. Частично — 111

| План | Вердикт | Что осталось | Подробности |
|---|---|---|---|
| `roo_code/plans/api/api-endpoints-list.md` | частично | механизма `resolveLabel()`/`labelLookup.ts` нет в коде — вторая половина плана описывает несуществующее | [`part-001.md`](inventory-parts/part-001.md) |
| `roo_code/plans/auth/auth-secret-link-plan.md` | частично | magic link не заводит сессию, фронт редиректит на `/login`, нет ветки `VITE_USE_MOCKS` | [`part-002.md`](inventory-parts/part-002.md) |
| `roo_code/plans/backend/backend-db-schema-alembic-plan.md` | частично | нет таблиц `category_linked_suppliers` и `product_linked_suppliers`; переводы в JSONB, а не тройками колонок | [`part-003.md`](inventory-parts/part-003.md) |
| `roo_code/plans/backend/backend-refactor-modular-monolith-plan.md` | частично (скептик) | подтверждены только фазы 1–3; роутеры, `internal_api` и разрыв прямых импортов не проверены | [`part-004.md`](inventory-parts/part-004.md) |
| `roo_code/plans/backend/i18n-db-refactoring-plan.md` | частично | GIN-индексы на JSONB-колонках не созданы ни в одной миграции | [`part-004.md`](inventory-parts/part-004.md) |
| `roo_code/plans/bugs/3.1-orders-card-bugs.md` | частично (скептик) | 22 из 23 багов закрыты, один не подтверждён | [`part-006.md`](inventory-parts/part-006.md) |
| `roo_code/plans/bugs/clients-api-contract-analysis.md` | частично | часть пунктов реализована в другом месте, чем требует записка; остаток — сверка по контракту | [`part-007.md`](inventory-parts/part-007.md) |
| `roo_code/plans/bugs/fix-4-remaining-products-bugs.md` | частично | из четырёх багов закрыты не все — остаток в части | [`part-007.md`](inventory-parts/part-007.md) |
| `roo_code/plans/bugs/fix-clients-delete-modal-text.md` | частично (скептик) | буквальные правки на месте, но требование сверх них не подтверждено | [`part-007.md`](inventory-parts/part-007.md) |
| `roo_code/plans/bugs/fix-filter-transition-flicker.md` | частично (скептик) | шаги 1–3 сделаны, дальше плана — нет | [`part-008.md`](inventory-parts/part-008.md) |
| `roo_code/plans/bugs/fix-structuredClone-v2.md` | частично (скептик) | пункты 1–3 есть, остаток плана не выполнен | [`part-009.md`](inventory-parts/part-009.md) |
| `roo_code/plans/bugs/fix-toTranslatedString-merge-bug.md` | частично | слияние есть под другим именем (`mergeLocaleValue`), часть мест не переведена на него | [`part-009.md`](inventory-parts/part-009.md) |
| `roo_code/plans/bugs/settings-notifications-bugs.md` | частично | три бага с разделом «Fix» закрыты, остальные записи без починки | [`part-010.md`](inventory-parts/part-010.md) |
| `roo_code/plans/bugs/static-analysis-debt-bugs.md` | частично | из девяти записей закрыта часть; статус несёт таблица в конце файла | [`part-011.md`](inventory-parts/part-011.md) |
| `roo_code/plans/categories/02-categories-checkpoint0.md` | частично (скептик) | в плане нет ни одного чекбокса — счёт «0 незакрытых» ничего не доказывал, нужна пофункциональная сверка | [`part-012.md`](inventory-parts/part-012.md) |
| `roo_code/plans/general/autonomous-run-policy-plan.md` | частично | цифры разделов 1–2 сходятся, часть требований политики не внедрена | [`part-013.md`](inventory-parts/part-013.md) |
| `roo_code/plans/general/convert-claude-md-to-roo-code.md` | частично (скептик) | шаги 1, 3 и часть 4 выполнены, остальное не подтверждено | [`part-013.md`](inventory-parts/part-013.md) |
| `roo_code/plans/general/dropdown-design-options.md` | частично | CSS Option A внедрён, часть рекомендаций варианта не реализована | [`part-013.md`](inventory-parts/part-013.md) |
| `roo_code/plans/general/move-project-to-flexiron-enterprise.md` | частично | перенос каталога Windows из этого чекаута не проверяем; косметика (шаг 7) сделана | [`part-013.md`](inventory-parts/part-013.md) |
| `roo_code/plans/general/mvp-roadmap.md` | частично | настройки и финансы есть, часть блоков дорожной карты не начата | [`part-014.md`](inventory-parts/part-014.md) |
| `roo_code/plans/general/phase10-clients-prompt.md` | частично (скептик) | чекбоксов в плане нет — вердикт «сделано» был вакуумным, нужна сверка по пунктам | [`part-014.md`](inventory-parts/part-014.md) |
| `roo_code/plans/general/prompt-for-new-session.md` | частично | проверка выполнена и записана; часть правил порядка роутов не закрыта | [`part-014.md`](inventory-parts/part-014.md) |
| `roo_code/plans/general/review-followups.md` | частично | из 22 разделов сделано 8, остальные частично или не начаты | [`part-015.md`](inventory-parts/part-015.md) |
| `roo_code/plans/general/settings-cache-data-staleness-plan.md` | частично (скептик) | чекбоксов в плане нет — «0 незакрытых» не вердикт; нужна сверка прозаических требований | [`part-016.md`](inventory-parts/part-016.md) |
| `roo_code/plans/general/settings-plan.md` | частично | нет `WarehouseSector`, часть поставки плана не закрыта | [`part-016.md`](inventory-parts/part-016.md) |
| `roo_code/plans/general/update-skills-clients-prompt.md` | частично | CSS/i18n/imports-половина внесена в скилы, вторая половина — нет | [`part-016.md`](inventory-parts/part-016.md) |
| `roo_code/plans/general/user-dropdown-menu-plan.md` | частично | всё есть, включая опциональный пункт 5; остаток — мелкие расхождения с буквой | [`part-016.md`](inventory-parts/part-016.md) |
| `roo_code/plans/orders/3.1-orders-plan.md` | частично | план объявляет себя историческим и по существу выполнен; 33 чекбокса остались неотмеченными | [`part-017.md`](inventory-parts/part-017.md) |
| `roo_code/plans/orders/3.2-order-page-shared-components.md` | частично (скептик) | чекбоксов в плане нет вовсе — вердикт «сделано» держался на пустом счёте | [`part-018.md`](inventory-parts/part-018.md) |
| `roo_code/plans/orders/3.3-order-returns-plan.md` | частично | реализовано почти всё; остаток перечислен в части | [`part-019.md`](inventory-parts/part-019.md) |
| `roo_code/plans/orders/currency-fix-and-fifo-plan.md` | частично | Phase A и B сделаны (кроме UI движения), Phase C не начата — 5 чекбоксов | [`part-020.md`](inventory-parts/part-020.md) |
| `roo_code/plans/orders/order-pricing-model.md` | частично | фронтовая модель и мок-сервер есть целиком, серверной реализации нет | [`part-022.md`](inventory-parts/part-022.md) |
| `roo_code/plans/orders/orders-backend-contract.md` | частично | клиентская половина контракта сделана целиком, серверной нет вовсе | [`part-023.md`](inventory-parts/part-023.md) |
| `roo_code/plans/orders/pricing-section-rework-plan.md` | частично | разделы 2–4 устарели по существу; раздел 1 (переименования) не выполнен | [`part-024.md`](inventory-parts/part-024.md) |
| `roo_code/plans/plans-multi-role-migration-plan.md` | частично | модели и связи есть, 3 чекбокса не закрыты | [`part-025.md`](inventory-parts/part-025.md) |
| `roo_code/plans/products/01-products-plan.md` | частично | поставка реализована и переросла план; 32 чекбокса не отмечены, остаток — в части | [`part-026.md`](inventory-parts/part-026.md) |
| `roo_code/plans/products/products-api-contract-analysis.md` | частично | все три «Changes Required» закрыты, остаток — расхождения контракта | [`part-027.md`](inventory-parts/part-027.md) |
| `roo_code/plans/products/product-uom-restructure-plan.md` | частично | шаги 1,2,5–9 есть; остальные шаги не выполнены | [`part-027.md`](inventory-parts/part-027.md) |
| `roo_code/plans/products/uom-restructure-completion-plan.md` | частично | шаги 1, 2 и почти весь 5 сделаны; 23 чекбокса открыты | [`part-028.md`](inventory-parts/part-028.md) |
| `roo_code/plans/refactor/single-locale-save-refactor.md` | частично | Фаза 1 и домены categories/products есть; часть доменов не переведена | [`part-030.md`](inventory-parts/part-030.md) |
| `roo_code/plans/refactor/refactor-prompts/01-products-page.md` | частично (скептик) | чекбоксов в файле ноль — «0 незакрытых» не вердикт; §-пункты не сверены | [`part-031.md`](inventory-parts/part-031.md) |
| `roo_code/plans/refactor/refactor-prompts/02-product-card-page.md` | частично (скептик) | не выполнены §5 и §6 плана; доказательство было вакуумным | [`part-031.md`](inventory-parts/part-031.md) |
| `roo_code/plans/refactor/refactor-prompts/03-categories-page.md` | частично (скептик) | отдельной `getCategoriesTranslated` нет — буква плана не выполнена, цель достигнута иначе | [`part-031.md`](inventory-parts/part-031.md) |
| `roo_code/plans/refactor/refactor-prompts/04-category-card-page.md` | частично | цель достигнута, буква про параллельные `*Translated`-функции — нет | [`part-032.md`](inventory-parts/part-032.md) |
| `roo_code/plans/refactor/refactor-prompts/05-bcc-request-page.md` | частично | цель достигнута, буква про параллельные `*Translated`-функции — нет | [`part-032.md`](inventory-parts/part-032.md) |
| `roo_code/plans/refactor/refactor-prompts/06-supplier-card-page.md` | частично | цель достигнута, буква про параллельные `*Translated`-функции — нет | [`part-032.md`](inventory-parts/part-032.md) |
| `roo_code/plans/refactor/refactor-prompts/07-supplier-card-config-page.md` | частично (скептик) | чекбоксов нет, `resolveLabel`/`useLabelResolver` в файле отсутствуют — сверка не проведена | [`part-033.md`](inventory-parts/part-033.md) |
| `roo_code/plans/refactor/refactor-prompts/08-supplier-create-page.md` | частично | типы и моки переведены; буква плана про отдельные функции не выполнена | [`part-033.md`](inventory-parts/part-033.md) |
| `roo_code/plans/refactor/refactor-prompts/09-suppliers-list-page.md` | частично (скептик) | та же дыра: в плане ни одного чекбокса, вердикт «сделано» не обоснован | [`part-033.md`](inventory-parts/part-033.md) |
| `roo_code/plans/refactor/single-locale-prompts/02-domain-categories.md` | частично (скептик) | вызовы `toTranslatedString` есть, но требования плана не выполнены — нужна проверка срабатывания | [`part-034.md`](inventory-parts/part-034.md) |
| `roo_code/plans/refactor/single-locale-prompts/03-domain-products.md` | частично | обёртки в сервисе есть, часть требований плана не закрыта | [`part-034.md`](inventory-parts/part-034.md) |
| `roo_code/plans/refactor/single-locale-prompts/04-domain-suppliers.md` | частично | три поля оборачиваются и сливаются, остальное по плану — нет | [`part-034.md`](inventory-parts/part-034.md) |
| `roo_code/plans/refactor/single-locale-prompts/06-domain-config.md` | частично | поля `name` оборачиваются и сливаются, часть требований не закрыта | [`part-034.md`](inventory-parts/part-034.md) |
| `roo_code/plans/refactor/single-locale-prompts/08-phase3-global-cleanup.md` | частично | пункты 1, 3, 4 сделаны; GET-роуты мока не соответствуют букве плана | [`part-035.md`](inventory-parts/part-035.md) |
| `roo_code/plans/refactor/single-locale-prompts/09-phase4-verification.md` | частично | тайпчек и билд чисты, e2e — выборкой; ручной чеклист (10 пунктов) не покрыт | [`part-035.md`](inventory-parts/part-035.md) |
| `roo_code/plans/sales-crm/01-sales-crm-initial-plan.md` | частично | инфраструктура (роут, флаг, типы) есть, сама страница — нет; 9 чекбоксов | [`part-036.md`](inventory-parts/part-036.md) |
| `roo_code/plans/services/service-card-page-plan.md` | частично (скептик) | вердикт держался на счёте чекбоксов, которых нет; визуальных тестов в спеке нет | [`part-037.md`](inventory-parts/part-037.md) |
| `roo_code/plans/services/services-page-plan.md` | частично (скептик) | план из 10 промптов не сверён по пунктам — ни `- [ ]`, ни `- [x]` в файле | [`part-038.md`](inventory-parts/part-038.md) |
| `roo_code/plans/suppliers/suppliers-api-contract-analysis.md` | частично | аналитическая записка: пять критических уточнений закрыты, остаток — серверная часть | [`part-039.md`](inventory-parts/part-039.md) |
| `roo_code/plans/warehouse/add-action-buttons-to-warehouse-tabs.md` | частично | тулбар и экспорт есть, часть кнопок плана — нет | [`part-040.md`](inventory-parts/part-040.md) |
| `roo_code/plans/warehouse/add-batch-auditlog-mock-data.md` | частично (скептик) | 12 блоков `auditLog` есть, но с таблицей плана не сходятся — типы записей другие | [`part-040.md`](inventory-parts/part-040.md) |
| `roo_code/plans/warehouse/add-batch-card-currency-selector.md` | частично | тип, форма и композабл есть, часть плана не закрыта | [`part-040.md`](inventory-parts/part-040.md) |
| `roo_code/plans/warehouse/add-batches-tab-tooltips.md` | частично | ключи и подсказки у восьми колонок из девяти | [`part-041.md`](inventory-parts/part-041.md) |
| `roo_code/plans/warehouse/add-batch-mock-files.md` | частично (скептик) | количество файлов сходится, тип каждого документа — нет (расхождение в трёх местах) | [`part-041.md`](inventory-parts/part-041.md) |
| `roo_code/plans/warehouse/add-batch-status-tooltip.md` | частично (скептик) | нет обёртки `span.batch-status-wrapper` с `data-test` и ещё одного требования плана | [`part-041.md`](inventory-parts/part-041.md) |
| `roo_code/plans/warehouse/add-deficit-tab-sorting.md` | частично | сортировка и композабл есть, часть плана — нет | [`part-042.md`](inventory-parts/part-042.md) |
| `roo_code/plans/warehouse/add-movements-filters.md` | частично | есть всё, кроме фильтра по категории в моке | [`part-042.md`](inventory-parts/part-042.md) |
| `roo_code/plans/warehouse/add-movement-type-hints-in-dropdown.md` | частично (скептик) | правила `.option-hint { font-size: 11px }` в `_custom-select.css` нет | [`part-042.md`](inventory-parts/part-042.md) |
| `roo_code/plans/warehouse/add-offcut-movements.md` | частично | есть всё, кроме переводов примечаний | [`part-043.md`](inventory-parts/part-043.md) |
| `roo_code/plans/warehouse/add-offcuts-remaining-filters.md` | частично | из трёх фильтров в UI два; категория множественная вместо одиночной | [`part-043.md`](inventory-parts/part-043.md) |
| `roo_code/plans/warehouse/auto-create-movement-on-location-change.md` | частично | шаги 1, 3, 5 сделаны, шаги 2 и 4 — нет | [`part-043.md`](inventory-parts/part-043.md) |
| `roo_code/plans/warehouse/auto-create-movement-on-offcut-location-change.md` | частично | шаг 1 перевыполнен, остальные шаги не закрыты | [`part-043.md`](inventory-parts/part-043.md) |
| `roo_code/plans/warehouse/correction-behavior-refinement.md` | частично (скептик) | нет красной подсказки под полем при отрицательном значении (Problem #2) | [`part-044.md`](inventory-parts/part-044.md) |
| `roo_code/plans/warehouse/enhance-movement-modal-with-batch-summary.md` | частично | размер, пропсы и секция сводки есть, часть плана — нет | [`part-044.md`](inventory-parts/part-044.md) |
| `roo_code/plans/warehouse/extract-batch-location-section.md` | частично (скептик) | секция и i18n на месте, но Edge Case плана не обработан | [`part-045.md`](inventory-parts/part-045.md) |
| `roo_code/plans/warehouse/extract-offcut-location-section.md` | частично (скептик) | шаблон и форма есть, Edge Case 3 (пустые rack/row/cell) не обработан | [`part-045.md`](inventory-parts/part-045.md) |
| `roo_code/plans/warehouse/fix-batch-count-inconsistency.md` | частично (скептик) | две записи существуют, но соответствие цифрам плана не доказано | [`part-046.md`](inventory-parts/part-046.md) |
| `roo_code/plans/warehouse/fix-entity-card-links-plan.md` | частично (скептик) | файлы, роуты и ключи есть, содержание карточек не сверено | [`part-046.md`](inventory-parts/part-046.md) |
| `roo_code/plans/warehouse/fix-export-functionality.md` | частично | обвязка экспорта есть целиком, часть плана — нет | [`part-047.md`](inventory-parts/part-047.md) |
| `roo_code/plans/warehouse/fix-offcut-movement-deficit-not-found.md` | частично | шаг 2 сделан целиком, остальные шаги — нет | [`part-048.md`](inventory-parts/part-048.md) |
| `roo_code/plans/warehouse/fix-offcuts-type-column.md` | частично | все шесть файловых правок есть; 10 чекбоксов открыты | [`part-048.md`](inventory-parts/part-048.md) |
| `roo_code/plans/warehouse/fix-warehouse-phase2-bugs-remaining-tabs.md` | частично | шаги 1–4 сделаны, дальше — нет | [`part-049.md`](inventory-parts/part-049.md) |
| `roo_code/plans/warehouse/fix-warehouse-table-row-padding.md` | частично (скептик) | Change 3 (responsive adjustments) — мёртвый код, план не закрыт | [`part-049.md`](inventory-parts/part-049.md) |
| `roo_code/plans/warehouse/generalize-offcuts-for-all-categories.md` | частично | шаги 1 и 3 есть, остальные — нет | [`part-049.md`](inventory-parts/part-049.md) |
| `roo_code/plans/warehouse/implement-batch-card-write-off.md` | частично | ни одной из трёх правок плана нет — ключи `write_off_*` в коде отсутствуют | [`part-050.md`](inventory-parts/part-050.md) |
| `roo_code/plans/warehouse/new-tasks-autotests-plan.md` | частично | все пять шагов заведены, часть тестов не дописана | [`part-051.md`](inventory-parts/part-051.md) |
| `roo_code/plans/warehouse/offcut-create-page-plan.md` | частично (скептик) | доказательство содержало ложный факт про `CreateOffcutModal` — сверка нужна заново | [`part-051.md`](inventory-parts/part-051.md) |
| `roo_code/plans/warehouse/offcut-movements-plan.md` | частично | цель достигнута шире плана, но ни одна правка не там, куда план её адресовал; 16 чекбоксов | [`part-051.md`](inventory-parts/part-051.md) |
| `roo_code/plans/warehouse/phase3-subtask1-useWarehouseBatch.md` | частично (скептик) | нет поля формы `location: string | null` и ещё одного требования; 8 чекбоксов | [`part-052.md`](inventory-parts/part-052.md) |
| `roo_code/plans/warehouse/phase3-subtask2-WarehouseBatchCard.md` | частично | 7 из 10 `data-test` есть; 12 чекбоксов открыты | [`part-052.md`](inventory-parts/part-052.md) |
| `roo_code/plans/warehouse/phase4-subtask1-CreateBatchModal.md` | частично | модалки нет — приход реализован отдельной страницей; 8 чекбоксов | [`part-052.md`](inventory-parts/part-052.md) |
| `roo_code/plans/warehouse/phase4-subtask2-CreateMovementModal.md` | частично | модалка есть, но партия приходит пропом — селектора партий и `unitPrice` нет; 10 чекбоксов | [`part-052.md`](inventory-parts/part-052.md) |
| `roo_code/plans/warehouse/phase4-subtask3-CreateOffcutModal.md` | частично | модалки нет — резка реализована страницей; 10 чекбоксов | [`part-052.md`](inventory-parts/part-052.md) |
| `roo_code/plans/warehouse/phase4-subtask4-useWarehouseMovement.md` | частично | файла `useWarehouseMovement.ts` нет, логика внутри модалки; 5 чекбоксов | [`part-053.md`](inventory-parts/part-053.md) |
| `roo_code/plans/warehouse/phase5-subtask1-useWarehouseOffcutsAndDeficit.md` | частично | обоих композаблов нет, логика в `useWarehouse.ts`; 5 чекбоксов | [`part-053.md`](inventory-parts/part-053.md) |
| `roo_code/plans/warehouse/phase5-subtask2-improve-tabs.md` | частично | бейджи, размеры и быстрые действия есть; 12 чекбоксов открыты | [`part-053.md`](inventory-parts/part-053.md) |
| `roo_code/plans/warehouse/phase6-subtask1-e2e-mocks.md` | частично | все 10 хелперов плюс шесть сверх плана; 7 чекбоксов | [`part-053.md`](inventory-parts/part-053.md) |
| `roo_code/plans/warehouse/phase6-subtask2-e2e-spec.md` | частично | спек на ~50 тестов есть; 8 чекбоксов открыты | [`part-053.md`](inventory-parts/part-053.md) |
| `roo_code/plans/warehouse/refactor-warehouse-mock-data.md` | частично | разделение на пять файлов выполнено, часть плана — нет | [`part-053.md`](inventory-parts/part-053.md) |
| `roo_code/plans/warehouse/remove-stock-deletion.md` | частично (скептик) | удаление вырезано, но нарушено ограничение области плана (лишний коммит) | [`part-054.md`](inventory-parts/part-054.md) |
| `roo_code/plans/warehouse/safe-cascade-deletion.md` | частично | `orderId` и блокировки есть, часть плана не закрыта | [`part-054.md`](inventory-parts/part-054.md) |
| `roo_code/plans/warehouse/stock-card-restructure-plan.md` | частично (скептик) | перестройка шаблона есть, остальные требования плана не доказаны | [`part-054.md`](inventory-parts/part-054.md) |
| `roo_code/plans/warehouse/stock-remainder-card-fix-plan.md` | частично | `useHead`, `entity-not-found`, чистка CSS сделаны; часть пунктов — нет | [`part-054.md`](inventory-parts/part-054.md) |
| `roo_code/plans/warehouse/stock-remainder-card-plan.md` | частично | нет кнопки retry в состоянии ошибки и отдельной кнопки; 9 чекбоксов | [`part-054.md`](inventory-parts/part-054.md) |
| `roo_code/plans/warehouse/update-offcut-statuses-to-match-batches.md` | частично | тип и все ключи i18n есть; 10 чекбоксов открыты | [`part-055.md`](inventory-parts/part-055.md) |
| `roo_code/plans/warehouse/verify-batch-card-api-readiness.md` | частично | фронтенд-слой готов как заявлено, серверной проверки нет | [`part-055.md`](inventory-parts/part-055.md) |
| `roo_code/plans/warehouse/verify-warehouse-server-side-filtering.md` | частично (скептик) | доказана только половина: что `sortBy` уходит; обработка на стороне мока не проверена | [`part-055.md`](inventory-parts/part-055.md) |
| `roo_code/plans/warehouse/warehouse-full-inventory.md` | частично | описательная инвентаризация; расхождения с реальностью перечислены в части | [`part-056.md`](inventory-parts/part-056.md) |
| `roo_code/plans/warehouse/warehouse-page-plan.md` | частично | нет модалки/печати QR, двух подвкладок дефицита, `GET /api/warehouse/locations`; два флага мертвы | [`part-057.md`](inventory-parts/part-057.md) |
| `roo_code/plans/warehouse/warehouse-phase2-bugs.md` | частично (скептик) | отчёт из 40 пунктов прозой — проверен выборочно, нужна пунктная перепроверка | [`part-058.md`](inventory-parts/part-058.md) |
| `roo_code/plans/warehouse/warehouse-phase3-execution-plan.md` | частично | фазы 3–6 сделаны в другой форме; остаток — сам файл с устаревшим списком «не сделано» | [`part-058.md`](inventory-parts/part-058.md) |

---

## 2. Можно закрыть (сделано) — 48 планов

| План | Вердикт | Что осталось | Подробности |
|---|---|---|---|
| `roo_code/plans/bugs/3.1-orders-bugs.md` | сделано | ничего; оговорки самого плана работой не являются | [`part-005.md`](inventory-parts/part-005.md) |
| `roo_code/plans/bugs/clients-bugs.md` | сделано | ничего; одно отклонение по букве (импорт `useRouter`) работы не требует | [`part-007.md`](inventory-parts/part-007.md) |
| `roo_code/plans/bugs/e2e-orders-row-total-race.md` | сделано | ничего | [`part-007.md`](inventory-parts/part-007.md) |
| `roo_code/plans/bugs/fix-clients-list-ui-bugs.md` | сделано | ничего; `max-width` 420px вместо 400px из плана | [`part-008.md`](inventory-parts/part-008.md) |
| `roo_code/plans/bugs/fix-customselect-placeholder-bug.md` | сделано | ничего | [`part-008.md`](inventory-parts/part-008.md) |
| `roo_code/plans/bugs/fix-datepicker-styling.md` | сделано | ничего | [`part-008.md`](inventory-parts/part-008.md) |
| `roo_code/plans/bugs/fix-form-field-spacing.md` | сделано | ничего; утверждение плана про отсутствие `.form-group` устарело | [`part-008.md`](inventory-parts/part-008.md) |
| `roo_code/plans/bugs/fix-loading-skeleton-prompts.md` | сделано | ничего; файл — обрывок, в нём осталась только секция `DeficitPage.vue` | [`part-008.md`](inventory-parts/part-008.md) |
| `roo_code/plans/bugs/fix-structuredClone-translation-bug.md` | сделано | ничего, все 9 сабтасков закрыты | [`part-009.md`](inventory-parts/part-009.md) |
| `roo_code/plans/bugs/fix-translatedString-display-bugs.md` | сделано | ничего; подзадача 1 решена иначе, чем в плане | [`part-010.md`](inventory-parts/part-010.md) |
| `roo_code/plans/orders/order-pricing-frontend-plan.md` | сделано | ничего, этапы 0–9 подтверждены по каждому | [`part-021.md`](inventory-parts/part-021.md) |
| `roo_code/plans/products/fix-products-null-items-bug.md` | сделано | ничего; две правки сильнее плана — «переводные» функции удалены вовсе | [`part-027.md`](inventory-parts/part-027.md) |
| `roo_code/plans/refactor/refactor-client-card-page.md` | сделано | ничего, все 5 Key Changes в коде | [`part-029.md`](inventory-parts/part-029.md) |
| `roo_code/plans/refactor/refactor-server-side-filtering-pagination.md` | сделано | ничего, все 6 шагов выполнены | [`part-029.md`](inventory-parts/part-029.md) |
| `roo_code/plans/refactor/refactor-server-translations-analytics.md` | сделано | ничего, целевая архитектура на месте | [`part-029.md`](inventory-parts/part-029.md) |
| `roo_code/plans/refactor/translation-refactor-audit-plan.md` | сделано | ничего, все 6 починок на месте | [`part-030.md`](inventory-parts/part-030.md) |
| `roo_code/plans/refactor/single-locale-prompts/01-phase1-infrastructure.md` | сделано | ничего; сверх плана есть `mergeLocaleValue()` | [`part-034.md`](inventory-parts/part-034.md) |
| `roo_code/plans/refactor/single-locale-prompts/05-domain-bcc.md` | сделано | ничего | [`part-034.md`](inventory-parts/part-034.md) |
| `roo_code/plans/refactor/single-locale-prompts/07-domain-analytics.md` | сделано | ничего; план проверочный, все условия выполнены | [`part-035.md`](inventory-parts/part-035.md) |
| `roo_code/plans/sales-crm/add-client-auditlog-mock-data.md` | сделано | ничего, все восемь шагов реализованы (местами шире плана) | [`part-036.md`](inventory-parts/part-036.md) |
| `roo_code/plans/sales-crm/create-client-page.md` | сделано | ничего; критическое требование порядка роутов соблюдено | [`part-036.md`](inventory-parts/part-036.md) |
| `roo_code/plans/services/fix-service-card-translations.md` | сделано | ничего, все три правки в коде | [`part-037.md`](inventory-parts/part-037.md) |
| `roo_code/plans/warehouse/add-batch-card-field-hints.md` | сделано | ничего, все пять полей получили подсказку | [`part-040.md`](inventory-parts/part-040.md) |
| `roo_code/plans/warehouse/add-batch-card-offcut-link.md` | сделано | ничего | [`part-040.md`](inventory-parts/part-040.md) |
| `roo_code/plans/warehouse/add-batch-card-unit-field.md` | сделано | ничего | [`part-041.md`](inventory-parts/part-041.md) |
| `roo_code/plans/warehouse/add-batches-filters.md` | сделано | ничего, все пять фильтров таба партий на месте | [`part-041.md`](inventory-parts/part-041.md) |
| `roo_code/plans/warehouse/add-offcut-batch-status.md` | сделано | ничего, все шесть файлов плана | [`part-042.md`](inventory-parts/part-042.md) |
| `roo_code/plans/warehouse/add-offcut-card-movements-section.md` | сделано | ничего, секция есть целиком | [`part-042.md`](inventory-parts/part-042.md) |
| `roo_code/plans/warehouse/analysis-cutting-vs-spec.md` | сделано | ничего, все пять строк «Что нужно исправить» закрыты | [`part-043.md`](inventory-parts/part-043.md) |
| `roo_code/plans/warehouse/enrich-batch-mock-locations.md` | сделано | ничего, все 100 location в новом формате | [`part-044.md`](inventory-parts/part-044.md) |
| `roo_code/plans/warehouse/enrich-batch-mock-notes.md` | сделано | ничего, ни одного `notes: null` не осталось | [`part-044.md`](inventory-parts/part-044.md) |
| `roo_code/plans/warehouse/fix-batch-card-custom-select-overlap.md` | сделано | ничего, все три шага в коде | [`part-045.md`](inventory-parts/part-045.md) |
| `roo_code/plans/warehouse/fix-batch-card-i18n-keys.md` | сделано | ничего; сверх плана добавлен `btn.retry` | [`part-045.md`](inventory-parts/part-045.md) |
| `roo_code/plans/warehouse/fix-batch-card-movements-table-styling.md` | сделано | ничего | [`part-046.md`](inventory-parts/part-046.md) |
| `roo_code/plans/warehouse/fix-batch-card-notes-textarea.md` | сделано | ничего, CSS совпадает с планом дословно | [`part-046.md`](inventory-parts/part-046.md) |
| `roo_code/plans/warehouse/fix-inline-action-button-styles.md` | сделано | ничего; 8 чекбоксов не отмечены, но код на месте дословно | [`part-047.md`](inventory-parts/part-047.md) |
| `roo_code/plans/warehouse/fix-mockCreateOffcut-batch-qty-and-movement.md` | сделано | ничего, все три претензии закрыты | [`part-047.md`](inventory-parts/part-047.md) |
| `roo_code/plans/warehouse/fix-movement-card-mock.md` | сделано | ничего, порядок матчеров верный | [`part-047.md`](inventory-parts/part-047.md) |
| `roo_code/plans/warehouse/fix-movement-modal-correction-behavior.md` | сделано | ничего, оба требования выполнены | [`part-047.md`](inventory-parts/part-047.md) |
| `roo_code/plans/warehouse/fix-movement-modal-default-type-placeholder.md` | сделано | ничего | [`part-047.md`](inventory-parts/part-047.md) |
| `roo_code/plans/warehouse/fix-movement-modal-show-unit-in-selected-qty.md` | сделано | ничего | [`part-048.md`](inventory-parts/part-048.md) |
| `roo_code/plans/warehouse/fix-offcut-card-i18n-keys.md` | сделано | ничего, все 13 ключей в трёх локалях | [`part-048.md`](inventory-parts/part-048.md) |
| `roo_code/plans/warehouse/fix-offcuts-action-buttons.md` | сделано | ничего; 11 чекбоксов не отмечены, но все пять слоёв на месте | [`part-048.md`](inventory-parts/part-048.md) |
| `roo_code/plans/warehouse/fix-stock-card-header-title.md` | сделано | ничего | [`part-048.md`](inventory-parts/part-048.md) |
| `roo_code/plans/warehouse/movement-modal-form-fields-restructure.md` | сделано | ничего, все 11 пунктов сводной таблицы в коде | [`part-050.md`](inventory-parts/part-050.md) |
| `roo_code/plans/warehouse/movements-default-sort-desc.md` | сделано | ничего, все три правки на месте | [`part-050.md`](inventory-parts/part-050.md) |
| `roo_code/plans/warehouse/movement-type-restrictions.md` | сделано | ничего, все четыре пункта реализованы | [`part-050.md`](inventory-parts/part-050.md) |
| `roo_code/plans/warehouse/phase3-subtask3-route.md` | сделано | ничего; расходится только номер строки (план 184–189, факт 261–265) | [`part-052.md`](inventory-parts/part-052.md) |

---

## 3. Непонятно — 2 плана

Оба требуют кода, которого нет ни в проблемном, ни в решённом виде. Прежде чем
брать их в работу, план надо переписать под текущую архитектуру или закрыть.

| План | Вердикт | Что осталось | Подробности |
|---|---|---|---|
| `roo_code/plans/bugs/fix-raw-i18n-keys-architectural.md` | непонятно | в коде нет ни описанной проблемы, ни предложенного решения — план не о текущем коде; 16 чекбоксов | [`part-009.md`](inventory-parts/part-009.md) |
| `roo_code/plans/bugs/fix-remaining-translation-bugs.md` | непонятно | требует 4 маршрута мока, но вызывающего кода тоже нет — требование потеряло адресата | [`part-009.md`](inventory-parts/part-009.md) |

---

## 4. Вердикт не окончателен (`dirty = 1`) — 0 планов

Ни один из 163 планов не проверялся по файлу, занятому чужой незакоммиченной правкой.
Раздел пуст: перепроверять после мержа нечего.

---

## Разделы с полным перечнем

Ниже к этому файлу присоединены разделы 01–05, записанные отдельно; вместе они
покрывают те же 163 плана с более длинными формулировками остатка.

- [`inventory-parts/section-01.md`](inventory-parts/section-01.md) — планы 1–40 (api, auth, backend, bugs, categories, general), части 001–017
- [`inventory-parts/section-02.md`](inventory-parts/section-02.md) — планы 41–80 (orders, products, refactor, sales-crm, services)
- [`inventory-parts/section-03.md`](inventory-parts/section-03.md) — планы 81–120 (services, suppliers, warehouse A–F), части 037–047
- [`inventory-parts/section-04.md`](inventory-parts/section-04.md) — планы 121–160 (warehouse, алфавитный хвост), части 047–056
- [`inventory-parts/section-05.md`](inventory-parts/section-05.md) — планы 161–163 (warehouse page/phase2/phase3), части 057–058

## Части этого прогона

58 частей, `part-001.md` … `part-058.md`, все на месте — ни одна не потеряна.
В каждой лежат доказательства целиком: команды, вывод, номера строк.
Ссылка на нужную часть стоит в каждой строке таблиц выше.

---
---



# Сводный отчёт инвентаризации — раздел 01 (планы 1–40, части 001–017)

Одна строка на план. Подробности и доказательства — в указанной части
`roo_code/plans/general/inventory-parts/part-NNN.md`; здесь они не повторяются.

Итог раздела: 40 планов — **сделано 10**, **частично 28**, **непонятно 2**.
Незакрытых чекбоксов всего 49, и все они в двух планах:
`bugs/fix-raw-i18n-keys-architectural.md` (16) и `orders/3.1-orders-plan.md` (33);
у остальных 38 планов чекбоксов нет вовсе — вердикт получен разбором по существу.
Пометка «скептик» означает, что заявку части «сделано» опроверг агент-скептик.

| # | План | Вердикт | Что осталось | Часть |
|---|---|---|---|---|
| 1 | `roo_code/plans/api/api-endpoints-list.md` | частично | 28 эндпойнтов вызываются как заявлено, но `resolveLabel()`, `labelLookup.ts` и `i18n/admin.ts` не существуют — вся вторая половина плана описывает механизм, которого нет (задача решена через `TranslatedString` + `tf()`) | part-001 |
| 2 | `roo_code/plans/auth/auth-secret-link-plan.md` | частично | magic link не создаёт сессию (`verify_secret_link` возвращает только email), фронтовый обработчик не логинит, а редиректит на `/login`, нет ветвления `VITE_USE_MOCKS` на странице входа | part-002 |
| 3 | `roo_code/plans/backend/backend-db-schema-alembic-plan.md` | частично | нет таблиц `category_linked_suppliers` и `product_linked_suppliers` (ни модели, ни миграции); `TranslatedString` лежит в JSONB, а не тройками колонок — вопреки отдельному разделу плана | part-003 |
| 4 | `roo_code/plans/backend/backend-refactor-modular-monolith-plan.md` | частично (скептик) | доказаны только фазы 1–3 (структура, модели, `alembic/env.py`); остальные фазы плана (роутеры, `internal_api`, разрыв прямых импортов между модулями) не подтверждены | part-004 |
| 5 | `roo_code/plans/backend/i18n-db-refactoring-plan.md` | частично | вариант B (JSONB) внедрён во всех 14 таблицах, но GIN-индексы на JSONB-колонках (шаг 5 фазы 1) не созданы ни в одной миграции — заявленный плюс варианта B не реализован | part-004 |
| 6 | `roo_code/plans/bugs/3.1-orders-bugs.md` | сделано | ничего; оговорки самого плана (недостижимая ветка наценки у БАГ-07, смена точки починки у БАГ-10) работой не являются | part-005 |
| 7 | `roo_code/plans/bugs/3.1-orders-card-bugs.md` | частично (скептик) | 22 из 23 багов закрыты; один не подтверждён, отклонение по букве — БАГ-16 решён общим `SuffixSelect` вместо `closest('.custom-select-wrap')` | part-006 |
| 8 | `roo_code/plans/bugs/clients-api-contract-analysis.md` | частично | `VALIDATION_ERROR` в `mockPatchClient` отсутствует (только `CLIENT_NOT_FOUND`, ошибки через `throw`), `dynamicFields` в `ClientFormData` нет; `orderHistory` осознанно отклонён | part-007 |
| 9 | `roo_code/plans/bugs/clients-bugs.md` | сделано | ничего; `useRouter` в `ClientCardPage` используется, так что буква БАГ-6 неактуальна | part-007 |
| 10 | `roo_code/plans/bugs/e2e-orders-row-total-race.md` | сделано | ничего — утверждение номера заказа до чтения суммы и `waitForDataReady` на месте | part-007 |
| 11 | `roo_code/plans/bugs/fix-4-remaining-products-bugs.md` | частично | добавить `fieldValues` для `f-10-4` (Weight per meter) двум товарам cat-10 либо убрать поле из категории; опционально — 114+39 мёртвых i18n-ключей динамических полей | part-007 |
| 12 | `roo_code/plans/bugs/fix-clients-delete-modal-text.md` | частично (скептик) | все четыре правки на месте (модал, `deletingClientName`, ветка CONFLICT, i18n ×3 локали), содержательного долга нет — снято как недоказанное | part-007 |
| 13 | `roo_code/plans/bugs/fix-clients-list-ui-bugs.md` | сделано | ничего; `max-width` первой filter-group 420px вместо плановых 400 | part-008 |
| 14 | `roo_code/plans/bugs/fix-customselect-placeholder-bug.md` | сделано | ничего | part-008 |
| 15 | `roo_code/plans/bugs/fix-datepicker-styling.md` | сделано | ничего — оба date-инпута вкладки партий переведены на `DatePicker` по шаблону плана | part-008 |
| 16 | `roo_code/plans/bugs/fix-filter-transition-flicker.md` | частично (скептик) | шаги 1–3 и шаблон/CSS на месте; отклонения от буквы — `opacity: 0` вместо `visibility: hidden`, скелетон самого `GlassPanel` вместо оверлея, добавлена ветка `skipStockTransition` | part-008 |
| 17 | `roo_code/plans/bugs/fix-form-field-spacing.md` | сделано | ничего; посылка плана «`.form-group` нигде не определён» устарела — правила есть в `_forms.css` и `main.css` | part-008 |
| 18 | `roo_code/plans/bugs/fix-loading-skeleton-prompts.md` | сделано | ничего по тому, что в файле осталось (только секция `DeficitPage.vue`); файл — обрывок большого набора промптов | part-008 |
| 19 | `roo_code/plans/bugs/fix-raw-i18n-keys-architectural.md` | непонятно (16 чекбоксов) | в коде нет ни описанной проблемы (regex-генерации ключей), ни предложенного решения (`labelLookup.ts`, `useLabelResolver.ts`, генератор) — план надо закрыть как неактуальный или переписать | part-009 |
| 20 | `roo_code/plans/bugs/fix-remaining-translation-bugs.md` | непонятно | четырёх `/translated`-маршрутов в моке нет, но нет и вызывающих их композаблов и сервисных функций — оба бага недостижимы; побочно: мёртвые ветки `/api/clients/translated` и `/api/orders/translated` | part-009 |
| 21 | `roo_code/plans/bugs/fix-structuredClone-translation-bug.md` | сделано | ничего — все 9 сабтасков (S1–S9) в коде, `vue-tsc` чистый | part-009 |
| 22 | `roo_code/plans/bugs/fix-structuredClone-v2.md` | частично (скептик) | пункты 1–3 в коде буквально (`watchEffect` + `deepTouch`, `vue-tsc` exit=0); пункт 4 — ручная проверка в браузере — машинно не подтверждается, только косвенно юнит-тестами | part-009 |
| 23 | `roo_code/plans/bugs/fix-toTranslatedString-merge-bug.md` | частично | шаги 1–2 сделаны (`mergeLocaleValue` + все девять P0/P1-вызовов); шаг 3 (P3, помечен «опционально») не сделан — остаточные `toTranslatedString()` при создании секций и полей | part-009 |
| 24 | `roo_code/plans/bugs/fix-translatedString-display-bugs.md` | сделано | ничего; подзадача 3 недостижима — `AnalyticsCard.vue` и `AlertsTable.vue` удалены. Вне плана: хардкод `{ru,en,lt}` в `BccRequestPage`, `SettingsLayout`, `SupplierCardConfigPage` | part-010 |
| 25 | `roo_code/plans/bugs/settings-notifications-bugs.md` | частично | БАГ-10 (перенести `filters-bar` внутрь `GlassPanel`, сам план — low priority) и остаточные HTML-комментарии: 1 в `ProfileSettings.vue`, 3 в `SettingsLayout.vue` при ✅ в таблице | part-010 |
| 26 | `roo_code/plans/bugs/static-analysis-debt-bugs.md` | частично | БАГ-09 (корень не найден, ждать падение с trace), БАГ-06 (39 функций и 24 тернарника не тронуты), отставшая таблица статусов и разошедшиеся счётчики храповика в `eslint.config.js` | part-011 |
| 27 | `roo_code/plans/categories/02-categories-checkpoint0.md` | частично (скептик) | содержательного долга нет: пять `data-test` названы по схеме `modal-*`/`category-card-*`, фильтрация серверная (в моке), секция наследованных полей скрывается по длине массива; «сделано» снято как недоказанное | part-012 |
| 28 | `roo_code/plans/general/autonomous-run-policy-plan.md` | частично | разделы 3–6 скриптом не реализованы (ветка `auto/<набор>`, коммит на задачу, `git stash push -u`, правила остановки, 6 агентов, куски по 100); сводного отчёта инвентаризации нет; утверждение о красном `verify` устарело | part-013 |
| 29 | `roo_code/plans/general/convert-claude-md-to-roo-code.md` | частично (скептик) | шаги 1, 3, 4 выполнены; шаг 2 отклонён по букве — `frontend_vue/CLAUDE.md` удалён, а не переписан в файл-указатель (цель достигнута сильнее, работы не оставляет) | part-013 |
| 30 | `roo_code/plans/general/dropdown-design-options.md` | частично | CSS Option A в `erp-base.css` есть, но в разметке `AdminTopbar.vue` нет блока `.user-dropdown-header` (аватар, имя, роль) — визуально это Option B; иконка `settings` вместо `settings-gear` | part-013 |
| 31 | `roo_code/plans/general/move-project-to-flexiron-enterprise.md` | частично | сам перенос каталога (шаги 2, 3, 6) из Linux-чекаута не проверяем; шаг 1 (удалить `demo/` и `frontend_vue/dist/`) буквально не выполнен; шаг 5 (пересборка) не снимался | part-013 |
| 32 | `roo_code/plans/general/mvp-roadmap.md` | частично | пользователи в настройках, секторы карты склада, ручная финансовая операция, весь блок документов (3.1–3.3), сигнал закупщику по минусу, резка из заказа, Purchase Orders целиком, канбан заказов, задания кладовщику, экспорт в бухгалтерию | part-014 |
| 33 | `roo_code/plans/general/phase10-clients-prompt.md` | частично (скептик) | все требуемые тесты и регистрации на месте (60+ тестов, smoke, navigation, флаги); прогон Playwright инвентаризацией не запускался, поэтому «зелёный» не утверждается | part-014 |
| 34 | `roo_code/plans/general/prompt-for-new-session.md` | частично | действующего долга нет: предложенный обработчик `/api/suppliers/translated` не нужен (семейство удалено), правила порядка маршрутов соблюдены; таблицы и номера строк плана описывают прошлое состояние `mocks/index.ts` | part-014 |
| 35 | `roo_code/plans/general/review-followups.md` | частично | из 22 разделов сделано 8; целиком не начаты п. 2, 2b, 4b, 4c, 4d, 4e, 4g, 7, 8, 9, 10, 11, 12, 13; частично — п. 1b (проверки отсутствия в e2e) и п. 4f (свести четыре копии условия в `REFERENCE_REQUIRED_TYPES`) | part-015 |
| 36 | `roo_code/plans/general/settings-cache-data-staleness-plan.md` | частично (скептик) | все Fix-пункты в коде (кэш, топбар из `useAuth`, скелетон и error-state в `SettingsLayout`), расхождение только в имени ключа `settings.retry`; «сделано» снято как недоказанное | part-016 |
| 37 | `roo_code/plans/general/settings-plan.md` | частично | нет табов «Пользователи», «Карта склада» (секторы) и «Шаблоны документов»; нет атомарного `getSettings/saveSettings` в сервисе; вместо `SettingsPage.vue` — `SettingsLayout.vue` с шестью дочерними роутами; `Currency.exchangeRate` отклонён осознанно | part-016 |
| 38 | `roo_code/plans/general/update-skills-clients-prompt.md` | частично | в скилах нет контрактной половины: `VALIDATION_ERROR` на POST, `CONFLICT` на DELETE, проверка «у мок-роута есть обработчик», `structuredClone` для новой мок-читалки, обратная проверка CSS-классов в Checkpoint 6, unused imports в Phase 9 | part-016 |
| 39 | `roo_code/plans/general/user-dropdown-menu-plan.md` | частично | дропдаун сделан целиком; расходится поведение logout в мок-режиме — код сессию не чистит, только редиректит (осознанно), и «Настройки» сделаны кнопкой с `router.push`, а не `<router-link>` | part-016 |
| 40 | `roo_code/plans/orders/3.1-orders-plan.md` | частично (33 чекбокса) | ссылки «Заказы» в сайдбаре и ключа `side.orders` нет (осознанно, vue-rules #21); контракт живёт в `orders/orders-backend-contract.md`, а не там, куда велел план; `/api/orders/:id/translated` в моке не зарегистрирован; питфолл #19 по фильтрам не выполнен буквально | part-017 |


# Сводка инвентаризации — раздел 02: orders, products, refactor, sales-crm, services

40 планов. Вердикт и остаток — по одной строке на план; доказательства не дублируются,
они в `roo_code/plans/general/inventory-parts/part-*.md` (номер части указан в строке).

Итог: сделано — 12, частично — 28. Из «частично» значительная доля (пачки
`refactor-prompts` и часть `single-locale-prompts`) не содержит работы: цель достигнута,
не выполнена только буква плана про параллельные `*Translated`-функции, добавлять их
значит плодить дубли. Реальный долг сосредоточен в бэкенде (заказы, товары, склад) и в
единичных фронтовых хвостах.

| План | Вердикт | Что осталось |
|---|---|---|
| `roo_code/plans/orders/3.2-order-page-shared-components.md` | частично | Фазы 1–9 в коде; вердикт «сделано» не доказан — чекбоксов в плане нет вовсе, счётчик нулевой по этой причине. Хвосты: `.client-pagination` вместо пропа `:compact` на `OrderCreatePage:322`, неимпортируемый `_inline-edit.css`, ручные прогоны. (part-018) |
| `roo_code/plans/orders/3.3-order-returns-plan.md` | частично | Нет i18n-ключа `line_returned_partial`; ключ ошибки назван `error_return_quantity_positive` вместо планового; write-back в `orders-backend-contract.md` (Prompt 7) не сделан; 3 из 10 тестов Prompt 15 — закрытие модалки по оверлею, переключение RU/EN/LT на карточке с возвратом, снапшот панели. (part-019) |
| `roo_code/plans/orders/currency-fix-and-fifo-plan.md` | частично | Вся Phase C — 5 пунктов: `currency_id` у Order/OrderItem, колонка валюты у складского движения и у связи товар-поставщик, эндпоинт FIFO-расчёта; бэкенда заказов не существует. Плюс хвост B5: показать валюту движения в списке и карточке движения (в типе и моке она есть). (part-020) |
| `roo_code/plans/orders/order-pricing-frontend-plan.md` | сделано | Ничего. Всё незакрытое план сам вынес за свои границы: бэкенд заказов, серверная фильтрация под `seeCost`, канбан, PDF, бухгалтерия. (part-021) |
| `roo_code/plans/orders/order-pricing-model.md` | частично | Бэкенда заказов нет вовсе — «авторитет сервер» из §15 держится на TS-моке; настоящее право `seeCost` (сервер не отдаёт себестоимость и присылает готовые цены) не реализовано; нехватка товара не создаёт запись дефицита из заказа — `WarehouseDeficit` заполняется только вручную со склада. (part-022) |
| `roo_code/plans/orders/orders-backend-contract.md` | частично | Весь бэкенд: модуль `orders`, модели и миграции, ~34 эндпоинта, `If-Match`, идемпотентность, FIFO-раскладка и снятие удержания теми же партиями, каталог ошибок §6, `/api/sales-crm/stats`, серверные права, порт `orderPricing.ts`. На фронте — режим §5.2: не считать цены локально и отключить правки от себестоимости для роли без `seeCost`. (part-023) |
| `roo_code/plans/orders/pricing-section-rework-plan.md` | частично | Открыт только раздел 1 (`field_price` → `field_purchase_price` + подсказка о закупке). Он конфликтует с кодом: `field_price` осознанно стал продажной ценой по умолчанию, закупочная сторона — `field_supplier_price` / `field_avg_cost_price`. Раздел 1 стоит закрыть как устаревший наравне с 2–4, а не исполнять буквально. (part-024) |
| `roo_code/plans/plans-multi-role-migration-plan.md` | частично | Все 6 моделей и миграция есть; Step 3 невыполним в текущем окружении: БД `flexiron` не существует, Python-зависимости не установлены, `alembic upgrade head` не применялся и упадёт на двух головах (`15f2c7d4e9b0` / `a1b2c3d4e5f6`). Плюс реестр отстал: 46 ключей в миграции против 52 флагов фронтенда, и форма колонок — JSONB-переводы, а не `name_ru/en/lt` из текста. (part-025) |
| `roo_code/plans/products/01-products-plan.md` | частично | Поставка сделана и переросла план. Из 32 пунктов открыты три питфолла Промпта 14: фильтры вынесены из `GlassPanel` в общий `filters-bar` (конвенция сменилась), мок не клонирует — `mockGetProduct` возвращает объект стора напрямую, 7 HTML-комментариев внутри `<template>` в `ProductCardPage.vue`. Плюс ручной browser golden path. (part-026) |
| `roo_code/plans/products/fix-products-null-items-bug.md` | сделано | Ничего; две правки сильнее плана — «переводные» функции не перенаправлены, а удалены. (part-027) |
| `roo_code/plans/products/products-api-contract-analysis.md` | частично | Контракт и фронт закрыты целиком. На бэкенде есть только `POST /api/products` и `GET /api/products/{id}`: нет GET-списка (а значит ни `search`, ни `categoryIds`, ни `sortBy/sortDir`, ни `PaginatedResponse`), нет PATCH и DELETE с `409 PRODUCT_IN_USE`; wire format snake_case и `str` вместо `TranslatedString`, в ответе detail нет `linkedSuppliers` и `categoryName`. (part-027) |
| `roo_code/plans/products/product-uom-restructure-plan.md` | частично | Шаг 4 не начат — у модуля `warehouse` нет ни одного слайса, эндпоинта создания партии с конвертацией и записью аудита не существует. Шаг 3 недоделан: дефолт `sale_uom_id` по первой единице категории `quantity` отсутствует, при пустом входе все три UoM остаются `None`. Шаг 10: решение по legacy `priceUnit` (жив сознательно) и по хардкоду `['kg','m','piece','ton']` в `BccRequestPage.vue:328`. (part-027) |
| `roo_code/plans/products/uom-restructure-completion-plan.md` | частично | Шаг 3 целиком: `warehouseQty = saleQty / warehouseToSaleFactor` при расходном движении, привязка движения к id заказа, поля конвертации в `MovementCreatePayload`. Шаг 4: `sellingPricePerSaleUoM` и отображение цены продажи за единицу продажи. Шаг 5: списочный `GET /api/products` — эндпоинта нет, проверять нечего. (part-028) |
| `roo_code/plans/refactor/refactor-client-card-page.md` | сделано | Ничего. Единственное расхождение — класс назван `client-card-header-row` вместо `product-card-header-row`; правила под него в CSS есть. (part-029) |
| `roo_code/plans/refactor/refactor-server-side-filtering-pagination.md` | сделано | Ничего — все 6 шагов вкладки Stock выполнены. (part-029) |
| `roo_code/plans/refactor/refactor-server-translations-analytics.md` | сделано | Ничего по объёму плана («только страницы аналитики»). (part-029) |
| `roo_code/plans/refactor/single-locale-save-refactor.md` | частично | Пункты 5.2 и 5.4: `createSection` в `configService.ts:54` без `locale` и `toTranslatedString`, `mockCreateSection` (`mocks/config.ts:306-309`) заполняет все три языка одной строкой — ровно тот антипаттерн, против которого план. Плюс два мёртвых алиаса `/api/clients/translated` и `/api/orders/translated` (`mocks/index.ts:470,534`) и хвост в `BccRequestPage.vue:308`. Фазы 4.2/4.3 (build, playwright) не воспроизводились. (part-030) |
| `roo_code/plans/refactor/translation-refactor-audit-plan.md` | сделано | Ничего — все 6 починок на месте, `vue-tsc` чист; `npm run build` не запускался. (part-030) |
| `roo_code/plans/refactor/refactor-prompts/01-products-page.md` | частично | Содержание достигнуто; «0 незакрытых чекбоксов» ничего не доказывает — чекбоксов в файле нет вовсе. Не выполнено буквальное требование «добавить `*Translated` рядом, старое НЕ удаляем»: миграция сделана на месте. Работы не осталось — дубли добавлять не нужно. (part-031) |
| `roo_code/plans/refactor/refactor-prompts/02-product-card-page.md` | частично | То же: доказательство вакуумно (чекбоксов нет), §5 `getProductTranslated()` и §6 `useProductCardTranslated()` не выполнены — вместо них переведены на месте `getProduct()` и `useProductCard()`. Исполнять не нужно. (part-031) |
| `roo_code/plans/refactor/refactor-prompts/03-categories-page.md` | частично | То же: отдельных `getCategoriesTranslated()` / `useCategoriesTranslated()` нет, миграция на месте, композабл вдобавок получил пагинацию. Работы не осталось. (part-031) |
| `roo_code/plans/refactor/refactor-prompts/04-category-card-page.md` | частично | Цель достигнута (`types/category.ts` целиком на `TranslatedString`). Нет `getCategoryTranslated()` и `useCategoryCardTranslated()` — переведены `getCategory()` и `useCategoryCard()`; добавлять не нужно. (part-032) |
| `roo_code/plans/refactor/refactor-prompts/05-bcc-request-page.md` | частично | Цель достигнута. Нет `getBccCategoriesTranslated()` / `getBccRecipientsTranslated()` / `getBccHistoryTranslated()` и `useBccRequestTranslated()` — работают переведённые на месте оригиналы. Работы не осталось. (part-032) |
| `roo_code/plans/refactor/refactor-prompts/06-supplier-card-page.md` | частично | Цель достигнута. Нет `getSupplierTranslated()` / `useSupplierCardTranslated()`; скелетон сделан по панелям, а не одной `GlassPanel :loading` — задачу «показать загрузку и ошибку» закрывает. (part-032) |
| `roo_code/plans/refactor/refactor-prompts/07-supplier-card-config-page.md` | частично | Цель достигнута; счётчик чекбоксов вакуумен — их в файле нет. Не добавлены п.3 (`getFieldLibraryTranslated` / `getSectionsTranslated` / `getPermissionsTranslated`) и п.4 (`useCardConfigTranslated`): существующие функции и так возвращают `TranslatedString`. Работы не требует. (part-033) |
| `roo_code/plans/refactor/refactor-prompts/08-supplier-create-page.md` | частично | Единственный настоящий остаток по пачке: п.5 реализован Вариантом A — один инпут через computed-прокси в текущую локаль (`SupplierFormSections.vue:21-41`), группы RU/EN/LT нет, то есть перевод на другой язык через форму ввести нельзя. Пункты 3/4/6 (`*Translated`) не нужны. (part-033) |
| `roo_code/plans/refactor/refactor-prompts/09-suppliers-list-page.md` | частично | Цель достигнута, доказательство «0 чекбоксов» вакуумно. `getSuppliersTranslated()` / `useSuppliersTranslated()` не нужны. Мелкие расхождения без работы: CSV отдаёт текущую локаль вместо `company.en ?? company.ru`, фильтр рейтинга в моке — точное совпадение вместо `>=`. (part-033) |
| `roo_code/plans/refactor/single-locale-prompts/01-phase1-infrastructure.md` | сделано | Ничего. Микро-расхождение без работы: фильтр в `mergeTranslatedString` — `v !== undefined`, план просил ещё и `!== null`; все примеры Verification дают ожидаемый результат. (part-034) |
| `roo_code/plans/refactor/single-locale-prompts/02-domain-categories.md` | частично | Вердикт «сделано» снят скептиком: показано наличие вызовов `toTranslatedString`, но не их срабатывание, и не все требования плана закрыты. Разбор и выкладки — part-034; работы по коду из них не выведено, нужен перепроверенный прогон. (part-034) |
| `roo_code/plans/refactor/single-locale-prompts/03-domain-products.md` | частично | Пункт 2b: `mockPatchProduct` заменяет `fieldValues` и `linkedSuppliers` целиком и присваивает `description` без `mergeTranslatedString` — при однолокальном PATCH остальные языки `fieldName`, `options[]`, `linkedSuppliers[].name` и описания теряются. (part-034) |
| `roo_code/plans/refactor/single-locale-prompts/04-domain-suppliers.md` | частично | Вложенные массивы из §1a/§1b/§2b не оборачиваются ни в сервисе, ни в моке. Поправка к плану: половины перечисленных полей в типах просто нет; реально пишется UI только `files[].name` (сейчас через `mergeLocaleValue` во вьюхе). Либо дописать обёртку и слияние для него (и при надобности `contacts[].name|role`), либо переписать список полей плана под настоящие типы. (part-034) |
| `roo_code/plans/refactor/single-locale-prompts/05-domain-bcc.md` | сделано | Ничего. (part-034) |
| `roo_code/plans/refactor/single-locale-prompts/06-domain-config.md` | частично | `createSection` без `locale` и `mockCreateSection` с тройным заполнением. Плюс расхождение формы: `useCardConfig` не вызывает `createField/patchField/createSection/patchSection` вовсе — живой путь батч-PUT уже пишет одну локаль, а четыре сервисные функции мертвы. Решение: привести к правилу или удалить осознанно. (part-034) |
| `roo_code/plans/refactor/single-locale-prompts/07-domain-analytics.md` | сделано | Ничего — план проверочный, все его условия выполнены. (part-035) |
| `roo_code/plans/refactor/single-locale-prompts/08-phase3-global-cleanup.md` | частично | Пункт 2 не соответствует букве: `/translated`-роутов в моке нет вовсе (удалять нечего), но живы два мёртвых алиаса `/api/clients/translated` и `/api/orders/translated` (`mocks/index.ts:470,534`). Либо вычистить их, либо переписать пункт под фактические plain-эндпоинты. (part-035) |
| `roo_code/plans/refactor/single-locale-prompts/09-phase4-verification.md` | частично | Полный Playwright не прогонялся — только выборка (categories.spec.ts, 45 passed), и дерево стоит на ветке с массовой переписью спеков, так что зелёный набор нужно подтверждать заново. Ручной чеклист из 10 пунктов не покрыт ничем: нужен автотест на однолокальный payload (create → только текущий язык, patch → склейка в моке, чтение при пустой локали → фолбэк). (part-035) |
| `roo_code/plans/sales-crm/01-sales-crm-initial-plan.md` | частично | Инфраструктура и 8 из 9 пунктов чек-листа есть. Проектное решение плана устарело: посадочная страница с двумя карточками заменена дашбордом, пункт «карточка Заказы = placeholder» отменён построенным разделом заказов. Остаток — мусор в i18n: `clients_link`, `clients_desc`, `orders_link`, `orders_desc` никем не используются, `orders_coming_soon` нет. (part-036) |
| `roo_code/plans/sales-crm/add-client-auditlog-mock-data.md` | сделано | Ничего — все восемь шагов, местами шире плана. (part-036) |
| `roo_code/plans/sales-crm/create-client-page.md` | сделано | Ничего. Порядок маршрутов `clients/new` до `clients/:id` соблюдён, все 16 test id на месте, валидация шире плана. (part-036) |
| `roo_code/plans/services/fix-service-card-translations.md` | сделано | Ничего — все три правки в коде. (part-037) |


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


# Сводка инвентаризации — раздел 05: `roo_code/plans/warehouse` (page/phase2/phase3)

Три плана, по одной строке каждый. Подробности и доказательства — в
[`part-057.md`](part-057.md) (план страницы) и [`part-058.md`](part-058.md)
(phase2-bugs, phase3-execution).

| Путь | Вердикт | Незакрытых чекбоксов | Что осталось |
|---|---|---|---|
| `roo_code/plans/warehouse/warehouse-page-plan.md` | частично | 0 | Реализовано почти всё и заметно шире плана (5 вкладок, 11 карточек/страниц, экспорт CSV, карта склада, резка, audit-эндпоинты, 45+ e2e). Нет: модалки/печати QR (флаг `warehouseQrPrint` мёртв), двух подвкладок дефицита, `GET /api/warehouse/locations`; флаги `warehouseOffcuts`/`warehouseDeficit` объявлены и не читаются; часть имён файлов и функций плана не совпадает с реализацией (страницы вместо модалок). Подробнее — [`part-057.md`](part-057.md). |
| `roo_code/plans/warehouse/warehouse-phase2-bugs.md` | частично | 0 | *Скептик опроверг вердикт «сделано».* Доказательство ничего не доказывает: в файле 0 незакрытых чекбоксов, но и 0 закрытых — это отчёт из 40 пунктов прозой (Problem/Fix), поэтому счёт по чекбоксам к нему неприменим. Осталось: перепроверить все 40 пунктов пунктно, а не выборочно. Подробнее — [`part-058.md`](part-058.md) §1. |
| `roo_code/plans/warehouse/warehouse-phase3-execution-plan.md` | частично | 2 (заглушки шаблона промпта) | Это инструкция «как вести новый чат» по фазам 3–6 плюс список «что НЕ сделано», который устарел целиком. Есть: фаза 3 полностью (`useWarehouseBatch.ts`, `WarehouseBatchCard.vue`, роут `warehouse/batches/:id`), фазы 4–5 — в другой форме (страницы создания вместо модалок, обрезки и дефицит внутри `useWarehouse.ts`), фаза 6 сделана (46 тестов). Осталось: не работа, а сам файл — переписать или закрыть, чтобы устаревший список не читали как задание. Подробнее — [`part-058.md`](part-058.md) §2. |
