# Перепись коротких ссылок трёх документов контракта — 2026-09-28

Это запись работы по трём доменам: `clients.md`, `suppliers.md`, `analytics.md` каталога
`roo_code/roo-context/api/`. Порядок тот же, что у принятой переписи
`short-refs-00-conventions-2026-09-28.md`: формат таблицы, колонки, вердикты и причины
взяты оттуда. Правка внесена только в один документ — `suppliers.md`.

## Что искал

Короткая ссылка — номер без названного рядом файла, у которого файл подразумевается
последним путём ЛЕВЕЕ на ТОЙ ЖЕ строке. Разбор сделан скриптом по дереву этого checkout.

```bash
grep -oP '(?<![\w:.,/-]):\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*(?![\w:])' roo_code/roo-context/api/clients.md   | wc -l   # 92
grep -oP '(?<![\w:.,/-]):\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*(?![\w:])' roo_code/roo-context/api/suppliers.md  | wc -l   # 7
grep -oP '(?<![\w:.,/-]):\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*(?![\w:])' roo_code/roo-context/api/analytics.md  | wc -l   # 26
wc -l roo_code/roo-context/api/clients.md roo_code/roo-context/api/suppliers.md roo_code/roo-context/api/analytics.md
#  844 clients.md · 913 suppliers.md · 565 analytics.md
```

Коротких ссылок 92 + 7 + 26 = **125**. Столько же строк в переписи ниже. Число строк каждого
документа правка не меняет: правились только цифры внутри ссылок.

## Ограничители — каждый снят со случившегося провала

1. **Строка с двумя и более РАЗНЫМИ путями не трогается вовсе** — контекст на ней
   определяется неверно. Такие ссылки помечены причиной «два пути на строке».
2. **Диапазон двигается обоими концами или не двигается ни одним.** Перевёрнутых
   диапазонов нет ни до, ни после правки — проверено грепом по всем трём документам.
3. **Правка доказывается содержимым, а не арифметикой.** Из предложения берётся код
   в бэктиках и грепается по подразумеваемому файлу: нашёлся ровно один раз — номер
   известен; не нашёлся, нашёлся многократно или токена рядом нет — ссылка не правится
   и идёт в «отдано глазам». Обратная проверка обязательна: если номер уже занят
   ссылкой на той же строке (полной или короткой), токен из него доказательством не
   служит.
4. **Строка-цель обязана совпасть дословно** — сверено по закоммиченной версии файла.

## Что поправлено — 1 короткая ссылка

| строка документа | файл | было | стало | токен | его строка |
|---|---|---|---|---|---|
| 140 | mocks/suppliers.ts | 117 | 118 | `'UK'` | 118 |

Ссылка стоит в предложении «сегодня там `'Estonia'`, `'Lithuania'`, `'Sweden'`,
`'Latvia'`, `'Germany'` и `'UK'`» — короткий номер продолжает перечень стран после
полной ссылки на тот же файл. На прежней строке (117) стоит `rating: 4,`, на строке
118 — `country: 'UK',`: искомая страна уехала на одну строку вниз. Диапазона здесь нет,
двигался один конец.

## Признано верными — 2 ссылки

| строка документа | файл | номер | токен |
|---|---|---|---|
| 217 | i18n/admin/analytics.ts | 251 | `'29 deals'` |
| 251 | views/admin/analytics/DashboardPage.vue | 95 | `kpiIconPaths[kpi.icon] ?? ''` |

У обеих токен уже стоит внутри написанного номера: переписывать нечего.

## Почему правка всего одна

Ограничитель 3 требует единственного вхождения токена по всему файлу. У большинства
строк номер доказуемым токеном не подтверждается: рядом стоят либо полные ссылки
с путём (и тогда короткий номер той же строки — второе утверждение о том же месте,
доказательства у него нет), либо фрагменты с обратной кавычкой внутри (регулярные
выражения), либо токен, встречающийся в файле многократно. При любом сомнении ссылка
не тронута: сломанная ссылка хуже устаревшей.

## Перепись — 125 строк, по строке на каждую короткую ссылку

Колонка «подразумеваемый файл» — имя файла без номера; номера идут отдельными колонками
голыми числами, чтобы эта перепись сама не стала набором ссылок, которые надо
сопровождать.

| № | строка документа | подразумеваемый файл | как написано | новый номер | утверждаемый токен | строки токена в файле | вердикт | причина |
|---|---|---|---|---|---|---|---|---|
| 1 | 33 | services/api.ts | 128-139 | — | — | — | отдано глазам | токен найден многократно |
| 2 | 34 | — | 140-141 | — | — | — | отдано глазам | токена рядом нет |
| 3 | 63 | mocks/index.ts | 505-506 | — | — | — | отдано глазам | токена рядом нет |
| 4 | 157 | useClientCard.ts | 158-160 | — | — | — | отдано глазам | токена рядом нет |
| 5 | 186 | — | 134 | — | — | — | отдано глазам | токена рядом нет |
| 6 | 213 | — | 1137 | — | — | — | отдано глазам | токена рядом нет |
| 7 | 213 | — | 1138 | — | — | — | отдано глазам | токена рядом нет |
| 8 | 221 | — | 1096-1102 | — | — | — | отдано глазам | токена рядом нет |
| 9 | 222 | — | 1104-1110 | — | — | — | отдано глазам | токена рядом нет |
| 10 | 223 | — | 1112-1121 | — | — | — | отдано глазам | токена рядом нет |
| 11 | 224 | — | 1123-1125 | — | — | — | отдано глазам | токена рядом нет |
| 12 | 231 | ClientCreatePage.vue | 101-103 | — | — | — | отдано глазам | токена рядом нет |
| 13 | 239 | domain/countries.ts | 19-269 | — | — | — | отдано глазам | токена рядом нет |
| 14 | 250 | mocks/index.ts | 912 | — | — | — | отдано глазам | токена рядом нет |
| 15 | 250 | mocks/index.ts | 919 | — | — | — | отдано глазам | токена рядом нет |
| 16 | 250 | mocks/index.ts | 1036 | — | — | — | отдано глазам | токена рядом нет |
| 17 | 271 | useClientCard.ts | 312 | — | — | — | отдано глазам | токена рядом нет |
| 18 | 272 | — | 322-325 | — | — | — | отдано глазам | токена рядом нет |
| 19 | 278 | — | 273-275 | — | — | — | отдано глазам | токена рядом нет |
| 20 | 293 | — | 309 | — | — | — | отдано глазам | токена рядом нет |
| 21 | 293 | — | 318 | — | — | — | отдано глазам | токена рядом нет |
| 22 | 293 | — | 328 | — | — | — | отдано глазам | токена рядом нет |
| 23 | 293 | — | 341 | — | — | — | отдано глазам | токена рядом нет |
| 24 | 293 | — | 358 | — | — | — | отдано глазам | токена рядом нет |
| 25 | 293 | — | 367 | — | — | — | отдано глазам | токена рядом нет |
| 26 | 293 | — | 375 | — | — | — | отдано глазам | токена рядом нет |
| 27 | 293 | — | 384 | — | — | — | отдано глазам | токена рядом нет |
| 28 | 293 | — | 405 | — | — | — | отдано глазам | токена рядом нет |
| 29 | 299 | — | 1095-1126 | — | — | — | отдано глазам | токена рядом нет |
| 30 | 318 | — | 67 | — | — | — | отдано глазам | токена рядом нет |
| 31 | 357 | — | 172 | — | — | — | отдано глазам | токена рядом нет |
| 32 | 388 | — | 1144-1164 | — | — | — | отдано глазам | токена рядом нет |
| 33 | 388 | — | 76 | — | — | — | отдано глазам | токена рядом нет |
| 34 | 388 | — | 116 | — | — | — | отдано глазам | токена рядом нет |
| 35 | 389 | — | 148 | — | — | — | отдано глазам | токена рядом нет |
| 36 | 389 | — | 210 | — | — | — | отдано глазам | токена рядом нет |
| 37 | 389 | — | 270 | — | — | — | отдано глазам | токена рядом нет |
| 38 | 389 | — | 332 | — | — | — | отдано глазам | токена рядом нет |
| 39 | 389 | — | 386 | — | — | — | отдано глазам | токена рядом нет |
| 40 | 389 | — | 530 | — | — | — | отдано глазам | токена рядом нет |
| 41 | 389 | — | 676 | — | — | — | отдано глазам | токена рядом нет |
| 42 | 389 | — | 962 | — | — | — | отдано глазам | токена рядом нет |
| 43 | 390 | — | 1067 | — | — | — | отдано глазам | токена рядом нет |
| 44 | 414 | — | 231 | — | — | — | отдано глазам | токена рядом нет |
| 45 | 430 | — | 50-56 | — | — | — | отдано глазам | токена рядом нет |
| 46 | 454 | — | 302-304 | — | — | — | отдано глазам | токена рядом нет |
| 47 | 469 | — | 246 | — | — | — | отдано глазам | токена рядом нет |
| 48 | 479 | — | 314-316 | — | — | — | отдано глазам | токена рядом нет |
| 49 | 492 | — | 170 | — | — | — | отдано глазам | токена рядом нет |
| 50 | 509 | — | 297-299 | — | — | — | отдано глазам | токена рядом нет |
| 51 | 513 | — | 56 | — | — | — | отдано глазам | токена рядом нет |
| 52 | 554 | — | 174 | — | — | — | отдано глазам | токена рядом нет |
| 53 | 591 | mocks/orders.ts | 4114 | — | — | — | отдано глазам | токена рядом нет |
| 54 | 596 | mocks/orders.ts | 4066 | — | — | — | отдано глазам | токен найден многократно |
| 55 | 622 | domain/countries.ts | 14-17 | — | — | — | отдано глазам | токена рядом нет |
| 56 | 626 | — | 339-341 | — | — | — | отдано глазам | токена рядом нет |
| 57 | 632 | — | 1136 | — | — | — | отдано глазам | токена рядом нет |
| 58 | 643 | mocks/notifications.ts | 566 | — | — | — | отдано глазам | токена рядом нет |
| 59 | 643 | mocks/notifications.ts | 592 | — | — | — | отдано глазам | токена рядом нет |
| 60 | 643 | mocks/notifications.ts | 616 | — | — | — | отдано глазам | токена рядом нет |
| 61 | 643 | mocks/notifications.ts | 637 | — | — | — | отдано глазам | токена рядом нет |
| 62 | 643 | mocks/notifications.ts | 657 | — | — | — | отдано глазам | токена рядом нет |
| 63 | 643 | mocks/notifications.ts | 684 | — | — | — | отдано глазам | токена рядом нет |
| 64 | 656 | — | 1083-1142 | — | — | — | отдано глазам | токена рядом нет |
| 65 | 656 | — | 1144-1164 | — | — | — | отдано глазам | токена рядом нет |
| 66 | 656 | — | 1182-1194 | — | — | — | отдано глазам | токена рядом нет |
| 67 | 657 | — | 76 | — | — | — | отдано глазам | токена рядом нет |
| 68 | 657 | — | 116 | — | — | — | отдано глазам | токена рядом нет |
| 69 | 657 | — | 148 | — | — | — | отдано глазам | токена рядом нет |
| 70 | 657 | — | 210 | — | — | — | отдано глазам | токена рядом нет |
| 71 | 657 | — | 270 | — | — | — | отдано глазам | токена рядом нет |
| 72 | 657 | — | 332 | — | — | — | отдано глазам | токена рядом нет |
| 73 | 657 | — | 386 | — | — | — | отдано глазам | токена рядом нет |
| 74 | 657 | — | 530 | — | — | — | отдано глазам | токена рядом нет |
| 75 | 657 | — | 676 | — | — | — | отдано глазам | токена рядом нет |
| 76 | 658 | — | 962 | — | — | — | отдано глазам | токена рядом нет |
| 77 | 658 | — | 79 | — | — | — | отдано глазам | токена рядом нет |
| 78 | 660 | — | 526-534 | — | — | — | отдано глазам | токена рядом нет |
| 79 | 694 | router/index.ts | 176 | — | — | — | отдано глазам | токен найден многократно |
| 80 | 694 | router/index.ts | 182 | — | — | — | отдано глазам | токен найден многократно |
| 81 | 707 | mocks/index.ts | 965-973 | — | — | — | отдано глазам | токена рядом нет |
| 82 | 707 | mocks/index.ts | 912 | — | — | — | отдано глазам | токена рядом нет |
| 83 | 707 | mocks/index.ts | 919 | — | — | — | отдано глазам | токена рядом нет |
| 84 | 707 | mocks/index.ts | 1036 | — | — | — | отдано глазам | токена рядом нет |
| 85 | 711 | — | 314-316 | — | — | — | отдано глазам | токена рядом нет |
| 86 | 723 | mocks/orders.ts | 4077-4090 | — | — | — | отдано глазам | токен найден многократно |
| 87 | 724 | — | 4096-4108 | — | — | — | отдано глазам | токена рядом нет |
| 88 | 743 | — | 30-34 | — | — | — | отдано глазам | токена рядом нет |
| 89 | 746 | — | 1151-1161 | — | — | — | отдано глазам | токена рядом нет |
| 90 | 776 | types/client.ts | 99-106 | — | — | — | отдано глазам | токена рядом нет |
| 91 | 781 | services/auditFeedService.ts | 57-64 | — | — | — | отдано глазам | токена рядом нет |
| 92 | 799 | roo_code/roo-context/03-api-contract.md | 2181 | — | — | — | отдано глазам | токена рядом нет |
| 93 | 140 | services/mocks/suppliers.ts | 117 | 118 | `'UK'` | 118 | поправлена | — |
| 94 | 278 | frontend_vue/src/views/admin/warehouse/WarehousePage.vue | 519 | — | — | — | отдано глазам | токена рядом нет |
| 95 | 402 | i18n/admin/suppliers.ts | 298 | — | — | — | отдано глазам | токена рядом нет |
| 96 | 402 | i18n/admin/suppliers.ts | 527 | — | — | — | отдано глазам | токена рядом нет |
| 97 | 421 | — | 100-102 | — | — | — | отдано глазам | токена рядом нет |
| 98 | 421 | — | 108 | — | — | — | отдано глазам | токена рядом нет |
| 99 | 421 | — | 117-121 | — | — | — | отдано глазам | токена рядом нет |
| 100 | 117 | mocks/analytics.ts | 877-884 | — | — | — | отдано глазам | токен не найден |
| 101 | 127 | — | 175 | — | — | — | отдано глазам | токена рядом нет |
| 102 | 127 | — | 167 | — | — | — | отдано глазам | токена рядом нет |
| 103 | 127 | — | 193-194 | — | — | — | отдано глазам | токена рядом нет |
| 104 | 128 | — | 42 | — | — | — | отдано глазам | токена рядом нет |
| 105 | 128 | — | 85 | — | — | — | отдано глазам | токена рядом нет |
| 106 | 129 | — | 145 | — | — | — | отдано глазам | токена рядом нет |
| 107 | 129 | — | 156 | — | — | — | отдано глазам | токена рядом нет |
| 108 | 142 | types/analytics.ts | 159 | — | — | — | отдано глазам | токен найден многократно |
| 109 | 142 | types/analytics.ts | 198 | — | — | — | отдано глазам | токен найден многократно |
| 110 | 213 | — | 215,250,267,286,318,341,390 | — | — | — | отдано глазам | токена рядом нет |
| 111 | 213 | — | 415,450,467,486,518,541,590 | — | — | — | отдано глазам | токена рядом нет |
| 112 | 217 | i18n/admin/analytics.ts | 251 | — | `'29 deals'` | 251 | верна | — |
| 113 | 218 | — | 451 | — | — | — | отдано глазам | токена рядом нет |
| 114 | 230 | — | 80-86 | — | — | — | отдано глазам | токена рядом нет |
| 115 | 230 | — | 419-450 | — | — | — | отдано глазам | токена рядом нет |
| 116 | 251 | DashboardPage.vue | 95 | — | `kpiIconPaths[kpi.icon] ?? ''` | 95 | верна | — |
| 117 | 256 | frontend_vue/src/i18n/admin/layout.ts | 80 | — | — | — | отдано глазам | два пути на строке |
| 118 | 256 | frontend_vue/src/i18n/admin/layout.ts | 138 | — | — | — | отдано глазам | два пути на строке |
| 119 | 297 | i18n/admin/analytics.ts | 208,244,261,359,384 | — | — | — | отдано глазам | токена рядом нет |
| 120 | 297 | i18n/admin/analytics.ts | 405,441,457,559,584 | — | — | — | отдано глазам | токена рядом нет |
| 121 | 303 | — | 231 | — | — | — | отдано глазам | токена рядом нет |
| 122 | 305 | — | 17 | — | — | — | отдано глазам | токена рядом нет |
| 123 | 396 | — | 27,30,33,36,39,42,45,48 | — | — | — | отдано глазам | токена рядом нет |
| 124 | 396 | — | 89,92 | — | — | — | отдано глазам | токена рядом нет |
| 125 | 449 | mocks/analytics.ts | 931-1005 | — | — | — | отдано глазам | токен найден многократно |
**Итого: 125 строк = 125 коротким ссылкам.** Поправлено 1, признано верными 2, отдано
глазам 122. Причины «отдано глазам»: «токена рядом нет» — 111, «токен найден
многократно» — 8, «два пути на строке» — 2, «токен не найден» — 1. Сумма
111 + 8 + 2 + 1 = 122 сходится с числом строк «отдано глазам». По документам:
клиенты 92, поставщики 7, аналитика 26.

### Как читалась причина

- **«два пути на строке»** — на строке два и более разных путей: контекст определяется
  неверно, ссылка не трогается (ограничитель 1). Таких ссылок две, обе в документе
  аналитики (строка 256: один и тот же файл назван и коротким хвостом, и полным путём).
- **«токена рядом нет»** — рядом со ссылкой нет кода в бэктиках, который можно
  проверить: либо бэктиков нет вовсе, либо рядом стоят только ссылки (полные и на своё
  же место) и русская проза, либо единственный код встречается в файле многократно.
- **«токен не найден»** — код рядом есть, но в подразумеваемом файле его нет ни разу.
- **«токен найден многократно»** — код рядом есть и встречается в файле больше одного
  раза; какой из номеров он утверждает, машина не знает.

Токен ищется на **той же строке**, что и ссылка; строка **выше** берётся только там, где
перечисление кодов стоит непосредственно над ссылками, продолжающими предложение
(в этом наборе таких мест нет).

## Проверка резолвером — до правки

Прогон по каждому документу отдельно, вывод сохранён целиком. Код возврата 0 у всех трёх.

```bash
cd frontend_vue && CONTRACT_REFS=roo_code/roo-context/api/clients.md ./node_modules/.bin/vitest run src/services/contractRefs.spec.ts
# то же для suppliers.md и analytics.md
```

### clients.md — до правки (exit 0)

```
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-1/wt-short-refs-clients-suppliers-analytics/frontend_vue

roo_code/roo-context/api/clients.md: ссылок 267, битых 50, глазами 7, без токена 163
  roo_code/roo-context/api/clients.md:37 → services/clientsService.ts:1-57 — нет токена в диапазоне: в 1-57 нет ни одного из: «Authorization», «X-CSRF-Token»
  roo_code/roo-context/api/clients.md:64 → mocks/index.ts:334-334 — нет токена в диапазоне: в 334-334 нет ни одного из: «name», «companyCode», «email»
  roo_code/roo-context/api/clients.md:70 → mocks/index.ts:605-605 — нет токена в диапазоне: в 605-605 нет ни одного из: «totalPages»
  roo_code/roo-context/api/clients.md:79 → mocks/clients.ts:1075-1077 — нет токена в диапазоне: в 1075-1077 нет ни одного из: «String(e)»
  roo_code/roo-context/api/clients.md:97 → services/api.ts:154-155 — нет токена в диапазоне: в 154-155 нет ни одного из: «null»
  roo_code/roo-context/api/clients.md:118 → mocks/index.ts:473-473 — нет токена в диапазоне: в 473-473 нет ни одного из: «services/clientsService.ts:getClients», «mocks/clients.ts:mockGetClients»
  roo_code/roo-context/api/clients.md:153 → mocks/index.ts:615-615 — нет токена в диапазоне: в 615-615 нет ни одного из: «CLIENT_NOT_FOUND»
  roo_code/roo-context/api/clients.md:178 → mocks/index.ts:518-518 — нет токена в диапазоне: в 518-518 нет ни одного из: «services/clientsService.ts:getClient», «mocks/clients.ts:mockGetClient»
  roo_code/roo-context/api/clients.md:189 → types/client.ts:60-73 — нет токена в диапазоне: в 60-73 нет ни одного из: «interactionHistory»
  roo_code/roo-context/api/clients.md:211 → mocks/clients.ts:1141-1141 — нет токена в диапазоне: в 1141-1141 нет ни одного из: «ApiResponse<Client>»
  roo_code/roo-context/api/clients.md:212 → mocks/clients.ts:1071-1073 — нет токена в диапазоне: в 1071-1073 нет ни одного из: «CL-NNN»
  roo_code/roo-context/api/clients.md:246 → mocks/clients.ts:1123-1125 — нет токена в диапазоне: в 1123-1125 нет ни одного из: «email»
  roo_code/roo-context/api/clients.md:264 → mocks/index.ts:961-961 — нет токена в диапазоне: в 961-961 нет ни одного из: «services/clientsService.ts:createClient», «mocks/clients.ts:mockCreateClient»
  roo_code/roo-context/api/clients.md:276 → composables/useDirtyCheck.ts:62-77 — нет токена в диапазоне: в 62-77 нет ни одного из: «interactionHistory»
  roo_code/roo-context/api/clients.md:280 → mocks/clients.ts:1163-1163 — нет токена в диапазоне: в 1163-1163 нет ни одного из: «ApiResponse<Client>»
  roo_code/roo-context/api/clients.md:281 → useClientCard.ts:274-274 — нет токена в диапазоне: в 274-274 нет ни одного из: «save()»
  roo_code/roo-context/api/clients.md:286 → domain/paymentTerms.ts:18-20 — нет токена в диапазоне: в 18-20 нет ни одного из: «catch»
  roo_code/roo-context/api/clients.md:296 → mocks/clients.ts:1162-1162 — нет токена в диапазоне: в 1162-1162 нет ни одного из: «createdAt», «auditLog», «diff()»
  roo_code/roo-context/api/clients.md:311 → mocks/index.ts:1250-1250 — нет токена в диапазоне: в 1250-1250 нет ни одного из: «services/clientsService.ts:patchClient», «mocks/clients.ts:mockPatchClient»
  roo_code/roo-context/api/clients.md:322 → mocks/index.ts:1527-1527 — нет токена в диапазоне: в 1527-1527 нет ни одного из: «ApiResponse<void>», «undefined»
  roo_code/roo-context/api/clients.md:329 → useClients.ts:73-73 — нет токена в диапазоне: в 73-73 нет ни одного из: «clients.toast_error_delete»
  roo_code/roo-context/api/clients.md:350 → mocks/index.ts:1524-1524 — нет токена в диапазоне: в 1524-1524 нет ни одного из: «services/clientsService.ts:deleteClient», «mocks/clients.ts:mockDeleteClient»
  roo_code/roo-context/api/clients.md:396 → mocks/clients.ts:79-79 — нет токена в диапазоне: в 79-79 нет ни одного из: «user_id»
  roo_code/roo-context/api/clients.md:406 → mocks/index.ts:525-525 — нет токена в диапазоне: в 525-525 нет ни одного из: «services/clientsService.ts:getClientAudit», «mocks/clients.ts:mockGetClientAudit»
  roo_code/roo-context/api/clients.md:416 → services/clientsService.ts:44-46 — нет токена в диапазоне: в 44-46 нет ни одного из: «StockAuditEntry.id»
  roo_code/roo-context/api/clients.md:421 → mocks/index.ts:1536-1536 — нет токена в диапазоне: в 1536-1536 нет ни одного из: «ApiResponse<void>»
  roo_code/roo-context/api/clients.md:446 → mocks/index.ts:1530-1530 — нет токена в диапазоне: в 1530-1530 нет ни одного из: «services/clientsService.ts:deleteClientAuditEntry», «mocks/clients.ts:mockDeleteClientAuditEntry»
  roo_code/roo-context/api/clients.md:471 → mocks/clients.ts:1216-1216 — нет токена в диапазоне: в 1216-1216 нет ни одного из: «ApiResponse<InteractionHistoryEntry>»
  roo_code/roo-context/api/clients.md:473 → useClientCard.ts:253-253 — нет токена в диапазоне: в 253-253 нет ни одного из: «inlineAddInteraction»
  roo_code/roo-context/api/clients.md:477 → mocks/clients.ts:1206-1217 — нет токена в диапазоне: в 1206-1217 нет ни одного из: «summary»
  roo_code/roo-context/api/clients.md:501 → mocks/index.ts:965-965 — нет токена в диапазоне: в 965-965 нет ни одного из: «services/clientsService.ts:addClientInteraction», «mocks/clients.ts:mockAddClientInteraction»
  roo_code/roo-context/api/clients.md:514 → mocks/index.ts:1726-1726 — нет токена в диапазоне: в 1726-1726 нет ни одного из: «/^\/api\/clients\/([^/]+)\/interactions\/(\d+)$/»
  roo_code/roo-context/api/clients.md:515 → mocks/clients.ts:1233-1233 — нет токена в диапазоне: в 1233-1233 нет ни одного из: «InteractionHistoryEntry»
  roo_code/roo-context/api/clients.md:522 → mocks/index.ts:1545-1545 — нет токена в диапазоне: в 1545-1545 нет ни одного из: «ApiResponse<void>»
  roo_code/roo-context/api/clients.md:531 → useClientCard.ts:158-160 — нет токена в диапазоне: в 158-160 нет ни одного из: «load()»
  roo_code/roo-context/api/clients.md:546 → mocks/index.ts:1539-1539 — нет токена в диапазоне: в 1539-1539 нет ни одного из: «services/clientsService.ts:deleteClientInteraction», «mocks/clients.ts:mockDeleteClientInteraction»
  roo_code/roo-context/api/clients.md:609 → mocks/index.ts:533-533 — нет токена в диапазоне: в 533-533 нет ни одного из: «services/clientsService.ts:getClientInvoiceSummary», «mocks/orders.ts:mockGetClientInvoiceSummary»
  roo_code/roo-context/api/clients.md:625 → domain/countries.ts:324-324 — нет токена в диапазоне: в 324-324 нет ни одного из: «suggestedDocumentType»
  roo_code/roo-context/api/clients.md:636 → mocks/index.ts:452-452 — нет токена в диапазоне: в 452-452 нет ни одного из: «pageSize»
  roo_code/roo-context/api/clients.md:646 → mocks/notifications.ts:722-726 — нет токена в диапазоне: в 722-726 нет ни одного из: «inactive»
  roo_code/roo-context/api/clients.md:654 → types/audit.ts:5-14 — нет токена в диапазоне: в 5-14 нет ни одного из: «clientAuditSources»
  roo_code/roo-context/api/clients.md:663 → types/client.ts:15-49 — нет токена в диапазоне: в 15-49 нет ни одного из: «fieldValues»
  roo_code/roo-context/api/clients.md:667 → mocks/config.ts:241-241 — нет токена в диапазоне: в 241-241 нет ни одного из: «clients»
  roo_code/roo-context/api/clients.md:684 → services/clientsService.ts:1-57 — нет токена в диапазоне: в 1-57 нет ни одного из: «options»
  roo_code/roo-context/api/clients.md:710 → useClientCard.ts:273-304 — нет токена в диапазоне: в 273-304 нет ни одного из: «POST»
  roo_code/roo-context/api/clients.md:715 → types/client.ts:15-49 — нет токена в диапазоне: в 15-49 нет ни одного из: «If-Match»
  roo_code/roo-context/api/clients.md:718 → mocks/index.ts:605-605 — нет токена в диапазоне: в 605-605 нет ни одного из: «totalPages»
  roo_code/roo-context/api/clients.md:730 → mocks/orders.ts:1626-1631 — нет токена в диапазоне: в 1626-1631 нет ни одного из: «clientPaymentTermsDays»
  roo_code/roo-context/api/clients.md:748 → domain/countries.ts:3-18 — нет токена в диапазоне: в 3-18 нет ни одного из: «null»
  roo_code/roo-context/api/clients.md:750 → ClientCreatePage.vue:73-80 — нет токена в диапазоне: в 73-80 нет ни одного из: «address»
[ссылки] документов 1 · ссылок 267 · битых 50

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  22:07:43
   Duration  270ms (transform 71ms, setup 0ms, import 88ms, tests 47ms, environment 0ms)
```

### suppliers.md — до правки (exit 0)

```
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-1/wt-short-refs-clients-suppliers-analytics/frontend_vue

roo_code/roo-context/api/suppliers.md: ссылок 270, битых 31, глазами 14, без токена 199
  roo_code/roo-context/api/suppliers.md:58 → frontend_vue/src/components/admin/SupplierFormSections.vue:45-52 — нет токена в диапазоне: в 45-52 нет ни одного из: «String(50)»
  roo_code/roo-context/api/suppliers.md:59 → backend/app/modules/suppliers/shared/models.py:29-31 — нет токена в диапазоне: в 29-31 нет ни одного из: «enum», «CHECK»
  roo_code/roo-context/api/suppliers.md:93 → frontend_vue/src/services/mocks/suppliers.ts:305-305 — нет токена в диапазоне: в 305-305 нет ни одного из: «GET», «PATCH»
  roo_code/roo-context/api/suppliers.md:104 → frontend_vue/src/components/admin/SupplierFormSections.vue:58-63 — нет токена в диапазоне: в 58-63 нет ни одного из: «PAYMENT_OPTIONS»
  roo_code/roo-context/api/suppliers.md:136 → services/mocks/config.ts:63-63 — нет токена в диапазоне: в 63-63 нет ни одного из: «f-country»
  roo_code/roo-context/api/suppliers.md:157 → frontend_vue/src/services/mocks/suppliers.ts:458-458 — нет токена в диапазоне: в 458-458 нет ни одного из: «SUPPLIER_NOT_FOUND»
  roo_code/roo-context/api/suppliers.md:158 → frontend_vue/src/services/mocks/suppliers.ts:466-466 — нет токена в диапазоне: в 466-466 нет ни одного из: «AUDIT_ENTRY_NOT_FOUND», «entryId»
  roo_code/roo-context/api/suppliers.md:210 → frontend_vue/src/services/mocks/suppliers.ts:262-266 — нет токена в диапазоне: в 262-266 нет ни одного из: «contactPerson»
  roo_code/roo-context/api/suppliers.md:247 → mocks/suppliers.ts:279-279 — нет токена в диапазоне: в 279-279 нет ни одного из: «mockGetSuppliers»
  roo_code/roo-context/api/suppliers.md:284 → frontend_vue/src/services/mocks/index.ts:327-330 — нет токена в диапазоне: в 327-330 нет ни одного из: «'1'», «'sup-001'»
  roo_code/roo-context/api/suppliers.md:298 → backend/app/modules/suppliers/features/supplier_reference/action.py:25-25 — нет токена в диапазоне: в 25-25 нет ни одного из: «list_suppliers_reference», «TranslatedString»
  roo_code/roo-context/api/suppliers.md:316 → frontend_vue/src/services/mocks/suppliers.ts:527-527 — нет токена в диапазоне: в 527-527 нет ни одного из: «company»
  roo_code/roo-context/api/suppliers.md:349 → mocks/suppliers.ts:525-525 — нет токена в диапазоне: в 525-525 нет ни одного из: «mockExportSuppliersCsv»
  roo_code/roo-context/api/suppliers.md:391 → frontend_vue/src/views/admin/suppliers/BccRequestPage.vue:531-531 — нет токена в диапазоне: в 531-531 нет ни одного из: «?supplier=<id>»
  roo_code/roo-context/api/suppliers.md:404 → views/admin/suppliers/SupplierCardPage.vue:275-275 — нет токена в диапазоне: в 275-275 нет ни одного из: «SupplierHistoryItem»
  roo_code/roo-context/api/suppliers.md:446 → frontend_vue/src/services/mocks/index.ts:440-440 — нет токена в диапазоне: в 440-440 нет ни одного из: «[^/]»
  roo_code/roo-context/api/suppliers.md:485 → backend/app/core/exceptions.py:23-27 — нет токена в диапазоне: в 23-27 нет ни одного из: «company»
  roo_code/roo-context/api/suppliers.md:489 → frontend_vue/src/services/mocks/suppliers.ts:471-471 — нет токена в диапазоне: в 471-471 нет ни одного из: «sup-NNN»
  roo_code/roo-context/api/suppliers.md:498 → backend/app/modules/suppliers/shared/models.py:49-51 — нет токена в диапазоне: в 49-51 нет ни одного из: «payment_terms»
  roo_code/roo-context/api/suppliers.md:520 → mocks/suppliers.ts:470-470 — нет токена в диапазоне: в 470-470 нет ни одного из: «mockCreateSupplier»
  roo_code/roo-context/api/suppliers.md:607 → mocks/suppliers.ts:411-411 — нет токена в диапазоне: в 411-411 нет ни одного из: «^/api/suppliers/([^/]+)$», «mockPatchSupplier»
  roo_code/roo-context/api/suppliers.md:630 → frontend_vue/src/services/suppliersService.ts:54-56 — нет токена в диапазоне: в 54-56 нет ни одного из: «undefined»
  roo_code/roo-context/api/suppliers.md:660 → mocks/suppliers.ts:451-451 — нет токена в диапазоне: в 451-451 нет ни одного из: «^/api/suppliers/([^/]+)/status$»
  roo_code/roo-context/api/suppliers.md:672 → frontend_vue/src/services/suppliersService.ts:82-84 — нет токена в диапазоне: в 82-84 нет ни одного из: «deleteMockRoute»
  roo_code/roo-context/api/suppliers.md:694 → frontend_vue/src/services/mocks/suppliers.ts:246-246 — нет токена в диапазоне: в 246-246 нет ни одного из: «entryId»
  roo_code/roo-context/api/suppliers.md:707 → mocks/suppliers.ts:456-456 — нет токена в диапазоне: в 456-456 нет ни одного из: «^/api/suppliers/([^/]+)/audit/([^/]+)$»
  roo_code/roo-context/api/suppliers.md:719 → backend/app/modules/suppliers/shared/models.py:29-31 — нет токена в диапазоне: в 29-31 нет ни одного из: «lead_time=0», «currency='EUR'»
  roo_code/roo-context/api/suppliers.md:722 → backend/app/modules/suppliers/shared/models.py:49-51 — нет токена в диапазоне: в 49-51 нет ни одного из: «payment_terms»
  roo_code/roo-context/api/suppliers.md:755 → frontend_vue/src/types/warehouse.ts:526-534 — нет токена в диапазоне: в 526-534 нет ни одного из: «sensitive»
  roo_code/roo-context/api/suppliers.md:820 → frontend_vue/src/services/mocks/config.ts:13-108 — нет токена в диапазоне: в 13-108 нет ни одного из: «PermissionMatrix»
  roo_code/roo-context/api/suppliers.md:838 → frontend_vue/src/composables/useSupplierCreate.ts:68-68 — нет токена в диапазоне: в 68-68 нет ни одного из: «Idempotency-Key»
[ссылки] документов 1 · ссылок 270 · битых 31

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  22:07:44
   Duration  244ms (transform 60ms, setup 0ms, import 75ms, tests 45ms, environment 0ms)
```

### analytics.md — до правки (exit 0)

```
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-1/wt-short-refs-clients-suppliers-analytics/frontend_vue

roo_code/roo-context/api/analytics.md: ссылок 203, битых 9, глазами 13, без токена 123
  roo_code/roo-context/api/analytics.md:73 → types/analytics.ts:216-251 — нет токена в диапазоне: в 216-251 нет ни одного из: «page»
  roo_code/roo-context/api/analytics.md:113 → mocks/analytics.ts:243-248 — нет токена в диапазоне: в 243-248 нет ни одного из: «deadstock»
  roo_code/roo-context/api/analytics.md:180 → mocks/index.ts:402-402 — нет токена в диапазоне: в 402-402 нет ни одного из: «/^\/api\/analytics\/(.+)$/»
  roo_code/roo-context/api/analytics.md:228 → mocks/analytics.ts:452-460 — нет токена в диапазоне: в 452-460 нет ни одного из: «salesByCategory»
  roo_code/roo-context/api/analytics.md:353 → mocks/analytics.ts:1-23 — нет токена в диапазоне: в 1-23 нет ни одного из: «MOCK_SETTINGS»
  roo_code/roo-context/api/analytics.md:364 → analyticsService.ts:5-5 — нет токена в диапазоне: в 5-5 нет ни одного из: «options?.headers», «GET»
  roo_code/roo-context/api/analytics.md:421 → services/api.ts:258-264 — нет токена в диапазоне: в 258-264 нет ни одного из: «If-Match»
  roo_code/roo-context/api/analytics.md:440 → mocks/analytics.ts:589-646 — нет токена в диапазоне: в 589-646 нет ни одного из: «managers», «workers»
  roo_code/roo-context/api/analytics.md:443 → mocks/analytics.ts:725-793 — нет токена в диапазоне: в 725-793 нет ни одного из: «routes», «loads»
[ссылки] документов 1 · ссылок 203 · битых 9

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  22:07:44
   Duration  253ms (transform 66ms, setup 0ms, import 82ms, tests 46ms, environment 0ms)
```

**Битых до правки: клиенты 50, поставщики 31, аналитика 9.** Ни одна из этих битых не
является короткой ссылкой переписи: все они полные (путь назван вплотную).

## Проверка резолвером — после правки

Тот же прогон по тем же трём документам, уже после единственной правки; код возврата 0.

### clients.md — после правки (exit 0)

```
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-1/wt-short-refs-clients-suppliers-analytics/frontend_vue

roo_code/roo-context/api/clients.md: ссылок 267, битых 50, глазами 7, без токена 163
  roo_code/roo-context/api/clients.md:37 → services/clientsService.ts:1-57 — нет токена в диапазоне: в 1-57 нет ни одного из: «Authorization», «X-CSRF-Token»
  roo_code/roo-context/api/clients.md:64 → mocks/index.ts:334-334 — нет токена в диапазоне: в 334-334 нет ни одного из: «name», «companyCode», «email»
  roo_code/roo-context/api/clients.md:70 → mocks/index.ts:605-605 — нет токена в диапазоне: в 605-605 нет ни одного из: «totalPages»
  roo_code/roo-context/api/clients.md:79 → mocks/clients.ts:1075-1077 — нет токена в диапазоне: в 1075-1077 нет ни одного из: «String(e)»
  roo_code/roo-context/api/clients.md:97 → services/api.ts:154-155 — нет токена в диапазоне: в 154-155 нет ни одного из: «null»
  roo_code/roo-context/api/clients.md:118 → mocks/index.ts:473-473 — нет токена в диапазоне: в 473-473 нет ни одного из: «services/clientsService.ts:getClients», «mocks/clients.ts:mockGetClients»
  roo_code/roo-context/api/clients.md:153 → mocks/index.ts:615-615 — нет токена в диапазоне: в 615-615 нет ни одного из: «CLIENT_NOT_FOUND»
  roo_code/roo-context/api/clients.md:178 → mocks/index.ts:518-518 — нет токена в диапазоне: в 518-518 нет ни одного из: «services/clientsService.ts:getClient», «mocks/clients.ts:mockGetClient»
  roo_code/roo-context/api/clients.md:189 → types/client.ts:60-73 — нет токена в диапазоне: в 60-73 нет ни одного из: «interactionHistory»
  roo_code/roo-context/api/clients.md:211 → mocks/clients.ts:1141-1141 — нет токена в диапазоне: в 1141-1141 нет ни одного из: «ApiResponse<Client>»
  roo_code/roo-context/api/clients.md:212 → mocks/clients.ts:1071-1073 — нет токена в диапазоне: в 1071-1073 нет ни одного из: «CL-NNN»
  roo_code/roo-context/api/clients.md:246 → mocks/clients.ts:1123-1125 — нет токена в диапазоне: в 1123-1125 нет ни одного из: «email»
  roo_code/roo-context/api/clients.md:264 → mocks/index.ts:961-961 — нет токена в диапазоне: в 961-961 нет ни одного из: «services/clientsService.ts:createClient», «mocks/clients.ts:mockCreateClient»
  roo_code/roo-context/api/clients.md:276 → composables/useDirtyCheck.ts:62-77 — нет токена в диапазоне: в 62-77 нет ни одного из: «interactionHistory»
  roo_code/roo-context/api/clients.md:280 → mocks/clients.ts:1163-1163 — нет токена в диапазоне: в 1163-1163 нет ни одного из: «ApiResponse<Client>»
  roo_code/roo-context/api/clients.md:281 → useClientCard.ts:274-274 — нет токена в диапазоне: в 274-274 нет ни одного из: «save()»
  roo_code/roo-context/api/clients.md:286 → domain/paymentTerms.ts:18-20 — нет токена в диапазоне: в 18-20 нет ни одного из: «catch»
  roo_code/roo-context/api/clients.md:296 → mocks/clients.ts:1162-1162 — нет токена в диапазоне: в 1162-1162 нет ни одного из: «createdAt», «auditLog», «diff()»
  roo_code/roo-context/api/clients.md:311 → mocks/index.ts:1250-1250 — нет токена в диапазоне: в 1250-1250 нет ни одного из: «services/clientsService.ts:patchClient», «mocks/clients.ts:mockPatchClient»
  roo_code/roo-context/api/clients.md:322 → mocks/index.ts:1527-1527 — нет токена в диапазоне: в 1527-1527 нет ни одного из: «ApiResponse<void>», «undefined»
  roo_code/roo-context/api/clients.md:329 → useClients.ts:73-73 — нет токена в диапазоне: в 73-73 нет ни одного из: «clients.toast_error_delete»
  roo_code/roo-context/api/clients.md:350 → mocks/index.ts:1524-1524 — нет токена в диапазоне: в 1524-1524 нет ни одного из: «services/clientsService.ts:deleteClient», «mocks/clients.ts:mockDeleteClient»
  roo_code/roo-context/api/clients.md:396 → mocks/clients.ts:79-79 — нет токена в диапазоне: в 79-79 нет ни одного из: «user_id»
  roo_code/roo-context/api/clients.md:406 → mocks/index.ts:525-525 — нет токена в диапазоне: в 525-525 нет ни одного из: «services/clientsService.ts:getClientAudit», «mocks/clients.ts:mockGetClientAudit»
  roo_code/roo-context/api/clients.md:416 → services/clientsService.ts:44-46 — нет токена в диапазоне: в 44-46 нет ни одного из: «StockAuditEntry.id»
  roo_code/roo-context/api/clients.md:421 → mocks/index.ts:1536-1536 — нет токена в диапазоне: в 1536-1536 нет ни одного из: «ApiResponse<void>»
  roo_code/roo-context/api/clients.md:446 → mocks/index.ts:1530-1530 — нет токена в диапазоне: в 1530-1530 нет ни одного из: «services/clientsService.ts:deleteClientAuditEntry», «mocks/clients.ts:mockDeleteClientAuditEntry»
  roo_code/roo-context/api/clients.md:471 → mocks/clients.ts:1216-1216 — нет токена в диапазоне: в 1216-1216 нет ни одного из: «ApiResponse<InteractionHistoryEntry>»
  roo_code/roo-context/api/clients.md:473 → useClientCard.ts:253-253 — нет токена в диапазоне: в 253-253 нет ни одного из: «inlineAddInteraction»
  roo_code/roo-context/api/clients.md:477 → mocks/clients.ts:1206-1217 — нет токена в диапазоне: в 1206-1217 нет ни одного из: «summary»
  roo_code/roo-context/api/clients.md:501 → mocks/index.ts:965-965 — нет токена в диапазоне: в 965-965 нет ни одного из: «services/clientsService.ts:addClientInteraction», «mocks/clients.ts:mockAddClientInteraction»
  roo_code/roo-context/api/clients.md:514 → mocks/index.ts:1726-1726 — нет токена в диапазоне: в 1726-1726 нет ни одного из: «/^\/api\/clients\/([^/]+)\/interactions\/(\d+)$/»
  roo_code/roo-context/api/clients.md:515 → mocks/clients.ts:1233-1233 — нет токена в диапазоне: в 1233-1233 нет ни одного из: «InteractionHistoryEntry»
  roo_code/roo-context/api/clients.md:522 → mocks/index.ts:1545-1545 — нет токена в диапазоне: в 1545-1545 нет ни одного из: «ApiResponse<void>»
  roo_code/roo-context/api/clients.md:531 → useClientCard.ts:158-160 — нет токена в диапазоне: в 158-160 нет ни одного из: «load()»
  roo_code/roo-context/api/clients.md:546 → mocks/index.ts:1539-1539 — нет токена в диапазоне: в 1539-1539 нет ни одного из: «services/clientsService.ts:deleteClientInteraction», «mocks/clients.ts:mockDeleteClientInteraction»
  roo_code/roo-context/api/clients.md:609 → mocks/index.ts:533-533 — нет токена в диапазоне: в 533-533 нет ни одного из: «services/clientsService.ts:getClientInvoiceSummary», «mocks/orders.ts:mockGetClientInvoiceSummary»
  roo_code/roo-context/api/clients.md:625 → domain/countries.ts:324-324 — нет токена в диапазоне: в 324-324 нет ни одного из: «suggestedDocumentType»
  roo_code/roo-context/api/clients.md:636 → mocks/index.ts:452-452 — нет токена в диапазоне: в 452-452 нет ни одного из: «pageSize»
  roo_code/roo-context/api/clients.md:646 → mocks/notifications.ts:722-726 — нет токена в диапазоне: в 722-726 нет ни одного из: «inactive»
  roo_code/roo-context/api/clients.md:654 → types/audit.ts:5-14 — нет токена в диапазоне: в 5-14 нет ни одного из: «clientAuditSources»
  roo_code/roo-context/api/clients.md:663 → types/client.ts:15-49 — нет токена в диапазоне: в 15-49 нет ни одного из: «fieldValues»
  roo_code/roo-context/api/clients.md:667 → mocks/config.ts:241-241 — нет токена в диапазоне: в 241-241 нет ни одного из: «clients»
  roo_code/roo-context/api/clients.md:684 → services/clientsService.ts:1-57 — нет токена в диапазоне: в 1-57 нет ни одного из: «options»
  roo_code/roo-context/api/clients.md:710 → useClientCard.ts:273-304 — нет токена в диапазоне: в 273-304 нет ни одного из: «POST»
  roo_code/roo-context/api/clients.md:715 → types/client.ts:15-49 — нет токена в диапазоне: в 15-49 нет ни одного из: «If-Match»
  roo_code/roo-context/api/clients.md:718 → mocks/index.ts:605-605 — нет токена в диапазоне: в 605-605 нет ни одного из: «totalPages»
  roo_code/roo-context/api/clients.md:730 → mocks/orders.ts:1626-1631 — нет токена в диапазоне: в 1626-1631 нет ни одного из: «clientPaymentTermsDays»
  roo_code/roo-context/api/clients.md:748 → domain/countries.ts:3-18 — нет токена в диапазоне: в 3-18 нет ни одного из: «null»
  roo_code/roo-context/api/clients.md:750 → ClientCreatePage.vue:73-80 — нет токена в диапазоне: в 73-80 нет ни одного из: «address»
[ссылки] документов 1 · ссылок 267 · битых 50

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  22:26:58
   Duration  296ms (transform 85ms, setup 0ms, import 100ms, tests 66ms, environment 0ms)
```

### suppliers.md — после правки (exit 0)

```
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-1/wt-short-refs-clients-suppliers-analytics/frontend_vue

roo_code/roo-context/api/suppliers.md: ссылок 270, битых 31, глазами 14, без токена 199
  roo_code/roo-context/api/suppliers.md:58 → frontend_vue/src/components/admin/SupplierFormSections.vue:45-52 — нет токена в диапазоне: в 45-52 нет ни одного из: «String(50)»
  roo_code/roo-context/api/suppliers.md:59 → backend/app/modules/suppliers/shared/models.py:29-31 — нет токена в диапазоне: в 29-31 нет ни одного из: «enum», «CHECK»
  roo_code/roo-context/api/suppliers.md:93 → frontend_vue/src/services/mocks/suppliers.ts:305-305 — нет токена в диапазоне: в 305-305 нет ни одного из: «GET», «PATCH»
  roo_code/roo-context/api/suppliers.md:104 → frontend_vue/src/components/admin/SupplierFormSections.vue:58-63 — нет токена в диапазоне: в 58-63 нет ни одного из: «PAYMENT_OPTIONS»
  roo_code/roo-context/api/suppliers.md:136 → services/mocks/config.ts:63-63 — нет токена в диапазоне: в 63-63 нет ни одного из: «f-country»
  roo_code/roo-context/api/suppliers.md:157 → frontend_vue/src/services/mocks/suppliers.ts:458-458 — нет токена в диапазоне: в 458-458 нет ни одного из: «SUPPLIER_NOT_FOUND»
  roo_code/roo-context/api/suppliers.md:158 → frontend_vue/src/services/mocks/suppliers.ts:466-466 — нет токена в диапазоне: в 466-466 нет ни одного из: «AUDIT_ENTRY_NOT_FOUND», «entryId»
  roo_code/roo-context/api/suppliers.md:210 → frontend_vue/src/services/mocks/suppliers.ts:262-266 — нет токена в диапазоне: в 262-266 нет ни одного из: «contactPerson»
  roo_code/roo-context/api/suppliers.md:247 → mocks/suppliers.ts:279-279 — нет токена в диапазоне: в 279-279 нет ни одного из: «mockGetSuppliers»
  roo_code/roo-context/api/suppliers.md:284 → frontend_vue/src/services/mocks/index.ts:327-330 — нет токена в диапазоне: в 327-330 нет ни одного из: «'1'», «'sup-001'»
  roo_code/roo-context/api/suppliers.md:298 → backend/app/modules/suppliers/features/supplier_reference/action.py:25-25 — нет токена в диапазоне: в 25-25 нет ни одного из: «list_suppliers_reference», «TranslatedString»
  roo_code/roo-context/api/suppliers.md:316 → frontend_vue/src/services/mocks/suppliers.ts:527-527 — нет токена в диапазоне: в 527-527 нет ни одного из: «company»
  roo_code/roo-context/api/suppliers.md:349 → mocks/suppliers.ts:525-525 — нет токена в диапазоне: в 525-525 нет ни одного из: «mockExportSuppliersCsv»
  roo_code/roo-context/api/suppliers.md:391 → frontend_vue/src/views/admin/suppliers/BccRequestPage.vue:531-531 — нет токена в диапазоне: в 531-531 нет ни одного из: «?supplier=<id>»
  roo_code/roo-context/api/suppliers.md:404 → views/admin/suppliers/SupplierCardPage.vue:275-275 — нет токена в диапазоне: в 275-275 нет ни одного из: «SupplierHistoryItem»
  roo_code/roo-context/api/suppliers.md:446 → frontend_vue/src/services/mocks/index.ts:440-440 — нет токена в диапазоне: в 440-440 нет ни одного из: «[^/]»
  roo_code/roo-context/api/suppliers.md:485 → backend/app/core/exceptions.py:23-27 — нет токена в диапазоне: в 23-27 нет ни одного из: «company»
  roo_code/roo-context/api/suppliers.md:489 → frontend_vue/src/services/mocks/suppliers.ts:471-471 — нет токена в диапазоне: в 471-471 нет ни одного из: «sup-NNN»
  roo_code/roo-context/api/suppliers.md:498 → backend/app/modules/suppliers/shared/models.py:49-51 — нет токена в диапазоне: в 49-51 нет ни одного из: «payment_terms»
  roo_code/roo-context/api/suppliers.md:520 → mocks/suppliers.ts:470-470 — нет токена в диапазоне: в 470-470 нет ни одного из: «mockCreateSupplier»
  roo_code/roo-context/api/suppliers.md:607 → mocks/suppliers.ts:411-411 — нет токена в диапазоне: в 411-411 нет ни одного из: «^/api/suppliers/([^/]+)$», «mockPatchSupplier»
  roo_code/roo-context/api/suppliers.md:630 → frontend_vue/src/services/suppliersService.ts:54-56 — нет токена в диапазоне: в 54-56 нет ни одного из: «undefined»
  roo_code/roo-context/api/suppliers.md:660 → mocks/suppliers.ts:451-451 — нет токена в диапазоне: в 451-451 нет ни одного из: «^/api/suppliers/([^/]+)/status$»
  roo_code/roo-context/api/suppliers.md:672 → frontend_vue/src/services/suppliersService.ts:82-84 — нет токена в диапазоне: в 82-84 нет ни одного из: «deleteMockRoute»
  roo_code/roo-context/api/suppliers.md:694 → frontend_vue/src/services/mocks/suppliers.ts:246-246 — нет токена в диапазоне: в 246-246 нет ни одного из: «entryId»
  roo_code/roo-context/api/suppliers.md:707 → mocks/suppliers.ts:456-456 — нет токена в диапазоне: в 456-456 нет ни одного из: «^/api/suppliers/([^/]+)/audit/([^/]+)$»
  roo_code/roo-context/api/suppliers.md:719 → backend/app/modules/suppliers/shared/models.py:29-31 — нет токена в диапазоне: в 29-31 нет ни одного из: «lead_time=0», «currency='EUR'»
  roo_code/roo-context/api/suppliers.md:722 → backend/app/modules/suppliers/shared/models.py:49-51 — нет токена в диапазоне: в 49-51 нет ни одного из: «payment_terms»
  roo_code/roo-context/api/suppliers.md:755 → frontend_vue/src/types/warehouse.ts:526-534 — нет токена в диапазоне: в 526-534 нет ни одного из: «sensitive»
  roo_code/roo-context/api/suppliers.md:820 → frontend_vue/src/services/mocks/config.ts:13-108 — нет токена в диапазоне: в 13-108 нет ни одного из: «PermissionMatrix»
  roo_code/roo-context/api/suppliers.md:838 → frontend_vue/src/composables/useSupplierCreate.ts:68-68 — нет токена в диапазоне: в 68-68 нет ни одного из: «Idempotency-Key»
[ссылки] документов 1 · ссылок 270 · битых 31

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  22:26:59
   Duration  282ms (transform 92ms, setup 0ms, import 108ms, tests 44ms, environment 0ms)
```

### analytics.md — после правки (exit 0)

```
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-1/wt-short-refs-clients-suppliers-analytics/frontend_vue

roo_code/roo-context/api/analytics.md: ссылок 203, битых 9, глазами 13, без токена 123
  roo_code/roo-context/api/analytics.md:73 → types/analytics.ts:216-251 — нет токена в диапазоне: в 216-251 нет ни одного из: «page»
  roo_code/roo-context/api/analytics.md:113 → mocks/analytics.ts:243-248 — нет токена в диапазоне: в 243-248 нет ни одного из: «deadstock»
  roo_code/roo-context/api/analytics.md:180 → mocks/index.ts:402-402 — нет токена в диапазоне: в 402-402 нет ни одного из: «/^\/api\/analytics\/(.+)$/»
  roo_code/roo-context/api/analytics.md:228 → mocks/analytics.ts:452-460 — нет токена в диапазоне: в 452-460 нет ни одного из: «salesByCategory»
  roo_code/roo-context/api/analytics.md:353 → mocks/analytics.ts:1-23 — нет токена в диапазоне: в 1-23 нет ни одного из: «MOCK_SETTINGS»
  roo_code/roo-context/api/analytics.md:364 → analyticsService.ts:5-5 — нет токена в диапазоне: в 5-5 нет ни одного из: «options?.headers», «GET»
  roo_code/roo-context/api/analytics.md:421 → services/api.ts:258-264 — нет токена в диапазоне: в 258-264 нет ни одного из: «If-Match»
  roo_code/roo-context/api/analytics.md:440 → mocks/analytics.ts:589-646 — нет токена в диапазоне: в 589-646 нет ни одного из: «managers», «workers»
  roo_code/roo-context/api/analytics.md:443 → mocks/analytics.ts:725-793 — нет токена в диапазоне: в 725-793 нет ни одного из: «routes», «loads»
[ссылки] документов 1 · ссылок 203 · битых 9

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  22:26:59
   Duration  243ms (transform 67ms, setup 0ms, import 82ms, tests 41ms, environment 0ms)
```

**Битых после правки: клиенты 50, поставщики 31, аналитика 9 — столько же, сколько было.**
Сравнение велось построчно по каждому документу, а не по итоговому числу.

```bash
for d in clients suppliers analytics; do
  diff <(grep "api/$d.md:" before-$d.txt | sort) <(grep "api/$d.md:" after-$d.txt | sort) && echo "$d: отчёт совпал"
done
# clients: отчёт совпал · suppliers: отчёт совпал · analytics: отчёт совпал
```

**Почему короткие ссылки не попадают в отчёт резолвера.** Резолвер судит только ссылки
с написанным путём: он находит пару «путь плюс номер» и проверяет токен в диапазоне.
Короткая ссылка файл прозой не называет, пути у неё нет — резолвер не видит её ни как
верную, ни как битую. Поэтому его число по этой задаче измениться и не могло; критерий
выполнен в том, что оно не выросло ни у одного документа, и это показано построчным
сравнением отчётов.

## Число строк и перевёрнутые диапазоны

```bash
for d in clients suppliers analytics; do printf "%s до=%s после=%s\n" "$d" \
  "$(git show HEAD:roo_code/roo-context/api/$d.md | wc -l)" "$(wc -l < roo_code/roo-context/api/$d.md)"; done
```

```
clients   до=844   после=844
suppliers до=913   после=913
analytics до=565   после=565
```

Строк стало столько же: правились только цифры внутри ссылок. Диапазонов, у которых
начало больше конца, в тронутых документах нет — ни до правки, ни после: грепом по всем
номерам вида «дефис плюс цифры» (413 совпадений) перевёрнутых 0.

```bash
grep -oP '(?<=\d)-(\d+)(?=[,`])' roo_code/roo-context/api/clients.md \
  roo_code/roo-context/api/suppliers.md roo_code/roo-context/api/analytics.md | wc -l   # 413
```

## Дословная сверка строки-цели

Правка двигает короткую ссылку на строку файла моков поставщиков. Строку-цель сверил
с закоммиченной версией: строки 117 и 118 в старой и рабочей версиях совпадают — файл
моков этой задачей не менялся вовсе.

```bash
git show HEAD:frontend_vue/src/services/mocks/suppliers.ts | sed -n '117p;118p'
sed -n '117p;118p' frontend_vue/src/services/mocks/suppliers.ts
```

Обе команды дают одно и то же:

```
    rating: 4,
    country: 'UK',
```

## Мутационная проверка — возврат номера к прежнему значению

```bash
sed -n '117p' frontend_vue/src/services/mocks/suppliers.ts   #     rating: 4,
sed -n '118p' frontend_vue/src/services/mocks/suppliers.ts   #     country: 'UK',
```

На прежней строке (117) утверждаемого токена `'UK'` нет — там `rating: 4,`. То есть
возврат номера делает ссылку ложной: предложение говорит «`'UK'`», а строка 117 называет
рейтинг. Правка доказана содержимым файла, а не сходством чисел.

Резолвером эта мутация не проверяется — короткие ссылки в его отчёт не попадают вовсе.
Резолвером здесь доказано другое и полезное: правка не добавила битых ссылок и не
сломала разбор документов — 267, 270 и 203 ссылки в обоих прогонах, 11 тестов зелёные.

## Границы этой переписи

- Разбирались только короткие ссылки: 125 из всех ссылок трёх документов. Полные
  (с путём вплотную) не трогались.
- Номера сняты грепом и `sed` по дереву этого checkout; документы менялись только
  внутри одной ссылки — в трёх файлах правка ровно одна.
- Короткая ссылка, которой путь на той же строке не нашёлся, помечена «—» и отдана
  глазам.
- Правило «при сомнении не трогать» сработало: 124 из 125 номеров оставлены как были,
  и для каждого названа причина.
- Искусственная нагрузка не создавалась, процессы по имени не гасились, глобальный
  потолок ожидания в конфиге не трогался.

