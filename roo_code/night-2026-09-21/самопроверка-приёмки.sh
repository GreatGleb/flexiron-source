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

echo
echo "══════════════════════════════════════════════════════════════════════"
if [ "$fails" = 0 ]; then
  echo 'Самопроверка сошлась: каждая мутация краснит свой критерий, проза — нет.'
else
  printf 'Самопроверка НЕ сошлась: нарушено ожиданий — %s\n' "$fails"
fi
echo "══════════════════════════════════════════════════════════════════════"
[ "$fails" = 0 ]
