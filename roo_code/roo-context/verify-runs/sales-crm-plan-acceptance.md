# CRM-план после П130 — журнал подготовки кандидата

Дата: 2026-09-18. Задача: `crm-plan-acceptance`.
Статус: кандидат для проверки контроллером и независимым reviewer; автор не объявляет
независимую приёмку, готовность сервера или выполнение С0–С6.

Область: [CRM-план](../../plans/sales-crm/sales-crm-backend-plan.md) и этот новый журнал.
Применены навыки vue-rules, verify, create-plan и api-contract; прочитаны ROO.md,
create-page и orchestrate. Приоритет имеют ограничения задания: без вопросов, агентов,
изменений исходников/контрактов/ответов владельца, Git, зависимостей и workflow.
Старые /tmp/night-queue-briefs не использовались. Исторический журнал внутри плана сохранён.

## 1. Приоритет требований и проверка обязательств

Прочитаны источники checkout: [реестр решений](../../plans/api/audit/00-решения-владельца.md),
[ответы владельца](../../plans/general/вопросы-владельцу-после-сверки-2026-09-17.md),
[соглашения](../api/00-conventions.md), [контракт CRM](../api/sales-crm.md),
[сквозная сводка](../../plans/general/сквозное-сводка.md) и соответствующие разделы шести
сквозных планов. Старые «осталось» в контракте не открывают уже решённые вопросы.

Команды чтения (выполнены из корня checkout):

```bash
sed -n '2630,2680p' roo_code/plans/api/audit/00-решения-владельца.md
sed -n '100,122p' roo_code/plans/general/вопросы-владельцу-после-сверки-2026-09-17.md
sed -n '1446,1464p' roo_code/roo-context/api/00-conventions.md
sed -n '1600,1620p' roo_code/roo-context/api/00-conventions.md
sed -n '336,370p' roo_code/plans/general/сквозное-rights-план.md
sed -n '484,570p' roo_code/plans/general/сквозное-rights-план.md
sed -n '301,325p' roo_code/plans/general/сквозное-tenancy-план.md
sed -n '96,114p' roo_code/plans/general/сквозное-audit-log-план.md
sed -n '365,397p' roo_code/plans/general/сквозное-notifications-план.md
sed -n '470,490p' roo_code/plans/general/сквозное-idempotency-план.md
rg -n -m 4 'sales-crm|Кастомных полей у домена нет' roo_code/plans/general/сквозное-custom-fields-план.md
```

Ниже результат содержательной сверки, а не результат выполнения будущих тестов.

| Требование и полученный факт источника | Место в плане и вывод |
|---|---|
| П130: месяц исходной отгрузки, сентябрь 400→300 после октябрьского возврата, октябрь 0; полный возврат обнуляет исходный вклад | §4, С0, С3 уже соответствовали. Уточнены передача связи/валюты через С1, мок С5 и единая регрессия С6 через все зависимые слайсы. Вопрос не открывается |
| П24/П23: список сумм по валютам, без конвертации; П19: сохранённая валюта старой записи | §4, С0, С1, С3, С5: нет суммы EUR+USD и замены отсутствующей валюты на EUR; отрицательная проверка смены валюты добавлена в С6 |
| П27/П62/П80: текущий месяц до серверного момента, пояс компании; ответ В004 задаёт страну с уточнением, а не рекомендацию взять пояс устройства | §4, С1, С3: settings владеет поясом; клиентская календарная дата не превращается в UTC-инстант. Публичный фильтр прошлого месяца не добавляется; пересчёт сентября проверяется общим расчётом |
| П45 и §23 соглашений: один срез, отметка в ответе, скрыта в UI | С0 задаёт технические входы и результат; С4 требует единое состояние, конкурентные commit/rollback, повтор и отказ источника; один timestamp при независимых чтениях отвергнут |
| П6/П16/П17 и rights Д1–Д10: revenue независимо от cost, owner/admin/accounting, полное вырезание, готовность прав, защита маршрута | §5, С0, С2, С5: GET → sales-crm.stats/read, revenue — отдельный field, нет локального ролевого механизма. Числа для восстановления выручки не отдаются; ссылки и кнопки виджетов не обходят права orders/clients |
| Rights Р5/Р-Д3: база admin и порог 90 %, при пустом домене работает только база; специальная строка revenue задаётся П16 | Неполнота начальной матрицы stats честно отнесена к С0. Добавлены исходный набор, порядок регистрации, семь ролей, переопределения и проверяемые примеры. Ни раздача всем ролям, ни готовность матрицы не утверждаются |
| Tenancy Т1–Т4, П76/П79: компания из сеанса, изоляция каждого источника, отзыв доступа | §6, С1, С2, С4: двухтенантные фикстуры, запрет подмены tenant, чужого среза, 401/403 до чтения; у CRM нет собственных таблиц/уникальностей |
| Audit-log: просмотры не пишутся; П85 расширяет виды других доменов | §6 и С6: GET не создаёт бизнес-журнал; нет своего вида и удаления; события заказов не дублируются в общем моке |
| Notifications: событие рождается переходом, для CRM событий нет; П126 относится к аналитической главной | §6: дословное отсутствие событий, нет нового типа, polling/push и блока тревог; С6 проверяет отсутствие побочного эффекта GET |
| Idempotency: CRM имеет 0 POST, Save — отдельными запросами, версия не ведётся | §6: обязательные строки сохранены с пояснением отсутствия мутаций; согласованный срез не подменён If-Match или Idempotency-Key |
| Custom-fields: CRM относится к блоку А без кастомных полей; П65/П71 сохраняют отсрочки | §6 и §9: дословная строка есть, редактор карточек и отменённые отчёты не становятся зависимостями KPI |
| П63: pending только new/confirmed с подсказкой; общие предикаты active/countsAsSale | §4, С3, С5: переименование и новый пользовательский статус не расширяют pending; отрицательные тесты покрывают terminal и отмены |
| Общие соглашения §1–2: ApiResponse для успеха, HTTP detail с code для ошибки | §7, С2, С5: общий конверт, без новых кодов CRM; сбой источника не превращается в успешные нули, UI переводит code |

## 2. Один маршрут против текущего кода

Выполненные команды:

```bash
rg -n 'sales-crm|SalesCrmStats|mockGetSalesCrmStats' frontend_vue/src backend/app
cat frontend_vue/src/composables/useSalesCrmDashboard.ts
sed -n '40,65p' frontend_vue/src/services/ordersService.ts
sed -n '35,65p' frontend_vue/src/types/order.ts
sed -n '1577,1596p' frontend_vue/src/services/mocks/orders.ts
sed -n '1,48p' frontend_vue/src/services/api.ts
sed -n '190,225p' frontend_vue/src/services/api.ts
cat backend/app/main.py
sed -n '1,55p' backend/app/modules/auth/internal_api/interface.py
ls backend/app/modules
sed -n '1,50p' frontend_vue/src/views/admin/sales-crm/SalesCrmPage.vue
sed -n '80,130p' frontend_vue/src/domain/orderStatus.ts
sed -n '2958,3025p' frontend_vue/src/services/mocks/orders.spec.ts
sed -n '1,85p' frontend_vue/tests/e2e/admin/sales-crm/sales-crm.spec.ts
```

Фактические результаты:

- getSalesCrmStats вызывает только `apiGet('/api/sales-crm/stats')`, без params;
  getMock содержит литеральную ветку этого пути на строке 627 и вызов mockGetSalesCrmStats.
- SalesCrmStats содержит activeOrders, pendingOrders, salesMtd, newClientsThisMonth —
  четыре обязательных number. Мок суммирует totalAmount по createdAt и местному monthStart.
  Это снимок старой реализации, а не норма П69/П130.
- useSalesCrmDashboard делает Promise.all из stats, orders и clients; оба виджета запрашивают
  pageSize 5, сортировку createdAt desc. Общего контекста чтения нет. Ошибка берётся из message;
  SalesCrmPage.formatCurrency вставляет фиксированный знак евро.
- apiGet уже вызывает buildHeaders с authHeaders и для getMock, и для fetch.
  toQueryStrings пропускает null/undefined; повторная реализация подписи или исправление
  старого clientId=null в CRM не нужны. План это уже учитывает.
- В backend/app/modules перечислены auth, bcc, billing, finance, notifications, products,
  services, settings, suppliers, warehouse; sales_crm, orders и clients отсутствуют.
  main.py CRM-router не подключает. check_permission содержит `return True` с пометкой Placeholder.
- isActive исключает delivered и terminal; isTerminal включает completed, returned и четыре
  отмены. countsAsSale исключает new, отмены и returned. Список pending в моке — new/confirmed.
- Блок sales CRM statistics в orders.spec.ts повторяет фильтр createdAt и сумму totalAmount;
  e2e содержит сценарий прироста active/pending после создания заказа. Эти тесты не доказывают
  П130, многовалютность, вырезание или согласованный срез. План С6 уже требует замены доказательств.

Дополнительно `rg -n 'П130|возврат.*месяц|сентябр|октябр'
roo_code/plans/{orders,warehouse,analytics,finance}/*backend*.md` не нашёл совпадений (exit 1).
Это ограниченный поиск, а не доказательство отсутствия всякого описания правила. Зависимые
планы не исправлялись: реестр П130 и дополнения действующих соглашений/контракта CRM старше;
CRM С0/С1 требуют синхронизации интерфейсов до реализации. Готовность соседних доменов не заявлена.

## 3. Находки и повторный проход документа

Первый проход выявил две неполноты в области задачи:

1. `sales-crm-backend-plan.md:С0:критерии-входа` — требования уже названы, но результат
   применения прав и граница блокировки требуют явной фиксации. Добавлена таблица входов и
   проверяемых выходов форм/прав/среза/связи возврата, запрет считать С0 выполненным, ограничение
   блокировки зависимыми работами CRM. Весь auth не блокируется.
2. `sales-crm-backend-plan.md:С6:регрессия-П130` — числовой пример был в §4/С0/С3,
   но не был явно передан интерфейсам и мок-тестам. Добавлено применение в С1/С5/С6,
   сохранение валюты, отсутствие двойного вычитания, конкурентный возврат и инверсии.

Повторное чтение после правок: С0–С6 сохраняют зависимости и отрицательные критерии.
С0 отвергает старые четыре числа и формальный timestamp; С1 — чужие данные/N+1/нулевую
заглушку; С2 — обход auth/rights; С3 — totalWithVat/неверный период/статусы; С4 — смешанный
срез и чужой контекст; С5 — евро по умолчанию и частичную загрузку; С6 — инверсии изоляции,
расчёта, вырезания, пагинации и среза. Новых продуктовых возможностей нет.
Будущие backend-пакеты и тесты помечены в §8 и §10 как будущие, не выданы за существующие.

Содержательно проверены К1–К7 в области плана (инвентарь, мок, ошибки, формы,
старшинство, обязательства и ссылки), Л3/Л5/Л9 и применимые Б1–Б5 как требования к будущему
коду. Это документальная сверка; runtime-прохождение этих линз не заявлено.

## 4. Воспроизводимая структурная проверка

Блок ниже исполняется из корня checkout, ничего не записывает. Проверяет только структуру,
локальные Markdown-цели/явные якоря и сохранность исторического журнала. Содержательную
правильность П130 доказывают источники и сверка выше, не наличие слова в документе.

```python
from pathlib import Path
import hashlib
import re
from urllib.parse import unquote

plan = Path('roo_code/plans/sales-crm/sales-crm-backend-plan.md')
journal = Path('roo_code/roo-context/verify-runs/sales-crm-plan-acceptance.md')
text = plan.read_text()
historical = text.split('### Журнал проверки документа', 1)[1]
assert hashlib.sha256(historical.encode()).hexdigest() == 'bed8dd1266571a23a45a2a7702269c3245a4e185734cd327770d1b7b28cf3308'
print('historical journal: unchanged')
sections = re.findall(r'^### С([0-6])\. (.*?)(?=^### |^## |\Z)', text, re.M | re.S)
assert [n for n, _ in sections] == list('0123456')
for n, section in sections:
    assert 'Зависимости:' in section and 'Приёмка:' in section, n
print('slices: C0-C6, dependencies and acceptance present')
routes = re.findall(r'^### (GET|POST|PUT|PATCH|DELETE) (/api/\S+)', text, re.M)
assert routes == [('GET', '/api/sales-crm/stats')], routes
print('CRM route headings: 1 GET /api/sales-crm/stats')
assert 'Событий домена нет.' in text and 'Кастомных полей у домена нет.' in text
for doc in (plan, journal):
    prose = re.sub(r'```.*?```', '', doc.read_text(), flags=re.S)
    links = re.findall(r'\[[^\]\n]*\]\(([^)\n]+)\)', prose)
    local = 0
    for link in links:
        if re.match(r'https?://', link):
            continue
        name, _, anchor = unquote(link).partition('#')
        target = (doc.parent / name).resolve() if name else doc.resolve()
        assert target.exists(), (doc, link)
        if anchor:
            assert f'id="{anchor}"' in target.read_text(), (doc, link)
        local += 1
    assert local > 0, doc
    print(f'{doc}: local Markdown links={local}, broken=0')
```

Запуск выполнен командой:

```bash
python3 - <<'PY'
from pathlib import Path
s = Path('roo_code/roo-context/verify-runs/sales-crm-plan-acceptance.md').read_text()
code = s.split('```python\n', 1)[1].split('\n```', 1)[0]
exec(compile(code, 'sales-crm-plan-acceptance.md:structural-check', 'exec'))
PY
```

Фактический stdout, exit 0:

```text
historical journal: unchanged
slices: C0-C6, dependencies and acceptance present
CRM route headings: 1 GET /api/sales-crm/stats
roo_code/plans/sales-crm/sales-crm-backend-plan.md: local Markdown links=49, broken=0
roo_code/roo-context/verify-runs/sales-crm-plan-acceptance.md: local Markdown links=6, broken=0
```

Хеш исторической части снят перед правками. Число 49 относится к текущему плану;
исторические «48 ссылок» не переписаны и не выданы за сегодняшний замер.
Это локальная структурная проверка, не строгая проверка всех видов ссылок контроллера.

## 5. Передача контроллеру

`npm run verify`, task.checks и строгие проверки ссылок ожидают контроллера согласно
заданию. Здесь они не запускались и пройденными не названы. Новые backend/runtime-тесты
не создавались вне разрешённых outputs: их сценарии и ожидаемые значения подготовлены
в С0–С6 плана, структурная проверка — в этом журнале. Фактические логи машинной приёмки
и вердикт независимого reviewer должны быть получены отдельно.
