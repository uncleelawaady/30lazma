# @exd_downloader_bot - Enhanced Version

Professional TikTok and YouTube video downloader bot with comprehensive analytics, user tracking, and admin features.

## Features

### User Features
- 🎬 Download single TikTok/YouTube videos without watermarks
- 👤 Download entire account videos in bulk
- 📱 Support for multiple platforms: TikTok, YouTube, Instagram, Facebook, X
- 🔄 Automatic user registration on first use
- 🌍 Multi-language support (Arabic, English)

### Admin Features
- 📊 **`/stats`** - View overall statistics (users, downloads, platform breakdown)
- 👥 **`/users`** - List recent users with activity
- ⭐ **`/top`** - Top 10 users by download count
- 📅 **`/today`** - Daily statistics and breakdowns
- 📱 **Admin Dashboard** - Interactive inline keyboard interface

### Backend Features
- 🗄️ SQLite database with optimized indexes
- 📈 Comprehensive download tracking
- 👤 User registration and tracking system
- 🔐 Admin-only access control
- 📝 Audit logging for all admin actions
- 🛡️ Privacy-focused data handling
- ⚡ Performance optimized queries

## Architecture

### Database Schema

#### Users Table
- `telegram_user_id` (UNIQUE) - Telegram user identifier
- `username` - Telegram username
- `first_name` - User's first name
- `last_name` - User's last name
- `language_code` - Preferred language
- `is_bot` - Is bot account
- `first_seen` - Registration timestamp
- `last_seen` - Last activity timestamp
- `is_admin` - Admin status
- `total_downloads` - Download count

#### Downloads Table
- `telegram_user_id` - User who initiated download
- `platform` - Video platform (tiktok, youtube, instagram, etc.)
- `url` - Video URL
- `video_title` - Video title/name
- `download_timestamp` - When download was initiated
- `success` - Success/failure flag
- `error_message` - Error details if failed
- `video_duration` - Video length in seconds
- `video_size` - Downloaded file size

#### Admin Logs Table
- `admin_id` - Admin user ID
- `action` - Action performed
- `target_id` - Target user/resource
- `details` - Additional details
- `timestamp` - Action timestamp

## Installation

### Prerequisites
- Python 3.8+
- pip3
- ffmpeg
- Telegram Bot Token
- Admin Telegram ID

### Setup Instructions

1. **Prepare bot directory:**
   ```bash
   mkdir -p /root/exd_downloader_bot
   cd /root/exd_downloader_bot
   ```

2. **Copy bot files:**
   ```bash
   cp bot.py enhanced_bot.py
   cp database.py .
   cp requirements.txt .
   ```

3. **Create .env file:**
   ```bash
   echo "BOT_TOKEN=your_bot_token_here" > .env
   chmod 600 .env
   ```

4. **Install dependencies:**
   ```bash
   pip3 install -r requirements.txt
   ```

5. **Initialize database:**
   ```bash
   python3 -c "from database import init_db; init_db()"
   ```

6. **Set up systemd service:**
   ```bash
   sudo tee /etc/systemd/system/exd_downloader_bot.service > /dev/null <<EOF
   [Unit]
   Description=@exd_downloader_bot - TikTok and YouTube Downloader
   After=network.target

   [Service]
   Type=simple
   User=root
   WorkingDirectory=/root/exd_downloader_bot
   EnvironmentFile=/root/exd_downloader_bot/.env
   ExecStart=/usr/bin/python3 /root/exd_downloader_bot/bot.py
   Restart=always
   RestartSec=10
   StandardOutput=syslog
   StandardError=syslog
   SyslogIdentifier=exd_downloader_bot

   [Install]
   WantedBy=multi-user.target
   EOF

   sudo systemctl daemon-reload
   sudo systemctl enable exd_downloader_bot.service
   sudo systemctl start exd_downloader_bot.service
   ```

7. **Verify service:**
   ```bash
   sudo systemctl status exd_downloader_bot.service
   journalctl -u exd_downloader_bot.service -f
   ```

## Usage

### User Commands
- `/start` - Start the bot and choose download mode
- Select "🎬 فيديو واحد" for single video
- Select "👤 حساب كامل" for account bulk download

### Admin Commands
All admin commands require admin Telegram ID in the system:

- `/stats` - Show overall statistics
  ```
  📊 **الإحصائيات العامة:**
  👥 إجمالي المستخدمين: 1250
  📥 إجمالي التحميلات الناجحة: 5432
  🟢 المستخدمين النشطين (24 ساعة): 48
  📱 تفصيل المنصات:
    • TIKTOK: 3200
    • YOUTUBE: 2100
    • INSTAGRAM: 132
  ```

- `/users` - Show recent users
  - Shows last 10 users with activity

- `/top` - Show top users
  - Shows top 10 users by download count

- `/today` - Show today's statistics
  - Downloads count
  - New users registered
  - Platform breakdown for today

### Admin Dashboard
Admin users see an additional "📊 لوحة التحكم" button in the main menu. This provides interactive access to all statistics through inline keyboard buttons.

## File Structure

```
/root/exd_downloader_bot/
├── bot.py                 # Main bot file (symlink to enhanced_bot.py)
├── database.py           # Database management module
├── requirements.txt      # Python dependencies
├── .env                  # Environment variables (BOT_TOKEN)
├── exd_bot.db           # SQLite database (auto-created)
├── downloads/           # Temporary video storage
└── backups/             # Bot backups
```

## Security Considerations

1. **Token Protection**: BOT_TOKEN stored in .env file only, never logged
2. **Access Control**: Admin commands restricted by Telegram ID
3. **Audit Logging**: All admin actions logged to database
4. **Password Security**: Credentials not displayed in logs
5. **Data Privacy**: User data only collected for essential functionality
6. **Cleanup**: Downloaded videos automatically removed after sending

## Monitoring and Maintenance

### View logs:
```bash
journalctl -u exd_downloader_bot.service -f
```

### Check database:
```bash
sqlite3 /root/exd_downloader_bot/exd_bot.db
```

### Monitor service:
```bash
sudo systemctl status exd_downloader_bot.service
```

### Restart bot:
```bash
sudo systemctl restart exd_downloader_bot.service
```

### Clean up downloads:
```bash
rm -rf /root/exd_downloader_bot/downloads/*
```

## Troubleshooting

### Bot not responding
1. Check service status: `sudo systemctl status exd_downloader_bot.service`
2. View logs: `journalctl -u exd_downloader_bot.service -f`
3. Verify BOT_TOKEN in .env
4. Check network connectivity

### Database errors
1. Verify database file exists: `ls -la exd_bot.db`
2. Check permissions: `chmod 644 exd_bot.db`
3. Reinitialize if corrupted: `python3 -c "from database import init_db; init_db()"`

### Download failures
1. Verify ffmpeg installed: `which ffmpeg`
2. Check disk space: `df -h`
3. Clear downloads folder: `rm -rf downloads/*`
4. Check yt-dlp version: `pip3 show yt-dlp`

## Admin Configuration

The bot is configured with admin ID: **7613454215**

To add more admins, modify database directly:
```bash
sqlite3 exd_bot.db "UPDATE users SET is_admin = 1 WHERE telegram_user_id = <USER_ID>"
```

## Performance

- **Database Indexes**: Optimized on frequently queried fields
- **Lazy Loading**: Statistics calculated on-demand
- **Cleanup**: Automatic video file deletion after sending
- **Memory**: Minimal overhead with streaming responses

## Updates and Maintenance

To update the bot:
1. Backup current installation: `cp -r /root/exd_downloader_bot /root/backups/backup_$(date +%s)`
2. Copy new files
3. Install updated dependencies: `pip3 install --upgrade -r requirements.txt`
4. Restart service: `sudo systemctl restart exd_downloader_bot.service`

## Support

For issues or questions, contact: elawadi.store4@gmail.com

---

**Version**: 2.0 (Enhanced with Analytics)  
**Last Updated**: 2026-07-23  
**Bot**: @exd_downloader_bot  
**Creator**: EXD | Elawaady XDigital
