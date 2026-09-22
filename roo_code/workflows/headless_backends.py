"""Исполнители автономного прогона за одним контрактом.

Ядро (`codex-night.py`) не знает, кто именно делает задачу. Оно даёт адаптеру роль
(`work` или `review`), промпт и путь, по которому обязан появиться результат
`{"status","summary","evidence"}`. Всё остальное — дело адаптера.

Роли назначаются бэкендам файлом маршрутизации, поэтому связка меняется правкой JSON,
а не кода: всё на Claude Code, всё на Codex, автор Zoo Code/DeepSeek с приёмкой Claude Code.

Границы правок, неизменность Git, машинные проверки и коммиты остаются в ядре: адаптер
не имеет права ничего из этого решать, иначе новый бэкенд молча ослабит политику прогона.
"""

import json
import os
import re
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROLES = ("work", "review")
DEFAULT_ROUTING_PATH = HERE / "headless-routing.json"


# Схему результата Codex навязывает сам через --output-schema. Остальным её держать нечем,
# поэтому она проговаривается в промпте буквально, с типами: первая же проба вернула
# evidence строкой вместо массива, и ядро отвергло работу как невыполненную.
SCHEMA_INSTRUCTION = (
    "Верни ровно один JSON-объект: "
    '{"status": "done" | "blocked", "summary": "<строка, одно предложение>", '
    '"evidence": ["<строка>", ...]}. '
    "evidence — всегда массив строк, даже если доказательство одно; при status=done он непустой.\n"
)


class Backend:
    """Общий контракт. Реализация обязана оставить результат в result_path."""

    name = "?"
    # Только Codex печатает распознаваемые события сбоя сервиса, по которым ядро
    # повторяет приёмку. Для остальных повтор запрещён: причина сбоя неизвестна.
    supports_service_retry = False
    # Считается ли расход этого бэкенда в потолок прогона. Потолок защищает
    # недельный лимит Claude; Codex и DeepSeek оплачиваются отдельно и своими
    # лимитами, поэтому в общий счёт не идут.
    metered = False

    def __init__(self, options=None):
        self.options = dict(options or {})

    def check(self):
        """Поднять ValueError, если бэкенд не может работать. Зовётся из preflight."""
        raise NotImplementedError

    def result_instruction(self, result_path):
        """Добавка к промпту, если результат не забирается командой автоматически."""
        return ""

    def build(self, role, root, run_dir, result_path):
        raise NotImplementedError

    def finalize(self, role, prefix, result_path):
        """Зовётся после команды: превратить вывод в файл результата, если нужно."""
        return None

    def tokens(self, prefix):
        """Сколько токенов стоил вызов. Неизвестно — ноль, и бэкенд не metered."""
        return 0


class CodexBackend(Backend):
    """Codex CLI. Схема результата навязана самим CLI через --output-schema."""

    name = "codex"
    supports_service_retry = True

    @property
    def binary(self):
        return self.options.get("binary", "codex")

    def check(self):
        if not shutil.which(self.binary):
            raise ValueError(f"Codex CLI не найден: {self.binary}")

    def build(self, role, root, run_dir, result_path):
        return [self.binary, "-a", "never", "exec", "--sandbox",
                "read-only" if role == "review" else "workspace-write", "--json",
                "--output-schema", str(run_dir / "schema.json"),
                "--output-last-message", str(result_path), "-"]


class ClaudeBackend(Backend):
    """Claude Code в режиме --print.

    Файла результата у него нет: он печатает JSON сессии в stdout. Адаптер достаёт
    оттуда поле result и сам кладёт его туда, где результат ждёт ядро, — просить
    модель записать файл нельзя, у проверяющего нет права записи по построению.
    """

    name = "claude"
    metered = True
    DEFAULT_BINARY = str(Path.home() / ".vscode/extensions/anthropic.claude-code-2.1.278-linux-x64"
                                        "/resources/native-binary/claude")

    @property
    def binary(self):
        return self.options.get("binary", self.DEFAULT_BINARY)

    def check(self):
        if not shutil.which(self.binary):
            raise ValueError(f"Claude Code CLI не найден: {self.binary}")

    def result_instruction(self, result_path):
        return SCHEMA_INSTRUCTION + "Это твой последний вывод: ни пояснений вокруг, ни разметки.\n"

    def build(self, role, root, run_dir, result_path):
        argv = [self.binary, "--print", "--output-format", "json", "--add-dir", str(root)]
        model = self.options.get("model")
        if model:
            argv += ["--model", model]
        if role == "review":
            # Проверяющий не выполняет команд и не пишет файлов. Ядро всё равно
            # сверит снимок файлов после него — это второй рубеж, а не первый.
            argv += ["--restricted", "--disallowedTools", "Write", "Edit", "NotebookEdit"]
        else:
            argv += ["--permission-mode", self.options.get("permission_mode", "bypassPermissions")]
        return argv

    def tokens(self, prefix):
        """Всё, что засчитает недельный лимит: вход, выход и обе стороны кэша.

        Чтение кэша здесь не «бесплатное»: на замеренной задаче оно давало 85–90%
        всего расхода. Потолок, считающий только вход и выход, не защитил бы ни от чего.
        Молча вернуть ноль нельзя: потолок, который не срабатывает, хуже отсутствующего.
        """
        printed = json.loads(prefix.with_suffix(".stdout.log").read_text())
        usage = printed.get("modelUsage")
        if not isinstance(usage, dict) or not usage:
            raise RuntimeError(f"В выводе {prefix.name} нет учёта токенов (modelUsage)")
        return sum(int(model.get("inputTokens", 0)) + int(model.get("outputTokens", 0))
                   + int(model.get("cacheCreationInputTokens", 0))
                   + int(model.get("cacheReadInputTokens", 0))
                   for model in usage.values())

    def finalize(self, role, prefix, result_path):
        printed = json.loads(prefix.with_suffix(".stdout.log").read_text())
        if printed.get("is_error"):
            raise RuntimeError(f"Claude Code вернул ошибку: {printed.get('result', '')[:400]}")
        result_path.write_text(extract_json_object(printed.get("result", "")))


class ZooBackend(Backend):
    """Zoo Code через IPC-сокет расширения.

    Управление снято с dist расширения и проверено вживую 2026-09-22: терминальное
    событие — taskIdle, а не taskCompleted. Разбор потока и запись результата — в
    zoo-ipc-client.mjs; здесь только сборка команды и проверка доступности.
    """

    name = "zoo"

    @property
    def socket(self):
        return self.options.get("socket", os.environ.get("ROO_CODE_IPC_SOCKET_PATH", ""))

    def check(self):
        if not shutil.which(self.options.get("node", "node")):
            raise ValueError("Не найден node для клиента Zoo Code")
        if not self.socket:
            raise ValueError("Не задан сокет Zoo Code: routing.socket или ROO_CODE_IPC_SOCKET_PATH")
        if not Path(self.socket).is_socket():
            raise ValueError(f"Сокет Zoo Code недоступен: {self.socket}. "
                             "VS Code должен быть запущен с ROO_CODE_IPC_SOCKET_PATH")

    def result_instruction(self, result_path):
        return SCHEMA_INSTRUCTION + "Отдай его через attempt_completion, без текста вокруг.\n"

    def build(self, role, root, run_dir, result_path):
        argv = [self.options.get("node", "node"), str(HERE / "zoo-ipc-client.mjs"),
                "--socket", self.socket, "--result", str(result_path),
                "--timeout", str(int(self.options.get("timeout_seconds", 3600)))]
        configuration = self.options.get("configuration")
        if configuration:
            argv += ["--config", json.dumps(configuration, ensure_ascii=False)]
        return argv


BACKENDS = {backend.name: backend for backend in (CodexBackend, ClaudeBackend, ZooBackend)}


def extract_json_object(text):
    """Достать объект результата из текста модели: она любит обрамить его разметкой."""
    stripped = re.sub(r"^\s*```(?:json)?|```\s*$", "", text.strip(), flags=re.MULTILINE).strip()
    start, depth, in_string, escaped = stripped.find("{"), 0, False, False
    if start < 0:
        raise RuntimeError(f"В ответе нет JSON-объекта: {text[:400]}")
    for index in range(start, len(stripped)):
        char = stripped[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return stripped[start:index + 1]
    raise RuntimeError(f"JSON-объект в ответе не закрыт: {text[:400]}")


def load_routing(path, codex_binary=None):
    """Собрать исполнителей по ролям. Без файла — обе роли на Codex, как было до адаптеров."""
    if path is None:
        options = {"binary": codex_binary} if codex_binary else {}
        return {role: CodexBackend(options) for role in ROLES}
    routing = json.loads(Path(path).read_text())
    backends = {}
    for role in ROLES:
        if role not in routing:
            raise ValueError(f"В маршрутизации нет роли {role}")
        options = dict(routing[role])
        name = options.pop("backend", None)
        if name not in BACKENDS:
            raise ValueError(f"Неизвестный бэкенд для роли {role}: {name}")
        backends[role] = BACKENDS[name](options)
    if backends["work"].name == backends["review"].name and backends["work"].options == backends["review"].options:
        # Политика прогона: приёмку делает не тот, кто писал. Один и тот же бэкенд
        # с одной и той же моделью превращает приёмку в самопроверку.
        raise ValueError("Автор и проверяющий заданы одинаково: приёмка станет самопроверкой")
    return backends
