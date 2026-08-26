# Очередь реализации — из инвентаризации 2026-08-26

Источник: [inventory-2026-08-26.md](inventory-2026-08-26.md). Задач **113** («частично» и «не начато»); 48 планов закрыты вердиктом «сделано» и сюда не входят.

**Как читать.** «Частично» не значит «сделать план целиком» — остаток перечислен в столбце «Что осталось» и подробно в части прогона. Задача начинается с воспроизведения: остаток проверяется в коде, не воспроизвёлся — задача закрывается как устаревшая (см. [autonomous-run-policy-plan.md](autonomous-run-policy-plan.md), раздел 2).

**Волны.** Внутри волны задачи не делят ни одного файла — их можно гнать параллельно (одновременно работают 6 агентов). Волн 33. Файлы извлечены из текстов планов грепом по путям `src/`, `tests/`, `backend/app/` — это оценка владения, а не доказательство: план может тронуть файл, который в нём не назван.

## Волна 1 — 6 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/refactor/single-locale-save-refactor.md` | частично | Фаза 1 и домены categories/products есть; часть доменов не переведена | 33 | [`part-030.md`](inventory-parts/part-030.md) |
| `roo_code/plans/backend/backend-refactor-modular-monolith-plan.md` | частично (скептик) | подтверждены только фазы 1–3; роутеры, `internal_api` и разрыв прямых импортов не проверены | 25 | [`part-004.md`](inventory-parts/part-004.md) |
| `roo_code/plans/warehouse/fix-entity-card-links-plan.md` | частично (скептик) | файлы, роуты и ключи есть, содержание карточек не сверено | 16 | [`part-046.md`](inventory-parts/part-046.md) |
| `roo_code/plans/warehouse/phase6-subtask1-e2e-mocks.md` | частично | все 10 хелперов плюс шесть сверх плана; 7 чекбоксов | 12 | [`part-053.md`](inventory-parts/part-053.md) |
| `roo_code/plans/auth/auth-secret-link-plan.md` | частично | magic link не заводит сессию, фронт редиректит на `/login`, нет ветки `VITE_USE_MOCKS` | 11 | [`part-002.md`](inventory-parts/part-002.md) |
| `roo_code/plans/orders/order-pricing-model.md` | частично | фронтовая модель и мок-сервер есть целиком, серверной реализации нет | 5 | [`part-022.md`](inventory-parts/part-022.md) |

## Волна 2 — 6 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/orders/3.1-orders-plan.md` | частично | план объявляет себя историческим и по существу выполнен; 33 чекбокса остались неотмеченными | 30 | [`part-017.md`](inventory-parts/part-017.md) |
| `roo_code/plans/bugs/fix-toTranslatedString-merge-bug.md` | частично | слияние есть под другим именем (`mergeLocaleValue`), часть мест не переведена на него | 12 | [`part-009.md`](inventory-parts/part-009.md) |
| `roo_code/plans/warehouse/safe-cascade-deletion.md` | частично | `orderId` и блокировки есть, часть плана не закрыта | 12 | [`part-054.md`](inventory-parts/part-054.md) |
| `roo_code/plans/backend/i18n-db-refactoring-plan.md` | частично | GIN-индексы на JSONB-колонках не созданы ни в одной миграции | 9 | [`part-004.md`](inventory-parts/part-004.md) |
| `roo_code/plans/backend/backend-db-schema-alembic-plan.md` | частично | нет таблиц `category_linked_suppliers` и `product_linked_suppliers`; переводы в JSONB, а не тройками колонок | 8 | [`part-003.md`](inventory-parts/part-003.md) |
| `roo_code/plans/general/settings-cache-data-staleness-plan.md` | частично (скептик) | чекбоксов в плане нет — «0 незакрытых» не вердикт; нужна сверка прозаических требований | 4 | [`part-016.md`](inventory-parts/part-016.md) |

## Волна 3 — 6 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/products/01-products-plan.md` | частично | поставка реализована и переросла план; 32 чекбокса не отмечены, остаток — в части | 30 | [`part-026.md`](inventory-parts/part-026.md) |
| `roo_code/plans/warehouse/update-offcut-statuses-to-match-batches.md` | частично | тип и все ключи i18n есть; 10 чекбоксов открыты | 12 | [`part-055.md`](inventory-parts/part-055.md) |
| `roo_code/plans/refactor/single-locale-prompts/04-domain-suppliers.md` | частично | три поля оборачиваются и сливаются, остальное по плану — нет | 6 | [`part-034.md`](inventory-parts/part-034.md) |
| `roo_code/plans/refactor/refactor-prompts/05-bcc-request-page.md` | частично | цель достигнута, буква про параллельные `*Translated`-функции — нет | 5 | [`part-032.md`](inventory-parts/part-032.md) |
| `roo_code/plans/refactor/refactor-prompts/07-supplier-card-config-page.md` | частично (скептик) | чекбоксов нет, `resolveLabel`/`useLabelResolver` в файле отсутствуют — сверка не проведена | 5 | [`part-033.md`](inventory-parts/part-033.md) |
| `roo_code/plans/orders/3.2-order-page-shared-components.md` | частично (скептик) | чекбоксов в плане нет вовсе — вердикт «сделано» держался на пустом счёте | 4 | [`part-018.md`](inventory-parts/part-018.md) |

## Волна 4 — 6 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/general/review-followups.md` | частично | из 22 разделов сделано 8, остальные частично или не начаты | 29 | [`part-015.md`](inventory-parts/part-015.md) |
| `roo_code/plans/sales-crm/01-sales-crm-initial-plan.md` | частично | инфраструктура (роут, флаг, типы) есть, сама страница — нет; 9 чекбоксов | 18 | [`part-036.md`](inventory-parts/part-036.md) |
| `roo_code/plans/warehouse/new-tasks-autotests-plan.md` | частично | все пять шагов заведены, часть тестов не дописана | 11 | [`part-051.md`](inventory-parts/part-051.md) |
| `roo_code/plans/warehouse/phase3-subtask2-WarehouseBatchCard.md` | частично | 7 из 10 `data-test` есть; 12 чекбоксов открыты | 8 | [`part-052.md`](inventory-parts/part-052.md) |
| `roo_code/plans/refactor/refactor-prompts/03-categories-page.md` | частично (скептик) | отдельной `getCategoriesTranslated` нет — буква плана не выполнена, цель достигнута иначе | 5 | [`part-031.md`](inventory-parts/part-031.md) |
| `roo_code/plans/refactor/refactor-prompts/06-supplier-card-page.md` | частично | цель достигнута, буква про параллельные `*Translated`-функции — нет | 5 | [`part-032.md`](inventory-parts/part-032.md) |

## Волна 5 — 6 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/warehouse-page-plan.md` | частично | нет модалки/печати QR, двух подвкладок дефицита, `GET /api/warehouse/locations`; два флага мертвы | 28 | [`part-057.md`](inventory-parts/part-057.md) |
| `roo_code/plans/general/phase10-clients-prompt.md` | частично (скептик) | чекбоксов в плане нет — вердикт «сделано» был вакуумным, нужна сверка по пунктам | 10 | [`part-014.md`](inventory-parts/part-014.md) |
| `roo_code/plans/plans-multi-role-migration-plan.md` | частично | модели и связи есть, 3 чекбокса не закрыты | 5 | [`part-025.md`](inventory-parts/part-025.md) |
| `roo_code/plans/refactor/refactor-prompts/04-category-card-page.md` | частично | цель достигнута, буква про параллельные `*Translated`-функции — нет | 5 | [`part-032.md`](inventory-parts/part-032.md) |
| `roo_code/plans/refactor/single-locale-prompts/03-domain-products.md` | частично | обёртки в сервисе есть, часть требований плана не закрыта | 5 | [`part-034.md`](inventory-parts/part-034.md) |
| `roo_code/plans/general/move-project-to-flexiron-enterprise.md` | частично | перенос каталога Windows из этого чекаута не проверяем; косметика (шаг 7) сделана | 3 | [`part-013.md`](inventory-parts/part-013.md) |

## Волна 6 — 6 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/orders/3.3-order-returns-plan.md` | частично | реализовано почти всё; остаток перечислен в части | 24 | [`part-019.md`](inventory-parts/part-019.md) |
| `roo_code/plans/warehouse/phase5-subtask2-improve-tabs.md` | частично | бейджи, размеры и быстрые действия есть; 12 чекбоксов открыты | 9 | [`part-053.md`](inventory-parts/part-053.md) |
| `roo_code/plans/refactor/refactor-prompts/02-product-card-page.md` | частично (скептик) | не выполнены §5 и §6 плана; доказательство было вакуумным | 7 | [`part-031.md`](inventory-parts/part-031.md) |
| `roo_code/plans/warehouse/refactor-warehouse-mock-data.md` | частично | разделение на пять файлов выполнено, часть плана — нет | 7 | [`part-053.md`](inventory-parts/part-053.md) |
| `roo_code/plans/refactor/single-locale-prompts/06-domain-config.md` | частично | поля `name` оборачиваются и сливаются, часть требований не закрыта | 4 | [`part-034.md`](inventory-parts/part-034.md) |
| `roo_code/plans/general/update-skills-clients-prompt.md` | частично | CSS/i18n/imports-половина внесена в скилы, вторая половина — нет | 3 | [`part-016.md`](inventory-parts/part-016.md) |

## Волна 7 — 6 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/services/services-page-plan.md` | частично (скептик) | план из 10 промптов не сверён по пунктам — ни `- [ ]`, ни `- [x]` в файле | 22 | [`part-038.md`](inventory-parts/part-038.md) |
| `roo_code/plans/warehouse/phase4-subtask1-CreateBatchModal.md` | частично | модалки нет — приход реализован отдельной страницей; 8 чекбоксов | 10 | [`part-052.md`](inventory-parts/part-052.md) |
| `roo_code/plans/refactor/single-locale-prompts/02-domain-categories.md` | частично (скептик) | вызовы `toTranslatedString` есть, но требования плана не выполнены — нужна проверка срабатывания | 5 | [`part-034.md`](inventory-parts/part-034.md) |
| `roo_code/plans/warehouse/fix-offcut-movement-deficit-not-found.md` | частично | шаг 2 сделан целиком, остальные шаги — нет | 5 | [`part-048.md`](inventory-parts/part-048.md) |
| `roo_code/plans/orders/orders-backend-contract.md` | частично | клиентская половина контракта сделана целиком, серверной нет вовсе | 3 | [`part-023.md`](inventory-parts/part-023.md) |
| `roo_code/plans/bugs/fix-structuredClone-v2.md` | частично (скептик) | пункты 1–3 есть, остаток плана не выполнен | 2 | [`part-009.md`](inventory-parts/part-009.md) |

## Волна 8 — 6 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/bugs/static-analysis-debt-bugs.md` | частично | из девяти записей закрыта часть; статус несёт таблица в конце файла | 17 | [`part-011.md`](inventory-parts/part-011.md) |
| `roo_code/plans/services/service-card-page-plan.md` | частично (скептик) | вердикт держался на счёте чекбоксов, которых нет; визуальных тестов в спеке нет | 14 | [`part-037.md`](inventory-parts/part-037.md) |
| `roo_code/plans/products/uom-restructure-completion-plan.md` | частично | шаги 1, 2 и почти весь 5 сделаны; 23 чекбокса открыты | 11 | [`part-028.md`](inventory-parts/part-028.md) |
| `roo_code/plans/bugs/settings-notifications-bugs.md` | частично | три бага с разделом «Fix» закрыты, остальные записи без починки | 6 | [`part-010.md`](inventory-parts/part-010.md) |
| `roo_code/plans/warehouse/stock-card-restructure-plan.md` | частично (скептик) | перестройка шаблона есть, остальные требования плана не доказаны | 4 | [`part-054.md`](inventory-parts/part-054.md) |
| `roo_code/plans/warehouse/add-action-buttons-to-warehouse-tabs.md` | частично | тулбар и экспорт есть, часть кнопок плана — нет | 3 | [`part-040.md`](inventory-parts/part-040.md) |

## Волна 9 — 6 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/refactor/single-locale-prompts/08-phase3-global-cleanup.md` | частично | пункты 1, 3, 4 сделаны; GET-роуты мока не соответствуют букве плана | 17 | [`part-035.md`](inventory-parts/part-035.md) |
| `roo_code/plans/warehouse/phase6-subtask2-e2e-spec.md` | частично | спек на ~50 тестов есть; 8 чекбоксов открыты | 10 | [`part-053.md`](inventory-parts/part-053.md) |
| `roo_code/plans/warehouse/add-batch-card-currency-selector.md` | частично | тип, форма и композабл есть, часть плана не закрыта | 9 | [`part-040.md`](inventory-parts/part-040.md) |
| `roo_code/plans/orders/pricing-section-rework-plan.md` | частично | разделы 2–4 устарели по существу; раздел 1 (переименования) не выполнен | 7 | [`part-024.md`](inventory-parts/part-024.md) |
| `roo_code/plans/warehouse/add-movement-type-hints-in-dropdown.md` | частично (скептик) | правила `.option-hint { font-size: 11px }` в `_custom-select.css` нет | 3 | [`part-042.md`](inventory-parts/part-042.md) |
| `roo_code/plans/categories/02-categories-checkpoint0.md` | частично (скептик) | в плане нет ни одного чекбокса — счёт «0 незакрытых» ничего не доказывал, нужна пофункциональная сверка | 2 | [`part-012.md`](inventory-parts/part-012.md) |

## Волна 10 — 6 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/orders/currency-fix-and-fifo-plan.md` | частично | Phase A и B сделаны (кроме UI движения), Phase C не начата — 5 чекбоксов | 16 | [`part-020.md`](inventory-parts/part-020.md) |
| `roo_code/plans/warehouse/offcut-create-page-plan.md` | частично (скептик) | доказательство содержало ложный факт про `CreateOffcutModal` — сверка нужна заново | 8 | [`part-051.md`](inventory-parts/part-051.md) |
| `roo_code/plans/refactor/refactor-prompts/09-suppliers-list-page.md` | частично (скептик) | та же дыра: в плане ни одного чекбокса, вердикт «сделано» не обоснован | 7 | [`part-033.md`](inventory-parts/part-033.md) |
| `roo_code/plans/warehouse/fix-warehouse-table-row-padding.md` | частично (скептик) | Change 3 (responsive adjustments) — мёртвый код, план не закрыт | 2 | [`part-049.md`](inventory-parts/part-049.md) |
| `roo_code/plans/api/api-endpoints-list.md` | частично | механизма `resolveLabel()`/`labelLookup.ts` нет в коде — вторая половина плана описывает несуществующее | 0 | [`part-001.md`](inventory-parts/part-001.md) |
| `roo_code/plans/bugs/clients-api-contract-analysis.md` | частично | часть пунктов реализована в другом месте, чем требует записка; остаток — сверка по контракту | 0 | [`part-007.md`](inventory-parts/part-007.md) |

## Волна 11 — 6 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/bugs/3.1-orders-card-bugs.md` | частично (скептик) | 22 из 23 багов закрыты, один не подтверждён | 12 | [`part-006.md`](inventory-parts/part-006.md) |
| `roo_code/plans/warehouse/add-offcut-movements.md` | частично | есть всё, кроме переводов примечаний | 9 | [`part-043.md`](inventory-parts/part-043.md) |
| `roo_code/plans/bugs/fix-4-remaining-products-bugs.md` | частично | из четырёх багов закрыты не все — остаток в части | 6 | [`part-007.md`](inventory-parts/part-007.md) |
| `roo_code/plans/general/autonomous-run-policy-plan.md` | частично | цифры разделов 1–2 сходятся, часть требований политики не внедрена | 1 | [`part-013.md`](inventory-parts/part-013.md) |
| `roo_code/plans/bugs/fix-clients-delete-modal-text.md` | частично (скептик) | буквальные правки на месте, но требование сверх них не подтверждено | 0 | [`part-007.md`](inventory-parts/part-007.md) |
| `roo_code/plans/general/convert-claude-md-to-roo-code.md` | частично (скептик) | шаги 1, 3 и часть 4 выполнены, остальное не подтверждено | 0 | [`part-013.md`](inventory-parts/part-013.md) |

## Волна 12 — 6 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/warehouse-phase2-bugs.md` | частично (скептик) | отчёт из 40 пунктов прозой — проверен выборочно, нужна пунктная перепроверка | 11 | [`part-058.md`](inventory-parts/part-058.md) |
| `roo_code/plans/refactor/refactor-prompts/01-products-page.md` | частично (скептик) | чекбоксов в файле ноль — «0 незакрытых» не вердикт; §-пункты не сверены | 5 | [`part-031.md`](inventory-parts/part-031.md) |
| `roo_code/plans/general/dropdown-design-options.md` | частично | CSS Option A внедрён, часть рекомендаций варианта не реализована | 0 | [`part-013.md`](inventory-parts/part-013.md) |
| `roo_code/plans/general/mvp-roadmap.md` | частично | настройки и финансы есть, часть блоков дорожной карты не начата | 0 | [`part-014.md`](inventory-parts/part-014.md) |
| `roo_code/plans/general/settings-plan.md` | частично | нет `WarehouseSector`, часть поставки плана не закрыта | 0 | [`part-016.md`](inventory-parts/part-016.md) |
| `roo_code/plans/refactor/single-locale-prompts/09-phase4-verification.md` | частично | тайпчек и билд чисты, e2e — выборкой; ручной чеклист (10 пунктов) не покрыт | 0 | [`part-035.md`](inventory-parts/part-035.md) |

## Волна 13 — 6 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/phase3-subtask1-useWarehouseBatch.md` | частично (скептик) | нет поля формы `location: string | 9 | null` и ещё одного требования; 8 чекбоксов | [`part-052.md`](inventory-parts/part-052.md) |
| `roo_code/plans/refactor/refactor-prompts/08-supplier-create-page.md` | частично | типы и моки переведены; буква плана про отдельные функции не выполнена | 7 | [`part-033.md`](inventory-parts/part-033.md) |
| `roo_code/plans/warehouse/fix-batch-count-inconsistency.md` | частично (скептик) | две записи существуют, но соответствие цифрам плана не доказано | 4 | [`part-046.md`](inventory-parts/part-046.md) |
| `roo_code/plans/products/products-api-contract-analysis.md` | частично | все три «Changes Required» закрыты, остаток — расхождения контракта | 2 | [`part-027.md`](inventory-parts/part-027.md) |
| `roo_code/plans/bugs/fix-filter-transition-flicker.md` | частично (скептик) | шаги 1–3 сделаны, дальше плана — нет | 1 | [`part-008.md`](inventory-parts/part-008.md) |
| `roo_code/plans/warehouse/correction-behavior-refinement.md` | частично (скептик) | нет красной подсказки под полем при отрицательном значении (Problem #2) | 0 | [`part-044.md`](inventory-parts/part-044.md) |

## Волна 14 — 6 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/phase4-subtask2-CreateMovementModal.md` | частично | модалка есть, но партия приходит пропом — селектора партий и `unitPrice` нет; 10 чекбоксов | 9 | [`part-052.md`](inventory-parts/part-052.md) |
| `roo_code/plans/general/prompt-for-new-session.md` | частично | проверка выполнена и записана; часть правил порядка роутов не закрыта | 6 | [`part-014.md`](inventory-parts/part-014.md) |
| `roo_code/plans/warehouse/add-deficit-tab-sorting.md` | частично | сортировка и композабл есть, часть плана — нет | 3 | [`part-042.md`](inventory-parts/part-042.md) |
| `roo_code/plans/warehouse/fix-warehouse-phase2-bugs-remaining-tabs.md` | частично | шаги 1–4 сделаны, дальше — нет | 0 | [`part-049.md`](inventory-parts/part-049.md) |
| `roo_code/plans/warehouse/warehouse-full-inventory.md` | частично | описательная инвентаризация; расхождения с реальностью перечислены в части | 0 | [`part-056.md`](inventory-parts/part-056.md) |
| `roo_code/plans/warehouse/warehouse-phase3-execution-plan.md` | частично | фазы 3–6 сделаны в другой форме; остаток — сам файл с устаревшим списком «не сделано» | 0 | [`part-058.md`](inventory-parts/part-058.md) |

## Волна 15 — 2 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/stock-remainder-card-fix-plan.md` | частично | `useHead`, `entity-not-found`, чистка CSS сделаны; часть пунктов — нет | 9 | [`part-054.md`](inventory-parts/part-054.md) |
| `roo_code/plans/products/product-uom-restructure-plan.md` | частично | шаги 1,2,5–9 есть; остальные шаги не выполнены | 6 | [`part-027.md`](inventory-parts/part-027.md) |

## Волна 16 — 2 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/auto-create-movement-on-location-change.md` | частично | шаги 1, 3, 5 сделаны, шаги 2 и 4 — нет | 8 | [`part-043.md`](inventory-parts/part-043.md) |
| `roo_code/plans/general/user-dropdown-menu-plan.md` | частично | всё есть, включая опциональный пункт 5; остаток — мелкие расхождения с буквой | 5 | [`part-016.md`](inventory-parts/part-016.md) |

## Волна 17 — 2 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/phase4-subtask3-CreateOffcutModal.md` | частично | модалки нет — резка реализована страницей; 10 чекбоксов | 8 | [`part-052.md`](inventory-parts/part-052.md) |
| `roo_code/plans/suppliers/suppliers-api-contract-analysis.md` | частично | аналитическая записка: пять критических уточнений закрыты, остаток — серверная часть | 5 | [`part-039.md`](inventory-parts/part-039.md) |

## Волна 18 — 1 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/stock-remainder-card-plan.md` | частично | нет кнопки retry в состоянии ошибки и отдельной кнопки; 9 чекбоксов | 8 | [`part-054.md`](inventory-parts/part-054.md) |

## Волна 19 — 2 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/add-batch-mock-files.md` | частично (скептик) | количество файлов сходится, тип каждого документа — нет (расхождение в трёх местах) | 7 | [`part-041.md`](inventory-parts/part-041.md) |
| `roo_code/plans/warehouse/fix-offcuts-type-column.md` | частично | все шесть файловых правок есть; 10 чекбоксов открыты | 3 | [`part-048.md`](inventory-parts/part-048.md) |

## Волна 20 — 1 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/add-offcuts-remaining-filters.md` | частично | из трёх фильтров в UI два; категория множественная вместо одиночной | 7 | [`part-043.md`](inventory-parts/part-043.md) |

## Волна 21 — 1 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/offcut-movements-plan.md` | частично | цель достигнута шире плана, но ни одна правка не там, куда план её адресовал; 16 чекбоксов | 7 | [`part-051.md`](inventory-parts/part-051.md) |

## Волна 22 — 2 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/phase5-subtask1-useWarehouseOffcutsAndDeficit.md` | частично | обоих композаблов нет, логика в `useWarehouse.ts`; 5 чекбоксов | 7 | [`part-053.md`](inventory-parts/part-053.md) |
| `roo_code/plans/warehouse/verify-warehouse-server-side-filtering.md` | частично (скептик) | доказана только половина: что `sortBy` уходит; обработка на стороне мока не проверена | 3 | [`part-055.md`](inventory-parts/part-055.md) |

## Волна 23 — 2 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/warehouse-expandable-rows-plan.md` | не начато | нет ничего: ни `ExpandableTable.vue`, ни состояния expand, ни типов, ни полей | 7 | [`part-056.md`](inventory-parts/part-056.md) |
| `roo_code/plans/warehouse/auto-create-movement-on-offcut-location-change.md` | частично | шаг 1 перевыполнен, остальные шаги не закрыты | 5 | [`part-043.md`](inventory-parts/part-043.md) |

## Волна 24 — 2 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/add-movements-filters.md` | частично | есть всё, кроме фильтра по категории в моке | 6 | [`part-042.md`](inventory-parts/part-042.md) |
| `roo_code/plans/warehouse/add-batch-status-tooltip.md` | частично (скептик) | нет обёртки `span.batch-status-wrapper` с `data-test` и ещё одного требования плана | 4 | [`part-041.md`](inventory-parts/part-041.md) |

## Волна 25 — 2 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/extract-offcut-location-section.md` | частично (скептик) | шаблон и форма есть, Edge Case 3 (пустые rack/row/cell) не обработан | 6 | [`part-045.md`](inventory-parts/part-045.md) |
| `roo_code/plans/warehouse/fix-warehouse-stock-delete-mock.md` | не начато | ни одной из трёх правок нет; премисса плана под вопросом (см. `remove-stock-deletion`) | 6 | [`part-049.md`](inventory-parts/part-049.md) |

## Волна 26 — 1 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/fix-export-functionality.md` | частично | обвязка экспорта есть целиком, часть плана — нет | 6 | [`part-047.md`](inventory-parts/part-047.md) |

## Волна 27 — 1 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/generalize-offcuts-for-all-categories.md` | частично | шаги 1 и 3 есть, остальные — нет | 6 | [`part-049.md`](inventory-parts/part-049.md) |

## Волна 28 — 1 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/phase4-subtask4-useWarehouseMovement.md` | частично | файла `useWarehouseMovement.ts` нет, логика внутри модалки; 5 чекбоксов | 6 | [`part-053.md`](inventory-parts/part-053.md) |

## Волна 29 — 1 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/remove-stock-deletion.md` | частично (скептик) | удаление вырезано, но нарушено ограничение области плана (лишний коммит) | 6 | [`part-054.md`](inventory-parts/part-054.md) |

## Волна 30 — 1 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/extract-batch-location-section.md` | частично (скептик) | секция и i18n на месте, но Edge Case плана не обработан | 5 | [`part-045.md`](inventory-parts/part-045.md) |

## Волна 31 — 2 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/enhance-movement-modal-with-batch-summary.md` | частично | размер, пропсы и секция сводки есть, часть плана — нет | 4 | [`part-044.md`](inventory-parts/part-044.md) |
| `roo_code/plans/warehouse/add-batch-auditlog-mock-data.md` | частично (скептик) | 12 блоков `auditLog` есть, но с таблицей плана не сходятся — типы записей другие | 3 | [`part-040.md`](inventory-parts/part-040.md) |

## Волна 32 — 1 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/implement-batch-card-write-off.md` | частично | ни одной из трёх правок плана нет — ключи `write_off_*` в коде отсутствуют | 3 | [`part-050.md`](inventory-parts/part-050.md) |

## Волна 33 — 2 задач

| План | Вердикт | Что осталось | Файлов | Подробности |
|---|---|---|---|---|
| `roo_code/plans/warehouse/verify-batch-card-api-readiness.md` | частично | фронтенд-слой готов как заявлено, серверной проверки нет | 3 | [`part-055.md`](inventory-parts/part-055.md) |
| `roo_code/plans/warehouse/add-batches-tab-tooltips.md` | частично | ключи и подсказки у восьми колонок из девяти | 2 | [`part-041.md`](inventory-parts/part-041.md) |

## Задачи, у которых файлы не распознаны

Владение файлами неизвестно — гнать их последовательно, не параллельно.

- `roo_code/plans/api/api-endpoints-list.md` — механизма `resolveLabel()`/`labelLookup.ts` нет в коде — вторая половина плана описывает несуществующее
- `roo_code/plans/bugs/clients-api-contract-analysis.md` — часть пунктов реализована в другом месте, чем требует записка; остаток — сверка по контракту
- `roo_code/plans/bugs/fix-clients-delete-modal-text.md` — буквальные правки на месте, но требование сверх них не подтверждено
- `roo_code/plans/general/convert-claude-md-to-roo-code.md` — шаги 1, 3 и часть 4 выполнены, остальное не подтверждено
- `roo_code/plans/general/dropdown-design-options.md` — CSS Option A внедрён, часть рекомендаций варианта не реализована
- `roo_code/plans/general/mvp-roadmap.md` — настройки и финансы есть, часть блоков дорожной карты не начата
- `roo_code/plans/general/settings-plan.md` — нет `WarehouseSector`, часть поставки плана не закрыта
- `roo_code/plans/refactor/single-locale-prompts/09-phase4-verification.md` — тайпчек и билд чисты, e2e — выборкой; ручной чеклист (10 пунктов) не покрыт
- `roo_code/plans/warehouse/correction-behavior-refinement.md` — нет красной подсказки под полем при отрицательном значении (Problem #2)
- `roo_code/plans/warehouse/fix-warehouse-phase2-bugs-remaining-tabs.md` — шаги 1–4 сделаны, дальше — нет
- `roo_code/plans/warehouse/warehouse-full-inventory.md` — описательная инвентаризация; расхождения с реальностью перечислены в части
- `roo_code/plans/warehouse/warehouse-phase3-execution-plan.md` — фазы 3–6 сделаны в другой форме; остаток — сам файл с устаревшим списком «не сделано»
