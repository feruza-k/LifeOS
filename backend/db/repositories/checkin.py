from typing import Optional
from uuid import UUID
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from db.models.checkin import Checkin
from db.repositories.base import BaseRepository

class CheckinRepository(BaseRepository[Checkin]):
    def __init__(self, session: AsyncSession):
        super().__init__(Checkin, session)

    async def get_by_user_and_date(self, user_id: UUID, checkin_date: date) -> Optional[Checkin]:
        query = select(Checkin).where(
            and_(
                Checkin.user_id == user_id,
                Checkin.date == checkin_date
            )
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

