from typing import List, Optional
from uuid import UUID
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from db.models.task import Task
from db.repositories.base import BaseRepository

class TaskRepository(BaseRepository[Task]):
    def __init__(self, session: AsyncSession):
        super().__init__(Task, session)

    async def get_by_user_and_date(self, user_id: UUID, task_date: date) -> List[Task]:
        query = select(Task).where(
            and_(
                Task.user_id == user_id,
                Task.date == task_date
            )
        ).order_by(Task.datetime)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_by_user_and_date_range(self, user_id: UUID, start_date: date, end_date: date) -> List[Task]:
        query = select(Task).where(
            and_(
                Task.user_id == user_id,
                Task.date >= start_date,
                Task.date <= end_date
            )
        ).order_by(Task.datetime)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_incomplete_by_user(self, user_id: UUID) -> List[Task]:
        query = select(Task).where(
            and_(
                Task.user_id == user_id,
                Task.completed == False
            )
        ).order_by(Task.datetime)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_upcoming_by_user(self, user_id: UUID, after: datetime) -> List[Task]:
        query = select(Task).where(
            and_(
                Task.user_id == user_id,
                Task.datetime > after
            )
        ).order_by(Task.datetime)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_overdue_by_user(self, user_id: UUID, before: datetime) -> List[Task]:
        query = select(Task).where(
            and_(
                Task.user_id == user_id,
                Task.datetime < before,
                Task.completed == False
            )
        ).order_by(Task.datetime)
        result = await self.session.execute(query)
        return list(result.scalars().all())

