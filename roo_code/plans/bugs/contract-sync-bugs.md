# Bugs — contract-sync, сводный индекс

Собран задачей 38 плана
[`roo_code/plans/api/contract-sync-plan.md`](../api/contract-sync-plan.md), фаза D.

**Своих находок этот файл не содержит.** Находка живёт в доменном файле
`contract-sync-<домен>-bugs.md`, и правит её только он: семнадцать агентов в одном файле дрались
бы за номера `БАГ-NN`. Здесь — одна строка на находку и ссылка туда, где она описана целиком.

Ни одна из них в заходе сверки **не чинится**: план контракта код не правит, а расхождение
решается в пользу кода. Что чинить и в каком порядке — решает человек.

Собрано: 2026-09-04. Доменных файлов: 3 из 17. Находок: 17.

---

## Все находки

| № | домен | сер. | тип | место в коде | суть |
|---|---|---|---|---|---|
| [auth-01](contract-sync-auth-bugs.md#баг-01--post-apiauthregister-зовётся-мока-нет) | auth | High | Runtime | `services/mocks/index.ts:875,905` | `POST /api/auth/register` зовётся, ветки мока нет — под моками регистрация падает |
| [auth-02](contract-sync-auth-bugs.md#баг-02--русские-данные-в-мок-пользователе) | auth | Low | Mock data | `services/mocks/index.ts:884-886` | русские имя, фамилия и телефон в мок-пользователе (питфолл #33) |
| [auth-03](contract-sync-auth-bugs.md#баг-03--локаль-регистрации-зашита-строкой-ru) | auth | Medium | Contract | `views/public/RegisterPage.vue:348` | локаль регистрации зашита `'ru'`, локаль интерфейса теряется безвозвратно |
| [auth-04](contract-sync-auth-bugs.md#баг-04--registerinput-во-фронте-слабее-серверной-схемы) | auth | Low | TypeScript | `types/auth.ts:28-37` | `RegisterInput` слабее серверной схемы: `first_name`/`last_name` объявлены необязательными |
| [auth-05](contract-sync-auth-bugs.md#баг-05--meresponse-отдаёт-secret_link-которого-нет-в-типе-фронта) | auth | Low | Contract | `types/auth.ts:3-13` | `secret_link` из `MeResponse` не описан во фронте и молча отбрасывается |
| [auth-06](contract-sync-auth-bugs.md#баг-06--поле-формы-выводится-из-текста-серверного-сообщения) | auth | Medium | Contract | `services/api.ts:86-106` | поле формы выводится из **текста** серверного сообщения — переформулировка ломает подсветку |
| [auth-07](contract-sync-auth-bugs.md#баг-07--срок-жизни-сессии-записан-в-двух-местах) | auth | Low | Duplicate | `backend/.../login/domain.py:78`, `me/action.py:52` | срок жизни сессии записан дважды — `timedelta(hours=24)` и `max_age=86400` |
| [categories-01](contract-sync-categories-bugs.md#баг-01--код-ошибки-удаления-читается-из-message-а-настоящий-api-кладёт-его-в-code) | categories | High | Contract | `composables/useCategories.ts:43-47` | код ошибки удаления читается из `message`, а настоящий API кладёт его в `code` |
| [categories-02](contract-sync-categories-bugs.md#баг-02--productcount-в-моке-категорий-разошёлся-с-моком-товаров) | categories | High | Mock data | `services/mocks/categories.ts:85,405,459` | `productCount` статичен и разошёлся с моком товаров — удаляется категория с товарами |
| [categories-03](contract-sync-categories-bugs.md#баг-03--селект-родителя-видит-только-первые-25-категорий) | categories | Medium | Contract | `views/admin/products/CategoryCardPage.vue:62-65` | селект родителя видит только первые 25 категорий: `pageSize` по умолчанию, `total` не читается |
| [categories-04](contract-sync-categories-bugs.md#баг-04--категория-не-найдена-приходит-текстом-а-не-кодом-и-текст-показывается-пользователю) | categories | Medium | i18n | `services/mocks/categories.ts:1419` | «категория не найдена» приходит английским текстом мимо i18n и рисуется на странице |
| [categories-05](contract-sync-categories-bugs.md#баг-05--patch-и-put-возвращают-undefined-вместо-ошибки-для-несуществующей-категории) | categories | Medium | Runtime | `services/mocks/categories.ts:1456-1458,1490-1492` | PATCH и PUT отдают `undefined` как успех — сохранение удалённой записи «удаётся» |
| [categories-06](contract-sync-categories-bugs.md#баг-06--родителем-можно-назначить-собственного-потомка-на-цикле-мок-зависает) | categories | High | Runtime | `views/admin/products/CategoryCardPage.vue:88-93` | родителем можно назначить собственного потомка — цикл, зависание `getLevel`, список не открывается |
| [categories-07](contract-sync-categories-bugs.md#баг-07--putcategoryfields-шлёт-ключ-fieldname-которого-нет-ни-в-типе-ни-в-разборе-мока) | categories | Low | Contract | `services/categoriesService.ts:65-71` | `PUT /:id/fields` шлёт ключ `fieldName`, которого нет ни в типе, ни в разборе мока |
| [categories-08](contract-sync-categories-bugs.md#баг-08--правка-поля-категории-стирает-его-переводы-на-двух-других-языках) | categories | High | i18n | `views/admin/products/CategoryCardPage.vue:132-157` | правка поля категории стирает переводы двух других языков (`toTranslatedString` вместо `mergeLocaleValue`) |
| [categories-09](contract-sync-categories-bugs.md#баг-09--orm-отношение-children-объявлено-с-каскадом-на-внешнем-ключе-который-стоит-restrict) | categories | High | Backend | `backend/app/modules/products/shared/models.py:44-47` | ORM-каскад `children` против `ondelete="RESTRICT"` того же FK — два объявления требуют противоположного |
| [suppliers-01](contract-sync-suppliers-bugs.md#баг-01--список-валют-в-форме-поставщика-зашит-константой) | suppliers | Medium | Duplicate | `components/admin/SupplierFormSections.vue:58-63,262` | список валют в форме поставщика зашит константой, хотя валютами владеют настройки |

## По доменам

| домен | файл | находок | High | Medium | Low |
|---|---|---|---|---|---|
| auth | [`contract-sync-auth-bugs.md`](contract-sync-auth-bugs.md) | 7 | 1 | 2 | 4 |
| categories | [`contract-sync-categories-bugs.md`](contract-sync-categories-bugs.md) | 9 | 5 | 3 | 1 |
| suppliers | [`contract-sync-suppliers-bugs.md`](contract-sync-suppliers-bugs.md) | 1 | — | 1 | — |
| **итого** | | **17** | **6** | **6** | **5** |

Четырнадцати доменов в этой таблице нет **не потому, что находок у них нет**, а потому что до
них не дошла сверка: доменных файлов контракта три из семнадцати. Пустая строка домена здесь
означала бы «проверено, чисто» — поэтому её и нет.

## Что здесь видно поперёк доменов

Три находки — один и тот же класс, и он же самый дорогой из найденных: **машинный код ошибки
подменён человеческим текстом**. `auth-06` выводит поле формы из подстрок серверного сообщения;
`categories-01` сравнивает `e.message` с константой `CATEGORY_HAS_PRODUCTS`, что работает только
потому, что мок бросает `new Error(code)`; `categories-04` показывает пользователю английскую
строку `Category cat-99 not found` мимо i18n. Во всех трёх мок и настоящий клиент договорились
о разном, и на моках это зелено. Общее правило — в
[`00-conventions.md`](../../roo-context/api/00-conventions.md), раздел про ошибки.

Второй класс, две находки: **производное значение хранится числом** — `categories-02`
(`productCount` в моке) и `auth-07` (срок сессии двумя числами в двух файлах). Обе расходятся
молча и обе — про то же, о чём девятая графа обязанностей: «считать, а не хранить».
