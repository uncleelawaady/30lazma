#!/usr/bin/env python3
"""
apply_show_store_fix.py v2
==========================
Patches _show_store_category so that when the current category is social_media,
pagination is 13 per page and buttons render one-per-row (full width), matching
the user's requirement for long Arabic service names.

Robust to whitespace differences in the function signature.
"""

from __future__ import annotations

import ast
import datetime
import os
import re
import shutil
import sys

BOT_PATH = "/opt/forfive_bot/bot.py"
MARKER = "# [show-store-fix-v1 marker] do not remove"


HEADER_RE = re.compile(
    r"(?P<sig>def _show_store_category\(chat_id, cat_id, show_escrow_services=False, linked_page=0,\s*\n\s+admin_user_id=None\):)",
    re.MULTILINE,
)

HEADER_INJECTION = """
    # show-store-fix-v1: single-column + 13/page for the social-media category.
    _ss_is_social = False
    try:
        _ss_conn = get_db()
        try:
            with _ss_conn.cursor() as _ss_cur:
                _ss_cur.execute(
                    "SELECT slug FROM bot_categories WHERE id=%s", (cat_id,)
                )
                _ss_row = _ss_cur.fetchone() or {}
                _ss_is_social = (str(_ss_row.get('slug') or '') == 'social_media')
        finally:
            try:
                _ss_conn.close()
            except Exception:
                pass
    except Exception:
        _ss_is_social = False
    _ss_page_size = 13 if _ss_is_social else STORE_XPRO_PAGE_SIZE
    _ss_step = 1 if _ss_is_social else 2
    _ss_row_width = 1 if _ss_is_social else 2
    """ + MARKER


FN_HEAD_RE = re.compile(r"^def _show_store_category\(", re.MULTILINE)
FN_TAIL_RE = re.compile(
    r"^\s*@bot\.callback_query_handler\(func=lambda call: re\.fullmatch\(r'catlinked",
    re.MULTILINE,
)


def _die(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(2)


def _patch_body(body):
    """Rewrite STORE_XPRO_PAGE_SIZE, row_width=2 and 2-column loops in body."""
    out = body
    out = out.replace("STORE_XPRO_PAGE_SIZE", "_ss_page_size")
    out = out.replace(
        "mk=types.InlineKeyboardMarkup(row_width=2)",
        "mk=types.InlineKeyboardMarkup(row_width=_ss_row_width)",
    )
    out = out.replace(
        "for index in range(0,len(groups),2):",
        "for index in range(0,len(groups),_ss_step):",
    )
    out = out.replace(
        "for g in groups[index:index+2]",
        "for g in groups[index:index+_ss_step]",
    )
    out = out.replace(
        "for i in range(0,len(visible),2):",
        "for i in range(0,len(visible),_ss_step):",
    )
    out = out.replace(
        "for kind,item in visible[i:i+2]:",
        "for kind,item in visible[i:i+_ss_step]:",
    )
    return out


def main():
    if not os.path.exists(BOT_PATH):
        _die(f"{BOT_PATH} not found")

    with open(BOT_PATH, "r", encoding="utf-8") as fh:
        src = fh.read()

    if MARKER in src:
        print("already applied — nothing to do.")
        return

    # 1) Inject the header variables (whitespace-tolerant match).
    m_hdr = HEADER_RE.search(src)
    if not m_hdr:
        _die("header anchor not found; _show_store_category signature changed")
    sig_end = m_hdr.end()
    src = src[:sig_end] + HEADER_INJECTION + src[sig_end:]

    # 2) Scope-limited rewrite of the function body.
    m_head = FN_HEAD_RE.search(src)
    if not m_head:
        _die("function start marker gone")
    m_tail = FN_TAIL_RE.search(src, m_head.end())
    if not m_tail:
        _die("could not find end-of-function marker (catlinked handler)")

    fn_start = m_head.start()
    body = src[fn_start:m_tail.start()]
    patched_body = _patch_body(body)
    src = src[:fn_start] + patched_body + src[m_tail.start():]

    # 3) Validate.
    try:
        ast.parse(src)
    except SyntaxError as e:
        _die(f"patched bot.py would not parse: {e}")

    # 4) Write with backup.
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = f"{BOT_PATH}.before_show_store_fix_{ts}"
    shutil.copy2(BOT_PATH, backup)
    with open(BOT_PATH, "w", encoding="utf-8") as fh:
        fh.write(src)

    print(f"OK — backup at {backup}")
    print("Restart the service: systemctl restart forfive_bot")


if __name__ == "__main__":
    main()
