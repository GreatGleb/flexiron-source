#!/usr/bin/env bash
# Сайт Flexiron (лендинг + программа) → репозиторий публикации GitHub Pages
# (этап 2 лендинга, SEO — roo_code/plans/landing/landing-stage-2-plan.md, пункт 3).
#
#   bash frontend_vue/scripts/publish-pages.sh            # собрать и скопировать в ../Flexiron-Enterprise
#   bash frontend_vue/scripts/publish-pages.sh --dry-run  # только показать, что изменится
#
# Собирает `npm run build:site` (сборка + заранее отрисованные страницы + sitemap.xml) и
# копирует ../site в корень репозитория публикации. Сохраняются его .git и README.md; всё
# прочее приводится к сборке — старая папка demo/ уходит, её ссылки ловит роутер.
# Коммит и push — человек: скрипт печатает команду, но не выполняет её.
set -euo pipefail

FRONT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE="$FRONT/../site"
TARGET="${PAGES_REPO:-$FRONT/../../Flexiron-Enterprise}"
DRY=""
[ "${1:-}" = "--dry-run" ] && DRY="--dry-run"

if [ ! -d "$TARGET/.git" ]; then
  echo "Нет репозитория публикации: $TARGET (задайте PAGES_REPO)" >&2
  exit 1
fi

(cd "$FRONT" && npm run build:site)
rsync -a --delete $DRY --itemize-changes --exclude '.git' --exclude 'README.md' "$SITE/" "$TARGET/"

if [ -n "$DRY" ]; then
  echo "Это был пробный прогон: в $TARGET ничего не изменено."
else
  echo
  git -C "$TARGET" status --short | head -40
  echo
  echo "Проверьте и опубликуйте:"
  echo "  cd $TARGET && git add -A && git commit -m 'build: сайт Flexiron' && git push"
fi
