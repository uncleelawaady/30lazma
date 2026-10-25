#!/usr/bin/env python3
"""
Second surgical fix: for _show_store_category when cat_id==34,
use pagination of 13 instead of STORE_XPRO_PAGE_SIZE (24) and render
one button per row instead of two.
"""
from __future__ import annotations
import ast, datetime, os, shutil, sys

BOT = "/opt/forfive_bot/bot.py"
MARK = "sm-cat34-store-fix"


OLD_PAG = """linked_page=max(0,int(linked_page or 0))
    total=len(linked)
    max_page=max(0,(total-1)//STORE_XPRO_PAGE_SIZE) if total else 0
    linked_page=min(linked_page,max_page)
    visible=linked[linked_page*STORE_XPRO_PAGE_SIZE:
                   (linked_page+1)*STORE_XPRO_PAGE_SIZE]"""

NEW_PAG = """linked_page=max(0,int(linked_page or 0))
    total=len(linked)
    # sm-cat34-store-fix: social-media (cat 34) uses 13 per page + 1 col
    _psz_sm = 13 if int(cat_id or 0) == 34 else STORE_XPRO_PAGE_SIZE
    _step_sm = 1 if int(cat_id or 0) == 34 else 2
    max_page=max(0,(total-1)//_psz_sm) if total else 0
    linked_page=min(linked_page,max_page)
    visible=linked[linked_page*_psz_sm:
                   (linked_page+1)*_psz_sm]"""

OLD_GRP_ROW = """    if linked_page==0:
        for index in range(0,len(groups),2):
            mk.row(*(tg_inline_button(supplier_service_button_label(g),
                        callback_data=f"grp_{g['id']}",
                        emoji_id=supplier_service_emoji_id(g),style=style)
                     for g in groups[index:index+2]))"""

NEW_GRP_ROW = """    if linked_page==0:
        for index in range(0,len(groups),_step_sm):
            mk.row(*(tg_inline_button(supplier_service_button_label(g),
                        callback_data=f"grp_{g['id']}",
                        emoji_id=supplier_service_emoji_id(g),style=style)
                     for g in groups[index:index+_step_sm]))"""

OLD_PROD_ROW = """    for i in range(0,len(visible),2):
        buttons=[]
        for kind,item in visible[i:i+2]:"""

NEW_PROD_ROW = """    for i in range(0,len(visible),_step_sm):
        buttons=[]
        for kind,item in visible[i:i+_step_sm]:"""

OLD_NAV1 = "    if total>STORE_XPRO_PAGE_SIZE:"
NEW_NAV1 = "    if total>_psz_sm:"


def die(msg):
    print(f"ERROR: {msg}", file=sys.stderr); sys.exit(2)

def apply_once(src, old, new, name):
    n = src.count(old)
    if n == 0:
        die(f"{name}: anchor not found")
    if n > 1:
        die(f"{name}: {n} matches (ambiguous)")
    return src.replace(old, new, 1)

def main():
    if not os.path.exists(BOT):
        die(f"{BOT} not found")
    with open(BOT, "r", encoding="utf-8") as fh:
        src = fh.read()
    if MARK in src:
        print("already applied — nothing to do.")
        return

    src = apply_once(src, OLD_PAG, NEW_PAG, "patch-A pagination")
    src = apply_once(src, OLD_GRP_ROW, NEW_GRP_ROW, "patch-B group row")
    src = apply_once(src, OLD_PROD_ROW, NEW_PROD_ROW, "patch-C product row")
    src = apply_once(src, OLD_NAV1, NEW_NAV1, "patch-D nav guard")

    try:
        ast.parse(src)
    except SyntaxError as e:
        die(f"patched bot.py would not parse: {e}")

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = f"{BOT}.before_sm_cat34_store_{ts}"
    shutil.copy2(BOT, backup)
    with open(BOT, "w", encoding="utf-8") as fh:
        fh.write(src)
    print(f"OK — backup at {backup}")
    print("Restart: systemctl restart forfive_bot")

if __name__ == "__main__":
    main()
