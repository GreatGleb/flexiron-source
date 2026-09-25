#!/usr/bin/env bash
# Одна ночь: своя ветка, свой каталог, своя сводка. Запускается таймером или руками.
#
# Скрипт намеренно отказывается работать в занятом дереве: прогон, начатый поверх
# чужих незакоммиченных правок, заберёт их в свой коммит или спрячет в stash.
set -euo pipefail

repo="${FLEXIRON_REPO:-$HOME/PycharmProjects/flexiron-source}"
routing="${FLEXIRON_ROUTING:-$HOME/.config/flexiron/night-routing.json}"
state_root="${FLEXIRON_NIGHTS:-$HOME/.local/share/flexiron}"
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
