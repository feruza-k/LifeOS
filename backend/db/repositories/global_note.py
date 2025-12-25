"""Repository for managing global notes."""

from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, asc, func
from db.models.global_note import GlobalNote
from db.repositories.base import BaseRepository


class GlobalNoteRepository(BaseRepository[GlobalNote]):
    """Manages CRUD operations for GlobalNote objects."""
    def __init__(self, session: AsyncSession):
        super().__init__(GlobalNote, session)

    async def list_by_user_ordered(
        self, 
        user_id: UUID, 
        limit: Optional[int] = None,
        include_archived: bool = False,
        sort_by: str = "updated_at",
        pinned_only: bool = False
    ) -> List[GlobalNote]:
        """Retrieve all global notes for a user with filtering and sorting."""
        query = select(GlobalNote).where(GlobalNote.user_id == user_id)
        
        # Filter archived
        if not include_archived:
            query = query.where(GlobalNote.archived == False)
        
        # Filter pinned
        if pinned_only:
            query = query.where(GlobalNote.pinned == True)
        
        # Sorting
        if sort_by == "updated_at":
            query = query.order_by(desc(GlobalNote.pinned), desc(GlobalNote.updated_at))
        elif sort_by == "created_at":
            query = query.order_by(desc(GlobalNote.pinned), desc(GlobalNote.created_at))
        elif sort_by == "title":
            query = query.order_by(desc(GlobalNote.pinned), asc(GlobalNote.title))
        else:
            query = query.order_by(desc(GlobalNote.pinned), desc(GlobalNote.updated_at))
        
        if limit:
            query = query.limit(limit)
        
        result = await self.session.execute(query)
        return list(result.scalars().all())

