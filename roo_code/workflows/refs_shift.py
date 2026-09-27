"""Ссылки документов, уехавшие из-за правки кода: найти и перенумеровать.

В документах проекта 16 324 ссылки вида `файл:строка` и ещё 5 972 коротких `:NNN`.
Любая вставка строк сдвигает часть из них. За 2026-09-23 на этом забраковано шесть
задач подряд: код и тесты верны, а документы после сдвига противоречат сами себе.
Требовать этого от автора бессмысленно вдвойне — ссылки живут в чужих документах,
которые задача не называла и трогать не имеет права.

Поэтому считает и чинит контроллер, и только там, где это механика:
строка переехала ДОСЛОВНО — номер правится молча; содержимое строки изменилось —
ссылка уходит списком проверяющему, потому что она могла стать ложью по существу.
"""

import re
import subprocess
from pathlib import Path

#: Имя файла с расширением — то, по чему ссылка находит свой сдвиг.
PATH_PATTERN = r"[A-Za-z0-9_][A-Za-z0-9_/.-]*\.(?:ts|vue|py|css|js|mjs|json|md)"
#: Один номер или диапазон: `49` и `214-218`.
NUMBER = r"\d+(?:-\d+)?"
#: Перечисление номеров через запятую: хвост `49,52,55` — тоже ссылка, а не текст.
NUMBERS = rf"{NUMBER}(?:,{NUMBER})*"

#: Один проход слева направо. Ветка `путь:номера` — полная ссылка; ветка `путь` без
#: номера только обновляет «текущий файл»; ветка `:номера` — короткая ссылка, чей файл
#: берётся из последнего пути ЛЕВЕЕ неё в этой же строке. Порядок веток важен: на
#: `models.py:49` срабатывает первая, поэтому короткая ветка берёт только голый номер.
#: Короткой ветке нужны границы с обеих сторон: двоеточие сразу после буквы или цифры —
#: это время (`17:36`), порт (`localhost:5433`) или колонка стек-трейса (`spec.ts:34:77`),
#: а не ссылка; номер, за которым идёт ещё `:цифра`, — строка с колонкой, а не строка.
SCAN = re.compile(rf"(?P<path>{PATH_PATTERN})(?::(?P<numbers>{NUMBERS}))?"
                  rf"|(?<![\w:.,/-]):(?P<short>{NUMBERS})(?![\w:])")
PATH_ONLY = re.compile(PATH_PATTERN)
HUNK = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+\d+(?:,(\d+))? @@")


#: Резолвер ссылок контракта по одному документу: команда из `frontend_vue` и её итог.
#: Одно место для ядра (счёт «до/после» задачи) и драйвера автора (тот же счёт до сдачи):
#: разойдись они — автор сдавал бы то, что ядро бракует.
RESOLVER_SPEC = "src/services/contractRefs.spec.ts"
BROKEN = re.compile(r"\[ссылки\][^\n]*битых (\d+)")


def link_check_argv(doc):
    return ["env", f"CONTRACT_REFS={doc}", "./node_modules/.bin/vitest", "run", RESOLVER_SPEC]


def broken_links(report):
    """Число битых ссылок из вывода резолвера; None — отчёта в выводе нет."""
    found = BROKEN.findall(report)
    return int(found[-1]) if found else None


def git_text(root, *args):
    # `core.quotePath=false` — не косметика: с умолчанием git ЭКРАНИРУЕТ кириллицу в
    # заголовках `+++ b/...`, имя перестаёт совпадать с тем, что отдаёт `ls-files -z`,
    # и сдвиги такого файла просто не находятся. В этом проекте кириллицей названы
    # документы планов, то есть ссылки НА них после правки молча остаются старыми.
    return subprocess.run(["git", "-C", str(root), "-c", "core.quotePath=false", *args],
                          capture_output=True, text=True)


def shifts(root, base):
    """Для каждого изменённого файла: куски (строка в старой версии, сдвиг после неё)."""
    diff = git_text(root, "diff", "--unified=0", base).stdout
    result, current = {}, None
    for line in diff.splitlines():
        if line.startswith("+++ b/"):
            current = line[6:]
            result.setdefault(current, [])
        elif line.startswith("@@") and current:
            match = HUNK.match(line)
            if match:
                removed, added = int(match.group(2) or 1), int(match.group(3) or 1)
                if removed != added:
                    result[current].append((int(match.group(1)), added - removed))
    return {name: hunks for name, hunks in result.items() if hunks}


NEW_SIDE = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")


def authored_lines(root, base):
    """Строки, которые автор написал или изменил: номера в НОВОЙ версии файла.

    Номер ссылки на такой строке написан под новый код, а не под старый — сдвиг
    поверх него двигает ссылку второй раз. Ночь 2026-09-27-0224: автор верно
    переписал `deficit.spec.ts:205` на `:207`, контроллер прочёл 207 как старый
    номер и сдвинул ещё на 2 — в пустую строку, и задачу забраковали.
    """
    diff = git_text(root, "diff", "--unified=0", base).stdout
    result, current = {}, None
    for line in diff.splitlines():
        if line.startswith("+++ "):
            current = line[6:] if line.startswith("+++ b/") else None
        elif line.startswith("@@") and current:
            match = NEW_SIDE.match(line)
            if match:
                start, count = int(match.group(1)), int(match.group(2) or 1)
                result.setdefault(current, set()).update(range(start, start + count))
    return result


def moved_to(line, hunks):
    return line + sum(delta for start, delta in hunks if start <= line)


def versions(root, base, path):
    old = git_text(root, "show", f"{base}:{path}")
    target = root / path
    return (old.stdout.splitlines() if old.returncode == 0 else None,
            target.read_text(errors="replace").splitlines() if target.is_file() else None)


def matches(changed, referenced):
    """Совпадает ли путь ссылки с изменённым файлом — по границе сегмента, не по буквам.

    Голый `endswith` считает, что `.../crud/domain.py` кончается на `main.py`: ссылку на
    `main.py` тогда двигают сдвиги совсем другого файла. Найдено 2026-09-25 на правке
    настроек — там это попало в «требуют глаз», но при дословном совпадении строки
    контроллер переписал бы номер МОЛЧА и указал бы в никуда.
    """
    return changed == referenced or changed.endswith("/" + referenced)


def tracked_files(root):
    result = git_text(root, "ls-files", "-z")
    return [name for name in result.stdout.split("\0") if name]


def ambiguous(referenced, files):
    """Показывает ли ссылка больше чем на один файл дерева.

    Резолвер контракта (`contractRefs.ts`, `resolveCandidates`) считает годным ЛЮБОЙ
    файл, чей путь кончается этим хвостом, и ссылка проходит, если хоть один из них
    её подтверждает. Значит `models.py:98-103` — это четырнадцать разных файлов, а не
    один, и сдвиг ОДНОГО из них ничего про неё не говорит.

    Найдено 2026-09-25: правка `suppliers/shared/models.py` молча перенумеровала
    `models.py:98-103` в `bcc.md` — строка там совпала дословно, проверка `verbatim`
    прошла, и ссылка на модель BCC уехала на две строки в никуда. Неоднозначная
    ссылка уходит глазам, а не механике.
    """
    return sum(1 for name in files if matches(name, referenced)) > 1


def verbatim(old_lines, new_lines, old_number, new_number):
    """Переехала ли строка дословно. Нет — номер молча править нельзя."""
    if old_lines is None or new_lines is None:
        return False
    if not (1 <= old_number <= len(old_lines)) or not (1 <= new_number <= len(new_lines)):
        return False
    return old_lines[old_number - 1] == new_lines[new_number - 1]


def target_of(referenced, moved):
    return next((name for name in moved if matches(name, referenced)), None)


def parse_numbers(numbers):
    """`49,52,55` и `214-218` → список пар (начало, конец или None)."""
    pairs = []
    for part in numbers.split(","):
        start, separator, end = part.partition("-")
        pairs.append((int(start), int(end) if separator else None))
    return pairs


def format_numbers(pairs):
    return ",".join(f"{start}-{end}" if end is not None else str(start)
                    for start, end in pairs)


def shifted_pairs(pairs, hunks):
    return [(moved_to(start, hunks), moved_to(end, hunks) if end is not None else None)
            for start, end in pairs]


def unchanged(pairs, new_pairs):
    return all(start == new_start and end == new_end
               for (start, end), (new_start, new_end) in zip(pairs, new_pairs))


def pairs_verbatim(old_lines, new_lines, pairs, new_pairs):
    """Каждый номер переехал ДОСЛОВНО, и ни один диапазон не перевернулся.

    Диапазон двигается ОБОИМИ концами: сдвинуть начало и забыть конец — это
    `:214-218` → `:234-218`, ссылка-опечатка, хуже устаревшей. Перевёрнутый
    диапазон не выпускается даже тогда, когда обе строки совпали случайно.
    """
    for (start, end), (new_start, new_end) in zip(pairs, new_pairs):
        if not verbatim(old_lines, new_lines, start, new_start):
            return False
        if end is not None and not verbatim(old_lines, new_lines, end, new_end):
            return False
        if new_end is not None and new_start > new_end:
            return False
    return True


#: Архив планов — снимок прошлого (инвариант ROO.md): документ там записывает, что
#: человек ВИДЕЛ тогда, а не что в коде сейчас. Перенумеровать ссылку внутри снимка
#: значит превратить запись о прошлом чтении в ложное утверждение о настоящем.
#: Проверке ссылок это ничего не стоит: `contractRefs.spec.ts` читает только
#: `roo-context/api`, `plans/api/audit` и `plans/bugs`, архива среди них нет.
FROZEN = ("plans/archive/",)


def frozen(doc, root):
    relative = str(Path(doc).relative_to(root)).replace("\\", "/")
    return any(part in relative for part in FROZEN)


def scan_line(root, base, doc, number, text, moved, files, cache, authored=False):
    """Ссылки одной строки — полные и короткие.

    Короткая ссылка (`:NNN`, хвост `,NNN`) берёт файл из последнего пути ЛЕВЕЕ себя
    в этой же строке. Строку с двумя и более РАЗНЫМИ путями контекст определяет
    неверно (`:72` после `suppliers/shared/models.py` уехал бы по карте
    `auth/shared/models.py`), поэтому короткие номера там не двигаются вовсе —
    только попадают в «требуют глаз». Повтор одного и того же пути строкой с двумя
    разными не считается.
    """
    # authored — строку написал автор: её номера уже под новый код (см. authored_lines).
    paths = {match.group(0) for match in PATH_ONLY.finditer(text)}
    single = len(paths) == 1
    safe, unsafe = [], []
    last_path = None
    for match in SCAN.finditer(text):
        if match.group("path") is not None:
            last_path = match.group("path")
            numbers = match.group("numbers")
            if numbers is None:
                continue  # путь назван без номера — обновляем контекст и идём дальше
            path, short, tail = last_path, False, "," in numbers
        else:
            if last_path is None:
                continue  # файл подразумевается, но в строке его нет — двигать не от чего
            path, numbers, short, tail = last_path, match.group("short"), True, False
        target = target_of(path, moved)
        if target is None:
            continue
        pairs = parse_numbers(numbers)
        new_pairs = shifted_pairs(pairs, moved[target])
        if unchanged(pairs, new_pairs):
            continue
        if target not in cache:
            cache[target] = versions(root, base, target)
        old_lines, new_lines = cache[target]
        item = {"документ": str(doc.relative_to(root)), "строка": number,
                "было": match.group(0),
                "стало": (":" if short else f"{path}:") + format_numbers(new_pairs),
                "_start": match.start(), "_end": match.end()}
        if authored:
            unsafe.append(item)  # номер написан под новый код — второй сдвиг его сломает
            continue
        if not single and (short or tail):
            unsafe.append(item)  # несколько разных путей на строке — контекст неоднозначен
            continue
        ok = (not ambiguous(path, files)
              and pairs_verbatim(old_lines, new_lines, pairs, new_pairs))
        (safe if ok else unsafe).append(item)
    return safe, unsafe


def collect(root, base="HEAD", docs="roo_code"):
    """Ссылки, несущие служебные смещения строки внутри себя (для правки)."""
    moved = shifts(root, base)
    if not moved:
        return [], []
    cache, safe, unsafe = {}, [], []
    files = tracked_files(root)
    tracked = set(files)
    authored = authored_lines(root, base)
    for doc in sorted((root / docs).rglob("*.md")):
        if frozen(doc, root):
            continue
        try:
            lines = doc.read_text(errors="replace").splitlines()
        except OSError:
            continue
        name = str(doc.relative_to(root))
        # Новый документ целиком написан под новый код.
        written = authored.get(name, set()) if name in tracked else set(range(1, len(lines) + 1))
        for number, text in enumerate(lines, 1):
            found_safe, found_unsafe = scan_line(root, base, doc, number, text,
                                                 moved, files, cache, number in written)
            safe.extend(found_safe)
            unsafe.extend(found_unsafe)
    return safe, unsafe


def public(item):
    """Отчёт наружу — без служебных смещений строки (`_start`, `_end`)."""
    return {key: value for key, value in item.items() if not key.startswith("_")}


def survey(root, base="HEAD", docs="roo_code"):
    """Что уехало: (перенумеруемые механически, требующие глаз)."""
    safe, unsafe = collect(root, base, docs)
    return [public(item) for item in safe], [public(item) for item in unsafe]


def renumber(root, base="HEAD", docs="roo_code"):
    """Перенумеровать дословно переехавшие ссылки. Возвращает (правки, требующие глаз)."""
    safe, unsafe = collect(root, base, docs)
    by_doc = {}
    for item in safe:
        by_doc.setdefault(item["документ"], []).append(item)
    for name, items in by_doc.items():
        path = root / name
        lines = path.read_text(errors="replace").splitlines(keepends=True)
        by_line = {}
        for item in items:
            by_line.setdefault(item["строка"], []).append(item)
        for number, group in by_line.items():
            # Справа налево: правка не сдвигает смещения ещё не обработанных ссылок.
            text = lines[number - 1]
            for item in sorted(group, key=lambda i: i["_start"], reverse=True):
                text = text[:item["_start"]] + item["стало"] + text[item["_end"]:]
            lines[number - 1] = text
        path.write_text("".join(lines))
    return [public(item) for item in safe], [public(item) for item in unsafe]


def main():
    import argparse
    import json
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--base", default="HEAD")
    parser.add_argument("--docs", default="roo_code")
    parser.add_argument("--fix", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    safe, unsafe = (renumber if args.fix else survey)(args.root, args.base, args.docs)
    if args.json:
        print(json.dumps({"переехали": safe, "требуют_глаз": unsafe}, ensure_ascii=False, indent=2))
        return 0
    print(("Перенумеровано" if args.fix else "Переехало дословно") + f": {len(safe)}")
    for item in safe[:10]:
        print(f"  {item['документ']}:{item['строка']}  {item['было']} → {item['стало']}")
    if len(safe) > 10:
        print(f"  … и ещё {len(safe) - 10}")
    if unsafe:
        print(f"Требуют глаз (строка изменилась, а не переехала): {len(unsafe)}")
        for item in unsafe:
            print(f"  {item['документ']}:{item['строка']}  {item['было']} (сдвиг дал бы {item['стало']})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
