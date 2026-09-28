# Перепись коротких ссылок `roo_code/roo-context/api/products.md` и `roo_code/roo-context/api/settings.md` — 2026-09-28

Короткая ссылка — это `:NNN`, `:N-M` или хвост перечисления через запятую, у которых файл рядом
не назван, а подразумевается последним путём ЛЕВЕЕ на ТОЙ ЖЕ строке. `refs_shift.py` такие не чинит
по построению: файл у них назван прозой, а не ссылкой. Полные ссылки вида `путь:строка` этой
задачей не трогались вовсе.

## Что искал

```bash
grep -oP '(?<![\w:.,/-]):\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*(?![\w:])' roo_code/roo-context/api/products.md | wc -l   # 110
grep -nP '(?<![\w:.,/-]):\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*(?![\w:])' roo_code/roo-context/api/products.md | wc -l   # 73
grep -oP '(?<![\w:.,/-]):\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*(?![\w:])' roo_code/roo-context/api/settings.md | wc -l   # 39
grep -nP '(?<![\w:.,/-]):\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*(?![\w:])' roo_code/roo-context/api/settings.md | wc -l   # 27
wc -l roo_code/roo-context/api/products.md roo_code/roo-context/api/settings.md                                  # 1043 / 1786
```

**Коротких ссылок: 110 в документе товаров в 73 строках и 39 в настройках в 27 строках — 149
всего.** Столько же строк в таблицах переписи ниже — 110 и 39. Число строк документов правка не
меняет: правились только цифры внутри ссылок. Замер:

```bash
git show HEAD:roo_code/roo-context/api/products.md | wc -l   # 1043
wc -l < roo_code/roo-context/api/products.md                  # 1043
git show HEAD:roo_code/roo-context/api/settings.md | wc -l    # 1786
wc -l < roo_code/roo-context/api/settings.md                  # 1786
```

## Ограничители — каждый снят со случившегося провала

1. **Строка с двумя и более РАЗНЫМИ путями не трогается вовсе** — контекст на ней определяется
   неверно. Такие ссылки помечены причиной «два пути на строке»: 13 в товарах, 2 в настройках.
2. **Диапазон `:N-M` двигается обоими концами или не двигается ни одним.** Перевёрнутых
   диапазонов нет ни одного — ни до, ни после правки; ни один диапазон не правился вовсе.
3. **Правка доказывается содержимым, а не арифметикой.** Из предложения берётся код в бэктиках
   (сам путь и токены-пути отброшены) и грепается по подразумеваемому файлу. Нашёлся ровно один
   раз — номер известен; не нашёлся, нашёлся многократно или токена рядом нет — ссылка не
   правится и идёт в «отдано глазам».
4. **Строка-цель в старой и новой версии файла совпадает дословно.** Ни один исправленный номер
   не двигал строку-цель: правились только числа в документе, файлы кода не трогались —
   `git diff --stat` по `frontend_vue/src/services/mocks/index.ts`,
   `frontend_vue/src/services/mocks/settings.ts`, `frontend_vue/src/composables/useProducts.ts` и
   `frontend_vue/src/types/product.ts` пуст.

## Что поправлено — 2 короткие ссылки

| строка документа | файл | было | стало | токен | его строка |
|---|---|---|---|---|---|
| 263 | frontend_vue/src/services/mocks/index.ts | 440 | 551 | `'/api/products/list'` | 551 |
| 579 | frontend_vue/src/composables/useProducts.ts | 48 | 49 | `products.toast_deleted` | 49 |

Обе — тот случай, который ограничитель 3 разрешает: токен стоит прямо перед ссылкой, и он же
стоит на новой строке.

**Соседняя короткая ссылка в обоих предложениях осталась неисправленной, и это названо, а не
умолчано.** В предложении строки 263 карточку ловит третья ссылка (`:449`), в предложении строки
579 `load()` несёт вторая (`:49`); у обеих файл на ТОЙ ЖЕ строке не назван, токена рядом нет —
значит по правилу они отданы глазам, хотя фактически речь про те же два файла. Предложение от
этого остаётся частично устаревшим, и так оно в переписи и записано.

**Отдельно названо то, что задачей не чинится.** В тех же двух предложениях стоят три ПОЛНЫЕ
ссылки — на `services/mocks/index.ts` (два номера подряд в одном предложении) и на
`composables/useProducts.ts` (один номер), — и ни одна из трёх не указывает на строку со своим
токеном: первые две ведут в пустую строку и в строку регулярки, третья — в `try {`. Полные
ссылки предметом этой задачи не являются вовсе — их чинит `refs_shift.py`, а он этой задачей не
запускался ни с `--fix`, ни без. Утверждения этих трёх пар остаются частично неверными, и это
записано здесь, чтобы приёмщик не принял молчание за согласие.

## Доказательство поимённо — грепом по целевому файлу

```bash
cd frontend_vue
grep -nF "'/api/products/list'" src/services/mocks/index.ts
# 551:  if (path === '/api/products/list') {
grep -cF "'/api/products/list'" src/services/mocks/index.ts            # 1 — вхождение единственное
sed -n '551p' src/services/mocks/index.ts | grep -cF "'/api/products/list'"   # 1 — токен на новой строке
sed -n '440p' src/services/mocks/index.ts | grep -cF "'/api/products/list'"   # 0 — на прежней его нет
grep -nF "products.toast_deleted" src/composables/useProducts.ts
# 49:      toast.success(t('products.toast_deleted'))
grep -cF "products.toast_deleted" src/composables/useProducts.ts      # 1 — вхождение единственное
sed -n '49p' src/composables/useProducts.ts | grep -cF "products.toast_deleted"   # 1
sed -n '48p' src/composables/useProducts.ts | grep -cF "products.toast_deleted"   # 0
```

Совпадение доказано поимённо, а не выведено из смещения: у двух номеров разное смещение (+111 и
+1), и каждый проверен отдельным грепом по своей строке.

## Диапазоны — до и после

```bash
git show HEAD:roo_code/roo-context/api/products.md | grep -oP '(?<![\w:.,/-]):\K\d+-\d+(?![\w:])' | awk -F- '$1>$2'   # пусто
git show HEAD:roo_code/roo-context/api/settings.md | grep -oP '(?<![\w:.,/-]):\K\d+-\d+(?![\w:])' | awk -F- '$1>$2'   # пусто
grep -oP '(?<![\w:.,/-]):\K\d+-\d+(?![\w:])' roo_code/roo-context/api/products.md | awk -F- '$1>$2'   # пусто
grep -oP '(?<![\w:.,/-]):\K\d+-\d+(?![\w:])' roo_code/roo-context/api/settings.md | awk -F- '$1>$2'   # пусто
```

Код возврата 0 у всех четырёх, вывода нет. Ни один диапазон не правился, поэтому «после»
совпадает с «до»; обе команды приведены и для версии `HEAD`, и для рабочего дерева.

## Проверка резолвером — до правки

```bash
cd frontend_vue && env CONTRACT_REFS=roo_code/roo-context/api/products.md ./node_modules/.bin/vitest run src/services/contractRefs.spec.ts
```

Код возврата 0. Вывод:

```
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-2/wt-short-refs-products-settings/frontend_vue

roo_code/roo-context/api/products.md: ссылок 411, битых 29, глазами 30, без токена 276
  roo_code/roo-context/api/products.md:80 → services/mocks/products.ts:14225-14225 — нет токена в диапазоне: в 14225-14225 нет ни одного из: «PRODUCT_IN_USE»
  roo_code/roo-context/api/products.md:81 → services/mocks/products.ts:14234-14234 — нет токена в диапазоне: в 14234-14234 нет ни одного из: «AUDIT_ENTRY_NOT_FOUND»
  roo_code/roo-context/api/products.md:103 → composables/useProductCard.ts:260-260 — нет токена в диапазоне: в 260-260 нет ни одного из: «msg.status_error»
  roo_code/roo-context/api/products.md:104 → views/admin/products/ProductCardPage.vue:73-73 — нет токена в диапазоне: в 73-73 нет ни одного из: «auditLog.toast_error_delete»
  roo_code/roo-context/api/products.md:127 → services/mocks/index.ts:567-567 — нет токена в диапазоне: в 567-567 нет ни одного из: «sortBy»
  roo_code/roo-context/api/products.md:299 → services/mocks/products.ts:31-31 — нет токена в диапазоне: в 31-31 нет ни одного из: «prod-001»
  roo_code/roo-context/api/products.md:339 → backend/app/modules/products/features/get_product_detail/domain.py:59-68 — нет токена в диапазоне: в 59-68 нет ни одного из: «categoryId», «categoryName»
  roo_code/roo-context/api/products.md:471 → views/admin/products/ProductsPage.vue:197-220 — нет токена в диапазоне: в 197-220 нет ни одного из: «catch»
  roo_code/roo-context/api/products.md:529 → composables/useProductCard.ts:243-255 — нет токена в диапазоне: в 243-255 нет ни одного из: «dirty.isDirty»
  roo_code/roo-context/api/products.md:549 → services/mocks/products.ts:14117-14218 — нет токена в диапазоне: в 14117-14218 нет ни одного из: «products.toast_error»
  roo_code/roo-context/api/products.md:620 → backend/app/modules/suppliers/shared/models.py:224-224 — нет токена в диапазоне: в 224-224 нет ни одного из: «supplier_price_entries.product_id»
  roo_code/roo-context/api/products.md:621 → backend/app/modules/bcc/shared/models.py:33-33 — нет токена в диапазоне: в 33-33 нет ни одного из: «bcc_events.product_id»
  roo_code/roo-context/api/products.md:630 → backend/app/modules/products/features/archive_product/action.py:22-22 — нет токена в диапазоне: в 22-22 нет ни одного из: «archived_at»
  roo_code/roo-context/api/products.md:651 → services/auditFeedService.ts:57-60 — нет токена в диапазоне: в 57-60 нет ни одного из: «Authorization»
  roo_code/roo-context/api/products.md:654 → services/mocks/index.ts:1503-1503 — нет токена в диапазоне: в 1503-1503 нет ни одного из: «Promise<void>»
  roo_code/roo-context/api/products.md:656 → views/admin/products/ProductCardPage.vue:70-70 — нет токена в диапазоне: в 70-70 нет ни одного из: «withoutRow»
  roo_code/roo-context/api/products.md:663 → composables/useAuditFeed.ts:103-103 — нет токена в диапазоне: в 103-103 нет ни одного из: «auditLog.toast_error_delete», «entryId»
  roo_code/roo-context/api/products.md:667 → services/auditFeedService.ts:49-56 — нет токена в диапазоне: в 49-56 нет ни одного из: «askDeleteAudit»
  roo_code/roo-context/api/products.md:668 → views/admin/products/ProductCardPage.vue:60-63 — нет токена в диапазоне: в 60-63 нет ни одного из: «confirmDeleteAudit»
  roo_code/roo-context/api/products.md:719 → services/mocks/notifications.ts:637-654 — нет токена в диапазоне: в 637-654 нет ни одного из: «notifyStockDeficit»
  roo_code/roo-context/api/products.md:742 → types/warehouse.ts:526-534 — нет токена в диапазоне: в 526-534 нет ни одного из: «sensitive»
  roo_code/roo-context/api/products.md:754 → backend/app/modules/products/shared/models.py:199-199 — нет токена в диапазоне: в 199-199 нет ни одного из: «Text»
  roo_code/roo-context/api/products.md:802 → backend/app/modules/auth/features/me/action.py:36-36 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 36-36
  roo_code/roo-context/api/products.md:811 → views/admin/products/ProductCardPage.vue:35-35 — нет токена в диапазоне: в 35-35 нет ни одного из: «true»
  roo_code/roo-context/api/products.md:822 → backend/app/core/database.py:22-30 — нет токена в диапазоне: в 22-30 нет ни одного из: «flush»
  roo_code/roo-context/api/products.md:864 → backend/app/modules/products/features/get_product_detail/action.py:31-31 — нет токена в диапазоне: в 31-31 нет ни одного из: «UUIDMixin»
  roo_code/roo-context/api/products.md:865 → backend/app/modules/products/shared/models.py:87-87 — нет токена в диапазоне: в 87-87 нет ни одного из: «'prod-114'»
  roo_code/roo-context/api/products.md:914 → composables/useProductCard.ts:122-122 — нет токена в диапазоне: в 122-122 нет ни одного из: «addLinkedSupplier»
  roo_code/roo-context/api/products.md:928 → services/mocks/products.ts:14136-14136 — нет токена в диапазоне: в 14136-14136 нет ни одного из: «Pick<>»
[ссылки] документов 1 · ссылок 411 · битых 29

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

```bash
cd frontend_vue && env CONTRACT_REFS=roo_code/roo-context/api/settings.md ./node_modules/.bin/vitest run src/services/contractRefs.spec.ts
```

Код возврата 0. Вывод:

```
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-2/wt-short-refs-products-settings/frontend_vue

roo_code/roo-context/api/settings.md: ссылок 592, битых 39, глазами 77, без токена 361
  roo_code/roo-context/api/settings.md:75 → mocks/settings.ts:777-777 — нет токена в диапазоне: в 777-777 нет ни одного из: «MAP_NOT_AN_IMAGE»
  roo_code/roo-context/api/settings.md:172 → mocks/settings.ts:469-469 — нет токена в диапазоне: в 469-469 нет ни одного из: «mockGetCompany»
  roo_code/roo-context/api/settings.md:218 → mocks/settings.ts:478-478 — нет токена в диапазоне: в 478-478 нет ни одного из: «mockPatchCompany»
  roo_code/roo-context/api/settings.md:281 → mocks/settings.ts:485-485 — нет токена в диапазоне: в 485-485 нет ни одного из: «mockGetConstants»
  roo_code/roo-context/api/settings.md:336 → mocks/settings.ts:505-505 — нет токена в диапазоне: в 505-505 нет ни одного из: «mockPatchConstants»
  roo_code/roo-context/api/settings.md:459 → mocks/settings.ts:512-512 — нет токена в диапазоне: в 512-512 нет ни одного из: «mockGetCurrencies»
  roo_code/roo-context/api/settings.md:492 → mocks/settings.ts:516-516 — нет токена в диапазоне: в 516-516 нет ни одного из: «mockCreateCurrency»
  roo_code/roo-context/api/settings.md:532 → mocks/settings.ts:525-525 — нет токена в диапазоне: в 525-525 нет ни одного из: «mockUpdateCurrency»
  roo_code/roo-context/api/settings.md:571 → mocks/settings.ts:531-531 — нет токена в диапазоне: в 531-531 нет ни одного из: «mockDeleteCurrency»
  roo_code/roo-context/api/settings.md:608 → mocks/settings.ts:539-539 — нет токена в диапазоне: в 539-539 нет ни одного из: «mockGetUoms»
  roo_code/roo-context/api/settings.md:646 → mocks/settings.ts:558-558 — нет токена в диапазоне: в 558-558 нет ни одного из: «mockCreateUom»
  roo_code/roo-context/api/settings.md:720 → mocks/settings.ts:573-573 — нет токена в диапазоне: в 573-573 нет ни одного из: «mockDeleteUom»
  roo_code/roo-context/api/settings.md:766 → mocks/settings.ts:602-602 — нет токена в диапазоне: в 602-602 нет ни одного из: «mockGetConversions»
  roo_code/roo-context/api/settings.md:808 → mocks/settings.ts:606-606 — нет токена в диапазоне: в 606-606 нет ни одного из: «mockCreateConversion»
  roo_code/roo-context/api/settings.md:847 → mocks/settings.ts:635-635 — нет токена в диапазоне: в 635-635 нет ни одного из: «mockUpdateConversion»
  roo_code/roo-context/api/settings.md:869 → mocks/settings.ts:641-641 — нет токена в диапазоне: в 641-641 нет ни одного из: «mockDeleteConversion»
  roo_code/roo-context/api/settings.md:915 → mocks/settings.ts:649-649 — нет токена в диапазоне: в 649-649 нет ни одного из: «mockGetOrderStatuses»
  roo_code/roo-context/api/settings.md:954 → mocks/settings.ts:653-653 — нет токена в диапазоне: в 653-653 нет ни одного из: «mockCreateOrderStatus»
  roo_code/roo-context/api/settings.md:995 → mocks/settings.ts:663-663 — нет токена в диапазоне: в 663-663 нет ни одного из: «mockUpdateOrderStatus»
  roo_code/roo-context/api/settings.md:1031 → crud/repository.py:318-328 — нет токена в диапазоне: в 318-328 нет ни одного из: «commit»
  roo_code/roo-context/api/settings.md:1040 → mocks/settings.ts:669-669 — нет токена в диапазоне: в 669-669 нет ни одного из: «mockMoveOrderStatus»
  roo_code/roo-context/api/settings.md:1068 → mocks/settings.ts:687-687 — нет токена в диапазоне: в 687-687 нет ни одного из: «mockDeleteOrderStatus»
  roo_code/roo-context/api/settings.md:1112 → mocks/settings.ts:749-749 — нет токена в диапазоне: в 749-749 нет ни одного из: «mockGetProfile»
  roo_code/roo-context/api/settings.md:1145 → mocks/settings.ts:758-758 — нет токена в диапазоне: в 758-758 нет ни одного из: «mockPatchProfile»
  roo_code/roo-context/api/settings.md:1231 → settings/features/mail/action.py:38-38 — нет токена в диапазоне: в 38-38 нет ни одного из: «get_mail_settings»
  roo_code/roo-context/api/settings.md:1236 → mocks/settings.ts:708-708 — нет токена в диапазоне: в 708-708 нет ни одного из: «mockGetMail»
  roo_code/roo-context/api/settings.md:1266 → settings/features/mail/action.py:56-56 — нет токена в диапазоне: в 56-56 нет ни одного из: «patch_mail_settings»
  roo_code/roo-context/api/settings.md:1269 → core/crypto.py:46-46 — нет токена в диапазоне: в 46-46 нет ни одного из: «password»
  roo_code/roo-context/api/settings.md:1272 → mocks/settings.ts:717-717 — нет токена в диапазоне: в 717-717 нет ни одного из: «mockPatchMail»
  roo_code/roo-context/api/settings.md:1304 → settings/features/mail/action.py:75-75 — нет токена в диапазоне: в 75-75 нет ни одного из: «send_mail_test»
  roo_code/roo-context/api/settings.md:1312 → mocks/settings.ts:740-740 — нет токена в диапазоне: в 740-740 нет ни одного из: «mockSendMailTest»
  roo_code/roo-context/api/settings.md:1367 → mocks/settings.ts:769-769 — нет токена в диапазоне: в 769-769 нет ни одного из: «mockGetWarehouseMap»
  roo_code/roo-context/api/settings.md:1382 → mocks/settings.ts:777-777 — нет токена в диапазоне: в 777-777 нет ни одного из: «MAP_NOT_AN_IMAGE»
  roo_code/roo-context/api/settings.md:1405 → mocks/settings.ts:773-773 — нет токена в диапазоне: в 773-773 нет ни одного из: «mockSaveWarehouseMap»
  roo_code/roo-context/api/settings.md:1429 → mocks/settings.ts:783-783 — нет токена в диапазоне: в 783-783 нет ни одного из: «mockDeleteWarehouseMap»
  roo_code/roo-context/api/settings.md:1479 → mocks/settings.ts:496-496 — нет токена в диапазоне: в 496-496 нет ни одного из: «mockGetOrderPermissions»
  roo_code/roo-context/api/settings.md:1580 → models.py:51-51 — нет токена в диапазоне: в 51-51 нет ни одного из: «logo_file_id»
  roo_code/roo-context/api/settings.md:1673 → crud/repository.py:318-328 — нет токена в диапазоне: в 318-328 нет ни одного из: «UPDATE», «commit»
  roo_code/roo-context/api/settings.md:1678 → mocks/settings.ts:777-777 — нет токена в диапазоне: в 777-777 нет ни одного из: «MAP_NOT_AN_IMAGE», «ApiRequestError», «code»
[ссылки] документов 1 · ссылок 592 · битых 39

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

**Битых до правки: 29 у товаров и 39 у настроек.** Ни одна из записей этих двух списков не
является короткой ссылкой из переписи: все они полные (`путь:строка`) либо унаследовали путь от
полной ссылки абзаца, поэтому ни одна из них моей правкой не затрагивалась и не могла быть
затронута.

## Проверка резолвером — после правки

Те же обе команды на том же дереве, после двух подстановок в документе товаров.

```bash
cd frontend_vue && env CONTRACT_REFS=roo_code/roo-context/api/products.md ./node_modules/.bin/vitest run src/services/contractRefs.spec.ts
```

Код возврата 0. Вывод:

```
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-2/wt-short-refs-products-settings/frontend_vue

roo_code/roo-context/api/products.md: ссылок 411, битых 29, глазами 28, без токена 276
  roo_code/roo-context/api/products.md:80 → services/mocks/products.ts:14225-14225 — нет токена в диапазоне: в 14225-14225 нет ни одного из: «PRODUCT_IN_USE»
  roo_code/roo-context/api/products.md:81 → services/mocks/products.ts:14234-14234 — нет токена в диапазоне: в 14234-14234 нет ни одного из: «AUDIT_ENTRY_NOT_FOUND»
  roo_code/roo-context/api/products.md:103 → composables/useProductCard.ts:260-260 — нет токена в диапазоне: в 260-260 нет ни одного из: «msg.status_error»
  roo_code/roo-context/api/products.md:104 → views/admin/products/ProductCardPage.vue:73-73 — нет токена в диапазоне: в 73-73 нет ни одного из: «auditLog.toast_error_delete»
  roo_code/roo-context/api/products.md:127 → services/mocks/index.ts:567-567 — нет токена в диапазоне: в 567-567 нет ни одного из: «sortBy»
  roo_code/roo-context/api/products.md:299 → services/mocks/products.ts:31-31 — нет токена в диапазоне: в 31-31 нет ни одного из: «prod-001»
  roo_code/roo-context/api/products.md:339 → backend/app/modules/products/features/get_product_detail/domain.py:59-68 — нет токена в диапазоне: в 59-68 нет ни одного из: «categoryId», «categoryName»
  roo_code/roo-context/api/products.md:471 → views/admin/products/ProductsPage.vue:197-220 — нет токена в диапазоне: в 197-220 нет ни одного из: «catch»
  roo_code/roo-context/api/products.md:529 → composables/useProductCard.ts:243-255 — нет токена в диапазоне: в 243-255 нет ни одного из: «dirty.isDirty»
  roo_code/roo-context/api/products.md:549 → services/mocks/products.ts:14117-14218 — нет токена в диапазоне: в 14117-14218 нет ни одного из: «products.toast_error»
  roo_code/roo-context/api/products.md:620 → backend/app/modules/suppliers/shared/models.py:224-224 — нет токена в диапазоне: в 224-224 нет ни одного из: «supplier_price_entries.product_id»
  roo_code/roo-context/api/products.md:621 → backend/app/modules/bcc/shared/models.py:33-33 — нет токена в диапазоне: в 33-33 нет ни одного из: «bcc_events.product_id»
  roo_code/roo-context/api/products.md:630 → backend/app/modules/products/features/archive_product/action.py:22-22 — нет токена в диапазоне: в 22-22 нет ни одного из: «archived_at»
  roo_code/roo-context/api/products.md:651 → services/auditFeedService.ts:57-60 — нет токена в диапазоне: в 57-60 нет ни одного из: «Authorization»
  roo_code/roo-context/api/products.md:654 → services/mocks/index.ts:1503-1503 — нет токена в диапазоне: в 1503-1503 нет ни одного из: «Promise<void>»
  roo_code/roo-context/api/products.md:656 → views/admin/products/ProductCardPage.vue:70-70 — нет токена в диапазоне: в 70-70 нет ни одного из: «withoutRow»
  roo_code/roo-context/api/products.md:663 → composables/useAuditFeed.ts:103-103 — нет токена в диапазоне: в 103-103 нет ни одного из: «auditLog.toast_error_delete», «entryId»
  roo_code/roo-context/api/products.md:667 → services/auditFeedService.ts:49-56 — нет токена в диапазоне: в 49-56 нет ни одного из: «askDeleteAudit»
  roo_code/roo-context/api/products.md:668 → views/admin/products/ProductCardPage.vue:60-63 — нет токена в диапазоне: в 60-63 нет ни одного из: «confirmDeleteAudit»
  roo_code/roo-context/api/products.md:719 → services/mocks/notifications.ts:637-654 — нет токена в диапазоне: в 637-654 нет ни одного из: «notifyStockDeficit»
  roo_code/roo-context/api/products.md:742 → types/warehouse.ts:526-534 — нет токена в диапазоне: в 526-534 нет ни одного из: «sensitive»
  roo_code/roo-context/api/products.md:754 → backend/app/modules/products/shared/models.py:199-199 — нет токена в диапазоне: в 199-199 нет ни одного из: «Text»
  roo_code/roo-context/api/products.md:802 → backend/app/modules/auth/features/me/action.py:36-36 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 36-36
  roo_code/roo-context/api/products.md:811 → views/admin/products/ProductCardPage.vue:35-35 — нет токена в диапазоне: в 35-35 нет ни одного из: «true»
  roo_code/roo-context/api/products.md:822 → backend/app/core/database.py:22-30 — нет токена в диапазоне: в 22-30 нет ни одного из: «flush»
  roo_code/roo-context/api/products.md:864 → backend/app/modules/products/features/get_product_detail/action.py:31-31 — нет токена в диапазоне: в 31-31 нет ни одного из: «UUIDMixin»
  roo_code/roo-context/api/products.md:865 → backend/app/modules/products/shared/models.py:87-87 — нет токена в диапазоне: в 87-87 нет ни одного из: «'prod-114'»
  roo_code/roo-context/api/products.md:914 → composables/useProductCard.ts:122-122 — нет токена в диапазоне: в 122-122 нет ни одного из: «addLinkedSupplier»
  roo_code/roo-context/api/products.md:928 → services/mocks/products.ts:14136-14136 — нет токена в диапазоне: в 14136-14136 нет ни одного из: «Pick<>»
[ссылки] документов 1 · ссылок 411 · битых 29

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

```bash
cd frontend_vue && env CONTRACT_REFS=roo_code/roo-context/api/settings.md ./node_modules/.bin/vitest run src/services/contractRefs.spec.ts
```

Код возврата 0. Вывод:

```
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-2/wt-short-refs-products-settings/frontend_vue

roo_code/roo-context/api/settings.md: ссылок 592, битых 39, глазами 77, без токена 361
  roo_code/roo-context/api/settings.md:75 → mocks/settings.ts:777-777 — нет токена в диапазоне: в 777-777 нет ни одного из: «MAP_NOT_AN_IMAGE»
  roo_code/roo-context/api/settings.md:172 → mocks/settings.ts:469-469 — нет токена в диапазоне: в 469-469 нет ни одного из: «mockGetCompany»
  roo_code/roo-context/api/settings.md:218 → mocks/settings.ts:478-478 — нет токена в диапазоне: в 478-478 нет ни одного из: «mockPatchCompany»
  roo_code/roo-context/api/settings.md:281 → mocks/settings.ts:485-485 — нет токена в диапазоне: в 485-485 нет ни одного из: «mockGetConstants»
  roo_code/roo-context/api/settings.md:336 → mocks/settings.ts:505-505 — нет токена в диапазоне: в 505-505 нет ни одного из: «mockPatchConstants»
  roo_code/roo-context/api/settings.md:459 → mocks/settings.ts:512-512 — нет токена в диапазоне: в 512-512 нет ни одного из: «mockGetCurrencies»
  roo_code/roo-context/api/settings.md:492 → mocks/settings.ts:516-516 — нет токена в диапазоне: в 516-516 нет ни одного из: «mockCreateCurrency»
  roo_code/roo-context/api/settings.md:532 → mocks/settings.ts:525-525 — нет токена в диапазоне: в 525-525 нет ни одного из: «mockUpdateCurrency»
  roo_code/roo-context/api/settings.md:571 → mocks/settings.ts:531-531 — нет токена в диапазоне: в 531-531 нет ни одного из: «mockDeleteCurrency»
  roo_code/roo-context/api/settings.md:608 → mocks/settings.ts:539-539 — нет токена в диапазоне: в 539-539 нет ни одного из: «mockGetUoms»
  roo_code/roo-context/api/settings.md:646 → mocks/settings.ts:558-558 — нет токена в диапазоне: в 558-558 нет ни одного из: «mockCreateUom»
  roo_code/roo-context/api/settings.md:720 → mocks/settings.ts:573-573 — нет токена в диапазоне: в 573-573 нет ни одного из: «mockDeleteUom»
  roo_code/roo-context/api/settings.md:766 → mocks/settings.ts:602-602 — нет токена в диапазоне: в 602-602 нет ни одного из: «mockGetConversions»
  roo_code/roo-context/api/settings.md:808 → mocks/settings.ts:606-606 — нет токена в диапазоне: в 606-606 нет ни одного из: «mockCreateConversion»
  roo_code/roo-context/api/settings.md:847 → mocks/settings.ts:635-635 — нет токена в диапазоне: в 635-635 нет ни одного из: «mockUpdateConversion»
  roo_code/roo-context/api/settings.md:869 → mocks/settings.ts:641-641 — нет токена в диапазоне: в 641-641 нет ни одного из: «mockDeleteConversion»
  roo_code/roo-context/api/settings.md:915 → mocks/settings.ts:649-649 — нет токена в диапазоне: в 649-649 нет ни одного из: «mockGetOrderStatuses»
  roo_code/roo-context/api/settings.md:954 → mocks/settings.ts:653-653 — нет токена в диапазоне: в 653-653 нет ни одного из: «mockCreateOrderStatus»
  roo_code/roo-context/api/settings.md:995 → mocks/settings.ts:663-663 — нет токена в диапазоне: в 663-663 нет ни одного из: «mockUpdateOrderStatus»
  roo_code/roo-context/api/settings.md:1031 → crud/repository.py:318-328 — нет токена в диапазоне: в 318-328 нет ни одного из: «commit»
  roo_code/roo-context/api/settings.md:1040 → mocks/settings.ts:669-669 — нет токена в диапазоне: в 669-669 нет ни одного из: «mockMoveOrderStatus»
  roo_code/roo-context/api/settings.md:1068 → mocks/settings.ts:687-687 — нет токена в диапазоне: в 687-687 нет ни одного из: «mockDeleteOrderStatus»
  roo_code/roo-context/api/settings.md:1112 → mocks/settings.ts:749-749 — нет токена в диапазоне: в 749-749 нет ни одного из: «mockGetProfile»
  roo_code/roo-context/api/settings.md:1145 → mocks/settings.ts:758-758 — нет токена в диапазоне: в 758-758 нет ни одного из: «mockPatchProfile»
  roo_code/roo-context/api/settings.md:1231 → settings/features/mail/action.py:38-38 — нет токена в диапазоне: в 38-38 нет ни одного из: «get_mail_settings»
  roo_code/roo-context/api/settings.md:1236 → mocks/settings.ts:708-708 — нет токена в диапазоне: в 708-708 нет ни одного из: «mockGetMail»
  roo_code/roo-context/api/settings.md:1266 → settings/features/mail/action.py:56-56 — нет токена в диапазоне: в 56-56 нет ни одного из: «patch_mail_settings»
  roo_code/roo-context/api/settings.md:1269 → core/crypto.py:46-46 — нет токена в диапазоне: в 46-46 нет ни одного из: «password»
  roo_code/roo-context/api/settings.md:1272 → mocks/settings.ts:717-717 — нет токена в диапазоне: в 717-717 нет ни одного из: «mockPatchMail»
  roo_code/roo-context/api/settings.md:1304 → settings/features/mail/action.py:75-75 — нет токена в диапазоне: в 75-75 нет ни одного из: «send_mail_test»
  roo_code/roo-context/api/settings.md:1312 → mocks/settings.ts:740-740 — нет токена в диапазоне: в 740-740 нет ни одного из: «mockSendMailTest»
  roo_code/roo-context/api/settings.md:1367 → mocks/settings.ts:769-769 — нет токена в диапазоне: в 769-769 нет ни одного из: «mockGetWarehouseMap»
  roo_code/roo-context/api/settings.md:1382 → mocks/settings.ts:777-777 — нет токена в диапазоне: в 777-777 нет ни одного из: «MAP_NOT_AN_IMAGE»
  roo_code/roo-context/api/settings.md:1405 → mocks/settings.ts:773-773 — нет токена в диапазоне: в 773-773 нет ни одного из: «mockSaveWarehouseMap»
  roo_code/roo-context/api/settings.md:1429 → mocks/settings.ts:783-783 — нет токена в диапазоне: в 783-783 нет ни одного из: «mockDeleteWarehouseMap»
  roo_code/roo-context/api/settings.md:1479 → mocks/settings.ts:496-496 — нет токена в диапазоне: в 496-496 нет ни одного из: «mockGetOrderPermissions»
  roo_code/roo-context/api/settings.md:1580 → models.py:51-51 — нет токена в диапазоне: в 51-51 нет ни одного из: «logo_file_id»
  roo_code/roo-context/api/settings.md:1673 → crud/repository.py:318-328 — нет токена в диапазоне: в 318-328 нет ни одного из: «UPDATE», «commit»
  roo_code/roo-context/api/settings.md:1678 → mocks/settings.ts:777-777 — нет токена в диапазоне: в 777-777 нет ни одного из: «MAP_NOT_AN_IMAGE», «ApiRequestError», «code»
[ссылки] документов 1 · ссылок 592 · битых 39

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

**Сравнение построчное по каждому документу.** У настроек — все 39 записей до и после совпадают
посимвольно: тот же текст, те же номера строк документа и диапазоны; документ этой задачей не
менялся, отчёт обязан совпасть. У товаров — те же 29 записей, тот же текст, те же номера и
диапазоны; ни одной новой записи не появилось, ни одна старая не пропала. **Битых после правки:
29 у товаров (не выросло) и 39 у настроек (не выросло).**

Отдельно названо наблюдение: у товаров «глазами» уменьшилось с 30 до 28 — обе исправленные
ссылки перестали быть слепыми и попали под проверку по содержимому. Обе остались зелёными.

**Почему счёт резолвера не мог измениться, и это ожидаемо, а не провал проверки.** Резолвер судит
ссылку, только если рядом с ней стоит греппабельный токен. У двух исправленных коротких ссылок
содержимое бэктиков самой ссылки — `:440` и `:48` — под запрет «похоже на ссылку» (`:\d`) и
токеном не считается; короткая ссылка наследует путь полной ссылки той же строки и остаётся
непроверенной по содержимому. Значит её номер резолвер не судит вовсе и увидеть подмену не может
— ни до, ни после. Критерий здесь выполняется в том, что счёт **не вырос**, а принадлежность
токенов доказана точечным грепом выше.

## Мутационная проверка

### Товары — возврат каждого исправленного номера к прежнему значению ломает утверждение

```bash
cd frontend_vue
sed -n '440p' src/services/mocks/index.ts | grep -cF "'/api/products/list'"   # 0
sed -n '48p' src/composables/useProducts.ts | grep -cF "products.toast_deleted"   # 0
sed -n '551p' src/services/mocks/index.ts | grep -cF "'/api/products/list'"   # 1
sed -n '49p' src/composables/useProducts.ts | grep -cF "products.toast_deleted"   # 1
```

Возврат номера 551 к 440 печатает строку без искомого токена, возврат 49 к 48 — тоже: `grep -c`
даёт 0 обе, тогда как на новых номерах те же токены находятся по разу. Ссылка, поставленная по
прежнему значению, опровергала бы предложение; поставленная по новому — подтверждает.

### Настройки — доказуемо исправимых ссылок не нашлось, мутация делается на самом разборе

Ни одной правки в этом документе нет, поэтому вместо мутации ссылок проверена сама перепись:
временное удаление одной короткой ссылки на копии во временном каталоге уменьшает счёт грепа ровно
на единицу, а исходный документ остаётся неизменным.

```bash
cp roo_code/roo-context/api/settings.md "$TMPDIR/settings-mut.md"
grep -cF ':1393' "$TMPDIR/settings-mut.md"    # 1 — ссылка в копии есть
perl -0pi -e 's/`mocks\/orders\.ts:1860`, `:1393`/`mocks\/orders.ts:1860`/' "$TMPDIR/settings-mut.md"
grep -oP '(?<![\w:.,/-]):\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*(?![\w:])' "$TMPDIR/settings-mut.md" | wc -l   # 38
grep -oP '(?<![\w:.,/-]):\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*(?![\w:])' roo_code/roo-context/api/settings.md | wc -l   # 39
wc -l < roo_code/roo-context/api/settings.md   # 1786
git diff --stat -- roo_code/roo-context/api/settings.md   # пусто
```

Счёт 39 → 38 ровно на единицу, подлинник остался 39, число строк документа не изменилось,
`git diff` по нему пуст. Перепись считает те же ссылки, что грепает, и на единицу больше не
находит ни одной.

## Перепись — 110 строк по товарам, по строке на короткую ссылку

Колонки: «строка документа» — номер строки в самом документе; «было» и «стало» — номера голыми
числами в своих колонках; «токен» — код в бэктиках, по которому проверялась правка.

| № | строка документа | подразумеваемый файл | было | стало | токен | вердикт | причина |
|---|---|---|---|---|---|---|---|
| 1 | 19 | backend/app/modules/products/features/list_products/action.py | 55 | — | — | отдано глазам | файл не назван |
| 2 | 28 | services/productsService.ts | 25 | — | — | отдано глазам | токена рядом нет |
| 3 | 28 | services/productsService.ts | 58 | — | — | отдано глазам | токена рядом нет |
| 4 | 28 | services/productsService.ts | 111 | — | — | отдано глазам | токена рядом нет |
| 5 | 28 | services/productsService.ts | 117 | — | — | отдано глазам | токена рядом нет |
| 6 | 28 | services/productsService.ts | 121 | — | — | отдано глазам | токена рядом нет |
| 7 | 28 | services/productsService.ts | 125 | — | — | отдано глазам | токена рядом нет |
| 8 | 32 | backend/app/modules/products/shared/models.py | 62 | — | — | отдано глазам | токена рядом нет |
| 9 | 32 | backend/app/modules/products/shared/models.py | 99 | — | — | отдано глазам | токена рядом нет |
| 10 | 32 | backend/app/modules/products/shared/models.py | 189 | — | — | отдано глазам | токена рядом нет |
| 11 | 33 | backend/alembic/versions/25245d4bf874_phase_3_categories_products.py | 42 | — | — | отдано глазам | токена рядом нет |
| 12 | 33 | backend/alembic/versions/25245d4bf874_phase_3_categories_products.py | 57 | — | — | отдано глазам | токена рядом нет |
| 13 | 33 | backend/alembic/versions/25245d4bf874_phase_3_categories_products.py | 73 | — | — | отдано глазам | токена рядом нет |
| 14 | 43 | services/productsService.ts, types/product.ts | 86-111 | — | — | отдано глазам | два пути на строке |
| 15 | 45 | backend/app/modules/settings/features/crud/schemas.py | 157 | — | — | отдано глазам | файл не назван |
| 16 | 45 | backend/app/modules/settings/features/crud/schemas.py | 169 | — | — | отдано глазам | файл не назван |
| 17 | 55 | composables/useProducts.ts | 27-43 | — | — | отдано глазам | файл не назван |
| 18 | 55 | composables/useProducts.ts | 45-58 | — | — | отдано глазам | файл не назван |
| 19 | 57 | composables/useProductCard.ts | 167-227 | — | — | отдано глазам | файл не назван |
| 20 | 57 | composables/useProductCard.ts | 229-264 | — | — | отдано глазам | файл не назван |
| 21 | 79 | services/mocks/products.ts | 14232 | — | `DELETE /api/products/:id/audit/:id` | отдано глазам | токен не найден |
| 22 | 99 | services/api.ts | 117-124 | — | — | отдано глазам | токена рядом нет |
| 23 | 101 | i18n/admin/products.ts | 327 | — | — | отдано глазам | токена рядом нет |
| 24 | 101 | i18n/admin/products.ts | 590 | — | — | отдано глазам | токена рядом нет |
| 25 | 192 | — | 13961 | — | — | отдано глазам | файл не назван |
| 26 | 197 | — | 13965-13974 | — | — | отдано глазам | файл не назван |
| 27 | 198 | — | 13969-13970 | — | — | отдано глазам | файл не назван |
| 28 | 208 | — | 73-79 | — | — | отдано глазам | файл не назван |
| 29 | 263 | services/mocks/index.ts | 440 | 551 | `'/api/products/list'` | поправлена | — |
| 30 | 264 | — | 449 | — | — | отдано глазам | файл не назван |
| 31 | 268 | composables/useProductNames.ts | 25-36 | — | `inflight` | отдано глазам | токен найден многократно |
| 32 | 269 | composables/useProductNames.ts | 31-33 | — | — | отдано глазам | файл не назван |
| 33 | 273 | composables/useWarehouse.ts | 245 | — | `Promise.all` | отдано глазам | токен найден многократно |
| 34 | 273 | composables/useWarehouse.ts | 271 | — | `Promise.all` | отдано глазам | токен найден многократно |
| 35 | 275 | composables/useWarehouseMovementCard.ts, composables/useWarehouseCutting.ts | 146 | — | — | отдано глазам | два пути на строке |
| 36 | 294 | composables/useProductCard.ts | 258 | — | — | отдано глазам | токена рядом нет |
| 37 | 331 | backend/app/modules/products/features/get_product_detail/schemas.py | 9-14 | — | — | отдано глазам | токена рядом нет |
| 38 | 332 | backend/app/modules/products/features/get_product_detail/domain.py | 17-22 | — | — | отдано глазам | токена рядом нет |
| 39 | 346 | backend/app/modules/products/features/get_product_detail/domain.py | 77-79 | — | — | отдано глазам | токена рядом нет |
| 40 | 353 | types/product.ts | 103 | — | `weightPerWarehouseUnitKg` | отдано глазам | номер уже верен |
| 41 | 353 | types/product.ts | 107-108 | — | `weightPerWarehouseUnitKg` | отдано глазам | диапазон: доказательства нет |
| 42 | 428 | services/productsService.ts, types/i18n.ts | 51 | — | — | отдано глазам | два пути на строке |
| 43 | 457 | features/create_product/domain.py, features/create_product/action.py | 38-42 | — | — | отдано глазам | два пути на строке |
| 44 | 470 | views/admin/products/ProductsPage.vue | 540 | — | `disabled` | отдано глазам | файл не назван |
| 45 | 493 | composables/useProductCard.ts | 105-107 | — | `isAnythingDirty` | отдано глазам | токен найден многократно |
| 46 | 521 | services/mocks/products.ts | 235 | — | — | отдано глазам | токена рядом нет |
| 47 | 521 | services/mocks/products.ts | 14201-14204 | — | — | отдано глазам | токена рядом нет |
| 48 | 530 | composables/useProductCard.ts | 93-95 | — | — | отдано глазам | файл не назван |
| 49 | 530 | composables/useProductCard.ts | 101-103 | — | — | отдано глазам | файл не назван |
| 50 | 544 | services/mocks/products.ts | 14145 | — | `null` | отдано глазам | токен найден многократно |
| 51 | 545 | services/mocks/products.ts | 14143 | — | — | отдано глазам | файл не назван |
| 52 | 552 | composables/useProductCard.ts | 247 | — | — | отдано глазам | файл не назван |
| 53 | 552 | composables/useProductCard.ts | 238-241 | — | — | отдано глазам | файл не назван |
| 54 | 579 | composables/useProducts.ts | 48 | 49 | `products.toast_deleted` | поправлена | — |
| 55 | 580 | composables/useProducts.ts | 49 | — | — | отдано глазам | файл не назван |
| 56 | 590 | services/mocks/products.ts | 14225 | — | `PRODUCT_IN_USE` | отдано глазам | токен найден многократно |
| 57 | 592 | — | 14224 | — | `new Set(['prod-001', 'prod-005', 'prod-010'])` | отдано глазам | файл не назван |
| 58 | 593 | services/mocks/products.ts | 1-18 | — | — | отдано глазам | токена рядом нет |
| 59 | 652 | — | 20-24 | — | — | отдано глазам | файл не назван |
| 60 | 652 | — | 41 | — | — | отдано глазам | файл не назван |
| 61 | 652 | — | 46 | — | — | отдано глазам | файл не назван |
| 62 | 660 | services/mocks/products.ts | 14234 | — | — | отдано глазам | токена рядом нет |
| 63 | 669 | — | 65-78 | — | — | отдано глазам | файл не назван |
| 64 | 680 | backend/app/modules/products/shared/models.py | 62 | — | — | отдано глазам | токена рядом нет |
| 65 | 680 | backend/app/modules/products/shared/models.py | 99 | — | — | отдано глазам | токена рядом нет |
| 66 | 680 | backend/app/modules/products/shared/models.py | 189 | — | — | отдано глазам | токена рядом нет |
| 67 | 739 | services/mocks/products.ts | 14230-14236 | — | — | отдано глазам | токена рядом нет |
| 68 | 740 | services/mocks/products.ts | 14213 | — | `mockPatchProduct` | отдано глазам | файл не назван |
| 69 | 740 | services/mocks/products.ts | 14110 | — | `mockCreateProduct` | отдано глазам | файл не назван |
| 70 | 752 | — | 14047-14052 | — | — | отдано глазам | файл не назван |
| 71 | 755 | — | 210-214 | — | `(product_id, field_id)` | отдано глазам | файл не назван |
| 72 | 765 | views/admin/products/ProductsPage.vue | 518 | — | — | отдано глазам | токена рядом нет |
| 73 | 765 | views/admin/products/ProductsPage.vue | 526 | — | — | отдано глазам | токена рядом нет |
| 74 | 766 | — | 158-165 | — | — | отдано глазам | файл не назван |
| 75 | 770 | composables/useProductCard.ts | 182-186 | — | — | отдано глазам | токена рядом нет |
| 76 | 770 | composables/useProductCard.ts | 270-303 | — | — | отдано глазам | токена рядом нет |
| 77 | 777 | services/mocks/products.ts | 13970 | — | `name.en` | отдано глазам | токен найден многократно |
| 78 | 784 | backend/alembic/versions/25245d4bf874_phase_3_categories_products.py | 191-196 | — | — | отдано глазам | токена рядом нет |
| 79 | 785 | — | 76 | — | — | отдано глазам | файл не назван |
| 80 | 795 | backend/app/modules/products/internal_api/interface.py | 63-70 | — | — | отдано глазам | токена рядом нет |
| 81 | 810 | router/index.ts | 226 | — | — | отдано глазам | токена рядом нет |
| 82 | 812 | config/featureFlags.ts | 38 | — | — | отдано глазам | токена рядом нет |
| 83 | 819 | services/api.ts | 205 | — | `Content-Type` | отдано глазам | токен найден многократно |
| 84 | 836 | — | 13891-13895 | — | `avgSalePrice` | отдано глазам | файл не назван |
| 85 | 837 | — | 13905-13918 | — | — | отдано глазам | файл не назван |
| 86 | 838 | — | 13920 | — | — | отдано глазам | файл не назван |
| 87 | 838 | — | 14112 | — | — | отдано глазам | файл не назван |
| 88 | 838 | — | 14215 | — | — | отдано глазам | файл не назван |
| 89 | 845 | backend/app/modules/products/features/get_product_detail/domain.py | 77-79 | — | `sale_uom_id` | отдано глазам | токен найден многократно |
| 90 | 851 | services/mocks/products.ts | 14026-14030 | — | — | отдано глазам | токена рядом нет |
| 91 | 871 | — | 14226 | — | `STORE.splice(idx, 1)` | отдано глазам | файл не назван |
| 92 | 901 | types/product.ts | 55 | — | — | отдано глазам | токена рядом нет |
| 93 | 907 | views/admin/products/ProductCardPage.vue | 211 | — | `currency` | отдано глазам | токен найден многократно |
| 94 | 908 | views/admin/products/ProductCardPage.vue | 209 | — | — | отдано глазам | файл не назван |
| 95 | 911 | — | 637-641 | — | — | отдано глазам | файл не назван |
| 96 | 911 | — | 650-654 | — | — | отдано глазам | файл не назван |
| 97 | 920 | — | 141-144 | — | — | отдано глазам | файл не назван |
| 98 | 935 | — | 182-186 | — | — | отдано глазам | файл не назван |
| 99 | 935 | — | 200 | — | — | отдано глазам | файл не назван |
| 100 | 935 | — | 202 | — | — | отдано глазам | файл не назван |
| 101 | 935 | — | 270-303 | — | — | отдано глазам | файл не назван |
| 102 | 958 | 03-api-contract.md, types/product.ts, services/mocks/products.ts | 58 | — | — | отдано глазам | два пути на строке |
| 103 | 958 | 03-api-contract.md, types/product.ts, services/mocks/products.ts | 62 | — | — | отдано глазам | два пути на строке |
| 104 | 958 | 03-api-contract.md, types/product.ts, services/mocks/products.ts | 11 | — | — | отдано глазам | два пути на строке |
| 105 | 958 | 03-api-contract.md, types/product.ts, services/mocks/products.ts | 15 | — | — | отдано глазам | два пути на строке |
| 106 | 958 | 03-api-contract.md, types/product.ts, services/mocks/products.ts | 13927 | — | — | отдано глазам | два пути на строке |
| 107 | 963 | 03-api-contract.md, services/mocks/products.ts, services/mocks/index.ts, types/api.ts, services/api.ts | 1-18 | — | — | отдано глазам | два пути на строке |
| 108 | 973 | 03-api-contract.md, router/index.ts, views/admin/products/ProductCardPage.vue, config/featureFlags.ts | 250 | — | — | отдано глазам | два пути на строке |
| 109 | 973 | 03-api-contract.md, router/index.ts, views/admin/products/ProductCardPage.vue, config/featureFlags.ts | 226 | — | — | отдано глазам | два пути на строке |
| 110 | 973 | 03-api-contract.md, router/index.ts, views/admin/products/ProductCardPage.vue, config/featureFlags.ts | 38 | — | — | отдано глазам | два пути на строке |

**Итого по товарам: 110 строк = 110 коротким ссылкам.** Поправлено 2, отдано глазам 108.

## Перепись — 39 строк по настройкам

| № | строка документа | подразумеваемый файл | было | стало | токен | вердикт | причина |
|---|---|---|---|---|---|---|---|
| 1 | 70 | services/mocks/settings.ts | 477 | — | `CURRENCY_NOT_FOUND` | отдано глазам | токен не про этот номер |
| 2 | 71 | services/mocks/settings.ts | 504 | — | `UOM_NOT_FOUND` | отдано глазам | токен не про этот номер |
| 3 | 72 | services/mocks/settings.ts | 531 | — | `CONVERSION_NOT_FOUND` | отдано глазам | токен не про этот номер |
| 4 | 73 | services/mocks/settings.ts | 577 | — | `ORDER_STATUS_NOT_FOUND` | отдано глазам | токен не про этот номер |
| 5 | 115 | composables/useSettings.ts | 258-264 | — | — | отдано глазам | токена рядом нет |
| 6 | 148 | backend/app/modules/settings/features/crud/schemas.py | 26-34 | — | — | отдано глазам | токена рядом нет |
| 7 | 212 | backend/app/modules/settings/features/crud/domain.py | 166 | — | — | отдано глазам | токена рядом нет |
| 8 | 371 | models.py (15 файлов с этим именем) | 42 | — | `unique=True` | отдано глазам | путь неоднозначен |
| 9 | 371 | models.py (15 файлов с этим именем) | 77 | — | `unique=True` | отдано глазам | путь неоднозначен |
| 10 | 371 | models.py (15 файлов с этим именем) | 99 | — | `unique=True` | отдано глазам | путь неоднозначен |
| 11 | 371 | models.py (15 файлов с этим именем) | 117 | — | `unique=True` | отдано глазам | путь неоднозначен |
| 12 | 371 | models.py (15 файлов с этим именем) | 149 | — | `unique=True` | отдано глазам | путь неоднозначен |
| 13 | 372 | — | 21 | — | — | отдано глазам | файл не назван |
| 14 | 372 | — | 46 | — | — | отдано глазам | файл не назван |
| 15 | 376 | composables/useWarehouseBatch.ts | 208 | — | `settings.constants` | отдано глазам | токен найден многократно |
| 16 | 376 | composables/useWarehouseBatch.ts | 286 | — | `settings.constants` | отдано глазам | токен найден многократно |
| 17 | 376 | composables/useWarehouseBatch.ts | 316 | — | `settings.constants` | отдано глазам | токен найден многократно |
| 18 | 394 | backend/app/modules/settings/features/crud/domain.py | 711-716 | — | — | отдано глазам | токена рядом нет |
| 19 | 400 | composables/useWarehouseCutting.ts | 195 | — | — | отдано глазам | токена рядом нет |
| 20 | 510 | — | 379 | — | — | отдано глазам | файл не назван |
| 21 | 569 | — | 317-319 | — | `CURRENCY_IS_DEFAULT` | отдано глазам | файл не назван |
| 22 | 569 | — | 325 | — | `CURRENCY_IN_USE` | отдано глазам | файл не назван |
| 23 | 632 | views/admin/settings/SettingsLayout.vue | 190 | — | `isUomCodeDuplicate` | отдано глазам | токен найден многократно |
| 24 | 1107 | backend/app/modules/settings/features/profile/action.py | 31 | — | `UNAUTHORIZED` | отдано глазам | токен не найден |
| 25 | 1107 | backend/app/modules/settings/features/profile/action.py | 31 | — | `UNAUTHORIZED` | отдано глазам | токен не найден |
| 26 | 1306 | — | 123 | — | — | отдано глазам | файл не назван |
| 27 | 1462 | services/mocks/orders.ts | 1393 | — | — | отдано глазам | токена рядом нет |
| 28 | 1549 | backend/app/modules/settings/features/profile/domain.py | 107 | — | — | отдано глазам | токена рядом нет |
| 29 | 1551 | — | 395 | — | — | отдано глазам | файл не назван |
| 30 | 1562 | composables/useSettings.ts | 533 | — | `takeSnapshot()` | отдано глазам | токен найден многократно |
| 31 | 1566 | composables/useSettings.ts | 515-517 | — | — | отдано глазам | токена рядом нет |
| 32 | 1571 | backend/app/modules/settings/features/crud/repository.py | 42 | — | — | отдано глазам | токена рядом нет |
| 33 | 1581 | backend/app/modules/settings/features/crud/domain.py | 166 | — | — | отдано глазам | токена рядом нет |
| 34 | 1665 | composables/useSettings.ts | 366 | — | — | отдано глазам | токена рядом нет |
| 35 | 1665 | composables/useSettings.ts | 376-377 | — | — | отдано глазам | токена рядом нет |
| 36 | 1665 | composables/useSettings.ts | 526 | — | — | отдано глазам | токена рядом нет |
| 37 | 1674 | mocks/settings.ts, backend/app/core/base.py | 490 | — | — | отдано глазам | два пути на строке |
| 38 | 1674 | mocks/settings.ts, backend/app/core/base.py | 544 | — | — | отдано глазам | два пути на строке |
| 39 | 1682 | services/mocks/index.ts | 1151 | — | `PUT /api/settings` | отдано глазам | токен не найден |

**Итого по настройкам: 39 строк = 39 коротким ссылкам.** Поправлено 0, отдано глазам 39.

**Всего: 149 коротких ссылок, поправлено 2, отдано глазам 147.** Сумма причин по строкам «отдано
глазам»: «два пути на строке» — 13 + 2 = 15, «токена рядом нет» — 37 + 13 = 50, «файл не назван» —
45 + 7 = 52, «токен найден многократно» — 10 + 5 = 15, «токен не найден» — 1 + 3 = 4, «диапазон:
доказательства нет» — 1, «номер уже верен» — 1, «путь неоднозначен» — 5, «токен не про этот
номер» — 4. Сумма 15 + 50 + 52 + 15 + 4 + 1 + 1 + 5 + 4 = 147 сходится с числом строк «отдано
глазам». С вердиктами: 2 + 147 = 149 сходится с длиной обеих таблиц и с грепом.

### Как читалась причина

- **«два пути на строке»** — на строке ссылки два и более разных путей: контекст определяется
  неверно, ссылка не трогается (ограничитель 1). Пример — строка 43 товаров, где рядом стоят
  `services/productsService.ts` и `types/product.ts`, и строка 973, где путей четыре.
- **«файл не назван»** — на ТОЙ ЖЕ строке нет ни одного кода в бэктиках, который читался бы как
  путь. Ссылка стоит одна, во второй половине предложения, а путь остался на предыдущей строке абзаца.
- **«токена рядом нет»** — файл назван, но рядом со ссылкой нет кода в бэктиках, который можно
  грепнуть по этому файлу и который подтвердил бы номер. Проверять нечего.
- **«токен не найден»** — код рядом есть, но в подразумеваемом файле его нет ни разу.
- **«токен найден многократно»** — код рядом есть и встречается в файле больше одного раза;
  какой из номеров он утверждает, машина не знает. Пример — `PRODUCT_IN_USE`, найденный дважды.
- **«номер уже верен»** — единственная короткая ссылка, чей номер совпал с единственным
  вхождением своего токена: ссылка на `weightPerWarehouseUnitKg` в `types/product.ts` при номере
  103. Правка не нужна, но строка остаётся в переписи.
- **«диапазон: доказательства нет»** — диапазон 107-108 того же предложения: токен единственный,
  но подтверждает он только начало, а двигать диапазон одним концом запрещено ограничителем 2.
- **«путь неоднозначен»** — путь записан голым именем `models.py`, а таких файлов в дереве
  пятнадцать; какой именно, из строки не следует.
- **«токен не про этот номер»** — код рядом есть, он даже единственный, но утверждает другое
  место. У четырёх строк 70–73 настроек это литерал кода отказа: единственное его вхождение —
  объявление в таблице `SETTINGS_REFUSAL_CODES`, а предложение говорит про место, где мок бросает
  отказ (строка с вызовом `mockRefusal`), — а там стоит не литерал, а обращение к константе.
  Правка увела бы ссылку от смысла предложения, поэтому все четыре отданы глазам, а не
  переписаны на номер объявления.

**Что значит колонка «подразумеваемый файл».** Это файл, который читатель подразумевает по
окружающей прозе, — и он назван и там, где причина «файл не назван»: причина говорит про другое,
а именно что на ТОЙ ЖЕ строке формального пути в бэктиках нет, поэтому правило «последний путь
левее на этой же строке» номер не подтверждает. Значок «—» в колонке стоит только там, где и
прозы с путём рядом не нашлось. От причины вердикта колонка не зависит.

## Границы этой переписи

- Разбирались только короткие ссылки: 411 ссылка документа товаров — из них коротких 110;
  592 ссылки настроек — из них коротких 39. Полные (`путь:строка`) не трогались: их чинит
  `refs_shift.py`.
- Числа номеров в таблицах сняты грепом и `sed` по файлам этого дерева; документы при этом не
  менялись ничем, кроме двух цифр в первом из них.
- Ссылки, у которых файл подразумевается прозой двух и более строк выше, поддержаны не были:
  правило «последний путь левее на ТОЙ ЖЕ строке» — единственное, по которому здесь считалось.
  Всякая короткая ссылка, которой этот путь не нашёлся, помечена в колонке «подразумеваемый файл»
  значком «—» и отдана глазам. Замером подтверждена граница этого правила: две короткие ссылки
  (`'/api/products/list'` и `products.toast_deleted`), чей файл на строке назван, поправлены; их
  соседки в тех же предложениях, чей файл остался строкой выше, отданы глазам.
- В таблицах переписи имя файла и номер никогда не стоят друг за другом через двоеточие: имя идёт
  отдельной колонкой, номер — отдельной колонкой голым числом. Двоеточие с числом встречается
  только внутри вывода инструмента, приведённого здесь дословно, и записями переписи не является.
- `refs_shift.py` не запускался ни с `--fix`, ни без: номера в чужих документах не переписывались.
- Искусственная нагрузка не создавалась, процессы по имени не гасились; глобальный
  `expect: { timeout }` в `playwright.config.ts` не трогался, и файл этот задачей не открывался.
- Временная копия документа для мутационной проверки лежит во временном каталоге задачи
  (`$TMPDIR`), вне checkout; в отчёте выше приведён весь её вывод, нужный для вывода.
