"""Мультиарендность (§5 `roo_code/plans/general/сквозное-tenancy-план.md`): Т1–Т8.

Отдельный файл от `test_route_auth.py` — тот сторожит аутентификацию (кто вошёл), этот
сторожит арендатора (что видит вошедший). Смешивание двух правил в одном списке
исключений значит потерять способность проверить любое из них по отдельности.

Разбор — тем же приёмом, что и `RouteAuthTest`/`TenantScopedGetterTest` из
`test_route_auth.py`: разбором `ast`, без импорта приложения (FastAPI и SQLAlchemy в
этом окружении не установлены, а проверка, которую нельзя запустить, — не проверка).

От того существующего стража этот отличается охватом и грубостью правила. Существующий
`TenantScopedGetterTest._is_tenant_scoped` умеет разворачивать вызов до соседней функции
того же файла, которая фильтрует. Здесь правило проще и грубее: функция обязана нести
`tenant_id ==` (или `Tenant.id ==`) **в собственном теле**, делегирование не
разворачивается. Это сознательно: грубое правило шире (смотрит весь `app/`, а не только
`repository.py`) и находит то, что разворачивающееся пропустило бы, — ценой того, что
несколько сегодняшних функций, безопасных по факту (сужение делегировано соседке того же
файла), тоже попадают в список и требуют строки-причины. Список не прячет это отличие —
он его называет.

Числа ниже сняты на сегодняшнем коде этого чекаута, а не перенесены из плана: план прямо
предупреждает, что его свип (37 / 22 / 15) мог устареть, и здесь это оказалось так —
между замером плана и этим кодом прошло несколько ночных прогонов
(`finance-payments-read-slice`, `auth-roles-lowercase-and-matrix-default` и другие),
которых план ещё не видел. Три из семи прежних дыр (`products` БАГ-14, обе функции)
и профильная запись (`update_user`) с тех пор закрыты кодом; взамен свип нашёл три
новых места, которых план не называл (см. `KNOWN_GAPS` ниже).
"""

from __future__ import annotations

import ast
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
APP = BACKEND / "app"


def _rel(path: Path) -> str:
    return str(path.relative_to(BACKEND))


def _all_py_files() -> list[Path]:
    return sorted(p for p in APP.rglob("*.py") if "__pycache__" not in p.parts)


def _model_files() -> list[Path]:
    return sorted(p for p in APP.rglob("models.py") if "__pycache__" not in p.parts)


def _action_files() -> list[Path]:
    return sorted(p for p in APP.rglob("action.py") if "__pycache__" not in p.parts)


def _functions(tree: ast.Module) -> list[ast.AsyncFunctionDef | ast.FunctionDef]:
    return [n for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]


def _builds_query(source: str) -> bool:
    """Функция считается запросом, если в `ast.unparse` её тела есть одна из трёх форм."""
    return any(token in source for token in ("select(", "update(", "db.delete("))


def _is_tenant_scoped(source: str) -> bool:
    """Требуется `tenant_id ==`, либо `Tenant.id ==` — обращение к самой таблице арендаторов."""
    return "tenant_id ==" in source or "Tenant.id ==" in source


# ─── §5.1. Три закрытых списка ──────────────────────────────────────────────
#
# Ключ у функций — (относительный путь, имя функции), не номер строки: строка съезжает
# от соседней правки, которая ничего не меняет в сужении, а список исключений не обязан
# идти в ногу с каждой перестановкой импорта. Переименование функции — это другая
# функция по построению, и запись обязана обновиться сама; это и проверяет
# `test_exception_lists_are_not_stale`.

TENANTLESS: dict[tuple[str, str], str] = {
    ("app/modules/auth/features/login/repository.py", "get_user_by_email"):
        "вход: резолвер личности до подтверждения арендатора (Т4). Какую из двух "
        "записей с одинаковым email вернуть, если он заведён в двух компаниях, решает "
        "П76 (компания определяется постоянной ссылкой при входе) — это вопрос про то, "
        "какую запись выбрать ПОСЛЕ поиска, а не про то, что этому поиску есть чем "
        "сузить SQL: арендатор здесь и есть то, что резолвер должен узнать.",
    ("app/modules/auth/features/magic_link/repository.py", "get_user_by_secret_link"):
        "резолвер по глобально уникальному секрету `secret_link_token` — арендатор ещё "
        "не известен и узнаётся из найденной записи (Т4).",
    ("app/modules/auth/features/me/repository.py", "get_user_by_id"):
        "резолвер: `user_id` взят из уже проверенного токена, и это единственный путь "
        "получить `CurrentUser.tenant_id` (`get_current_user` в "
        "`app/modules/auth/shared/dependencies.py` зовёт ровно эту функцию) — сузить "
        "нечем, арендатор узнаётся из результата (Т4).",
    ("app/modules/auth/features/register/repository.py", "get_tenant_by_slug"):
        "резолвер до создания арендатора — регистрация подбирает свободный slug для "
        "будущей компании (Т4): арендатора, которым можно было бы сузить, ещё нет.",
}

KNOWN_GAPS: dict[tuple[str, str], str] = {
    ("app/modules/auth/features/register/repository.py", "get_user_by_email"):
        "проверка уникальности email при регистрации ищет по всей таблице `users`, а не "
        "внутри будущего арендатора — П58 разрешает повтор email в разных компаниях, "
        "эта проверка запрещает его ложно (auth БАГ-13).",
    ("app/modules/auth/internal_api/interface.py", "get_profile_user_by_email"):
        "тот же класс БАГ-13 во втором месте — собственный докстринг функции называет "
        "её `Legacy global uniqueness check; company-aware email changes belong to C1`: "
        "починка отложена явно, а не забыта.",
    ("app/core/uploads/service.py", "delete_file"):
        "своего `tenant_id ==` в теле нет: функция получает уже найденную запись у "
        "`get_file_by_id` (та сама сужена) и вызывает `db.delete` на неё. Т3 требует, "
        "чтобы сужал сам писатель, а не читатель перед ним — здесь сужение есть, но не "
        "в этой функции.",
    ("app/modules/settings/features/warehouse_map/repository.py", "delete_map"):
        "тот же рисунок, что и `delete_file`: `get_map` сужает, `delete_map` сам не "
        "строит фильтр — своей строки `tenant_id ==` в теле функции нет (Т3).",
    ("app/modules/finance/features/payments/repository.py", "count_payments"):
        "`select(func.count())` строится в этой функции, а `tenant_id ==` лежит в "
        "`_filtered_query` — соседней функции того же файла, которую эта вызывает. Т2 "
        "требует, чтобы сужала именно вызывающая функция, а не сосед.",

    # Тот же рисунок, что у `count_payments`, и добавлены они тем же разбором: счётчик
    # строит `select(func.count())` над подзапросом, который ему собрал сосед того же
    # файла, получивший `tenant_id` аргументом. Проверено чтением каждой: сужение есть,
    # просто не в теле вызывающей. Грубость правила здесь названа, а не обойдена.
    ("app/modules/clients/features/read_clients/repository.py", "count_clients"):
        "считает над подзапросом `_filtered_query(tenant_id, …)` — соседки того же файла; "
        "своей строки `tenant_id ==` в теле нет (Т2).",
    ("app/modules/products/features/list_products/repository.py", "count_catalog"):
        "считает над подзапросом `_catalog_query(tenant_id, …)` — соседки того же файла; "
        "своей строки `tenant_id ==` в теле нет (Т2).",
    ("app/modules/warehouse/features/list_batches/repository.py", "count_batches"):
        "считает над подзапросом `_filtered_query(tenant_id, …)` — соседки того же файла; "
        "своей строки `tenant_id ==` в теле нет (Т2).",
    ("app/modules/warehouse/features/list_movements/repository.py", "count_movements"):
        "считает над подзапросом `_filtered_query(tenant_id, …)` — соседки того же файла; "
        "своей строки `tenant_id ==` в теле нет (Т2).",
    ("app/modules/notifications/features/feed/repository.py", "count_notifications"):
        "считает над подзапросом `_filtered_query(tenant_id, user_id, …)` — соседки того "
        "же файла; своей строки `tenant_id ==` в теле нет (Т2).",
    ("app/modules/notifications/features/feed/repository.py", "count_unread"):
        "тот же рисунок: сужение и по арендатору, и по пользователю делает соседка, "
        "которой переданы оба (Т2).",
    ("app/modules/finance/features/archive/repository.py", "count_archive_items"):
        "считает над подзапросом `_filtered_query(tenant_id, …)` — соседки того же файла; "
        "своей строки `tenant_id ==` в теле нет (Т2).",
    ("app/modules/products/features/patch_product/domain.py", "patch_product"):
        "домен не строит фильтр сам: товар берётся `get_product_for_update(db, id, "
        "tenant_id)`, и сужение живёт в репозитории (`Product.tenant_id == tenant_id`). "
        "Сюда функция попала потому, что свип смотрит весь `app/`, а не только "
        "`repository.py` (Т2).",
}

TENANT_TABLES_EXEMPT: dict[str, str] = {
    "tenants": "сам реестр арендаторов — категория В: тому, кто его обозначает, некого сужать.",
    "plans": "платформенный каталог тарифов, один на всю систему (категория В).",
    "plan_features": "платформенный каталог фич тарифа, один на всю систему (категория В).",
    "feature_definitions": "платформенный реестр ключей фич, один на всю систему (категория В).",
    "sessions": "арендатор наследуется через единственный обязательный `user_id` (категория Б).",
    "user_roles": "арендатор наследуется через единственный обязательный `user_id` (категория Б).",
}


def _sweep() -> tuple[int, int, list[tuple[str, str]]]:
    """(всего запросов, суженных, несуженных[(rel, funcname)])."""
    total = 0
    scoped = 0
    unscoped: list[tuple[str, str]] = []
    for path in _all_py_files():
        tree = ast.parse(path.read_text(encoding="utf-8"))
        rel = _rel(path)
        for fn in _functions(tree):
            source = ast.unparse(fn)
            if not _builds_query(source):
                continue
            total += 1
            if _is_tenant_scoped(source):
                scoped += 1
            else:
                unscoped.append((rel, fn.name))
    return total, scoped, unscoped


class QuerySweepTest(unittest.TestCase):
    def test_every_query_is_tenant_scoped(self) -> None:
        _, _, unscoped = _sweep()
        unexplained = [
            f"{rel} {name}"
            for rel, name in unscoped
            if (rel, name) not in TENANTLESS and (rel, name) not in KNOWN_GAPS
        ]
        self.assertEqual(
            [],
            unexplained,
            "несуженный запрос вне TENANTLESS и KNOWN_GAPS: " + ", ".join(unexplained),
        )

    def test_sweep_floor(self) -> None:
        """Пол проверки. Плановое число (2026-09-12) — 37, и его нельзя опускать без
        причины; сегодняшний свежий замер этого чекаута выше — 45, — и по правилу
        задачи ставится он, а не плановое число."""
        total, _, _ = _sweep()
        self.assertGreaterEqual(
            total, 45, "разбор перестал находить запросы — сломан экстрактор, а не код"
        )

    def test_tenantless_is_not_a_dump(self) -> None:
        """TENANTLESS длиннее десяти строк значит, что список стал свалкой (§5.1)."""
        self.assertLessEqual(len(TENANTLESS), 10)

    def test_exception_lists_are_not_stale(self) -> None:
        for rel, name in list(TENANTLESS) + list(KNOWN_GAPS):
            path = BACKEND / rel
            self.assertTrue(path.is_file(), f"в списке исключений нет файла: {rel}")
            tree = ast.parse(path.read_text(encoding="utf-8"))
            names = {fn.name for fn in _functions(tree)}
            self.assertIn(
                name, names, f"{rel}: функция {name} не найдена — переименована или удалена?"
            )

    def test_known_gaps_really_lack_scope(self) -> None:
        """Находка закрыта — строку из KNOWN_GAPS надо убрать (без этого исключение
        переживает починку и прячет место навсегда)."""
        fixed: list[str] = []
        for rel, name in KNOWN_GAPS:
            tree = ast.parse((BACKEND / rel).read_text(encoding="utf-8"))
            fn = next((f for f in _functions(tree) if f.name == name), None)
            self.assertIsNotNone(fn, f"{rel}: {name} не найдена")
            source = ast.unparse(fn)
            if not _builds_query(source) or _is_tenant_scoped(source):
                fixed.append(f"{rel} {name}")
        self.assertEqual(
            [], fixed, "находка уже починена — уберите строку из KNOWN_GAPS: " + ", ".join(fixed)
        )


# ─── §5.1, шестой тест. Модель без tenant_id обязана иметь категорию ──────────


def _assign_parts(stmt: ast.stmt) -> tuple[list[ast.expr] | None, ast.expr | None]:
    if isinstance(stmt, ast.Assign):
        return stmt.targets, stmt.value
    if isinstance(stmt, ast.AnnAssign) and stmt.value is not None:
        return [stmt.target], stmt.value
    return None, None


def _model_census() -> tuple[int, dict[str, tuple[str, str]]]:
    """(всего моделей, {tablename: (rel, classname)} для моделей без tenant_id)."""
    total = 0
    without: dict[str, tuple[str, str]] = {}
    for path in _model_files():
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(node, ast.ClassDef):
                continue
            tablename: str | None = None
            has_tenant = False
            for stmt in node.body:
                targets, value = _assign_parts(stmt)
                if not targets:
                    continue
                for target in targets:
                    if not isinstance(target, ast.Name):
                        continue
                    if target.id == "__tablename__" and isinstance(value, ast.Constant):
                        tablename = value.value
                    if target.id == "tenant_id":
                        has_tenant = True
            if tablename is None:
                continue
            total += 1
            if not has_tenant:
                without[tablename] = (_rel(path), node.name)
    return total, without


class ModelCategoryTest(unittest.TestCase):
    def test_every_model_has_a_category(self) -> None:
        total, without = _model_census()
        self.assertGreaterEqual(
            total, 49, "разбор перестал находить модели — сломан обход, а не код"
        )
        unexplained = [
            f"{rel} {cls} ({table})"
            for table, (rel, cls) in without.items()
            if table not in TENANT_TABLES_EXEMPT
        ]
        self.assertEqual(
            [],
            unexplained,
            "модель без tenant_id вне TENANT_TABLES_EXEMPT (Т8): " + ", ".join(unexplained),
        )

    def test_tenant_tables_exempt_is_not_stale(self) -> None:
        _, without_today = _model_census()
        for tablename in TENANT_TABLES_EXEMPT:
            self.assertIn(
                tablename,
                without_today,
                f"таблица {tablename} обзавелась tenant_id или исчезла — уберите строку",
            )


# ─── §5.2. Заглушки арендатора в коде нет ───────────────────────────────────

PLACEHOLDER_TENANT = "00000000-0000-0000-0000-000000000001"


class NoHardcodedTenantPlaceholderTest(unittest.TestCase):
    def test_no_hardcoded_placeholder_tenant(self) -> None:
        hits: list[str] = []
        for path in _all_py_files():
            text = path.read_text(encoding="utf-8")
            if PLACEHOLDER_TENANT not in text:
                continue
            for lineno, line in enumerate(text.split("\n"), start=1):
                if PLACEHOLDER_TENANT in line:
                    hits.append(f"{_rel(path)}:{lineno}")
        self.assertEqual(
            [], hits, "захардкоженный арендатор-заглушка найден: " + ", ".join(hits)
        )


# ─── §5.3. Роут не принимает арендатора параметром ──────────────────────────


def _is_route_handler(node: ast.AST) -> bool:
    if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        return False
    for dec in node.decorator_list:
        func = dec.func if isinstance(dec, ast.Call) else dec
        if isinstance(func, ast.Attribute) and isinstance(func.value, ast.Name) and func.value.id == "router":
            return True
    return False


class RouteDoesNotAcceptTenantIdTest(unittest.TestCase):
    def test_no_route_accepts_tenant_id_as_parameter(self) -> None:
        offenders: list[str] = []
        handlers_seen = 0
        for path in _action_files():
            tree = ast.parse(path.read_text(encoding="utf-8"))
            for node in ast.walk(tree):
                if not _is_route_handler(node):
                    continue
                handlers_seen += 1
                argnames = {a.arg for a in node.args.args} | {a.arg for a in node.args.kwonlyargs}
                if "tenant_id" in argnames:
                    offenders.append(f"{_rel(path)} {node.name}")
        self.assertGreaterEqual(
            handlers_seen, 30, "разбор перестал находить роуты — сломан экстрактор, а не код"
        )
        self.assertEqual(
            [],
            offenders,
            "роут принимает tenant_id параметром (Т1): " + ", ".join(offenders),
        )


# ─── §5.5. Уникальность считается парой с арендатором (Т6) ──────────────────
#
# У модели категории А каждый UniqueConstraint/unique=True либо начинается с
# `tenant_id` (форма 1), либо — когда столбцов ≥ 2 — несёт колонку `*_id` (кроме самого
# `tenant_id`), у которой в этой же модели объявлен ForeignKey на таблицу категории А
# (форма 2): пара уже тенантская через владельца, потому что PK владельца сам уникален
# по арендатору. Одиночная `*_id`-колонка без пары формы 2 не даёт: она означает «эта
# строка может быть только у одного арендатора во всём мире», а не «пара с владельцем».
# Категория В (`CATEGORY_V_TABLES`) из правила исключена целиком — Т6 про арендаторские
# таблицы, а не про платформенные.

CATEGORY_V_TABLES = {"tenants", "plans", "plan_features", "feature_definitions"}

UNIQUE_PAIR_EXEMPT: dict[tuple[str, str], str] = {
    ("User", "secret_link_token"):
        "глобально уникальный секрет ссылки-приглашения — единственное именованное "
        "исключение Т6: секрет обязан быть уникален вне арендатора, чтобы переход по "
        "ссылке нашёл ровно одну запись.",
    ("Session", "token_hash"):
        "тот же рисунок, что `secret_link_token`: хэш токена сессии ищется до того, как "
        "арендатор известен, и обязан быть уникален глобально, а не парой с ним.",
    ("StockItem", "product_id"):
        "warehouse №28 — единственная одиночная колонка без пары: два арендатора, "
        "купившие один и тот же товар, делят одну строку остатка. Находка, а не "
        "починка — эта задача её только фиксирует.",
}


def _parse_models() -> dict[str, dict]:
    """{classname: {table, has_tenant, fk: {col: target_table}, unique_sets: [(kind, name, cols)]}}"""
    info: dict[str, dict] = {}
    for path in _model_files():
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(node, ast.ClassDef):
                continue
            tablename: str | None = None
            has_tenant = False
            fk: dict[str, str] = {}
            unique_sets: list[tuple[str, str | None, list[str]]] = []

            for stmt in node.body:
                targets, value = _assign_parts(stmt)
                if not targets or value is None:
                    continue
                for target in targets:
                    if not isinstance(target, ast.Name):
                        continue
                    colname = target.id
                    if colname == "__tablename__" and isinstance(value, ast.Constant):
                        tablename = value.value
                    if colname == "tenant_id":
                        has_tenant = True
                    for sub in ast.walk(value):
                        if not isinstance(sub, ast.Call):
                            continue
                        callee = sub.func.id if isinstance(sub.func, ast.Name) else None
                        if callee == "ForeignKey" and sub.args and isinstance(sub.args[0], ast.Constant):
                            fk_target = sub.args[0].value
                            if isinstance(fk_target, str):
                                fk[colname] = fk_target.split(".")[0]
                    # column-level unique=True is a one-column unique set of its own
                    if isinstance(value, ast.Call) and any(
                        kw.arg == "unique" and isinstance(kw.value, ast.Constant) and kw.value.value is True
                        for kw in value.keywords
                    ):
                        unique_sets.append(("column", colname, [colname]))

            for stmt in node.body:
                if not (
                    isinstance(stmt, ast.Assign)
                    and any(isinstance(t, ast.Name) and t.id == "__table_args__" for t in stmt.targets)
                ):
                    continue
                value = stmt.value
                elts = value.elts if isinstance(value, ast.Tuple) else [value]
                for elt in elts:
                    if not isinstance(elt, ast.Call):
                        continue
                    callee = elt.func.id if isinstance(elt.func, ast.Name) else None
                    str_args = [a.value for a in elt.args if isinstance(a, ast.Constant) and isinstance(a.value, str)]
                    if callee == "UniqueConstraint":
                        name = next(
                            (kw.value.value for kw in elt.keywords if kw.arg == "name" and isinstance(kw.value, ast.Constant)),
                            None,
                        )
                        unique_sets.append(("UniqueConstraint", name, str_args))
                    elif callee == "Index":
                        is_unique = any(
                            kw.arg == "unique" and isinstance(kw.value, ast.Constant) and kw.value.value is True
                            for kw in elt.keywords
                        )
                        if not is_unique or not str_args:
                            continue
                        # First positional string is the index name, the rest are columns.
                        unique_sets.append(("Index", str_args[0], str_args[1:]))

            if tablename is not None:
                info[node.name] = {
                    "table": tablename,
                    "has_tenant": has_tenant,
                    "fk": fk,
                    "unique_sets": unique_sets,
                }
    return info


def _find_unique_violations(models: dict[str, dict]) -> list[tuple[str, str, list[str]]]:
    category_a_tables = {m["table"] for m in models.values() if m["has_tenant"]}
    violations: list[tuple[str, str, list[str]]] = []
    for classname, model in models.items():
        if model["table"] in CATEGORY_V_TABLES:
            continue
        fk = model["fk"]
        for kind, name, cols in model["unique_sets"]:
            if not cols:
                continue
            form1 = cols[0] == "tenant_id"
            form2 = len(cols) >= 2 and any(
                col != "tenant_id" and col.endswith("_id") and fk.get(col) in category_a_tables
                for col in cols
            )
            if not (form1 or form2):
                label = name or f"{kind}({', '.join(cols)})"
                violations.append((classname, label, cols))
    return violations


class UniqueConstraintsArePairedTest(unittest.TestCase):
    def test_unique_constraints_are_paired_with_tenant(self) -> None:
        models = _parse_models()
        self.assertGreaterEqual(
            len(models), 49, "разбор перестал находить модели — сломан обход, а не код"
        )
        violations = _find_unique_violations(models)
        unexplained = [
            f"{cls}.{label}"
            for cls, label, _cols in violations
            if (cls, label) not in UNIQUE_PAIR_EXEMPT
        ]
        self.assertEqual(
            [],
            unexplained,
            "уникальность без пары с арендатором вне UNIQUE_PAIR_EXEMPT (Т6): "
            + ", ".join(unexplained),
        )

    def test_known_forms_pass_silently(self) -> None:
        """`uq_product_field_value` (сегодня — `ix_product_field_values_product_field`) и
        `uq_user_role` законны по форме 2 (пара через FK на строку категории А) и не
        должны попадать ни в найденные нарушения, ни в UNIQUE_PAIR_EXEMPT — иначе домен
        получит повод «чинить» верный констрейнт миграцией (§2.6 плана)."""
        models = _parse_models()
        violation_labels = {label for _cls, label, _cols in _find_unique_violations(models)}
        for legal_name in ("uq_user_role", "ix_product_field_values_product_field"):
            self.assertNotIn(legal_name, violation_labels)
            self.assertNotIn(
                legal_name, {label for _cls, label in UNIQUE_PAIR_EXEMPT}
            )

    def test_unique_pair_exempt_is_not_stale(self) -> None:
        models = _parse_models()
        violations_today = {(cls, label) for cls, label, _cols in _find_unique_violations(models)}
        for classname, label in UNIQUE_PAIR_EXEMPT:
            self.assertIn(
                (classname, label),
                violations_today,
                f"{classname}.{label} уже спарен с арендатором или исчез — уберите строку",
            )


# ─── Мутационная защита: причина не может быть пустой строкой ──────────────


class ExceptionListsHaveReasonsTest(unittest.TestCase):
    def test_every_exception_has_a_non_empty_reason(self) -> None:
        for label, mapping in (
            ("TENANTLESS", TENANTLESS),
            ("KNOWN_GAPS", KNOWN_GAPS),
            ("TENANT_TABLES_EXEMPT", TENANT_TABLES_EXEMPT),
            ("UNIQUE_PAIR_EXEMPT", UNIQUE_PAIR_EXEMPT),
        ):
            for key, reason in mapping.items():
                self.assertIsInstance(reason, str)
                self.assertTrue(
                    reason.strip(), f"{label}[{key!r}] — причина пустая или из пробелов"
                )


if __name__ == "__main__":
    unittest.main()
