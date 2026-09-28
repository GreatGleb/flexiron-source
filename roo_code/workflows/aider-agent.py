"""Драйвер aider для ночного автора: из редактора по одному сообщению — в агента.

Запускается питоном из окружения самого aider (его библиотека нужна напрямую) и
получает конфиг JSON-ом от aider-runner.py. Права агента на команды владелец выдал
явно 2026-09-26 — как у Zoo Code и Claude-автора с bypassPermissions. Что добавлено к
aider и почему именно так — всё сверено с исходниками 0.86.2:

- **Вопросы aider решаются по смыслу, а не одним ответом.** «Да» — починке упавших
  проверок, чтению вывода команд и допустимым командам. «Нет» — правке файла вне чата
  и созданию нового: оба после «да» делают `git add` (`base_coder.allowed_to_edit`),
  а изменённый индекс ядро считает порчей Git и останавливает всю ночь.
- **Проверки задачи — когда модель считает работу сделанной** (решение владельца
  2026-09-26). Не после каждой правки: `auto_test` aider гонял бы `npm run verify` на
  каждом шаге недописанной работы. Сделанной работа считается по ответу без правок и
  команд; красные `checks` задачи (те же, что потом погонит ядро) возвращаются модели
  ходом на починку, и после каждой починки гоняются снова. Всё в одном цикле aider,
  поэтому потолок ходов общий.
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
- **Ссылки своих документов — до сдачи, тем же счётом, что у ядра.** Битых ссылок в
  документе из outputs не должно стать больше, чем до задачи (резолвер
  `contractRefs.spec.ts`); стало — красное возвращается модели, как упавшие checks.
  Ссылки её документов на строки, которые ИЗМЕНИЛИСЬ, контроллер не перенумерует —
  модель получает их список один раз. Брак 27.09: три задачи из пяти — ссылки.
"""

import json
import os
import re
import shlex
import shutil
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import refs_shift  # noqa: E402  (только stdlib — годится и для питона aider)

CONFIG, ROOT, OUTPUTS = {}, None, []
GIT_READ_ONLY = {"status", "diff", "log", "show", "grep", "ls-files", "blame", "rev-parse", "cat-file",
                 "check-ignore", "ls-tree", "describe", "shortlog"}
YES = {"Attempt to fix test errors?", "Attempt to fix lint errors?"}
ACTIVE = set()
# Группы процессов всех команд задачи. Zoo-автор запускал `nohup npm run dev & disown` и
# ходил на этот сервер следующими командами — после команды его гасить нельзя. После
# задачи — обязательно: иначе сервер переживёт её и займёт порт следующей.
GROUPS = set()
# Ответ, в котором есть правка или команда: SEARCH/REPLACE-блок либо shell-блок.
ACTING = re.compile(r"^<{5,9} SEARCH|^```(?:bash|sh|shell|zsh|console)\b", re.MULTILINE)
CANNOT = re.compile(r"НЕ МОГУ:\s*(.+)")


# Имена из файла ключей. Ключ нужен самому aider, а не командам модели: без этой уборки
# `printenv` в команде клал ключ в журнал команд, а оттуда — в доказательства, то есть в
# каталог прогона и в промпт приёмщика.
SECRETS = set()
SECRET_NAME = re.compile(r"_API_KEY$")


def load_env(path):
    for line in Path(path).expanduser().read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            SECRETS.add(key.strip())
            os.environ.setdefault(key.strip(), value.strip())


def child_env():
    """Окружение команд модели и проверок — без ключей модели."""
    return {k: v for k, v in os.environ.items() if k not in SECRETS and not SECRET_NAME.search(k)}


# Каталог с обёрткой `git` — первым в PATH команд модели. Разбор строки в command_refusal
# ловит только прямую запись: `bash -c 'git add .'`, `(git add x)`, `true;git stash`,
# `timeout 5 git add .` он пропускал, а изменённый индекс ядро считает концом ночи.
# Обёртка видит уже разобранную оболочкой команду, как бы та ни была записана.
# Каталог — в каталоге прогона (`guard_dir` конфига), а не в /tmp: убирает его обёртка
# aider-runner.py, которая переживает SIGKILL драйвера; mkdtemp в /tmp оставался навсегда.
GUARD_DIR = None


def install_git_guard(directory):
    global GUARD_DIR
    real = shutil.which("git")
    if not real:
        return
    Path(directory).mkdir(parents=True, exist_ok=True)
    GUARD_DIR = str(directory)
    shim = Path(GUARD_DIR) / "git"
    shim.write_text(f"#!/bin/sh\nexec {shlex.quote(sys.executable)} {shlex.quote(str(Path(__file__).resolve()))} "
                    f"--git-guard {shlex.quote(real)} \"$@\"\n")
    shim.chmod(0o755)


# Команды, которые на общей машине бьют по соседям. Ночь 2026-09-27-2225: автор пачки
# запустил 160 `yes` на 8 ядрах (load 176) для «инверсии под нагрузкой», а сосед в это
# время гнал свои e2e под чужой нагрузкой; снимал нагрузку он `pkill -x yes`, то
# есть и чужую. Запрет — только для автора пачки: ядро выдаёт PW_PORT лишь тогда, когда
# рядом пишут другие. Один автор на машине нагрузку создавать может, её требует план.
SHARED_MACHINE = {"yes", "stress", "stress-ng", "pkill", "killall"}


def shared_machine():
    return "PW_PORT" in os.environ


def shared_refusal(name):
    return (f"{name}: отклонено ночным контроллером — машина общая с другими авторами: "
            "искусственная нагрузка и остановка процессов по имени бьют по их тестам; "
            "вместо прогона под нагрузкой сделай замер")


def install_shared_guard(directory):
    """Обёртки команд SHARED_MACHINE в каталоге обёртки git — первыми в PATH.

    Разбор строки в command_refusal ловит прямую запись; `bash -c 'yes'` и `xargs pkill`
    ловит обёртка, как у git."""
    global GUARD_DIR
    if not shared_machine():
        return
    Path(directory).mkdir(parents=True, exist_ok=True)
    GUARD_DIR = str(directory)
    for name in SHARED_MACHINE:
        shim = Path(GUARD_DIR) / name
        shim.write_text(f"#!/bin/sh\necho {shlex.quote(shared_refusal(name))} >&2\nexit 1\n")
        shim.chmod(0o755)


def guarded_env():
    env = child_env()
    if GUARD_DIR:
        env["PATH"] = GUARD_DIR + os.pathsep + env.get("PATH", "")
    return env


def guard_refusal(args):
    """Отказ обёртки `git`: подкоманда, которая пишет. Без подкоманды git ничего не меняет."""
    sub = next(git_subcommands(["git", *args]))
    if sub and sub not in GIT_READ_ONLY:
        return (f"git {sub}: отклонено ночным контроллером — git меняет репозиторий; "
                f"можно только {', '.join(sorted(GIT_READ_ONLY))}")
    return None


def git_guard(real, args):
    refusal = guard_refusal(args)
    if refusal:
        print(refusal, file=sys.stderr)
        return 1
    os.execv(real, [real, *args])


def clip(text, limit):
    if len(text) <= limit:
        return text
    head = limit // 5
    return text[:head] + f"\n…[вырезано {len(text) - limit} символов]…\n" + text[-(limit - head):]


def kill(proc):
    """Прерванная команда гасится вся: SIGTERM, а кто его пережил — SIGKILL."""
    try:
        os.killpg(proc.pid, signal.SIGTERM)
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        pass
    except ProcessLookupError:
        return
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    proc.wait()


class Drain(threading.Thread):
    """Читает вывод команды до конца канала, храня только начало и хвост.

    Конец канала — не конец команды: фоновый потомок (`(yes > /dev/null &)` у Zoo-автора
    28 раз, сервер без перенаправления) держит унаследованный канал открытым. Чтение до
    конца канала в главном потоке ждало его весь таймаут команды, а после таймаута —
    вечно, если потомок глух к SIGTERM. Здесь команда кончается вместе со своей
    оболочкой, а канал дочитывается в фоне: писатель не упирается в полный буфер, и
    ни диск, ни память не растут."""

    def __init__(self, stream, limit):
        super().__init__(daemon=True)
        self.stream, self.limit = stream, limit
        self.head, self.tail, self.total = bytearray(), bytearray(), 0
        self.lock = threading.Lock()

    def run(self):
        for chunk in iter(lambda: self.stream.read1(65536), b""):
            with self.lock:
                self.total += len(chunk)
                room = self.limit - len(self.head)
                if room > 0:
                    self.head += chunk[:room]
                    chunk = chunk[room:]
                self.tail += chunk
                del self.tail[:-self.limit]

    def text(self):
        with self.lock:
            cut = self.total - len(self.head) - len(self.tail)
            gap = f"\n…[вырезано {cut} байт]…\n".encode() if cut else b""
            return (bytes(self.head) + gap + bytes(self.tail)).decode(errors="replace")


def run_limited(command, cwd, timeout, shell, env=None):
    """Команда с таймаутом на всё дерево процессов и обрезанным выводом."""
    proc = subprocess.Popen(command, cwd=cwd, shell=shell, executable="/bin/bash" if shell else None,
                            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            start_new_session=True, env=env or child_env())
    ACTIVE.add(proc)
    GROUPS.add(proc.pid)
    drain = Drain(proc.stdout, CONFIG["output_limit"])
    drain.start()
    note = ""
    try:
        code = proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        kill(proc)
        note = f"\n[команда прервана ночным контроллером: дольше {timeout} с]"
        code = 124
    finally:
        ACTIVE.discard(proc)
    # Без фоновых потомков конец канала приходит сразу за оболочкой; с ними — не ждём.
    drain.join(timeout=1)
    return code, clip(drain.text() + note, CONFIG["output_limit"])


def alive(pgid):
    try:
        os.killpg(pgid, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False


def kill_groups(grace=2.0):
    """Всё, что запускали команды задачи, включая ушедшее в фон.

    SIGTERM — сразу всем группам, общее ожидание, SIGKILL — оставшимся. По очереди нельзя:
    ядро, останавливая задачу, шлёт SIGTERM и через 5 секунд SIGKILL, и уборка, ждущая
    упрямые группы одну за другой, была бы прервана на середине — часть серверов пережила
    бы задачу. Здесь весь путь занимает не больше grace + доли секунды."""
    groups = [g for g in GROUPS if alive(g)]
    for sig in (signal.SIGTERM, signal.SIGKILL):
        for pgid in groups:
            try:
                os.killpg(pgid, sig)
            except (ProcessLookupError, PermissionError):
                pass
        deadline = time.monotonic() + grace
        while groups and time.monotonic() < deadline:
            groups = [g for g in groups if alive(g)]
            time.sleep(0.05)
        if not groups:
            break
    GROUPS.clear()


def stop(_number, _frame):
    # Ядро гасит группу процессов обёртки, а команды живут в своих сессиях: без этого
    # тесты и серверы, запущенные автором, пережили бы задачу.
    kill_groups()
    raise SystemExit(143)


# Проверено по 20 ночным сессиям Zoo Code (2026-09-26): пишущих git-команд там нет ни одной,
# читающие — diff 75, status 60, show 31, log 8, rev-parse, ls-files, check-ignore.
GIT_OPTIONS_WITH_VALUE = {"-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"}
COMMAND_POSITION = {";", "&&", "||", "|", "(", "then", "do", "else", "time", "nohup", "xargs", "env"}


def git_subcommands(words):
    """Подкоманды git, стоящего в позиции команды. `grep git x` — не git."""
    for index, word in enumerate(words):
        if Path(word).name != "git" or (index and words[index - 1] not in COMMAND_POSITION
                                        and not words[index - 1].endswith(";")):
            continue
        rest, skip = words[index + 1:], False
        for item in rest:
            if skip:
                skip = False
            elif item in GIT_OPTIONS_WITH_VALUE:
                skip = True   # у -C и -c есть значение: `git -C /путь diff`
            elif item.startswith("-"):
                continue
            else:
                yield item
                break
        else:
            yield ""


def command_refusal(command):
    if "refs_shift" in command:
        return f"`{command}`: номера ссылок правит контроллер после задачи, не автор"
    try:
        words = shlex.split(command, comments=True)
    except ValueError:
        words = command.split()
    for sub in git_subcommands(words):
        if sub not in GIT_READ_ONLY:
            return (f"`{command}`: git {sub or '(без подкоманды)'} меняет репозиторий; "
                    f"можно только {', '.join(sorted(GIT_READ_ONLY))}")
    if shared_machine():
        for index, word in enumerate(words):
            # `(yes > /dev/null &)` и `$(pkill …)` shlex отдаёт словом со скобкой впереди.
            name = Path(word.lstrip("($`{")).name
            if name in SHARED_MACHINE and (not index or word[0] in "($`{" or words[index - 1] in COMMAND_POSITION
                                           or words[index - 1].endswith((";", "&", "|"))):
                return f"`{command}`: {shared_refusal(name)}"
    return None


DONE_QUESTION = ("Задача закончена? Если да — ответь без правок и команд отчётом: что изменил, "
                 "какие команды и проверки гонял и с каким итогом; после такого ответа "
                 "запустятся машинные проверки задачи. Если нет — продолжай. Если выполнить "
                 "нельзя — начни с «НЕ МОГУ: <причина>».")


def main(config_path):
    try:
        return drive(config_path)
    finally:
        kill_groups()
        if GUARD_DIR:
            shutil.rmtree(GUARD_DIR, ignore_errors=True)


def drive(config_path):
    global CONFIG, ROOT, OUTPUTS
    CONFIG = json.loads(Path(config_path).read_text())
    ROOT = Path(CONFIG["root"]).resolve()
    OUTPUTS = list(CONFIG["outputs"])
    signal.signal(signal.SIGTERM, stop)
    if CONFIG.get("env_file"):
        load_env(CONFIG["env_file"])
    install_git_guard(CONFIG["guard_dir"])
    install_shared_guard(CONFIG["guard_dir"])

    import aider.coders.base_coder as base_coder
    from aider.coders import Coder
    from aider.history import ChatSummary
    from aider.io import InputOutput
    from aider.models import Model
    from aider.repo import GitRepo

    stats = {"commands": [], "refused": [], "read_added": [], "checks_runs": 0, "checks_green": None,
             "command_log": [], "final_reply": "", "cannot": "", "aider_errors": []}

    def run_model_command(command, verbose=False, error_print=None, cwd=None):
        code, out = run_limited(command, cwd or ROOT, CONFIG["command_timeout"], shell=True, env=guarded_env())
        # Журнал уходит приёмщику как доказательство: он читает отчёт автора целиком и
        # бракует «мутация не подтверждена», если прогонов автора не видно.
        tail = out.strip().splitlines()[-3:] if out.strip() else []
        stats["command_log"].append(f"$ {command.replace(chr(10), ' ⏎ ')} → код {code}"
                                    + ("; " + " / ".join(tail) if tail else ""))
        return code, out

    base_coder.run_cmd = run_model_command

    pending = []
    DROPPED = {"Create new file?", "Allow edits to file that has not been added to the chat?"}

    class NightIO(InputOutput):
        # Ошибки самого aider и litellm — отдельным списком для причины браковки. Искать их
        # в логе по слову «Error» нельзя: туда пишутся ответы модели и строки её команд, и
        # «AssertionError» из процитированного вывода тестов становился «aider сообщил: …».
        # litellm печатает исключение предупреждением, а под ним — пояснение ошибкой
        # (`check_and_open_urls`), поэтому из предупреждений берутся только его строки.
        def tool_error(self, message="", strip=True):
            if str(message).strip():
                stats["aider_errors"].append(str(message).strip().splitlines()[0][:300])
            super().tool_error(message, strip)

        def tool_warning(self, message="", strip=True):
            if str(message).strip().startswith("litellm."):
                stats["aider_errors"].append(str(message).strip().splitlines()[0][:300])
            super().tool_warning(message, strip)

        def confirm_ask(self, question, default="y", subject=None, explicit_yes_required=False,
                        group=None, allow_never=False):
            asked = question.strip()
            if asked.startswith("Run shell command"):
                lines = [c for c in (subject or "").splitlines() if c.strip() and not c.strip().startswith("#")]
                refusals = [r for r in map(command_refusal, lines) if r]
                stats["refused"] += refusals
                ok = not refusals
                if ok:
                    # Блок — одна команда: он и выполняется одним скриптом. Счёт по строкам
                    # писал приёмщику «команд 58» при одиннадцати запусках (живая проба).
                    stats["commands"].append("\n".join(lines))
            else:
                ok = asked in YES
                if asked in DROPPED:
                    # aider пишет «Skipping edits» только в лог: модель считала правку
                    # сделанной и отчитывалась о ней.
                    pending.append(f"Правка {subject} ОТКЛОНЕНА — файла нет среди outputs. "
                                   f"Править можно только: {', '.join(OUTPUTS)}.")
            self.tool_output(f"[ночь] {asked} {subject or ''} → {'да' if ok else 'нет'}")
            return ok

    def outputs_state():
        return {name: (ROOT / name).read_bytes() if (ROOT / name).is_file() else None for name in OUTPUTS}

    checked = {"state": None}
    counting = (ROOT / "frontend_vue" / refs_shift.RESOLVER_SPEC).is_file()
    # Документы, которым есть чем проверяться: резолвер или ссылки из roo_code/ (refs_shift).
    docs = [name for name in OUTPUTS if name.endswith(".md")
            and (counting or (ROOT / "roo_code").is_dir())]

    def broken(doc):
        """Битые ссылки документа — та же команда и тот же разбор, что у ядра."""
        if not (ROOT / doc).is_file():
            return 0, ""
        code, out = run_limited(refs_shift.link_check_argv(doc), ROOT / "frontend_vue",
                                CONFIG["check_timeout"], shell=False)
        return refs_shift.broken_links(out), out

    links_before = {doc: broken(doc)[0] for doc in docs} if counting else {}
    stats["links_before"] = links_before
    shown = set()   # (документ, строка) уже показанных ссылок — показываются один раз

    def link_failures():
        failures = []
        for doc, before in links_before.items():
            after, out = broken(doc)
            if before is not None and (after is None or after > before):
                failures.append(f"{doc}: битых ссылок было {before}, стало {after} — ядро забракует "
                                f"задачу. Отчёт резолвера:\n{out}")
        return failures

    def changed_links():
        """Ссылки моих документов на изменившиеся строки: контроллер их не тронет."""
        try:
            _, eyes = refs_shift.survey(ROOT)
        except Exception as error:  # отчёт не должен ронять автора; ядро проверит само
            stats["aider_errors"].append(f"refs_shift: {error}"[:300])
            return None
        fresh = [item for item in eyes if item["документ"] in OUTPUTS
                 and (item["документ"], item["строка"]) not in shown]
        if not fresh:
            return None
        shown.update((item["документ"], item["строка"]) for item in fresh)
        lines = "\n".join(f"- {i['документ']}:{i['строка']} — `{i['было']}` (механический сдвиг дал бы "
                          f"`{i['стало']}`, но строка-цель изменилась)" for i in fresh)
        return ("Ссылки в твоих документах указывают на строки кода, которые ты изменил. Контроллер "
                "их не перенумерует. Для каждой: найди, где теперь то, о чём говорит предложение, и "
                "поставь этот номер; в том же предложении должен стоять токен в бэктиках, который "
                "ЕСТЬ на целевой строке, — резолвер проверит его. Ссылка всё ещё верна — оставь.\n"
                + lines)

    def run_checks():
        checked["state"] = outputs_state()
        failures = []
        for check in CONFIG["checks"]:
            code, out = run_limited(check["argv"], ROOT / check["cwd"], CONFIG["check_timeout"], shell=False)
            if code:
                failures.append(f"$ cd {check['cwd']} && {shlex.join(check['argv'])}  → код {code}\n{out}")
        failures += link_failures()
        stats["checks_runs"] += 1
        stats["checks_green"] = not failures
        note = changed_links()
        if failures:
            return ("Машинные проверки задачи упали. Их же погонит приёмка — почини:\n\n"
                    + "\n\n".join(failures) + (f"\n\n{note}" if note else ""))
        return note

    # Строкой — только для системного промпта aider («the user prefers this test command»):
    # модель знает, какие проверки её ждут, и может запустить их сама командой.
    checks = "; ".join(f"(cd {c['cwd']} && {shlex.join(c['argv'])})" for c in CONFIG["checks"])

    io = NightIO(pretty=False, fancy_input=False, chat_history_file=CONFIG["chat_history"],
                 input_history_file=CONFIG["input_history"], root=str(ROOT))
    model = Model(CONFIG["model"])
    repo = GitRepo(io, OUTPUTS, str(ROOT), models=model.commit_message_models())
    coder = Coder.create(
        main_model=model, edit_format=CONFIG["edit_format"], io=io, repo=repo,
        fnames=OUTPUTS, read_only_fnames=CONFIG["sources"], auto_commits=False, dirty_commits=False,
        map_tokens=model.get_repo_map_tokens(), stream=False, auto_lint=False,
        auto_test=False, test_cmd=checks or None,
        # aider сжимает историю уже после 8192 токенов — это его потолок, а не модели (1M у
        # deepseek-flash). В агентском цикле это два-три вывода команд: старые ходы ушли бы
        # в пересказ, и модель чинила бы по памяти, а не по выводу.
        summarizer=ChatSummary([model.weak_model, model], CONFIG.get("history_tokens", 65536)),
        suggest_shell_commands=True, detect_urls=False, restore_chat_history=False,
        # Язык aider берёт из локали, а у ночи она английская: системный промпт требовал
        # «Reply in English», и живая проба отчиталась по-английски. Проект, документы и
        # отчёты Zoo-автора — русские.
        chat_language="Russian")
    coder.max_reflections = CONFIG["max_reflections"]

    def mentions(content):
        added, refused = [], []
        for rel in sorted(coder.get_file_mentions(content) - coder.ignore_mentions):
            coder.ignore_mentions.add(rel)
            path = Path(coder.abs_root_path(rel))
            if not path.is_file():
                continue
            if (len(stats["read_added"]) >= CONFIG["max_read_files"]
                    or path.stat().st_size > CONFIG["read_file_limit"]):
                refused.append(rel)
                continue
            coder.abs_read_only_fnames.add(str(path))
            added.append(rel)
            stats["read_added"].append(rel)
        notes = []
        if added:
            notes.append(f"Добавил в чат ТОЛЬКО ДЛЯ ЧТЕНИЯ: {', '.join(added)}. "
                         f"Править можно только: {', '.join(OUTPUTS)}.")
        if refused:
            # Молча пропустить нельзя: модель просила файл и ждала его. Потолок (45 —
            # над максимумом Zoo-автора, 44) достижим, а молчание стоило бы задачи.
            notes.append(f"НЕ открыл (потолок {CONFIG['max_read_files']} файлов или "
                         f"{CONFIG['read_file_limit']} байт): {', '.join(refused)}. "
                         "Читай их командой — `grep -n <слово> <файл>` или `sed -n '<от>,<до>p' <файл>`.")
        if not notes:
            return None
        note = " ".join(notes)
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

    def run_block(commands_str, group):
        """Блок команд — одним скриптом, как у Zoo. aider гонит его построчно: `cd` из
        первой строки не доживал до второй, heredoc и многострочный цикл рвались на
        синтаксические ошибки. У Zoo таких команд 40 на 20 ночных сессий, 23 — heredoc."""
        block = commands_str.strip()
        if not io.confirm_ask("Run shell commands?", subject=block, explicit_yes_required=True, group=group):
            return None
        code, out = run_model_command(block)
        # Код возврата — всегда: у aider его нет вовсе, а блок без вывода (`test -f`,
        # `grep -q`) не давал модели хода — задача обрывалась на полуслове. Zoo код
        # возврата показывал в каждом ответе на команду.
        return f"Выполнено (код возврата {code}):\n$ {block}\n{out}\n"

    coder.handle_shell_commands = run_block
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
    send = coder.send_message
    declared = {"done": False}

    def send_then_check(message):
        """Конец хода без продолжения — место решения о проверках.

        Ход, которому aider уже назначил продолжение (вывод команд, открытые файлы,
        несработавшая правка), решения не требует. Остальное: ответ без правок и команд —
        модель объявила работу сделанной, гоняем checks; правка до такого ответа —
        спрашиваем, закончена ли задача; правка после него — это починка, гоняем сразу.
        Outputs не менялись с прошлого прогона — повторять нечего: модель, ответившая
        на красные проверки одними словами, иначе получала бы тот же вывод до потолка."""
        yield from send(message)
        content = coder.partial_response_content or ""
        if coder.reflected_message or CANNOT.search(content):
            return
        if ACTING.search(content) and not declared["done"]:
            coder.reflected_message = DONE_QUESTION
            return
        declared["done"] = True
        if (CONFIG["checks"] or docs) and checked["state"] != outputs_state():
            coder.reflected_message = run_checks()

    coder.send_message = send_then_check
    # preproc=False: промпт ядра упоминает десятки документов, и aider подтянул бы их все.
    # Нужное модель попросит сама — упоминанием в ответе, и получит только для чтения.
    coder.run(with_message=Path(CONFIG["message"]).read_text(), preproc=False)
    last = coder.partial_response_content or ""
    if ACTING.search(last) and not CANNOT.search(last):
        # Закончила правкой или командой — отчёта нет, а приёмщик читает именно его.
        # «НЕ МОГУ» рядом с правкой — уже отчёт: просьба о новом дала бы ответ «Готово»,
        # и он затёр бы отказ — задача ушла бы в done.
        # Один короткий ход; правки в нём по-прежнему только в outputs. Упоминания файлов
        # здесь не подтягиваются: отчёт их называет, и подтянутый файл дал бы ещё ход,
        # ответ которого затёр бы сам отчёт.
        coder.check_for_file_mentions = lambda content: None
        coder.run(with_message=("Задача закончена? Ответь без правок и команд отчётом: что "
                                "изменил, какие команды и проверки гонял и с каким итогом. "
                                "Если выполнить нельзя — начни с «НЕ МОГУ: <причина>»."),
                  preproc=False)
    if (CONFIG["checks"] or docs) and checked["state"] != outputs_state():
        # Итог проверок нужен приёмщику и тогда, когда модель работу сделанной не объявила
        # (НЕ МОГУ, потолок ходов) или объявила до последней правки: отчитываемся о тех
        # файлах, что уходят ядру, а не о прошлом прогоне.
        run_checks()
    # Последний ответ модели — её отчёт: код и правки из него вырезаются, остаётся текст.
    reply = re.sub(r"```.*?```", " ", coder.partial_response_content or "", flags=re.DOTALL)
    reply = re.sub(r"<{5,9} SEARCH.*?>{5,9} REPLACE", " ", reply, flags=re.DOTALL)
    stats["final_reply"] = " ".join(reply.split())[:1500]
    cannot = CANNOT.search(coder.partial_response_content or "")
    stats["cannot"] = cannot.group(1).strip()[:400] if cannot else ""
    stats.update(tokens_sent=coder.total_tokens_sent, tokens_received=coder.total_tokens_received,
                 cost=round(coder.total_cost, 4), reflections=coder.num_reflections)
    Path(CONFIG["stats"]).write_text(json.dumps(stats, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    if sys.argv[1] == "--git-guard":
        sys.exit(git_guard(sys.argv[2], sys.argv[3:]))
    sys.exit(main(sys.argv[1]))
