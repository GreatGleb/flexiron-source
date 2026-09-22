#!/usr/bin/env bash
# Самопроверка приёмки 2026-09-21: мутации обязаны краснить ИМЕННО свои критерии.
#
#   ./самопроверка-приёмки.sh        # код возврата 0 — все ожидания сошлись
#
# Ничего в рабочем дереве не меняется. Под `/tmp/приёмка-мутация-$$` собирается
# ОДНОРАЗОВЫЙ корень, ЗЕРКАЛЬНЫЙ настоящему: туда копируются `backend/` и сам гейт
# вместе с `проба.py` — в `roo_code/night-2026-09-21/`. Затем запускается КОПИЯ
# гейта: её собственный `cd "$(dirname "$0")/../.."` резолвится в этот поддельный
# корень, поэтому её `$ROOT/backend` — это мутированная копия. Гейт больше НЕ
# читает ACCEPTANCE_BACKEND (F1, 2026-09-22): перенаправить его пробы нечем, и
# самопроверка обходится без единой переменной окружения. /tmp убирается за собой
# по `trap` и до, и после.
#
# Зачем это нужно. Ночью два слайса из двух прошли приёмку, правив ПРОЗУ, а не
# поведение: докстринг без слова map_url снял сторож П11, переименование колонки в
# time_zone набрало счётчик С2 на чужой строке DateTime(timezone=True), а число
# строк '@router' ничего не говорило о доступности роутов. M1..M5 воспроизводят
# именно эти обходы и требуют, чтобы новая редакция на каждом краснела, а проза без
# колонки (M2) — оставалась зелёной. M7 закрывает F1 (переменная окружения не спасает
# сломанное дерево), M8 — F2 (неизвестный селектор даёт ненулевой выход).

set -uo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
FAKE=/tmp/приёмка-мутация-$$
COPY="$FAKE/backend"
GATE="$FAKE/roo_code/night-2026-09-21/приёмка.sh"

fails=0

ok()  { printf '  \033[32mOK  \033[0m %s\n' "$1"; }
bad() { printf '  \033[31mПЛОХО\033[0m %s\n' "$1"; fails=$((fails+1)); }

# ── помощники ────────────────────────────────────────────────────────────────

# поддельный корень: копия backend И копия гейта с пробой, чтобы "$ROOT" гейта
# указывал на копию. Никаких переменных окружения — только раскладка каталогов.
подготовить() {
  rm -rf "$FAKE"
  mkdir -p "$FAKE/roo_code/night-2026-09-21"
  cp -r "$ROOT/backend" "$COPY"
  cp "$HERE/приёмка.sh" "$HERE/проба.py" "$FAKE/roo_code/night-2026-09-21/"
  chmod +x "$GATE"
}

# Копия фронта для мутаций, которые валят фронтовый спек: критерий гоняет vitest в
# "$ROOT/frontend_vue" ПОДДЕЛЬНОГО корня, как и любая другая проба — с того дерева, где
# лежит гейт. node_modules НЕ копируется (сотни мегабайт), а линкуется: пакеты — не то,
# что мутируется. Копируются только те файлы, без которых vitest не соберёт спек:
# src целиком, package.json ("type": "module") и vitest.config.ts (алиасы '@'/'@styles').
подготовить_фронт() {
  mkdir -p "$FAKE/frontend_vue"
  cp -r "$ROOT/frontend_vue/src" "$FAKE/frontend_vue/src"
  cp "$ROOT/frontend_vue/package.json" "$ROOT/frontend_vue/vitest.config.ts" \
    "$FAKE/frontend_vue/"
  ln -s "$ROOT/frontend_vue/node_modules" "$FAKE/frontend_vue/node_modules"
}

# прогон КОПИИ гейта; слайсы передаются аргументами. cd не нужен: гейт сам уходит
# в свой корень. ACCEPTANCE_BACKEND не выставляется ни здесь, ни где-либо ещё.
прогон() { "$GATE" "$@" 2>&1; }

# строка критерия в выводе обязана быть ПЛОХО / обязана быть OK
красный() { printf '%s\n' "$2" | grep -F -- "$1" | grep -q 'ПЛОХО'; }
зелёный() { printf '%s\n' "$2" | grep -F -- "$1" | grep -q 'OK'; }

trap 'rm -rf "$FAKE"' EXIT

# ── M1: настоящая колонка map_url ────────────────────────────────────────────
echo "── M1: map_url объявлен колонкой → П11 обязан покраснеть ─────────────"
подготовить
python3 - "$COPY/app/modules/settings/shared/models.py" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
anchor = "    map_file_id: Mapped[str] = mapped_column(String(255), nullable=False)\n"
assert anchor in text, "якорь M1 не найден"
text = text.replace(
    anchor,
    anchor + "    map_url: Mapped[str | None] = mapped_column(String(512), nullable=True)\n",
    1,
)
open(path, "w", encoding="utf-8").write(text)
PY
OUT=$(прогон c9); rc=$?
if красный 'П11: ссылка не хранится' "$OUT"; then
  ok "M1: проба П11 покраснела на настоящей колонке"
else bad "M1: проба П11 осталась зелёной"; printf '%s\n' "$OUT" | tail -20; fi
[ "$rc" -ne 0 ] && ok "M1: выход приёмки ненулевой (rc=$rc)" || bad "M1: приёмка вернула 0"
old=$(grep -c 'map_url' "$COPY/app/modules/settings/shared/models.py")
[ "$old" -gt 0 ] && ok "M1: старая редакция тоже была бы красной (вхождений map_url: $old)" \
  || bad "M1: старое вхождение потерялось"
зелёный 'три роута карты' "$OUT" && ok "M1: остальные критерии C9 не тронуты" \
  || bad "M1: покраснело лишнее"

# ── M2: map_url только в прозе ───────────────────────────────────────────────
echo "── M2: map_url упомянут только в докстринге → П11 обязан остаться зелёным ──"
подготовить
python3 - "$COPY/app/modules/settings/shared/models.py" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
anchor = "column holds the link at all — it is built in `domain.py`, on every read.\n"
assert anchor in text, "якорь M2 не найден"
text = text.replace(
    anchor,
    anchor + "      (проза M2: map_url упомянут здесь и не значит ничего.)\n",
    1,
)
open(path, "w", encoding="utf-8").write(text)
PY
OUT=$(прогон c9); rc=$?
зелёный 'П11: ссылка не хранится' "$OUT" \
  && ok "M2: проба П11 осталась зелёной — проза нерелевантна" \
  || { bad "M2: проба П11 покраснела на прозе"; printf '%s\n' "$OUT" | tail -20; }
[ "$rc" -eq 0 ] && ok "M2: приёмка вернула 0" || bad "M2: приёмка вернула $rc"
old=$(grep -c 'map_url' "$COPY/app/modules/settings/shared/models.py")
[ "$old" -gt 0 ] && ok "M2: СТАРАЯ редакция на этой прозе краснела (вхождений map_url: $old)" \
  || bad "M2: проза не попала в файл"

# ── M3: снятая регистрация роута ─────────────────────────────────────────────
echo "── M3: снят декоратор DELETE → критерий роутов обязан покраснеть ───────"
подготовить
python3 - "$COPY/app/modules/settings/features/warehouse_map/action.py" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
anchor = '@router.delete("/warehouse-map", response_model=ApiResponse)\n'
assert anchor in text, "якорь M3 не найден"
open(path, "w", encoding="utf-8").write(text.replace(anchor, "", 1))
PY
OUT=$(прогон c9); rc=$?
if красный 'три роута карты' "$OUT"; then
  ok "M3: проба роутов покраснела (DELETE больше не смонтирован)"
else bad "M3: проба роутов осталась зелёной"; printf '%s\n' "$OUT" | tail -20; fi
[ "$rc" -ne 0 ] && ok "M3: выход приёмки ненулевой (rc=$rc)" || bad "M3: приёмка вернула 0"
old=$(grep -c '@router' "$COPY/app/modules/settings/features/warehouse_map/action.py")
[ "$old" = 2 ] && ok "M3: старая редакция тоже была бы красной (строк '@router': $old)" \
  || bad "M3: строк '@router' не 2, а $old"
зелёный 'П11: хранится идентификатор' "$OUT" && ok "M3: остальные критерии C9 не тронуты" \
  || bad "M3: покраснело лишнее"

# ── M4: колонки C2 удалены, имена остались в прозе ───────────────────────────
echo "── M4: колонки C2 удалены, имена в прозе → новый критерий красный, старый зелёный ──"
подготовить
python3 - "$COPY/app/modules/settings/shared/models.py" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
columns = (
    '    time_zone: Mapped[str | None] = mapped_column(String(64), nullable=True)\n'
    '    country_code: Mapped[str | None] = mapped_column(String(2), nullable=True)\n'
    '    confirmation_code: Mapped[str] = mapped_column(\n'
    '        String(4), nullable=False, default="", server_default=""\n'
    '    )\n'
)
assert columns in text, "якорь M4 не найден"
prose = (
    '    """Проза для M4 — имена полей остались только в этом тексте:\n'
    '    time_zone: часовой пояс\n'
    '    country_code: страна\n'
    '    confirmation_code: код подтверждения\n'
    '    """\n'
)
open(path, "w", encoding="utf-8").write(text.replace(columns, prose, 1))
PY
OUT=$(прогон c2); rc=$?
if красный 'часовой пояс' "$OUT"; then
  ok "M4: проба C2 покраснела (колонок нет)"
else bad "M4: проба C2 осталась зелёной"; printf '%s\n' "$OUT" | tail -20; fi
[ "$rc" -ne 0 ] && ok "M4: выход приёмки ненулевой (rc=$rc)" || bad "M4: приёмка вернула 0"
old=$(grep -c '^    \(time_zone\|country_code\|confirmation_code\):' \
  "$COPY/app/modules/settings/shared/models.py")
[ "$old" = 3 ] && ok "M4: СТАРАЯ редакция на этой прозе была бы зелёной (совпадений: $old)" \
  || bad "M4: старое совпадение не набралось (получено $old)"
зелёный 'три новые константы' "$OUT" && ok "M4: критерий констант не тронут" \
  || bad "M4: покраснело лишнее"

# ── M5: черновик перестал сниматься ──────────────────────────────────────────
echo "── M5: UPDATE перестал гасить is_draft → тест П31 обязан покраснеть ─────"
подготовить
python3 - "$COPY/app/modules/settings/features/warehouse_map/repository.py" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
anchor = ".values(is_draft=False)"
assert anchor in text, "якорь M5 не найден"
open(path, "w", encoding="utf-8").write(text.replace(anchor, ".values(is_draft=True)", 1))
PY
OUT=$(прогон c9); rc=$?
if красный 'П31: Save снимает черновик' "$OUT"; then
  ok "M5: тест П31 покраснел"
else bad "M5: тест П31 остался зелёным"; printf '%s\n' "$OUT" | tail -20; fi
[ "$rc" -ne 0 ] && ok "M5: выход приёмки ненулевой (rc=$rc)" || bad "M5: приёмка вернула 0"
old=$(grep -rl 'is_draft' "$COPY/app/modules/settings" 2>/dev/null | wc -l | tr -d ' ')
[ "$old" -gt 0 ] && ok "M5: СТАРАЯ редакция была бы зелёной (файлов с is_draft: $old)" \
  || bad "M5: старое совпадение потерялось"

# ── M6: проба, которая не может исполниться ──────────────────────────────────
echo "── M6: сломанный импорт → проба обязана быть красной, а не зелёной ──────"
подготовить
python3 - "$COPY/app/modules/settings/shared/models.py" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
anchor = "class WarehouseMap(UUIDMixin, TimestampMixin, Base):"
assert anchor in text, "якорь M6 не найден"
open(path, "w", encoding="utf-8").write(
    text.replace(anchor, "class WarehouseMap(UUIDMixin, TimestampMixin, Base)", 1)
)
PY
OUT=$(прогон c9); rc=$?
if printf '%s\n' "$OUT" | grep -q 'проба не выполнилась'; then
  ok "M6: строка критерия сообщает «проба не выполнилась»"
else bad "M6: сообщения о неисполненной пробе нет"; printf '%s\n' "$OUT" | tail -20; fi
красный 'таблица карты заведена' "$OUT" \
  && ok "M6: критерий красный (fail-closed), а не молчаливо зелёный" \
  || bad "M6: критерий остался зелёным при неисполнимой пробе"
[ "$rc" -ne 0 ] && ok "M6: выход приёмки ненулевой (rc=$rc)" || bad "M6: приёмка вернула 0"

# ── M7: ACCEPTANCE_BACKEND не спасает сломанное дерево (F1) ──────────────────
echo "── M7: сломанный backend + ACCEPTANCE_BACKEND=чистая копия → всё равно красный ──"
подготовить
python3 - "$COPY/app/modules/settings/features/warehouse_map/repository.py" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
anchor = ".values(is_draft=False)"
assert anchor in text, "якорь M7 не найден"
open(path, "w", encoding="utf-8").write(text.replace(anchor, ".values(is_draft=True)", 1))
PY
PRISTINE="$FAKE/пристин"
cp -r "$ROOT/backend" "$PRISTINE"
# именно тот приём, которым гейт обходили раньше: переменная указывает на чистую копию
OUT=$(ACCEPTANCE_BACKEND="$PRISTINE" "$GATE" c9 2>&1); rc=$?
if красный 'П31: Save снимает черновик' "$OUT"; then
  ok "M7: П31 остался красным — ACCEPTANCE_BACKEND проигнорирован"
else bad "M7: ACCEPTANCE_BACKEND позеленил сломанное дерево"; printf '%s\n' "$OUT" | tail -20; fi
[ "$rc" -ne 0 ] && ok "M7: выход приёмки ненулевой (rc=$rc)" || bad "M7: приёмка вернула 0"

# ── M8: неизвестный селектор → ненулевой выход (F2) ──────────────────────────
echo "── M8: неизвестный селектор → ПЛОХО и ненулевой выход ──────────────────"
подготовить
OUT=$(прогон zzz); rc=$?
if printf '%s\n' "$OUT" | grep -q 'ПЛОХО'; then
  ok "M8: неизвестный селектор даёт строку ПЛОХО"
else bad "M8: строки ПЛОХО нет"; printf '%s\n' "$OUT" | tail -20; fi
[ "$rc" -ne 0 ] && ok "M8: выход приёмки ненулевой (rc=$rc)" || bad "M8: приёмка вернула 0 на мусорном селекторе"

# ── M9: снят тенант-предикат из САМОГО UPDATE → тест П31 обязан покраснеть ───
# F5 закрыт правкой ТЕСТА (test_warehouse_map_draft.py:182 требует tenant_id в
# UPDATE), но собственной мутации у него не было: M5 снимает эффект черновика
# целиком, а не предикат. Здесь из UPDATE в repository.py убирается ровно строка
# `UploadedFile.tenant_id == tenant_id,` — и критерий П31 обязан покраснеть.
echo "── M9: удалён тенант-предикат из UPDATE → тест П31 обязан покраснеть ────"
подготовить
python3 - "$COPY/app/modules/settings/features/warehouse_map/repository.py" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
# Предикат встречается ДВАЖДЫ (чтение в get_uploaded_file и сам UPDATE). Якорь
# вместе со следующей строкой .is_draft делает правку адресной — снимаем ИМЕННО
# из UPDATE, а не из тенант-скоупа чтения.
old = ("            UploadedFile.tenant_id == tenant_id,\n"
       "            UploadedFile.is_draft.is_(True),\n")
new = "            UploadedFile.is_draft.is_(True),\n"
assert text.count(old) == 1, "якорь M9 не единственен"
open(path, "w", encoding="utf-8").write(text.replace(old, new, 1))
PY
OUT=$(прогон c9); rc=$?
if красный 'П31: Save снимает черновик' "$OUT"; then
  ok "M9: тест П31 покраснел (тенант-предикат снят из UPDATE)"
else bad "M9: тест П31 остался зелёным"; printf '%s\n' "$OUT" | tail -20; fi
[ "$rc" -ne 0 ] && ok "M9: выход приёмки ненулевой (rc=$rc)" || bad "M9: приёмка вернула 0"
left=$(grep -c 'UploadedFile.tenant_id == tenant_id' \
  "$COPY/app/modules/settings/features/warehouse_map/repository.py")
[ "$left" = 1 ] && ok "M9: правка адресная — предикат чтения (get_uploaded_file) на месте" \
  || bad "M9: ожидали 1 оставшийся предикат, нашли $left"
зелёный 'три роута карты' "$OUT" && ok "M9: остальные критерии C9 не тронуты" \
  || bad "M9: покраснело лишнее"

# ── M10: подмена интерпретатора (обёртка python3 впереди PATH) + сломанное дерево ─
# Воспроизводит приём pass 2: обёртка ОТДАЁТ ВЕРДИКТ вместо питона (`-m pytest` →
# 0, `-c` со словом openapi → «3»). Дерево при этом сломано ПО-НАСТОЯЩЕМУ (снят
# DELETE-роут) — иначе подделка прошла бы на зелёном и ничего не доказала. После
# F9 ожидание: НЕ зелёный — либо критерий роутов красный (подмена не сработала),
# либо гейт громко отверг подменённый интерпретатор.
echo "── M10: обёртка python3 впереди PATH + сломанный роут → зелёного быть не должно ──"
подготовить
python3 - "$COPY/app/modules/settings/features/warehouse_map/action.py" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
anchor = '@router.delete("/warehouse-map", response_model=ApiResponse)\n'
assert anchor in text, "якорь M10 не найден"
open(path, "w", encoding="utf-8").write(text.replace(anchor, "", 1))
PY
WRAP="$FAKE/подмена-бин"
mkdir -p "$WRAP"
cat > "$WRAP/python3" <<'SH'
#!/bin/sh
# Приём pass 2: pytest — «успех», проба про openapi — «3». Остальное делегируется
# настоящему питону, чтобы подделка была НЕЗАМЕТНОЙ (иначе соседние критерии
# покраснели бы сами и замаскировали дыру).
case "$*" in
  *"-m pytest"*) exit 0 ;;
esac
case "$*" in
  *openapi*) echo 3; exit 0 ;;
esac
exec /usr/bin/python3 "$@"
SH
chmod +x "$WRAP/python3"
# сторож мутации: обёртка обязана перехватывать bare `python3`, иначе M10 пуст
peek_c=$(PATH="$WRAP:$PATH" python3 -c 'openapi' 2>&1)
PATH="$WRAP:$PATH" python3 -m pytest -q >/dev/null 2>&1; peek_p=$?
if [ "$peek_c" = 3 ] && [ "$peek_p" = 0 ]; then
  ok "M10: обёртка перехватывает bare python3 (openapi→«3», pytest→0) — приём на месте"
else bad "M10: обёртка не воспроизводит приём (openapi='$peek_c', pytest rc=$peek_p)"; fi
OUT=$(PATH="$WRAP:$PATH" "$GATE" c9 2>&1); rc=$?
if красный 'три роута карты' "$OUT"; then
  ok "M10: критерий роутов остался КРАСНЫМ при обёртке впереди PATH (подмена не прошла)"
elif printf '%s\n' "$OUT" | grep -qE 'ПЛОХО.*(интерпретатор|доверенному PATH|открытом на запись)'; then
  ok "M10: гейт громко отверг подменённый интерпретатор"
else
  bad "M10: подмена python3 всё ещё даёт зелёный вердикт"; printf '%s\n' "$OUT" | tail -20
fi
[ "$rc" -ne 0 ] && ok "M10: выход приёмки ненулевой (rc=$rc)" || bad "M10: приёмка вернула 0 на сломанном дереве с обёрткой"
# видимость: гейт печатает, ЧЕМ исполняет, — РЕАЛЬНЫЙ путь, не обёртку
REAL_PY=$(PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" command -v python3)
printf '%s\n' "$OUT" | grep -qF "$REAL_PY" \
  && ok "M10: в выводе гейта виден РЕАЛЬНЫЙ интерпретатор ($REAL_PY)" \
  || bad "M10: в выводе гейта нет строки с реальным интерпретатором ($REAL_PY)"

# ── M11: снят код UOM_IN_USE → красный ТОЛЬКО отказ по единице ────────────────
# Заход 2a конвертировал серверные половины c4/c5/c15 из grep по файлам в запросы.
# M11..M17 доказывают, что новый критерий ломается ИМЕННО тем, о чём он, и что
# сосед — нет. Ориентир владельца: снять code="UOM_IN_USE" → красный только UOM-тест.
echo "── M11: снят code=\"UOM_IN_USE\" → красный UOM-отказ, валютные зелёные ─────"
подготовить
python3 - "$COPY/app/modules/settings/features/crud/domain.py" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
anchor = ', code="UOM_IN_USE"'
assert text.count(anchor) == 1, "якорь M11 не единственен"
open(path, "w", encoding="utf-8").write(text.replace(anchor, "", 1))
PY
OUT=$(прогон c4 c5 c15); rc=$?
if красный 'С4: отказы UOM/валют отвечают кодом (тест)' "$OUT"; then
  ok "M11: критерий С4 покраснел (код UOM_IN_USE снят)"
else bad "M11: критерий С4 остался зелёным"; printf '%s\n' "$OUT" | tail -20; fi
зелёный 'С5: дубль пары пересчёта отвергнут (тест)' "$OUT" && ok "M11: сосед С5 (пересчёт) не тронут" || bad "M11: покраснело лишнее в С5"
зелёный 'С15: границы финансовых констант (тест)' "$OUT" && ok "M11: сосед С15 не тронут" || bad "M11: покраснело лишнее в С15"
[ "$rc" -ne 0 ] && ok "M11: выход приёмки ненулевой (rc=$rc)" || bad "M11: приёмка вернула 0"
# специфичность: красный ИМЕННО UOM-тест, валютные — зелёные
( cd "$COPY" && python3 -m pytest tests/modules/settings/test_settings_refusals.py -q -k uom_in_use >/dev/null 2>&1 ); m11_uom=$?
( cd "$COPY" && python3 -m pytest tests/modules/settings/test_settings_refusals.py -q -k "currency_in_use or currency_default" >/dev/null 2>&1 ); m11_cur=$?
[ "$m11_uom" -ne 0 ] && ok "M11: UOM-тест красный (rc=$m11_uom)" || bad "M11: UOM-тест остался зелёным"
[ "$m11_cur" -eq 0 ] && ok "M11: валютные тесты зелёные" || bad "M11: валютные тесты покраснели (rc=$m11_cur)"

# ── M12: из reorder убрано сравнение множеств → 200 вместо 422 ────────────────
echo "── M12: reorder без сравнения множеств → неполный список проходит ─────────"
подготовить
python3 - "$COPY/app/modules/settings/features/crud/domain.py" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
anchor = "if len(set(given)) != len(given) or set(given) != known:"
assert text.count(anchor) == 1, "якорь M12 не единственен"
open(path, "w", encoding="utf-8").write(
    text.replace(anchor, "if len(set(given)) != len(given):", 1)
)
PY
OUT=$(прогон c4 c5 c15); rc=$?
if красный 'С5: неполный reorder отвергнут кодом (тест)' "$OUT"; then
  ok "M12: критерий С5 (reorder) покраснел — неполный список дал 200"
else bad "M12: критерий С5 (reorder) остался зелёным"; printf '%s\n' "$OUT" | tail -20; fi
зелёный 'С5: дубль пары пересчёта отвергнут (тест)' "$OUT" && ok "M12: сосед С5 (пересчёт) не тронут" || bad "M12: покраснело лишнее в С5"
зелёный 'С15: границы финансовых констант (тест)' "$OUT" && ok "M12: сосед С15 не тронут" || bad "M12: покраснело лишнее в С15"
[ "$rc" -ne 0 ] && ok "M12: выход приёмки ненулевой (rc=$rc)" || bad "M12: приёмка вернула 0"

# ── M13: верхняя граница vat_rate снята → 101 проходит, граничный 100 зелёный ──
echo "── M13: vat_rate (0.0, 100.0) → (0.0, None) → 101 проходит ────────────────"
подготовить
python3 - "$COPY/app/modules/settings/features/crud/domain.py" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
anchor = '"vat_rate": (0.0, 100.0),  # П108'
assert text.count(anchor) == 1, "якорь M13 не единственен"
open(path, "w", encoding="utf-8").write(
    text.replace(anchor, '"vat_rate": (0.0, None),  # П108 (мутация M13)', 1)
)
PY
OUT=$(прогон c4 c5 c15); rc=$?
if красный 'С15: границы финансовых констант (тест)' "$OUT"; then
  ok "M13: критерий С15 покраснел (101 больше не отвергается)"
else bad "M13: критерий С15 остался зелёным"; printf '%s\n' "$OUT" | tail -20; fi
зелёный 'С4: отказы UOM/валют отвечают кодом (тест)' "$OUT" && ok "M13: сосед С4 не тронут" || bad "M13: покраснело лишнее в С4"
[ "$rc" -ne 0 ] && ok "M13: выход приёмки ненулевой (rc=$rc)" || bad "M13: приёмка вернула 0"
# «граница работает»: за границей — красный, САМА граница (100/0) остаётся зелёной
( cd "$COPY" && python3 -m pytest tests/modules/settings/test_settings_refusals.py -q -k out_of_range >/dev/null 2>&1 ); m13_range=$?
( cd "$COPY" && python3 -m pytest tests/modules/settings/test_settings_refusals.py -q -k constant_bounds_are_inclusive >/dev/null 2>&1 ); m13_edge=$?
[ "$m13_range" -ne 0 ] && ok "M13: тест «за границей» красный (rc=$m13_range)" || bad "M13: тест «за границей» остался зелёным"
[ "$m13_edge" -eq 0 ] && ok "M13: тест граничных значений (100) зелёный" || bad "M13: граничный тест покраснел (rc=$m13_edge)"

# ── M14: снят блок дубля пары → второй POST даёт 200 ─────────────────────────
echo "── M14: снят CONVERSION_PAIR_TAKEN → второй POST той же пары даёт 200 ─────"
подготовить
python3 - "$COPY/app/modules/settings/features/crud/domain.py" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
anchor = (
    "    # Gap 2: 409 if duplicate conversion exists\n"
    "    existing = await get_conversion_by_uom_pair(db, tenant_id, from_uom_id, to_uom_id)\n"
    "    if existing is not None:\n"
    "        raise ConflictError(\n"
    "            \"A conversion rule between these units already exists\",\n"
    "            code=\"CONVERSION_PAIR_TAKEN\",\n"
    "        )\n"
)
assert text.count(anchor) == 1, "якорь M14 не единственен"
open(path, "w", encoding="utf-8").write(
    text.replace(anchor, "    # Gap 2 снят мутацией M14: дубль пары не отвергается.\n", 1)
)
PY
OUT=$(прогон c4 c5 c15); rc=$?
if красный 'С5: дубль пары пересчёта отвергнут (тест)' "$OUT"; then
  ok "M14: критерий С5 (пересчёт) покраснел — второй POST дал 200"
else bad "M14: критерий С5 (пересчёт) остался зелёным"; printf '%s\n' "$OUT" | tail -20; fi
зелёный 'С5: неполный reorder отвергнут кодом (тест)' "$OUT" && ok "M14: сосед reorder не тронут" || bad "M14: покраснело лишнее в reorder"
зелёный 'С4: отказы UOM/валют отвечают кодом (тест)' "$OUT" && ok "M14: сосед С4 не тронут" || bad "M14: покраснело лишнее в С4"
[ "$rc" -ne 0 ] && ok "M14: выход приёмки ненулевой (rc=$rc)" || bad "M14: приёмка вернула 0"

# ── M15: снята регистрация обработчика AppError → красная проба 282 ───────────
# НАХОДКА захода 2a (2026-09-22). Ориентир владельца ждал от этой мутации ещё и
# «500 в reorder/constants-тестах». Под скопированным харнессом это НЕ
# воспроизводится: тест собирает СВОЙ FastAPI() и регистрирует app_error_handler
# сам (как велено — приём из test_warehouse_map_draft.py:108), поэтому снятие
# декоратора в main.py на путь этих запросов не влияет. Проба 282 смотрит на
# ПРОДУКТ и краснеет; тесты обязаны остаться зелёными — это ожидание зафиксировано
# ниже, а не подогнано. Что отказ ДЕЙСТВИТЕЛЬНО едет на обработчике, доказывает
# M15b: тело обработчика сломано — и reorder/constants краснеют.
echo "── M15: снят @app.exception_handler(AppError) → красная проба 282 ──────────"
подготовить
python3 - "$COPY/app/main.py" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
anchor = "@app.exception_handler(AppError)\n"
assert text.count(anchor) == 1, "якорь M15 не единственен"
open(path, "w", encoding="utf-8").write(text.replace(anchor, "", 1))
PY
OUT=$(прогон c4 c5 c15); rc=$?
if красный 'AppError зарегистрирован в приложении' "$OUT"; then
  ok "M15: проба регистрации обработчика покраснела (смотрит на продукт)"
else bad "M15: проба регистрации обработчика осталась зелёной"; printf '%s\n' "$OUT" | tail -20; fi
зелёный 'С5: неполный reorder отвергнут кодом (тест)' "$OUT" && ok "M15: reorder-тест ЗЕЛЁНЫЙ — декоратор вне пути теста (находка)" || bad "M15: reorder-тест покраснел вопреки ожиданию"
зелёный 'С15: границы финансовых констант (тест)' "$OUT" && ok "M15: constants-тест ЗЕЛЁНЫЙ — декоратор вне пути теста (находка)" || bad "M15: constants-тест покраснел вопреки ожиданию"
зелёный 'С4: отказы UOM/валют отвечают кодом (тест)' "$OUT" && ok "M15: сосед С4 (HTTPException) не тронут" || bad "M15: покраснело лишнее в С4"
[ "$rc" -ne 0 ] && ok "M15: выход приёмки ненулевой (rc=$rc)" || bad "M15: приёмка вернула 0"

# ── M15b: тело обработчика AppError сломано → 500 в reorder/constants ────────
# Это и есть та половина ориентира, которую не даёт снятие декоратора: отказ
# reorder/constants проходит через app_error_handler, и если он не мапит класс на
# статус, тесты получают 500 (raise_app_exceptions=False в харнессе показывает это
# как ответ, а не как трейсбек).
echo "── M15b: обработчик AppError всегда 500 → reorder/constants краснеют ───────"
подготовить
python3 - "$COPY/app/main.py" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
anchor = (
    "    status_code = next(\n"
    "        (code for kind, code in _APP_ERROR_STATUS if isinstance(exc, kind)), 500\n"
    "    )\n"
)
assert text.count(anchor) == 1, "якорь M15b не единственен"
open(path, "w", encoding="utf-8").write(
    text.replace(anchor, "    status_code = 500  # мутация M15b\n", 1)
)
PY
OUT=$(прогон c4 c5 c15); rc=$?
if красный 'С5: неполный reorder отвергнут кодом (тест)' "$OUT"; then
  ok "M15b: reorder-тест покраснел (обработчик вернул 500)"
else bad "M15b: reorder-тест остался зелёным"; printf '%s\n' "$OUT" | tail -20; fi
if красный 'С15: границы финансовых констант (тест)' "$OUT"; then
  ok "M15b: constants-тест покраснел (обработчик вернул 500)"
else bad "M15b: constants-тест остался зелёным"; printf '%s\n' "$OUT" | tail -20; fi
зелёный 'AppError зарегистрирован в приложении' "$OUT" && ok "M15b: проба регистрации зелёная (декоратор на месте)" || bad "M15b: проба регистрации покраснела"
зелёный 'С4: отказы UOM/валют отвечают кодом (тест)' "$OUT" && ok "M15b: сосед С4 (HTTPException) не тронут" || bad "M15b: покраснело лишнее в С4"
[ "$rc" -ne 0 ] && ok "M15b: выход приёмки ненулевой (rc=$rc)" || bad "M15b: приёмка вернула 0"

# ── M16: возвращён alias="order" → красная проба 294 ─────────────────────────
echo "── M16: sort_order с alias=\"order\" → проба схемы PATCH статуса красная ─────"
подготовить
python3 - "$COPY/app/modules/settings/features/crud/schemas.py" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
anchor = (
    "class OrderStatusPatchInput(BaseModel):\n"
    "    \"\"\"Partial update for an order status.\"\"\"\n"
    "\n"
    "    name: TranslatedString | None = None\n"
)
assert text.count(anchor) == 1, "якорь M16 не единственен"
addition = anchor + "    sort_order: int | None = Field(alias=\"order\", default=None)  # M16\n"
open(path, "w", encoding="utf-8").write(text.replace(anchor, addition, 1))
PY
OUT=$(прогон c4 c5 c15); rc=$?
if красный 'order ушёл из схемы PATCH статуса' "$OUT"; then
  ok "M16: проба схемы покраснела (alias=\"order\" вернулся)"
else bad "M16: проба схемы осталась зелёной"; printf '%s\n' "$OUT" | tail -20; fi
зелёный 'С4: отказы UOM/валют отвечают кодом (тест)' "$OUT" && ok "M16: сосед С4 не тронут" || bad "M16: покраснело лишнее в С4"
[ "$rc" -ne 0 ] && ok "M16: выход приёмки ненулевой (rc=$rc)" || bad "M16: приёмка вернула 0"

# ── M17: имя константы C2 вписано в CONSTANT_BOUNDS → красная проба 361 ──────
echo "── M17: default_kerf_mm в CONSTANT_BOUNDS → проба границ C2 красная ────────"
подготовить
python3 - "$COPY/app/modules/settings/features/crud/domain.py" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
anchor = (
    "CONSTANT_BOUNDS: dict[str, tuple[float | None, float | None]] = {\n"
    "    \"vat_rate\": (0.0, 100.0),  # П108\n"
)
assert text.count(anchor) == 1, "якорь M17 не единственен"
addition = (
    "CONSTANT_BOUNDS: dict[str, tuple[float | None, float | None]] = {\n"
    "    \"default_kerf_mm\": (0.0, None),  # мутация M17\n"
    "    \"vat_rate\": (0.0, 100.0),  # П108\n"
)
open(path, "w", encoding="utf-8").write(text.replace(anchor, addition, 1))
PY
OUT=$(прогон c4 c5 c15); rc=$?
if красный 'границы констант C2 не назначены' "$OUT"; then
  ok "M17: проба границ C2 покраснела (имя константы C2 вписано)"
else bad "M17: проба границ C2 осталась зелёной"; printf '%s\n' "$OUT" | tail -20; fi
зелёный 'С15: границы финансовых констант (тест)' "$OUT" && ok "M17: сосед С15 (границы работают) не тронут" || bad "M17: покраснело лишнее в С15"
[ "$rc" -ne 0 ] && ok "M17: выход приёмки ненулевой (rc=$rc)" || bad "M17: приёмка вернула 0"

# ── M18: код снят из SAVE_ERROR_KEYS → фронт-критерий красный, соседи зелёные ──
# Заход 2a-фронт заменил три текстовые строки («код во frontend_vue/src > 0») на прогон
# спека useSettings.saveErrors. M18 снимает из ПРОДУКТОВОЙ таблицы SAVE_ERROR_KEYS один
# код (CONSTANT_OUT_OF_RANGE): сохранение перестаёт узнавать отказ и кладёт в error текст
# сервера, кейс С15 краснеет, спека выходит ненулевым кодом. Сначала база: без неё
# «красный» не отличался бы от «критерий вообще не бегает на поддельном корне».
echo "── M18: CONSTANT_OUT_OF_RANGE снят из SAVE_ERROR_KEYS → фронт красный ─────"
подготовить
подготовить_фронт
BASE=$(прогон c4); brc=$?
зелёный 'фронт C4/C5/C15: отказ становится переводом' "$BASE" \
  && ok "M18: база — критерий зелёный (мутация валит именно его)" \
  || { bad "M18: база уже красная"; printf '%s\n' "$BASE" | tail -20; }
python3 - "$FAKE/frontend_vue/src/composables/useSettings.ts" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
anchor = "  ['CONSTANT_OUT_OF_RANGE', 'settingsFinance.error_constant_out_of_range'],\n"
assert text.count(anchor) == 1, "якорь M18 не единственен"
open(path, "w", encoding="utf-8").write(text.replace(anchor, "", 1))
PY
OUT=$(прогон c4 c5 c15 c2 c9); rc=$?
if красный 'фронт C4/C5/C15: отказ становится переводом' "$OUT"; then
  ok "M18: фронт-критерий покраснел (код снят из таблицы)"
else bad "M18: фронт-критерий остался зелёным"; printf '%s\n' "$OUT" | tail -25; fi
зелёный 'С4: отказы UOM/валют отвечают кодом (тест)' "$OUT" && ok "M18: сосед С4 зелёный" || bad "M18: покраснело лишнее в С4"
зелёный 'С5: неполный reorder отвергнут кодом (тест)' "$OUT" && ok "M18: сосед С5 (reorder) зелёный" || bad "M18: покраснело лишнее в С5"
зелёный 'С15: границы финансовых констант (тест)' "$OUT" && ok "M18: сосед С15 зелёный" || bad "M18: покраснело лишнее в С15"
зелёный 'часовой пояс' "$OUT" && ok "M18: сосед C2 зелёный" || bad "M18: покраснело лишнее в C2"
зелёный 'П11: ссылка не хранится' "$OUT" && ok "M18: сосед C9 зелёный" || bad "M18: покраснело лишнее в C9"
[ "$rc" -ne 0 ] && ok "M18: выход приёмки ненулевой (rc=$rc)" || bad "M18: приёмка вернула 0"

# ── M19: спека утверждает ТЕКСТ сервера вместо кода → фронт-критерий красный ───
# Ориентир владельца «вернуть в спек утверждение по тексту сервера вместо кода»:
# подменяется ровно сравнение в помощнике спека, продукт не тронут — значит красный
# обязан дать именно критерий, а не сломанный разбор.
echo "── M19: утверждение по тексту сервера вместо перевода → фронт красный ──────"
подготовить
подготовить_фронт
BASE=$(прогон c4); brc=$?
зелёный 'фронт C4/C5/C15: отказ становится переводом' "$BASE" \
  && ok "M19: база — критерий зелёный" \
  || { bad "M19: база уже красная"; printf '%s\n' "$BASE" | tail -20; }
python3 - "$FAKE/frontend_vue/src/composables/useSettings.saveErrors.spec.ts" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
old = "  expect(s.error.value).not.toBe(фраза)\n  expect(s.error.value).toBe(t(key))\n"
new = "  expect(s.error.value).toBe(фраза)  // мутация M19\n"
assert text.count(old) == 1, "якорь M19 не единственен"
open(path, "w", encoding="utf-8").write(text.replace(old, new, 1))
PY
OUT=$(прогон c4 c5 c15 c2 c9); rc=$?
if красный 'фронт C4/C5/C15: отказ становится переводом' "$OUT"; then
  ok "M19: фронт-критерий покраснел (спека ждёт текст сервера, а получает перевод)"
else bad "M19: фронт-критерий остался зелёным"; printf '%s\n' "$OUT" | tail -25; fi
зелёный 'С4: отказы UOM/валют отвечают кодом (тест)' "$OUT" && ok "M19: сосед С4 зелёный" || bad "M19: покраснело лишнее в С4"
зелёный 'С15: границы финансовых констант (тест)' "$OUT" && ok "M19: сосед С15 зелёный" || bad "M19: покраснело лишнее в С15"
зелёный 'часовой пояс' "$OUT" && ok "M19: сосед C2 зелёный" || bad "M19: покраснело лишнее в C2"
зелёный 'П11: ссылка не хранится' "$OUT" && ok "M19: сосед C9 зелёный" || bad "M19: покраснело лишнее в C9"
[ "$rc" -ne 0 ] && ok "M19: выход приёмки ненулевой (rc=$rc)" || bad "M19: приёмка вернула 0"

# ── M20: из спека удалён один кейс → спека ЗЕЛЁНАЯ, но пол «не меньше шести» красный ─
# Это проверка именно ПОЛА, а не «спека упала»: удаляем С15-кейс, остаётся пять
# выполненных тестов, сам спек выходит 0 — и критерий обязан покраснеть на числе.
echo "── M20: удалён один кейс спека → пол «не меньше шести» срабатывает ─────────"
подготовить
подготовить_фронт
python3 - "$FAKE/frontend_vue/src/composables/useSettings.saveErrors.spec.ts" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
block = (
    "describe('С15 · границы финансовых констант: отказ приходит кодом, а показывается фразой', () => {\n"
    "  it('CONSTANT_OUT_OF_RANGE — значение вне диапазона', async () => {\n"
    "    const фраза = 'the boundary was checked elsewhere and refused here'\n"
    "    const s = свежий()\n"
    "    s.updateConstants({ vatRate: 101 })\n"
    "    vi.mocked(settingsService.saveConstants).mockRejectedValue(\n"
    "      отказ('CONSTANT_OUT_OF_RANGE', фраза),\n"
    "    )\n"
    "    await s.save()\n"
    "    ожидать_перевод(s, 'settingsFinance.error_constant_out_of_range', фраза)\n"
    "  })\n"
    "})\n"
)
assert text.count(block) == 1, "якорь M20 не единственен"
open(path, "w", encoding="utf-8").write(text.replace(block, "// мутация M20: кейс С15 удалён\n", 1))
PY
OUT=$(прогон c4 c5 c15 c2 c9); rc=$?
if красный 'выполнено 5, пол 6' "$OUT"; then
  ok "M20: критерий покраснел на числе выполненных (5 < 6), а не на падении спека"
else bad "M20: пол не сработал"; printf '%s\n' "$OUT" | tail -25; fi
зелёный 'С4: отказы UOM/валют отвечают кодом (тест)' "$OUT" && ok "M20: сосед С4 зелёный" || bad "M20: покраснело лишнее в С4"
зелёный 'С5: неполный reorder отвергнут кодом (тест)' "$OUT" && ok "M20: сосед С5 (reorder) зелёный" || bad "M20: покраснело лишнее в С5"
зелёный 'С15: границы финансовых констант (тест)' "$OUT" && ok "M20: сосед С15 зелёный" || bad "M20: покраснело лишнее в С15"
зелёный 'П11: ссылка не хранится' "$OUT" && ok "M20: сосед C9 зелёный" || bad "M20: покраснело лишнее в C9"
[ "$rc" -ne 0 ] && ok "M20: выход приёмки ненулевой (rc=$rc)" || bad "M20: приёмка вернула 0"

echo
echo "══════════════════════════════════════════════════════════════════════"
if [ "$fails" = 0 ]; then
  echo 'Самопроверка сошлась: каждая мутация краснит свой критерий, проза — нет.'
else
  printf 'Самопроверка НЕ сошлась: нарушено ожиданий — %s\n' "$fails"
fi
echo "══════════════════════════════════════════════════════════════════════"
[ "$fails" = 0 ]
