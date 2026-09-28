# Перепись коротких ссылок `roo_code/roo-context/api/00-conventions.md` — 2026-09-28

Короткая ссылка — `:NNN`, `:N-M` или хвост перечисления через запятую, у которых файл не назван
рядом, а подразумевается последним путём ЛЕВЕЕ на ТОЙ ЖЕ строке. `refs_shift.py` такие не чинит по
построению: файл у них назван прозой, а не ссылкой.

## Что искал

```bash
grep -oP '(?<![\w:.,/-]):\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*(?![\w:])' roo_code/roo-context/api/00-conventions.md | wc -l   # 95
grep -nP '(?<![\w:.,/-]):\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*(?![\w:])' roo_code/roo-context/api/00-conventions.md | wc -l   # 67
grep -c '' roo_code/roo-context/api/00-conventions.md                                                                 # 1677
```

**Коротких ссылок в документе 95 в 67 строках.** Столько же строк в таблице ниже — 95. Числа строк
(1677) правка не меняет: правились только цифры внутри ссылок.

## Ограничители — каждый снят со случившегося провала

1. **Строка с двумя и более РАЗНЫМИ путями не трогается вовсе** — контекст на ней определяется
   неверно. Такие ссылки в таблице помечены причиной «два пути на строке».
2. **Диапазон `:N-M` двигается обоими концами или не двигается ни одним.** Во всём документе
   перевёрнутых диапазонов нет ни одного — ни до, ни после правки:
   `grep -oP '(?<=\d)-(\d+)(?=[,`])'` → пусто; проверено по каждому вхождению в таблице отдельно.
3. **Правка доказывается содержимым, а не арифметикой.** Из предложения берётся код в бэктиках
   (сам путь и токены-пути отброшены) и грепается по подразумеваемому файлу. Нашёлся ровно один
   раз — номер известен; не нашёлся, нашёлся многократно или токена рядом нет — ссылка не
   правится и идёт в «отдано глазам».

## Что поправлено — 8 коротких ссылок

| строка документа | файл | было | стало | токен | его строка |
|---|---|---|---|---|---|
| 759 | mocks/notifications.ts | 566 | 599 | `notifyWarehouseReady` | 599 |
| 759 | mocks/notifications.ts | 592 | 625 | `notifyPaymentReceived` | 625 |
| 759 | mocks/notifications.ts | 616 | 649 | `notifyBatchReceived` | 649 |
| 759 | mocks/notifications.ts | 637 | 670 | `notifyStockDeficit` | 670 |
| 759 | mocks/notifications.ts | 657 | 690 | `notifySupplierResponse` | 690 |
| 759 | mocks/notifications.ts | 684 | 717 | `notifyPaymentOverdue` | 717 |
| 764 | mocks/orders.ts | 3929 | 3944 | `!wasReady && fullyReserved` | 3944 |
| 1092 | mocks/suppliers.ts | 117 | 118 | `'UK'` | 118 |

Проверка каждого — точечным грепом по целевому файлу:

```bash
cd frontend_vue && for spec in "599:notifyWarehouseReady" "625:notifyPaymentReceived" "649:notifyBatchReceived" "670:notifyStockDeficit" "690:notifySupplierResponse" "717:notifyPaymentOverdue"; do n=${spec%%:*}; t=${spec#*:}; printf "%s -> " "$n"; sed -n "${n}p" src/services/mocks/notifications.ts | grep -c "$t"; done
# 599 -> 1 · 625 -> 1 · 649 -> 1 · 670 -> 1 · 690 -> 1 · 717 -> 1
grep -cF '!wasReady && fullyReserved' frontend_vue/src/services/mocks/orders.ts   # 1 (строка 3944)
grep -nF "country: 'UK'" frontend_vue/src/services/mocks/suppliers.ts             # 118:    country: 'UK',
```

Смещение у семи эмиттеров одно и то же, +33: их объявления ушли вниз на тридцать три строки, и
все семь номеров уехали вместе. Шесть из семи доказаны поимённо; первый номер той же строки
относится к ПОЛНОЙ ссылке (файл назван вплотную рядом), а не к короткой, поэтому его чинит
механика (`refs_shift.py`), а не эта задача.

## Проверка резолвером — до правки

```bash
cd frontend_vue && env CONTRACT_REFS=roo_code/roo-context/api/00-conventions.md ./node_modules/.bin/vitest run src/services/contractRefs.spec.ts
```

Код возврата 0. Вывод:

```
roo_code/roo-context/api/00-conventions.md: ссылок 336, битых 29, глазами 12, без токена 234
  roo_code/roo-context/api/00-conventions.md:29 → services/api.ts:128-139 — нет токена в диапазоне: в 128-139 нет ни одного из: «ApiResponse<T>», «success»
  roo_code/roo-context/api/00-conventions.md:34 → backend/app/core/uploads/action.py:143-146 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 143-146
  roo_code/roo-context/api/00-conventions.md:36 → services/api.ts:140-141 — нет токена в диапазоне: в 140-141 нет ни одного из: «ApiResponse»
  roo_code/roo-context/api/00-conventions.md:65 → core/uploads/action.py:106-114 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 106-114
  roo_code/roo-context/api/00-conventions.md:71 → backend/app/modules/auth/features/me/action.py:44-72 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 44-72
  roo_code/roo-context/api/00-conventions.md:229 → types/config.ts:35-35 — нет токена в диапазоне: в 35-35 нет ни одного из: «PermissionMatrix», «roles», «users», «rolePermissions»
  roo_code/roo-context/api/00-conventions.md:298 → backend/app/modules/auth/shared/models.py:167-189 — нет токена в диапазоне: в 167-189 нет ни одного из: «parent_id»
  roo_code/roo-context/api/00-conventions.md:357 → crud/action.py:512-516 — вне границ: в backend/app/modules/settings/features/crud/action.py 470 строк, ссылка на 512-516
  roo_code/roo-context/api/00-conventions.md:410 → mocks/orders.ts:1387-1389 — нет токена в диапазоне: в 1387-1389 нет ни одного из: «unitCost», «costSource», «allocations», «marginPercent»
  roo_code/roo-context/api/00-conventions.md:414 → types/audit.ts:63-74 — нет токена в диапазоне: в 63-74 нет ни одного из: «toRows»
  roo_code/roo-context/api/00-conventions.md:423 → composables/useOrderPermissions.ts:23-32 — нет токена в диапазоне: в 23-32 нет ни одного из: «requireRight», «maySeeCost»
  roo_code/roo-context/api/00-conventions.md:625 → suppliers/shared/models.py:312-316 — нет токена в диапазоне: в 312-316 нет ни одного из: «CASCADE», «category_fields.category_id», «CASCADE»
  roo_code/roo-context/api/00-conventions.md:659 → services/auditFeedService.ts:49-77 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 49-77
  roo_code/roo-context/api/00-conventions.md:708 → suppliers/shared/models.py:188-194 — нет токена в диапазоне: в 188-194 нет ни одного из: «StockAuditEntry»
  roo_code/roo-context/api/00-conventions.md:736 → types/audit.ts:5-14 — нет токена в диапазоне: в 5-14 нет ни одного из: «entity_type»
  roo_code/roo-context/api/00-conventions.md:750 → warehouse/shared/models.py:310-310 — нет токена в диапазоне: в 310-310 нет ни одного из: «old_value», «new_value», «Text»
  roo_code/roo-context/api/00-conventions.md:939 → mocks/index.ts:1583-1583 — нет токена в диапазоне: в 1583-1583 нет ни одного из: «ifMatchVersion»
  roo_code/roo-context/api/00-conventions.md:1002 → suppliers/shared/models.py:252-252 — нет токена в диапазоне: в 252-252 нет ни одного из: «bcc_events.source», «String(50)»
  roo_code/roo-context/api/00-conventions.md:1004 → suppliers/shared/models.py:129-129 — нет токена в диапазоне: в 129-129 нет ни одного из: «{ru,en,lt}», «String(255)»
  roo_code/roo-context/api/00-conventions.md:1043 → services/api.ts:153-156 — нет токена в диапазоне: в 153-156 нет ни одного из: «url.searchParams»
  roo_code/roo-context/api/00-conventions.md:1117 → types/client.ts:90-96 — нет токена в диапазоне: в 90-96 нет ни одного из: «SalesCrmStats»
  roo_code/roo-context/api/00-conventions.md:1144 → SettingsLayout.vue:436-446 — нет токена в диапазоне: в 436-446 нет ни одного из: «is_default»
  roo_code/roo-context/api/00-conventions.md:1229 → backend/app/core/uploads/action.py:78-146 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 78-146
  roo_code/roo-context/api/00-conventions.md:1256 → core/uploads/action.py:141-142 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 141-142
  roo_code/roo-context/api/00-conventions.md:1262 → core/uploads/action.py:136-136 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 136-136
  roo_code/roo-context/api/00-conventions.md:1306 → mocks/orders.ts:1626-1631 — нет токена в диапазоне: в 1626-1631 нет ни одного из: «clientName», «clientVatCode», «clientAddress», «clientPaymentTermsDays»
  roo_code/roo-context/api/00-conventions.md:1378 → mocks/finance.ts:421-429 — нет токена в диапазоне: в 421-429 нет ни одного из: «mockGetPayment», «clone», «user»
  roo_code/roo-context/api/00-conventions.md:1417 → mocks/categories.ts:1507-1507 — нет токена в диапазоне: в 1507-1507 нет ни одного из: «tmp-<…>»
  roo_code/roo-context/api/00-conventions.md:1464 → core/uploads/action.py:96-114 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 96-114
[ссылки] документов 1 · ссылок 336 · битых 29
```

**Битых до правки: 29.** Из этих двадцати девяти ни одна не является короткой ссылкой из переписи:
все они — полные (`путь:строка`), и чинит их механика `refs_shift.py`, а не эта задача.

## Проверка резолвером — после правки

Правка уже внесена в документ, поэтому прогон снят по настоящему пути (не по копии):

```bash
cd frontend_vue && env CONTRACT_REFS=roo_code/roo-context/api/00-conventions.md ./node_modules/.bin/vitest run src/services/contractRefs.spec.ts
```

Код возврата 0. Вывод целиком:

```
roo_code/roo-context/api/00-conventions.md: ссылок 336, битых 29, глазами 12, без токена 234
  roo_code/roo-context/api/00-conventions.md:29 → services/api.ts:128-139 — нет токена в диапазоне: в 128-139 нет ни одного из: «ApiResponse<T>», «success»
  roo_code/roo-context/api/00-conventions.md:34 → backend/app/core/uploads/action.py:143-146 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 143-146
  roo_code/roo-context/api/00-conventions.md:36 → services/api.ts:140-141 — нет токена в диапазоне: в 140-141 нет ни одного из: «ApiResponse»
  roo_code/roo-context/api/00-conventions.md:65 → core/uploads/action.py:106-114 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 106-114
  roo_code/roo-context/api/00-conventions.md:71 → backend/app/modules/auth/features/me/action.py:44-72 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 44-72
  roo_code/roo-context/api/00-conventions.md:229 → types/config.ts:35-35 — нет токена в диапазоне: в 35-35 нет ни одного из: «PermissionMatrix», «roles», «users», «rolePermissions»
  roo_code/roo-context/api/00-conventions.md:298 → backend/app/modules/auth/shared/models.py:167-189 — нет токена в диапазоне: в 167-189 нет ни одного из: «parent_id»
  roo_code/roo-context/api/00-conventions.md:357 → crud/action.py:512-516 — вне границ: в backend/app/modules/settings/features/crud/action.py 470 строк, ссылка на 512-516
  roo_code/roo-context/api/00-conventions.md:410 → mocks/orders.ts:1387-1389 — нет токена в диапазоне: в 1387-1389 нет ни одного из: «unitCost», «costSource», «allocations», «marginPercent»
  roo_code/roo-context/api/00-conventions.md:414 → types/audit.ts:63-74 — нет токена в диапазоне: в 63-74 нет ни одного из: «toRows»
  roo_code/roo-context/api/00-conventions.md:423 → composables/useOrderPermissions.ts:23-32 — нет токена в диапазоне: в 23-32 нет ни одного из: «requireRight», «maySeeCost»
  roo_code/roo-context/api/00-conventions.md:625 → suppliers/shared/models.py:312-316 — нет токена в диапазоне: в 312-316 нет ни одного из: «CASCADE», «category_fields.category_id», «CASCADE»
  roo_code/roo-context/api/00-conventions.md:659 → services/auditFeedService.ts:49-77 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 49-77
  roo_code/roo-context/api/00-conventions.md:708 → suppliers/shared/models.py:188-194 — нет токена в диапазоне: в 188-194 нет ни одного из: «StockAuditEntry»
  roo_code/roo-context/api/00-conventions.md:736 → types/audit.ts:5-14 — нет токена в диапазоне: в 5-14 нет ни одного из: «entity_type»
  roo_code/roo-context/api/00-conventions.md:750 → warehouse/shared/models.py:310-310 — нет токена в диапазоне: в 310-310 нет ни одного из: «old_value», «new_value», «Text»
  roo_code/roo-context/api/00-conventions.md:939 → mocks/index.ts:1583-1583 — нет токена в диапазоне: в 1583-1583 нет ни одного из: «ifMatchVersion»
  roo_code/roo-context/api/00-conventions.md:1002 → suppliers/shared/models.py:252-252 — нет токена в диапазоне: в 252-252 нет ни одного из: «bcc_events.source», «String(50)»
  roo_code/roo-context/api/00-conventions.md:1004 → suppliers/shared/models.py:129-129 — нет токена в диапазоне: в 129-129 нет ни одного из: «{ru,en,lt}», «String(255)»
  roo_code/roo-context/api/00-conventions.md:1043 → services/api.ts:153-156 — нет токена в диапазоне: в 153-156 нет ни одного из: «url.searchParams»
  roo_code/roo-context/api/00-conventions.md:1117 → types/client.ts:90-96 — нет токена в диапазоне: в 90-96 нет ни одного из: «SalesCrmStats»
  roo_code/roo-context/api/00-conventions.md:1144 → SettingsLayout.vue:436-446 — нет токена в диапазоне: в 436-446 нет ни одного из: «is_default»
  roo_code/roo-context/api/00-conventions.md:1229 → backend/app/core/uploads/action.py:78-146 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 78-146
  roo_code/roo-context/api/00-conventions.md:1256 → core/uploads/action.py:141-142 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 141-142
  roo_code/roo-context/api/00-conventions.md:1262 → core/uploads/action.py:136-136 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 136-136
  roo_code/roo-context/api/00-conventions.md:1306 → mocks/orders.ts:1626-1631 — нет токена в диапазоне: в 1626-1631 нет ни одного из: «clientName», «clientVatCode», «clientAddress», «clientPaymentTermsDays»
  roo_code/roo-context/api/00-conventions.md:1378 → mocks/finance.ts:421-429 — нет токена в диапазоне: в 421-429 нет ни одного из: «mockGetPayment», «clone», «user»
  roo_code/roo-context/api/00-conventions.md:1417 → mocks/categories.ts:1507-1507 — нет токена в диапазоне: в 1507-1507 нет ни одного из: «tmp-<…>»
  roo_code/roo-context/api/00-conventions.md:1464 → core/uploads/action.py:96-114 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 96-114
[ссылки] документов 1 · ссылок 336 · битых 29

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

**Битых после правки: 29** — столько же, сколько было до неё. Ни одна короткая ссылка из переписи
в отчёт резолвера не попадает: он судит только ссылки с написанным путём, а короткая файл
подразумевает прозой. Поэтому его число по этой задаче и не могло измениться: критерий выполнен в
том, что оно **не выросло**. Оба прогона — до и после — сняты полным текстом в
`$TMPDIR/before.txt` и `$TMPDIR/final-real.txt`.

## Мутационная проверка

На копии правленого документа одному исправленному номеру возвращено прежнее значение, и копия
прогнана резолвером:

```bash
cp roo_code/roo-context/api/00-conventions.md "$TMPDIR/mut1.md"
# в копии `:3944` возвращается в `:3929`; остальные семь правок на месте
cd frontend_vue && env CONTRACT_REFS="$TMPDIR/mut1.md" ./node_modules/.bin/vitest run src/services/contractRefs.spec.ts
```

Код возврата 0. Итоговая строка:

```
[ссылки] документов 1 · ссылок 336 · битых 29
```

**Число битых не изменилось, и это ожидаемый результат, а не провал проверки.** Резолвер короткие
ссылки не судит вовсе — их нет ни в одной из 29 записей его отчёта, потому что у них не написан
путь. Значит возврат номера назад он увидеть не может, и мутацию по коротким ссылкам он не
проверяет. Резолвером здесь доказано другое и полезное: правка не добавила битых ссылок и не
сломала разбор документа (336 ссылок в обоих прогонах, 11 тестов зелёные).

Мутационное доказательство самой правки — точечная подстановка по целевому файлу, и она снята
командой:

```bash
sed -n '3929p' frontend_vue/src/services/mocks/orders.ts   #          lineId: item.id,
sed -n '3944p' frontend_vue/src/services/mocks/orders.ts   #   if (!wasReady && fullyReserved(order)) notifyWarehouseReady(order)
sed -n '117p' frontend_vue/src/services/mocks/suppliers.ts #     rating: 4,
```

Возврат `:3944` → `:3929` возвращает ссылку на строку, где искомого токена нет; возврат
`:118` → `:117` в моках поставщиков — то же самое (`rating: 4,` вместо `country: 'UK',`).
Каждый из восьми исправленных номеров проверяем так же — подстановкой прежнего значения, — и
именно так он и найден.

## Перепись — 95 строк, по строке на каждую короткую ссылку документа

Колонка «подразумеваемый файл» — имя файла без двоеточия с номером; номера — отдельными колонками
голыми числами, чтобы эта перепись сама не стала набором ссылок, которые надо сопровождать.

| № | строка документа | подразумеваемый файл | как написано | новый номер | утверждаемый токен | строки токена в файле | вердикт | причина |
|---|---|---|---|---|---|---|---|---|
| 1 | 46 | — | 492-500 | — | — | — | отдано глазам | токена рядом нет |
| 2 | 64 | — | 13-20 | — | — | — | отдано глазам | токена рядом нет |
| 3 | 65 | — | 23-27 | — | — | — | отдано глазам | токена рядом нет |
| 4 | 66 | — | 30-34 | — | — | — | отдано глазам | токена рядом нет |
| 5 | 67 | — | 37-41 | — | — | — | отдано глазам | токена рядом нет |
| 6 | 68 | — | 44-48 | — | — | — | отдано глазам | токена рядом нет |
| 7 | 117 | — | 152 | — | — | — | отдано глазам | токена рядом нет |
| 8 | 139 | mocks/orders.ts | 4710-4752 | — | — | — | отдано глазам | токена рядом нет |
| 9 | 148 | alembic/versions/e24a3922ed01_phase_7_config.py | 93 | — | `uq_role_permission` | 93 | верна | токен стоит на этой строке |
| 10 | 183 | composables/useAuth.ts | 36 | — | — | — | отдано глазам | токена рядом нет |
| 11 | 183 | composables/useAuth.ts | 39-45 | — | — | — | отдано глазам | токена рядом нет |
| 12 | 230 | — | 37-57 | — | — | — | отдано глазам | токена рядом нет |
| 13 | 261 | — | 60-63 | — | — | — | отдано глазам | токена рядом нет |
| 14 | 262 | settings/features/profile/domain.py | 106 | — | — | — | отдано глазам | токена рядом нет |
| 15 | 421 | mocks/settings.ts | 433-442 | — | `seeCost`, `manualCost`, `correction` | 65, 66, 67 | отдано глазам | токен найден многократно |
| 16 | 424 | mocks/orders.ts | 1390-1393 | — | `requireRight` | 1865, 2008, 2252, 2322, 2646, 3405 | отдано глазам | токен найден многократно |
| 17 | 429 | composables/useSettings.ts | 92 | — | `settled` | 121, 325, 333, 362, 711 | отдано глазам | токен найден многократно |
| 18 | 477 | — | 99 | — | — | — | отдано глазам | токена рядом нет |
| 19 | 477 | — | 100-101 | — | — | — | отдано глазам | токена рядом нет |
| 20 | 478 | — | 120 | — | — | — | отдано глазам | токена рядом нет |
| 21 | 499 | — | 11-35 | — | — | — | отдано глазам | токена рядом нет |
| 22 | 499 | — | 37-73 | — | — | — | отдано глазам | токена рядом нет |
| 23 | 500 | — | 75-105 | — | — | — | отдано глазам | токена рядом нет |
| 24 | 502 | — | 108-134 | — | — | — | отдано глазам | токена рядом нет |
| 25 | 503 | — | 137-155 | — | — | — | отдано глазам | токена рядом нет |
| 26 | 505 | — | 255-274 | — | — | — | отдано глазам | токена рядом нет |
| 27 | 536 | router/index.ts | 258-318 | — | `adminFinance` | — | отдано глазам | токен не найден |
| 28 | 549 | router/index.ts | 258,264,276,282,288,306,318 | — | `adminWarehouse` | 99, 259, 265, 277, 283, 289, 307, 319 | отдано глазам | токен найден многократно |
| 29 | 570 | — | 210-214 | — | — | — | отдано глазам | токена рядом нет |
| 30 | 627 | alembic/versions/25245d4bf874_phase_3_categories_products.py | 78 | — | `RESTRICT` | 32, 62, 78 | отдано глазам | токен найден многократно |
| 31 | 648 | — | 16-26 | — | — | — | отдано глазам | токена рядом нет |
| 32 | 648 | — | 35-45 | — | — | — | отдано глазам | токена рядом нет |
| 33 | 667 | services/mocks/warehouse.ts | 1885 | — | `AUDIT_ENTRY_NOT_FOUND` | 1593, 1885, 1887, 1905, 1907, 1921, 1923, 1937, 1954, 1956, 2058 | отдано глазам | токен найден многократно |
| 34 | 667 | services/mocks/warehouse.ts | 1898 | — | `AUDIT_ENTRY_NOT_FOUND` | те же 11 | отдано глазам | токен найден многократно |
| 35 | 667 | services/mocks/warehouse.ts | 1912 | — | `AUDIT_ENTRY_NOT_FOUND` | те же 11 | отдано глазам | токен найден многократно |
| 36 | 667 | services/mocks/warehouse.ts | 1928 | — | `AUDIT_ENTRY_NOT_FOUND` | те же 11 | отдано глазам | токен найден многократно |
| 37 | 698 | — | 185 | — | — | — | отдано глазам | токена рядом нет |
| 38 | 751 | — | 254-255 | — | — | — | отдано глазам | токена рядом нет |
| 39 | 759 | mocks/notifications.ts | 566 | 599 | `notifyWarehouseReady` | 599 | поправлена | — |
| 40 | 759 | mocks/notifications.ts | 592 | 625 | `notifyPaymentReceived` | 625 | поправлена | — |
| 41 | 759 | mocks/notifications.ts | 616 | 649 | `notifyBatchReceived` | 649 | поправлена | — |
| 42 | 759 | mocks/notifications.ts | 637 | 670 | `notifyStockDeficit` | 670 | поправлена | — |
| 43 | 759 | mocks/notifications.ts | 657 | 690 | `notifySupplierResponse` | 690 | поправлена | — |
| 44 | 759 | mocks/notifications.ts | 684 | 717 | `notifyPaymentOverdue` | 717 | поправлена | — |
| 45 | 760 | — | 514-522 | — | — | — | отдано глазам | токена рядом нет |
| 46 | 764 | mocks/orders.ts | 3929 | 3944 | `!wasReady && fullyReserved` | 3944 | поправлена | — |
| 47 | 765 | — | 4001 | — | — | — | отдано глазам | токена рядом нет |
| 48 | 766 | services/mocks/warehouse.ts | 1710 | — | `warehouse` | 36, 49, 66, 70, 122, 165, 221, 697, 721, 738, 745, 748, 752, 765, 767, 800, 1309, 1367, 1368, 1372, 1672, 1963, 1970, 2042, 2074 | отдано глазам | токен найден многократно |
| 49 | 767 | mocks/finance.ts | 486 | — | `finance` | 8, 23 | отдано глазам | токен найден многократно |
| 50 | 794 | — | 4676 | — | — | — | отдано глазам | два пути на строке |
| 51 | 877 | — | 107 | — | — | — | отдано глазам | токена рядом нет |
| 52 | 905 | services/bccService.ts | 64 | — | `Idempotency-Key` | 24, 43, 64, 74, 83 | отдано глазам | токен найден многократно |
| 53 | 938 | services/ordersService.ts | 113 | — | `If-Match` | 42, 112 | отдано глазам | токен найден многократно |
| 54 | 938 | services/ordersService.ts | 165 | — | `If-Match` | 42, 112 | отдано глазам | токен найден многократно |
| 55 | 938 | services/ordersService.ts | 187 | — | `If-Match` | 42, 112 | отдано глазам | токен найден многократно |
| 56 | 938 | services/ordersService.ts | 195 | — | `If-Match` | 42, 112 | отдано глазам | токен найден многократно |
| 57 | 939 | — | 211 | — | — | — | отдано глазам | токена рядом нет |
| 58 | 939 | — | 395 | — | — | — | отдано глазам | токена рядом нет |
| 59 | 940 | — | 1416-1421 | — | — | — | отдано глазам | токена рядом нет |
| 60 | 959 | — | 19-25 | — | — | — | отдано глазам | токена рядом нет |
| 61 | 960 | — | 36-50 | — | — | — | отдано глазам | токена рядом нет |
| 62 | 962 | — | 53-61 | — | — | — | отдано глазам | токена рядом нет |
| 63 | 980 | views/admin/products/ProductsPage.vue | 164 | — | — | — | отдано глазам | токена рядом нет |
| 64 | 981 | views/admin/products/ProductCardPage.vue | 141 | — | — | — | отдано глазам | токена рядом нет |
| 65 | 981 | views/admin/products/ProductCardPage.vue | 153 | — | — | — | отдано глазам | токена рядом нет |
| 66 | 981 | views/admin/products/ProductCardPage.vue | 165 | — | — | — | отдано глазам | токена рядом нет |
| 67 | 987 | — | 336 | — | — | — | отдано глазам | токена рядом нет |
| 68 | 987 | — | 462 | — | — | — | отдано глазам | токена рядом нет |
| 69 | 987 | — | 378 | — | — | — | отдано глазам | токена рядом нет |
| 70 | 1001 | backend/app/modules/products/shared/models.py | 76 | — | `field_definitions.name` | — | отдано глазам | токен не найден |
| 71 | 1081 | domain/countries.ts | 351-355 | — | `countryOptions` | 351 | верна | токен стоит в диапазоне |
| 72 | 1088 | — | 88 | — | — | — | отдано глазам | два пути на строке |
| 73 | 1092 | services/mocks/suppliers.ts | 117 | 118 | `'UK'` | 118 | поправлена | — |
| 74 | 1109 | services/mocks/warehouse.ts | 724-726 | — | `exchange_rate` | — | отдано глазам | токен не найден |
| 75 | 1141 | FinanceSettings.vue | 90-113 | — | `constants.defaultCurrency` | 17, 28, 39, 52 | отдано глазам | токен найден многократно |
| 76 | 1141 | FinanceSettings.vue | 17 | — | `constants.defaultCurrency` | 17, 28, 39, 52 | отдано глазам | токен найден многократно |
| 77 | 1145 | crud/domain.py | 140-170 | — | `is_default` | 300, 324, 330, 337, 364, 365, 370, 384, 395 | отдано глазам | токен найден многократно |
| 78 | 1247 | — | 67 | — | — | — | отдано глазам | токена рядом нет |
| 79 | 1280 | — | 119 | — | — | — | отдано глазам | токена рядом нет |
| 80 | 1281 | — | 90 | — | — | — | отдано глазам | токена рядом нет |
| 81 | 1307 | — | 2415-2422 | — | — | — | отдано глазам | токена рядом нет |
| 82 | 1387 | — | 440 | — | — | — | отдано глазам | токена рядом нет |
| 83 | 1387 | — | 449 | — | — | — | отдано глазам | токена рядом нет |
| 84 | 1389 | — | 637 | — | — | — | отдано глазам | токена рядом нет |
| 85 | 1389 | — | 726 | — | — | — | отдано глазам | токена рядом нет |
| 86 | 1389 | — | 745 | — | — | — | отдано глазам | токена рядом нет |
| 87 | 1414 | mocks/orders.ts | 1615-1617 | — | — | — | отдано глазам | токена рядом нет |
| 88 | 1416 | — | 410 | — | — | — | отдано глазам | два пути на строке |
| 89 | 1416 | — | 458 | — | — | — | отдано глазам | два пути на строке |
| 90 | 1416 | — | 312 | — | — | — | отдано глазам | два пути на строке |
| 91 | 1496 | alembic/versions/fd0ecc1269df_phase_9_warehouse.py | 77 | — | `CASCADE` | 29, 55, 56, 75, 76, 92, 93, 106, 107, 116, 117 | отдано глазам | токен найден многократно |
| 92 | 1497 | — | 93 | — | — | — | отдано глазам | токена рядом нет |
| 93 | 1497 | — | 107 | — | — | — | отдано глазам | токена рядом нет |
| 94 | 1543 | services/settingsService.ts | 170 | — | — | — | отдано глазам | токена рядом нет |
| 95 | 1543 | services/settingsService.ts | 179 | — | — | — | отдано глазам | токена рядом нет |

**Итого: 95 строк = 95 коротким ссылкам.** Поправлено 8, признано верными 2, отдано глазам 85.
У каждой строки «отдано глазам» названа причина из четырёх: «два пути на строке» — 5,
«токена рядом нет» — 57, «токен не найден» — 3, «токен найден многократно» — 20.
Сумма причин 5 + 57 + 3 + 20 = 85 сходится с числом строк «отдано глазам».

### Как читалась причина

- **«два пути на строке»** — на строке ссылки два и более разных пути: контекст определяется
  неверно, ссылка не трогается (ограничитель 1).
- **«токена рядом нет»** — рядом со ссылкой нет кода в бэктиках, который можно проверить. Файл
  при этом бывает назван — в самом предложении или в подразумеваемом фрагменте, — но числа это не
  доказывает: проверять нечего. Колонка «подразумеваемый файл» от причины не зависит и «—» несёт
  только там, где и пути не нашлось.
- **«токен не найден»** — код рядом есть, но в подразумеваемом файле его нет ни разу.
- **«токен найден многократно»** — код рядом есть и встречается в файле больше одного раза;
  какой из номеров он утверждает, машина не знает.

Токен ищется на **той же строке**, что и ссылка; строка **выше** берётся только там, где
перечисление кодов стоит непосредственно над ссылками, продолжающими предложение (строка 759 —
семь эмиттеров, строки 938 и 905 — `If-Match` и `Idempotency-Key`, строки 1496 и 627 — политики
`CASCADE`/`RESTRICT`). Строка 421 под это не подпадает: там `seeCost`, `manualCost` и `correction`
строкой выше называют перечень прав, а не подразумеваемый файл мока, — ссылка отдана глазам.
Из семи токенов строки 759 шесть совпали с номерами один в один, и эта связь проверена грепом
поимённо, а не выведена из расстояния: это и есть доказательство, которого ограничитель 3 требует.

Строка 71 стоит в вердикте «верна»: токен `countryOptions` лежит ровно на 351, то есть внутри
написанного диапазона 351-355. Строки 39–44 и 73 записаны «поправлена», хотя их токены теперь
тоже совпадают с номером: это следствие уже сделанной правки, и различать эти две группы надо по
колонке «новый номер» — у «верна» она пуста, у «поправлена» заполнена.

Строка 15 отдана глазам по той же причине, что и строки 39–44, но с другого конца: токенов рядом
три — `seeCost`, `manualCost` и `correction`, — и лежат они на трёх разных строках (65, 66, 67),
то есть один номер ими не доказывается. Какой из трёх подразумевал автор для диапазона 433–442 и
подразумевал ли его вовсе, из предложения не следует; правится такое чтением, а не грепом.

## Границы этой переписи

- Разбирались только короткие ссылки: 336 ссылок документа — из них коротких 95. Полные
  (`путь:строка`) не трогались: их чинит `refs_shift.py`.
- Числа номеров в таблице сняты грепом и `sed` по файлам этого дерева; документ при этом не
  менялся ничем, кроме восьми цифр.
- Ссылки, у которых файл подразумевается прозой двух и более строк выше, поддержаны не были:
  правило «последний путь левее на ТОЙ ЖЕ строке» — единственное, по которому здесь считалось.
  Всякая короткая ссылка, которой этот путь не нашёлся, помечена в колонке «подразумеваемый файл»
  значком «—» и отдана глазам.
- В таблицах переписи имя файла и номер никогда не стоят друг за другом через двоеточие: имя идёт
  отдельной колонкой, номер — отдельной колонкой голым числом. Двоеточие с числом встречается
  только внутри вывода инструмента, приведённого здесь дословно, и записями переписи не является.
- Ссылки, у которых контекст оказался спорным, отданы глазам и не трогались: строки 10 и 11
  (в бэктиках там `credentials: 'include'` с пробелом, а доказуемый токен обязан быть одним
  словом), строка 15 (три токена на трёх разных строках), строки 70 и 74 (токен рядом есть, но в
  файле не найден ни разу). Правило «при сомнении не трогать» здесь и сработало: ни одна из них
  номер не сменила.
