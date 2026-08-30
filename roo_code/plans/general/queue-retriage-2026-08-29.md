# Пересортировка очереди — 2026-08-29

Очередь из [inventory-2026-08-26.md](../archive/2026-08/roo_code/general/inventory-2026-08-26.md) считала 100 задач. Тридцать
из них задачами не были. Ниже — что вынуто и на каком основании. Файлы не удалены,
кроме отдельно оговорённого. Осталось в [implementation-queue.md](implementation-queue.md) — **70**.


> **Метод.** Проверялось не «сколько чекбоксов», а конкретное утверждение инвентаризации
> об остатке — грепом в коде. Где вердикт унаследован без перепроверки, это сказано прямо.


---

## 1. Опровергнуто проверкой — работа есть (5)

Инвентаризация заявила остаток, которого в коде нет.


| План | Заявленный остаток | Что в коде на самом деле |
|---|---|---|
| `warehouse/add-batch-status-tooltip.md` | нет обёртки `span.batch-status-wrapper` с `data-test` и ещё одного требования плана | `batch-status-wrapper` есть: `WarehouseBatchCard.vue:404`, `WarehouseMovementCard.vue:182`, правило в `warehouse_list.css:555` |
| `warehouse/add-batches-tab-tooltips.md` | ключи и подсказки у восьми колонок из девяти | 42 различных ключа `col_*_hint` в `i18n/admin/warehouse.ts`, а не «восемь колонок из девяти» |
| `warehouse/add-movements-filters.md` | есть всё, кроме фильтра по категории в моке | фильтр по категории есть и в UI (`warehouse-movements-category-filter`), и в моке (`categoryId`, 11 вхождений) |
| `warehouse/add-offcuts-remaining-filters.md` | из трёх фильтров в UI два; категория множественная вместо одиночной | в UI пять фильтров обрезков (status, unit, type, category, batch), а не «два из трёх» — `WarehousePage.vue:1081–1120` |
| `warehouse/verify-warehouse-server-side-filtering.md` | доказана только половина: что `sortBy` уходит; обработка на стороне мока не проверена | `sortBy` обрабатывается в `mocks/warehouse.ts` — 42 вхождения, не «половина доказана» |

## 2. Сделано иначе (1)


| План | Заявленный остаток | Почему снят |
|---|---|---|
| `warehouse/phase3-subtask1-useWarehouseBatch.md` | нет поля формы `location: string | плоского `location: string` нет и не будет: форма хранит `locationRack/locationRow/locationCell/locationNotes` (`useWarehouseBatch.ts:42–45`). Структура выбрана вместо строки |

## 3. Не задача реализации (18)

Живые документы, справочники, контракты, промпты, разовые миграции. Они не «не сделаны» —
их нечего делать. Файлы остаются на местах, из счёта работы вынуты.


| Файл | Что это |
|---|---|
| `api/api-endpoints-list.md` | справочник эндпоинтов; его «вторая половина» описывает мёртвый `resolveLabel` |
| `archive/2026-08/review-followups.md` | уже в архиве с 2026-08-28 — очередь считала его дважды |
| `bugs/clients-api-contract-analysis.md` | аналитическая записка |
| `categories/02-categories-checkpoint0.md` | чекпоинт согласования, не поставка |
| `general/autonomous-run-policy-plan.md` | действующая политика прогонов, ROO.md ссылается на неё как на живую |
| `general/convert-claude-md-to-roo-code.md` | разовая миграция, состоялась |
| `general/dropdown-design-options.md` | выбор варианта; Option A внедрён, остальные — отвергнутые альтернативы |
| `general/move-project-to-flexiron-enterprise.md` | разовый перенос каталога; из этого чекаута непроверяем |
| `general/mvp-roadmap.md` | дорожная карта — цель, а не задача |
| `general/phase10-clients-prompt.md` | промпт, не поставка |
| `general/prompt-for-new-session.md` | промпт, не поставка |
| `general/update-skills-clients-prompt.md` | промпт, не поставка |
| `orders/order-pricing-model.md` | модель ценообразования — документ |
| `orders/orders-backend-contract.md` | действующий контракт домена — источник истины, а не задача |
| `products/products-api-contract-analysis.md` | аналитическая записка |
| `suppliers/suppliers-api-contract-analysis.md` | аналитическая записка |
| `warehouse/warehouse-full-inventory.md` | описательная инвентаризация склада |
| `warehouse/warehouse-phase3-execution-plan.md` | по вердикту сам остаток — «файл с устаревшим списком» |

## 4. Бэкенд-трек — отдельный счёт (6)

Работа настоящая, но это не фронтовая очередь: у проекта десять модулей и восемь
вертикальных слайсов, модуля `orders` нет вовсе. Мешать её с UI-задачами — врать об обеих.


| План | Что осталось |
|---|---|
| `auth/auth-secret-link-plan.md` | magic link не заводит сессию, фронт редиректит на `/login`, нет ветки `VITE_USE_MOCKS` |
| `backend/backend-db-schema-alembic-plan.md` | нет таблиц `category_linked_suppliers` и `product_linked_suppliers`; переводы в JSONB, а не тройками колонок |
| `backend/backend-refactor-modular-monolith-plan.md` | подтверждены только фазы 1–3; роутеры, `internal_api` и разрыв прямых импортов не проверены |
| `backend/i18n-db-refactoring-plan.md` | GIN-индексы на JSONB-колонках не созданы ни в одной миграции |
| `plans-multi-role-migration-plan.md` | модели и связи есть, 3 чекбокса не закрыты |
| `warehouse/verify-batch-card-api-readiness.md` | фронтенд-слой готов как заявлено, серверной проверки нет |

---

## Что осталось непроверенным

Из 70 оставшихся сегодня перепроверены единицы. Остальные несут вердикт инвентаризации
как есть, а он ошибался в обе стороны:


- **завышал остаток** — пять планов раздела 1 числились незакрытыми, хотя работа в коде есть;
- **занижал остаток** — так я написал 2026-08-29 про `warehouse/refactor-warehouse-mock-data.md`,
  и это **было моей ошибкой**: разделение на пять файлов выполнено, сид лежит в `src/mocks/`,
  а я искал в `src/services/mocks/`. Инвентаризация тут права (проверено 2026-08-30);
- **был прав там, где я усомнился** — GIN-индексов в миграциях правда нет, `SalesCrmPage.vue`
  правда нет. Мои опровержения оказались ложными срабатываниями грепа: `ori`**`gin`**`al_name`
  вместо индекса и страницы клиентов вместо страницы CRM.


Отсюда правило: вердикт по каждой из 70 подтверждать перед тем, как брать в работу —
ровно как предписывает [autonomous-run-policy-plan.md](autonomous-run-policy-plan.md), раздел 2:
задача начинается с воспроизведения остатка; не воспроизвёлся — закрывается как устаревшая.
