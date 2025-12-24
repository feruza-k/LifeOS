from typing import List, Optional
from uuid import UUID
from datetime import date
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from db.models.context_signal import ContextSignal
from db.repositories.base import BaseRepository

class ContextSignalRepository(BaseRepository[ContextSignal]):
    def __init__(self, session: AsyncSession):
        super().__init__(ContextSignal, session)
    
    async def get_by_user_and_week(self, user_id: UUID, week_start: date) -> Optional[ContextSignal]:
        """Get context signal for a specific user and week."""
        query = select(ContextSignal).where(
            ContextSignal.user_id == user_id,
            ContextSignal.week_start == week_start
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def get_recent_signals(self, user_id: UUID, limit: int = 4) -> List[ContextSignal]:
        """Get most recent context signals for a user (for drift detection)."""
        query = select(ContextSignal).where(
            ContextSignal.user_id == user_id
        ).order_by(desc(ContextSignal.week_start)).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def upsert_signal(self, user_id: UUID, week_start: date, signals_json: dict) -> ContextSignal:
        """Create or update context signal for a week."""
        existing = await self.get_by_user_and_week(user_id, week_start)
        
        if existing:
            existing.signals_json = signals_json
            await self.session.commit()
            await self.session.refresh(existing)
            return existing
        else:
            new_signal = ContextSignal(
                user_id=user_id,
                week_start=week_start,
                signals_json=signals_json
            )
            self.session.add(new_signal)
            await self.session.commit()
            await self.session.refresh(new_signal)
            return new_signal

