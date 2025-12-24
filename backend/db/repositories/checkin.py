from typing import Optional, List
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
    
    async def get_by_user_and_date_range(self, user_id: UUID, start_date: date, end_date: date) -> List[Checkin]:
        """Get all check-ins for a user within a date range."""
        query = select(Checkin).where(
            and_(
                Checkin.user_id == user_id,
                Checkin.date >= start_date,
                Checkin.date <= end_date
            )
        ).order_by(Checkin.date)
        result = await self.session.execute(query)
        return list(result.scalars().all())

