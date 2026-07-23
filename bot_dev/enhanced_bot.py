import logging
import os
import re
from datetime import datetime
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, User
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters, ContextTypes
from yt_dlp import YoutubeDL
from database import (
    init_db, register_user, log_download, get_user, is_admin,
    get_stats, get_top_users, get_today_stats, get_users_list, log_admin_action
)

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.getenv('BOT_TOKEN', '')
ADMIN_ID = 7613454215

VIDEO_MODE, ACCOUNT_MODE_COUNT, ACCOUNT_MODE_LINK = range(3)
user_data = {}

# Detect platform from URL
def detect_platform(url: str) -> str:
    """Detect video platform from URL."""
    url_lower = url.lower()
    if 'tiktok.com' in url_lower or 'vm.tiktok.com' in url_lower:
        return 'tiktok'
    elif 'youtube.com' in url_lower or 'youtu.be' in url_lower or 'youtube.com/shorts' in url_lower:
        return 'youtube'
    elif 'instagram.com' in url_lower or 'ig.com' in url_lower:
        return 'instagram'
    elif 'facebook.com' in url_lower or 'fb.watch' in url_lower:
        return 'facebook'
    elif 'x.com' in url_lower or 'twitter.com' in url_lower:
        return 'x'
    return 'unknown'

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command and register user."""
    user = update.message.from_user
    telegram_user_id = user.id

    # Register user
    register_user(
        telegram_user_id=telegram_user_id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        language_code=user.language_code or 'ar',
        is_bot=user.is_bot
    )

    keyboard = [
        [InlineKeyboardButton("🎬 فيديو واحد", callback_data='single_video')],
        [InlineKeyboardButton("👤 حساب كامل", callback_data='full_account')]
    ]

    if is_admin(telegram_user_id):
        keyboard.append([InlineKeyboardButton("📊 لوحة التحكم", callback_data='admin_dashboard')])

    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text("مرحباً بك في @exd_downloader_bot 🎬\n\nحمّل فيديوهات تيك توك ويوتيوب بدون علامة مائية وبجودة عالية.", reply_markup=reply_markup)

async def button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle button presses."""
    query = update.callback_query
    await query.answer()
    chat_id = query.message.chat_id
    user_id = query.from_user.id

    if query.data == 'single_video':
        user_data[chat_id] = {'mode': VIDEO_MODE}
        await query.edit_message_text(text="الرجاء إرسال رابط الفيديو.")
    elif query.data == 'full_account':
        user_data[chat_id] = {'mode': ACCOUNT_MODE_COUNT}
        await query.edit_message_text(text="كم عدد الفيديوهات المطلوب جلبها من الحساب؟ (أرسل رقماً فقط)")
    elif query.data == 'admin_dashboard' and is_admin(user_id):
        await show_admin_dashboard(query, context)
    elif query.data.startswith('admin_') and is_admin(user_id):
        await handle_admin_action(query, context, query.data)

async def show_admin_dashboard(query, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show admin dashboard."""
    admin_id = query.from_user.id

    keyboard = [
        [InlineKeyboardButton("📈 الإحصائيات", callback_data='admin_stats')],
        [InlineKeyboardButton("👥 المستخدمين", callback_data='admin_users')],
        [InlineKeyboardButton("⭐ المستخدمون الأفضل", callback_data='admin_top')],
        [InlineKeyboardButton("📅 إحصائيات اليوم", callback_data='admin_today')],
        [InlineKeyboardButton("🔙 رجوع", callback_data='back_main')]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.edit_message_text(text="لوحة التحكم الإدارية 📊", reply_markup=reply_markup)
    log_admin_action(admin_id, 'view_dashboard')

async def handle_admin_action(query, context: ContextTypes.DEFAULT_TYPE, action: str) -> None:
    """Handle admin actions."""
    admin_id = query.from_user.id

    if action == 'admin_stats':
        stats = get_stats()
        message = f"""
📊 **الإحصائيات العامة:**

👥 إجمالي المستخدمين: {stats['total_users']}
📥 إجمالي التحميلات الناجحة: {stats['total_downloads']}
🟢 المستخدمين النشطين (24 ساعة): {stats['active_24h']}

📱 تفصيل المنصات:
"""
        for platform in stats['platform_stats']:
            message += f"  • {platform['platform'].upper()}: {platform['count']}\n"

        keyboard = [[InlineKeyboardButton("🔙 رجوع", callback_data='admin_dashboard')]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(text=message, reply_markup=reply_markup)
        log_admin_action(admin_id, 'view_stats')

    elif action == 'admin_top':
        top_users = get_top_users(10)
        message = "⭐ **أفضل 10 مستخدمين:**\n\n"
        for idx, user in enumerate(top_users, 1):
            first_name = user.get('first_name') or 'Unknown'
            message += f"{idx}. {first_name} - {user['total_downloads']} تحميل\n"

        keyboard = [[InlineKeyboardButton("🔙 رجوع", callback_data='admin_dashboard')]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(text=message, reply_markup=reply_markup)
        log_admin_action(admin_id, 'view_top_users')

    elif action == 'admin_today':
        today_stats = get_today_stats()
        message = f"""
📅 **إحصائيات اليوم:**

📥 التحميلات: {today_stats['downloads_today']}
🆕 مستخدمين جدد: {today_stats['new_users_today']}

📱 تفصيل المنصات:
"""
        for platform in today_stats['platform_breakdown']:
            message += f"  • {platform['platform'].upper()}: {platform['count']}\n"

        keyboard = [[InlineKeyboardButton("🔙 رجوع", callback_data='admin_dashboard')]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(text=message, reply_markup=reply_markup)
        log_admin_action(admin_id, 'view_today_stats')

    elif action == 'admin_users':
        users = get_users_list(10, 0)
        message = "👥 **أحدث 10 مستخدمين:**\n\n"
        for user in users:
            first_name = user.get('first_name') or 'Unknown'
            message += f"• {first_name} - {user['total_downloads']} تحميل\n"

        keyboard = [[InlineKeyboardButton("🔙 رجوع", callback_data='admin_dashboard')]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(text=message, reply_markup=reply_markup)
        log_admin_action(admin_id, 'view_users')

    elif action == 'back_main':
        keyboard = [
            [InlineKeyboardButton("🎬 فيديو واحد", callback_data='single_video')],
            [InlineKeyboardButton("👤 حساب كامل", callback_data='full_account')],
            [InlineKeyboardButton("📊 لوحة التحكم", callback_data='admin_dashboard')]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(text="مرحباً بك في @exd_downloader_bot 🎬", reply_markup=reply_markup)

async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Admin /stats command."""
    user_id = update.message.from_user.id
    if not is_admin(user_id):
        await update.message.reply_text("⛔ أنت لست صاحب صلاحيات إدارية.")
        return

    stats = get_stats()
    message = f"""
📊 **الإحصائيات العامة:**

👥 إجمالي المستخدمين: {stats['total_users']}
📥 إجمالي التحميلات الناجحة: {stats['total_downloads']}
🟢 المستخدمين النشطين (24 ساعة): {stats['active_24h']}

📱 تفصيل المنصات:
"""
    for platform in stats['platform_stats']:
        message += f"  • {platform['platform'].upper()}: {platform['count']}\n"

    await update.message.reply_text(message)
    log_admin_action(user_id, 'cmd_stats')

async def top_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Admin /top command."""
    user_id = update.message.from_user.id
    if not is_admin(user_id):
        await update.message.reply_text("⛔ أنت لست صاحب صلاحيات إدارية.")
        return

    top_users = get_top_users(10)
    message = "⭐ **أفضل 10 مستخدمين:**\n\n"
    for idx, user in enumerate(top_users, 1):
        first_name = user.get('first_name') or 'Unknown'
        message += f"{idx}. {first_name} - {user['total_downloads']} تحميل\n"

    await update.message.reply_text(message)
    log_admin_action(user_id, 'cmd_top')

async def today_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Admin /today command."""
    user_id = update.message.from_user.id
    if not is_admin(user_id):
        await update.message.reply_text("⛔ أنت لست صاحب صلاحيات إدارية.")
        return

    today_stats = get_today_stats()
    message = f"""
📅 **إحصائيات اليوم:**

📥 التحميلات: {today_stats['downloads_today']}
🆕 مستخدمين جدد: {today_stats['new_users_today']}

📱 تفصيل المنصات:
"""
    for platform in today_stats['platform_breakdown']:
        message += f"  • {platform['platform'].upper()}: {platform['count']}\n"

    await update.message.reply_text(message)
    log_admin_action(user_id, 'cmd_today')

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle text messages."""
    chat_id = update.message.chat_id
    user_id = update.message.from_user.id
    text = update.message.text

    # Register user
    user = update.message.from_user
    register_user(
        telegram_user_id=user_id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        language_code=user.language_code or 'ar',
        is_bot=user.is_bot
    )

    if chat_id not in user_data:
        await update.message.reply_text("الرجاء البدء باستخدام أمر /start.")
        return

    mode = user_data[chat_id]['mode']

    if mode == VIDEO_MODE:
        await update.message.reply_text("جاري معالجة الفيديو، يرجى الانتظار...")
        await download_and_send_video(update, context, text, user_id)
        del user_data[chat_id]
    elif mode == ACCOUNT_MODE_COUNT:
        if text.isdigit():
            count = int(text)
            user_data[chat_id]['count'] = count
            user_data[chat_id]['mode'] = ACCOUNT_MODE_LINK
            await update.message.reply_text(f"تم تحديد {count} فيديوهات. الرجاء إرسال رابط الحساب.")
        else:
            await update.message.reply_text("الرجاء إرسال رقم صحيح لعدد الفيديوهات.")
    elif mode == ACCOUNT_MODE_LINK:
        await update.message.reply_text("جاري معالجة الحساب، يرجى الانتظار...")
        count = user_data[chat_id]['count']
        await download_and_send_account_videos(update, context, text, count, user_id)
        del user_data[chat_id]

async def download_and_send_video(update: Update, context: ContextTypes.DEFAULT_TYPE, url: str, user_id: int) -> None:
    """Download and send single video."""
    chat_id = update.message.chat_id
    platform = detect_platform(url)

    try:
        ydl_opts = {
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'outtmpl': os.path.join('downloads', '%(id)s.%(ext)s'),
            'noplaylist': True,
            'quiet': True,
            'no_warnings': True,
            'postprocessors': [{
                'key': 'FFmpegVideoConvertor',
                'preferedformat': 'mp4'
            }],
        }
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filepath = ydl.prepare_filename(info)
            await update.message.reply_video(video=open(filepath, 'rb'), caption="تم تحميل الفيديو بنجاح بدون علامة مائية.")
            os.remove(filepath)

            # Log successful download
            log_download(
                telegram_user_id=user_id,
                platform=platform,
                url=url,
                title=info.get('title', 'Unknown'),
                success=True,
                duration=info.get('duration'),
                size=info.get('filesize')
            )
    except Exception as e:
        logger.error(f"Error downloading/sending video: {e}")
        await update.message.reply_text("عذراً، حدث خطأ أثناء تحميل الفيديو أو الرابط غير صالح. يرجى التأكد من صحة الرابط.")
        log_download(
            telegram_user_id=user_id,
            platform=platform,
            url=url,
            success=False,
            error=str(e)
        )

async def download_and_send_account_videos(update: Update, context: ContextTypes.DEFAULT_TYPE, url: str, count: int, user_id: int) -> None:
    """Download and send account videos."""
    chat_id = update.message.chat_id
    platform = detect_platform(url)

    try:
        ydl_opts = {
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'outtmpl': os.path.join('downloads', '%(id)s.%(ext)s'),
            'playlistend': count,
            'quiet': True,
            'no_warnings': True,
            'postprocessors': [{
                'key': 'FFmpegVideoConvertor',
                'preferedformat': 'mp4'
            }],
        }
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if 'entries' in info:
                for entry in info['entries']:
                    if entry:
                        try:
                            video_info = ydl.extract_info(entry['url'], download=True)
                            filepath = ydl.prepare_filename(video_info)
                            await update.message.reply_video(video=open(filepath, 'rb'), caption="تم تحميل الفيديو بنجاح بدون علامة مائية.")
                            os.remove(filepath)

                            log_download(
                                telegram_user_id=user_id,
                                platform=platform,
                                url=entry['url'],
                                title=video_info.get('title', 'Unknown'),
                                success=True,
                                duration=video_info.get('duration'),
                                size=video_info.get('filesize')
                            )
                        except Exception as e:
                            logger.warning(f"Could not download video {entry.get('url', 'N/A')}: {e}")
                            await update.message.reply_text(f"عذراً، حدث خطأ أثناء تحميل أحد الفيديوهات: {entry.get('title', 'غير معروف')}")
                            log_download(
                                telegram_user_id=user_id,
                                platform=platform,
                                url=entry.get('url', 'unknown'),
                                success=False,
                                error=str(e)
                            )
            else:
                await update.message.reply_text("لم يتم العثور على فيديوهات في هذا الرابط أو الرابط غير صالح.")
    except Exception as e:
        logger.error(f"Error downloading/sending account videos: {e}")
        await update.message.reply_text("عذراً، حدث خطأ أثناء معالجة الحساب أو الرابط غير صالح. يرجى التأكد من صحة الرابط.")
        log_download(
            telegram_user_id=user_id,
            platform=platform,
            url=url,
            success=False,
            error=str(e)
        )

def main() -> None:
    """Start the bot."""
    if not BOT_TOKEN:
        raise ValueError("BOT_TOKEN environment variable not set")

    init_db()

    application = Application.builder().token(BOT_TOKEN).build()

    # Command handlers
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("stats", stats_command))
    application.add_handler(CommandHandler("top", top_command))
    application.add_handler(CommandHandler("today", today_command))

    # Callback handlers
    application.add_handler(CallbackQueryHandler(button))

    # Message handler
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    os.makedirs('downloads', exist_ok=True)
    main()
