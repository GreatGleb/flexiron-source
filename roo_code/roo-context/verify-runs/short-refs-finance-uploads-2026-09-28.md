# Перепись коротких ссылок `roo_code/roo-context/api/finance.md` и `roo_code/roo-context/api/uploads.md` — 2026-09-28

Короткая ссылка — это `:NNN`, `:N-M` или хвост перечисления через запятую, у которых файл рядом
не назван, а подразумевается последним путём ЛЕВЕЕ на ТОЙ ЖЕ строке. `refs_shift.py` такие не чинит
по построению: файл у них назван прозой, а не ссылкой. Образец по составу и строгости —
[`short-refs-services-sales-crm-2026-09-28.md`](short-refs-services-sales-crm-2026-09-28.md).

## Что искал

```bash
grep -oP '(?<![\w:.,/-]):\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*(?![\w:])' roo_code/roo-context/api/finance.md | wc -l   # 106
grep -nP '(?<![\w:.,/-]):\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*(?![\w:])' roo_code/roo-context/api/finance.md | wc -l   # 76
grep -oP '(?<![\w:.,/-]):\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*(?![\w:])' roo_code/roo-context/api/uploads.md | wc -l   # 31
grep -nP '(?<![\w:.,/-]):\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*(?![\w:])' roo_code/roo-context/api/uploads.md | wc -l   # 26
wc -l roo_code/roo-context/api/finance.md roo_code/roo-context/api/uploads.md                                   # 874 / 500
```

**Коротких ссылок: 106 в документе финансов в 76 строках и 31 в uploads в 26 строках — 137 всего.**
Столько же строк в таблицах ниже — 106 и 31. Число строк документов правка не меняет: правились
только цифры внутри ссылок. Замер:

```bash
git diff --stat
#  roo_code/roo-context/api/uploads.md | 4 ++--
#  1 file changed, 2 insertions(+), 2 deletions(-)
git show HEAD:roo_code/roo-context/api/finance.md | wc -l   # 874
wc -l < roo_code/roo-context/api/finance.md                  # 874
git show HEAD:roo_code/roo-context/api/uploads.md | wc -l   # 500
wc -l < roo_code/roo-context/api/uploads.md                  # 500
```

## Ограничители — каждый снят со случившегося провала

1. **Строка с двумя и более РАЗНЫМИ путями не трогается вовсе** — контекст на ней определяется
   неверно. Такие ссылки в таблицах помечены причиной «два пути на строке»: 11 в финансах, 5 в
   uploads.
2. **Диапазон `:N-M` двигается обоими концами или не двигается ни одним.** Перевёрнутых
   диапазонов нет ни одного — ни до, ни после правки; ни один диапазон в этих двух документах не
   правился вовсе.
3. **Правка доказывается содержимым, а не арифметикой.** Из предложения берётся код в бэктиках
   (сам путь и токены-пути отброшены) и грепается по подразумеваемому файлу. Нашёлся ровно один
   раз — номер известен; не нашёлся, нашёлся многократно или токена рядом нет — ссылка не
   правится и идёт в «отдано глазам».
4. **Строка-цель в старой и новой версии файла совпадает дословно.** Ни один из двух исправленных
   номеров не двигал строку-цель: правились только числа в документе, файлы кода не трогались —
   `git status --short` показывает изменённым лишь документ uploads и новый файл этого журнала.

## Что поправлено — 2 короткие ссылки

Обе — в `roo_code/roo-context/api/uploads.md`. В финансах доказуемо исправимых нет: там либо
диапазон с недоказанными концами, либо путь назван не на строке ссылки, либо токена рядом нет, либо
токен встречается многократно, либо на строке два разных пути.

| строка документа | файл | было | стало | токен | его строка |
|---|---|---|---|---|---|
| 60 | frontend_vue/src/services/api.ts | 224 | 304 | `file: File` | 304 |
| 140 | frontend_vue/src/services/mocks/index.ts | 1678 | 1906 | `[mock] UPLOAD` | 1906 |

Токен стоит **на той же строке**, что и ссылка, — файл назван тут же, слева. Строка-цель в старой и
новой версии файла совпадает дословно: правились только числа в документе.

## Доказательство поимённо — грепом по целевому файлу

```bash
cd frontend_vue
grep -nF 'file: File' src/services/api.ts
# 304:export async function apiUpload<T>(path: string, file: File, options?: RequestOptions): Promise<T> {
grep -cF 'file: File' src/services/api.ts                     # 1 — вхождение единственное
sed -n '304p' src/services/api.ts | grep -cF 'file: File'     # 1 — токен на новой строке
git show HEAD:src/services/api.ts | sed -n '304p' | grep -cF 'file: File'   # 1 — строка-цель не двигалась
grep -nF '[mock] UPLOAD' src/services/mocks/index.ts
# 1906:    message: `[mock] UPLOAD ${path} not found`,
grep -oF '[mock] UPLOAD' src/services/mocks/index.ts | wc -l  # 1 — вхождение единственное
sed -n '1906p' src/services/mocks/index.ts | grep -cF '[mock] UPLOAD'   # 1 — токен на новой строке
git show HEAD:src/services/mocks/index.ts | sed -n '1906p' | grep -cF '[mock] UPLOAD'   # 1 — строка-цель не двигалась
```

Совпадение доказано поимённо, а не выведено из одинакового смещения: у двух номеров разное
смещение (+80 и +228), и каждый проверен отдельным грепом по своей строке.

## Мутационная проверка

Возврат любого одного исправленного номера к прежнему значению печатает старую строку, и
утверждаемого токена на ней нет:

```bash
cd frontend_vue
sed -n '224p' src/services/api.ts                                       # /**
sed -n '224p' src/services/api.ts | grep -cF 'file: File'                # 0
sed -n '1678p' src/services/mocks/index.ts                              #       const code = result.code ?? 'CATEGORY_NOT_FOUND'
sed -n '1678p' src/services/mocks/index.ts | grep -cF '[mock] UPLOAD'    # 0
```

Возврат номера 304 к 224 печатает открывающий комментарий `/**`, возврат 1906 к 1678 — строку
разбора удаления категории: искомого токена нет ни на одной из прежних строк, `grep -c` даёт 0
обе. Оба исправленных номера найдены именно так — подстановкой прежнего значения.

Доказуемо исправимых ссылок в финансах не нашлось ни одной, поэтому отдельная мутация на разборе
не делалась: критерий покрыт этими двумя правками. Число вхождений грепа у обоих документов не
изменилось — 106 и 31 до и после.

## Диапазоны — до и после

```bash
grep -oP '(?<![\w:.,/-]):\K\d+-\d+(?![\w:])' roo_code/roo-context/api/finance.md | awk -F- '$1>$2'    # пусто
grep -oP '(?<![\w:.,/-]):\K\d+-\d+(?![\w:])' roo_code/roo-context/api/uploads.md | awk -F- '$1>$2'  # пусто
```

Код возврата 0 у обеих, вывода нет — и до правки, и после. Ни один диапазон не правился, поэтому
«после» совпадает с «до».

## Проверка резолвером — до правки

```bash
cd frontend_vue && env CONTRACT_REFS=roo_code/roo-context/api/finance.md ./node_modules/.bin/vitest run src/services/contractRefs.spec.ts
```

Код возврата 0. Вывод:

```
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-2/wt-short-refs-finance-uploads/frontend_vue

roo_code/roo-context/api/finance.md: ссылок 344, битых 39, глазами 30, без токена 221
  roo_code/roo-context/api/finance.md:54 → backend/app/core/exceptions.py:13-20 — нет токена в диапазоне: в 13-20 нет ни одного из: «PAYMENT_NOT_FOUND»
  roo_code/roo-context/api/finance.md:129 → views/admin/finance/IncomingPaymentsPage.vue:40-47 — нет токена в диапазоне: в 40-47 нет ни одного из: «ReceivableStatus»
  roo_code/roo-context/api/finance.md:136 → services/financeService.ts:20-20 — нет токена в диапазоне: в 20-20 нет ни одного из: «options?.headers»
  roo_code/roo-context/api/finance.md:168 → mocks/notifications.ts:684-684 — нет токена в диапазоне: в 684-684 нет ни одного из: «notifyPaymentOverdue»
  roo_code/roo-context/api/finance.md:207 → mocks/index.ts:451-451 — нет токена в диапазоне: в 451-451 нет ни одного из: «page», «pageSize»
  roo_code/roo-context/api/finance.md:222 → mocks/finance.ts:416-416 — нет токена в диапазоне: в 416-416 нет ни одного из: «documents.length»
  roo_code/roo-context/api/finance.md:231 → mocks/finance.ts:72-72 — нет токена в диапазоне: в 72-72 нет ни одного из: «receivables()»
  roo_code/roo-context/api/finance.md:262 → services/financeService.ts:41-43 — нет токена в диапазоне: в 41-43 нет ни одного из: «encodeURIComponent»
  roo_code/roo-context/api/finance.md:281 → mocks/finance.ts:109-115 — нет токена в диапазоне: в 109-115 нет ни одного из: «sup-001…sup-005», «'1'…'6'»
  roo_code/roo-context/api/finance.md:285 → finance/shared/models.py:11-55 — нет токена в диапазоне: в 11-55 нет ни одного из: «If-Match»
  roo_code/roo-context/api/finance.md:294 → mocks/finance.ts:427-428 — нет токена в диапазоне: в 427-428 нет ни одного из: «PAYMENT_NOT_FOUND»
  roo_code/roo-context/api/finance.md:297 → mocks/finance.ts:426-430 — нет токена в диапазоне: в 426-430 нет ни одного из: «mockGetPayment»
  roo_code/roo-context/api/finance.md:331 → mocks/finance.ts:522-522 — нет токена в диапазоне: в 522-522 нет ни одного из: «notes»
  roo_code/roo-context/api/finance.md:351 → b2619dfeb90f_phase_10_finance.py:44-45 — нет токена в диапазоне: в 44-45 нет ни одного из: «TimestampMixin»
  roo_code/roo-context/api/finance.md:359 → mocks/finance.ts:474-475 — нет токена в диапазоне: в 474-475 нет ни одного из: «PAYMENT_NOT_FOUND», «VALIDATION_ERROR»
  roo_code/roo-context/api/finance.md:406 → mocks/index.ts:343-343 — нет токена в диапазоне: в 343-343 нет ни одного из: «parseFinanceListParams»
  roo_code/roo-context/api/finance.md:455 → backend/app/modules/finance/features/archive/action.py:18-18 — нет токена в диапазоне: в 18-18 нет ни одного из: «list_archive_items»
  roo_code/roo-context/api/finance.md:501 → mocks/notifications.ts:684-684 — нет токена в диапазоне: в 684-684 нет ни одного из: «notifyPaymentOverdue»
  roo_code/roo-context/api/finance.md:503 → mocks/finance.ts:483-486 — нет токена в диапазоне: в 483-486 нет ни одного из: «overdue»
  roo_code/roo-context/api/finance.md:511 → mocks/finance.ts:522-522 — нет токена в диапазоне: в 522-522 нет ни одного из: «commit»
  roo_code/roo-context/api/finance.md:522 → mocks/index.ts:392-393 — нет токена в диапазоне: в 392-393 нет ни одного из: «finance_payments»
  roo_code/roo-context/api/finance.md:539 → mocks/config.ts:183-183 — нет токена в диапазоне: в 183-183 нет ни одного из: «Accounting», «description»
  roo_code/roo-context/api/finance.md:559 → types/finance.ts:64-64 — нет токена в диапазоне: в 64-64 нет ни одного из: «String(50)»
  roo_code/roo-context/api/finance.md:569 → mocks/orders.ts:4715-4715 — нет токена в диапазоне: в 4715-4715 нет ни одного из: «tenant_id», «tenants.id», «ondelete="CASCADE"»
  roo_code/roo-context/api/finance.md:581 → mocks/finance.ts:426-427 — нет токена в диапазоне: в 426-427 нет ни одного из: «mockGetPayment»
  roo_code/roo-context/api/finance.md:582 → router/index.ts:326-326 — нет токена в диапазоне: в 326-326 нет ни одного из: «financeIncoming», «financeOutgoing»
  roo_code/roo-context/api/finance.md:599 → services/api.ts:258-264 — нет токена в диапазоне: в 258-264 нет ни одного из: «POST»
  roo_code/roo-context/api/finance.md:617 → domain/receivable.ts:101-117 — нет токена в диапазоне: в 101-117 нет ни одного из: «dueDate»
  roo_code/roo-context/api/finance.md:620 → domain/receivable.ts:30-64 — нет токена в диапазоне: в 30-64 нет ни одного из: «paidAt»
  roo_code/roo-context/api/finance.md:621 → domain/receivable.ts:165-176 — нет токена в диапазоне: в 165-176 нет ни одного из: «outstandingAmount»
  roo_code/roo-context/api/finance.md:623 → mocks/finance.ts:43-50 — нет токена в диапазоне: в 43-50 нет ни одного из: «documentCount», «documents.length»
  roo_code/roo-context/api/finance.md:624 → mocks/finance.ts:416-416 — нет токена в диапазоне: в 416-416 нет ни одного из: «document_count»
  roo_code/roo-context/api/finance.md:647 → types/finance.ts:29-29 — нет токена в диапазоне: в 29-29 нет ни одного из: «counterparty_id», «counterparty_vat_code», «nullable=True»
  roo_code/roo-context/api/finance.md:651 → types/finance.ts:74-76 — нет токена в диапазоне: в 74-76 нет ни одного из: «document_count»
  roo_code/roo-context/api/finance.md:704 → mocks/finance.ts:102-102 — нет токена в диапазоне: в 102-102 нет ни одного из: «filtered.sort»
  roo_code/roo-context/api/finance.md:748 → views/admin/finance/DocumentArchivePage.vue:203-207 — нет токена в диапазоне: в 203-207 нет ни одного из: «FileItem»
  roo_code/roo-context/api/finance.md:749 → views/admin/finance/OutgoingPaymentCardPage.vue:8-8 — нет токена в диапазоне: в 8-8 нет ни одного из: «url»
  roo_code/roo-context/api/finance.md:777 → 03-api-contract.md:2024-2024 — нет токена в диапазоне: в 2024-2024 нет ни одного из: «page», «pageSize»
  roo_code/roo-context/api/finance.md:820 → mocks/finance.ts:145-145 — нет токена в диапазоне: в 145-145 нет ни одного из: «'EUR'»
[ссылки] документов 1 · ссылок 344 · битых 39

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

```bash
cd frontend_vue && env CONTRACT_REFS=roo_code/roo-context/api/uploads.md ./node_modules/.bin/vitest run src/services/contractRefs.spec.ts
```

Код возврата 0. Вывод:

```
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-2/wt-short-refs-finance-uploads/frontend_vue

roo_code/roo-context/api/uploads.md: ссылок 194, битых 3, глазами 13, без токена 129
  roo_code/roo-context/api/uploads.md:236 → core/uploads/action.py:85-93 — нет токена в диапазоне: в 85-93 нет ни одного из: «store_file», «db.commit()»
  roo_code/roo-context/api/uploads.md:253 → types/category.ts:4-4 — нет токена в диапазоне: в 4-4 нет ни одного из: «CategoryFieldType»
  roo_code/roo-context/api/uploads.md:300 → backend/app/main.py:74-74 — нет токена в диапазоне: в 74-74 нет ни одного из: «lifespan»
[ссылки] документов 1 · ссылок 194 · битых 3

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

**Битых до правки: 39 у финансов и 3 у uploads.** Среди этих записей нет ни одной короткой
ссылки из переписи: все они полные (`путь:строка`), и чинит их механика `refs_shift.py`, а не эта
задача.

## Проверка резолвером — после правки

Те же команды на том же дереве, после двух подстановок.

```bash
cd frontend_vue && env CONTRACT_REFS=roo_code/roo-context/api/finance.md ./node_modules/.bin/vitest run src/services/contractRefs.spec.ts
```

Код возврата 0. Вывод:

```
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-2/wt-short-refs-finance-uploads/frontend_vue

roo_code/roo-context/api/finance.md: ссылок 344, битых 39, глазами 30, без токена 221
  roo_code/roo-context/api/finance.md:54 → backend/app/core/exceptions.py:13-20 — нет токена в диапазоне: в 13-20 нет ни одного из: «PAYMENT_NOT_FOUND»
  roo_code/roo-context/api/finance.md:129 → views/admin/finance/IncomingPaymentsPage.vue:40-47 — нет токена в диапазоне: в 40-47 нет ни одного из: «ReceivableStatus»
  roo_code/roo-context/api/finance.md:136 → services/financeService.ts:20-20 — нет токена в диапазоне: в 20-20 нет ни одного из: «options?.headers»
  roo_code/roo-context/api/finance.md:168 → mocks/notifications.ts:684-684 — нет токена в диапазоне: в 684-684 нет ни одного из: «notifyPaymentOverdue»
  roo_code/roo-context/api/finance.md:207 → mocks/index.ts:451-451 — нет токена в диапазоне: в 451-451 нет ни одного из: «page», «pageSize»
  roo_code/roo-context/api/finance.md:222 → mocks/finance.ts:416-416 — нет токена в диапазоне: в 416-416 нет ни одного из: «documents.length»
  roo_code/roo-context/api/finance.md:231 → mocks/finance.ts:72-72 — нет токена в диапазоне: в 72-72 нет ни одного из: «receivables()»
  roo_code/roo-context/api/finance.md:262 → services/financeService.ts:41-43 — нет токена в диапазоне: в 41-43 нет ни одного из: «encodeURIComponent»
  roo_code/roo-context/api/finance.md:281 → mocks/finance.ts:109-115 — нет токена в диапазоне: в 109-115 нет ни одного из: «sup-001…sup-005», «'1'…'6'»
  roo_code/roo-context/api/finance.md:285 → finance/shared/models.py:11-55 — нет токена в диапазоне: в 11-55 нет ни одного из: «If-Match»
  roo_code/roo-context/api/finance.md:294 → mocks/finance.ts:427-428 — нет токена в диапазоне: в 427-428 нет ни одного из: «PAYMENT_NOT_FOUND»
  roo_code/roo-context/api/finance.md:297 → mocks/finance.ts:426-430 — нет токена в диапазоне: в 426-430 нет ни одного из: «mockGetPayment»
  roo_code/roo-context/api/finance.md:331 → mocks/finance.ts:522-522 — нет токена в диапазоне: в 522-522 нет ни одного из: «notes»
  roo_code/roo-context/api/finance.md:351 → b2619dfeb90f_phase_10_finance.py:44-45 — нет токена в диапазоне: в 44-45 нет ни одного из: «TimestampMixin»
  roo_code/roo-context/api/finance.md:359 → mocks/finance.ts:474-475 — нет токена в диапазоне: в 474-475 нет ни одного из: «PAYMENT_NOT_FOUND», «VALIDATION_ERROR»
  roo_code/roo-context/api/finance.md:406 → mocks/index.ts:343-343 — нет токена в диапазоне: в 343-343 нет ни одного из: «parseFinanceListParams»
  roo_code/roo-context/api/finance.md:455 → backend/app/modules/finance/features/archive/action.py:18-18 — нет токена в диапазоне: в 18-18 нет ни одного из: «list_archive_items»
  roo_code/roo-context/api/finance.md:501 → mocks/notifications.ts:684-684 — нет токена в диапазоне: в 684-684 нет ни одного из: «notifyPaymentOverdue»
  roo_code/roo-context/api/finance.md:503 → mocks/finance.ts:483-486 — нет токена в диапазоне: в 483-486 нет ни одного из: «overdue»
  roo_code/roo-context/api/finance.md:511 → mocks/finance.ts:522-522 — нет токена в диапазоне: в 522-522 нет ни одного из: «commit»
  roo_code/roo-context/api/finance.md:522 → mocks/index.ts:392-393 — нет токена в диапазоне: в 392-393 нет ни одного из: «finance_payments»
  roo_code/roo-context/api/finance.md:539 → mocks/config.ts:183-183 — нет токена в диапазоне: в 183-183 нет ни одного из: «Accounting», «description»
  roo_code/roo-context/api/finance.md:559 → types/finance.ts:64-64 — нет токена в диапазоне: в 64-64 нет ни одного из: «String(50)»
  roo_code/roo-context/api/finance.md:569 → mocks/orders.ts:4715-4715 — нет токена в диапазоне: в 4715-4715 нет ни одного из: «tenant_id», «tenants.id», «ondelete="CASCADE"»
  roo_code/roo-context/api/finance.md:581 → mocks/finance.ts:426-427 — нет токена в диапазоне: в 426-427 нет ни одного из: «mockGetPayment»
  roo_code/roo-context/api/finance.md:582 → router/index.ts:326-326 — нет токена в диапазоне: в 326-326 нет ни одного из: «financeIncoming», «financeOutgoing»
  roo_code/roo-context/api/finance.md:599 → services/api.ts:258-264 — нет токена в диапазоне: в 258-264 нет ни одного из: «POST»
  roo_code/roo-context/api/finance.md:617 → domain/receivable.ts:101-117 — нет токена в диапазоне: в 101-117 нет ни одного из: «dueDate»
  roo_code/roo-context/api/finance.md:620 → domain/receivable.ts:30-64 — нет токена в диапазоне: в 30-64 нет ни одного из: «paidAt»
  roo_code/roo-context/api/finance.md:621 → domain/receivable.ts:165-176 — нет токена в диапазоне: в 165-176 нет ни одного из: «outstandingAmount»
  roo_code/roo-context/api/finance.md:623 → mocks/finance.ts:43-50 — нет токена в диапазоне: в 43-50 нет ни одного из: «documentCount», «documents.length»
  roo_code/roo-context/api/finance.md:624 → mocks/finance.ts:416-416 — нет токена в диапазоне: в 416-416 нет ни одного из: «document_count»
  roo_code/roo-context/api/finance.md:647 → types/finance.ts:29-29 — нет токена в диапазоне: в 29-29 нет ни одного из: «counterparty_id», «counterparty_vat_code», «nullable=True»
  roo_code/roo-context/api/finance.md:651 → types/finance.ts:74-76 — нет токена в диапазоне: в 74-76 нет ни одного из: «document_count»
  roo_code/roo-context/api/finance.md:704 → mocks/finance.ts:102-102 — нет токена в диапазоне: в 102-102 нет ни одного из: «filtered.sort»
  roo_code/roo-context/api/finance.md:748 → views/admin/finance/DocumentArchivePage.vue:203-207 — нет токена в диапазоне: в 203-207 нет ни одного из: «FileItem»
  roo_code/roo-context/api/finance.md:749 → views/admin/finance/OutgoingPaymentCardPage.vue:8-8 — нет токена в диапазоне: в 8-8 нет ни одного из: «url»
  roo_code/roo-context/api/finance.md:777 → 03-api-contract.md:2024-2024 — нет токена в диапазоне: в 2024-2024 нет ни одного из: «page», «pageSize»
  roo_code/roo-context/api/finance.md:820 → mocks/finance.ts:145-145 — нет токена в диапазоне: в 145-145 нет ни одного из: «'EUR'»
[ссылки] документов 1 · ссылок 344 · битых 39

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

```bash
cd frontend_vue && env CONTRACT_REFS=roo_code/roo-context/api/uploads.md ./node_modules/.bin/vitest run src/services/contractRefs.spec.ts
```

Код возврата 0. Вывод:

```
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-2/wt-short-refs-finance-uploads/frontend_vue

roo_code/roo-context/api/uploads.md: ссылок 194, битых 3, глазами 13, без токена 129
  roo_code/roo-context/api/uploads.md:236 → core/uploads/action.py:85-93 — нет токена в диапазоне: в 85-93 нет ни одного из: «store_file», «db.commit()»
  roo_code/roo-context/api/uploads.md:253 → types/category.ts:4-4 — нет токена в диапазоне: в 4-4 нет ни одного из: «CategoryFieldType»
  roo_code/roo-context/api/uploads.md:300 → backend/app/main.py:74-74 — нет токена в диапазоне: в 74-74 нет ни одного из: «lifespan»
[ссылки] документов 1 · ссылок 194 · битых 3

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

**Сравнение построчное по каждому документу.** У uploads — те же 3 записи, тот же текст, те же
номера строк документов и диапазоны до и после: список совпадает построчно, ни одной новой записи
не появилось, ни одна старая не пропала. У финансов — те же 39 записей, тот же текст, те же номера
строк документов и диапазоны до и после. **Битых после правки: 39 у финансов (не выросло) и 3 у
uploads (не выросло).**

**Почему счёт резолвера не мог измениться, и это ожидаемо, а не провал проверки.** Резолвер судит
ссылку, только если рядом с ней стоит греппабельный токен. У двух исправленных коротких ссылок
содержимое бэктиков самой ссылки — `:224` и `:1678` — под запрет «похоже на ссылку» (`:\d`) и
токеном не считается; короткая ссылка наследует путь полной ссылки той же строки и остаётся
непроверенной по содержимому. Значит её номер резолвер не судит вовсе и увидеть подмену не может —
ни до, ни после. Критерий здесь выполняется в том, что счёт **не вырос**, а принадлежность токенов
доказана точечным грепом выше.

## Перепись — 106 строк по финансам, по строке на короткую ссылку

Колонки: «строка документа» — номер строки в самом документе; «было» и «стало» — номера голыми
числами в своих колонках; «кратность токена» — сколько раз токен встречается в подразумеваемом
файле, либо «—», где кратность не измерялась и причина этого не требует.

| № | строка документа | подразумеваемый файл | было | стало | утверждаемый токен | кратность токена | вердикт | причина |
|---|---|---|---|---|---|---|---|---|
| 1 | 27 | finance/shared/models.py | 58-90 | — | `payment_documents` | 1 | отдано глазам | диапазон — оба конца не доказаны |
| 2 | 28 | backend/alembic/versions/b2619dfeb90f_phase_10_finance.py | 93-128 | — | `document_archive_items` | 1 | отдано глазам | диапазон — оба конца не доказаны |
| 3 | 48 | frontend_vue/src/services/mocks/finance.ts | 475 | — | `PAYMENT_NOT_FOUND` | 3 | отдано глазам | токен найден многократно |
| 4 | 59 | frontend_vue/src/services/orderLineEdits.ts | 326-327 | — | — | — | отдано глазам | токена рядом нет |
| 5 | 86 | frontend_vue/src/services/mocks/finance.ts и frontend_vue/src/types/finance.ts | 83-98 | — | — | — | отдано глазам | два пути на строке |
| 6 | 112 | frontend_vue/src/views/admin/finance/IncomingPaymentsPage.vue | 203-210 | — | — | — | отдано глазам | токена рядом нет |
| 7 | 113 | — | 17-24 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 8 | 158 | frontend_vue/src/services/mocks/orders.ts | 4719 | — | — | — | отдано глазам | токена рядом нет |
| 9 | 166 | frontend_vue/src/services/mocks/finance.ts | 86 | — | — | — | отдано глазам | токена рядом нет |
| 10 | 167 | — | 88-99 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 11 | 171 | — | 55-62 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 12 | 258 | frontend_vue/src/services/mocks/finance.ts | 173-174 | — | — | — | отдано глазам | токена рядом нет |
| 13 | 258 | frontend_vue/src/services/mocks/finance.ts | 194-195 | — | — | — | отдано глазам | токена рядом нет |
| 14 | 259 | — | 215-216 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 15 | 259 | — | 236-237 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 16 | 290 | frontend_vue/src/views/admin/finance/OutgoingPaymentCardPage.vue | 40-51 | — | `isDirty` | 4 | отдано глазам | токен найден многократно |
| 17 | 298 | — | 421-425 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 18 | 311 | frontend_vue/src/views/admin/finance/OutgoingPaymentCardPage.vue | 62 | — | `notesDraft` | 6 | отдано глазам | токен найден многократно |
| 19 | 312 | — | 90-95 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 20 | 313 | — | 97-111 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 21 | 314 | — | 40-51 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 22 | 314 | — | 72-88 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 23 | 341 | — | 505-508 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 24 | 349 | frontend_vue/src/services/mocks/finance.ts | 522 | — | `updatedAt` | — | отдано глазам | токен найден многократно |
| 25 | 357 | — | 522 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 26 | 385 | — | 77-83 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 27 | 385 | — | 85-88 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 28 | 385 | — | 91-93 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 29 | 386 | — | 110-117 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 30 | 389 | — | 203-207 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 31 | 393 | — | 61-62 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 32 | 421 | frontend_vue/src/services/mocks/finance.ts | 34-36 | — | `clone(filtered)` | 1 | отдано глазам | токен рядом не про этот номер |
| 33 | 435 | — | 116-124 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 34 | 450 | — | 314-341 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 35 | 450 | — | 155-158 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 36 | 474 | frontend_vue/src/services/mocks/finance.ts | 169 | — | `'EUR'` | 5 | отдано глазам | токен найден многократно |
| 37 | 474 | frontend_vue/src/services/mocks/finance.ts | 190 | — | `'EUR'` | 5 | отдано глазам | токен найден многократно |
| 38 | 475 | — | 211 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 39 | 475 | — | 232 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 40 | 485 | frontend_vue/src/services/mocks/finance.ts | 401 | — | — | — | отдано глазам | токена рядом нет |
| 41 | 485 | frontend_vue/src/services/mocks/finance.ts | 460 | — | — | — | отдано глазам | токена рядом нет |
| 42 | 505 | — | 484-488 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 43 | 507 | — | 55-62 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 44 | 510 | — | 348-360 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 45 | 540 | frontend_vue/src/types/finance.ts и backend/app/modules/finance/shared/models.py | 32 | — | — | — | отдано глазам | два пути на строке |
| 46 | 540 | frontend_vue/src/types/finance.ts и backend/app/modules/finance/shared/models.py | 48 | — | — | — | отдано глазам | два пути на строке |
| 47 | 566 | frontend_vue/src/services/financeService.ts | 33 | — | — | — | отдано глазам | токена рядом нет |
| 48 | 566 | frontend_vue/src/services/financeService.ts | 42 | — | — | — | отдано глазам | токена рядом нет |
| 49 | 566 | frontend_vue/src/services/financeService.ts | 49 | — | — | — | отдано глазам | токена рядом нет |
| 50 | 566 | frontend_vue/src/services/financeService.ts | 63 | — | — | — | отдано глазам | токена рядом нет |
| 51 | 567 | frontend_vue/src/services/api.ts | 194-209 | — | `options?.headers` | — | отдано глазам | токен найден многократно |
| 52 | 568 | frontend_vue/src/services/mocks/finance.ts | 257 | — | — | — | отдано глазам | токена рядом нет |
| 53 | 570 | backend/app/modules/finance/shared/models.py | 63-68 | — | `nullable=False, index=True` | — | отдано глазам | токен найден многократно |
| 54 | 571 | backend/alembic/versions/b2619dfeb90f_phase_10_finance.py | 98-103 | — | — | — | отдано глазам | токена рядом нет |
| 55 | 571 | backend/alembic/versions/b2619dfeb90f_phase_10_finance.py | 51 | — | — | — | отдано глазам | токена рядом нет |
| 56 | 571 | backend/alembic/versions/b2619dfeb90f_phase_10_finance.py | 64 | — | — | — | отдано глазам | токена рядом нет |
| 57 | 583 | — | 332 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 58 | 583 | — | 338 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 59 | 583 | — | 344 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 60 | 583 | — | 447-450 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 61 | 589 | frontend_vue/src/services/mocks/config.ts | 183 | — | — | — | отдано глазам | токена рядом нет |
| 62 | 590 | — | 189-190 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 63 | 630 | — | 75-107 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 64 | 631 | — | 175 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 65 | 632 | — | 460 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 66 | 648 | backend/app/modules/finance/shared/models.py и frontend_vue/src/types/finance.ts | 37 | — | — | — | отдано глазам | два пути на строке |
| 67 | 648 | backend/app/modules/finance/shared/models.py и frontend_vue/src/types/finance.ts | 24 | — | — | — | отдано глазам | два пути на строке |
| 68 | 654 | backend/alembic/versions/b2619dfeb90f_phase_10_finance.py | 50 | — | — | — | отдано глазам | токена рядом нет |
| 69 | 654 | backend/alembic/versions/b2619dfeb90f_phase_10_finance.py | 63 | — | — | — | отдано глазам | токена рядом нет |
| 70 | 655 | frontend_vue/src/services/mocks/finance.ts | 119 | — | — | — | отдано глазам | токена рядом нет |
| 71 | 655 | frontend_vue/src/services/mocks/finance.ts | 259 | — | — | — | отдано глазам | токена рядом нет |
| 72 | 656 | — | 121 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 73 | 662 | frontend_vue/src/types/finance.ts | 3 | — | `PaymentStatus` | 3 | отдано глазам | токен найден многократно |
| 74 | 665 | frontend_vue/src/domain/receivable.ts | 59-62 | — | — | — | отдано глазам | токена рядом нет |
| 75 | 677 | frontend_vue/src/domain/receivable.ts | 147 | — | — | — | отдано глазам | токена рядом нет |
| 76 | 678 | — | 113-116 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 77 | 685 | frontend_vue/src/services/mocks/finance.ts | 34-36 | — | `clone` | 4 | отдано глазам | токен найден многократно |
| 78 | 685 | frontend_vue/src/services/mocks/finance.ts | 429 | — | `clone` | 4 | отдано глазам | токен найден многократно |
| 79 | 685 | frontend_vue/src/services/mocks/finance.ts | 460 | — | `clone` | 4 | отдано глазам | токен найден многократно |
| 80 | 685 | frontend_vue/src/services/mocks/finance.ts | 487 | — | `clone` | 4 | отдано глазам | токен найден многократно |
| 81 | 689 | frontend_vue/src/views/admin/finance/OutgoingPaymentCardPage.vue | 86 | — | — | — | отдано глазам | токена рядом нет |
| 82 | 696 | — | 132-136 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 83 | 705 | — | 101 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 84 | 710 | frontend_vue/src/services/mocks/finance.ts | 86 | — | — | — | отдано глазам | токена рядом нет |
| 85 | 710 | frontend_vue/src/services/mocks/finance.ts | 88-99 | — | — | — | отдано глазам | токена рядом нет |
| 86 | 713 | frontend_vue/src/services/mocks/finance.ts | 251-256 | — | — | — | отдано глазам | токена рядом нет |
| 87 | 714 | — | 314-341 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 88 | 715 | — | 155-158 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 89 | 719 | frontend_vue/src/services/mocks/suppliers.ts | 29 | — | `sup-001…sup-005` | 0 | отдано глазам | токен не найден |
| 90 | 719 | frontend_vue/src/services/mocks/suppliers.ts | 49 | — | `sup-001…sup-005` | 0 | отдано глазам | токен не найден |
| 91 | 720 | — | 69 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 92 | 720 | — | 89 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 93 | 720 | — | 109 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 94 | 725 | — | 463-468 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 95 | 743 | — | 149-152 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 96 | 752 | frontend_vue/src/services/mocks/index.ts | 831 | — | — | — | отдано глазам | токена рядом нет |
| 97 | 753 | — | 1399 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 98 | 770 | roo_code/roo-context/03-api-contract.md и frontend_vue/src/services/mocks/finance.ts и frontend_vue/src/services/mocks/index.ts и backend/app/modules/finance/shared/models.py | 2126 | — | — | — | отдано глазам | два пути на строке |
| 99 | 772 | roo_code/roo-context/03-api-contract.md и backend/app/modules/finance/shared/models.py и frontend_vue/src/services/mocks/finance.ts | 251-256 | — | — | — | отдано глазам | два пути на строке |
| 100 | 773 | roo_code/roo-context/03-api-contract.md и frontend_vue/src/services/financeService.ts и frontend_vue/src/services/mocks/finance.ts | 353 | — | — | — | отдано глазам | два пути на строке |
| 101 | 779 | frontend_vue/src/router/index.ts и frontend_vue/src/config/featureFlags.ts и frontend_vue/src/types/features.ts | 332 | — | — | — | отдано глазам | два пути на строке |
| 102 | 779 | frontend_vue/src/router/index.ts и frontend_vue/src/config/featureFlags.ts и frontend_vue/src/types/features.ts | 338 | — | — | — | отдано глазам | два пути на строке |
| 103 | 779 | frontend_vue/src/router/index.ts и frontend_vue/src/config/featureFlags.ts и frontend_vue/src/types/features.ts | 344 | — | — | — | отдано глазам | два пути на строке |
| 104 | 793 | roo_code/plans/api/audit/00-решения-владельца.md | 320-332 | — | — | — | отдано глазам | токена рядом нет |
| 105 | 825 | roo_code/roo-context/api/00-conventions.md | 330 | — | — | — | отдано глазам | токена рядом нет |
| 106 | 828 | — | 328 | — | — | — | отдано глазам | путь не назван на строке ссылки |

**Итого по финансам: 106 строк = 106 коротким ссылкам.** Поправлено 0, отдано глазам 106.

## Перепись — 31 строка по uploads

| № | строка документа | подразумеваемый файл | было | стало | утверждаемый токен | кратность токена | вердикт | причина |
|---|---|---|---|---|---|---|---|---|
| 1 | 27 | backend/alembic/versions/b2619dfeb90f_phase_10_finance.py | 67 | — | `ondelete="RESTRICT"` | 2 | отдано глазам | токен найден многократно |
| 2 | 41 | frontend_vue/src/components/admin/ui/DropZone.vue | 47-53 | — | `@change` | 1 | отдано глазам | токен рядом не про этот номер |
| 3 | 42 | frontend_vue/src/components/admin/ui/DropZone.vue | 55-60 | — | `@drop` | 1 | отдано глазам | токен рядом не про этот номер |
| 4 | 60 | frontend_vue/src/services/api.ts | 224 | 304 | `file: File` | 1 | поправлена | — |
| 5 | 90 | backend/app/core/uploads/action.py | 26 | — | `response_model=ApiResponse` | 2 | отдано глазам | токен найден многократно |
| 6 | 97 | — | 66 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 7 | 140 | frontend_vue/src/services/mocks/index.ts | 1678 | 1906 | `[mock] UPLOAD` | 1 | поправлена | — |
| 8 | 157 | frontend_vue/src/services/mocks/index.ts | 1661-1679 | — | `uploadMockRoute` | 2 | отдано глазам | токен найден многократно |
| 9 | 208 | backend/app/core/config.py | 35 | — | `max_upload_size_mb` | 1 | отдано глазам | номер верен — правки не требуется |
| 10 | 209 | backend/app/core/config.py | 36-42 | — | `upload_whitelist_mime` | 1 | отдано глазам | номер верен — правки не требуется |
| 11 | 209 | backend/app/core/config.py | 43 | — | `draft_ttl_hours` | 1 | отдано глазам | номер верен — правки не требуется |
| 12 | 260 | frontend_vue/src/views/admin/products/ProductCardPage.vue | 589-595 | — | `arr.push(f.name)` | 1 | отдано глазам | токен рядом не про этот номер |
| 13 | 260 | frontend_vue/src/views/admin/products/ProductCardPage.vue | 218-221 | — | `arr.push(f.name)` | 1 | отдано глазам | токен рядом не про этот номер |
| 14 | 261 | frontend_vue/src/views/admin/products/ProductCardPage.vue | 593 | — | `download-url="#"` | 1 | отдано глазам | номер верен — правки не требуется |
| 15 | 268 | — | 1670 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 16 | 271 | — | 1098 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 17 | 271 | — | 1405 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 18 | 298 | — | 117-138 | — | — | — | отдано глазам | путь не назван на строке ссылки |
| 19 | 313 | backend/app/core/uploads/models.py | 23 | — | `storage_path` | 1 | отдано глазам | номер верен — правки не требуется |
| 20 | 315 | backend/app/core/uploads/action.py | 89 | — | `/static/uploads/` | 2 | отдано глазам | токен найден многократно |
| 21 | 318 | backend/alembic/versions/b2619dfeb90f_phase_10_finance.py | 68-70 | — | `document_archive_items` | 3 | отдано глазам | токен найден многократно |
| 22 | 345 | frontend_vue/src/services/mocks/index.ts | 1405 | — | — | — | отдано глазам | токена рядом нет |
| 23 | 365 | frontend_vue/src/services/mocks/index.ts | 272 | — | — | — | отдано глазам | токена рядом нет |
| 24 | 376 | backend/app/core/uploads/service.py | 51-57 | — | `delete_file` | 1 | отдано глазам | токен рядом не про этот номер |
| 25 | 378 | — | 53 | — | `get_file_by_id` | 2 | отдано глазам | путь не назван на строке ссылки |
| 26 | 395 | frontend_vue/src/views/admin/warehouse/useWarehouseBatchCreate.ts и frontend_vue/src/composables/useWarehouseOffcutCard.ts и frontend_vue/src/views/admin/finance/OutgoingPaymentCardPage.vue | 386 | — | — | — | отдано глазам | два пути на строке |
| 27 | 395 | frontend_vue/src/views/admin/warehouse/useWarehouseBatchCreate.ts и frontend_vue/src/composables/useWarehouseOffcutCard.ts и frontend_vue/src/views/admin/finance/OutgoingPaymentCardPage.vue | 100-108 | — | — | — | отдано глазам | два пути на строке |
| 28 | 395 | frontend_vue/src/views/admin/warehouse/useWarehouseBatchCreate.ts и frontend_vue/src/composables/useWarehouseOffcutCard.ts и frontend_vue/src/views/admin/finance/OutgoingPaymentCardPage.vue | 206-212 | — | — | — | отдано глазам | два пути на строке |
| 29 | 396 | backend/alembic/versions/a8dd7d7ba74b_phase_6_suppliers.py и backend/alembic/versions/b2619dfeb90f_phase_10_finance.py | 67 | — | — | — | отдано глазам | два пути на строке |
| 30 | 399 | backend/app/core/config.py и backend/app/core/uploads/action.py | 36-42 | — | — | — | отдано глазам | два пути на строке |
| 31 | 406 | frontend_vue/src/services/mocks/index.ts | 1405 | — | — | — | отдано глазам | токена рядом нет |

**Итого по uploads: 31 строка = 31 короткой ссылке.** Поправлено 2, отдано глазам 29.

**Всего: 137 коротких ссылок, поправлено 2, отдано глазам 135.** Сумма причин по строкам «отдано
глазам», посчитанная по обеим таблицам:

| причина | финансы | uploads | всего |
|---|---|---|---|
| токен найден многократно | 13 | 5 | 18 |
| токена рядом нет | 30 | 3 | 33 |
| путь не назван на строке ссылки | 47 | 6 | 53 |
| два пути на строке | 11 | 5 | 16 |
| токен не найден | 2 | 0 | 2 |
| токен рядом не про этот номер | 1 | 5 | 6 |
| номер верен — правки не требуется | 0 | 5 | 5 |
| диапазон — оба конца не доказаны | 2 | 0 | 2 |
| **итого «отдано глазам»** | **106** | **29** | **135** |

Сумма причин: 18 + 33 + 53 + 16 + 2 + 6 + 5 + 2 = 135, и это число совпадает с суммой по
столбцам: 106 + 29 = 135. С вердиктами: 2 поправленных + 135 отданных глазам = 137, а 137 —
длина обеих таблиц и число, которое печатает греп коротких ссылок по двум документам.

Разбор по номерам строк, по документу:

- **финансы:** «диапазон — оба конца не доказаны» — №1, 2 (2); «токен найден многократно» — №3,
  16, 18, 24, 36, 37, 51, 53, 73, 77, 78, 79, 80 (13); «токена рядом нет» — №4, 6, 8, 9, 12, 13,
  40, 41, 47, 48, 49, 50, 52, 54, 55, 56, 61, 68, 69, 70, 71, 74, 75, 81, 84, 85, 86, 96, 104,
  105 (30); «два пути на строке» — №5, 45, 46, 66, 67, 98, 99, 100, 101, 102, 103 (11); «токен не
  найден» — №89, 90 (2); «токен рядом не про этот номер» — №32 (1); «путь не назван на строке
  ссылки» — остальные (47). Проверка: 2 + 13 + 30 + 11 + 2 + 1 + 47 = 106 ✓
- **uploads:** «токен найден многократно» — №1, 5, 8, 20, 21 (5); «токен рядом не про этот
  номер» — №2, 3, 12, 13, 24 (5); «номер верен — правки не требуется» — №9, 10, 11, 14, 19 (5);
  «путь не назван на строке ссылки» — №6, 15, 16, 17, 18, 25 (6); «токена рядом нет» — №22, 23,
  31 (3); «два пути на строке» — №26, 27, 28, 29, 30 (5); «поправлена» — №4, 7 (2). Проверка:
  5 + 5 + 5 + 6 + 3 + 5 + 2 = 31 ✓

## Как читалась причина

- **«два пути на строке»** — на строке ссылки два и более разных путей: контекст определяется
  неверно, ссылка не трогается (ограничитель 1).
- **«токена рядом нет»** — рядом со ссылкой нет кода в бэктиках, который можно грепнуть по
  подразумеваемому файлу и который подтвердил бы номер. Файл при этом назван на той же строке, но
  числа это не доказывает: проверять нечего.
- **«путь не назван на строке ссылки»** — строка ссылки не несёт пути левее себя: он лежит строкой
  выше или ниже. Правило «последний путь левее на ТОЙ ЖЕ строке» файла не даёт, и угадывать его —
  ровно тот промах, ради которого ограничитель 1 и писался.
- **«токен не найден»** — код рядом есть, но в подразумеваемом файле его нет ни разу
  (`sup-001…sup-005` в сторе поставщиков: там id `'1'…'6'`).
- **«токен найден многократно»** — код рядом есть и встречается в файле больше одного раза; какой
  из номеров он утверждает, машина не знает.
- **«токен рядом не про этот номер»** — код рядом есть, он даже единственный, но утверждает другое
  место.
- **«номер верен — правки не требуется»** — токен рядом единственный в подразумеваемом файле и
  стоит именно на этом номере: ссылка уже верна, менять нечего.
- **«диапазон — оба конца не доказаны»** — токен рядом единственный, но ссылка — диапазон, и
  границы участка из токена не выводятся: `payment_documents` и `document_archive_items`
  объявлены классами, а не строками, и конец участка машина назвать не может. Ограничитель 2
  запрещает двигать один конец, а оба конца доказать нечем.

Токен ищется на **той же строке**, что и ссылка. Строка **выше** берётся только для явного
продолжения перечисления — там, где ссылки стоят непосредственно под строкой с путями и числами;
в этих двух документах таких доказуемых случаев нет.

## Границы этой переписи

- Разбирались только короткие ссылки: 344 ссылки документа финансов — из них коротких 106; 194
  ссылки uploads — из них коротких 31. Полные (`путь:строка`) не трогались: их чинит
  `refs_shift.py`.
- Числа номеров в таблицах сняты грепом и `sed` по файлам этого дерева; документы при этом не
  менялись ничем, кроме двух чисел во втором из них.
- Ссылки, у которых файл подразумевается прозой двух и более строк выше, поддержаны не были:
  правило «последний путь левее на ТОЙ ЖЕ строке» — единственное, по которому здесь считалось.
- В таблицах переписи имя файла и номер никогда не стоят друг за другом через двоеточие: имя идёт
  отдельной колонкой, номер — отдельной колонкой голым числом. Двоеточие с числом встречается
  только внутри вывода инструмента, приведённого здесь дословно, и записями переписи не является.
- `refs_shift.py` не запускался ни с `--fix`, ни без: номера в чужих документах не переписывались.
- Искусственная нагрузка не создавалась, процессы по имени не гасились; глобальный
  `expect: { timeout }` в `playwright.config.ts` не трогался.
