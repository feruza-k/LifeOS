import os
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path, override=False)
except (ImportError, PermissionError):
    pass

DATABASE_URL = os.getenv("DATABASE_URL")
# Allow forcing disable of prepared statements via environment variable
FORCE_DISABLE_PREPARED_STATEMENTS = os.getenv("DISABLE_PREPARED_STATEMENTS", "false").lower() == "true"

if not DATABASE_URL:
    engine = None
    AsyncSessionLocal = None
else:
    # Check if using pgbouncer (pooler) - transaction mode doesn't support prepared statements
    # Supabase Transaction Pooler uses port 6543
    # Also check for common Supabase pooler patterns
    is_pooler = (
        "pooler" in DATABASE_URL.lower() or 
        "pgbouncer" in DATABASE_URL.lower() or 
        ":6543" in DATABASE_URL or
        ".supabase.co:6543" in DATABASE_URL.lower() or
        FORCE_DISABLE_PREPARED_STATEMENTS
    )
    
    # ALWAYS disable prepared statements - safer for pgbouncer and doesn't hurt performance
    # This MUST be set to 0 when using pgbouncer in transaction mode
    # asyncpg will use this to disable statement caching
    connect_args = {
        "server_settings": {
            "application_name": "lifeos_backend",
        },
        "statement_cache_size": 0,  # Disable prepared statements for pgbouncer compatibility
        "command_timeout": 30,  # 30 seconds for query execution
        "timeout": 10,  # 10 seconds connection timeout
        "ssl": "require",  # Supabase requires SSL connections
    }
    
    if is_pooler or FORCE_DISABLE_PREPARED_STATEMENTS:
        reason = "FORCE_DISABLE env var" if FORCE_DISABLE_PREPARED_STATEMENTS else (
            "pooler" if "pooler" in DATABASE_URL.lower() else 
            "port 6543" if ":6543" in DATABASE_URL else 
            "pgbouncer detected"
        )
        print(f"🔧 Prepared statements DISABLED ({reason})")
    else:
        print(f"🔧 Prepared statements DISABLED (default for compatibility)")
    
    # Create engine with prepared statement cache disabled
    engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        future=True,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        connect_args=connect_args,
    )

    AsyncSessionLocal = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

Base = declarative_base()

async def get_session() -> AsyncSession:
    if not AsyncSessionLocal:
        raise ValueError("DATABASE_URL environment variable is required. Set it in .env file or environment.")
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

