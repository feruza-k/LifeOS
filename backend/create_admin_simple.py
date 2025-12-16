#!/usr/bin/env python3
"""
Simple script to create an admin user - uses only basic Python.
Run this from backend directory: python create_admin_simple.py
"""

import json
import uuid
import sys
from pathlib import Path
from datetime import datetime

# Add current directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    import bcrypt
except ImportError:
    print("❌ bcrypt not installed. Installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "bcrypt"])
    import bcrypt

def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt."""
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def create_admin_user():
    """Create admin user in database."""
    # Get password
    password = input("Enter admin password (min 6 chars, default: admin123): ").strip()
    if not password:
        password = "admin123"
    
    if len(password) < 6:
        print("❌ Password must be at least 6 characters")
        return
    
    # Load database
    db_path = Path(__file__).parent / "app" / "db" / "data.json"
    if not db_path.exists():
        print(f"❌ Database file not found at {db_path}")
        return
    
    with open(db_path, 'r') as f:
        data = json.load(f)
    
    # Check if admin exists
    admin_email = "admin@lifeos.local"
    users = data.get("users", [])
    
    for user in users:
        if user.get("email") == admin_email:
            print(f"⚠️  Admin user already exists!")
            response = input("Reset password? (y/n): ").strip().lower()
            if response != 'y':
                print("Cancelled.")
                return
            
            # Update existing admin password
            user["password"] = get_password_hash(password)
            break
    else:
        # Create new admin user
        admin_user = {
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password": get_password_hash(password),
            "created_at": datetime.now().isoformat()
        }
        users.append(admin_user)
        data["users"] = users
        print(f"✅ Created admin user")
    
    # Save database
    with open(db_path, 'w') as f:
        json.dump(data, f, indent=4)
    
    print(f"\n✅ Admin user ready!")
    print(f"\nLogin credentials:")
    print(f"  Email: {admin_email}")
    print(f"  Password: {password}")
    print(f"\n⚠️  IMPORTANT: Keep this password secure!")

if __name__ == "__main__":
    try:
        create_admin_user()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

