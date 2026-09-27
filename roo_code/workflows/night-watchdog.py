#!/usr/bin/env python3
"""Сторож ночи: раз в 15 минут смотрит на последнюю ночь и лечит то, что умеет.

Ночь 2026-09-27-0224 стояла с 05:27 до утра: ядро упало на разборе ответа приёмщика, и
этого никто не заметил. Ночь 2026-09-27-0940 кончилась на второй порции из-за упавшего
автора — тоже в тишине. Сторож нужен не для того, чтобы ночь была умнее, а чтобы
остановка без причины длилась пятнадцать минут, а не шесть часов.

Известные поломки лечатся без модели:
- ядро остановилось на задаче, а её работа лежит в checkout и годна к повтору
  приёмки (`codex-night.py --retry-review`, так спасена задача 27.09, `ca99fd1`) —
  повтор, затем продолжение ночи на оставшееся время;
- супервизор умер, дерево чистое — продолжение ночи на оставшееся время.

Неизвестная поломка — headless Claude Code с логами: причина, правка с тестом. Не
справился — работа задачи прячется в архив и stash, ночь идёт без неё.

Каждое действие — строкой в `watchdog.jsonl` каталога ночи; сводка ночи её печатает.
Сторож не мержит, не пушит и не меняет срок ночи: срок назначил владелец при старте.
"""

import argparse
from contextlib import contextmanager
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import tarfile
import time

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from headless_backends import ClaudeBackend  # noqa: E402

# Замер ночей 26–27.09: журнал ядра молчит до 32.8 мин внутри законной пачки (автор
# пишет, событий нет), оператор — до 11 мин. Порог 30 по журналу поднимал бы ложную
# тревогу на здоровой ночи. Поэтому тишина — это отсутствие изменений ЛЮБОГО файла
# каталога ночи (лог aider, чат, worktree автора), а не только журнала, и порог с
# запасом над самым долгим замеренным промежутком.
SILENCE_MINUTES = 45
# Две порции подряд без принятых задач — уже не невезение, а повод посмотреть.
IDLE_BATCHES = 2
# Сколько раз за ночь сторож её поднимает. Поломка, которую продолжение не лечит,
# иначе жгла бы оператора (8–11 мин и токены) каждые 15 минут до утра.
MAX_HEALS = 4
# Меньше этого до срока — поднимать нечего: супервизор сам не начинает порцию,
# когда осталось 10 минут.
MIN_MINUTES_LEFT = 15
CLAUDE_TIMEOUT = 40 * 60
# Файл в каталоге ночи, которым владелец выключает сторожа для этой ночи.
OFF = "сторож-выключен"
NORMAL_FINISH = ("время вышло", "потолок токенов", "порции кончились", "порций подряд без принятых задач")
SIGNAL_STOP = "Получен сигнал остановки"


def read(path, default=None):
    try:
        return json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return default


def run_number(path):
    match = re.fullmatch(r"run-(\d+)", path.name)
    return int(match.group(1)) if match else -1


def latest_night(nights):
    found = sorted(p for p in nights.glob("night-*") if (p / "night.json").is_file())
    return found[-1] if found else None


def last_run(night):
    runs = sorted((p for p in night.glob("run-*") if run_number(p) >= 0), key=run_number)
    return runs[-1] if runs else None


def newest_activity(night):
    """Время последнего изменения чего угодно в каталоге ночи, кроме копий зависимостей.

    Файлы самого сторожа не в счёт: его замок и журнал обновляются каждым обходом, и
    ночь с ними не замолчала бы никогда. По той же причине не в счёт mtime каталогов —
    создание файла сторожем сдвигает mtime каталога ночи.
    """
    newest = 0.0
    for folder, dirs, files in os.walk(night):
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".git") and not d.startswith("watchdog")]
        for name in files:
            if name.startswith("watchdog"):
                continue
            try:
                newest = max(newest, os.stat(os.path.join(folder, name)).st_mtime)
            except OSError:
                pass
    return newest


def idle_streak(report):
    streak = 0
    for batch in reversed((report or {}).get("batches", [])):
        if batch.get("completed"):
            break
        streak += 1
    return streak


class Journal:
    def __init__(self, night):
        self.path = night / "watchdog.jsonl"

    def entries(self):
        if not self.path.is_file():
            return []
        return [json.loads(line) for line in self.path.read_text().splitlines() if line.strip()]

    def seen(self, key):
        return any(e.get("ключ") == key for e in self.entries())

    def heals(self):
        return sum(1 for e in self.entries() if e.get("лечение"))

    def write(self, saw, did, **extra):
        entry = {"time": time.time(), "увидел": saw, "сделал": did, **extra}
        with self.path.open("a") as stream:
            stream.write(json.dumps(entry, ensure_ascii=False) + "\n")
        print(f"сторож: {saw} → {did}", flush=True)
        return entry


class World:
    """Всё, чем сторож трогает машину. В тестах подменяется целиком."""

    def __init__(self, launch_mode="auto", claude_timeout=CLAUDE_TIMEOUT):
        self.launch_mode = launch_mode
        self.claude_timeout = claude_timeout

    def now(self):
        return time.time()

    def supervisor_alive(self, pid):
        try:
            cmdline = Path(f"/proc/{pid}/cmdline").read_bytes()
        except OSError:
            return False
        # pid мог достаться другому процессу — живой считается только наш супервизор.
        return b"night-supervisor.py" in cmdline

    def night_processes(self, workspace, night):
        """Процессы, которые ещё работают на эту ночь: ядро, авторы, продолжение."""
        found = []
        for entry in Path("/proc").iterdir():
            if not entry.name.isdigit() or int(entry.name) == os.getpid():
                continue
            try:
                args = entry.joinpath("cmdline").read_bytes().decode(errors="replace").split("\0")
            except OSError:
                continue
            core = any(a.endswith("codex-night.py") for a in args) and str(workspace) in args
            if core or any(str(night) in a for a in args):
                found.append(int(entry.name))
        return found

    def tree_dirty(self, workspace):
        return bool(subprocess.check_output(["git", "-C", str(workspace), "status", "--porcelain"],
                                            text=True).strip())

    def retry_ok(self, workspace, run_dir, routing):
        """Годна ли остановка к повтору приёмки — спрашиваем само ядро, без модели.

        Без `--run` ядро делает только preflight и сверку контрольной точки: HEAD как при
        остановке, изменения внутри outputs задачи, у автора `done`. Своя копия этих
        правил в стороже разошлась бы с ядром при первой же правке.
        """
        result = subprocess.run([sys.executable, str(Path(workspace) / "roo_code/workflows/codex-night.py"),
                                 "--workspace", str(workspace), "--queue", str(run_dir / "queue.json"),
                                 "--routing", str(routing), "--retry-review", str(run_dir)],
                                capture_output=True, text=True)
        return result.returncode == 0, (result.stderr or result.stdout).strip()[-400:]

    def launch(self, night, meta, retry, number):
        script = Path(meta["workspace"]) / "roo_code/workflows/night-run.sh"
        argv = ["bash", str(script), "--resume", str(night)]
        if retry:
            argv += ["--retry-review", str(retry)]
        log = night / f"watchdog-launch-{number}.log"
        if self.launch_mode == "systemd" or (self.launch_mode == "auto" and shutil.which("systemd-run")):
            # Отдельный юнит: дочерний процесс службы сторожа systemd убил бы вместе с ней.
            subprocess.run(["systemd-run", "--user", "--collect", "--quiet",
                            f"--unit=flexiron-night-resume-{night.name}-{number}",
                            f"--setenv=PATH={os.environ.get('PATH', '')}",
                            "-p", f"StandardOutput=append:{log}", "-p", f"StandardError=append:{log}",
                            *argv], check=True)
        else:
            with log.open("ab") as out:
                subprocess.Popen(argv, stdin=subprocess.DEVNULL, stdout=out, stderr=subprocess.STDOUT,
                                 start_new_session=True)
        return log

    def terminate(self, pids):
        for pid in pids:
            try:
                os.kill(pid, signal.SIGTERM)
            except ProcessLookupError:
                pass

    def park(self, workspace, night, number):
        """Снять работу задачи из checkout, не потеряв её: архив вне checkout и stash."""
        workspace = Path(workspace)
        archive = night / f"watchdog-parked-{number}"
        archive.mkdir()
        (archive / "changes.patch").write_bytes(subprocess.check_output(
            ["git", "-C", str(workspace), "diff", "--binary", "HEAD"]))
        names = subprocess.check_output(["git", "-C", str(workspace), "status", "--porcelain", "-z",
                                         "--untracked-files=all"], text=True).split("\0")
        with tarfile.open(archive / "files.tar", "w", dereference=False) as tar:
            for line in filter(None, names):
                path = workspace / line[3:]
                if path.exists() or path.is_symlink():
                    tar.add(path, arcname=line[3:], recursive=False)
        subprocess.run(["git", "-C", str(workspace), "stash", "push", "--include-untracked", "-m",
                        f"night-watchdog parked: {night}"], check=True, capture_output=True)
        stash = subprocess.check_output(["git", "-C", str(workspace), "rev-parse", "refs/stash"],
                                        text=True).strip()
        (archive / "stash.txt").write_text(stash + "\n")
        return archive, stash

    def ask_claude(self, night, meta, saw, detail, number):
        routing = read(Path(meta["routing"]), {}) or {}
        review = routing.get("review", {}) if routing.get("review", {}).get("backend") == "claude" else {}
        backend = ClaudeBackend({"model": meta.get("operator_model") or review.get("model"),
                                 **({"binary": meta["operator_binary"]} if meta.get("operator_binary")
                                    else {"binary": review["binary"]} if review.get("binary") else {})})
        prefix = night / f"watchdog-claude-{number}"
        workspace = Path(meta["workspace"])
        argv = backend.build("work", workspace, night, prefix.with_suffix(".json")) + ["--add-dir", str(night)]
        prompt = claude_prompt(night, meta, saw, detail)
        prefix.with_suffix(".prompt.txt").write_text(prompt)
        with prefix.with_suffix(".stdout.log").open("wb") as out, \
                prefix.with_suffix(".stderr.log").open("wb") as err:
            try:
                subprocess.run(argv, input=prompt.encode(), stdout=out, stderr=err, cwd=workspace,
                               timeout=self.claude_timeout, check=True)
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as error:
                return {"status": "failed", "summary": f"сессия Claude не отработала: {error}"[:300]}
        return claude_verdict(prefix.with_suffix(".stdout.log"))


def claude_prompt(night, meta, saw, detail):
    return (
        "Ты — ремонтник ночного автономного прогона Flexiron. Человека нет, спрашивать некого.\n"
        f"Беда: {saw}.\nПодробности: {detail}\n"
        f"Каталог ночи (логи, state.json, journal.jsonl прогонов run-N): {night}\n"
        f"Checkout ночи: {meta['workspace']} (ветка {meta['branch']}).\n"
        "Сделай:\n"
        "1. Найди причину по логам и коду roo_code/workflows/.\n"
        "2. Если причина — дефект кода прогона: исправь его в checkout ночи, добавь тест, "
        "прогони тесты этого файла, закоммить ТОЛЬКО свои файлы (`git commit -- <файлы>`). "
        "Незакоммиченную работу задачи в checkout не трогай, не прячь и не удаляй.\n"
        "3. Если процессы ночи повисли — гаси их по PID (`kill <pid>`), НЕ `pkill -f`: "
        "шаблон совпадёт с твоей же оболочкой.\n"
        "Запрещено: merge, push, rebase, reset, смена ветки, правка файлов вне roo_code/workflows/ "
        "(кроме каталога ночи), запуск ночи — её поднимет сторож после тебя.\n"
        "Последней строкой ответа верни JSON: "
        '{"status": "fixed" | "failed", "summary": "причина и что сделано, коротко"}\n')


def claude_verdict(stdout_log):
    try:
        text = json.loads(stdout_log.read_text()).get("result", "")
    except (OSError, json.JSONDecodeError, AttributeError):
        return {"status": "failed", "summary": "Claude не вернул разборный вывод сессии"}
    # Ответ ищется с конца: перед JSON модель могла написать рассуждение (как у приёмщика, 01c21dd).
    for match in reversed(list(re.finditer(r"\{[^{}]*\}", text or ""))):
        try:
            verdict = json.loads(match.group(0))
        except json.JSONDecodeError:
            continue
        if verdict.get("status") in ("fixed", "failed"):
            return {"status": verdict["status"], "summary": str(verdict.get("summary", ""))[:300]}
    return {"status": "failed", "summary": f"в ответе Claude нет вердикта: {str(text)[-200:]}"}


@contextmanager
def night_lock(night):
    with (night / "watchdog.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            yield False   # прошлый сторож ещё работает (например, ждёт Claude)
            return
        yield True


def tick(nights, world):
    night = latest_night(nights)
    if night is None:
        return "ночей нет"
    with night_lock(night) as locked:
        if not locked:
            return "прошлый сторож ещё работает"
        return check(night, world)


def check(night, world):
    meta = read(night / "night.json")
    journal = Journal(night)
    if (night / OFF).exists():
        return "сторож выключен владельцем"
    minutes_left = (meta["deadline"] - world.now()) / 60
    if minutes_left < MIN_MINUTES_LEFT:
        return "срок ночи вышел"
    report = read(night / "supervisor.json", {}) or {}
    workspace = Path(meta["workspace"])

    if world.supervisor_alive(meta["pid"]):
        newest = newest_activity(night)
        silent = (world.now() - newest) / 60
        if silent > SILENCE_MINUTES:
            # Ключ — момент, с которого тихо: та же тишина на следующем обходе не новый случай.
            return unknown(night, meta, world, journal,
                           f"тишина {silent:.0f} мин при живом супервизоре",
                           "ни один файл каталога ночи не менялся; процессы ночи: "
                           f"{world.night_processes(workspace, night)}",
                           key=f"тишина:{int(newest)}", live="тишина")
        streak = idle_streak(report)
        if streak >= IDLE_BATCHES:
            # Ключ — первая порция полосы: растущая полоса — всё тот же случай.
            batches = report.get("batches", [])
            return unknown(night, meta, world, journal, f"порций подряд без принятых задач: {streak}",
                           json.dumps(batches[-streak:], ensure_ascii=False)[:1500],
                           key=f"холостые:{len(batches) - streak}", live="холостые")
        return "ночь идёт"

    stopped = report.get("stopped")
    if stopped and stopped.startswith(NORMAL_FINISH):
        return "ночь закончилась штатно"
    alive = world.night_processes(workspace, night)
    if alive:
        # Супервизор мёртв, но ядро или авторы ещё работают: убийство супервизора по PID
        # ядро не гасит (своя группа процессов). Вмешательство сейчас столкнуло бы двух
        # хозяев checkout; ждём, пока ядро допишет своё состояние.
        key = "ждёт ядро:" + ",".join(map(str, sorted(alive)))
        if not journal.seen(key):
            journal.write(f"супервизор мёртв, процессы ночи ещё живы: {sorted(alive)}", "жду", ключ=key)
        return "жду ядро"
    return revive(night, meta, world, journal, report, minutes_left)


def revive(night, meta, world, journal, report, minutes_left, after_claude=None):
    """Ночь стоит до срока и ни один её процесс не жив. Поднять, если знаем как."""
    if journal.heals() >= MAX_HEALS:
        key = f"лимит:{MAX_HEALS}"
        if not journal.seen(key):
            journal.write(f"ночь снова стоит, поднималась уже {MAX_HEALS} раз",
                          "больше не поднимаю — решение за владельцем", ключ=key)
        return "лимит подъёмов"
    workspace = Path(meta["workspace"])
    run = last_run(night)
    state = read(run / "state.json") if run else None
    dirty = world.tree_dirty(workspace)
    stopped = report.get("stopped")
    core_stopped = bool(state) and state.get("status") == "stopped"
    saw = (f"ядро остановилось в {run.name} на {state.get('current')}: {state.get('reason', '')[:200]}"
           if core_stopped else f"супервизор остановился: {stopped}" if stopped
           else "супервизор умер до срока")

    if dirty and core_stopped:
        ok, why = world.retry_ok(workspace, run, meta["routing"])
        if ok:
            return resume(night, meta, world, journal, saw, minutes_left, retry=run)
        if after_claude is None:
            return unknown(night, meta, world, journal, saw, f"повтор приёмки невозможен: {why}",
                           key=f"неизвестно:{run.name}")
    elif not dirty and (after_claude is not None or (not stopped and (
            not core_stopped or state.get("reason", "").startswith(SIGNAL_STOP)))):
        # Супервизор умер (не дописал итог) и checkout чистый — поднимаем. Ядро, погашенное
        # сигналом вместе с ним, — тот же случай, а не своя поломка.
        return resume(night, meta, world, journal, saw, minutes_left)
    elif after_claude is None:
        return unknown(night, meta, world, journal, saw,
                       f"дерево {'занято' if dirty else 'чистое'}; итог супервизора: {stopped}; "
                       f"последний прогон: {run.name if run else 'нет'}",
                       key=f"неизвестно:{run.name if run else '-'}:{stopped}")

    # Сюда попадаем только после Claude: ночь продолжается без этой задачи.
    if dirty:
        archive, stash = world.park(workspace, night, len(journal.entries()) + 1)
        journal.write(saw, f"работа задачи снята из checkout: архив {archive}, stash {stash}",
                      причина=after_claude.get("summary", ""))
    return resume(night, meta, world, journal, saw, minutes_left)


def resume(night, meta, world, journal, saw, minutes_left, retry=None):
    number = journal.heals() + 1
    log = world.launch(night, meta, retry, number)
    did = (f"повтор приёмки {retry.name}, затем продолжение ночи" if retry else "продолжение ночи")
    journal.write(saw, f"{did} на оставшиеся {minutes_left:.0f} мин; лог {log}", лечение=did)
    return "повтор приёмки" if retry else "продолжение"


def unknown(night, meta, world, journal, saw, detail, key, live=None):
    """Поломка, которую сторож не знает: звать Claude один раз на один случай."""
    if journal.seen(key):
        return "случай уже разбирался"
    number = sum(1 for e in journal.entries() if e.get("claude")) + 1
    journal.write(saw, "зову Claude на разбор", ключ=key, claude=number, подробно=detail[:1500])
    verdict = world.ask_claude(night, meta, saw, detail, number)
    journal.write(saw, f"Claude: {verdict['status']} — {verdict['summary']}", claude_итог=verdict["status"])
    if live == "тишина":
        if verdict["status"] != "fixed":
            # Повисшая ночь не сдвинется сама; погашенное ядро запишет остановку, и
            # следующий обход поднимет её обычным путём.
            pids = [meta["pid"], *world.night_processes(Path(meta["workspace"]), night)]
            world.terminate(pids)
            journal.write(saw, f"гашу процессы ночи по PID: {pids}")
        return "тишина разобрана"
    if live:
        return "холостые порции разобраны"
    report = read(night / "supervisor.json", {}) or {}
    return revive(night, meta, world, journal, report, (meta["deadline"] - world.now()) / 60,
                  after_claude=verdict)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--nights", type=Path, default=Path.home() / ".local/share/flexiron")
    parser.add_argument("--launch", choices=("auto", "systemd", "direct"), default="auto",
                        help="Чем поднимать ночь: отдельным юнитом systemd или процессом в своей сессии")
    args = parser.parse_args()
    print(tick(args.nights, World(args.launch)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
