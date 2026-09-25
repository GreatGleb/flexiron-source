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

REF = re.compile(r"(?P<path>[A-Za-z0-9_][A-Za-z0-9_/.-]*\.(?:ts|vue|py|css|js|mjs|json|md))"
                 r":(?P<start>\d+)(?:-(?P<end>\d+))?")
HUNK = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+\d+(?:,(\d+))? @@")


def git_text(root, *args):
    return subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True)


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


def verbatim(old_lines, new_lines, old_number, new_number):
    """Переехала ли строка дословно. Нет — номер молча править нельзя."""
    if old_lines is None or new_lines is None:
        return False
    if not (1 <= old_number <= len(old_lines)) or not (1 <= new_number <= len(new_lines)):
        return False
    return old_lines[old_number - 1] == new_lines[new_number - 1]


def survey(root, base="HEAD", docs="roo_code"):
    """Что уехало: (перенумеруемые механически, требующие глаз)."""
    moved = shifts(root, base)
    if not moved:
        return [], []
    cache, safe, unsafe = {}, [], []
    for doc in sorted((root / docs).rglob("*.md")):
        try:
            lines = doc.read_text(errors="replace").splitlines()
        except OSError:
            continue
        for number, text in enumerate(lines, 1):
            for ref in REF.finditer(text):
                path = ref.group("path")
                target = next((name for name in moved if matches(name, path)), None)
                if target is None:
                    continue
                start = int(ref.group("start"))
                new_start = moved_to(start, moved[target])
                if new_start == start:
                    continue
                end = ref.group("end")
                new_end = moved_to(int(end), moved[target]) if end else None
                if target not in cache:
                    cache[target] = versions(root, base, target)
                old_lines, new_lines = cache[target]
                ok = verbatim(old_lines, new_lines, start, new_start) and (
                    end is None or verbatim(old_lines, new_lines, int(end), new_end))
                item = {"документ": str(doc.relative_to(root)), "строка": number,
                        "было": ref.group(0),
                        "стало": f"{path}:{new_start}" + (f"-{new_end}" if end else "")}
                (safe if ok else unsafe).append(item)
    return safe, unsafe


def renumber(root, base="HEAD", docs="roo_code"):
    """Перенумеровать дословно переехавшие ссылки. Возвращает (правки, требующие глаз)."""
    safe, unsafe = survey(root, base, docs)
    by_doc = {}
    for item in safe:
        by_doc.setdefault(item["документ"], []).append(item)
    for name, items in by_doc.items():
        path = root / name
        lines = path.read_text(errors="replace").splitlines(keepends=True)
        for item in items:
            index = item["строка"] - 1
            lines[index] = lines[index].replace(item["было"], item["стало"])
        path.write_text("".join(lines))
    return safe, unsafe


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
