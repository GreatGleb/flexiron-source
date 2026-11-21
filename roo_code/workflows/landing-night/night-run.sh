#!/usr/bin/env bash
# Ночь лендинга Flexiron: ваша учётная запись и вход Claude, этот checkout, своя ветка
# auto/night-landing-<время>, коммит на каждую принятую задачу. Перенос night-run.sh из 3D_website.
#
#   bash roo_code/workflows/landing-night/night-run.sh              # вся очередь
#   bash roo_code/workflows/landing-night/night-run.sh --only L-01  # пробный запуск одной задачи
#   bash roo_code/workflows/landing-night/night-run.sh --resume     # продолжить на текущей ветке auto/night-landing-*
#   python3 roo_code/workflows/landing-night/night.py --dry-run     # что будет выполнено, без запуска
#
# Чтобы ночь пережила закрытие терминала — через systemd пользователя:
#   systemd-run --user --collect --unit=flexiron-landing-night bash ~/PycharmProjects/flexiron-source/roo_code/workflows/landing-night/night-run.sh
#   (ход: journalctl --user -fu flexiron-landing-night)
# Параметры: LANDING_HOURS (7), LANDING_TASK_MINUTES (120), LANDING_MODEL (модель аккаунта по умолчанию),
#   LANDING_NIGHT_SHARE (0.15 — доля недельного лимита на ночь), LANDING_WEEKLY_TOKENS (120000000),
#   LANDING_REVIEW (all | off | L-03,L-06 — где работает приёмщик), LANDING_FIX_ROUNDS (1),
#   LANDING_TASKS (roo_code/plans/landing/tasks.json), PW_PORT (5373 — порт dev-сервера e2e этой ночи).
#
# Отказывается работать в занятом дереве: ночь, начатая поверх чужих правок, заберёт их в свой коммит.
# Отказывается, если порт PW_PORT или PW_PORT+1 занят: Playwright переиспользовал бы чужой сервер.
# На время ночи push отключён (remote.origin.pushurl), после — восстанавливается.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
HERE="$ROOT/roo_code/workflows/landing-night"
STATE_ROOT="${LANDING_NIGHTS:-$HOME/.local/share/flexiron-landing}"
NO_PUSH="no-push://landing-night"
export PW_PORT="${PW_PORT:-5373}"
cd "$ROOT"

resume=0
args=()
for a in "$@"; do
  if [ "$a" = "--resume" ]; then resume=1; else args+=("$a"); fi
done

if [ -n "$(git status --porcelain)" ]; then
  echo "Дерево занято незакоммиченной работой — ночь не начинается (git status)." >&2
  exit 3
fi

for port in "$PW_PORT" "$((PW_PORT + 1))"; do
  if ss -ltn "sport = :$port" 2>/dev/null | grep -q LISTEN; then
    echo "Порт $port занят — Playwright переиспользовал бы чужой dev-сервер. Освободите его или задайте PW_PORT." >&2
    exit 3
  fi
done

if [ ! -d "$ROOT/frontend_vue/node_modules" ]; then
  echo "Нет frontend_vue/node_modules — сначала cd frontend_vue && npm ci (агенту npm install запрещён)." >&2
  exit 3
fi

# Node. Под systemd-run nvm не подключён, и PATH даёт системный /usr/bin/node — на этой машине 18.19,
# где юнит-тесты гейта падают (нет глобального crypto). Так 2026-11-20 заблокированы L-02 и L-03.
# Берём самый новый node из ~/.nvm, если он есть, и не стартуем ниже 20.
nvm_bin="$(ls -d "$HOME"/.nvm/versions/node/v*/bin 2>/dev/null | sort -V | tail -1 || true)"
if [ -n "$nvm_bin" ]; then export PATH="$nvm_bin:$PATH"; fi
node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$node_major" -lt 20 ]; then
  echo "Node $(node -v 2>/dev/null || echo 'не найден') — нужен 20+ (гейт frontend_vue). Поставьте через nvm." >&2
  exit 3
fi

stamp="$(date +%F-%H%M)"
if [ "$resume" = 1 ]; then
  branch="$(git branch --show-current)"
  case "$branch" in auto/night-landing-*) ;; *) echo "--resume — только на ветке auto/night-landing-*" >&2; exit 3 ;; esac
else
  branch="auto/night-landing-$stamp"
  git switch -c "$branch"
fi
out="$STATE_ROOT/night-$stamp"
mkdir -p "$out"

# Push отключён на время ночи; запрет git push у агента — второй рубеж (night.py, DENY).
old_pushurl="$(git config --local --get remote.origin.pushurl || true)"
restore_push() {
  if [ -n "$old_pushurl" ]; then git config --local remote.origin.pushurl "$old_pushurl"
  else git config --local --unset remote.origin.pushurl || true; fi
}
trap restore_push EXIT
git config --local remote.origin.pushurl "$NO_PUSH"

echo "Ночь: ветка $branch, журнал $out, PW_PORT=$PW_PORT, node $(node -v)"
status=0
python3 "$HERE/night.py" --out "$out" --tasks "${LANDING_TASKS:-roo_code/plans/landing/tasks.json}" \
  --hours "${LANDING_HOURS:-7}" --task-minutes "${LANDING_TASK_MINUTES:-120}" \
  --model "${LANDING_MODEL:-}" --night-share "${LANDING_NIGHT_SHARE:-0.15}" \
  --weekly-tokens "${LANDING_WEEKLY_TOKENS:-120000000}" --review "${LANDING_REVIEW:-all}" \
  --fix-rounds "${LANDING_FIX_ROUNDS:-1}" "${args[@]}" 2>&1 | tee -a "$out/night.log" || status=$?
echo "Сводка: $out/СВОДКА.md"
exit "$status"
