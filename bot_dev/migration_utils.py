#!/usr/bin/env python3
"""
Migration utilities for upgrading to enhanced bot version.
Handles data migration from old bot format to new analytics database.
"""

import sqlite3
import json
import argparse
from pathlib import Path
from datetime import datetime
from database import init_db, register_user, log_download

def backfill_from_logs(log_file: str, db_path: str = 'exd_bot.db'):
    """
    Backfill database from existing logs.
    Expects log format with download records.
    """
    print(f"📥 Backfilling from logs: {log_file}")

    if not Path(log_file).exists():
        print(f"⚠️  Log file not found: {log_file}")
        return False

    try:
        with open(log_file, 'r') as f:
            lines = f.readlines()

        processed = 0
        skipped = 0

        for line in lines:
            try:
                # Try to parse as JSON log entry
                entry = json.loads(line.strip())

                # Extract relevant fields
                user_id = entry.get('user_id') or entry.get('telegram_user_id')
                if not user_id:
                    skipped += 1
                    continue

                # Register user if not exists
                register_user(
                    telegram_user_id=user_id,
                    username=entry.get('username', ''),
                    first_name=entry.get('first_name', 'User'),
                    last_name=entry.get('last_name', ''),
                    language_code=entry.get('language_code', 'ar')
                )

                # Log download if applicable
                if 'url' in entry and 'platform' in entry:
                    log_download(
                        telegram_user_id=user_id,
                        platform=entry.get('platform', 'unknown'),
                        url=entry.get('url', ''),
                        title=entry.get('title', ''),
                        success=entry.get('success', True),
                        error=entry.get('error', None)
                    )

                processed += 1
            except (json.JSONDecodeError, ValueError):
                skipped += 1
                continue

        print(f"✅ Backfill complete: {processed} records processed, {skipped} skipped")
        return True

    except Exception as e:
        print(f"❌ Error during backfill: {e}")
        return False

def migrate_from_old_db(old_db_path: str, new_db_path: str = 'exd_bot.db'):
    """
    Migrate data from old database format if schema is compatible.
    """
    print(f"📦 Migrating from old database: {old_db_path}")

    if not Path(old_db_path).exists():
        print(f"⚠️  Old database not found: {old_db_path}")
        return False

    try:
        # Connect to old database
        old_conn = sqlite3.connect(old_db_path)
        old_cursor = old_conn.cursor()

        # Try to read user data from old tables
        try:
            old_cursor.execute("SELECT * FROM users LIMIT 1")
            columns = [description[0] for description in old_cursor.description]
        except sqlite3.OperationalError:
            print("⚠️  No users table in old database")
            old_conn.close()
            return False

        # If old schema exists, migrate data
        old_cursor.execute("SELECT * FROM users")
        users = old_cursor.fetchall()

        processed = 0
        for user in users:
            try:
                # Map old columns to new schema
                user_dict = dict(zip(columns, user))

                register_user(
                    telegram_user_id=user_dict.get('telegram_user_id') or user_dict.get('id'),
                    username=user_dict.get('username', ''),
                    first_name=user_dict.get('first_name', 'User'),
                    last_name=user_dict.get('last_name', ''),
                    language_code=user_dict.get('language_code', 'ar')
                )
                processed += 1
            except Exception as e:
                print(f"⚠️  Skipped user migration: {e}")
                continue

        old_conn.close()
        print(f"✅ Migration complete: {processed} users migrated")
        return True

    except Exception as e:
        print(f"❌ Error during migration: {e}")
        return False

def init_and_verify(db_path: str = 'exd_bot.db'):
    """
    Initialize database and verify structure.
    """
    print("🔧 Initializing database...")

    try:
        init_db()
        print("✅ Database initialized successfully")

        # Verify tables exist
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )
        tables = [row[0] for row in cursor.fetchall()]

        required_tables = ['users', 'downloads', 'admin_logs']
        for table in required_tables:
            if table in tables:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                print(f"  ✓ {table}: {count} records")
            else:
                print(f"  ✗ {table}: MISSING")
                conn.close()
                return False

        conn.close()
        print("✅ Database verification complete")
        return True

    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        return False

def generate_migration_report(db_path: str = 'exd_bot.db'):
    """
    Generate migration status report.
    """
    print("\n📊 Migration Report")
    print("=" * 50)

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Users statistics
        cursor.execute("SELECT COUNT(*) FROM users")
        total_users = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM users WHERE is_admin = 1")
        admin_users = cursor.fetchone()[0]

        cursor.execute(
            "SELECT COUNT(*) FROM users WHERE last_seen >= datetime('now', '-24 hours')"
        )
        active_24h = cursor.fetchone()[0]

        # Downloads statistics
        cursor.execute("SELECT COUNT(*) FROM downloads WHERE success = 1")
        successful_downloads = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM downloads WHERE success = 0")
        failed_downloads = cursor.fetchone()[0]

        cursor.execute(
            "SELECT platform, COUNT(*) FROM downloads WHERE success = 1 GROUP BY platform"
        )
        platform_stats = cursor.fetchall()

        # Display report
        print(f"\n👥 Users:")
        print(f"  Total: {total_users}")
        print(f"  Admins: {admin_users}")
        print(f"  Active (24h): {active_24h}")

        print(f"\n📊 Downloads:")
        print(f"  Successful: {successful_downloads}")
        print(f"  Failed: {failed_downloads}")

        if platform_stats:
            print(f"\n📱 Platform Breakdown:")
            for platform, count in platform_stats:
                print(f"  {platform.upper()}: {count}")

        conn.close()
        print("\n" + "=" * 50)
        return True

    except Exception as e:
        print(f"❌ Report generation failed: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(
        description='Migration utilities for enhanced @exd_downloader_bot'
    )
    parser.add_argument(
        '--init', action='store_true',
        help='Initialize fresh database'
    )
    parser.add_argument(
        '--backfill', action='store_true',
        help='Backfill from existing logs'
    )
    parser.add_argument(
        '--migrate', type=str, metavar='OLD_DB',
        help='Migrate from old database file'
    )
    parser.add_argument(
        '--logs', type=str, metavar='LOG_FILE',
        help='Backfill from log file'
    )
    parser.add_argument(
        '--report', action='store_true',
        help='Generate migration report'
    )
    parser.add_argument(
        '--db', type=str, default='exd_bot.db',
        help='Database path (default: exd_bot.db)'
    )

    args = parser.parse_args()

    if not any([args.init, args.backfill, args.migrate, args.logs, args.report]):
        parser.print_help()
        return

    # Initialize if needed
    if args.init:
        init_and_verify(args.db)

    # Migrate from old database
    if args.migrate:
        migrate_from_old_db(args.migrate, args.db)

    # Backfill from logs
    if args.logs:
        backfill_from_logs(args.logs, args.db)

    # Generate report
    if args.report:
        generate_migration_report(args.db)

if __name__ == '__main__':
    main()
