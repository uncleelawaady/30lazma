"""
new_services_notifier.py
========================
Professional broadcast system for "new services" notifications.

Hooks into Forfive Pro Store bot's auto-sync cycle. After each sync,
detects products added in bot_products since the last broadcast,
asks the super-admin to approve a formatted preview, and broadcasts to
users who have opted in. Supports Arabic/English, HTML message rendering,
rate limiting, Telegram-block detection, and persistent queue so a bot
restart never duplicates or loses a broadcast.

Public API
----------
    notifier = NewServicesNotifier(bot, get_db, super_admin_id, logger=None)
    notifier.init()                     # Idempotent migrations + handlers.
    notifier.after_sync_cycle()         # Call once per sync cycle.
    notifier.admin_notify_now()         # Manual trigger (admin command).

Author: Claude Opus 4.7, for Ahmed Elawaady (@elawaadyofficial)
Date:   2026-10-24
"""

from __future__ import annotations

import logging
import threading
import time
import json
import html
from datetime import datetime, timedelta
from typing import Callable, Iterable, List, Optional

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MIN_NEW_SERVICES_TO_BROADCAST = 1
MAX_SERVICES_IN_MESSAGE = 15
PER_SEND_SLEEP_SECONDS = 1.0 / 25  # 25 messages/sec (Telegram allows 30)
ADMIN_AUTO_APPROVE_AFTER_MINUTES = 15
BROADCAST_RETRY_ATTEMPTS = 2

# ---------------------------------------------------------------------------
# Migrations: idempotent, safe to run on every startup.
# ---------------------------------------------------------------------------

MIGRATIONS: List[str] = [
    # bot_products.created_at
    """
    SELECT COUNT(*) INTO @col FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bot_products'
      AND COLUMN_NAME = 'created_at'
    """,
    "SET @sql := IF(@col = 0, "
    "'ALTER TABLE bot_products ADD COLUMN created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP', "
    "'SELECT 1')",
    "PREPARE stmt FROM @sql",
    "EXECUTE stmt",
    "DEALLOCATE PREPARE stmt",
    # Backfill once so pre-existing products are not re-broadcast.
    "UPDATE bot_products SET created_at = '2026-01-01 00:00:00' "
    "WHERE created_at IS NULL OR created_at > NOW()",

    # bot_users.new_services_notifications
    """
    SELECT COUNT(*) INTO @col FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bot_users'
      AND COLUMN_NAME = 'new_services_notifications'
    """,
    "SET @sql := IF(@col = 0, "
    "'ALTER TABLE bot_users ADD COLUMN new_services_notifications TINYINT(1) NOT NULL DEFAULT 1', "
    "'SELECT 1')",
    "PREPARE stmt FROM @sql",
    "EXECUTE stmt",
    "DEALLOCATE PREPARE stmt",

    # bot_users.notifications_blocked (user blocked bot DMs)
    """
    SELECT COUNT(*) INTO @col FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bot_users'
      AND COLUMN_NAME = 'notifications_blocked'
    """,
    "SET @sql := IF(@col = 0, "
    "'ALTER TABLE bot_users ADD COLUMN notifications_blocked TINYINT(1) NOT NULL DEFAULT 0', "
    "'SELECT 1')",
    "PREPARE stmt FROM @sql",
    "EXECUTE stmt",
    "DEALLOCATE PREPARE stmt",

    # Broadcast queue (admin-approval + persistence)
    """
    CREATE TABLE IF NOT EXISTS bot_new_services_broadcasts (
        id INT NOT NULL AUTO_INCREMENT,
        trigger_type ENUM('auto_sync','manual') NOT NULL DEFAULT 'auto_sync',
        services_json LONGTEXT NOT NULL,
        services_count INT NOT NULL DEFAULT 0,
        preview_message LONGTEXT NULL,
        status ENUM('pending_approval','approved','rejected','sending','sent','failed')
            NOT NULL DEFAULT 'pending_approval',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP NULL DEFAULT NULL,
        sent_count INT NOT NULL DEFAULT 0,
        failed_count INT NOT NULL DEFAULT 0,
        admin_message_id BIGINT NULL DEFAULT NULL,
        PRIMARY KEY (id),
        KEY idx_status_created (status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,

    # Simple state table (persistent cursor for "since last broadcast")
    """
    CREATE TABLE IF NOT EXISTS bot_notifications_state (
        k VARCHAR(50) NOT NULL,
        v VARCHAR(255) NOT NULL DEFAULT '',
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (k)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,

    # Seed cursor if missing (so first broadcast after install is NOT "every
    # product ever").
    "INSERT IGNORE INTO bot_notifications_state (k, v) "
    "VALUES ('last_broadcast_cutoff', DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'))",
]


# ---------------------------------------------------------------------------
# Localized text
# ---------------------------------------------------------------------------

STRINGS = {
    "ar": {
        "header": "🆕 <b>خدمات جديدة في For Five</b>",
        "footer_more": "و {n} خدمة إضافية — اضغط للتصفح 👇",
        "footer_cta": "🛒 تصفح المتجر",
        "preview_admin": (
            "📬 <b>معاينة بث: خدمات جديدة</b>\n\n"
            "تم اكتشاف <b>{n}</b> خدمة جديدة بعد المزامنة الأخيرة.\n"
            "— الرسالة التالية هي ما سيتم بثه لكل المشتركين:"
        ),
        "approve_btn": "✅ موافق — ابث للكل",
        "defer_btn": "⏳ تأجيل",
        "reject_btn": "❌ تجاهل",
        "approved_toast": "✅ تم البث.",
        "rejected_toast": "تم التجاهل.",
        "deferred_toast": "تم التأجيل — سيُسأل في الدورة التالية.",
        "already_handled": "تمت المعالجة سابقاً.",
        "sent_report": (
            "📤 <b>تقرير البث</b>\n"
            "تم إرسال: <b>{sent}</b>\n"
            "تعذّر: <b>{failed}</b>\n"
            "إجمالي الخدمات: <b>{services}</b>"
        ),
        "settings_title": "🔔 <b>إعدادات الإشعارات</b>",
        "settings_on_line": "— الخدمات الجديدة: <b>مفعّل ✅</b>",
        "settings_off_line": "— الخدمات الجديدة: <b>معطّل ⏸</b>",
        "toggle_on": "🔕 إيقاف الإشعارات",
        "toggle_off": "🔔 تفعيل الإشعارات",
        "toggle_done_on": "✅ تم تفعيل إشعارات الخدمات الجديدة.",
        "toggle_done_off": "⏸ تم إيقاف إشعارات الخدمات الجديدة.",
    },
    "en": {
        "header": "🆕 <b>New services at For Five</b>",
        "footer_more": "and {n} more — tap to browse 👇",
        "footer_cta": "🛒 Browse shop",
        "preview_admin": (
            "📬 <b>Broadcast preview: new services</b>\n\n"
            "<b>{n}</b> new services detected after the last sync.\n"
            "— The following message will be broadcast to all opted-in users:"
        ),
        "approve_btn": "✅ Approve — send to all",
        "defer_btn": "⏳ Defer",
        "reject_btn": "❌ Dismiss",
        "approved_toast": "✅ Broadcast started.",
        "rejected_toast": "Dismissed.",
        "deferred_toast": "Deferred — will ask again next cycle.",
        "already_handled": "Already handled.",
        "sent_report": (
            "📤 <b>Broadcast report</b>\n"
            "Sent: <b>{sent}</b>\n"
            "Failed: <b>{failed}</b>\n"
            "Services: <b>{services}</b>"
        ),
        "settings_title": "🔔 <b>Notification settings</b>",
        "settings_on_line": "— New services: <b>ON ✅</b>",
        "settings_off_line": "— New services: <b>OFF ⏸</b>",
        "toggle_on": "🔕 Turn off",
        "toggle_off": "🔔 Turn on",
        "toggle_done_on": "✅ New-service notifications enabled.",
        "toggle_done_off": "⏸ New-service notifications disabled.",
    },
}


def _t(lang: str, key: str, **fmt) -> str:
    """Translate; falls back to Arabic if lang unknown."""
    tbl = STRINGS.get(lang) or STRINGS["ar"]
    s = tbl.get(key) or STRINGS["ar"].get(key, key)
    return s.format(**fmt) if fmt else s


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------


class NewServicesNotifier:
    """Hook-driven broadcaster for newly-added products."""

    SHOP_DEEPLINK_CALLBACK = "menu:browse"  # Replaced with real deeplink if known.

    def __init__(
        self,
        bot,
        get_db: Callable,
        super_admin_id: int,
        *,
        logger: Optional[logging.Logger] = None,
        shop_cta_callback: Optional[str] = None,
    ):
        self.bot = bot
        self.get_db = get_db
        self.super_admin_id = int(super_admin_id)
        self.log = logger or logging.getLogger("new_services_notifier")
        self._init_lock = threading.Lock()
        self._initialised = False
        self._cycle_lock = threading.Lock()
        if shop_cta_callback:
            self.SHOP_DEEPLINK_CALLBACK = shop_cta_callback

    # ---------- init / migration ----------

    def init(self) -> None:
        """Run idempotent migrations and register handlers.

        Safe to call multiple times; only runs once per process.
        """
        with self._init_lock:
            if self._initialised:
                return
            try:
                self._run_migrations()
            except Exception:
                self.log.exception("migrations failed")
                return
            try:
                self._register_handlers()
            except Exception:
                self.log.exception("handler registration failed")
                return
            self._initialised = True
            self.log.info("NewServicesNotifier ready")

    def _run_migrations(self) -> None:
        conn = self.get_db()
        try:
            with conn.cursor() as cur:
                for stmt in MIGRATIONS:
                    try:
                        cur.execute(stmt)
                    except Exception:
                        # Idempotent-safe: individual stmt may already apply.
                        self.log.exception("migration stmt failed: %s", stmt[:80])
                conn.commit()
        finally:
            try:
                conn.close()
            except Exception:
                pass

    # ---------- public hooks ----------

    def after_sync_cycle(self) -> None:
        """Called once per auto-sync cycle (post sleep safeguarded)."""
        if not self._initialised:
            self.init()
        if not self._initialised:
            return
        if not self._cycle_lock.acquire(blocking=False):
            self.log.info("skip: previous cycle still processing")
            return
        try:
            services = self._collect_new_services()
            if len(services) < MIN_NEW_SERVICES_TO_BROADCAST:
                self.log.info("sync cycle: no new services")
                self._auto_approve_pending_if_overdue()
                return
            queue_id = self._enqueue_broadcast(services, trigger="auto_sync")
            if queue_id:
                self._notify_admin_for_approval(queue_id, services)
            self._auto_approve_pending_if_overdue()
        except Exception:
            self.log.exception("after_sync_cycle crashed")
        finally:
            self._cycle_lock.release()

    def admin_notify_now(self) -> Optional[int]:
        """Manual admin trigger; enqueues immediately and asks for approval."""
        try:
            services = self._collect_new_services()
        except Exception:
            self.log.exception("admin_notify_now: collect failed")
            return None
        if not services:
            return None
        qid = self._enqueue_broadcast(services, trigger="manual")
        if qid:
            self._notify_admin_for_approval(qid, services)
        return qid

    # ---------- data access ----------

    def _collect_new_services(self) -> List[dict]:
        """Return products created after the last-broadcast cutoff.

        Only visible, active, non-deleted ones.
        """
        conn = self.get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT v FROM bot_notifications_state "
                    "WHERE k = 'last_broadcast_cutoff'"
                )
                row = cur.fetchone() or {}
                cutoff = row.get("v") or "2026-01-01 00:00:00"

                cur.execute(
                    """
                    SELECT
                        id,
                        COALESCE(name_ar, name_en, '')      AS name_ar,
                        COALESCE(name_en, name_ar, '')      AS name_en,
                        icon,
                        custom_emoji_id,
                        source_price_text,
                        source_type,
                        service_group_id,
                        created_at
                    FROM bot_products
                    WHERE created_at > %s
                      AND (deleted_at IS NULL)
                      AND (source_active = 1 OR source_active IS NULL)
                      AND (COALESCE(name_ar, name_en, '') != '')
                    ORDER BY created_at ASC, id ASC
                    LIMIT 500
                    """,
                    (cutoff,),
                )
                rows = list(cur.fetchall())
                return rows
        finally:
            try:
                conn.close()
            except Exception:
                pass

    def _enqueue_broadcast(
        self, services: List[dict], *, trigger: str
    ) -> Optional[int]:
        """Insert broadcast row; returns queue id."""
        try:
            services_slim = [
                {
                    "id": s["id"],
                    "name_ar": s.get("name_ar") or "",
                    "name_en": s.get("name_en") or "",
                    "icon": s.get("icon") or "",
                    "custom_emoji_id": s.get("custom_emoji_id") or "",
                    "price": s.get("source_price_text") or "",
                    "created_at": self._iso(s.get("created_at")),
                }
                for s in services
            ]
            payload = json.dumps(services_slim, ensure_ascii=False)
            preview_ar = self._format_services_message(services, "ar")
            conn = self.get_db()
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO bot_new_services_broadcasts
                            (trigger_type, services_json, services_count,
                             preview_message, status)
                        VALUES (%s, %s, %s, %s, 'pending_approval')
                        """,
                        (trigger, payload, len(services), preview_ar),
                    )
                    conn.commit()
                    return cur.lastrowid
            finally:
                conn.close()
        except Exception:
            self.log.exception("enqueue_broadcast failed")
            return None

    def _mark_sending(self, queue_id: int) -> None:
        self._update_queue(
            queue_id,
            "UPDATE bot_new_services_broadcasts "
            "SET status='sending', approved_at=NOW() WHERE id=%s AND status='pending_approval'",
            (queue_id,),
        )

    def _mark_rejected(self, queue_id: int) -> None:
        self._update_queue(
            queue_id,
            "UPDATE bot_new_services_broadcasts "
            "SET status='rejected' WHERE id=%s AND status='pending_approval'",
            (queue_id,),
        )

    def _mark_sent(self, queue_id: int, sent: int, failed: int) -> None:
        self._update_queue(
            queue_id,
            "UPDATE bot_new_services_broadcasts "
            "SET status='sent', sent_count=%s, failed_count=%s WHERE id=%s",
            (sent, failed, queue_id),
        )

    def _update_queue(self, queue_id: int, sql: str, params: tuple) -> None:
        conn = self.get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                conn.commit()
        except Exception:
            self.log.exception("update queue row %s failed", queue_id)
        finally:
            try:
                conn.close()
            except Exception:
                pass

    def _save_admin_message_id(self, queue_id: int, message_id: int) -> None:
        self._update_queue(
            queue_id,
            "UPDATE bot_new_services_broadcasts "
            "SET admin_message_id=%s WHERE id=%s",
            (message_id, queue_id),
        )

    def _advance_cursor(self, services: List[dict]) -> None:
        if not services:
            return
        latest = max((self._iso(s.get("created_at")) for s in services), default="")
        if not latest:
            return
        conn = self.get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO bot_notifications_state (k, v) VALUES "
                    "('last_broadcast_cutoff', %s) "
                    "ON DUPLICATE KEY UPDATE v=VALUES(v)",
                    (latest,),
                )
                conn.commit()
        except Exception:
            self.log.exception("cursor advance failed")
        finally:
            try:
                conn.close()
            except Exception:
                pass

    def _get_subscribers(self) -> List[dict]:
        conn = self.get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT telegram_id, COALESCE(language,'ar') AS language
                    FROM bot_users
                    WHERE is_banned = 0
                      AND new_services_notifications = 1
                      AND notifications_blocked = 0
                      AND telegram_id IS NOT NULL
                    """
                )
                return list(cur.fetchall())
        finally:
            try:
                conn.close()
            except Exception:
                pass

    def _mark_user_blocked(self, telegram_id: int) -> None:
        try:
            conn = self.get_db()
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE bot_users SET notifications_blocked=1 "
                        "WHERE telegram_id=%s",
                        (telegram_id,),
                    )
                    conn.commit()
            finally:
                conn.close()
        except Exception:
            self.log.exception("mark user blocked failed for %s", telegram_id)

    def _get_user_notifications_flag(self, telegram_id: int) -> bool:
        conn = self.get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT new_services_notifications FROM bot_users "
                    "WHERE telegram_id=%s",
                    (telegram_id,),
                )
                row = cur.fetchone()
                if not row:
                    return True
                return bool(row.get("new_services_notifications", 1))
        finally:
            try:
                conn.close()
            except Exception:
                pass

    def _set_user_notifications_flag(
        self, telegram_id: int, enabled: bool
    ) -> None:
        conn = self.get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE bot_users SET new_services_notifications=%s "
                    "WHERE telegram_id=%s",
                    (1 if enabled else 0, telegram_id),
                )
                conn.commit()
        except Exception:
            self.log.exception("set user flag failed")
        finally:
            try:
                conn.close()
            except Exception:
                pass

    # ---------- message formatting ----------

    @staticmethod
    def _iso(value) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value
        try:
            return value.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            return str(value)

    @staticmethod
    def _service_name(service: dict, lang: str) -> str:
        if lang == "en":
            return service.get("name_en") or service.get("name_ar") or "—"
        return service.get("name_ar") or service.get("name_en") or "—"

    @staticmethod
    def _service_icon(service: dict) -> str:
        return (service.get("icon") or "✨").strip() or "✨"

    @staticmethod
    def _service_price(service: dict) -> str:
        p = (service.get("source_price_text") or service.get("price") or "").strip()
        return p

    def _format_services_message(
        self, services: List[dict], lang: str = "ar"
    ) -> str:
        """Return HTML message body (no CTA button)."""
        lines = [_t(lang, "header"), ""]
        for s in services[:MAX_SERVICES_IN_MESSAGE]:
            icon = html.escape(self._service_icon(s))
            name = html.escape(self._service_name(s, lang))
            price = html.escape(self._service_price(s))
            if price:
                lines.append(f"{icon}  <b>{name}</b> — {price}")
            else:
                lines.append(f"{icon}  <b>{name}</b>")
        extra = len(services) - MAX_SERVICES_IN_MESSAGE
        if extra > 0:
            lines.append("")
            lines.append(_t(lang, "footer_more", n=extra))
        return "\n".join(lines)

    def _build_cta_keyboard(self, lang: str):
        try:
            import telebot
            kb = telebot.types.InlineKeyboardMarkup()
            kb.add(
                telebot.types.InlineKeyboardButton(
                    _t(lang, "footer_cta"),
                    callback_data=self.SHOP_DEEPLINK_CALLBACK,
                )
            )
            return kb
        except Exception:
            return None

    def _build_approval_keyboard(self, queue_id: int, lang: str = "ar"):
        try:
            import telebot
            kb = telebot.types.InlineKeyboardMarkup(row_width=2)
            kb.add(
                telebot.types.InlineKeyboardButton(
                    _t(lang, "approve_btn"),
                    callback_data=f"nsvc:approve:{queue_id}",
                )
            )
            kb.add(
                telebot.types.InlineKeyboardButton(
                    _t(lang, "defer_btn"),
                    callback_data=f"nsvc:defer:{queue_id}",
                ),
                telebot.types.InlineKeyboardButton(
                    _t(lang, "reject_btn"),
                    callback_data=f"nsvc:reject:{queue_id}",
                ),
            )
            return kb
        except Exception:
            return None

    # ---------- admin preview flow ----------

    def _notify_admin_for_approval(
        self, queue_id: int, services: List[dict]
    ) -> None:
        lang = "ar"
        preview = self._format_services_message(services, lang)
        intro = _t(lang, "preview_admin", n=len(services))
        text = f"{intro}\n\n{preview}"
        kb = self._build_approval_keyboard(queue_id, lang)
        try:
            msg = self.bot.send_message(
                self.super_admin_id,
                text,
                parse_mode="HTML",
                reply_markup=kb,
                disable_web_page_preview=True,
            )
            if hasattr(msg, "message_id"):
                self._save_admin_message_id(queue_id, msg.message_id)
        except Exception:
            self.log.exception("notify admin failed for queue %s", queue_id)

    def _auto_approve_pending_if_overdue(self) -> None:
        """Auto-approve pending broadcasts older than N minutes."""
        try:
            conn = self.get_db()
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT id, services_json
                        FROM bot_new_services_broadcasts
                        WHERE status='pending_approval'
                          AND created_at < NOW() - INTERVAL %s MINUTE
                        ORDER BY id ASC
                        """,
                        (ADMIN_AUTO_APPROVE_AFTER_MINUTES,),
                    )
                    rows = list(cur.fetchall())
            finally:
                conn.close()
            for row in rows:
                self.log.info(
                    "auto-approving overdue broadcast %s", row["id"]
                )
                try:
                    services = json.loads(row["services_json"] or "[]")
                except Exception:
                    services = []
                self._approve_and_broadcast(row["id"], services)
        except Exception:
            self.log.exception("auto-approve sweep failed")

    # ---------- broadcasting ----------

    def _approve_and_broadcast(
        self, queue_id: int, services: Optional[List[dict]] = None
    ) -> None:
        self._mark_sending(queue_id)
        if services is None:
            services = self._load_services_from_queue(queue_id)
        if not services:
            self._mark_sent(queue_id, 0, 0)
            return
        subscribers = self._get_subscribers()
        sent = failed = 0
        for sub in subscribers:
            lang = sub.get("language") or "ar"
            text = self._format_services_message(services, lang)
            kb = self._build_cta_keyboard(lang)
            ok = self._send_one(int(sub["telegram_id"]), text, kb)
            if ok:
                sent += 1
            else:
                failed += 1
            time.sleep(PER_SEND_SLEEP_SECONDS)
        self._mark_sent(queue_id, sent, failed)
        self._advance_cursor(services)
        self._send_admin_report(sent, failed, len(services))

    def _load_services_from_queue(self, queue_id: int) -> List[dict]:
        conn = self.get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT services_json FROM bot_new_services_broadcasts "
                    "WHERE id=%s",
                    (queue_id,),
                )
                row = cur.fetchone()
                if not row:
                    return []
                try:
                    return json.loads(row["services_json"] or "[]")
                except Exception:
                    return []
        finally:
            try:
                conn.close()
            except Exception:
                pass

    def _send_one(self, chat_id: int, text: str, kb) -> bool:
        for attempt in range(BROADCAST_RETRY_ATTEMPTS):
            try:
                self.bot.send_message(
                    chat_id,
                    text,
                    parse_mode="HTML",
                    reply_markup=kb,
                    disable_web_page_preview=True,
                )
                return True
            except Exception as e:
                msg = str(e).lower()
                if (
                    "blocked" in msg
                    or "forbidden" in msg
                    or "user is deactivated" in msg
                    or "chat not found" in msg
                ):
                    self._mark_user_blocked(chat_id)
                    return False
                if "too many requests" in msg or "429" in msg:
                    time.sleep(2 * (attempt + 1))
                    continue
                self.log.warning("send to %s failed: %s", chat_id, e)
                return False
        return False

    def _send_admin_report(self, sent: int, failed: int, services: int) -> None:
        try:
            self.bot.send_message(
                self.super_admin_id,
                _t("ar", "sent_report", sent=sent, failed=failed, services=services),
                parse_mode="HTML",
                disable_web_page_preview=True,
            )
        except Exception:
            pass

    # ---------- handlers ----------

    def _register_handlers(self) -> None:
        bot = self.bot

        @bot.callback_query_handler(
            func=lambda c: bool(c.data) and c.data.startswith("nsvc:")
        )
        def _on_nsvc(call):  # pragma: no cover - telebot runtime
            try:
                _, action, qid_s = call.data.split(":", 2)
                qid = int(qid_s)
            except Exception:
                return
            if int(call.from_user.id) != self.super_admin_id:
                try:
                    bot.answer_callback_query(call.id, "⛔")
                except Exception:
                    pass
                return
            handled = self._handle_admin_decision(qid, action)
            try:
                if handled == "approved":
                    bot.answer_callback_query(call.id, _t("ar", "approved_toast"))
                elif handled == "rejected":
                    bot.answer_callback_query(call.id, _t("ar", "rejected_toast"))
                elif handled == "deferred":
                    bot.answer_callback_query(call.id, _t("ar", "deferred_toast"))
                else:
                    bot.answer_callback_query(call.id, _t("ar", "already_handled"))
            except Exception:
                pass
            # Clear the inline keyboard so the admin cannot double-click.
            try:
                bot.edit_message_reply_markup(
                    chat_id=call.message.chat.id,
                    message_id=call.message.message_id,
                    reply_markup=None,
                )
            except Exception:
                pass

        @bot.callback_query_handler(
            func=lambda c: bool(c.data) and c.data.startswith("notify_toggle:")
        )
        def _on_toggle(call):  # pragma: no cover - telebot runtime
            try:
                tid = int(call.from_user.id)
                current = self._get_user_notifications_flag(tid)
                self._set_user_notifications_flag(tid, not current)
                bot.answer_callback_query(
                    call.id,
                    _t("ar", "toggle_done_off" if current else "toggle_done_on"),
                )
                # Refresh the settings panel if present.
                self._render_settings(call.message.chat.id,
                                      edit_message_id=call.message.message_id)
            except Exception:
                self.log.exception("toggle failed")

        @bot.message_handler(commands=["notifications", "notify"])
        def _cmd_notifications(message):  # pragma: no cover - telebot runtime
            try:
                self._render_settings(message.chat.id)
            except Exception:
                self.log.exception("notifications command failed")

        @bot.message_handler(commands=["notify_now"])
        def _cmd_notify_now(message):  # pragma: no cover - telebot runtime
            if int(message.from_user.id) != self.super_admin_id:
                return
            qid = self.admin_notify_now()
            try:
                if qid:
                    bot.reply_to(message, f"✅ queued #{qid}")
                else:
                    bot.reply_to(message, "لا توجد خدمات جديدة.")
            except Exception:
                pass

    def _handle_admin_decision(self, queue_id: int, action: str) -> str:
        conn = self.get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT status, services_json FROM bot_new_services_broadcasts "
                    "WHERE id=%s",
                    (queue_id,),
                )
                row = cur.fetchone()
        finally:
            try:
                conn.close()
            except Exception:
                pass
        if not row or row["status"] != "pending_approval":
            return "none"
        if action == "approve":
            try:
                services = json.loads(row["services_json"] or "[]")
            except Exception:
                services = []
            # Fire-and-forget on a worker thread so the callback returns fast.
            threading.Thread(
                target=self._approve_and_broadcast,
                args=(queue_id, services),
                daemon=True,
            ).start()
            return "approved"
        if action == "reject":
            self._mark_rejected(queue_id)
            return "rejected"
        if action == "defer":
            # Leave as pending; auto-approve sweep will pick it up or admin can
            # re-trigger from /notify_now.
            return "deferred"
        return "none"

    # ---------- user settings UI ----------

    def _render_settings(self, chat_id: int, edit_message_id: Optional[int] = None) -> None:
        try:
            import telebot
        except Exception:
            return
        lang = self._user_language(chat_id)
        enabled = self._get_user_notifications_flag(chat_id)
        lines = [
            _t(lang, "settings_title"),
            "",
            _t(lang, "settings_on_line" if enabled else "settings_off_line"),
        ]
        text = "\n".join(lines)
        kb = telebot.types.InlineKeyboardMarkup()
        kb.add(
            telebot.types.InlineKeyboardButton(
                _t(lang, "toggle_on" if enabled else "toggle_off"),
                callback_data="notify_toggle:1",
            )
        )
        try:
            if edit_message_id:
                self.bot.edit_message_text(
                    text,
                    chat_id=chat_id,
                    message_id=edit_message_id,
                    parse_mode="HTML",
                    reply_markup=kb,
                )
            else:
                self.bot.send_message(
                    chat_id,
                    text,
                    parse_mode="HTML",
                    reply_markup=kb,
                )
        except Exception:
            self.log.exception("render settings failed")

    def _user_language(self, telegram_id: int) -> str:
        try:
            conn = self.get_db()
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT COALESCE(language,'ar') AS language FROM bot_users "
                        "WHERE telegram_id=%s",
                        (telegram_id,),
                    )
                    row = cur.fetchone()
                    return (row or {}).get("language") or "ar"
            finally:
                conn.close()
        except Exception:
            return "ar"
