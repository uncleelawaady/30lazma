"""
admin_extensions.py
===================
Multi-admin support + per-button editor for section buttons (الوساطة + قناة
التواصل الرسمية).

Public API
----------
    import admin_extensions as ax
    ax.setup(bot, get_db, super_admin_id, logger=None)

What it adds
------------
* Table `bot_admins` with per-user role (super_admin / admin / moderator) and
  JSON permissions.
* Table `bot_ui_section_buttons` holding the editable buttons for the two
  sections, seeded from the current hardcoded set on first run.
* `is_admin(uid)`, `is_super_admin(uid)`, `has_permission(uid, perm)` helpers
  wired onto the bot module for the rest of bot.py to call cheaply.
* Admin UI (callback namespace `axm_*`):
    - axm_root            open the extensions root menu
    - axm_admins          list / add / remove admins
    - axm_adm_add         prompt to add admin by Telegram ID
    - axm_adm_del_<id>    remove admin
    - axm_adm_perms_<id>  toggle permissions for one admin
    - axm_adm_perm_<id>_<key>  flip one permission bit
    - axm_secs            list sections (escrow / contact_channel)
    - axm_sec_<key>       list buttons in a section
    - axm_btn_<id>        edit menu for a button (emoji / label / url / move /
                           delete / toggle)
    - axm_btn_<id>_emoji  prompt to set emoji
    - axm_btn_<id>_label  prompt to set label
    - axm_btn_<id>_url    prompt to set action value
    - axm_btn_<id>_up / _down     reorder
    - axm_btn_<id>_toggle         enable/disable
    - axm_btn_<id>_delete         delete
    - axm_btn_<key>_add_<section> add button to a section
* `get_section_buttons(section_key, lang='ar')` → ordered list of dicts for the
  renderer to consume.

Permissions keys
----------------
    manage_admins       add / remove admins and change their permissions
    edit_sections       edit the escrow and contact-channel buttons
    manage_services     create / edit / hide bot_products (reserved — not yet
                        enforced)
    reply_support       answer /support tickets (reserved)
    ban_users           ban / unban users (reserved)
    view_stats          view admin stats (reserved)

Super admin always has all permissions.  Moderators default to all permissions
except `manage_admins`.
"""

from __future__ import annotations

import json
import logging
import re
import threading
from typing import Callable, Dict, List, Optional

MARKER = "admin-extensions-v1"


DEFAULT_PERMISSIONS = {
    "manage_admins": False,
    "edit_sections": True,
    "manage_services": True,
    "reply_support": True,
    "ban_users": True,
    "view_stats": True,
}

PERMISSION_LABELS_AR = {
    "manage_admins": "إدارة المشرفين",
    "edit_sections": "تحرير أزرار الأقسام",
    "manage_services": "إدارة الخدمات",
    "reply_support": "الرد على الدعم",
    "ban_users": "حظر المستخدمين",
    "view_stats": "عرض الإحصائيات",
}

SECTION_LABELS = {
    "escrow": "🤝 أزرار الوساطة",
    "contact_channel": "📞 أزرار قناة التواصل",
}

# ---------------------------------------------------------------------------
# Migrations (idempotent)
# ---------------------------------------------------------------------------

MIGRATIONS: List[str] = [
    """
    CREATE TABLE IF NOT EXISTS bot_admins (
        telegram_id BIGINT NOT NULL,
        role        ENUM('super_admin','admin','moderator') NOT NULL DEFAULT 'moderator',
        permissions LONGTEXT NULL,
        added_by    BIGINT NULL,
        note        VARCHAR(200) NULL,
        is_active   TINYINT(1) NOT NULL DEFAULT 1,
        created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (telegram_id),
        KEY idx_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS bot_ui_section_buttons (
        id INT NOT NULL AUTO_INCREMENT,
        section_key   VARCHAR(50) NOT NULL,
        button_key    VARCHAR(80) NOT NULL,
        emoji         VARCHAR(16) NULL,
        label         VARCHAR(200) NOT NULL,
        action_type   ENUM('url','callback','phone','noop') NOT NULL DEFAULT 'callback',
        action_value  VARCHAR(500) NULL,
        row_width     TINYINT NOT NULL DEFAULT 1,
        order_index   INT NOT NULL DEFAULT 0,
        is_active     TINYINT(1) NOT NULL DEFAULT 1,
        created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_section_key (section_key, button_key),
        KEY idx_section_order (section_key, is_active, order_index)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
]

# Default seeds (one-time insert; respects UNIQUE constraint so safe to re-run)
_ESCROW_SEED = [
    # (button_key, emoji, label, action_type, action_value, row_width, order_index)
    ("escrow_policy",   "🧵", "سياسة الوساطة",        "callback", "escrow_policy",         2, 10),
    ("escrow_contacts", "📞", "التواصل الرسمي",        "callback", "escrow_contacts",       2, 20),
    ("escrow_inquiry",  "💬", "استفسار عن الوساطة",   "callback", "store_escrow_support",  1, 30),
    ("escrow_catalog",  "🛍️", "خدمات الوساطة",         "callback", "escrow_catalog",        1, 40),
]

_CONTACT_SEED = [
    ("wa_main",     "💬", "واتساب الرئيسي", "url", "https://wa.me/201055151888", 2, 10),
    ("wa_extra",    "💚", "واتساب إضافي",   "url", "https://wa.me/201040898404", 2, 20),
    ("messenger",   "📨", "ماسنجر",         "url", "https://m.me/elawaady.official", 2, 30),
    ("support",     "🛟", "الدعم",           "url", "https://t.me/Support",      2, 40),
    ("services",    "🏠", "الخدمات",         "callback", "menu:services",         2, 50),
    ("policy",      "📜", "السياسة",         "callback", "escrow_policy",         2, 60),
]


def _seed_section_buttons(get_db, logger):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS c FROM bot_ui_section_buttons WHERE section_key='escrow'")
            row = cur.fetchone()
            escrow_exists = int((row.get('c') if isinstance(row, dict) else row[0]) or 0) > 0
            cur.execute("SELECT COUNT(*) AS c FROM bot_ui_section_buttons WHERE section_key='contact_channel'")
            row = cur.fetchone()
            contact_exists = int((row.get('c') if isinstance(row, dict) else row[0]) or 0) > 0

            if not escrow_exists:
                for bk, emoji, label, atype, aval, rw, oi in _ESCROW_SEED:
                    cur.execute(
                        "INSERT IGNORE INTO bot_ui_section_buttons "
                        "(section_key, button_key, emoji, label, action_type, action_value, row_width, order_index) "
                        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                        ("escrow", bk, emoji, label, atype, aval, rw, oi),
                    )
            if not contact_exists:
                for bk, emoji, label, atype, aval, rw, oi in _CONTACT_SEED:
                    cur.execute(
                        "INSERT IGNORE INTO bot_ui_section_buttons "
                        "(section_key, button_key, emoji, label, action_type, action_value, row_width, order_index) "
                        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                        ("contact_channel", bk, emoji, label, atype, aval, rw, oi),
                    )
            conn.commit()
    except Exception:
        logger.exception("seed_section_buttons failed")
    finally:
        try:
            conn.close()
        except Exception:
            pass


def _seed_super_admin_and_default_mod(get_db, super_admin_id, logger):
    """Insert the super admin and the pre-approved moderator (6849506365)."""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            # Super admin — always ensure present with all permissions.
            super_perms = json.dumps({k: True for k in DEFAULT_PERMISSIONS})
            cur.execute(
                "INSERT INTO bot_admins (telegram_id, role, permissions, note) "
                "VALUES (%s,'super_admin',%s,'owner') "
                "ON DUPLICATE KEY UPDATE role='super_admin', permissions=VALUES(permissions), is_active=1",
                (int(super_admin_id), super_perms),
            )
            # Pre-approved moderator.
            default_mod_id = 6849506365
            default_perms = json.dumps(DEFAULT_PERMISSIONS)
            cur.execute(
                "INSERT IGNORE INTO bot_admins (telegram_id, role, permissions, added_by, note) "
                "VALUES (%s,'moderator',%s,%s,'seeded moderator')",
                (default_mod_id, default_perms, int(super_admin_id)),
            )
            conn.commit()
    except Exception:
        logger.exception("seed_super_admin failed")
    finally:
        try:
            conn.close()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# State (filled in setup)
# ---------------------------------------------------------------------------

_bot = None
_get_db = None
_super_admin_id = 0
_log = logging.getLogger("admin_extensions")
_lock = threading.Lock()
_setup_done = False


def setup(bot, get_db, super_admin_id, logger=None):
    """Call once at bot startup. Idempotent per process."""
    global _bot, _get_db, _super_admin_id, _log, _setup_done
    with _lock:
        if _setup_done:
            return
        _bot = bot
        _get_db = get_db
        _super_admin_id = int(super_admin_id)
        if logger is not None:
            _log = logger
        try:
            _run_migrations()
            _seed_section_buttons(_get_db, _log)
            _seed_super_admin_and_default_mod(_get_db, _super_admin_id, _log)
            _register_handlers()
            _setup_done = True
            _log.info("admin_extensions ready")
        except Exception:
            _log.exception("admin_extensions setup failed")


def _run_migrations():
    conn = _get_db()
    try:
        with conn.cursor() as cur:
            for stmt in MIGRATIONS:
                try:
                    cur.execute(stmt)
                except Exception:
                    _log.exception("migration failed: %s", stmt[:60])
            conn.commit()
    finally:
        try:
            conn.close()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Permission helpers (meant to be called from bot.py as well)
# ---------------------------------------------------------------------------

def is_super_admin(uid):
    try:
        return int(uid) == _super_admin_id
    except Exception:
        return False


def _load_admin_row(uid):
    try:
        conn = _get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT telegram_id, role, permissions, is_active "
                    "FROM bot_admins WHERE telegram_id=%s AND is_active=1",
                    (int(uid),),
                )
                return cur.fetchone()
        finally:
            conn.close()
    except Exception:
        return None


def is_admin(uid):
    if is_super_admin(uid):
        return True
    row = _load_admin_row(uid)
    return bool(row)


def has_permission(uid, perm):
    if is_super_admin(uid):
        return True
    row = _load_admin_row(uid)
    if not row:
        return False
    perms_raw = (row.get("permissions") if isinstance(row, dict) else row[2]) or "{}"
    try:
        perms = json.loads(perms_raw)
    except Exception:
        perms = {}
    return bool(perms.get(perm))


# ---------------------------------------------------------------------------
# Section-button data access
# ---------------------------------------------------------------------------

def get_section_buttons(section_key, active_only=True):
    try:
        conn = _get_db()
        try:
            with conn.cursor() as cur:
                sql = (
                    "SELECT id, section_key, button_key, emoji, label, action_type, "
                    "action_value, row_width, order_index, is_active "
                    "FROM bot_ui_section_buttons WHERE section_key=%s"
                )
                params = [section_key]
                if active_only:
                    sql += " AND is_active=1"
                sql += " ORDER BY order_index ASC, id ASC"
                cur.execute(sql, params)
                return list(cur.fetchall() or [])
        finally:
            conn.close()
    except Exception:
        _log.exception("get_section_buttons failed for %s", section_key)
        return []


def _get_button(bid):
    conn = _get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, section_key, button_key, emoji, label, action_type, "
                "action_value, row_width, order_index, is_active "
                "FROM bot_ui_section_buttons WHERE id=%s",
                (int(bid),),
            )
            return cur.fetchone()
    finally:
        try:
            conn.close()
        except Exception:
            pass


def _update_button(bid, **fields):
    if not fields:
        return
    cols = ", ".join(f"{k}=%s" for k in fields.keys())
    params = list(fields.values()) + [int(bid)]
    conn = _get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE bot_ui_section_buttons SET {cols} WHERE id=%s", params
            )
            conn.commit()
    finally:
        try:
            conn.close()
        except Exception:
            pass


def _delete_button(bid):
    conn = _get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM bot_ui_section_buttons WHERE id=%s", (int(bid),)
            )
            conn.commit()
    finally:
        try:
            conn.close()
        except Exception:
            pass


def _insert_button(section_key, button_key, emoji, label, action_type, action_value, row_width=1):
    conn = _get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COALESCE(MAX(order_index),0)+10 AS oi FROM bot_ui_section_buttons WHERE section_key=%s",
                (section_key,),
            )
            row = cur.fetchone()
            oi = int((row.get('oi') if isinstance(row, dict) else row[0]) or 10)
            cur.execute(
                "INSERT INTO bot_ui_section_buttons "
                "(section_key, button_key, emoji, label, action_type, action_value, row_width, order_index) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                (section_key, button_key, emoji, label, action_type, action_value, row_width, oi),
            )
            conn.commit()
            return cur.lastrowid
    finally:
        try:
            conn.close()
        except Exception:
            pass


def _reorder_button(bid, direction):
    """Swap order_index with neighbour in the same section."""
    btn = _get_button(bid)
    if not btn:
        return
    section = btn["section_key"]
    oi = int(btn["order_index"])
    conn = _get_db()
    try:
        with conn.cursor() as cur:
            if direction == "up":
                cur.execute(
                    "SELECT id, order_index FROM bot_ui_section_buttons "
                    "WHERE section_key=%s AND order_index < %s "
                    "ORDER BY order_index DESC, id DESC LIMIT 1",
                    (section, oi),
                )
            else:
                cur.execute(
                    "SELECT id, order_index FROM bot_ui_section_buttons "
                    "WHERE section_key=%s AND order_index > %s "
                    "ORDER BY order_index ASC, id ASC LIMIT 1",
                    (section, oi),
                )
            neigh = cur.fetchone()
            if not neigh:
                return
            nid = int(neigh["id"] if isinstance(neigh, dict) else neigh[0])
            noi = int(neigh["order_index"] if isinstance(neigh, dict) else neigh[1])
            cur.execute("UPDATE bot_ui_section_buttons SET order_index=%s WHERE id=%s", (noi, bid))
            cur.execute("UPDATE bot_ui_section_buttons SET order_index=%s WHERE id=%s", (oi, nid))
            conn.commit()
    finally:
        try:
            conn.close()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Admin UI handlers
# ---------------------------------------------------------------------------

# Pending prompts are tracked via telebot's register_next_step_handler
# (bot.py's own pattern) so we do not steal messages from other handlers.


def _ack(call):
    try:
        _bot.answer_callback_query(call.id)
    except Exception:
        pass


def _edit_or_send(call, text, markup=None):
    try:
        return _bot.edit_message_text(
            text, chat_id=call.message.chat.id, message_id=call.message.message_id,
            parse_mode="HTML", reply_markup=markup, disable_web_page_preview=True,
        )
    except Exception:
        try:
            return _bot.send_message(call.message.chat.id, text, parse_mode="HTML",
                              reply_markup=markup, disable_web_page_preview=True)
        except Exception:
            _log.exception("send failed")
            return None


def _kb(rows):
    """Build InlineKeyboardMarkup from a list of lists of (text, callback_data) tuples."""
    import telebot
    mk = telebot.types.InlineKeyboardMarkup()
    for row in rows:
        buttons = [telebot.types.InlineKeyboardButton(t, callback_data=cb) for (t, cb) in row]
        mk.row(*buttons)
    return mk


def _render_root(call):
    text = (
        "⚙️ <b>الإضافات الإدارية</b>\n\n"
        "اختر ما تود إدارته:"
    )
    rows = []
    uid = call.from_user.id
    if has_permission(uid, "manage_admins") or is_super_admin(uid):
        rows.append([("👥 إدارة المشرفين", "axm_admins")])
    if has_permission(uid, "edit_sections"):
        rows.append([("🎨 تحرير أزرار الأقسام", "axm_secs")])
    rows.append([("◀️ رجوع", "axm_close")])
    _edit_or_send(call, text, _kb(rows))


def _list_admins():
    conn = _get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT telegram_id, role, permissions, is_active, note "
                "FROM bot_admins WHERE is_active=1 ORDER BY role, telegram_id"
            )
            return list(cur.fetchall() or [])
    finally:
        try:
            conn.close()
        except Exception:
            pass


def _render_admins(call):
    uid = call.from_user.id
    if not has_permission(uid, "manage_admins"):
        _ack(call); return
    rows_db = _list_admins()
    lines = ["👥 <b>المشرفون الحاليون</b>", ""]
    btn_rows = []
    for r in rows_db:
        tid = int(r["telegram_id"] if isinstance(r, dict) else r[0])
        role = r["role"] if isinstance(r, dict) else r[1]
        note = r["note"] if isinstance(r, dict) else r[4]
        tag = {"super_admin": "👑", "admin": "🛡", "moderator": "🧑‍💼"}.get(role, "•")
        lines.append(f"{tag} <code>{tid}</code> — {role}" + (f" ({note})" if note else ""))
        if role != "super_admin":
            btn_rows.append([
                (f"⚙️ {tid}", f"axm_adm_perms_{tid}"),
                ("🗑", f"axm_adm_del_{tid}"),
            ])
    btn_rows.append([("➕ إضافة مشرف", "axm_adm_add")])
    btn_rows.append([("◀️ رجوع", "axm_root")])
    _edit_or_send(call, "\n".join(lines), _kb(btn_rows))


def _render_admin_perms(call, tid):
    uid = call.from_user.id
    if not has_permission(uid, "manage_admins"):
        _ack(call); return
    row = _load_admin_row(tid)
    if not row:
        _ack(call); return
    try:
        perms = json.loads(row["permissions"] or "{}")
    except Exception:
        perms = {}
    lines = [f"⚙️ <b>صلاحيات المشرف</b> <code>{tid}</code>", ""]
    btn_rows = []
    for key, label_ar in PERMISSION_LABELS_AR.items():
        on = bool(perms.get(key))
        mark = "✅" if on else "❌"
        btn_rows.append([(f"{mark} {label_ar}", f"axm_adm_perm_{tid}_{key}")])
    btn_rows.append([("◀️ رجوع", "axm_admins")])
    _edit_or_send(call, "\n".join(lines), _kb(btn_rows))


def _toggle_admin_perm(call, tid, key):
    uid = call.from_user.id
    if not has_permission(uid, "manage_admins"):
        _ack(call); return
    if key not in DEFAULT_PERMISSIONS:
        _ack(call); return
    row = _load_admin_row(tid)
    if not row:
        _ack(call); return
    try:
        perms = json.loads(row["permissions"] or "{}")
    except Exception:
        perms = {}
    perms[key] = not bool(perms.get(key))
    conn = _get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE bot_admins SET permissions=%s WHERE telegram_id=%s",
                (json.dumps(perms), int(tid)),
            )
            conn.commit()
    finally:
        try: conn.close()
        except Exception: pass
    _ack(call)
    _render_admin_perms(call, tid)


def _render_add_admin_prompt(call):
    uid = call.from_user.id
    if not has_permission(uid, "manage_admins"):
        _ack(call); return
    msg = _edit_or_send(call,
        "➕ <b>إضافة مشرف جديد</b>\n\n"
        "ابعت الـTelegram ID للمشرف (رقم) الآن.\n"
        "ممكن تجيبه من بوت @userinfobot — المستخدم يبعتله /start ويحصل على الـID.\n\n"
        "/cancel للإلغاء",
        _kb([[("◀️ رجوع", "axm_admins")]])
    )
    try:
        _bot.register_next_step_handler_by_chat_id(call.message.chat.id, _handle_add_admin, uid)
    except Exception:
        _log.exception("register next step failed")


def _handle_add_admin(message, uid):
    chat_id = message.chat.id
    if message.from_user.id != uid:
        return
    text = (message.text or "").strip()
    if text.lower() in ("/cancel", "cancel"):
        _bot.send_message(chat_id, "تم الإلغاء.")
        return
    if not text.isdigit():
        _bot.send_message(chat_id, "❌ لازم يكون رقم فقط. أعد /ax")
        return
    new_tid = int(text)
    default_perms = json.dumps(DEFAULT_PERMISSIONS)
    try:
        conn = _get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO bot_admins (telegram_id, role, permissions, added_by, note) "
                    "VALUES (%s,'moderator',%s,%s,'added via UI') "
                    "ON DUPLICATE KEY UPDATE is_active=1, role='moderator', permissions=VALUES(permissions)",
                    (new_tid, default_perms, uid),
                )
                conn.commit()
        finally:
            try: conn.close()
            except: pass
        _bot.send_message(chat_id, f"✅ تم إضافة المشرف <code>{new_tid}</code>\n\nاستخدم /ax لرؤية القائمة.",
                          parse_mode="HTML")
    except Exception:
        _log.exception("add admin failed")
        _bot.send_message(chat_id, "❌ حصل خطأ. حاول تاني.")


def _handle_button_edit_text(message, uid, bid, what):
    chat_id = message.chat.id
    if message.from_user.id != uid:
        return
    text = (message.text or "").strip()
    if text.lower() in ("/cancel", "cancel"):
        _bot.send_message(chat_id, "تم الإلغاء.")
        return
    try:
        if what == "emoji":
            _update_button(bid, emoji=text[:16])
            _bot.send_message(chat_id, "✅ تم تحديث الرمز. استخدم /ax للعودة.")
        elif what == "label":
            if len(text) > 60:
                _bot.send_message(chat_id, "❌ الاسم طويل جداً (أقصى 60 حرف). أعد /ax")
                return
            _update_button(bid, label=text)
            _bot.send_message(chat_id, "✅ تم تحديث الاسم. استخدم /ax للعودة.")
        elif what == "url":
            atype = "url" if text.startswith(("http://", "https://", "tg://")) else "callback"
            _update_button(bid, action_value=text[:500], action_type=atype)
            _bot.send_message(chat_id, "✅ تم تحديث الرابط/الأكشن. استخدم /ax للعودة.")
    except Exception:
        _log.exception("button edit failed")
        _bot.send_message(chat_id, "❌ حصل خطأ.")


def _handle_add_button_label(message, uid, section_key):
    chat_id = message.chat.id
    if message.from_user.id != uid:
        return
    text = (message.text or "").strip()
    if text.lower() in ("/cancel", "cancel"):
        _bot.send_message(chat_id, "تم الإلغاء.")
        return
    if len(text) > 60:
        _bot.send_message(chat_id, "❌ الاسم طويل. أعد /ax")
        return
    _bot.send_message(chat_id,
        "تمام. دلوقتي ابعت الرابط (مثال https://wa.me/201...) أو callback (مثال menu:services).\n"
        "/cancel للإلغاء")
    try:
        _bot.register_next_step_handler_by_chat_id(chat_id, _handle_add_button_url, uid, section_key, text)
    except Exception:
        _log.exception("register add button url step failed")


def _handle_add_button_url(message, uid, section_key, label):
    chat_id = message.chat.id
    if message.from_user.id != uid:
        return
    text = (message.text or "").strip()
    if text.lower() in ("/cancel", "cancel"):
        _bot.send_message(chat_id, "تم الإلغاء.")
        return
    action_type = "url" if text.startswith(("http://", "https://", "tg://")) else "callback"
    slug = re.sub(r"[^a-z0-9]+", "_", label.lower())[:50] or f"btn_{int(threading.get_ident())}"
    try:
        _insert_button(section_key, slug, "✨", label, action_type, text[:500], row_width=1)
        _bot.send_message(chat_id, "✅ تم إضافة الزر. غيّر الرمز من /ax.")
    except Exception:
        _log.exception("add button failed")
        _bot.send_message(chat_id, "❌ حصل خطأ.")


# --- Section/button UI ---

def _render_sections(call):
    uid = call.from_user.id
    if not has_permission(uid, "edit_sections"):
        _ack(call); return
    rows = []
    for key, label in SECTION_LABELS.items():
        rows.append([(label, f"axm_sec_{key}")])
    rows.append([("◀️ رجوع", "axm_root")])
    _edit_or_send(call, "🎨 <b>تحرير أزرار الأقسام</b>\n\nاختر القسم:", _kb(rows))


def _render_section_buttons(call, section_key):
    uid = call.from_user.id
    if not has_permission(uid, "edit_sections"):
        _ack(call); return
    buttons = get_section_buttons(section_key, active_only=False)
    section_label = SECTION_LABELS.get(section_key, section_key)
    lines = [f"<b>{section_label}</b>", ""]
    rows = []
    for b in buttons:
        bid = int(b["id"])
        emoji = b.get("emoji") or ""
        label = b.get("label") or "—"
        active = "✅" if b.get("is_active") else "⏸"
        rows.append([(f"{active} {emoji} {label}", f"axm_btn_{bid}")])
    rows.append([("➕ إضافة زر", f"axm_add_{section_key}")])
    rows.append([("◀️ رجوع", "axm_secs")])
    _edit_or_send(call, "\n".join(lines), _kb(rows))


def _render_button_menu(call, bid):
    uid = call.from_user.id
    if not has_permission(uid, "edit_sections"):
        _ack(call); return
    b = _get_button(bid)
    if not b:
        _ack(call); return
    emoji = b.get("emoji") or ""
    label = b.get("label") or ""
    atype = b.get("action_type") or ""
    aval = b.get("action_value") or ""
    active_txt = "مفعّل ✅" if b.get("is_active") else "معطّل ⏸"
    text = (
        f"<b>{emoji} {label}</b>\n\n"
        f"• الرمز: <code>{emoji}</code>\n"
        f"• الاسم: <code>{label}</code>\n"
        f"• النوع: <code>{atype}</code>\n"
        f"• القيمة: <code>{aval}</code>\n"
        f"• الحالة: {active_txt}\n"
    )
    toggle_txt = "⏸ تعطيل" if b.get("is_active") else "✅ تفعيل"
    rows = [
        [("🎨 تعديل الرمز", f"axm_btn_{bid}_emoji"),
         ("📝 تعديل الاسم", f"axm_btn_{bid}_label")],
        [("🔗 تعديل الرابط/الأكشن", f"axm_btn_{bid}_url")],
        [("⬆️ لأعلى", f"axm_btn_{bid}_up"),
         ("⬇️ لأسفل", f"axm_btn_{bid}_down")],
        [(toggle_txt, f"axm_btn_{bid}_toggle"),
         ("🗑 حذف", f"axm_btn_{bid}_delete")],
        [("◀️ رجوع", f"axm_sec_{b['section_key']}")],
    ]
    _edit_or_send(call, text, _kb(rows))


def _prompt_button_edit(call, bid, what):
    uid = call.from_user.id
    if not has_permission(uid, "edit_sections"):
        _ack(call); return
    hints = {
        "emoji": "ابعت الرمز الجديد (أيموجي واحد زي 💬 أو 🎵)",
        "label": "ابعت الاسم الجديد (أقصى 60 حرف)",
        "url":   "ابعت الرابط الجديد (مثال https://wa.me/201055...) أو callback_data (menu:services)",
    }
    _edit_or_send(call, hints.get(what, "ابعت القيمة الجديدة") + "\n\n/cancel للإلغاء",
                  _kb([[("◀️ رجوع", f"axm_btn_{bid}")]]))
    try:
        _bot.register_next_step_handler_by_chat_id(
            call.message.chat.id, _handle_button_edit_text, uid, int(bid), what
        )
    except Exception:
        _log.exception("register button edit step failed")


def _prompt_add_button(call, section_key):
    uid = call.from_user.id
    if not has_permission(uid, "edit_sections"):
        _ack(call); return
    _edit_or_send(call,
        "➕ <b>إضافة زر جديد</b>\n\n"
        "ابعت الاسم الكامل للزر (مثال: تيليجرام القناة)\n"
        "بعدها هسألك عن الرابط.\n\n/cancel للإلغاء",
        _kb([[("◀️ رجوع", f"axm_sec_{section_key}")]])
    )
    try:
        _bot.register_next_step_handler_by_chat_id(
            call.message.chat.id, _handle_add_button_label, uid, section_key
        )
    except Exception:
        _log.exception("register add button step failed")


def _register_handlers():
    bot = _bot

    @bot.message_handler(commands=["admin_ext", "ax", "axroot"])
    def _cmd_root(message):
        if not is_admin(message.from_user.id):
            return
        class Shim:
            def __init__(self, m):
                self.message = m
                self.from_user = m.from_user
                self.id = "0"
                self.data = ""
        _render_root(Shim(message))

    @bot.callback_query_handler(func=lambda c: bool(c.data) and c.data.startswith("axm_"))
    def _cb(call):
        if not is_admin(call.from_user.id):
            _ack(call); return
        data = call.data
        try:
            if data == "axm_root":
                _ack(call); _render_root(call); return
            if data == "axm_close":
                _ack(call)
                try:
                    bot.delete_message(call.message.chat.id, call.message.message_id)
                except Exception:
                    pass
                return
            if data == "axm_admins":
                _ack(call); _render_admins(call); return
            if data == "axm_adm_add":
                _ack(call); _render_add_admin_prompt(call); return
            if data.startswith("axm_adm_del_"):
                tid = int(data[len("axm_adm_del_"):])
                if has_permission(call.from_user.id, "manage_admins") and tid != _super_admin_id:
                    conn = _get_db()
                    try:
                        with conn.cursor() as cur:
                            cur.execute("UPDATE bot_admins SET is_active=0 WHERE telegram_id=%s", (tid,))
                            conn.commit()
                    finally:
                        try: conn.close()
                        except: pass
                _ack(call); _render_admins(call); return
            if data.startswith("axm_adm_perms_"):
                tid = int(data[len("axm_adm_perms_"):])
                _ack(call); _render_admin_perms(call, tid); return
            if data.startswith("axm_adm_perm_"):
                rest = data[len("axm_adm_perm_"):]
                parts = rest.split("_", 1)
                if len(parts) == 2:
                    tid = int(parts[0]); key = parts[1]
                    _toggle_admin_perm(call, tid, key); return
                _ack(call); return
            if data == "axm_secs":
                _ack(call); _render_sections(call); return
            if data.startswith("axm_sec_"):
                sk = data[len("axm_sec_"):]
                _ack(call); _render_section_buttons(call, sk); return
            if data.startswith("axm_add_"):
                sk = data[len("axm_add_"):]
                _ack(call); _prompt_add_button(call, sk); return
            if data.startswith("axm_btn_"):
                rest = data[len("axm_btn_"):]
                parts = rest.split("_", 1)
                try:
                    bid = int(parts[0])
                except Exception:
                    _ack(call); return
                if len(parts) == 1:
                    _ack(call); _render_button_menu(call, bid); return
                sub = parts[1]
                if sub in ("emoji", "label", "url"):
                    _ack(call); _prompt_button_edit(call, bid, sub); return
                if sub == "up" or sub == "down":
                    _reorder_button(bid, sub)
                    b = _get_button(bid)
                    _ack(call)
                    if b:
                        _render_section_buttons(call, b["section_key"])
                    return
                if sub == "toggle":
                    b = _get_button(bid)
                    if b:
                        _update_button(bid, is_active=0 if b["is_active"] else 1)
                        _render_section_buttons(call, b["section_key"])
                    _ack(call); return
                if sub == "delete":
                    b = _get_button(bid)
                    if b:
                        _delete_button(bid)
                        _render_section_buttons(call, b["section_key"])
                    _ack(call); return
            _ack(call)
        except Exception:
            _log.exception("ax callback failed: %s", data)
            _ack(call)
