from typing import Optional
from uuid import UUID
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from db.models.note import Note
from db.repositories.base import BaseRepository

class NoteRepository(BaseRepository[Note]):
    def __init__(self, session: AsyncSession):
        super().__init__(Note, session)

    async def get_by_user_and_date(self, user_id: UUID, note_date: date) -> Optional[Note]:
        query = select(Note).where(
            and_(
                Note.user_id == user_id,
                Note.date == note_date
            )
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

