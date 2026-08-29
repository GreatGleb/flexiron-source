# Инвентаризация: roo_code/plans/api

## roo_code/plans/api/api-endpoints-list.md — ЧАСТИЧНО

Незакрытых чекбоксов: 0 (`grep -c "^[[:space:]]*- \[ \]"` → `0`).

Это не план работ, а справочный список: перечисление 28 эндпойнтов фронтенда плюс
таблица «данные, которые требуют `resolveLabel()`». Проверял два утверждения:
(а) перечисленные эндпойнты вызываются из кода, (б) механизм `resolveLabel()` +
`labelLookup.ts` + `admin.ts` существует.

### Что есть

Все 28 перечисленных путей действительно вызываются из соответствующих сервисов.

```
$ cd frontend_vue/src/services && for f in productsService.ts categoriesService.ts \
    suppliersService.ts bccService.ts configService.ts analyticsService.ts uploadsService.ts; \
    do echo "===== $f"; grep -nE "'/(api/)?[a-z]|\`/(api/)?[a-z]|\"/(api/)?[a-z]" $f; done
===== productsService.ts
20:  return apiGet('/api/products', params)
24:  return apiGet(`/api/products/${id}`)
57:  return apiPost('/api/products', payload)
110:  return apiPatch(`/api/products/${id}`, payload)
116:  return apiGet('/api/products/list')
120:  return apiDelete(`/api/products/${id}`)
124:  await apiDelete<void>(`/api/products/${productId}/audit/${entryId}`)
===== categoriesService.ts
12:  return apiGet('/api/categories', {
20:  return apiGet(`/api/categories/${id}`)
31:  return apiPost('/api/categories', {
53:  return apiPatch(`/api/categories/${id}`, payload)
57:  return apiDelete(`/api/categories/${id}`)
65:  return apiPut(`/api/categories/${id}/fields`, {
===== suppliersService.ts
20:  return apiGet<PaginatedResponse<Supplier>>('/api/suppliers', params)
24:  return apiGet<SupplierCardData>(`/api/suppliers/${id}`)
33:  return apiPatch<SupplierCardData>(`/api/suppliers/${id}`, {
55:  await apiPatch<void>(`/api/suppliers/${id}/status`, { status })
62:  return apiPost<SupplierCardData>('/api/suppliers', {
83:  await apiDelete<void>(`/api/suppliers/${supplierId}/audit/${entryId}`)
93:  return apiGet<string>('/api/suppliers/export.csv', params)
98:  return apiGet<Array<{ id: string; company: string }>>('/api/suppliers/list')
===== bccService.ts
7:  return apiGet<BccCategory[]>('/api/bcc/categories')
11:  return apiGet<BccRecipient[]>('/api/bcc/recipients', { products: productIds.join(',') })
21:  return apiGet<PaginatedResponse<BccRequest>>('/api/bcc/history', params)
36:    '/api/bcc/send',
58:    '/api/bcc/log',
73:  return apiPost<BccRequest>(`/api/bcc/events/${eventId}/response`, payload)
77:  return apiPost<BccRequest>(`/api/bcc/events/${eventId}/no-response`, {})
===== configService.ts
7:  return apiGet<FieldDefinition[]>('/api/config/fields')
12:  await apiPut<void>('/api/config/fields', fields)
22:  return apiPost<FieldDefinition>('/api/config/fields', {
37:  return apiPatch<FieldDefinition>(`/api/config/fields/${id}`, translatedPatch)
41:  await apiDelete<void>(`/api/config/fields/${id}`)
46:  return apiGet<SectionConfig[]>('/api/config/sections')
51:  await apiPut<void>('/api/config/sections', sections)
55:  return apiPost<SectionConfig>('/api/config/sections', payload)
67:  return apiPatch<SectionConfig>(`/api/config/sections/${id}`, translatedPatch)
71:  await apiDelete<void>(`/api/config/sections/${id}`)
76:  return apiGet<PermissionMatrix>('/api/config/permissions')
81:  await apiPut<void>('/api/config/permissions', matrix)
===== analyticsService.ts
5:  return apiGet<DashboardData>(`/api/analytics/${page}`)
===== uploadsService.ts
16:  return apiUpload<UploadedFile>('/api/uploads', file, { headers })
```

`Idempotency-Key` на `POST /api/bcc/send` тоже на месте
(`frontend_vue/src/services/bccService.ts:44` — `headers: { 'Idempotency-Key': newIdempotencyKey() }`),
как и на `POST /api/bcc/log` (строка 65), хотя план про второй молчит.

### Чего нет

**1. `resolveLabel()` и `labelLookup.ts` не существуют.** Вся вторая половина плана
(таблица «Данные, которые требуют `resolveLabel()`») описывает механизм, которого в
коде нет ни под этим именем, ни в этих файлах.

```
$ cd frontend_vue/src && grep -rn "resolveLabel" .
(пусто)
$ find . -name "labelLookup*"
(пусто)
$ ls i18n/admin.ts
ls: cannot access 'i18n/admin.ts': No such file or directory
$ find . -name "admin.ts"
(пусто)
```

Вместо этого перевод идёт через тип `TranslatedString`:
`frontend_vue/src/types/i18n.ts:19` — `export function toTranslatedString(value: string, locale: string): TranslatedString`.
То есть сервер отдаёт не «названия на русском», а объект с локалями; сервисы
(`bccService.ts:39-40`, `configService.ts:37`) оборачивают строки в него на отправке.
Модель данных другая, чем в плане. `i18n/admin` сейчас каталог, а не файл `admin.ts`.

**2. «Всего: 28 эндпойнтов» — устарело в разы.** В сервисах 109 уникальных путей.

```
$ cd frontend_vue/src && grep -rhoE "'/api/[^']*'|\`/api/[^\`]*\`" services/*.ts \
    | sed "s/[\`']//g" | sed 's/\${[^}]*}/:id/g' | sort -u | wc -l
109
```

Не покрыты списком целые домены: `/api/orders/*` (24 пути), `/api/warehouse/*` (24),
`/api/settings/*` (13), `/api/clients/*` (6), `/api/finance/*` (3),
`/api/notifications/*` (4), `/api/services*`, `/api/audit-feed*`, `/api/sales-crm/stats`.
Сервисов на диске 17, а план знает про 7 (`ls frontend_vue/src/services/`).
Даже внутри перечисленных семи есть незаписанные вызовы: `/api/products/list`,
`/api/products/:id/audit/:entryId`, `/api/suppliers/list`.

### Что остаётся

Как справочник «полный список эндпойнтов фронтенда» файл больше не работает: его
надо перегенерировать (28 → 109) либо переименовать в список по семи ранним сервисам.
Таблицу `resolveLabel()` надо либо выбросить, либо переписать под `TranslatedString`
из `frontend_vue/src/types/i18n.ts`.

Рядом лежит `roo_code/plans/api/api-endpoints-list.txt` — тот же текст в plain-text
виде, расходится с `.md` только разметкой (`diff` показал только оформление заголовков).
Устарел одинаково.

### Пункты

Чекбоксов в плане нет; ниже — разделы плана как проверяемые пункты.

| Пункт | Вердикт | Доказательство |
|---|---|---|
| Продукты — 5 эндпойнтов (productsService.ts) | сделано | `productsService.ts:20,24,57,110,120` |
| Категории — 6 эндпойнтов (categoriesService.ts) | сделано | `categoriesService.ts:12,20,31,53,57,65` |
| Поставщики — 7 эндпойнтов (suppliersService.ts) | сделано | `suppliersService.ts:20,24,33,55,62,83,93` |
| BCC — 7 эндпойнтов (bccService.ts) | сделано | `bccService.ts:7,11,21,36,58,73,77`; Idempotency-Key на 44 |
| Конфигурация — 12 эндпойнтов (configService.ts) | сделано | `configService.ts:7,12,22,37,41,46,51,55,67,71,76,81` |
| Аналитика — 1 эндпойнт (analyticsService.ts) | сделано | `analyticsService.ts:5` |
| Файлы — 1 эндпойнт (uploadsService.ts) | сделано | `uploadsService.ts:16` |
| «Всего: 28 эндпойнтов» — полный список фронтенда | не начато (утверждение ложно) | 109 уникальных путей, 17 сервисов |
| Таблица `resolveLabel()` через `labelLookup.ts` + `admin.ts` | не начато (механизма нет) | `grep -rn resolveLabel` пусто, обоих файлов нет |
