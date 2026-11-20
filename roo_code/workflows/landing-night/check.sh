#!/usr/bin/env bash
# Проверка задачи ночи лендинга (вызывает night.py после каждой сессии автора).
#
#   bash check.sh landing   # npm run verify + e2e: navigation, smoke, i18n и tests/e2e/public/
#   bash check.sh full      # npm run verify + полный e2e (задачи с e2e_full: правка общего пола)
#
# Порт dev-сервера — PW_PORT (night-run.sh ставит 5373), чтобы не переиспользовать чужой сервер на 5173:
# у него другое окружение (нет VITE_LANDING_LEADS_URL), и тесты формы проверяли бы не то.
# Вердикт — по коду возврата каждой команды, вывод целиком (verify.md: «Прогон читается по коду возврата»).
set -uo pipefail

mode="${1:-landing}"
cd "$(dirname "${BASH_SOURCE[0]}")/../../../frontend_vue" || exit 2
export PW_PORT="${PW_PORT:-5373}"

echo "== npm run verify"
npm run verify
code=$?
echo "== verify: код $code"
[ "$code" -eq 0 ] || exit 1

if [ "$mode" = full ]; then
  echo "== e2e: полный набор (PW_PORT=$PW_PORT)"
  npx playwright test --reporter=line
else
  specs=(tests/e2e/navigation.spec.ts tests/e2e/smoke.spec.ts tests/e2e/i18n.spec.ts)
  [ -d tests/e2e/public ] && specs+=(tests/e2e/public)
  echo "== e2e: ${specs[*]} (PW_PORT=$PW_PORT)"
  npx playwright test --reporter=line "${specs[@]}"
fi
code=$?
echo "== e2e: код $code"
exit "$code"
