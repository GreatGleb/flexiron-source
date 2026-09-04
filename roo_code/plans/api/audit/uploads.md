# Аудит контракта — uploads

Эндпоинтов в коде: **1**. Реализовано бэкендом: **1** (POST /api/uploads).

Источник истины по эндпоинту: бэкенд → мок+клиент → замысел. Пустая графа = задача не закрыта.
Утверждение без `файл:строка` не записывается. Код не правится: место, где он выглядит
неверным, — находка в `roo_code/plans/bugs/contract-sync-uploads-bugs.md`.

> **Домен из одного эндпоинта, но он самый кросс-доменный из семнадцати.** `POST /api/uploads`
> зовётся из ровно одного места фронта (`src/services/uploadsService.ts:16`), а результат втекает
> в **двенадцать** страниц через один компонент `DropZone`
> (`src/components/admin/ui/DropZone.vue:38`): suppliers, bcc, products, orders ×2, warehouse ×5,
> finance, settings. Поэтому любое расхождение формы ответа умножается на двенадцать, и главная
> находка домена именно такая.
>
> **Бэкенд здесь есть, и по К5 он старший.** `backend/app/core/uploads/action.py:79` — это
> единственный роут вне `app/modules/`: uploads объявлен инфраструктурой, а не бизнес-модулем
> (`backend/app/core/uploads/service.py:1-5` — «It is NOT a business module — it's infrastructure»).
> Роут подключён (`backend/app/main.py:74`), таблица создана миграцией
> (`backend/alembic/versions/133fae13afbe_phase_5_uploads.py:25-37`), и на неё ссылаются три чужие
> таблицы с `ondelete="RESTRICT"`: `supplier_files.file_id`
> (`backend/alembic/versions/a8dd7d7ba74b_phase_6_suppliers.py:88`), `payment_documents.file_id` и
> `document_archive_items.file_id` (`backend/alembic/versions/b2619dfeb90f_phase_10_finance.py:53`
> и `:67`).
>
> **И ровно поэтому старший источник расходится с фронтом сильнее, чем где-либо.** Сервер
> возвращает **два** поля (`core/uploads/action.py:143-146`), клиентский тип обещает **шесть**
> (`src/services/uploadsService.ts:3-10`), мок отдаёт все шесть (`mocks/index.ts:1667-1674`).
> Фронт написан по моку, и под моками работает; против настоящего сервера четыре из
> двенадцати потребителей падают исключением, а остальные тихо кладут `undefined`. Разбор —
> в графе «Форма ответа» и в БАГ-01/БАГ-02.
>
> **Старый раздел `03-api-contract.md:161-179` — не раздел домена, а часть общих соглашений
> (строки 1–293), и это гипотеза.** Из шести его утверждений кодом подтверждено **одно**
> (лимиты и 413), три неверны (форма ответа, «один или несколько», draft-хранилище), два не
> реализованы вовсе (вирус-скан, TTL-уборка). Построчно — в графе «Пробел контракта».

## Эндпоинты

### POST /api/uploads
- Вызывающий: `src/services/uploadsService.ts:16`
- Бэкенд: `backend/app/core/uploads/action.py:79`
- Мок: `mocks/index.ts:1662`
- Форма запроса: **`multipart/form-data`, ровно одно поле `file`, ровно один файл на запрос.**
  Сервер объявляет один обязательный файл: `file: UploadFile = File(...)`
  (`backend/app/core/uploads/action.py:82`) — не `list[UploadFile]`, то есть второй файл в том же
  запросе сервер не примет. Клиент собирает форму так же: `form.append('file', file)` с одним
  `File` (`src/services/api.ts:229-230`), а `apiUpload` принимает `file: File`, а не массив
  (`src/services/api.ts:224`). Несколько файлов = несколько запросов: `DropZone` делает
  `Promise.all(files.map((f) => uploadFile(f)))` (`src/components/admin/ui/DropZone.vue:38`).
  Путь без слэша на конце: префикс `/api/uploads` (`core/uploads/action.py:19`) плюс пустой путь роута
  `@router.post("")` (`:79`) — совпадает с литералом клиента (`uploadsService.ts:16`) и с
  веткой мока `path === '/api/uploads'` (`mocks/index.ts:1662`).
  **Заголовки — один: `Authorization: Bearer <token>`.** Клиент собирает его сам из
  `localStorage.getItem('auth_token')` (`src/services/uploadsService.ts:14-15`) и передаёт третьим
  аргументом `{ headers }` (`:16`); `apiUpload` кладёт их в `fetch` как есть
  (`src/services/api.ts:231-235`) и **ничего не добавляет от себя** — общего перехватчика нет,
  тот же ручной сбор повторяют `settingsService.ts:19` и `auditFeedService.ts:21`, и только они
  трое из всех сервисов. Сервер читает ровно этот заголовок
  (`core/uploads/action.py:35`, разбор `Bearer` — `:43-48`), токен — `URLSafeTimedSerializer` с солью
  `"session"` (`core/uploads/action.py:28-31`), из него берётся `user_id` (`:51`).
  `Idempotency-Key` не шлётся: `grep -c "Idempotency" src/services/uploadsService.ts` → `0`,
  и сервер его не читает (`grep -c "Idempotency\|idempotency" backend/app/core/uploads/action.py`
  → `0`). См. БАГ-05.
  **Под моками заголовки теряются целиком**: мок-ветка `apiUpload` зовёт `uploadMock<T>(path, file)`
  без третьего аргумента (`src/services/api.ts:225-228`), а сигнатура мока заголовков и не имеет
  (`mocks/index.ts:1661`). Поэтому путь «нет токена → 401» под моками не воспроизводится ни при
  каких условиях (БАГ-04).
  Валидация запроса на сервере — два правила, оба до записи на диск: MIME по белому списку
  (`core/uploads/action.py:96`, список — `backend/app/core/config.py:36-42`: `application/pdf`, docx, xlsx,
  `image/png`, `image/jpeg`) и размер (`core/uploads/action.py:106-108`, лимит `max_upload_size_mb: int = 20`,
  `config.py:35`). Клиент не проверяет ни того, ни другого: `uploadFile` — четыре строки без
  единой проверки (`uploadsService.ts:13-17`), `DropZone.handleFiles` шлёт всё, что бросили
  (`DropZone.vue:33-45`). Атрибут `accept` есть у 2 дропзон из 12 и обе допускают типы вне
  белого списка (см. графу «Значения по умолчанию», БАГ-13).
- Форма ответа: **сервер отдаёт объект из двух полей, клиент типизирует шесть.**
  Сервер: `ApiResponse(success=True, data={"url": public_url, "fileId": str(uploaded.id)})`
  (`backend/app/core/uploads/action.py:143-146`); конверт — `app/core/schemas.py:29-35`
  (`success`, `data: dict | None`, `message`, `code`), `response_model=ApiResponse` (`core/uploads/action.py:79`).
  `unwrap()` снимает конверт и возвращает `json.data` (`src/services/api.ts:127-138`).
  Значит фактический ответ фронту — `{ url: string, fileId: string }` и **ничего больше**;
  `fileId` — UUID записи (`str(uploaded.id)`, `core/uploads/action.py:145`), `url` — `http(s)://<host>/static/uploads/<uuid4><ext>`
  (`core/uploads/action.py:141-142`, имя файла — `core/uploads/action.py:119`).
  Клиент: `apiUpload<UploadedFile>` (`uploadsService.ts:16`) с
  `interface UploadedFile { fileId; name; size; mime; url; uploadedAt }`
  (`uploadsService.ts:3-10`) — **четыре из шести полей сервер не отдаёт**.
  Мок отдаёт все шесть (`mocks/index.ts:1667-1674`), причём `url` — base64 data-URL
  (`:1666`, `:1672`), а не ссылка; комментарий там же честно помечает это как mock-only (`:1664-1665`).
  Формат `fileId` тоже расходится: мок — `file-<seq>-<Date.now()>` (`mocks/index.ts:1663`,
  счётчик `:272`), сервер — UUID (`core/uploads/action.py:145`).
  **Кто именно читает недостающие поля** (по одному вызову на потребителя, все через
  `@uploaded` у `DropZone`):
  `useOrderCard.ts:1625,1628,1629` (`name`, `size`, `mime`); `useOrderCreate.ts:331,334,335`;
  `OutgoingPaymentCardPage.vue:102,105,106` плюс `uploadedAt` (`:107` — в объект `PaymentDocument`);
  `BccRequestPage.vue:313,314,315`; `ProductCardPage.vue:225` (`f.name`);
  `WarehouseBatchCreatePage.vue:142` и `WarehouseOffcutCreatePage.vue:182` (`f.name`, `f.size`).
  **Четыре потребителя падают исключением, а не просто теряют поле:**
  `SupplierCardPage.vue:49`, `useWarehouseBatch.ts:181`, `useWarehouseOffcutCard.ts:148` —
  `u.uploadedAt.slice(0, 10)` по `undefined`; `useWarehouseMap.ts:45` —
  `file.mime.startsWith('image/')` по `undefined`, и это не декоративная строка, а единственная
  клиентская проверка типа карты склада (её собственный комментарий — `useWarehouseMap.ts:37-43`).
  Единственный потребитель, которому хватает серверного ответа, — логотип компании:
  `handleLogoUploaded(files: { url: string }[])` (`SettingsLayout.vue:344-349`) объявляет
  структурный тип из одного поля `url` и других не трогает.
  Находки: БАГ-01 (четыре поля), БАГ-02 (`useWarehouseMap`), БАГ-11 (ветка `data:` в
  `SettingsLayout.vue:346`).
- Коды ошибок: **каталог берётся с бэкенда, он старший; мок не бросает ни одного.**
  Сервер объявляет два кода прямо в файле:
  `UNAUTHORIZED` — трижды: нет заголовка (`core/uploads/action.py:39-42`), не `Bearer`/пустой токен
  (`core/uploads/action.py:45-48`), токен не разбирается (`core/uploads/action.py:56-59`); HTTP 401;
  `VALIDATION_ERROR` — дважды: MIME вне белого списка (`core/uploads/action.py:97-103`, HTTP **422**) и
  превышение размера (`core/uploads/action.py:109-115`, HTTP **413**). То есть один код на два разных HTTP —
  различить причину можно только по статусу или тексту;
  `NOT_FOUND` — у пользователя нет арендатора (`core/uploads/action.py:72-75`, HTTP 404).
  Ни один код домена не подстрока другого (фронт сравнивает подстрокой):
  `UNAUTHORIZED`, `VALIDATION_ERROR`, `NOT_FOUND` — три несравнимых литерала.
  Общий каталог ядра — `backend/app/core/exceptions.py`; uploads из него не наследует, а поднимает
  `HTTPException` напрямую (`core/uploads/action.py:10`, `:39`, `:56`, `:72`, `:97`, `:109`).
  **Мок не бросает ни одного из трёх**: вся его ветка — сборка меты и `delay`
  (`mocks/index.ts:1662-1677`); единственный `throw` — `[mock] UPLOAD ${path} not found`
  (`:1678`) для неизвестного пути, то есть для ситуации, которой у домена из одного пути не
  бывает. Ни размера, ни MIME, ни авторизации мок не проверяет — под моками **все** пути ошибок
  недостижимы, и это факт для контракта, а не придирка.
  **До человека не доходит ни один код.** `apiUpload` бросает `ApiRequestError` с разобранными
  `message`/`code` (`src/services/api.ts:117-125`, разбор — `:19-84`), `DropZone` ловит и
  превращает в событие `uploadError` (`DropZone.vue:40-42`) — а слушателя у события нет ни у
  одной из двенадцати страниц: `grep -rn "upload-error\|uploadError" src/views src/components
  --include=*.vue | grep -v ui/DropZone.vue` → пусто. Отказ загрузки виден только тем, что файл
  не появился в списке (БАГ-03).
- Save-режим: **quick action — файл уходит на сервер сразу при drop/выборе, до всякого Save.**
  `DropZone.handleFiles` вызывает `uploadFile` немедленно из `@change` и `@drop`
  (`DropZone.vue:33-38`, `:47-53`, `:55-60`), кнопки в компоненте нет. Старый контракт относит
  `POST /uploads` к quick actions явно (`03-api-contract.md:262`) — подтверждено кодом.
  **Привязка к сущности — отдельная фаза и она уже clean-slate:** страница держит `fileId` в
  локальном состоянии и отправляет массив по Save. Два накопителя названы прямо:
  `fileIdsToAttach` (`useWarehouseBatch.ts:170`, наполняется `:182`) и
  `useWarehouseOffcutCard.ts:149`; у заказа — `pendingFileAdds` (`useOrderCard.ts:184`, наполняется `:1617`).
  Страница создания копит и того меньше: `useOrderCreate.ts:323-341` кладёт файл прямо в
  `localOrder.files`, ничего не отправляя. Исключения из clean-slate два, оба quick-action:
  карта склада — `PUT /api/settings/warehouse-map` сразу после подтверждения замены
  (`useWarehouseMap.ts:51-58`, подтверждение — `WarehouseMapPage.vue:34-43`), и логотип компании,
  который просто пишется в `settings.company.logoUrl` (`SettingsLayout.vue:344-349`).
  **Ни один серверный эндпоинт привязку не принимает**: `grep -rn "fileIds\|file_ids" backend/app
  --include=*.py` → две модельные колонки (`modules/bcc/shared/models.py:78`,
  `modules/warehouse/shared/models.py:62`) и ни одного роута. То есть вторая половина паттерна
  живёт только в моке.
- Пробел контракта: **разбор `03-api-contract.md:157-199` по утверждениям — из шести подтверждено одно.**
  1. «Body: multipart/form-data, поле `file` (один или несколько)» (`:164`) — **неверно во второй
     половине**: сервер принимает один файл (`core/uploads/action.py:82`), клиент шлёт один
     (`src/services/api.ts:229-230`). Несколько = несколько запросов (`DropZone.vue:38`);
  2. «Response 200: `Array<{fileId,name,size,mime,url,uploadedAt}>`» (`:165-175`) — **неверно
     дважды**: ответ не массив, а объект в конверте (`core/uploads/action.py:143-146`,
     `app/core/schemas.py:29-35`), и в нём два поля из шести. Ближе всех к правде оказался не
     контракт, а мок (`mocks/index.ts:1667-1674`), по которому и написан фронт;
  3. «url — временный URL для preview» (`:172`) — **неверно**: сервер строит постоянную ссылку на
     статику (`core/uploads/action.py:141-142`), файл смонтирован навсегда (`backend/app/main.py:63`).
     Временный тут как раз мок: data-URL живёт в памяти вкладки (`mocks/index.ts:1666`);
  4. «Файл попадает в draft-хранилище (не привязан ни к какой сущности)» (`:177`) — **неверно**:
     эндпоинт передаёт `is_draft=False` (`core/uploads/action.py:136`) при значении по умолчанию `True` и в
     модели (`core/uploads/models.py:26-28`), и в сигнатуре сервиса (`core/uploads/service.py:22`),
     и в схеме (`133fae13afbe_phase_5_uploads.py:33`). Черновиков в системе не возникает вовсе
     (БАГ-07);
  5. «Max 20 MB/файл, whitelist MIME (pdf, docx, xlsx, png, jpg). 413 при превышении» (`:178`) —
     **подтверждено полностью**: `config.py:35`, `config.py:36-42`, `core/uploads/action.py:106-115`
     (413 — `:110`). Единственное уточнение: отказ по MIME даёт 422 (`core/uploads/action.py:98`), а не 413;
  6. «Virus-scan синхронный (блокирующий). 422 `INFECTED`» (`:179`) — **кода нет нигде**:
     `grep -rni "infected\|virus\|antivirus\|clamav" backend/app frontend_vue/src` → 0 попаданий.
     Ни кода, ни ошибки, ни поля статуса в модели (`core/uploads/models.py:11-38`);
  7. «Удаление = убрать `fileId` из массива и сохранить; сервер удаляет файлы каскадом; отдельного
     DELETE нет» (`:195`) — **прямо противоречит схеме**: три ссылки на `uploaded_files` объявлены
     `ondelete="RESTRICT"` (`a8dd7d7ba74b_phase_6_suppliers.py:88`,
     `b2619dfeb90f_phase_10_finance.py:53`, `:67`), то есть БД запретит удаление файла, на который
     ссылается документ. Функция `delete_file` написана (`core/uploads/service.py:51-57`), но её
     не зовёт никто: `grep -rn "delete_file" backend --include=*.py` → только объявление и
     собственный вызов `get_file_by_id` внутри (`:53`). То же у `get_file_by_id`
     (`core/uploads/service.py:39-48`) — вызывающего вне файла нет;
  8. «Cleanup: draft-файлы, не привязанные ни к чему, удаляются по TTL 24 ч» (`:199`, повтор
     `:280`) — **не реализовано**: константа есть (`core/config.py:43`, `draft_ttl_hours: int = 24`),
     колонка есть (`core/uploads/models.py:37-39`, `133fae13afbe:36`), а читателя и писателя нет:
     `grep -rn "draft_ttl_hours" backend/app` → одно попадание, само объявление; `expires_at` в
     uploads не присваивается нигде (`grep -rn "expires_at" backend/app/core/uploads/` → только
     объявление колонки). Планировщика в проекте нет вовсе: `lifespan` пуст
     (`backend/app/main.py:40-48`);
  9. «Привязка: сервер находит draft-файлы, привязывает, переносит из draft в постоянное»
     (`:183-187`) — серверной части не существует (см. «Save-режим»: ни один роут не принимает
     `fileIds`). Мок эту фазу отыгрывает: `mockAddOrderFile` берёт имя из реестра загрузок
     (`mocks/index.ts:1098`), `mockPatchPayment` получает резолвер `(fileId) => uploadedFiles.get(fileId)`
     (`mocks/index.ts:1405`);
  10. «Endpoints, принимающие `fileIds`: `PATCH /api/suppliers/:id`, `POST /api/bcc/send`,
      `POST /api/bcc/log`» (`:189-191`) — список **устарел по составу**: `fileIds` копят ещё
      склад (`useWarehouseBatch.ts:170`, `useWarehouseOffcutCard.ts:149`), заказы
      (`useOrderCard.ts:184`, наполняется `:1617`), финансы (`OutgoingPaymentCardPage.vue:98-109`) и товары
      (`ProductCardPage.vue:223-226`). Это чужие домены — здесь только фиксируем, что перечень
      неполон.
  **Чего нет ни в контракте, ни в коде** (и потому уходит владельцу, а не в контракт):
  эндпоинта чтения метаданных файла (`GET /api/uploads/:id`) нет — ни клиента, ни роута;
  эндпоинта удаления нет; повторной выдачи ссылки нет. Фронт хранит `url` у себя в сущности
  (`OutgoingPaymentCardPage.vue:104`, `useWarehouseMap.ts:56`), потому что переспросить его не у
  кого.
- Источник истины: **бэкенд** — реализация есть и подключена (`backend/app/core/uploads/action.py:79`,
  `backend/app/main.py:74`), значит по К5 форма ответа и каталог ошибок берутся с него, а не с
  мока и не с `types`. Практическое следствие: `interface UploadedFile`
  (`src/services/uploadsService.ts:3-10`) — **не** спецификация ответа, а желаемая форма, под
  которую написан мок; расхождение записано как находка про фронт (БАГ-01), а не как требование
  к серверу. Метка `Статус: спроектировано` домену не подходит ни в каком месте: код есть с обеих
  сторон.

## Обязанности сервера

Заполняется как НАБЛЮДЕНИЕ: что знает мок, что знает бэкенд, где во фронте стоит константа
на месте серверного значения. Ответ «нигде» — это не решение, а строка в
`00-решения-владельца.md` с указанием домена.

- Значения по умолчанию и их владелец: **владелец — конфиг сервера, и фронт о нём не знает
  ничего.** Три значения живут в `backend/app/core/config.py`: `max_upload_size_mb: int = 20`
  (`:35`), `upload_whitelist_mime` из пяти MIME (`:36-42`: pdf, docx, xlsx, png, jpeg),
  `draft_ttl_hours: int = 24` (`:43`). Ни одно не отдаётся наружу: эндпоинта настроек аплоада нет,
  в `GET /api/settings` их нет (`grep -rin "upload" frontend_vue/src/types/settings.ts` → только
  комментарий `:108` и поле `uploadedAt` `:118`), в моке настроек — тоже.
  Фронт вместо этого держит **два несогласованных списка типов**, и оба шире серверного:
  `CompanySettings.vue:74` — `'image/png,image/jpeg,image/svg+xml'` (SVG в белом списке нет),
  `WarehouseMapPage.vue:159` — `accept="image/*"` (gif, webp, svg — ничего из этого сервер не
  примет). У остальных **десяти** дропзон атрибута `accept` нет вообще:
  `grep -rn "accept=" frontend_vue/src/views --include=*.vue` даёт ровно две строки на двенадцать
  использований `DropZone`. Лимита размера во фронте нет ни в одном месте:
  `grep -rn "max_upload\|maxUpload\|MAX_FILE\|20 \* 1024" frontend_vue/src` → пусто (БАГ-13).
  Значение по умолчанию `is_draft` тоже владелец сервера — и он же его перебивает: модель и
  миграция говорят `True` (`core/uploads/models.py:26-28`, `133fae13afbe:33`), эндпоинт передаёт
  `False` (`core/uploads/action.py:136`).
- События и уведомления: **не рождает ни одного, ни на сервере, ни в моке.** На сервере после
  `store_file` идёт `db.commit()` и сборка ответа (`core/uploads/action.py:138-146`) — ни вызова, ни импорта
  уведомлений; модуль `notifications` роутов не имеет вовсе (замер плана,
  `contract-sync-plan.md:243`). В моке: `grep -n "notify" frontend_vue/src/services/mocks/index.ts
  | sed -n '/166[0-9]/p'` → пусто, вся ветка загрузки — семнадцать строк без побочных эффектов
  (`mocks/index.ts:1662-1677`), тогда как семь триггеров уведомлений мока живут в
  `mocks/notifications.ts` и загрузки среди них нет
  (`grep -in "upload\|file" frontend_vue/src/services/mocks/notifications.ts` → пусто).
  Сама по себе загрузка события и не должна рождать — событием является привязка к сущности,
  а она принадлежит домену сущности. Но и там сервера нет (ни один роут не принимает `fileIds`),
  поэтому вопрос «рождает ли привязка документа событие» не решён нигде → владельцу.
- Запись в аудит-лог: **нигде.** Сервер: в `action.py` нет ни одного обращения к аудиту
  (`grep -c "audit" backend/app/core/uploads/action.py` → 0), таблицы аудита у uploads нет
  (`133fae13afbe_phase_5_uploads.py:25-37` — одна таблица `uploaded_files`). Мок:
  `grep -rn "auditLog.push" frontend_vue/src/services/mocks/*.ts | grep -i "file\|upload"` → пусто.
  При этом след *кто загрузил* сервер хранит — `uploaded_by` (`core/uploads/models.py:29-33`,
  заполняется `core/uploads/action.py:135`), — то есть данные для записи есть, а записи нет. Перечень
  сущностей ленты аудита в старом контракте (`03-api-contract.md:2698-2771`) файлов не
  упоминает. Помечается ли загрузка `sensitive` — вопрос без ответа в коде → владельцу.
- Кастомные поля: **пересечение есть, и оно сломано на фронте.** Тип поля `'file'` объявлен в
  домене categories: `CategoryFieldType = 'text' | 'number' | 'boolean' | 'enum' | 'email' | 'date' | 'file'`
  (`src/types/category.ts:4`), значения живут у товара (`src/types/product.ts:12` — `fieldType:
  CategoryFieldType`). У `FieldDefinition` домена config типа `'file'` **нет**:
  `FieldType = 'enum' | 'number' | 'text' | 'date' | 'boolean' | 'tags'` (`src/types/config.ts:3`)
  — то есть два разных вокабуляра полей, и файловый есть только в одном.
  Что кладётся в значение: `ProductCardPage.vue:223-226` пушит в `fieldValues[fieldId]`
  **имя файла** (`arr.push(f.name)`), а не `fileId`; рендер и удаление тоже по имени
  (`:589-595`, `removeFieldFile` — `:218-221`), ссылка на скачивание захардкожена `download-url="#"`
  (`:593`). `fileId` и `url`, которые вернул сервер, теряются в тот же момент — привязать такой
  файл к товару на бэкенде не по чему (БАГ-10). Что делать со значением при удалении определения
  поля — не знает ни мок, ни сервер (общая дыра, зафиксирована в скиле,
  `roo_code/skills/api-contract.md:260-263`) → владельцу.
- Настройки, которых мок не отслеживает: **три, и все три — правила сервера.** (1) Белый список
  MIME (`core/config.py:36-42`) — мок принимает любой тип, `mime: file.type || 'application/octet-stream'`
  (`mocks/index.ts:1671`), то есть даже пустой тип превращает в валидный, вместо отказа.
  (2) Лимит размера 20 МБ (`core/config.py:35`) — мок пишет `size: file.size`
  (`mocks/index.ts:1670`) без сравнения с чем-либо. (3) Авторизация — мок не видит заголовков
  вовсе (`src/services/api.ts:225-228` против `:231-235`), значит и 401 не отдаёт.
  Плюс мок отслеживает то, чего сервер не умеет: реестр `uploadedFiles: Map<string, UploadedFileMeta>`
  (`mocks/index.ts:271-281`) отдаёт метаданные по `fileId` двум чужим доменам
  (`mocks/index.ts:1098` — имя файла заказа, `:1405` — резолвер документов платежа), тогда как на
  сервере читающего эндпоинта нет ни одного. Реестр в памяти вкладки и перезагрузку не переживает —
  сохраняется только сам data-URL внутри закешированной сущности (`mocks/index.ts:1664-1665`).
- Мультиарендность: **на записи есть, на чтении отсутствует по построению.** Запись: `tenant_id`
  разрешается из пользователя токена (`core/uploads/action.py:126` → `_get_tenant_id`, `:62-76`: `SELECT User
  WHERE id = user_id`, при `tenant_id is None` — 404 `NOT_FOUND`), колонка обязательна и
  индексирована (`core/uploads/models.py:16-21`, `133fae13afbe:28`), FK на `tenants` с
  `ondelete="CASCADE"` — удаление арендатора уносит его файлы из таблицы.
  Чтение: файлы раздаёт статикой `app.mount("/static/uploads", StaticFiles(directory=UPLOAD_DIR))`
  (`backend/app/main.py:63`) — **без авторизации, без арендатора и без единой проверки**, все
  файлы всех арендаторов лежат в одном каталоге (`core/uploads/action.py:22-23`, `main.py:61-62` — один и тот
  же путь `backend/uploads`). Единственная защита — неугадываемое имя `uuid4().hex + ext`
  (`core/uploads/action.py:119`); отозвать выданную ссылку нечем (БАГ-09). Строки с `storage_path`
  (`core/uploads/models.py:23`) хранят абсолютный путь машины (`core/uploads/action.py:127`).
- Права — в какой функции проверяются: **проверяется только сессия, права не проверяются нигде.**
  Единственная зависимость эндпоинта — `_resolve_user_id` (`core/uploads/action.py:34-59`, подключена
  `:84`): она доказывает, что токен валиден, и возвращает `user_id`. Ни роли, ни матрицы прав в
  файле нет: `grep -in "permission\|role\|can_" backend/app/core/uploads/action.py` → пусто.
  Та же функция скопирована ещё в двух местах бэкенда — `modules/settings/features/profile/action.py:41`
  и `modules/settings/features/crud/action.py:97`, — то есть общего места проверки сессии в
  проекте нет (БАГ-12 касается соседнего дефекта того же файла).
  Во фронте прав на загрузку тоже нет: матрица `PermissionMatrix` (`src/types/config.ts:37-57`)
  файлов не упоминает, `grep -rin "upload" src/types/config.ts` → пусто, и ни одна из двенадцати
  дропзон не спрятана за правом — `DropZone` во всех двенадцати шаблонах стоит без `v-if` по
  праву (например `OrderCardPage.vue:2176-2181`, `SupplierCardPage.vue:265-270`).
  Кто имеет право загружать файл и должен ли это быть отдельное право → владельцу.
- Транзакционность и идемпотентность: **обе не обеспечены, и обе видны в одном месте.**
  Порядок операций: файл пишется на диск (`core/uploads/action.py:123`, `file_path.write_bytes(contents)`),
  затем создаётся запись (`:128-137`) и только затем `await db.commit()` (`:138`). Диск и БД не в
  одной транзакции: падение на `_get_tenant_id` (`:126`, бросает 404) или на коммите оставляет
  файл на диске без строки в таблице, и убрать его некому — уборщика нет (см. графу «Настройки»
  и БАГ-06). Обратный откат тоже отсутствует: `try/except` вокруг записи на диск нет
  (`core/uploads/action.py:117-138` — линейный код).
  Идемпотентности нет ни с одной стороны: клиент ключ не шлёт (`uploadsService.ts:13-17` — ни
  `newIdempotencyKey()`, ни заголовка), сервер его не читает (`core/uploads/action.py:79-146`), мок бы его и
  не увидел (`src/services/api.ts:225-228`), хотя механизм в моке есть и используется другими
  доменами (`withIdempotency`, `mocks/index.ts:262-269`). Повтор запроса — второй файл на диске и
  вторая строка в таблице с новым UUID; дедупликации по содержимому нет (хеша в модели нет:
  `core/uploads/models.py:11-38`). См. БАГ-05.
- Производные значения (считать, не хранить): **одно, и оно считается: `url`.** В таблице его нет
  (`core/uploads/models.py:11-38`, `133fae13afbe:25-37` — `storage_path`, но не `url`); ответ
  собирает его на каждый запрос из базы текущего запроса: `base_url = str(request.base_url)`
  (`core/uploads/action.py:141`) плюс `/static/uploads/<имя>` (`:142`). Следствие: смена хоста или схемы меняет
  ссылку, а прежние остаются битыми.
  **И ровно это производное значение три чужие таблицы сохраняют как данные**:
  `payment_documents.url` (`b2619dfeb90f_phase_10_finance.py:57`),
  `document_archive_items.url` (`:70`), плюс `size` и `mime` там же (`:55-56`, `:68-69`) — то есть
  копия метаданных файла, снятая в момент привязки. Фронт делает то же самое: кладёт `url`, `size`,
  `mime`, `uploadedAt` в сущность (`OutgoingPaymentCardPage.vue:102-107`,
  `useWarehouseMap.ts:51-58`, тип `WarehouseMapFile` — `src/types/settings.ts:111-119`).
  Что здесь источник истины — `uploaded_files` или копия в сущности — не решено нигде → владельцу.

## Правила домена, которых нет в контракте

Самое ценное содержимое аудита: эндпоинты машина перечислит и без человека, а правило,
живущее только в моке или доменном слое, — нет.

1. **Загрузка и привязка — две независимые фазы, и вторая может не наступить никогда.** Файл
   уходит на сервер по drop (`DropZone.vue:33-38`), а `fileId` копится в локальном массиве и
   уходит только по Save (`useWarehouseBatch.ts:170,182`, `useWarehouseOffcutCard.ts:149`,
   `useOrderCard.ts:184`, наполняется `:1617`). Пользователь, закрывший вкладку до Save, оставляет на сервере файл,
   на который никто не сошлётся: `is_draft=False` (`core/uploads/action.py:136`) и `expires_at` пуст, значит
   для системы он неотличим от привязанного.
2. **Отмена страницы не отменяет загрузку.** `useOrderCreate.ts:323-341` кладёт файл в
   `localOrder.files`, ничего не отправляя; сам файл при этом уже на сервере. Cancel формы
   откатывает только состояние (общее правило clean-slate, `03-api-contract.md:274-281`) —
   серверный файл остаётся.
3. **Удаление файла из карточки — это удаление ссылки, а не файла.** Все `removeFile` работают с
   массивом в памяти: `SupplierCardPage.vue:54-57`, `useWarehouseBatch.ts:187`, `useWarehouseOffcutCard.ts:154`,
   `OrderCardPage.vue:2173` (`@delete="removeFile(f.fileId)"`). Ни один не зовёт сервер.
   На стороне БД удаление файла вообще запрещено, пока на него ссылается документ:
   `ondelete="RESTRICT"` в трёх местах (`a8dd7d7ba74b:88`, `b2619dfeb90f:53`, `:67`).
4. **Карта склада — единственное место, где загрузка требует подтверждения, и подтверждение
   спрашивается ПОСЛЕ загрузки.** `WarehouseMapPage.vue:34-43`: файл уже на сервере, модалка
   спрашивает про замену прежней карты; собственный комментарий объясняет почему
   (`WarehouseMapPage.vue:29-33`). То есть подтверждается не загрузка, а необратимое действие
   над прежним значением.
5. **Тип файла проверяется на клиенте ровно один раз на весь проект** — в карте склада
   (`useWarehouseMap.ts:45`), и её же комментарий формулирует правило, которого больше нигде нет:
   «`accept` фильтрует диалог выбора и ничего не значит для перетаскивания — в дропзону можно
   бросить PDF» (`useWarehouseMap.ts:37-43`). Остальные одиннадцать дропзон полагаются на сервер.
6. **Мок-форма ответа протекла в продовый код.** `SettingsLayout.vue:346` отбрасывает `url`,
   начинающийся с `data:`, — то есть приложение знает, что бывает мок-ответ, и обходит его
   (БАГ-11). Это единственное место, где мок и продакшен различаются ветвлением, а не флагом
   `USE_MOCKS` (`src/services/api.ts:4`).
7. **Реестр загрузок мока обслуживает чужие домены**, компенсируя отсутствие эндпоинта чтения:
   имя файла заказа берётся из него (`mocks/index.ts:1098`), документы платежа резолвятся через
   него (`:1405`). Уберёшь реестр — сломаются orders и finance, а не uploads.
8. **`fileId` не является непрозрачным идентификатором в моке.** Формат `file-<seq>-<Date.now()>`
   (`mocks/index.ts:1663`) сортируется по времени и растёт монотонно в пределах вкладки; серверный
   UUID (`core/uploads/action.py:145`) не даёт ни того, ни другого. Код, который начнёт полагаться на порядок
   `fileId`, будет зелёным под моками и сломается на сервере.
9. **Домен не покрыт ни одной юнит-спекой.** `grep -rln "uploads\|uploadFile" frontend_vue/src
   --include=*.spec.ts` → пусто; на бэкенде `find backend/tests -iname "*upload*"` → пусто.
   Единственная проверка поведения — e2e карты склада
   (`frontend_vue/tests/e2e/admin/warehouse/warehouse-map.spec.ts:23-27`, отказ по типу — `:164`),
   и она гоняется против мока, то есть проверяет мок, а не сервер.

## Находки про код → contract-sync-uploads-bugs.md

13 находок: БАГ-01…БАГ-13. Код не тронут.
