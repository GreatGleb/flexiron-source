#!/usr/bin/env bash
# Машинная приёмка ночных задач 2026-09-21.
#
# Зачем скрипт, а не список команд в брифе: ночь идёт через Zoo Code, то есть
# исполнителя запускает человек, а не контроллер. Слово модели «сделано» ничем не
# обеспечено — обеспечивает его этот файл. Гонять после КАЖДОЙ задачи, а не в конце.
#
#   ./приёмка.sh            — все слайсы плюс общий гейт
#   ./приёмка.sh c0 c1      — только названные слайсы, без общего гейта
#
# Каждый критерий взят из `roo_code/plans/settings/settings-backend-plan.md`, раздел 7,
# и ЗАМЕРЕН КРАСНЫМ 2026-09-21 до начала работы. Критерий, зелёный до начала работы,
# критерием не является (правило того же раздела) — если строка зелёная на чистом
# дереве, это дефект скрипта, а не выполненная работа.

set -uo pipefail
cd "$(dirname "$0")/../.." || exit 2
ROOT=$(pwd)

ok=0; bad=0

# сторож <имя> … — критерий, который зелен и ДО работы: он охраняет значение от
# регресса, а не отмечает прогресс. Печатается словом «СТОРОЖ», чтобы зелёная строка
# сторожа не читалась как выполненная работа (правило «зелёный до начала — не критерий»
# относится к критериям прогресса, а сторож по смыслу обязан быть зелёным всегда).
сторож() { проверить "· $1 (сторож)" "$2" "$3"; }

# проверить <имя> <ожидание: N | >0> <фактическое число>
проверить() {
  local name=$1 want=$2 got=$3 good=0
  case $want in
    '>0') [ "$got" -gt 0 ] && good=1 ;;
    *)    [ "$got" = "$want" ] && good=1 ;;
  esac
  if [ $good = 1 ]; then
    printf '  \033[32mOK  \033[0m %-54s ждали %-4s получили %s\n' "$name" "$want" "$got"; ok=$((ok+1))
  else
    printf '  \033[31mПЛОХО\033[0m %-54s ждали %-4s получили %s\n' "$name" "$want" "$got"; bad=$((bad+1))
  fi
}

# число файлов, где встречается образец (grep -rl | wc -l — не grep -rc:
# последний печатает строку на каждый просмотренный файл и покраснеть не может)
файлов() { grep -rl "$1" "${@:2}" 2>/dev/null | wc -l | tr -d ' '; }
вхождений() { local n; n=$(grep -c "$1" "$2" 2>/dev/null | head -1); echo "${n:-0}"; }

c0() {
  echo "── С0 · мок-долг домена ──────────────────────────────────────────────"
  проверить "броски-строки сняты (mocks/settings.ts)" 0 "$(вхождений 'throw new Error(' frontend_vue/src/services/mocks/settings.ts)"
  проверить "спека почты утверждает поле, не текст"   0 "$(вхождений 'toThrow' frontend_vue/src/services/mocks/mail-settings.spec.ts)"
  проверить "спека карты утверждает поле, не текст"   0 "$(вхождений 'toThrow' frontend_vue/src/services/mocks/warehouse-map.spec.ts)"
  # на месте снятых toThrow обязано появиться утверждение О ПОЛЕ, иначе спека
  # перестала проверять отказ вовсе — это Л9, а не выполненная работа
  проверить "…и на их месте есть утверждение о поле"  '>0' "$(( $(вхождений 'errorCode\|\.code' frontend_vue/src/services/mocks/mail-settings.spec.ts) + $(вхождений 'errorCode\|\.code' frontend_vue/src/services/mocks/warehouse-map.spec.ts) ))"
  проверить "смена пароля перестала быть no-op"       0 "$(вхождений 'no-op mock' frontend_vue/src/services/mocks/index.ts)"
  проверить "три кода пароля заведены в моке"         '>0' "$(вхождений 'PASSWORD_WRONG_CURRENT\|PASSWORD_TOO_SHORT\|PASSWORD_CONFIRM_MISMATCH' frontend_vue/src/services/mocks/index.ts)"
  проверить "мёртвые ветки GET/PUT /api/settings сняты" 0 "$(вхождений "'/api/settings'" frontend_vue/src/services/mocks/index.ts)"
  проверить "дубль пары единиц отвергается"           '>0' "$(вхождений 'CONVERSION_PAIR_TAKEN' frontend_vue/src/services/mocks/settings.ts)"
  # чужой домен задача не трогает
  сторож "bcc.ts остался нетронут"                  0 "$(cd "$ROOT" && git diff --name-only HEAD -- frontend_vue/src/services/mocks/bcc.ts | wc -l | tr -d ' ')"
}

c1() {
  echo "── С1 · схема: снятие лишнего ────────────────────────────────────────"
  проверить "exchange_rate снят из модели"    0 "$(вхождений 'exchange_rate' backend/app/modules/settings/shared/models.py)"
  проверить "exchange_rate снят из схем"      0 "$(вхождений 'exchange_rate' backend/app/modules/settings/features/crud/schemas.py)"
  проверить "RESTRICT у правил пересчёта"     2 "$(вхождений 'ForeignKey("uoms.id", ondelete="RESTRICT")' backend/app/modules/settings/shared/models.py)"
  проверить "default_currency не хранится"    0 "$(вхождений 'default_currency' backend/app/modules/settings/shared/models.py)"
}

c2() {
  echo "── С2 · схема: новые поля ────────────────────────────────────────────"
  проверить "три новые константы"             3 "$(вхождений 'default_kerf_mm\|payment_deferral_days\|reservation_hold_days' backend/app/modules/settings/shared/models.py)"
  проверить "часовой пояс, страна, код подтв." 3 "$(вхождений 'timezone\|country_code\|confirmation_code' backend/app/modules/settings/shared/models.py)"
  сторож "пагинация настройкой НЕ стала"    0 "$(grep -ric 'page_size\|pagesize\|per_page' backend/app/modules/settings 2>/dev/null | awk -F: '{s+=$2} END{print s+0}')"
  проверить "логотип хранит id, не ссылку"    0 "$(файлов 'logo_url' backend/app)"
  проверить "…а logo_file_id заведён"         '>0' "$(вхождений 'logo_file_id' backend/app/modules/settings/shared/models.py)"
  сторож "поле logoUrl в схемах осталось"   '>0' "$(вхождений 'logo_url\|logoUrl' backend/app/modules/settings/features/crud/schemas.py)"
}

c4() {
  echo "── С4 · отказы доходят как коды ──────────────────────────────────────"
  проверить "глобальный обработчик AppError"  '>0' "$(вхождений 'exception_handler' backend/app/main.py)"
  local code
  for code in UOM_IN_USE CURRENCY_IN_USE CURRENCY_IS_DEFAULT; do
    проверить "код $code на сервере"          '>0' "$(файлов "$code" backend/app)"
    проверить "код $code во фронте"           '>0' "$(файлов "$code" frontend_vue/src)"
  done
}

c5() {
  echo "── С5 · валидация тел ────────────────────────────────────────────────"
  проверить "ORDER_STATUS_REORDER_INCOMPLETE сервер" '>0' "$(файлов ORDER_STATUS_REORDER_INCOMPLETE backend/app)"
  проверить "ORDER_STATUS_REORDER_INCOMPLETE фронт"  '>0' "$(файлов ORDER_STATUS_REORDER_INCOMPLETE frontend_vue/src)"
  проверить "order ушёл из схемы PATCH статуса"      0   "$(вхождений '    order' backend/app/modules/settings/features/crud/schemas.py)"
  # было две — значит критерий требует РОСТА, а не просто наличия
  local n; n=$(вхождений 'raise ValidationError' backend/app/modules/settings/features/crud/domain.py)
  проверить "проверок стало больше прежних двух"     '>0' "$(( n > 2 ? 1 : 0 ))"
}

c9() {
  echo "── С9 · карта склада ─────────────────────────────────────────────────"
  проверить "таблица карты заведена"          '>0' "$(вхождений 'warehouse_map' backend/app/modules/settings/shared/models.py)"
  сторож "П11: ссылка не хранится"          0   "$(вхождений 'map_url' backend/app/modules/settings/shared/models.py)"
  проверить "П11: хранится идентификатор"     '>0' "$(вхождений 'map_file_id' backend/app/modules/settings/shared/models.py)"
  проверить "П31: Save снимает черновик"      '>0' "$(файлов 'is_draft' backend/app/modules/settings)"
  проверить "три роута карты"                 3   "$(вхождений '@router' backend/app/modules/settings/features/warehouse_map/action.py)"
}

c15() {
  echo "── С15 · границы финансовых констант (объём сужен) ───────────────────"
  проверить "CONSTANT_OUT_OF_RANGE на сервере"  '>0' "$(файлов CONSTANT_OUT_OF_RANGE backend/app)"
  проверить "CONSTANT_OUT_OF_RANGE во фронте"   '>0' "$(файлов CONSTANT_OUT_OF_RANGE frontend_vue/src)"
  проверить "…и в контракте, с числами"         '>0' "$(вхождений 'CONSTANT_OUT_OF_RANGE' roo_code/roo-context/api/settings.md)"
  # границы трёх констант C2 владелец НЕ назначал — назначить их самому запрещено
  сторож "границы констант C2 не назначены"      0   "$(вхождений 'default_kerf_mm\|payment_deferral_days\|reservation_hold_days' backend/app/modules/settings/features/crud/domain.py)"
}

гейт() {
  echo "── Общий гейт ────────────────────────────────────────────────────────"
  echo "  frontend: npm run verify"
  ( cd frontend_vue && npm run verify >/tmp/приёмка-verify.txt 2>&1 )
  проверить "npm run verify" 0 "$?"
  echo "  backend: pytest"
  ( cd backend && python3 -m pytest tests -q >/tmp/приёмка-pytest.txt 2>&1 )
  проверить "pytest tests" 0 "$?"
  echo "  backend: приложение импортируется"
  ( cd backend && python3 -c 'from app.main import app' >/dev/null 2>&1 )
  проверить "import app.main" 0 "$?"
  # метка контракта снимается той же задачей, что и слайс
  проверить "settings.md: 'не реализован' убывает от 4" '>0' \
    "$(( $(grep -cE 'Бэкенд: (\*\*)?не реализован' roo_code/roo-context/api/settings.md) < 4 ? 1 : 0 ))"
}

if [ $# -gt 0 ]; then
  for s in "$@"; do "$s"; done
else
  c0; c1; c2; c4; c5; c9; c15; гейт
fi

echo
echo "══════════════════════════════════════════════════════════════════════"
printf 'Сошлось: %s   Не сошлось: %s\n' "$ok" "$bad"
[ "$bad" = 0 ] || echo 'НЕ ГОТОВО. Несошедшийся критерий — это невыполненная работа, а не придирка.'
echo "══════════════════════════════════════════════════════════════════════"
[ "$bad" = 0 ]
