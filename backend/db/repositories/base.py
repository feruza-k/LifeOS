from typing import Generic, TypeVar, Type, Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload

ModelType = TypeVar("ModelType")

class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType], session: AsyncSession):
        self.model = model
        self.session = session

    async def create(self, **kwargs) -> ModelType:
        instance = self.model(**kwargs)
        self.session.add(instance)
        await self.session.flush()
        await self.session.refresh(instance)
        return instance

    async def get_by_id(self, id: UUID, user_id: Optional[UUID] = None) -> Optional[ModelType]:
        query = select(self.model).where(self.model.id == id)
        if user_id is not None and hasattr(self.model, "user_id"):
            query = query.where(self.model.user_id == user_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def list_by_user(self, user_id: UUID, limit: Optional[int] = None, offset: int = 0) -> List[ModelType]:
        query = select(self.model).where(self.model.user_id == user_id)
        if limit:
            query = query.limit(limit).offset(offset)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def update(self, id: UUID, user_id: Optional[UUID], **kwargs) -> Optional[ModelType]:
        query = update(self.model).where(self.model.id == id)
        if user_id is not None and hasattr(self.model, "user_id"):
            query = query.where(self.model.user_id == user_id)
        query = query.values(**kwargs).returning(self.model)
        result = await self.session.execute(query)
        instance = result.scalar_one_or_none()
        if instance:
            await self.session.flush()
        return instance

    async def delete(self, id: UUID, user_id: Optional[UUID] = None) -> bool:
        query = delete(self.model).where(self.model.id == id)
        if user_id is not None and hasattr(self.model, "user_id"):
            query = query.where(self.model.user_id == user_id)
        result = await self.session.execute(query)
        await self.session.flush()
        return result.rowcount > 0

