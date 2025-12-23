#!/usr/bin/env python3
"""Quick script to add global_notes table to existing database."""
import asyncio
import os
import sys
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path, override=False)
except ImportError:
    pass

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("❌ Error: DATABASE_URL not set")
    print("\nTo set it:")
    print("  export DATABASE_URL='postgresql+asyncpg://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres'")
    print("\nOr add to .env file:")
    print("  DATABASE_URL=postgresql+asyncpg://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres")
    sys.exit(1)

async def add_global_notes_table():
    migration_file = Path(__file__).parent.parent / "migrations" / "add_global_notes.sql"
    if not migration_file.exists():
        print(f"❌ Migration file not found: {migration_file}")
        sys.exit(1)
    
    print(f"📄 Reading migration from: {migration_file}")
    with open(migration_file, "r") as f:
        migration_sql = f.read()
    
    print(f"🔌 Connecting to database...")
    try:
        engine = create_async_engine(DATABASE_URL, echo=False)
    except Exception as e:
        print(f"❌ Failed to create engine: {e}")
        sys.exit(1)
    
    try:
        async with engine.begin() as conn:
            print("✅ Connected! Applying migration...\n")
            
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
                    if "already exists" in error_msg.lower() or "duplicate" in error_msg.lower():
                        preview = statement.replace("\n", " ")[:60]
                        print(f"  [{i}/{len(statements)}] ⚠️  Already exists: {preview}...")
                    else:
                        print(f"  [{i}/{len(statements)}] ❌ Error: {error_msg}")
                        print(f"     Statement: {statement[:100]}...")
                        raise
        
        await engine.dispose()
        print("\n✅ Migration applied successfully!")
        print("   The global_notes table is now available.")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        await engine.dispose()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(add_global_notes_table())

