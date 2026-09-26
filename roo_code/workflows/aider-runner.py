"""Обёртка автора на aider: промпт ядра на входе, файл результата на выходе.

aider — не агент с терминалом, а редактор файлов по одному сообщению. Поэтому всё,
что другие исполнители делают сами, здесь делает обёртка:

- из промпта берётся задание (JSON после «Задание (JSON):») — `outputs` уходят в
  чат как редактируемые, существующие `sources` — только для чтения;
- результат `{"status","summary","evidence"}` aider не печатает — его собирает
  обёртка по факту: какие файлы из `outputs` изменились;
- служебные следы aider в checkout не остаются: история чата пишется в каталог
  прогона, кэш карты репозитория и пустые заготовки новых файлов удаляются. Иначе
  ядро увидело бы их как правки вне задачи и браковало каждую задачу.

Флаги сверены с исходниками aider 0.86.2 и живыми пробами, а не с памятью:
- на КАЖДЫЙ вопрос aider обёртка отвечает «нет» — строками «n» в stdin. `--yes-always`
  здесь смертелен: «Create new file?» и «Allow edits to file that has not been added
  to the chat?» после «да» делают `git add` (`base_coder.allowed_to_edit`), а
  изменённый индекс ядро считает порчей Git и останавливает ВСЮ ночь. Проба
  2026-09-26: с `--yes-always` файл вне задачи попал в индекс, с «n» — «Skipping
  edits». Молчать тоже нельзя: на конце ввода `confirm_ask` берёт ответ по
  умолчанию, а он «да»;
- тем же «нет» закрыто подтягивание упомянутых файлов («Add file to the chat?»):
  aider ищет имена файлов и в промпте, и в ответе модели. Промпт ядра упоминает
  десятки документов — с «да» они уходили в модель целиком и становились
  редактируемыми (проба: 4.3k токенов против 699 на той же задаче);
- shell-команды требуют явного «да» (`explicit_yes_required`) — не запускаются;
- коммиты закрыты `--no-auto-commits --no-dirty-commits`;
- имя модели aider может не знать и тогда берёт формат `whole` — модель переписывает
  каждый файл целиком. Поэтому формат по умолчанию `diff`, как в настройках aider
  для deepseek-chat и deepseek-reasoner;
- несуществующий файл из `--file` создаётся пустым (`utils.touch_file`) без `git add`;
- кэш карты — `.aider.tags.cache.v*` в корне репозитория (`RepoMap.TAGS_CACHE_DIR`).
"""

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

MARKER = "\nЗадание (JSON):\n"


def git_status(root):
    """Изменённые и новые файлы checkout — тем же счётом, что у ядра."""
    def names(*args):
        out = subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True, check=True).stdout
        return set(filter(None, out.split("\0")))
    return (names("diff", "--name-only", "-z", "HEAD")
            | names("ls-files", "--others", "--exclude-standard", "-z"))


def snapshot(root, names):
    result = {}
    for name in names:
        path = root / name
        result[name] = path.read_bytes() if path.is_file() else None
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", default="aider")
    parser.add_argument("--model", required=True)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--result", type=Path, required=True)
    parser.add_argument("--timeout", type=int, default=3600)
    parser.add_argument("--env-file", type=Path)
    parser.add_argument("--edit-format")
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
    chat = stem.with_suffix(".aider.chat.md")
    missing = {name for name in outputs if not (root / name).exists()}
    caches_before = set(root.glob(".aider.tags.cache.v*"))
    before = snapshot(root, outputs)

    argv = [args.binary, "--model", args.model, "--message-file", str(message),
            "--no-auto-commits", "--no-dirty-commits", "--no-gitignore",
            "--no-check-update", "--no-show-release-notes", "--no-analytics", "--no-pretty",
            "--no-stream", "--no-fancy-input", "--no-detect-urls", "--no-suggest-shell-commands",
            "--no-auto-lint", "--no-auto-test", "--no-restore-chat-history",
            "--chat-history-file", str(chat),
            "--input-history-file", str(stem.with_suffix(".aider.input.history"))]
    if args.env_file:
        argv += ["--env-file", str(args.env_file)]
    argv += ["--edit-format", args.edit_format or "diff"]
    for name in outputs:
        argv += ["--file", name]
    for name in sources:
        argv += ["--read", name]

    log = stem.with_suffix(".aider.log")
    try:
        with log.open("w") as stream:
            # Запас «нет» с избытком: вопросов за задачу единицы, а кончившийся ввод
            # aider прочитал бы как «да». Лишнее он не читает — выходит после сообщения.
            proc = subprocess.run(argv, cwd=root, input="n\n" * 5000, text=True, stdout=stream,
                                  stderr=subprocess.STDOUT, timeout=args.timeout)
        code = proc.returncode
    except subprocess.TimeoutExpired:
        code = None
    finally:
        # Следы aider убираются при любом исходе: иначе ядро забракует задачу за
        # «правку вне задачи», а причиной окажется не автор, а его инструмент.
        for cache in set(root.glob(".aider.tags.cache.v*")) - caches_before:
            shutil.rmtree(cache, ignore_errors=True)
        for name in missing:
            path = root / name
            if path.is_file() and path.stat().st_size == 0:
                path.unlink()

    edited = sorted(name for name, body in snapshot(root, outputs).items() if body != before[name])
    evidence = [f"история чата aider: {chat}", f"вывод aider: {log}"]
    # Ошибку модели aider печатает и выходит с кодом 0 (замер 0.86.2: неверный ключ
    # DeepSeek → «litellm.AuthenticationError», exit 0). Без этой строки причина
    # браковки звучала бы «ничего не изменил», а настоящая осталась бы в логе.
    errors = [line.strip() for line in log.read_text(errors="replace").splitlines()
              if "Error" in line and line.strip()]
    why = f"; aider сообщил: {errors[-1][:300]}" if errors else ""
    if code is None:
        return finish("blocked", f"aider не уложился в {args.timeout} с{why}", evidence)
    if code:
        return finish("blocked", f"aider завершился с кодом {code}{why}", evidence)
    if not edited:
        return finish("blocked", f"aider не изменил ни одного файла из outputs{why}", evidence)
    outside = sorted(git_status(root) - set(outputs))
    evidence = [f"изменён {name}" for name in edited] + evidence
    if outside:
        # Решает ядро, здесь только честное описание. Через aider сюда попасть не должно
        # (на правку вне чата он получает «нет»), но обёртка не вправе это скрыть.
        evidence.append(f"изменено вне outputs: {outside}")
    return finish("done", "aider изменил: " + ", ".join(edited), evidence)


if __name__ == "__main__":
    sys.exit(main())
