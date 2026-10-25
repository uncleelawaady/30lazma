#!/usr/bin/env python3
"""
Scoped surgical fix for _show_store_category: for cat_id==34 only, show
1 button per row and 13 items per page. Done by patching lines ONLY inside
the function body (identified by `def _show_store_category(` to next
top-level `def ` or `@bot`), so single-line replacements can't collide
with similar text elsewhere.
"""
from __future__ import annotations
import ast, datetime, os, re, shutil, sys

BOT = "/opt/forfive_bot/bot.py"
MARK = "sm-cat34-store-fix-v2"

FN_START_RE = re.compile(r"^def _show_store_category\(", re.MULTILINE)
# A function ends at the next top-level def/class/@decorator or EOF.
FN_END_RE = re.compile(r"^(?:def |class |@)", re.MULTILINE)


def die(msg):
    print(f"ERROR: {msg}", file=sys.stderr); sys.exit(2)


def find_fn_body(src):
    m = FN_START_RE.search(src)
    if not m:
        die("def _show_store_category not found")
    start = m.start()
    tail = src[m.end():]
    end_m = FN_END_RE.search(tail)
    end = m.end() + (end_m.start() if end_m else len(tail))
    return start, end


def patch_fn_body(body):
    orig_body = body
    changed = []

    # 1) Insert the helpers near the top of the function, right after the signature.
    #    Place them just before the first `linked_page=` assignment.
    marker_line = f"    # {MARK}: 1-col + 13/page when cat_id == 34\n"
    helpers = (
        marker_line +
        "    _psz_sm = 13 if int(cat_id or 0) == 34 else STORE_XPRO_PAGE_SIZE\n"
        "    _step_sm = 1 if int(cat_id or 0) == 34 else 2\n"
    )
    if MARK not in body:
        key = "    linked_page=max(0,int(linked_page or 0))"
        if key not in body:
            die("linked_page init not found")
        body = body.replace(key, helpers + key, 1)
        changed.append("insert helpers")

    # 2) Replace STORE_XPRO_PAGE_SIZE occurrences in this function body with _psz_sm.
    before = body
    body = re.sub(r"\bSTORE_XPRO_PAGE_SIZE\b", "_psz_sm", body)
    if body != before:
        changed.append("STORE_XPRO_PAGE_SIZE -> _psz_sm")

    # 3) Replace step=2 occurrences in group/visible loops.
    before = body
    body = body.replace("range(0,len(groups),2)", "range(0,len(groups),_step_sm)")
    body = body.replace("groups[index:index+2]", "groups[index:index+_step_sm]")
    body = body.replace("range(0,len(visible),2)", "range(0,len(visible),_step_sm)")
    body = body.replace("visible[i:i+2]", "visible[i:i+_step_sm]")
    if body != before:
        changed.append("row-step 2 -> _step_sm")

    # 4) row_width if hardcoded 2 — only inside this function.
    before = body
    body = body.replace(
        "mk=types.InlineKeyboardMarkup(row_width=2)",
        "mk=types.InlineKeyboardMarkup(row_width=1 if int(cat_id or 0)==34 else 2)",
    )
    if body != before:
        changed.append("row_width -> variable")

    if body == orig_body:
        print("already applied — nothing to do.")
        return None, []
    return body, changed


def main():
    if not os.path.exists(BOT):
        die(f"{BOT} not found")
    with open(BOT, "r", encoding="utf-8") as fh:
        src = fh.read()
    start, end = find_fn_body(src)
    body = src[start:end]
    new_body, changed = patch_fn_body(body)
    if new_body is None:
        return
    new_src = src[:start] + new_body + src[end:]

    try:
        ast.parse(new_src)
    except SyntaxError as e:
        die(f"patched bot.py would not parse: {e}")

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = f"{BOT}.before_sm_store_v2_{ts}"
    shutil.copy2(BOT, backup)
    with open(BOT, "w", encoding="utf-8") as fh:
        fh.write(new_src)
    print(f"OK — backup at {backup}")
    print("Changes:", ", ".join(changed))
    print("Restart: systemctl restart forfive_bot")


if __name__ == "__main__":
    main()
