"""Сводка прогона: что принято, что забраковано, чем это стоило.

Читает каталог ночи (супервизорский, с порциями, или одиночный каталог прогона) и
печатает короткий отчёт. Ничего не меняет: сводка не имеет права трогать ни репозиторий,
ни журналы, по которым её составляют.
"""

import argparse
import json
from pathlib import Path


def read(path, default=None):
    try:
        return json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return default


def run_lines(run_dir, repo):
    state = read(run_dir / "state.json")
    if state is None:
        return [f"- {run_dir.name}: прогон не оставил состояния — смотреть логи вручную"], 0, 0, 0
    lines = []
    for item in state["completed"]:
        subject = ""
        if repo:
            import subprocess
            try:
                subject = subprocess.check_output(
                    ["git", "-C", str(repo), "show", "-s", "--format=%h %s", item["commit"]],
                    text=True, stderr=subprocess.DEVNULL).strip()
            except subprocess.CalledProcessError:
                subject = item["commit"][:9]
        lines.append(f"  - ✅ {item['task']} — {subject or item['commit'][:9]}")
    for item in state.get("blocked", []):
        reason = (item.get("reason") or "").strip().replace("\n", " ")
        lines.append(f"  - ⛔ {item['task']} (этап {item.get('phase')}) — {reason[:160]}")
        if item.get("archive"):
            lines.append(f"       черновик: {item['archive']}")
    for item in state.get("waiting", []):
        lines.append(f"  - ⏸ {item['task']} — ждёт: {', '.join(item['dependencies'])}")
    journal = (run_dir / "journal.jsonl")
    batches = []
    if journal.is_file():
        for line in journal.read_text().splitlines():
            event = json.loads(line)
            if event.get("event") == "batch":
                batches.append(event.get("batch"))
    if batches:
        lines.append(f"  - пачки авторов: {'; '.join(', '.join(b) for b in batches)}")
    if state.get("reason"):
        lines.append(f"  - остановка: {state['reason'][:200]}")
    return lines, len(state["completed"]), len(state.get("blocked", [])), state.get("tokens", 0)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True, help="Каталог ночи или одного прогона")
    parser.add_argument("--repo", type=Path, help="Checkout, чтобы подписать коммиты")
    args = parser.parse_args()

    supervisor = read(args.out / "supervisor.json")
    runs = sorted(args.out.glob("run-*")) or ([args.out] if (args.out / "state.json").is_file() else [])
    if not runs:
        print(f"В {args.out} нет ни одного прогона")
        return 1

    print(f"# Сводка прогона — {args.out.name}\n")
    accepted = blocked = tokens = 0
    body = []
    for run_dir in runs:
        lines, ok, bad, spent = run_lines(run_dir, args.repo)
        accepted += ok
        blocked += bad
        tokens += spent
        body.append(f"- **{run_dir.name}**: принято {ok}, забраковано {bad}, токенов {spent:,}")
        body.extend(lines)

    print(f"**Итого: принято {accepted}, забраковано {blocked}, токенов {tokens:,}**")
    if supervisor:
        print(f"**Порций оператора: {len(supervisor.get('batches', []))}. "
              f"Остановка: {supervisor.get('stopped')}**")
    print()
    print("\n".join(body))
    watchdog = args.out / "watchdog.jsonl"
    if watchdog.is_file():
        # Что сторож увидел и сделал: без этого утром подъём ночи неотличим от ровной ночи.
        import time
        print("\n## Сторож\n")
        for line in watchdog.read_text().splitlines():
            if not line.strip():
                continue
            entry = json.loads(line)
            stamp = time.strftime("%H:%M", time.localtime(entry.get("time", 0)))
            reason = f" (причина: {entry['причина']})" if entry.get("причина") else ""
            print(f"- {stamp} — {entry.get('увидел')} → {entry.get('сделал')}{reason}")
    if blocked:
        print("\nЗабракованное не потеряно: черновик каждой задачи лежит в архиве прогона "
              "и в git stash — смотреть по путям выше.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
