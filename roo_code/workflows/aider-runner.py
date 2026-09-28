"""Обёртка автора на aider: промпт ядра на входе, файл результата на выходе.

Работает системным питоном и зовёт драйвер aider-agent.py питоном из окружения
aider — драйверу нужна его библиотека. Разделение не для красоты: всё, что обязано
сработать при любом исходе драйвера (таймаут, падение, неверный ключ), живёт здесь.

- из промпта берётся задание (JSON после «Задание (JSON):») — `outputs` уходят в
  чат как редактируемые, `sources` — только для чтения, `checks` — в цикл починки;
- результат `{"status","summary","evidence"}` aider не печатает — его собирает
  обёртка по факту: какие файлы из `outputs` изменились, плюс сводка драйвера;
- служебные следы aider в checkout не остаются: история чата пишется в каталог
  прогона, кэш карты репозитория и пустые заготовки новых файлов удаляются. Иначе
  ядро увидело бы их как правки вне задачи и браковало каждую задачу. Кэш карты —
  `.aider.tags.cache.v*` в корне (`RepoMap.TAGS_CACHE_DIR`), заготовка — пустой файл
  под несуществующий output (`utils.touch_file`).

Имя модели aider может не знать и тогда берёт формат `whole` — модель переписывает
каждый файл целиком. Поэтому формат по умолчанию `diff`, как в настройках aider для
deepseek-chat и deepseek-reasoner.
"""

import argparse
import json
import shutil
import signal
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import headless_backends as backends  # noqa: E402  (нужен HERE в sys.path)

MARKER = "\nЗадание (JSON):\n"


def git_status(root):
    """Изменённые и новые файлы checkout — тем же счётом, что у ядра."""
    def names(*args):
        out = subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True, check=True).stdout
        return set(filter(None, out.split("\0")))
    return (names("diff", "--name-only", "-z", "HEAD")
            | names("ls-files", "--others", "--exclude-standard", "-z"))


def cost_text(cost):
    return "нет замера" if cost is None else f"${cost}"


def snapshot(root, names):
    result = {}
    for name in names:
        path = root / name
        result[name] = path.read_bytes() if path.is_file() else None
    return result


def aider_python(binary):
    """Питон окружения aider — из шебанга его скрипта (`uv tool` ставит именно так)."""
    script = shutil.which(binary)
    if not script:
        raise FileNotFoundError(f"aider не найден: {binary}")
    first = Path(script).read_bytes().split(b"\n", 1)[0].decode(errors="replace")
    if not first.startswith("#!"):
        raise ValueError(f"У {script} нет шебанга — укажи routing.work.python")
    return first[2:].strip().split()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", default="aider")
    parser.add_argument("--python", help="Питон окружения aider; по умолчанию — из шебанга aider")
    parser.add_argument("--model", required=True)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--result", type=Path, required=True)
    parser.add_argument("--timeout", type=int, default=3600)
    parser.add_argument("--env-file", type=Path)
    parser.add_argument("--edit-format")
    # Потолки сняты с 20 ночных сессий Zoo Code (2026-09-26): запросов к модели медиана 33,
    # максимум 57; самая долгая команда — 40 минут (тест под нагрузкой), playwright — до 10.
    # Прежние 12 ходов и 10 минут оборвали бы большинство задач. Значения по решению
    # владельца 2026-09-26 — 100 ходов и 60 минут, с запасом над замером. Время всей задачи
    # держит ядро (timeout_seconds маршрутизации); эти — только от вечных команд вроде
    # `npm run dev` без фона.
    parser.add_argument("--max-reflections", type=int, default=100)
    parser.add_argument("--command-timeout", type=int, default=3600)
    parser.add_argument("--check-timeout", type=int, default=3600)
    parser.add_argument("--output-limit", type=int, default=12000)
    # Файлов для чтения — 45 по решению владельца 2026-09-26: Zoo-автор за ночную сессию
    # читал медиана 14.5 разных файлов, максимум 44. Прежние 12 кончались в обычной задаче.
    parser.add_argument("--max-read-files", type=int, default=45)
    parser.add_argument("--read-file-limit", type=int, default=200_000)
    parser.add_argument("--history-tokens", type=int, default=65536)
    args = parser.parse_args()
    root, result_path = args.root.resolve(), args.result
    prompt = sys.stdin.read()

    def finish(status, summary, evidence):
        result_path.write_text(json.dumps({"status": status, "summary": summary[:500],
                                           "evidence": evidence}, ensure_ascii=False))
        return 0

    if MARKER not in prompt:
        return finish("blocked", "Обёртка aider не нашла задание в промпте ядра",
                      [f"ожидался маркер {MARKER.strip()!r}"])
    task = json.loads(prompt.split(MARKER, 1)[1])
    outputs = list(task.get("outputs", []))
    sources = [s for s in task.get("sources", []) if (root / s).is_file() and s not in outputs]

    stem = result_path.with_suffix("")
    message = stem.with_suffix(".aider.message.md")
    message.write_text(prompt)
    chat, log, stats_path = (stem.with_suffix(s) for s in (".aider.chat.md", ".aider.log", ".aider.stats.json"))
    config = stem.with_suffix(".aider.config.json")
    guard = stem.with_suffix(".aider.git-guard")
    config.write_text(json.dumps({
        "root": str(root), "model": args.model, "message": str(message), "outputs": outputs,
        "sources": sources, "checks": task.get("checks", []), "edit_format": args.edit_format or "diff",
        "env_file": str(args.env_file) if args.env_file else None,
        "chat_history": str(chat), "input_history": str(stem.with_suffix(".aider.input.history")),
        "stats": str(stats_path), "guard_dir": str(guard), "max_reflections": args.max_reflections,
        "command_timeout": args.command_timeout, "check_timeout": args.check_timeout,
        "output_limit": args.output_limit, "max_read_files": args.max_read_files,
        "read_file_limit": args.read_file_limit, "history_tokens": args.history_tokens}, ensure_ascii=False, indent=2))
    missing = {name for name in outputs if not (root / name).exists()}
    caches_before = set(root.glob(".aider.tags.cache.v*"))
    before = snapshot(root, outputs)

    python = [args.python] if args.python else aider_python(args.binary)
    code = None
    with log.open("w") as stream:
        driver = subprocess.Popen([*python, str(HERE / "aider-agent.py"), str(config)], cwd=root,
                                  stdin=subprocess.DEVNULL, stdout=stream, stderr=subprocess.STDOUT)

        def forward(_number, _frame):
            # Ядро гасит нас сигналом — драйвер обязан успеть погасить свои команды.
            driver.terminate()
            try:
                driver.wait(timeout=15)
            except subprocess.TimeoutExpired:
                driver.kill()
            raise SystemExit(143)

        signal.signal(signal.SIGTERM, forward)
        try:
            code = driver.wait(timeout=args.timeout)
        except subprocess.TimeoutExpired:
            driver.terminate()
            try:
                driver.wait(timeout=15)
            except subprocess.TimeoutExpired:
                driver.kill()
                driver.wait()
        finally:
            # Следы aider убираются при любом исходе: иначе ядро забракует задачу за
            # «правку вне задачи», а причиной окажется не автор, а его инструмент.
            # Обёртка git драйвера: убитый SIGKILL драйвер убрать её не успевает.
            shutil.rmtree(guard, ignore_errors=True)
            for cache in set(root.glob(".aider.tags.cache.v*")) - caches_before:
                shutil.rmtree(cache, ignore_errors=True)
            for name in missing:
                path = root / name
                if path.is_file() and path.stat().st_size == 0:
                    path.unlink()

    edited = sorted(name for name, body in snapshot(root, outputs).items() if body != before[name])
    evidence = [f"история чата aider: {chat}", f"вывод aider: {log}"]
    stats = json.loads(stats_path.read_text()) if stats_path.is_file() else {}
    if stats:
        green = {True: "зелёные", False: "КРАСНЫЕ", None: "не запускались"}[stats.get("checks_green")]
        evidence.append(f"проверки задачи у автора: {green} (прогонов {stats.get('checks_runs', 0)}); "
                        f"команд {len(stats.get('commands', []))}, отклонено {len(stats.get('refused', []))}; "
                        f"токенов {stats.get('tokens_sent', 0)}+{stats.get('tokens_received', 0)}, "
                        f"${stats.get('cost', 0)} по счёту aider, "
                        f"по тарифу провайдера {cost_text(stats.get('cost_real'))}")
        # Прогоны автора — приёмщику: без них «мутация не подтверждена» бракует верную работу.
        evidence += [f"команда автора: {line}"[:400] for line in stats.get("command_log", [])[-15:]]
        if stats.get("final_reply"):
            evidence.append("отчёт автора: " + stats["final_reply"])
    # Ошибку модели aider печатает и работает дальше (замер 0.86.2: неверный ключ DeepSeek →
    # «litellm.AuthenticationError», выход с кодом 0). Без этой строки причина браковки
    # звучала бы «ничего не изменил», а настоящая осталась бы в логе. Берётся только то,
    # что сообщили aider и litellm (их список ведёт драйвер), а не любая строка лога со
    # словом «Error»: в логе и ответы модели, цитирующие вывод тестов, и её команды.
    why = ""
    errors = stats.get("aider_errors", [])
    if errors:
        own = [e for e in errors if e.startswith("litellm.")] or errors
        why = f"; aider сообщил: {own[-1][:300]}"
    elif not stats:
        # Драйвер упал, не оставив сводки: причина — последняя строка его трассировки.
        text = log.read_text(errors="replace")
        if "Traceback (most recent call last):" in text:
            crash = [line.strip() for line in text.rsplit("Traceback (most recent call last):", 1)[1].splitlines()
                     if line.strip()]
            why = f"; aider сообщил: {crash[-1][:300]}" if crash else ""
    # Отказ провайдера (нет денег, не принят ключ, исчерпана квота) — не брак задачи:
    # следующая получит тот же ответ. Ядро узнаёт его по началу строки и останавливает
    # ночь. Таймаут (code is None) сюда не годится: там ошибка могла быть старой и
    # безобидной, а работу оборвал потолок времени. Уже изменённые файлы важнее отказа —
    # их судит приёмка, и терять их из-за сдохшего в конце счёта незачем.
    fatal = None if code is None or edited else backends.provider_refusal(errors)
    if fatal:
        return finish("blocked", f"{backends.PROVIDER_REFUSAL_PREFIX}: {fatal[:300]}", evidence)
    if code is None:
        return finish("blocked", f"aider не уложился в {args.timeout} с{why}", evidence)
    if code:
        return finish("blocked", f"драйвер aider завершился с кодом {code}{why}", evidence)
    if stats.get("cannot"):
        # Модель сама сказала, что задачу выполнить нельзя, — её причина и есть причина
        # браковки, даже если что-то успело измениться: работу сохранит архив блокировки.
        return finish("blocked", "автор: " + stats["cannot"], evidence)
    if not edited:
        # Объяснение модели — лучшая причина, какая есть: без него утром видно только «не изменил».
        said = f"; автор: {stats['final_reply'][:300]}" if stats.get("final_reply") else ""
        return finish("blocked", f"aider не изменил ни одного файла из outputs{why}{said}", evidence)
    outside = sorted(git_status(root) - set(outputs))
    evidence = [f"изменён {name}" for name in edited] + evidence
    if outside:
        # Решает ядро, здесь только честное описание: правку вне чата драйвер отклоняет,
        # но команда автора могла тронуть что угодно — обёртка не вправе это скрыть.
        evidence.append(f"изменено вне outputs: {outside}")
    summary = stats.get("final_reply") or ("aider изменил: " + ", ".join(edited))
    return finish("done", summary, evidence)


if __name__ == "__main__":
    sys.exit(main())
