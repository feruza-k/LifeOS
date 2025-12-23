"""Repository for managing global notes."""

from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from db.models.global_note import GlobalNote
from db.repositories.base import BaseRepository


class GlobalNoteRepository(BaseRepository[GlobalNote]):
    """Manages CRUD operations for GlobalNote objects."""
    def __init__(self, session: AsyncSession):
        super().__init__(GlobalNote, session)

    async def list_by_user_ordered(self, user_id: UUID, limit: Optional[int] = None) -> List[GlobalNote]:
        """Retrieve all global notes for a user, ordered by most recently updated."""
        query = select(GlobalNote).where(GlobalNote.user_id == user_id).order_by(desc(GlobalNote.updated_at))
        if limit:
            query = query.limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())

