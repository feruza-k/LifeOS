#!/usr/bin/env python3
"""
Simple script to create an admin user for LifeOS.
Usage:
    ADMIN_PASSWORD=yourpassword python create_admin.py
    Or: python create_admin.py
    (will prompt for password)
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.storage.repo import repo
from app.auth.auth import get_password_hash

def create_admin_user():
    """Create or update admin user."""
    admin_email = "admin@lifeos.local"
    
    # Check if admin user already exists
    existing_user = repo.get_user_by_email(admin_email)
    
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
        existing_user["password"] = get_password_hash(password)
        from app.storage.repo import load_data, save_data
        data = load_data()
        users = data.get("users", [])
        for i, u in enumerate(users):
            if u["id"] == existing_user["id"]:
                users[i] = existing_user
                break
        data["users"] = users
        save_data(data)
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
    admin_user = repo.create_user(admin_email, hashed_password)
    
    print(f"\n✅ Admin user created successfully!")
    print(f"\nLogin credentials:")
    print(f"  Email: {admin_email}")
    print(f"  Password: [the password you just entered]")
    print(f"\n⚠️  IMPORTANT: Keep this password secure!")

if __name__ == "__main__":
    try:
        create_admin_user()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

