#!/usr/bin/env bash
# Одна ночь: своя ветка, свой каталог, своя сводка. Запускается таймером или руками.
#
# Скрипт намеренно отказывается работать в занятом дереве: прогон, начатый поверх
# чужих незакоммиченных правок, заберёт их в свой коммит или спрячет в stash.
set -euo pipefail

repo="${FLEXIRON_REPO:-$HOME/PycharmProjects/flexiron-source}"
routing="${FLEXIRON_ROUTING:-$HOME/.config/flexiron/night-routing.json}"
state_root="${FLEXIRON_NIGHTS:-$HOME/.local/share/flexiron}"

# Продолжение уже начатой ночи — так её поднимает сторож (night-watchdog.py):
#   night-run.sh --resume <каталог ночи> [--retry-review <каталог прогона>]
# Ветка, checkout и параметры — из night.json этой ночи; новой ветки нет.
if [ "${1:-}" = "--resume" ]; then
    out="${2:?нужен каталог ночи}"
    shift 2
    meta="$out/night.json"
    test -f "$meta" || { echo "Нет $meta — продолжать нечего" >&2; exit 2; }
    field() { python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))[sys.argv[2]])' "$meta" "$1"; }
    repo="$(field workspace)"
    branch="$(field branch)"
    if [ "$(git -C "$repo" branch --show-current)" != "$branch" ]; then
        echo "Checkout $repo не на ветке ночи $branch — продолжение не начинается" >&2
        exit 3
    fi
    # Грязное дерево законно только для повтора приёмки: там лежит работа автора.
    if [ "${1:-}" != "--retry-review" ] && [ -n "$(git -C "$repo" status --porcelain)" ]; then
        echo "Дерево занято — продолжение без повтора приёмки не начинается" >&2
        exit 3
    fi
    status=0
    python3 "$repo/roo_code/workflows/night-supervisor.py" --resume --out "$out" "$@" || status=$?
    python3 "$repo/roo_code/workflows/night-report.py" --out "$out" --repo "$repo" \
        > "$out/СВОДКА.md" 2>&1 || true
    echo "Сводка: $out/СВОДКА.md"
    exit "$status"
fi
stamp="$(date +%F-%H%M)"
out="$state_root/night-$stamp"

test -f "$routing" || { echo "Нет файла маршрутизации: $routing" >&2; exit 2; }
test -d "$repo/.git" || { echo "Не репозиторий: $repo" >&2; exit 2; }

if [ -n "$(git -C "$repo" status --porcelain)" ]; then
    echo "Дерево занято чужой работой — ночь не начинается" >&2
    exit 3
fi

git -C "$repo" switch -c "auto/night-$stamp"
mkdir -p "$out"

status=0
python3 "$repo/roo_code/workflows/night-supervisor.py" \
    --workspace "$repo" --routing "$routing" \
    --operator-prompt "$repo/roo_code/workflows/operator-prompt.md" \
    --out "$out" \
    --hours "${FLEXIRON_HOURS:-7}" \
    --token-budget "${FLEXIRON_TOKENS:-26000000}" \
    --max-tasks "${FLEXIRON_BATCH:-5}" \
    --parallel "${FLEXIRON_PARALLEL:-4}" \
    --max-batches "${FLEXIRON_MAX_BATCHES:-8}" \
    --idle-limit "${FLEXIRON_IDLE_LIMIT:-3}" || status=$?

# Сводка пишется при любом исходе: оборванную ночь утром тоже надо читать.
python3 "$repo/roo_code/workflows/night-report.py" --out "$out" --repo "$repo" \
    > "$out/СВОДКА.md" 2>&1 || true
echo "Сводка: $out/СВОДКА.md"
exit "$status"
