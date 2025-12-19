from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import AsyncSessionLocal
from db.repositories.task import TaskRepository
from db.repositories.note import NoteRepository
from db.repositories.checkin import CheckinRepository
from db.repo import db_repo

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def get_task_repo(session: AsyncSession = None) -> TaskRepository:
    if session:
        return TaskRepository(session)
    async with AsyncSessionLocal() as s:
        return TaskRepository(s)

async def get_note_repo(session: AsyncSession = None) -> NoteRepository:
    if session:
        return NoteRepository(session)
    async with AsyncSessionLocal() as s:
        return NoteRepository(s)

async def get_checkin_repo(session: AsyncSession = None) -> CheckinRepository:
    if session:
        return CheckinRepository(session)
    async with AsyncSessionLocal() as s:
        return CheckinRepository(s)

def get_db_repo():
    return db_repo

