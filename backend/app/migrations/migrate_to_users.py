"""
Migration script to add user_id to existing data.
Run this once before enabling authentication.

Usage:
    python -m app.migrations.migrate_to_users
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file FIRST (before importing auth)
load_dotenv()

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.storage.repo import repo, load_data, save_data
from app.auth.auth import get_password_hash
from datetime import datetime

def migrate_existing_data():
    """Assign existing data to a default admin user."""
    print("Starting migration to user-based data ownership...")
    
    # Get admin password from environment (required, fail fast)
    admin_password = os.environ.get("ADMIN_BOOTSTRAP_PASSWORD")
    if not admin_password:
        raise ValueError(
            "ADMIN_BOOTSTRAP_PASSWORD environment variable is required. "
            "Set it before running migration."
        )
    
    data = load_data()
    
    # Check if admin user already exists
    admin_user = repo.get_user_by_email("admin@lifeos.local")
    
    if not admin_user:
        # Create default admin user
        print("Creating admin user...")
        hashed_password = get_password_hash(admin_password)
        admin_user = repo.create_user(
            email="admin@lifeos.local",
            hashed_password=hashed_password
        )
        print(f"Admin user created: {admin_user['id']}")
    else:
        print(f"Admin user already exists: {admin_user['id']}")
    
    user_id = admin_user["id"]
    migrated_count = 0
    
    # Migrate tasks
    for task in data.get("tasks", []):
        if "user_id" not in task:
            task["user_id"] = user_id
            migrated_count += 1
    print(f"Migrated {migrated_count} tasks")
    
    # Migrate notes
    migrated_count = 0
    for note in data.get("notes", []):
        if "user_id" not in note:
            note["user_id"] = user_id
            migrated_count += 1
    print(f"Migrated {migrated_count} notes")
    
    # Migrate checkins
    migrated_count = 0
    for checkin in data.get("checkins", []):
        if "user_id" not in checkin:
            checkin["user_id"] = user_id
            migrated_count += 1
    print(f"Migrated {migrated_count} check-ins")
    
    # Migrate reminders
    migrated_count = 0
    for reminder in data.get("reminders", []):
        if "user_id" not in reminder:
            reminder["user_id"] = user_id
            migrated_count += 1
    print(f"Migrated {migrated_count} reminders")
    
    # Migrate monthly_focus
    migrated_count = 0
    for focus in data.get("monthly_focus", []):
        if "user_id" not in focus:
            focus["user_id"] = user_id
            migrated_count += 1
    print(f"Migrated {migrated_count} monthly focus entries")
    
    # Save migrated data
    save_data(data)
    print("\n✅ Migration complete!")
    print(f"\nDefault admin credentials:")
    print(f"  Email: admin@lifeos.local")
    print(f"  Password: [Set via ADMIN_BOOTSTRAP_PASSWORD environment variable]")
    print(f"\n⚠️  IMPORTANT: Change this password after first login!")

if __name__ == "__main__":
    try:
        migrate_existing_data()
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        sys.exit(1)
