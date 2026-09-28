"""Пауза ночи на пик DeepSeek: посмотреть или переключить на ходу.

    night-peak.py            — режим последней ночи и когда сменится пик
    night-peak.py ignore     — в пик работать (цена вдвое выше)
    night-peak.py pause      — в пик ждать (по умолчанию для ночи)
    --night <каталог>        — не последняя ночь, а эта

Режим — файл `deepseek-peak` в каталоге ночи; `night-run.sh` пишет его на старте из
FLEXIRON_PEAK. Авторы перечитывают его раз в минуту, так что переключение доходит до
идущей ночи без перезапуска. Время показывается и в UTC, и по часам ноутбука.
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import deepseek_tariff as tariff  # noqa: E402


def latest_night(root):
    nights = sorted(p for p in root.glob("night-*") if p.is_dir())
    return nights[-1] if nights else None


def when(moment):
    return f"{moment.astimezone():%d.%m %H:%M} по часам ноутбука ({moment:%H:%M} UTC)"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("mode", nargs="?", choices=tariff.MODES)
    parser.add_argument("--night", type=Path)
    args = parser.parse_args()
    root = Path(os.environ.get("FLEXIRON_NIGHTS", Path.home() / ".local/share/flexiron"))
    night = args.night or latest_night(root)
    if not night or not night.is_dir():
        print(f"Ночей нет в {root}")
        return 2
    mode_file = night / tariff.MODE_FILE
    if args.mode:
        mode_file.write_text(args.mode + "\n")
    now = tariff.utc_now()
    mode = tariff.read_mode(mode_file) if mode_file.is_file() else None
    print(f"Ночь: {night.name}")
    if mode is None:
        print("Режим: файла нет — ночь запущена до пауз на пик, запросы идут всегда")
    else:
        print(f"Режим: {mode} — " + ("в пик запросы к DeepSeek ждут" if mode == "pause" else "в пик запросы идут"))
    change = tariff.next_change(now)
    print(("Сейчас пик, кончится " if tariff.peak(now) else "Сейчас не пик, начнётся ") + when(change))
    # Задачи на паузе: их файл паузы обновляется каждую минуту, пока они ждут.
    for path in sorted(night.glob("run-*/*.aider.pause.json")) + sorted(night.glob("*.aider.pause.json")):
        try:
            data = json.loads(path.read_text())
        except (OSError, ValueError):
            continue
        if data.get("until_utc") and time.time() - path.stat().st_mtime < 180:
            task = path.name.removesuffix("-work.aider.pause.json")
            print(f"  на паузе: {task}, ждёт {data['paused_seconds'] / 60:.0f} мин")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
