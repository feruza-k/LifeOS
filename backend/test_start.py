#!/usr/bin/env python3
"""Test script to debug startup issues"""

import sys

print("Testing imports...")

try:
    print("1. Importing FastAPI...")
    from fastapi import FastAPI
    print("   ✓ FastAPI imported")
except Exception as e:
    print(f"   ✗ Failed: {e}")
    sys.exit(1)

try:
    print("2. Importing app.main...")
    from app.main import app
    print("   ✓ app.main imported")
except Exception as e:
    print(f"   ✗ Failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    print("3. Testing app instance...")
    print(f"   App type: {type(app)}")
    print("   ✓ App instance created")
except Exception as e:
    print(f"   ✗ Failed: {e}")
    sys.exit(1)

print("\n✅ All imports successful!")
print("\nTry running:")
print("  python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000")
