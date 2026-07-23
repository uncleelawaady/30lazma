# Deployment Guide - Enhanced @exd_downloader_bot

This guide explains how to deploy the enhanced bot version once VPS connectivity is restored.

## Status

- ✅ Enhanced bot code prepared locally
- ✅ Database schema designed and tested
- ✅ Admin commands implemented
- ✅ Analytics system ready
- ❌ VPS connectivity issue (to be resolved)

## Prerequisites for Deployment

Before deploying, ensure:

1. **VPS Connectivity Restored**
   - SSH access to 2.24.15.245:22
   - Root user can execute commands

2. **Environment Variables**
   - BOT_TOKEN: Telegram bot token (must be in .env file)
   - Admin ID: 7613454215 (predefined)

3. **System Requirements**
   - Python 3.8+
   - pip3
   - ffmpeg
   - systemd (for service management)

## Deployment Steps

### Phase 1: Prepare VPS

Once SSH connectivity is restored, execute:

```bash
# 1. Connect to VPS
ssh -i /path/to/key root@2.24.15.245

# 2. Verify current bot status
sudo systemctl status exd_downloader_bot.service

# 3. Create backup directory
mkdir -p /root/backups
```

### Phase 2: Backup Current Installation

```bash
# 1. Create timestamped backup of current bot
BACKUP_NAME="backup_exd_downloader_$(date +%Y-%m-%d_%H-%M-%S)"
cp -r /root/exd_downloader_bot /root/backups/$BACKUP_NAME
echo "Backup created: $BACKUP_NAME"

# 2. Backup database if it exists
if [ -f /root/exd_downloader_bot/exd_bot.db ]; then
    cp /root/exd_downloader_bot/exd_bot.db /root/backups/${BACKUP_NAME}/exd_bot_backup.db
fi
```

### Phase 3: Deploy Enhanced Version

```bash
# 1. Stop current bot service
sudo systemctl stop exd_downloader_bot.service

# 2. Upload enhanced bot files to VPS
# Use scp or clone from repository
git clone https://github.com/uncleelawaady/30lazma.git /tmp/bot_source
cd /tmp/bot_source/bot_dev

# 3. Copy enhanced files to bot directory
sudo cp enhanced_bot.py /root/exd_downloader_bot/bot.py
sudo cp database.py /root/exd_downloader_bot/
sudo cp requirements.txt /root/exd_downloader_bot/

# 4. Install dependencies
cd /root/exd_downloader_bot
sudo pip3 install -r requirements.txt

# 5. Ensure .env file has BOT_TOKEN
# If missing, create it:
# echo "BOT_TOKEN=your_token_here" | sudo tee .env
# sudo chmod 600 .env
```

### Phase 4: Database Migration

If upgrading from existing bot:

```bash
# 1. Initialize new database schema
cd /root/exd_downloader_bot
python3 << 'EOF'
from database import init_db
init_db()
print("Database initialized successfully")
EOF

# 2. Backfill existing users if needed (see migration_utils.py)
python3 migration_utils.py --backfill

# 3. Verify database
sqlite3 exd_bot.db ".tables"
```

### Phase 5: Update Service Configuration

```bash
# The enhanced bot uses same systemd service
# Just verify it points to new bot.py

sudo systemctl daemon-reload
sudo systemctl enable exd_downloader_bot.service
sudo systemctl start exd_downloader_bot.service

# 6. Verify service is running
sudo systemctl status exd_downloader_bot.service
journalctl -u exd_downloader_bot.service -n 20
```

### Phase 6: Verify Deployment

```bash
# 1. Check if bot responds
# Send /start command in Telegram to @exd_downloader_bot

# 2. Check service logs
journalctl -u exd_downloader_bot.service -f

# 3. Verify database created
ls -lh /root/exd_downloader_bot/exd_bot.db

# 4. Test admin commands (from admin ID 7613454215)
# Send /stats, /users, /top, /today
```

## Rollback Procedure

If issues occur, rollback to previous version:

```bash
# 1. Stop the service
sudo systemctl stop exd_downloader_bot.service

# 2. Restore from backup
BACKUP_NAME="backup_exd_downloader_2026-07-23_HH-MM-SS"
rm -rf /root/exd_downloader_bot
cp -r /root/backups/$BACKUP_NAME /root/exd_downloader_bot

# 3. Restart service
sudo systemctl start exd_downloader_bot.service

# 4. Verify
sudo systemctl status exd_downloader_bot.service
```

## Configuration Reference

### Bot Token
Location: `/root/exd_downloader_bot/.env`
```
BOT_TOKEN=your_token_here
```

### Admin ID
The bot admin ID is hardcoded as: `7613454215`
To add more admins, execute:
```bash
sqlite3 /root/exd_downloader_bot/exd_bot.db \
  "UPDATE users SET is_admin = 1 WHERE telegram_user_id = <USER_ID>"
```

### Directories
- **Bot**: `/root/exd_downloader_bot/`
- **Database**: `/root/exd_downloader_bot/exd_bot.db`
- **Downloads**: `/root/exd_downloader_bot/downloads/`
- **Backups**: `/root/backups/`
- **Logs**: Via journalctl

## Post-Deployment Checklist

After successful deployment:

- [ ] Bot responds to /start command
- [ ] Single video download works
- [ ] Account bulk download works
- [ ] Users are automatically registered
- [ ] Database is created and working
- [ ] Admin commands accessible to admin (7613454215)
- [ ] /stats shows correct statistics
- [ ] /users lists recent users
- [ ] /top shows top users
- [ ] /today shows daily statistics
- [ ] Admin dashboard accessible
- [ ] Download files are cleaned up
- [ ] No errors in logs

## Monitoring After Deployment

### Daily Checks
```bash
# View today's activity
journalctl -u exd_downloader_bot.service --since today

# Database statistics
sqlite3 /root/exd_downloader_bot/exd_bot.db \
  "SELECT COUNT(*) as users FROM users; SELECT COUNT(*) as downloads FROM downloads;"
```

### Weekly Maintenance
```bash
# Backup database
cp /root/exd_downloader_bot/exd_bot.db /root/backups/weekly_backup_$(date +%Y-%m-%d).db

# Clean old logs
journalctl -u exd_downloader_bot.service --vacuum-time=4w

# Check disk usage
du -sh /root/exd_downloader_bot/
```

## Troubleshooting

### Issue: Bot not responding after deployment

**Solution:**
1. Check service: `sudo systemctl status exd_downloader_bot.service`
2. View logs: `journalctl -u exd_downloader_bot.service -n 50`
3. Verify token: `grep BOT_TOKEN /root/exd_downloader_bot/.env`
4. Restart: `sudo systemctl restart exd_downloader_bot.service`

### Issue: Database permission errors

**Solution:**
```bash
sudo chown root:root /root/exd_downloader_bot/exd_bot.db
sudo chmod 644 /root/exd_downloader_bot/exd_bot.db
```

### Issue: FFmpeg errors

**Solution:**
```bash
sudo apt update
sudo apt install -y ffmpeg
ffmpeg -version  # Verify installation
```

## Support

For deployment assistance or issues, contact: elawadi.store4@gmail.com

---

**Prepared**: 2026-07-23  
**Ready for Deployment**: When VPS SSH connectivity is restored  
**Bot**: @exd_downloader_bot  
**Version**: 2.0 (Enhanced)
