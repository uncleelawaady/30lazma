#!/bin/bash

# Enhanced @exd_downloader_bot Deployment Script
# This script deploys the enhanced bot with analytics, user tracking, and admin features

set -e

BOT_DIR="/root/exd_downloader_bot"
BACKUP_DIR="/root/backups"
SERVICE_NAME="exd_downloader_bot"

echo "🚀 Starting deployment of enhanced @exd_downloader_bot..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup current bot if it exists
if [ -d "$BOT_DIR" ]; then
    echo "📦 Creating backup of current bot..."
    BACKUP_NAME="backup_exd_downloader_$(date +%Y-%m-%d_%H-%M-%S)"
    cp -r "$BOT_DIR" "$BACKUP_DIR/$BACKUP_NAME"
    echo "✅ Backup created at $BACKUP_DIR/$BACKUP_NAME"
fi

# Create bot directory
mkdir -p "$BOT_DIR"
cd "$BOT_DIR"

# Copy enhanced bot files
echo "📄 Copying enhanced bot files..."
cp bot_dev/enhanced_bot.py "$BOT_DIR/bot.py"
cp bot_dev/database.py "$BOT_DIR/database.py"
cp bot_dev/requirements.txt "$BOT_DIR/requirements.txt"

# Install/update dependencies
echo "📚 Installing dependencies..."
pip3 install -r "$BOT_DIR/requirements.txt"

# Create downloads directory
mkdir -p "$BOT_DIR/downloads"

# Check if .env file exists with BOT_TOKEN
if [ ! -f "$BOT_DIR/.env" ]; then
    echo "⚠️  .env file not found! Please create it with:"
    echo "   BOT_TOKEN=your_token_here"
else
    echo "✅ .env file found"
fi

# Update systemd service
echo "🔧 Updating systemd service..."
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=@exd_downloader_bot - TikTok and YouTube Downloader
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$BOT_DIR
EnvironmentFile=$BOT_DIR/.env
ExecStart=/usr/bin/python3 $BOT_DIR/bot.py
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=$SERVICE_NAME

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
echo "🔄 Reloading systemd..."
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME.service"

# Restart bot
echo "🚀 Starting bot service..."
sudo systemctl restart "$SERVICE_NAME.service"

# Wait a moment for service to start
sleep 2

# Check service status
if sudo systemctl is-active --quiet "$SERVICE_NAME.service"; then
    echo "✅ Bot service is running!"
else
    echo "⚠️  Warning: Bot service may not have started. Check logs with:"
    echo "   sudo systemctl status $SERVICE_NAME.service"
    echo "   journalctl -u $SERVICE_NAME.service -f"
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Available admin commands:"
echo "   /stats  - View overall statistics"
echo "   /users  - View recent users"
echo "   /top    - View top users"
echo "   /today  - View today's statistics"
echo ""
echo "🔍 View logs with:"
echo "   journalctl -u $SERVICE_NAME.service -f"
echo ""
echo "📱 Admin ID: 7613454215"
