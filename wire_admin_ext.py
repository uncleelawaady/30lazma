#!/usr/bin/env python3
"""
wire_admin_ext.py
=================
Wires admin_extensions.py into /opt/forfive_bot/bot.py.

* Appends a short setup block at EOF of bot.py:
    import admin_extensions as _ax
    _ax.setup(bot, get_db, SUPER_ADMIN_ID, logger=logging.getLogger('ax'))

* Idempotent: refuses to re-apply when the marker is already present.
* ast.parse validates before overwriting; a timestamped backup is written first.
"""
from __future__ import annotations

import ast
import datetime
import os
import shutil
import sys

BOT_PATH = "/opt/forfive_bot/bot.py"
MODULE_PATH = "/opt/forfive_bot/admin_extensions.py"
MARKER = "# [wire-admin-ext-v1 marker]"

BLOCK = """

# [wire-admin-ext-v1 marker] do not remove
try:
    import logging as _ax_log
    import os as _ax_os
    import sys as _ax_sys
    _ax_dir = _ax_os.path.dirname(__file__) or '/opt/forfive_bot'
    if _ax_dir not in _ax_sys.path:
        _ax_sys.path.insert(0, _ax_dir)
    import admin_extensions as _ax
    try:
        _ax.setup(bot, get_db, SUPER_ADMIN_ID, logger=_ax_log.getLogger('ax'))
    except Exception:
        _ax_log.getLogger('ax').exception('admin_extensions setup failed')
except Exception:
    try:
        import logging as _ax_fb
        _ax_fb.getLogger('ax').exception('admin_extensions import failed')
    except Exception:
        pass
"""

def die(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(2)

def main():
    if not os.path.exists(BOT_PATH):
        die(f"{BOT_PATH} not found")
    if not os.path.exists(MODULE_PATH):
        die(f"{MODULE_PATH} not found — download admin_extensions.py first")
    with open(BOT_PATH, "r", encoding="utf-8") as fh:
        src = fh.read()
    if MARKER in src:
        print("already wired — nothing to do.")
        return
    if not src.endswith("\n"):
        src += "\n"
    patched = src + BLOCK
    try:
        ast.parse(patched)
    except SyntaxError as e:
        die(f"patched bot.py would not parse: {e}")
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = f"{BOT_PATH}.before_wire_ax_{ts}"
    shutil.copy2(BOT_PATH, backup)
    with open(BOT_PATH, "w", encoding="utf-8") as fh:
        fh.write(patched)
    print(f"OK — backup at {backup}")
    print("Restart: systemctl restart forfive_bot")

if __name__ == "__main__":
    main()
