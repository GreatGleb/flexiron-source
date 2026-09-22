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
#
# Редакция 2026-09-22: критерий, который можно выполнить правкой ПРОЗЫ (докстринга или
# комментария), критерием не считается — два слайса из двух прошли старую редакцию
# именно так (см. вердикты скептика по c2 и c9). Поведение доказывается пробой
# (`проба` / инструмент `проба.py`), а текстовый поиск остаётся только там, где рядом
# стоит письменный довод: перечень такого долга — ниже, после помощников.

set -uo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
# Инструмент проб лежит рядом со скриптом. Пробы исполняются в backend/ и читают
# файлы оттуда, поэтому путь передаётся через окружение, а не вклеивается в код
# проб (так код остаётся в одинарных кавычках и читается как python, а не как bash).
export ACCEPTANCE_PROBE="$HERE/проба.py"

cd "$HERE/../.." || exit 2
ROOT=$(pwd)

# Каталог бэкенда, в котором исполняются пробы, тест П31 и сбор тестов. Это ВСЕГДА
# "$ROOT/backend" — дерево, которое и принимается. Раньше здесь стояло
# ${ACCEPTANCE_BACKEND:-$ROOT/backend}, и слайс, экспортировав эту переменную на
# чистую копию, получал зелёный вердикт на сломанном дереве (F1, 2026-09-22).
# Перенаправления проб больше нет: ни переменной окружения, ни флага — BEND не
# покидает скрипт и выводится только из ROOT. Самопроверка-приёмки.sh обходится без
# этого: она копирует backend и САМ гейт в поддельный корень в /tmp, чтобы "$ROOT"
# гейта указывал на мутированную копию.
BEND="$ROOT/backend"

# ── Доверенное окружение проб (F9, 2026-09-22) ────────────────────────────────
# Пробы, тест П31 и сбор тестов исполняются ОТДЕЛЬНЫМ, ФИКСИРОВАННЫМ окружением, а
# не тем, что досталось гейту от вызывающего. Повод — замер pass 2 (2026-09-22):
# обёртка `python3`, положенная РАНЬШЕ в PATH, отдавала вердикт вместо питона (на
# `-m pytest` выходила 0, на `-c` со словом openapi печатала «3»), так что снятый
# роут и сломанный черновик оставались «зелёными», а PYTHONPATH с sitecustomize.py
# исполнял чужой код на старте интерпретатора. `-B` тут не помогает (гасит только
# .pyc), и cwd=backend тоже: интерпретатор ищется ПО ИМЕНИ в PATH.
# Отсюда: PATH не наследуется (фиксированный список ниже), PYTHONPATH/PYTHONHOME и
# прочие рычаги инъекции сняты (`env -i`), интерпретатор резолвится ОДИН раз и
# только по доверенному PATH, дальше всюду — абсолютный путь, ни одного bare
# `python3`. Пробе оставлено ровно нужное: её cwd (backend → sys.path), доверенный
# PATH, UTF-8-локаль и ACCEPTANCE_PROBE (его ставит сам гейт, а не вызывающий);
# fastapi/httpx/aiosqlite/pytest стоят в user-site и находятся без PYTHONPATH.
# npm/node/git гейт НЕ санирует — признанный остаток (см. «Известный долг»).
TRUSTED_PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
TRUSTED_LOCALE="C.UTF-8"

# резолв ИМЕНИ по доверенному PATH; пусто — это отказ, а не «попробуем иначе»
доверенно() { PATH="$TRUSTED_PATH" command -v "$1" 2>/dev/null; }

# проверка резолва: абсолютный, исполняемый и НЕ в каталоге, открытом вызывающему на
# запись (обёртку в /tmp или в рабочем дереве отсекаем здесь же). Спор «подменить
# интерпретатор» решается падением кодом 2, а не исполнением того, что нашлось.
проверить_интерпретатор() {
  local what=$1 path=$2 real=$3 dir
  if [ -z "$path" ]; then
    printf '  \033[31mПЛОХО\033[0m %s не найден по доверенному PATH %s\n' "$what" "$TRUSTED_PATH" >&2
    exit 2
  fi
  case $path in
    /*) ;;
    *) printf '  \033[31mПЛОХО\033[0m %s разрешился в относительный путь: %s\n' "$what" "$path" >&2; exit 2 ;;
  esac
  if [ ! -x "$path" ]; then
    printf '  \033[31mПЛОХО\033[0m %s не исполняется: %s\n' "$what" "$path" >&2
    exit 2
  fi
  dir=$(PATH="$TRUSTED_PATH" dirname "$real")
  if [ -d "$dir" ] && [ -w "$dir" ]; then
    printf '  \033[31mПЛОХО\033[0m %s (%s → %s) в каталоге, открытом на запись (%s): вердикту доверять нельзя\n' \
      "$what" "$path" "$real" "$dir" >&2
    exit 2
  fi
}

PY=$(доверенно python3)
ENV_BIN=$(доверенно env)
PY_REAL=$(PATH="$TRUSTED_PATH" readlink -f "$PY" 2>/dev/null || printf '%s' "$PY")
ENV_REAL=$(PATH="$TRUSTED_PATH" readlink -f "$ENV_BIN" 2>/dev/null || printf '%s' "$ENV_BIN")
проверить_интерпретатор python3 "$PY" "$PY_REAL"
проверить_интерпретатор env "$ENV_BIN" "$ENV_REAL"

# env_probe — вот ВСЁ окружение пробы, и оно неизменно. `env -i` выбрасывает
# унаследованное целиком (PYTHONPATH/PYTHONHOME/HOME и прочее), затем задаётся
# минимум. env берётся абсолютным ("$ENV_BIN"), чтобы сам `env` нельзя было
# подсунуть обёрткой из PATH. HOME НЕ передаётся намеренно: это рычаг
# sitecustomize.py (HOME=<чужой>/.local/...), а нужен он только для user-site,
# который Python и без него берёт из записи passwd (проверено: pytest/fastapi
# оттуда импортируются при пустом окружении).
env_probe() {
  "$ENV_BIN" -i \
    PATH="$TRUSTED_PATH" \
    LANG="$TRUSTED_LOCALE" LC_ALL="$TRUSTED_LOCALE" \
    ACCEPTANCE_PROBE="$ACCEPTANCE_PROBE" \
    "$@"
}

# видимость резолва: подмена интерпретатора обязана быть ГРОМКОЙ, а не молчаливой.
# Печатается на каждом прогоне, до критериев.
printf '── Пробы: чем исполняются (F9) ────────────────────────────────────────\n'
printf '  python3 : %s → %s\n' "$PY" "$PY_REAL"
printf '  env     : %s\n' "$ENV_BIN"
printf '  PATH проб (фиксированный): %s\n' "$TRUSTED_PATH"
printf '  локаль проб: %s; PYTHONPATH/PYTHONHOME/HOME сняты\n' "$TRUSTED_LOCALE"
printf '  npm (видимость; НЕ санируется): %s\n' "$(command -v npm 2>/dev/null || printf 'не найден')"

# TESTS_BASELINE — ПОЛ числа собранных тестов, а не доказательство роста за слайс.
# Замер 2026-09-21 до работы дал 43; после правки редакции 2026-09-22 (тест П31)
# собрано 45; заход 2a (2026-09-22) добавил 11 тестов отказов
# (test_settings_refusals.py) — собрано 56, пол поднят до 56. Поднимать вручную и
# только ПОСЛЕ того, как новый тест уехал в коммит, — за каждый принятый слайс; иначе
# слайс, снявший настоящий тест и добавивший тривиальный, снова позеленеет. Чего пол
# НЕ умеет: он не отличает настоящий тест от `assert True` и не запрещает слайсу не
# добавить ни одного теста, пока пол не поднят. Это признанная граница — перечень
# долга ниже, под заголовком «известный долг». Снять критерий роста — удалить блок в
# гейте() вместе с этой строкой.
TESTS_BASELINE=56

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

# проба <имя> <ожидание: N | >0> <python-код> — критерий, доказанный ПОВЕДЕНИЕМ.
# Код исполняется в $BEND (= "$ROOT/backend") АБСОЛЮТНЫМ "$PY" (интерпретатор
# резолвлен один раз наверху по доверенному PATH) и в санированном окружении
# (env_probe): ни bare `python3`, ни унаследованный PYTHONPATH до вердикта не
# дотягиваются — это и есть F9. -B обязателен, чтобы проба не писала __pycache__ и
# не сдвигала критерии, считающие файлы. Код печатает ровно одно число; сравнение
# делает та же проверить(), поэтому счётчики, '>0' и формат строки остаются прежними.
# FAIL-CLOSED: ненулевой выход (импорт, исключение) — это ПЛОХО, в рамке и с первой
# строкой stderr. Недоказуемый критерий красный, а не молчаливо зелёный, и никогда не
# откатывается к grep.
проба() {
  local name=$1 want=$2 code=$3 out rc err
  err=$(mktemp)
  out=$( cd "$BEND" && env_probe "$PY" -B -c "$code" 2>"$err" )
  rc=$?
  if [ $rc -ne 0 ]; then
    printf '  \033[31mПЛОХО\033[0m %-54s проба не выполнилась: %s\n' "$name" "$(head -1 "$err")"
    bad=$((bad+1))
  else
    проверить "$name" "$want" "$out"
  fi
  rm -f "$err"
}
# проба_сторож — то же, что проба, но строкой сторожа: зелёной она обязана быть и до
# работы, поэтому слово «СТОРОЖ» в имени отделяет её от критериев прогресса.
проба_сторож() { проба "· $1 (сторож)" "$2" "$3"; }

# число файлов, где встречается образец (grep -rl | wc -l — не grep -rc:
# последний печатает строку на каждый просмотренный файл и покраснеть не может)
файлов() { grep -rl "$1" "${@:2}" 2>/dev/null | wc -l | tr -d ' '; }
вхождений() { local n; n=$(grep -c "$1" "$2" 2>/dev/null | head -1); echo "${n:-0}"; }

# ── Известный долг: критерии на ТЕКСТЕ и признанные границы приёмки ───────────
# Довод владельца (2026-09-22), по которому они здесь названы, а не удалены: для
# части проверок поведенческая проба дороже (нужен прогон vitest или живой запрос) и
# это отдельная работа, а не молчаливое исключение. При следующем проходе начинать
# с них; ссылки — на строки редакции до правки 2026-09-22 (критерии, перечисленные в
# задаче как non-goal, не тронуты):
#   c0, функция c0()     — фронт-моки: вхождения в mocks/*.ts и в спеках. Проба тут —
#                          прогон vitest, он уже стоит в общем гейте.
#   c1, функция c1()     — снятие полей по файлу; доказуемо составом колонок, как это
#                          сделано для C2/C9 ниже.
#   c2, функция c2()     — сторож пагинации (grep -ric по каталогу) и поиск 'logo_url'
#                          по файлам backend/app.
#   c2, строка с logoUrl — сторож 'logo_url|logoUrl' в схемах: текст вместо поля схемы.
#   c4, строка 286       — «код UOM_IN_USE/CURRENCY_* во фронте»: файлов > 0 во
#                          frontend_vue/src. Фронтовая половина — отдельный vitest-спек.
#   c5, строка 293       — «ORDER_STATUS_REORDER_INCOMPLETE фронт»: тот же класс.
#   c15, строка 358      — «CONSTANT_OUT_OF_RANGE во фронте»: тот же класс.
#   гейт, метка          — «не реализован» в settings.md: проза по существу.
#
# Заход 2a (2026-09-22) снял из этого перечня то, что конвертировано в поведение:
# серверные половины c4 (коды по дереву), c5 ('raise ValidationError' по файлу),
# c15 (CONSTANT_OUT_OF_RANGE по дереву) и пробы-строки 282/294/361. Оставшийся текст
# перечислен выше с адресами; «известный долг» без адреса здесь не держится.
#
# Границы, признанные 2026-09-22 (это не текстовый долг, а слабость критерия):
#   • рост тестов в гейте — ПОЛ, а не доказательство роста за слайс: он ловит снятие
#     настоящего теста и подмену его тривиальным (44 < пола 45), но не отличает
#     настоящий тест от `assert True` и не запрещает слайсу не добавить ни одного
#     теста, пока пол не поднят вручную за принятый слайс.
#   • перенаправление проб убрано (F1): ACCEPTANCE_BACKEND больше не читается —
#     вердикт снимается только с "$ROOT/backend" того дерева, где лежит скрипт, и
#     никакой переменной окружения его не навести на чужую копию.
#   • ПОДМЕНА ИНТЕРПРЕТАТОРА закрыта не до конца (F9, 2026-09-22) — что осталось:
#       – user-site (~/.local/lib/python3.12/site-packages) открыт на запись тому же
#         пользователю, что и судья: положенный туда sitecustomize.py исполнится на
#         старте интерпретатора и обойдёт и пробы, и санировку. Закрывается
#         PYTHONNOUSERSITE=1 — но именно в user-site стоят pytest/fastapi/httpx/
#         aiosqlite, и этот флаг краснит ЗДОРОВОЕ дерево (проверено), а born-red гейт
#         запрещён. Нужен venv или разделение пользователей — вне объёма задачи.
#       – npm/node не санируются (`npm run verify`): путь npm только печатается для
#         видимости. Подменённый npm вердикт подделает — вне объёма задачи.
#       – git и coreutils (grep/sed/wc/awk/head/tr/mktemp/rm), которыми считаются
#         ТЕКСТОВЫЕ критерии, резолвятся по имени из PATH вызывающего: обёртка на них
#         подделает текстовые критерии. ПРОБЫ этим не подделать (исполняются "$PY" в
#         `env -i`), и инъекция окружения в пробы закрыта; подмена PATH-утилит — тот
#         же класс «разделение доверия», что и выше, и в объём не входит.
#   • видимость: гейт печатает резолвленный "$PY" (и npm) на каждом прогоне — подмена
#     становится громкой, но НЕ доказывается как невозможная.

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
  # Три константы — состав колонок GlobalConstants, а не строки файла.
  проба "три новые константы" 3 '
from app.modules.settings.shared.models import GlobalConstants
cols = {c.name for c in GlobalConstants.__table__.columns}
print(sum(n in cols for n in ("default_kerf_mm", "payment_deferral_days", "reservation_hold_days")))
'
  # Было: вхождений строки '^    (time_zone|country_code|confirmation_code):' — то есть
  # ТЕКСТ, и 4-пробельная проза в докстринге (или не-mapped_column атрибут) удовлетворяла
  # его так же, как объявление колонки. Теперь это состав колонок CompanyInfo плюс
  # требование «колонки с именем timezone нет»: именно переименованием в time_zone
  # критерий и был обойдён, а старое имя набирало совпадения чужой строкой
  # DateTime(timezone=True).
  проба "часовой пояс, страна, код подтв. + колонки timezone нет" 4 '
from app.modules.settings.shared.models import CompanyInfo
cols = {c.name for c in CompanyInfo.__table__.columns}
print(sum(n in cols for n in ("time_zone", "country_code", "confirmation_code"))
      + (0 if "timezone" in cols else 1))
'
  сторож "пагинация настройкой НЕ стала"    0 "$(grep -ric 'page_size\|pagesize\|per_page' backend/app/modules/settings 2>/dev/null | awk -F: '{s+=$2} END{print s+0}')"
  проверить "логотип хранит id, не ссылку"    0 "$(файлов 'logo_url' backend/app)"
  проба "…а logo_file_id заведён" 1 '
from app.modules.settings.shared.models import CompanyInfo
print(1 if "logo_file_id" in {c.name for c in CompanyInfo.__table__.columns} else 0)
'
  сторож "поле logoUrl в схемах осталось"   '>0' "$(вхождений 'logo_url\|logoUrl' backend/app/modules/settings/features/crud/schemas.py)"
}

c4() {
  echo "── С4 · отказы доходят как коды ──────────────────────────────────────"
  # Было: вхождений 'exception_handler' в main.py > 0 — эту строку набирал и
  # комментарий. Проба смотрит на РЕГИСТРАЦИЮ: app.exception_handlers — карта, по
  # которой Starlette реально матчит исключение, а не текст в файле.
  проба "AppError зарегистрирован в приложении" '>0' '
from app.core.exceptions import AppError
from app.main import app
print(1 if AppError in app.exception_handlers else 0)
'
  # Было: файлов "UOM_IN_USE" (или валютного кода) backend/app > 0 — код в
  # комментарии или докстринге удовлетворял это так же, как настоящий отказ. Теперь
  # это запросы: DELETE получает 409 и свой код в теле (test_settings_refusals.py),
  # включая тенант-скоуп (чужой объект читается как отсутствующий). Ненулевой выход
  # pytest (в том числе «не запустился») — ПЛОХО, как и у пробы.
  echo "  backend: pytest -k отказы UOM/валют  [$PY]"
  ( cd "$BEND" && env_probe "$PY" -B -m pytest tests/modules/settings/test_settings_refusals.py -q -k "uom_in_use or currency_default or currency_in_use or another_tenant" >/tmp/приёмка-c4.txt 2>&1 )
  проверить "С4: отказы UOM/валют отвечают кодом (тест)" 0 "$?"
  local code
  for code in UOM_IN_USE CURRENCY_IN_USE CURRENCY_IS_DEFAULT; do
    проверить "код $code во фронте"           '>0' "$(файлов "$code" frontend_vue/src)"
  done
}

c5() {
  echo "── С5 · валидация тел ────────────────────────────────────────────────"
  # Было: файлов ORDER_STATUS_REORDER_INCOMPLETE backend/app > 0. Теперь PUT reorder
  # с неполным (или чужим) списком получает 422 и код из тела, а полный список —
  # 200: это отделяет «отказ» от «reorder сломан целиком».
  echo "  backend: pytest -k reorder  [$PY]"
  ( cd "$BEND" && env_probe "$PY" -B -m pytest tests/modules/settings/test_settings_refusals.py -q -k reorder >/tmp/приёмка-c5-reorder.txt 2>&1 )
  проверить "С5: неполный reorder отвергнут кодом (тест)" 0 "$?"
  проверить "ORDER_STATUS_REORDER_INCOMPLETE фронт"  '>0' "$(файлов ORDER_STATUS_REORDER_INCOMPLETE frontend_vue/src)"
  # Было: вхождений строки '    order' в schemas.py = 0 — любой другой отступ или
  # упоминание в прозе двигали счётчик. Проба смотрит на СХЕМУ: ни имя поля, ни
  # алиас 'order' у OrderStatusPatchInput не заведены.
  проба "order ушёл из схемы PATCH статуса" 0 '
from app.modules.settings.features.crud.schemas import OrderStatusPatchInput
names = set(OrderStatusPatchInput.model_fields)
aliases = {f.alias for f in OrderStatusPatchInput.model_fields.values() if f.alias}
print(1 if "order" in (names | aliases) else 0)
'
  # Было: вхождений 'raise ValidationError' > 2 — счётчик СТРОК файла, а не поведение.
  # Теперь второй POST той же упорядоченной пары отвечает CONVERSION_PAIR_TAKEN.
  echo "  backend: pytest -k conversion  [$PY]"
  ( cd "$BEND" && env_probe "$PY" -B -m pytest tests/modules/settings/test_settings_refusals.py -q -k conversion >/tmp/приёмка-c5-conversion.txt 2>&1 )
  проверить "С5: дубль пары пересчёта отвергнут (тест)" 0 "$?"
}

c9() {
  echo "── С9 · карта склада ─────────────────────────────────────────────────"
  # Имя таблицы берётся у самой модели, а не из подстроки в файле — иначе критерий
  # зеленел бы на докстринге со словом warehouse_map.
  проба "таблица карты заведена" 1 '
from app.modules.settings.shared.models import WarehouseMap
print(1 if WarehouseMap.__tablename__ == "warehouse_map" else 0)
'
  # П11 «ссылка не хранится» — СТОРОЖ, и он обязан смотреть на схему, а не на текст:
  # старая редакция считала вхождения 'map_url' в файле models.py == 0, и слайс прошёл
  # её правкой докстринга (требование при этом выполнено — обойдён был критерий).
  # Здесь четыре независимых условия: колонки map_url нет, колонки map_file_id и
  # file_metadata есть, и ни одно объявление mapped_column во всём файле не носит имени
  # с map_url (скан — проба.py, AST: комментарии и докстринги в поток токенов не
  # попадают). Проза нерелевантна В ОБЕ СТОРОНЫ: и похвала, и упрёк ссылке в докстринге
  # не двигают ни одно из условий.
  проба_сторож "П11: ссылка не хранится (схема + mapped_column)" 4 '
import os, subprocess, sys
from app.modules.settings.shared.models import WarehouseMap
cols = {c.name for c in WarehouseMap.__table__.columns}
ok = 0 if "map_url" in cols else 1
ok += sum(name in cols for name in ("map_file_id", "file_metadata"))
scan = subprocess.run(
    [sys.executable, "-B", os.environ["ACCEPTANCE_PROBE"],
     "--файл", "app/modules/settings/shared/models.py",
     "--токен", "map_url", "--область", "mapped_column"],
    capture_output=True, text=True)
ok += 1 if scan.returncode == 0 and scan.stdout.strip() == "0" else 0
print(ok)
'
  проба "П11: хранится идентификатор" 1 '
from app.modules.settings.shared.models import WarehouseMap
print(1 if "map_file_id" in {c.name for c in WarehouseMap.__table__.columns} else 0)
'
  # П31 «Save снимает черновик» — утверждение о ПОВЕДЕНИИ, поэтому доказывается тестом,
  # а не поиском 'is_draft' по файлам: одно из трёх совпадений старой редакции было
  # прозой в докстринге models.py, и снятие самого UPDATE в repository.py оставляло
  # критерий зелёным. Ненулевой код (в том числе «pytest не запустился») — ПЛОХО.
  echo "  backend: pytest tests/modules/settings/test_warehouse_map_draft.py  [$PY]"
  ( cd "$BEND" && env_probe "$PY" -B -m pytest tests/modules/settings/test_warehouse_map_draft.py -q >/tmp/приёмка-черновик.txt 2>&1 )
  проверить "П31: Save снимает черновик (тест)" 0 "$?"
  # Три роута: доказательство ДОСТУПНОСТИ, а не число строк '@router' в тексте.
  # app.routes в этой версии FastAPI врёт (ленивые _IncludedRouter, path = None) —
  # считаем по app.openapi()['paths'] (roo_code/skills/verify.md:388-390). Пути и
  # методы сверены с action.py:37/55/82 и регистрацией в main.py:47-49.
  проба "три роута карты (openapi)" 3 '
from app.main import app
paths = app.openapi()["paths"]
want = (("get", "/api/settings/warehouse-map"),
        ("put", "/api/settings/warehouse-map"),
        ("delete", "/api/settings/warehouse-map"))
print(sum(1 for method, path in want if path in paths and method in paths[path]))
'
}

c15() {
  echo "── С15 · границы финансовых констант (объём сужен) ───────────────────"
  # Было: файлов "CONSTANT_OUT_OF_RANGE" backend/app > 0 — строка в комментарии
  # проходила так же, как работающая граница. Теперь PATCH за границей отвечает 422
  # с кодом, ГРАНИЧНЫЕ значения (по CONSTANT_BOUNDS) проходят, а скаляр без границы
  # не отвергается: это и есть разница между «код есть» и «граница работает».
  # Ненулевой выход pytest (в том числе «не запустился») — ПЛОХО.
  echo "  backend: pytest -k constant  [$PY]"
  ( cd "$BEND" && env_probe "$PY" -B -m pytest tests/modules/settings/test_settings_refusals.py -q -k constant >/tmp/приёмка-c15.txt 2>&1 )
  проверить "С15: границы финансовых констант (тест)" 0 "$?"
  проверить "CONSTANT_OUT_OF_RANGE во фронте"   '>0' "$(файлов CONSTANT_OUT_OF_RANGE frontend_vue/src)"
  проверить "…и в контракте, с числами"         '>0' "$(вхождений 'CONSTANT_OUT_OF_RANGE' roo_code/roo-context/api/settings.md)"
  # границы трёх констант C2 владелец НЕ назначал — назначить их самому запрещено.
  # Было: вхождений имён по domain.py = 0 — имя в комментарии рядом со словарём
  # набирало счётчик. Проба смотрит на КЛЮЧИ самого CONSTANT_BOUNDS.
  проба "границы констант C2 не назначены" 0 '
from app.modules.settings.features.crud.domain import CONSTANT_BOUNDS
c2 = {"default_kerf_mm", "payment_deferral_days", "reservation_hold_days"}
print(len(set(CONSTANT_BOUNDS) & c2))
'
}

гейт() {
  echo "── Общий гейт ────────────────────────────────────────────────────────"
  echo "  frontend: npm run verify"
  ( cd frontend_vue && npm run verify >/tmp/приёмка-verify.txt 2>&1 )
  проверить "npm run verify" 0 "$?"
  echo "  backend: pytest  [$PY]"
  ( cd backend && env_probe "$PY" -m pytest tests -q >/tmp/приёмка-pytest.txt 2>&1 )
  проверить "pytest tests" 0 "$?"
  echo "  backend: приложение импортируется"
  ( cd backend && env_probe "$PY" -c 'from app.main import app' >/dev/null 2>&1 )
  проверить "import app.main" 0 "$?"
  # метка контракта снимается той же задачей, что и слайс
  проверить "settings.md: 'не реализован' убывает от 4" '>0' \
    "$(( $(grep -cE 'Бэкенд: (\*\*)?не реализован' roo_code/roo-context/api/settings.md) < 4 ? 1 : 0 ))"

  # ── Критерий роста тестов: ПОЛ, а не доказательство роста ──────────────────
  # Зачем: семь слайсов и шесть новых эндпоинтов не добавили ни одного теста, а
  # «pytest зелёный» этого различить не может. Считается СОБРАННОЕ число тестов, и
  # оно печатается в самой строке критерия. Пусто (набор не собрался) = 0 = красный:
  # критерий fail-closed, как и проба.
  # ЧТО ЭТО НА САМОМ ДЕЛЕ: пол. Он доказывает лишь «тестов не меньше, чем на
  # последнем принятом слайсе» — пол поднимается ВРУЧНУЮ (TESTS_BASELINE наверху) за
  # каждый принятый слайс. Слайс, не добавивший ни одного теста, пол ПОКА пройдёт: пол
  # не отличает настоящий тест от `assert True`. Это признанная граница (см.
  # «известный долг»), а не доказательство роста за слайс.
  # Изолированный блок: снять его — удалить эти строки и TESTS_BASELINE наверху.
  local collected
  collected=$( cd "$BEND" && env_probe "$PY" -B -m pytest tests -q --collect-only 2>/dev/null | sed -n 's/^\([0-9]\+\) tests\? collected.*/\1/p' | tail -1 )
  проверить "тестов не меньше пола $TESTS_BASELINE (пол за принятый слайс; собрано ${collected:-0})" '>0' "$(( ${collected:-0} >= TESTS_BASELINE ? 1 : 0 ))"
}

if [ $# -gt 0 ]; then
  # Селектор — это определённая функция ЭТОГО файла. Незнакомец (опечатка или
  # враждебный диспетчер) раньше давал «command not found», НОЛЬ критериев и ЗЕЛЁНЫЙ
  # вердикт (F2, 2026-09-22): отсутствие доказательства выдавалось за доказательство.
  # Теперь это ПЛОХО и код 2. Намеренных ненулевых веток, кроме итогового
  # `exit = [ "$bad" = 0 ]`, ровно две: эта и отказ от недоверенного интерпретатора
  # (проверить_интерпретатор наверху, F9) — обе означают «вердикту нет доказательства».
  before=$((ok+bad))
  for s in "$@"; do
    if ! declare -F "$s" >/dev/null; then
      printf '  \033[31mПЛОХО\033[0m неизвестный слайс: %s\n' "$s"
      exit 2
    fi
    "$s"
  done
  # Набор ВАЛИДНЫХ селекторов, не выполнивший ни одного критерия, — тот же случай:
  # ноль доказательств. Та же строка ПЛОХО и тот же код 2.
  if [ $((ok+bad)) -eq "$before" ]; then
    printf '  \033[31mПЛОХО\033[0m селекторы не выполнили ни одного критерия: %s\n' "$*"
    exit 2
  fi
else
  c0; c1; c2; c4; c5; c9; c15; гейт
fi

echo
echo "══════════════════════════════════════════════════════════════════════"
printf 'Сошлось: %s   Не сошлось: %s\n' "$ok" "$bad"
[ "$bad" = 0 ] || echo 'НЕ ГОТОВО. Несошедшийся критерий — это невыполненная работа, а не придирка.'
echo "══════════════════════════════════════════════════════════════════════"
[ "$bad" = 0 ]
