import sqlite3
import os
from datetime import datetime
from pathlib import Path

DB_PATH = os.path.join(os.path.dirname(__file__), 'exd_bot.db')

def init_db():
    """Initialize database with all required tables."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Users table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_user_id INTEGER UNIQUE NOT NULL,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        language_code TEXT DEFAULT 'ar',
        is_bot INTEGER DEFAULT 0,
        first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_admin INTEGER DEFAULT 0,
        total_downloads INTEGER DEFAULT 0
    )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_telegram_id ON users(telegram_user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_first_seen ON users(first_seen)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_last_seen ON users(last_seen)')

    # Downloads table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS downloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_user_id INTEGER NOT NULL,
        platform TEXT NOT NULL,
        url TEXT NOT NULL,
        video_title TEXT,
        download_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        success INTEGER DEFAULT 1,
        error_message TEXT,
        video_duration INTEGER,
        video_size INTEGER,
        FOREIGN KEY(telegram_user_id) REFERENCES users(telegram_user_id)
    )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_user_downloads ON downloads(telegram_user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_platform ON downloads(platform)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_download_timestamp ON downloads(download_timestamp)')

    # Admin actions log
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS admin_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        target_id INTEGER,
        details TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_admin_logs ON admin_logs(admin_id, timestamp)')

    conn.commit()
    conn.close()

def register_user(telegram_user_id, username, first_name, last_name, language_code, is_bot=False):
    """Register or update user."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute('''
        INSERT INTO users (telegram_user_id, username, first_name, last_name, language_code, is_bot)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(telegram_user_id) DO UPDATE SET
        last_seen = CURRENT_TIMESTAMP,
        username = excluded.username,
        first_name = excluded.first_name,
        last_name = excluded.last_name
        ''', (telegram_user_id, username, first_name, last_name, language_code, int(is_bot)))
        conn.commit()
        return True
    except Exception as e:
        return False
    finally:
        conn.close()

def log_download(telegram_user_id, platform, url, title=None, success=True, error=None, duration=None, size=None):
    """Log a download action."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute('''
        INSERT INTO downloads (telegram_user_id, platform, url, video_title, success, error_message, video_duration, video_size)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (telegram_user_id, platform, url, title, int(success), error, duration, size))

        # Update user's total downloads
        cursor.execute('UPDATE users SET total_downloads = total_downloads + 1 WHERE telegram_user_id = ?', (telegram_user_id,))
        conn.commit()
    except Exception as e:
        pass
    finally:
        conn.close()

def get_user(telegram_user_id):
    """Get user info."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE telegram_user_id = ?', (telegram_user_id,))
    user = cursor.fetchone()
    conn.close()
    return dict(user) if user else None

def is_admin(telegram_user_id):
    """Check if user is admin."""
    user = get_user(telegram_user_id)
    return user and user.get('is_admin', 0) == 1

def get_stats():
    """Get overall statistics."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute('SELECT COUNT(*) as total_users FROM users')
    total_users = cursor.fetchone()['total_users']

    cursor.execute('SELECT COUNT(*) as total_downloads FROM downloads WHERE success = 1')
    total_downloads = cursor.fetchone()['total_downloads']

    cursor.execute('''
    SELECT platform, COUNT(*) as count FROM downloads WHERE success = 1
    GROUP BY platform ORDER BY count DESC
    ''')
    platform_stats = cursor.fetchall()

    cursor.execute('''
    SELECT COUNT(*) as count FROM users WHERE last_seen >= datetime('now', '-24 hours')
    ''')
    active_24h = cursor.fetchone()['count']

    conn.close()

    return {
        'total_users': total_users,
        'total_downloads': total_downloads,
        'platform_stats': [dict(row) for row in platform_stats],
        'active_24h': active_24h
    }

def get_top_users(limit=10):
    """Get top users by downloads."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute('''
    SELECT telegram_user_id, first_name, username, total_downloads, last_seen
    FROM users
    WHERE total_downloads > 0
    ORDER BY total_downloads DESC
    LIMIT ?
    ''', (limit,))

    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return users

def get_today_stats():
    """Get today's statistics."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute('''
    SELECT COUNT(*) as count FROM downloads
    WHERE success = 1 AND DATE(download_timestamp) = DATE('now')
    ''')
    downloads_today = cursor.fetchone()['count']

    cursor.execute('''
    SELECT COUNT(*) as count FROM users
    WHERE DATE(first_seen) = DATE('now')
    ''')
    new_users_today = cursor.fetchone()['count']

    cursor.execute('''
    SELECT platform, COUNT(*) as count FROM downloads
    WHERE success = 1 AND DATE(download_timestamp) = DATE('now')
    GROUP BY platform
    ''')
    platform_breakdown = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return {
        'downloads_today': downloads_today,
        'new_users_today': new_users_today,
        'platform_breakdown': platform_breakdown
    }

def get_users_list(limit=20, offset=0):
    """Get users list with pagination."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute('''
    SELECT telegram_user_id, first_name, username, total_downloads, last_seen
    FROM users
    ORDER BY last_seen DESC
    LIMIT ? OFFSET ?
    ''', (limit, offset))

    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return users

def log_admin_action(admin_id, action, target_id=None, details=None):
    """Log admin action for audit trail."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute('''
        INSERT INTO admin_logs (admin_id, action, target_id, details)
        VALUES (?, ?, ?, ?)
        ''', (admin_id, action, target_id, details))
        conn.commit()
    except:
        pass
    finally:
        conn.close()
