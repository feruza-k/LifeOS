#!/usr/bin/env python3
"""Run a single migration file against the database."""
import asyncio
import os
import sys
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("❌ Error: DATABASE_URL not set")
    print("\nTo set it:")
    print("  export DATABASE_URL='postgresql+asyncpg://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres'")
    print("\nOr add to .env file:")
    print("  DATABASE_URL=postgresql+asyncpg://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres")
    print("\n💡 Tip: Get the correct connection string from Supabase Dashboard → Project Settings → Database")
    sys.exit(1)

async def run_migration(migration_file: str):
    migration_path = Path(__file__).parent.parent / "migrations" / migration_file
    if not migration_path.exists():
        print(f"❌ Migration file not found: {migration_path}")
        sys.exit(1)
    
    print(f"📄 Reading migration from: {migration_path}")
    with open(migration_path, "r") as f:
        migration_sql = f.read()
    
    print(f"🔌 Connecting to database...")
    try:
        engine = create_async_engine(
            DATABASE_URL,
            echo=False,
            connect_args={
                "server_settings": {"application_name": "lifeos_migration"},
                "statement_cache_size": 0,
                "command_timeout": 30,
                "timeout": 10,
                "ssl": "require",
            }
        )
    except Exception as e:
        print(f"❌ Failed to create engine: {e}")
        print("\n💡 Check your DATABASE_URL format:")
        print("   postgresql+asyncpg://user:password@host:port/database")
        sys.exit(1)
    
    try:
        async with engine.begin() as conn:
            print("✅ Connected! Running migration...\n")
            
            # Split by semicolon and execute each statement
            statements = [s.strip() for s in migration_sql.split(";") if s.strip() and not s.strip().startswith("--")]
            
            for i, statement in enumerate(statements, 1):
                if not statement or statement.startswith("--"):
                    continue
                
                try:
                    await conn.execute(text(statement))
                    preview = statement.replace("\n", " ")[:60]
                    print(f"  [{i}/{len(statements)}] ✅ {preview}...")
                except Exception as e:
                    error_msg = str(e)
                    if "already exists" in error_msg.lower() or "duplicate" in error_msg.lower() or "does not exist" in error_msg.lower():
                        preview = statement.replace("\n", " ")[:60]
                        print(f"  [{i}/{len(statements)}] ⚠️  Skipped (already applied or not needed): {preview}...")
                    else:
                        print(f"  [{i}/{len(statements)}] ❌ Error: {error_msg}")
                        print(f"     Statement: {statement[:100]}...")
                        raise
        
        await engine.dispose()
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        print("\n💡 Troubleshooting:")
        print("   1. Verify your password is correct (check Supabase Dashboard)")
        print("   2. Ensure database exists")
        print("   3. Check network connectivity")
        print("   4. Try using Supabase SQL Editor as alternative")
        await engine.dispose()
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python run_migration.py <migration_file.sql>")
        print("\nExample:")
        print("  python run_migration.py increase_note_title_length.sql")
        sys.exit(1)
    
    migration_file = sys.argv[1]
    asyncio.run(run_migration(migration_file))

