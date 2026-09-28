# Потолки ожиданий после действия: settings и два каталога

Задача `expect-budget-after-action-settings-and-catalog-specs`, прогон 2026-09-28.
Три пункта плана «Сквозное: потолки ожиданий под нагрузкой и хвосты ссылок» — П1 в части
четырёх спеков вне `analytics/` и `suppliers/`.

## Что менялось

Четыре спеки получили бюджет ожидания у утверждений, которые стоят ПОСЛЕ действия на странице:

* `frontend_vue/tests/e2e/admin/products/categories.spec.ts` — 22 утверждения: открытие и
  закрытие модалов создания и удаления категории, модала поля, признак грязной формы
  (`not.toBeDisabled`, `toHaveClass(/\bdirty\b/)`), изменившаяся длина списка после поиска;
* `frontend_vue/tests/e2e/admin/settings/settings.spec.ts` — 9 утверждений: два модала
  (валюта, единица измерения), модал статуса, кнопка сохранения после правки поля, и
  единственный числовой потолок файла `{ timeout: 3000 }` у ожидания активного модального слоя
  переведён на тот же импорт;
* `frontend_vue/tests/e2e/admin/notifications/notifications.spec.ts` — 2 отрицательных
  утверждения: уход с маршрута уведомлений после клика по строке (`not.toHaveURL`) и
  исчезновение точки-бейджа после «отметить все прочитанными» (`not.toBeVisible`);
* `frontend_vue/tests/e2e/admin/sales-crm/sales-crm.spec.ts` — 1 утверждение: видимость
  страницы создания заказа после клика по кнопке нового заказа.

Бюджет везде взят ИМПОРТОМ `DATA_READY_TIMEOUT` из `frontend_vue/tests/e2e/helpers/ready.ts`;
второго экземпляра числа `30000` в тронутых файлах не появилось. Смысл утверждений не менялся:
регулярки, ожидаемые тексты, `not.` и `.soft` остались как были, добавлен только второй
аргумент.

Ассерт, у которого пол уже есть, не тронут: утверждения сразу после `openAdminPage`,
`openAdminCard` и `waitForDataReady` — вне правки.

## Сторож класса переходов

Новый файл `frontend_vue/src/services/expectUrlBudget.spec.ts` — vitest, окружение `node`
(как у `snapshotBudget.spec.ts`; в `vitest.config.ts` стоит `environment: 'node'` по умолчанию,
прагма не нужна). Разбор повторяет приём сторожа снимков: текст вызова целиком от `toHaveURL(`
до парной скобки, через переносы.

Три утверждения: разбор не пуст (не меньше 25 спек-файлов и не меньше 95 вызовов); каждый
неотрицательный (без `.not.`) вызов несёт `timeout: DATA_READY_TIMEOUT`, нарушители
перечисляются файлом и номером строки; отрицательных вызовов больше нуля — иначе правило
исключения не проверялось бы ничем.

## Прогон тронутых спеков

Команда (вывод в файл целиком, чтобы не потерять код возврата за конвейером):

```
cd frontend_vue && npx playwright test tests/e2e/admin/products/categories.spec.ts tests/e2e/admin/settings/settings.spec.ts tests/e2e/admin/notifications/notifications.spec.ts tests/e2e/admin/sales-crm/sales-crm.spec.ts --reporter=line > "$TMPDIR/e2e-touched.txt" 2>&1; echo "exit=$?"
```

Код возврата: `exit=0`.

Итог прогона: `85 passed (2.3m)`. Список прошлых тестов — все 85, включая визуальные эталоны
`categories › visual @1440` и `category-card › visual @1440`, флаговые проверки
`redirects to /404 when adminCategories flag is OFF` и
`field rows not draggable when categoryFieldReorder is OFF`. Строк `failed`, `flaky`,
`skipped` в выводе нет.

## Замер вместо инверсии

Нагрузку не создавали: машина общая, `yes`, `stress`, `pkill`, `killall` в этой задаче
запрещены. Вместо инверсии одно тронутое действие и следующее за ним утверждение временно
обёрнуты в измерение времени `Date.now()` — открытие модала создания категории в
`categories-list › create modal › clicking create button opens modal`.

Команда:

```
cd frontend_vue && npx playwright test tests/e2e/admin/products/categories.spec.ts -g "clicking create button opens modal" --reporter=line > "$TMPDIR/measure.txt" 2>&1; echo "exit=$?"; grep -E "\[measure\]|[0-9]+ (passed|failed)" "$TMPDIR/measure.txt"
```

Код возврата: `exit=0`. Вывод:

```
[measure] create-modal: 646 ms against 5000
  1 passed (7.0s)
```

Вывод по замеру: клик и появление модала вместе заняли **646 мс** против прежнего потолка
`expect` в **5000 мс** — запас почти восьмикратный, и красноты на этом утверждении не
наблюдается. Значит бюджет поставлен как **страховка на будущее**, а не как починка
наблюдаемого падения: на быстрой машине потолок не тратится вовсе, платит только падающий
тест. Инструментация из файла убрана — в кандидат она не входит.

## Мутационная проверка сторожа

Команда: временно снять `{ timeout: DATA_READY_TIMEOUT }` у одного неотрицательного
`toHaveURL(` в `categories.spec.ts` (переход по строке в карточку), прогнать
`npm run test:unit -- src/services/expectUrlBudget.spec.ts`, затем вернуть файл из резервной
копии.

Ожидание: `npm run test:unit` краснеет на `expectUrlBudget.spec.ts`, и снятый вызов назван в
списке нарушителей; после возврата — снова зелёный.

## Ссылки контрактных документов

Резолвер: `cd frontend_vue && CONTRACT_REFS=<документ> ./node_modules/.bin/vitest run
src/services/contractRefs.spec.ts`.

`categories.md` до правки — 183 ссылки, 25 битых; после — 181 ссылка, 24 битых. Счёт не вырос:
он уменьшился на снятую ссылку с номерами строк, которую заменила цитата теста.

В `notifications.md` ссылка на строки, где флага `test_mock_force_error` нет, заменена цитатой
имени теста `error state shows retry button` — номер строки не выдуман, а убран.

В `sales-crm.md` ссылка на строку с именем теста KPI оставлена: правка в этом тесте строку с
именем не двигала.

## Чего этот журнал не доказывает

`npm run verify` целиком и `npm run test:unit` целиком здесь не гонялись — их выполняет
контроллер после сдачи кандидата. Прогон четырёх тронутых спеков и сторожа выполнен, коды
возврата записаны выше.
