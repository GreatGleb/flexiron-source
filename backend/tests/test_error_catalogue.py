"""Каталог кодов отказа — контракт называет каждый, разбором AST, без БД и без приложения.

Три вещи, которые сторож утверждает:

1. Каждый код, который бэкенд может отдать наружу, назван контрактом. Коды собираются по
   всему `app/` из аргументов `code="…"` у вызовов исключений и из литералов `"code": "…"`
   внутри словарей отказа (сосед — литеральный ключ `"message"`, форма §1 соглашений). Код,
   поднятый в `app/modules/<модуль>/…`, обязан встречаться либо в файле своего домена
   (`roo_code/roo-context/api/<модуль>.md`), либо в `00-conventions.md`. Код, поднятый в
   `app/core/`, этому требованию не подчиняется — у ядра нет доменного файла контракта.
2. Ни один отказ не уходит без кода. `raise HTTPException(...)` обязан нести `detail` —
   словарь, а не строку, — и этот словарь несёт ровно ключи `message` и `code`, ни одним
   больше и ни одним меньше. `ApiResponse(success=False)` в проекте не встречается вовсе —
   у отказа обёртки нет по §1 соглашений (три формы конверта — только у успеха).
3. Исключения из требования (1) — закрытым поимённым списком с причиной у каждой строки,
   и список охраняется тестом устаревания: код, который контракт уже назвал, или которого
   в коде больше нет, обязан быть убран.

    cd backend && python3 -m pytest tests/test_error_catalogue.py -q
"""

from __future__ import annotations

import ast
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
APP = BACKEND / "app"
CONTRACT_DIR = BACKEND.parent / "roo_code" / "roo-context" / "api"
CONVENTIONS_FILE = "00-conventions.md"

# Список закрыт поимённо, с причиной у каждой строки. Новый код сюда не добавляется в обход
# требования (1) — он либо называется контрактом, либо чинится в коде.
#
# `SECRET_UNREADABLE` — код ядра (`app/core/crypto.py`, шифрование пароля почтового сервера
# настроек, П59): у `app/core/` нет и не может быть доменного файла контракта, а переписывать
# `00-conventions.md` под код, который не про домен, а про инфраструктуру, задача запрещает.
KNOWN_UNDOCUMENTED_CODES: dict[str, str] = {
    "SECRET_UNREADABLE": (
        "app/core/crypto.py — код ядра (SecretCryptoError, шифрование пароля почтового "
        "сервера настроек), а не домена; своего файла контракта у app/core нет и не будет"
    ),
}


def _rel(path: Path) -> str:
    return str(path.relative_to(BACKEND))


def _py_files() -> list[Path]:
    return sorted(APP.rglob("*.py"))


def _own_module(path: Path) -> str | None:
    """Домен файла — второй сегмент под `app/modules/`, или `None` для `app/core` и `app/main.py`."""
    parts = path.relative_to(BACKEND).parts
    if len(parts) >= 3 and parts[0] == "app" and parts[1] == "modules":
        return parts[2]
    return None


def _str_const(node: ast.AST | None) -> str | None:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def _codes_from_call_kwargs(tree: ast.Module) -> list[tuple[int, str]]:
    """`code="…"` у любого вызова — конструктор исключения (`ConflictError(...)` и соседи)."""
    out: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        for kw in node.keywords:
            if kw.arg == "code":
                value = _str_const(kw.value)
                if value is not None:
                    out.append((node.lineno, value))
    return out


def _codes_from_detail_dicts(tree: ast.Module) -> list[tuple[int, str]]:
    """Литералы `"code": "…"` внутри словаря, несущего и `"message"` — форма отказа §1.

    Соседство с `"message"` — не украшение, а фильтр: он не даёт спутать код отказа с
    посторонним словарём, у которого случайно есть ключ `code` (например, тело записи
    валюты в `crud/domain.py`, где `"code"` — код валюты, а не код отказа, и его значение —
    вызов `.strip().upper()`, а не строковый литерал, так что фильтр по значению уже отсёк
    бы его и без этого соседства).
    """
    out: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Dict):
            continue
        keys = [_str_const(k) for k in node.keys]
        if "message" not in keys or "code" not in keys:
            continue
        value = _str_const(node.values[keys.index("code")])
        if value is not None:
            out.append((node.lineno, value))
    return out


def _all_codes() -> dict[str, list[str]]:
    """код -> список `файл:строка`, где он объявлен литералом хотя бы одним из двух путей."""
    by_code: dict[str, list[str]] = {}
    for path in _py_files():
        tree = ast.parse(path.read_text(encoding="utf-8"))
        found = _codes_from_call_kwargs(tree) + _codes_from_detail_dicts(tree)
        for lineno, code in found:
            by_code.setdefault(code, []).append(f"{_rel(path)}:{lineno}")
    return by_code


def _contract_text(file_name: str) -> str:
    path = CONTRACT_DIR / file_name
    return path.read_text(encoding="utf-8") if path.is_file() else ""


def _all_contract_text() -> str:
    return "\n".join(_contract_text(p.name) for p in sorted(CONTRACT_DIR.glob("*.md")))


class ErrorCatalogueExtractorTest(unittest.TestCase):
    def test_extractor_floor(self) -> None:
        """Пол обхода: экстрактор, переставший находить код, даёт зелёный отчёт о пустоте —
        он хуже отсутствующей проверки. Числа взяты с запасом от замера на 2026-09-25:
        139 файлов `app/**/*.py`, 21 уникальный код."""
        files = _py_files()
        self.assertGreaterEqual(
            len(files), 30, "разбор перестал находить файлы app/**/*.py — сломан обход, а не код"
        )
        codes = _all_codes()
        self.assertGreaterEqual(
            len(codes),
            18,
            "экстрактор нашёл меньше 18 кодов — сломан экстрактор, а не код: "
            + ", ".join(sorted(codes)),
        )


class ErrorCatalogueContractTest(unittest.TestCase):
    """(1) Каждый код бэкенда назван контрактом — файлом своего домена или соглашениями."""

    def test_every_domain_code_is_named_in_contract(self) -> None:
        conventions_text = _contract_text(CONVENTIONS_FILE)
        undocumented: list[str] = []
        for code, locations in sorted(_all_codes().items()):
            if code in KNOWN_UNDOCUMENTED_CODES:
                continue
            for loc in locations:
                path = BACKEND / loc.split(":", 1)[0]
                module = _own_module(path)
                if module is None:
                    continue  # app/core — не домен, требование (1) сюда не относится
                domain_text = _contract_text(f"{module}.md")
                if code in domain_text or code in conventions_text:
                    continue
                undocumented.append(
                    f"{loc}: код {code} не назван ни в {module}.md, ни в {CONVENTIONS_FILE}"
                )
        self.assertEqual(
            [],
            undocumented,
            "код отказа не назван контрактом: " + "; ".join(undocumented),
        )


class RefusalHasNoEnvelopeTest(unittest.TestCase):
    """(2) Ни один отказ не уходит без кода, и у него нет конверта успеха."""

    def _http_exception_calls(self, tree: ast.Module) -> list[tuple[int, ast.AST | None]]:
        out: list[tuple[int, ast.AST | None]] = []
        for node in ast.walk(tree):
            if not (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Name)
                and node.func.id == "HTTPException"
            ):
                continue
            detail_kw = next((kw for kw in node.keywords if kw.arg == "detail"), None)
            out.append((node.lineno, detail_kw.value if detail_kw else None))
        return out

    def test_every_refusal_carries_a_message_and_code_dict(self) -> None:
        checked = 0
        bad: list[str] = []
        for path in _py_files():
            tree = ast.parse(path.read_text(encoding="utf-8"))
            for lineno, detail_value in self._http_exception_calls(tree):
                checked += 1
                rel = _rel(path)
                if detail_value is None:
                    bad.append(f"{rel}:{lineno} — HTTPException без detail")
                    continue
                if not isinstance(detail_value, ast.Dict):
                    bad.append(
                        f"{rel}:{lineno} — detail не словарь (строка вместо {{message, code}})"
                    )
                    continue
                keys = sorted(
                    k.value
                    for k in detail_value.keys
                    if isinstance(k, ast.Constant) and isinstance(k.value, str)
                )
                if keys != ["code", "message"]:
                    bad.append(
                        f"{rel}:{lineno} — detail несёт ключи {keys}, а не ровно message и code"
                    )

        self.assertGreaterEqual(
            checked, 15, "обход перестал находить HTTPException — сломан обход, а не код"
        )
        self.assertEqual([], bad, "отказ без кода или с чужой формой detail: " + "; ".join(bad))

    def test_no_envelope_on_a_refusal(self) -> None:
        """`ApiResponse(success=False)` не встречается — конверта у отказа нет (§1)."""
        hits: list[str] = []
        for path in _py_files():
            tree = ast.parse(path.read_text(encoding="utf-8"))
            for node in ast.walk(tree):
                if not (
                    isinstance(node, ast.Call)
                    and isinstance(node.func, ast.Name)
                    and node.func.id == "ApiResponse"
                ):
                    continue
                for kw in node.keywords:
                    if kw.arg == "success" and isinstance(kw.value, ast.Constant) and kw.value.value is False:
                        hits.append(f"{_rel(path)}:{node.lineno}")
        self.assertEqual([], hits, "ApiResponse(success=False) встречается: " + ", ".join(hits))


class KnownUndocumentedCodesTest(unittest.TestCase):
    """(3) Список исключений закрыт, поимённый, и не переживает свою причину."""

    def test_known_codes_are_not_stale_lists(self) -> None:
        for code in KNOWN_UNDOCUMENTED_CODES:
            self.assertTrue(code, "пустая строка кода в закрытом списке")

    def test_known_codes_still_exist_in_code(self) -> None:
        by_code = _all_codes()
        for code in KNOWN_UNDOCUMENTED_CODES:
            self.assertIn(
                code,
                by_code,
                f"{code} стоит в закрытом списке, но такого кода в коде больше нет — строку убрать",
            )

    def test_known_codes_are_still_undocumented(self) -> None:
        """Код, который контракт уже называет, обязан выйти из списка — иначе сторож про
        него молчит и находка, для которой список заведён, переживает свою починку."""
        contract_text = _all_contract_text()
        for code in KNOWN_UNDOCUMENTED_CODES:
            self.assertNotIn(
                code,
                contract_text,
                f"{code} уже назван контрактом — убери строку из KNOWN_UNDOCUMENTED_CODES",
            )


if __name__ == "__main__":
    unittest.main()
