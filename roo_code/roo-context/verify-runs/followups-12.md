# Пункт 12 — Почтовый сервер в настройках (находка 4-D)

План: [`review-followups.md` §12](../../plans/general/review-followups.md).
Спека: [04.2 §4 и §6](../../../toDo/design/screen_specs/04.2_BCC_Request_Tool.md).
Режим автономный, ветка `auto/followups-2026-08-28`.

---

## 1. Воспроизведение

Пункт утверждает: «Grep по `smtp`, `mailServer`, `почтов` в настройках и типах — пусто».

```
$ cd frontend_vue && grep -rni "smtp\|mailServer\|mail_server" src/ --include=*.ts --include=*.vue -l
(ни одной строки)

$ ls src/views/admin/settings/
CompanySettings.vue  FinanceSettings.vue  LogsSettings.vue  OrderStatusesSettings.vue
ProfileSettings.vue  SettingsLayout.vue   UnitsSettings.vue
```

Раздела нет, типа нет, эндпоинта нет. Отправка BCC при этом существовала — и мок
`mockSendBccRequest(_payload)` **игнорировал payload целиком** и возвращал идентификатор:

```
$ sed -n '268,276p' src/services/mocks/bcc.ts
export function mockSendBccRequest(_payload: {
  ...
}): { requestId: string } {
  return { requestId: `req-${Date.now()}` }
}
```

То есть проверить требование «одной транзакцией, все адреса в BCC» было **нечем**: следа
отправка не оставляла. Воспроизведено по обоим пунктам.

**Граница задачи.** Пункт называет «одну транзакцию» ответственностью бэкенда. В
`backend/app/modules/bcc/` есть модель и `internal_api`, но **ни одного слайса**
(`find app/modules/bcc -name "*.py"` → только `shared/`, `internal_api/`, пустой
`features/__init__.py`), а тестов в бэкенде нет вовсе (`verify.md`, раздел «Бэкенд»).
Сервером для фронта сегодня служит мок-слой — там правило и реализовано, и там же
проверено тестом. Бэкендовая часть остаётся за пунктом 12 и не объявляется сделанной.

## 2. Что сделано

### Тип: пароля нет в типе, а не «не забыть вычеркнуть»

[`src/types/settings.ts`](../../../frontend_vue/src/types/settings.ts) — `MailServerSettings`
без поля `password`, с булевым `passwordSet`; отдельный `MailServerPayload` с `password?`
только на запись. Требование пункта «пароль не возвращать на фронт» становится
структурным: положить секрет в стор `useSettings` или в его кэш в localStorage просто
нечем. Плюс `MAIL_ENCRYPTIONS` + `isMailEncryption()` — список и тип из одного места, как у
`CONVERSION_FORMULA_TYPES` рядом.

### Сервер (мок-слой)

| Что | Где |
|---|---|
| `GET /api/settings/mail` | `mockGetMail()` — отдаёт настройки без пароля |
| `PATCH /api/settings/mail` | `mockPatchMail()` — merge; пустой `password` = «не менять» |
| `POST /api/settings/mail/test` | `mockSendMailTest()` — письмо себе, 422 `MAIL_NOT_CONFIGURED` |

Пароль живёт в отдельной переменной `mailPassword`, почтовая секция — в `mailStore`, а не в
`settingsStore` (тип стора сузился до `Omit<AppSettings, 'mail'>`): второй копии правила
«пароль задан» нет ни одной, `mockGetSettings()` собирает срез через `mockGetMail()`.

### Одна транзакция и все адреса в BCC

`mockSendBccRequest` теперь оставляет **конверт** (`SentEmail`) в `MOCK_SENT_EMAILS`: один
push на отправку, все адреса получателей в `bcc`, `to` — адрес отправителя из почтовых
настроек, `cc` пуст. Ненастроенный сервер отвечает `MAIL_NOT_CONFIGURED`, а не молчаливым
успехом.

### Страница и BCC-инструмент

- [`MailSettings.vue`](../../../frontend_vue/src/views/admin/settings/MailSettings.vue) —
  хост, порт, шифрование, логин, пароль, адрес и имя отправителя, кнопка «отправить
  тестовое письмо». Вкладка в `SettingsLayout` между «Статусы заказов» и «Логи» (индексы
  существующих вкладок не съехали), маршрут `admin-settings-mail`.
- Сохранение — общей кнопкой Save настроек (clean-slate, как у company/constants/profile).
  Пароль уходит отдельным полем и только если его ввели; после сохранения поле очищается,
  `discard()` его тоже сбрасывает.
- `useBccRequest` отдаёт `mailFrom` / `mailReady` / `mailSettled`; страница показывает
  строку «From: …» над шаблоном письма, а при ненастроенном сервере — ссылку на вкладку
  настроек (`router-link`, не `<span>`), и кнопка «Send Request» неактивна.

Контракт дописан: раздел «Почтовый сервер (Mail)» + правка Notes у `POST /api/bcc/send`
(одна транзакция, отправитель из настроек, 422 при ненастроенном сервере) в
[`03-api-contract.md`](../03-api-contract.md).

## 3. Файлы

```
src/types/settings.ts                       + MailServerSettings/Payload, MAIL_ENCRYPTIONS
src/services/settingsService.ts             + getMailServer/saveMailServer/sendMailServerTest
src/services/mocks/settings.ts              + mailStore/mailPassword + 4 функции
src/services/mocks/bcc.ts                   конверт SentEmail, отправка одной транзакцией
src/services/mocks/index.ts                 + 3 маршрута
src/composables/useSettings.ts              + секция mail, пароль вне стора, кэш v6
src/composables/useBccRequest.ts            + mailFrom/mailReady/mailSettled
src/views/admin/settings/MailSettings.vue   новая страница
src/views/admin/settings/SettingsLayout.vue + вкладка и provide
src/views/admin/suppliers/BccRequestPage.vue строка отправителя, Send заблокирован
src/router/index.ts                         + admin-settings-mail
src/i18n/admin/settings.ts                  + settingsMail (ru/en/lt), settingsTabs.mail
src/i18n/admin/bcc.ts                       + sender_label / sender_missing
src/services/mocks/mail-settings.spec.ts    новый (7)
src/services/mocks/bcc-envelope.spec.ts     новый (5)
tests/e2e/admin/settings/settings.spec.ts   список вкладок + 4 теста вкладки «Почта»
tests/e2e/admin/suppliers/bcc-request.spec.ts + тест отправителя
*-snapshots/bcc-request-{template,history}.png базлайны перерисованы (#22)
```

## 4. Приёмка

```
$ cd frontend_vue && npm run verify
exit=0
Test Files  31 passed (31)
     Tests  627 passed (627)
```

(в первом прогоне было красное: `prefer-const` на `mailStore` и пять файлов мимо prettier —
починено, `verify3.txt` уже зелёный)

```
$ npx playwright test tests/e2e/admin/settings/settings.spec.ts --reporter=line --workers=3
exit=0   24 passed (21.8s)

$ npx playwright test tests/e2e/admin/suppliers/bcc-request.spec.ts --reporter=line --workers=3
exit=1   2 failed (снимки template/history) · 43 passed
$ npx playwright test ... -g "visual" --update-snapshots --workers=1
exit=0   5 passed — базлайны перерисованы, картинка проверена глазами:
         в шаблоне появилась строка «FROM: Flexiron UAB <sales@flexiron.lt>»
```

Полный набор гнался отдельно — `useSettings` лежит на пути каждой админской страницы
(`AdminSidebar.onMounted → load()`), то есть это общий пол, а не одна область (verify.md,
«Какой прогон e2e нужен», уровень 2). Результат — в разделе 6.

## 5. Линзы

**Л9 (тесты) — инверсия на каждое утверждение, 12 юнитов + 6 e2e.**

| Что сломал | Что покраснело |
|---|---|
| `mockGetMail` кладёт `password` в ответ | «never returns the password — on either read path» |
| `passwordSet: false` всегда | «reports that a password is set» + «keeps the stored password» |
| пустой `password` перезаписывает пароль | «keeps the stored password when the field is left empty» |
| patch затирает незаданные поля | «merges only the fields it was given» |
| `mockGetSettings` отдаёт стор без подмены `mail` | «reads the same mail settings from the full slice» |
| `mockIsMailConfigured` не смотрит на хост | «refuses the test email while not configured» |
| `mockSendMailTest` отвечает чужим адресом | «sends the test email to the sender address itself» (юнит и e2e) |
| отправка циклом: письмо на получателя, адрес в `to` | «leaves exactly one envelope» + «puts every recipient in BCC» + «addresses the envelope from the mail server settings» |
| снят guard `MAIL_NOT_CONFIGURED` | «refuses to send while the mail server is not configured» |
| `fileIds: []` вместо payload | «carries the subject, body and attachments» |
| вкладка «Почта» убрана из `SETTINGS_TABS` | «the settings tabs are the seven sections, in order» |
| поле пароля забиндено на `settings.mail.username` | «the password field stays empty even though a password is set» |
| сид `host: ''` | «loads the mail server form filled from settings» |
| `_updateMail` без `markDirty` | «typing in the host field makes the save bar dirty» |
| `mailFrom` — константа `InBox LT <…>` | «shows the sender configured in the mail settings» |

Каждый раз краснел ровно тот тест, чьё поведение сломано; после каждой инверсии файл
восстанавливался из копии (`diff` с копией — пусто, проверено перед коммитом).

E2E-тест отправителя намеренно **читает** адрес из вкладки настроек и лишь потом сверяет с
письмом: константа в тесте проверяла бы совпадение теста с моком, а не страницы с
настройками (#15).

**Л1 (реактивность).** `mailFrom`/`mailReady` — `computed` над реактивным `settings`, новых
`watch`/`structuredClone`/`toRaw` нет. Поля формы — `:value` + `@input` (#49), порт
нормализуется `Number.parseInt` и NaN в стор не попадает (#25).

```
$ grep -n "structuredClone\|toRaw(\|watch(" src/composables/useBccRequest.ts src/views/admin/settings/MailSettings.vue
src/composables/useBccRequest.ts:1:import { ref, reactive, computed, watch, watchEffect } from 'vue'
src/composables/useBccRequest.ts:103:  watch(selectedProductIds, refreshRecipients, { deep: true })
```
(оба вхождения — прежние, от п. 11 и раньше; в новой странице ни одного)

**Л2 (i18n).** Паритет ключей ru/en/lt — временной спекой, прогнана и удалена:

```
$ npx vitest run src/i18n/__parity-check.spec.ts
Test Files  1 passed (1)     Tests  2 passed (2)      # settings + bcc
$ grep -n "settingsMail" -A 24 src/i18n/admin/settings.ts | grep "@"
(пусто — символа @ в переводах нет, #1)
```
Переводы дописаны в `src/i18n/admin/settings.ts` и `bcc.ts` — доменные файлы, не удалённый
`admin.ts` (#35). Русского в моках нет: сид почты — латиница.

**Л3 (контракт и HTTP).** Метод под смысл: `GET` чтение, `PATCH` merge-правка секции (как у
company/constants), `POST` действие «отправить тест». У каждого вызванного роута есть мок:

```
$ grep -n "api/settings/mail" src/services/settingsService.ts src/services/mocks/index.ts
settingsService.ts:166  apiGet  '/api/settings/mail'
settingsService.ts:170  apiPatch '/api/settings/mail'
settingsService.ts:179  apiPost  '/api/settings/mail/test'
mocks/index.ts:391   GET   /api/settings/mail
mocks/index.ts:1126  POST  /api/settings/mail/test
mocks/index.ts:1342  PATCH /api/settings/mail
```
Контракт дописан (раздел 2). `/translated` здесь не нужен: почтовые настройки — не
`TranslatedString` (#42).

**Л4 (мок = правда).** `mockGetMail()` собирает новый объект на каждый вызов — прямой ссылки
на стор наружу нет (#13). Сбой — состояние, а не мгновение: `MAIL_NOT_CONFIGURED` держится,
пока настройки не заполнены, и снимается настройками, а не первым чтением (#65). Пароль в
моке хранится, потому что сервер его хранит; наружу не выходит ни одним путём — это и
проверяет первый тест.

**Л5 (один источник).** Правило «сервер настроен» записано один раз —
`mockIsMailConfigured()`; отправка BCC и тестовое письмо зовут его, а не считают заново.
`mailReady` на клиенте — не вторая реализация, а объяснение пользователю до нажатия: сервер
всё равно отказывает сам, и тест на отказ есть. Почтовая секция не продублирована в
`settingsStore` (стор сузился до `Omit<AppSettings,'mail'>`). Машинная часть — `npm run
dupes` и sonarjs внутри `lint`, оба в зелёном `npm run verify`.

**Л6 (UI и CSS).** Классы `.settings-mail-*`, `.email-sender*` — грепом по проекту
свободны (#12). `.settings-section-title` / `.section-spacer` объявлены в самой странице, а
не взяты из чужого файла (#63). Иконка `email` в `SvgIcon.vue` существует (#17).
`CustomSelect` получает `string`, не `string | null` (#24). Многооператорных `@click` нет —
обработчики вынесены в функции (#67).

**Л7 (права, флаги, роутинг).** Нового флага нет; вкладка живёт под уже существующим
page-level `adminSettings`. Имя маршрута `admin-settings-mail` уникально:

```
$ grep -c "name: 'admin-settings-mail'" src/router/index.ts
1
```
Переходы — `router-link` по имени (#32, #62).

**Л8 (сохранение и потеря данных).** Пустое поле пароля не стирает пароль (тест). Save —
общая кнопка настроек, clean-slate; `discard()` сбрасывает и введённый пароль. Секрет не
попадает ни в снимок, ни в кэш localStorage — его нет в типе. Кэш поднят до v6, v5 в
списке протухших.

**Л10 (целостность).** Дублей имён маршрутов нет (совпадения в грепе — ссылки `redirect: {
name: … }`). `src/i18n/admin/index.ts` не менялся: домены `settings` и `bcc` в нём уже были.
`typecheck` зелёный на всём дереве, включая `tests/`.

## 6. Полный прогон e2e

```
$ npx playwright test --reporter=line --workers=3
  1 failed
    orders.spec.ts:1842 › Order Card › payments and invoices ›
      a price printed wrong is corrected in the open, not rewritten
      Expected: 115.5   Received: 120.5
  1022 passed (18.8m)
```

Падение **не моё и уже разобрано** — это тот же тест и то же расхождение, что легли в
журнал пункта 8 (`followups-8.md`, §5) и оттуда в bugs-file как **БАГ-24**
(`3.1-orders-card-bugs.md`): после `correct-confirm` тест ждёт закрытия модала, а не
прихода перечитанной карточки, и читает ячейку одноразовым `textContent()` — питфолл #64.
Проверено повторно на этом дереве:

```
$ npx playwright test … -g "a price printed wrong is corrected in the open" --workers=1 --repeat-each=3
exit=0   3 passed (42.4s)
```

Полный набор гнался ради общего пола (`useSettings` + мок настроек — их читает каждая
админская страница через `AdminSidebar`), и он чист: единственное падение принадлежит
известному гоночному тесту заказов, к почте отношения не имеющему.

**Одна правка легла после старта полного прогона** — `configured` в `MailSettings.vue`
перестала учитывать несохранённый пароль (кнопка теста обещала бы проверку того, чего
сервер ещё не видел). Она затрагивает только вкладку почты, а спеки настроек и BCC в том
прогоне ещё не стартовали; обе прогнаны заново на итоговом дереве:

```
$ npx playwright test tests/e2e/admin/settings/settings.spec.ts       tests/e2e/admin/suppliers/bcc-request.spec.ts --reporter=line --workers=3
exit=0   69 passed (1.2m)

$ npm run verify        # итоговый, на том же дереве
exit=0   Test Files 31 passed (31) · Tests 627 passed (627)
```

## 7. Вне гейта

```
$ npm run audit
found 0 vulnerabilities

$ npm run deadcode
Unused exports (58) · Unused exported types (21)
$ grep -n "Mail\|mail\|SentEmail" deadcode.txt
(пусто — ни один новый экспорт не мёртв; база verify.md — 59 и 22, роста нет)

$ npm run test:unit:coverage
Statements 100% · Branches 96.84% · Functions 100% · Lines 100%   (пороги 99/96/100/99)
```

## 8. Что осталось за пунктом

Бэкенд. `backend/app/modules/bcc/` — модель и `internal_api` без единого слайса,
`settings` — два слайса из нужных, тестов в `backend/` нет вовсе. Правила «пароль не
отдавать» и «одна транзакция, все адреса в BCC» сегодня реализованы и проверены на
мок-слое, который и служит фронту сервером. Когда у `bcc` появятся эндпоинты, оба правила
переезжают туда вместе со своими тестами — и `03-api-contract.md` уже описывает, что
именно там должно получиться.

---

**Итог:** машинная приёмка зелёная, линзы Л1–Л10 пройдены с командами и выводом,
инверсий 18 (12 юнит + 6 e2e), полный e2e — 1022 passed при одном известном чужом флейке.
