#!/usr/bin/env python3
"""
Simple script to create an admin user for LifeOS (uses PostgreSQL).
Usage:
    ADMIN_PASSWORD=yourpassword python create_admin.py
    Or: python create_admin.py
    (will prompt for password)
"""

import os
import sys
import asyncio
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from db.repo import db_repo
from app.auth.auth import get_password_hash

async def create_admin_user():
    """Create or update admin user in database."""
    admin_email = "admin@lifeos.local"
    
    # Check if admin user already exists
    existing_user = await db_repo.get_user_by_email(admin_email)
    
    if existing_user:
        print(f"⚠️  Admin user already exists!")
        response = input("Do you want to reset the password? (y/n): ")
        if response.lower() != 'y':
            print("Cancelled.")
            return
        
        # Get new password
        password = os.environ.get("ADMIN_PASSWORD")
        if not password:
            import getpass
            password = getpass.getpass("Enter new admin password (min 6 chars): ")
        
        if len(password) < 6:
            print("❌ Password must be at least 6 characters")
            return
        
        # Update password
        hashed_password = get_password_hash(password)
        await db_repo.update_user(existing_user["id"], {"password_hash": hashed_password})
        print(f"✅ Admin password updated!")
        print(f"\nLogin credentials:")
        print(f"  Email: {admin_email}")
        print(f"  Password: [the password you just entered]")
        return
    
    # Get password from environment or prompt
    password = os.environ.get("ADMIN_PASSWORD")
    if not password:
        import getpass
        password = getpass.getpass("Enter admin password (min 6 chars): ")
    
    if len(password) < 6:
        print("❌ Password must be at least 6 characters")
        return
    
    # Create admin user
    print(f"Creating admin user...")
    hashed_password = get_password_hash(password)
    admin_user = await db_repo.create_user(admin_email, hashed_password, username="admin")
    
    print(f"\n✅ Admin user created successfully!")
    print(f"\nLogin credentials:")
    print(f"  Email: {admin_email}")
    print(f"  Password: [the password you just entered]")
    print(f"\n⚠️  IMPORTANT: Keep this password secure!")

if __name__ == "__main__":
    try:
        asyncio.run(create_admin_user())
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

