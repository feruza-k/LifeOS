#!/usr/bin/env python3
"""Quick script to test database connectivity."""
import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("❌ Error: DATABASE_URL not set in environment")
    print("\nCheck your .env file or set it:")
    print("  export DATABASE_URL='postgresql+asyncpg://...'")
    sys.exit(1)

print(f"🔌 Testing connection to database...")
print(f"   URL: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'hidden'}")
print()

async def test_connection():
    try:
        import asyncpg
        
        # Parse connection string
        # Format: postgresql+asyncpg://user:pass@host:port/db
        url = DATABASE_URL.replace("postgresql+asyncpg://", "").replace("postgresql://", "")
        if "@" in url:
            auth, rest = url.split("@", 1)
            if ":" in auth:
                user, password = auth.split(":", 1)
            else:
                user = auth
                password = None
        else:
            user = None
            password = None
            rest = url
        
        if "/" in rest:
            host_port, dbname = rest.split("/", 1)
        else:
            host_port = rest
            dbname = None
        
        if ":" in host_port:
            host, port = host_port.split(":", 1)
            port = int(port)
        else:
            host = host_port
            port = 5432
        
        print(f"   Host: {host}")
        print(f"   Port: {port}")
        print(f"   Database: {dbname}")
        print(f"   User: {user}")
        print()
        
        # If using pooler hostname but port 5432, suggest using 6543
        if "pooler" in host.lower() and port == 5432:
            print("   ⚠️  WARNING: Using pooler hostname with port 5432.")
            print("   💡 TIP: For transaction pooler, use port 6543 instead.")
            print("   💡 Update DATABASE_URL to use :6543 instead of :5432")
            print()
        
        print("   Attempting connection with SSL (10 second timeout)...")
        
        # Try with SSL (required for Supabase)
        try:
            conn = await asyncio.wait_for(
                asyncpg.connect(
                    host=host,
                    port=port,
                    user=user,
                    password=password,
                    database=dbname,
                    timeout=10,
                    ssl="require"  # Supabase requires SSL
                ),
                timeout=12
            )
        except Exception as ssl_error:
            # If SSL fails, try without SSL (for debugging)
            print(f"   SSL connection failed: {ssl_error}")
            print("   Trying without SSL (for debugging)...")
            conn = await asyncio.wait_for(
                asyncpg.connect(
                    host=host,
                    port=port,
                    user=user,
                    password=password,
                    database=dbname,
                    timeout=10
                ),
                timeout=12
            )
        
        # Test query
        result = await conn.fetchval("SELECT version()")
        print(f"✅ Connection successful!")
        print(f"   PostgreSQL version: {result.split(',')[0]}")
        
        await conn.close()
        return True
        
    except asyncio.TimeoutError:
        print("❌ Connection timeout - database server is not reachable")
        print("\n🔍 Troubleshooting steps:")
        print("  1. Check if database is PAUSED in Supabase dashboard:")
        print("     → Go to https://supabase.com/dashboard")
        print("     → Settings → Database → Resume if paused")
        print("  2. If using pooler hostname, try port 6543 instead of 5432:")
        print("     → Change DATABASE_URL from :5432 to :6543")
        print("  3. Verify DATABASE_URL is correct in .env file")
        print("  4. Check Supabase status: https://status.supabase.com/")
        print("  5. Ensure firewall allows outbound connections on port 5432/6543")
        return False
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        print(f"   Error type: {type(e).__name__}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_connection())
    sys.exit(0 if success else 1)

