#!/usr/bin/env python3
"""Механическая перенумерация ссылок `файл:строка`, поехавших от правок C9.

Правило 1 ночи: переносится только та ссылка, которая была ВЕРНОЙ до правки.
Признак «была в документе до правки» — точная строка ссылки присутствует в версии
документа из HEAD: значит её написал не этот слайс, и номера в ней старые.

Карта «старая строка -> новая» строится по содержимому файла (difflib между HEAD и
диском; равнодлинные блоки — строка в строку), как это делал слайс C2.

Отличие от renumber-c2.py ровно одно, и оно сужает объём: цели здесь — `main.py`
(сдвинулся на три строки импортом роутера и на одну — его регистрацией) и сам
`roo_code/roo-context/api/settings.md` (выросли три раздела карты). Документы
исторических прогонов (`fix-run-2026-09-09/*`, `roo-context/verify-runs/*`) и чужие
вердикты не трогаются намеренно: их таблицы «было/стало» переписывать нельзя.

Прогон ограничен ИЗМЕРЯЕМЫМ набором — тремя каталогами, по которым считается
строка «документов · ссылок · битых» (те же, что берёт `contractRefs.spec.ts` без
`CONTRACT_REFS`). Файлы вне набора объявлены остатком в отчёте, а не перенумерованы:
ссылки на `main.py` там и до слайса указывали мимо (например `main.py:63` — это
`FastAPI(...)`, а не монтирование статики), и механический перенос увёз бы неверный
номер в новое неверное место.
"""
import difflib
import os
import re
import subprocess

REPO = "/home/greatgleb/PycharmProjects/flexiron-source"
os.chdir(REPO)

# ref-путь -> настоящий путь файла-цели (одна цель на два написания)
TARGETS = {
    "backend/app/main.py": "backend/app/main.py",
    "app/main.py": "backend/app/main.py",
    "roo_code/roo-context/api/settings.md": "roo_code/roo-context/api/settings.md",
    "api/settings.md": "roo_code/roo-context/api/settings.md",
}

# измеряемый набор: те же каталоги, что обходит `targets()` в contractRefs.spec.ts
DOC_DIRS = (
    "roo_code/roo-context/api",
    "roo_code/plans/api/audit",
    "roo_code/plans/bugs",
)


def git_lines(*args):
    out = subprocess.run(
        ["git", "-c", "core.quotepath=false", *args],
        capture_output=True, text=True, encoding="utf-8",
    )
    return out.stdout.splitlines()


def head_lines(path):
    out = subprocess.run(
        ["git", "-c", "core.quotepath=false", "show", f"HEAD:{path}"],
        capture_output=True, text=True, encoding="utf-8",
    )
    return out.stdout.splitlines() if out.returncode == 0 else None


def measured_docs():
    docs = []
    for d in DOC_DIRS:
        for f in sorted(os.listdir(d)):
            if f.endswith(".md"):
                docs.append(f"{d}/{f}")
    return docs


MAPS = {}
for target in sorted(set(TARGETS.values())):
    old = head_lines(target)
    new = open(target, encoding="utf-8").read().splitlines()
    sm = difflib.SequenceMatcher(None, old, new, autojunk=False)
    m = {}
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal" or (tag == "replace" and (i2 - i1) == (j2 - j1)):
            for k in range(i2 - i1):
                m[i1 + k + 1] = j1 + k + 1
    MAPS[target] = m

REF = re.compile(
    r'([A-Za-z0-9_./-]*[A-Za-z0-9_-]\.(?:ts|tsx|vue|py|md|json|mjs))?:(\d+)(?:-(\d+))?'
)


def plan_doc(doc):
    """Список замен (start, end, текст) на документ."""
    head_text = "\n".join(head_lines(doc) or [])
    text = open(doc, encoding="utf-8").read()
    replacements, log = [], []
    line_offset = 0
    for line in text.splitlines(keepends=True):
        last_path = None
        for m in REF.finditer(line):
            ref_path, start, end = m.group(1), int(m.group(2)), m.group(3)
            path = ref_path or last_path
            if ref_path:
                last_path = ref_path
            if not path or path not in TARGETS:
                continue
            key = TARGETS[path]
            raw = m.group(0)
            if raw not in head_text:      # этой ссылки в HEAD нет — она наша, не трогаем
                continue
            table = MAPS[key]
            if start not in table:
                continue
            new_start = table[start]
            if end is None:
                if new_start == start:
                    continue
                new_raw = f"{path}:{new_start}"
            else:
                if int(end) not in table:
                    continue
                new_end = table[int(end)]
                if (new_start, new_end) == (start, int(end)):
                    continue
                new_raw = f"{path}:{new_start}-{new_end}"
            if new_raw in head_text:      # такой номер в документе уже был — неоднозначно
                continue
            log.append((doc, raw, new_raw, key))
            replacements.append((line_offset + m.start(), line_offset + m.end(), new_raw))
        line_offset += len(line)
    return replacements, log


def main(argv):
    docs = argv[1:] if len(argv) > 1 else measured_docs()
    total, touched = 0, 0
    for doc in docs:
        if not os.path.exists(doc) or head_lines(doc) is None:
            continue
        reps, log = plan_doc(doc)
        if not reps:
            continue
        text = open(doc, encoding="utf-8").read()
        # позиции собраны по исходному тексту; применяем справа налево
        for start, end, new_raw in sorted(reps, reverse=True):
            text = text[:start] + new_raw + text[end:]
        open(doc, "w", encoding="utf-8").write(text)
        touched += 1
        for _, raw, new_raw, key in log:
            print(f"{doc}: {raw} -> {new_raw}   [{key}]")
            total += 1
    print(f"перенумеровано ссылок: {total} в {touched} документах")


if __name__ == "__main__":
    import sys

    main(sys.argv)
