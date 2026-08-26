# Часть 013 — roo_code/plans/general (пачка 4 плана)

Проверено 2026-08-26. Код не менялся.

---

## 1. roo_code/plans/general/autonomous-run-policy-plan.md — **частично**

Незакрытых чекбоксов: 0 (`grep -c "^[[:space:]]*- \[ \]"` → 0).

Это политика прогона, а не правка кода. Проверяемы её измеримые утверждения и раздел 7 («первый прогон — инвентаризация»).

### Доказательство

```
$ find roo_code/plans -name "*.md" -not -path "*inventory-parts*" | wc -l
163
$ grep -rl "^[[:space:]]*- \[ \]" roo_code/plans --include=*.md | wc -l
25
$ grep -rh "^[[:space:]]*- \[ \]" roo_code/plans --include=*.md | wc -l
276
$ grep -rh "^[[:space:]]*- \[x\]" roo_code/plans --include=*.md | wc -l
12
$ find roo_code/plans/warehouse -name "*.md" | wc -l
80
$ grep -n "workflowSizeGuideline" .claude/settings.json
76:  "workflowSizeGuideline": "large"
$ wc -l frontend_vue/src/views/admin/warehouse/WarehousePage.vue
3811 frontend_vue/src/views/admin/warehouse/WarehousePage.vue
$ grep -rn "offcut-type-badge" frontend_vue/src | head
frontend_vue/src/styles/admin/warehouse_list.css:1076:.offcut-type-badge {
frontend_vue/src/styles/admin/warehouse_list.css:1085:.offcut-type-badge--sheet {
frontend_vue/src/styles/admin/warehouse_list.css:1089:.offcut-type-badge--linear {
frontend_vue/src/views/admin/warehouse/WarehousePage.vue:2735:                    class="offcut-type-badge"
$ ls roo_code/workflows/
inventory-plans.js
$ grep -n "inventory-<дата>" roo_code/workflows/inventory-plans.js
430:    '3. Запиши сводный отчёт в roo_code/plans/general/inventory-<дата>.md'
450:    'Прими работу. Отчёт инвентаризации должен лежать в roo_code/plans/general/inventory-<дата>.md.'
$ find roo_code -name "inventory*"
roo_code/workflows/inventory-plans.js
roo_code/plans/general/inventory-parts
$ git status --short
?? roo_code/plans/general/inventory-parts/
$ cd frontend_vue && npm run format:check
Checking formatting...
All matched files use Prettier code style!
$ git branch -a | grep auto/     # пусто
$ grep -rl "autonomous-run-policy-plan" --include=*.md . | grep -v node_modules
ROO.md
```

### Что есть
- Цифры разделов 1 и 2 совпадают почти в точности: 25 планов с чекбоксами, 276 незакрытых, 12 закрытых, 80 складских. Расхождение только в общем счёте: план говорит 162 файла, сейчас 163 (за вычетом файлов самой инвентаризации).
- Пример из раздела 2 подтверждён: правила `.offcut-type-badge` есть в `warehouse_list.css:1076`, то есть план `fix-offcuts-type-column.md` действительно наполовину описывает прошлое.
- `workflowSizeGuideline: "large"` в `.claude/settings.json` — как и сказано в разделе 7.
- Раздел 7 реализован скриптом: `roo_code/workflows/inventory-plans.js` (шесть фаз, вердикты, части в `inventory-parts/`), и прогон идёт прямо сейчас — этот файл его часть.
- Политика подключена: ROO.md ссылается на план.
- Предусловие раздела 4a выполнено: `git status --short` чист (кроме каталога отчётов этого прогона).

### Чего нет
- Утверждение раздела 4a «`npm run verify` красный, `format:check` не проходят восемь файлов» **устарело** — `format:check` зелёный.
- Сводного отчёта инвентаризации нет: ни `inventory-2026-08-25.md` (имя из раздела 93), ни `inventory-<дата>.md`. Есть только части `inventory-parts/part-0NN.md` незавершённого прогона.
- Разделы 3–6 (ветка `auto/<набор>`, коммит на задачу, `git stash push -u` у провала, правила остановки, 6 агентов, куски по 100) скриптом не реализованы: в `roo_code/workflows/` единственный файл — инвентаризация. Ветки `auto/*` в репозитории нет — реализационный прогон ни разу не запускался, что разделу 7 не противоречит.
- WarehousePage.vue 3811 строк против заявленных 3820 — мелкое расхождение.

### Файлы кода из плана
`src/styles/admin/warehouse_list.css`, `WarehousePage.vue`, `.claude/settings.json`

---

## 2. roo_code/plans/general/convert-claude-md-to-roo-code.md — **сделано**

Незакрытых чекбоксов: 0.

### Доказательство

```
$ ls -la frontend_vue/CLAUDE.md
ls: cannot access 'frontend_vue/CLAUDE.md': No such file or directory
$ ls -la roo_code/roo-context/frontend-vue-quickref.md
-rw-rw-r-- 1 greatgleb greatgleb 4975 Jun 30 15:28 roo_code/roo-context/frontend-vue-quickref.md
$ head -1 roo_code/roo-context/frontend-vue-quickref.md
# Frontend Vue — Quick Reference
$ grep -n "^## " roo_code/roo-context/frontend-vue-quickref.md
Directory Structure / Patterns / SOLID / DRY / DDD (Domain-Driven Design) / Prohibitions / Verification Checklist
$ grep -rn "CLAUDE.md" roo_code/skills/*.md
(нет совпадений)
$ grep -rn "CLAUDE.md" roo_code/ --include=*.md
только roo_code/plans/general/convert-claude-md-to-roo-code.md и move-project-to-flexiron-enterprise.md
$ git log --oneline --diff-filter=D -3 -- frontend_vue/CLAUDE.md
5d20a77 updated ai context
$ git log --oneline -3 -- roo_code/roo-context/frontend-vue-quickref.md
5d20a77 updated ai context
```

### Что есть
- Шаг 1 выполнен: `roo_code/roo-context/frontend-vue-quickref.md` существует и содержит ровно те семь разделов, что перечислены в плане (Directory Structure, Patterns, SOLID, DRY, DDD, Prohibitions, Verification Checklist), причём с относительными ссылками и без слэш-команд, как требовалось. Более того, шапка расширена ссылками на `frontend-composables.md`, `frontend-services.md`, `frontend-types.md`, а раздел DDD переведён из голого текста в ссылки на реальные файлы.
- Шаг 3 выполнен: ни один скил не ссылается на `frontend_vue/CLAUDE.md` — включая `roo_code/skills/create-plan.md`, где план указывал строку 37.
- Шаг 4 (нет остатков терминологии Claude Code в `frontend_vue/`) выполнен вместе с удалением файла.

### Отклонение от буквы плана (работы не оставляет)
Шаг 2 требовал *переписать* `frontend_vue/CLAUDE.md` в файл-указатель. Вместо этого файл **удалён** в том же коммите `5d20a77`, что создал quickref. Цель шага (в `frontend_vue/` не остаётся инструкций под Claude Code) достигнута сильнее, чем требовалось; воссоздавать файл ради «редирект-заметки» смысла нет. Корневой `CLAUDE.md` (тот, что через `@ROO.md` подключает общие правила) — другой файл и планом не затрагивается.

### Файлы кода из плана
`frontend_vue/CLAUDE.md`, `roo_code/roo-context/frontend-vue-quickref.md`, `roo_code/roo-context/frontend-architecture.md`, `roo_code/skills/vue-rules.md`, `roo_code/skills/create-plan.md`, `ROO.md`

---

## 3. roo_code/plans/general/dropdown-design-options.md — **частично**

Незакрытых чекбоксов: 0.

Документ предлагает три варианта оформления пользовательского дропдауна и рекомендует **Option A** (шапка с аватаром, именем и ролью; карточка ~220px; усиленный blur; красноватый hover у «Выйти»; плавная анимация fade+slide), заканчиваясь вопросом «реализовать?». Реализован он наполовину: **весь CSS Option A есть, разметки шапки нет** — значит правила шапки мёртвые.

### Доказательство

```
$ grep -rn "user-dropdown" frontend_vue/src
frontend_vue/src/components/admin/AdminTopbar.vue:105:          <div v-if="isMenuOpen" class="user-dropdown" @click.stop>
frontend_vue/src/components/admin/AdminTopbar.vue:106:            <button class="user-dropdown-item" @click="goToSettings">
frontend_vue/src/components/admin/AdminTopbar.vue:110:            <div class="user-dropdown-divider" />
frontend_vue/src/components/admin/AdminTopbar.vue:111:            <button class="user-dropdown-item logout" @click="handleLogout">
frontend_vue/src/styles/erp-base.css:434:.user-dropdown {
frontend_vue/src/styles/erp-base.css:450:.user-dropdown-header {
frontend_vue/src/styles/erp-base.css:459:.user-dropdown-avatar {
frontend_vue/src/styles/erp-base.css:474:.user-dropdown-info {
frontend_vue/src/styles/erp-base.css:481:.user-dropdown-name {
frontend_vue/src/styles/erp-base.css:490:.user-dropdown-role {
frontend_vue/src/styles/erp-base.css:498:.user-dropdown-item {
frontend_vue/src/styles/erp-base.css:517:.user-dropdown-item:hover {
frontend_vue/src/styles/erp-base.css:522:.user-dropdown-item.logout:hover {
frontend_vue/src/styles/erp-base.css:527:.user-dropdown-divider {
```

`erp-base.css:434-449` — `min-width: 220px`, `backdrop-filter: blur(20px)` (усиленный против 16px соседнего плана `user-dropdown-menu-plan.md`).
`erp-base.css:450-497` — `.user-dropdown-header`, `.user-dropdown-avatar` (38px, градиент `--primary`/`--primary-dark`), `.user-dropdown-info`, `.user-dropdown-name`, `.user-dropdown-role`.
`erp-base.css:522` — `.user-dropdown-item.logout:hover { color: #ff6b6b; background: rgba(255,107,107,0.1); }` — красноватый hook Option A.
`AdminTopbar.vue:104` — `<Transition name="dropdown-fade">`, анимация в scoped-стилях компонента.

### Что есть
CSS Option A целиком плюс красный hover и анимация; ширина и blur — по Option A, не по базовому плану.

### Чего нет
В разметке `AdminTopbar.vue:105-114` внутри `.user-dropdown` только две кнопки и разделитель. Блока `.user-dropdown-header` с аватаром, именем и ролью **нет** — пять классов шапки (`-header`, `-avatar`, `-info`, `-name`, `-role`) не встречаются ни в одном шаблоне. Визуально дропдаун сейчас — это Option B (компактный список из двух пунктов с улучшенными отступами), а не рекомендованный Option A. Иконка настроек — `name="settings"`, а план называет `settings-gear`; иконка выхода `corner-up-left` совпадает.

### Файлы кода из плана
(в плане пути файлов не указаны — только имена CSS-классов и иконок)

---

## 4. roo_code/plans/general/move-project-to-flexiron-enterprise.md — **частично**

Незакрытых чекбоксов: 0.

План описывает перенос каталога Windows `C:\...\InBox LT` → `C:\...\flexiron_enterprise`. Сам перенос из этого чекаута не проверяем: репозиторий живёт на Linux по пути, которого в плане нет. Проверяемы косметические шаги и перечисленные «проблемные» файлы — и они все в состоянии «после переезда».

### Доказательство

```
$ git rev-parse --show-toplevel
/home/greatgleb/PycharmProjects/flexiron-source
$ head -1 ROO.md
# Flexiron Enterprise — Roo Code Instructions
$ head -1 roo_code/roo-context/frontend-vue-quickref.md
# Frontend Vue — Quick Reference
$ ls -la .idea
ls: cannot access '.idea': No such file or directory
$ ls -la "xlx tables"
ls: cannot access 'xlx tables': No such file or directory
$ ls -d demo frontend_vue/dist
demo
frontend_vue/dist
$ grep -rl "InBox LT" . --exclude-dir=node_modules --exclude-dir=.git
roo_code/plans/general/review-followups.md
roo_code/plans/general/move-project-to-flexiron-enterprise.md
frontend_vue/tests/e2e/admin/suppliers/bcc-request.spec.ts
frontend_vue/src/composables/useBccRequest.ts
frontend_vue/src/views/admin/suppliers/BccRequestPage.vue
$ ls "toDo/old ai ide configs"
.claude  .windsurf
```

### Что есть
- Шаг 7 (косметика) выполнен: `ROO.md` — «Flexiron Enterprise», quickref — «Frontend Vue — Quick Reference» (было «InBox LT — Frontend Vue (Admin Migration)»).
- Проблема 1 снята сама: каталога `.idea/` в репозитории нет вовсе — нечего переименовывать (`InBox LT.iml`, `modules.xml`, `workspace.xml` отсутствуют).
- Проблема 4 снята: каталога `xlx tables/` нет — `rename_files.py` и `deep_analyze.py` в репозитории отсутствуют, обновлять пути негде.
- Указание «не менять» имя компании в письмах соблюдено: «InBox LT» осталось ровно в трёх файлах кода — `useBccRequest.ts:16-23`, `BccRequestPage.vue:509-511`, `bcc-request.spec.ts:298`, и это бизнес-контент, как план и требовал.
- «43 файла с InBox LT в заголовках» из проблемы 6 больше нет: осталось пять файлов, из которых два — сами планы.

### Чего нет / не проверяемо
- Собственно перенос каталога (шаги 2, 3, 6) из Linux-чекаута не подтвердить: пути `C:\Users\great\...` тут не существуют, а git remote проверялся бы вне репозитория задачи.
- Шаг 1 «удалить артефакты сборки перед переездом»: `demo/` и `frontend_vue/dist/` на месте. Для переезда это уже неважно (регенерируются сборкой), но буквально шаг не выполнен.
- Проблема 3 (`toDo/old ai ide configs/.claude/settings.local.json` с паттернами `Bash(cd *InBox LT*)`): каталог `toDo/old ai ide configs/` на месте с `.claude` и `.windsurf`. План сам называет это «safe to ignore», и «InBox LT» grep в нём уже не находит.
- Шаг 5 (пересборка/проверка) не проверялся — состояние `npm run build` этой задачей не снималось; `format:check` зелёный.

### Файлы кода из плана
`.idea/InBox LT.iml`, `.idea/modules.xml`, `.idea/workspace.xml`, `demo/app/*.js`, `frontend_vue/dist/assets/*.js`, `toDo/old ai ide configs/.claude/settings.local.json`, `xlx tables/rename_files.py`, `xlx tables/deep_analyze.py`, `frontend_vue/src/composables/useBccRequest.ts`, `frontend_vue/src/views/admin/suppliers/BccRequestPage.vue`, `frontend_vue/tests/e2e/admin/suppliers/bcc-request.spec.ts`, `ROO.md`, `roo_code/roo-context/frontend-vue-quickref.md`
