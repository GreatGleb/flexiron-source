# Перепись коротких ссылок `roo_code/roo-context/api/config.md` — 2026-09-28

Короткая ссылка — это `:NNN`, `:N-M` или хвост перечисления через запятую. Файл у неё не назван, а
подразумевается последним путём ЛЕВЕЕ на ТОЙ ЖЕ строке; когда ссылка продолжает перечисление,
начатое строкой выше, файл подразумевается последним путём абзаца выше.

## Что искал

```bash
grep -oP '(?<![\w:.,/-]):\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*(?![\w:])' roo_code/roo-context/api/config.md | wc -l   # 184
grep -nP '(?<![\w:.,/-]):\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*(?![\w:])' roo_code/roo-context/api/config.md | wc -l   # 115
wc -l roo_code/roo-context/api/config.md                                                                            # 952
```

**Коротких ссылок: 184 во всём документе, они стоят в 115 строках.** Столько
же строк в таблице переписи ниже — по строке на каждое вхождение. Число строк документа правка не
меняет: `git show HEAD` даёт 952 строк, `wc -l` по рабочему файлу — 952.

## Ограничители

1. **Строка с двумя и более РАЗНЫМИ путями не трогается вовсе** — контекст на ней неоднозначен.
2. **Диапазон `:N-M` двигается обоими концами или не двигается ни одним.** Перевёрнутых диапазонов нет.
3. **Правка доказывается содержимым.** Из предложения берётся код в бэктиках рядом со ссылкой и
   грепается по подразумеваемому файлу: нашёлся ровно один раз — номер известен; иначе глаза.
4. **Ссылка не трогается, если номер уже верен.**

## Что поправлено — 6

| строка документа | файл | было | стало | токен | его строка |
|---|---|---|---|---|---|
| 182 | frontend_vue/src/services/mocks/config.ts | 278 | 309 | `usageCount: 0` | 309 |
| 298 | frontend_vue/src/services/mocks/config.ts | 174 | 194 | `visible: false` | 194 |
| 343 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 463 | 472 | `system: false` | 472 |
| 362 | frontend_vue/src/services/mocks/config.ts | 314 | 351 | `order: MOCK_SECTIONS.length` | 351 |
| 363 | frontend_vue/src/services/mocks/config.ts | 317 | 354 | `fields: []` | 354 |
| 491 | frontend_vue/src/services/mocks/config.ts | 224 | 244 | `roles` | 244 |

## Доказательство поимённо — грепом по целевому файлу

```bash
grep -cF 'usageCount: 0' frontend_vue/src/services/mocks/config.ts   # 1 — вхождение токена в файле единственное
grep -cF 'visible: false' frontend_vue/src/services/mocks/config.ts   # 1 — вхождение токена в файле единственное
grep -cF 'system: false' frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue   # 1 — вхождение токена в файле единственное
grep -cF 'order: MOCK_SECTIONS.length' frontend_vue/src/services/mocks/config.ts   # 1 — вхождение токена в файле единственное
grep -cF 'fields: []' frontend_vue/src/services/mocks/config.ts   # 1 — вхождение токена в файле единственное
grep -cF 'roles' frontend_vue/src/services/mocks/config.ts   # 1 — вхождение токена в файле единственное
```

```bash
sed -n '309p' frontend_vue/src/services/mocks/config.ts | grep -cF 'usageCount: 0'   # 1 — токен на новом номере
sed -n '194p' frontend_vue/src/services/mocks/config.ts | grep -cF 'visible: false'   # 1 — токен на новом номере
sed -n '472p' frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | grep -cF 'system: false'   # 1 — токен на новом номере
sed -n '351p' frontend_vue/src/services/mocks/config.ts | grep -cF 'order: MOCK_SECTIONS.length'   # 1 — токен на новом номере
sed -n '354p' frontend_vue/src/services/mocks/config.ts | grep -cF 'fields: []'   # 1 — токен на новом номере
sed -n '244p' frontend_vue/src/services/mocks/config.ts | grep -cF 'roles'   # 1 — токен на новом номере
```

## Диапазоны — до и после

```bash
git show HEAD:roo_code/roo-context/api/config.md | grep -oP '(?<![\w:.,/-]):\K\d+-\d+(?![\w:])' | awk -F- '$1>$2'
```
До правки: код возврата 0, вывод (пусто).

```bash
grep -oP '(?<![\w:.,/-]):\K\d+-\d+(?![\w:])' roo_code/roo-context/api/config.md | awk -F- '$1>$2'
```
После правки: код возврата 0, вывод (пусто).

Ни одного диапазона, где начало больше конца, ни до правки, ни после.

## Проверка резолвером — до правки

```bash
cd frontend_vue && env CONTRACT_REFS=roo_code/roo-context/api/config.md ./node_modules/.bin/vitest run src/services/contractRefs.spec.ts
```
Код возврата 0. Вывод целиком:

```

 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-2/wt-short-refs-config/frontend_vue

roo_code/roo-context/api/config.md: ссылок 387, битых 53, глазами 38, без токена 242
  roo_code/roo-context/api/config.md:57 → mocks/config.ts:117-117 — нет токена в диапазоне: в 117-117 нет ни одного из: «Contacts», «Location», «Logistics»
  roo_code/roo-context/api/config.md:80 → useCardConfig.ts:51-55 — нет токена в диапазоне: в 51-55 нет ни одного из: «PUT»
  roo_code/roo-context/api/config.md:146 → useCardConfig.ts:35-35 — нет токена в диапазоне: в 35-35 нет ни одного из: «GET»
  roo_code/roo-context/api/config.md:150 → useCardConfig.ts:45-61 — нет токена в диапазоне: в 45-61 нет ни одного из: «load()»
  roo_code/roo-context/api/config.md:172 → configService.ts:16-19 — нет токена в диапазоне: в 16-19 нет ни одного из: «required», «options»
  roo_code/roo-context/api/config.md:231 → composables/useCategoryCard.ts:147-147 — нет токена в диапазоне: в 147-147 нет ни одного из: «confirmDeleteField»
  roo_code/roo-context/api/config.md:240 → mocks/config.ts:301-303 — нет токена в диапазоне: в 301-303 нет ни одного из: «sec.fields»
  roo_code/roo-context/api/config.md:267 → useCardConfig.ts:32-32 — нет токена в диапазоне: в 32-32 нет ни одного из: «Promise.all»
  roo_code/roo-context/api/config.md:289 → mocks/config.ts:250-252 — нет токена в диапазоне: в 250-252 нет ни одного из: «mockSaveSections»
  roo_code/roo-context/api/config.md:316 → SupplierCardConfigPage.vue:494-508 — нет токена в диапазоне: в 494-508 нет ни одного из: «PATCH»
  roo_code/roo-context/api/config.md:317 → useCardConfig.ts:53-53 — нет токена в диапазоне: в 53-53 нет ни одного из: «PUT»
  roo_code/roo-context/api/config.md:326 → types/config.ts:20-21 — нет токена в диапазоне: в 20-21 нет ни одного из: «system»
  roo_code/roo-context/api/config.md:375 → e24a3922ed01_phase_7_config.py:43-53 — нет токена в диапазоне: в 43-53 нет ни одного из: «UniqueConstraint»
  roo_code/roo-context/api/config.md:447 → useCardConfig.ts:33-33 — нет токена в диапазоне: в 33-33 нет ни одного из: «Promise.all»
  roo_code/roo-context/api/config.md:477 → mocks/config.ts:179-184 — нет токена в диапазоне: в 179-184 нет ни одного из: «userPermissions»
  roo_code/roo-context/api/config.md:490 → mocks/config.ts:186-186 — нет токена в диапазоне: в 186-186 нет ни одного из: «PERMISSION_ROLES»
  roo_code/roo-context/api/config.md:492 → backend/app/modules/auth/shared/models.py:120-120 — нет токена в диапазоне: в 120-120 нет ни одного из: «users.role»
  roo_code/roo-context/api/config.md:499 → mocks/config.ts:210-218 — нет токена в диапазоне: в 210-218 нет ни одного из: «can_read», «server_default="true"»
  roo_code/roo-context/api/config.md:511 → backend/app/modules/auth/shared/models.py:167-258 — нет токена в диапазоне: в 167-258 нет ни одного из: «select()»
  roo_code/roo-context/api/config.md:522 → useCardConfig.ts:54-54 — нет токена в диапазоне: в 54-54 нет ни одного из: «Promise.all»
  roo_code/roo-context/api/config.md:528 → backend/app/modules/auth/shared/models.py:120-120 — нет токена в диапазоне: в 120-120 нет ни одного из: «roles», «user_roles.role_name»
  roo_code/roo-context/api/config.md:534 → suppliers/shared/models.py:281-281 — нет токена в диапазоне: в 281-281 нет ни одного из: «section_configs.name_translations»
  roo_code/roo-context/api/config.md:538 → SupplierCardConfigPage.vue:205-308 — нет токена в диапазоне: в 205-308 нет ни одного из: «mockSavePermissions»
  roo_code/roo-context/api/config.md:555 → useCardConfig.ts:46-46 — нет токена в диапазоне: в 46-46 нет ни одного из: «load()»
  roo_code/roo-context/api/config.md:582 → backend/app/modules/suppliers/shared/models.py:265-267 — нет токена в диапазоне: в 265-267 нет ни одного из: «uq_field_definitions_tenant_name», «FIELD_NAME_TAKEN», «fieldErrors»
  roo_code/roo-context/api/config.md:608 → SupplierCardConfigPage.vue:86-91 — нет токена в диапазоне: в 86-91 нет ни одного из: «'text'»
  roo_code/roo-context/api/config.md:610 → backend/app/modules/suppliers/shared/models.py:253-253 — нет токена в диапазоне: в 253-253 нет ни одного из: «CHECK»
  roo_code/roo-context/api/config.md:633 → backend/app/core/base.py:42-54 — нет токена в диапазоне: в 42-54 нет ни одного из: «created_by»
  roo_code/roo-context/api/config.md:639 → configService.ts:6-42 — нет токена в диапазоне: в 6-42 нет ни одного из: «field_definitions»
  roo_code/roo-context/api/config.md:641 → frontend_vue/src/types/supplier.ts:12-31 — нет токена в диапазоне: в 12-31 нет ни одного из: «fieldValues», «suppliers»
  roo_code/roo-context/api/config.md:642 → backend/app/modules/suppliers/shared/models.py:17-62 — нет токена в диапазоне: в 17-62 нет ни одного из: «supplier_field_values»
  roo_code/roo-context/api/config.md:645 → backend/app/modules/products/shared/models.py:194-198 — нет токена в диапазоне: в 194-198 нет ни одного из: «f-certified»
  roo_code/roo-context/api/config.md:657 → frontend_vue/src/types/i18n.ts:6-10 — нет токена в диапазоне: в 6-10 нет ни одного из: «usageCount»
  roo_code/roo-context/api/config.md:683 → frontend_vue/src/router/index.ts:192-197 — нет токена в диапазоне: в 192-197 нет ни одного из: «permissionsEditor»
  roo_code/roo-context/api/config.md:684 → SupplierCardConfigPage.vue:21-21 — нет токена в диапазоне: в 21-21 нет ни одного из: «true»
  roo_code/roo-context/api/config.md:710 → backend/app/modules/suppliers/shared/models.py:265-267 — нет токена в диапазоне: в 265-267 нет ни одного из: «PUT»
  roo_code/roo-context/api/config.md:717 → mocks/config.ts:191-203 — нет токена в диапазоне: в 191-203 нет ни одного из: «MOCK_SECTIONS», «permission_items»
  roo_code/roo-context/api/config.md:718 → backend/app/modules/auth/shared/models.py:179-181 — нет токена в диапазоне: в 179-181 нет ни одного из: «name_translations»
  roo_code/roo-context/api/config.md:720 → backend/app/modules/suppliers/shared/models.py:281-281 — нет токена в диапазоне: в 281-281 нет ни одного из: «usageCount»
  roo_code/roo-context/api/config.md:725 → mocks/config.ts:250-252 — нет токена в диапазоне: в 250-252 нет ни одного из: «sort_order»
  roo_code/roo-context/api/config.md:726 → backend/app/modules/suppliers/shared/models.py:282-282 — нет токена в диапазоне: в 282-282 нет ни одного из: «roles», «users»
  roo_code/roo-context/api/config.md:727 → backend/app/modules/auth/shared/models.py:120-120 — нет токена в диапазоне: в 120-120 нет ни одного из: «user_roles.role_name», «users»
  roo_code/roo-context/api/config.md:728 → configService.ts:80-81 — нет токена в диапазоне: в 80-81 нет ни одного из: «PUT»
  roo_code/roo-context/api/config.md:743 → suppliers/shared/models.py:281-281 — нет токена в диапазоне: в 281-281 нет ни одного из: «permission_items.name_translations»
  roo_code/roo-context/api/config.md:754 → e24a3922ed01_phase_7_config.py:34-34 — нет токена в диапазоне: в 34-34 нет ни одного из: «fieldId.startsWith('f-custom-')»
  roo_code/roo-context/api/config.md:759 → types/config.ts:24-25 — нет токена в диапазоне: в 24-25 нет ни одного из: «phase_7_config»
  roo_code/roo-context/api/config.md:790 → mocks/config.ts:191-203 — нет токена в диапазоне: в 191-203 нет ни одного из: «permission_items»
  roo_code/roo-context/api/config.md:822 → mocks/config.ts:318-321 — нет токена в диапазоне: в 318-321 нет ни одного из: «createField»
  roo_code/roo-context/api/config.md:829 → frontend_vue/src/types/i18n.ts:53-63 — нет токена в диапазоне: в 53-63 нет ни одного из: «toTranslatedString»
  roo_code/roo-context/api/config.md:872 → suppliers/shared/models.py:265-267 — нет токена в диапазоне: в 265-267 нет ни одного из: «DUPLICATE», «uq_field_definitions_tenant_name»
  roo_code/roo-context/api/config.md:875 → mocks/config.ts:346-346 — нет токена в диапазоне: в 346-346 нет ни одного из: «fields», «PATCH», «Object.assign»
  roo_code/roo-context/api/config.md:885 → mocks/config.ts:232-232 — нет токена в диапазоне: в 232-232 нет ни одного из: «MOCK_PERMISSIONS»
  roo_code/roo-context/api/config.md:919 → auth/shared/models.py:236-240 — нет токена в диапазоне: в 236-240 нет ни одного из: «UserPermission.user_id», «uuid», «users»
[ссылки] документов 1 · ссылок 387 · битых 53

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  23:40:33
   Duration  366ms (transform 103ms, setup 0ms, import 125ms, tests 64ms, environment 0ms)
```

## Проверка резолвером — после правки

```bash
cd frontend_vue && env CONTRACT_REFS=roo_code/roo-context/api/config.md ./node_modules/.bin/vitest run src/services/contractRefs.spec.ts
```
Код возврата 0. Вывод целиком:

```

 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-2/wt-short-refs-config/frontend_vue

roo_code/roo-context/api/config.md: ссылок 387, битых 53, глазами 38, без токена 242
  roo_code/roo-context/api/config.md:57 → mocks/config.ts:117-117 — нет токена в диапазоне: в 117-117 нет ни одного из: «Contacts», «Location», «Logistics»
  roo_code/roo-context/api/config.md:80 → useCardConfig.ts:51-55 — нет токена в диапазоне: в 51-55 нет ни одного из: «PUT»
  roo_code/roo-context/api/config.md:146 → useCardConfig.ts:35-35 — нет токена в диапазоне: в 35-35 нет ни одного из: «GET»
  roo_code/roo-context/api/config.md:150 → useCardConfig.ts:45-61 — нет токена в диапазоне: в 45-61 нет ни одного из: «load()»
  roo_code/roo-context/api/config.md:172 → configService.ts:16-19 — нет токена в диапазоне: в 16-19 нет ни одного из: «required», «options»
  roo_code/roo-context/api/config.md:231 → composables/useCategoryCard.ts:147-147 — нет токена в диапазоне: в 147-147 нет ни одного из: «confirmDeleteField»
  roo_code/roo-context/api/config.md:240 → mocks/config.ts:301-303 — нет токена в диапазоне: в 301-303 нет ни одного из: «sec.fields»
  roo_code/roo-context/api/config.md:267 → useCardConfig.ts:32-32 — нет токена в диапазоне: в 32-32 нет ни одного из: «Promise.all»
  roo_code/roo-context/api/config.md:289 → mocks/config.ts:250-252 — нет токена в диапазоне: в 250-252 нет ни одного из: «mockSaveSections»
  roo_code/roo-context/api/config.md:316 → SupplierCardConfigPage.vue:494-508 — нет токена в диапазоне: в 494-508 нет ни одного из: «PATCH»
  roo_code/roo-context/api/config.md:317 → useCardConfig.ts:53-53 — нет токена в диапазоне: в 53-53 нет ни одного из: «PUT»
  roo_code/roo-context/api/config.md:326 → types/config.ts:20-21 — нет токена в диапазоне: в 20-21 нет ни одного из: «system»
  roo_code/roo-context/api/config.md:375 → e24a3922ed01_phase_7_config.py:43-53 — нет токена в диапазоне: в 43-53 нет ни одного из: «UniqueConstraint»
  roo_code/roo-context/api/config.md:447 → useCardConfig.ts:33-33 — нет токена в диапазоне: в 33-33 нет ни одного из: «Promise.all»
  roo_code/roo-context/api/config.md:477 → mocks/config.ts:179-184 — нет токена в диапазоне: в 179-184 нет ни одного из: «userPermissions»
  roo_code/roo-context/api/config.md:490 → mocks/config.ts:186-186 — нет токена в диапазоне: в 186-186 нет ни одного из: «PERMISSION_ROLES»
  roo_code/roo-context/api/config.md:492 → backend/app/modules/auth/shared/models.py:120-120 — нет токена в диапазоне: в 120-120 нет ни одного из: «users.role»
  roo_code/roo-context/api/config.md:499 → mocks/config.ts:210-218 — нет токена в диапазоне: в 210-218 нет ни одного из: «can_read», «server_default="true"»
  roo_code/roo-context/api/config.md:511 → backend/app/modules/auth/shared/models.py:167-258 — нет токена в диапазоне: в 167-258 нет ни одного из: «select()»
  roo_code/roo-context/api/config.md:522 → useCardConfig.ts:54-54 — нет токена в диапазоне: в 54-54 нет ни одного из: «Promise.all»
  roo_code/roo-context/api/config.md:528 → backend/app/modules/auth/shared/models.py:120-120 — нет токена в диапазоне: в 120-120 нет ни одного из: «roles», «user_roles.role_name»
  roo_code/roo-context/api/config.md:534 → suppliers/shared/models.py:281-281 — нет токена в диапазоне: в 281-281 нет ни одного из: «section_configs.name_translations»
  roo_code/roo-context/api/config.md:538 → SupplierCardConfigPage.vue:205-308 — нет токена в диапазоне: в 205-308 нет ни одного из: «mockSavePermissions»
  roo_code/roo-context/api/config.md:555 → useCardConfig.ts:46-46 — нет токена в диапазоне: в 46-46 нет ни одного из: «load()»
  roo_code/roo-context/api/config.md:582 → backend/app/modules/suppliers/shared/models.py:265-267 — нет токена в диапазоне: в 265-267 нет ни одного из: «uq_field_definitions_tenant_name», «FIELD_NAME_TAKEN», «fieldErrors»
  roo_code/roo-context/api/config.md:608 → SupplierCardConfigPage.vue:86-91 — нет токена в диапазоне: в 86-91 нет ни одного из: «'text'»
  roo_code/roo-context/api/config.md:610 → backend/app/modules/suppliers/shared/models.py:253-253 — нет токена в диапазоне: в 253-253 нет ни одного из: «CHECK»
  roo_code/roo-context/api/config.md:633 → backend/app/core/base.py:42-54 — нет токена в диапазоне: в 42-54 нет ни одного из: «created_by»
  roo_code/roo-context/api/config.md:639 → configService.ts:6-42 — нет токена в диапазоне: в 6-42 нет ни одного из: «field_definitions»
  roo_code/roo-context/api/config.md:641 → frontend_vue/src/types/supplier.ts:12-31 — нет токена в диапазоне: в 12-31 нет ни одного из: «fieldValues», «suppliers»
  roo_code/roo-context/api/config.md:642 → backend/app/modules/suppliers/shared/models.py:17-62 — нет токена в диапазоне: в 17-62 нет ни одного из: «supplier_field_values»
  roo_code/roo-context/api/config.md:645 → backend/app/modules/products/shared/models.py:194-198 — нет токена в диапазоне: в 194-198 нет ни одного из: «f-certified»
  roo_code/roo-context/api/config.md:657 → frontend_vue/src/types/i18n.ts:6-10 — нет токена в диапазоне: в 6-10 нет ни одного из: «usageCount»
  roo_code/roo-context/api/config.md:683 → frontend_vue/src/router/index.ts:192-197 — нет токена в диапазоне: в 192-197 нет ни одного из: «permissionsEditor»
  roo_code/roo-context/api/config.md:684 → SupplierCardConfigPage.vue:21-21 — нет токена в диапазоне: в 21-21 нет ни одного из: «true»
  roo_code/roo-context/api/config.md:710 → backend/app/modules/suppliers/shared/models.py:265-267 — нет токена в диапазоне: в 265-267 нет ни одного из: «PUT»
  roo_code/roo-context/api/config.md:717 → mocks/config.ts:191-203 — нет токена в диапазоне: в 191-203 нет ни одного из: «MOCK_SECTIONS», «permission_items»
  roo_code/roo-context/api/config.md:718 → backend/app/modules/auth/shared/models.py:179-181 — нет токена в диапазоне: в 179-181 нет ни одного из: «name_translations»
  roo_code/roo-context/api/config.md:720 → backend/app/modules/suppliers/shared/models.py:281-281 — нет токена в диапазоне: в 281-281 нет ни одного из: «usageCount»
  roo_code/roo-context/api/config.md:725 → mocks/config.ts:250-252 — нет токена в диапазоне: в 250-252 нет ни одного из: «sort_order»
  roo_code/roo-context/api/config.md:726 → backend/app/modules/suppliers/shared/models.py:282-282 — нет токена в диапазоне: в 282-282 нет ни одного из: «roles», «users»
  roo_code/roo-context/api/config.md:727 → backend/app/modules/auth/shared/models.py:120-120 — нет токена в диапазоне: в 120-120 нет ни одного из: «user_roles.role_name», «users»
  roo_code/roo-context/api/config.md:728 → configService.ts:80-81 — нет токена в диапазоне: в 80-81 нет ни одного из: «PUT»
  roo_code/roo-context/api/config.md:743 → suppliers/shared/models.py:281-281 — нет токена в диапазоне: в 281-281 нет ни одного из: «permission_items.name_translations»
  roo_code/roo-context/api/config.md:754 → e24a3922ed01_phase_7_config.py:34-34 — нет токена в диапазоне: в 34-34 нет ни одного из: «fieldId.startsWith('f-custom-')»
  roo_code/roo-context/api/config.md:759 → types/config.ts:24-25 — нет токена в диапазоне: в 24-25 нет ни одного из: «phase_7_config»
  roo_code/roo-context/api/config.md:790 → mocks/config.ts:191-203 — нет токена в диапазоне: в 191-203 нет ни одного из: «permission_items»
  roo_code/roo-context/api/config.md:822 → mocks/config.ts:318-321 — нет токена в диапазоне: в 318-321 нет ни одного из: «createField»
  roo_code/roo-context/api/config.md:829 → frontend_vue/src/types/i18n.ts:53-63 — нет токена в диапазоне: в 53-63 нет ни одного из: «toTranslatedString»
  roo_code/roo-context/api/config.md:872 → suppliers/shared/models.py:265-267 — нет токена в диапазоне: в 265-267 нет ни одного из: «DUPLICATE», «uq_field_definitions_tenant_name»
  roo_code/roo-context/api/config.md:875 → mocks/config.ts:346-346 — нет токена в диапазоне: в 346-346 нет ни одного из: «fields», «PATCH», «Object.assign»
  roo_code/roo-context/api/config.md:885 → mocks/config.ts:232-232 — нет токена в диапазоне: в 232-232 нет ни одного из: «MOCK_PERMISSIONS»
  roo_code/roo-context/api/config.md:919 → auth/shared/models.py:236-240 — нет токена в диапазоне: в 236-240 нет ни одного из: «UserPermission.user_id», «uuid», «users»
[ссылки] документов 1 · ссылок 387 · битых 53

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  23:40:34
   Duration  356ms (transform 92ms, setup 0ms, import 113ms, tests 61ms, environment 1ms)
```

Сравнение построчное: списки совпадают (да), ни одной новой записи не
появилось — **счёт битых не вырос**: [ссылки] документов 1 · ссылок 387 · битых 53 до, [ссылки] документов 1 · ссылок 387 · битых 53 после.

## Мутационная проверка

Возврат любого исправленного номера к прежнему значению печатает строку без утверждаемого токена:

```bash
sed -n '278p' frontend_vue/src/services/mocks/config.ts | grep -cF 'usageCount: 0'   # 0
sed -n '174p' frontend_vue/src/services/mocks/config.ts | grep -cF 'visible: false'   # 0
sed -n '463p' frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | grep -cF 'system: false'   # 0
sed -n '314p' frontend_vue/src/services/mocks/config.ts | grep -cF 'order: MOCK_SECTIONS.length'   # 0
sed -n '317p' frontend_vue/src/services/mocks/config.ts | grep -cF 'fields: []'   # 0
sed -n '224p' frontend_vue/src/services/mocks/config.ts | grep -cF 'roles'   # 0
```

У каждой — `0`; на новом номере тот же токен найден (блок выше).

## Перепись — 184 строк, по строке на короткую ссылку

| № | строка документа | подразумеваемый файл | было | стало | утверждаемый токен | строки токена | вердикт | причина |
|---|---|---|---|---|---|---|---|---|
| 1 | 39 | backend/app/modules/suppliers/shared/models.py | 269 | — | `—` | — | отдано глазам | токена рядом нет |
| 2 | 40 | backend/app/modules/suppliers/shared/models.py | 294 | — | `—` | — | отдано глазам | токена рядом нет |
| 3 | 41 | backend/app/modules/auth/shared/models.py | 169 | — | `—` | — | отдано глазам | токена рядом нет |
| 4 | 41 | backend/app/modules/auth/shared/models.py | 202 | — | `—` | — | отдано глазам | токена рядом нет |
| 5 | 52 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 43 | — | `—` | — | отдано глазам | токена рядом нет |
| 6 | 56 | frontend_vue/src/components/admin/SupplierFormSections.vue | 169 | — | `—` | — | отдано глазам | токена рядом нет |
| 7 | 56 | frontend_vue/src/components/admin/SupplierFormSections.vue | 201 | — | `—` | — | отдано глазам | токена рядом нет |
| 8 | 56 | frontend_vue/src/components/admin/SupplierFormSections.vue | 238 | — | `—` | — | отдано глазам | токена рядом нет |
| 9 | 56 | frontend_vue/src/components/admin/SupplierFormSections.vue | 315 | — | `—` | — | отдано глазам | токена рядом нет |
| 10 | 58 | frontend_vue/src/services/mocks/config.ts | 131 | — | `—` | — | отдано глазам | токена рядом нет |
| 11 | 58 | frontend_vue/src/services/mocks/config.ts | 143 | — | `—` | — | отдано глазам | токена рядом нет |
| 12 | 58 | frontend_vue/src/services/mocks/config.ts | 155 | — | `—` | — | отдано глазам | токена рядом нет |
| 13 | 58 | frontend_vue/src/services/mocks/config.ts | 167 | — | `—` | — | отдано глазам | токена рядом нет |
| 14 | 58 | frontend_vue/src/types/config.ts | 32 | — | `—` | — | отдано глазам | токена рядом нет |
| 15 | 84 | frontend_vue/src/services/mocks/config.ts | 274 | — | `—` | — | отдано глазам | токена рядом нет |
| 16 | 85 | frontend_vue/src/services/mocks/config.ts | 116 | — | `sec-new-<счётчик>` | — | отдано глазам | токен не найден |
| 17 | 85 | frontend_vue/src/services/mocks/config.ts | 312 | — | `—` | — | отдано глазам | токена рядом нет |
| 18 | 86 | backend/alembic/versions/e24a3922ed01_phase_7_config.py | 45 | — | `—` | — | отдано глазам | токена рядом нет |
| 19 | 120 | frontend_vue/src/services/mocks/config.ts | 11-112 | — | `—` | — | отдано глазам | токена рядом нет |
| 20 | 121 | frontend_vue/src/services/mocks/config.ts | 68-75 | — | `f-country` | 83,169 | отдано глазам | токен найден многократно |
| 21 | 141 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 403-424 | — | `—` | — | отдано глазам | токена рядом нет |
| 22 | 141 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 350-361 | — | `—` | — | отдано глазам | токена рядом нет |
| 23 | 147 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 411-417 | — | `—` | — | отдано глазам | токена рядом нет |
| 24 | 165 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 315-321 | — | `fieldLibrary.value` | 49,51,55,324,362,363,420 | отдано глазам | токен найден многократно |
| 25 | 167 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 307-308 | — | `—` | — | отдано глазам | токена рядом нет |
| 26 | 173 | frontend_vue/src/types/config.ts | 13 | — | `—` | — | отдано глазам | токена рядом нет |
| 27 | 176 | frontend_vue/src/services/mocks/index.ts | 912 | — | `—` | — | отдано глазам | токена рядом нет |
| 28 | 176 | frontend_vue/src/services/mocks/index.ts | 919 | — | `—` | — | отдано глазам | токена рядом нет |
| 29 | 177 | frontend_vue/src/services/mocks/index.ts | 1036 | — | `—` | — | отдано глазам | токена рядом нет |
| 30 | 181 | frontend_vue/src/services/mocks/config.ts | 274 | — | `id: f-custom-${++fieldIdSeq}` | — | отдано глазам | токен не найден |
| 31 | 181 | frontend_vue/src/services/mocks/config.ts | 277 | — | `required: false` | 58,65,79,86,101,108,115,122,129,308 | отдано глазам | токен найден многократно |
| 32 | 182 | frontend_vue/src/services/mocks/config.ts | 278 | 309 | `usageCount: 0` | 309 | поправлена | — |
| 33 | 204 | frontend_vue/src/services/configService.ts | 37 | — | `—` | — | отдано глазам | токена рядом нет |
| 34 | 212 | frontend_vue/src/types/i18n.ts | 294 | — | `Object.assign` | — | отдано глазам | токен не найден |
| 35 | 247 | backend/app/modules/auth/shared/models.py | 72 | — | `—` | — | отдано глазам | токена рядом нет |
| 36 | 249 | backend/app/modules/auth/shared/models.py | 213 | — | `—` | — | отдано глазам | токена рядом нет |
| 37 | 290 | frontend_vue/src/services/mocks/config.ts | 254-259 | — | `—` | — | отдано глазам | токена рядом нет |
| 38 | 296 | frontend_vue/src/services/mocks/config.ts | 114-177 | — | `—` | — | отдано глазам | токена рядом нет |
| 39 | 297 | frontend_vue/src/services/mocks/config.ts | 121 | — | `system: true` | 141,155,167,179,191 | отдано глазам | токен найден многократно |
| 40 | 297 | frontend_vue/src/services/mocks/config.ts | 135 | — | `—` | — | отдано глазам | токена рядом нет |
| 41 | 297 | frontend_vue/src/services/mocks/config.ts | 147 | — | `—` | — | отдано глазам | токена рядом нет |
| 42 | 297 | frontend_vue/src/services/mocks/config.ts | 159 | — | `—` | — | отдано глазам | токена рядом нет |
| 43 | 297 | frontend_vue/src/services/mocks/config.ts | 171 | — | `—` | — | отдано глазам | токена рядом нет |
| 44 | 298 | frontend_vue/src/services/mocks/config.ts | 174 | 194 | `visible: false` | 194 | поправлена | — |
| 45 | 320 | frontend_vue/src/composables/useCardConfig.ts | 74-77 | — | `—` | — | отдано глазам | токена рядом нет |
| 46 | 320 | frontend_vue/src/composables/useCardConfig.ts | 79-82 | — | `—` | — | отдано глазам | токена рядом нет |
| 47 | 320 | frontend_vue/src/composables/useCardConfig.ts | 89-93 | — | `—` | — | отдано глазам | токена рядом нет |
| 48 | 321 | frontend_vue/src/composables/useCardConfig.ts | 84-87 | — | `—` | — | отдано глазам | токена рядом нет |
| 49 | 321 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 334-341 | — | `—` | — | отдано глазам | токена рядом нет |
| 50 | 322 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 403-424 | — | `—` | — | отдано глазам | токена рядом нет |
| 51 | 322 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 433-440 | — | `—` | — | отдано глазам | токена рядом нет |
| 52 | 342 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 458 | — | `id: sec-new-${++sectionIdSeq}` | — | отдано глазам | токен не найден |
| 53 | 343 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 463 | 472 | `system: false` | 472 | поправлена | — |
| 54 | 344 | frontend_vue/src/composables/useCardConfig.ts | 442 | — | `—` | — | отдано глазам | токена рядом нет |
| 55 | 348 | frontend_vue/src/services/configService.ts | 22-25 | — | `TranslatedString` | 3,24,35,65 | отдано глазам | токен найден многократно |
| 56 | 355 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 413 | — | `—` | — | отдано глазам | токена рядом нет |
| 57 | 355 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 459 | — | `—` | — | отдано глазам | токена рядом нет |
| 58 | 362 | frontend_vue/src/services/mocks/config.ts | 314 | 351 | `order: MOCK_SECTIONS.length` | 351 | поправлена | — |
| 59 | 363 | frontend_vue/src/services/mocks/config.ts | 315 | — | `collapsed: false` | 139,153,177,189,352 | отдано глазам | токен найден многократно |
| 60 | 363 | frontend_vue/src/services/mocks/config.ts | 316 | — | `visible: true` | 140,143,144,145,146,154,157,158,166,169 | отдано глазам | токен найден многократно |
| 61 | 363 | frontend_vue/src/services/mocks/config.ts | 317 | 354 | `fields: []` | 354 | поправлена | — |
| 62 | 369 | — | 314 | — | `MOCK_SECTIONS.length` | — | отдано глазам | токена рядом нет |
| 63 | 390 | frontend_vue/src/services/configService.ts | 67 | — | `—` | — | отдано глазам | токена рядом нет |
| 64 | 395 | frontend_vue/src/services/mocks/config.ts | 330 | — | `Object.assign` | 288,328,369 | отдано глазам | токен найден многократно |
| 65 | 427 | backend/app/modules/auth/shared/models.py | 72 | — | `—` | — | отдано глазам | токена рядом нет |
| 66 | 459 | frontend_vue/src/types/config.ts | 39-40 | — | `—` | — | отдано глазам | токена рядом нет |
| 67 | 460 | frontend_vue/src/types/config.ts | 45 | — | `—` | — | отдано глазам | токена рядом нет |
| 68 | 462 | frontend_vue/src/types/config.ts | 46-54 | — | `—` | — | отдано глазам | токена рядом нет |
| 69 | 463 | frontend_vue/src/types/config.ts | 55-56 | — | `—` | — | отдано глазам | токена рядом нет |
| 70 | 478 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 233-237 | — | `—` | — | отдано глазам | два пути на строке |
| 71 | 483 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 190-192 | — | `—` | — | отдано глазам | токена рядом нет |
| 72 | 491 | frontend_vue/src/services/mocks/config.ts | 224 | 244 | `roles` | 244 | поправлена | — |
| 73 | 493 | backend/app/modules/auth/shared/models.py | 60-61 | — | `—` | — | отдано глазам | токена рядом нет |
| 74 | 529 | backend/app/modules/auth/shared/models.py | 42 | — | `users` | 43,52,104,105,110,131,155,259 | отдано глазам | токен найден многократно |
| 75 | 530 | backend/app/modules/suppliers/shared/models.py | 316 | — | `—` | — | отдано глазам | токена рядом нет |
| 76 | 583 | backend/app/modules/suppliers/shared/models.py | 256-258 | — | `is_builtin` | 257 | отдано глазам | токен внутри диапазона |
| 77 | 609 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 61 | — | `—` | — | отдано глазам | токена рядом нет |
| 78 | 609 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 396 | — | `—` | — | отдано глазам | токена рядом нет |
| 79 | 609 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 400 | — | `—` | — | отдано глазам | токена рядом нет |
| 80 | 620 | frontend_vue/src/services/mocks/notifications.ts | 566 | — | `—` | — | отдано глазам | токена рядом нет |
| 81 | 620 | frontend_vue/src/services/mocks/notifications.ts | 592 | — | `—` | — | отдано глазам | токена рядом нет |
| 82 | 620 | frontend_vue/src/services/mocks/notifications.ts | 616 | — | `—` | — | отдано глазам | токена рядом нет |
| 83 | 620 | frontend_vue/src/services/mocks/notifications.ts | 637 | — | `—` | — | отдано глазам | токена рядом нет |
| 84 | 621 | frontend_vue/src/services/mocks/notifications.ts | 657 | — | `—` | — | отдано глазам | токена рядом нет |
| 85 | 621 | frontend_vue/src/services/mocks/notifications.ts | 684 | — | `—` | — | отдано глазам | токена рядом нет |
| 86 | 630 | frontend_vue/src/types/audit.ts | 16-26 | — | `—` | — | отдано глазам | токена рядом нет |
| 87 | 654 | — | 232 | — | `—` | — | отдано глазам | токена рядом нет |
| 88 | 655 | frontend_vue/src/services/mocks/config.ts | 189 | — | `—` | — | отдано глазам | токена рядом нет |
| 89 | 655 | frontend_vue/src/services/mocks/config.ts | 232 | — | `—` | — | отдано глазам | токена рядом нет |
| 90 | 658 | frontend_vue/src/services/mocks/config.ts | 24 | — | `—` | — | отдано глазам | токена рядом нет |
| 91 | 658 | frontend_vue/src/services/mocks/config.ts | 60 | — | `—` | — | отдано глазам | токена рядом нет |
| 92 | 658 | frontend_vue/src/services/mocks/config.ts | 67 | — | `—` | — | отдано глазам | токена рядом нет |
| 93 | 659 | frontend_vue/src/services/mocks/config.ts | 103 | — | `—` | — | отдано глазам | токена рядом нет |
| 94 | 659 | frontend_vue/src/services/mocks/config.ts | 110 | — | `—` | — | отдано глазам | токена рядом нет |
| 95 | 659 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 416 | — | `—` | — | отдано глазам | токена рядом нет |
| 96 | 660 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 433-440 | — | `—` | — | отдано глазам | токена рядом нет |
| 97 | 666 | backend/app/modules/suppliers/shared/models.py | 274-279 | — | `section_configs` | 289,327 | отдано глазам | токен найден многократно |
| 98 | 667 | backend/app/modules/suppliers/shared/models.py | 299-304 | — | `section_fields` | 317 | отдано глазам | токен вне диапазона |
| 99 | 668 | backend/app/modules/auth/shared/models.py | 174-179 | — | `role_permissions` | 211 | отдано глазам | токен вне диапазона |
| 100 | 669 | backend/app/modules/auth/shared/models.py | 207-212 | — | `user_permissions` | 248 | отдано глазам | токен вне диапазона |
| 101 | 670 | backend/alembic/versions/e24a3922ed01_phase_7_config.py | 46 | — | `—` | — | отдано глазам | токена рядом нет |
| 102 | 670 | backend/alembic/versions/e24a3922ed01_phase_7_config.py | 59 | — | `—` | — | отдано глазам | токена рядом нет |
| 103 | 670 | backend/alembic/versions/e24a3922ed01_phase_7_config.py | 71 | — | `—` | — | отдано глазам | токена рядом нет |
| 104 | 670 | backend/alembic/versions/e24a3922ed01_phase_7_config.py | 83 | — | `—` | — | отдано глазам | токена рядом нет |
| 105 | 670 | backend/alembic/versions/e24a3922ed01_phase_7_config.py | 99 | — | `—` | — | отдано глазам | токена рядом нет |
| 106 | 671 | backend/alembic/versions/e24a3922ed01_phase_7_config.py | 40 | — | `uq_field_definitions_tenant_name` | 40 | отдано глазам | номер уже верен |
| 107 | 672 | backend/alembic/versions/e24a3922ed01_phase_7_config.py | 93 | — | `(tenant_id, item_id, role)` | — | отдано глазам | токен не найден |
| 108 | 673 | backend/alembic/versions/e24a3922ed01_phase_7_config.py | 109 | — | `—` | — | отдано глазам | токена рядом нет |
| 109 | 685 | frontend_vue/src/config/featureFlags.ts | 35 | — | `—` | — | отдано глазам | токена рядом нет |
| 110 | 691 | frontend_vue/src/services/mocks/index.ts | 946 | — | `—` | — | отдано глазам | токена рядом нет |
| 111 | 691 | frontend_vue/src/services/mocks/index.ts | 912 | — | `—` | — | отдано глазам | токена рядом нет |
| 112 | 691 | frontend_vue/src/services/mocks/index.ts | 919 | — | `—` | — | отдано глазам | токена рядом нет |
| 113 | 691 | frontend_vue/src/services/mocks/index.ts | 1036 | — | `—` | — | отдано глазам | токена рядом нет |
| 114 | 696 | frontend_vue/src/composables/useCardConfig.ts | 56-58 | — | `—` | — | отдано глазам | токена рядом нет |
| 115 | 701 | frontend_vue/src/services/mocks/config.ts | 257-258 | — | `—` | — | отдано глазам | токена рядом нет |
| 116 | 707 | frontend_vue/src/services/mocks/config.ts | 312 | — | `—` | — | отдано глазам | токена рядом нет |
| 117 | 708 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 410 | — | `—` | — | отдано глазам | токена рядом нет |
| 118 | 708 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 458 | — | `—` | — | отдано глазам | токена рядом нет |
| 119 | 728 | backend/app/modules/auth/shared/models.py | 42 | — | `—` | — | отдано глазам | токена рядом нет |
| 120 | 740 | frontend_vue/src/types/config.ts | 13 | — | `—` | — | отдано глазам | токена рядом нет |
| 121 | 741 | backend/app/modules/suppliers/shared/models.py | 262 | — | `—` | — | отдано глазам | токена рядом нет |
| 122 | 742 | backend/alembic/versions/e24a3922ed01_phase_7_config.py | 36 | — | `—` | — | отдано глазам | токена рядом нет |
| 123 | 755 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 301-302 | — | `—` | — | отдано глазам | токена рядом нет |
| 124 | 758 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 29 | — | `—` | — | отдано глазам | токена рядом нет |
| 125 | 767 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 233-237 | — | `—` | — | отдано глазам | токена рядом нет |
| 126 | 775 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 190-192 | — | `—` | — | отдано глазам | токена рядом нет |
| 127 | 776 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 241-259 | — | `—` | — | отдано глазам | токена рядом нет |
| 128 | 778 | backend/app/modules/auth/shared/models.py | 102-105 | — | `—` | — | отдано глазам | токена рядом нет |
| 129 | 793 | backend/app/modules/suppliers/shared/models.py | 316 | — | `—` | — | отдано глазам | токена рядом нет |
| 130 | 795 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 215 | — | `—` | — | отдано глазам | токена рядом нет |
| 131 | 797 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 273-280 | — | `—` | — | отдано глазам | токена рядом нет |
| 132 | 798 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 186-194 | — | `—` | — | отдано глазам | токена рядом нет |
| 133 | 798 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 205 | — | `—` | — | отдано глазам | токена рядом нет |
| 134 | 798 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 222 | — | `—` | — | отдано глазам | токена рядом нет |
| 135 | 799 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 241-259 | — | `—` | — | отдано глазам | токена рядом нет |
| 136 | 799 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 278 | — | `—` | — | отдано глазам | токена рядом нет |
| 137 | 799 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 283 | — | `—` | — | отдано глазам | токена рядом нет |
| 138 | 800 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 287-299 | — | `—` | — | отдано глазам | токена рядом нет |
| 139 | 801 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 133-158 | — | `—` | — | отдано глазам | токена рядом нет |
| 140 | 809 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 141-154 | — | `—` | — | отдано глазам | токена рядом нет |
| 141 | 825 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 413 | — | `—` | — | отдано глазам | токена рядом нет |
| 142 | 825 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 459 | — | `—` | — | отдано глазам | токена рядом нет |
| 143 | 830 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 413 | — | `—` | — | отдано глазам | токена рядом нет |
| 144 | 830 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 459 | — | `—` | — | отдано глазам | токена рядом нет |
| 145 | 871 | — | 650 | — | `—` | — | отдано глазам | два пути на строке |
| 146 | 871 | frontend_vue/src/services/mocks/config.ts | 298-304 | — | `—` | — | отдано глазам | два пути на строке |
| 147 | 872 | backend/app/modules/suppliers/shared/models.py | 636 | — | `—` | — | отдано глазам | токена рядом нет |
| 148 | 872 | backend/app/modules/suppliers/shared/models.py | 644 | — | `—` | — | отдано глазам | токена рядом нет |
| 149 | 873 | backend/app/modules/suppliers/shared/models.py | 641 | — | `—` | — | отдано глазам | токена рядом нет |
| 150 | 874 | frontend_vue/src/services/mocks/config.ts | 674 | — | `—` | — | отдано глазам | токена рядом нет |
| 151 | 875 | frontend_vue/src/services/mocks/config.ts | 671 | — | `—` | — | отдано глазам | токена рядом нет |
| 152 | 876 | frontend_vue/src/services/mocks/config.ts | 650 | — | `—` | — | отдано глазам | два пути на строке |
| 153 | 877 | backend/app/modules/products/shared/models.py | 629 | — | `—` | — | отдано глазам | два пути на строке |
| 154 | 877 | frontend_vue/src/services/mocks/config.ts | 24 | — | `—` | — | отдано глазам | два пути на строке |
| 155 | 877 | frontend_vue/src/services/mocks/config.ts | 60 | — | `—` | — | отдано глазам | два пути на строке |
| 156 | 877 | frontend_vue/src/services/mocks/config.ts | 67 | — | `—` | — | отдано глазам | два пути на строке |
| 157 | 877 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 416 | — | `—` | — | отдано глазам | два пути на строке |
| 158 | 878 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 629 | — | `GET /api/config/fields` | — | отдано глазам | токен не найден |
| 159 | 879 | backend/app/modules/auth/internal_api/interface.py | 655 | — | `—` | — | отдано глазам | токена рядом нет |
| 160 | 879 | frontend_vue/src/services/mocks/config.ts | 254-259 | — | `—` | — | отдано глазам | токена рядом нет |
| 161 | 880 | frontend_vue/src/services/mocks/config.ts | 648 | — | `—` | — | отдано глазам | токена рядом нет |
| 162 | 881 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 640 | — | `—` | — | отдано глазам | токена рядом нет |
| 163 | 882 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 633 | — | `POST` | — | отдано глазам | два пути на строке |
| 164 | 883 | frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue | 636 | — | `—` | — | отдано глазам | токена рядом нет |
| 165 | 884 | backend/app/modules/suppliers/shared/models.py | 627 | — | `—` | — | отдано глазам | токена рядом нет |
| 166 | 884 | backend/app/modules/suppliers/shared/models.py | 643 | — | `—` | — | отдано глазам | токена рядом нет |
| 167 | 884 | backend/app/modules/suppliers/shared/models.py | 657 | — | `—` | — | отдано глазам | токена рядом нет |
| 168 | 884 | backend/app/modules/suppliers/shared/models.py | 673 | — | `—` | — | отдано глазам | токена рядом нет |
| 169 | 884 | backend/app/modules/suppliers/shared/models.py | 681 | — | `—` | — | отдано глазам | токена рядом нет |
| 170 | 884 | frontend_vue/src/types/config.ts | 18 | — | `—` | — | отдано глазам | токена рядом нет |
| 171 | 884 | frontend_vue/src/types/config.ts | 61 | — | `—` | — | отдано глазам | токена рядом нет |
| 172 | 885 | frontend_vue/src/types/config.ts | 683 | — | `—` | — | отдано глазам | токена рядом нет |
| 173 | 886 | frontend_vue/src/services/mocks/config.ts | 32 | — | `—` | — | отдано глазам | два пути на строке |
| 174 | 886 | frontend_vue/src/services/mocks/config.ts | 813-815 | — | `—` | — | отдано глазам | два пути на строке |
| 175 | 886 | frontend_vue/src/services/mocks/config.ts | 267 | — | `—` | — | отдано глазам | два пути на строке |
| 176 | 889 | — | 3034 | — | `DELETE /api/config/sections/:id` | — | отдано глазам | токена рядом нет |
| 177 | 895 | — | 32 | — | `—` | — | отдано глазам | токена рядом нет |
| 178 | 895 | — | 267 | — | `—` | — | отдано глазам | токена рядом нет |
| 179 | 895 | — | 643 | — | `—` | — | отдано глазам | токена рядом нет |
| 180 | 895 | — | 671 | — | `—` | — | отдано глазам | токена рядом нет |
| 181 | 895 | — | 673 | — | `—` | — | отдано глазам | токена рядом нет |
| 182 | 895 | — | 811-815 | — | `—` | — | отдано глазам | токена рядом нет |
| 183 | 895 | — | 3029-3034 | — | `—` | — | отдано глазам | токена рядом нет |
| 184 | 925 | backend/app/modules/auth/shared/models.py | 42 | — | `—` | — | отдано глазам | два пути на строке |

**Итого: 184 строк.** Вердикты: отдано глазам — 178, поправлена — 6.
Сумма вердиктов 184 сходится с длиной таблицы 184.

Причины у «отдано глазам»: два пути на строке — 14, номер уже верен — 1, токен вне диапазона — 3, токен внутри диапазона — 1, токен найден многократно — 10, токен не найден — 6, токена рядом нет — 143.
Сумма причин 178 сходится с числом строк «отдано глазам» 178.

## Границы этой переписи

- Разбирались только короткие ссылки; полные (`путь:строка`) этой задачей не трогаются.
- Искусственная нагрузка не создавалась, процессы по имени не гасились.
