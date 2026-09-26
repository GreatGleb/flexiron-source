"""Драйвер aider для ночного автора: из редактора по одному сообщению — в агента.

Запускается питоном из окружения самого aider (его библиотека нужна напрямую) и
получает конфиг JSON-ом от aider-runner.py. Права агента на команды владелец выдал
явно 2026-09-26 — как у Zoo Code и Claude-автора с bypassPermissions. Что добавлено к
aider и почему именно так — всё сверено с исходниками 0.86.2:

- **Вопросы aider решаются по смыслу, а не одним ответом.** «Да» — починке упавших
  проверок, чтению вывода команд и допустимым командам. «Нет» — правке файла вне чата
  и созданию нового: оба после «да» делают `git add` (`base_coder.allowed_to_edit`),
  а изменённый индекс ядро считает порчей Git и останавливает всю ночь.
- **Проверки задачи — внутри цикла.** `test_cmd` у aider может быть функцией
  (`commands.cmd_test`); после каждой правки он её зовёт и упавшее отдаёт модели на
  починку. Функция гоняет `checks` задачи — те же, что потом погонит ядро.
- **Команды продолжают работу.** aider выполняет предложенные моделью команды, но их
  вывод только кладёт в историю, нового хода модели не делает. Здесь после команд
  модель получает ход — так она ищет файлы грепом, читает логи, запускает тесты.
- **Команды ограничены.** Свой `run_cmd` вместо aider-овского: у того нет таймаута,
  и `npm run dev` повесил бы задачу до конца ночи. Вывод обрезается — полный лог
  тестов съел бы контекст. Git — только читающие подкоманды, `refs_shift` — нет
  (номера ссылок правит контроллер, и автор, взявшийся за это сам, уже стоил ночи).
  Остальное защищает ядро, как и у других авторов: границы задачи, неизменность Git.
- **Найденные файлы открываются только для чтения.** Упомянутый моделью файл aider
  добавил бы редактируемым; здесь — только для чтения и с потолком по числу и размеру.
"""

import json
import os
import re
import shlex
import signal
import subprocess
import sys
from pathlib import Path

CONFIG, ROOT, OUTPUTS = {}, None, []
GIT_READ_ONLY = {"status", "diff", "log", "show", "grep", "ls-files", "blame", "rev-parse", "cat-file"}
YES = {"Attempt to fix test errors?", "Attempt to fix lint errors?", "Add command output to the chat?"}
ACTIVE = set()
# Ответ, в котором есть правка или команда: SEARCH/REPLACE-блок либо shell-блок.
ACTING = re.compile(r"^<{5,9} SEARCH|^```(?:bash|sh|shell|zsh|console)\b", re.MULTILINE)


def load_env(path):
    for line in Path(path).expanduser().read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


def clip(text, limit):
    if len(text) <= limit:
        return text
    head = limit // 5
    return text[:head] + f"\n…[вырезано {len(text) - limit} символов]…\n" + text[-(limit - head):]


def kill(proc):
    for sig in (signal.SIGTERM, signal.SIGKILL):
        try:
            os.killpg(proc.pid, sig)
            proc.wait(timeout=5)
            return
        except subprocess.TimeoutExpired:
            continue
        except ProcessLookupError:
            return


def run_limited(command, cwd, timeout, shell):
    """Команда с таймаутом на всё дерево процессов и обрезанным выводом."""
    proc = subprocess.Popen(command, cwd=cwd, shell=shell, executable="/bin/bash" if shell else None,
                            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            text=True, errors="replace", start_new_session=True)
    ACTIVE.add(proc)
    try:
        out, _ = proc.communicate(timeout=timeout)
        code = proc.returncode
    except subprocess.TimeoutExpired:
        kill(proc)
        out, _ = proc.communicate()
        out = (out or "") + f"\n[команда прервана ночным контроллером: дольше {timeout} с]"
        code = 124
    finally:
        ACTIVE.discard(proc)
    return code, clip(out or "", CONFIG["output_limit"])


def stop(_number, _frame):
    # Ядро гасит группу процессов обёртки, а команды живут в своих сессиях: без этого
    # тесты, запущенные автором, пережили бы задачу.
    for proc in list(ACTIVE):
        kill(proc)
    raise SystemExit(143)


def command_refusal(command):
    if "refs_shift" in command:
        return f"`{command}`: номера ссылок правит контроллер после задачи, не автор"
    try:
        words = shlex.split(command, comments=True)
    except ValueError:
        words = command.split()
    for index, word in enumerate(words):
        if Path(word).name == "git":
            rest = [w for w in words[index + 1:] if not w.startswith("-")]
            sub = rest[0] if rest else ""
            if sub not in GIT_READ_ONLY:
                return (f"`{command}`: git {sub or '(без подкоманды)'} меняет репозиторий; "
                        f"можно только {', '.join(sorted(GIT_READ_ONLY))}")
    return None


def main(config_path):
    global CONFIG, ROOT, OUTPUTS
    CONFIG = json.loads(Path(config_path).read_text())
    ROOT = Path(CONFIG["root"]).resolve()
    OUTPUTS = list(CONFIG["outputs"])
    signal.signal(signal.SIGTERM, stop)
    if CONFIG.get("env_file"):
        load_env(CONFIG["env_file"])

    import aider.coders.base_coder as base_coder
    from aider.coders import Coder
    from aider.history import ChatSummary
    from aider.io import InputOutput
    from aider.models import Model
    from aider.repo import GitRepo

    stats = {"commands": [], "refused": [], "read_added": [], "checks_runs": 0, "checks_green": None,
             "command_log": [], "final_reply": "", "cannot": ""}

    def run_model_command(command, verbose=False, error_print=None, cwd=None):
        code, out = run_limited(command, cwd or ROOT, CONFIG["command_timeout"], shell=True)
        # Журнал уходит приёмщику как доказательство: он читает отчёт автора целиком и
        # бракует «мутация не подтверждена», если прогонов автора не видно.
        tail = out.strip().splitlines()[-3:] if out.strip() else []
        stats["command_log"].append(f"$ {command} → код {code}" + ("; " + " / ".join(tail) if tail else ""))
        return code, out

    base_coder.run_cmd = run_model_command

    class NightIO(InputOutput):
        def confirm_ask(self, question, default="y", subject=None, explicit_yes_required=False,
                        group=None, allow_never=False):
            asked = question.strip()
            if asked.startswith("Run shell command"):
                lines = [c for c in (subject or "").splitlines() if c.strip() and not c.strip().startswith("#")]
                refusals = [r for r in map(command_refusal, lines) if r]
                stats["refused"] += refusals
                ok = not refusals
                if ok:
                    stats["commands"] += lines
            else:
                ok = asked in YES
            self.tool_output(f"[ночь] {asked} {subject or ''} → {'да' if ok else 'нет'}")
            return ok

    def run_checks():
        failures = []
        for check in CONFIG["checks"]:
            code, out = run_limited(check["argv"], ROOT / check["cwd"], CONFIG["check_timeout"], shell=False)
            if code:
                failures.append(f"$ cd {check['cwd']} && {shlex.join(check['argv'])}  → код {code}\n{out}")
        stats["checks_runs"] += 1
        stats["checks_green"] = not failures
        if failures:
            return ("Машинные проверки задачи упали. Их же погонит приёмка — почини:\n\n"
                    + "\n\n".join(failures))
        return None

    class Checks(str):
        """Строка и функция сразу. aider склеивает `test_cmd` со строкой системного промпта
        (`get_platform_info`), а `cmd_test` зовёт его, если он вызываем: голая функция роняла
        драйвер на первом же запросе к модели — поймано тестом, а не ночью."""

        def __call__(self):
            return run_checks()

    checks = Checks("; ".join(f"(cd {c['cwd']} && {shlex.join(c['argv'])})" for c in CONFIG["checks"]))

    io = NightIO(pretty=False, fancy_input=False, chat_history_file=CONFIG["chat_history"],
                 input_history_file=CONFIG["input_history"], root=str(ROOT))
    model = Model(CONFIG["model"])
    repo = GitRepo(io, OUTPUTS, str(ROOT), models=model.commit_message_models())
    coder = Coder.create(
        main_model=model, edit_format=CONFIG["edit_format"], io=io, repo=repo,
        fnames=OUTPUTS, read_only_fnames=CONFIG["sources"], auto_commits=False, dirty_commits=False,
        map_tokens=model.get_repo_map_tokens(), stream=False, auto_lint=False,
        auto_test=bool(CONFIG["checks"]), test_cmd=checks if CONFIG["checks"] else None,
        # aider сжимает историю уже после 8192 токенов — это его потолок, а не модели (1M у
        # deepseek-flash). В агентском цикле это два-три вывода команд: старые ходы ушли бы
        # в пересказ, и модель чинила бы по памяти, а не по выводу.
        summarizer=ChatSummary([model.weak_model, model], CONFIG.get("history_tokens", 65536)),
        suggest_shell_commands=True, detect_urls=False, restore_chat_history=False)
    coder.max_reflections = CONFIG["max_reflections"]

    pending = []

    def mentions(content):
        added = []
        for rel in sorted(coder.get_file_mentions(content) - coder.ignore_mentions):
            coder.ignore_mentions.add(rel)
            path = Path(coder.abs_root_path(rel))
            if (len(stats["read_added"]) >= CONFIG["max_read_files"] or not path.is_file()
                    or path.stat().st_size > CONFIG["read_file_limit"]):
                continue
            coder.abs_read_only_fnames.add(str(path))
            added.append(rel)
            stats["read_added"].append(rel)
        if not added:
            return None
        note = (f"Добавил в чат ТОЛЬКО ДЛЯ ЧТЕНИЯ: {', '.join(added)}. "
                f"Править можно только: {', '.join(OUTPUTS)}.")
        # Возврат сообщения aider отрабатывает `return` ДО правок и команд (`send_message`):
        # ответ «```bash grep … helper.py```» терял свою команду, ответ с правкой — правку.
        # Такой ответ сначала доделывается, а ход с новыми файлами модель получает после
        # (shell_then_continue). Молча выкинуть просьбу нельзя: живая проба 2026-09-26 —
        # модель вписала заглушку, попросила config/limits.py, не получила и сдалась.
        if ACTING.search(content):
            pending.append(note)
            return None
        return note

    coder.check_for_file_mentions = mentions
    run_shell = coder.run_shell_commands

    def shell_then_continue():
        before = len(stats["refused"])
        output = run_shell()
        # aider копит команды за весь запуск (сброс — только в init_before_message) и на
        # каждом ходу гоняет их все заново. С ходом после команд это был цикл до потолка
        # отражений: одна и та же команда, один и тот же вывод, токены за каждый круг.
        coder.shell_commands = []
        refused = stats["refused"][before:]
        opened = " ".join(pending) + "\n" if pending else ""
        pending.clear()
        if (output or refused or opened) and not coder.reflected_message:
            note = ("Отклонено ночным контроллером: " + "; ".join(refused) + "\n") if refused else ""
            coder.reflected_message = (opened + note + ("Вывод команд — выше. " if output else "")
                                       + "Продолжай задачу по этому результату. Когда задача "
                                       "сделана и проверки зелёные — ответь без команд отчётом: "
                                       "что изменил, какие команды и проверки гонял и с каким итогом.")
        return output

    coder.run_shell_commands = shell_then_continue
    # preproc=False: промпт ядра упоминает десятки документов, и aider подтянул бы их все.
    # Нужное модель попросит сама — упоминанием в ответе, и получит только для чтения.
    coder.run(with_message=Path(CONFIG["message"]).read_text(), preproc=False)
    if CONFIG["checks"] and stats["checks_green"] is None:
        # Правок не было — auto_test не сработал ни разу; итог проверок всё равно нужен.
        run_checks()
    if ACTING.search(coder.partial_response_content or ""):
        # Закончила правкой или командой — отчёта нет, а приёмщик читает именно его.
        # Один короткий ход; правки в нём по-прежнему только в outputs. Упоминания файлов
        # здесь не подтягиваются: отчёт их называет, и подтянутый файл дал бы ещё ход,
        # ответ которого затёр бы сам отчёт.
        coder.check_for_file_mentions = lambda content: None
        coder.run(with_message=("Задача закончена? Ответь без правок и команд отчётом: что "
                                "изменил, какие команды и проверки гонял и с каким итогом. "
                                "Если выполнить нельзя — начни с «НЕ МОГУ: <причина>»."),
                  preproc=False)
    # Последний ответ модели — её отчёт: код и правки из него вырезаются, остаётся текст.
    reply = re.sub(r"```.*?```", " ", coder.partial_response_content or "", flags=re.DOTALL)
    reply = re.sub(r"<{5,9} SEARCH.*?>{5,9} REPLACE", " ", reply, flags=re.DOTALL)
    stats["final_reply"] = " ".join(reply.split())[:1500]
    cannot = re.search(r"НЕ МОГУ:\s*(.+)", coder.partial_response_content or "")
    stats["cannot"] = cannot.group(1).strip()[:400] if cannot else ""
    stats.update(tokens_sent=coder.total_tokens_sent, tokens_received=coder.total_tokens_received,
                 cost=round(coder.total_cost, 4), reflections=coder.num_reflections)
    Path(CONFIG["stats"]).write_text(json.dumps(stats, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
