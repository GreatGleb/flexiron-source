---
name: vue-rules
description: Vue 3 + Vite специфические правила и pitfalls для frontend_vue. Trigger on these tasks — adding `:class` bindings, writing/editing mocks, building editable forms with Save, adding new pages/components, рефакторинг существующей страницы при добавлении новой (extract shared component), новый endpoint caller (service/composable/validate), перед коммитом Vue changes, при появлении странных багов с CSS/реактивностью, при выборе HTTP-метода для нового endpoint.
user_invocable: true
---

# Vue Rules — InBox LT Frontend

Правила собраны из реальных багов, допущенных при миграции `demo/` → `frontend_vue/`. Каждое правило = lesson learned, не теория.

---

## Working principles

- **Thoroughness over speed.** Перед завершением задачи — Grep по всем callers связанным с изменением (router-link, event names, class names, props). «По диагонали» уже привело к багу: preselect supplier не передавался из карточки потому что я не нашёл все места ссылок на `/bcc-request`.
- **Сверяться с оригиналом по деталям.** Перед реализацией логики из `demo/admin/*.html` или `demo/assets/js/admin/*.js` — прочитать оригинал целиком, не полагаться на память.
- **Верификация фазы ≠ только typecheck+lint.** Статика не ловит: пропущенные компоненты (план→файлы), неверные строковые литералы (route names, i18n keys), визуальные регрессии, устаревшие **спецификации в `toDo/admin-api-contract.md`** и meta-страницы (ScreensPage, README). Финальный чек = план→файлы→typecheck→lint→contract sync→browser.

---

## Save UX — Clean-slate (default) vs Quick-actions

**Default — clean-slate** для редактируемых форм/конфигов: все мутации в локальном Vue reactive state, **сервер не знает до клика Save**. Reload страницы = откат к серверному состоянию. Никаких autosave / per-keystroke sync.

**Применяется к:**
- `SupplierCardPage` — Save шлёт PATCH **с дельтой только** через `useDirtyCheck.diff()`
- `SupplierCardConfigPage` — Save → 3 PUT параллельно: `/api/config/fields`, `/api/config/sections`, `/api/config/permissions`. Все ops (create/delete field/section, rename, hide) — **локальные**, не immediate POST/DELETE.

**Quick-actions исключения** — применяются на сервере сразу:
- Drag-drop статуса в Kanban → `PATCH /suppliers/:id/status`
- Accept Response / No Response в BCC history → `POST /bcc/events/:id/...`
- BCC Send / Log → `POST /bcc/send` / `/bcc/log`
- Audit entry delete (с confirm modal перед) → `DELETE /suppliers/:id/audit/:idx`
- Upload файла при drag-drop → `POST /uploads` (отвязанный fileId, привязка через save)

**Перед написанием save-логики — спросить пользователя:** «Это quick-action (immediate) или Save-batch (clean-slate)?». Default — **clean-slate если форма редактируемая**.

---

## HTTP-методы

- **PATCH (RFC 7396 merge)** — update одиночной сущности с дельтой. Сейчас: `/suppliers/:id`, `/suppliers/:id/status`, `/config/sections/:id`, `/config/fields/:id`
- **PUT** — bulk replace коллекций когда нужна атомарная консистентность. Сейчас: `/config/sections`, `/config/fields`, `/config/permissions` (все три параллельно при Save)
- **POST** — create + necessary actions (BCC send/log, accept response, etc.)
- **DELETE** — точечное удаление (audit entry, custom field, section)

**Idempotency-Key header** на необратимых POST (`/bcc/send`, `/bcc/log`) — генерится через `newIdempotencyKey()` из `services/api.ts`, server cache 24h.

**Files** — отдельный `POST /api/uploads` (multipart) сразу при drag-drop → returns `{ fileId, name, size, mime, url }`. Save-операция шлёт массив `fileIds: string[]`. Никогда **не** шлём бинарные данные внутри JSON-payload карточки.

---

## Contract-first (новый endpoint / рефакторинг страницы)

Lesson learned: добавляя `SupplierCreatePage` с рефакторингом `SupplierCardPage` (extract `SupplierFormSections`) — пропустил (a) обновление `toDo/admin-api-contract.md` (строка "UI компонент — отдельная итерация" осталась после реализации), (b) синхронизацию client-валидации с контрактом (validate проверял только `company`, а контракт требовал `company + email`, server отклонил бы с 422). Typecheck+lint этого не ловят, user потом спросил «проверь ничего ли не упущено».

**Rule: контракт read → код → контракт write-back.**

**Read-first** — перед написанием composable/service/validate для endpoint'а:
- Прочитать соответствующую секцию `toDo/admin-api-contract.md` (поиск по endpoint-пути)
- Required поля, response shape, save-паттерн (clean-slate vs quick-action), идемпотентность, коды ошибок — берутся **оттуда**, не из UX-интуиции. Client validation ≥ server validation (никогда не слабее).

**Write-back** — после реализации endpoint-UI обновить контракт:
- Убрать маркеры `"TBD"`, `"UI — отдельная итерация"`, `"endpoint на будущее"` у этого endpoint'а
- Прописать конкретный `Page.vue`, composable, route — чтобы в контракте был actual reference
- Если контракт ссылается на несуществующие endpoint'ы/файлы — удалить (контракт не рот-плейбук)

**Refactor checklist** (задача = новая страница + extract shared компонент из существующей):
1. Grep по всем callers удаляемых/переименованных экспортов (services, composables, components) — в том числе **template usage**, который TypeScript не всегда ловит
2. В старой странице: убрать неиспользуемые `import`ы и utility-функции (`newNote`, локальные consts) после extraction — ESLint ловит imports, но не всегда inline-функции
3. Обновить `toDo/admin-api-contract.md` если сигнатура endpoint'а изменилась (`Partial<Supplier>` → `Partial<SupplierCardData>`)
4. Если меняется роут-структура — проверить `ScreensPage.vue`, CLAUDE.md (путь архитектуры), README
5. Done ≠ typecheck+lint. Done = (1-4) + pitfalls #1-#14 + contract sync + browser walk-through golden path

**Триггер-момент**: как только замечаю что задача = «новая страница + extract из старой» / «новый endpoint caller» — **сразу** читать контракт **перед** планом, не после.

---

## Pitfalls (полный список)

### 1. `@` в переводах ломает vue-i18n
`name@company.com` → `SyntaxError: Invalid linked format`. **Fix:** экранировать `name{'@'}company.com`.

### 2. `#app` обёртка ломает flex-layout
Public CSS рассчитан на `body { display: flex; flex-direction: column }`. Vue оборачивает в `<div id="app">`. **Fix:** `#app { display: flex; flex-direction: column; min-height: 100vh }` в App.vue.

### 3. `html { overflow: hidden }` из erp-base.css обрезает длинные страницы
Для public-страниц с register form. **Fix:** `html { height: auto !important; overflow: visible !important }` в App.vue.

### 4. Vite блокирует файлы вне корня (403)
CSS из `demo/assets/` ссылается на `url("../images/...")`. **Fix:** `server.fs.allow` в `vite.config.js` должен включать `demo/assets`.

### 5. Контент за bg-overlay невидим
App.vue рендерит `.bg-image` (z-index: 0) и `.bg-overlay` (z-index: 1). **Fix:** контент без `.container` (который уже z-index 10) сам задаёт `position: relative; z-index: 10+`.

### 6. `taskkill //F //IM node.exe` убивает Claude Code
Не использовать массово. Stop dev-server по PID или Ctrl+C.

### 7. `public.css` грузится глобально и ломает admin-стили
Например `.lang-switcher { position: absolute }` — рвёт flex topbar. **Fix:** `.shell .lang-switcher { position: static }` в AdminLayout.

### 8. `bg-image` / `bg-overlay` нужны ВСЕМ роутам
Стеклянный effect (`backdrop-filter: blur`) на sidebar/topbar работает только когда фон видим. **Не** скрывать через `v-if` для admin.

### 9. HTML-комментарии в `<template>` попадают в DOM
`<!-- X -->` рендерится как DOM comment node, особенно засоряет внутри `<svg>`. **Fix:** комментарии — только в `<script>`.

### 10. Wrong route names
`<router-link :to="{ name: 'X' }">` молча не работает если `X` не в router. **Fix:** перед использованием — сверяться с `src/router/index.ts`. TypeScript эту ошибку не ловит.

### 11. Typecheck + lint ≠ полная проверка фазы
Статика не ловит: пропущенные компоненты, неверные string literals, визуальные регрессии. **Fix:** чеклист план→файлы→typecheck→lint→browser. Не объявлять фазу done после только typecheck.

### 12. Generic class names ломают локальные стили
`.hidden { display: none !important }` в `suppliers_list.css` — глобальный. Когда я делаю `:class="{ hidden }"` локально — глобальный display:none перебивает локальный opacity/dashed. **Fix:** для state-модификаторов — BEM-style: `.is-hidden`, `.is-active`, `.has-error`. Перед `:class="{ X }"` → `grep -rn "^\.X" demo/assets/css/` чтобы убедиться что имя свободно.

### 13. Mock возвращает прямую ссылку на массив
`mockGetX()` возвращает `STORE` напрямую → `composable.value === STORE`. Любая mutation в моке отражается в reactive ref **без emit**. Если view дополнительно делает `.push()` — двойной item. **Fix:** все `mockGetX()` возвращают `structuredClone(STORE)`. Mutations работают со STORE, чтения — с клонами. Симулирует REST где client/server изолированы.

### 14. Один UI-компонент по всей странице — не mix native + custom
Mix нативного `<select>` и `CustomSelect` в одной странице → разный hover/focus, юзер видит непоследовательность (jitter padding на CustomSelect:hover). **Fix:** если CustomSelect доминирует — использовать его и в модалках. Native HTML — только когда явно нет кастомного аналога.

### 16. Компонент обязан сам импортировать свои CSS-стили

Нельзя полагаться на то, что нужные классы загрузит другой компонент на той же странице. Если `ComponentA` использует класс `.foo` из `_foo.css`, но не импортирует его — стили работают только случайно, когда `ComponentB` (который импортирует `_foo.css`) оказывается на той же странице.

**Пример:** `SearchInput.vue` использовал класс `checkbox-list-search` из `_checkbox-list.css` без импорта. На странице с `CheckboxList` всё работало. На странице без него — иконка вылезала за поле.

**Fix:** каждый Vue-компонент импортирует свой CSS-файл явно в `<script setup>`:
```ts
import '@styles/admin/components/_my-component.css'
```

### 15. Playwright тесты не должны зависеть от конкретных мок-данных

**Проблема:** тест который ищет `'металл'` или ожидает `.toHaveCount(1)` на конкретное имя — падает при любом изменении STORE. При переходе на реальный API мок-данные вообще не будут использоваться.

**Правила для Playwright тестов:**

**Язык — всегда English.** `tests/e2e/fixtures.ts` устанавливает `flexiron_lang: 'en'` в `addInitScript` до загрузки страницы. Все спеки (кроме `i18n.spec.ts`) импортируют `test` из `fixtures.ts`, не из `@playwright/test`.

**Мок-данные — только English.** Все значения в mock STORE (названия категорий, названия полей, enum-варианты, описания) должны быть на английском. Русские строки в STORE → тест, проверяющий текст на странице, зависит от языка мока.

**Не хардкодить конкретные данные в тестах.** Вместо `fill('металл')` + `toHaveCount(1)` — читать значение динамически:
```ts
// ПЛОХО — падает при смене мока
await input.fill('metal')
await expect(rows).toHaveCount(1)

// ХОРОШО — данные-независимо
const firstName = (await rows.first().locator('td').first().textContent())!.trim().split(' ')[0]!
await input.fill(firstName)
const after = await rows.count()
expect(after).toBeGreaterThan(0)
expect(after).toBeLessThan(totalBefore)
```

**Относительные count-assertions вместо абсолютных:**
```ts
// ПЛОХО
await expect(rows).toHaveCount(6)

// ХОРОШО
const before = await rows.count()
await doSomething()
await expect(rows).toHaveCount(before + 1)
```

**Для API-ready тестов — `page.route()`.** Когда тест проверяет поведение при конкретных данных (например ошибку 409 при удалении), используй перехват:
```ts
await page.route('**/api/categories/*', (route) => {
  route.fulfill({ status: 409, json: { code: 'CATEGORY_HAS_PRODUCTS' } })
})
```
Это работает одинаково с мок-слоем и с реальным API.

**`fixtures.ts` — единственная точка входа.** Все спеки импортируют `{ test, expect }` из `../../fixtures` (или относительного пути), кроме `feature-flags.spec.ts` и `i18n.spec.ts`.

### 17. SvgIcon — проверять имя иконки до использования

Перед `<SvgIcon name="X">` — grep `SvgIcon.vue` чтобы убедиться что имя существует. TypeScript не ловит неверную строку. Примеры ошибок: `name="edit"` (не существует → `name="edit-pencil"`), `name="folder"` и `name="trash"` не были определены пока не добавили вручную.

**Fix:** `grep -n '"X"' src/components/admin/SvgIcon.vue` перед каждым новым именем.

---

### 18. Save bar и модалка — разные i18n ключи для «Отмена»

Кнопка в **save bar** (отмена несохранённых изменений) → ключ `btn_discard_changes` → «Отменить изменения».  
Кнопка **закрытия модалки** (cancel без действия) → ключ `btn_discard` → «Отмена».

Никогда не использовать `btn_discard` в save bar — пользователь не понимает что именно отменяется.

---

### 19. Поиск/фильтры — внутри того же GlassPanel что и таблица

`glass-input` имеет фон `rgba(255,255,255,0.05)` — почти невидим на тёмном фоне страницы вне GlassPanel. Внутри GlassPanel `backdrop-filter + background` панели создают дополнительный слой — поле выглядит заметно светлее и чётче.

**Правило:** поиск/фильтры, относящиеся к конкретной таблице — **всегда внутри той же `GlassPanel`** перед содержимым таблицы.

---

### 20. Filter watcher + GlassPanel — обязательный `initialized` флаг

`watch(filters, load)` + поиск внутри `panel-body` = каждое нажатие клавиши → `loading=true` → `.glass-panel.loading .panel-body { display:none }` → поле поиска скрывается + браузер сбрасывает фокус. После загрузки поле появляется, но фокус потерян.

**Fix:** скелетон только при **первой** загрузке; перезагрузки по фильтрам — тихие:

```ts
let initialized = false

async function load() {
  if (!initialized) loading.value = true  // скелетон только первый раз
  try {
    const res = await getItems(filters)
    items.value = res.items
    initialized = true
  } finally {
    loading.value = false
  }
}
```

Применяется: любой composable с `watch(filters, load)` где поиск находится внутри GlassPanel.

---

### 21. Сайдбар — только точки входа в раздел

В сайдбаре — одна ссылка на **раздел** (`/admin/products`), не на каждую его страницу. Все дочерние страницы раздела (категории, карточки и т.д.) навигируются через ссылки внутри раздела.

**Как делать внутренние ссылки:**
```html
<!-- в хедере страницы-раздела -->
<div class="entity-action-bar no-margin pos-static">
  <router-link :to="{ name: 'admin-categories' }" class="btn btn-secondary">
    <SvgIcon name="folder" :width="18" :height="18" />
    <span>{{ t('categories.title') }}</span>
  </router-link>
</div>
```

Пример нарушения: «Категории» как отдельный пункт сайдбара, хотя это страница внутри раздела «Товары».

---

### 22. Обновлять snapshot baseline сразу после UI-изменений

После любого изменения затрагивающего элемент с snapshot-тестом (CSS margin/padding/color, текст кнопки, добавлен/убран элемент) — **сразу обновить baseline**:

```bash
npx playwright test [spec] -g "[test-name]" --update-snapshots --workers=1
```

Затем открыть обновлённый PNG в `tests/e2e/...-snapshots/` и визуально убедиться что baseline корректен. Не накапливать «сломанные» снапшоты — они скрывают реальные регрессии.

---

### 23. AppModal + Teleport: fall-through атрибуты не приземляются

`AppModal` использует `<Teleport to="body">` как корень. `data-test="modal-*"` на компоненте становится fall-through атрибутом, но Teleport не DOM-элемент — атрибут исчезает. Все E2E тесты модальных окон падают с 0 элементов.

**Это уже исправлено в AppModal.vue** (`inheritAttrs: false` + `v-bind="$attrs"` на `.modal-overlay`). Но если создаётся **новый** компонент с `<Teleport>` как корнем — обязательно то же самое:

```ts
defineOptions({ inheritAttrs: false })
```
```html
<div v-bind="$attrs" class="modal-overlay" ...>  <!-- data-test приземляется сюда -->
```

---

## Применение этого skill

Когда я начинаю задачу из триггер-списка (см. description выше) — **прочитай этот skill полностью** прежде чем писать код. Если задача не из списка — `Read` только нужный раздел.

После завершения задачи — пройтись чек-листом: pitfalls #1–#23, save-режим (если форма), HTTP-метод (если новый endpoint).
