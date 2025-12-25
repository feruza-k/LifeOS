"""Memory repository with retrieval methods."""

from typing import List, Optional, TYPE_CHECKING
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc, func
from sqlalchemy.orm import selectinload
from db.models.memory import Memory
from db.repositories.base import BaseRepository
from app.ai.memory_taxonomy import MemoryType

if TYPE_CHECKING:
    from app.ai.memory_candidate import MemoryCandidate


class MemoryRepository(BaseRepository[Memory]):
    """Repository for memory storage and retrieval."""
    
    def __init__(self, session: AsyncSession):
        super().__init__(Memory, session)

    async def get_by_user_and_category(self, user_id: UUID, category: str) -> List[Memory]:
        """Legacy method: Get memories by user and category."""
        query = select(Memory).where(
            and_(
                Memory.user_id == user_id,
                Memory.category == category
            )
        ).order_by(Memory.created_at.desc())
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_by_type(
        self,
        user_id: UUID,
        memory_type: MemoryType,
        limit: Optional[int] = None
    ) -> List[Memory]:
        query = select(Memory).where(
            and_(
                Memory.user_id == user_id,
                Memory.memory_type == memory_type.value
            )
        ).order_by(
            desc(Memory.confidence),
            desc(Memory.created_at)
        )
        
        if limit:
            query = query.limit(limit)
        
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_top_memories(
        self,
        user_id: UUID,
        limit: int = 3,
        memory_types: Optional[List[MemoryType]] = None
    ) -> List[Memory]:
        """Get top N memories ordered by confidence then recency."""
        query = select(Memory).where(
            Memory.user_id == user_id
        )
        
        # Filter by type if specified
        if memory_types:
            type_values = [mt.value for mt in memory_types]
            query = query.where(Memory.memory_type.in_(type_values))
        
        # Order by relevance: confidence first, then recency
        query = query.order_by(
            desc(Memory.confidence),
            desc(Memory.created_at)
        ).limit(limit)
        
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_high_confidence_memories(
        self,
        user_id: UUID,
        min_confidence: float = 0.80,
        limit: Optional[int] = None
    ) -> List[Memory]:
        query = select(Memory).where(
            and_(
                Memory.user_id == user_id,
                Memory.confidence >= min_confidence
            )
        ).order_by(
            desc(Memory.confidence),
            desc(Memory.created_at)
        )
        
        if limit:
            query = query.limit(limit)
        
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_by_source(
        self,
        user_id: UUID,
        source: str,
        limit: Optional[int] = None
    ) -> List[Memory]:
        query = select(Memory).where(
            and_(
                Memory.user_id == user_id,
                Memory.source == source
            )
        ).order_by(desc(Memory.created_at))
        
        if limit:
            query = query.limit(limit)
        
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def create_from_candidate(
        self,
        user_id: UUID,
        candidate: "MemoryCandidate"
    ) -> Memory:
        """Create Memory from validated candidate."""
        if not candidate.should_store:
            raise ValueError(
                f"Cannot create memory from candidate that doesn't meet policy: "
                f"{', '.join(candidate.validation_errors)}"
            )
        
        return await self.create(
            user_id=user_id,
            content=candidate.content,
            memory_type=candidate.memory_type.value,
            confidence=float(candidate.confidence),
            source=candidate.source,
            extra_data=candidate.metadata,
        )
    
    async def count_by_user(self, user_id: UUID) -> int:
        """Get total count of memories for a user."""
        query = select(func.count(Memory.id)).where(
            Memory.user_id == user_id
        )
        result = await self.session.execute(query)
        return result.scalar() or 0
    
    async def get_recent_memories(
        self,
        user_id: UUID,
        days: int = 30,
        limit: Optional[int] = None
    ) -> List[Memory]:
        from datetime import datetime, timedelta
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        query = select(Memory).where(
            and_(
                Memory.user_id == user_id,
                Memory.created_at >= cutoff_date
            )
        ).order_by(desc(Memory.created_at))
        
        if limit:
            query = query.limit(limit)
        
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_relevant_memories(
        self,
        user_id: UUID,
        conversation_context: str,
        limit: int = 5
    ) -> List[Memory]:
        """Get memories relevant to the conversation context using keyword matching."""
        import re
        from datetime import datetime
        
        # Extract keywords from conversation
        words = re.findall(r'\b\w+\b', conversation_context.lower())
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'}
        keywords = [w for w in words if len(w) > 3 and w not in stop_words]
        
        if not keywords:
            return await self.get_top_memories(user_id, limit=limit)
        
        # Get all memories for the user
        query = select(Memory).where(Memory.user_id == user_id)
        result = await self.session.execute(query)
        all_memories = list(result.scalars().all())
        
        # Score memories by keyword matches
        scored = []
        for memory in all_memories:
            content_lower = memory.content.lower()
            matches = sum(1 for keyword in keywords if keyword in content_lower)
            if matches > 0:
                recency_days = (datetime.utcnow() - memory.created_at).days if memory.created_at else 365
                recency_factor = max(0.5, 1.0 - (recency_days / 365.0))
                score = matches * float(memory.confidence) * recency_factor
                scored.append((score, memory))
        
        # Sort by score and return top N
        scored.sort(key=lambda x: x[0], reverse=True)
        result_memories = [memory for _, memory in scored[:limit]]
        
        # Log for debugging (can be removed later)
        import logging
        logger = logging.getLogger(__name__)
        if result_memories:
            logger.debug(
                f"[Memory Retrieval] Found {len(result_memories)} relevant memories "
                f"(keywords: {keywords[:5]})"
            )
        
        return result_memories

