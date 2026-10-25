#!/usr/bin/env python3
"""
Minimal safe UI patch for social-media category (hardcoded id=34):
  - 1 column full-width (row_width=1)
  - 13 services per page instead of 24
  - keep full service name (no truncation)
Everything else untouched. ast.parse validates before writing. Idempotent.
"""
from __future__ import annotations
import ast, datetime, os, shutil, sys

BOT = "/opt/forfive_bot/bot.py"
MARK = "ui-social-cat-34-fix"


OLD_BLOCK = """    compact_external = bool(from_storefront and g.get('source_type')=='external_api')
    if compact_external:
        max_plan_page=max(0,(len(plans)-1)//24) if plans else 0
        plan_page=max(0,min(plan_page,max_plan_page))
        shown=plans[plan_page*24:(plan_page+1)*24]
    else:
        shown=plans
    mk=types.InlineKeyboardMarkup(row_width=2 if compact_external else 1)"""

NEW_BLOCK = """    compact_external = bool(from_storefront and g.get('source_type')=='external_api')
    # ui-social-cat-34-fix: social-media category gets full-width buttons and 13 per page
    _is_sm_cat_34 = False
    try:
        _is_sm_cat_34 = int(g.get('category_id') or 0) == 34
    except Exception:
        pass
    _pg_sm = 13 if _is_sm_cat_34 else 24
    if compact_external or _is_sm_cat_34:
        max_plan_page=max(0,(len(plans)-1)//_pg_sm) if plans else 0
        plan_page=max(0,min(plan_page,max_plan_page))
        shown=plans[plan_page*_pg_sm:(plan_page+1)*_pg_sm]
    else:
        shown=plans
    mk=types.InlineKeyboardMarkup(row_width=1 if _is_sm_cat_34 else (2 if compact_external else 1))"""


OLD_LABEL = """        label=(_prodseller_short_name(p.get('name')) if compact_external
               else customer_button_label(p))"""

NEW_LABEL = """        if _is_sm_cat_34:
            label = customer_button_label(p)
        elif compact_external:
            label = _prodseller_short_name(p.get('name'))
        else:
            label = customer_button_label(p)"""


def die(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(2)

def main():
    if not os.path.exists(BOT):
        die(f"{BOT} not found")
    with open(BOT, "r", encoding="utf-8") as fh:
        src = fh.read()
    if MARK in src:
        print("already applied — nothing to do.")
        return

    # First patch: pagination + row width (expect exactly one match)
    n1 = src.count(OLD_BLOCK)
    if n1 == 0:
        die("OLD_BLOCK not found — maybe already patched or source changed")
    if n1 > 1:
        die(f"OLD_BLOCK found {n1} times — ambiguous")
    src = src.replace(OLD_BLOCK, NEW_BLOCK, 1)

    # Second patch: label building — this must be inside the same scope.
    # Expect exactly one occurrence as well; if not, we skip it (not fatal).
    n2 = src.count(OLD_LABEL)
    if n2 == 1:
        src = src.replace(OLD_LABEL, NEW_LABEL, 1)
    elif n2 > 1:
        die(f"OLD_LABEL found {n2} times — ambiguous")
    # (n2 == 0 is OK — label code may differ, we won't fail)

    try:
        ast.parse(src)
    except SyntaxError as e:
        die(f"patched bot.py would not parse: {e}")

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = f"{BOT}.before_sm_cat34_{ts}"
    shutil.copy2(BOT, backup)
    with open(BOT, "w", encoding="utf-8") as fh:
        fh.write(src)
    print(f"OK — backup at {backup}")
    print("Restart: systemctl restart forfive_bot")

if __name__ == "__main__":
    main()
