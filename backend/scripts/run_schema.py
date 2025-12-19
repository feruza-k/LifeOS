#!/usr/bin/env python3
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
    print("  export DATABASE_URL='postgresql+asyncpg://postgres:[YOUR-PASSWORD]@db.nuuvagaayowrvgsbduwr.supabase.co:5432/postgres'")
    print("\nOr add to .env file:")
    print("  DATABASE_URL=postgresql+asyncpg://postgres:[YOUR-PASSWORD]@db.nuuvagaayowrvgsbduwr.supabase.co:5432/postgres")
    print("\n💡 Tip: Get the correct connection string from Supabase Dashboard → Project Settings → Database")
    sys.exit(1)

async def run_schema():
    schema_file = Path(__file__).parent.parent / "database_schema.sql"
    if not schema_file.exists():
        print(f"❌ Schema file not found: {schema_file}")
        sys.exit(1)
    
    print(f"📄 Reading schema from: {schema_file}")
    with open(schema_file, "r") as f:
        schema_sql = f.read()
    
    print(f"🔌 Connecting to database...")
    try:
        engine = create_async_engine(DATABASE_URL, echo=False)
    except Exception as e:
        print(f"❌ Failed to create engine: {e}")
        print("\n💡 Check your DATABASE_URL format:")
        print("   postgresql+asyncpg://user:password@host:port/database")
        sys.exit(1)
    
    try:
        async with engine.begin() as conn:
            print("✅ Connected! Applying schema...\n")
            
            statements = [s.strip() for s in schema_sql.split(";") if s.strip() and not s.strip().startswith("--")]
            
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
        print("\n✅ Schema applied successfully!")
        
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
    asyncio.run(run_schema())

