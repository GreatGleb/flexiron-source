#!/usr/bin/env python3
"""Механическая перенумерация ссылок `файл:строка`, поехавших от правок C2.

Правило 1 ночи: переносится только та ссылка, которая была ВЕРНОЙ до правки.
Признак «была в документе до правки» — точная строка ссылки присутствует в версии
документа из HEAD: значит её написал не этот слайс, и номера в ней старые.

Карта «старая строка -> новая» строится по содержимому файла (difflib между HEAD и
диском; равнодлинные блоки — строка в строку), как это делал слайс C1.
"""
import difflib
import os
import re
import subprocess

REPO = "/home/greatgleb/PycharmProjects/flexiron-source"
os.chdir(REPO)

TARGETS = {
    "settings/shared/models.py": "backend/app/modules/settings/shared/models.py",
    "settings/features/crud/schemas.py": "backend/app/modules/settings/features/crud/schemas.py",
    "settings/features/crud/domain.py": "backend/app/modules/settings/features/crud/domain.py",
}
# Голое имя в документе домена `settings`.
BARE = {
    "models.py": "settings/shared/models.py",
    "schemas.py": "settings/features/crud/schemas.py",
    "domain.py": "settings/features/crud/domain.py",
    "crud/schemas.py": "settings/features/crud/schemas.py",
    "crud/domain.py": "settings/features/crud/domain.py",
}
SETTINGS_DOCS = {
    "roo_code/roo-context/api/settings.md",
    "roo_code/plans/settings/settings-backend-plan.md",
    "roo_code/plans/api/audit/settings.md",
    "roo_code/plans/bugs/contract-sync-settings-bugs.md",
*[f"roo_code/night-2026-09-21/{n}" for n in (
    "settings-c0.md", "settings-c1.md", "settings-c2.md", "settings-c4.md", "settings-c5.md",
    "settings-c9.md", "settings-c15.md", "отчёт-c1.md", "вопросы-владельцу.md",
)],
}


def git_lines(*args):
    out = subprocess.run(["git", "-c", "core.quotepath=false", *args],
                         capture_output=True, text=True, encoding="utf-8")
    return out.stdout.splitlines()


def head_lines(path):
    out = subprocess.run(["git", "-c", "core.quotepath=false", "show", f"HEAD:{path}"],
                         capture_output=True, text=True, encoding="utf-8")
    return out.stdout.splitlines() if out.returncode == 0 else None


MAPS, OLD_LEN = {}, {}
for key, path in TARGETS.items():
    old = head_lines(path)
    new = open(path, encoding="utf-8").read().splitlines()
    sm = difflib.SequenceMatcher(None, old, new, autojunk=False)
    m = {}
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal" or (tag == "replace" and (i2 - i1) == (j2 - j1)):
            for k in range(i2 - i1):
                m[i1 + k + 1] = j1 + k + 1
    MAPS[key], OLD_LEN[key] = m, len(old)

REF = re.compile(r'([A-Za-z0-9_./-]*[A-Za-z0-9_-]\.(?:ts|tsx|vue|py|md|json|mjs))?:(\d+)(?:-(\d+))?')


def target_key(ref_path, doc):
    if not ref_path:
        return None
    for key in TARGETS:
        if ref_path == key or ref_path.endswith("/" + key):
            return key
    if doc in SETTINGS_DOCS and ref_path in BARE:
        return BARE[ref_path]
    return None


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
            if not path:
                continue
            key = target_key(path, doc)
            if key is None:
                continue
            raw = m.group(0)
            if raw not in head_text:          # этой ссылки в HEAD нет — она наша, не трогаем
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
            if new_raw in head_text:          # такой номер в документе уже был — неоднозначно
                continue
            log.append((doc, raw, new_raw, key))
            replacements.append((line_offset + m.start(), line_offset + m.end(), new_raw))
        line_offset += len(line)
    return replacements, log


def main(argv):
    # Явный список документов: правятся только те, где ссылки на три файла слайса
    # реально поехали от его правок. Исторические отчёты прошлых прогонов не трогаются.
    docs = argv[1:] if len(argv) > 1 else git_lines("ls-files", "--", "*.md")
    total, touched = 0, 0
    for doc in docs:
        if head_lines(doc) is None:
            continue
        reps, log = plan_doc(doc)
        if not reps:
            continue
        text = open(doc, encoding="utf-8").read()
        # позиции собраны по исходному тексту; применяем справа налево в пределах всего файла
        # (номера строк документа от правок не зависят — замены локальны внутри строк)
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
