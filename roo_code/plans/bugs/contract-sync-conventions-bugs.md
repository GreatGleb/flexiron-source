# Bugs — contract-sync / общие соглашения (`00-conventions.md`)

Источник: цикл проверок, задача «код отказа сравнивается подстрокой» ночного прогона
2026-09-12 (очередь [`night-run-queue-plan.md`](../general/night-run-queue-plan.md)).
Область: [`roo_code/roo-context/api/00-conventions.md`](../../roo-context/api/00-conventions.md) §2
«Каталог кодов ошибок», каталоги кодов пятнадцати доменных файлов
`roo_code/roo-context/api/*.md` и §6 контракта заказов
[`orders-backend-contract.md`](../orders/orders-backend-contract.md).
Начато: 2026-09-12.

---

## БАГ-01 — §2 требует «ни один код не является подстрокой другого», а требование нарушено пятьюдесятью парами

**File:** `roo_code/roo-context/api/00-conventions.md:77-79`
**Severity:** High — требование контракта, которое нельзя выполнить, не переименовав каталог
целиком; пока оно стоит, каждый новый код приходится придумывать под несуществующее ограничение.
**Источник:** цикл проверок, Л5 (второй источник правила) + машинный пересчёт
**Тип:** Contract

### Problem

§2 объявляет доменным кодам правило (и заодно ссылается на строки, которых больше нет:
`services/orderLineEdits.ts:343-354` указывало на комментарий о порядке, а после перевода
сравнения на равенство 2026-09-12 таблица сдвинулась и живёт на `:308-416` — ссылку править
вместе с текстом требования, а не отдельно):

> **Ни один код не является подстрокой другого.** Фронт местами сравнивает код подстрокой
> (`services/orderLineEdits.ts:343-354`), поэтому «услуги нет в каталоге» называется
> `CATALOG_SERVICE_NOT_FOUND`, а не `SERVICE_NOT_FOUND` (`mocks/orders.ts:373-376`).

Требование **уже нарушено массово**. Пересчёт по каталогам контракта, по тому, что бросает мок,
и по ядру бэкенда даёт **172 настоящих кода и 50 пар вложенности** — то есть в 50 случаях один
код целиком помещается внутри другого. Доказательство лежит в `/tmp/proof-nesting.txt`
(скрипт печатает набор, каждую пару и её разбор по доменам).

Что это за пары:

| перехватывающий код | сколько чужих отказов накрывает | пример |
|---|---|---|
| `NOT_FOUND` (ядро, `backend/app/core/exceptions.py:13-20`) | 39 | `NOT_FOUND` ⊂ `ORDER_NOT_FOUND` |
| `SERVICE_NOT_FOUND` | 2 | ⊂ `CATALOG_SERVICE_NOT_FOUND`, ⊂ `ORDER_SERVICE_NOT_FOUND` |
| `BATCH_NOT_FOUND` | 2 | ⊂ `RETURN_BATCH_NOT_FOUND`, ⊂ `SHIPMENT_BATCH_NOT_FOUND` |
| `FORBIDDEN` (ядро) | 2 | ⊂ `FORBIDDEN_CORRECTION`, ⊂ `FORBIDDEN_MANUALCOST` |
| `CONFLICT` (ядро) | 1 | ⊂ `ORDER_VERSION_CONFLICT` |
| `PRODUCT_NOT_FOUND` | 1 | ⊂ `CATALOG_PRODUCT_NOT_FOUND` |
| `UOM_NOT_FOUND` | 1 | ⊂ `SERVICE_UOM_NOT_FOUND` |
| `CURRENCY_NOT_FOUND` | 1 | ⊂ `SERVICE_CURRENCY_NOT_FOUND` |
| `AUDIT_ENTRY_NOT_FOUND` | 1 | ⊂ `ORDER_AUDIT_ENTRY_NOT_FOUND` |

**Лекарство §2 само себя опровергает.** `SERVICE_NOT_FOUND` переименовали в
`CATALOG_SERVICE_NOT_FOUND`, чтобы уйти от вложенности в `ORDER_SERVICE_NOT_FOUND`. Приставка
уходу не помогает: `SERVICE_NOT_FOUND` ⊂ `CATALOG_SERVICE_NOT_FOUND` — та же вложенность, только
с другой стороны. Ровно так же `PRODUCT_NOT_FOUND` ⊂ `CATALOG_PRODUCT_NOT_FOUND`. Приставка
**создаёт** вложенность, а не снимает её: любой код, полученный приписыванием слова спереди,
содержит исходный.

**Почему пятнадцать доменных проверок ничего не заметили.** Каждый домен считал пары **внутри
себя** и честно писал «0 пар» — например `warehouse.md:110-112`: «проверено попарно по всем 22
(0 пар), проверка проинвертирована на подставленной паре `BATCH_NOT` ⊂ `BATCH_NOT_FOUND`».
Проверка работает, замер верен, и вывод из него всё равно ложный: **30 пар из 50 — междоменные**
(`BATCH_NOT_FOUND` из warehouse внутри `RETURN_BATCH_NOT_FOUND` из orders), а ещё ядерные
`NOT_FOUND`/`FORBIDDEN`/`CONFLICT` не принадлежат ни одному домену и в подомённый счёт не
попадают вовсе. Правило сквозное, а проверялось пятнадцатью независимыми срезами — классический
второй источник правила, от которого лечит Л5.

**Чем это грозило на самом деле.** Подстрочное сравнение до 2026-09-12 стояло в трёх местах:
`useClients.ts:73`, `useOrderCard.ts:542,1702-1703` и таблица `ERROR_KEYS`
(`services/orderLineEdits.ts:308-416`) через `errorMessageKey`. Внутри `ERROR_KEYS` вложенных
пар нет (пересчитано: 0), поэтому не стреляло — но правильность держалась комментарием
«код, содержащийся в другом, обязан идти вторым», то есть ручной дисциплиной, ничем не
проверяемой. Первый же добавленный `NOT_FOUND` или `SHIPMENT_NOT_FOUND` в начало таблицы
перехватил бы десяток чужих отказов молча.

### Fix

TBD — **решение владельца, не агента.** Каталог кодов без владельца не переименовывают.
Развилка, как она видится из кода:

1. **Снять требование из §2** и записать вместо него то, что теперь верно: код сравнивается
   **равенством**, форму `КОД: подробность` разбирает `errorCode`
   (`frontend_vue/src/services/apiErrorCode.ts:41-48`). Тогда вложенность безвредна и
   переименовывать нечего — а `CATALOG_SERVICE_NOT_FOUND` и `CATALOG_PRODUCT_NOT_FOUND` остаются
   как есть, просто по другой причине (они называют другую сущность, а не спасаются от коллизии).
2. **Оставить требование** — тогда придётся переименовать не две пары, а весь хвост `*_NOT_FOUND`
   и уйти от ядерных `NOT_FOUND`/`FORBIDDEN`/`CONFLICT`, которые объявлены в
   `backend/app/core/exceptions.py:13-48` и с доменными кодами пересекаются по построению.

Подстрочное сравнение во фронте к моменту записи находки **уже снято** (та же задача прогона),
так что вариант 1 ничего не ломает: ни одно место больше не зависит от невложенности.

### Future rule

Сквозное требование проверяется сквозной проверкой. Пятнадцать подомённых замеров «0 пар»
в сумме не дают «0 пар» по каталогу, и каждый из них при этом верен — вывод ложный не из-за
ошибки в замере, а из-за того, что область замера уже области требования. Требование к
**множеству** кодов (уникальность, невложенность, префиксы) считается на объединённом множестве,
одним скриптом, и результат печатается строкой — так же, как `[контракт] сведено доменов: …`.

### Как пересчитать

Скрипт собирает набор из трёх источников и печатает каждую пару:

```python
# из корня репозитория: python3 - <<'PY'
import re, pathlib
root = pathlib.Path('.'); codes = {}
def add(c, src): codes.setdefault(c, set()).add(src)
CODE = re.compile(r'^[A-Z][A-Z0-9_]{4,}$')
# Не коды: подставная пара из проверки warehouse.md:111, обрубок шаблона
# `FORBIDDEN_${right}` (mocks/orders.ts:1865), два слова из прозы —
# про DUPLICATE контракт прямо пишет «кода в домене нет» (config.md:834).
NOISE = {'BATCH_NOT', 'FORBIDDEN_', 'COUNT', 'DUPLICATE'}
api = root / 'roo_code/roo-context/api'
for f in sorted(api.glob('*.md')):
    inside = False
    for ln in f.read_text().splitlines():
        if ln.startswith('## '):
            low = ln.lower(); inside = 'код' in low and 'каталог' in low; continue
        if inside:
            for t in re.findall(r'`([A-Z][A-Z0-9_]*)`', ln):
                if CODE.match(t): add(t, f'contract:{f.name}')
conv = (api / '00-conventions.md').read_text()
for t in re.findall(r'^\| `([A-Z_]+)` \|', conv, re.M): add(t, 'contract:00-conventions.md')
for t in ('MISSING_TOKEN', 'TOKEN_EXPIRED', 'INVALID_TOKEN'): add(t, 'contract:00-conventions.md')
oc = (root / 'roo_code/plans/orders/orders-backend-contract.md').read_text()
for t in re.findall(r'`([A-Z][A-Z0-9_]*)`', oc.split('## 6. Коды ошибок')[1].split('\n## 7.')[0]):
    if CODE.match(t): add(t, 'contract:orders-backend-contract§6')
for f in (root / 'frontend_vue/src/services/mocks').glob('*.ts'):
    if f.name.endswith('.spec.ts'): continue
    for m in re.findall(r"throw new Error\(\s*['\"`]([^'\"`]*)", f.read_text()):
        t = re.match(r'^([A-Z][A-Z0-9_]{4,})(?::|$)', m)
        if t: add(t.group(1), f'mock:{f.name}')
exc = root / 'backend/app/core/exceptions.py'
if exc.exists():
    for t in re.findall(r'code="([A-Z_]+)"', exc.read_text()): add(t, 'backend:core/exceptions.py')
for n in NOISE: codes.pop(n, None)
names = sorted(codes)
pairs = [(a, b) for a in names for b in names if a != b and a in b]
print('настоящих кодов в наборе:', len(names))
print('пар вложенности (короткий ⊂ длинный):', len(pairs))
for a, b in pairs:
    print(f'{a:34s} ⊂ {b:38s}', 'ОДИН домен' if codes[a] & codes[b] else 'РАЗНЫЕ домены')
print('перехватывающих кодов:', len({a for a, _ in pairs}))
print('внутридоменных пар:', sum(1 for a, b in pairs if codes[a] & codes[b]))
print('междоменных пар:', sum(1 for a, b in pairs if not (codes[a] & codes[b])))
```

Замер 2026-09-12: `настоящих кодов в наборе: 172`, `пар вложенности: 50`,
`внутридоменных пар: 20`, `междоменных пар: 30`, `перехватывающих кодов: 9`.

**Поправка к счёту, который вызвал находку.** Заявлено было «51 пара» и четыре примера.
Три примера подтвердились (`PRODUCT_NOT_FOUND` ⊂ `CATALOG_PRODUCT_NOT_FOUND`,
`BATCH_NOT_FOUND` ⊂ `RETURN_BATCH_NOT_FOUND`, `UOM_NOT_FOUND` ⊂ `SERVICE_UOM_NOT_FOUND`).
Четвёртый — **`EMAIL_TAKEN` ⊂ `CLIENT_EMAIL_TAKEN` — не подтвердился: кода `EMAIL_TAKEN` не
существует**, и это записано в самом контракте: `auth.md:568` перечисляет его среди
унаследованного, не подтверждённого кодом, с доказательством «`grep -rn "EMAIL_TAKEN" backend/app
frontend_vue/src` пуст; регистрация отдаёт `CONFLICT`». Разница 51 против 50 — в границе набора,
а не в существе находки: два счёта по-разному решают, что считать настоящим кодом.

---

## Сводная таблица

| | БАГ | Тип | Файл | Суть |
|---|---|---|---|---|
| | БАГ-01 | Contract | `00-conventions.md:77-79` | Требование «ни один код не подстрока другого» нарушено 50 парами; лекарство §2 (приставка `CATALOG_`) создаёт ровно ту коллизию, от которой лечит |
