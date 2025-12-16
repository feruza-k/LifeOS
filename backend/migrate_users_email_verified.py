#!/usr/bin/env python3
"""
Migration script to set email_verified=true for existing users.
This ensures backward compatibility with users created before email verification was added.

Usage:
    python migrate_users_email_verified.py
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.storage.repo import repo, load_data, save_data
from app.logging import logger

def migrate_users():
    """Set email_verified=true for all existing users who don't have it set."""
    print("Starting user migration: setting email_verified=true for existing users...")
    
    data = load_data()
    users = data.get("users", [])
    
    migrated_count = 0
    updated_users = []
    
    for user in users:
        # Check if email_verified field exists and is False or None
        if "email_verified" not in user or not user.get("email_verified"):
            user["email_verified"] = True
            migrated_count += 1
            print(f"  - Migrated user: {user.get('email')} (id: {user.get('id')})")
        
        # Ensure other new fields exist with defaults
        if "username" not in user:
            # Extract username from email
            email = user.get("email", "")
            user["username"] = email.split("@")[0] if "@" in email else email
        
        if "avatar_path" not in user:
            user["avatar_path"] = None
        
        if "verification_token" not in user:
            user["verification_token"] = None
        
        if "verification_token_expires" not in user:
            user["verification_token_expires"] = None
        
        if "reset_token" not in user:
            user["reset_token"] = None
        
        if "reset_token_expires" not in user:
            user["reset_token_expires"] = None
        
        updated_users.append(user)
    
    # Update data with migrated users
    data["users"] = updated_users
    save_data(data)
    
    print(f"\n✅ Migration complete!")
    print(f"   Migrated {migrated_count} user(s)")
    print(f"   All existing users now have email_verified=true")
    print(f"   Default fields added to all users")

if __name__ == "__main__":
    try:
        migrate_users()
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

