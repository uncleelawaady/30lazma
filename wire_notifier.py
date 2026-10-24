#!/usr/bin/env python3
"""
wire_notifier.py
================
Wires NewServicesNotifier into /opt/forfive_bot/bot.py by appending a block
at EOF that:

  1. Imports NewServicesNotifier from the sibling module.
  2. Instantiates it with bot, get_db, and SUPER_ADMIN_ID.
  3. Starts a daemon thread that calls notifier.after_sync_cycle() every
     AUTO_SYNC_INTERVAL seconds, offset by one minute so it fires after the
     existing auto_source_sync_loop finishes its sync pass.

This leaves auto_source_sync_loop untouched (zero risk of regressing sync).
Idempotent: a second run detects the marker and does nothing.

Safety:
  * Backs up bot.py with a timestamp before touching it.
  * ast.parse validates the output before overwriting.
  * All failure paths log and let the bot continue running.
"""

from __future__ import annotations

import ast
import datetime
import os
import shutil
import sys

BOT_PATH = "/opt/forfive_bot/bot.py"
MODULE_PATH = "/opt/forfive_bot/new_services_notifier.py"
MARKER = "# [wire-notifier-v1 marker] do not remove"


HOOK = """

# wire-notifier-v1: new-services broadcast heartbeat.  {marker}
try:
    import logging as _wn_logging
    import os as _wn_os
    import sys as _wn_sys
    import threading as _wn_threading
    import time as _wn_time
    _wn_dir = _wn_os.path.dirname(__file__) or '/opt/forfive_bot'
    if _wn_dir not in _wn_sys.path:
        _wn_sys.path.insert(0, _wn_dir)
    from new_services_notifier import NewServicesNotifier as _WNNotifier

    _wn_log = _wn_logging.getLogger('wn.notifier')

    try:
        _wn_notifier = _WNNotifier(bot, get_db, SUPER_ADMIN_ID, logger=_wn_log)
        _wn_notifier.init()
    except Exception:
        _wn_notifier = None
        _wn_log.exception('NewServicesNotifier init failed')

    def _wn_heartbeat():
        # Fire slightly AFTER each sync pass completes.
        try:
            _wn_interval = int(AUTO_SYNC_INTERVAL)  # type: ignore[name-defined]
        except Exception:
            _wn_interval = 15 * 60
        offset = 90  # one and a half minutes after the sync tick
        # Initial delay: give the first sync a chance to run.
        _wn_time.sleep(_wn_interval + offset)
        while True:
            if _wn_notifier is not None:
                try:
                    _wn_notifier.after_sync_cycle()
                except Exception:
                    _wn_log.exception('after_sync_cycle crashed')
            _wn_time.sleep(_wn_interval)

    if _wn_notifier is not None:
        _wn_hb_thread = _wn_threading.Thread(
            target=_wn_heartbeat, name='wn-notifier-heartbeat', daemon=True
        )
        _wn_hb_thread.start()
        _wn_log.info('wn: notifier heartbeat thread started')
except Exception:
    try:
        import logging as _wn_fallback_log
        _wn_fallback_log.getLogger('wn.notifier').exception(
            'wn: fatal wiring error (bot continues without notifier)')
    except Exception:
        pass
"""


def _die(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(2)


def main():
    if not os.path.exists(BOT_PATH):
        _die(f"{BOT_PATH} not found")
    if not os.path.exists(MODULE_PATH):
        _die(f"{MODULE_PATH} not found")

    with open(BOT_PATH, "r", encoding="utf-8") as fh:
        src = fh.read()

    if MARKER in src:
        print("already wired — nothing to do.")
        return

    if not src.endswith("\n"):
        src += "\n"
    patched = src + HOOK.format(marker=MARKER)

    try:
        ast.parse(patched)
    except SyntaxError as e:
        _die(f"patched bot.py would not parse: {e}")

    # Backup and write.
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = f"{BOT_PATH}.before_wire_notifier_{ts}"
    shutil.copy2(BOT_PATH, backup)
    with open(BOT_PATH, "w", encoding="utf-8") as fh:
        fh.write(patched)

    print(f"OK — backup at {backup}")
    print("Restart the service: systemctl restart forfive_bot")


if __name__ == "__main__":
    main()
