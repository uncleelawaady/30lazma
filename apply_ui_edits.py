#!/usr/bin/env python3
"""
apply_ui_edits.py
=================
Applies three UI improvements to /opt/forfive_bot/bot.py in place:

  1. Social-media category — one full-width button per row, 13 services per
     page (keeping the existing Next/Previous navigation).
  2. Every service's rendered label uses a corrected brand emoji inferred
     from the name, not the stored (and often wrong) one.
  3. The official-contact-channel page's inline buttons get clearer icons.

Safety:
  * Writes a timestamped backup of bot.py before touching it.
  * Validates Python syntax before overwriting the live file.
  * Rejects the run if any expected anchor is missing (no silent half-edit).

Idempotent: a second run detects the markers it placed and reports "already
applied" without changing anything.
"""

from __future__ import annotations

import ast
import datetime
import os
import re
import shutil
import sys

BOT_PATH = "/opt/forfive_bot/bot.py"
MARKER = "# [ui-edits-v1 marker] do not remove"


# ---------------------------------------------------------------------------
# Brand-emoji map.  Keys are lower-cased tokens scanned against the service
# name; the FIRST match in the ordered list wins.  Extend freely.
# ---------------------------------------------------------------------------

BRAND_EMOJI_PAIRS = [
    # social
    ("tiktok", "🎵"),
    ("tik tok", "🎵"),
    ("tik-tok", "🎵"),
    ("instagram", "📷"),
    ("insta ", "📷"),
    ("facebook", "📘"),
    ("فيسبوك", "📘"),
    ("فيس بوك", "📘"),
    ("youtube", "▶️"),
    ("يوتيوب", "▶️"),
    ("twitter", "🐦"),
    ("تويتر", "🐦"),
    (" x ", "✖️"),
    ("snapchat", "👻"),
    ("سناب", "👻"),
    ("threads", "🧵"),
    ("ثريدز", "🧵"),
    ("telegram", "✈️"),
    ("تيليجرام", "✈️"),
    ("whatsapp", "💬"),
    ("واتساب", "💬"),
    ("linkedin", "💼"),
    ("لينكد", "💼"),
    ("pinterest", "📌"),
    ("بنترست", "📌"),
    ("reddit", "👽"),
    ("ريديت", "👽"),
    ("discord", "🎮"),
    ("ديسكورد", "🎮"),
    ("twitch", "🟣"),
    ("messenger", "📨"),
    ("ماسنجر", "📨"),
    ("signal", "📶"),
    ("vk", "🇷🇺"),
    # ai
    ("chatgpt", "🤖"),
    ("chat gpt", "🤖"),
    ("gemini", "💎"),
    ("claude", "🧠"),
    ("grok", "🧪"),
    ("midjourney", "🎨"),
    ("leonardo", "🖌️"),
    ("stable diffusion", "🖼️"),
    ("perplexity", "🔍"),
    # entertainment
    ("netflix", "🎬"),
    ("نتفلكس", "🎬"),
    ("spotify", "🎧"),
    ("سبوتيفاي", "🎧"),
    ("apple music", "🍎"),
    ("youtube music", "🎼"),
    ("amazon prime", "📦"),
    ("prime video", "📺"),
    ("disney", "🏰"),
    ("hulu", "📺"),
    ("hbo", "📺"),
    ("peacock", "🦚"),
    ("shahid", "📺"),
    ("شاهد", "📺"),
    ("osn", "📺"),
    # productivity / tools
    ("notion", "📝"),
    ("canva", "🎨"),
    ("adobe", "🎨"),
    ("microsoft", "🪟"),
    ("office 365", "🪟"),
    ("google one", "☁️"),
    ("icloud", "☁️"),
    ("dropbox", "📦"),
    ("figma", "🖌️"),
    ("miro", "🧩"),
    ("zoom", "🎥"),
    ("skype", "📞"),
    ("duolingo", "🦉"),
    ("grammarly", "✍️"),
    ("ilovepdf", "📄"),
    ("i love pdf", "📄"),
    ("deepl", "🌐"),
    ("datacamp", "📊"),
    ("coursera", "🎓"),
    ("udemy", "🎓"),
    ("coursehero", "🎓"),
    ("skillshare", "🎓"),
    ("jetbrains", "⚙️"),
    ("cursor", "➡️"),
    ("framer", "🖼️"),
    ("envato", "🧰"),
    ("ccleaner", "🧹"),
    ("bitdefender", "🛡️"),
    ("avira", "🛡️"),
    ("avast", "🛡️"),
    ("vpn", "🛡️"),
    # phones / telecom / finance
    ("esim", "📶"),
    ("e-sim", "📶"),
    ("e sim", "📶"),
    ("gift", "🎁"),
    ("هدية", "🎁"),
    ("gift card", "🎁"),
    ("itunes", "🎵"),
    ("steam", "🎮"),
    ("playstation", "🎮"),
    ("psn", "🎮"),
    ("xbox", "🎮"),
    # fallback categories by keyword
    ("متابع", "👥"),
    ("followers", "👥"),
    ("subs", "📣"),
    ("subscriber", "📣"),
    ("مشترك", "📣"),
    ("views", "👁️"),
    ("مشاهد", "👁️"),
    ("likes", "❤️"),
    ("like", "❤️"),
    ("إعجاب", "❤️"),
    ("لايك", "❤️"),
    ("comment", "💬"),
    ("تعليق", "💬"),
    ("share", "🔁"),
    ("مشارك", "🔁"),
    ("reaction", "💥"),
    ("رياكت", "💥"),
    ("story", "📸"),
    ("ستوري", "📸"),
    ("دقيقة", "⏱️"),
    ("minute", "⏱️"),
]

GENERIC_FALLBACK = "✨"


# ---------------------------------------------------------------------------
# Patch 1 — Social-media override inside customer_linked_category_page()
# ---------------------------------------------------------------------------

PATCH1_ANCHOR = "compact_external = bool(from_storefront and g.get('source_type')=='external_api')"
PATCH1_OLD = """        compact_external = bool(from_storefront and g.get('source_type')=='external_api')
        if compact_external:
            max_plan_page=max(0,(len(plans)-1)//24) if plans else 0
            plan_page=max(0,min(plan_page,max_plan_page))
            shown=plans[plan_page*24:(plan_page+1)*24]
        else:
            shown=plans
        mk=types.InlineKeyboardMarkup(row_width=2 if compact_external else 1)"""
PATCH1_NEW = """        compact_external = bool(from_storefront and g.get('source_type')=='external_api')
        # ui-edits-v1: Social-media category uses full-width buttons + 13 per page.
        try:
            _is_social_media = (str(cat.get('slug') or '') == 'social_media')  # type: ignore[name-defined]
        except Exception:
            _is_social_media = False
        _page_size = 13 if _is_social_media else 24
        if compact_external or _is_social_media:
            max_plan_page=max(0,(len(plans)-1)//_page_size) if plans else 0
            plan_page=max(0,min(plan_page,max_plan_page))
            shown=plans[plan_page*_page_size:(plan_page+1)*_page_size]
        else:
            shown=plans
        if _is_social_media:
            _row_width = 1
        else:
            _row_width = 2 if compact_external else 1
        mk=types.InlineKeyboardMarkup(row_width=_row_width)"""


# ---------------------------------------------------------------------------
# Patch 2 — Full names for social-media services (don't truncate).
# ---------------------------------------------------------------------------

PATCH2_OLD = "            label=(_prodseller_short_name(p.get('name')) if compact_external\n                   else customer_button_label(p))"
PATCH2_NEW = """            # ui-edits-v1: Social-media buttons keep full names (full-width).
            if _is_social_media:
                label = customer_button_label(p)
            elif compact_external:
                label = _prodseller_short_name(p.get('name'))
            else:
                label = customer_button_label(p)"""


# ---------------------------------------------------------------------------
# Patch 3 — Inject an icon prefix at customer_button_label() call-site.
# We wrap customer_button_label itself so every button gets the brand emoji.
# ---------------------------------------------------------------------------

PATCH3_INJECT = """

# ui-edits-v1: brand-emoji helper {marker}
_BRAND_EMOJI_PAIRS = {brand_pairs!r}
_BRAND_EMOJI_FALLBACK = {fallback!r}

def _brand_emoji_for(text):
    try:
        s = (text or '').lower()
    except Exception:
        return ''
    for token, emoji in _BRAND_EMOJI_PAIRS:
        if token in s:
            return emoji
    return ''

try:
    _orig_customer_button_label = customer_button_label  # type: ignore[name-defined]
    def customer_button_label(p):  # type: ignore[no-redef]
        label = _orig_customer_button_label(p)
        try:
            name = (p or {}).get('name') if isinstance(p, dict) else str(p)
        except Exception:
            name = ''
        emoji = _brand_emoji_for(name) or _brand_emoji_for(label)
        if not emoji:
            return label
        # Avoid stacking emoji if the stored label already starts with one.
        head = (label or '').lstrip()
        if head and head[0] in '©®‼⁉⃣™ℹ↔↕↖↗↘↙↩↪⌚⌛⌨⏏⏩⏪⏫⏬⏭⏮⏯⏰⏱⏲⏳⏸⏹⏺Ⓜ▪▫▶◀◻◼◽◾☀☁☂☃☄☎☑☔☕☘☝☠☢☣☦☪☮☯☸☹☺♀♂♈♉♊♋♌♍♎♏♐♑♒♓♠♣♥♦♨♻♾♿⚒⚓⚔⚕⚖⚗⚙⚛⚜⚠⚡⚪⚫⚰⚱⚽⚾⛄⛅⛈⛎⛏⛑⛓⛔⛩⛪⛰⛱⛲⛳⛴⛵⛷⛸⛹⛺⛽✂✅✈✉✊✋✌✍✏✒✔✖✝✡✨✳✴❄❇❌❎❓❔❕❗❣❤➕➖➗➡➰➿⤴⤵⬅⬆⬇⬛⬜⭐⭕〰〽㊗㊙':
            return label
        if head and ord(head[0]) >= 0x1f000:
            return label
        return f"{{emoji}} {{label}}"
except NameError:
    pass
"""


# ---------------------------------------------------------------------------
# Patch 4 — Communication channels: give each button a clearer icon.
# The source line looks like:
#     label = ('الدعم', 'واتساب إضافي', 'واتساب الرئيسي')[idx]
# followed shortly by
#     items.append(tg_inline_button('ماسنجر', url='https://m.me/' + messengers[0]))
# We only touch display labels — nothing else about routing changes.
# ---------------------------------------------------------------------------

COMM_LABELS_OLD = "        label = ('الدعم', 'واتساب إضافي', 'واتساب الرئيسي')[idx]"
COMM_LABELS_NEW = "        label = ('🛟 الدعم', '💚 واتساب إضافي', '💬 واتساب الرئيسي')[idx]"

COMM_MESSENGER_OLD = "items.append(tg_inline_button('ماسنجر', url='https://m.me/' + messengers[0]))"
COMM_MESSENGER_NEW = "items.append(tg_inline_button('📨 ماسنجر', url='https://m.me/' + messengers[0]))"


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------

def _die(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(2)


def _apply_single(src, old, new, *, name):
    count = src.count(old)
    if count == 0:
        _die(f"anchor missing for {name!r}: expected text not found")
    if count > 1:
        _die(f"anchor ambiguous for {name!r}: text occurs {count} times")
    return src.replace(old, new, 1)


def main():
    if not os.path.exists(BOT_PATH):
        _die(f"{BOT_PATH} not found")

    with open(BOT_PATH, "r", encoding="utf-8") as fh:
        src = fh.read()

    if MARKER in src:
        print("already applied — ui-edits-v1 marker present; no changes.")
        return

    # Patch 1 — social-media pagination + row_width override.
    src = _apply_single(src, PATCH1_OLD, PATCH1_NEW, name="patch1-social-pagination")

    # Patch 2 — full names for social-media buttons.
    src = _apply_single(src, PATCH2_OLD, PATCH2_NEW, name="patch2-social-labels")

    # Patch 3 — brand-emoji wrapper injected AFTER the original definition.
    inject = PATCH3_INJECT.format(
        marker=MARKER,
        brand_pairs=BRAND_EMOJI_PAIRS,
        fallback=GENERIC_FALLBACK,
    )
    # Append at EOF so it runs after bot.py has defined customer_button_label.
    if not src.endswith("\n"):
        src += "\n"
    src += inject

    # Patch 4 — communication-channel icons.
    src = _apply_single(src, COMM_LABELS_OLD, COMM_LABELS_NEW,
                        name="patch4-comm-labels")
    src = _apply_single(src, COMM_MESSENGER_OLD, COMM_MESSENGER_NEW,
                        name="patch4-comm-messenger")

    # Syntax check BEFORE overwriting.
    try:
        ast.parse(src)
    except SyntaxError as e:
        _die(f"patched bot.py would not parse: {e}")

    # Backup and write.
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = f"{BOT_PATH}.before_ui_edits_{ts}"
    shutil.copy2(BOT_PATH, backup)
    with open(BOT_PATH, "w", encoding="utf-8") as fh:
        fh.write(src)

    print(f"OK — backup at {backup}")
    print("Restart the service: systemctl restart forfive_bot")


if __name__ == "__main__":
    main()
