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

if not DATABASE_URL:
    engine = None
    AsyncSessionLocal = None
else:
    engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        future=True,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
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

