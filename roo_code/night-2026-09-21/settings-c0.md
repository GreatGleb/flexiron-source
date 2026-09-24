# Задача settings-c0 — мок-долг домена настроек

**Ждёт:** ничего. **Правит:** только файлы из «Что можно править».

## Что читать

- [`roo_code/plans/settings/settings-backend-plan.md`](../plans/settings/settings-backend-plan.md),
  **раздел 4 целиком** — это ТЗ задачи, и **раздел 3** — таблица кодов и статусов;
- [`roo_code/skills/vue-rules.md`](../skills/vue-rules.md) — весь список питфоллов;
- [`roo_code/skills/verify.md`](../skills/verify.md) — цикл проверок;
- [`roo_code/roo-context/api/settings.md`](../roo-context/api/settings.md) — контракт домена.

## Что можно править

```
frontend_vue/src/services/mocks/settings.ts
frontend_vue/src/services/mocks/index.ts
frontend_vue/src/services/mocks/mail-settings.spec.ts
frontend_vue/src/services/mocks/warehouse-map.spec.ts
```

**`frontend_vue/src/services/mocks/bcc.ts` править запрещено** — он принадлежит своему
домену. Общий код `MAIL_NOT_CONFIGURED` обязан остаться тем же именем: этого требует
`frontend_vue/src/composables/apiErrorCode.consumers.spec.ts:241`.

## Что сделать

Мок держится того же правила, что приложение: если в приложении так нельзя — в моке тоже
нельзя (линза Л4). Сегодня мок отказывает **строкой**, а сервер будет отказывать **кодом**,
и из-за этого слайсы C4–C7 нечем проверить в мок-режиме.

1. **Десять бросков → `ApiRequestError` с кодом в поле `code`.** Замер:
   `grep -c "throw new Error(" frontend_vue/src/services/mocks/settings.ts` → **10**.
   Статусы из раздела 3 плана: `*_NOT_FOUND` → 404, `MAIL_NOT_CONFIGURED` → 409,
   `MAP_NOT_AN_IMAGE` → 415. Человеческое сообщение — второе поле, совпадать с кодом не обязано.

2. **Спеки, утверждающие отказ по тексту, переписать на утверждение о поле.** Это
   `mail-settings.spec.ts:70`, `:111` и `warehouse-map.spec.ts:72-73`. Форма утверждения —
   та, что `errorCode(e)` вернёт и против мока, и против сервера.
   **Снять `toThrow` и не поставить взамен утверждения о поле — это не выполненная задача,
   а ослеплённая спека** (Л9). Приёмка проверяет обе половины.

3. **Смена пароля перестаёт быть no-op.** `mocks/index.ts:1235` отвечает `delay(undefined)`
   и тела не смотрит вовсе. Завести хранение пароля демо-пользователя и бросать
   `PASSWORD_WRONG_CURRENT`, `PASSWORD_TOO_SHORT`, `PASSWORD_CONFIRM_MISMATCH` — те же три
   кода, что вводит C7. Без этого приёмка C7 сойдётся на пустом месте.

4. **Снять две мёртвые ветки мока:** `GET /api/settings` (`mocks/index.ts:491`) и
   `PUT /api/settings` (`:1257`). Вызывающего у них нет (линза К2), и эндпоинтами домена
   они не являются. Номера строк проверить замером — в контракте они устарели.

5. **Завести две проверки, которые сервер делает, а мок нет:** системность статуса при
   удалении (ядровый `FORBIDDEN`, новым кодом не заводится) и дубль пары единиц у правила
   пересчёта — `CONVERSION_PAIR_TAKEN`, новый код. Сегодня `mockCreateConversion`
   (`mocks/settings.ts:569`) кладёт дубль в стор без единой проверки.

**Чего делать нельзя.** Превращать в код человеческие сообщения. В этом файле их нет, и
если при правке появится строка не из заглавных — в поле `code` она не идёт.

**Чего эта задача не делает.** Перенумерацию порядка статусов после удаления
(`mocks/settings.ts:661`) не трогать ни в какую сторону: расхождение с сервером настоящее,
но выбор стороны — вопрос владельца **В14**, и это отдельный слайс C14.

## Приёмка

```bash
cd frontend_vue && npm run verify          # целиком, не test:unit
./roo_code/night-2026-09-21/приёмка.sh c0
```

Критерии (все замерены красными 2026-09-21):

| что | ждём | сегодня |
|---|---|---|
| `grep -c "throw new Error(" mocks/settings.ts` | 0 | 10 |
| `grep -c toThrow mocks/mail-settings.spec.ts` | 0 | 2 |
| `grep -c toThrow mocks/warehouse-map.spec.ts` | 0 | 1 |
| утверждение о поле в обеих спеках | >0 | 0 |
| `grep -c "no-op mock" mocks/index.ts` | 0 | 1 |
| три кода пароля в `mocks/index.ts` | >0 | 0 |
| `grep -c "'/api/settings'" mocks/index.ts` | 0 | 2 |
| `grep -c CONVERSION_PAIR_TAKEN mocks/settings.ts` | >0 | 0 |
| `bcc.ts` не изменён | 0 | 0 (сторож) |

`npm run test:unit` обязан остаться зелёным целиком — включая
`apiErrorCode.consumers.spec.ts` и обе BCC-спеки.
