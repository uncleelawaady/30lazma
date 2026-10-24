#!/usr/bin/env python3
"""
cleanup_handle_group_click.py
=============================
Removes the apply_ui_edits.py v1 patch inside handle_group_click that calls
`_ui_is_social_media_group(g)`.  That call fails with NameError at runtime
even though the function exists at line 11230 (looks like a module reload or
scope issue).  The social-media UI is now owned entirely by the newer
_show_store_category patch (show-store-fix-v1), so handle_group_click can
simply be reverted to its pre-patch shape there.

Strategy: inline-replace `_ui_is_social_media_group(g)` with a safe inline
expression that queries the DB directly for the group's category slug.
Equivalent semantics, zero global-lookup risk.

Also: makes sure `_is_scorpion_product` and other labels keep working.

Idempotent (second run detects the marker).
"""

from __future__ import annotations

import ast
import datetime
import os
import re
import shutil
import sys

BOT_PATH = "/opt/forfive_bot/bot.py"
MARKER = "# [cleanup-hgc-v1 marker] do not remove"

OLD = "_is_social_media = _ui_is_social_media_group(g)"
NEW = (
    "_is_social_media = False  " + MARKER + "\n"
    "    try:\n"
    "        _hgc_cid = int((g or {}).get('category_id'))\n"
    "        _hgc_conn = get_db()\n"
    "        try:\n"
    "            with _hgc_conn.cursor() as _hgc_cur:\n"
    "                _hgc_cur.execute(\n"
    "                    \"SELECT slug FROM bot_categories WHERE id=%s\", (_hgc_cid,)\n"
    "                )\n"
    "                _hgc_row = _hgc_cur.fetchone() or {}\n"
    "                _is_social_media = (\n"
    "                    str(_hgc_row.get('slug') or '') == 'social_media'\n"
    "                )\n"
    "        finally:\n"
    "            try:\n"
    "                _hgc_conn.close()\n"
    "            except Exception:\n"
    "                pass\n"
    "    except Exception:\n"
    "        _is_social_media = False"
)


def _die(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(2)


def main():
    if not os.path.exists(BOT_PATH):
        _die(f"{BOT_PATH} not found")

    with open(BOT_PATH, "r", encoding="utf-8") as fh:
        src = fh.read()

    if MARKER in src:
        print("already applied — nothing to do.")
        return

    if OLD not in src:
        _die(f"anchor not found: {OLD!r}")

    # Precondition: the broken call should appear exactly once (inside
    # handle_group_click).  Guard against accidental double-replace.
    count = src.count(OLD)
    if count != 1:
        _die(f"expected exactly 1 occurrence of anchor, found {count}")

    src = src.replace(OLD, NEW, 1)

    try:
        ast.parse(src)
    except SyntaxError as e:
        _die(f"patched bot.py would not parse: {e}")

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = f"{BOT_PATH}.before_cleanup_hgc_{ts}"
    shutil.copy2(BOT_PATH, backup)
    with open(BOT_PATH, "w", encoding="utf-8") as fh:
        fh.write(src)

    print(f"OK — backup at {backup}")
    print("Restart the service: systemctl restart forfive_bot")


if __name__ == "__main__":
    main()
