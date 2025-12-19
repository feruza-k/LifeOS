from typing import List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from db.models.memory import Memory
from db.repositories.base import BaseRepository

class MemoryRepository(BaseRepository[Memory]):
    def __init__(self, session: AsyncSession):
        super().__init__(Memory, session)

    async def get_by_user_and_category(self, user_id: UUID, category: str) -> List[Memory]:
        query = select(Memory).where(
            and_(
                Memory.user_id == user_id,
                Memory.category == category
            )
        ).order_by(Memory.created_at.desc())
        result = await self.session.execute(query)
        return list(result.scalars().all())

