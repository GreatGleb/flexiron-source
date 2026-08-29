# Часть 039 — roo_code/plans/suppliers

## roo_code/plans/suppliers/suppliers-api-contract-analysis.md

**Вердикт: частично**

Незакрытых чекбоксов: 0 (`grep -c "^[[:space:]]*- \[ \]"` → `0`). Это не план работ,
а аналитическая записка: она (а) утверждает состояние фронта и бэка, (б) требует пять
уточнений в контракте («Critical Path Items», раздел 5.3 и 7), (в) объявляет к реализации
29 эндпоинтов шести фаз (раздел 5.4).

### Что сделано

**Пять «критических уточнений» — все пять закрыты в контракте.**

1. Wire format `TranslatedString` — `roo_code/roo-context/03-api-contract.md:74`:
   «В примерах ниже для краткости может использоваться `"company": "Metalltorg"` — это
   сокращение. Реальный wire format — всегда `TranslatedString`». Плюс строка 2574:
   «мультилокалевые поля (`TranslatedString`) передаются во всех трёх локалях (ru, en, lt) всегда».
2. Формат diff аудита — строки 470–505: `oldValue`/`newValue` — JSON-строки с ключами
   изменённых полей, пример `"oldValue": "{\"rating\":3}"`; строка 505: «это строки
   (JSON serialized), а не вложенные объекты. Сервер хранит их как есть, без парсинга».
3. Virus scan — строка 179: «Virus-scan синхронный (блокирующий). 422 `INFECTED` — если файл
   заражён». То есть выбран вариант (a) из рекомендации плана.
4. Тип `entryId` — строка 530: «`entryId` — это DB ID (UUID), а не индекс в массиве»;
   строка 528: «`entryId` — UUID аудит-записи (генерируется сервером, возвращается в `auditLog[].id`)».
5. Принимаемые поля `POST /api/suppliers` — строки 389–422: полный перечень required
   (`company`, `email`) и optional с дефолтами, включая `addresses`, `contacts`, `files`, `fileIds`.

**Фронтенд действительно на месте целиком** (все 15 файлов из таблицы раздела 1 существуют),
но строчные метрики плана устарели — файлы с тех пор выросли/сжались:

| файл | план | факт (`wc -l`) |
|---|---|---|
| SuppliersListPage.vue | 673 | 632 |
| SupplierCardPage.vue | 341 | 361 |
| BccRequestPage.vue | 1350 | 1183 |
| SupplierCardConfigPage.vue | 1053 | 1098 |
| suppliersService.ts | 95 | 99 |
| mocks/suppliers.ts | 473 | 568 |
| mocks/index.ts | 358 | 1700 |

Композаблы все пять на месте: `useSuppliers.ts`, `useSupplierCard.ts`, `useSupplierCreate.ts`,
`useBccRequest.ts`, `useCardConfig.ts` (`ls frontend_vue/src/composables/`).

**Схема БД под домен заложена.** Модели есть — `backend/app/modules/suppliers/shared/models.py`:
`Supplier`, `SupplierAddress`, `SupplierContact`, `SupplierFile`, `SupplierAuditEntry`,
`SupplierPriceEntry`, `FieldDefinition`, `SectionConfig`, `SectionField`;
`backend/app/modules/bcc/shared/models.py`: `BccCategory`, `BccEvent`. Миграции:
`a8dd7d7ba74b_phase_6_suppliers.py`, `e24a3922ed01_phase_7_config.py`, `f96e6fb2d5cf_phase_8_bcc.py`.

Из 29 объявленных эндпоинтов **реализованы 4**: `POST /api/auth/login`, `POST /api/auth/register`,
`GET /api/auth/me` (+ вне списка `GET /api/auth/link` — magic link) и `POST /api/uploads`
(`backend/app/core/uploads/action.py`).

### Чего нет

- Утверждение раздела 1 «**No backend exists yet**» больше не верно: бэкенд есть, 11 модулей,
  17 миграций, 31 задекорированный эндпоинт (в основном settings и products).
- **Suppliers: 0 из 7 эндпоинтов.** `backend/app/modules/suppliers/features/` содержит только
  `__init__.py` — ни одного слайса. То же у `bcc/features/` (0 из 7). Config-эндпоинтов (0 из 9)
  нет вовсе: модели `FieldDefinition`/`SectionConfig` лежат в модуле suppliers, слайсов нет.
- **Analytics: 0 из 8.** `grep -ril analytics backend/app` — пусто.
- **Auth не 5, а 3 эндпоинта:** `POST /api/auth/logout` и `POST /api/auth/refresh` не существуют
  (`grep -rn "logout\|refresh" backend/app --include=*.py` — ни одного совпадения), хотя план
  ставит Auth «✅ 100%».
- Ни один роутер suppliers/bcc/config не подключён в `backend/app/main.py` (строки 66–74).
- **Две ссылки плана ведут в никуда:** `toDo/admin-api-contract.md` («duplicate copy, 982 lines»)
  не существует — `ls: cannot access`; `roo_code/plans/suppliers/4.1-suppliers-plan.md` тоже
  не существует, каталог `roo_code/plans/suppliers/` содержит один файл — сам этот анализ.
- Контракт вырос с заявленных 981 строки до 157590 байт — метрика плана устарела.
- Фронт по-прежнему на моках: `frontend_vue/.env:2: VITE_USE_MOCKS=true`.

### Доказательства

```
$ grep -c "^[[:space:]]*- \[ \]" roo_code/plans/suppliers/suppliers-api-contract-analysis.md
0

$ ls roo_code/plans/suppliers/
suppliers-api-contract-analysis.md

$ ls -la toDo/admin-api-contract.md roo_code/plans/suppliers/4.1-suppliers-plan.md
ls: cannot access 'toDo/admin-api-contract.md': No such file or directory
ls: cannot access 'roo_code/plans/suppliers/4.1-suppliers-plan.md': No such file or directory

$ ls -la roo_code/roo-context/03-api-contract.md
-rw-rw-r-- 1 greatgleb greatgleb 157590 Aug 26 15:30 roo_code/roo-context/03-api-contract.md

$ for f in <15 файлов таблицы раздела 1>; do ... wc -l ...; done
OK 632 frontend_vue/src/views/admin/suppliers/SuppliersListPage.vue
OK 361 frontend_vue/src/views/admin/suppliers/SupplierCardPage.vue
OK  87 frontend_vue/src/views/admin/suppliers/SupplierCreatePage.vue
OK 1183 frontend_vue/src/views/admin/suppliers/BccRequestPage.vue
OK 1098 frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue
OK 112 frontend_vue/src/types/supplier.ts
OK  47 frontend_vue/src/types/bcc.ts
OK  65 frontend_vue/src/types/config.ts
OK  99 frontend_vue/src/services/suppliersService.ts
OK  78 frontend_vue/src/services/bccService.ts
OK  82 frontend_vue/src/services/configService.ts
OK  17 frontend_vue/src/services/uploadsService.ts
OK 568 frontend_vue/src/services/mocks/suppliers.ts
OK 1700 frontend_vue/src/services/mocks/index.ts
OK 245 frontend_vue/src/services/api.ts

$ ls frontend_vue/src/composables/ | grep -iE "supplier|bcc|config"
useBccRequest.ts
useCardConfig.ts
useSupplierCard.ts
useSupplierCreate.ts
useSuppliers.ts

$ find backend/app/modules -type d -name features -exec sh -c 'echo "-- $1"; ls "$1"' _ {} \;
-- backend/app/modules/suppliers/features
__init__.py
-- backend/app/modules/bcc/features
__init__.py
-- backend/app/modules/auth/features
__init__.py  login  magic_link  me  register
-- backend/app/modules/settings/features
__init__.py  crud  profile
-- backend/app/modules/products/features
__init__.py  create_product  get_product_detail
(остальные — только __init__.py)

$ grep -rn "@router\.\(get\|post\|patch\|put\|delete\)" backend/app --include=*.py
backend/app/core/uploads/action.py: @router.post("", ...)
backend/app/modules/auth/features/login/action.py: @router.post("/login", ...)
backend/app/modules/auth/features/magic_link/action.py: @router.get("/link", ...)
backend/app/modules/auth/features/me/action.py: @router.get("/me", ...)
backend/app/modules/auth/features/register/action.py: @router.post("/register", ...)
backend/app/modules/products/... (2)
backend/app/modules/settings/... (24)
— ни одного suppliers/bcc/config/analytics

$ grep -rn "logout\|refresh" backend/app --include=*.py | grep -i "router\|def \|path"
(пусто)

$ grep -rn "analytics" backend/app --include=*.py -il
(пусто)

$ grep -n "class \|__tablename__" backend/app/modules/suppliers/shared/models.py
14:class Supplier ... 17:__tablename__ = "suppliers"
81:class SupplierAddress ... 112:class SupplierContact ... 140:class SupplierFile
170:class SupplierAuditEntry ... 204:class SupplierPriceEntry
240:class FieldDefinition ... 269:class SectionConfig ... 294:class SectionField

$ grep -rln "suppliers\|bcc_categories\|field_definitions" backend/alembic/versions/
a8dd7d7ba74b_phase_6_suppliers.py
e24a3922ed01_phase_7_config.py
f96e6fb2d5cf_phase_8_bcc.py
fd0ecc1269df_phase_9_warehouse.py
8cf3bfa380dd_phase_12_plans_multi_role.py

$ grep -n "TranslatedString\|virus\|entryId — это DB ID" roo_code/roo-context/03-api-contract.md
74:  Реальный wire format — всегда `TranslatedString`.
179:  Virus-scan синхронный (блокирующий). 422 `INFECTED` — если файл заражён.
505:  `oldValue`/`newValue` — это строки (JSON serialized), а не вложенные объекты.
530:  `entryId` — это DB ID (UUID), а не индекс в массиве.
2574: мультилокалевые поля (`TranslatedString`) передаются во всех трёх локалях всегда.

$ grep -n "include_router" backend/app/main.py
66-74: products ×2, auth ×4, settings ×2, uploads — итого 9 роутеров
```

### Что осталось

Реализовать бэкенд домена: 7 эндпоинтов suppliers, 7 bcc, 9 config, 8 analytics,
плюс `POST /api/auth/logout` и `POST /api/auth/refresh` — 25 из 29 (фаза 1 частично,
фазы 2–5 целиком). Схема БД и модели под это уже есть. Заодно поправить в самом
документе три устаревших факта: «No backend exists yet», ссылку на несуществующий
`toDo/admin-api-contract.md` и ссылку на несуществующий `4.1-suppliers-plan.md`.

### Пункты

Чекбоксов в плане нет — итемов не приводится.
