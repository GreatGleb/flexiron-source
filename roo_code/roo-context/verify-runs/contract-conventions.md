# Цикл проверок — задача 19, `00-conventions.md`

Домен: общие соглашения (файл `roo_code/roo-context/api/00-conventions.md`). Скил —
[`api-contract.md`](../../skills/api-contract.md), задача 19 плана
[`contract-sync-plan.md`](../../plans/api/contract-sync-plan.md).

Текст соглашений написан коммитом `82e0d3d` по семнадцати аудитам. Этот проход — вход
следующей итерации того же цикла: резолвер ссылок появился в проекте **после** написания
(`d62498f`, `src/services/contractRefs.ts`), то есть линза К7 на этом файле не проходилась
ни разу.

## Итерация 1

**Машинная приёмка.** `cd frontend_vue && npm run verify` — зелёная (EXIT=0): typecheck, lint,
dupes, format:check, 39 файлов спек, 794 теста.

**К7 — резолвер ссылок.** Чем проверял:

```bash
cd frontend_vue && CONTRACT_REFS=roo_code/roo-context/api/00-conventions.md \
  npx vitest run src/services/contractRefs.spec.ts
```

Что вернулось: `ссылок 254, битых 14, глазами 5, без токена 187`.

Все четырнадцать — один класс: диапазон назван верно, а утверждаемый токен на строке документа
относился к соседней мысли того же абзаца, поэтому доказательства у ссылки не было. Правились
**тексты**, не диапазоны (кроме двух случаев, где диапазон действительно не покрывал
утверждение): рядом со ссылкой поставлен токен, который в названных строках лежит.

| строка документа | ссылка | что стало доказательством |
|---|---|---|
| §1 | `services/api.ts:140-141` | цитата комментария с `ApiResponse` вместо отсутствующего `success` |
| §6 | `useOrderPermissions.ts:23-32` | три `computed` по имени: `canSeeCost`, `canSetManualCost`, `canCorrect` |
| §6 | `auth/shared/models.py:145-236` | имена моделей перенесены на строку ссылки |
| §6 | `useOrderPermissions.ts:16-21` → `:17-21` | цитата «is a `curtain`, not a right» — диапазон сужен по факту |
| §6 | `mocks/auditFeed.ts:47-60` → `:43-60` | `toRows` объявлен на `:43`, ссылка начиналась после объявления |
| §8 | `useProductCard.ts:247` | `Number.isNaN`; отдельная ссылка на `Text` — `products/shared/models.py:203-208` |
| §9 | `warehouseService.ts:333-373` | `apiDelete` вместо `DELETE` (в коде регистр другой) |
| §9 | `suppliers/shared/models.py:170-201` | `SupplierAuditEntry` вместо отсутствующего `sensitive` |
| §13 | `services/api.ts:153-156` | `url.searchParams` вместо `entityType=` |
| §16 | `core/uploads/action.py:141-142` | `base_url` вместо `storage_path` |
| §18 | `bcc/.../domain.py:95-99` | `NoRecipientsError`; код `NO_RECIPIENTS` — своей ссылкой на `:34-38` |
| §18 | `mocks/finance.ts:421-425` → `:421-429` | `mockGetPayment` и `clone` — диапазон расширен до функции |
| §18 | `mocks/auditFeed.ts:53-59` | токены `user`/`property` разведены по своим строкам |
| §21 | `useAuth.ts:101-108` | `getStoredCsrf` вместо `csrf_token` (в коде заголовок `X-CSRF-Token`) |

Пять «глазами» проверены чтением и оставлены как есть — во всех пяти ссылка верна, а токен на
строке принадлежит соседнему утверждению: `mocks/orders.ts:1858`
(`'FORBIDDEN_' + right.toUpperCase()` — кода `FORBIDDEN_CORRECTION` дословно в файле нет),
`router/index.ts:258-318` (восемь попаданий `adminWarehouse`), `types/config.ts:3`
(`FieldType` из шести значений), `useAuditFeed.ts:68` (`page.value = result.page`),
`services/mocks/warehouse.ts:724-726` (запрет чужой валюты партии).

## Итерация 2

`ссылок 256, битых 0, глазами 5, без токена 187` — свип чистый.

`cd frontend_vue && npm run verify` — зелёная, EXIT=0. `[контракт] сведено доменов: 2 · описано
эндпоинтов: 6 из 175`: файл соглашений в инвентарь не попадает, и это требование задачи —
примеров с заголовком `### <МЕТОД> /api/...` в нём нет ни одного (`grep -c '^### '` → 0).

## Что перепроверено по коду отдельно от ссылок

Список из промпта задачи 19 — то, где прежний текст расходился с кодом:

- **конверт**: `unwrap` принимает три формы (`services/api.ts:108-142`) — прочитано целиком;
- **PATCH против PUT**: `apiPatch` 27 вызовов, `apiPut` 6 — пересчитано теми же командами, что
  в §3;
- **`TranslatedString`**: интерфейс `types/i18n.ts:6-10`, три помощника на `:19-25`, `:36-50`,
  `:53-61` — совпадает с §12;
- **аудит по id**: девять сущностей замкнуты типом `types/audit.ts:4-14`;
- **`Idempotency-Key`**: пять вызовов (`bccService.ts:43`, `:64`, `ordersService.ts:295`,
  `:352`, `:386`), генератор `api.ts:240`;
- **фича-флаги**: 52 во фронте против 46 в миграции — пересчитано;
- **мультиарендность**: `tenant_id` во всех десяти модулях, счётчики §4 совпали;
- **уведомления**: семь `notify*`;
- **права**: `check_permission` — `return True` с комментарием «Placeholder»
  (`auth/internal_api/interface.py:27-38`), вызывающих нет; `dependencies.py` — один докстринг;
  `ForbiddenError` поднимается во всём бэкенде один раз
  (`settings/features/crud/domain.py:529`). То есть форма отказа прежнего контракта
  `403 { code: 'FORBIDDEN' }` не подтверждается, и §6 говорит это же.

Решений в этом проходе не принято ни одного: строки «нигде» остались в
[`audit/00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md) (189 доменных
плюс два засеянных пункта — фичи и тарифы, жизненный цикл значения кастомного поля).
